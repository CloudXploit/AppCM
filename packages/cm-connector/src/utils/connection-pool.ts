import PQueue from 'p-queue';
import { CMConnector, CMConnectionPool, CMConnectionConfig, CMError } from '../types';
import { DatabaseConnector } from '../connectors/database-connector';
import { APIConnector } from '../connectors/api-connector';
import { getMonitoring } from '@cm-diagnostics/logger';
import Redis from 'ioredis';

const monitoring = getMonitoring();
const logger = monitoring.getLogger({ component: 'connection-pool' });
const metrics = monitoring.getMetrics();

interface PooledConnection {
  connector: CMConnector;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
  systemId: string;
}

export class CMConnectionPool implements CMConnectionPool {
  private connections: Map<string, PooledConnection[]> = new Map();
  private queue: PQueue;
  private maxSize: number;
  private maxIdleTime: number;
  private maxUseCount: number;
  private healthCheckInterval: number;
  private healthCheckTimer?: NodeJS.Timer;
  private redis?: Redis;

  constructor(options: {
    maxSize?: number;
    maxIdleTime?: number;
    maxUseCount?: number;
    healthCheckInterval?: number;
    redis?: Redis;
  } = {}) {
    this.maxSize = options.maxSize || 10;
    this.maxIdleTime = options.maxIdleTime || 300000; // 5 minutes
    this.maxUseCount = options.maxUseCount || 100;
    this.healthCheckInterval = options.healthCheckInterval || 60000; // 1 minute
    this.redis = options.redis;

    this.queue = new PQueue({ concurrency: this.maxSize });

    // Start health check timer
    this.startHealthChecks();

    logger.info('Connection pool initialized', {
      maxSize: this.maxSize,
      maxIdleTime: this.maxIdleTime,
      maxUseCount: this.maxUseCount
    });
  }

  async acquire(systemId: string, config: CMConnectionConfig): Promise<CMConnector> {
    logger.debug('Acquiring connection', { systemId });
    metrics.increment('connection_pool_acquire_requests', { systemId });

    const startTime = Date.now();

    try {
      // Check if we have available connections for this system
      let systemConnections = this.connections.get(systemId) || [];
      
      // Find an available connection
      let connection = systemConnections.find(conn => !conn.inUse && this.isConnectionValid(conn));

      if (connection) {
        // Reuse existing connection
        connection.inUse = true;
        connection.lastUsedAt = new Date();
        connection.useCount++;

        metrics.increment('connection_pool_reuse', { systemId });
        metrics.record('connection_pool_acquire_time', Date.now() - startTime);

        logger.debug('Reusing existing connection', { 
          systemId, 
          useCount: connection.useCount 
        });

        return connection.connector;
      }

      // Create new connection if pool not full
      if (systemConnections.filter(c => !c.inUse).length < this.maxSize) {
        const newConnector = await this.createConnection(config);
        
        connection = {
          connector: newConnector,
          inUse: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          useCount: 1,
          systemId
        };

        systemConnections.push(connection);
        this.connections.set(systemId, systemConnections);

        metrics.increment('connection_pool_create', { systemId });
        metrics.record('connection_pool_acquire_time', Date.now() - startTime);

        logger.info('Created new connection', { systemId });

        // Store in Redis for distributed systems
        if (this.redis) {
          await this.storeConnectionInfo(systemId, connection);
        }

        return newConnector;
      }

      // Wait for available connection
      logger.debug('Pool full, waiting for available connection', { systemId });
      metrics.increment('connection_pool_wait', { systemId });

      return await this.queue.add(async () => {
        // Recursive call after waiting
        return this.acquire(systemId, config);
      });

    } catch (error) {
      metrics.increment('connection_pool_acquire_errors', { systemId });
      logger.error('Failed to acquire connection', error as Error);
      throw new CMError('CONNECTION_FAILED', 'Failed to acquire connection from pool', error);
    }
  }

  release(connector: CMConnector, systemId: string): void {
    logger.debug('Releasing connection', { systemId });

    const systemConnections = this.connections.get(systemId);
    if (!systemConnections) {
      logger.warn('No connections found for system', { systemId });
      return;
    }

    const connection = systemConnections.find(conn => conn.connector === connector);
    if (!connection) {
      logger.warn('Connection not found in pool', { systemId });
      return;
    }

    connection.inUse = false;
    connection.lastUsedAt = new Date();

    metrics.increment('connection_pool_release', { systemId });

    // Check if connection should be closed
    if (connection.useCount >= this.maxUseCount || !this.isConnectionValid(connection)) {
      this.closeConnection(connection, systemId);
    }
  }

  async drain(): Promise<void> {
    logger.info('Draining connection pool');

    // Stop health checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Wait for queue to be empty
    await this.queue.onEmpty();

    // Close all connections
    const closePromises: Promise<void>[] = [];

    for (const [systemId, connections] of this.connections) {
      for (const connection of connections) {
        closePromises.push(this.closeConnection(connection, systemId));
      }
    }

    await Promise.all(closePromises);
    this.connections.clear();

    logger.info('Connection pool drained');
    metrics.increment('connection_pool_drained');
  }

