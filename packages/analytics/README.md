# @cm-diagnostics/analytics

Comprehensive analytics, ML pipelines, dashboards, and data visualization for CM Diagnostics.

## Features

- 📊 **Interactive Dashboards**: Pre-built and custom dashboards with real-time widgets
- 🤖 **ML Pipeline Framework**: Build, train, and deploy machine learning models
- 📈 **Data Visualization**: Rich visualization library with 15+ chart types
- 🚀 **Real-time Streaming**: Stream processing for real-time analytics
- 🎯 **Model Registry**: Version control and deployment management for ML models
- 🔌 **REST API**: Comprehensive API for all analytics operations

## Installation

```bash
npm install @cm-diagnostics/analytics
```

## Quick Start

```typescript
import { createAnalyticsEngine } from '@cm-diagnostics/analytics';

// Create analytics engine
const analytics = createAnalyticsEngine({
  dashboards: {
    maxDashboards: 100,
    enableAutoSave: true
  },
  pipelines: {
    maxConcurrentRuns: 5,
    enableMetrics: true
  },
  streaming: {
    maxConcurrentStreams: 10,
    enableBackpressure: true
  },
  models: {
    enableVersioning: true,
    autoDeployment: false
  }
});

// Create a dashboard
const dashboard = await analytics.createDashboardFromTemplate(
  'performance',
  'System Performance',
  'admin',
  ['system-1', 'system-2']
);

// Create and run ML pipeline
const pipeline = await analytics.createPipeline('Anomaly Detection', [
  {
    id: 'ingest',
    name: 'Data Ingestion',
    type: 'data_ingestion',
    config: { /* ... */ },
    dependencies: []
  },
  {
    id: 'train',
    name: 'Model Training',
    type: 'model_training',
    config: { /* ... */ },
    dependencies: ['ingest']
  }
], 'data-scientist');

const run = await analytics.runPipeline(pipeline.id);
```

## Dashboard Management

### Creating Dashboards

```typescript
// Create empty dashboard
const dashboard = await analytics.createDashboard(
  'My Dashboard',
  'custom',
  'user-id'
);

// Create from template
const perfDashboard = await analytics.createDashboardFromTemplate(
  'performance',
  'Performance Monitoring',
  'user-id',
  ['system-1', 'system-2', 'system-3']
);
```

### Available Dashboard Templates

- **Overview**: System health overview with key metrics
- **Performance**: Detailed performance metrics and trends
- **Security**: Security monitoring and alerts
- **Capacity**: Capacity planning and resource utilization
- **Custom**: Build your own dashboard

### Adding Widgets

```typescript
// Add metric card
await dashboardManager.createMetricWidget(
  dashboardId,
  'cpu_usage',
  ['system-1'],
  { x: 0, y: 0 }
);

// Add time series chart
await dashboardManager.createTimeSeriesWidget(
  dashboardId,
  ['cpu_usage', 'memory_usage'],
  ['system-1'],
  { x: 0, y: 2 }
);

// Add heatmap
await dashboardManager.createHeatmapWidget(
  dashboardId,
  'response_time',
  ['system-1', 'system-2'],
  { x: 6, y: 2 }
);
```

## ML Pipeline Framework

### Pipeline Stages

1. **Data Ingestion**: Load data from various sources
2. **Data Validation**: Validate data quality and schema
3. **Data Preprocessing**: Clean and transform data
4. **Feature Engineering**: Create features for ML models
5. **Model Training**: Train machine learning models
6. **Model Evaluation**: Evaluate model performance
7. **Model Deployment**: Deploy models to production
8. **Monitoring**: Monitor model performance

### Creating Pipelines

