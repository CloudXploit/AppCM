import { BaseScanner, ScanContext, Finding } from '@cm-diagnostics/diagnostics';
import { IDOLConnector, IDOLStatus } from '../types';
import { IDOLSearchService } from '../queries/search-service';
import { IDOLAnalyticsService } from '../analytics/analytics-service';

export interface IDOLScanContext extends ScanContext {
  idolConnector: IDOLConnector;
  idolSearchService: IDOLSearchService;
  idolAnalyticsService: IDOLAnalyticsService;
}

export class IDOLPerformanceScanner extends BaseScanner<IDOLScanContext> {
  name = 'IDOL Performance Scanner';
  description = 'Scans IDOL server performance metrics';

  async scan(context: IDOLScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
      // Get IDOL status and metrics
      const status = await context.idolConnector.getStatus();
      const metrics = context.idolConnector.getMetrics();
      
      // Check query performance
      if (metrics.averageQueryTime > 2000) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-high-query-latency',
          severity: 'high',
          category: 'performance',
          title: 'High IDOL Query Latency',
          description: `Average query time is ${metrics.averageQueryTime}ms, exceeding threshold of 2000ms`,
          evidence: {
            averageQueryTime: metrics.averageQueryTime,
            totalQueries: metrics.totalQueries
          },
          impact: 'Users experiencing slow search results',
          recommendation: 'Optimize queries or scale IDOL infrastructure'
        });
      }
      
      // Check memory usage
      if (status.performance?.memoryUsage && status.performance.memoryUsage > 90) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-high-memory',
          severity: 'critical',
          category: 'performance',
          title: 'Critical IDOL Memory Usage',
          description: `IDOL server memory usage at ${status.performance.memoryUsage}%`,
          evidence: {
            memoryUsage: status.performance.memoryUsage,
            cpuUsage: status.performance.cpuUsage
          },
          impact: 'Risk of server crashes and performance degradation',
          recommendation: 'Increase memory allocation or optimize IDOL configuration'
        });
      }
      
      // Check indexing performance
      if (metrics.averageIndexTime > 5000) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-slow-indexing',
          severity: 'medium',
          category: 'performance',
          title: 'Slow IDOL Indexing Performance',
          description: `Average indexing time is ${metrics.averageIndexTime}ms`,
          evidence: {
            averageIndexTime: metrics.averageIndexTime,
            totalIndexOperations: metrics.totalIndexOperations
          },
          impact: 'Content updates delayed in search results',
          recommendation: 'Review indexing configuration and batch sizes'
        });
      }
      
      // Check cache performance
      if (metrics.cacheHitRate < 60) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-cache-config',
          severity: 'medium',
          category: 'configuration',
          title: 'Low IDOL Cache Hit Rate',
          description: `Cache hit rate is ${metrics.cacheHitRate.toFixed(2)}%, below optimal threshold`,
          evidence: {
            cacheHitRate: metrics.cacheHitRate
          },
          impact: 'Increased query processing time',
          recommendation: 'Increase cache size or review cache configuration'
        });
      }
      
    } catch (error) {
      findings.push({
        id: this.generateFindingId(),
        ruleId: 'idol-scan-error',
        severity: 'high',
        category: 'availability',
        title: 'IDOL Performance Scan Failed',
        description: `Failed to complete performance scan: ${error}`,
        evidence: { error: String(error) },
        impact: 'Unable to assess IDOL performance',
        recommendation: 'Check IDOL connectivity and permissions'
      });
    }
    
    return findings;
  }
}

export class IDOLContentScanner extends BaseScanner<IDOLScanContext> {
  name = 'IDOL Content Scanner';
  description = 'Scans IDOL content quality and integrity';

