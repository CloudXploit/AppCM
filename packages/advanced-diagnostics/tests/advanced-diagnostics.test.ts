import {
  createAdvancedDiagnostics,
  AdvancedDiagnosticsEngine,
  AnomalyAlgorithm,
  InsightType,
  PatternType,
  CauseType,
  TimeRange
} from '../src';
import { Finding, SystemMetrics } from '@cm-diagnostics/diagnostics';

describe('Advanced Diagnostics Tests', () => {
  let advancedDiagnostics: AdvancedDiagnosticsEngine;
  
  beforeEach(() => {
    advancedDiagnostics = createAdvancedDiagnostics({
      anomalyDetection: {
        sensitivity: 0.7,
        algorithms: [
          AnomalyAlgorithm.STATISTICAL,
          AnomalyAlgorithm.ISOLATION_FOREST
        ],
        windowSize: 30,
        minimumDataPoints: 5
      },
      enableLearning: true,
      enablePredictions: true
    });
  });
  
  describe('Anomaly Detection', () => {
    test('should detect CPU usage anomalies', async () => {
      const metrics = generateMetrics('system-1', 100, {
        cpuPattern: 'spike',
        memoryPattern: 'normal'
      });
      
      await advancedDiagnostics.ingestMetrics(metrics);
      const anomalies = await advancedDiagnostics.detectAnomalies('system-1');
      
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].metric).toBe('cpu_usage');
      expect(anomalies[0].type).toBeDefined();
      expect(anomalies[0].confidence).toBeGreaterThan(0.5);
    });
    
    test('should detect memory leak pattern', async () => {
      const metrics = generateMetrics('system-2', 200, {
        cpuPattern: 'normal',
        memoryPattern: 'leak'
      });
      
      await advancedDiagnostics.ingestMetrics(metrics);
      const anomalies = await advancedDiagnostics.detectAnomalies('system-2');
      
      const memoryAnomalies = anomalies.filter(a => a.metric === 'memory_usage');
      expect(memoryAnomalies.length).toBeGreaterThan(0);
      expect(memoryAnomalies[0].type).toBe('TREND');
    });
    
    test('should handle insufficient data gracefully', async () => {
      const metrics = generateMetrics('system-3', 3);
      
      await advancedDiagnostics.ingestMetrics(metrics);
      const anomalies = await advancedDiagnostics.detectAnomalies('system-3');
      
      expect(anomalies).toEqual([]);
    });
  });
  
  describe('Predictive Analytics', () => {
    test('should predict future metric values', async () => {
      const metrics = generateMetrics('system-4', 500, {
        cpuPattern: 'increasing'
      });
      
      await advancedDiagnostics.ingestMetrics(metrics);
      
      // Train models first
      await advancedDiagnostics.trainModels();
      
      const prediction = await advancedDiagnostics.getPredictions(
        'system-4',
        'cpu_usage',
        30
      );
      
      expect(prediction).toBeDefined();
      expect(prediction.predictedValue).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidenceInterval).toBeDefined();
    });
    
    test('should generate predictive insights', async () => {
      const metrics = generateMetrics('system-5', 500, {
        cpuPattern: 'increasing',
        diskPattern: 'increasing'
      });
      
      await advancedDiagnostics.ingestMetrics(metrics);
      const insights = await advancedDiagnostics.getInsights('system-5');
      
      expect(insights.length).toBeGreaterThan(0);
      
      const capacityWarning = insights.find(i => i.type === InsightType.CAPACITY_WARNING);
      expect(capacityWarning).toBeDefined();
      expect(capacityWarning?.recommendations.length).toBeGreaterThan(0);
    });
  });
  
  describe('Pattern Recognition', () => {
    test('should identify performance patterns', async () => {
      const metrics = generateMetrics('system-6', 200, {
        cpuPattern: 'periodic'
      });
      
      await advancedDiagnostics.ingestMetrics(metrics);
      
      const timeRange: TimeRange = {
        start: metrics[0].timestamp,
        end: metrics[metrics.length - 1].timestamp
      };
      
      const patterns = await advancedDiagnostics.findPatterns('system-6', timeRange);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBeDefined();
      expect(patterns[0].occurrences.length).toBeGreaterThan(0);
    });
    
    test('should match known patterns', async () => {
      const metrics = generateMetrics('system-7', 100);
      await advancedDiagnostics.ingestMetrics(metrics);
      
      const pattern = {
        id: 'test-pattern',
        name: 'Test Pattern',
        description: 'Test pattern for matching',
        type: PatternType.PERFORMANCE,
        signature: {
          metrics: [{
            metric: 'cpu_usage',
            behavior: 'stable' as const,
            threshold: 0.5
          }],
          conditions: []
        },
        occurrences: [],
        confidence: 0.8,
        impact: 'medium' as const
      };
      
      const occurrences = await advancedDiagnostics.matchPattern('system-7', pattern);
      expect(occurrences).toBeDefined();
    });
  });
  
  describe('Root Cause Analysis', () => {
    test('should analyze root cause of performance issue', async () => {
      const finding: Finding = {
        id: 'finding-1',
        ruleId: 'perf-cpu-high',
        title: 'High CPU Usage',
        description: 'CPU usage exceeded 90% threshold',
        severity: 'high',
        category: 'performance',
        systemId: 'system-8',
        detectedAt: new Date(),
        status: 'open',
        details: {
          metrics: {
            cpu_usage: 0.92,
            memory_usage: 0.65
          }
        }
      };
      
      const analysis = await advancedDiagnostics.analyzeRootCause(finding);
      
      expect(analysis).toBeDefined();
      expect(analysis.primaryCause).toBeDefined();
      expect(analysis.primaryCause.type).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.evidence.length).toBeGreaterThan(0);
    });
    
    test('should identify contributing causes', async () => {
      const finding: Finding = {
        id: 'finding-2',
        ruleId: 'perf-response-slow',
        title: 'Slow Response Time',
        description: 'Response time exceeded acceptable threshold',
        severity: 'high',
        category: 'performance',
        systemId: 'system-9',
        detectedAt: new Date(),
        status: 'open',
        details: {
          metrics: {
            response_time: 2500,
            cpu_usage: 0.85,
            connection_pool_usage: 0.95
          }
        }
      };
      
      const analysis = await advancedDiagnostics.analyzeRootCause(finding);
      
      expect(analysis.contributingCauses.length).toBeGreaterThan(0);
      expect(analysis.causalChain.length).toBeGreaterThan(0);
    });
  });
  
  describe('Learning System', () => {
    test('should record and learn from resolutions', async () => {
      const finding: Finding = createTestFinding('system-10');
      const diagnosis = await advancedDiagnostics.analyzeRootCause(finding);
      
      const resolution = {
        id: 'res-1',
        actions: [{
          type: 'config_change',
          description: 'Increased connection pool size',
          parameters: { poolSize: 200 },
          result: 'success' as const
        }],
        appliedAt: new Date(),
        appliedBy: 'test-user',
        automated: false,
        duration: 5,
        rollbackAvailable: true
      };
      
      const outcome = {
        success: true,
        metrics: {
          before: { response_time: 2500, error_rate: 0.05 },
          after: { response_time: 500, error_rate: 0.01 },
          improvement: { response_time: 2000, error_rate: 0.04 }
        },
        timeToResolution: 5
      };
      
      await advancedDiagnostics.recordResolution(finding, diagnosis, resolution, outcome);
      
      // Get similar cases
      const similarCases = await advancedDiagnostics.getSimilarCases(finding);
      expect(similarCases.length).toBeGreaterThan(0);
    });
    
    test('should recommend resolution based on learning', async () => {
      // Record multiple successful cases
      for (let i = 0; i < 5; i++) {
        const finding = createTestFinding(`system-${i}`);
        const diagnosis = await advancedDiagnostics.analyzeRootCause(finding);
        
        const resolution = {
          id: `res-${i}`,
          actions: [{
            type: 'scale_resources',
            description: 'Scaled CPU resources',
            parameters: { cpuCores: 8 },
            result: 'success' as const
          }],
          appliedAt: new Date(),
          appliedBy: 'test-user',
          automated: false,
          duration: 10,
          rollbackAvailable: true
        };
        
        const outcome = {
          success: true,
          metrics: {
            before: { cpu_usage: 0.9 },
            after: { cpu_usage: 0.5 },
            improvement: { cpu_usage: 0.4 }
          },
          timeToResolution: 10
        };
        
        await advancedDiagnostics.recordResolution(finding, diagnosis, resolution, outcome);
      }
      
      // Get recommendation for similar finding
      const newFinding = createTestFinding('system-new');
      const recommendation = await advancedDiagnostics.getRecommendedResolution(newFinding);
      
      expect(recommendation).toBeDefined();
      expect(recommendation?.actions.length).toBeGreaterThan(0);
    });
  });
  
  describe('Health Check', () => {
    test('should report system health', async () => {
      const metrics = generateMetrics('system-health', 50);
      await advancedDiagnostics.ingestMetrics(metrics);
      
      const health = await advancedDiagnostics.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.components.anomalyDetector).toBe(true);
      expect(health.components.predictiveAnalyzer).toBe(true);
      expect(health.metrics.bufferSize).toBe(50);
    });
  });
});

