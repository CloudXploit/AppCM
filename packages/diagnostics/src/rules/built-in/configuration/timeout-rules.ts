import { RuleBuilder, RemediationBuilder } from '../../rule-builder';

// Low Query Timeout Rule
export const lowQueryTimeoutRule = RuleBuilder.configurationRule('config-timeout-values')
  .name('Query Timeout Too Low')
  .description('Database query timeout is set too low, causing premature query terminations')
  .severity('medium')
  .supportedVersions('*')
  .tags('configuration', 'database', 'timeout')
  .when('system.performance.queryTimeout', 'less_than', 60)
  .remediate(
    RemediationBuilder.updateConfig('config-query-timeout')
      .name('Increase Query Timeout')
      .description('Increase query timeout to recommended value')
      .action('update_configuration')
      .parameters({
        setting: 'query_timeout',
        value: 60,
        oldValue: 30
      })
      .riskLevel('low')
      .estimatedDuration(5)
      .build()
  )
  .build();

// Session Timeout Rule
export const sessionTimeoutRule = RuleBuilder.configurationRule('config-session-timeout')
  .name('Session Timeout Configuration')
  .description('User session timeout may not be optimal for security and usability')
  .severity('low')
  .supportedVersions('*')
  .tags('configuration', 'security', 'session')
  .when('security.authentication.sessionTimeout', 'greater_than', 60)
  .remediate(
    RemediationBuilder.updateConfig('config-session-timeout')
      .name('Optimize Session Timeout')
      .description('Set session timeout to balance security and usability')
      .action('update_configuration')
      .parameters({
        setting: 'session_timeout_minutes',
        value: 30,
        oldValue: 120
      })
      .riskLevel('low')
      .estimatedDuration(5)
      .build()
  )
  .build();