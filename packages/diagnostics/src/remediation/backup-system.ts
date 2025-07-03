import { Logger } from '@cm-diagnostics/logger';
import type { RemediationContext } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { z } from 'zod';

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  remediationId: string;
  systemId: string;
  type: 'configuration' | 'database' | 'files' | 'full';
  description: string;
  size: number;
  checksum: string;
  encrypted: boolean;
  compression: 'none' | 'gzip' | 'brotli';
  items: BackupItem[];
  retention: {
    days: number;
    priority: 'low' | 'medium' | 'high';
  };
}

export interface BackupItem {
  type: 'file' | 'database' | 'configuration' | 'state';
  path: string;
  originalPath: string;
  size: number;
  checksum: string;
  metadata?: any;
}

export interface BackupOptions {
  type: 'configuration' | 'database' | 'files' | 'full';
  compress?: boolean;
  encrypt?: boolean;
  retentionDays?: number;
  priority?: 'low' | 'medium' | 'high';
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface RestoreOptions {
  verify?: boolean;
  force?: boolean;
  selective?: string[]; // Specific items to restore
  dryRun?: boolean;
}

const BackupMetadataSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  remediationId: z.string(),
  systemId: z.string(),
  type: z.enum(['configuration', 'database', 'files', 'full']),
  description: z.string(),
  size: z.number(),
  checksum: z.string(),
  encrypted: z.boolean(),
  compression: z.enum(['none', 'gzip', 'brotli']),
  items: z.array(z.object({
    type: z.enum(['file', 'database', 'configuration', 'state']),
    path: z.string(),
    originalPath: z.string(),
    size: z.number(),
    checksum: z.string(),
    metadata: z.any().optional()
  })),
  retention: z.object({
    days: z.number(),
    priority: z.enum(['low', 'medium', 'high'])
  })
});

export class BackupSystem {
  private logger: Logger;
  private backupRoot: string;
  private encryptionKey?: Buffer;
  private maxConcurrentBackups = 3;
  private activeBackups = new Map<string, Promise<BackupMetadata>>();

  constructor(
    backupRoot: string = '/var/cm-diagnostics/backups',
    encryptionKey?: string
  ) {
    this.logger = new Logger('BackupSystem');
    this.backupRoot = backupRoot;
    
    if (encryptionKey) {
      this.encryptionKey = crypto.scryptSync(encryptionKey, 'salt', 32);
    }
    
    this.initializeBackupDirectory();
  }

