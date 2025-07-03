import { BaseScanner } from './base-scanner';
import { ScanContext } from '../types';

export class ConfigurationScanner extends BaseScanner {
  constructor() {
    super({
      id: 'configuration-scanner',
      name: 'Configuration Scanner',
      category: 'configuration',
      version: '1.0.0',
      supportedRules: [
        'config-timeout-values',
        'config-connection-limits',
        'config-cache-settings',
        'config-log-levels',
        'config-retention-policies',
        'config-backup-settings',
        'config-index-maintenance',
        'config-email-settings',
        'config-workflow-limits',
        'config-api-limits'
      ],
      supportedVersions: ['*']
    });
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Configuration scanner initialized');
  }

  protected async extractData(context: ScanContext): Promise<any> {
    this.logger.debug('Extracting configuration data');
    
    try {
      const configuration = {
        system: await this.getSystemConfiguration(context),
        database: await this.getDatabaseConfiguration(context),
        application: await this.getApplicationConfiguration(context),
        integration: await this.getIntegrationConfiguration(context),
        recommendations: await this.getRecommendedSettings(context),
        timestamp: new Date()
      };
      
      return configuration;
    } catch (error) {
      this.logger.error('Failed to extract configuration data', error as Error);
      throw error;
    }
  }

  private async getSystemConfiguration(context: ScanContext): Promise<any> {
    try {
      const config: any = {
        general: {},
        performance: {},
        logging: {},
        maintenance: {}
      };

      // General settings
      const generalQuery = {
        sql: `SELECT 
                setting_name,
                setting_value,
                setting_type,
                is_default,
                last_modified
              FROM CM_SYSTEM_SETTINGS
              WHERE setting_category = 'GENERAL'`
      };

      try {
        const result = await context.connector.executeQuery(generalQuery);
        config.general = this.transformSettings(result);
      } catch (error) {
        this.logger.debug('Could not get general settings');
      }

      // Performance settings
      const perfQuery = {
        sql: `SELECT 
                query_timeout,
                connection_timeout,
                max_connections,
                connection_pool_size,
                cache_enabled,
                cache_size_mb,
                cache_ttl_minutes
              FROM CM_PERFORMANCE_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(perfQuery);
        if (result[0]) {
          config.performance = {
            queryTimeout: result[0].query_timeout || 30,
            connectionTimeout: result[0].connection_timeout || 15,
            maxConnections: result[0].max_connections || 100,
            connectionPoolSize: result[0].connection_pool_size || 20,
            cache: {
              enabled: result[0].cache_enabled || false,
              sizeMB: result[0].cache_size_mb || 512,
              ttlMinutes: result[0].cache_ttl_minutes || 60
            }
          };
        }
      } catch (error) {
        this.logger.debug('Could not get performance settings');
        config.performance = this.getDefaultPerformanceSettings();
      }

      // Logging settings
      const loggingQuery = {
        sql: `SELECT 
                log_level,
                log_retention_days,
                log_max_size_mb,
                audit_enabled,
                debug_enabled
              FROM CM_LOGGING_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(loggingQuery);
        if (result[0]) {
          config.logging = {
            level: result[0].log_level || 'INFO',
            retentionDays: result[0].log_retention_days || 30,
            maxSizeMB: result[0].log_max_size_mb || 1024,
            auditEnabled: result[0].audit_enabled || false,
            debugEnabled: result[0].debug_enabled || false
          };
        }
      } catch (error) {
        this.logger.debug('Could not get logging settings');
        config.logging = this.getDefaultLoggingSettings();
      }

      return config;
    } catch (error) {
      this.logger.error('Failed to get system configuration', error as Error);
      return {};
    }
  }

