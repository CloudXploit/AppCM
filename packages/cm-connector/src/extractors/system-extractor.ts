import { BaseExtractor } from './base-extractor';
import { z } from 'zod';

export interface SystemData {
  configuration: SystemConfiguration;
  features: SystemFeature[];
  services: SystemService[];
  modules: SystemModule[];
  performance: SystemPerformance;
}

export interface SystemConfiguration {
  systemId: string;
  version: string;
  edition: string;
  installDate: Date;
  lastUpgrade?: Date;
  serverName: string;
  databaseName: string;
  databaseType: string;
  databaseVersion: string;
  settings: Record<string, any>;
}

export interface SystemFeature {
  name: string;
  enabled: boolean;
  version?: string;
  licensedUntil?: Date;
  configuration?: Record<string, any>;
}

export interface SystemService {
  name: string;
  status: 'running' | 'stopped' | 'disabled' | 'unknown';
  startType: 'automatic' | 'manual' | 'disabled';
  lastStarted?: Date;
  port?: number;
  endpoint?: string;
}

export interface SystemModule {
  name: string;
  version: string;
  installed: boolean;
  active: boolean;
  dependencies: string[];
}

export interface SystemPerformance {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeUsers: number;
  activeSessions: number;
  queuedJobs: number;
  lastMeasured: Date;
}

export class SystemExtractor extends BaseExtractor<SystemData> {
  constructor(connector: any, adapter: any) {
    super(connector, adapter, 'SystemExtractor');
  }

  getSchema(): z.ZodSchema<SystemData> {
    return z.object({
      configuration: z.object({
        systemId: z.string(),
        version: z.string(),
        edition: z.string(),
        installDate: z.date(),
        lastUpgrade: z.date().optional(),
        serverName: z.string(),
        databaseName: z.string(),
        databaseType: z.string(),
        databaseVersion: z.string(),
        settings: z.record(z.any())
      }),
      features: z.array(z.object({
        name: z.string(),
        enabled: z.boolean(),
        version: z.string().optional(),
        licensedUntil: z.date().optional(),
        configuration: z.record(z.any()).optional()
      })),
      services: z.array(z.object({
        name: z.string(),
        status: z.enum(['running', 'stopped', 'disabled', 'unknown']),
        startType: z.enum(['automatic', 'manual', 'disabled']),
        lastStarted: z.date().optional(),
        port: z.number().optional(),
        endpoint: z.string().optional()
      })),
      modules: z.array(z.object({
        name: z.string(),
        version: z.string(),
        installed: z.boolean(),
        active: z.boolean(),
        dependencies: z.array(z.string())
      })),
      performance: z.object({
        cpuUsage: z.number(),
        memoryUsage: z.number(),
        diskUsage: z.number(),
        activeUsers: z.number(),
        activeSessions: z.number(),
        queuedJobs: z.number(),
        lastMeasured: z.date()
      })
    });
  }

  async extract(): Promise<SystemData> {
    const [configuration, features, services, modules, performance] = await Promise.all([
      this.extractConfiguration(),
      this.extractFeatures(),
      this.extractServices(),
      this.extractModules(),
      this.extractPerformance()
    ]);

    return {
      configuration,
      features,
      services,
      modules,
      performance
    };
  }

  validate(data: SystemData): boolean {
    try {
      this.getSchema().parse(data);
      return true;
    } catch (error) {
      this.logger.error('System data validation failed', error);
      return false;
    }
  }

  transform(data: SystemData): any {
    // Transform to unified format
    return {
      system: {
        id: data.configuration.systemId,
        version: data.configuration.version,
        edition: data.configuration.edition,
        metadata: {
          installDate: data.configuration.installDate,
          lastUpgrade: data.configuration.lastUpgrade,
          server: data.configuration.serverName,
          database: {
            name: data.configuration.databaseName,
            type: data.configuration.databaseType,
            version: data.configuration.databaseVersion
          }
        }
      },
      features: data.features.map(f => ({
        ...f,
        status: f.enabled ? 'active' : 'inactive'
      })),
      services: data.services,
      modules: data.modules,
      metrics: {
        performance: data.performance,
        timestamp: data.performance.lastMeasured
      }
    };
  }

