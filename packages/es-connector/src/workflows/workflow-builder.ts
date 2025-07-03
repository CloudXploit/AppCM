import {
  ESWorkflow,
  ESWorkflowStep,
  ESWorkflowVariable,
  ESWorkflowTrigger,
  ESWorkflowPort,
  ESErrorHandling
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowBuilder {
  private workflow: Partial<ESWorkflow>;
  private currentStep?: ESWorkflowStep;

  constructor(name: string, description?: string) {
    this.workflow = {
      id: uuidv4(),
      name,
      description,
      version: 1,
      status: 'draft',
      steps: [],
      variables: [],
      triggers: [],
      createdDate: new Date(),
      modifiedDate: new Date()
    };
  }

  static create(name: string, description?: string): WorkflowBuilder {
    return new WorkflowBuilder(name, description);
  }

  category(category: string): this {
    this.workflow.category = category;
    return this;
  }

  tags(...tags: string[]): this {
    this.workflow.tags = tags;
    return this;
  }

  variable(
    name: string,
    type: ESWorkflowVariable['type'],
    options?: {
      defaultValue?: any;
      required?: boolean;
      description?: string;
    }
  ): this {
    if (!this.workflow.variables) {
      this.workflow.variables = [];
    }

    this.workflow.variables.push({
      name,
      type,
      ...options
    });

    return this;
  }

  trigger(type: ESWorkflowTrigger['type'], configuration: Record<string, any>): this {
    if (!this.workflow.triggers) {
      this.workflow.triggers = [];
    }

    this.workflow.triggers.push({
      id: uuidv4(),
      type,
      configuration,
      enabled: true
    });

    return this;
  }

  scheduleTrigger(cronExpression: string, timezone?: string): this {
    return this.trigger('schedule', {
      cronExpression,
      timezone: timezone || 'UTC'
    });
  }

  apiTrigger(endpoint: string, method: string = 'POST'): this {
    return this.trigger('api', {
      endpoint,
      method,
      authentication: 'token'
    });
  }

  eventTrigger(eventType: string, filter?: Record<string, any>): this {
    return this.trigger('event', {
      eventType,
      filter
    });
  }

  addStep(
    name: string,
    type: ESWorkflowStep['type'],
    configuration: Record<string, any>
  ): this {
    const step: ESWorkflowStep = {
      id: uuidv4(),
      name,
      type,
      configuration,
      position: this.calculatePosition(),
      inputs: [],
      outputs: []
    };

    this.workflow.steps!.push(step);
    this.currentStep = step;

    return this;
  }

  action(name: string, action: string, parameters?: Record<string, any>): this {
    return this.addStep(name, 'action', {
      action,
      parameters: parameters || {}
    });
  }

  decision(
    name: string,
    condition: string,
    truePath?: string,
    falsePath?: string
  ): this {
    return this.addStep(name, 'decision', {
      condition,
      truePath,
      falsePath
    });
  }

  approval(
    name: string,
    approvers: string[],
    options?: {
      title?: string;
      description?: string;
      dueInDays?: number;
      requireAll?: boolean;
    }
  ): this {
    return this.addStep(name, 'approval', {
      approvers,
      title: options?.title || name,
      description: options?.description,
      dueInDays: options?.dueInDays || 3,
      requireAll: options?.requireAll ?? true
    });
  }

  notification(
    name: string,
    recipients: string[],
    template: string,
    data?: Record<string, any>
  ): this {
    return this.addStep(name, 'notification', {
      recipients,
      template,
      data: data || {}
    });
  }

  subprocess(name: string, workflowId: string, variables?: Record<string, any>): this {
    return this.addStep(name, 'subprocess', {
      workflowId,
      variables: variables || {},
      waitForCompletion: true
    });
  }

  input(
    name: string,
    type: string,
    required: boolean = true,
    defaultValue?: any
  ): this {
    if (!this.currentStep) {
      throw new Error('No current step to add input to');
    }

    if (!this.currentStep.inputs) {
      this.currentStep.inputs = [];
    }

    this.currentStep.inputs.push({
      id: uuidv4(),
      name,
      type,
      required,
      defaultValue
    });

    return this;
  }

  output(name: string, type: string): this {
    if (!this.currentStep) {
      throw new Error('No current step to add output to');
    }

    if (!this.currentStep.outputs) {
      this.currentStep.outputs = [];
    }

    this.currentStep.outputs.push({
      id: uuidv4(),
      name,
      type,
      required: false
    });

    return this;
  }

  errorHandling(
    strategy: ESErrorHandling['strategy'],
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      compensationSteps?: string[];
    }
  ): this {
    if (!this.currentStep) {
      throw new Error('No current step to add error handling to');
    }

    this.currentStep.errorHandling = {
      strategy,
      ...options
    };

    return this;
  }

  connectSteps(fromStepId: string, toStepId: string, condition?: string): this {
    const fromStep = this.workflow.steps?.find(s => s.id === fromStepId);
    const toStep = this.workflow.steps?.find(s => s.id === toStepId);

    if (!fromStep || !toStep) {
      throw new Error('Invalid step IDs for connection');
    }

    if (!fromStep.configuration.connections) {
      fromStep.configuration.connections = [];
    }

    fromStep.configuration.connections.push({
      to: toStepId,
      condition
    });

    return this;
  }

  parallel(...builders: ((builder: ParallelBuilder) => void)[]): this {
    const parallelId = uuidv4();
    const parallelStep = this.addStep(`Parallel-${parallelId}`, 'action', {
      action: 'parallel',
      branches: []
    });

    builders.forEach((builderFn, index) => {
      const parallelBuilder = new ParallelBuilder(`Branch-${index + 1}`);
      builderFn(parallelBuilder);
      
      this.currentStep!.configuration.branches.push(parallelBuilder.getBranch());
    });

    return this;
  }

  loop(
    name: string,
    collection: string,
    itemVariable: string,
    body: (builder: LoopBuilder) => void
  ): this {
    const loopStep = this.addStep(name, 'action', {
      action: 'loop',
      collection,
      itemVariable,
      steps: []
    });

    const loopBuilder = new LoopBuilder();
    body(loopBuilder);
    
    this.currentStep!.configuration.steps = loopBuilder.getSteps();

    return this;
  }

  build(): ESWorkflow {
    if (!this.workflow.steps || this.workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    return this.workflow as ESWorkflow;
  }

  private calculatePosition(): { x: number; y: number } {
    const stepCount = this.workflow.steps?.length || 0;
    const x = 100 + (stepCount % 4) * 200;
    const y = 100 + Math.floor(stepCount / 4) * 150;
    
    return { x, y };
  }
}

class ParallelBuilder {
  private steps: ESWorkflowStep[] = [];

  constructor(private branchName: string) {}

  action(name: string, action: string, parameters?: Record<string, any>): this {
    this.steps.push({
      id: uuidv4(),
      name,
      type: 'action',
      configuration: {
        action,
        parameters: parameters || {}
      },
      position: { x: 0, y: 0 }
    });

    return this;
  }

  getBranch(): any {
    return {
      name: this.branchName,
      steps: this.steps
    };
  }
}

class LoopBuilder {
  private steps: ESWorkflowStep[] = [];

  action(name: string, action: string, parameters?: Record<string, any>): this {
    this.steps.push({
      id: uuidv4(),
      name,
      type: 'action',
      configuration: {
        action,
        parameters: parameters || {}
      },
      position: { x: 0, y: 0 }
    });

    return this;
  }

  decision(
    name: string,
    condition: string,
    continueLoop: boolean = true
  ): this {
    this.steps.push({
      id: uuidv4(),
      name,
      type: 'decision',
      configuration: {
        condition,
        truePath: continueLoop ? 'continue' : 'break',
        falsePath: continueLoop ? 'break' : 'continue'
      },
      position: { x: 0, y: 0 }
    });

    return this;
  }

  getSteps(): ESWorkflowStep[] {
    return this.steps;
  }
}

// Helper function to create common workflows
export const CommonWorkflows = {
  documentApproval: (approvers: string[]) => {
    return WorkflowBuilder.create('Document Approval Workflow')
      .description('Standard document approval process')
      .category('Approval')
      .tags('document', 'approval', 'standard')
      .variable('documentId', 'string', { required: true })
      .variable('documentTitle', 'string', { required: true })
      .variable('requester', 'string', { required: true })
      .action('Validate Document', 'validateDocument', {
        documentId: '${documentId}'
      })
      .approval('Manager Approval', approvers, {
        title: 'Document Approval Required',
        description: 'Please review and approve document: ${documentTitle}',
        dueInDays: 3
      })
      .notification('Notify Requester', ['${requester}'], 'approval-complete', {
        documentId: '${documentId}',
        approved: true
      })
      .build();
  },

  dataProcessing: (sourceTable: string, targetTable: string) => {
    return WorkflowBuilder.create('Data Processing Pipeline')
      .description('ETL pipeline for data processing')
      .category('Data Processing')
      .variable('batchSize', 'number', { defaultValue: 1000 })
      .variable('processDate', 'date', { defaultValue: new Date() })
      .scheduleTrigger('0 2 * * *', 'UTC')
      .action('Extract Data', 'extractData', {
        source: sourceTable,
        date: '${processDate}',
        batchSize: '${batchSize}'
      })
      .action('Transform Data', 'transformData', {
        rules: 'standard-transformation'
      })
      .errorHandling('retry', { maxRetries: 3, retryDelay: 5000 })
      .action('Load Data', 'loadData', {
        target: targetTable,
        mode: 'append'
      })
      .notification('Notify Admin', ['admin@example.com'], 'etl-complete')
      .build();
  }
};