  private async initializeBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupRoot);
    } catch {
      await fs.mkdir(this.backupRoot, { recursive: true });
    }
  }

  async createBackup(
    context: RemediationContext,
    remediationId: string,
    options: BackupOptions
  ): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    
    // Check concurrent backup limit
    if (this.activeBackups.size >= this.maxConcurrentBackups) {
      throw new Error('Maximum concurrent backups reached');
    }

    const backupPromise = this.performBackup(context, backupId, remediationId, options);
    this.activeBackups.set(backupId, backupPromise);

    try {
      const metadata = await backupPromise;
      return metadata;
    } finally {
      this.activeBackups.delete(backupId);
    }
  }

  private async performBackup(
    context: RemediationContext,
    backupId: string,
    remediationId: string,
    options: BackupOptions
  ): Promise<BackupMetadata> {
    this.logger.info(`Starting backup ${backupId} for remediation ${remediationId}`);
    
    const backupDir = path.join(this.backupRoot, backupId);
    await fs.mkdir(backupDir, { recursive: true });

    const items: BackupItem[] = [];
    let totalSize = 0;

    try {
      // Backup based on type
      switch (options.type) {
        case 'configuration':
          const configItems = await this.backupConfiguration(context, backupDir);
          items.push(...configItems);
          break;
          
        case 'database':
          const dbItems = await this.backupDatabase(context, backupDir);
          items.push(...dbItems);
          break;
          
        case 'files':
          const fileItems = await this.backupFiles(context, backupDir, options);
          items.push(...fileItems);
          break;
          
        case 'full':
          const configBackup = await this.backupConfiguration(context, backupDir);
          const dbBackup = await this.backupDatabase(context, backupDir);
          const filesBackup = await this.backupFiles(context, backupDir, options);
          items.push(...configBackup, ...dbBackup, ...filesBackup);
          break;
      }

      // Calculate total size
      totalSize = items.reduce((sum, item) => sum + item.size, 0);

      // Compress if requested
      if (options.compress) {
        await this.compressBackup(backupDir, options.compress);
      }

      // Encrypt if requested
      if (options.encrypt && this.encryptionKey) {
        await this.encryptBackup(backupDir);
      }

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        remediationId,
        systemId: context.systemId,
        type: options.type,
        description: `Backup for ${options.type} before remediation`,
        size: totalSize,
        checksum: await this.calculateChecksum(backupDir),
        encrypted: options.encrypt || false,
        compression: options.compress ? 'gzip' : 'none',
        items,
        retention: {
          days: options.retentionDays || 30,
          priority: options.priority || 'medium'
        }
      };

      // Save metadata
      await this.saveMetadata(backupDir, metadata);

      this.logger.info(`Backup ${backupId} completed successfully`, {
        size: totalSize,
        itemCount: items.length,
        type: options.type
      });

      return metadata;

    } catch (error) {
      this.logger.error(`Backup ${backupId} failed`, error);
      // Cleanup on failure
      await this.cleanupBackup(backupDir);
      throw error;
    }
  }

  private async backupConfiguration(
    context: RemediationContext,
    backupDir: string
  ): Promise<BackupItem[]> {
    const items: BackupItem[] = [];
    const configDir = path.join(backupDir, 'configuration');
    await fs.mkdir(configDir, { recursive: true });

    // Backup system configuration
    const systemConfig = await context.getConfiguration();
    const systemConfigPath = path.join(configDir, 'system.json');
    await fs.writeFile(systemConfigPath, JSON.stringify(systemConfig, null, 2));
    
    items.push({
      type: 'configuration',
      path: systemConfigPath,
      originalPath: 'system.config',
      size: Buffer.byteLength(JSON.stringify(systemConfig)),
      checksum: this.calculateFileChecksum(systemConfigPath),
      metadata: { version: systemConfig.version }
    });

    // Backup service configurations
    const services = await context.getServices();
    for (const service of services) {
      const serviceConfig = await service.getConfiguration();
      const servicePath = path.join(configDir, `service_${service.name}.json`);
      await fs.writeFile(servicePath, JSON.stringify(serviceConfig, null, 2));
      
      items.push({
        type: 'configuration',
        path: servicePath,
        originalPath: `services.${service.name}`,
        size: Buffer.byteLength(JSON.stringify(serviceConfig)),
        checksum: this.calculateFileChecksum(servicePath),
        metadata: { service: service.name }
      });
    }

    // Backup environment variables
    const envVars = await context.getEnvironmentVariables();
    const envPath = path.join(configDir, 'environment.json');
    await fs.writeFile(envPath, JSON.stringify(envVars, null, 2));
    
    items.push({
      type: 'configuration',
      path: envPath,
      originalPath: 'environment',
      size: Buffer.byteLength(JSON.stringify(envVars)),
      checksum: this.calculateFileChecksum(envPath)
    });

    return items;
  }

  private async backupDatabase(
    context: RemediationContext,
    backupDir: string
  ): Promise<BackupItem[]> {
    const items: BackupItem[] = [];
    const dbDir = path.join(backupDir, 'database');
    await fs.mkdir(dbDir, { recursive: true });

    // Get database connection
    const db = await context.getDatabaseConnection();

    // Export schema
    const schemaPath = path.join(dbDir, 'schema.sql');
    const schema = await db.exportSchema();
    await fs.writeFile(schemaPath, schema);
    
    items.push({
      type: 'database',
      path: schemaPath,
      originalPath: 'database.schema',
      size: Buffer.byteLength(schema),
      checksum: this.calculateFileChecksum(schemaPath)
    });

    // Export critical tables
    const criticalTables = [
      'users', 'permissions', 'configurations', 
      'audit_logs', 'system_settings'
    ];

    for (const table of criticalTables) {
      try {
        const dataPath = path.join(dbDir, `${table}.json`);
        const data = await db.exportTable(table);
        await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
        
        items.push({
          type: 'database',
          path: dataPath,
          originalPath: `database.${table}`,
          size: Buffer.byteLength(JSON.stringify(data)),
          checksum: this.calculateFileChecksum(dataPath),
          metadata: { 
            table,
            rowCount: data.length 
          }
        });
      } catch (error) {
        this.logger.warn(`Failed to backup table ${table}`, error);
      }
    }

    return items;
  }

  private async backupFiles(
    context: RemediationContext,
    backupDir: string,
    options: BackupOptions
  ): Promise<BackupItem[]> {
    const items: BackupItem[] = [];
    const filesDir = path.join(backupDir, 'files');
    await fs.mkdir(filesDir, { recursive: true });

    // Get files to backup based on patterns
    const filesToBackup = await context.getFiles({
      include: options.includePatterns || ['**/config.*', '**/settings.*'],
      exclude: options.excludePatterns || ['**/node_modules/**', '**/temp/**']
    });

    for (const file of filesToBackup) {
      try {
        const content = await fs.readFile(file.path);
        const relativePath = path.relative(context.rootPath, file.path);
        const backupPath = path.join(filesDir, relativePath);
        
        // Create directory structure
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        
        // Copy file
        await fs.writeFile(backupPath, content);
        
        items.push({
          type: 'file',
          path: backupPath,
          originalPath: file.path,
          size: content.length,
          checksum: this.calculateBufferChecksum(content),
          metadata: {
            permissions: file.permissions,
            modified: file.modified
          }
        });
      } catch (error) {
        this.logger.warn(`Failed to backup file ${file.path}`, error);
      }
    }

    return items;
  }

  async restoreBackup(
    backupId: string,
    context: RemediationContext,
    options: RestoreOptions = {}
  ): Promise<void> {
    this.logger.info(`Starting restore of backup ${backupId}`);
    
    const backupDir = path.join(this.backupRoot, backupId);
    const metadataPath = path.join(backupDir, 'metadata.json');
    
    // Load and validate metadata
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = BackupMetadataSchema.parse(JSON.parse(metadataContent));

    // Verify backup integrity
    if (options.verify) {
      await this.verifyBackup(backupDir, metadata);
    }

    // Decrypt if needed
    if (metadata.encrypted && this.encryptionKey) {
      await this.decryptBackup(backupDir);
    }

    // Decompress if needed
    if (metadata.compression !== 'none') {
      await this.decompressBackup(backupDir, metadata.compression);
    }

    // Perform restore based on items
    const itemsToRestore = options.selective 
      ? metadata.items.filter(item => options.selective!.includes(item.originalPath))
      : metadata.items;

    if (options.dryRun) {
      this.logger.info('Dry run mode - no actual restore performed', {
        itemsToRestore: itemsToRestore.map(i => i.originalPath)
      });
      return;
    }

    // Create a restore point before restoring
    if (!options.force) {
      await this.createBackup(context, `restore-${backupId}`, {
        type: metadata.type,
        retentionDays: 7,
        priority: 'high'
      });
    }

    // Restore items
    for (const item of itemsToRestore) {
      try {
        await this.restoreItem(item, context, backupDir);
      } catch (error) {
        this.logger.error(`Failed to restore item ${item.originalPath}`, error);
        if (!options.force) {
          throw error;
        }
      }
    }

    this.logger.info(`Restore of backup ${backupId} completed successfully`);
  }

  private async restoreItem(
    item: BackupItem,
    context: RemediationContext,
    backupDir: string
  ): Promise<void> {
    switch (item.type) {
      case 'configuration':
        await this.restoreConfiguration(item, context);
        break;
        
      case 'database':
        await this.restoreDatabase(item, context);
        break;
        
      case 'file':
        await this.restoreFile(item, context);
        break;
        
      case 'state':
        await this.restoreState(item, context);
        break;
    }
  }

  private async restoreConfiguration(
    item: BackupItem,
    context: RemediationContext
  ): Promise<void> {
    const content = await fs.readFile(item.path, 'utf-8');
    const config = JSON.parse(content);

    if (item.originalPath === 'system.config') {
      await context.updateConfiguration(config);
    } else if (item.originalPath.startsWith('services.')) {
      const serviceName = item.originalPath.split('.')[1];
      const service = await context.getService(serviceName);
      await service.updateConfiguration(config);
    } else if (item.originalPath === 'environment') {
      await context.setEnvironmentVariables(config);
    }
  }

  private async restoreDatabase(
    item: BackupItem,
    context: RemediationContext
  ): Promise<void> {
    const db = await context.getDatabaseConnection();

    if (item.originalPath === 'database.schema') {
      const schema = await fs.readFile(item.path, 'utf-8');
      await db.executeScript(schema);
    } else if (item.originalPath.startsWith('database.')) {
      const table = item.originalPath.split('.')[1];
      const content = await fs.readFile(item.path, 'utf-8');
      const data = JSON.parse(content);
      await db.importTable(table, data);
    }
  }

  private async restoreFile(
    item: BackupItem,
    context: RemediationContext
  ): Promise<void> {
    const content = await fs.readFile(item.path);
    await fs.writeFile(item.originalPath, content);
    
    // Restore permissions if available
    if (item.metadata?.permissions) {
      await fs.chmod(item.originalPath, item.metadata.permissions);
    }
  }

  private async restoreState(
    item: BackupItem,
    context: RemediationContext
  ): Promise<void> {
    const content = await fs.readFile(item.path, 'utf-8');
    const state = JSON.parse(content);
    await context.setState(item.originalPath, state);
  }

  async listBackups(filter?: {
    remediationId?: string;
    systemId?: string;
    type?: BackupOptions['type'];
    startDate?: Date;
    endDate?: Date;
  }): Promise<BackupMetadata[]> {
    const backups: BackupMetadata[] = [];
    
    const entries = await fs.readdir(this.backupRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const metadataPath = path.join(this.backupRoot, entry.name, 'metadata.json');
          const content = await fs.readFile(metadataPath, 'utf-8');
          const metadata = BackupMetadataSchema.parse(JSON.parse(content));
          
          // Apply filters
          if (filter) {
            if (filter.remediationId && metadata.remediationId !== filter.remediationId) continue;
            if (filter.systemId && metadata.systemId !== filter.systemId) continue;
            if (filter.type && metadata.type !== filter.type) continue;
            if (filter.startDate && metadata.timestamp < filter.startDate) continue;
            if (filter.endDate && metadata.timestamp > filter.endDate) continue;
          }
          
          backups.push(metadata);
        } catch (error) {
          this.logger.warn(`Failed to read backup metadata for ${entry.name}`, error);
        }
      }
    }
    
    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backupDir = path.join(this.backupRoot, backupId);
    await fs.rm(backupDir, { recursive: true, force: true });
    this.logger.info(`Deleted backup ${backupId}`);
  }

  async cleanupOldBackups(): Promise<number> {
    const backups = await this.listBackups();
    const now = new Date();
    let deletedCount = 0;

    for (const backup of backups) {
      const age = (now.getTime() - backup.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      
      if (age > backup.retention.days) {
        // Check priority before deleting
        if (backup.retention.priority === 'high' && age < backup.retention.days * 2) {
          continue; // Keep high priority backups longer
        }
        
        await this.deleteBackup(backup.id);
        deletedCount++;
      }
    }

    this.logger.info(`Cleaned up ${deletedCount} old backups`);
    return deletedCount;
  }

  async getBackupSize(backupId: string): Promise<number> {
    const backupDir = path.join(this.backupRoot, backupId);
    return this.getDirectorySize(backupDir);
  }

  private async getDirectorySize(dir: string): Promise<number> {
    let size = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        size += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }
    
    return size;
  }

  private async verifyBackup(backupDir: string, metadata: BackupMetadata): Promise<void> {
    const actualChecksum = await this.calculateChecksum(backupDir);
    
    if (actualChecksum !== metadata.checksum) {
      throw new Error('Backup integrity check failed');
    }
  }

  private async compressBackup(backupDir: string, compression: boolean | 'gzip' | 'brotli'): Promise<void> {
    // Implementation would compress the backup directory
    this.logger.debug('Compressing backup', { backupDir, compression });
  }

  private async decompressBackup(backupDir: string, compression: 'gzip' | 'brotli'): Promise<void> {
    // Implementation would decompress the backup
    this.logger.debug('Decompressing backup', { backupDir, compression });
  }

  private async encryptBackup(backupDir: string): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    // Implementation would encrypt all files in the backup
    this.logger.debug('Encrypting backup', { backupDir });
  }

  private async decryptBackup(backupDir: string): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    // Implementation would decrypt all files in the backup
    this.logger.debug('Decrypting backup', { backupDir });
  }

  private async calculateChecksum(dir: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    
    const processDirectory = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else {
          const content = await fs.readFile(fullPath);
          hash.update(content);
        }
      }
    };
    
    await processDirectory(dir);
    return hash.digest('hex');
  }

  private calculateFileChecksum(filePath: string): string {
    // Synchronous for now, could be made async
    return crypto.createHash('sha256').update(filePath).digest('hex');
  }

  private calculateBufferChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async saveMetadata(backupDir: string, metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(backupDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async cleanupBackup(backupDir: string): Promise<void> {
    try {
      await fs.rm(backupDir, { recursive: true, force: true });
    } catch (error) {
      this.logger.error('Failed to cleanup backup directory', error);
    }
  }

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }
}

// Export singleton instance
export const backupSystem = new BackupSystem();