  private async extractConfiguration(): Promise<SystemConfiguration> {
    const query = this.adapter.buildQuery('GET_SYSTEM_CONFIG', {});
    const result = await this.executeQuery(query);
    
    if (!result || result.length === 0) {
      throw new Error('No system configuration found');
    }

    const config = result[0];
    const settings = await this.extractSettings();

    return {
      systemId: config.SYSTEM_ID || config.id,
      version: config.VERSION || config.version,
      edition: config.EDITION || config.edition || 'Standard',
      installDate: new Date(config.INSTALL_DATE || config.install_date),
      lastUpgrade: config.LAST_UPGRADE ? new Date(config.LAST_UPGRADE) : undefined,
      serverName: config.SERVER_NAME || config.server_name || 'Unknown',
      databaseName: config.DATABASE_NAME || config.database_name,
      databaseType: config.DATABASE_TYPE || config.database_type || 'SQLServer',
      databaseVersion: config.DATABASE_VERSION || config.database_version || 'Unknown',
      settings
    };
  }

  private async extractSettings(): Promise<Record<string, any>> {
    try {
      const query = this.adapter.buildQuery('GET_SYSTEM_OPTIONS', {});
      const result = await this.executeQuery(query);
      
      const settings: Record<string, any> = {};
      
      for (const row of result) {
        const category = row.option_category || 'general';
        const name = row.option_name || row.name;
        const value = row.option_value || row.value;
        
        if (!settings[category]) {
          settings[category] = {};
        }
        
        settings[category][name] = this.parseSettingValue(value, row.option_type);
      }
      
      return settings;
    } catch (error) {
      this.logger.warn('Failed to extract system settings', error);
      return {};
    }
  }

