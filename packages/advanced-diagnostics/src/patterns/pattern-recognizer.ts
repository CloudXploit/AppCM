import { EventEmitter } from 'events';
import * as kmeans from 'ml-kmeans';
import { DBSCAN } from 'density-clustering';
import * as dtw from 'dynamic-time-warping';
import * as ss from 'simple-statistics';
import _ from 'lodash';
import {
  Pattern,
  PatternRecognizer,
  PatternType,
  PatternSignature,
  PatternOccurrence,
  PatternCondition,
  MetricPattern,
  PatternFrequency,
  TimeRange,
  ImpactLevel
} from '../types';
import { SystemMetrics } from '@cm-diagnostics/diagnostics';
import { logger } from '@cm-diagnostics/logger';

interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  type: PatternType;
  signature: PatternSignature;
  minConfidence: number;
}

export class AdvancedPatternRecognizer extends EventEmitter implements PatternRecognizer {
  private patterns: Map<string, Pattern> = new Map();
  private patternTemplates: PatternTemplate[] = [];
  private dbscan: DBSCAN;
  
  constructor() {
    super();
    this.dbscan = new DBSCAN();
    this.initializePatternTemplates();
  }

  private initializePatternTemplates(): void {
    // Performance patterns
    this.patternTemplates.push({
      id: 'memory-leak',
      name: 'Memory Leak Pattern',
      description: 'Gradual memory increase without corresponding decrease',
      type: PatternType.PERFORMANCE,
      signature: {
        metrics: [{
          metric: 'memory_usage',
          behavior: 'increase',
          rate: 0.01 // 1% per hour
        }],
        conditions: [{
          type: 'and',
          conditions: [
            { metric: 'memory_usage', operator: 'gt', value: 0.5 },
            { metric: 'gc_frequency', operator: 'gt', value: 10 }
          ]
        }],
        timeWindow: 180 // 3 hours
      },
      minConfidence: 0.7
    });

    this.patternTemplates.push({
      id: 'cpu-spike',
      name: 'CPU Spike Pattern',
      description: 'Sudden CPU usage spikes followed by normal levels',
      type: PatternType.PERFORMANCE,
      signature: {
        metrics: [{
          metric: 'cpu_usage',
          behavior: 'oscillating',
          threshold: 0.8
        }],
        conditions: [{
          type: 'or',
          conditions: [
            { metric: 'cpu_usage', operator: 'gt', value: 0.9 },
            { metric: 'cpu_wait', operator: 'gt', value: 0.3 }
          ]
        }],
        timeWindow: 30,
        frequency: {
          type: 'recurring',
          interval: 60,
          variance: 10
        }
      },
      minConfidence: 0.75
    });

    // Error patterns
    this.patternTemplates.push({
      id: 'cascading-failure',
      name: 'Cascading Failure Pattern',
      description: 'Errors spreading across multiple components',
      type: PatternType.ERROR,
      signature: {
        metrics: [
          { metric: 'error_rate', behavior: 'increase', rate: 0.1 },
          { metric: 'response_time', behavior: 'increase', rate: 0.2 }
        ],
        conditions: [{
          type: 'and',
          conditions: [
            { metric: 'error_rate', operator: 'gt', value: 0.05 },
            { metric: 'active_connections', operator: 'lt', value: 100 }
          ]
        }],
        timeWindow: 15
      },
      minConfidence: 0.8
    });

    // Usage patterns
    this.patternTemplates.push({
      id: 'peak-hours',
      name: 'Peak Usage Hours',
      description: 'Regular high usage during business hours',
      type: PatternType.USAGE,
      signature: {
        metrics: [
          { metric: 'active_users', behavior: 'increase', threshold: 0.7 },
          { metric: 'throughput', behavior: 'increase', threshold: 0.7 }
        ],
        conditions: [{
          type: 'and',
          conditions: [
            { metric: 'hour_of_day', operator: 'gte', value: 9 },
            { metric: 'hour_of_day', operator: 'lte', value: 17 }
          ]
        }],
        frequency: {
          type: 'periodic',
          interval: 1440 // Daily
        }
      },
      minConfidence: 0.85
    });

    // Security patterns
    this.patternTemplates.push({
      id: 'brute-force',
      name: 'Brute Force Attack Pattern',
      description: 'Multiple failed authentication attempts from same source',
      type: PatternType.SECURITY,
      signature: {
        metrics: [{
          metric: 'auth_failures',
          behavior: 'increase',
          threshold: 10
        }],
        conditions: [{
          type: 'and',
          conditions: [
            { metric: 'unique_ips', operator: 'lt', value: 5 },
            { metric: 'auth_success_rate', operator: 'lt', value: 0.1 }
          ]
        }],
        timeWindow: 10
      },
      minConfidence: 0.9
    });

    // Workflow patterns
    this.patternTemplates.push({
      id: 'batch-processing',
      name: 'Batch Processing Pattern',
      description: 'Regular spikes in activity for batch jobs',
      type: PatternType.WORKFLOW,
      signature: {
        metrics: [
          { metric: 'cpu_usage', behavior: 'increase', threshold: 0.6 },
          { metric: 'disk_io', behavior: 'increase', threshold: 0.7 }
        ],
        conditions: [{
          type: 'or',
          conditions: [
            { metric: 'hour_of_day', operator: 'eq', value: 2 },
            { metric: 'hour_of_day', operator: 'eq', value: 14 }
          ]
        }],
        frequency: {
          type: 'periodic',
          interval: 720 // Every 12 hours
        }
      },
      minConfidence: 0.8
    });
  }

