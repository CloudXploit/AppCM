// CM Diagnostics Complete Demo
// Demonstrates all features of the application

import { createCore } from './packages/core/src';
import { createLogger } from './packages/logger/src';
import { createAuthSystem } from './packages/auth/src';
import { createCache } from './packages/cache/src';
import { createNotificationSystem } from './packages/notifications/src';
import { createWorkflowEngine } from './packages/workflow/src';
import { createMonitoringSystem } from './packages/monitoring/src';
import { createDiagnosticsEngine } from './packages/diagnostics/src';
import { createRemediationEngine } from './packages/remediation/src';
import { createIntegrationHub } from './packages/integrations/src';
import { createScheduler } from './packages/scheduler/src';
import { createAdvancedDiagnostics } from './packages/advanced-diagnostics/src';
import { createAnalyticsEngine } from './packages/analytics/src';

async function runCompleteDemo() {
  console.log('🚀 CM Diagnostics - Complete Feature Demo');
  console.log('=========================================\n');

  // Initialize all systems
  const logger = createLogger({ level: 'info', service: 'demo' });
  
  const core = createCore({
    appName: 'CM Diagnostics Demo',
    version: '1.0.0',
    environment: 'development'
  });

  const auth = createAuthSystem({
    jwtSecret: 'demo-secret',
    tokenExpiry: '24h'
  });

  const cache = createCache({ type: 'memory' });

  const notifications = createNotificationSystem({
    channels: {
      console: { enabled: true }
    }
  });

  const workflow = createWorkflowEngine({
    maxConcurrentWorkflows: 5
  });

  const monitoring = createMonitoringSystem({
    enableMetrics: true,
    enableTracing: true
  });

  const diagnostics = createDiagnosticsEngine({
    rules: { enableBuiltInRules: true },
    realtime: { enabled: true }
  });

  const remediation = createRemediationEngine({
    strategies: { enableBuiltInStrategies: true },
    execution: { dryRunByDefault: true }
  });

  const integrations = createIntegrationHub();
  
  const scheduler = createScheduler({
    persistence: false
  });

  const advancedDiagnostics = createAdvancedDiagnostics({
    anomalyDetection: { sensitivity: 0.7 },
    enableLearning: true
  });

  const analytics = createAnalyticsEngine({
    dashboards: { maxDashboards: 10 },
    pipelines: { maxConcurrentRuns: 3 }
  });

  console.log('✅ All systems initialized\n');

  // Demo 1: Authentication
  console.log('📌 Demo 1: Authentication System');
  console.log('--------------------------------');
  
  const user = await auth.createUser({
    email: 'admin@cm-diagnostics.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin'
  });
  
  const { token } = await auth.login('admin@cm-diagnostics.com', 'admin123');
  console.log(`✅ User created and logged in: ${user.email}`);
  console.log(`🔑 JWT Token: ${token.substring(0, 20)}...`);

  // Demo 2: System Registration
  console.log('\n📌 Demo 2: System Registration & Monitoring');
  console.log('-------------------------------------------');
  
  const cmSystem = core.registerSystem({
    id: 'cm-prod-01',
    name: 'Production Content Manager',
    type: 'content-manager',
    version: '8.5.2',
    url: 'https://cm.example.com',
    metadata: {
      environment: 'production',
      region: 'us-east-1',
      criticality: 'high'
    }
  });
  
  console.log(`✅ System registered: ${cmSystem.name} (${cmSystem.id})`);

  // Demo 3: Real-time Monitoring
  console.log('\n📌 Demo 3: Real-time Monitoring');
  console.log('--------------------------------');
  
  // Start monitoring
  await monitoring.startCollecting();
  
  // Simulate metrics
  for (let i = 0; i < 5; i++) {
    const metrics = {
      systemId: cmSystem.id,
      timestamp: new Date(),
      cpu: {
        usage: 0.3 + Math.random() * 0.5,
        cores: 8,
        loadAverage: [2.1, 2.5, 2.8]
      },
      memory: {
        total: 16384,
        used: 8192 + Math.random() * 4096,
        free: 8192 - Math.random() * 4096,
        usagePercent: 0.5 + Math.random() * 0.3
      },
      disk: {
        total: 512000,
        used: 256000 + Math.random() * 100000,
        free: 256000 - Math.random() * 100000,
        usagePercent: 0.5 + Math.random() * 0.2
      },
      responseTime: {
        average: 200 + Math.random() * 300,
        median: 180 + Math.random() * 200,
        p95: 500 + Math.random() * 500,
        p99: 1000 + Math.random() * 1000
      },
      throughput: {
        requestsPerSecond: 100 + Math.random() * 50,
        bytesPerSecond: 1000000 + Math.random() * 500000
      },
      errors: {
        rate: Math.random() * 0.05,
        total: Math.floor(Math.random() * 100)
      },
      activeUsers: Math.floor(100 + Math.random() * 200),
      connections: {
        active: Math.floor(50 + Math.random() * 100),
        idle: Math.floor(10 + Math.random() * 40),
        total: 200,
        failed: Math.floor(Math.random() * 10)
      }
    };
    
    await monitoring.ingestMetrics(metrics);
    console.log(`📊 Metrics collected at ${metrics.timestamp.toISOString()}`);
    console.log(`   CPU: ${(metrics.cpu.usage * 100).toFixed(1)}%, Memory: ${(metrics.memory.usagePercent * 100).toFixed(1)}%`);
  }

  // Demo 4: Diagnostics
  console.log('\n📌 Demo 4: Automated Diagnostics');
  console.log('--------------------------------');
  
  // Create diagnostic rules
  diagnostics.addRule({
    id: 'high-cpu-usage',
    name: 'High CPU Usage Detection',
    description: 'Detects when CPU usage exceeds 80%',
    category: 'performance',
    severity: 'warning',
    enabled: true,
    condition: {
      type: 'threshold',
      metric: 'cpu.usage',
      operator: '>',
      value: 0.8,
      duration: 300
    },
    metadata: {
      impact: 'System performance degradation',
      recommendation: 'Scale up resources or optimize workload'
    }
  });

  diagnostics.addRule({
    id: 'memory-leak-detection',
    name: 'Memory Leak Detection',
    description: 'Detects potential memory leaks',
    category: 'performance',
    severity: 'high',
    enabled: true,
    condition: {
      type: 'trend',
      metric: 'memory.used',
      trend: 'increasing',
      duration: 1800,
      threshold: 0.1
    }
  });

  // Run diagnostics
  const diagnosticResult = await diagnostics.runDiagnostics(cmSystem.id);
  console.log(`✅ Diagnostics completed: ${diagnosticResult.totalChecks} checks`);
  console.log(`   Findings: ${diagnosticResult.findings.length}`);
  
  if (diagnosticResult.findings.length > 0) {
    diagnosticResult.findings.forEach(finding => {
      console.log(`   ⚠️  ${finding.title} (${finding.severity})`);
    });
  }

  // Demo 5: ML-based Anomaly Detection
  console.log('\n📌 Demo 5: ML-based Anomaly Detection');
  console.log('-------------------------------------');
  
  // Ingest historical data for ML
  const historicalMetrics = [];
  for (let i = 0; i < 100; i++) {
    historicalMetrics.push({
      systemId: cmSystem.id,
      timestamp: new Date(Date.now() - i * 60000),
      cpu: {
        usage: 0.3 + Math.sin(i * 0.1) * 0.2 + Math.random() * 0.1,
        cores: 8,
        loadAverage: [2, 2, 2]
      },
      memory: {
        total: 16384,
        used: 8192 + i * 10, // Simulating memory leak
        free: 8192 - i * 10,
        usagePercent: 0.5 + i * 0.001
      },
      disk: {
        total: 512000,
        used: 256000,
        free: 256000,
        usagePercent: 0.5
      },
      responseTime: {
        average: 200 + Math.random() * 100,
        median: 180,
        p95: 500,
        p99: 1000
      },
      throughput: {
        requestsPerSecond: 100,
        bytesPerSecond: 1000000
      },
      errors: {
        rate: 0.01,
        total: 10
      },
      activeUsers: 150,
      connections: {
        active: 100,
        idle: 50,
        total: 200,
        failed: 5
      }
    });
  }
  
  await advancedDiagnostics.ingestMetrics(historicalMetrics);
  
  // Detect anomalies
  const anomalies = await advancedDiagnostics.detectAnomalies(cmSystem.id);
  console.log(`🤖 ML Analysis completed: ${anomalies.length} anomalies detected`);
  
  anomalies.slice(0, 3).forEach(anomaly => {
    console.log(`   🔍 ${anomaly.metric}: ${anomaly.type} anomaly (confidence: ${(anomaly.confidence * 100).toFixed(0)}%)`);
  });

  // Get predictive insights
  const insights = await advancedDiagnostics.getInsights(cmSystem.id);
  console.log(`\n💡 Predictive Insights: ${insights.length} insights generated`);
  
  insights.slice(0, 2).forEach(insight => {
    console.log(`   📈 ${insight.title}`);
    console.log(`      ${insight.description}`);
    console.log(`      Impact: ${insight.impact}, Likelihood: ${(insight.likelihood * 100).toFixed(0)}%`);
  });

  // Demo 6: Auto-Remediation
  console.log('\n📌 Demo 6: Automated Remediation');
  console.log('--------------------------------');
  
  // Create remediation strategies
  remediation.addStrategy({
    id: 'restart-service',
    name: 'Restart Service',
    description: 'Restarts the Content Manager service',
    category: 'service',
    applicableFindings: ['service-not-responding', 'high-memory-usage'],
    actions: [
      {
        type: 'service',
        operation: 'restart',
        parameters: {
          serviceName: 'content-manager',
          gracefulShutdown: true,
          timeout: 30
        }
      }
    ],
    risks: ['temporary-downtime'],
    estimatedDuration: 60,
    requiresApproval: true
  });

  remediation.addStrategy({
    id: 'clear-cache',
    name: 'Clear System Cache',
    description: 'Clears Content Manager cache to free memory',
    category: 'performance',
    applicableFindings: ['high-memory-usage', 'cache-overflow'],
    actions: [
      {
        type: 'cache',
        operation: 'clear',
        parameters: {
          cacheTypes: ['page', 'object', 'query']
        }
      }
    ],
    risks: ['temporary-performance-impact'],
    estimatedDuration: 30,
    requiresApproval: false
  });

  // Execute remediation (dry run)
  if (diagnosticResult.findings.length > 0) {
    const plan = await remediation.createRemediationPlan(
      diagnosticResult.findings[0],
      { autoSelect: true }
    );
    
    console.log(`📋 Remediation Plan created: ${plan.strategies.length} strategies`);
    plan.strategies.forEach(strategy => {
      console.log(`   🔧 ${strategy.name} (Duration: ${strategy.estimatedDuration}s)`);
    });
    
    const execution = await remediation.executeRemediation(plan, {
      dryRun: true
    });
    
    console.log(`✅ Remediation executed (dry run): ${execution.status}`);
  }

  // Demo 7: Workflow Automation
  console.log('\n📌 Demo 7: Workflow Automation');
  console.log('------------------------------');
  
  const diagnosticWorkflow = await workflow.createWorkflow({
    name: 'Automated Diagnostic Workflow',
    description: 'Runs diagnostics and auto-remediation',
    trigger: {
      type: 'schedule',
      schedule: '*/15 * * * *' // Every 15 minutes
    },
    steps: [
      {
        id: 'collect-metrics',
        name: 'Collect System Metrics',
        type: 'action',
        action: 'monitoring.collectMetrics',
        parameters: { systemId: '${systemId}' }
      },
      {
        id: 'run-diagnostics',
        name: 'Run Diagnostics',
        type: 'action',
        action: 'diagnostics.run',
        parameters: { systemId: '${systemId}' },
        dependsOn: ['collect-metrics']
      },
      {
        id: 'check-findings',
        name: 'Check for Critical Findings',
        type: 'condition',
        condition: '${findings.length} > 0 && ${findings[0].severity} === "critical"',
        dependsOn: ['run-diagnostics']
      },
      {
        id: 'notify-team',
        name: 'Notify Operations Team',
        type: 'action',
        action: 'notifications.send',
        parameters: {
          channel: 'email',
          recipients: ['ops-team@example.com'],
          subject: 'Critical issue detected',
          template: 'critical-finding'
        },
        dependsOn: ['check-findings']
      },
      {
        id: 'auto-remediate',
        name: 'Execute Auto-Remediation',
        type: 'action',
        action: 'remediation.execute',
        parameters: {
          findingId: '${findings[0].id}',
          autoApprove: false
        },
        dependsOn: ['check-findings']
      }
    ]
  });
  
  console.log(`✅ Workflow created: ${diagnosticWorkflow.name}`);
  console.log(`   Steps: ${diagnosticWorkflow.steps.length}`);

  // Demo 8: Analytics Dashboard
  console.log('\n📌 Demo 8: Analytics & Dashboards');
  console.log('---------------------------------');
  
  // Create performance dashboard
  const dashboard = await analytics.createDashboardFromTemplate(
    'performance',
    'System Performance Dashboard',
    user.id,
    [cmSystem.id]
  );
  
  console.log(`📊 Dashboard created: ${dashboard.name}`);
  console.log(`   Widgets: ${dashboard.widgets.length}`);
  
  // Create ML pipeline
  const mlPipeline = await analytics.createPipeline(
    'Anomaly Detection Pipeline',
    [
      {
        id: 'ingest',
        name: 'Data Ingestion',
        type: 'data_ingestion' as any,
        config: {
          processor: 'metrics-ingestion',
          parameters: { source: 'monitoring' },
          inputs: [],
          outputs: [{ name: 'raw_data', type: 'dataset', destination: 'memory' }]
        },
        dependencies: []
      },
      {
        id: 'train',
        name: 'Train Anomaly Model',
        type: 'model_training' as any,
        config: {
          processor: 'anomaly-training',
          parameters: { algorithm: 'isolation_forest' },
          inputs: [{ name: 'raw_data', type: 'dataset', source: 'memory' }],
          outputs: [{ name: 'model', type: 'model', destination: 'registry' }]
        },
        dependencies: ['ingest']
      }
    ],
    user.id
  );
  
  console.log(`🤖 ML Pipeline created: ${mlPipeline.name}`);

  // Demo 9: Integrations
  console.log('\n📌 Demo 9: External Integrations');
  console.log('--------------------------------');
  
  // Configure Slack integration
  const slackIntegration = integrations.configure('slack', {
    name: 'Slack Notifications',
    enabled: true,
    config: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/demo',
      channel: '#cm-alerts',
      username: 'CM Diagnostics Bot'
    }
  });
  
  console.log(`✅ Slack integration configured: ${slackIntegration.name}`);

  // Configure PagerDuty integration
  const pagerdutyIntegration = integrations.configure('pagerduty', {
    name: 'PagerDuty Incidents',
    enabled: true,
    config: {
      apiKey: process.env.PAGERDUTY_API_KEY || 'demo-key',
      serviceId: 'cm-diagnostics',
      escalationPolicy: 'critical-only'
    }
  });
  
  console.log(`✅ PagerDuty integration configured: ${pagerdutyIntegration.name}`);

  // Demo 10: Scheduled Jobs
  console.log('\n📌 Demo 10: Scheduled Jobs');
  console.log('--------------------------');
  
  const backupJob = await scheduler.scheduleJob({
    name: 'Daily Backup',
    schedule: '0 2 * * *', // 2 AM daily
    handler: async () => {
      console.log('Executing daily backup...');
      // Backup logic here
    },
    options: {
      timezone: 'UTC',
      maxRetries: 3
    }
  });
  
  const reportJob = await scheduler.scheduleJob({
    name: 'Weekly Report',
    schedule: '0 9 * * MON', // 9 AM every Monday
    handler: async () => {
      console.log('Generating weekly report...');
      // Report generation logic
    }
  });
  
  console.log(`✅ Scheduled jobs created:`);
  console.log(`   - ${backupJob.name}: ${backupJob.schedule}`);
  console.log(`   - ${reportJob.name}: ${reportJob.schedule}`);

  // Summary
  console.log('\n🎉 Demo Complete!');
  console.log('=================');
  console.log('\nSystems Status:');
  
  const stats = analytics.getStatistics();
  console.log(`📊 Dashboards: ${stats.dashboards.total}`);
  console.log(`🔄 Active Workflows: ${workflow.getActiveWorkflows().length}`);
  console.log(`📡 Integrations: ${integrations.list().length}`);
  console.log(`⏰ Scheduled Jobs: ${scheduler.getJobs().length}`);
  console.log(`🔍 Diagnostic Rules: ${diagnostics.getRules().length}`);
  console.log(`🔧 Remediation Strategies: ${remediation.getStrategies().length}`);
  
  console.log('\n🌐 Access Points:');
  console.log('   Web UI: http://localhost:3000');
  console.log('   API: http://localhost:3000/api');
  console.log('   Metrics: http://localhost:9090');
  console.log('   Grafana: http://localhost:3001');
  console.log('   Kibana: http://localhost:5601');
  
  console.log('\n📚 For more information, see the documentation.');
  
  // Cleanup
  await monitoring.stop();
  await scheduler.stop();
  await cache.disconnect();
}

// Run the demo
if (require.main === module) {
  runCompleteDemo()
    .then(() => {
      console.log('\n✅ Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error);
      process.exit(1);
    });
}

export { runCompleteDemo };