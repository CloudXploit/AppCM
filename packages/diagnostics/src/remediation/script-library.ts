import type { RemediationAction, RemediationContext } from '../types';

export interface RemediationScript {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiredParams: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    description: string;
    required: boolean;
    default?: any;
  }>;
  preConditions: string[];
  postConditions: string[];
  estimatedDuration: number; // in seconds
  execute: (context: RemediationContext, params: any) => Promise<any>;
  validate: (params: any) => { valid: boolean; errors?: string[] };
  generateRollbackData: (context: RemediationContext, params: any) => Promise<any>;
}

export class RemediationScriptLibrary {
  private scripts: Map<string, RemediationScript> = new Map();

  constructor() {
    this.registerBuiltInScripts();
  }

  private registerBuiltInScripts() {
    // Configuration Management Scripts
    this.register({
      id: 'update_timeout_settings',
      name: 'Update Timeout Settings',
      description: 'Updates various timeout configurations to optimal values',
      category: 'configuration',
      riskLevel: 'low',
      requiredParams: [
        {
          name: 'timeoutType',
          type: 'string',
          description: 'Type of timeout to update (session, connection, query)',
          required: true
        },
        {
          name: 'value',
          type: 'number',
          description: 'New timeout value in seconds',
          required: true
        }
      ],
      preConditions: [
        'System is not under high load',
        'No active user sessions will be affected'
      ],
      postConditions: [
        'Timeout setting is updated',
        'Configuration is persisted'
      ],
      estimatedDuration: 5,
      execute: async (context, params) => {
        const { timeoutType, value } = params;
        const config = await context.getConfiguration();
        const oldValue = config[`${timeoutType}Timeout`];
        
        config[`${timeoutType}Timeout`] = value;
        await context.updateConfiguration(config);
        
        return { oldValue, newValue: value };
      },
      validate: (params) => {
        const errors: string[] = [];
        if (!['session', 'connection', 'query'].includes(params.timeoutType)) {
          errors.push('Invalid timeout type');
        }
        if (params.value < 0 || params.value > 3600) {
          errors.push('Timeout value must be between 0 and 3600 seconds');
        }
        return { valid: errors.length === 0, errors };
      },
      generateRollbackData: async (context, params) => {
        const config = await context.getConfiguration();
        return { 
          timeoutType: params.timeoutType,
          originalValue: config[`${params.timeoutType}Timeout`]
        };
      }
    });

    this.register({
      id: 'optimize_cache_settings',
      name: 'Optimize Cache Settings',
      description: 'Adjusts cache size and TTL for better performance',
      category: 'performance',
      riskLevel: 'medium',
      requiredParams: [
        {
          name: 'cacheType',
          type: 'string',
          description: 'Type of cache to optimize',
          required: true
        },
        {
          name: 'size',
          type: 'number',
          description: 'New cache size in MB',
          required: false,
          default: 'auto'
        },
        {
          name: 'ttl',
          type: 'number',
          description: 'Time to live in seconds',
          required: false,
          default: 3600
        }
      ],
      preConditions: [
        'Sufficient memory available',
        'Cache service is running'
      ],
      postConditions: [
        'Cache configuration updated',
        'Cache cleared and reinitialized'
      ],
      estimatedDuration: 30,
      execute: async (context, params) => {
        const cacheConfig = await context.getCacheConfiguration(params.cacheType);
        const oldConfig = { ...cacheConfig };
        
        if (params.size !== 'auto') {
          cacheConfig.maxSize = params.size * 1024 * 1024; // Convert MB to bytes
        } else {
          // Auto-calculate based on available memory
          const systemInfo = await context.getSystemInfo();
          cacheConfig.maxSize = Math.floor(systemInfo.freeMemory * 0.25);
        }
        
        cacheConfig.ttl = params.ttl;
        
        await context.updateCacheConfiguration(params.cacheType, cacheConfig);
        await context.clearCache(params.cacheType);
        
        return { oldConfig, newConfig: cacheConfig };
      },
      validate: (params) => {
        const errors: string[] = [];
        if (params.size !== 'auto' && (params.size < 10 || params.size > 10240)) {
          errors.push('Cache size must be between 10MB and 10GB');
        }
        if (params.ttl < 60 || params.ttl > 86400) {
          errors.push('TTL must be between 60 seconds and 24 hours');
        }
        return { valid: errors.length === 0, errors };
      },
      generateRollbackData: async (context, params) => {
        const cacheConfig = await context.getCacheConfiguration(params.cacheType);
        return { cacheType: params.cacheType, originalConfig: cacheConfig };
      }
    });

    // Service Management Scripts
    this.register({
      id: 'restart_service_gracefully',
      name: 'Graceful Service Restart',
      description: 'Performs a graceful restart with connection draining',
      category: 'service',
      riskLevel: 'medium',
      requiredParams: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'Name of the service to restart',
          required: true
        },
        {
          name: 'drainTimeout',
          type: 'number',
          description: 'Time to wait for connections to drain (seconds)',
          required: false,
          default: 30
        }
      ],
      preConditions: [
        'Service is currently running',
        'No critical operations in progress'
      ],
      postConditions: [
        'Service is running',
        'All connections restored'
      ],
      estimatedDuration: 60,
      execute: async (context, params) => {
        const service = await context.getService(params.serviceName);
        
        // Enable drain mode
        await service.enableDrainMode();
        
        // Wait for connections to drain
        await context.wait(params.drainTimeout * 1000);
        
        // Stop service
        await service.stop();
        
        // Wait a moment
        await context.wait(2000);
        
        // Start service
        await service.start();
        
        // Wait for service to be ready
        await service.waitForReady();
        
        return { status: 'restarted', serviceName: params.serviceName };
      },
      validate: (params) => {
        const errors: string[] = [];
        if (!params.serviceName) {
          errors.push('Service name is required');
        }
        if (params.drainTimeout < 0 || params.drainTimeout > 300) {
          errors.push('Drain timeout must be between 0 and 300 seconds');
        }
        return { valid: errors.length === 0, errors };
      },
      generateRollbackData: async (context, params) => {
        const service = await context.getService(params.serviceName);
        return { 
          serviceName: params.serviceName,
          wasRunning: service.isRunning()
        };
      }
    });

    // Database Scripts
    this.register({
      id: 'rebuild_database_indexes',
      name: 'Rebuild Database Indexes',
      description: 'Rebuilds fragmented database indexes for better performance',
      category: 'database',
      riskLevel: 'high',
      requiredParams: [
        {
          name: 'tables',
          type: 'object',
          description: 'Array of table names or "all"',
          required: true
        },
        {
          name: 'online',
          type: 'boolean',
          description: 'Perform online rebuild if supported',
          required: false,
          default: true
        }
      ],
      preConditions: [
        'Database is accessible',
        'Sufficient disk space available',
        'No long-running transactions'
      ],
      postConditions: [
        'Indexes rebuilt',
        'Statistics updated'
      ],
      estimatedDuration: 300,
      execute: async (context, params) => {
        const db = await context.getDatabaseConnection();
        const tables = params.tables === 'all' 
          ? await db.getAllTables() 
          : params.tables;
        
        const results = [];
        
        for (const table of tables) {
          const indexes = await db.getIndexes(table);
          
          for (const index of indexes) {
            if (index.fragmentationPercent > 30) {
              await db.rebuildIndex(table, index.name, { online: params.online });
              results.push({
                table,
                index: index.name,
                oldFragmentation: index.fragmentationPercent,
                status: 'rebuilt'
              });
            }
          }
        }
        
        // Update statistics
        await db.updateStatistics(tables);
        
        return { rebuiltIndexes: results };
      },
      validate: (params) => {
        const errors: string[] = [];
        if (!params.tables) {
          errors.push('Tables parameter is required');
        }
        if (params.tables !== 'all' && !Array.isArray(params.tables)) {
          errors.push('Tables must be an array or "all"');
        }
        return { valid: errors.length === 0, errors };
      },
      generateRollbackData: async (context, params) => {
        // Index rebuilds don't need rollback, but we track what was done
        return { tables: params.tables, timestamp: new Date() };
      }
    });

    this.register({
      id: 'clean_audit_logs',
      name: 'Clean Old Audit Logs',
      description: 'Archives and removes old audit log entries',
      category: 'maintenance',
      riskLevel: 'low',
      requiredParams: [
        {
          name: 'retentionDays',
          type: 'number',
          description: 'Number of days to retain',
          required: true
        },
        {
          name: 'archivePath',
          type: 'string',
          description: 'Path to archive old logs',
          required: false,
          default: '/archive/audit'
        }
      ],
      preConditions: [
        'Archive location is accessible',
        'Sufficient disk space for archive'
      ],
      postConditions: [
        'Old logs archived',
        'Database space reclaimed'
      ],
      estimatedDuration: 120,
      execute: async (context, params) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - params.retentionDays);
        
        // Get logs to archive
        const logsToArchive = await context.getAuditLogs({
          before: cutoffDate
        });
        
        // Archive logs
        const archiveFile = `${params.archivePath}/audit_${Date.now()}.json`;
        await context.writeFile(archiveFile, JSON.stringify(logsToArchive));
        
        // Delete from database
        const deletedCount = await context.deleteAuditLogs({
          before: cutoffDate
        });
        
        return {
          archivedCount: logsToArchive.length,
          deletedCount,
          archiveFile
        };
      },
      validate: (params) => {
        const errors: string[] = [];
        if (params.retentionDays < 7 || params.retentionDays > 365) {
          errors.push('Retention days must be between 7 and 365');
        }
        return { valid: errors.length === 0, errors };
      },
      generateRollbackData: async (context, params) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - params.retentionDays);
        
        const logsToArchive = await context.getAuditLogs({
          before: cutoffDate
        });
        
        return {
          logs: logsToArchive,
          cutoffDate
        };
      }
    });

    // Security Scripts
    this.register({
      id: 'rotate_encryption_keys',
      name: 'Rotate Encryption Keys',
      description: 'Rotates encryption keys and re-encrypts sensitive data',
      category: 'security',
      riskLevel: 'high',
      requiredParams: [
        {
          name: 'keyType',
          type: 'string',
          description: 'Type of key to rotate',
          required: true
        },
        {
          name: 'algorithm',
          type: 'string',
          description: 'Encryption algorithm',
          required: false,
          default: 'AES-256-GCM'
        }
      ],
      preConditions: [
        'No active encryption operations',
        'Backup of current keys exists'
      ],
      postConditions: [
        'New keys generated',
        'All data re-encrypted',
        'Old keys archived'
      ],
      estimatedDuration: 600,
      execute: async (context, params) => {
        const keyManager = await context.getKeyManager();
        
        // Generate new key
        const newKey = await keyManager.generateKey(params.algorithm);
        
        // Get old key
        const oldKey = await keyManager.getCurrentKey(params.keyType);
        
        // Re-encrypt all data
        const reencryptedItems = await context.reencryptData(
          params.keyType,
          oldKey,
          newKey
        );
        
        // Update key in key manager
        await keyManager.rotateKey(params.keyType, newKey);
        
        // Archive old key
        await keyManager.archiveKey(oldKey);
        
        return {
          keyType: params.keyType,
          itemsReencrypted: reencryptedItems.length,
          newKeyId: newKey.id
        };
      },
      validate: (params) => {
        const errors: string[] = [];
        const validKeyTypes = ['master', 'data', 'session', 'api'];
        if (!validKeyTypes.includes(params.keyType)) {
          errors.push(`Invalid key type. Must be one of: ${validKeyTypes.join(', ')}`);
        }
        return { valid: errors.length === 0, errors };
      },
      generateRollbackData: async (context, params) => {
        const keyManager = await context.getKeyManager();
        const currentKey = await keyManager.getCurrentKey(params.keyType);
        
        return {
          keyType: params.keyType,
          originalKeyId: currentKey.id
        };
      }
    });

    // Performance Scripts
    this.register({
      id: 'optimize_database_connections',
      name: 'Optimize Database Connection Pool',
      description: 'Adjusts connection pool settings based on current load',
      category: 'performance',
      riskLevel: 'medium',
      requiredParams: [
        {
          name: 'poolName',
          type: 'string',
          description: 'Name of the connection pool',
          required: true
        },
        {
          name: 'mode',
          type: 'string',
          description: 'Optimization mode: auto, conservative, aggressive',
          required: false,
          default: 'auto'
        }
      ],
      preConditions: [
        'Database is accessible',
        'Connection pool metrics available'
      ],
      postConditions: [
        'Connection pool reconfigured',
        'Connections rebalanced'
      ],
      estimatedDuration: 30,
      execute: async (context, params) => {
        const pool = await context.getConnectionPool(params.poolName);
        const metrics = await pool.getMetrics();
        const oldConfig = pool.getConfiguration();
        
        let newConfig;
        
        switch (params.mode) {
          case 'conservative':
            newConfig = {
              minConnections: Math.max(5, metrics.avgActiveConnections),
              maxConnections: Math.max(20, metrics.peakConnections * 1.2),
              idleTimeout: 300000 // 5 minutes
            };
            break;
            
          case 'aggressive':
            newConfig = {
              minConnections: Math.max(10, metrics.avgActiveConnections * 1.5),
              maxConnections: Math.max(50, metrics.peakConnections * 1.5),
              idleTimeout: 600000 // 10 minutes
            };
            break;
            
          case 'auto':
          default:
            const utilizationRate = metrics.avgActiveConnections / oldConfig.maxConnections;
            
            if (utilizationRate > 0.8) {
              // High utilization - increase pool size
              newConfig = {
                minConnections: oldConfig.minConnections * 1.5,
                maxConnections: oldConfig.maxConnections * 1.5,
                idleTimeout: oldConfig.idleTimeout
              };
            } else if (utilizationRate < 0.3) {
              // Low utilization - decrease pool size
              newConfig = {
                minConnections: Math.max(5, oldConfig.minConnections * 0.7),
                maxConnections: Math.max(20, oldConfig.maxConnections * 0.7),
                idleTimeout: oldConfig.idleTimeout
              };
            } else {
              // Optimal range - minor adjustments
              newConfig = {
                minConnections: metrics.avgActiveConnections,
                maxConnections: metrics.peakConnections * 1.3,
                idleTimeout: oldConfig.idleTimeout
              };
            }
        }
        
        await pool.reconfigure(newConfig);
        
        return {
          poolName: params.poolName,
          oldConfig,
          newConfig,
          metrics
        };
      },
      validate: (params) => {
        const errors: string[] = [];
        const validModes = ['auto', 'conservative', 'aggressive'];
        if (!validModes.includes(params.mode)) {
          errors.push(`Invalid mode. Must be one of: ${validModes.join(', ')}`);
        }
        return { valid: errors.length === 0, errors };
      },
      generateRollbackData: async (context, params) => {
        const pool = await context.getConnectionPool(params.poolName);
        return {
          poolName: params.poolName,
          originalConfig: pool.getConfiguration()
        };
      }
    });
  }

  register(script: RemediationScript): void {
    this.scripts.set(script.id, script);
  }

  get(scriptId: string): RemediationScript | undefined {
    return this.scripts.get(scriptId);
  }

  list(category?: string): RemediationScript[] {
    const scripts = Array.from(this.scripts.values());
    
    if (category) {
      return scripts.filter(s => s.category === category);
    }
    
    return scripts;
  }

  search(query: string): RemediationScript[] {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.scripts.values()).filter(script => 
      script.name.toLowerCase().includes(lowerQuery) ||
      script.description.toLowerCase().includes(lowerQuery) ||
      script.category.toLowerCase().includes(lowerQuery)
    );
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    
    for (const script of this.scripts.values()) {
      categories.add(script.category);
    }
    
    return Array.from(categories).sort();
  }

  validateScript(scriptId: string, params: any): { valid: boolean; errors?: string[] } {
    const script = this.get(scriptId);
    
    if (!script) {
      return { valid: false, errors: ['Script not found'] };
    }
    
    return script.validate(params);
  }

  async executeScript(
    scriptId: string, 
    context: RemediationContext, 
    params: any
  ): Promise<any> {
    const script = this.get(scriptId);
    
    if (!script) {
      throw new Error(`Script not found: ${scriptId}`);
    }
    
    const validation = script.validate(params);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors?.join(', ')}`);
    }
    
    return script.execute(context, params);
  }
}

// Export singleton instance
export const scriptLibrary = new RemediationScriptLibrary();