  async findPatterns(data: SystemMetrics[], timeRange: TimeRange): Promise<Pattern[]> {
    const foundPatterns: Pattern[] = [];
    
    // Filter data to time range
    const filteredData = data.filter(d => 
      d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
    );
    
    if (filteredData.length < 10) {
      return foundPatterns;
    }
    
    // Try to match against known templates
    for (const template of this.patternTemplates) {
      const matches = this.matchTemplate(template, filteredData);
      if (matches.confidence >= template.minConfidence) {
        foundPatterns.push(matches);
      }
    }
    
    // Discover new patterns using clustering
    const discoveredPatterns = await this.discoverPatterns(filteredData);
    foundPatterns.push(...discoveredPatterns);
    
    // Analyze time series patterns
    const timeSeriesPatterns = this.analyzeTimeSeriesPatterns(filteredData);
    foundPatterns.push(...timeSeriesPatterns);
    
    // Deduplicate and rank patterns
    const uniquePatterns = this.deduplicatePatterns(foundPatterns);
    uniquePatterns.sort((a, b) => b.confidence - a.confidence);
    
    this.emit('patternsFound', { count: uniquePatterns.length, timeRange });
    return uniquePatterns;
  }

  private matchTemplate(template: PatternTemplate, data: SystemMetrics[]): Pattern {
    const occurrences: PatternOccurrence[] = [];
    let totalMatchScore = 0;
    let matchCount = 0;
    
    // Sliding window analysis
    const windowSize = template.signature.timeWindow || 60;
    const stepSize = Math.max(1, Math.floor(windowSize / 4));
    
    for (let i = 0; i < data.length - windowSize; i += stepSize) {
      const window = data.slice(i, i + windowSize);
      const matchResult = this.evaluateSignature(template.signature, window);
      
      if (matchResult.matches) {
        occurrences.push({
          timestamp: window[0].timestamp,
          systemId: window[0].systemId,
          matchScore: matchResult.score,
          context: matchResult.context
        });
        totalMatchScore += matchResult.score;
        matchCount++;
      }
    }
    
    const confidence = matchCount > 0 ? totalMatchScore / matchCount : 0;
    
    return {
      id: `pattern-${template.id}-${Date.now()}`,
      name: template.name,
      description: template.description,
      type: template.type,
      signature: template.signature,
      occurrences,
      confidence,
      impact: this.assessImpact(template.type, confidence, occurrences.length)
    };
  }

  private evaluateSignature(
    signature: PatternSignature,
    window: SystemMetrics[]
  ): { matches: boolean; score: number; context: Record<string, any> } {
    let score = 0;
    let matches = true;
    const context: Record<string, any> = {};
    
    // Evaluate metric patterns
    for (const metricPattern of signature.metrics) {
      const values = this.extractMetricValues(window, metricPattern.metric);
      const behavior = this.analyzeBehavior(values);
      
      if (metricPattern.behavior === behavior) {
        score += 0.5;
      } else {
        matches = false;
      }
      
      if (metricPattern.threshold) {
        const max = Math.max(...values);
        if (max >= metricPattern.threshold) {
          score += 0.3;
        } else {
          matches = false;
        }
      }
      
      if (metricPattern.rate) {
        const rate = this.calculateRate(values);
        if (Math.abs(rate - metricPattern.rate) < 0.1) {
          score += 0.2;
        }
      }
      
      context[`${metricPattern.metric}_behavior`] = behavior;
    }
    
    // Evaluate conditions
    if (signature.conditions) {
      for (const condition of signature.conditions) {
        const conditionResult = this.evaluateCondition(condition, window);
        if (!conditionResult) {
          matches = false;
        } else {
          score += 0.1;
        }
      }
    }
    
    // Evaluate frequency pattern
    if (signature.frequency && window.length > 1) {
      const frequencyMatch = this.evaluateFrequency(signature.frequency, window);
      if (frequencyMatch) {
        score += 0.2;
      }
      context.frequencyMatch = frequencyMatch;
    }
    
    return { matches, score: Math.min(score, 1), context };
  }

