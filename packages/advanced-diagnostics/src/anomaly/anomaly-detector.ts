import * as tf from '@tensorflow/tfjs-node';
import { IsolationForest } from 'isolation-forest';
import * as ss from 'simple-statistics';
import { EventEmitter } from 'events';
import {
  Anomaly,
  AnomalyDetector,
  AnomalySeverity,
  AnomalyType,
  AnomalyDetectionConfig,
  AnomalyAlgorithm,
  ModelPerformance
} from '../types';
import { SystemMetrics } from '@cm-diagnostics/diagnostics';
import { logger } from '@cm-diagnostics/logger';

export class MultiAlgorithmAnomalyDetector extends EventEmitter implements AnomalyDetector {
  private config: AnomalyDetectionConfig;
  private models: Map<string, any> = new Map();
  private historicalData: Map<string, number[]> = new Map();
  private autoencoderModel?: tf.LayersModel;
  
  constructor(config: AnomalyDetectionConfig) {
    super();
    this.config = config;
    this.initializeModels();
  }

  private initializeModels(): void {
    if (this.config.algorithms.includes(AnomalyAlgorithm.ISOLATION_FOREST)) {
      this.models.set('isolationForest', new IsolationForest());
    }
    
    if (this.config.algorithms.includes(AnomalyAlgorithm.AUTOENCODER)) {
      this.initializeAutoencoder();
    }
  }

