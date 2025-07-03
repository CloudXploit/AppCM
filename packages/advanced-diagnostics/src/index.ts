// Advanced Diagnostics Package
// Machine Learning, Predictive Analytics, Pattern Recognition, and Root Cause Analysis

export * from './types';

// Anomaly Detection
export { MultiAlgorithmAnomalyDetector } from './anomaly/anomaly-detector';

// Predictive Analytics
export { MLPredictiveAnalyzer } from './predictive/predictive-analyzer';

// Pattern Recognition
export { AdvancedPatternRecognizer } from './patterns/pattern-recognizer';

// Root Cause Analysis
export { IntelligentRootCauseAnalyzer } from './root-cause/root-cause-analyzer';

// Learning System
export { AdaptiveLearningSystem } from './learning/learning-system';

// Main Integration Class
import { EventEmitter } from 'events';
import { MultiAlgorithmAnomalyDetector } from './anomaly/anomaly-detector';
import { MLPredictiveAnalyzer } from './predictive/predictive-analyzer';
import { AdvancedPatternRecognizer } from './patterns/pattern-recognizer';
import { IntelligentRootCauseAnalyzer } from './root-cause/root-cause-analyzer';
import { AdaptiveLearningSystem } from './learning/learning-system';
import {
  AnomalyDetectionConfig,
  AnomalyAlgorithm,
  Anomaly,
  Prediction,
  PredictiveInsight,
  Pattern,
  PatternOccurrence,
  RootCauseAnalysis,
  LearningCase,
  Resolution,
  TimeRange,
  AnalysisContext
} from './types';
import { Finding, SystemMetrics } from '@cm-diagnostics/diagnostics';
import { logger } from '@cm-diagnostics/logger';

export interface AdvancedDiagnosticsConfig {
  anomalyDetection?: Partial<AnomalyDetectionConfig>;
  enableLearning?: boolean;
  enablePredictions?: boolean;
  dataRetentionDays?: number;
}

export class AdvancedDiagnosticsEngine extends EventEmitter {
  private anomalyDetector: MultiAlgorithmAnomalyDetector;
  private predictiveAnalyzer: MLPredictiveAnalyzer;
  private patternRecognizer: AdvancedPatternRecognizer;
  private rootCauseAnalyzer: IntelligentRootCauseAnalyzer;
  private learningSystem: AdaptiveLearningSystem;
  private config: AdvancedDiagnosticsConfig;
  private metricsBuffer: Map<string, SystemMetrics[]> = new Map();
  
  constructor(config: AdvancedDiagnosticsConfig = {}) {
    super();
    
    this.config = {
      enableLearning: true,
      enablePredictions: true,
      dataRetentionDays: 30,
      ...config
    };
    
    // Initialize components
    const anomalyConfig: AnomalyDetectionConfig = {
      sensitivity: 0.7,
      algorithms: [
        AnomalyAlgorithm.STATISTICAL,
        AnomalyAlgorithm.ISOLATION_FOREST,
        AnomalyAlgorithm.AUTOENCODER
      ],
      windowSize: 60,
      minimumDataPoints: 10,
      adaptiveLearning: true,
      ...config.anomalyDetection
    };
    
    this.anomalyDetector = new MultiAlgorithmAnomalyDetector(anomalyConfig);
    this.predictiveAnalyzer = new MLPredictiveAnalyzer();
    this.patternRecognizer = new AdvancedPatternRecognizer();
    this.rootCauseAnalyzer = new IntelligentRootCauseAnalyzer();
    this.learningSystem = new AdaptiveLearningSystem();
    
    this.setupEventHandlers();
    logger.info('Advanced Diagnostics Engine initialized', { config: this.config });
  }
  
  private setupEventHandlers(): void {
    // Forward events from sub-components
    this.anomalyDetector.on('anomaliesDetected', (anomalies) => {
      this.emit('anomaliesDetected', anomalies);
    });
    
    this.predictiveAnalyzer.on('insightsGenerated', (data) => {
      this.emit('insightsGenerated', data);
    });
    
    this.patternRecognizer.on('patternsFound', (data) => {
      this.emit('patternsFound', data);
    });
    
    this.rootCauseAnalyzer.on('analysisComplete', (analysis) => {
      this.emit('rootCauseAnalysisComplete', analysis);
    });
    
    this.learningSystem.on('learningComplete', (data) => {
      this.emit('learningComplete', data);
    });
  }
  