  private analyzeBehavior(values: number[]): 'increase' | 'decrease' | 'stable' | 'oscillating' {
    if (values.length < 2) return 'stable';
    
    const trend = ss.linearRegression([
      Array.from({ length: values.length }, (_, i) => i),
      values
    ]);
    
    const cv = ss.standardDeviation(values) / (ss.mean(values) || 1);
    
    if (cv > 0.3) return 'oscillating';
    if (trend.m > 0.01) return 'increase';
    if (trend.m < -0.01) return 'decrease';
    return 'stable';
  }

  private calculateRate(values: number[]): number {
    if (values.length < 2) return 0;
    
    const deltas: number[] = [];
    for (let i = 1; i < values.length; i++) {
      deltas.push(values[i] - values[i - 1]);
    }
    
    return ss.mean(deltas);
  }

  private evaluateCondition(condition: PatternCondition, window: SystemMetrics[]): boolean {
    if (condition.type === 'and') {
      return condition.conditions?.every(c => this.evaluateCondition(c, window)) ?? true;
    }
    
    if (condition.type === 'or') {
      return condition.conditions?.some(c => this.evaluateCondition(c, window)) ?? false;
    }
    
    if (condition.type === 'not') {
      return !condition.conditions?.some(c => this.evaluateCondition(c, window)) ?? true;
    }
    
    // Simple condition
    if (condition.metric && condition.operator && condition.value !== undefined) {
      const values = this.extractMetricValues(window, condition.metric);
      const avgValue = ss.mean(values);
      
      switch (condition.operator) {
        case 'gt': return avgValue > condition.value;
        case 'lt': return avgValue < condition.value;
        case 'eq': return Math.abs(avgValue - condition.value) < 0.01;
        case 'ne': return Math.abs(avgValue - condition.value) >= 0.01;
        case 'gte': return avgValue >= condition.value;
        case 'lte': return avgValue <= condition.value;
      }
    }
    
    return false;
  }

  private evaluateFrequency(frequency: PatternFrequency, window: SystemMetrics[]): boolean {
    if (window.length < 2) return false;
    
    const timestamps = window.map(w => w.timestamp.getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push((timestamps[i] - timestamps[i - 1]) / 60000); // Convert to minutes
    }
    
    const avgInterval = ss.mean(intervals);
    const variance = frequency.variance || frequency.interval! * 0.1;
    
    switch (frequency.type) {
      case 'recurring':
        return Math.abs(avgInterval - frequency.interval!) <= variance;
      case 'periodic':
        // Check if intervals are multiples of the base interval
        return intervals.every(i => 
          Math.abs((i % frequency.interval!) - 0) <= variance
        );
      case 'sporadic':
        // High variance indicates sporadic pattern
        return ss.standardDeviation(intervals) > avgInterval * 0.5;
      default:
        return false;
    }
  }

  private extractMetricValues(data: SystemMetrics[], metric: string): number[] {
    return data.map(d => {
      switch (metric) {
        case 'cpu_usage': return d.cpu?.usage || 0;
        case 'memory_usage': return d.memory?.usagePercent || 0;
        case 'error_rate': return d.errors?.rate || 0;
        case 'response_time': return d.responseTime?.average || 0;
        case 'active_users': return d.activeUsers || 0;
        case 'throughput': return d.throughput?.requestsPerSecond || 0;
        case 'auth_failures': return d.security?.authFailures || 0;
        case 'hour_of_day': return d.timestamp.getHours();
        case 'day_of_week': return d.timestamp.getDay();
        default: return 0;
      }
    });
  }

