import { BaseScanner } from './base-scanner';
import { ScanContext } from '../types';
import { SystemExtractor } from '@cm-diagnostics/cm-connector';

export class PerformanceScanner extends BaseScanner {
  constructor() {
    super({
      id: 'performance-scanner',
      name: 'Performance Scanner',
      category: 'performance',
      version: '1.0.0',
      supportedRules: [
        'perf-cpu-usage',
        'perf-memory-usage',
        'perf-disk-io',
        'perf-query-time',
        'perf-connection-pool',
        'perf-cache-hit-rate',
        'perf-response-time',
        'perf-queue-depth'
      ],
      supportedVersions: ['*']
    });
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Performance scanner initialized');
  }

  protected async extractData(context: ScanContext): Promise<any> {
    this.logger.debug('Extracting performance data');
    
    try {
      // Use the system extractor to get performance metrics
      const systemExtractor = new SystemExtractor(
        context.connector,
        context.connector.adapter
      );
      
      const systemData = await systemExtractor.extract();
      
      // Get additional performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(context);
      const databaseMetrics = await this.getDatabaseMetrics(context);
      const queryMetrics = await this.getQueryMetrics(context);
      
      return {
        system: systemData,
        performance: {
          ...systemData.performance,
          ...performanceMetrics
        },
        database: databaseMetrics,
        queries: queryMetrics,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to extract performance data', error as Error);
      throw error;
    }
  }

  private async getPerformanceMetrics(context: ScanContext): Promise<any> {
    try {
      // Get real-time performance metrics
      const queries = [
        // CPU usage from system
        {
          sql: `SELECT 
                  cpu_percent,
                  memory_percent,
                  disk_read_bytes_sec,
                  disk_write_bytes_sec
                FROM sys.dm_os_performance_counters
                WHERE counter_name IN ('CPU usage %', 'Memory usage %')`,
          fallback: { cpu_percent: 0, memory_percent: 0 }
        },
        // Active sessions
        {
          sql: `SELECT COUNT(*) as active_sessions 
                FROM sys.dm_exec_sessions 
                WHERE is_user_process = 1`,
          fallback: { active_sessions: 0 }
        },
        // Blocked processes
        {
          sql: `SELECT COUNT(*) as blocked_processes 
                FROM sys.dm_exec_requests 
                WHERE blocking_session_id > 0`,
          fallback: { blocked_processes: 0 }
        }
      ];

      const results: any = {};
      
      for (const query of queries) {
        try {
          const result = await context.connector.executeQuery(query);
          Object.assign(results, result[0] || query.fallback);
        } catch (error) {
          this.logger.warn('Performance query failed, using fallback', { 
            error: (error as Error).message 
          });
          Object.assign(results, query.fallback);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to get performance metrics', error as Error);
      return {};
    }
  }

  private async getDatabaseMetrics(context: ScanContext): Promise<any> {
    try {
      const metrics = {
        connectionPool: {
          total: 0,
          active: 0,
          idle: 0,
          waiting: 0
        },
        cache: {
          hitRate: 0,
          size: 0,
          evictions: 0
        },
        io: {
          readsPerSec: 0,
          writesPerSec: 0,
          avgReadLatency: 0,
          avgWriteLatency: 0
        }
      };

      // Get connection pool stats
      const poolQuery = {
        sql: `SELECT 
                COUNT(*) as total_connections,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_connections,
                SUM(CASE WHEN status = 'idle' THEN 1 ELSE 0 END) as idle_connections
              FROM sys.dm_exec_connections`
      };

      try {
        const poolResult = await context.connector.executeQuery(poolQuery);
        if (poolResult[0]) {
          metrics.connectionPool = {
            total: poolResult[0].total_connections || 0,
            active: poolResult[0].active_connections || 0,
            idle: poolResult[0].idle_connections || 0,
            waiting: 0
          };
        }
      } catch (error) {
        this.logger.debug('Could not get connection pool metrics');
      }

      // Get cache statistics
      const cacheQuery = {
        sql: `SELECT 
                cache_hit_ratio,
                cache_size_mb,
                cache_evictions_per_sec
              FROM sys.dm_os_memory_cache_counters`
      };

      try {
        const cacheResult = await context.connector.executeQuery(cacheQuery);
        if (cacheResult[0]) {
          metrics.cache = {
            hitRate: cacheResult[0].cache_hit_ratio || 0,
            size: cacheResult[0].cache_size_mb || 0,
            evictions: cacheResult[0].cache_evictions_per_sec || 0
          };
        }
      } catch (error) {
        this.logger.debug('Could not get cache metrics');
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get database metrics', error as Error);
      return {};
    }
  }

  private async getQueryMetrics(context: ScanContext): Promise<any> {
    try {
      // Get slow queries
      const slowQueryThreshold = 1000; // 1 second
      
      const slowQueries = {
        sql: `SELECT TOP 10
                query_text,
                execution_count,
                avg_duration_ms,
                max_duration_ms,
                total_cpu_time_ms,
                total_logical_reads
              FROM sys.dm_exec_query_stats
              CROSS APPLY sys.dm_exec_sql_text(sql_handle)
              WHERE avg_duration_ms > ${slowQueryThreshold}
              ORDER BY avg_duration_ms DESC`
      };

      try {
        const result = await context.connector.executeQuery(slowQueries);
        return {
          slowQueries: result,
          slowQueryCount: result.length,
          avgQueryTime: result.reduce((sum: number, q: any) => sum + q.avg_duration_ms, 0) / result.length || 0
        };
      } catch (error) {
        this.logger.debug('Could not get query metrics');
        return {
          slowQueries: [],
          slowQueryCount: 0,
          avgQueryTime: 0
        };
      }
    } catch (error) {
      this.logger.error('Failed to get query metrics', error as Error);
      return {};
    }
  }

  protected async onCleanup(): Promise<void> {
    this.logger.info('Performance scanner cleanup completed');
  }

  protected getResourcePath(data: any): string {
    return `system/performance/${data.timestamp}`;
  }

  protected async getMetadata(context: ScanContext): Promise<Record<string, any>> {
    return {
      scannerVersion: this.version,
      systemId: context.systemId,
      timestamp: new Date().toISOString(),
      metricsCollected: [
        'cpu_usage',
        'memory_usage',
        'disk_io',
        'connection_pool',
        'cache_stats',
        'query_performance'
      ]
    };
  }
}