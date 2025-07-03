// ML Pipeline Manager
// Manages machine learning pipelines for data processing and model training

import { EventEmitter } from 'events';
import {
  MLPipeline,
  PipelineStage,
  StageType,
  PipelineStatus,
  PipelineRun,
  StageResult,
  PipelineSchedule,
  PipelineTrigger,
  RunMetrics,
  ResourceUsage
} from '../types';
import { logger } from '@cm-diagnostics/logger';
import * as cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

export interface PipelineManagerConfig {
  maxConcurrentRuns?: number;
  maxRetries?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  checkpointInterval?: number;
}

export class PipelineManager extends EventEmitter {
  private pipelines: Map<string, MLPipeline> = new Map();
  private activeRuns: Map<string, PipelineRun> = new Map();
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private config: Required<PipelineManagerConfig>;
  private stageProcessors: Map<StageType, StageProcessor> = new Map();

  constructor(config: PipelineManagerConfig = {}) {
    super();
    
    this.config = {
      maxConcurrentRuns: 5,
      maxRetries: 3,
      defaultTimeout: 3600000, // 1 hour
      enableMetrics: true,
      checkpointInterval: 60000, // 1 minute
      ...config
    };

    this.initializeStageProcessors();
    logger.info('Pipeline Manager initialized', { config: this.config });
  }

  private initializeStageProcessors(): void {
    // Register built-in stage processors
    this.registerStageProcessor(StageType.DATA_INGESTION, new DataIngestionProcessor());
    this.registerStageProcessor(StageType.DATA_VALIDATION, new DataValidationProcessor());
    this.registerStageProcessor(StageType.DATA_PREPROCESSING, new DataPreprocessingProcessor());
    this.registerStageProcessor(StageType.FEATURE_ENGINEERING, new FeatureEngineeringProcessor());
    this.registerStageProcessor(StageType.MODEL_TRAINING, new ModelTrainingProcessor());
    this.registerStageProcessor(StageType.MODEL_EVALUATION, new ModelEvaluationProcessor());
    this.registerStageProcessor(StageType.MODEL_DEPLOYMENT, new ModelDeploymentProcessor());
    this.registerStageProcessor(StageType.MONITORING, new MonitoringProcessor());
  }

  registerStageProcessor(type: StageType, processor: StageProcessor): void {
    this.stageProcessors.set(type, processor);
    logger.debug('Stage processor registered', { type });
  }

  async createPipeline(
    name: string,
    stages: PipelineStage[],
    createdBy: string
  ): Promise<MLPipeline> {
    const pipeline: MLPipeline = {
      id: uuidv4(),
      name,
      stages,
      parameters: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
        version: '1.0.0',
        tags: []
      },
      status: {
        state: 'idle'
      }
    };

    // Validate pipeline
    this.validatePipeline(pipeline);

    this.pipelines.set(pipeline.id, pipeline);
    
    this.emit('pipelineCreated', pipeline);
    logger.info('Pipeline created', { id: pipeline.id, name });

