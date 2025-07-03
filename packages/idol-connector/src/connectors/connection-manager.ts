import { EventEmitter } from 'events';
import winston from 'winston';
import { IDOLConnection, IDOLConnector, IDOLStatus } from '../types';
import { IDOLServerConnector } from './idol-connector';
import { CommunityConnector } from './community-connector';
import { CloudConnector } from './cloud-connector';

export interface ConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  poolSize?: number;
}

export class IDOLConnectionManager extends EventEmitter {
  private connections: Map<string, IDOLConnector> = new Map();
  private connectionPools: Map<string, IDOLConnector[]> = new Map();
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();
  private logger: winston.Logger;
  private defaultOptions: ConnectionOptions = {
    maxRetries: 3,
    retryDelay: 5000,
    heartbeatInterval: 30000,
    connectionTimeout: 10000,
    poolSize: 1
  };

  constructor() {
    super();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async createConnection(
    id: string,
    config: IDOLConnection,
    options?: ConnectionOptions
  ): Promise<IDOLConnector> {
    const connOptions = { ...this.defaultOptions, ...options };
    
    try {
      // Determine connector type based on configuration
      const connector = this.createConnectorInstance(config);
      
      // Connect with retry logic
      await this.connectWithRetry(connector, connOptions);
      
      // Store connection
      this.connections.set(id, connector);
      
      // Create connection pool if needed
      if (connOptions.poolSize && connOptions.poolSize > 1) {
        await this.createConnectionPool(id, config, connOptions);
      }
      
      // Start health monitoring
      this.startHealthCheck(id, connector, connOptions.heartbeatInterval!);
      
      this.emit('connection:created', { id, config });
      this.logger.info(`Created IDOL connection: ${id}`);
      
      return connector;
    } catch (error) {
      this.logger.error(`Failed to create connection ${id}:`, error);
      throw error;
    }
  }

  private createConnectorInstance(config: IDOLConnection): IDOLConnector {
    // Determine connector type based on config
    if (config.community) {
      return new CommunityConnector(config);
    } else if (config.host.includes('cloud') || config.host.includes('saas')) {
      return new CloudConnector(config);
    } else {
      return new IDOLServerConnector(config);
    }
  }

  private async connectWithRetry(
    connector: IDOLConnector,
    options: ConnectionOptions
  ): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < options.maxRetries!; attempt++) {
      try {
        await Promise.race([
          connector.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), options.connectionTimeout)
          )
        ]);
        
        return; // Success
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Connection attempt ${attempt + 1} failed:`, error);
        
        if (attempt < options.maxRetries! - 1) {
          await new Promise(resolve => setTimeout(resolve, options.retryDelay));
        }
      }
    }
    
    throw lastError || new Error('Failed to connect after retries');
  }

  private async createConnectionPool(
    id: string,
    config: IDOLConnection,
    options: ConnectionOptions
  ): Promise<void> {
    const pool: IDOLConnector[] = [];
    
    for (let i = 1; i < options.poolSize!; i++) {
      const connector = this.createConnectorInstance(config);
      await this.connectWithRetry(connector, options);
      pool.push(connector);
    }
    
    this.connectionPools.set(id, pool);
    this.logger.info(`Created connection pool for ${id} with ${pool.length + 1} connections`);
  }

  private startHealthCheck(
    id: string,
    connector: IDOLConnector,
    interval: number
  ): void {
    const check = setInterval(async () => {
      try {
        const status = await connector.getStatus();
        
        if (status.status !== 'running') {
          this.emit('connection:unhealthy', { id, status });
          this.logger.warn(`Connection ${id} is unhealthy:`, status);
          
          // Attempt to reconnect
          await this.reconnect(id);
        }
      } catch (error) {
        this.emit('connection:error', { id, error });
        this.logger.error(`Health check failed for ${id}:`, error);
        
        // Attempt to reconnect
        await this.reconnect(id);
      }
    }, interval);
    
    this.healthChecks.set(id, check);
  }

  async getConnection(id: string): Promise<IDOLConnector | undefined> {
    const connection = this.connections.get(id);
    
    if (!connection) {
      return undefined;
    }
    
    // If connection pool exists, return least busy connection
    const pool = this.connectionPools.get(id);
    if (pool && pool.length > 0) {
      return this.getLeastBusyConnection([connection, ...pool]);
    }
    
    return connection;
  }

  private getLeastBusyConnection(connections: IDOLConnector[]): IDOLConnector {
    // Simple round-robin for now
    // In production, this would check actual connection metrics
    return connections[Math.floor(Math.random() * connections.length)];
  }

  async reconnect(id: string): Promise<void> {
    const connection = this.connections.get(id);
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }
    
    try {
      await connection.disconnect();
      await connection.connect();
      
      this.emit('connection:reconnected', { id });
      this.logger.info(`Reconnected to IDOL: ${id}`);
    } catch (error) {
      this.emit('connection:reconnect:failed', { id, error });
      this.logger.error(`Failed to reconnect ${id}:`, error);
      throw error;
    }
  }

  async closeConnection(id: string): Promise<void> {
    // Stop health check
    const healthCheck = this.healthChecks.get(id);
    if (healthCheck) {
      clearInterval(healthCheck);
      this.healthChecks.delete(id);
    }
    
    // Close main connection
    const connection = this.connections.get(id);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(id);
    }
    
    // Close pool connections
    const pool = this.connectionPools.get(id);
    if (pool) {
      await Promise.all(pool.map(conn => conn.disconnect()));
      this.connectionPools.delete(id);
    }
    
    this.emit('connection:closed', { id });
    this.logger.info(`Closed IDOL connection: ${id}`);
  }

  async closeAllConnections(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    await Promise.all(ids.map(id => this.closeConnection(id)));
  }

  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  async getConnectionStatus(id: string): Promise<IDOLStatus | null> {
    const connection = await this.getConnection(id);
    if (!connection) {
      return null;
    }
    
    try {
      return await connection.getStatus();
    } catch (error) {
      this.logger.error(`Failed to get status for ${id}:`, error);
      return {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getAllConnectionStatuses(): Promise<Record<string, IDOLStatus>> {
    const statuses: Record<string, IDOLStatus> = {};
    
    for (const id of this.connections.keys()) {
      const status = await this.getConnectionStatus(id);
      if (status) {
        statuses[id] = status;
      }
    }
    
    return statuses;
  }
}