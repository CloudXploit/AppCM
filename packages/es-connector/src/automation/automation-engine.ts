import { EventEmitter } from 'eventemitter3';
import winston from 'winston';
import { ESClient } from '../api/es-client';
import { ESWorkflowService } from '../workflows/workflow-service';
import { WorkflowBuilder } from '../workflows/workflow-builder';
import { ESWorkflow, ESWorkflowInstance } from '../types';
import PQueue from 'p-queue';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  errorHandling?: {
    retryCount?: number;
    retryDelay?: number;
    fallbackActions?: AutomationAction[];
  };
  metadata?: Record<string, any>;
}

export interface AutomationTrigger {
  type: 'event' | 'schedule' | 'webhook' | 'manual' | 'threshold' | 'pattern';
  configuration: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'regex';
  value: any;
  combineWith?: 'and' | 'or';
}

export interface AutomationAction {
  type: 'workflow' | 'script' | 'api' | 'notification' | 'remediation';
  configuration: Record<string, any>;
  async?: boolean;
  timeout?: number;
}

export interface AutomationContext {
  trigger: any;
  data: Record<string, any>;
  metadata: Record<string, any>;
  startTime: Date;
  history: AutomationHistoryEntry[];
}

export interface AutomationHistoryEntry {
  timestamp: Date;
  action: string;
  status: 'started' | 'completed' | 'failed';
  result?: any;
  error?: any;
  duration?: number;
}

export class AutomationEngine extends EventEmitter {
  private client: ESClient;
  private workflowService: ESWorkflowService;
  private logger: winston.Logger;
  private rules: Map<string, AutomationRule> = new Map();
  private activeAutomations: Map<string, AutomationContext> = new Map();
  private queue: PQueue;
  private scriptExecutors: Map<string, Function> = new Map();
  private remediationHandlers: Map<string, Function> = new Map();