    return pipeline;
  }

  private validatePipeline(pipeline: MLPipeline): void {
    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stageId: string): boolean => {
      visited.add(stageId);
      recursionStack.add(stageId);

      const stage = pipeline.stages.find(s => s.id === stageId);
      if (!stage) return false;

      for (const dep of stage.dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }

      recursionStack.delete(stageId);
      return false;
    };

    for (const stage of pipeline.stages) {
      if (!visited.has(stage.id) && hasCycle(stage.id)) {
        throw new Error('Pipeline contains circular dependencies');
      }
    }

    // Validate stage processors exist
    for (const stage of pipeline.stages) {
      if (!this.stageProcessors.has(stage.type) && stage.type !== StageType.CUSTOM) {
        throw new Error(`No processor registered for stage type: ${stage.type}`);
      }
    }
  }

  async runPipeline(
    pipelineId: string,
    parameters?: Record<string, any>
  ): Promise<PipelineRun> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    // Check concurrent runs limit
    if (this.activeRuns.size >= this.config.maxConcurrentRuns) {
      throw new Error(`Maximum concurrent runs (${this.config.maxConcurrentRuns}) reached`);
    }

    const run: PipelineRun = {
      id: uuidv4(),
      pipelineId,
      startTime: new Date(),
      status: 'running',
      stageResults: [],
      metrics: {
        duration: 0,
        dataProcessed: 0,
        resourceUsage: {
          cpu: 0,
          memory: 0,
          storage: 0,
          network: 0
        }
      },
      logs: [`Pipeline run started at ${new Date().toISOString()}`]
    };

    this.activeRuns.set(run.id, run);
    pipeline.status.state = 'running';
    pipeline.status.lastRun = run;

    this.emit('pipelineStarted', { pipeline, run });

    try {
      await this.executePipeline(pipeline, run, parameters);
      
      run.status = 'completed';
      pipeline.status.state = 'idle';
      this.emit('pipelineCompleted', { pipeline, run });
    } catch (error) {
      run.status = 'failed';
      pipeline.status.state = 'failed';
      run.logs.push(`Pipeline failed: ${(error as Error).message}`);
      this.emit('pipelineFailed', { pipeline, run, error });
      throw error;
    } finally {
      run.endTime = new Date();
      run.metrics.duration = run.endTime.getTime() - run.startTime.getTime();
      this.activeRuns.delete(run.id);
    }

    return run;
  }

  private async executePipeline(
    pipeline: MLPipeline,
    run: PipelineRun,
    parameters?: Record<string, any>
  ): Promise<void> {
    // Build execution order based on dependencies
    const executionOrder = this.buildExecutionOrder(pipeline);
    
    // Execute stages in order
    for (const stageId of executionOrder) {
      const stage = pipeline.stages.find(s => s.id === stageId)!;
      
      const stageResult: StageResult = {
        stageId: stage.id,
        status: 'running',
        startTime: new Date(),
        outputs: {}
      };
      
      run.stageResults.push(stageResult);
      
      try {
        await this.executeStage(stage, run, parameters);
        
        stageResult.status = 'completed';
        stageResult.endTime = new Date();
        
        this.emit('stageCompleted', { pipeline, run, stage, result: stageResult });
      } catch (error) {
        stageResult.status = 'failed';
        stageResult.endTime = new Date();
        stageResult.error = (error as Error).message;
        
        this.emit('stageFailed', { pipeline, run, stage, result: stageResult, error });
        
        // Check retry policy
        if (stage.retryPolicy && stage.retryPolicy.maxRetries > 0) {
          await this.retryStage(stage, run, parameters, stage.retryPolicy.maxRetries);
        } else {
          throw error;
        }
      }
    }
  }

  private buildExecutionOrder(pipeline: MLPipeline): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    
    const visit = (stageId: string) => {
      if (visited.has(stageId)) return;
      
      const stage = pipeline.stages.find(s => s.id === stageId);
      if (!stage) return;
      
      // Visit dependencies first
      for (const dep of stage.dependencies) {
        visit(dep);
      }
      
      visited.add(stageId);
      order.push(stageId);
    };
    
    // Visit all stages
    for (const stage of pipeline.stages) {
      visit(stage.id);
    }
    
    return order;
  }

  private async executeStage(
    stage: PipelineStage,
    run: PipelineRun,
    parameters?: Record<string, any>
  ): Promise<void> {
    const processor = this.stageProcessors.get(stage.type);
    if (!processor && stage.type !== StageType.CUSTOM) {
      throw new Error(`No processor for stage type: ${stage.type}`);
    }

    const stageContext: StageContext = {
      stage,
      run,
      parameters: { ...parameters, ...stage.config.parameters },
      previousOutputs: this.collectPreviousOutputs(stage, run)
    };

    if (processor) {
      await processor.execute(stageContext);
    } else {
      // Custom stage - execute custom processor
      await this.executeCustomStage(stageContext);
    }

    // Update metrics
    if (this.config.enableMetrics) {
      await this.updateRunMetrics(run);
    }
  }

  private collectPreviousOutputs(
    stage: PipelineStage,
    run: PipelineRun
  ): Record<string, any> {
    const outputs: Record<string, any> = {};
    
    for (const depId of stage.dependencies) {
      const depResult = run.stageResults.find(r => r.stageId === depId);
      if (depResult && depResult.outputs) {
        outputs[depId] = depResult.outputs;
      }
    }
    
    return outputs;
  }

  private async executeCustomStage(context: StageContext): Promise<void> {
    // Execute custom processor specified in config
    const processorName = context.stage.config.processor;
    
    // This would be implemented to load and execute custom processors
    throw new Error(`Custom processor not implemented: ${processorName}`);
  }

  private async retryStage(
    stage: PipelineStage,
    run: PipelineRun,
    parameters: Record<string, any> | undefined,
    retriesLeft: number
  ): Promise<void> {
    const retryPolicy = stage.retryPolicy!;
    let delay = retryPolicy.initialDelay;
    
    for (let attempt = 1; attempt <= retriesLeft; attempt++) {
      run.logs.push(`Retrying stage ${stage.name} (attempt ${attempt}/${retriesLeft})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        await this.executeStage(stage, run, parameters);
        return; // Success
      } catch (error) {
        if (attempt === retriesLeft) {
          throw error; // Final attempt failed
        }
        
        // Calculate next delay
        switch (retryPolicy.backoffStrategy) {
          case 'exponential':
            delay *= 2;
            break;
          case 'linear':
            delay += retryPolicy.initialDelay;
            break;
          // 'fixed' keeps the same delay
        }
        
        if (retryPolicy.maxDelay) {
          delay = Math.min(delay, retryPolicy.maxDelay);
        }
      }
    }
  }

  private async updateRunMetrics(run: PipelineRun): Promise<void> {
    // Simulate metrics collection
    run.metrics.resourceUsage = {
      cpu: Math.random() * 100,
      memory: Math.random() * 16384,
      storage: Math.random() * 1024,
      network: Math.random() * 100
    };
    
    run.metrics.dataProcessed += Math.random() * 1000000;
  }

  async schedulePipeline(
    pipelineId: string,
    schedule: PipelineSchedule
  ): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    // Cancel existing schedule
    this.unschedulePipeline(pipelineId);

    pipeline.schedule = schedule;

    if (schedule.type === 'cron') {
      const task = cron.schedule(schedule.expression, async () => {
        try {
          await this.runPipeline(pipelineId);
        } catch (error) {
          logger.error('Scheduled pipeline run failed', { pipelineId, error });
        }
      }, {
        timezone: schedule.timezone
      });

      this.scheduledJobs.set(pipelineId, task);
      task.start();

      logger.info('Pipeline scheduled', { pipelineId, schedule });
    }
  }

  unschedulePipeline(pipelineId: string): void {
    const task = this.scheduledJobs.get(pipelineId);
    if (task) {
      task.stop();
      this.scheduledJobs.delete(pipelineId);
      
      const pipeline = this.pipelines.get(pipelineId);
      if (pipeline) {
        delete pipeline.schedule;
      }
    }
  }

  async addTrigger(
    pipelineId: string,
    trigger: PipelineTrigger
  ): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    if (!pipeline.triggers) {
      pipeline.triggers = [];
    }

    pipeline.triggers.push(trigger);

    // Set up trigger based on type
    switch (trigger.type) {
      case 'event':
        this.setupEventTrigger(pipelineId, trigger);
        break;
      case 'data':
        this.setupDataTrigger(pipelineId, trigger);
        break;
      case 'metric':
        this.setupMetricTrigger(pipelineId, trigger);
        break;
    }
  }

  private setupEventTrigger(pipelineId: string, trigger: PipelineTrigger): void {
    const eventName = trigger.config.eventName;
    
    this.on(eventName, async (data) => {
      if (this.evaluateTriggerCondition(trigger, data)) {
        await this.runPipeline(pipelineId, { triggerData: data });
      }
    });
  }

  private setupDataTrigger(pipelineId: string, trigger: PipelineTrigger): void {
    // Monitor data source for changes
    // Implementation would depend on data source type
  }

  private setupMetricTrigger(pipelineId: string, trigger: PipelineTrigger): void {
    // Monitor metrics and trigger when threshold is met
    // Implementation would integrate with metrics system
  }

  private evaluateTriggerCondition(trigger: PipelineTrigger, data: any): boolean {
    if (!trigger.config.condition) return true;
    
    // Simple condition evaluation
    // In production, this would use a proper expression evaluator
    try {
      return eval(trigger.config.condition);
    } catch {
      return true;
    }
  }

  getPipeline(pipelineId: string): MLPipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  listPipelines(filters?: {
    status?: PipelineStatus['state'];
    tags?: string[];
  }): MLPipeline[] {
    let pipelines = Array.from(this.pipelines.values());

    if (filters) {
      if (filters.status) {
        pipelines = pipelines.filter(p => p.status.state === filters.status);
      }
      if (filters.tags && filters.tags.length > 0) {
        pipelines = pipelines.filter(p =>
          filters.tags!.some(tag => p.metadata.tags.includes(tag))
        );
      }
    }

    return pipelines;
  }

  getActiveRuns(): PipelineRun[] {
    return Array.from(this.activeRuns.values());
  }

  async cancelRun(runId: string): Promise<void> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found or not active`);
    }

    run.status = 'cancelled';
    run.endTime = new Date();
    run.logs.push(`Pipeline run cancelled at ${new Date().toISOString()}`);

    this.activeRuns.delete(runId);
    
    const pipeline = this.pipelines.get(run.pipelineId);
    if (pipeline) {
      pipeline.status.state = 'idle';
    }

    this.emit('pipelineCancelled', { pipeline, run });
  }

  destroy(): void {
    // Stop all scheduled jobs
    this.scheduledJobs.forEach(task => task.stop());
    this.scheduledJobs.clear();

    // Cancel all active runs
    this.activeRuns.forEach(run => {
      run.status = 'cancelled';
      run.endTime = new Date();
    });
    this.activeRuns.clear();

    this.removeAllListeners();
  }
}