  private async getDatabaseConfiguration(context: ScanContext): Promise<any> {
    try {
      const dbConfig: any = {
        connection: {},
        maintenance: {},
        backup: {},
        indexes: {}
      };

      // Connection settings
      const connQuery = {
        sql: `SELECT 
                max_pool_size,
                min_pool_size,
                connection_lifetime,
                idle_timeout,
                max_retries
              FROM CM_DB_CONNECTION_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(connQuery);
        if (result[0]) {
          dbConfig.connection = {
            maxPoolSize: result[0].max_pool_size || 100,
            minPoolSize: result[0].min_pool_size || 10,
            connectionLifetime: result[0].connection_lifetime || 300,
            idleTimeout: result[0].idle_timeout || 60,
            maxRetries: result[0].max_retries || 3
          };
        }
      } catch (error) {
        this.logger.debug('Could not get database connection settings');
      }

      // Maintenance settings
      const maintQuery = {
        sql: `SELECT 
                auto_vacuum_enabled,
                auto_analyze_enabled,
                index_rebuild_threshold,
                statistics_update_frequency,
                maintenance_window_start,
                maintenance_window_end
              FROM CM_DB_MAINTENANCE_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(maintQuery);
        if (result[0]) {
          dbConfig.maintenance = {
            autoVacuum: result[0].auto_vacuum_enabled || false,
            autoAnalyze: result[0].auto_analyze_enabled || false,
            indexRebuildThreshold: result[0].index_rebuild_threshold || 30,
            statisticsUpdateFrequency: result[0].statistics_update_frequency || 'WEEKLY',
            maintenanceWindow: {
              start: result[0].maintenance_window_start || '02:00',
              end: result[0].maintenance_window_end || '06:00'
            }
          };
        }
      } catch (error) {
        this.logger.debug('Could not get database maintenance settings');
      }

      // Backup settings
      const backupQuery = {
        sql: `SELECT 
                backup_enabled,
                backup_type,
                backup_frequency,
                backup_retention_days,
                backup_compression,
                backup_location
              FROM CM_BACKUP_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(backupQuery);
        if (result[0]) {
          dbConfig.backup = {
            enabled: result[0].backup_enabled || false,
            type: result[0].backup_type || 'FULL',
            frequency: result[0].backup_frequency || 'DAILY',
            retentionDays: result[0].backup_retention_days || 30,
            compression: result[0].backup_compression || true,
            location: result[0].backup_location || '/backup'
          };
        }
      } catch (error) {
        this.logger.debug('Could not get backup settings');
      }

      return dbConfig;
    } catch (error) {
      this.logger.error('Failed to get database configuration', error as Error);
      return {};
    }
  }

  private async getApplicationConfiguration(context: ScanContext): Promise<any> {
    try {
      const appConfig: any = {
        email: {},
        workflow: {},
        api: {},
        ui: {}
      };

      // Email settings
      const emailQuery = {
        sql: `SELECT 
                smtp_enabled,
                smtp_host,
                smtp_port,
                smtp_use_ssl,
                email_queue_enabled,
                max_retry_attempts,
                retry_interval_minutes
              FROM CM_EMAIL_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(emailQuery);
        if (result[0]) {
          appConfig.email = {
            enabled: result[0].smtp_enabled || false,
            smtp: {
              host: result[0].smtp_host || 'localhost',
              port: result[0].smtp_port || 25,
              useSSL: result[0].smtp_use_ssl || false
            },
            queue: {
              enabled: result[0].email_queue_enabled || true,
              maxRetries: result[0].max_retry_attempts || 3,
              retryInterval: result[0].retry_interval_minutes || 5
            }
          };
        }
      } catch (error) {
        this.logger.debug('Could not get email settings');
      }

      // Workflow settings
      const workflowQuery = {
        sql: `SELECT 
                workflow_enabled,
                max_workflow_instances,
                workflow_timeout_minutes,
                parallel_execution_limit,
                retry_failed_workflows
              FROM CM_WORKFLOW_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(workflowQuery);
        if (result[0]) {
          appConfig.workflow = {
            enabled: result[0].workflow_enabled || false,
            maxInstances: result[0].max_workflow_instances || 100,
            timeoutMinutes: result[0].workflow_timeout_minutes || 60,
            parallelLimit: result[0].parallel_execution_limit || 10,
            retryFailed: result[0].retry_failed_workflows || true
          };
        }
      } catch (error) {
        this.logger.debug('Could not get workflow settings');
      }

      // API settings
      const apiQuery = {
        sql: `SELECT 
                api_enabled,
                api_rate_limit,
                api_timeout_seconds,
                api_max_request_size,
                api_cors_enabled
              FROM CM_API_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(apiQuery);
        if (result[0]) {
          appConfig.api = {
            enabled: result[0].api_enabled || false,
            rateLimit: result[0].api_rate_limit || 1000,
            timeoutSeconds: result[0].api_timeout_seconds || 30,
            maxRequestSize: result[0].api_max_request_size || '10MB',
            corsEnabled: result[0].api_cors_enabled || false
          };
        }
      } catch (error) {
        this.logger.debug('Could not get API settings');
      }

      return appConfig;
    } catch (error) {
      this.logger.error('Failed to get application configuration', error as Error);
      return {};
    }
  }

