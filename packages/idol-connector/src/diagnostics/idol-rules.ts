import { RuleBuilder } from '@cm-diagnostics/diagnostics';

// IDOL Performance Rules
export const idolHighQueryLatencyRule = RuleBuilder.performanceRule('idol-high-query-latency')
  .name('IDOL High Query Latency')
  .description('IDOL query response time exceeds acceptable threshold')
  .severity('high')
  .category('performance')
  .whenThreshold('idol.metrics.averageQueryTime', 'greater_than', 2000, 90, 'ms')
  .thenRecommend([
    'Check IDOL server resource utilization',
    'Review query complexity and optimize if needed',
    'Consider adding more IDOL query servers',
    'Check network latency between CM and IDOL'
  ])
  .autoRemediate()
  .build();

export const idolIndexingBacklogRule = RuleBuilder.performanceRule('idol-indexing-backlog')
  .name('IDOL Indexing Backlog')
  .description('Large number of documents pending indexing')
  .severity('medium')
  .category('performance')
  .whenThreshold('idol.queue.pendingDocuments', 'greater_than', 10000, 80, 'documents')
  .thenRecommend([
    'Increase indexing batch size',
    'Add more IDOL index servers',
    'Check for indexing errors',
    'Review document processing pipeline'
  ])
  .build();

export const idolMemoryUsageRule = RuleBuilder.performanceRule('idol-high-memory')
  .name('IDOL High Memory Usage')
  .description('IDOL server memory usage is critically high')
  .severity('critical')
  .category('performance')
  .whenThreshold('idol.performance.memoryUsage', 'greater_than', 90, 85, '%')
  .thenRecommend([
    'Increase IDOL server memory allocation',
    'Review and optimize IDOL configuration',
    'Consider database compaction',
    'Check for memory leaks'
  ])
  .autoRemediate()
  .build();

// IDOL Availability Rules
export const idolConnectionFailureRule = RuleBuilder.connectivityRule('idol-connection-failure')
  .name('IDOL Connection Failure')
  .description('Unable to connect to IDOL server')
  .severity('critical')
  .category('connectivity')
  .whenCondition((context) => !context.idol?.isConnected)
  .thenRecommend([
    'Check IDOL server status',
    'Verify network connectivity',
    'Check IDOL service is running',
    'Validate connection credentials'
  ])
  .build();

export const idolDatabaseOfflineRule = RuleBuilder.availabilityRule('idol-database-offline')
  .name('IDOL Database Offline')
  .description('One or more IDOL databases are offline')
  .severity('high')
  .category('availability')
  .whenCondition((context) => {
    const databases = context.idol?.databases || [];
    return databases.some(db => db.status === 'offline');
  })
  .thenRecommend([
    'Check IDOL database status',
    'Review IDOL error logs',
    'Restart affected databases',
    'Check disk space availability'
  ])
  .build();

// IDOL Configuration Rules
export const idolSuboptimalCacheRule = RuleBuilder.configurationRule('idol-cache-config')
  .name('IDOL Suboptimal Cache Configuration')
  .description('IDOL cache hit rate is below optimal levels')
  .severity('medium')
  .category('configuration')
  .whenThreshold('idol.metrics.cacheHitRate', 'less_than', 60, 70, '%')
  .thenRecommend([
    'Increase IDOL cache size',
    'Review cache eviction policy',
    'Analyze query patterns',
    'Consider implementing query result caching'
  ])
  .build();

export const idolSecurityMisconfigurationRule = RuleBuilder.securityRule('idol-security-config')
  .name('IDOL Security Misconfiguration')
  .description('IDOL security settings are not properly configured')
  .severity('high')
  .category('security')
  .whenCondition((context) => {
    const config = context.idol?.config;
    return !config?.ssl?.enabled || !config?.authentication?.enabled;
  })
  .thenRecommend([
    'Enable SSL/TLS for IDOL connections',
    'Configure proper authentication',
    'Review IDOL security documentation',
    'Implement access control lists'
  ])
  .build();

// IDOL Data Quality Rules
export const idolDuplicateContentRule = RuleBuilder.dataRule('idol-duplicate-content')
  .name('IDOL Duplicate Content Detection')
  .description('High percentage of duplicate content in IDOL')
  .severity('medium')
  .category('data-quality')
  .whenThreshold('idol.analysis.duplicatePercentage', 'greater_than', 20, 15, '%')
  .thenRecommend([
    'Implement deduplication in indexing pipeline',
    'Review content sources for duplicates',
    'Use IDOL deduplication features',
    'Clean up existing duplicates'
  ])
  .build();