  // Metric ingestion
  async ingestMetrics(metrics: SystemMetrics[]): Promise<void> {
    // Buffer metrics by system
    metrics.forEach(metric => {
      if (!this.metricsBuffer.has(metric.systemId)) {
        this.metricsBuffer.set(metric.systemId, []);
      }
      
      const buffer = this.metricsBuffer.get(metric.systemId)!;
      buffer.push(metric);
      
      // Maintain buffer size
      const maxBufferSize = 10000;
      if (buffer.length > maxBufferSize) {
        buffer.splice(0, buffer.length - maxBufferSize);
      }
    });
    
    // Clean old data
    this.cleanOldData();
  }
  
  private cleanOldData(): void {
    const cutoffTime = Date.now() - (this.config.dataRetentionDays! * 24 * 60 * 60 * 1000);
    
    this.metricsBuffer.forEach((buffer, systemId) => {
      const filtered = buffer.filter(m => m.timestamp.getTime() > cutoffTime);
      this.metricsBuffer.set(systemId, filtered);
    });
  }
  
  // Anomaly Detection
  async detectAnomalies(
    systemId: string,
    config?: Partial<AnomalyDetectionConfig>
  ): Promise<Anomaly[]> {
    const metrics = this.metricsBuffer.get(systemId) || [];
    
    if (metrics.length === 0) {
      return [];
    }
    
    const anomalies = await this.anomalyDetector.detect(metrics, config);
    
    // Learn from anomalies if enabled
    if (this.config.enableLearning && anomalies.length > 0) {
      // Store anomaly patterns for future reference
      anomalies.forEach(anomaly => {
        logger.debug('Anomaly detected for learning', {
          systemId,
          metric: anomaly.metric,
          severity: anomaly.severity
        });
      });
    }
    
    return anomalies;
  }
  
  // Predictive Analytics
  async getPredictions(systemId: string, metric: string, horizon: number = 60): Promise<Prediction> {
    if (!this.config.enablePredictions) {
      throw new Error('Predictions are disabled');
    }
    
    const historicalData = this.metricsBuffer.get(systemId) || [];
    
    // Update model with latest data
    await this.predictiveAnalyzer.updateModel(historicalData);
    
    // Get prediction
    return this.predictiveAnalyzer.predict(systemId, metric, horizon);
  }
  
  async getInsights(systemId: string): Promise<PredictiveInsight[]> {
    if (!this.config.enablePredictions) {
      return [];
    }
    
    return this.predictiveAnalyzer.analyzeInsights(systemId);
  }
  
  // Pattern Recognition
  async findPatterns(
    systemId: string,
    timeRange: TimeRange
  ): Promise<Pattern[]> {
    const metrics = this.metricsBuffer.get(systemId) || [];
    return this.patternRecognizer.findPatterns(metrics, timeRange);
  }
  
  async matchPattern(
    systemId: string,
    pattern: Pattern
  ): Promise<PatternOccurrence[]> {
    const metrics = this.metricsBuffer.get(systemId) || [];
    return this.patternRecognizer.matchPattern(pattern, metrics);
  }
  
  // Root Cause Analysis
  async analyzeRootCause(
    finding: Finding,
    context?: Partial<AnalysisContext>
  ): Promise<RootCauseAnalysis> {
    const fullContext: AnalysisContext = {
      systemId: finding.systemId,
      timeWindow: 60,
      includeMetrics: ['cpu_usage', 'memory_usage', 'error_rate', 'response_time'],
      includeLogs: true,
      includeEvents: true,
      ...context
    };
    
    const analysis = await this.rootCauseAnalyzer.analyze(finding, fullContext);
    
    // Record for learning if enabled
    if (this.config.enableLearning) {
      // This will be completed when resolution is applied
      this.emit('rootCauseAnalyzed', { finding, analysis });
    }
    
    return analysis;
  }
  
