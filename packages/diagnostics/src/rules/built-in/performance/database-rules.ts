import { RuleBuilder, RemediationBuilder } from '../../rule-builder';

// Slow Query Rule
export const slowQueryRule = RuleBuilder.performanceRule('perf-slow-queries')
  .name('Slow Database Queries Detected')
  .description('Database queries are taking longer than acceptable threshold')
  .severity('medium')
  .supportedVersions('*')
  .tags('database', 'query', 'performance')
  .whenThreshold('queries.avgQueryTime', 'greater_than', 1000, 1000, 'ms')
  .remediate(
    RemediationBuilder.updateConfig('perf-query-timeout')
      .name('Optimize Query Timeout')
      .description('Increase query timeout to prevent premature terminations')
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
  .remediate(
    RemediationBuilder.updateConfig('perf-rebuild-indexes')
      .name('Rebuild Database Indexes')
      .description('Rebuild fragmented indexes to improve query performance')
      .action('rebuild_indexes')
      .riskLevel('medium')
      .requiresApproval()
      .estimatedDuration(1800) // 30 minutes
      .build()
  )
  .build();

// Connection Pool Exhaustion Rule
export const connectionPoolExhaustedRule = RuleBuilder.performanceRule('perf-connection-pool')
  .name('Database Connection Pool Exhausted')
  .description('Available database connections are running low')
  .severity('high')
  .supportedVersions('*')
  .tags('database', 'connection', 'pool')
  .when('database.connectionPool.active', 'greater_than', 90)
  .when('database.connectionPool.waiting', 'greater_than', 5)
  .remediate(
    RemediationBuilder.updateConfig('perf-pool-size')
      .name('Increase Connection Pool Size')
      .description('Increase the maximum connection pool size')
      .action('update_configuration')
      .parameters({
        setting: 'max_pool_size',
        value: 200,
        oldValue: 100
      })
      .riskLevel('low')
      .estimatedDuration(10)
      .postCondition({
        field: 'database.connectionPool.total',
        operator: 'greater_than',
        value: 150
      })
      .build()
  )
  .build();

// Low Cache Hit Rate Rule
export const lowCacheHitRateRule = RuleBuilder.performanceRule('perf-cache-hit-rate')
  .name('Low Database Cache Hit Rate')
  .description('Database cache hit rate is below optimal levels')
  .severity('medium')
  .supportedVersions('*')
  .tags('database', 'cache', 'performance')
  .when('database.cache.hitRate', 'less_than', 85)
  .remediate(
    RemediationBuilder.updateConfig('perf-cache-size')
      .name('Increase Cache Size')
      .description('Increase database cache size for better performance')
      .action('update_configuration')
      .parameters({
        setting: 'cache_size_mb',
        value: 2048,
        oldValue: 1024
      })
      .riskLevel('low')
      .estimatedDuration(30)
      .build()
  )
  .build();