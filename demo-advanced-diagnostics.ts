import {
  createAdvancedDiagnostics,
  AnomalyAlgorithm,
  InsightType,
  PatternType,
  CauseType
} from './packages/advanced-diagnostics/src';
import { Finding, SystemMetrics } from './packages/diagnostics/src/types';

async function demonstrateAdvancedDiagnostics() {
  console.log('🧠 CM Diagnostics - Advanced Diagnostics Demo\n');
  console.log('==============================================\n');

  // Initialize Advanced Diagnostics Engine
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
    enablePredictions: true,
    dataRetentionDays: 30
  });

  // Set up event listeners
  advancedDiagnostics.on('anomaliesDetected', (anomalies) => {
    console.log(`🚨 Detected ${anomalies.length} anomalies`);
  });

  advancedDiagnostics.on('insightsGenerated', ({ count }) => {
    console.log(`💡 Generated ${count} predictive insights`);
  });

  advancedDiagnostics.on('patternsFound', ({ count }) => {
    console.log(`🔍 Found ${count} patterns`);
  });

  advancedDiagnostics.on('rootCauseAnalysisComplete', (analysis) => {
    console.log(`🎯 Root cause identified: ${analysis.primaryCause.description}`);
  });

  // 1. Generate and ingest sample metrics
  console.log('1️⃣ Generating system metrics with various patterns...\n');
  
  const systems = [
    { id: 'prod-cm-01', pattern: 'memory-leak' },
    { id: 'prod-cm-02', pattern: 'cpu-spike' },
    { id: 'dev-cm-01', pattern: 'gradual-degradation' }
  ];

  for (const system of systems) {
    const metrics = generateSystemMetrics(system.id, system.pattern, 500);
    await advancedDiagnostics.ingestMetrics(metrics);
    console.log(`✅ Ingested ${metrics.length} metrics for ${system.id}`);
  }

  // 2. Train ML models
  console.log('\n2️⃣ Training machine learning models...\n');
  
  try {
    await advancedDiagnostics.trainModels();
    console.log('✅ Models trained successfully\n');
  } catch (error) {
    console.log('⚠️  Model training requires more data\n');
  }

  // 3. Anomaly Detection
  console.log('3️⃣ Running anomaly detection...\n');
  
  for (const system of systems) {
    const anomalies = await advancedDiagnostics.detectAnomalies(system.id);
    
    console.log(`System: ${system.id}`);
    console.log(`Found ${anomalies.length} anomalies:`);
    
    anomalies.slice(0, 3).forEach(anomaly => {
      console.log(`  - ${anomaly.metric}: ${anomaly.type} anomaly`);
      console.log(`    Value: ${anomaly.value.toFixed(2)}, Expected: ${anomaly.expectedRange.mean.toFixed(2)}`);
      console.log(`    Severity: ${anomaly.severity}, Confidence: ${(anomaly.confidence * 100).toFixed(0)}%`);
    });
    console.log();
  }

  // 4. Predictive Analytics
  console.log('4️⃣ Generating predictive insights...\n');
  
  for (const system of systems) {
    const insights = await advancedDiagnostics.getInsights(system.id);
    
    console.log(`System: ${system.id}`);
    console.log(`Generated ${insights.length} insights:`);
    
    insights.slice(0, 2).forEach(insight => {
      console.log(`  📊 ${insight.title}`);
      console.log(`     ${insight.description}`);
      console.log(`     Impact: ${insight.impact}, Likelihood: ${(insight.likelihood * 100).toFixed(0)}%`);
      console.log(`     Recommendations:`);
      insight.recommendations.slice(0, 2).forEach(rec => {
        console.log(`       • ${rec}`);
      });
    });
    console.log();
  }

  // 5. Pattern Recognition
  console.log('5️⃣ Discovering patterns...\n');
  
  const timeRange = {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date()
  };
  
  for (const system of systems.slice(0, 1)) {
    const patterns = await advancedDiagnostics.findPatterns(system.id, timeRange);
    
    console.log(`System: ${system.id}`);
    console.log(`Discovered ${patterns.length} patterns:`);
    
    patterns.slice(0, 3).forEach(pattern => {
      console.log(`  🔄 ${pattern.name}`);
      console.log(`     Type: ${pattern.type}`);
      console.log(`     Occurrences: ${pattern.occurrences.length}`);
      console.log(`     Confidence: ${(pattern.confidence * 100).toFixed(0)}%`);
      console.log(`     Impact: ${pattern.impact}`);
    });
    console.log();
  }

  // 6. Root Cause Analysis
  console.log('6️⃣ Performing root cause analysis...\n');
  
  // Create a sample finding
  const finding: Finding = {
    id: 'finding-demo-1',
    ruleId: 'perf-response-slow',
    title: 'Slow Response Time Detected',
    description: 'Average response time exceeded 2000ms threshold',
    severity: 'high',
    category: 'performance',
    systemId: 'prod-cm-01',
    detectedAt: new Date(),
    status: 'open',
    details: {
      metrics: {
        response_time: 2500,
        cpu_usage: 0.85,
        memory_usage: 0.92,
        connection_pool_usage: 0.95,
        error_rate: 0.03
      },
      errorMessage: 'Multiple timeout errors detected in application logs',
      configChanges: [
        { parameter: 'max_connections', oldValue: '100', newValue: '150', changedAt: new Date(Date.now() - 3600000) }
      ]
    }
  };
  
  const rootCause = await advancedDiagnostics.analyzeRootCause(finding);
  
  console.log('🎯 Root Cause Analysis Results:');
  console.log(`   Primary Cause: ${rootCause.primaryCause.description}`);
  console.log(`   Type: ${rootCause.primaryCause.type}`);
  console.log(`   Probability: ${(rootCause.primaryCause.probability * 100).toFixed(0)}%`);
  console.log(`   Impact: ${rootCause.primaryCause.impact}`);
  
  console.log('\n   Contributing Causes:');
  rootCause.contributingCauses.slice(0, 3).forEach(cause => {
    console.log(`   - ${cause.description} (${(cause.probability * 100).toFixed(0)}%)`);
  });
  
  console.log('\n   Recommendations:');
  rootCause.recommendations.slice(0, 3).forEach((rec, idx) => {
    console.log(`   ${idx + 1}. ${rec.action}`);
    console.log(`      Impact: ${rec.estimatedImpact}, Effort: ${rec.estimatedEffort}`);
    console.log(`      Automatable: ${rec.automatable ? 'Yes' : 'No'}`);
  });
  
  console.log(`\n   Analysis Confidence: ${(rootCause.confidence * 100).toFixed(0)}%`);

  // 7. Learning System
  console.log('\n7️⃣ Demonstrating learning system...\n');
  
  // Record a successful resolution
  const resolution = {
    id: 'res-demo-1',
    actions: [
      {
        type: 'config_change',
        description: 'Increased connection pool size to 200',
        parameters: { max_connections: 200 },
        result: 'success' as const
      },
      {
        type: 'resource_scaling',
        description: 'Added 2 CPU cores',
        parameters: { cpu_cores: 6 },
        result: 'success' as const
      }
    ],
    appliedAt: new Date(),
    appliedBy: 'sre-team',
    automated: false,
    duration: 15,
    rollbackAvailable: true
  };
  
  const outcome = {
    success: true,
    metrics: {
      before: {
        response_time: 2500,
        cpu_usage: 0.85,
        error_rate: 0.03
      },
      after: {
        response_time: 450,
        cpu_usage: 0.45,
        error_rate: 0.001
      },
      improvement: {
        response_time: 2050,
        cpu_usage: 0.40,
        error_rate: 0.029
      }
    },
    timeToResolution: 15
  };
  
  await advancedDiagnostics.recordResolution(finding, rootCause, resolution, outcome);
  console.log('✅ Resolution recorded for learning');
  
  // Get similar cases
  const similarCases = await advancedDiagnostics.getSimilarCases(finding);
  console.log(`\n📚 Found ${similarCases.length} similar historical cases`);
  
  // Get recommended resolution for a new finding
  const newFinding: Finding = {
    ...finding,
    id: 'finding-demo-2',
    detectedAt: new Date()
  };
  
  const recommendedResolution = await advancedDiagnostics.getRecommendedResolution(newFinding);
  if (recommendedResolution) {
    console.log('\n🤖 AI-Recommended Resolution:');
    recommendedResolution.actions.forEach(action => {
      console.log(`   - ${action.description}`);
    });
  }

  // 8. System Statistics
  console.log('\n8️⃣ System Statistics:\n');
  
  const stats = advancedDiagnostics.getStatistics();
  console.log('📊 Learning System:');
  console.log(`   Cases Recorded: ${stats.learning.casesRecorded}`);
  console.log(`   Success Rate: ${(stats.learning.successRate * 100).toFixed(0)}%`);
  console.log(`   Avg Resolution Time: ${stats.learning.avgResolutionTime.toFixed(0)} minutes`);
  
  console.log('\n📊 Pattern Recognition:');
  console.log(`   Patterns Identified: ${stats.patternRecognition.patternsIdentified}`);

  // 9. Health Check
  console.log('\n9️⃣ System Health Check:\n');
  
  const health = await advancedDiagnostics.healthCheck();
  console.log(`Status: ${health.status} ${health.status === 'healthy' ? '✅' : '⚠️'}`);
  console.log('Components:');
  Object.entries(health.components).forEach(([component, status]) => {
    console.log(`  ${component}: ${status ? '✅' : '❌'}`);
  });
  console.log(`\nMetrics Buffer: ${health.metrics.bufferSize} data points`);
  if (health.metrics.oldestData) {
    console.log(`Data Range: ${health.metrics.oldestData.toLocaleString()} - ${health.metrics.newestData?.toLocaleString()}`);
  }

  console.log('\n✨ Advanced Diagnostics Demo Complete!');
}

