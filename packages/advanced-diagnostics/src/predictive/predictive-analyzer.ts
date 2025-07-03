import * as tf from '@tensorflow/tfjs-node';
import { NeuralNetwork } from 'brain.js';
import * as ss from 'simple-statistics';
import { EventEmitter } from 'events';
import {
  Prediction,
  PredictiveInsight,
  PredictiveAnalyzer,
  InsightType,
  ImpactLevel,
  ModelType,
  ModelStatus,
  ModelPerformance
} from '../types';
import { SystemMetrics } from '@cm-diagnostics/diagnostics';
import { logger } from '@cm-diagnostics/logger';

interface TimeSeriesModel {
  model: tf.LayersModel;
  scaler: {
    mean: number;
    std: number;
  };
  lookback: number;
  features: string[];
}

export class MLPredictiveAnalyzer extends EventEmitter implements PredictiveAnalyzer {
  private timeSeriesModels: Map<string, TimeSeriesModel> = new Map();
  private neuralNetworks: Map<string, NeuralNetwork> = new Map();
  private historicalData: Map<string, SystemMetrics[]> = new Map();
  private insightThresholds = {
    capacityWarning: 0.85,
    performanceDegradation: 0.7,
    failureRisk: 0.8,
    securityThreat: 0.75,
    complianceDrift: 0.6
  };

  constructor() {
    super();
  }

  async predict(systemId: string, metric: string, horizon: number): Promise<Prediction> {
    const modelKey = `${systemId}-${metric}`;
    const model = this.timeSeriesModels.get(modelKey);
    
    if (!model) {
      throw new Error(`No model found for ${modelKey}`);
    }
    
    const historicalData = this.historicalData.get(systemId) || [];
    if (historicalData.length < model.lookback) {
      throw new Error(`Insufficient historical data for prediction`);
    }
    
    // Prepare input data
    const recentData = historicalData.slice(-model.lookback);
    const input = this.prepareTimeSeriesInput(recentData, metric, model);
    
    // Make prediction
    const prediction = await this.predictTimeSeries(model, input, horizon);
    
    // Calculate confidence based on model performance and data quality
    const confidence = this.calculatePredictionConfidence(model, recentData, metric);
    
    // Calculate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(
      prediction.predictedValue,
      confidence,
      this.getHistoricalVolatility(recentData, metric)
    );
    
    // Identify contributing factors
    const factors = this.identifyContributingFactors(recentData, metric);
    