```typescript
const pipeline = await analytics.createPipeline('Predictive Maintenance', [
  {
    id: 'ingest',
    name: 'Ingest Metrics',
    type: StageType.DATA_INGESTION,
    config: {
      processor: 'metrics-ingestion',
      parameters: {
        sources: ['prometheus', 'elasticsearch'],
        timeRange: '7d'
      },
      inputs: [],
      outputs: [{
        name: 'raw_metrics',
        type: 'dataset',
        destination: 's3://data/raw'
      }]
    },
    dependencies: []
  },
  {
    id: 'preprocess',
    name: 'Preprocess Data',
    type: StageType.DATA_PREPROCESSING,
    config: {
      processor: 'standard-preprocessing',
      parameters: {
        normalize: true,
        handleMissing: 'interpolate'
      },
      inputs: [{
        name: 'raw_metrics',
        type: 'dataset',
        source: 's3://data/raw'
      }],
      outputs: [{
        name: 'processed_data',
        type: 'dataset',
        destination: 's3://data/processed'
      }]
    },
    dependencies: ['ingest']
  },
  {
    id: 'train',
    name: 'Train Model',
    type: StageType.MODEL_TRAINING,
    config: {
      processor: 'automl-trainer',
      parameters: {
        algorithm: 'random_forest',
        hyperparameters: {
          n_estimators: 100,
          max_depth: 10
        }
      },
      inputs: [{
        name: 'processed_data',
        type: 'dataset',
        source: 's3://data/processed'
      }],
      outputs: [{
        name: 'trained_model',
        type: 'model',
        destination: 's3://models/predictive-maintenance'
      }]
    },
    dependencies: ['preprocess']
  }
], 'ml-engineer');

// Schedule pipeline
await analytics.schedulePipeline(pipeline.id, {
  type: 'cron',
  expression: '0 2 * * *', // Daily at 2 AM
  timezone: 'UTC'
});
```

## Streaming Analytics

### Creating Streams

```typescript
const stream = await analytics.createStream({
  name: 'Real-time Anomaly Detection',
  sources: [
    {
      id: 'metrics-source',
      type: 'kafka',
      config: {
        topic: 'system-metrics',
        brokers: ['kafka:9092'],
        groupId: 'analytics-consumer'
      }
    }
  ],
  processors: [
    {
      id: 'filter-high-cpu',
      type: 'filter',
      config: {
        operation: 'filter',
        parameters: {
          condition: 'event.cpu_usage > 80'
        }
      }
    },
    {
      id: 'detect-anomalies',
      type: 'ml',
      config: {
        operation: 'predict',
        parameters: {
          modelId: 'anomaly-detector-v2',
          features: ['cpu_usage', 'memory_usage', 'disk_io']
        }
      }
    }
  ],
  sinks: [
    {
      id: 'alert-sink',
      type: 'alert',
      config: {
        alertName: 'High CPU Anomaly',
        condition: 'prediction.anomaly_score > 0.8'
      }
    },
    {
      id: 'storage-sink',
      type: 'storage',
      config: {
        destination: 's3://anomalies/',
        format: 'parquet'
      }
    }
  ],
  windowConfig: {
    type: 'sliding',
    size: 300000, // 5 minutes
    slide: 60000  // 1 minute
  }
});

// Start streaming
await analytics.startStream(stream.id);
```

## Model Registry

### Registering Models

```typescript
const model = await analytics.registerModel({
  name: 'cpu-usage-predictor',
  type: ModelType.TIME_SERIES,
  framework: ModelFramework.TENSORFLOW,
  version: '2.0.0',
  artifacts: [
    {
      type: 'model',
      path: 's3://models/cpu-predictor/model.h5',
      size: 52428800, // 50MB
      checksum: 'sha256:abcd1234...'
    },
    {
      type: 'weights',
      path: 's3://models/cpu-predictor/weights.h5',
      size: 10485760, // 10MB
      checksum: 'sha256:efgh5678...'
    }
  ],
  metadata: {
    createdBy: 'ml-team',
    description: 'LSTM model for CPU usage prediction',
    tags: ['time-series', 'cpu', 'lstm'],
    hyperparameters: {
      layers: 3,
      units: [128, 64, 32],
      dropout: 0.2,
      learning_rate: 0.001
    },
    trainingData: {
      dataset: 'cpu-metrics-2024',
      version: '3.0',
      size: 10000000,
      features: ['cpu_usage', 'load_average', 'process_count'],
      split: { train: 0.7, validation: 0.15, test: 0.15 }
    },
    dependencies: [
      'tensorflow==2.12.0',
      'numpy==1.24.3',
      'pandas==2.0.3'
    ]
  },
  metrics: {
    rmse: 0.045,
    mae: 0.032,
    r2Score: 0.94,
    custom: {
      forecast_accuracy_1h: 0.96,
      forecast_accuracy_24h: 0.88
    }
  }
});
```

