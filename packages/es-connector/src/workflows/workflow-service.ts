import { EventEmitter } from 'eventemitter3';
import winston from 'winston';
import { ESClient } from '../api/es-client';
import {
  ESWorkflow,
  ESWorkflowInstance,
  ESWorkflowStep,
  ESWorkflowTrigger,
  ESWorkflowHistory,
  ESWorkflowError
} from '../types';

export interface WorkflowExecutionOptions {
  variables?: Record<string, any>;
  async?: boolean;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
  notifyOnComplete?: boolean;
  notifyOnError?: boolean;
}

export interface WorkflowSearchOptions {
  name?: string;
  category?: string;
  tags?: string[];
  status?: string;
  createdBy?: string;
  modifiedAfter?: Date;
  limit?: number;
  offset?: number;
  sort?: string;
}

export class ESWorkflowService extends EventEmitter {
  private client: ESClient;
  private logger: winston.Logger;
  private activeInstances: Map<string, ESWorkflowInstance> = new Map();

  constructor(client: ESClient, logger?: winston.Logger) {
    super();
    this.client = client;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });
  }

  async getWorkflows(options: WorkflowSearchOptions = {}): Promise<ESWorkflow[]> {
    try {
      const params = new URLSearchParams();
      
      if (options.name) params.append('name', options.name);
      if (options.category) params.append('category', options.category);
      if (options.tags?.length) params.append('tags', options.tags.join(','));
      if (options.status) params.append('status', options.status);
      if (options.createdBy) params.append('createdBy', options.createdBy);
      if (options.modifiedAfter) params.append('modifiedAfter', options.modifiedAfter.toISOString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.sort) params.append('sort', options.sort);

      const workflows = await this.client.get<ESWorkflow[]>(`/workflows?${params}`);
      
      this.logger.info(`Retrieved ${workflows.length} workflows`);
      return workflows;
    } catch (error) {
      this.logger.error('Failed to get workflows:', error);
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<ESWorkflow> {
    try {
      const workflow = await this.client.get<ESWorkflow>(`/workflows/${workflowId}`);
      return workflow;
    } catch (error) {
      this.logger.error(`Failed to get workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async createWorkflow(workflow: Partial<ESWorkflow>): Promise<ESWorkflow> {
    try {
      const created = await this.client.post<ESWorkflow>('/workflows', workflow);
      
      this.emit('workflow:created', created);
      this.logger.info(`Created workflow: ${created.name} (${created.id})`);
      
      return created;
    } catch (error) {
      this.logger.error('Failed to create workflow:', error);
      throw error;
    }
  }

  async updateWorkflow(
    workflowId: string,
    updates: Partial<ESWorkflow>
  ): Promise<ESWorkflow> {
    try {
      const updated = await this.client.put<ESWorkflow>(
        `/workflows/${workflowId}`,
        updates
      );
      
      this.emit('workflow:updated', updated);
      this.logger.info(`Updated workflow: ${updated.name} (${updated.id})`);
      
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await this.client.delete(`/workflows/${workflowId}`);
      
      this.emit('workflow:deleted', { workflowId });
      this.logger.info(`Deleted workflow: ${workflowId}`);
    } catch (error) {
      this.logger.error(`Failed to delete workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async publishWorkflow(workflowId: string): Promise<ESWorkflow> {
    try {
      const published = await this.client.post<ESWorkflow>(
        `/workflows/${workflowId}/publish`
      );
      
      this.emit('workflow:published', published);
      this.logger.info(`Published workflow: ${published.name} (${published.id})`);
      
      return published;
    } catch (error) {
      this.logger.error(`Failed to publish workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async executeWorkflow(
    workflowId: string,
    options: WorkflowExecutionOptions = {}
  ): Promise<ESWorkflowInstance> {
    try {
      const instance = await this.client.post<ESWorkflowInstance>(
        `/workflows/${workflowId}/execute`,
        {
          variables: options.variables || {},
          async: options.async ?? true,
          priority: options.priority || 'normal',
          timeout: options.timeout,
          notifications: {
            onComplete: options.notifyOnComplete,
            onError: options.notifyOnError
          }
        }
      );
      
      this.activeInstances.set(instance.id, instance);
      this.emit('workflow:started', instance);
      this.logger.info(`Started workflow instance: ${instance.id}`);
      
      // If synchronous execution, wait for completion
      if (!options.async) {
        return await this.waitForCompletion(instance.id, options.timeout);
      }
      
      return instance;
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async getWorkflowInstance(instanceId: string): Promise<ESWorkflowInstance> {
    try {
      const instance = await this.client.get<ESWorkflowInstance>(
        `/workflow-instances/${instanceId}`
      );
      
      this.activeInstances.set(instanceId, instance);
      return instance;
    } catch (error) {
      this.logger.error(`Failed to get workflow instance ${instanceId}:`, error);
      throw error;
    }
  }

  async getWorkflowInstances(
    workflowId?: string,
    status?: string
  ): Promise<ESWorkflowInstance[]> {
    try {
      const params = new URLSearchParams();
      if (workflowId) params.append('workflowId', workflowId);
      if (status) params.append('status', status);

      const instances = await this.client.get<ESWorkflowInstance[]>(
        `/workflow-instances?${params}`
      );
      
      // Update cache
      instances.forEach(instance => {
        this.activeInstances.set(instance.id, instance);
      });
      
      return instances;
    } catch (error) {
      this.logger.error('Failed to get workflow instances:', error);
      throw error;
    }
  }

  async cancelWorkflowInstance(instanceId: string, reason?: string): Promise<void> {
    try {
      await this.client.post(`/workflow-instances/${instanceId}/cancel`, {
        reason
      });
      
      const instance = await this.getWorkflowInstance(instanceId);
      this.emit('workflow:cancelled', instance);
      this.logger.info(`Cancelled workflow instance: ${instanceId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel workflow instance ${instanceId}:`, error);
      throw error;
    }
  }

  async suspendWorkflowInstance(instanceId: string): Promise<void> {
    try {
      await this.client.post(`/workflow-instances/${instanceId}/suspend`);
      
      const instance = await this.getWorkflowInstance(instanceId);
      this.emit('workflow:suspended', instance);
      this.logger.info(`Suspended workflow instance: ${instanceId}`);
    } catch (error) {
      this.logger.error(`Failed to suspend workflow instance ${instanceId}:`, error);
      throw error;
    }
  }

  async resumeWorkflowInstance(instanceId: string): Promise<void> {
    try {
      await this.client.post(`/workflow-instances/${instanceId}/resume`);
      
      const instance = await this.getWorkflowInstance(instanceId);
      this.emit('workflow:resumed', instance);
      this.logger.info(`Resumed workflow instance: ${instanceId}`);
    } catch (error) {
      this.logger.error(`Failed to resume workflow instance ${instanceId}:`, error);
      throw error;
    }
  }

  async retryWorkflowStep(instanceId: string, stepId: string): Promise<void> {
    try {
      await this.client.post(
        `/workflow-instances/${instanceId}/steps/${stepId}/retry`
      );
      
      this.logger.info(`Retrying step ${stepId} in workflow instance ${instanceId}`);
    } catch (error) {
      this.logger.error(`Failed to retry workflow step:`, error);
      throw error;
    }
  }

  async getWorkflowHistory(instanceId: string): Promise<ESWorkflowHistory[]> {
    try {
      const history = await this.client.get<ESWorkflowHistory[]>(
        `/workflow-instances/${instanceId}/history`
      );
      
      return history;
    } catch (error) {
      this.logger.error(`Failed to get workflow history for ${instanceId}:`, error);
      throw error;
    }
  }

  async getWorkflowVariables(instanceId: string): Promise<Record<string, any>> {
    try {
      const variables = await this.client.get<Record<string, any>>(
        `/workflow-instances/${instanceId}/variables`
      );
      
      return variables;
    } catch (error) {
      this.logger.error(`Failed to get workflow variables for ${instanceId}:`, error);
      throw error;
    }
  }

  async updateWorkflowVariables(
    instanceId: string,
    variables: Record<string, any>
  ): Promise<void> {
    try {
      await this.client.patch(
        `/workflow-instances/${instanceId}/variables`,
        variables
      );
      
      this.logger.info(`Updated variables for workflow instance ${instanceId}`);
    } catch (error) {
      this.logger.error(`Failed to update workflow variables:`, error);
      throw error;
    }
  }

  async importWorkflow(definition: any, format: 'json' | 'xml' | 'bpmn'): Promise<ESWorkflow> {
    try {
      const imported = await this.client.post<ESWorkflow>('/workflows/import', {
        definition,
        format
      });
      
      this.emit('workflow:imported', imported);
      this.logger.info(`Imported workflow: ${imported.name} (${imported.id})`);
      
      return imported;
    } catch (error) {
      this.logger.error('Failed to import workflow:', error);
      throw error;
    }
  }

  async exportWorkflow(workflowId: string, format: 'json' | 'xml' | 'bpmn'): Promise<any> {
    try {
      const exported = await this.client.get(
        `/workflows/${workflowId}/export?format=${format}`
      );
      
      return exported;
    } catch (error) {
      this.logger.error(`Failed to export workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async validateWorkflow(workflow: Partial<ESWorkflow>): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const result = await this.client.post('/workflows/validate', workflow);
      return result;
    } catch (error) {
      this.logger.error('Failed to validate workflow:', error);
      throw error;
    }
  }

  private async waitForCompletion(
    instanceId: string,
    timeout?: number
  ): Promise<ESWorkflowInstance> {
    const startTime = Date.now();
    const maxWait = timeout || 300000; // 5 minutes default
    
    while (true) {
      const instance = await this.getWorkflowInstance(instanceId);
      
      if (['completed', 'failed', 'cancelled'].includes(instance.status)) {
        if (instance.status === 'completed') {
          this.emit('workflow:completed', instance);
        } else if (instance.status === 'failed') {
          this.emit('workflow:failed', instance);
        }
        
        return instance;
      }
      
      if (Date.now() - startTime > maxWait) {
        throw new Error(`Workflow execution timeout after ${maxWait}ms`);
      }
      
      await this.delay(1000); // Poll every second
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getActiveInstances(): Promise<ESWorkflowInstance[]> {
    return Array.from(this.activeInstances.values()).filter(
      instance => ['running', 'suspended'].includes(instance.status)
    );
  }

  clearCache(): void {
    this.activeInstances.clear();
  }
}