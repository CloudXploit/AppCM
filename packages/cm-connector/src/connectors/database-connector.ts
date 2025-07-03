import { BaseConnector } from './base-connector';
import { CMConnectionConfig, CMQuery, CMSystemInfo, CMError } from '../types';
import { CMVersionDetector } from '../versions/version-detector';
import knex, { Knex } from 'knex';
import mssql from 'mssql';
import oracledb from 'oracledb';

export class DatabaseConnector extends BaseConnector {
  private knexInstance?: Knex;
  private mssqlPool?: mssql.ConnectionPool;
  private oraclePool?: oracledb.Pool;
  private databaseType: 'mssql' | 'oracledb' | null = null;

  async connect(): Promise<void> {
    this.logger.info('Connecting to Content Manager database', {
      host: this.config.host,
      database: this.config.database,
      type: this.config.type
    });

    try {
      // Detect database type based on port or configuration
      if (this.config.port === 1433 || this.config.additionalOptions?.driver === 'mssql') {
        await this.connectMSSql();
        this.databaseType = 'mssql';
      } else if (this.config.port === 1521 || this.config.additionalOptions?.driver === 'oracledb') {
        await this.connectOracle();
        this.databaseType = 'oracledb';
      } else {
        // Try both and see which works
        try {
          await this.connectMSSql();
          this.databaseType = 'mssql';
        } catch (mssqlError) {
          this.logger.debug('MSSQL connection failed, trying Oracle', mssqlError);
          await this.connectOracle();
          this.databaseType = 'oracledb';
        }
      }

      this.connected = true;
      this.logger.info('Successfully connected to Content Manager database', {
        databaseType: this.databaseType
      });

      this.metrics.increment('cm_db_connections_success', {
        databaseType: this.databaseType
      });
    } catch (error) {
      this.metrics.increment('cm_db_connections_failed');
      this.handleError(error, 'connect');
    }
  }

  private async connectMSSql(): Promise<void> {
    const config: mssql.config = {
      server: this.config.host,
      port: this.config.port || 1433,
      database: this.config.database!,
      user: this.config.username!,
      password: this.config.password!,
      options: {
        encrypt: this.config.encrypted || false,
        trustServerCertificate: this.config.trustServerCertificate || false,
        connectTimeout: this.config.connectionTimeout || 30000,
        requestTimeout: this.config.requestTimeout || 30000,
      },
      pool: {
        max: this.config.poolSize || 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    this.mssqlPool = await mssql.connect(config);

    // Also create Knex instance for query building
    this.knexInstance = knex({
      client: 'mssql',
      connection: {
        server: this.config.host,
        port: this.config.port || 1433,
        database: this.config.database!,
        user: this.config.username!,
        password: this.config.password!,
        options: {
          encrypt: this.config.encrypted || false,
          trustServerCertificate: this.config.trustServerCertificate || false,
        },
      },
      pool: {
        min: 0,
        max: this.config.poolSize || 10,
      },
    });
  }

  private async connectOracle(): Promise<void> {
    // Initialize Oracle client if needed
    if (!oracledb.initOracleClient) {
      this.logger.warn('Oracle Instant Client not initialized');
    }

    const connectionString = this.config.additionalOptions?.connectionString ||
      `${this.config.host}:${this.config.port || 1521}/${this.config.database}`;

    this.oraclePool = await oracledb.createPool({
      user: this.config.username!,
      password: this.config.password!,
      connectionString,
      poolMax: this.config.poolSize || 10,
      poolMin: 0,
      poolTimeout: 60,
      queueTimeout: 60000,
    });

    // Create Knex instance for Oracle
    this.knexInstance = knex({
      client: 'oracledb',
      connection: {
        user: this.config.username!,
        password: this.config.password!,
        connectionString,
      },
      pool: {
        min: 0,
        max: this.config.poolSize || 10,
      },
    });
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from Content Manager database');

    try {
      if (this.mssqlPool) {
        await this.mssqlPool.close();
        this.mssqlPool = undefined;
      }

      if (this.oraclePool) {
        await this.oraclePool.close();
        this.oraclePool = undefined;
      }

      if (this.knexInstance) {
        await this.knexInstance.destroy();
        this.knexInstance = undefined;
      }

      this.connected = false;
      this.databaseType = null;

      this.logger.info('Successfully disconnected from Content Manager database');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
      throw error;
    }
  }

  async executeQuery<T = any>(query: CMQuery): Promise<T[]> {
    if (!this.connected) {
      throw new CMError('CONNECTION_FAILED', 'Not connected to database');
    }

    const startTime = Date.now();

    try {
      let result: T[];

      if (this.databaseType === 'mssql' && this.mssqlPool) {
        result = await this.executeMSSqlQuery<T>(query);
      } else if (this.databaseType === 'oracledb' && this.oraclePool) {
        result = await this.executeOracleQuery<T>(query);
      } else {
        throw new Error('No active database connection');
      }

      const duration = Date.now() - startTime;
      this.metrics.record('cm_query_duration', duration, {
        databaseType: this.databaseType!,
        queryType: this.getQueryType(query.sql),
      });

      return result;
    } catch (error) {
      this.metrics.increment('cm_query_errors', {
        databaseType: this.databaseType!,
        errorType: (error as any).code || 'unknown',
      });
      this.handleError(error, 'executeQuery');
    }
  }

  private async executeMSSqlQuery<T>(query: CMQuery): Promise<T[]> {
    const request = this.mssqlPool!.request();

    // Set timeout if specified
    if (query.timeout) {
      request.timeout = query.timeout;
    }

    // Add parameters if provided
    if (query.params && Array.isArray(query.params)) {
      query.params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });
    }

    const result = await request.query(query.sql);
    return result.recordset as T[];
  }

