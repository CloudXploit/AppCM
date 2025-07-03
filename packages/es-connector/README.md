# @cm-diagnostics/es-connector

Enterprise Studio integration package for CM Diagnostics, providing workflow automation, approvals, dashboards, and reporting capabilities.

## Features

- 🔄 **Workflow Management**: Create, execute, and monitor complex workflows
- 🤖 **Process Automation**: Rule-based automation with triggers and actions
- ✅ **Approval Workflows**: Multi-level approvals with escalation
- 📊 **Custom Dashboards**: Real-time monitoring with interactive widgets
- 📈 **Report Designer**: Scheduled reports with distribution
- 🔐 **Security**: Role-based access control and secure authentication
- 🔌 **WebSocket Support**: Real-time updates and notifications

## Installation

```bash
npm install @cm-diagnostics/es-connector
```

## Quick Start

```typescript
import { createESIntegration } from '@cm-diagnostics/es-connector';

// Create integration instance
const esIntegration = createESIntegration({
  connection: {
    baseUrl: 'https://es.example.com',
    username: 'your-username',
    password: 'your-password'
  }
});

// Connect
await esIntegration.connect();

// Execute a workflow
const result = await esIntegration.executeWorkflow('workflow-id', {
  variables: { input: 'data' }
});
```

## Workflow Management

### Creating Workflows

```typescript
import { WorkflowBuilder } from '@cm-diagnostics/es-connector';

const workflow = WorkflowBuilder.create('My Workflow')
  .description('Automated process workflow')
  .variable('inputData', 'string', { required: true })
  .variable('approver', 'string', { defaultValue: 'manager@example.com' })
  
  // Add steps
  .action('Process Data', 'processAction', {
    data: '${inputData}'
  })
  .decision('Need Approval?', 'amount > 1000')
  .approval('Manager Approval', ['${approver}'], {
    title: 'Approval Required',
    dueInDays: 2
  })
  .notification('Complete', ['${requester}'], 'workflow-complete')
  .build();

// Create in Enterprise Studio
const created = await esIntegration.getWorkflowService().createWorkflow(workflow);
```

### Parallel Execution

```typescript
const workflow = WorkflowBuilder.create('Parallel Processing')
  .parallel(
    (branch) => branch.action('Task 1', 'task1'),
    (branch) => branch.action('Task 2', 'task2'),
    (branch) => branch.action('Task 3', 'task3')
  )
  .build();
```

### Loops and Iterations

```typescript
const workflow = WorkflowBuilder.create('Batch Processing')
  .loop('Process Items', 'items', 'currentItem', (loop) => {
    loop
      .action('Process Item', 'processItem', { item: '${currentItem}' })
      .decision('Continue?', 'currentItem.status === "pending"');
  })
  .build();
```

## Process Automation

### Creating Automation Rules

```typescript
const automationEngine = esIntegration.getAutomationEngine();

await automationEngine.addRule({
  id: 'high-cpu-alert',
  name: 'High CPU Alert',
  enabled: true,
  trigger: {
    type: 'threshold',
    configuration: {
      metric: 'cpu_usage',
      threshold: 90,
      duration: 300 // 5 minutes
    }
  },
  conditions: [
    { field: 'environment', operator: 'equals', value: 'production' }
  ],
  actions: [
    {
      type: 'workflow',
      configuration: { workflowId: 'scale-resources' }
    },
    {
      type: 'notification',
      configuration: {
        recipients: ['ops@example.com'],
        template: 'high-cpu-alert'
      }
    }
  ]
});
```

### Custom Remediation Handlers

```typescript
automationEngine.registerRemediationHandler('restart-service', async (context) => {
  const { serviceName } = context.data;
  // Implement service restart logic
  return { success: true, serviceName };
});
```

## Approval Management

### Creating Approvals

```typescript
const approvalService = esIntegration.getApprovalService();

const approval = await approvalService.createApproval(
  'workflow-instance-id',
  'step-id',
  {
    title: 'Change Approval Required',
    description: 'Please review and approve the proposed changes',
    approvers: [
      { userId: 'john.doe' },
      { role: 'change-manager' }
    ],
    dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    priority: 'high',
    escalationRules: [{
      afterHours: 24,
      escalateTo: [{ role: 'senior-manager' }]
    }]
  }
);
```

### Processing Approvals

```typescript
// Get pending approvals
const pending = await approvalService.getMyPendingApprovals();

// Approve with comments
await approvalService.approve(approvalId, {
  approved: true,
  comments: 'Approved with conditions'
});

// Delegate
await approvalService.delegate(approvalId, 'other-user-id', 'Out of office');
```

## Dashboard Creation

### Using Dashboard Builder

