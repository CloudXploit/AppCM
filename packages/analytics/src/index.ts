// Analytics & ML Package
// Comprehensive analytics, dashboards, ML pipelines, and visualizations

export * from './types';

// Dashboard components
export { DashboardManager } from './dashboard/dashboard-manager';
export { WidgetRenderer } from './dashboard/widget-renderer';

// ML Pipeline framework
export { PipelineManager, StageProcessor, StageContext } from './pipeline/pipeline-manager';

// Visualization library
export { VisualizationFactory } from './visualization/visualization-factory';

// Streaming analytics
export { StreamingAnalytics } from './streaming/streaming-analytics';

// Model registry
export { ModelRegistry } from './models/model-registry';

// Analytics API
export { AnalyticsAPI } from './api/analytics-api';

// Main Analytics Engine
import { EventEmitter } from 'events';
import { DashboardManager } from './dashboard/dashboard-manager';
import { PipelineManager } from './pipeline/pipeline-manager';
import { VisualizationFactory } from './visualization/visualization-factory';
import { StreamingAnalytics } from './streaming/streaming-analytics';
import { ModelRegistry } from './models/model-registry';
import { AnalyticsAPI } from './api/analytics-api';
import { logger } from '@cm-diagnostics/logger';
import {
  Dashboard,
  DashboardType,
  MLPipeline,
  PipelineStage,
  MLModel,
  ModelType,
  StreamingAnalytics as StreamingAnalyticsType,
  AnalyticsEvent
} from './types';

export interface AnalyticsEngineConfig {
  dashboards?: {
    maxDashboards?: number;
    maxWidgetsPerDashboard?: number;
    enableAutoSave?: boolean;
  };
  pipelines?: {
    maxConcurrentRuns?: number;
    enableMetrics?: boolean;
  };
  streaming?: {
    maxConcurrentStreams?: number;
    enableBackpressure?: boolean;
  };
  models?: {
    maxModelsPerType?: number;
    enableVersioning?: boolean;
    autoDeployment?: boolean;
  };
  api?: {
    enableAuth?: boolean;
    rateLimit?: number;
    cors?: boolean;
  };
}

export class AnalyticsEngine extends EventEmitter {
  private dashboardManager: DashboardManager;
  private pipelineManager: PipelineManager;
  private vizFactory: VisualizationFactory;
  private streamingAnalytics: StreamingAnalytics;
  private modelRegistry: ModelRegistry;
  private analyticsAPI: AnalyticsAPI;
  private config: AnalyticsEngineConfig;

  constructor(config: AnalyticsEngineConfig = {}) {
    super();
    this.config = config;

    // Initialize components
    this.dashboardManager = new DashboardManager(config.dashboards);
    this.pipelineManager = new PipelineManager(config.pipelines);
    this.vizFactory = new VisualizationFactory();
    this.streamingAnalytics = new StreamingAnalytics(config.streaming);
    this.modelRegistry = new ModelRegistry(config.models);
    
    // Initialize API
    this.analyticsAPI = new AnalyticsAPI(
      this.dashboardManager,
      this.pipelineManager,
      this.vizFactory,
      this.streamingAnalytics,
      this.modelRegistry
    );

    this.setupEventHandlers();
    logger.info('Analytics Engine initialized', { config });
  }

  private setupEventHandlers(): void {
    // Forward events from components
    const components = [
      this.dashboardManager,
      this.pipelineManager,
      this.streamingAnalytics,
      this.modelRegistry
    ];

    components.forEach(component => {
      component.on('analyticsEvent', (event: AnalyticsEvent) => {
        this.emit('analyticsEvent', event);
      });
    });

    // Dashboard events
    this.dashboardManager.on('dashboardCreated', (dashboard) => {
      this.emit('dashboardCreated', dashboard);
    });

    this.dashboardManager.on('dashboardUpdated', (dashboard) => {
      this.emit('dashboardUpdated', dashboard);
    });

    // Pipeline events
    this.pipelineManager.on('pipelineStarted', (data) => {
      this.emit('pipelineStarted', data);
    });

    this.pipelineManager.on('pipelineCompleted', (data) => {
      this.emit('pipelineCompleted', data);
    });

    this.pipelineManager.on('pipelineFailed', (data) => {
      this.emit('pipelineFailed', data);
    });

    // Streaming events
    this.streamingAnalytics.on('streamStarted', (data) => {
      this.emit('streamStarted', data);
    });

    this.streamingAnalytics.on('streamError', (data) => {
      this.emit('streamError', data);
    });

    // Model events
    this.modelRegistry.on('modelRegistered', (model) => {
      this.emit('modelRegistered', model);
    });

    this.modelRegistry.on('modelDeployed', (data) => {
      this.emit('modelDeployed', data);
    });
  }

  // Dashboard operations
  async createDashboard(
    name: string,
    type: DashboardType,
    createdBy: string
  ): Promise<Dashboard> {
    return this.dashboardManager.createDashboard(name, type, createdBy);
  }

  async createDashboardFromTemplate(
    template: DashboardType,
    name: string,
    createdBy: string,
    systemIds: string[]
  ): Promise<Dashboard> {
    return this.dashboardManager.createFromTemplate(template, name, createdBy, systemIds);
  }

