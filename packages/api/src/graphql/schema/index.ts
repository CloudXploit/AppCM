import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar Date
  scalar JSON

  # Enums
  enum DiagnosticSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum DiagnosticCategory {
    PERFORMANCE
    SECURITY
    CONFIGURATION
    DATA_INTEGRITY
    COMPLIANCE
    AVAILABILITY
    COMPATIBILITY
  }

  enum DiagnosticStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }

  enum RemediationStatus {
    PENDING
    APPROVED
    EXECUTING
    COMPLETED
    FAILED
    ROLLED_BACK
  }

  enum ConnectionType {
    DIRECT_DB
    REST_API
    SOAP_API
  }

  enum DatabaseType {
    SQLSERVER
    ORACLE
  }

  enum UserRole {
    ADMIN
    ANALYST
    VIEWER
  }

  # Input Types
  input ConnectionConfigInput {
    type: ConnectionType!
    host: String
    port: Int
    database: String
    username: String!
    password: String!
    databaseType: DatabaseType
    baseUrl: String
    encrypted: Boolean
    options: JSON
  }

  input ScanOptionsInput {
    name: String
    rules: [String!]
    categories: [DiagnosticCategory!]
    scheduleExpression: String
  }

  input RemediationOptionsInput {
    dryRun: Boolean
    requireApproval: Boolean
    comment: String
  }

  input PaginationInput {
    page: Int
    limit: Int
    sortBy: String
    sortOrder: String
  }

  input DateRangeInput {
    start: Date!
    end: Date!
  }

  # Types
  type User {
    id: ID!
    username: String!
    email: String!
    role: UserRole!
    createdAt: Date!
    lastLogin: Date
    preferences: JSON
  }

  type CMSystem {
    id: ID!
    name: String!
    version: String!
    edition: String!
    database: DatabaseInfo!
    features: [String!]!
    modules: [String!]!
    lastConnected: Date
    health: SystemHealth!
    connection: ConnectionStatus!
  }

  type DatabaseInfo {
    type: DatabaseType!
    version: String!
    name: String!
    server: String!
  }

  type SystemHealth {
    status: String!
    lastCheck: Date!
    issues: Int!
    score: Float!
  }

  type ConnectionStatus {
    connected: Boolean!
    lastError: String
    latency: Int
  }

  type DiagnosticScan {
    id: ID!
    name: String!
    systemId: String!
    system: CMSystem!
    status: DiagnosticStatus!
    progress: Float!
    rules: [String!]!
    categories: [DiagnosticCategory!]
    startedAt: Date
    completedAt: Date
    duration: Int
    findingsCount: FindingsCount!
    findings: [DiagnosticFinding!]!
    triggeredBy: String!
    triggerType: String!
  }

  type FindingsCount {
    total: Int!
    bySeverity: SeverityCount!
    byCategory: CategoryCount!
  }

  type SeverityCount {
    low: Int!
    medium: Int!
    high: Int!
    critical: Int!
  }

  type CategoryCount {
    performance: Int!
    security: Int!
    configuration: Int!
    dataIntegrity: Int!
    compliance: Int!
    availability: Int!
    compatibility: Int!
  }

  type DiagnosticFinding {
    id: ID!
    ruleId: String!
    ruleName: String!
    category: DiagnosticCategory!
    severity: DiagnosticSeverity!
    title: String!
    description: String!
    impact: String!
    recommendation: String!
    systemId: String!
    component: String!
    resourcePath: String
    evidence: Evidence!
    detectedAt: Date!
    lastSeenAt: Date!
    occurrenceCount: Int!
    remediable: Boolean!
    remediationActions: [RemediationAction!]
    remediationHistory: [RemediationAttempt!]
    acknowledged: Boolean!
    acknowledgedBy: String
    acknowledgedAt: Date
    resolved: Boolean!
    resolvedAt: Date
    resolvedBy: String
    falsePositive: Boolean!
  }

  type Evidence {
    actual: JSON!
    expected: JSON!
    difference: JSON
    metadata: JSON
  }

  type RemediationAction {
    id: ID!
    name: String!
    description: String!
    type: String!
    action: String!
    parameters: JSON
    riskLevel: String!
    requiresApproval: Boolean!
    requiresDowntime: Boolean!
    estimatedDuration: Int!
    canRollback: Boolean!
  }

  type RemediationAttempt {
    id: ID!
    findingId: String!
    actionId: String!
    status: RemediationStatus!
    startedAt: Date!
    completedAt: Date
    executedBy: String!
    approvedBy: String
    success: Boolean!
    output: String
    error: String
    changesMade: JSON
    rolledBack: Boolean!
    rollbackAt: Date
    rollbackReason: String
  }

  type DiagnosticRule {
    id: ID!
    name: String!
    description: String!
    category: DiagnosticCategory!
    severity: DiagnosticSeverity!
    enabled: Boolean!
    version: String!
    supportedVersions: [String!]!
    tags: [String!]!
    config: JSON
    autoRemediate: Boolean!
    schedule: RuleSchedule
  }

  type RuleSchedule {
    frequency: String!
    cronExpression: String
  }

  type DiagnosticReport {
    id: ID!
    scanId: String!
    systemId: String!
    generatedAt: Date!
    summary: ReportSummary!
    findings: [DiagnosticFinding!]!
    trends: ReportTrends
    recommendations: [Recommendation!]!
  }

  type ReportSummary {
    totalFindings: Int!
    criticalFindings: Int!
    highFindings: Int!
    mediumFindings: Int!
    lowFindings: Int!
    remediatedFindings: Int!
    healthScore: Float!
  }

  type ReportTrends {
    findingsOverTime: [TimeSeriesData!]!
    severityDistribution: JSON!
    categoryDistribution: JSON!
    topIssues: [TopIssue!]!
  }

  type TimeSeriesData {
    date: Date!
    value: Float!
  }

  type TopIssue {
    ruleId: String!
    ruleName: String!
    count: Int!
  }

  type Recommendation {
    priority: Int!
    title: String!
    description: String!
    impact: String!
    effort: String!
  }

  type Statistics {
    totalScans: Int!
    totalFindings: Int!
    totalRemediations: Int!
    averageScanDuration: Float!
    healthScoreTrend: [TimeSeriesData!]!
    topFindings: [TopIssue!]!
  }

  type AuthPayload {
    token: String!
    user: User!
    expiresIn: Int!
  }

  # Queries
  type Query {
    # Authentication
    me: User

    # Systems
    systems: [CMSystem!]!
    system(id: ID!): CMSystem
    testConnection(config: ConnectionConfigInput!): ConnectionStatus!

    # Diagnostics
    scans(systemId: String, status: DiagnosticStatus, pagination: PaginationInput): [DiagnosticScan!]!
    scan(id: ID!): DiagnosticScan
    findings(
      scanId: String
      systemId: String
      severity: DiagnosticSeverity
      category: DiagnosticCategory
      resolved: Boolean
      pagination: PaginationInput
    ): [DiagnosticFinding!]!
    finding(id: ID!): DiagnosticFinding

    # Rules
    rules(category: DiagnosticCategory, enabled: Boolean): [DiagnosticRule!]!
    rule(id: ID!): DiagnosticRule

    # Reports
    reports(systemId: String!, dateRange: DateRangeInput): [DiagnosticReport!]!
    report(id: ID!): DiagnosticReport
    generateReport(scanId: String!): DiagnosticReport!

    # Statistics
    statistics(systemId: String, dateRange: DateRangeInput): Statistics!
  }

  # Mutations
  type Mutation {
    # Authentication
    login(username: String!, password: String!): AuthPayload!
    logout: Boolean!
    changePassword(oldPassword: String!, newPassword: String!): Boolean!

    # Systems
    addSystem(name: String!, config: ConnectionConfigInput!): CMSystem!
    updateSystem(id: ID!, name: String, config: ConnectionConfigInput): CMSystem!
    removeSystem(id: ID!): Boolean!

    # Diagnostics
    createScan(systemId: String!, options: ScanOptionsInput!): DiagnosticScan!
    cancelScan(id: ID!): DiagnosticScan!
    acknowledgeFinding(id: ID!, comment: String): DiagnosticFinding!
    markFindingResolved(id: ID!, comment: String): DiagnosticFinding!
    markFindingFalsePositive(id: ID!, reason: String!): DiagnosticFinding!

    # Remediation
    executeRemediation(
      findingId: String!
      actionId: String!
      options: RemediationOptionsInput
    ): RemediationAttempt!
    approveRemediation(attemptId: String!): RemediationAttempt!
    rollbackRemediation(attemptId: String!, reason: String!): RemediationAttempt!

    # Rules
    updateRule(id: ID!, enabled: Boolean, config: JSON): DiagnosticRule!
    createCustomRule(input: JSON!): DiagnosticRule!

    # User Management
    updatePreferences(preferences: JSON!): User!
  }

  # Subscriptions
  type Subscription {
    # Scan updates
    scanProgress(scanId: String!): DiagnosticScan!
    scanCompleted(systemId: String): DiagnosticScan!

    # Finding alerts
    newFinding(systemId: String, severity: DiagnosticSeverity): DiagnosticFinding!
    findingUpdated(findingId: String!): DiagnosticFinding!

    # Remediation updates
    remediationProgress(attemptId: String!): RemediationAttempt!
    remediationCompleted(systemId: String): RemediationAttempt!

    # System health
    systemHealthChanged(systemId: String!): CMSystem!
  }
`;