  size(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.length;
    }
    return total;
  }

  available(): number {
    let available = 0;
    for (const connections of this.connections.values()) {
      available += connections.filter(c => !c.inUse && this.isConnectionValid(c)).length;
    }
    return available;
  }

  pending(): number {
    return this.queue.pending;
  }

  getStats(): {
    totalConnections: number;
    availableConnections: number;
    inUseConnections: number;
    pendingRequests: number;
    systemStats: Record<string, any>;
  } {
    const systemStats: Record<string, any> = {};

    for (const [systemId, connections] of this.connections) {
      systemStats[systemId] = {
        total: connections.length,
        available: connections.filter(c => !c.inUse).length,
        inUse: connections.filter(c => c.inUse).length,
        avgUseCount: connections.reduce((sum, c) => sum + c.useCount, 0) / connections.length
      };
    }

    return {
      totalConnections: this.size(),
      availableConnections: this.available(),
      inUseConnections: this.size() - this.available(),
      pendingRequests: this.pending(),
      systemStats
    };
  }

  private async createConnection(config: CMConnectionConfig): Promise<CMConnector> {
    let connector: CMConnector;

    switch (config.type) {
      case 'DIRECT_DB':
        connector = new DatabaseConnector(config);
        break;
      case 'REST_API':
      case 'SOAP_API':
        connector = new APIConnector(config);
        break;
      default:
        throw new CMError('INVALID_CONFIG', `Unsupported connection type: ${config.type}`);
    }

    await connector.connect();
    return connector;
  }

  private async closeConnection(connection: PooledConnection, systemId: string): Promise<void> {
    try {
      logger.debug('Closing connection', { systemId, useCount: connection.useCount });
      
      await connection.connector.disconnect();
      
      const systemConnections = this.connections.get(systemId);
      if (systemConnections) {
        const index = systemConnections.indexOf(connection);
        if (index > -1) {
          systemConnections.splice(index, 1);
        }
        
        if (systemConnections.length === 0) {
          this.connections.delete(systemId);
        }
      }

      metrics.increment('connection_pool_close', { systemId });
    } catch (error) {
      logger.error('Error closing connection', error as Error);
      metrics.increment('connection_pool_close_errors', { systemId });
    }
  }

  private isConnectionValid(connection: PooledConnection): boolean {
    // Check if connection is still connected
    if (!connection.connector.isConnected()) {
      return false;
    }

    // Check if connection has been idle too long
    const idleTime = Date.now() - connection.lastUsedAt.getTime();
    if (idleTime > this.maxIdleTime) {
      logger.debug('Connection idle timeout exceeded', { 
        systemId: connection.systemId,
        idleTime 
      });
      return false;
    }

    // Check if connection has been used too many times
    if (connection.useCount >= this.maxUseCount) {
      logger.debug('Connection use count exceeded', { 
        systemId: connection.systemId,
        useCount: connection.useCount 
      });
      return false;
    }

    return true;
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    logger.debug('Performing connection pool health checks');

    for (const [systemId, connections] of this.connections) {
      for (const connection of connections) {
        if (!connection.inUse && connection.connector.isConnected()) {
          try {
            const health = await connection.connector.healthCheck();
            
            if (health.status === 'critical' || health.status === 'offline') {
              logger.warn('Unhealthy connection detected', { 
                systemId, 
                status: health.status 
              });
              await this.closeConnection(connection, systemId);
            }
          } catch (error) {
            logger.error('Health check failed', error as Error);
            await this.closeConnection(connection, systemId);
          }
        }
      }
    }

    // Clean up idle connections
    await this.cleanupIdleConnections();

    // Report metrics
    const stats = this.getStats();
    metrics.setGauge('connection_pool_size', () => stats.totalConnections);
    metrics.setGauge('connection_pool_available', () => stats.availableConnections);
    metrics.setGauge('connection_pool_pending', () => stats.pendingRequests);
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();

    for (const [systemId, connections] of this.connections) {
      const idleConnections = connections.filter(conn => 
        !conn.inUse && 
        (now - conn.lastUsedAt.getTime()) > this.maxIdleTime
      );

      for (const connection of idleConnections) {
        logger.debug('Cleaning up idle connection', { 
          systemId, 
          idleTime: now - connection.lastUsedAt.getTime() 
        });
        await this.closeConnection(connection, systemId);
      }
    }
  }

  private async storeConnectionInfo(systemId: string, connection: PooledConnection): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `cm:pool:${systemId}:${connection.createdAt.getTime()}`;
      const info = {
        systemId,
        createdAt: connection.createdAt.toISOString(),
        useCount: connection.useCount,
        inUse: connection.inUse
      };

      await this.redis.setex(key, 3600, JSON.stringify(info)); // 1 hour TTL
    } catch (error) {
      logger.error('Failed to store connection info in Redis', error as Error);
    }
  }
}

// Global connection pool instance
let globalPool: CMConnectionPool | null = null;

export function getConnectionPool(options?: any): CMConnectionPool {
  if (!globalPool) {
    globalPool = new CMConnectionPool(options);
  }
  return globalPool;
}

export async function closeConnectionPool(): Promise<void> {
  if (globalPool) {
    await globalPool.drain();
    globalPool = null;
  }
}