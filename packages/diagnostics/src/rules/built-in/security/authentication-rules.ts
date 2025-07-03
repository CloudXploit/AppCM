import { RuleBuilder, RemediationBuilder } from '../../rule-builder';

// Weak Password Policy Rule
export const weakPasswordPolicyRule = RuleBuilder.securityRule('sec-weak-passwords')
  .name('Weak Password Policy Detected')
  .description('Password policy does not meet security standards')
  .severity('high')
  .supportedVersions('*')
  .tags('security', 'password', 'authentication')
  .when('security.configuration.passwordPolicy.minLength', 'less_than', 12)
  .when('security.configuration.passwordPolicy.complexityEnabled', 'equals', false)
  .remediate(
    RemediationBuilder.updateConfig('sec-password-policy')
      .name('Strengthen Password Policy')
      .description('Update password policy to meet security standards')
      .action('update_configuration')
      .parameters({
        settings: {
          password_min_length: 12,
          password_complexity_enabled: true,
          password_history_count: 5,
          password_expiry_days: 90
        }
      })
      .riskLevel('low')
      .estimatedDuration(10)
      .build()
  )
  .build();

// Default Account Active Rule
export const defaultAccountActiveRule = RuleBuilder.securityRule('sec-default-accounts')
  .name('Default Account Active')
  .description('Default system account is still active and may have default credentials')
  .severity('critical')
  .supportedVersions('*')
  .tags('security', 'account', 'vulnerability')
  .when('security.vulnerabilities[0].type', 'equals', 'default_credentials')
  .remediate(
    RemediationBuilder.updateConfig('sec-disable-default')
      .name('Disable Default Account')
      .description('Disable the default account to prevent unauthorized access')
      .action('disable_account')
      .riskLevel('low')
      .estimatedDuration(5)
      .build()
  )
  .build();

// Inactive Users Rule
export const inactiveUsersRule = RuleBuilder.securityRule('sec-inactive-users')
  .name('Inactive Users with Active Access')
  .description('Users who have not logged in recently still have active access')
  .severity('medium')
  .supportedVersions('*')
  .tags('security', 'users', 'access')
  .when('security.vulnerabilities[0].type', 'equals', 'inactive_user')
  .schedule('daily')
  .remediate(
    RemediationBuilder.updateConfig('sec-disable-inactive')
      .name('Disable Inactive Users')
      .description('Disable users who have been inactive for more than 90 days')
      .action('disable_inactive_users')
      .parameters({
        inactiveDays: 90,
        excludeSystemAccounts: true
      })
      .riskLevel('medium')
      .requiresApproval()
      .estimatedDuration(60)
      .build()
  )
  .build();

// Failed Login Attempts Rule
export const failedLoginAttemptsRule = RuleBuilder.securityRule('sec-failed-logins')
  .name('Excessive Failed Login Attempts')
  .description('Multiple failed login attempts detected from same source')
  .severity('high')
  .supportedVersions('*')
  .tags('security', 'authentication', 'attack')
  .when('security.audit.failedLogins.length', 'greater_than', 10)
  .config({
    timeWindow: 3600, // 1 hour
    threshold: 10,
    uniqueIPs: false
  })
  .remediate(
    RemediationBuilder.updateConfig('sec-lockout-policy')
      .name('Enable Account Lockout')
      .description('Enable automatic account lockout after failed attempts')
      .action('update_configuration')
      .parameters({
        setting: 'account_lockout_threshold',
        value: 5,
        oldValue: 0
      })
      .riskLevel('low')
      .estimatedDuration(5)
      .build()
  )
  .build();