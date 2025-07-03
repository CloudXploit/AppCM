import { Logger } from '@cm-diagnostics/logger';
import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import type { RemediationAction, RemediationContext } from '../types';
import { RemediationEngine } from './remediation-engine';
import { backupSystem } from './backup-system';
import { impactAnalyzer } from './impact-analyzer';

export interface ScheduledRemediation {
  id: string;
  name: string;
  description: string;
  action: RemediationAction;
  schedule: ScheduleConfig;
  conditions: ExecutionCondition[];
  options: ScheduleOptions;
  status: ScheduleStatus;
  metadata: ScheduleMetadata;
}

export interface ScheduleConfig {
  type: 'once' | 'recurring' | 'conditional';
  cronExpression?: string;
  executeAt?: Date;
  timezone?: string;
  retryPolicy?: RetryPolicy;
}

export interface ExecutionCondition {
  type: 'time_window' | 'system_load' | 'dependency' | 'approval' | 'custom';
  config: any;
  required: boolean;
}

export interface ScheduleOptions {
  priority: 'low' | 'normal' | 'high' | 'critical';
  maxExecutionTime?: number; // milliseconds
  requiresApproval?: boolean;
  notifyBefore?: number; // minutes
  backupBeforeExecution?: boolean;
  testBeforeExecution?: boolean;
  maintenanceMode?: boolean;
}

export interface ScheduleStatus {
  state: 'scheduled' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  lastExecution?: Date;
  nextExecution?: Date;
  executionCount: number;
  failureCount: number;
  averageExecutionTime?: number;
}

export interface ScheduleMetadata {
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  relatedIssues: string[];
}

export interface RetryPolicy {
  maxRetries: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  initialDelay: number; // milliseconds
  maxDelay?: number;
}

export interface ExecutionResult {
  scheduledRemediationId: string;
  executionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  error?: string;
  changes: any[];
  rollbackAvailable: boolean;
}

export interface EmergencyStopRequest {
  reason: string;
  requestedBy: string;
  force: boolean;
  rollback: boolean;
}

export class RemediationScheduler extends EventEmitter {
  private logger: Logger;
  private schedules: Map<string, ScheduledRemediation> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private activeExecutions: Map<string, ExecutionContext> = new Map();
  private emergencyStopSignals: Map<string, EmergencyStopRequest> = new Map();
  private engine: RemediationEngine;
  private executionHistory: Map<string, ExecutionResult[]> = new Map();
  private maintenanceMode = false;

  constructor(engine: RemediationEngine) {
    super();
    this.logger = new Logger('RemediationScheduler');
    this.engine = engine;
    this.startExecutionMonitor();
  }

  async scheduleRemediation(
    remediation: Omit<ScheduledRemediation, 'id' | 'status'>
  ): Promise<ScheduledRemediation> {
    const id = this.generateScheduleId();
    
    const scheduled: ScheduledRemediation = {
      id,
      ...remediation,
      status: {
        state: 'scheduled',
        executionCount: 0,
        failureCount: 0
      }
    };

    // Validate schedule configuration
    this.validateSchedule(scheduled);

    // Calculate next execution time
    scheduled.status.nextExecution = this.calculateNextExecution(scheduled);

    // Set up scheduling based on type
    if (scheduled.schedule.type === 'recurring' && scheduled.schedule.cronExpression) {
      this.setupCronJob(scheduled);
    } else if (scheduled.schedule.type === 'once' && scheduled.schedule.executeAt) {
      this.setupOneTimeExecution(scheduled);
    }

    this.schedules.set(id, scheduled);
    this.emit('scheduled', scheduled);
    
    this.logger.info(`Scheduled remediation: ${scheduled.name}`, {
      id,
      nextExecution: scheduled.status.nextExecution
    });

    return scheduled;
  }