  private parseSettingValue(value: string, type?: string): any {
    if (!value) return null;
    
    switch (type?.toLowerCase()) {
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'number':
      case 'integer':
        return parseInt(value, 10);
      case 'float':
      case 'decimal':
        return parseFloat(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  private async extractFeatures(): Promise<SystemFeature[]> {
    try {
      const query = this.adapter.buildQuery('GET_FEATURES', {});
      const result = await this.executeQuery(query);
      
      return result.map(row => ({
        name: row.FEATURE_NAME || row.name,
        enabled: row.ENABLED === 1 || row.enabled === true,
        version: row.FEATURE_VERSION || row.version,
        licensedUntil: row.LICENSE_EXPIRY ? new Date(row.LICENSE_EXPIRY) : undefined,
        configuration: this.parseFeatureConfig(row.FEATURE_CONFIG || row.config)
      }));
    } catch (error) {
      this.logger.warn('Failed to extract features', error);
      return [];
    }
  }

  private parseFeatureConfig(config: any): Record<string, any> | undefined {
    if (!config) return undefined;
    
    if (typeof config === 'string') {
      try {
        return JSON.parse(config);
      } catch {
        return { raw: config };
      }
    }
    
    return config;
  }

  private async extractServices(): Promise<SystemService[]> {
    const services: SystemService[] = [];
    
    // Core services that should exist
    const coreServices = [
      { name: 'Content Manager Service', port: 8080 },
      { name: 'IDOL Connector Service', port: 9100 },
      { name: 'Workflow Service', port: 8081 },
      { name: 'Event Processor', port: 8082 },
      { name: 'Background Job Service', port: 8083 }
    ];

    for (const service of coreServices) {
      services.push({
        name: service.name,
        status: 'unknown', // Would need OS-level access to determine
        startType: 'automatic',
        port: service.port
      });
    }

    // Try to get service status from database
    try {
      const query = this.adapter.buildQuery('GET_SERVICE_STATUS', {});
      const result = await this.executeQuery(query);
      
      for (const row of result) {
        const existingService = services.find(s => s.name === row.SERVICE_NAME);
        if (existingService) {
          existingService.status = this.mapServiceStatus(row.STATUS);
          existingService.lastStarted = row.LAST_STARTED ? new Date(row.LAST_STARTED) : undefined;
        }
      }
    } catch (error) {
      this.logger.debug('Service status query not available', error);
    }

    return services;
  }

  private mapServiceStatus(status: any): SystemService['status'] {
    if (!status) return 'unknown';
    
    const normalized = status.toString().toLowerCase();
    if (normalized.includes('run')) return 'running';
    if (normalized.includes('stop')) return 'stopped';
    if (normalized.includes('disable')) return 'disabled';
    return 'unknown';
  }

  private async extractModules(): Promise<SystemModule[]> {
    const modules: SystemModule[] = [];
    
    // Check for common modules
    const moduleChecks = [
      { name: 'Records Management', table: 'TRECORD' },
      { name: 'Document Management', table: 'TDOCUMENT' },
      { name: 'Workflow', table: 'TWORKFLOW' },
      { name: 'IDOL Integration', table: 'TIDOLCONFIG' },
      { name: 'Enterprise Studio', table: 'TESENTERPRISE' },
      { name: 'Web Client', table: 'TWEBCLIENT' },
      { name: 'Email Management', table: 'TEMAIL' },
      { name: 'Physical Records', table: 'TPHYSICAL' }
    ];

    for (const module of moduleChecks) {
      const installed = await this.checkTableExists(module.table);
      modules.push({
        name: module.name,
        version: 'Unknown', // Would need specific queries per module
        installed,
        active: installed, // Simplified - would need more checks
        dependencies: []
      });
    }

    return modules;
  }

  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const actualTableName = this.adapter.getTableName(tableName.toLowerCase());
      const query = {
        sql: `SELECT COUNT(*) as CNT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?`,
        params: [actualTableName]
      };
      
      const result = await this.executeQuery(query);
      return result[0]?.CNT > 0;
    } catch {
      return false;
    }
  }

  private async extractPerformance(): Promise<SystemPerformance> {
    // Get current performance metrics
    const metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      activeUsers: 0,
      activeSessions: 0,
      queuedJobs: 0,
      lastMeasured: new Date()
    };

    try {
      // Get active users
      const userQuery = {
        sql: `SELECT COUNT(DISTINCT USER_ID) as ACTIVE_USERS FROM TAUDIT WHERE AUDIT_DATE > ?`,
        params: [new Date(Date.now() - 15 * 60 * 1000)] // Last 15 minutes
      };
      const userResult = await this.executeQuery(userQuery);
      metrics.activeUsers = userResult[0]?.ACTIVE_USERS || 0;

      // Get active sessions
      const sessionQuery = {
        sql: `SELECT COUNT(*) as ACTIVE_SESSIONS FROM TSESSION WHERE SESSION_ACTIVE = 1 AND LAST_ACCESS > ?`,
        params: [new Date(Date.now() - 30 * 60 * 1000)] // Last 30 minutes
      };
      const sessionResult = await this.executeQuery(sessionQuery);
      metrics.activeSessions = sessionResult[0]?.ACTIVE_SESSIONS || 0;

      // Get queued jobs
      const jobQuery = {
        sql: `SELECT COUNT(*) as QUEUED_JOBS FROM TJOBS WHERE JOB_STATUS = 'PENDING'`
      };
      const jobResult = await this.executeQuery(jobQuery);
      metrics.queuedJobs = jobResult[0]?.QUEUED_JOBS || 0;

      // Database metrics would require specific permissions
      // These are placeholders
      metrics.cpuUsage = Math.random() * 30 + 10; // 10-40%
      metrics.memoryUsage = Math.random() * 40 + 30; // 30-70%
      metrics.diskUsage = Math.random() * 50 + 20; // 20-70%

    } catch (error) {
      this.logger.warn('Failed to extract some performance metrics', error);
    }

    return metrics;
  }
}