// Stage processor interface
export interface StageProcessor {
  execute(context: StageContext): Promise<void>;
}

export interface StageContext {
  stage: PipelineStage;
  run: PipelineRun;
  parameters: Record<string, any>;
  previousOutputs: Record<string, any>;
}

// Built-in stage processors
class DataIngestionProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Ingesting data for stage: ${stage.name}`);
    
    // Simulate data ingestion
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      recordsIngested: 10000,
      dataSize: 1024 * 1024 * 100 // 100MB
    };
  }
}

class DataValidationProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Validating data for stage: ${stage.name}`);
    
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      validRecords: 9800,
      invalidRecords: 200,
      validationErrors: []
    };
  }
}

class DataPreprocessingProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Preprocessing data for stage: ${stage.name}`);
    
    // Simulate preprocessing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      processedRecords: 9800,
      transformations: ['normalize', 'encode', 'scale']
    };
  }
}

class FeatureEngineeringProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Engineering features for stage: ${stage.name}`);
    
    // Simulate feature engineering
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      featuresCreated: 50,
      featureImportance: {
        cpu_usage_mean: 0.85,
        memory_usage_max: 0.72,
        response_time_p95: 0.68
      }
    };
  }
}

class ModelTrainingProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Training model for stage: ${stage.name}`);
    
    // Simulate model training
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      modelId: uuidv4(),
      epochs: 100,
      finalLoss: 0.0234,
      metrics: {
        accuracy: 0.945,
        precision: 0.932,
        recall: 0.951
      }
    };
  }
}

class ModelEvaluationProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Evaluating model for stage: ${stage.name}`);
    
    // Simulate evaluation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      testAccuracy: 0.938,
      confusionMatrix: [[950, 50], [30, 970]],
      rocAuc: 0.962
    };
  }
}

class ModelDeploymentProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Deploying model for stage: ${stage.name}`);
    
    // Simulate deployment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      deploymentId: uuidv4(),
      endpoint: 'https://api.cm-diagnostics.local/models/predict',
      version: '1.0.0',
      status: 'active'
    };
  }
}

class MonitoringProcessor implements StageProcessor {
  async execute(context: StageContext): Promise<void> {
    const { stage, run } = context;
    run.logs.push(`Setting up monitoring for stage: ${stage.name}`);
    
    // Simulate monitoring setup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const result = run.stageResults.find(r => r.stageId === stage.id)!;
    result.outputs = {
      monitoringEnabled: true,
      metrics: ['latency', 'throughput', 'error_rate'],
      alerts: ['drift_detection', 'performance_degradation']
    };
  }
}