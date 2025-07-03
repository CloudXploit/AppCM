// Analytics API
// REST API endpoints for analytics functionality

import { Router, Request, Response } from 'express';
import {
  AnalyticsQuery,
  AnalyticsResult,
  Dashboard,
  Widget,
  MLPipeline,
  PipelineRun,
  Visualization,
  VisualizationType,
  AnalyticsError
} from '../types';
import { DashboardManager } from '../dashboard/dashboard-manager';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { VisualizationFactory } from '../visualization/visualization-factory';
import { StreamingAnalytics } from '../streaming/streaming-analytics';
import { ModelRegistry } from '../models/model-registry';
import { logger } from '@cm-diagnostics/logger';
import { z } from 'zod';

// Validation schemas
const DashboardCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['overview', 'system', 'performance', 'security', 'capacity', 'custom']),
  description: z.string().optional()
});

const WidgetCreateSchema = z.object({
  type: z.string(),
  title: z.string(),
  dataSource: z.object({
    type: z.enum(['metrics', 'findings', 'anomalies', 'predictions', 'custom']),
    query: z.object({
      systems: z.array(z.string()).optional(),
      metrics: z.array(z.string()).optional(),
      timeRange: z.object({
        start: z.union([z.string(), z.date()]),
        end: z.union([z.string(), z.date()])
      }).optional()
    })
  }),
  visualization: z.object({
    type: z.string(),
    options: z.record(z.any())
  }),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  size: z.object({
    width: z.number(),
    height: z.number()
  })
});

const QuerySchema = z.object({
  query: z.union([
    z.string(),
    z.object({
      select: z.array(z.string()),
      from: z.string(),
      where: z.array(z.any()).optional(),
      groupBy: z.array(z.string()).optional(),
      orderBy: z.array(z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc'])
      })).optional(),
      limit: z.number().optional(),
      offset: z.number().optional()
    })
  ]),
  parameters: z.record(z.any()).optional(),
  cache: z.object({
    enabled: z.boolean(),
    ttl: z.number()
  }).optional()
});

export class AnalyticsAPI {
  private router: Router;
  private dashboardManager: DashboardManager;
  private pipelineManager: PipelineManager;
  private vizFactory: VisualizationFactory;
  private streamingAnalytics: StreamingAnalytics;
  private modelRegistry: ModelRegistry;

  constructor(
    dashboardManager: DashboardManager,
    pipelineManager: PipelineManager,
    vizFactory: VisualizationFactory,
    streamingAnalytics: StreamingAnalytics,
    modelRegistry: ModelRegistry
  ) {
    this.router = Router();
    this.dashboardManager = dashboardManager;
    this.pipelineManager = pipelineManager;
    this.vizFactory = vizFactory;
    this.streamingAnalytics = streamingAnalytics;
    this.modelRegistry = modelRegistry;

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Dashboard routes
    this.router.get('/dashboards', this.listDashboards.bind(this));
    this.router.post('/dashboards', this.createDashboard.bind(this));
    this.router.get('/dashboards/:id', this.getDashboard.bind(this));
    this.router.put('/dashboards/:id', this.updateDashboard.bind(this));
    this.router.delete('/dashboards/:id', this.deleteDashboard.bind(this));

    // Widget routes
    this.router.post('/dashboards/:id/widgets', this.addWidget.bind(this));
    this.router.put('/dashboards/:dashboardId/widgets/:widgetId', this.updateWidget.bind(this));
    this.router.delete('/dashboards/:dashboardId/widgets/:widgetId', this.removeWidget.bind(this));

    // Query routes
    this.router.post('/query', this.executeQuery.bind(this));
    this.router.post('/query/validate', this.validateQuery.bind(this));

    // Pipeline routes
    this.router.get('/pipelines', this.listPipelines.bind(this));
    this.router.post('/pipelines', this.createPipeline.bind(this));
    this.router.get('/pipelines/:id', this.getPipeline.bind(this));
    this.router.post('/pipelines/:id/run', this.runPipeline.bind(this));
    this.router.post('/pipelines/:id/schedule', this.schedulePipeline.bind(this));
    this.router.delete('/pipelines/:id/schedule', this.unschedulePipeline.bind(this));
    this.router.get('/pipelines/:id/runs', this.getPipelineRuns.bind(this));

    // Visualization routes
    this.router.post('/visualizations', this.createVisualization.bind(this));
    this.router.put('/visualizations/:id/data', this.updateVisualizationData.bind(this));

    // Streaming routes
    this.router.get('/streams', this.listStreams.bind(this));
    this.router.post('/streams', this.createStream.bind(this));
    this.router.post('/streams/:id/start', this.startStream.bind(this));
    this.router.post('/streams/:id/stop', this.stopStream.bind(this));

    // Model routes
    this.router.get('/models', this.listModels.bind(this));
    this.router.post('/models', this.registerModel.bind(this));
    this.router.get('/models/:id', this.getModel.bind(this));
    this.router.post('/models/:id/deploy', this.deployModel.bind(this));

    // Health check
    this.router.get('/health', this.healthCheck.bind(this));
  }