  constructor(
    client: ESClient,
    workflowService: ESWorkflowService,
    options?: {
      maxConcurrency?: number;
      logger?: winston.Logger;
    }
  ) {
    super();
    this.client = client;
    this.workflowService = workflowService;
    this.logger = options?.logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });
    
    this.queue = new PQueue({ 
      concurrency: options?.maxConcurrency || 10 
    });

    this.registerBuiltInHandlers();
  }

  private registerBuiltInHandlers(): void {
    // Register common remediation handlers
    this.registerRemediationHandler('restart-service', async (context) => {
      const serviceName = context.data.serviceName;
      this.logger.info(`Restarting service: ${serviceName}`);
      // Implementation would restart the service
      return { restarted: true, serviceName };
    });

    this.registerRemediationHandler('clear-cache', async (context) => {
      const cacheType = context.data.cacheType;
      this.logger.info(`Clearing cache: ${cacheType}`);
      // Implementation would clear the specified cache
      return { cleared: true, cacheType };
    });

    this.registerRemediationHandler('scale-resources', async (context) => {
      const { resourceType, scaleFactor } = context.data;
      this.logger.info(`Scaling ${resourceType} by factor ${scaleFactor}`);
      // Implementation would scale resources
      return { scaled: true, resourceType, scaleFactor };
    });
  }

  async addRule(rule: AutomationRule): Promise<void> {
    this.rules.set(rule.id, rule);
    
    if (rule.enabled) {
      await this.activateRule(rule);
    }
    
    this.emit('rule:added', rule);
    this.logger.info(`Added automation rule: ${rule.name} (${rule.id})`);
  }

  async removeRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) return;

    await this.deactivateRule(rule);
    this.rules.delete(ruleId);
    
    this.emit('rule:removed', rule);
    this.logger.info(`Removed automation rule: ${rule.name} (${ruleId})`);
  }

  async enableRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.enabled) return;

    rule.enabled = true;
    await this.activateRule(rule);
    
    this.emit('rule:enabled', rule);
    this.logger.info(`Enabled automation rule: ${rule.name} (${ruleId})`);
  }

  async disableRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return;

    rule.enabled = false;
    await this.deactivateRule(rule);
    
    this.emit('rule:disabled', rule);
    this.logger.info(`Disabled automation rule: ${rule.name} (${ruleId})`);
  }

  async executeRule(
    ruleId: string,
    triggerData?: any
  ): Promise<AutomationContext> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const context: AutomationContext = {
      trigger: triggerData || { manual: true },
      data: {},
      metadata: {
        ruleId,
        ruleName: rule.name,
        executionId: this.generateExecutionId()
      },
      startTime: new Date(),
      history: []
    };

    this.activeAutomations.set(context.metadata.executionId, context);
    
    try {
      this.emit('automation:started', { rule, context });
      
      // Check conditions
      if (rule.conditions && !this.evaluateConditions(rule.conditions, context)) {
        this.logger.info(`Conditions not met for rule: ${rule.name}`);
        this.emit('automation:skipped', { rule, context, reason: 'conditions_not_met' });
        return context;
      }

      // Execute actions
      for (const action of rule.actions) {
        await this.executeAction(action, context, rule);
      }

      this.emit('automation:completed', { rule, context });
      
    } catch (error) {
      this.logger.error(`Automation failed for rule ${rule.name}:`, error);
      
      // Handle error
      if (rule.errorHandling) {
        await this.handleError(error, rule, context);
      }
      
      this.emit('automation:failed', { rule, context, error });
      throw error;
      
    } finally {
      this.activeAutomations.delete(context.metadata.executionId);
    }

    return context;
  }

  private async executeAction(
    action: AutomationAction,
    context: AutomationContext,
    rule: AutomationRule
  ): Promise<void> {
    const historyEntry: AutomationHistoryEntry = {
      timestamp: new Date(),
      action: action.type,
      status: 'started'
    };
    
    context.history.push(historyEntry);
    const startTime = Date.now();

    try {
      let result: any;

      switch (action.type) {
        case 'workflow':
          result = await this.executeWorkflowAction(action, context);
          break;
          
        case 'script':
          result = await this.executeScriptAction(action, context);
          break;
          
        case 'api':
          result = await this.executeApiAction(action, context);
          break;
          
        case 'notification':
          result = await this.executeNotificationAction(action, context);
          break;
          
        case 'remediation':
          result = await this.executeRemediationAction(action, context);
          break;
          
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      historyEntry.status = 'completed';
      historyEntry.result = result;
      historyEntry.duration = Date.now() - startTime;
      
      // Store result in context for next actions
      if (result && typeof result === 'object') {
        Object.assign(context.data, result);
      }
      
    } catch (error) {
      historyEntry.status = 'failed';
      historyEntry.error = error;
      historyEntry.duration = Date.now() - startTime;
      throw error;
    }
  }

  private async executeWorkflowAction(
    action: AutomationAction,
    context: AutomationContext
  ): Promise<any> {
    const { workflowId, variables } = action.configuration;
    
    const instance = await this.workflowService.executeWorkflow(workflowId, {
      variables: this.resolveVariables(variables, context),
      async: !action.async,
      timeout: action.timeout
    });

    return {
      workflowInstanceId: instance.id,
      workflowStatus: instance.status
    };
  }

  private async executeScriptAction(
    action: AutomationAction,
    context: AutomationContext
  ): Promise<any> {
    const { scriptId, parameters } = action.configuration;
    
    const executor = this.scriptExecutors.get(scriptId);
    if (!executor) {
      throw new Error(`Script executor not found: ${scriptId}`);
    }

    const resolvedParams = this.resolveVariables(parameters, context);
    return await executor(resolvedParams, context);
  }

  private async executeApiAction(
    action: AutomationAction,
    context: AutomationContext
  ): Promise<any> {
    const { method, endpoint, headers, body } = action.configuration;
    
    const resolvedEndpoint = this.resolveTemplate(endpoint, context);
    const resolvedHeaders = this.resolveVariables(headers, context);
    const resolvedBody = this.resolveVariables(body, context);

    const response = await this.client.request({
      method,
      url: resolvedEndpoint,
      headers: resolvedHeaders,
      data: resolvedBody,
      timeout: action.timeout
    });

    return response.data;
  }

  private async executeNotificationAction(
    action: AutomationAction,
    context: AutomationContext
  ): Promise<any> {
    const { recipients, template, data, channel } = action.configuration;
    
    const notification = {
      recipients: this.resolveVariables(recipients, context),
      template,
      data: this.resolveVariables(data, context),
      channel: channel || 'email',
      metadata: {
        automationId: context.metadata.executionId,
        ruleId: context.metadata.ruleId
      }
    };

    await this.client.post('/notifications/send', notification);
    
    return {
      notificationSent: true,
      recipients: notification.recipients
    };
  }

  private async executeRemediationAction(
    action: AutomationAction,
    context: AutomationContext
  ): Promise<any> {
    const { remediationType, parameters } = action.configuration;
    
    const handler = this.remediationHandlers.get(remediationType);
    if (!handler) {
      throw new Error(`Remediation handler not found: ${remediationType}`);
    }

    const resolvedParams = this.resolveVariables(parameters, context);
    context.data = { ...context.data, ...resolvedParams };
    
    return await handler(context);
  }

  private evaluateConditions(
    conditions: AutomationCondition[],
    context: AutomationContext
  ): boolean {
    let result = true;
    let combineWith: 'and' | 'or' = 'and';

    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(condition.field, context);
      const conditionMet = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      if (combineWith === 'and') {
        result = result && conditionMet;
      } else {
        result = result || conditionMet;
      }

      combineWith = condition.combineWith || 'and';
    }

    return result;
  }

  private evaluateCondition(
    fieldValue: any,
    operator: AutomationCondition['operator'],
    expectedValue: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'regex':
        return new RegExp(expectedValue).test(String(fieldValue));
      default:
        return false;
    }
  }

  private getFieldValue(field: string, context: AutomationContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    return value;
  }

  private resolveVariables(obj: any, context: AutomationContext): any {
    if (typeof obj === 'string') {
      return this.resolveTemplate(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveVariables(item, context));
    }

    if (obj && typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveVariables(value, context);
      }
      return resolved;
    }

    return obj;
  }

  private resolveTemplate(template: string, context: AutomationContext): string {
    return template.replace(/\${([^}]+)}/g, (match, path) => {
      const value = this.getFieldValue(path, context);
      return value !== undefined ? String(value) : match;
    });
  }

  private async handleError(
    error: any,
    rule: AutomationRule,
    context: AutomationContext
  ): Promise<void> {
    const { retryCount = 0, retryDelay = 1000, fallbackActions } = rule.errorHandling || {};

    // Retry logic
    for (let i = 0; i < retryCount; i++) {
      this.logger.info(`Retrying automation (attempt ${i + 1}/${retryCount})`);
      await this.delay(retryDelay * (i + 1));

      try {
        for (const action of rule.actions) {
          await this.executeAction(action, context, rule);
        }
        return; // Success
      } catch (retryError) {
        this.logger.warn(`Retry ${i + 1} failed:`, retryError);
      }
    }

    // Execute fallback actions
    if (fallbackActions) {
      this.logger.info('Executing fallback actions');
      for (const action of fallbackActions) {
        try {
          await this.executeAction(action, context, rule);
        } catch (fallbackError) {
          this.logger.error('Fallback action failed:', fallbackError);
        }
      }
    }
  }

  private async activateRule(rule: AutomationRule): Promise<void> {
    // Set up triggers based on rule configuration
    switch (rule.trigger.type) {
      case 'schedule':
        // Would set up scheduled execution
        break;
      case 'event':
        // Would subscribe to events
        break;
      case 'webhook':
        // Would register webhook
        break;
      case 'threshold':
        // Would set up monitoring
        break;
    }
  }

  private async deactivateRule(rule: AutomationRule): Promise<void> {
    // Clean up triggers
    // Implementation depends on trigger type
  }

  registerScriptExecutor(scriptId: string, executor: Function): void {
    this.scriptExecutors.set(scriptId, executor);
  }

  registerRemediationHandler(type: string, handler: Function): void {
    this.remediationHandlers.set(type, handler);
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRules(): AutomationRule[] {
    return Array.from(this.rules.values());
  }

  getActiveAutomations(): AutomationContext[] {
    return Array.from(this.activeAutomations.values());
  }
}