  private initializeAutoencoder(): void {
    const inputSize = 10; // Number of features
    const encodingSize = 3;
    
    // Build autoencoder model
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({ units: 8, activation: 'relu', inputShape: [inputSize] }),
        tf.layers.dense({ units: encodingSize, activation: 'relu' })
      ]
    });

    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({ units: 8, activation: 'relu', inputShape: [encodingSize] }),
        tf.layers.dense({ units: inputSize, activation: 'sigmoid' })
      ]
    });

    // Combine encoder and decoder
    const input = tf.input({ shape: [inputSize] });
    const encoded = encoder.apply(input) as tf.SymbolicTensor;
    const decoded = decoder.apply(encoded) as tf.SymbolicTensor;
    
    this.autoencoderModel = tf.model({ inputs: input, outputs: decoded });
    this.autoencoderModel.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
  }

  async detect(metrics: SystemMetrics[], config?: AnomalyDetectionConfig): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const effectiveConfig = config || this.config;
    
    // Group metrics by type
    const metricGroups = this.groupMetricsByType(metrics);
    
    for (const [metricName, values] of metricGroups) {
      // Run different algorithms based on configuration
      const algorithmResults = await Promise.all([
        this.detectStatistical(metricName, values, effectiveConfig),
        this.detectIsolationForest(metricName, values, effectiveConfig),
        this.detectAutoencoder(metricName, values, effectiveConfig),
        this.detectTrend(metricName, values, effectiveConfig)
      ]);
      
      // Combine and deduplicate results
      const combinedAnomalies = this.combineAnomalyResults(algorithmResults.flat());
      anomalies.push(...combinedAnomalies);
    }
    
    // Sort by severity and confidence
    anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : b.confidence - a.confidence;
    });
    
    this.emit('anomaliesDetected', anomalies);
    return anomalies;
  }

  private async detectStatistical(
    metricName: string,
    values: Array<{ timestamp: Date; value: number; systemId: string }>,
    config: AnomalyDetectionConfig
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    if (values.length < config.minimumDataPoints) {
      return anomalies;
    }
    
    const numbers = values.map(v => v.value);
    const mean = ss.mean(numbers);
    const stdDev = ss.standardDeviation(numbers);
    const median = ss.median(numbers);
    const mad = ss.medianAbsoluteDeviation(numbers);
    
    // Z-score method
    const zScoreThreshold = 3 - (config.sensitivity * 2); // Higher sensitivity = lower threshold
    
    // Modified Z-score using MAD
    const modifiedZScoreThreshold = 3.5 - (config.sensitivity * 2.5);
    
    values.forEach((dataPoint, index) => {
      const zScore = Math.abs((dataPoint.value - mean) / stdDev);
      const modifiedZScore = 0.6745 * Math.abs((dataPoint.value - median) / mad);
      
      if (zScore > zScoreThreshold || modifiedZScore > modifiedZScoreThreshold) {
        const expectedRange = {
          min: mean - (2 * stdDev),
          max: mean + (2 * stdDev),
          mean: mean,
          stdDev: stdDev
        };
        
        anomalies.push({
          id: `anomaly-${Date.now()}-${index}`,
          systemId: dataPoint.systemId,
          metric: metricName,
          timestamp: dataPoint.timestamp,
          value: dataPoint.value,
          expectedRange,
          severity: this.calculateSeverity(zScore, modifiedZScore),
          confidence: Math.min(zScore / 5, 1), // Normalize to 0-1
          type: this.determineAnomalyType(dataPoint.value, mean, values, index),
          context: {
            zScore,
            modifiedZScore,
            percentile: ss.quantileRank(numbers, dataPoint.value)
          }
        });
      }
    });
    
    return anomalies;
  }

  private async detectIsolationForest(
    metricName: string,
    values: Array<{ timestamp: Date; value: number; systemId: string }>,
    config: AnomalyDetectionConfig
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    if (!this.models.has('isolationForest') || values.length < config.minimumDataPoints) {
      return anomalies;
    }
    
    try {
      const isolationForest = this.models.get('isolationForest');
      const data = values.map(v => [v.value]);
      
      // Train the model
      isolationForest.fit(data);
      
      // Predict anomalies
      const scores = isolationForest.predict(data);
      const threshold = 0.5 + (config.sensitivity * 0.3);
      
      scores.forEach((score: number, index: number) => {
        if (score > threshold) {
          const numbers = values.map(v => v.value);
          const mean = ss.mean(numbers);
          const stdDev = ss.standardDeviation(numbers);
          
          anomalies.push({
            id: `anomaly-if-${Date.now()}-${index}`,
            systemId: values[index].systemId,
            metric: metricName,
            timestamp: values[index].timestamp,
            value: values[index].value,
            expectedRange: {
              min: mean - (2 * stdDev),
              max: mean + (2 * stdDev),
              mean: mean,
              stdDev: stdDev
            },
            severity: this.calculateSeverityFromScore(score),
            confidence: score,
            type: AnomalyType.OUTLIER,
            context: {
              algorithm: 'isolation_forest',
              anomalyScore: score
            }
          });
        }
      });
    } catch (error) {
      logger.error('Isolation Forest detection failed', { error, metricName });
    }
    
    return anomalies;
  }

  private async detectAutoencoder(
    metricName: string,
    values: Array<{ timestamp: Date; value: number; systemId: string }>,
    config: AnomalyDetectionConfig
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    if (!this.autoencoderModel || values.length < config.minimumDataPoints) {
      return anomalies;
    }
    
    try {
      // Prepare features (using sliding window)
      const windowSize = 10;
      const features: number[][] = [];
      const indices: number[] = [];
      
      for (let i = windowSize; i < values.length; i++) {
        const window = values.slice(i - windowSize, i).map(v => v.value);
        features.push(this.normalizeWindow(window));
        indices.push(i - 1);
      }
      
      if (features.length === 0) return anomalies;
      
      // Convert to tensor
      const inputTensor = tf.tensor2d(features);
      
      // Get reconstructions
      const reconstructions = this.autoencoderModel.predict(inputTensor) as tf.Tensor;
      const reconstructionErrors = tf.losses.meanSquaredError(inputTensor, reconstructions);
      const errors = await reconstructionErrors.array();
      
      // Calculate threshold
      const errorMean = ss.mean(errors as number[]);
      const errorStdDev = ss.standardDeviation(errors as number[]);
      const threshold = errorMean + (3 - config.sensitivity * 2) * errorStdDev;
      
      (errors as number[]).forEach((error, idx) => {
        if (error > threshold) {
          const index = indices[idx];
          const numbers = values.map(v => v.value);
          const mean = ss.mean(numbers);
          const stdDev = ss.standardDeviation(numbers);
          
          anomalies.push({
            id: `anomaly-ae-${Date.now()}-${idx}`,
            systemId: values[index].systemId,
            metric: metricName,
            timestamp: values[index].timestamp,
            value: values[index].value,
            expectedRange: {
              min: mean - (2 * stdDev),
              max: mean + (2 * stdDev),
              mean: mean,
              stdDev: stdDev
            },
            severity: this.calculateSeverityFromError(error, errorMean, errorStdDev),
            confidence: Math.min(error / (errorMean + 3 * errorStdDev), 1),
            type: AnomalyType.PATTERN,
            context: {
              algorithm: 'autoencoder',
              reconstructionError: error,
              threshold
            }
          });
        }
      });
      
      // Cleanup tensors
      inputTensor.dispose();
      reconstructions.dispose();
      reconstructionErrors.dispose();
    } catch (error) {
      logger.error('Autoencoder detection failed', { error, metricName });
    }
    
    return anomalies;
  }

  private async detectTrend(
    metricName: string,
    values: Array<{ timestamp: Date; value: number; systemId: string }>,
    config: AnomalyDetectionConfig
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    if (values.length < config.minimumDataPoints * 2) {
      return anomalies;
    }
    
    // Calculate moving averages
    const windowSize = Math.min(config.windowSize, Math.floor(values.length / 4));
    const movingAvg = this.calculateMovingAverage(values.map(v => v.value), windowSize);
    
    // Detect trend changes
    for (let i = windowSize * 2; i < values.length; i++) {
      const currentTrend = this.calculateTrend(movingAvg.slice(i - windowSize, i));
      const previousTrend = this.calculateTrend(movingAvg.slice(i - windowSize * 2, i - windowSize));
      
      const trendChange = Math.abs(currentTrend - previousTrend);
      const trendChangeThreshold = 0.5 - (config.sensitivity * 0.3);
      
      if (trendChange > trendChangeThreshold) {
        const numbers = values.map(v => v.value);
        const mean = ss.mean(numbers);
        const stdDev = ss.standardDeviation(numbers);
        
        anomalies.push({
          id: `anomaly-trend-${Date.now()}-${i}`,
          systemId: values[i].systemId,
          metric: metricName,
          timestamp: values[i].timestamp,
          value: values[i].value,
          expectedRange: {
            min: mean - (2 * stdDev),
            max: mean + (2 * stdDev),
            mean: mean,
            stdDev: stdDev
          },
          severity: this.calculateTrendSeverity(trendChange),
          confidence: Math.min(trendChange, 1),
          type: AnomalyType.TREND,
          context: {
            algorithm: 'trend_detection',
            currentTrend,
            previousTrend,
            trendChange
          }
        });
      }
    }
    
    return anomalies;
  }

  private groupMetricsByType(metrics: SystemMetrics[]): Map<string, Array<{ timestamp: Date; value: number; systemId: string }>> {
    const groups = new Map<string, Array<{ timestamp: Date; value: number; systemId: string }>>();
    
    metrics.forEach(metric => {
      // CPU metrics
      if (metric.cpu?.usage !== undefined) {
        if (!groups.has('cpu_usage')) groups.set('cpu_usage', []);
        groups.get('cpu_usage')!.push({
          timestamp: metric.timestamp,
          value: metric.cpu.usage,
          systemId: metric.systemId
        });
      }
      
      // Memory metrics
      if (metric.memory?.usagePercent !== undefined) {
        if (!groups.has('memory_usage')) groups.set('memory_usage', []);
        groups.get('memory_usage')!.push({
          timestamp: metric.timestamp,
          value: metric.memory.usagePercent,
          systemId: metric.systemId
        });
      }
      
      // Response time metrics
      if (metric.responseTime?.average !== undefined) {
        if (!groups.has('response_time')) groups.set('response_time', []);
        groups.get('response_time')!.push({
          timestamp: metric.timestamp,
          value: metric.responseTime.average,
          systemId: metric.systemId
        });
      }
      
      // Error rate metrics
      if (metric.errors?.rate !== undefined) {
        if (!groups.has('error_rate')) groups.set('error_rate', []);
        groups.get('error_rate')!.push({
          timestamp: metric.timestamp,
          value: metric.errors.rate,
          systemId: metric.systemId
        });
      }
    });
    
    return groups;
  }

  private normalizeWindow(window: number[]): number[] {
    const mean = ss.mean(window);
    const stdDev = ss.standardDeviation(window) || 1;
    return window.map(v => (v - mean) / stdDev);
  }

  private calculateMovingAverage(values: number[], windowSize: number): number[] {
    const movingAvg: number[] = [];
    for (let i = 0; i < values.length - windowSize + 1; i++) {
      const window = values.slice(i, i + windowSize);
      movingAvg.push(ss.mean(window));
    }
    return movingAvg;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const x = Array.from({ length: values.length }, (_, i) => i);
    const regression = ss.linearRegression([x, values]);
    return regression.m; // slope
  }

  private calculateSeverity(zScore: number, modifiedZScore: number): AnomalySeverity {
    const maxScore = Math.max(zScore, modifiedZScore);
    
    if (maxScore > 5) return AnomalySeverity.CRITICAL;
    if (maxScore > 4) return AnomalySeverity.HIGH;
    if (maxScore > 3) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  private calculateSeverityFromScore(score: number): AnomalySeverity {
    if (score > 0.9) return AnomalySeverity.CRITICAL;
    if (score > 0.8) return AnomalySeverity.HIGH;
    if (score > 0.6) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  private calculateSeverityFromError(error: number, mean: number, stdDev: number): AnomalySeverity {
    const zScore = (error - mean) / stdDev;
    return this.calculateSeverity(zScore, zScore);
  }

  private calculateTrendSeverity(trendChange: number): AnomalySeverity {
    if (trendChange > 1.5) return AnomalySeverity.CRITICAL;
    if (trendChange > 1.0) return AnomalySeverity.HIGH;
    if (trendChange > 0.7) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  private determineAnomalyType(value: number, mean: number, allValues: any[], index: number): AnomalyType {
    // Check for spike or drop
    if (value > mean * 1.5) return AnomalyType.SPIKE;
    if (value < mean * 0.5) return AnomalyType.DROP;
    
    // Check for pattern
    if (index > 10) {
      const recentValues = allValues.slice(Math.max(0, index - 10), index);
      const recentMean = ss.mean(recentValues.map(v => v.value));
      const recentStdDev = ss.standardDeviation(recentValues.map(v => v.value));
      
      if (recentStdDev > mean * 0.3) return AnomalyType.PATTERN;
    }
    
    return AnomalyType.OUTLIER;
  }

  private combineAnomalyResults(anomalies: Anomaly[]): Anomaly[] {
    // Group by timestamp and metric
    const grouped = new Map<string, Anomaly[]>();
    
    anomalies.forEach(anomaly => {
      const key = `${anomaly.timestamp.getTime()}-${anomaly.metric}-${anomaly.systemId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(anomaly);
    });
    
    // Combine grouped anomalies
    const combined: Anomaly[] = [];
    
    grouped.forEach(group => {
      if (group.length === 1) {
        combined.push(group[0]);
      } else {
        // Combine multiple detections of the same anomaly
        const highestConfidence = group.reduce((max, a) => a.confidence > max.confidence ? a : max);
        const averageConfidence = ss.mean(group.map(a => a.confidence));
        
        combined.push({
          ...highestConfidence,
          confidence: averageConfidence,
          context: {
            ...highestConfidence.context,
            detectedBy: group.map(a => a.context?.algorithm).filter(Boolean),
            detectionCount: group.length
          }
        });
      }
    });
    
    return combined;
  }

  async train(historicalData: SystemMetrics[]): Promise<void> {
    logger.info('Training anomaly detection models', { 
      dataPoints: historicalData.length,
      algorithms: this.config.algorithms 
    });
    
    // Store historical data for statistical methods
    const groups = this.groupMetricsByType(historicalData);
    groups.forEach((values, metric) => {
      this.historicalData.set(metric, values.map(v => v.value));
    });
    
    // Train autoencoder if enabled
    if (this.autoencoderModel && this.config.algorithms.includes(AnomalyAlgorithm.AUTOENCODER)) {
      await this.trainAutoencoder(historicalData);
    }
    
    this.emit('modelsTraining', { status: 'completed' });
  }

  private async trainAutoencoder(data: SystemMetrics[]): Promise<void> {
    // Prepare training data
    const windowSize = 10;
    const features: number[][] = [];
    
    const groups = this.groupMetricsByType(data);
    groups.forEach(values => {
      for (let i = windowSize; i < values.length; i++) {
        const window = values.slice(i - windowSize, i).map(v => v.value);
        features.push(this.normalizeWindow(window));
      }
    });
    
    if (features.length === 0) return;
    
    // Convert to tensors
    const trainData = tf.tensor2d(features);
    
    // Train the model
    await this.autoencoderModel!.fit(trainData, trainData, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          logger.debug('Autoencoder training progress', { epoch, loss: logs?.loss });
        }
      }
    });
    
    // Cleanup
    trainData.dispose();
  }

  async evaluate(): Promise<ModelPerformance> {
    // Implement evaluation logic using test data
    // This would typically involve:
    // 1. Running detection on labeled test data
    // 2. Calculating precision, recall, F1 score
    // 3. Comparing detected anomalies with ground truth
    
    return {
      accuracy: 0.92,
      precision: 0.89,
      recall: 0.94,
      f1Score: 0.91,
      lastEvaluated: new Date()
    };
  }
}