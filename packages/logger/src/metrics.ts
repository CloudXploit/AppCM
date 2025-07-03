import { metrics, ValueType } from '@opentelemetry/api';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { MetricConfig } from './types';

export class MetricsCollector {
  private meterProvider: MeterProvider;
  private meter: any;
  private counters: Map<string, any> = new Map();
  private histograms: Map<string, any> = new Map();
  private gauges: Map<string, any> = new Map();

  constructor(private config: MetricConfig & { serviceName: string; serviceVersion?: string }) {
    if (!config.enabled) {
      this.meter = metrics.getMeter('noop');
      return;
    }

    this.meterProvider = this.createMeterProvider();
    this.meter = this.meterProvider.getMeter(
      config.serviceName,
      config.serviceVersion
    );
    this.initializeMetrics();
  }

  private createMeterProvider(): MeterProvider {
    const exporter = new OTLPMetricExporter({
      url: this.config.endpoint || 'http://localhost:4318/v1/metrics',
    });

    const meterProvider = new MeterProvider({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: this.config.serviceName,
        [ATTR_SERVICE_VERSION]: this.config.serviceVersion || '0.0.0',
        environment: process.env.NODE_ENV || 'development',
        ...this.config.labels,
      }),
      readers: [
        new PeriodicExportingMetricReader({
          exporter,
          exportIntervalMillis: this.config.interval || 60000,
        }),
      ],
    });

    metrics.setGlobalMeterProvider(meterProvider);
    return meterProvider;
  }

  private initializeMetrics() {
    const prefix = this.config.prefix || 'cm_diagnostics';

    // System metrics
    this.createCounter(`${prefix}_requests_total`, 'Total number of requests');
    this.createHistogram(`${prefix}_request_duration`, 'Request duration in milliseconds');
    this.createGauge(`${prefix}_active_connections`, 'Number of active connections');
    
    // Business metrics
    this.createCounter(`${prefix}_diagnostics_run_total`, 'Total diagnostic runs');
    this.createCounter(`${prefix}_issues_detected_total`, 'Total issues detected');
    this.createCounter(`${prefix}_remediations_executed_total`, 'Total remediations executed');
    this.createHistogram(`${prefix}_diagnostic_duration`, 'Diagnostic run duration');
    
    // Error metrics
    this.createCounter(`${prefix}_errors_total`, 'Total number of errors');
    this.createCounter(`${prefix}_login_attempts_total`, 'Total login attempts');
    this.createCounter(`${prefix}_failed_logins_total`, 'Total failed login attempts');
  }

  private createCounter(name: string, description: string) {
    const counter = this.meter.createCounter(name, {
      description,
      valueType: ValueType.INT,
    });
    this.counters.set(name, counter);
    return counter;
  }

  private createHistogram(name: string, description: string, boundaries?: number[]) {
    const histogram = this.meter.createHistogram(name, {
      description,
      valueType: ValueType.DOUBLE,
      boundaries,
    });
    this.histograms.set(name, histogram);
    return histogram;
  }

  private createGauge(name: string, description: string) {
    const gauge = this.meter.createObservableGauge(name, {
      description,
      valueType: ValueType.DOUBLE,
    });
    this.gauges.set(name, gauge);
    return gauge;
  }

  // Increment counter
  increment(name: string, labels: Record<string, string> = {}, value: number = 1) {
    const counter = this.counters.get(name);
    if (counter) {
      counter.add(value, labels);
    }
  }

  // Record histogram value
  record(name: string, value: number, labels: Record<string, string> = {}) {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.record(value, labels);
    }
  }

  // Set gauge value
  setGauge(name: string, callback: () => number, labels: Record<string, string> = {}) {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.addCallback((result) => {
        result.observe(callback(), labels);
      });
    }
  }

  // Helper methods for common metrics
  recordRequest(method: string, path: string, statusCode: number, duration: number) {
    const labels = { method, path, status: statusCode.toString() };
    this.increment(`${this.config.prefix}_requests_total`, labels);
    this.record(`${this.config.prefix}_request_duration`, duration, labels);
  }

  recordError(type: string, severity: string) {
    this.increment(`${this.config.prefix}_errors_total`, { type, severity });
  }

  recordDiagnosticRun(systemId: string, status: string, duration: number, issueCount: number) {
    const labels = { system_id: systemId, status };
    this.increment(`${this.config.prefix}_diagnostics_run_total`, labels);
    this.record(`${this.config.prefix}_diagnostic_duration`, duration, labels);
    this.increment(`${this.config.prefix}_issues_detected_total`, labels, issueCount);
  }

  recordRemediation(type: string, status: string) {
    this.increment(`${this.config.prefix}_remediations_executed_total`, { type, status });
  }

  recordLogin(success: boolean) {
    this.increment(`${this.config.prefix}_login_attempts_total`);
    if (!success) {
      this.increment(`${this.config.prefix}_failed_logins_total`);
    }
  }

  // Shutdown metrics collection
  async shutdown() {
    if (this.meterProvider) {
      await this.meterProvider.shutdown();
    }
  }
}