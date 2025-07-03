import { DiagnosticRule } from '../../types';

// Performance Rules
import { 
  highCpuUsageRule, 
  criticalCpuUsageRule 
} from './performance/cpu-usage-rules';

import { 
  slowQueryRule, 
  connectionPoolExhaustedRule, 
  lowCacheHitRateRule 
} from './performance/database-rules';

// Security Rules
import { 
  weakPasswordPolicyRule, 
  defaultAccountActiveRule, 
  inactiveUsersRule, 
  failedLoginAttemptsRule 
} from './security/authentication-rules';

import { 
  auditDisabledRule, 
  shortAuditRetentionRule 
} from './security/audit-rules';

// Configuration Rules
import { 
  lowQueryTimeoutRule, 
  sessionTimeoutRule 
} from './configuration/timeout-rules';

import { 
  dbMaintenanceDisabledRule, 
  backupNotConfiguredRule, 
  indexMaintenanceRule 
} from './configuration/maintenance-rules';

// Export all rules as an array
export const builtInRules: DiagnosticRule[] = [
  // Performance Rules
  highCpuUsageRule,
  criticalCpuUsageRule,
  slowQueryRule,
  connectionPoolExhaustedRule,
  lowCacheHitRateRule,
  
  // Security Rules
  weakPasswordPolicyRule,
  defaultAccountActiveRule,
  inactiveUsersRule,
  failedLoginAttemptsRule,
  auditDisabledRule,
  shortAuditRetentionRule,
  
  // Configuration Rules
  lowQueryTimeoutRule,
  sessionTimeoutRule,
  dbMaintenanceDisabledRule,
  backupNotConfiguredRule,
  indexMaintenanceRule
];

// Export rules by category
export const performanceRules: DiagnosticRule[] = [
  highCpuUsageRule,
  criticalCpuUsageRule,
  slowQueryRule,
  connectionPoolExhaustedRule,
  lowCacheHitRateRule
];

export const securityRules: DiagnosticRule[] = [
  weakPasswordPolicyRule,
  defaultAccountActiveRule,
  inactiveUsersRule,
  failedLoginAttemptsRule,
  auditDisabledRule,
  shortAuditRetentionRule
];

export const configurationRules: DiagnosticRule[] = [
  lowQueryTimeoutRule,
  sessionTimeoutRule,
  dbMaintenanceDisabledRule,
  backupNotConfiguredRule,
  indexMaintenanceRule
];

// Helper function to get rules by category
export function getRulesByCategory(category: string): DiagnosticRule[] {
  switch (category) {
    case 'performance':
      return performanceRules;
    case 'security':
      return securityRules;
    case 'configuration':
      return configurationRules;
    default:
      return [];
  }
}

// Helper function to get rule by ID
export function getRuleById(id: string): DiagnosticRule | undefined {
  return builtInRules.find(rule => rule.id === id);
}