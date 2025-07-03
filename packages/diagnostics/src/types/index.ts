// Core types for the diagnostics system

export type DiagnosticSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DiagnosticCategory = 
  | 'performance' 
  | 'security' 
  | 'configuration' 
  | 'data-integrity'
  | 'compliance'
  | 'availability'
  | 'compatibility';

export type DiagnosticStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type RemediationStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled-back';

// Diagnostic Rule Definition
export interface DiagnosticRule {
  id: string;
  name: string;
  description: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  enabled: boolean;
  version: string;
  supportedVersions: string[]; // CM versions this rule applies to
  tags: string[];
  
  // Rule configuration
  config?: Record<string, any>;
  
  // Thresholds and conditions
  conditions: RuleCondition[];
  
  // Auto-remediation settings
  autoRemediate: boolean;
  remediationActions?: RemediationAction[];
  
  // Scheduling
  schedule?: {
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    cronExpression?: string;
  };
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex' | 'exists' | 'not_exists';
  value: any;
  threshold?: number;
  unit?: string;
}

// Diagnostic Finding
export interface DiagnosticFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  
  // Finding details
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  
  // Context
  systemId: string;
  component: string;
  resourcePath?: string;
  
  // Evidence
  evidence: {
    actual: any;
    expected: any;
    difference?: any;
    metadata?: Record<string, any>;
  };
  
  // Timestamps
  detectedAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  
  // Remediation
  remediable: boolean;
  remediationActions?: RemediationAction[];
  remediationHistory?: RemediationAttempt[];
  
  // Status
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  falsePositive: boolean;
}

// Remediation Action
export interface RemediationAction {
  id: string;
  name: string;
  description: string;
  type: 'automatic' | 'semi-automatic' | 'manual';
  
  // Action details
  action: string;
  parameters?: Record<string, any>;
  
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  requiresDowntime: boolean;
  estimatedDuration: number; // seconds
  
  // Rollback
  canRollback: boolean;
  rollbackAction?: string;
  rollbackParameters?: Record<string, any>;
  
  // Validation
  preConditions?: RuleCondition[];
  postConditions?: RuleCondition[];
}

// Remediation Attempt
export interface RemediationAttempt {
  id: string;
  findingId: string;
  actionId: string;
  status: RemediationStatus;
  
  // Execution details
  startedAt: Date;
  completedAt?: Date;
  executedBy: string;
  approvedBy?: string;
  
  // Results
  success: boolean;
  output?: string;
  error?: string;
  
  // Changes made
  changesMade?: {
    before: any;
    after: any;
  };
  
  // Rollback info
  rolledBack: boolean;
  rollbackAt?: Date;
  rollbackReason?: string;
}

// Diagnostic Scan
export interface DiagnosticScan {
  id: string;
  name: string;
  systemId: string;
  
  // Scan configuration
  rules: string[]; // Rule IDs to run
  categories?: DiagnosticCategory[];
  
  // Status
  status: DiagnosticStatus;
  progress: number; // 0-100
  
  // Timing
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // seconds
  
  // Results
  findingsCount: {
    total: number;
    bySeverity: Record<DiagnosticSeverity, number>;
    byCategory: Record<DiagnosticCategory, number>;
  };
  
  findings: DiagnosticFinding[];
  
  // Metadata
  triggeredBy: string;
  triggerType: 'manual' | 'scheduled' | 'event' | 'api';
}

// Scanner Interface
export interface DiagnosticScanner {
  id: string;
  name: string;
  category: DiagnosticCategory;
  version: string;
  
  // Scanner capabilities
  supportedRules: string[];
  supportedVersions: string[];
  
  // Methods
  initialize(): Promise<void>;
  scan(context: ScanContext): Promise<ScanResult>;
  cleanup(): Promise<void>;
}

export interface ScanContext {
  systemId: string;
  connector: any; // CMConnector instance
  rules: DiagnosticRule[];
  previousFindings?: DiagnosticFinding[];
  options?: Record<string, any>;
}

export interface ScanResult {
  scannerId: string;
  duration: number;
  findings: DiagnosticFinding[];
  errors?: ScanError[];
  metadata?: Record<string, any>;
}

export interface ScanError {
  ruleId: string;
  error: string;
  stack?: string;
  retryable: boolean;
}

// Remediation Engine Interface
export interface RemediationEngine {
  execute(finding: DiagnosticFinding, action: RemediationAction): Promise<RemediationResult>;
  validate(finding: DiagnosticFinding, action: RemediationAction): Promise<ValidationResult>;
  rollback(attempt: RemediationAttempt): Promise<RollbackResult>;
}

export interface RemediationResult {
  success: boolean;
  attempt: RemediationAttempt;
  output?: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  estimatedImpact?: {
    affectedUsers: number;
    downtime: number;
    riskScore: number;
  };
}

export interface RollbackResult {
  success: boolean;
  restoredState?: any;
  error?: string;
}

// Diagnostic Report
export interface DiagnosticReport {
  id: string;
  scanId: string;
  systemId: string;
  generatedAt: Date;
  
  // Summary
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    remediatedFindings: number;
    healthScore: number; // 0-100
  };
  
  // Detailed findings
  findings: DiagnosticFinding[];
  
  // Trends
  trends?: {
    findingsOverTime: Array<{ date: Date; count: number }>;
    severityDistribution: Record<DiagnosticSeverity, number>;
    categoryDistribution: Record<DiagnosticCategory, number>;
    topIssues: Array<{ ruleId: string; count: number }>;
  };
  
  // Recommendations
  recommendations: Array<{
    priority: number;
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
  }>;
}

// Plugin Interface
export interface DiagnosticPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  
  // Plugin capabilities
  rules?: DiagnosticRule[];
  scanners?: DiagnosticScanner[];
  remediationActions?: RemediationAction[];
  
  // Lifecycle
  install(): Promise<void>;
  uninstall(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}