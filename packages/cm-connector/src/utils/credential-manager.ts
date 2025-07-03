import CryptoJS from 'crypto-js';
import { CMCredentials, CMConnectionConfig } from '../types';
import { prisma } from '@cm-diagnostics/database';
import { getMonitoring } from '@cm-diagnostics/logger';

const monitoring = getMonitoring();
const logger = monitoring.getLogger({ component: 'credential-manager' });

export class CredentialManager {
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || process.env.CREDENTIAL_ENCRYPTION_KEY || 
      this.generateDefaultKey();
    
    if (!encryptionKey && !process.env.CREDENTIAL_ENCRYPTION_KEY) {
      logger.warn('Using default encryption key. Set CREDENTIAL_ENCRYPTION_KEY environment variable for production.');
    }
  }

  private generateDefaultKey(): string {
    // In production, this should be a secure, persistent key
    return CryptoJS.SHA256('cm-diagnostics-default-key-change-in-production').toString();
  }

  encrypt(plainText: string): string {
    try {
      return CryptoJS.AES.encrypt(plainText, this.encryptionKey).toString();
    } catch (error) {
      logger.error('Encryption failed', error as Error);
      throw new Error('Failed to encrypt credential');
    }
  }

  decrypt(cipherText: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, this.encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      logger.error('Decryption failed', error as Error);
      throw new Error('Failed to decrypt credential');
    }
  }

  async saveCredentials(
    systemId: string,
    config: CMConnectionConfig
  ): Promise<CMCredentials> {
    logger.info('Saving credentials for system', { systemId });

    try {
      // Encrypt sensitive fields
      const encryptedConfig: any = { ...config };
      
      if (config.password) {
        encryptedConfig.password = undefined;
        encryptedConfig.encryptedPassword = this.encrypt(config.password);
      }
      
      if (config.apiKey) {
        encryptedConfig.apiKey = undefined;
        encryptedConfig.encryptedApiKey = this.encrypt(config.apiKey);
      }
      
      if (config.sshKey) {
        encryptedConfig.sshKey = undefined;
        encryptedConfig.encryptedSshKey = this.encrypt(config.sshKey);
      }

      // Store in database
      const credentials = await prisma.cMSystem.update({
        where: { id: systemId },
        data: {
          connectionConfig: encryptedConfig,
        },
      });

      logger.info('Credentials saved successfully', { systemId });
      monitoring.getMetrics().increment('credentials_saved');

      return {
        id: credentials.id,
        systemId: credentials.id,
        connectionConfig: config, // Return unencrypted for immediate use
        encryptedPassword: encryptedConfig.encryptedPassword,
        encryptedApiKey: encryptedConfig.encryptedApiKey,
        encryptedSshKey: encryptedConfig.encryptedSshKey,
        createdAt: credentials.createdAt,
        updatedAt: credentials.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to save credentials', error as Error);
      monitoring.getMetrics().increment('credentials_save_failed');
      throw error;
    }
  }

  async loadCredentials(systemId: string): Promise<CMConnectionConfig> {
    logger.debug('Loading credentials for system', { systemId });

    try {
      const system = await prisma.cMSystem.findUnique({
        where: { id: systemId },
      });

      if (!system) {
        throw new Error(`System not found: ${systemId}`);
      }

      const config = system.connectionConfig as any;
      const decryptedConfig: CMConnectionConfig = { ...config };

      // Decrypt sensitive fields
      if (config.encryptedPassword) {
        decryptedConfig.password = this.decrypt(config.encryptedPassword);
        delete (decryptedConfig as any).encryptedPassword;
      }

      if (config.encryptedApiKey) {
        decryptedConfig.apiKey = this.decrypt(config.encryptedApiKey);
        delete (decryptedConfig as any).encryptedApiKey;
      }

      if (config.encryptedSshKey) {
        decryptedConfig.sshKey = this.decrypt(config.encryptedSshKey);
        delete (decryptedConfig as any).encryptedSshKey;
      }

      monitoring.getMetrics().increment('credentials_loaded');
      return decryptedConfig;
    } catch (error) {
      logger.error('Failed to load credentials', error as Error);
      monitoring.getMetrics().increment('credentials_load_failed');
      throw error;
    }
  }

  async updateCredentials(
    systemId: string,
    updates: Partial<CMConnectionConfig>
  ): Promise<void> {
    logger.info('Updating credentials for system', { systemId });

    try {
      // Load existing credentials
      const existingConfig = await this.loadCredentials(systemId);
      
      // Merge with updates
      const updatedConfig = { ...existingConfig, ...updates };
      
      // Save updated credentials
      await this.saveCredentials(systemId, updatedConfig);
      
      logger.info('Credentials updated successfully', { systemId });
    } catch (error) {
      logger.error('Failed to update credentials', error as Error);
      throw error;
    }
  }

  async deleteCredentials(systemId: string): Promise<void> {
    logger.info('Deleting credentials for system', { systemId });

    try {
      await prisma.cMSystem.update({
        where: { id: systemId },
        data: {
          connectionConfig: {},
        },
      });

      logger.info('Credentials deleted successfully', { systemId });
      monitoring.getMetrics().increment('credentials_deleted');
    } catch (error) {
      logger.error('Failed to delete credentials', error as Error);
      monitoring.getMetrics().increment('credentials_delete_failed');
      throw error;
    }
  }

  async testCredentials(
    config: CMConnectionConfig
  ): Promise<{ valid: boolean; error?: string }> {
    logger.debug('Testing credentials');

    try {
      // Import connector dynamically to avoid circular dependency
      const { ConnectorFactory } = await import('../connectors/factory');
      const connector = ConnectorFactory.create(config);

      await connector.connect();
      await connector.disconnect();

      monitoring.getMetrics().increment('credentials_test_success');
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Credential test failed', error as Error);
      monitoring.getMetrics().increment('credentials_test_failed');
      
      return { 
        valid: false, 
        error: errorMessage 
      };
    }
  }

  // Rotate encryption key
  async rotateEncryptionKey(newKey: string): Promise<void> {
    logger.info('Starting encryption key rotation');

    try {
      // Get all systems with credentials
      const systems = await prisma.cMSystem.findMany({
        where: {
          connectionConfig: {
            not: {}
          }
        }
      });

      logger.info(`Rotating credentials for ${systems.length} systems`);

      // Re-encrypt each system's credentials
      for (const system of systems) {
        try {
          // Decrypt with old key
          const config = await this.loadCredentials(system.id);
          
          // Update encryption key
          this.encryptionKey = newKey;
          
          // Re-encrypt with new key
          await this.saveCredentials(system.id, config);
        } catch (error) {
          logger.error(`Failed to rotate credentials for system ${system.id}`, error as Error);
          throw error;
        }
      }

      logger.info('Encryption key rotation completed successfully');
      monitoring.getMetrics().increment('encryption_key_rotated');
    } catch (error) {
      logger.error('Encryption key rotation failed', error as Error);
      monitoring.getMetrics().increment('encryption_key_rotation_failed');
      throw error;
    }
  }

  // Validate credentials format
  validateCredentials(config: CMConnectionConfig): string[] {
    const errors: string[] = [];

    if (!config.type) {
      errors.push('Connection type is required');
    }

    if (!config.host) {
      errors.push('Host is required');
    }

    if (config.type === 'DIRECT_DB') {
      if (!config.database) {
        errors.push('Database name is required for direct database connection');
      }
      if (!config.username || !config.password) {
        errors.push('Username and password are required for direct database connection');
      }
    }

    if (config.type === 'REST_API' || config.type === 'SOAP_API') {
      if (!config.username || !config.password) {
        if (!config.apiKey) {
          errors.push('Either username/password or API key is required for API connection');
        }
      }
    }

    if (config.type === 'SSH') {
      if (!config.username) {
        errors.push('Username is required for SSH connection');
      }
      if (!config.password && !config.sshKey) {
        errors.push('Either password or SSH key is required for SSH connection');
      }
    }

    return errors;
  }
}