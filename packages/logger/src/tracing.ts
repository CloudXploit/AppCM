import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { TracingConfig } from './types';

export class TracingService {
  private sdk: NodeSDK | null = null;
  private tracer: any;

  constructor(private config: TracingConfig) {
    if (config.enabled) {
      this.initialize();
    } else {
      this.tracer = trace.getTracer('noop');
    }
  }

  private initialize() {
    const exporter = new OTLPTraceExporter({
      url: this.config.endpoint || 'http://localhost:4318/v1/traces',
    });

    const resource = new Resource({
      [ATTR_SERVICE_NAME]: this.config.serviceName,
      [ATTR_SERVICE_VERSION]: this.config.serviceVersion || '0.0.0',
      environment: this.config.environment || process.env.NODE_ENV || 'development',
    });

    this.sdk = new NodeSDK({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
        }),
      ],
    });

    this.sdk.start();
    this.tracer = trace.getTracer(
      this.config.serviceName,
      this.config.serviceVersion
    );
  }

  // Create a new span
  startSpan(name: string, options?: {
    kind?: SpanKind;
    attributes?: Record<string, any>;
    parent?: any;
  }) {
    return this.tracer.startSpan(name, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    }, options?.parent ? trace.setSpan(context.active(), options.parent) : undefined);
  }

  // Create a span and execute function within its context
  async withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
    }
  ): Promise<T> {
    const span = this.startSpan(name, options);
    
    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Wrap a function to automatically create spans
  wrap<T extends (...args: any[]) => any>(
    name: string,
    fn: T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
    }
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.withSpan(
        name,
        () => fn(...args),
        options
      );
    }) as T;
  }

  // Get current span
  getCurrentSpan() {
    return trace.getSpan(context.active());
  }

  // Add event to current span
  addEvent(name: string, attributes?: Record<string, any>) {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // Set attributes on current span
  setAttributes(attributes: Record<string, any>) {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  // Record an exception on current span
  recordException(error: Error, attributes?: Record<string, any>) {
    const span = this.getCurrentSpan();
    if (span) {
      span.recordException(error, attributes);
    }
  }

  // Common span creators
  createHttpSpan(method: string, url: string, attributes?: Record<string, any>) {
    return this.startSpan(`HTTP ${method} ${url}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': method,
        'http.url': url,
        ...attributes,
      },
    });
  }

  createDatabaseSpan(operation: string, table: string, attributes?: Record<string, any>) {
    return this.startSpan(`DB ${operation} ${table}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.operation': operation,
        'db.table': table,
        ...attributes,
      },
    });
  }

  createQueueSpan(operation: string, queue: string, attributes?: Record<string, any>) {
    return this.startSpan(`Queue ${operation} ${queue}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        'messaging.operation': operation,
        'messaging.destination': queue,
        ...attributes,
      },
    });
  }

  // Shutdown tracing
  async shutdown() {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }
}