```typescript
import { DashboardBuilder } from '@cm-diagnostics/es-connector';

const dashboard = DashboardBuilder.create('Operations Dashboard')
  .refreshInterval(30) // seconds
  .filter({
    name: 'environment',
    type: 'select',
    options: ['Production', 'Staging'],
    defaultValue: 'Production'
  })
  
  // Add widgets
  .metric('System Health', 98.5, { unit: '%' })
  .chart('Performance Trend', 'line', 'SELECT * FROM metrics')
  .table('Recent Alerts', 'SELECT * FROM alerts LIMIT 10', [
    { field: 'severity', label: 'Severity' },
    { field: 'message', label: 'Message' },
    { field: 'time', label: 'Time' }
  ])
  .build();

const created = await esIntegration.getDashboardService().createDashboard(dashboard);
```

### Real-time Updates

```typescript
const dashboardService = esIntegration.getDashboardService();

// Subscribe to dashboard updates
dashboardService.subscribeToDashboard(dashboardId, (data) => {
  console.log('Dashboard updated:', data);
});
```

## Report Generation

### Creating Reports

```typescript
import { ReportBuilder } from '@cm-diagnostics/es-connector';

const report = ReportBuilder.create('Monthly Report', 'pdf')
  .description('Monthly system performance report')
  .parameter({
    name: 'month',
    type: 'string',
    label: 'Report Month',
    required: true
  })
  .header('Monthly Performance Report - ${month}')
  .chart({
    type: 'bar',
    title: 'System Utilization',
    dataSource: {
      type: 'query',
      configuration: {
        query: 'SELECT system, avg_cpu, avg_memory FROM monthly_stats WHERE month = ${month}'
      }
    }
  })
  .table({
    columns: [
      { field: 'metric', label: 'Metric' },
      { field: 'value', label: 'Value' },
      { field: 'trend', label: 'Trend' }
    ],
    dataSource: {
      type: 'api',
      configuration: {
        endpoint: '/api/metrics/summary',
        parameters: { month: '${month}' }
      }
    }
  })
  .schedule({
    frequency: 'monthly',
    timezone: 'UTC'
  })
  .distribute({
    recipients: ['reports@example.com'],
    subject: 'Monthly Report - ${month}',
    attachReport: true
  })
  .build();

const created = await esIntegration.getReportService().createReport(report);
```

### Executing Reports

```typescript
const reportService = esIntegration.getReportService();

// Execute report
const result = await reportService.executeReport(reportId, {
  parameters: { month: '2024-01' },
  format: 'pdf'
});

// Check execution status (for async)
const status = await reportService.getExecutionStatus(jobId);
```

## Authentication & Security

### Session Management

```typescript
const authManager = esIntegration.getAuthManager();

// Check permissions
const hasPermission = await authManager.checkPermission('workflows.execute');
const hasRole = await authManager.checkRole('admin');

// Impersonation (for testing/support)
await authManager.impersonate('user-id');
await authManager.endImpersonation();
```

### Persistent Sessions

```typescript
const esIntegration = createESIntegration({
  connection: { /* ... */ },
  sessionStorage: {
    get: async (key) => localStorage.getItem(key),
    set: async (key, value) => localStorage.setItem(key, value),
    delete: async (key) => localStorage.removeItem(key)
  }
});
```

## Event Handling

```typescript
// Listen to events
esIntegration.on('workflow:started', (data) => {
  console.log('Workflow started:', data);
});

esIntegration.on('approval:created', (approval) => {
  console.log('New approval request:', approval);
});

esIntegration.on('automation:failed', ({ rule, error }) => {
  console.error('Automation failed:', rule.name, error);
});
```

## Error Handling

```typescript
try {
  await esIntegration.executeWorkflow('workflow-id');
} catch (error) {
  if (error.code === 'WORKFLOW_NOT_FOUND') {
    console.error('Workflow does not exist');
  } else if (error.code === 'PERMISSION_DENIED') {
    console.error('Insufficient permissions');
  }
}
```

## Best Practices

1. **Connection Management**: Use connection pooling for high-throughput scenarios
2. **Error Handling**: Always implement proper error handling and retries
3. **Permissions**: Check permissions before sensitive operations
4. **Monitoring**: Subscribe to events for monitoring and alerting
5. **Resource Cleanup**: Always disconnect when done

## API Reference

### Main Classes

- `EnterpriseStudioIntegration` - Main integration class
- `ESClient` - Low-level API client
- `ESAuthManager` - Authentication and authorization
- `ESWorkflowService` - Workflow management
- `AutomationEngine` - Process automation
- `ESApprovalService` - Approval workflows
- `ESDashboardService` - Dashboard management
- `ESReportService` - Report generation

### Builders

- `WorkflowBuilder` - Fluent API for workflow creation
- `DashboardBuilder` - Dashboard construction
- `ReportBuilder` - Report template builder

## License

Part of CM Diagnostics - Enterprise License