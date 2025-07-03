import { RuleBuilder, RemediationBuilder } from '../../rule-builder';

// High CPU Usage Rule
export const highCpuUsageRule = RuleBuilder.performanceRule('perf-cpu-usage')
  .name('High CPU Usage')
  .description('CPU usage is above recommended threshold')
  .severity('high')
  .supportedVersions('*')
  .tags('cpu', 'performance', 'resource')
  .whenThreshold('performance.cpuUsage', 'greater_than', 80, 80, '%')
  .autoRemediate()
  .remediate(
    RemediationBuilder.updateConfig('perf-cpu-remediate-cache')
      .name('Clear System Cache')
      .description('Clear system cache to reduce CPU load')
      .action('clear_cache')
      .riskLevel('low')
      .estimatedDuration(10)
      .build()
  )
  .remediate(
    RemediationBuilder.restartService('perf-cpu-remediate-service')
      .name('Restart Background Service')
      .description('Restart background processing service to clear stuck processes')
      .action('restart_service')
      .riskLevel('medium')
      .requiresApproval()
      .requiresDowntime()
      .estimatedDuration(60)
      .rollback('start_service')
      .build()
  )
  .build();

// Critical CPU Usage Rule
export const criticalCpuUsageRule = RuleBuilder.performanceRule('perf-cpu-critical')
  .name('Critical CPU Usage')
  .description('CPU usage is critically high and affecting system performance')
  .severity('critical')
  .supportedVersions('*')
  .tags('cpu', 'performance', 'critical')
  .whenThreshold('performance.cpuUsage', 'greater_than', 95, 95, '%')
  .config({
    alertThreshold: 95,
    measurementPeriod: 300, // 5 minutes
    consecutiveChecks: 3
  })
  .build();