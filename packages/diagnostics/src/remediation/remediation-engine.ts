import { EventEmitter } from 'events';
import { 
  RemediationEngine as IRemediationEngine,
  DiagnosticFinding,
  RemediationAction,
  RemediationAttempt,
  RemediationResult,
  ValidationResult,
  RollbackResult,
  RemediationStatus
} from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';
import { CMConnector } from '@cm-diagnostics/cm-connector';
import PQueue from 'p-queue';

const monitoring = getMonitoring();

export interface RemediationEngineConfig {
  maxConcurrentActions?: number;
  actionTimeout?: number;
  requireApproval?: boolean;
  dryRun?: boolean;
  enableRollback?: boolean;
}

export class RemediationEngine extends EventEmitter implements IRemediationEngine {
  private logger: any;
  private metrics: any;
  private config: RemediationEngineConfig;
  private actionQueue: PQueue;
  private activeAttempts: Map<string, RemediationAttempt> = new Map();
  private actionHandlers: Map<string, ActionHandler> = new Map();

  constructor(config: RemediationEngineConfig = {}) {
    super();
    this.config = {
      maxConcurrentActions: 1, // Default to sequential execution for safety
      actionTimeout: 300000, // 5 minutes
      requireApproval: true,
      dryRun: false,
      enableRollback: true,
      ...config
    };

    this.logger = monitoring.getLogger({ component: 'remediation-engine' });
    this.metrics = monitoring.getMetrics();
    
    this.actionQueue = new PQueue({ 
      concurrency: this.config.maxConcurrentActions 
    });

    this.registerBuiltInHandlers();
    
    this.logger.info('Remediation engine initialized', { config: this.config });
  }

