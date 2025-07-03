import { EventEmitter } from 'events';
import { IDOLConnector, IDOLStatus, IDOLMetrics } from '../types';

export interface PerformanceMetrics {
  timestamp: Date;
  queryMetrics: {
    count: number;
    averageTime: number;
    p95Time: number;
    p99Time: number;
    slowQueries: number;
    errors: number;
  };
  indexMetrics: {
    count: number;
    averageTime: number;
    documentsPerSecond: number;
    failures: number;
  };
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    activeConnections: number;
  };
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    evictions: number;
    size: number;
  };
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  type: 'threshold' | 'anomaly' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  threshold?: number;
  message: string;
}

export interface MonitoringOptions {
  interval?: number; // ms
  retentionPeriod?: number; // hours
  alertThresholds?: {
    queryTime?: number;
    indexTime?: number;
    errorRate?: number;
    cpuUsage?: number;
    memoryUsage?: number;
  };
  enableAnomalyDetection?: boolean;
}

export class IDOLPerformanceMonitor extends EventEmitter {
  private connector: IDOLConnector;
  private metricsHistory: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private options: Required<MonitoringOptions>;
  private queryTimes: number[] = [];
  private indexTimes: number[] = [];
  
  constructor(connector: IDOLConnector, options: MonitoringOptions = {}) {
    super();
    this.connector = connector;
    this.options = {
      interval: options.interval || 60000, // 1 minute
      retentionPeriod: options.retentionPeriod || 24, // 24 hours
      alertThresholds: {
        queryTime: options.alertThresholds?.queryTime || 2000,
        indexTime: options.alertThresholds?.indexTime || 5000,
        errorRate: options.alertThresholds?.errorRate || 5,
        cpuUsage: options.alertThresholds?.cpuUsage || 80,
        memoryUsage: options.alertThresholds?.memoryUsage || 85
      },
      enableAnomalyDetection: options.enableAnomalyDetection ?? true
    };
    
    this.setupMetricsCollection();
  }