### Deploying Models

```typescript
const deployment = await analytics.deployModel(model.id, {
  environment: 'production',
  instances: 3,
  resources: {
    cpu: 4,
    memory: 8192,
    gpu: 1
  },
  scaling: {
    min: 2,
    max: 10,
    targetMetric: 'latency',
    targetValue: 100 // ms
  },
  monitoring: {
    metrics: ['latency', 'throughput', 'error_rate', 'drift'],
    alerts: [
      {
        name: 'high_latency',
        condition: 'latency > 200',
        threshold: 200,
        actions: ['scale_up', 'notify']
      },
      {
        name: 'model_drift',
        condition: 'drift_score > 0.1',
        threshold: 0.1,
        actions: ['notify', 'retrain']
      }
    ],
    logging: {
      level: 'info',
      destinations: ['cloudwatch', 'elasticsearch']
    }
  }
});

// Endpoint available at:
// https://api.cm-diagnostics.local/models/cpu-usage-predictor/2.0.0/predict
```

### Model Comparison

```typescript
const comparison = analytics.compareModels([
  'cpu-predictor-v1',
  'cpu-predictor-v2',
  'cpu-predictor-lstm'
]);

console.log('Best performing model:', comparison.bestPerforming);
// Output: { modelId: 'cpu-predictor-v2', metric: 'accuracy', value: 0.96 }
```

## Data Visualization

### Available Visualization Types

- Line Chart
- Bar Chart
- Pie Chart
- Scatter Plot
- Heatmap
- Sankey Diagram
- Network Graph
- Treemap
- Sunburst Chart
- Radar Chart
- Gauge Chart
- Candlestick Chart

### Creating Visualizations

```typescript
// Time series visualization
const timeSeriesViz = analytics.createVisualization(
  VisualizationType.LINE_CHART,
  metricsData,
  {
    type: 'line',
    options: {
      xField: 'timestamp',
      yField: 'value',
      series: [
        { field: 'cpu_usage', label: 'CPU', color: '#3b82f6' },
        { field: 'memory_usage', label: 'Memory', color: '#10b981' }
      ],
      showLegend: true,
      showGrid: true,
      animations: true
    }
  }
);

// Render to DOM element
analytics.renderVisualization(
  timeSeriesViz,
  document.getElementById('chart-container')!,
  { theme: 'dark', responsive: true }
);

// Correlation heatmap
const heatmapViz = analytics.createVisualization(
  VisualizationType.HEATMAP,
  correlationData,
  {
    type: 'heatmap',
    options: {
      colorScheme: 'viridis',
      showLabels: true,
      cellGap: 1,
      min: -1,
      max: 1
    }
  }
);
```

## REST API Integration

```typescript
import express from 'express';

const app = express();

// Mount analytics API
app.use('/api/analytics', analytics.getAPIRouter());

// API endpoints available:
// GET    /api/analytics/dashboards
// POST   /api/analytics/dashboards
// GET    /api/analytics/dashboards/:id
// PUT    /api/analytics/dashboards/:id
// DELETE /api/analytics/dashboards/:id
// 
// POST   /api/analytics/dashboards/:id/widgets
// PUT    /api/analytics/dashboards/:dashboardId/widgets/:widgetId
// DELETE /api/analytics/dashboards/:dashboardId/widgets/:widgetId
// 
// POST   /api/analytics/query
// POST   /api/analytics/query/validate
// 
// GET    /api/analytics/pipelines
// POST   /api/analytics/pipelines
// GET    /api/analytics/pipelines/:id
// POST   /api/analytics/pipelines/:id/run
// POST   /api/analytics/pipelines/:id/schedule
// 
// GET    /api/analytics/models
// POST   /api/analytics/models
// GET    /api/analytics/models/:id
// POST   /api/analytics/models/:id/deploy
// 
// GET    /api/analytics/streams
// POST   /api/analytics/streams
// POST   /api/analytics/streams/:id/start
// POST   /api/analytics/streams/:id/stop
```