  getDashboards(): Dashboard[] {
    return this.dashboardManager.listDashboards();
  }

  // Pipeline operations
  async createPipeline(
    name: string,
    stages: PipelineStage[],
    createdBy: string
  ): Promise<MLPipeline> {
    return this.pipelineManager.createPipeline(name, stages, createdBy);
  }

  async runPipeline(
    pipelineId: string,
    parameters?: Record<string, any>
  ): Promise<any> {
    return this.pipelineManager.runPipeline(pipelineId, parameters);
  }

  getPipelines(): MLPipeline[] {
    return this.pipelineManager.listPipelines();
  }

  // Streaming operations
  async createStream(
    config: Omit<StreamingAnalyticsType, 'id' | 'status'>
  ): Promise<StreamingAnalyticsType> {
    return this.streamingAnalytics.createStream(config);
  }

  async startStream(streamId: string): Promise<void> {
    return this.streamingAnalytics.startStream(streamId);
  }

  async stopStream(streamId: string): Promise<void> {
    return this.streamingAnalytics.stopStream(streamId);
  }

  getStreams(): StreamingAnalyticsType[] {
    return this.streamingAnalytics.listStreams();
  }

  // Model operations
  async registerModel(modelData: any): Promise<MLModel> {
    return this.modelRegistry.registerModel(modelData);
  }

  async deployModel(
    modelId: string,
    deploymentConfig: any
  ): Promise<any> {
    return this.modelRegistry.deployModel(modelId, deploymentConfig);
  }

  getModels(): MLModel[] {
    return this.modelRegistry.listModels();
  }

  compareModels(modelIds: string[]): any {
    return this.modelRegistry.compareModels(modelIds);
  }

  // Visualization operations
  createVisualization(
    type: any,
    data: any[],
    config: any
  ): any {
    return this.vizFactory.create(type, data, config);
  }

  renderVisualization(
    visualization: any,
    container: HTMLElement,
    options?: any
  ): void {
    this.vizFactory.render(visualization, container, options);
  }

  // Get API router for Express integration
  getAPIRouter() {
    return this.analyticsAPI.getRouter();
  }

  // Analytics queries
  async executeQuery(query: any): Promise<any> {
    // This would execute against a real data store
    logger.info('Executing analytics query', { query });
    
    // Simulate query execution
    const data = [];
    for (let i = 0; i < 100; i++) {
      data.push({
        timestamp: new Date(Date.now() - i * 60000),
        value: Math.random() * 100,
        systemId: `system-${Math.floor(Math.random() * 5) + 1}`
      });
    }

    return {
      query,
      data,
      metadata: {
        executionTime: Math.random() * 1000,
        rowCount: data.length,
        cached: false,
        timestamp: new Date()
      }
    };
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
  }> {
    const health = {
      dashboards: this.dashboardManager.listDashboards().length,
      pipelines: this.pipelineManager.listPipelines().length,
      streams: this.streamingAnalytics.listStreams().length,
      models: this.modelRegistry.listModels().length
    };

    const status = Object.values(health).every(v => v >= 0) ? 'healthy' : 'degraded';

    return {
      status,
      components: health
    };
  }

  // Statistics
  getStatistics(): {
    dashboards: {
      total: number;
      byType: Record<string, number>;
    };
    pipelines: {
      total: number;
      running: number;
      completed: number;
      failed: number;
    };
    streams: {
      total: number;
      active: number;
    };
    models: {
      total: number;
      deployed: number;
      byType: Record<string, number>;
    };
  } {
    const dashboards = this.dashboardManager.listDashboards();
    const pipelines = this.pipelineManager.listPipelines();
    const streams = this.streamingAnalytics.listStreams();
    const models = this.modelRegistry.listModels();

    // Count dashboards by type
    const dashboardsByType: Record<string, number> = {};
    dashboards.forEach(d => {
      dashboardsByType[d.type] = (dashboardsByType[d.type] || 0) + 1;
    });

    // Count models by type
    const modelsByType: Record<string, number> = {};
    models.forEach(m => {
      modelsByType[m.type] = (modelsByType[m.type] || 0) + 1;
    });

    return {
      dashboards: {
        total: dashboards.length,
        byType: dashboardsByType
      },
      pipelines: {
        total: pipelines.length,
        running: pipelines.filter(p => p.status.state === 'running').length,
        completed: pipelines.filter(p => p.status.state === 'idle' && p.status.lastRun?.status === 'completed').length,
        failed: pipelines.filter(p => p.status.state === 'failed').length
      },
      streams: {
        total: streams.length,
        active: streams.filter(s => s.status.state === 'running').length
      },
      models: {
        total: models.length,
        deployed: models.filter(m => m.status.state === 'deployed').length,
        byType: modelsByType
      }
    };
  }

  // Cleanup
  destroy(): void {
    this.dashboardManager.destroy();
    this.pipelineManager.destroy();
    this.streamingAnalytics.destroy();
    this.modelRegistry.destroy();
    this.vizFactory.destroyAll();
    
    this.removeAllListeners();
    logger.info('Analytics Engine destroyed');
  }
}

// Factory function
export function createAnalyticsEngine(
  config?: AnalyticsEngineConfig
): AnalyticsEngine {
  return new AnalyticsEngine(config);
}