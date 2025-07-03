import { Logger } from './logger';
import { MetricsCollector } from './metrics';
import { TracingService } from './tracing';
import { MonitoringConfig, LogContext } from './types';
import { EventEmitter } from 'events';

export class MonitoringService extends EventEmitter {
  private logger: Logger;
  private metrics: MetricsCollector;
  private tracing: TracingService;
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();
  private isShuttingDown = false;

  constructor(private config: MonitoringConfig) {
    super();
    
    this.logger = new Logger(config.logger);
    this.metrics = new MetricsCollector({
      ...config.metrics!,
      serviceName: config.logger.serviceName,
      serviceVersion: config.logger.serviceVersion,
    });
    this.tracing = new TracingService({
      ...config.tracing!,
      serviceName: config.logger.serviceName,
      serviceVersion: config.logger.serviceVersion,
    });

    this.setupGracefulShutdown();
    this.setupErrorHandlers();
  }

  // Get logger instance
  getLogger(context?: LogContext): Logger {
    return context ? this.logger.child(context) : this.logger;
  }

  // Get metrics collector
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  // Get tracing service
  getTracing(): TracingService {
    return this.tracing;
  }

  // Register health check
  registerHealthCheck(name: string, check: () => Promise<boolean>) {
    this.healthChecks.set(name, check);
    this.logger.info(`Health check registered: ${name}`);
  }

  // Perform health checks
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, boolean>;
    timestamp: Date;
  }> {
    const checks: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [name, check] of this.healthChecks) {
      try {
        const isHealthy = await check();
        checks[name] = isHealthy;
        if (!isHealthy) allHealthy = false;
      } catch (error) {
        checks[name] = false;
        allHealthy = false;
        this.logger.error(`Health check failed: ${name}`, error as Error);
      }
    }

    const result = {
      status: allHealthy ? 'healthy' : 'unhealthy' as const,
      checks,
      timestamp: new Date(),
    };

    this.metrics.setGauge('health_status', () => allHealthy ? 1 : 0);
    return result;
  }

  // Monitor async operation
  async monitorOperation<T>(
    name: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const logger = this.getLogger(context);
    const timer = logger.startTimer(name, context);
    
    return this.tracing.withSpan(name, async () => {
      try {
        logger.debug(`Starting operation: ${name}`, context);
        const result = await operation();
        timer();
        this.metrics.increment('operations_success_total', { operation: name });
        return result;
      } catch (error) {
        timer();
        this.metrics.increment('operations_failure_total', { operation: name });
        logger.error(`Operation failed: ${name}`, error as Error, context);
        throw error;
      }
    });
  }

  // Create middleware for Express
  middleware() {
    return {
      logger: this.logger.httpLogger(),
      metrics: (req: any, res: any, next: any) => {
        const start = Date.now();
        
        res.on('finish', () => {
          const duration = Date.now() - start;
          this.metrics.recordRequest(
            req.method,
            req.route?.path || req.path,
            res.statusCode,
            duration
          );
        });
        
        next();
      },
      tracing: (req: any, res: any, next: any) => {
        const span = this.tracing.createHttpSpan(req.method, req.url, {
          'http.target': req.url,
          'http.host': req.hostname,
          'http.scheme': req.protocol,
          'http.user_agent': req.get('user-agent'),
        });

        res.on('finish', () => {
          span.setAttributes({
            'http.status_code': res.statusCode,
            'http.response_content_length': res.get('content-length') || 0,
          });
          span.end();
        });

        next();
      },
    };
  }

  // Setup graceful shutdown
  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      this.logger.info(`Received ${signal}, starting graceful shutdown`);
      this.emit('shutdown', signal);

      try {
        // Give some time for ongoing operations
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Shutdown monitoring services
        await Promise.all([
          this.metrics.shutdown(),
          this.tracing.shutdown(),
        ]);

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  // Setup error handlers
  private setupErrorHandlers() {
    process.on('uncaughtException', (error) => {
      this.logger.fatal('Uncaught exception', error);
      this.metrics.recordError('uncaught_exception', 'fatal');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', reason as Error, {
        promise: promise.toString(),
      });
      this.metrics.recordError('unhandled_rejection', 'error');
    });
  }

  // Alert management
  async sendAlert(
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    context?: LogContext
  ) {
    const alert = {
      severity,
      title,
      message,
      timestamp: new Date(),
      context,
    };

    this.logger[severity === 'critical' ? 'error' : severity](`Alert: ${title}`, {
      alert,
      ...context,
    });

    this.emit('alert', alert);
    this.metrics.increment('alerts_total', { severity });

    // TODO: Integrate with external alerting services (PagerDuty, Slack, etc.)
  }

  // Performance monitoring
  createPerformanceObserver() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.record('browser_performance', entry.duration, {
            type: entry.entryType,
            name: entry.name,
          });
        }
      });

      observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
      return observer;
    }
    return null;
  }
}