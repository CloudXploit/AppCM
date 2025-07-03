# @cm-diagnostics/advanced-diagnostics

Advanced machine learning and AI-powered diagnostics for CM Diagnostics, providing anomaly detection, predictive analytics, pattern recognition, root cause analysis, and automated learning.

## Features

- 🤖 **Multi-Algorithm Anomaly Detection**: Statistical, Isolation Forest, and Autoencoder methods
- 📈 **Predictive Analytics**: Time series forecasting and insight generation
- 🔍 **Pattern Recognition**: Automatic discovery and matching of system behavior patterns
- 🎯 **Root Cause Analysis**: Intelligent causality inference with evidence-based reasoning
- 🧠 **Automated Learning**: Learns from past resolutions to recommend future fixes
- 📊 **Real-time Processing**: Stream processing of metrics with adaptive learning

## Installation

```bash
npm install @cm-diagnostics/advanced-diagnostics
```

## Quick Start

```typescript
import { createAdvancedDiagnostics, AnomalyAlgorithm } from '@cm-diagnostics/advanced-diagnostics';

// Create advanced diagnostics engine
const advancedDiagnostics = createAdvancedDiagnostics({
  anomalyDetection: {
    sensitivity: 0.7,
    algorithms: [
      AnomalyAlgorithm.STATISTICAL,
      AnomalyAlgorithm.ISOLATION_FOREST,
      AnomalyAlgorithm.AUTOENCODER
    ],
    windowSize: 60,
    minimumDataPoints: 10,
    adaptiveLearning: true
  },
  enableLearning: true,
  enablePredictions: true
});

// Ingest metrics
await advancedDiagnostics.ingestMetrics(metrics);

// Detect anomalies
const anomalies = await advancedDiagnostics.detectAnomalies('system-id');

// Get predictive insights
const insights = await advancedDiagnostics.getInsights('system-id');

// Analyze root cause
const rootCause = await advancedDiagnostics.analyzeRootCause(finding);
```

## Core Components

### 1. Anomaly Detection

Multiple algorithms work together to detect various types of anomalies:

```typescript
// Configure anomaly detection
const anomalies = await advancedDiagnostics.detectAnomalies('system-id', {
  sensitivity: 0.8, // 0-1, higher = more sensitive
  algorithms: [
    AnomalyAlgorithm.STATISTICAL,      // Z-score and MAD
    AnomalyAlgorithm.ISOLATION_FOREST, // Tree-based isolation
    AnomalyAlgorithm.AUTOENCODER,      // Neural network reconstruction
    AnomalyAlgorithm.PROPHET           // Time series decomposition
  ]
});

// Anomaly types detected
anomalies.forEach(anomaly => {
  console.log(`${anomaly.metric}: ${anomaly.type}`);
  // Types: SPIKE, DROP, TREND, PATTERN, OUTLIER, SEASONALITY
});
```

### 2. Predictive Analytics

Forecast future values and identify potential issues:

```typescript
// Predict future metric values
const prediction = await advancedDiagnostics.getPredictions(
  'system-id',
  'cpu_usage',
  60 // horizon in minutes
);

console.log(`Predicted value: ${prediction.predictedValue}`);
console.log(`Confidence: ${prediction.confidence}`);
console.log(`Interval: ${prediction.confidenceInterval.lower} - ${prediction.confidenceInterval.upper}`);

// Get actionable insights
const insights = await advancedDiagnostics.getInsights('system-id');

insights.forEach(insight => {
  console.log(`${insight.title}: ${insight.description}`);
  console.log(`Impact: ${insight.impact}, Likelihood: ${insight.likelihood}`);
  console.log('Recommendations:', insight.recommendations);
});
```

### 3. Pattern Recognition

Discover and match behavioral patterns:

```typescript
// Find patterns in time range
const patterns = await advancedDiagnostics.findPatterns('system-id', {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-08')
});

// Pattern types
patterns.forEach(pattern => {
  switch(pattern.type) {
    case PatternType.PERFORMANCE:
      console.log('Performance pattern:', pattern.name);
      break;
    case PatternType.ERROR:
      console.log('Error pattern:', pattern.name);
      break;
    case PatternType.USAGE:
      console.log('Usage pattern:', pattern.name);
      break;
    case PatternType.SECURITY:
      console.log('Security pattern:', pattern.name);
      break;
    case PatternType.WORKFLOW:
      console.log('Workflow pattern:', pattern.name);
      break;
  }
});

// Match specific pattern
const occurrences = await advancedDiagnostics.matchPattern('system-id', pattern);
```

### 4. Root Cause Analysis

Intelligent analysis of issue root causes:

```typescript
const rootCause = await advancedDiagnostics.analyzeRootCause(finding, {
  timeWindow: 60,              // Minutes before/after
  includeMetrics: ['cpu_usage', 'memory_usage'],
  includeLogs: true,
  includeEvents: true
});

// Analysis results
console.log('Primary Cause:', rootCause.primaryCause.description);
console.log('Type:', rootCause.primaryCause.type);
// Types: CONFIGURATION, RESOURCE, WORKLOAD, DEPENDENCY, 
//        ENVIRONMENTAL, HUMAN, HARDWARE, SOFTWARE

console.log('Contributing Causes:');
rootCause.contributingCauses.forEach(cause => {
  console.log(`- ${cause.description} (${cause.probability})`);
});

console.log('Recommendations:');
rootCause.recommendations.forEach(rec => {
  console.log(`- ${rec.action}`);
  console.log(`  Impact: ${rec.estimatedImpact}`);
  console.log(`  Effort: ${rec.estimatedEffort}`);
  console.log(`  Automatable: ${rec.automatable}`);
});
```

### 5. Learning System

Continuously learns from resolutions:

```typescript
// Record a resolution
await advancedDiagnostics.recordResolution(
  finding,
  diagnosis,
  {
    id: 'res-1',
    actions: [{
      type: 'config_change',
      description: 'Increased connection pool',
      parameters: { poolSize: 200 },
      result: 'success'
    }],
    appliedAt: new Date(),
    appliedBy: 'sre-team',
    automated: false,
    duration: 15,
    rollbackAvailable: true
  },
  {
    success: true,
    metrics: {
      before: { response_time: 2000 },
      after: { response_time: 200 },
      improvement: { response_time: 1800 }
    },
    timeToResolution: 15
  }
);

// Get similar cases
const similarCases = await advancedDiagnostics.getSimilarCases(finding, 5);

// Get AI-recommended resolution
const recommendation = await advancedDiagnostics.getRecommendedResolution(finding);
if (recommendation) {
  console.log('Recommended actions:');
  recommendation.actions.forEach(action => {
    console.log(`- ${action.description}`);
  });
}
```

## Advanced Configuration

### Anomaly Detection Algorithms

- **Statistical**: Z-score, Modified Z-score (MAD), percentile-based
- **Isolation Forest**: Tree-based anomaly isolation
- **Autoencoder**: Neural network reconstruction error
- **Local Outlier Factor**: Density-based detection
- **One-Class SVM**: Support vector machine for outlier detection
- **Prophet**: Facebook's time series decomposition

### Predictive Models

- **LSTM Networks**: Long Short-Term Memory for time series
- **ARIMA**: Auto-Regressive Integrated Moving Average
- **Random Forest**: Ensemble method for non-linear patterns
- **Neural Networks**: Multi-layer perceptrons for complex relationships

### Pattern Recognition Methods

- **K-means Clustering**: Grouping similar behaviors
- **DBSCAN**: Density-based spatial clustering
- **Dynamic Time Warping**: Sequence similarity matching
- **Motif Discovery**: Recurring pattern identification

## Event Handling

```typescript
// Listen to events
advancedDiagnostics.on('anomaliesDetected', (anomalies) => {
  console.log(`Found ${anomalies.length} anomalies`);
});

advancedDiagnostics.on('insightsGenerated', ({ systemId, count }) => {
  console.log(`Generated ${count} insights for ${systemId}`);
});

advancedDiagnostics.on('patternsFound', ({ count, timeRange }) => {
  console.log(`Found ${count} patterns in time range`);
});

advancedDiagnostics.on('rootCauseAnalysisComplete', (analysis) => {
  console.log(`Root cause: ${analysis.primaryCause.description}`);
});

advancedDiagnostics.on('learningComplete', ({ cases, patterns }) => {
  console.log(`Learning updated with ${cases} cases`);
});
```

## Model Training

```typescript
// Train models with historical data
await advancedDiagnostics.trainModels(historicalMetrics);

// Models are also updated automatically as new data arrives
// with adaptive learning enabled
```

## Performance Considerations

1. **Data Retention**: Configure `dataRetentionDays` based on available memory
2. **Algorithm Selection**: Choose algorithms based on your use case
3. **Window Size**: Larger windows provide more context but use more memory
4. **Sensitivity**: Balance between false positives and missed anomalies

## Best Practices

1. **Regular Training**: Retrain models periodically with new data
2. **Feedback Loop**: Provide feedback on resolutions for better learning
3. **Algorithm Tuning**: Adjust sensitivity based on your environment
4. **Pattern Library**: Build a library of known patterns for your systems
5. **Resolution Documentation**: Document all resolutions for learning

## API Reference

### Main Class

- `AdvancedDiagnosticsEngine` - Main engine class

### Sub-components

- `MultiAlgorithmAnomalyDetector` - Anomaly detection
- `MLPredictiveAnalyzer` - Predictive analytics
- `AdvancedPatternRecognizer` - Pattern recognition
- `IntelligentRootCauseAnalyzer` - Root cause analysis
- `AdaptiveLearningSystem` - Learning system

### Types

- `Anomaly`, `AnomalySeverity`, `AnomalyType`
- `Prediction`, `PredictiveInsight`, `InsightType`
- `Pattern`, `PatternType`, `PatternOccurrence`
- `RootCauseAnalysis`, `Cause`, `CauseType`
- `LearningCase`, `Resolution`, `ResolutionOutcome`

## License

Part of CM Diagnostics - Enterprise License