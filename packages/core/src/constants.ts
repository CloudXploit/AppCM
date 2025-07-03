// Application constants

export const APP_NAME = 'CM Diagnostics';
export const APP_VERSION = '1.0.0';

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
};

export const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
} as const;

export const SCAN_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const FINDING_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const;

export const REMEDIATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  APPLIED: 'applied',
  FAILED: 'failed',
} as const;

export const CM_VERSIONS = {
  '10.x': { min: '10.0', max: '10.99' },
  '16.x': { min: '16.0', max: '16.99' },
  '20.x': { min: '20.0', max: '20.99' },
  '22.x': { min: '22.0', max: '22.99' },
  '23.x': { min: '23.0', max: '23.99' },
} as const;

export const DIAGNOSTIC_CATEGORIES = {
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  CONFIGURATION: 'configuration',
  COMPLIANCE: 'compliance',
  AVAILABILITY: 'availability',
} as const;

export const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH001',
  AUTH_TOKEN_EXPIRED: 'AUTH002',
  AUTH_TOKEN_INVALID: 'AUTH003',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH004',
  
  // Validation
  VALIDATION_FAILED: 'VAL001',
  VALIDATION_REQUIRED_FIELD: 'VAL002',
  VALIDATION_INVALID_FORMAT: 'VAL003',
  
  // System
  SYSTEM_NOT_FOUND: 'SYS001',
  SYSTEM_CONNECTION_FAILED: 'SYS002',
  SYSTEM_INCOMPATIBLE_VERSION: 'SYS003',
  
  // Diagnostic
  DIAGNOSTIC_SCAN_FAILED: 'DIAG001',
  DIAGNOSTIC_RULE_ERROR: 'DIAG002',
  DIAGNOSTIC_REMEDIATION_FAILED: 'DIAG003',
  
  // General
  INTERNAL_SERVER_ERROR: 'GEN001',
  RESOURCE_NOT_FOUND: 'GEN002',
  OPERATION_TIMEOUT: 'GEN003',
} as const;