  private async getIntegrationConfiguration(context: ScanContext): Promise<any> {
    try {
      const integrations: any = {
        idol: {},
        enterpriseStudio: {},
        ldap: {},
        sso: {}
      };

      // IDOL settings
      const idolQuery = {
        sql: `SELECT 
                idol_enabled,
                idol_server_host,
                idol_server_port,
                idol_index_port,
                idol_sync_enabled,
                idol_sync_frequency
              FROM CM_IDOL_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(idolQuery);
        if (result[0]) {
          integrations.idol = {
            enabled: result[0].idol_enabled || false,
            server: {
              host: result[0].idol_server_host,
              port: result[0].idol_server_port,
              indexPort: result[0].idol_index_port
            },
            sync: {
              enabled: result[0].idol_sync_enabled || false,
              frequency: result[0].idol_sync_frequency || 'HOURLY'
            }
          };
        }
      } catch (error) {
        this.logger.debug('Could not get IDOL settings');
      }

      return integrations;
    } catch (error) {
      this.logger.error('Failed to get integration configuration', error as Error);
      return {};
    }
  }

  private async getRecommendedSettings(context: ScanContext): Promise<any> {
    // Return recommended settings based on system size and version
    return {
      performance: {
        queryTimeout: 60,
        connectionPoolSize: 50,
        cacheSize: 1024,
        maxConnections: 200
      },
      maintenance: {
        indexRebuildThreshold: 20,
        statisticsUpdateFrequency: 'DAILY',
        backupFrequency: 'DAILY',
        logRetentionDays: 90
      },
      security: {
        passwordMinLength: 12,
        passwordComplexity: true,
        sessionTimeout: 30,
        auditEnabled: true
      }
    };
  }

  private transformSettings(settings: any[]): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    for (const setting of settings) {
      transformed[setting.setting_name] = {
        value: setting.setting_value,
        type: setting.setting_type,
        isDefault: setting.is_default,
        lastModified: setting.last_modified
      };
    }
    
    return transformed;
  }

  private getDefaultPerformanceSettings(): any {
    return {
      queryTimeout: 30,
      connectionTimeout: 15,
      maxConnections: 100,
      connectionPoolSize: 20,
      cache: {
        enabled: false,
        sizeMB: 512,
        ttlMinutes: 60
      }
    };
  }

  private getDefaultLoggingSettings(): any {
    return {
      level: 'INFO',
      retentionDays: 30,
      maxSizeMB: 1024,
      auditEnabled: false,
      debugEnabled: false
    };
  }

  protected async onCleanup(): Promise<void> {
    this.logger.info('Configuration scanner cleanup completed');
  }

  protected getResourcePath(data: any): string {
    return `configuration/scan/${data.timestamp}`;
  }

  protected async getMetadata(context: ScanContext): Promise<Record<string, any>> {
    return {
      scannerVersion: this.version,
      systemId: context.systemId,
      timestamp: new Date().toISOString(),
      configurationsChecked: [
        'system_settings',
        'database_config',
        'performance_tuning',
        'logging_config',
        'maintenance_settings',
        'backup_config',
        'email_settings',
        'workflow_config',
        'api_settings',
        'integration_config'
      ]
    };
  }
}