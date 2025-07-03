export interface ESConnection {
  baseUrl: string;
  username: string;
  password: string;
  domain?: string;
  timeout?: number;
  maxRetries?: number;
  wsEndpoint?: string;
  apiVersion?: string;
}

export interface ESSession {
  sessionId: string;
  userId: string;
  userName: string;
  roles: string[];
  permissions: string[];
  expiresAt: Date;
  refreshToken?: string;
}

export interface ESWorkflow {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: 'draft' | 'published' | 'deprecated';
  createdBy: string;
  createdDate: Date;
  modifiedBy: string;
  modifiedDate: Date;
  category?: string;
  tags?: string[];
  steps: ESWorkflowStep[];
  variables?: ESWorkflowVariable[];
  triggers?: ESWorkflowTrigger[];
}

export interface ESWorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'decision' | 'subprocess' | 'approval' | 'notification';
  configuration: Record<string, any>;
  position: { x: number; y: number };
  inputs?: ESWorkflowPort[];
  outputs?: ESWorkflowPort[];
  errorHandling?: ESErrorHandling;
}

export interface ESWorkflowPort {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: any;
}

export interface ESWorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  defaultValue?: any;
  required?: boolean;
  description?: string;
}

export interface ESWorkflowTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'event' | 'api' | 'email' | 'file';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface ESErrorHandling {
  strategy: 'retry' | 'skip' | 'fail' | 'compensate';
  maxRetries?: number;
  retryDelay?: number;
  compensationSteps?: string[];
}

export interface ESWorkflowInstance {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'suspended';
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  variables: Record<string, any>;
  history: ESWorkflowHistory[];
  error?: ESWorkflowError;
}

export interface ESWorkflowHistory {
  stepId: string;
  stepName: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error?: string;
  performedBy?: string;
}

export interface ESWorkflowError {
  code: string;
  message: string;
  stepId: string;
  timestamp: Date;
  details?: any;
  stackTrace?: string;
}

export interface ESApproval {
  id: string;
  workflowInstanceId: string;
  stepId: string;
  title: string;
  description?: string;
  requester: string;
  approvers: ESApprover[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdDate: Date;
  dueDate?: Date;
  completedDate?: Date;
  comments?: ESApprovalComment[];
  attachments?: ESAttachment[];
  metadata?: Record<string, any>;
}

export interface ESApprover {
  userId: string;
  userName: string;
  role?: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  respondedDate?: Date;
  comments?: string;
  delegatedTo?: string;
}

export interface ESApprovalComment {
  id: string;
  userId: string;
  userName: string;
  comment: string;
  timestamp: Date;
  type: 'comment' | 'approval' | 'rejection' | 'delegation';
}

export interface ESAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedDate: Date;
  url?: string;
}

export interface ESDashboard {
  id: string;
  name: string;
  description?: string;
  layout: ESDashboardLayout;
  widgets: ESWidget[];
  filters?: ESDashboardFilter[];
  refreshInterval?: number;
  permissions?: ESPermission[];
  createdBy: string;
  createdDate: Date;
  modifiedBy: string;
  modifiedDate: Date;
}

export interface ESDashboardLayout {
  type: 'grid' | 'flow' | 'fixed';
  columns?: number;
  rows?: number;
  responsive?: boolean;
}

export interface ESWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'text' | 'image' | 'custom';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  configuration: ESWidgetConfig;
  dataSource?: ESDataSource;
  refreshInterval?: number;
}

export interface ESWidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'scatter' | 'heatmap';
  displayOptions?: Record<string, any>;
  thresholds?: ESThreshold[];
  actions?: ESWidgetAction[];
}

export interface ESDataSource {
  type: 'query' | 'api' | 'workflow' | 'static';
  configuration: Record<string, any>;
  refreshTrigger?: 'interval' | 'manual' | 'event';
}

export interface ESThreshold {
  value: number;
  color: string;
  label?: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
}

export interface ESWidgetAction {
  label: string;
  icon?: string;
  action: 'navigate' | 'execute' | 'export' | 'refresh';
  configuration: Record<string, any>;
}

export interface ESDashboardFilter {
  id: string;
  name: string;
  type: 'text' | 'select' | 'date' | 'range' | 'boolean';
  defaultValue?: any;
  options?: any[];
  required?: boolean;
  affectsWidgets?: string[];
}

export interface ESReport {
  id: string;
  name: string;
  description?: string;
  template: ESReportTemplate;
  parameters?: ESReportParameter[];
  schedule?: ESReportSchedule;
  distribution?: ESReportDistribution;
  format: 'pdf' | 'excel' | 'word' | 'html' | 'csv';
  createdBy: string;
  createdDate: Date;
  modifiedBy: string;
  modifiedDate: Date;
}

export interface ESReportTemplate {
  type: 'built-in' | 'custom' | 'jasper' | 'crystal';
  templateId?: string;
  sections?: ESReportSection[];
  styling?: ESReportStyling;
}

export interface ESReportSection {
  id: string;
  type: 'header' | 'footer' | 'content' | 'summary' | 'chart' | 'table';
  content: any;
  dataSource?: ESDataSource;
  conditional?: ESConditional;
}

export interface ESReportParameter {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  defaultValue?: any;
  validation?: ESValidation;
}

export interface ESReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  cronExpression?: string;
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
}

export interface ESReportDistribution {
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  attachReport?: boolean;
  compressionEnabled?: boolean;
}

export interface ESReportStyling {
  theme?: string;
  customCSS?: string;
  pageSize?: string;
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface ESConditional {
  field: string;
  operator: string;
  value: any;
  action: 'show' | 'hide' | 'enable' | 'disable';
}

export interface ESValidation {
  type: 'regex' | 'range' | 'length' | 'custom';
  pattern?: string;
  min?: number;
  max?: number;
  message?: string;
  customValidator?: string;
}

export interface ESPermission {
  principalType: 'user' | 'role' | 'group';
  principalId: string;
  permissions: string[];
  deny?: boolean;
}

export interface ESNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  userId?: string;
  workflowInstanceId?: string;
  read?: boolean;
  actions?: ESNotificationAction[];
}

export interface ESNotificationAction {
  label: string;
  action: string;
  parameters?: Record<string, any>;
}

export interface ESMetrics {
  workflows: {
    total: number;
    active: number;
    failed: number;
    averageExecutionTime: number;
  };
  approvals: {
    pending: number;
    averageApprovalTime: number;
    overdueCount: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    activeUsers: number;
    apiCallsPerMinute: number;
  };
}