  async executeScheduledRemediation(
    scheduledId: string,
    context: RemediationContext
  ): Promise<ExecutionResult> {
    const scheduled = this.schedules.get(scheduledId);
    if (!scheduled) {
      throw new Error(`Scheduled remediation not found: ${scheduledId}`);
    }

    const executionId = this.generateExecutionId();
    const executionContext: ExecutionContext = {
      scheduledId,
      executionId,
      startTime: new Date(),
      context,
      abortController: new AbortController()
    };

    this.activeExecutions.set(executionId, executionContext);
    scheduled.status.state = 'running';

    try {
      // Check pre-execution conditions
      await this.checkExecutionConditions(scheduled, context);

      // Send notifications if configured
      if (scheduled.options.notifyBefore) {
        await this.sendPreExecutionNotification(scheduled);
      }

      // Create backup if requested
      if (scheduled.options.backupBeforeExecution) {
        await backupSystem.createBackup(context, executionId, {
          type: 'full',
          priority: 'high',
          retentionDays: 7
        });
      }

      // Run test if requested
      if (scheduled.options.testBeforeExecution) {
        await this.runPreExecutionTest(scheduled, context);
      }

      // Enable maintenance mode if requested
      if (scheduled.options.maintenanceMode) {
        await this.enableMaintenanceMode();
      }

      // Execute the remediation
      const result = await this.executeWithTimeout(
        scheduled,
        context,
        executionContext
      );

      // Update status
      scheduled.status.state = 'completed';
      scheduled.status.lastExecution = new Date();
      scheduled.status.executionCount++;
      
      // Calculate next execution for recurring schedules
      if (scheduled.schedule.type === 'recurring') {
        scheduled.status.nextExecution = this.calculateNextExecution(scheduled);
      }

      const executionResult: ExecutionResult = {
        scheduledRemediationId: scheduledId,
        executionId,
        startTime: executionContext.startTime,
        endTime: new Date(),
        duration: Date.now() - executionContext.startTime.getTime(),
        success: true,
        changes: result.changes || [],
        rollbackAvailable: result.rollbackAvailable || false
      };

      // Store execution history
      this.addToHistory(scheduledId, executionResult);
      
      // Update average execution time
      this.updateAverageExecutionTime(scheduled);

      this.emit('execution-completed', executionResult);
      return executionResult;

    } catch (error) {
      scheduled.status.state = 'failed';
      scheduled.status.failureCount++;

      const executionResult: ExecutionResult = {
        scheduledRemediationId: scheduledId,
        executionId,
        startTime: executionContext.startTime,
        endTime: new Date(),
        duration: Date.now() - executionContext.startTime.getTime(),
        success: false,
        error: error.message,
        changes: [],
        rollbackAvailable: false
      };

      // Store execution history
      this.addToHistory(scheduledId, executionResult);

      // Handle retry if configured
      if (scheduled.schedule.retryPolicy) {
        await this.handleRetry(scheduled, context, error);
      }

      this.emit('execution-failed', executionResult);
      throw error;

    } finally {
      // Cleanup
      this.activeExecutions.delete(executionId);
      
      // Disable maintenance mode if it was enabled
      if (scheduled.options.maintenanceMode && this.maintenanceMode) {
        await this.disableMaintenanceMode();
      }
    }
  }

  async cancelScheduledRemediation(
    scheduledId: string,
    reason: string
  ): Promise<void> {
    const scheduled = this.schedules.get(scheduledId);
    if (!scheduled) {
      throw new Error(`Scheduled remediation not found: ${scheduledId}`);
    }

    // Cancel cron job if exists
    const cronJob = this.cronJobs.get(scheduledId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(scheduledId);
    }

    // Update status
    scheduled.status.state = 'cancelled';
    
    this.logger.info(`Cancelled scheduled remediation: ${scheduled.name}`, { reason });
    this.emit('cancelled', { scheduledId, reason });
  }

