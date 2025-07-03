import {
  createAnalyticsEngine,
  AnalyticsEngine,
  DashboardType,
  ModelType,
  ModelFramework,
  StageType,
  VisualizationType
} from '../src';

describe('Analytics & ML Tests', () => {
  let analytics: AnalyticsEngine;

  beforeEach(() => {
    analytics = createAnalyticsEngine({
      dashboards: {
        maxDashboards: 10,
        enableAutoSave: false
      },
      pipelines: {
        maxConcurrentRuns: 3,
        enableMetrics: true
      },
      streaming: {
        maxConcurrentStreams: 5,
        enableBackpressure: true
      },
      models: {
        maxModelsPerType: 10,
        enableVersioning: true,
        autoDeployment: false
      }
    });
  });

  afterEach(() => {
    analytics.destroy();
  });

  describe('Dashboard Management', () => {
    test('should create dashboard', async () => {
      const dashboard = await analytics.createDashboard(
        'Test Dashboard',
        DashboardType.OVERVIEW,
        'test-user'
      );

      expect(dashboard).toBeDefined();
      expect(dashboard.name).toBe('Test Dashboard');
      expect(dashboard.type).toBe(DashboardType.OVERVIEW);
      expect(dashboard.widgets).toEqual([]);
    });

    test('should create dashboard from template', async () => {
      const dashboard = await analytics.createDashboardFromTemplate(
        DashboardType.PERFORMANCE,
        'Performance Dashboard',
        'test-user',
        ['system-1', 'system-2']
      );

      expect(dashboard).toBeDefined();
      expect(dashboard.widgets.length).toBeGreaterThan(0);
      expect(dashboard.type).toBe(DashboardType.PERFORMANCE);
    });

    test('should list dashboards', async () => {
      await analytics.createDashboard('Dashboard 1', DashboardType.OVERVIEW, 'user1');
      await analytics.createDashboard('Dashboard 2', DashboardType.SECURITY, 'user1');

      const dashboards = analytics.getDashboards();
      expect(dashboards).toHaveLength(2);
    });
  });

  describe('ML Pipeline Management', () => {
    test('should create pipeline', async () => {
      const stages = [
        {
          id: 'ingest',
          name: 'Data Ingestion',
          type: StageType.DATA_INGESTION,
          config: {
            processor: 'ingestion',
            parameters: { source: 'metrics' },
            inputs: [],
            outputs: [{ name: 'raw_data', type: 'dataset' as const, destination: 'memory' }]
          },
          dependencies: []
        },
        {
          id: 'validate',
          name: 'Data Validation',
          type: StageType.DATA_VALIDATION,
          config: {
            processor: 'validation',
            parameters: { rules: [] },
            inputs: [{ name: 'raw_data', type: 'dataset' as const, source: 'memory' }],
            outputs: [{ name: 'valid_data', type: 'dataset' as const, destination: 'memory' }]
          },
          dependencies: ['ingest']
        }
      ];

      const pipeline = await analytics.createPipeline(
        'Test Pipeline',
        stages,
        'test-user'
      );

      expect(pipeline).toBeDefined();
      expect(pipeline.name).toBe('Test Pipeline');
      expect(pipeline.stages).toHaveLength(2);
      expect(pipeline.status.state).toBe('idle');
    });

    test('should run pipeline', async () => {
      const stages = [
        {
          id: 'ingest',
          name: 'Data Ingestion',
          type: StageType.DATA_INGESTION,
          config: {
            processor: 'ingestion',
            parameters: {},
            inputs: [],
            outputs: []
          },
          dependencies: []
        }
      ];

      const pipeline = await analytics.createPipeline(
        'Simple Pipeline',
        stages,
        'test-user'
      );

      const run = await analytics.runPipeline(pipeline.id);

      expect(run).toBeDefined();
      expect(run.pipelineId).toBe(pipeline.id);
      expect(run.status).toBe('completed');
    });

    test('should detect circular dependencies', async () => {
      const stages = [
        {
          id: 'stage1',
          name: 'Stage 1',
          type: StageType.CUSTOM,
          config: { processor: 'custom', parameters: {}, inputs: [], outputs: [] },
          dependencies: ['stage2']
        },
        {
          id: 'stage2',
          name: 'Stage 2',
          type: StageType.CUSTOM,
          config: { processor: 'custom', parameters: {}, inputs: [], outputs: [] },
          dependencies: ['stage1']
        }
      ];

      await expect(
        analytics.createPipeline('Circular Pipeline', stages, 'test-user')
      ).rejects.toThrow('circular dependencies');
    });
  });

  describe('Streaming Analytics', () => {
    test('should create stream', async () => {
      const stream = await analytics.createStream({
        name: 'Test Stream',
        sources: [{
          id: 'source1',
          type: 'metrics',
          config: {}
        }],
        processors: [{
          id: 'filter1',
          type: 'filter',
          config: {
            operation: 'filter',
            parameters: { condition: 'value > 50' }
          }
        }],
        sinks: [{
          id: 'sink1',
          type: 'dashboard',
          config: {}
        }],
        windowConfig: {
          type: 'tumbling',
          size: 60000
        }
      });

      expect(stream).toBeDefined();
      expect(stream.name).toBe('Test Stream');
      expect(stream.status.state).toBe('stopped');
    });

    test('should start and stop stream', async () => {
      const stream = await analytics.createStream({
        name: 'Controllable Stream',
        sources: [{ id: 's1', type: 'metrics', config: {} }],
        processors: [],
        sinks: [{ id: 'sink1', type: 'storage', config: {} }],
        windowConfig: { type: 'tumbling', size: 5000 }
      });

      await analytics.startStream(stream.id);
      
      const runningStreams = analytics.getStreams();
      const runningStream = runningStreams.find(s => s.id === stream.id);
      expect(runningStream?.status.state).toBe('running');

      await analytics.stopStream(stream.id);
      
      const stoppedStreams = analytics.getStreams();
      const stoppedStream = stoppedStreams.find(s => s.id === stream.id);
      expect(stoppedStream?.status.state).toBe('stopped');
    });
  });

  describe('Model Registry', () => {
    test('should register model', async () => {
      const model = await analytics.registerModel({
        name: 'anomaly-detector',
        type: ModelType.ANOMALY_DETECTION,
        framework: ModelFramework.TENSORFLOW,
        version: '1.0.0',
        artifacts: [{
          type: 'model',
          path: '/models/anomaly-detector.h5',
          size: 1024 * 1024 * 10,
          checksum: 'abc123'
        }],
        metadata: {
          createdBy: 'test-user',
          description: 'Anomaly detection model',
          tags: ['anomaly', 'tensorflow'],
          hyperparameters: {
            layers: 3,
            neurons: [64, 32, 16],
            activation: 'relu'
          },
          trainingData: {
            dataset: 'metrics-2024',
            version: '1.0',
            size: 1000000,
            features: ['cpu_usage', 'memory_usage', 'response_time'],
            split: { train: 0.7, validation: 0.15, test: 0.15 }
          },
          dependencies: ['tensorflow==2.12.0']
        },
        metrics: {
          accuracy: 0.95,
          precision: 0.93,
          recall: 0.92,
          f1Score: 0.925,
          custom: {}
        }
      });

      expect(model).toBeDefined();
      expect(model.name).toBe('anomaly-detector');
      expect(model.version).toBe('1.0.0');
      expect(model.status.state).toBe('ready');
    });

    test('should auto-generate version', async () => {
      const model1 = await analytics.registerModel({
        name: 'classifier',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
        artifacts: [{
          type: 'model',
          path: '/models/classifier.pkl',
          size: 1024 * 100
        }],
        metadata: {
          createdBy: 'test-user',
          tags: [],
          hyperparameters: {},
          trainingData: {
            dataset: 'test',
            version: '1.0',
            size: 1000,
            features: [],
            split: { train: 0.8, validation: 0.1, test: 0.1 }
          },
          dependencies: []
        },
        metrics: { accuracy: 0.9, custom: {} }
      });

      expect(model1.version).toBe('1.0.0');

      const model2 = await analytics.registerModel({
        name: 'classifier',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
        artifacts: [{
          type: 'model',
          path: '/models/classifier-v2.pkl',
          size: 1024 * 100
        }],
        metadata: {
          createdBy: 'test-user',
          tags: [],
          hyperparameters: {},
          trainingData: {
            dataset: 'test',
            version: '1.0',
            size: 1000,
            features: [],
            split: { train: 0.8, validation: 0.1, test: 0.1 }
          },
          dependencies: []
        },
        metrics: { accuracy: 0.92, custom: {} }
      });

      expect(model2.version).toBe('1.0.1');
    });

    test('should deploy model', async () => {
      const model = await analytics.registerModel({
        name: 'predictor',
        type: ModelType.REGRESSION,
        framework: ModelFramework.XGBOOST,
        version: '1.0.0',
        artifacts: [{
          type: 'model',
          path: '/models/predictor.xgb',
          size: 1024 * 500
        }],
        metadata: {
          createdBy: 'test-user',
          tags: ['regression'],
          hyperparameters: { max_depth: 6, n_estimators: 100 },
          trainingData: {
            dataset: 'metrics',
            version: '1.0',
            size: 50000,
            features: ['feature1', 'feature2'],
            split: { train: 0.8, validation: 0.1, test: 0.1 }
          },
          dependencies: ['xgboost==1.7.0']
        },
        metrics: { rmse: 0.05, mae: 0.03, custom: {} }
      });

      const deployment = await analytics.deployModel(model.id, {
        environment: 'development',
        instances: 2,
        resources: { cpu: 2, memory: 4096 }
      });

      expect(deployment).toBeDefined();
      expect(deployment.environment).toBe('development');
      expect(deployment.instances).toHaveLength(2);
      expect(deployment.version).toBe('1.0.0');
    });

    test('should compare models', () => {
      // Would need to register multiple models first
      expect(() => analytics.compareModels(['model1', 'model2']))
        .toThrow('Need at least 2 models');
    });
  });

  describe('Visualizations', () => {
    test('should create visualization', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 15 }
      ];

      const viz = analytics.createVisualization(
        VisualizationType.LINE_CHART,
        data,
        {
          type: 'line',
          options: {
            xField: 'x',
            yField: 'y',
            showLegend: true
          }
        }
      );

      expect(viz).toBeDefined();
      expect(viz.type).toBe(VisualizationType.LINE_CHART);
      expect(viz.data).toEqual(data);
    });
  });

  describe('Analytics Queries', () => {
    test('should execute query', async () => {
      const result = await analytics.executeQuery({
        query: 'SELECT * FROM metrics WHERE value > 50',
        parameters: {}
      });

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    test('should report healthy status', async () => {
      const health = await analytics.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.components).toBeDefined();
      expect(health.components.dashboards).toBe(0);
      expect(health.components.pipelines).toBe(0);
      expect(health.components.streams).toBe(0);
      expect(health.components.models).toBe(0);
    });
  });

  describe('Statistics', () => {
    test('should return statistics', async () => {
      // Create some entities
      await analytics.createDashboard('Dashboard 1', DashboardType.OVERVIEW, 'user1');
      await analytics.createPipeline('Pipeline 1', [{
        id: 'stage1',
        name: 'Stage 1',
        type: StageType.DATA_INGESTION,
        config: { processor: 'test', parameters: {}, inputs: [], outputs: [] },
        dependencies: []
      }], 'user1');

      const stats = analytics.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.dashboards.total).toBe(1);
      expect(stats.pipelines.total).toBe(1);
      expect(stats.streams.total).toBe(0);
      expect(stats.models.total).toBe(0);
    });
  });

  describe('Event Handling', () => {
    test('should emit events', async (done) => {
      analytics.on('dashboardCreated', (dashboard) => {
        expect(dashboard.name).toBe('Event Test Dashboard');
        done();
      });

      await analytics.createDashboard(
        'Event Test Dashboard',
        DashboardType.OVERVIEW,
        'test-user'
      );
    });
  });
});