import { RuleBuilder, RemediationBuilder } from '../../rule-builder';

// Audit Disabled Rule
export const auditDisabledRule = RuleBuilder.securityRule('sec-audit-disabled')
  .name('Security Audit Logging Disabled')
  .description('Security audit logging is not enabled, preventing detection of security incidents')
  .severity('high')
  .supportedVersions('*')
  .tags('security', 'audit', 'compliance')
  .when('security.audit.enabled', 'equals', false)
  .remediate(
    RemediationBuilder.updateConfig('sec-enable-audit')
      .name('Enable Security Audit Logging')
      .description('Enable comprehensive security audit logging')
      .action('update_configuration')
      .parameters({
        settings: {
          audit_enabled: true,
          audit_level: 'DETAILED',
          audit_retention_days: 90,
          audit_failed_logins: true,
          audit_permission_changes: true,
          audit_data_access: true
        }
      })
      .riskLevel('low')
      .estimatedDuration(10)
      .build()
  )
  .build();

// Short Audit Retention Rule
export const shortAuditRetentionRule = RuleBuilder.complianceRule('sec-audit-retention')
  .name('Insufficient Audit Log Retention')
  .description('Audit logs are not retained long enough for compliance requirements')
  .severity('medium')
  .supportedVersions('*')
  .tags('security', 'audit', 'compliance')
  .when('security.audit.retentionDays', 'less_than', 90)
  .remediate(
    RemediationBuilder.updateConfig('sec-audit-retention')
      .name('Increase Audit Retention Period')
      .description('Increase audit log retention to meet compliance requirements')
      .action('update_configuration')
      .parameters({
        setting: 'audit_retention_days',
        value: 365,
        oldValue: 30
      })
      .riskLevel('low')
      .estimatedDuration(5)
      .build()
  )
  .build();