  async emergencyStop(
    executionId: string,
    request: EmergencyStopRequest
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`No active execution found: ${executionId}`);
    }

    this.logger.warn(`Emergency stop requested for execution ${executionId}`, request);
    
    // Store the stop request
    this.emergencyStopSignals.set(executionId, request);
    
    // Signal abort
    execution.abortController.abort();
    
    // If force stop is requested, attempt immediate termination
    if (request.force) {
      await this.forceStopExecution(execution, request);
    }

    // If rollback is requested, schedule it
    if (request.rollback) {
      await this.scheduleEmergencyRollback(execution, request);
    }

    this.emit('emergency-stop', { executionId, request });
  }

  getScheduledRemediations(filter?: {
    state?: ScheduleStatus['state'];
    priority?: ScheduleOptions['priority'];
    tags?: string[];
  }): ScheduledRemediation[] {
    let remediations = Array.from(this.schedules.values());

    if (filter) {
      if (filter.state) {
        remediations = remediations.filter(r => r.status.state === filter.state);
      }
      if (filter.priority) {
        remediations = remediations.filter(r => r.options.priority === filter.priority);
      }
      if (filter.tags && filter.tags.length > 0) {
        remediations = remediations.filter(r => 
          filter.tags!.some(tag => r.metadata.tags.includes(tag))
        );
      }
    }

    return remediations;
  }

  getExecutionHistory(
    scheduledId: string,
    limit?: number
  ): ExecutionResult[] {
    const history = this.executionHistory.get(scheduledId) || [];
    return limit ? history.slice(-limit) : history;
  }

  async updateSchedule(
    scheduledId: string,
    updates: Partial<ScheduledRemediation>
  ): Promise<ScheduledRemediation> {
    const scheduled = this.schedules.get(scheduledId);
    if (!scheduled) {
      throw new Error(`Scheduled remediation not found: ${scheduledId}`);
    }

    // Cancel existing cron job if schedule is changing
    if (updates.schedule) {
      const cronJob = this.cronJobs.get(scheduledId);
      if (cronJob) {
        cronJob.stop();
        this.cronJobs.delete(scheduledId);
      }
    }

    // Apply updates
    Object.assign(scheduled, updates);
    scheduled.metadata.updatedAt = new Date();

    // Recalculate next execution
    if (updates.schedule) {
      scheduled.status.nextExecution = this.calculateNextExecution(scheduled);
      
      // Set up new scheduling
      if (scheduled.schedule.type === 'recurring' && scheduled.schedule.cronExpression) {
        this.setupCronJob(scheduled);
      }
    }

    this.emit('updated', scheduled);
    return scheduled;
  }

  isInMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  private validateSchedule(scheduled: ScheduledRemediation): void {
    if (scheduled.schedule.type === 'recurring' && !scheduled.schedule.cronExpression) {
      throw new Error('Cron expression required for recurring schedule');
    }

    if (scheduled.schedule.type === 'once' && !scheduled.schedule.executeAt) {
      throw new Error('Execution time required for one-time schedule');
    }

    if (scheduled.schedule.cronExpression) {
      if (!cron.validate(scheduled.schedule.cronExpression)) {
        throw new Error('Invalid cron expression');
      }
    }
  }

  private setupCronJob(scheduled: ScheduledRemediation): void {
    if (!scheduled.schedule.cronExpression) return;

    const job = cron.schedule(
      scheduled.schedule.cronExpression,
      async () => {
        try {
          // Create context for execution
          const context = await this.createExecutionContext(scheduled);
          await this.executeScheduledRemediation(scheduled.id, context);
        } catch (error) {
          this.logger.error(`Failed to execute scheduled remediation ${scheduled.id}`, error);
        }
      },
      {
        scheduled: true,
        timezone: scheduled.schedule.timezone
      }
    );

    this.cronJobs.set(scheduled.id, job);
  }

  private setupOneTimeExecution(scheduled: ScheduledRemediation): void {
    if (!scheduled.schedule.executeAt) return;

    const delay = scheduled.schedule.executeAt.getTime() - Date.now();
    if (delay <= 0) {
      this.logger.warn(`Scheduled execution time is in the past for ${scheduled.id}`);
      return;
    }

    setTimeout(async () => {
      try {
        const context = await this.createExecutionContext(scheduled);
        await this.executeScheduledRemediation(scheduled.id, context);
      } catch (error) {
        this.logger.error(`Failed to execute scheduled remediation ${scheduled.id}`, error);
      }
    }, delay);
  }

  private calculateNextExecution(scheduled: ScheduledRemediation): Date | undefined {
    if (scheduled.schedule.type === 'once') {
      return scheduled.schedule.executeAt;
    }

    if (scheduled.schedule.type === 'recurring' && scheduled.schedule.cronExpression) {
      // Parse cron expression to get next execution time
      // This is a simplified implementation
      const interval = cron.schedule(scheduled.schedule.cronExpression, () => {});
      const next = new Date();
      // In a real implementation, we'd calculate the actual next execution time
      return next;
    }

    return undefined;
  }

  private async checkExecutionConditions(
    scheduled: ScheduledRemediation,
    context: RemediationContext
  ): Promise<void> {
    for (const condition of scheduled.conditions) {
      const met = await this.evaluateCondition(condition, context);
      
      if (!met && condition.required) {
        throw new Error(`Required condition not met: ${condition.type}`);
      }
    }
  }

  private async evaluateCondition(
    condition: ExecutionCondition,
    context: RemediationContext
  ): Promise<boolean> {
    switch (condition.type) {
      case 'time_window':
        return this.isInTimeWindow(condition.config);
        
      case 'system_load':
        const systemInfo = await context.getSystemInfo();
        return systemInfo.cpu < condition.config.maxCpu && 
               systemInfo.memory < condition.config.maxMemory;
               
      case 'dependency':
        // Check if dependent remediations have completed
        return this.checkDependencies(condition.config.dependencies);
        
      case 'approval':
        // Check if approval has been granted
        return this.checkApproval(condition.config.approvalId);
        
      case 'custom':
        // Execute custom condition function
        return condition.config.evaluate(context);
        
      default:
        return true;
    }
  }

  private isInTimeWindow(config: any): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    
    return currentHour >= config.startHour && currentHour <= config.endHour;
  }

  private checkDependencies(dependencies: string[]): boolean {
    for (const depId of dependencies) {
      const dep = this.schedules.get(depId);
      if (!dep || dep.status.state !== 'completed') {
        return false;
      }
    }
    return true;
  }

  private checkApproval(approvalId: string): boolean {
    // In a real implementation, this would check the approval system
    return true;
  }

  private async sendPreExecutionNotification(scheduled: ScheduledRemediation): Promise<void> {
    this.emit('pre-execution-notification', {
      scheduledId: scheduled.id,
      name: scheduled.name,
      executeIn: scheduled.options.notifyBefore
    });
  }

  private async runPreExecutionTest(
    scheduled: ScheduledRemediation,
    context: RemediationContext
  ): Promise<void> {
    // Run impact analysis
    const impact = await impactAnalyzer.analyzeImpact(
      scheduled.action,
      { 
        ruleId: 'scheduled',
        severity: 'low',
        category: 'scheduled',
        title: scheduled.name,
        description: scheduled.description
      },
      { cmSystem: {}, cmConnector: {} } as any
    );

    if (impact.risk.level === 'critical') {
      throw new Error('Pre-execution test failed: Critical risk detected');
    }
  }

  private async executeWithTimeout(
    scheduled: ScheduledRemediation,
    context: RemediationContext,
    executionContext: ExecutionContext
  ): Promise<any> {
    const timeout = scheduled.options.maxExecutionTime || 300000; // 5 minutes default
    
    return Promise.race([
      this.executeWithAbort(scheduled, context, executionContext),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      )
    ]);
  }

  private async executeWithAbort(
    scheduled: ScheduledRemediation,
    context: RemediationContext,
    executionContext: ExecutionContext
  ): Promise<any> {
    // Check for abort signal periodically during execution
    const checkAbort = () => {
      if (executionContext.abortController.signal.aborted) {
        throw new Error('Execution aborted');
      }
    };

    // Set up periodic abort checks
    const abortCheckInterval = setInterval(checkAbort, 1000);

    try {
      // Execute the remediation action
      const result = await this.engine.executeRemediation(
        scheduled.action,
        {
          ruleId: 'scheduled',
          severity: 'medium',
          category: 'scheduled',
          title: scheduled.name,
          description: scheduled.description
        },
        { cmSystem: {}, cmConnector: {} } as any
      );

      return result;
    } finally {
      clearInterval(abortCheckInterval);
    }
  }

  private async forceStopExecution(
    execution: ExecutionContext,
    request: EmergencyStopRequest
  ): Promise<void> {
    this.logger.warn(`Force stopping execution ${execution.executionId}`);
    
    // In a real implementation, this would:
    // 1. Kill any running processes
    // 2. Release any held resources
    // 3. Clean up partial changes if possible
    
    this.emit('force-stopped', {
      executionId: execution.executionId,
      reason: request.reason
    });
  }

  private async scheduleEmergencyRollback(
    execution: ExecutionContext,
    request: EmergencyStopRequest
  ): Promise<void> {
    // Schedule an immediate rollback
    await this.scheduleRemediation({
      name: `Emergency Rollback for ${execution.executionId}`,
      description: `Rollback due to emergency stop: ${request.reason}`,
      action: {
        type: 'rollback',
        parameters: {
          originalExecutionId: execution.executionId
        }
      },
      schedule: {
        type: 'once',
        executeAt: new Date()
      },
      conditions: [],
      options: {
        priority: 'critical',
        requiresApproval: false,
        backupBeforeExecution: false,
        testBeforeExecution: false
      },
      metadata: {
        createdBy: request.requestedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['emergency', 'rollback'],
        relatedIssues: [execution.scheduledId]
      }
    });
  }

  private async handleRetry(
    scheduled: ScheduledRemediation,
    context: RemediationContext,
    error: Error
  ): Promise<void> {
    const retryPolicy = scheduled.schedule.retryPolicy;
    if (!retryPolicy) return;

    const retryCount = this.getRetryCount(scheduled.id);
    if (retryCount >= retryPolicy.maxRetries) {
      this.logger.error(`Max retries reached for ${scheduled.id}`);
      return;
    }

    const delay = this.calculateRetryDelay(retryPolicy, retryCount);
    
    this.logger.info(`Scheduling retry ${retryCount + 1} for ${scheduled.id} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.executeScheduledRemediation(scheduled.id, context);
      } catch (retryError) {
        this.logger.error(`Retry failed for ${scheduled.id}`, retryError);
      }
    }, delay);
  }

  private calculateRetryDelay(policy: RetryPolicy, retryCount: number): number {
    switch (policy.backoffType) {
      case 'fixed':
        return policy.initialDelay;
        
      case 'linear':
        return policy.initialDelay * (retryCount + 1);
        
      case 'exponential':
        const delay = policy.initialDelay * Math.pow(2, retryCount);
        return policy.maxDelay ? Math.min(delay, policy.maxDelay) : delay;
        
      default:
        return policy.initialDelay;
    }
  }

  private getRetryCount(scheduledId: string): number {
    const history = this.executionHistory.get(scheduledId) || [];
    
    // Count consecutive failures from the most recent execution
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].success) {
        count++;
      } else {
        break;
      }
    }
    
    return count;
  }

  private addToHistory(scheduledId: string, result: ExecutionResult): void {
    if (!this.executionHistory.has(scheduledId)) {
      this.executionHistory.set(scheduledId, []);
    }
    
    const history = this.executionHistory.get(scheduledId)!;
    history.push(result);
    
    // Keep only last 100 executions
    if (history.length > 100) {
      history.shift();
    }
  }

  private updateAverageExecutionTime(scheduled: ScheduledRemediation): void {
    const history = this.executionHistory.get(scheduled.id) || [];
    if (history.length === 0) return;

    const totalTime = history.reduce((sum, exec) => sum + exec.duration, 0);
    scheduled.status.averageExecutionTime = Math.round(totalTime / history.length);
  }

  private async createExecutionContext(scheduled: ScheduledRemediation): Promise<RemediationContext> {
    // In a real implementation, this would create a proper context
    // based on the scheduled remediation configuration
    return {} as RemediationContext;
  }

  private async enableMaintenanceMode(): Promise<void> {
    this.maintenanceMode = true;
    this.emit('maintenance-mode-enabled');
  }

  private async disableMaintenanceMode(): Promise<void> {
    this.maintenanceMode = false;
    this.emit('maintenance-mode-disabled');
  }

  private startExecutionMonitor(): void {
    // Monitor active executions for issues
    setInterval(() => {
      for (const [executionId, execution] of this.activeExecutions) {
        const runtime = Date.now() - execution.startTime.getTime();
        
        // Alert on long-running executions
        if (runtime > 600000) { // 10 minutes
          this.logger.warn(`Long-running execution detected: ${executionId}`, {
            runtime,
            scheduledId: execution.scheduledId
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private generateScheduleId(): string {
    return `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type definitions
interface ExecutionContext {
  scheduledId: string;
  executionId: string;
  startTime: Date;
  context: RemediationContext;
  abortController: AbortController;
}

// Export scheduler instance
export const remediationScheduler = (engine: RemediationEngine) => new RemediationScheduler(engine);