// Helper function to generate realistic metrics
function generateSystemMetrics(systemId: string, pattern: string, count: number): SystemMetrics[] {
  const metrics: SystemMetrics[] = [];
  const baseTime = Date.now() - count * 60000;
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime + i * 60000);
    let cpu = 0.3 + Math.random() * 0.2;
    let memory = 0.4 + Math.random() * 0.1;
    let responseTime = 200 + Math.random() * 100;
    let errorRate = 0.001;
    
    // Apply patterns
    switch (pattern) {
      case 'memory-leak':
        memory = Math.min(0.95, 0.3 + (i / count) * 0.6 + Math.random() * 0.05);
        if (memory > 0.8) {
          responseTime += (memory - 0.8) * 2000;
          errorRate = 0.01 + (memory - 0.8) * 0.1;
        }
        break;
        
      case 'cpu-spike':
        if (i % 100 >= 50 && i % 100 <= 60) {
          cpu = 0.85 + Math.random() * 0.1;
          responseTime = 1500 + Math.random() * 1000;
          errorRate = 0.02 + Math.random() * 0.03;
        }
        break;
        
      case 'gradual-degradation':
        const degradation = i / count;
        cpu = Math.min(0.9, 0.2 + degradation * 0.5 + Math.random() * 0.1);
        memory = Math.min(0.85, 0.3 + degradation * 0.4 + Math.random() * 0.1);
        responseTime = 150 + degradation * 1500 + Math.random() * 200;
        errorRate = 0.001 + degradation * 0.04;
        break;
    }
    
    metrics.push({
      systemId,
      timestamp,
      cpu: {
        usage: cpu,
        cores: 4,
        loadAverage: [cpu * 4, cpu * 3.8, cpu * 3.5]
      },
      memory: {
        total: 16384,
        used: memory * 16384,
        free: (1 - memory) * 16384,
        usagePercent: memory
      },
      disk: {
        total: 512000,
        used: 256000 + Math.random() * 50000,
        free: 256000 - Math.random() * 50000,
        usagePercent: 0.5 + Math.random() * 0.1
      },
      responseTime: {
        average: responseTime,
        median: responseTime * 0.9,
        p95: responseTime * 1.5,
        p99: responseTime * 2
      },
      throughput: {
        requestsPerSecond: Math.max(10, 100 - cpu * 80),
        bytesPerSecond: Math.max(100000, 1000000 - cpu * 800000)
      },
      errors: {
        rate: errorRate,
        total: Math.floor(errorRate * 1000)
      },
      activeUsers: Math.floor(50 + Math.random() * 50 - cpu * 30),
      connections: {
        active: Math.floor(100 + cpu * 100),
        idle: Math.floor(50 - cpu * 30),
        total: 200,
        failed: Math.floor(errorRate * 100)
      },
      security: {
        authFailures: Math.floor(Math.random() * 5),
        permissionChanges: i % 200 === 0 ? 1 : 0,
        suspiciousActivities: errorRate > 0.02 ? Math.floor(Math.random() * 3) : 0
      }
    });
  }
  
  return metrics;
}

// Run the demo
if (require.main === module) {
  demonstrateAdvancedDiagnostics().catch(console.error);
}

export { demonstrateAdvancedDiagnostics };