export const idolStaleContentRule = RuleBuilder.dataRule('idol-stale-content')
  .name('IDOL Stale Content')
  .description('Significant amount of outdated content in IDOL')
  .severity('low')
  .category('data-quality')
  .whenCondition((context) => {
    const stats = context.idol?.contentStats;
    if (!stats) return false;
    const staleThreshold = new Date();
    staleThreshold.setFullYear(staleThreshold.getFullYear() - 2);
    return stats.documentsOlderThan > stats.totalDocuments * 0.3;
  })
  .thenRecommend([
    'Implement content retention policies',
    'Archive or remove outdated content',
    'Update content refresh schedules',
    'Review content lifecycle management'
  ])
  .build();

// IDOL Integration Rules
export const cmIdolSyncDelayRule = RuleBuilder.integrationRule('cm-idol-sync-delay')
  .name('CM to IDOL Sync Delay')
  .description('Content synchronization between CM and IDOL is delayed')
  .severity('medium')
  .category('integration')
  .whenThreshold('idol.sync.averageDelay', 'greater_than', 300, 240, 'seconds')
  .thenRecommend([
    'Check sync job status',
    'Review sync batch sizes',
    'Optimize sync queries',
    'Check for sync errors'
  ])
  .build();

export const idolContentMismatchRule = RuleBuilder.integrationRule('idol-content-mismatch')
  .name('IDOL Content Mismatch')
  .description('Content count mismatch between CM and IDOL')
  .severity('high')
  .category('integration')
  .whenCondition((context) => {
    const cmCount = context.cm?.documentCount || 0;
    const idolCount = context.idol?.documentCount || 0;
    const difference = Math.abs(cmCount - idolCount);
    return difference > cmCount * 0.05; // More than 5% difference
  })
  .thenRecommend([
    'Run full content reconciliation',
    'Check for sync failures',
    'Verify deletion sync',
    'Review sync filters and rules'
  ])
  .autoRemediate()
  .build();

// IDOL Analytics Rules
export const idolAnalyticsErrorRule = RuleBuilder.functionalRule('idol-analytics-error')
  .name('IDOL Analytics Processing Errors')
  .description('High rate of analytics processing failures')
  .severity('medium')
  .category('functionality')
  .whenThreshold('idol.analytics.errorRate', 'greater_than', 5, 3, '%')
  .thenRecommend([
    'Check analytics configuration',
    'Review error logs for patterns',
    'Verify language pack installation',
    'Check analytics server resources'
  ])
  .build();

export const idolLowAnalyticsCoverageRule = RuleBuilder.functionalRule('idol-analytics-coverage')
  .name('Low IDOL Analytics Coverage')
  .description('Many documents lack analytics metadata')
  .severity('low')
  .category('functionality')
  .whenThreshold('idol.analytics.coveragePercentage', 'less_than', 80, 85, '%')
  .thenRecommend([
    'Enable analytics for more content types',
    'Review analytics pipeline configuration',
    'Check for processing bottlenecks',
    'Consider batch reprocessing'
  ])
  .build();

// Export all rules as a collection
export const idolDiagnosticRules = [
  // Performance
  idolHighQueryLatencyRule,
  idolIndexingBacklogRule,
  idolMemoryUsageRule,
  
  // Availability
  idolConnectionFailureRule,
  idolDatabaseOfflineRule,
  
  // Configuration
  idolSuboptimalCacheRule,
  idolSecurityMisconfigurationRule,
  
  // Data Quality
  idolDuplicateContentRule,
  idolStaleContentRule,
  
  // Integration
  cmIdolSyncDelayRule,
  idolContentMismatchRule,
  
  // Analytics
  idolAnalyticsErrorRule,
  idolLowAnalyticsCoverageRule
];

// Rule categories for organization
export const idolRuleCategories = {
  performance: [
    idolHighQueryLatencyRule,
    idolIndexingBacklogRule,
    idolMemoryUsageRule
  ],
  availability: [
    idolConnectionFailureRule,
    idolDatabaseOfflineRule
  ],
  configuration: [
    idolSuboptimalCacheRule,
    idolSecurityMisconfigurationRule
  ],
  dataQuality: [
    idolDuplicateContentRule,
    idolStaleContentRule
  ],
  integration: [
    cmIdolSyncDelayRule,
    idolContentMismatchRule
  ],
  analytics: [
    idolAnalyticsErrorRule,
    idolLowAnalyticsCoverageRule
  ]
};