  // Learning System
  async recordResolution(
    finding: Finding,
    diagnosis: RootCauseAnalysis,
    resolution: Resolution,
    outcome: LearningCase['outcome']
  ): Promise<void> {
    if (!this.config.enableLearning) {
      return;
    }
    
    const learningCase: LearningCase = {
      id: `case-${Date.now()}`,
      timestamp: new Date(),
      systemId: finding.systemId,
      finding,
      diagnosis,
      resolution,
      outcome
    };
    
    await this.learningSystem.recordCase(learningCase);
  }
  
  async getSimilarCases(finding: Finding, limit?: number): Promise<LearningCase[]> {
    return this.learningSystem.getSimilarCases(finding, limit);
  }
  
  async getRecommendedResolution(finding: Finding): Promise<Resolution | null> {
    if (!this.config.enableLearning) {
      return null;
    }
    
    return this.learningSystem.getRecommendedResolution(finding);
  }
  
  // Training and model management
  async trainModels(historicalData?: SystemMetrics[]): Promise<void> {
    logger.info('Starting model training');
    
    // Use provided data or buffered data
    const trainingData = historicalData || Array.from(this.metricsBuffer.values()).flat();
    
    if (trainingData.length < 100) {
      throw new Error('Insufficient data for training (minimum 100 samples required)');
    }
    
    // Train anomaly detection models
    await this.anomalyDetector.train(trainingData);
    
    // Train predictive models
    await this.predictiveAnalyzer.updateModel(trainingData);
    
    // Train learning system
    await this.learningSystem.learn();
    
    logger.info('Model training completed');
    this.emit('modelsTraining', { status: 'completed', samples: trainingData.length });
  }
  
  // Statistics and insights
  getStatistics(): {
    anomalyDetection: {
      totalAnomaliesDetected: number;
      algorithmPerformance: Record<string, any>;
    };
    patternRecognition: {
      patternsIdentified: number;
      patternTypes: Record<string, number>;
    };
    learning: {
      casesRecorded: number;
      successRate: number;
      avgResolutionTime: number;
    };
  } {
    const learningStats = this.learningSystem.getCaseStatistics();
    const patternStats = this.patternRecognizer.getPatternStatistics();
    
    return {
      anomalyDetection: {
        totalAnomaliesDetected: 0, // Would need to track this
        algorithmPerformance: {}
      },
      patternRecognition: {
        patternsIdentified: patternStats.length,
        patternTypes: {} // Would need to implement pattern type counting
      },
      learning: {
        casesRecorded: learningStats.totalCases,
        successRate: learningStats.successfulCases / Math.max(learningStats.totalCases, 1),
        avgResolutionTime: learningStats.avgResolutionTime
      }
    };
  }
  
  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
    metrics: {
      bufferSize: number;
      oldestData?: Date;
      newestData?: Date;
    };
  }> {
    const components = {
      anomalyDetector: true,
      predictiveAnalyzer: true,
      patternRecognizer: true,
      rootCauseAnalyzer: true,
      learningSystem: true
    };
    
    let oldestData: Date | undefined;
    let newestData: Date | undefined;
    let totalBufferSize = 0;
    
    this.metricsBuffer.forEach(buffer => {
      totalBufferSize += buffer.length;
      
      if (buffer.length > 0) {
        const bufferOldest = buffer[0].timestamp;
        const bufferNewest = buffer[buffer.length - 1].timestamp;
        
        if (!oldestData || bufferOldest < oldestData) {
          oldestData = bufferOldest;
        }
        
        if (!newestData || bufferNewest > newestData) {
          newestData = bufferNewest;
        }
      }
    });
    
    const allHealthy = Object.values(components).every(v => v);
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      components,
      metrics: {
        bufferSize: totalBufferSize,
        oldestData,
        newestData
      }
    };
  }
}

// Export factory function
export function createAdvancedDiagnostics(
  config?: AdvancedDiagnosticsConfig
): AdvancedDiagnosticsEngine {
  return new AdvancedDiagnosticsEngine(config);
}