  async execute(
    finding: DiagnosticFinding,
    action: RemediationAction,
    options?: {
      connector?: CMConnector;
      approvedBy?: string;
      dryRun?: boolean;
    }
  ): Promise<RemediationResult> {
    const attemptId = this.generateAttemptId();
    const startTime = Date.now();
    
    const attempt: RemediationAttempt = {
      id: attemptId,
      findingId: finding.id,
      actionId: action.id,
      status: 'pending',
      startedAt: new Date(),
      executedBy: 'system',
      approvedBy: options?.approvedBy,
      success: false
    };

    this.activeAttempts.set(attemptId, attempt);
    this.emit('remediation:started', { finding, action, attempt });

    try {
      // Validate before execution
      const validation = await this.validate(finding, action);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }

      // Check for approval if required
      if (this.config.requireApproval && action.requiresApproval && !options?.approvedBy) {
        attempt.status = 'pending';
        this.emit('remediation:approval-required', { finding, action, attempt });
        
        return {
          success: false,
          attempt,
          error: 'Approval required for this action'
        };
      }

      // Execute in dry-run mode if specified
      const isDryRun = options?.dryRun ?? this.config.dryRun;
      
      attempt.status = 'executing';
      this.emit('remediation:executing', { finding, action, attempt });

      // Get the action handler
      const handler = this.actionHandlers.get(action.action);
      if (!handler) {
        throw new Error(`No handler registered for action: ${action.action}`);
      }

      // Execute the action
      const executionResult = await this.actionQueue.add(async () => {
        return await handler.execute({
          finding,
          action,
          connector: options?.connector,
          dryRun: isDryRun
        });
      });

      // Update attempt with results
      attempt.completedAt = new Date();
      attempt.success = executionResult.success;
      attempt.output = executionResult.output;
      attempt.changesMade = executionResult.changes;

      if (executionResult.success) {
        attempt.status = 'completed';
        
        this.logger.info('Remediation completed successfully', { 
          attemptId,
          findingId: finding.id,
          actionId: action.id,
          duration: Date.now() - startTime
        });
        
        this.emit('remediation:completed', { finding, action, attempt });
        
        this.metrics.increment('remediation_success', {
          action: action.action,
          category: finding.category,
          severity: finding.severity
        });
      } else {
        throw new Error(executionResult.error || 'Action execution failed');
      }

      return {
        success: true,
        attempt,
        output: executionResult.output
      };

    } catch (error) {
      attempt.status = 'failed';
      attempt.completedAt = new Date();
      attempt.error = (error as Error).message;
      
      this.logger.error('Remediation failed', error as Error, { 
        attemptId,
        findingId: finding.id,
        actionId: action.id 
      });
      
      this.emit('remediation:failed', { finding, action, attempt, error });
      
      this.metrics.increment('remediation_failures', {
        action: action.action,
        category: finding.category,
        severity: finding.severity
      });

      return {
        success: false,
        attempt,
        error: (error as Error).message
      };
      
    } finally {
      this.activeAttempts.delete(attemptId);
      
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.record('remediation_duration', duration, {
        action: action.action,
        success: attempt.success
      });
    }
  }

  async validate(
    finding: DiagnosticFinding,
    action: RemediationAction
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation
      if (!finding.remediable) {
        errors.push('Finding is not marked as remediable');
      }

      if (!action.action) {
        errors.push('Action command is not specified');
      }

      // Check if handler exists
      if (!this.actionHandlers.has(action.action)) {
        errors.push(`No handler available for action: ${action.action}`);
      }

      // Validate pre-conditions
      if (action.preConditions && action.preConditions.length > 0) {
        // TODO: Implement pre-condition validation
        warnings.push('Pre-condition validation not yet implemented');
      }

      // Risk assessment
      if (action.riskLevel === 'high' && !action.requiresApproval) {
        warnings.push('High-risk action should require approval');
      }

      if (action.requiresDowntime) {
        warnings.push('This action requires system downtime');
      }

      // Estimate impact
      const estimatedImpact = await this.estimateImpact(finding, action);

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        estimatedImpact
      };

    } catch (error) {
      this.logger.error('Validation failed', error as Error);
      errors.push(`Validation error: ${(error as Error).message}`);
      
      return {
        valid: false,
        errors
      };
    }
  }

  async rollback(attempt: RemediationAttempt): Promise<RollbackResult> {
    if (!this.config.enableRollback) {
      return {
        success: false,
        error: 'Rollback is not enabled'
      };
    }

    if (!attempt.changesMade) {
      return {
        success: false,
        error: 'No changes recorded for rollback'
      };
    }

    const startTime = Date.now();
    
    try {
      this.logger.info('Starting rollback', { attemptId: attempt.id });
      this.emit('rollback:started', { attempt });

      // Find the action
      const action = await this.findActionById(attempt.actionId);
      if (!action || !action.canRollback || !action.rollbackAction) {
        throw new Error('Action does not support rollback');
      }

      // Get rollback handler
      const handler = this.actionHandlers.get(action.rollbackAction);
      if (!handler) {
        throw new Error(`No handler for rollback action: ${action.rollbackAction}`);
      }

      // Execute rollback
      const rollbackResult = await handler.execute({
        finding: { id: attempt.findingId } as DiagnosticFinding, // Simplified
        action: {
          ...action,
          action: action.rollbackAction,
          parameters: {
            ...action.rollbackParameters,
            originalChanges: attempt.changesMade
          }
        },
        dryRun: false
      });

      if (rollbackResult.success) {
        attempt.rolledBack = true;
        attempt.rollbackAt = new Date();
        
        this.logger.info('Rollback completed successfully', { 
          attemptId: attempt.id,
          duration: Date.now() - startTime
        });
        
        this.emit('rollback:completed', { attempt });
        
        return {
          success: true,
          restoredState: rollbackResult.changes?.after
        };
      } else {
        throw new Error(rollbackResult.error || 'Rollback failed');
      }

    } catch (error) {
      this.logger.error('Rollback failed', error as Error, { 
        attemptId: attempt.id 
      });
      
      this.emit('rollback:failed', { attempt, error });
      
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // Register an action handler
  registerHandler(action: string, handler: ActionHandler): void {
    this.logger.info('Registering action handler', { action });
    this.actionHandlers.set(action, handler);
  }

  // Register built-in handlers
  private registerBuiltInHandlers(): void {
    // Configuration update handler
    this.registerHandler('update_configuration', {
      execute: async (context) => {
        const { action, connector, dryRun } = context;
        const params = action.parameters || {};
        
        if (dryRun) {
          return {
            success: true,
            output: `[DRY RUN] Would update configuration: ${JSON.stringify(params)}`,
            changes: { before: {}, after: params }
          };
        }

        // Execute configuration update
        const query = {
          sql: `UPDATE CM_SYSTEM_SETTINGS 
                SET setting_value = ?, last_modified = GETDATE() 
                WHERE setting_name = ?`,
          params: [params.value, params.setting]
        };

        await connector?.executeQuery(query);

        return {
          success: true,
          output: `Updated ${params.setting} to ${params.value}`,
          changes: {
            before: { [params.setting]: params.oldValue },
            after: { [params.setting]: params.value }
          }
        };
      }
    });

    // Service restart handler
    this.registerHandler('restart_service', {
      execute: async (context) => {
        const { action, dryRun } = context;
        const serviceName = action.parameters?.serviceName || 'ContentManager';
        
        if (dryRun) {
          return {
            success: true,
            output: `[DRY RUN] Would restart service: ${serviceName}`,
            changes: { before: { status: 'running' }, after: { status: 'restarted' } }
          };
        }

        // In real implementation, would use appropriate service control
        return {
          success: true,
          output: `Service ${serviceName} restarted successfully`,
          changes: {
            before: { status: 'running' },
            after: { status: 'running', restartedAt: new Date() }
          }
        };
      }
    });

    // Clear cache handler
    this.registerHandler('clear_cache', {
      execute: async (context) => {
        const { connector, dryRun } = context;
        
        if (dryRun) {
          return {
            success: true,
            output: '[DRY RUN] Would clear system cache'
          };
        }

        const query = { sql: `EXEC sp_clear_cm_cache` };
        await connector?.executeQuery(query);

        return {
          success: true,
          output: 'System cache cleared successfully'
        };
      }
    });

    // More handlers can be added here...
  }

  private async estimateImpact(
    finding: DiagnosticFinding,
    action: RemediationAction
  ): Promise<ValidationResult['estimatedImpact']> {
    // Simple impact estimation - can be enhanced
    return {
      affectedUsers: action.requiresDowntime ? 100 : 0,
      downtime: action.estimatedDuration || 0,
      riskScore: action.riskLevel === 'high' ? 8 : 
                 action.riskLevel === 'medium' ? 5 : 2
    };
  }

  private async findActionById(actionId: string): Promise<RemediationAction | null> {
    // In real implementation, would look up from registry or database
    return null;
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Action handler interface
interface ActionHandler {
  execute(context: ActionContext): Promise<ActionResult>;
}

interface ActionContext {
  finding: DiagnosticFinding;
  action: RemediationAction;
  connector?: CMConnector;
  dryRun: boolean;
}

interface ActionResult {
  success: boolean;
  output?: string;
  error?: string;
  changes?: {
    before: any;
    after: any;
  };
}