## Analytics Queries

```typescript
// SQL-style query
const result = await analytics.executeQuery({
  query: `
    SELECT 
      systemId,
      AVG(cpu_usage) as avg_cpu,
      MAX(memory_usage) as max_memory,
      COUNT(*) as sample_count
    FROM metrics
    WHERE timestamp > NOW() - INTERVAL '1 hour'
    GROUP BY systemId
    ORDER BY avg_cpu DESC
    LIMIT 10
  `
});

// Query builder
const result2 = await analytics.executeQuery({
  query: {
    select: ['systemId', 'AVG(cpu_usage)', 'MAX(memory_usage)'],
    from: 'metrics',
    where: [
      { field: 'timestamp', operator: 'gt', value: 'now-1h' },
      { field: 'cpu_usage', operator: 'gt', value: 50 }
    ],
    groupBy: ['systemId'],
    orderBy: [{ field: 'AVG(cpu_usage)', direction: 'desc' }],
    limit: 10
  },
  cache: {
    enabled: true,
    ttl: 300 // 5 minutes
  }
});
```

## Event Handling

```typescript
// Dashboard events
analytics.on('dashboardCreated', (dashboard) => {
  console.log(`Dashboard created: ${dashboard.name}`);
});

analytics.on('widgetUpdated', ({ dashboard, widget }) => {
  console.log(`Widget ${widget.id} updated in dashboard ${dashboard.id}`);
});

// Pipeline events
analytics.on('pipelineStarted', ({ pipeline, run }) => {
  console.log(`Pipeline ${pipeline.name} started: ${run.id}`);
});

analytics.on('pipelineCompleted', ({ pipeline, run }) => {
  console.log(`Pipeline completed in ${run.metrics.duration}ms`);
});

analytics.on('stageFailed', ({ pipeline, stage, error }) => {
  console.error(`Stage ${stage.name} failed: ${error.message}`);
});

// Model events
analytics.on('modelRegistered', (model) => {
  console.log(`Model registered: ${model.name} v${model.version}`);
});

analytics.on('modelDeployed', ({ model, deployment }) => {
  console.log(`Model deployed to ${deployment.environment}`);
});

analytics.on('deploymentAlert', ({ deployment, alert, value }) => {
  console.warn(`Alert ${alert.name}: ${value}`);
});

// Streaming events
analytics.on('streamError', ({ streamId, error }) => {
  console.error(`Stream error: ${error.message}`);
});

analytics.on('analyticsEvent', (event) => {
  // Handle all analytics events
  console.log(`Analytics event: ${event.type}`, event.data);
});
```

## Statistics and Monitoring

```typescript
// Get system statistics
const stats = analytics.getStatistics();
console.log(`
  Dashboards: ${stats.dashboards.total}
  Active Pipelines: ${stats.pipelines.running}
  Active Streams: ${stats.streams.active}
  Deployed Models: ${stats.models.deployed}
`);

// Health check
const health = await analytics.healthCheck();
if (health.status !== 'healthy') {
  console.warn('Analytics system degraded:', health.components);
}
```

## Best Practices

1. **Dashboard Design**
   - Keep dashboards focused on specific use cases
   - Use appropriate visualizations for data types
   - Limit widgets per dashboard for performance

2. **Pipeline Development**
   - Design idempotent pipeline stages
   - Implement proper error handling and retries
   - Use checkpointing for long-running pipelines

3. **Model Management**
   - Always version your models
   - Track training data and hyperparameters
   - Monitor model performance and drift

4. **Streaming Analytics**
   - Design for backpressure handling
   - Use appropriate window sizes
   - Implement dead letter queues

5. **Performance**
   - Enable caching for frequently accessed queries
   - Use data sampling for large datasets
   - Implement proper indexing strategies

## License

Part of CM Diagnostics - Enterprise License