// Helper functions
function generateMetrics(
  systemId: string,
  count: number,
  patterns: {
    cpuPattern?: 'normal' | 'spike' | 'increasing' | 'periodic' | 'leak';
    memoryPattern?: 'normal' | 'leak' | 'spike' | 'increasing';
    diskPattern?: 'normal' | 'increasing';
  } = {}
): SystemMetrics[] {
  const metrics: SystemMetrics[] = [];
  const baseTime = Date.now() - count * 60000;
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime + i * 60000);
    
    let cpuUsage = 0.3 + Math.random() * 0.2;
    if (patterns.cpuPattern === 'spike' && i > count / 2 && i < count / 2 + 10) {
      cpuUsage = 0.85 + Math.random() * 0.1;
    } else if (patterns.cpuPattern === 'increasing') {
      cpuUsage = 0.2 + (i / count) * 0.6;
    } else if (patterns.cpuPattern === 'periodic') {
      cpuUsage = 0.5 + Math.sin(i * 0.5) * 0.3;
    }
    
    let memoryUsage = 0.4 + Math.random() * 0.1;
    if (patterns.memoryPattern === 'leak') {
      memoryUsage = 0.3 + (i / count) * 0.5;
    } else if (patterns.memoryPattern === 'spike' && i === Math.floor(count / 2)) {
      memoryUsage = 0.9;
    }
    
    let diskUsage = 0.5 + Math.random() * 0.1;
    if (patterns.diskPattern === 'increasing') {
      diskUsage = 0.4 + (i / count) * 0.4;
    }
    
    metrics.push({
      systemId,
      timestamp,
      cpu: {
        usage: cpuUsage,
        cores: 4,
        loadAverage: [cpuUsage * 4, cpuUsage * 3.5, cpuUsage * 3]
      },
      memory: {
        total: 16384,
        used: memoryUsage * 16384,
        free: (1 - memoryUsage) * 16384,
        usagePercent: memoryUsage
      },
      disk: {
        total: 512000,
        used: diskUsage * 512000,
        free: (1 - diskUsage) * 512000,
        usagePercent: diskUsage
      },
      responseTime: {
        average: 200 + cpuUsage * 1000,
        median: 180 + cpuUsage * 800,
        p95: 300 + cpuUsage * 1500,
        p99: 400 + cpuUsage * 2000
      },
      throughput: {
        requestsPerSecond: 100 - cpuUsage * 50,
        bytesPerSecond: 1000000 - cpuUsage * 500000
      },
      errors: {
        rate: cpuUsage > 0.8 ? 0.05 : 0.01,
        total: Math.floor(Math.random() * 10)
      },
      activeUsers: Math.floor(50 + Math.random() * 50),
      connections: {
        active: Math.floor(100 + Math.random() * 100),
        idle: Math.floor(50 + Math.random() * 50),
        total: 200,
        failed: Math.floor(Math.random() * 5)
      }
    });
  }
  
  return metrics;
}

function createTestFinding(systemId: string): Finding {
  return {
    id: `finding-${Date.now()}`,
    ruleId: 'test-rule',
    title: 'Test Finding',
    description: 'Test finding for learning system',
    severity: 'high',
    category: 'performance',
    systemId,
    detectedAt: new Date(),
    status: 'open',
    details: {
      metrics: {
        cpu_usage: 0.85,
        memory_usage: 0.6,
        response_time: 1500
      }
    }
  };
}