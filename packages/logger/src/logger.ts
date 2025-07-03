import pino, { Logger as PinoLogger } from 'pino';
import { pinoHttp } from 'pino-http';
import { LoggerConfig, LogContext, ErrorInfo } from './types';

export class Logger {
  private logger: PinoLogger;
  private config: LoggerConfig;
  private defaultContext: LogContext = {};

  constructor(config: LoggerConfig) {
    this.config = config;
    this.logger = this.createLogger();
  }

  private createLogger(): PinoLogger {
    const options: pino.LoggerOptions = {
      level: this.config.level,
      name: this.config.serviceName,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => ({
          pid: bindings.pid,
          hostname: bindings.hostname,
          service: this.config.serviceName,
          version: this.config.serviceVersion,
          environment: this.config.environment,
        }),
      },
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      redact: this.config.redact || {
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
        censor: '[REDACTED]',
      },
    };

    // Configure transport based on environment
    if (this.config.prettyPrint && this.config.environment !== 'production') {
      options.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      };
    }

    return pino(options);
  }

  setDefaultContext(context: LogContext) {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  child(context: LogContext): Logger {
    const childLogger = Object.create(this);
    childLogger.logger = this.logger.child(context);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    return childLogger;
  }

  trace(message: string, context?: LogContext) {
    this.logger.trace({ ...this.defaultContext, ...context }, message);
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug({ ...this.defaultContext, ...context }, message);
  }

  info(message: string, context?: LogContext) {
    this.logger.info({ ...this.defaultContext, ...context }, message);
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn({ ...this.defaultContext, ...context }, message);
  }

  error(message: string, error?: Error | ErrorInfo, context?: LogContext) {
    const errorInfo = this.formatError(error);
    this.logger.error(
      { ...this.defaultContext, ...context, ...errorInfo },
      message
    );
  }

  fatal(message: string, error?: Error | ErrorInfo, context?: LogContext) {
    const errorInfo = this.formatError(error);
    this.logger.fatal(
      { ...this.defaultContext, ...context, ...errorInfo },
      message
    );
  }

  // HTTP request logging middleware
  httpLogger() {
    return pinoHttp({
      logger: this.logger,
      customProps: (req) => ({
        ...this.defaultContext,
        requestId: req.id,
      }),
      customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },
      customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
      },
      customAttributeKeys: {
        req: 'request',
        res: 'response',
        err: 'error',
        responseTime: 'duration',
      },
      wrapSerializers: false,
    });
  }

  // Performance logging
  startTimer(operation: string, context?: LogContext): () => void {
    const start = process.hrtime.bigint();
    const startCpuUsage = process.cpuUsage();

    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      const endCpuUsage = process.cpuUsage(startCpuUsage);
      
      const cpuTime = (endCpuUsage.user + endCpuUsage.system) / 1000; // Convert to milliseconds
      const memoryUsage = process.memoryUsage();

      this.info(`Operation completed: ${operation}`, {
        ...context,
        performance: {
          operation,
          duration,
          cpu: cpuTime,
          memory: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
          },
        },
      });
    };
  }

  // Audit logging
  audit(action: string, context: LogContext & { 
    entityType?: string;
    entityId?: string;
    changes?: any;
    result?: 'success' | 'failure';
  }) {
    this.info(`Audit: ${action}`, {
      ...context,
      audit: true,
      action,
      timestamp: new Date().toISOString(),
    });
  }

  // Security logging
  security(event: string, context: LogContext & {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    attackType?: string;
    blocked?: boolean;
  }) {
    const level = context.severity === 'critical' || context.severity === 'high' 
      ? 'error' 
      : 'warn';
    
    this.logger[level]({
      ...this.defaultContext,
      ...context,
      security: true,
      event,
      timestamp: new Date().toISOString(),
    }, `Security event: ${event}`);
  }

  private formatError(error?: Error | ErrorInfo): ErrorInfo | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as any), // Include any custom properties
      };
    }

    return error;
  }

  // Get the underlying Pino logger instance
  getPinoLogger(): PinoLogger {
    return this.logger;
  }
}