  start(): void {
    if (this.monitoringInterval) {
      return; // Already running
    }
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        this.emit('error', error);
      });
    }, this.options.interval);
    
    // Collect initial metrics
    this.collectMetrics();
    
    this.emit('monitoring:started');
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.emit('monitoring:stopped');
  }

  private setupMetricsCollection(): void {
    // Hook into connector events to collect real-time metrics
    this.connector.on('query', (event) => {
      this.queryTimes.push(event.duration);
      if (this.queryTimes.length > 1000) {
        this.queryTimes.shift();
      }
    });
    
    this.connector.on('indexed', (event) => {
      this.indexTimes.push(event.duration);
      if (this.indexTimes.length > 1000) {
        this.indexTimes.shift();
      }
    });
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      const status = await this.connector.getStatus();
      const connectorMetrics = this.connector.getMetrics();
      
      const metrics: PerformanceMetrics = {
        timestamp,
        queryMetrics: this.calculateQueryMetrics(connectorMetrics),
        indexMetrics: this.calculateIndexMetrics(connectorMetrics),
        systemMetrics: this.extractSystemMetrics(status),
        cacheMetrics: this.calculateCacheMetrics(connectorMetrics)
      };
      
      // Store metrics
      this.metricsHistory.push(metrics);
      this.cleanupOldMetrics();
      
      // Check for alerts
      this.checkAlerts(metrics);
      
      // Detect anomalies if enabled
      if (this.options.enableAnomalyDetection) {
        this.detectAnomalies(metrics);
      }
      
      this.emit('metrics:collected', metrics);
    } catch (error) {
      this.emit('metrics:error', error);
    }
  }

  private calculateQueryMetrics(connectorMetrics: IDOLMetrics): PerformanceMetrics['queryMetrics'] {
    const recentQueries = this.queryTimes.slice(-100);
    const sortedTimes = [...recentQueries].sort((a, b) => a - b);
    
    return {
      count: connectorMetrics.totalQueries,
      averageTime: connectorMetrics.averageQueryTime,
      p95Time: this.percentile(sortedTimes, 95),
      p99Time: this.percentile(sortedTimes, 99),
      slowQueries: recentQueries.filter(t => t > this.options.alertThresholds.queryTime).length,
      errors: Math.round(connectorMetrics.totalQueries * connectorMetrics.errorRate)
    };
  }

  private calculateIndexMetrics(connectorMetrics: IDOLMetrics): PerformanceMetrics['indexMetrics'] {
    const recentIndexOps = this.indexTimes.slice(-100);
    const documentsPerOp = 50; // Average assumption
    
    return {
      count: connectorMetrics.totalIndexOperations,
      averageTime: connectorMetrics.averageIndexTime,
      documentsPerSecond: recentIndexOps.length > 0 
        ? (documentsPerOp * 1000) / (recentIndexOps.reduce((a, b) => a + b, 0) / recentIndexOps.length)
        : 0,
      failures: Math.round(connectorMetrics.totalIndexOperations * connectorMetrics.errorRate)
    };
  }

  private extractSystemMetrics(status: IDOLStatus): PerformanceMetrics['systemMetrics'] {
    return {
      cpuUsage: status.performance?.cpuUsage || 0,
      memoryUsage: status.performance?.memoryUsage || 0,
      diskUsage: 0, // Would need to be implemented
      networkLatency: 0, // Would need to be measured
      activeConnections: this.connector.getMetrics().activeConnections
    };
  }

  private calculateCacheMetrics(connectorMetrics: IDOLMetrics): PerformanceMetrics['cacheMetrics'] {
    const hitRate = connectorMetrics.cacheHitRate;
    
    return {
      hitRate,
      missRate: 100 - hitRate,
      evictions: 0, // Would need to track
      size: 0 // Would need to track
    };
  }

  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];
    
    // Check query time
    if (metrics.queryMetrics.averageTime > this.options.alertThresholds.queryTime) {
      alerts.push(this.createAlert(
        'threshold',
        'high',
        'query.averageTime',
        metrics.queryMetrics.averageTime,
        this.options.alertThresholds.queryTime,
        `Query time ${metrics.queryMetrics.averageTime}ms exceeds threshold`
      ));
    }
    
    // Check CPU usage
    if (metrics.systemMetrics.cpuUsage > this.options.alertThresholds.cpuUsage) {
      alerts.push(this.createAlert(
        'threshold',
        'high',
        'system.cpuUsage',
        metrics.systemMetrics.cpuUsage,
        this.options.alertThresholds.cpuUsage,
        `CPU usage ${metrics.systemMetrics.cpuUsage}% exceeds threshold`
      ));
    }
    
    // Check memory usage
    if (metrics.systemMetrics.memoryUsage > this.options.alertThresholds.memoryUsage) {
      alerts.push(this.createAlert(
        'threshold',
        'critical',
        'system.memoryUsage',
        metrics.systemMetrics.memoryUsage,
        this.options.alertThresholds.memoryUsage,
        `Memory usage ${metrics.systemMetrics.memoryUsage}% exceeds threshold`
      ));
    }
    
    // Check error rate
    const errorRate = (metrics.queryMetrics.errors / metrics.queryMetrics.count) * 100;
    if (errorRate > this.options.alertThresholds.errorRate) {
      alerts.push(this.createAlert(
        'threshold',
        'high',
        'query.errorRate',
        errorRate,
        this.options.alertThresholds.errorRate,
        `Error rate ${errorRate.toFixed(2)}% exceeds threshold`
      ));
    }
    
    // Emit alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('alert', alert);
    });
  }

  private detectAnomalies(metrics: PerformanceMetrics): void {
    if (this.metricsHistory.length < 10) {
      return; // Not enough data
    }
    
    // Simple anomaly detection using z-score
    const recentMetrics = this.metricsHistory.slice(-20);
    
    // Check query time anomaly
    const queryTimes = recentMetrics.map(m => m.queryMetrics.averageTime);
    const queryTimeZScore = this.calculateZScore(
      metrics.queryMetrics.averageTime,
      queryTimes
    );
    
    if (Math.abs(queryTimeZScore) > 3) {
      const alert = this.createAlert(
        'anomaly',
        'medium',
        'query.averageTime',
        metrics.queryMetrics.averageTime,
        undefined,
        `Query time anomaly detected (z-score: ${queryTimeZScore.toFixed(2)})`
      );
      this.alerts.push(alert);
      this.emit('alert', alert);
    }
    
    // Check for trending issues
    this.detectTrends(recentMetrics);
  }

  private detectTrends(metrics: PerformanceMetrics[]): void {
    if (metrics.length < 5) return;
    
    // Check if query time is consistently increasing
    const queryTimes = metrics.map(m => m.queryMetrics.averageTime);
    const trend = this.calculateTrend(queryTimes);
    
    if (trend > 0.1) { // 10% increase per interval
      const alert = this.createAlert(
        'trend',
        'medium',
        'query.averageTime',
        queryTimes[queryTimes.length - 1],
        undefined,
        `Query time showing upward trend (${(trend * 100).toFixed(1)}% increase per interval)`
      );
      this.alerts.push(alert);
      this.emit('alert', alert);
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    metric: string,
    value: number,
    threshold: number | undefined,
    message: string
  ): PerformanceAlert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      severity,
      metric,
      value,
      threshold,
      message
    };
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private calculateZScore(value: number, population: number[]): number {
    const mean = population.reduce((a, b) => a + b, 0) / population.length;
    const variance = population.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / population.length;
    const stdDev = Math.sqrt(variance);
    return stdDev === 0 ? 0 : (value - mean) / stdDev;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return avgY === 0 ? 0 : slope / avgY; // Normalized slope
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.options.retentionPeriod);
    
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
  }

  getMetricsHistory(hours: number = 1): PerformanceMetrics[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getAlerts(hours: number = 1): PerformanceAlert[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    return this.alerts.filter(a => a.timestamp > cutoff);
  }

  getHealthScore(): number {
    const current = this.getCurrentMetrics();
    if (!current) return 100;
    
    let score = 100;
    
    // Deduct points for high resource usage
    score -= Math.max(0, current.systemMetrics.cpuUsage - 70) * 0.5;
    score -= Math.max(0, current.systemMetrics.memoryUsage - 70) * 0.5;
    
    // Deduct points for slow queries
    score -= Math.max(0, (current.queryMetrics.averageTime - 1000) / 100);
    
    // Deduct points for errors
    const errorRate = (current.queryMetrics.errors / Math.max(1, current.queryMetrics.count)) * 100;
    score -= errorRate * 2;
    
    // Deduct points for poor cache performance
    score -= Math.max(0, (60 - current.cacheMetrics.hitRate) * 0.3);
    
    return Math.max(0, Math.min(100, score));
  }
}