  private assessImpact(type: PatternType, confidence: number, occurrences: number): ImpactLevel {
    const baseImpact = {
      [PatternType.SECURITY]: 3,
      [PatternType.ERROR]: 2.5,
      [PatternType.PERFORMANCE]: 2,
      [PatternType.USAGE]: 1,
      [PatternType.WORKFLOW]: 0.5
    };
    
    const score = (baseImpact[type] || 1) * confidence * Math.log(occurrences + 1);
    
    if (score > 3) return ImpactLevel.CRITICAL;
    if (score > 2) return ImpactLevel.HIGH;
    if (score > 1) return ImpactLevel.MEDIUM;
    return ImpactLevel.LOW;
  }

  private async discoverPatterns(data: SystemMetrics[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    // Extract features for clustering
    const features = this.extractFeatures(data);
    if (features.length < 10) return patterns;
    
    // Apply K-means clustering
    const k = Math.min(5, Math.floor(features.length / 10));
    const kmResult = kmeans(features, k, { initialization: 'kmeans++' });
    
    // Analyze each cluster
    for (let i = 0; i < k; i++) {
      const clusterIndices = kmResult.clusters.map((c, idx) => c === i ? idx : -1).filter(idx => idx >= 0);
      if (clusterIndices.length < 5) continue;
      
      const clusterData = clusterIndices.map(idx => data[idx]);
      const pattern = this.analyzeCluster(clusterData, i);
      if (pattern) {
        patterns.push(pattern);
      }
    }
    
    // Apply DBSCAN for density-based clustering
    const dbscanClusters = this.dbscan.run(features, 0.5, 5);
    
    for (let i = 0; i < dbscanClusters.length; i++) {
      const cluster = dbscanClusters[i];
      if (cluster.length < 5) continue;
      
      const clusterData = cluster.map(idx => data[idx]);
      const pattern = this.analyzeCluster(clusterData, `dbscan-${i}`);
      if (pattern) {
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }

  private extractFeatures(data: SystemMetrics[]): number[][] {
    return data.map(d => [
      d.cpu?.usage || 0,
      d.memory?.usagePercent || 0,
      d.responseTime?.average || 0,
      d.errors?.rate || 0,
      d.throughput?.requestsPerSecond || 0,
      d.activeUsers || 0,
      d.timestamp.getHours() / 24,
      d.timestamp.getDay() / 7
    ]);
  }

  private analyzeCluster(clusterData: SystemMetrics[], clusterId: string | number): Pattern | null {
    if (clusterData.length < 5) return null;
    
    // Calculate cluster characteristics
    const metrics = ['cpu_usage', 'memory_usage', 'error_rate', 'response_time'];
    const signature: PatternSignature = { metrics: [], conditions: [] };
    
    for (const metric of metrics) {
      const values = this.extractMetricValues(clusterData, metric);
      const behavior = this.analyzeBehavior(values);
      const mean = ss.mean(values);
      const stdDev = ss.standardDeviation(values);
      
      if (stdDev / mean < 0.2) { // Low variance, characteristic pattern
        signature.metrics.push({
          metric,
          behavior,
          threshold: mean
        });
      }
    }
    
    if (signature.metrics.length === 0) return null;
    
    // Analyze temporal patterns
    const hours = clusterData.map(d => d.timestamp.getHours());
    const hourMode = ss.mode(hours);
    if (ss.standardDeviation(hours) < 3) {
      signature.conditions.push({
        type: 'and',
        conditions: [
          { metric: 'hour_of_day', operator: 'gte', value: hourMode - 2 },
          { metric: 'hour_of_day', operator: 'lte', value: hourMode + 2 }
        ]
      });
    }
    
    return {
      id: `discovered-${clusterId}-${Date.now()}`,
      name: `Discovered Pattern ${clusterId}`,
      description: `Automatically discovered pattern from clustering analysis`,
      type: this.inferPatternType(signature),
      signature,
      occurrences: clusterData.map(d => ({
        timestamp: d.timestamp,
        systemId: d.systemId,
        matchScore: 0.8,
        context: { clusterId }
      })),
      confidence: 0.7,
      impact: ImpactLevel.MEDIUM
    };
  }

  private inferPatternType(signature: PatternSignature): PatternType {
    const hasErrorMetric = signature.metrics.some(m => m.metric.includes('error'));
    const hasSecurityMetric = signature.metrics.some(m => m.metric.includes('auth') || m.metric.includes('security'));
    const hasPerformanceMetric = signature.metrics.some(m => 
      m.metric.includes('cpu') || m.metric.includes('memory') || m.metric.includes('response')
    );
    
    if (hasSecurityMetric) return PatternType.SECURITY;
    if (hasErrorMetric) return PatternType.ERROR;
    if (hasPerformanceMetric) return PatternType.PERFORMANCE;
    
    return PatternType.USAGE;
  }

  private analyzeTimeSeriesPatterns(data: SystemMetrics[]): Pattern[] {
    const patterns: Pattern[] = [];
    const metrics = ['cpu_usage', 'memory_usage', 'response_time', 'error_rate'];
    
    for (const metric of metrics) {
      const values = this.extractMetricValues(data, metric);
      
      // Detect repeating sequences using DTW
      const sequences = this.findRepeatingSequences(values);
      if (sequences.length > 0) {
        patterns.push(this.createSequencePattern(metric, sequences, data));
      }
      
      // Detect anomalous sub-sequences
      const anomalousSequences = this.findAnomalousSequences(values);
      if (anomalousSequences.length > 0) {
        patterns.push(this.createAnomalyPattern(metric, anomalousSequences, data));
      }
    }
    
    return patterns;
  }

  private findRepeatingSequences(values: number[]): Array<{ start: number; length: number; similarity: number }> {
    const sequences: Array<{ start: number; length: number; similarity: number }> = [];
    const minLength = 10;
    const maxLength = Math.min(100, Math.floor(values.length / 3));
    
    for (let length = minLength; length <= maxLength; length += 10) {
      for (let i = 0; i < values.length - length * 2; i++) {
        const seq1 = values.slice(i, i + length);
        
        for (let j = i + length; j < values.length - length; j++) {
          const seq2 = values.slice(j, j + length);
          
          // Use DTW to compare sequences
          const distance = this.calculateDTWDistance(seq1, seq2);
          const similarity = 1 - (distance / length);
          
          if (similarity > 0.8) {
            sequences.push({ start: i, length, similarity });
            break; // Found one match, move to next starting point
          }
        }
      }
    }
    
    return this.mergeOverlappingSequences(sequences);
  }

  private calculateDTWDistance(seq1: number[], seq2: number[]): number {
    // Simplified DTW implementation
    const n = seq1.length;
    const m = seq2.length;
    const matrix: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(Infinity));
    
    matrix[0][0] = 0;
    
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = Math.abs(seq1[i - 1] - seq2[j - 1]);
        matrix[i][j] = cost + Math.min(
          matrix[i - 1][j],    // insertion
          matrix[i][j - 1],    // deletion
          matrix[i - 1][j - 1] // match
        );
      }
    }
    
    return matrix[n][m];
  }