  // Dashboard endpoints
  private async listDashboards(req: Request, res: Response): Promise<void> {
    try {
      const { type, tags, owner } = req.query;
      
      const filters: any = {};
      if (type) filters.type = type;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
      if (owner) filters.owner = owner;

      const dashboards = this.dashboardManager.listDashboards(filters);
      
      res.json({
        data: dashboards,
        count: dashboards.length
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async createDashboard(req: Request, res: Response): Promise<void> {
    try {
      const validation = DashboardCreateSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors
        });
        return;
      }

      const { name, type, description } = validation.data;
      const dashboard = await this.dashboardManager.createDashboard(
        name,
        type as any,
        req.user?.id || 'anonymous'
      );

      if (description) {
        await this.dashboardManager.updateDashboard(dashboard.id, { description });
      }

      res.status(201).json({ data: dashboard });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const dashboard = this.dashboardManager.getDashboard(req.params.id);
      
      if (!dashboard) {
        res.status(404).json({ error: 'Dashboard not found' });
        return;
      }

      res.json({ data: dashboard });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async updateDashboard(req: Request, res: Response): Promise<void> {
    try {
      const dashboard = await this.dashboardManager.updateDashboard(
        req.params.id,
        req.body
      );

      res.json({ data: dashboard });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteDashboard(req: Request, res: Response): Promise<void> {
    try {
      await this.dashboardManager.deleteDashboard(req.params.id);
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Widget endpoints
  private async addWidget(req: Request, res: Response): Promise<void> {
    try {
      const validation = WidgetCreateSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors
        });
        return;
      }

      const widget = await this.dashboardManager.addWidget(
        req.params.id,
        validation.data as any
      );

      res.status(201).json({ data: widget });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async updateWidget(req: Request, res: Response): Promise<void> {
    try {
      const widget = await this.dashboardManager.updateWidget(
        req.params.dashboardId,
        req.params.widgetId,
        req.body
      );

      res.json({ data: widget });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async removeWidget(req: Request, res: Response): Promise<void> {
    try {
      await this.dashboardManager.removeWidget(
        req.params.dashboardId,
        req.params.widgetId
      );

      res.status(204).send();
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Query endpoints
  private async executeQuery(req: Request, res: Response): Promise<void> {
    try {
      const validation = QuerySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid query',
          details: validation.error.errors
        });
        return;
      }

      const query = validation.data as AnalyticsQuery;
      const result = await this.executeAnalyticsQuery(query);

      res.json(result);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async validateQuery(req: Request, res: Response): Promise<void> {
    try {
      const validation = QuerySchema.safeParse(req.body);
      
      if (!validation.success) {
        res.json({
          valid: false,
          errors: validation.error.errors
        });
        return;
      }

      // Additional query validation logic
      const query = validation.data as AnalyticsQuery;
      const validationResult = await this.validateAnalyticsQuery(query);

      res.json({
        valid: validationResult.valid,
        errors: validationResult.errors || []
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Pipeline endpoints
  private async listPipelines(req: Request, res: Response): Promise<void> {
    try {
      const { status, tags } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];

      const pipelines = this.pipelineManager.listPipelines(filters);
      
      res.json({
        data: pipelines,
        count: pipelines.length
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async createPipeline(req: Request, res: Response): Promise<void> {
    try {
      const { name, stages } = req.body;
      
      const pipeline = await this.pipelineManager.createPipeline(
        name,
        stages,
        req.user?.id || 'anonymous'
      );

      res.status(201).json({ data: pipeline });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPipeline(req: Request, res: Response): Promise<void> {
    try {
      const pipeline = this.pipelineManager.getPipeline(req.params.id);
      
      if (!pipeline) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }

      res.json({ data: pipeline });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async runPipeline(req: Request, res: Response): Promise<void> {
    try {
      const run = await this.pipelineManager.runPipeline(
        req.params.id,
        req.body.parameters
      );

      res.json({ data: run });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async schedulePipeline(req: Request, res: Response): Promise<void> {
    try {
      const { schedule } = req.body;
      
      await this.pipelineManager.schedulePipeline(req.params.id, schedule);
      
      res.json({ message: 'Pipeline scheduled successfully' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async unschedulePipeline(req: Request, res: Response): Promise<void> {
    try {
      this.pipelineManager.unschedulePipeline(req.params.id);
      
      res.json({ message: 'Pipeline schedule removed' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPipelineRuns(req: Request, res: Response): Promise<void> {
    try {
      const pipeline = this.pipelineManager.getPipeline(req.params.id);
      
      if (!pipeline) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }

      // Get recent runs (would be implemented with proper storage)
      const runs: PipelineRun[] = [];
      if (pipeline.status.lastRun) {
        runs.push(pipeline.status.lastRun);
      }

      res.json({
        data: runs,
        count: runs.length
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Visualization endpoints
  private async createVisualization(req: Request, res: Response): Promise<void> {
    try {
      const { type, data, config } = req.body;
      
      const viz = this.vizFactory.create(
        type as VisualizationType,
        data,
        config
      );

      res.status(201).json({ data: viz });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async updateVisualizationData(req: Request, res: Response): Promise<void> {
    try {
      const { data } = req.body;
      
      this.vizFactory.updateData(req.params.id, data);
      
      res.json({ message: 'Visualization data updated' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Streaming endpoints
  private async listStreams(req: Request, res: Response): Promise<void> {
    try {
      const streams = this.streamingAnalytics.listStreams();
      
      res.json({
        data: streams,
        count: streams.length
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async createStream(req: Request, res: Response): Promise<void> {
    try {
      const stream = await this.streamingAnalytics.createStream(req.body);
      
      res.status(201).json({ data: stream });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async startStream(req: Request, res: Response): Promise<void> {
    try {
      await this.streamingAnalytics.startStream(req.params.id);
      
      res.json({ message: 'Stream started' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async stopStream(req: Request, res: Response): Promise<void> {
    try {
      await this.streamingAnalytics.stopStream(req.params.id);
      
      res.json({ message: 'Stream stopped' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Model endpoints
  private async listModels(req: Request, res: Response): Promise<void> {
    try {
      const { type, status } = req.query;
      
      const filters: any = {};
      if (type) filters.type = type;
      if (status) filters.status = status;

      const models = this.modelRegistry.listModels(filters);
      
      res.json({
        data: models,
        count: models.length
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async registerModel(req: Request, res: Response): Promise<void> {
    try {
      const model = await this.modelRegistry.registerModel(req.body);
      
      res.status(201).json({ data: model });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getModel(req: Request, res: Response): Promise<void> {
    try {
      const model = this.modelRegistry.getModel(req.params.id);
      
      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.json({ data: model });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deployModel(req: Request, res: Response): Promise<void> {
    try {
      const deployment = await this.modelRegistry.deployModel(
        req.params.id,
        req.body
      );

      res.json({ data: deployment });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Health check
  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        components: {
          dashboards: 'healthy',
          pipelines: 'healthy',
          streaming: 'healthy',
          models: 'healthy'
        }
      };

      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message
      });
    }
  }

  // Helper methods
  private async executeAnalyticsQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const startTime = Date.now();
    
    try {
      // Simulate query execution
      // In production, this would execute against a real data store
      const data = await this.simulateQueryExecution(query);
      
      return {
        query,
        data,
        metadata: {
          executionTime: Date.now() - startTime,
          rowCount: data.length,
          cached: false,
          timestamp: new Date()
        }
      };
    } catch (error) {
      logger.error('Query execution failed', { query, error });
      
      return {
        query,
        data: [],
        metadata: {
          executionTime: Date.now() - startTime,
          rowCount: 0,
          cached: false,
          timestamp: new Date()
        },
        errors: [{
          code: 'QUERY_FAILED',
          message: (error as Error).message
        }]
      };
    }
  }

  private async simulateQueryExecution(query: AnalyticsQuery): Promise<any[]> {
    // Simulate data based on query
    const data = [];
    const count = Math.floor(Math.random() * 100) + 10;
    
    for (let i = 0; i < count; i++) {
      data.push({
        timestamp: new Date(Date.now() - i * 60000),
        value: Math.random() * 100,
        metric: 'cpu_usage',
        systemId: `system-${Math.floor(Math.random() * 5) + 1}`
      });
    }
    
    return data;
  }

  private async validateAnalyticsQuery(query: AnalyticsQuery): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];
    
    // Basic validation
    if (typeof query.query === 'object') {
      if (!query.query.from) {
        errors.push('FROM clause is required');
      }
      if (!query.query.select || query.query.select.length === 0) {
        errors.push('SELECT clause must contain at least one field');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private handleError(res: Response, error: any): void {
    logger.error('API error', { error });
    
    if (error.message?.includes('not found')) {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message?.includes('Invalid') || error.message?.includes('required')) {
      res.status(400).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}