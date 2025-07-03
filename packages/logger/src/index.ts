export * from './types';
export * from './logger';
export * from './metrics';
export * from './tracing';
export * from './monitoring';

import { MonitoringService } from './monitoring';
import { MonitoringConfig } from './types';

// Default configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  logger: {
    level: process.env.LOG_LEVEL as any || 'info',
    environment: process.env.NODE_ENV || 'development',
    serviceName: process.env.SERVICE_NAME || 'cm-diagnostics',
    serviceVersion: process.env.SERVICE_VERSION,
    prettyPrint: process.env.NODE_ENV !== 'production',
    elasticsearch: process.env.ELASTICSEARCH_URL ? {
      node: process.env.ELASTICSEARCH_URL,
      index: process.env.ELASTICSEARCH_INDEX || 'cm-diagnostics-logs',
    } : undefined,
    redact: {
      paths: [
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'apiKey',
        'secret',
        '*.password',
        '*.token',
        '*.apiKey',
        'authorization',
        'cookie',
      ],
    },
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    endpoint: process.env.METRICS_ENDPOINT,
    interval: 60000,
    prefix: 'cm_diagnostics',
  },
  tracing: {
    enabled: process.env.TRACING_ENABLED === 'true',
    endpoint: process.env.TRACING_ENDPOINT,
    serviceName: process.env.SERVICE_NAME || 'cm-diagnostics',
    serviceVersion: process.env.SERVICE_VERSION,
    environment: process.env.NODE_ENV || 'development',
    samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '1.0'),
  },
};

// Singleton instance
let monitoringInstance: MonitoringService | null = null;

export function initializeMonitoring(config?: Partial<MonitoringConfig>): MonitoringService {
  if (!monitoringInstance) {
    const mergedConfig = {
      ...defaultMonitoringConfig,
      ...config,
      logger: {
        ...defaultMonitoringConfig.logger,
        ...config?.logger,
      },
      metrics: {
        ...defaultMonitoringConfig.metrics,
        ...config?.metrics,
      },
      tracing: {
        ...defaultMonitoringConfig.tracing,
        ...config?.tracing,
      },
    };
    
    monitoringInstance = new MonitoringService(mergedConfig);
  }
  return monitoringInstance;
}

export function getMonitoring(): MonitoringService {
  if (!monitoringInstance) {
    throw new Error('Monitoring not initialized. Call initializeMonitoring() first.');
  }
  return monitoringInstance;
}