  private mergeOverlappingSequences(
    sequences: Array<{ start: number; length: number; similarity: number }>
  ): Array<{ start: number; length: number; similarity: number }> {
    if (sequences.length === 0) return sequences;
    
    // Sort by start position
    sequences.sort((a, b) => a.start - b.start);
    
    const merged: Array<{ start: number; length: number; similarity: number }> = [];
    let current = sequences[0];
    
    for (let i = 1; i < sequences.length; i++) {
      const next = sequences[i];
      
      if (current.start + current.length >= next.start) {
        // Overlapping sequences, merge them
        current = {
          start: current.start,
          length: Math.max(current.start + current.length, next.start + next.length) - current.start,
          similarity: Math.max(current.similarity, next.similarity)
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  private findAnomalousSequences(values: number[]): Array<{ start: number; length: number; score: number }> {
    const anomalies: Array<{ start: number; length: number; score: number }> = [];
    const windowSize = 20;
    
    if (values.length < windowSize * 2) return anomalies;
    
    // Calculate baseline statistics
    const baseline = values.slice(0, windowSize);
    const baselineMean = ss.mean(baseline);
    const baselineStd = ss.standardDeviation(baseline);
    
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const window = values.slice(i, i + windowSize);
      const windowMean = ss.mean(window);
      const windowStd = ss.standardDeviation(window);
      
      // Calculate anomaly score
      const meanDiff = Math.abs(windowMean - baselineMean) / (baselineStd || 1);
      const stdDiff = Math.abs(windowStd - baselineStd) / (baselineStd || 1);
      const score = (meanDiff + stdDiff) / 2;
      
      if (score > 2) {
        anomalies.push({ start: i, length: windowSize, score });
      }
    }
    
    return this.mergeOverlappingAnomalies(anomalies);
  }

  private mergeOverlappingAnomalies(
    anomalies: Array<{ start: number; length: number; score: number }>
  ): Array<{ start: number; length: number; score: number }> {
    if (anomalies.length === 0) return anomalies;
    
    anomalies.sort((a, b) => a.start - b.start);
    
    const merged: Array<{ start: number; length: number; score: number }> = [];
    let current = anomalies[0];
    
    for (let i = 1; i < anomalies.length; i++) {
      const next = anomalies[i];
      
      if (current.start + current.length >= next.start - 5) {
        current = {
          start: current.start,
          length: Math.max(current.start + current.length, next.start + next.length) - current.start,
          score: Math.max(current.score, next.score)
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  private createSequencePattern(
    metric: string,
    sequences: Array<{ start: number; length: number; similarity: number }>,
    data: SystemMetrics[]
  ): Pattern {
    const occurrences = sequences.map(seq => ({
      timestamp: data[seq.start].timestamp,
      systemId: data[seq.start].systemId,
      matchScore: seq.similarity,
      context: { sequenceLength: seq.length }
    }));
    
    return {
      id: `sequence-${metric}-${Date.now()}`,
      name: `Repeating ${metric} Pattern`,
      description: `Detected repeating sequence in ${metric} with ${sequences.length} occurrences`,
      type: PatternType.PERFORMANCE,
      signature: {
        metrics: [{
          metric,
          behavior: 'oscillating' as const
        }],
        conditions: [],
        frequency: {
          type: 'recurring',
          interval: Math.round(ss.mean(sequences.map(s => s.length)))
        }
      },
      occurrences,
      confidence: ss.mean(sequences.map(s => s.similarity)),
      impact: ImpactLevel.MEDIUM
    };
  }

  private createAnomalyPattern(
    metric: string,
    anomalies: Array<{ start: number; length: number; score: number }>,
    data: SystemMetrics[]
  ): Pattern {
    const occurrences = anomalies.map(anomaly => ({
      timestamp: data[anomaly.start].timestamp,
      systemId: data[anomaly.start].systemId,
      matchScore: Math.min(anomaly.score / 5, 1),
      context: { anomalyScore: anomaly.score }
    }));
    
    return {
      id: `anomaly-sequence-${metric}-${Date.now()}`,
      name: `Anomalous ${metric} Sequences`,
      description: `Detected ${anomalies.length} anomalous sequences in ${metric}`,
      type: PatternType.ERROR,
      signature: {
        metrics: [{
          metric,
          behavior: 'oscillating' as const
        }],
        conditions: []
      },
      occurrences,
      confidence: Math.min(ss.mean(anomalies.map(a => a.score)) / 5, 1),
      impact: ImpactLevel.HIGH
    };
  }

  private deduplicatePatterns(patterns: Pattern[]): Pattern[] {
    const uniquePatterns: Pattern[] = [];
    const seen = new Set<string>();
    
    for (const pattern of patterns) {
      const key = `${pattern.type}-${pattern.name}-${Math.floor(pattern.confidence * 10)}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        uniquePatterns.push(pattern);
      } else {
        // Merge occurrences if similar pattern exists
        const existing = uniquePatterns.find(p => 
          p.type === pattern.type && 
          p.name === pattern.name &&
          Math.abs(p.confidence - pattern.confidence) < 0.1
        );
        
        if (existing) {
          existing.occurrences.push(...pattern.occurrences);
          existing.confidence = Math.max(existing.confidence, pattern.confidence);
        }
      }
    }
    
    return uniquePatterns;
  }

  async matchPattern(pattern: Pattern, data: SystemMetrics[]): Promise<PatternOccurrence[]> {
    const occurrences: PatternOccurrence[] = [];
    const windowSize = pattern.signature.timeWindow || 60;
    
    for (let i = 0; i < data.length - windowSize; i++) {
      const window = data.slice(i, i + windowSize);
      const matchResult = this.evaluateSignature(pattern.signature, window);
      
      if (matchResult.matches) {
        occurrences.push({
          timestamp: window[0].timestamp,
          systemId: window[0].systemId,
          matchScore: matchResult.score,
          context: matchResult.context
        });
      }
    }
    
    return occurrences;
  }

  async registerPattern(pattern: Pattern): Promise<void> {
    this.patterns.set(pattern.id, pattern);
    
    // Add to templates if confidence is high enough
    if (pattern.confidence > 0.8) {
      this.patternTemplates.push({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        type: pattern.type,
        signature: pattern.signature,
        minConfidence: pattern.confidence * 0.8
      });
    }
    
    this.emit('patternRegistered', { pattern });
    logger.info('Pattern registered', { patternId: pattern.id, name: pattern.name });
  }
}