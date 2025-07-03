import { CMConnector, CMConnectionConfig, CMQuery, CMHealthCheck, CMSystemInfo, CMError } from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';
import pRetry from 'p-retry';

const monitoring = getMonitoring();

export abstract class BaseConnector implements CMConnector {
  protected config: CMConnectionConfig;
  protected connected: boolean = false;
  protected logger: any;
  protected metrics: any;

  constructor(config: CMConnectionConfig) {
    this.config = config;
    this.logger = monitoring.getLogger({ 
      component: 'cm-connector',
      connectionType: config.type 
    });
    this.metrics = monitoring.getMetrics();
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract executeQuery<T = any>(query: CMQuery): Promise<T[]>;
  abstract getSystemInfo(): Promise<CMSystemInfo>;

  isConnected(): boolean {
    return this.connected;
  }

  async healthCheck(): Promise<CMHealthCheck> {
    const startTime = Date.now();
    const checks = {
      database: false,
      services: false,
      filesystem: false,
      network: false
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check database connectivity
      try {
        await this.executeQuery({ 
          sql: 'SELECT 1 as HEALTH_CHECK', 
          timeout: 5000 
        });
        checks.database = true;
      } catch (error) {
        errors.push(`Database check failed: ${error}`);
      }

      // Check network connectivity
      checks.network = this.connected;

      // Version-specific health checks
      const additionalChecks = await this.performAdditionalHealthChecks();
      Object.assign(checks, additionalChecks.checks);
      errors.push(...additionalChecks.errors);
      warnings.push(...additionalChecks.warnings);

      // Determine overall status
      const criticalChecks = ['database', 'network'];
      const hasCriticalFailure = criticalChecks.some(check => !checks[check as keyof typeof checks]);
      const hasWarnings = warnings.length > 0 || Object.values(checks).some(v => !v);

      let status: CMHealthCheck['status'] = 'healthy';
      if (!this.connected) {
        status = 'offline';
      } else if (hasCriticalFailure) {
        status = 'critical';
      } else if (hasWarnings) {
        status = 'warning';
      }

      const latency = Date.now() - startTime;

      this.metrics.record('cm_health_check_duration', latency, { 
        status, 
        version: this.config.type 
      });

      return {
        status,
        timestamp: new Date(),
        latency,
        checks,
        errors,
        warnings
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'critical',
        timestamp: new Date(),
        latency: Date.now() - startTime,
        checks,
        errors: [...errors, `Health check error: ${error}`],
        warnings
      };
    }
  }

  protected async performAdditionalHealthChecks(): Promise<{
    checks: Record<string, boolean>;
    errors: string[];
    warnings: string[];
  }> {
    // Override in subclasses for version-specific checks
    return { checks: {}, errors: [], warnings: [] };
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: pRetry.Options
  ): Promise<T> {
    const defaultOptions: pRetry.Options = {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 5000,
      onFailedAttempt: (error) => {
        this.logger.warn(
          `Operation failed, attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}`,
          { error: error.message }
        );
      }
    };

    return pRetry(operation, { ...defaultOptions, ...options });
  }

  protected handleError(error: any, operation: string): never {
    this.logger.error(`Operation failed: ${operation}`, error);
    this.metrics.increment('cm_connector_errors', { 
      operation, 
      type: this.config.type 
    });

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new CMError('CONNECTION_FAILED', `Connection failed: ${error.message}`, error);
    } else if (error.message?.includes('authentication') || error.message?.includes('login')) {
      throw new CMError('AUTHENTICATION_FAILED', `Authentication failed: ${error.message}`, error);
    } else if (error.message?.includes('permission') || error.message?.includes('access denied')) {
      throw new CMError('PERMISSION_DENIED', `Permission denied: ${error.message}`, error);
    } else if (error.code === 'ETIMEOUT' || error.message?.includes('timeout')) {
      throw new CMError('TIMEOUT', `Operation timed out: ${error.message}`, error);
    } else {
      throw new CMError('UNKNOWN_ERROR', `Unknown error in ${operation}: ${error.message}`, error);
    }
  }

  protected sanitizeConfig(config: CMConnectionConfig): CMConnectionConfig {
    const sanitized = { ...config };
    // Remove sensitive data for logging
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.apiKey) sanitized.apiKey = '***';
    if (sanitized.sshKey) sanitized.sshKey = '***';
    return sanitized;
  }
}