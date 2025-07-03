import {
  createESIntegration,
  WorkflowBuilder,
  DashboardBuilder,
  ReportBuilder,
  AutomationRule
} from './packages/es-connector/src';

async function demonstrateESIntegration() {
  console.log('🔧 CM Diagnostics - Enterprise Studio Integration Demo\n');

  // Initialize Enterprise Studio integration
  const esIntegration = createESIntegration({
    connection: {
      baseUrl: 'https://es.example.com',
      username: 'admin',
      password: 'password',
      apiVersion: '1.0'
    },
    autoConnect: false
  });

  try {
    // 1. Connect to Enterprise Studio
    console.log('1️⃣ Connecting to Enterprise Studio...');
    await esIntegration.connect();
    console.log('✅ Connected successfully\n');

    // 2. Create and execute a workflow
    console.log('2️⃣ Creating diagnostic workflow...');
    const diagnosticWorkflow = WorkflowBuilder.create('CM Diagnostic Workflow')
      .description('Automated diagnostic and remediation workflow')
      .variable('systemId', 'string', { required: true })
      .variable('issueType', 'string', { required: true })
      .variable('severity', 'string', { defaultValue: 'medium' })
      
      // Step 1: Run diagnostics
      .action('Run Diagnostics', 'runDiagnostics', {
        systemId: '${systemId}',
        scanType: 'comprehensive'
      })
      
      // Step 2: Analyze results
      .action('Analyze Results', 'analyzeResults', {
        includeRecommendations: true
      })
      
      // Step 3: Decision based on severity
      .decision('Check Severity', "severity === 'critical' || findings.length > 5")
      
      // Step 4: Approval for critical issues
      .approval('Manager Approval', ['manager@company.com'], {
        title: 'Critical Issue Remediation Approval',
        description: 'Approval required for automated remediation of critical issues',
        dueInDays: 1
      })
      
      // Step 5: Execute remediation
      .action('Execute Remediation', 'executeRemediation', {
        actions: '${recommendedActions}',
        backupFirst: true
      })
      
      // Step 6: Verify fix
      .action('Verify Fix', 'verifyRemediation', {
        rerunDiagnostics: true
      })
      
      // Step 7: Send notification
      .notification('Notify Completion', ['${requester}', 'ops-team@company.com'], 'remediation-complete', {
        systemId: '${systemId}',
        issue: '${issueType}',
        status: '${remediationStatus}'
      })
      .build();

    const workflowService = esIntegration.getWorkflowService();
    const createdWorkflow = await workflowService.createWorkflow(diagnosticWorkflow);
    console.log(`✅ Created workflow: ${createdWorkflow.name} (${createdWorkflow.id})\n`);

    // Execute the workflow
    console.log('Executing diagnostic workflow...');
    const instance = await workflowService.executeWorkflow(createdWorkflow.id, {
      variables: {
        systemId: 'prod-cm-01',
        issueType: 'performance-degradation',
        severity: 'high'
      },
      async: true
    });
    console.log(`✅ Workflow instance started: ${instance.id}\n`);

    // 3. Set up automation rules
    console.log('3️⃣ Setting up automation rules...');
    const automationEngine = esIntegration.getAutomationEngine();
    
    const performanceRule: AutomationRule = {
      id: 'auto-scale-rule',
      name: 'Auto-Scale on High Load',
      enabled: true,
      trigger: {
        type: 'threshold',
        configuration: {
          metric: 'cpu_usage',
          threshold: 80,
          duration: 300 // 5 minutes
        }
      },
      conditions: [
        { field: 'system.type', operator: 'equals', value: 'content-manager' },
        { field: 'time.hour', operator: 'greater_than', value: 8, combineWith: 'and' },
        { field: 'time.hour', operator: 'less_than', value: 20, combineWith: 'and' }
      ],
      actions: [
        {
          type: 'workflow',
          configuration: {
            workflowId: 'scale-resources-workflow',
            variables: { scaleFactor: 1.5 }
          }
        },
        {
          type: 'notification',
          configuration: {
            recipients: ['ops-team@company.com'],
            template: 'resource-scaling',
            channel: 'email'
          }
        }
      ],
      errorHandling: {
        retryCount: 3,
        retryDelay: 5000,
        fallbackActions: [{
          type: 'notification',
          configuration: {
            recipients: ['escalation@company.com'],
            template: 'automation-failure'
          }
        }]
      }
    };

    await automationEngine.addRule(performanceRule);
    console.log('✅ Added automation rule for auto-scaling\n');

    // 4. Create monitoring dashboard
    console.log('4️⃣ Creating monitoring dashboard...');
    const dashboardService = esIntegration.getDashboardService();
    
    const cmDashboard = DashboardBuilder.create('CM System Health Dashboard')
      .description('Real-time monitoring of Content Manager systems')
      .refreshInterval(30) // 30 seconds
      .filter({
        name: 'environment',
        type: 'select',
        options: ['Production', 'Staging', 'Development'],
        defaultValue: 'Production'
      })
      .filter({
        name: 'timeRange',
        type: 'range',
        defaultValue: { start: '-1h', end: 'now' }
      })
      
      // Metrics row
      .row()
        .metric('System Health', 95, { 
          unit: '%',
          thresholds: [
            { value: 90, color: '#10b981', operator: 'gte' },
            { value: 70, color: '#f59e0b', operator: 'gte' },
            { value: 0, color: '#ef4444', operator: 'gte' }
          ]
        })
        .metric('Active Users', 234)
        .metric('Avg Response Time', 145, { unit: 'ms' })
        .metric('Error Rate', 0.3, { unit: '%' })
        .end()
      
      // Performance chart
      .chart('Performance Trends', 'line', {
        type: 'query',
        configuration: {
          query: `
            SELECT 
              timestamp,
              cpu_usage,
              memory_usage,
              response_time
            FROM system_metrics
            WHERE environment = $environment
              AND timestamp >= $timeRange.start
          `
        }
      }, {
        width: 12,
        height: 4,
        xAxis: 'timestamp',
        yAxis: 'value',
        series: ['cpu_usage', 'memory_usage', 'response_time']
      })
      
      // Issues table
      .table('Active Issues', {
        type: 'api',
        configuration: {
          endpoint: '/api/issues',
          method: 'GET',
          parameters: { 
            status: 'active',
            environment: '${environment}'
          }
        }
      }, [
        { field: 'severity', label: 'Severity', sortable: true },
        { field: 'title', label: 'Issue', sortable: true },
        { field: 'system', label: 'System' },
        { field: 'detected', label: 'Detected', sortable: true },
        { field: 'status', label: 'Status' }
      ], {
        width: 12,
        height: 6
      })
      .build();

    const createdDashboard = await dashboardService.createDashboard(cmDashboard);
    console.log(`✅ Created dashboard: ${createdDashboard.name}\n`);

    // 5. Create compliance report
    console.log('5️⃣ Creating compliance report...');
    const reportService = esIntegration.getReportService();
    
    const complianceReport = ReportBuilder.create('CM Security Compliance Report', 'pdf')
      .description('Monthly security and compliance audit report')
      .parameter({
        name: 'month',
        type: 'string',
        label: 'Report Month',
        required: true,
        defaultValue: new Date().toISOString().slice(0, 7)
      })
      .parameter({
        name: 'includeDetails',
        type: 'boolean',
        label: 'Include Detailed Findings',
        defaultValue: true
      })
      .styling({
        theme: 'professional',
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: 25, right: 25, bottom: 25, left: 25 }
      })
      .header({
        template: 'compliance-header',
        data: {
          title: 'Security Compliance Report',
          month: '${month}',
          logo: '/assets/company-logo.png'
        }
      })
      .content('## Executive Summary\n\nThis report provides a comprehensive overview of security compliance for all Content Manager systems.')
      .chart({
        type: 'donut',
        title: 'Compliance Status by Category',
        dataSource: {
          type: 'query',
          configuration: {
            query: `
              SELECT 
                category,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) as compliant
              FROM compliance_checks
              WHERE month = $month
              GROUP BY category
            `
          }
        }
      })
      .table({
        columns: [
          { field: 'control', label: 'Control' },
          { field: 'status', label: 'Status' },
          { field: 'finding', label: 'Finding' },
          { field: 'remediation', label: 'Remediation' }
        ],
        dataSource: {
          type: 'query',
          configuration: {
            query: `
              SELECT * FROM compliance_findings
              WHERE month = $month AND status != 'compliant'
              ORDER BY severity DESC
            `
          }
        }
      })
      .content({
        template: 'detailed-findings',
        data: { threshold: 'high' }
      }, {
        conditional: {
          field: 'includeDetails',
          operator: 'equals',
          value: true
        }
      })
      .footer('Generated by CM Diagnostics - ${reportDate}')
      .schedule({
        frequency: 'monthly',
        timezone: 'America/New_York'
      })
      .distribute({
        recipients: ['compliance@company.com', 'security@company.com'],
        cc: ['ciso@company.com'],
        subject: 'Monthly CM Security Compliance Report - ${month}',
        body: 'Please find attached the monthly security compliance report for Content Manager systems.',
        attachReport: true,
        compressionEnabled: true
      })
      .build();

    const createdReport = await reportService.createReport(complianceReport);
    console.log(`✅ Created report: ${createdReport.name}\n`);

    // 6. Set up approval workflow
    console.log('6️⃣ Setting up approval process...');
    const approvalService = esIntegration.getApprovalService();
    
    // Simulate creating an approval for a critical change
    const approval = await approvalService.createApproval(
      instance.id, // workflow instance ID
      'manager-approval-step', // step ID
      {
        title: 'Critical System Change Approval',
        description: 'Approval required for automated remediation of critical performance issues in Production CM system',
        approvers: [
          { role: 'cm-admin' },
          { role: 'security-admin' }
        ],
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        priority: 'high',
        metadata: {
          systemId: 'prod-cm-01',
          changeType: 'performance-optimization',
          estimatedImpact: 'medium'
        },
        escalationRules: [{
          afterHours: 12,
          escalateTo: [{ role: 'cm-manager' }],
          notificationTemplate: 'approval-escalation'
        }],
        requireAllApprovers: true,
        requireComments: true
      }
    );
    console.log(`✅ Created approval request: ${approval.id}\n`);

    // 7. Check system health
    console.log('7️⃣ Checking Enterprise Studio health...');
    const health = await esIntegration.healthCheck();
    console.log('System Health:');
    console.log(`  Connected: ${health.connected ? '✅' : '❌'}`);
    console.log(`  Authenticated: ${health.authenticated ? '✅' : '❌'}`);
    console.log('  Services:');
    Object.entries(health.services).forEach(([service, status]) => {
      console.log(`    ${service}: ${status ? '✅' : '❌'}`);
    });

    // 8. Monitor workflow execution
    console.log('\n8️⃣ Monitoring workflow execution...');
    let instanceStatus = await workflowService.getWorkflowInstance(instance.id);
    console.log(`Workflow Status: ${instanceStatus.status}`);
    console.log(`Current Step: ${instanceStatus.currentStep || 'Starting...'}`);
    
    // Get workflow history
    const history = await workflowService.getWorkflowHistory(instance.id);
    console.log('\nExecution History:');
    history.forEach(entry => {
      console.log(`  - ${entry.stepName}: ${entry.status} (${entry.endTime ? 'completed' : 'in progress'})`);
    });

  } catch (error) {
    console.error('❌ Error during demo:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await esIntegration.disconnect();
    console.log('✅ Demo completed');
  }
}

// Run the demo
if (require.main === module) {
  demonstrateESIntegration().catch(console.error);
}

export { demonstrateESIntegration };