  private async executeOracleQuery<T>(query: CMQuery): Promise<T[]> {
    let connection: oracledb.Connection | undefined;

    try {
      connection = await this.oraclePool!.getConnection();

      const options: oracledb.ExecuteOptions = {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        timeout: query.timeout || 30000,
      };

      const result = await connection.execute(
        query.sql,
        query.params || [],
        options
      );

      return (result.rows || []) as T[];
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  async getSystemInfo(): Promise<CMSystemInfo> {
    return CMVersionDetector.detectVersion(this);
  }

  protected async performAdditionalHealthChecks(): Promise<{
    checks: Record<string, boolean>;
    errors: string[];
    warnings: string[];
  }> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check table accessibility
    try {
      await this.executeQuery({
        sql: 'SELECT COUNT(*) as CNT FROM TSYSTEM',
        timeout: 5000,
      });
      checks.tables = true;
    } catch (error) {
      checks.tables = false;
      errors.push(`Cannot access system tables: ${error}`);
    }

    // Check database space
    try {
      const spaceQuery = this.databaseType === 'mssql'
        ? `
          SELECT 
            SUM(size * 8 / 1024) as TOTAL_MB,
            SUM(CASE WHEN max_size = -1 THEN 0 ELSE (max_size - size) * 8 / 1024 END) as AVAILABLE_MB
          FROM sys.database_files
        `
        : `
          SELECT 
            SUM(bytes) / 1024 / 1024 as TOTAL_MB,
            SUM(maxbytes - bytes) / 1024 / 1024 as AVAILABLE_MB
          FROM dba_data_files
        `;

      const spaceResult = await this.executeQuery({ sql: spaceQuery, timeout: 5000 });
      
      if (spaceResult[0]?.AVAILABLE_MB < 1000) {
        warnings.push('Low database space available (< 1GB)');
      }
      
      checks.storage = true;
    } catch (error) {
      checks.storage = false;
      warnings.push(`Cannot check database space: ${error}`);
    }

    return { checks, errors, warnings };
  }

  private getQueryType(sql: string): string {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  // Expose Knex instance for query building
  getQueryBuilder(): Knex | undefined {
    return this.knexInstance;
  }
}