    return {
      id: `pred-${Date.now()}`,
      systemId,
      metric,
      timestamp: new Date(),
      predictedValue: prediction.predictedValue,
      confidence,
      timeHorizon: horizon,
      confidenceInterval,
      factors,
      model: 'lstm_time_series'
    };
  }

  async analyzeInsights(systemId: string): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    const data = this.historicalData.get(systemId) || [];
    
    if (data.length < 100) {
      return insights;
    }
    
    // Analyze different aspects
    const capacityInsights = await this.analyzeCapacity(systemId, data);
    const performanceInsights = await this.analyzePerformance(systemId, data);
    const failureRiskInsights = await this.analyzeFailureRisk(systemId, data);
    const securityInsights = await this.analyzeSecurityRisks(systemId, data);
    const complianceInsights = await this.analyzeCompliance(systemId, data);
    
    insights.push(
      ...capacityInsights,
      ...performanceInsights,
      ...failureRiskInsights,
      ...securityInsights,
      ...complianceInsights
    );
    
    // Sort by impact and likelihood
    insights.sort((a, b) => {
      const impactScore = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = impactScore[a.impact] * a.likelihood;
      const bScore = impactScore[b.impact] * b.likelihood;
      return bScore - aScore;
    });
    
    this.emit('insightsGenerated', { systemId, count: insights.length });
    return insights;
  }

  private async analyzeCapacity(systemId: string, data: SystemMetrics[]): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    
    // Analyze CPU capacity
    const cpuTrend = this.analyzeTrend(data.map(d => d.cpu?.usage || 0));
    if (cpuTrend.projectedMax > this.insightThresholds.capacityWarning) {
      insights.push({
        id: `insight-cpu-${Date.now()}`,
        systemId,
        type: InsightType.CAPACITY_WARNING,
        title: 'CPU Capacity Risk',
        description: `CPU usage is projected to reach ${Math.round(cpuTrend.projectedMax * 100)}% within ${cpuTrend.timeToMax} hours`,
        impact: cpuTrend.projectedMax > 0.95 ? ImpactLevel.CRITICAL : ImpactLevel.HIGH,
        likelihood: cpuTrend.confidence,
        timeframe: `${cpuTrend.timeToMax} hours`,
        recommendations: [
          'Scale up CPU resources',
          'Optimize CPU-intensive processes',
          'Implement load balancing',
          'Review and optimize queries'
        ],
        relatedMetrics: ['cpu_usage', 'process_count', 'thread_count'],
        confidence: cpuTrend.confidence
      });
    }
    
    // Analyze memory capacity
    const memoryTrend = this.analyzeTrend(data.map(d => d.memory?.usagePercent || 0));
    if (memoryTrend.projectedMax > this.insightThresholds.capacityWarning) {
      insights.push({
        id: `insight-memory-${Date.now()}`,
        systemId,
        type: InsightType.CAPACITY_WARNING,
        title: 'Memory Capacity Risk',
        description: `Memory usage is projected to reach ${Math.round(memoryTrend.projectedMax * 100)}% within ${memoryTrend.timeToMax} hours`,
        impact: memoryTrend.projectedMax > 0.95 ? ImpactLevel.CRITICAL : ImpactLevel.HIGH,
        likelihood: memoryTrend.confidence,
        timeframe: `${memoryTrend.timeToMax} hours`,
        recommendations: [
          'Increase memory allocation',
          'Identify and fix memory leaks',
          'Optimize caching strategies',
          'Review memory-intensive operations'
        ],
        relatedMetrics: ['memory_usage', 'heap_size', 'gc_frequency'],
        confidence: memoryTrend.confidence
      });
    }
    
    // Analyze disk capacity
    const diskTrend = this.analyzeTrend(data.map(d => d.disk?.usagePercent || 0));
    if (diskTrend.projectedMax > this.insightThresholds.capacityWarning) {
      const daysToFull = Math.round(diskTrend.timeToMax / 24);
      insights.push({
        id: `insight-disk-${Date.now()}`,
        systemId,
        type: InsightType.CAPACITY_WARNING,
        title: 'Disk Space Warning',
        description: `Disk usage will reach capacity in approximately ${daysToFull} days at current growth rate`,
        impact: daysToFull < 7 ? ImpactLevel.CRITICAL : ImpactLevel.HIGH,
        likelihood: diskTrend.confidence,
        timeframe: `${daysToFull} days`,
        recommendations: [
          'Implement log rotation',
          'Archive old data',
          'Clean temporary files',
          'Expand disk capacity'
        ],
        relatedMetrics: ['disk_usage', 'file_count', 'log_size'],
        confidence: diskTrend.confidence
      });
    }
    
    return insights;
  }

  private async analyzePerformance(systemId: string, data: SystemMetrics[]): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    
    // Analyze response time degradation
    const responseTimes = data.map(d => d.responseTime?.average || 0);
    const rtTrend = this.analyzeTrend(responseTimes);
    const rtVolatility = ss.standardDeviation(responseTimes) / ss.mean(responseTimes);
    
    if (rtTrend.slope > 0.1 || rtVolatility > 0.3) {
      insights.push({
        id: `insight-perf-${Date.now()}`,
        systemId,
        type: InsightType.PERFORMANCE_DEGRADATION,
        title: 'Performance Degradation Detected',
        description: `Response times are increasing by ${Math.round(rtTrend.slope * 100)}ms per hour with ${Math.round(rtVolatility * 100)}% volatility`,
        impact: rtVolatility > 0.5 ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
        likelihood: rtTrend.confidence,
        timeframe: 'Ongoing',
        recommendations: [
          'Analyze slow queries',
          'Check database indexes',
          'Review recent code changes',
          'Monitor concurrent connections'
        ],
        relatedMetrics: ['response_time', 'query_time', 'connection_count'],
        confidence: rtTrend.confidence
      });
    }
    
    // Analyze throughput patterns
    const throughput = data.map(d => d.throughput?.requestsPerSecond || 0);
    const patterns = this.detectPerformancePatterns(throughput);
    
    if (patterns.degradationPeriods.length > 0) {
      insights.push({
        id: `insight-throughput-${Date.now()}`,
        systemId,
        type: InsightType.PERFORMANCE_DEGRADATION,
        title: 'Recurring Performance Issues',
        description: `System shows recurring performance degradation during ${patterns.degradationPeriods.join(', ')}`,
        impact: ImpactLevel.MEDIUM,
        likelihood: patterns.confidence,
        timeframe: 'Recurring',
        recommendations: [
          'Schedule maintenance during low-traffic periods',
          'Implement auto-scaling for peak times',
          'Optimize batch processing schedules',
          'Review scheduled jobs timing'
        ],
        relatedMetrics: ['throughput', 'cpu_usage', 'active_sessions'],
        confidence: patterns.confidence
      });
    }
    
    return insights;
  }

  private async analyzeFailureRisk(systemId: string, data: SystemMetrics[]): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    
    // Analyze error rate trends
    const errorRates = data.map(d => d.errors?.rate || 0);
    const errorTrend = this.analyzeTrend(errorRates);
    const errorSpikes = this.detectSpikes(errorRates);
    
    if (errorTrend.slope > 0.01 || errorSpikes.length > 3) {
      const riskScore = this.calculateFailureRisk(data);
      
      if (riskScore > this.insightThresholds.failureRisk) {
        insights.push({
          id: `insight-failure-${Date.now()}`,
          systemId,
          type: InsightType.FAILURE_RISK,
          title: 'Elevated System Failure Risk',
          description: `System shows ${Math.round(riskScore * 100)}% failure risk based on error patterns and resource utilization`,
          impact: riskScore > 0.9 ? ImpactLevel.CRITICAL : ImpactLevel.HIGH,
          likelihood: riskScore,
          timeframe: '24-48 hours',
          recommendations: [
            'Review error logs for root causes',
            'Implement circuit breakers',
            'Increase monitoring frequency',
            'Prepare rollback procedures'
          ],
          relatedMetrics: ['error_rate', 'cpu_usage', 'memory_usage', 'connection_failures'],
          confidence: errorTrend.confidence
        });
      }
    }
    
    // Analyze connection stability
    const connectionFailures = data.map(d => d.connections?.failed || 0);
    const connTrend = this.analyzeTrend(connectionFailures);
    
    if (connTrend.slope > 0.5) {
      insights.push({
        id: `insight-conn-${Date.now()}`,
        systemId,
        type: InsightType.FAILURE_RISK,
        title: 'Connection Stability Issues',
        description: 'Increasing connection failures indicate potential network or database issues',
        impact: ImpactLevel.HIGH,
        likelihood: connTrend.confidence,
        timeframe: 'Immediate',
        recommendations: [
          'Check network connectivity',
          'Review connection pool settings',
          'Verify database server health',
          'Implement connection retry logic'
        ],
        relatedMetrics: ['connection_failures', 'connection_timeout', 'network_latency'],
        confidence: connTrend.confidence
      });
    }
    
    return insights;
  }

  private async analyzeSecurityRisks(systemId: string, data: SystemMetrics[]): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    
    // Analyze authentication failures
    const authFailures = data.map(d => d.security?.authFailures || 0);
    const authPattern = this.detectSecurityPatterns(authFailures);
    
    if (authPattern.isSuspicious) {
      insights.push({
        id: `insight-security-auth-${Date.now()}`,
        systemId,
        type: InsightType.SECURITY_THREAT,
        title: 'Suspicious Authentication Activity',
        description: `Detected ${authPattern.type} pattern in authentication failures`,
        impact: authPattern.severity === 'high' ? ImpactLevel.CRITICAL : ImpactLevel.HIGH,
        likelihood: authPattern.confidence,
        timeframe: 'Active',
        recommendations: [
          'Enable account lockout policies',
          'Implement rate limiting',
          'Review authentication logs',
          'Consider multi-factor authentication'
        ],
        relatedMetrics: ['auth_failures', 'unique_ips', 'failed_usernames'],
        confidence: authPattern.confidence
      });
    }
    
    // Analyze access patterns
    const unusualAccess = this.detectUnusualAccess(data);
    if (unusualAccess.length > 0) {
      insights.push({
        id: `insight-security-access-${Date.now()}`,
        systemId,
        type: InsightType.SECURITY_THREAT,
        title: 'Unusual Access Patterns',
        description: 'Detected access patterns that deviate from normal behavior',
        impact: ImpactLevel.MEDIUM,
        likelihood: 0.7,
        timeframe: 'Recent',
        recommendations: [
          'Review access logs',
          'Verify user permissions',
          'Check for compromised accounts',
          'Update access control policies'
        ],
        relatedMetrics: ['access_count', 'unique_users', 'permission_changes'],
        confidence: 0.75
      });
    }
    
    return insights;
  }

  private async analyzeCompliance(systemId: string, data: SystemMetrics[]): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    
    // Analyze backup compliance
    const backupSuccess = data.map(d => d.backup?.successRate || 1);
    const backupTrend = this.analyzeTrend(backupSuccess);
    
    if (backupTrend.projectedMin < 0.95) {
      insights.push({
        id: `insight-compliance-backup-${Date.now()}`,
        systemId,
        type: InsightType.COMPLIANCE_DRIFT,
        title: 'Backup Compliance Risk',
        description: 'Backup success rate is declining and may fall below compliance requirements',
        impact: ImpactLevel.HIGH,
        likelihood: backupTrend.confidence,
        timeframe: '1 week',
        recommendations: [
          'Review backup procedures',
          'Check storage capacity',
          'Verify backup job configurations',
          'Test backup restoration process'
        ],
        relatedMetrics: ['backup_success_rate', 'backup_duration', 'backup_size'],
        confidence: backupTrend.confidence
      });
    }
    
    // Analyze audit compliance
    const auditGaps = this.detectAuditGaps(data);
    if (auditGaps.length > 0) {
      insights.push({
        id: `insight-compliance-audit-${Date.now()}`,
        systemId,
        type: InsightType.COMPLIANCE_DRIFT,
        title: 'Audit Trail Gaps',
        description: `Detected ${auditGaps.length} periods with missing or incomplete audit logs`,
        impact: ImpactLevel.MEDIUM,
        likelihood: 0.9,
        timeframe: 'Historical',
        recommendations: [
          'Enable comprehensive audit logging',
          'Implement log retention policies',
          'Regular audit log reviews',
          'Automate compliance reporting'
        ],
        relatedMetrics: ['audit_log_size', 'audit_events', 'retention_period'],
        confidence: 0.85
      });
    }
    
    return insights;
  }

  private prepareTimeSeriesInput(data: SystemMetrics[], metric: string, model: TimeSeriesModel): tf.Tensor {
    const values = data.map(d => this.extractMetricValue(d, metric));
    
    // Normalize values
    const normalizedValues = values.map(v => (v - model.scaler.mean) / model.scaler.std);
    
    // Create sequences
    const sequence = normalizedValues.slice(-model.lookback);
    
    // Add additional features if available
    const features: number[][] = [];
    for (let i = 0; i < sequence.length; i++) {
      const featureVector = [sequence[i]];
      
      // Add time-based features
      const timestamp = data[data.length - model.lookback + i].timestamp;
      featureVector.push(
        timestamp.getHours() / 24, // Hour of day
        timestamp.getDay() / 7, // Day of week
        timestamp.getDate() / 31 // Day of month
      );
      
      features.push(featureVector);
    }
    
    return tf.tensor3d([features]);
  }

  private async predictTimeSeries(
    model: TimeSeriesModel,
    input: tf.Tensor,
    horizon: number
  ): Promise<{ predictedValue: number; sequence: number[] }> {
    const predictions: number[] = [];
    let currentInput = input;
    
    for (let i = 0; i < horizon; i++) {
      // Make prediction
      const prediction = model.model.predict(currentInput) as tf.Tensor;
      const value = await prediction.data();
      predictions.push(value[0]);
      
      // Update input for next prediction
      const inputData = await currentInput.array() as number[][][];
      const newSequence = [...inputData[0].slice(1), [value[0], ...inputData[0][0].slice(1)]];
      
      currentInput.dispose();
      currentInput = tf.tensor3d([newSequence]);
      prediction.dispose();
    }
    
    // Denormalize predictions
    const denormalizedPredictions = predictions.map(
      p => p * model.scaler.std + model.scaler.mean
    );
    
    currentInput.dispose();
    
    return {
      predictedValue: denormalizedPredictions[denormalizedPredictions.length - 1],
      sequence: denormalizedPredictions
    };
  }

  private calculatePredictionConfidence(
    model: TimeSeriesModel,
    recentData: SystemMetrics[],
    metric: string
  ): number {
    // Base confidence on model performance
    let confidence = 0.8; // Base confidence
    
    // Adjust based on data quality
    const values = recentData.map(d => this.extractMetricValue(d, metric));
    const cv = ss.standardDeviation(values) / ss.mean(values); // Coefficient of variation
    
    if (cv > 0.5) confidence *= 0.8; // High variability reduces confidence
    if (cv < 0.1) confidence *= 1.1; // Low variability increases confidence
    
    // Adjust based on data recency
    const latestDataAge = Date.now() - recentData[recentData.length - 1].timestamp.getTime();
    if (latestDataAge > 3600000) confidence *= 0.9; // Data older than 1 hour
    
    return Math.min(confidence, 0.95);
  }

  private calculateConfidenceInterval(
    predictedValue: number,
    confidence: number,
    volatility: number
  ): { lower: number; upper: number } {
    const margin = predictedValue * volatility * (1 - confidence);
    
    return {
      lower: Math.max(0, predictedValue - margin),
      upper: predictedValue + margin
    };
  }

  private getHistoricalVolatility(data: SystemMetrics[], metric: string): number {
    const values = data.map(d => this.extractMetricValue(d, metric));
    const returns: number[] = [];
    
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
    
    return ss.standardDeviation(returns);
  }

  private identifyContributingFactors(data: SystemMetrics[], metric: string): string[] {
    const factors: string[] = [];
    
    // Analyze correlations with other metrics
    const targetValues = data.map(d => this.extractMetricValue(d, metric));
    
    // Check CPU correlation
    const cpuValues = data.map(d => d.cpu?.usage || 0);
    const cpuCorrelation = this.calculateCorrelation(targetValues, cpuValues);
    if (Math.abs(cpuCorrelation) > 0.7) factors.push('cpu_usage');
    
    // Check memory correlation
    const memoryValues = data.map(d => d.memory?.usagePercent || 0);
    const memoryCorrelation = this.calculateCorrelation(targetValues, memoryValues);
    if (Math.abs(memoryCorrelation) > 0.7) factors.push('memory_usage');
    
    // Check time patterns
    const hourlyPattern = this.detectHourlyPattern(data, metric);
    if (hourlyPattern) factors.push('time_of_day');
    
    const weeklyPattern = this.detectWeeklyPattern(data, metric);
    if (weeklyPattern) factors.push('day_of_week');
    
    return factors;
  }

  private extractMetricValue(metrics: SystemMetrics, metric: string): number {
    switch (metric) {
      case 'cpu_usage':
        return metrics.cpu?.usage || 0;
      case 'memory_usage':
        return metrics.memory?.usagePercent || 0;
      case 'response_time':
        return metrics.responseTime?.average || 0;
      case 'error_rate':
        return metrics.errors?.rate || 0;
      case 'throughput':
        return metrics.throughput?.requestsPerSecond || 0;
      case 'disk_usage':
        return metrics.disk?.usagePercent || 0;
      default:
        return 0;
    }
  }

  private analyzeTrend(values: number[]): {
    slope: number;
    projectedMax: number;
    projectedMin: number;
    timeToMax: number;
    confidence: number;
  } {
    if (values.length < 2) {
      return { slope: 0, projectedMax: 0, projectedMin: 0, timeToMax: Infinity, confidence: 0 };
    }
    
    const x = Array.from({ length: values.length }, (_, i) => i);
    const regression = ss.linearRegression([x, values]);
    const rSquared = ss.rSquared([x, values], x => regression.m * x + regression.b);
    
    // Project forward
    const currentMax = Math.max(...values);
    const hoursToMax = currentMax < 1 ? (1 - regression.b) / regression.m : Infinity;
    
    return {
      slope: regression.m,
      projectedMax: Math.min(1, regression.b + regression.m * (values.length + hoursToMax)),
      projectedMin: Math.max(0, regression.b),
      timeToMax: hoursToMax,
      confidence: rSquared
    };
  }

  private detectSpikes(values: number[]): number[] {
    const spikes: number[] = [];
    const mean = ss.mean(values);
    const stdDev = ss.standardDeviation(values);
    
    values.forEach((value, index) => {
      if (value > mean + 2 * stdDev) {
        spikes.push(index);
      }
    });
    
    return spikes;
  }

  private detectPerformancePatterns(values: number[]): {
    degradationPeriods: string[];
    confidence: number;
  } {
    // Simplified pattern detection
    // In a real implementation, this would use more sophisticated time series analysis
    const hourlyAverages = new Map<number, number[]>();
    
    values.forEach((value, index) => {
      const hour = index % 24;
      if (!hourlyAverages.has(hour)) {
        hourlyAverages.set(hour, []);
      }
      hourlyAverages.get(hour)!.push(value);
    });
    
    const degradationPeriods: string[] = [];
    const overallMean = ss.mean(values);
    
    hourlyAverages.forEach((hourValues, hour) => {
      const hourMean = ss.mean(hourValues);
      if (hourMean < overallMean * 0.8) {
        degradationPeriods.push(`${hour}:00-${hour}:59`);
      }
    });
    
    return {
      degradationPeriods,
      confidence: degradationPeriods.length > 0 ? 0.75 : 0
    };
  }

  private calculateFailureRisk(data: SystemMetrics[]): number {
    let riskScore = 0;
    let factors = 0;
    
    // CPU risk
    const cpuValues = data.map(d => d.cpu?.usage || 0);
    const cpuMax = Math.max(...cpuValues.slice(-10));
    if (cpuMax > 0.9) {
      riskScore += 0.3;
      factors++;
    }
    
    // Memory risk
    const memoryValues = data.map(d => d.memory?.usagePercent || 0);
    const memoryMax = Math.max(...memoryValues.slice(-10));
    if (memoryMax > 0.85) {
      riskScore += 0.3;
      factors++;
    }
    
    // Error rate risk
    const errorRates = data.map(d => d.errors?.rate || 0);
    const errorTrend = this.analyzeTrend(errorRates.slice(-20));
    if (errorTrend.slope > 0.01) {
      riskScore += 0.2;
      factors++;
    }
    
    // Connection failure risk
    const connFailures = data.map(d => d.connections?.failed || 0);
    const connSum = connFailures.slice(-10).reduce((a, b) => a + b, 0);
    if (connSum > 5) {
      riskScore += 0.2;
      factors++;
    }
    
    return factors > 0 ? riskScore / factors : 0;
  }

  private detectSecurityPatterns(authFailures: number[]): {
    isSuspicious: boolean;
    type: string;
    severity: string;
    confidence: number;
  } {
    const recentFailures = authFailures.slice(-24); // Last 24 hours
    const totalFailures = recentFailures.reduce((a, b) => a + b, 0);
    
    // Brute force pattern
    if (totalFailures > 100) {
      return {
        isSuspicious: true,
        type: 'Potential brute force attack',
        severity: 'high',
        confidence: 0.9
      };
    }
    
    // Distributed attack pattern
    const nonZeroHours = recentFailures.filter(f => f > 0).length;
    if (nonZeroHours > 20 && totalFailures > 50) {
      return {
        isSuspicious: true,
        type: 'Distributed authentication attack',
        severity: 'high',
        confidence: 0.85
      };
    }
    
    // Targeted attack pattern
    const spikes = this.detectSpikes(recentFailures);
    if (spikes.length >= 3) {
      return {
        isSuspicious: true,
        type: 'Targeted authentication attempts',
        severity: 'medium',
        confidence: 0.75
      };
    }
    
    return {
      isSuspicious: false,
      type: 'Normal',
      severity: 'low',
      confidence: 1
    };
  }

  private detectUnusualAccess(data: SystemMetrics[]): string[] {
    const patterns: string[] = [];
    
    // Check for off-hours access
    const nightAccess = data.filter(d => {
      const hour = d.timestamp.getHours();
      return hour >= 0 && hour < 6 && d.activeUsers && d.activeUsers > 0;
    });
    
    if (nightAccess.length > 5) {
      patterns.push('Unusual night-time access detected');
    }
    
    // Check for rapid permission changes
    const permissionChanges = data.map(d => d.security?.permissionChanges || 0);
    const totalChanges = permissionChanges.reduce((a, b) => a + b, 0);
    if (totalChanges > 10) {
      patterns.push('Elevated permission change activity');
    }
    
    return patterns;
  }

  private detectAuditGaps(data: SystemMetrics[]): Array<{ start: Date; end: Date }> {
    const gaps: Array<{ start: Date; end: Date }> = [];
    
    // Check for periods with no audit events
    for (let i = 1; i < data.length; i++) {
      const timeDiff = data[i].timestamp.getTime() - data[i - 1].timestamp.getTime();
      if (timeDiff > 3600000) { // Gap larger than 1 hour
        gaps.push({
          start: data[i - 1].timestamp,
          end: data[i].timestamp
        });
      }
    }
    
    return gaps;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const xMean = ss.mean(x);
    const yMean = ss.mean(y);
    
    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;
    
    for (let i = 0; i < x.length; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }
    
    const denominator = Math.sqrt(xDenominator * yDenominator);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private detectHourlyPattern(data: SystemMetrics[], metric: string): boolean {
    const hourlyValues = new Map<number, number[]>();
    
    data.forEach(d => {
      const hour = d.timestamp.getHours();
      const value = this.extractMetricValue(d, metric);
      if (!hourlyValues.has(hour)) {
        hourlyValues.set(hour, []);
      }
      hourlyValues.get(hour)!.push(value);
    });
    
    const hourlyMeans: number[] = [];
    hourlyValues.forEach(values => {
      hourlyMeans.push(ss.mean(values));
    });
    
    const cv = ss.standardDeviation(hourlyMeans) / ss.mean(hourlyMeans);
    return cv > 0.2; // Significant variation across hours
  }

  private detectWeeklyPattern(data: SystemMetrics[], metric: string): boolean {
    const dailyValues = new Map<number, number[]>();
    
    data.forEach(d => {
      const day = d.timestamp.getDay();
      const value = this.extractMetricValue(d, metric);
      if (!dailyValues.has(day)) {
        dailyValues.set(day, []);
      }
      dailyValues.get(day)!.push(value);
    });
    
    const dailyMeans: number[] = [];
    dailyValues.forEach(values => {
      dailyMeans.push(ss.mean(values));
    });
    
    const cv = ss.standardDeviation(dailyMeans) / ss.mean(dailyMeans);
    return cv > 0.15; // Significant variation across days
  }

  async updateModel(newData: SystemMetrics[]): Promise<void> {
    // Update historical data
    newData.forEach(metrics => {
      if (!this.historicalData.has(metrics.systemId)) {
        this.historicalData.set(metrics.systemId, []);
      }
      this.historicalData.get(metrics.systemId)!.push(metrics);
    });
    
    // Retrain models if enough new data
    for (const [systemId, data] of this.historicalData.entries()) {
      if (data.length > 1000) {
        await this.retrainModels(systemId, data);
      }
    }
    
    this.emit('modelsUpdated', { dataPoints: newData.length });
  }

  private async retrainModels(systemId: string, data: SystemMetrics[]): Promise<void> {
    const metrics = ['cpu_usage', 'memory_usage', 'response_time', 'error_rate'];
    
    for (const metric of metrics) {
      const modelKey = `${systemId}-${metric}`;
      const values = data.map(d => this.extractMetricValue(d, metric));
      
      // Calculate scaling parameters
      const mean = ss.mean(values);
      const std = ss.standardDeviation(values) || 1;
      
      // Build LSTM model
      const model = await this.buildLSTMModel(10, 4); // 10 lookback, 4 features
      
      // Prepare training data
      const { inputs, outputs } = this.prepareTrainingData(data, metric, 10);
      
      // Train model
      await model.fit(inputs, outputs, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            logger.debug(`Training ${modelKey}`, { epoch, loss: logs?.loss });
          }
        }
      });
      
      // Store model
      this.timeSeriesModels.set(modelKey, {
        model,
        scaler: { mean, std },
        lookback: 10,
        features: ['value', 'hour', 'dayOfWeek', 'dayOfMonth']
      });
      
      // Cleanup tensors
      inputs.dispose();
      outputs.dispose();
    }
  }

  private async buildLSTMModel(lookback: number, features: number): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [lookback, features]
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 50,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 25, activation: 'relu' }),
        tf.layers.dense({ units: 1 })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse']
    });
    
    return model;
  }

  private prepareTrainingData(
    data: SystemMetrics[],
    metric: string,
    lookback: number
  ): { inputs: tf.Tensor; outputs: tf.Tensor } {
    const sequences: number[][][] = [];
    const targets: number[] = [];
    
    for (let i = lookback; i < data.length - 1; i++) {
      const sequence: number[][] = [];
      
      for (let j = i - lookback; j < i; j++) {
        const value = this.extractMetricValue(data[j], metric);
        const timestamp = data[j].timestamp;
        
        sequence.push([
          value,
          timestamp.getHours() / 24,
          timestamp.getDay() / 7,
          timestamp.getDate() / 31
        ]);
      }
      
      sequences.push(sequence);
      targets.push(this.extractMetricValue(data[i], metric));
    }
    
    return {
      inputs: tf.tensor3d(sequences),
      outputs: tf.tensor2d(targets, [targets.length, 1])
    };
  }
}