  async scan(context: IDOLScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
      // Get databases
      const databases = await context.idolConnector.getDatabases();
      
      // Check each database
      for (const db of databases) {
        // Check for empty databases
        if (db.documents === 0 && !db.internal) {
          findings.push({
            id: this.generateFindingId(),
            ruleId: 'idol-empty-database',
            severity: 'low',
            category: 'data-quality',
            title: `Empty IDOL Database: ${db.name}`,
            description: `Database ${db.name} contains no documents`,
            evidence: { database: db },
            impact: 'No content available for search in this database',
            recommendation: 'Verify content synchronization or remove unused database'
          });
        }
        
        // Check database size
        if (db.size > 100 * 1024 * 1024 * 1024) { // 100GB
          findings.push({
            id: this.generateFindingId(),
            ruleId: 'idol-large-database',
            severity: 'medium',
            category: 'performance',
            title: `Large IDOL Database: ${db.name}`,
            description: `Database ${db.name} is ${(db.size / 1024 / 1024 / 1024).toFixed(2)}GB`,
            evidence: { database: db },
            impact: 'May impact query and maintenance performance',
            recommendation: 'Consider partitioning or archiving old content'
          });
        }
      }
      
      // Check for duplicates (sample check)
      const duplicateCheck = await this.checkDuplicates(context);
      if (duplicateCheck.duplicatePercentage > 20) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-duplicate-content',
          severity: 'medium',
          category: 'data-quality',
          title: 'High Duplicate Content in IDOL',
          description: `Approximately ${duplicateCheck.duplicatePercentage.toFixed(1)}% duplicate content detected`,
          evidence: duplicateCheck,
          impact: 'Wasted storage and confusing search results',
          recommendation: 'Implement deduplication in content pipeline'
        });
      }
      
      // Check content freshness
      const freshnessCheck = await this.checkContentFreshness(context);
      if (freshnessCheck.stalePercentage > 30) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-stale-content',
          severity: 'low',
          category: 'data-quality',
          title: 'Stale Content in IDOL',
          description: `${freshnessCheck.stalePercentage.toFixed(1)}% of content is older than 2 years`,
          evidence: freshnessCheck,
          impact: 'Outdated information in search results',
          recommendation: 'Implement content retention policies'
        });
      }
      
    } catch (error) {
      findings.push({
        id: this.generateFindingId(),
        ruleId: 'idol-content-scan-error',
        severity: 'medium',
        category: 'error',
        title: 'IDOL Content Scan Failed',
        description: `Failed to complete content scan: ${error}`,
        evidence: { error: String(error) },
        impact: 'Unable to assess content quality',
        recommendation: 'Check IDOL permissions and connectivity'
      });
    }
    
    return findings;
  }

  private async checkDuplicates(context: IDOLScanContext): Promise<any> {
    // Sample implementation - would need more sophisticated duplicate detection
    const sampleSize = 1000;
    const searchResult = await context.idolSearchService.search('*', {
      limit: sampleSize,
      fields: ['DRECONTENT', 'DRETITLE']
    });
    
    const contentHashes = new Set<string>();
    let duplicates = 0;
    
    for (const doc of searchResult.documents) {
      const hash = this.simpleHash(doc.title + doc.content);
      if (contentHashes.has(hash)) {
        duplicates++;
      } else {
        contentHashes.add(hash);
      }
    }
    
    return {
      sampledDocuments: sampleSize,
      duplicatesFound: duplicates,
      duplicatePercentage: (duplicates / sampleSize) * 100
    };
  }

  private async checkContentFreshness(context: IDOLScanContext): Promise<any> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    // Query for old content
    const oldContent = await context.idolSearchService.searchWithFieldText(
      '*',
      (builder) => {
        builder.dateBefore('date_modified', twoYearsAgo);
      },
      { limit: 1 }
    );
    
    const totalContent = await context.idolSearchService.search('*', { limit: 1 });
    
    return {
      totalDocuments: totalContent.totalResults,
      staleDocuments: oldContent.totalResults,
      stalePercentage: (oldContent.totalResults / totalContent.totalResults) * 100,
      cutoffDate: twoYearsAgo
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

export class IDOLIntegrationScanner extends BaseScanner<IDOLScanContext> {
  name = 'IDOL Integration Scanner';
  description = 'Scans CM to IDOL integration health';

  async scan(context: IDOLScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
      // Check connection status
      if (!context.idolConnector.isConnected()) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-connection-failure',
          severity: 'critical',
          category: 'connectivity',
          title: 'IDOL Connection Failed',
          description: 'Unable to establish connection to IDOL server',
          evidence: { connected: false },
          impact: 'Search functionality unavailable',
          recommendation: 'Check IDOL server status and network connectivity'
        });
        return findings; // Can't continue without connection
      }
      
      // Check content synchronization
      const syncStatus = await this.checkSyncStatus(context);
      if (syncStatus.delayMinutes > 5) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'cm-idol-sync-delay',
          severity: 'medium',
          category: 'integration',
          title: 'CM to IDOL Sync Delayed',
          description: `Content sync is ${syncStatus.delayMinutes} minutes behind`,
          evidence: syncStatus,
          impact: 'New or updated content not appearing in search',
          recommendation: 'Check sync job status and performance'
        });
      }
      
      // Check for sync errors
      if (syncStatus.errorRate > 5) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-sync-errors',
          severity: 'high',
          category: 'integration',
          title: 'High IDOL Sync Error Rate',
          description: `${syncStatus.errorRate.toFixed(1)}% of sync operations failing`,
          evidence: syncStatus,
          impact: 'Content missing from search results',
          recommendation: 'Review sync error logs and fix issues'
        });
      }
      
      // Check content count mismatch
      const countComparison = await this.compareContentCounts(context);
      if (Math.abs(countComparison.difference) > countComparison.cmCount * 0.05) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: 'idol-content-mismatch',
          severity: 'high',
          category: 'integration',
          title: 'Content Count Mismatch',
          description: `IDOL has ${Math.abs(countComparison.difference)} ${countComparison.difference > 0 ? 'more' : 'fewer'} documents than CM`,
          evidence: countComparison,
          impact: 'Search results incomplete or showing deleted content',
          recommendation: 'Run full content reconciliation'
        });
      }
      
    } catch (error) {
      findings.push({
        id: this.generateFindingId(),
        ruleId: 'idol-integration-scan-error',
        severity: 'medium',
        category: 'error',
        title: 'IDOL Integration Scan Failed',
        description: `Failed to complete integration scan: ${error}`,
        evidence: { error: String(error) },
        impact: 'Unable to assess integration health',
        recommendation: 'Check scanner permissions and connectivity'
      });
    }
    
    return findings;
  }

  private async checkSyncStatus(context: IDOLScanContext): Promise<any> {
    // This would check actual sync job status
    // For now, return mock data
    return {
      lastSyncTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      delayMinutes: 10,
      pendingDocuments: 250,
      errorRate: 2.5,
      successRate: 97.5
    };
  }

  private async compareContentCounts(context: IDOLScanContext): Promise<any> {
    // Get CM document count (this would come from CM connector)
    const cmCount = context.system?.documentCount || 10000;
    
    // Get IDOL document count
    const idolResult = await context.idolSearchService.search('*', { limit: 1 });
    const idolCount = idolResult.totalResults;
    
    return {
      cmCount,
      idolCount,
      difference: idolCount - cmCount,
      percentageDifference: ((idolCount - cmCount) / cmCount) * 100
    };
  }
}

// Export scanner collection
export const idolScanners = [
  IDOLPerformanceScanner,
  IDOLContentScanner,
  IDOLIntegrationScanner
];