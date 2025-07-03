// Streaming Analytics
// Real-time analytics processing and streaming

import { EventEmitter } from 'events';
import {
  StreamingAnalytics as StreamingAnalyticsType,
  StreamSource,
  StreamProcessor,
  StreamSink,
  WindowConfig,
  StreamStatus,
  StreamMetrics,
  StreamError,
  ProcessorConfig,
  AnalyticsEvent,
  AnalyticsEventType
} from '../types';
import { logger } from '@cm-diagnostics/logger';
import { v4 as uuidv4 } from 'uuid';
import { Observable, Subject, interval, merge } from 'rxjs';
import {
  buffer,
  bufferTime,
  filter,
  map,
  scan,
  share,
  tap,
  window,
  windowTime,
  catchError,
  retry
} from 'rxjs/operators';

export interface StreamingConfig {
  maxConcurrentStreams?: number;
  defaultWindowSize?: number;
  checkpointInterval?: number;
  enableBackpressure?: boolean;
  maxBufferSize?: number;
}

export class StreamingAnalytics extends EventEmitter {
  private streams: Map<string, StreamingAnalyticsType> = new Map();
  private activeStreams: Map<string, StreamInstance> = new Map();
  private config: Required<StreamingConfig>;
  private processors: Map<string, ProcessorFunction> = new Map();

  constructor(config: StreamingConfig = {}) {
    super();
    
    this.config = {
      maxConcurrentStreams: 10,
      defaultWindowSize: 60000, // 1 minute
      checkpointInterval: 30000, // 30 seconds
      enableBackpressure: true,
      maxBufferSize: 10000,
      ...config
    };

    this.initializeProcessors();
    logger.info('Streaming Analytics initialized', { config: this.config });
  }

  private initializeProcessors(): void {
    // Register built-in processors
    this.registerProcessor('filter', this.createFilterProcessor());
    this.registerProcessor('transform', this.createTransformProcessor());
    this.registerProcessor('aggregate', this.createAggregateProcessor());
    this.registerProcessor('join', this.createJoinProcessor());
    this.registerProcessor('ml', this.createMLProcessor());
  }

  registerProcessor(name: string, processor: ProcessorFunction): void {
    this.processors.set(name, processor);
    logger.debug('Stream processor registered', { name });
  }

  async createStream(config: Omit<StreamingAnalyticsType, 'id' | 'status'>): Promise<StreamingAnalyticsType> {
    if (this.streams.size >= this.config.maxConcurrentStreams) {
      throw new Error(`Maximum concurrent streams (${this.config.maxConcurrentStreams}) reached`);
    }

    const stream: StreamingAnalyticsType = {
      ...config,
      id: uuidv4(),
      status: {
        state: 'stopped',
        metrics: {
          eventsProcessed: 0,
          throughput: 0,
          latency: { p50: 0, p95: 0, p99: 0, max: 0 },
          backpressure: 0
        },
        errors: []
      }
    };

    this.validateStream(stream);
    this.streams.set(stream.id, stream);

    this.emit('streamCreated', stream);
    logger.info('Stream created', { id: stream.id, name: stream.name });

    return stream;
  }

  private validateStream(stream: StreamingAnalyticsType): void {
    // Validate sources
    if (stream.sources.length === 0) {
      throw new Error('Stream must have at least one source');
    }

    // Validate processors
    for (const processor of stream.processors) {
      if (!this.processors.has(processor.type) && processor.type !== 'custom') {
        throw new Error(`Unknown processor type: ${processor.type}`);
      }
    }

    // Validate sinks
    if (stream.sinks.length === 0) {
      throw new Error('Stream must have at least one sink');
    }
  }

  async startStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    if (this.activeStreams.has(streamId)) {
      throw new Error(`Stream ${streamId} is already running`);
    }

    const instance = new StreamInstance(stream, this.processors, this.config);
    this.activeStreams.set(streamId, instance);

    instance.on('metrics', (metrics: StreamMetrics) => {
      stream.status.metrics = metrics;
      this.emit('streamMetrics', { streamId, metrics });
    });

    instance.on('error', (error: StreamError) => {
      stream.status.errors.push(error);
      this.emit('streamError', { streamId, error });
    });

    instance.on('event', (event: AnalyticsEvent) => {
      this.emit('analyticsEvent', event);
    });

    await instance.start();
    stream.status.state = 'running';

    this.emit('streamStarted', { streamId });
    logger.info('Stream started', { streamId });
  }

  async stopStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const instance = this.activeStreams.get(streamId);
    if (!instance) {
      throw new Error(`Stream ${streamId} is not running`);
    }

    await instance.stop();
    this.activeStreams.delete(streamId);
    stream.status.state = 'stopped';

    this.emit('streamStopped', { streamId });
    logger.info('Stream stopped', { streamId });
  }

  async pauseStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const instance = this.activeStreams.get(streamId);
    if (!instance) {
      throw new Error(`Stream ${streamId} is not running`);
    }

    await instance.pause();
    stream.status.state = 'paused';

    this.emit('streamPaused', { streamId });
  }

  async resumeStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const instance = this.activeStreams.get(streamId);
    if (!instance) {
      throw new Error(`Stream ${streamId} is not active`);
    }

    await instance.resume();
    stream.status.state = 'running';

    this.emit('streamResumed', { streamId });
  }

  getStream(streamId: string): StreamingAnalyticsType | undefined {
    return this.streams.get(streamId);
  }

  listStreams(): StreamingAnalyticsType[] {
    return Array.from(this.streams.values());
  }

  getStreamMetrics(streamId: string): StreamMetrics | undefined {
    const stream = this.streams.get(streamId);
    return stream?.status.metrics;
  }

  // Processor implementations
  private createFilterProcessor(): ProcessorFunction {
    return (config: ProcessorConfig) => {
      return (source$: Observable<any>) => {
        const condition = config.parameters.condition;
        return source$.pipe(
          filter(event => this.evaluateCondition(event, condition))
        );
      };
    };
  }

  private createTransformProcessor(): ProcessorFunction {
    return (config: ProcessorConfig) => {
      return (source$: Observable<any>) => {
        const transformation = config.parameters.transformation;
        return source$.pipe(
          map(event => this.applyTransformation(event, transformation))
        );
      };
    };
  }

  private createAggregateProcessor(): ProcessorFunction {
    return (config: ProcessorConfig) => {
      return (source$: Observable<any>) => {
        const { method, field, windowSize = 60000 } = config.parameters;
        
        return source$.pipe(
          windowTime(windowSize),
          map(window$ => window$.pipe(
            scan((acc, event) => {
              const value = this.extractFieldValue(event, field);
              
              switch (method) {
                case 'sum':
                  return acc + value;
                case 'avg':
                  return { sum: acc.sum + value, count: acc.count + 1 };
                case 'min':
                  return Math.min(acc, value);
                case 'max':
                  return Math.max(acc, value);
                case 'count':
                  return acc + 1;
                default:
                  return acc;
              }
            }, method === 'avg' ? { sum: 0, count: 0 } : 0),
            map(result => {
              if (method === 'avg' && result.count > 0) {
                return result.sum / result.count;
              }
              return result;
            })
          )),
          share()
        );
      };
    };
  }

  private createJoinProcessor(): ProcessorFunction {
    return (config: ProcessorConfig) => {
      return (source$: Observable<any>) => {
        // Simplified join - in production would handle multiple streams
        const { joinKey, joinWindow = 5000 } = config.parameters;
        
        return source$.pipe(
          bufferTime(joinWindow),
          map(events => {
            // Group by join key
            const grouped = new Map<string, any[]>();
            
            events.forEach(event => {
              const key = this.extractFieldValue(event, joinKey);
              if (!grouped.has(key)) {
                grouped.set(key, []);
              }
              grouped.get(key)!.push(event);
            });
            
            // Return joined results
            return Array.from(grouped.entries()).map(([key, group]) => ({
              key,
              events: group,
              timestamp: new Date()
            }));
          })
        );
      };
    };
  }

  private createMLProcessor(): ProcessorFunction {
    return (config: ProcessorConfig) => {
      return (source$: Observable<any>) => {
        const { modelId, features } = config.parameters;
        
        return source$.pipe(
          map(event => {
            // Extract features
            const featureVector = features.map((f: string) => 
              this.extractFieldValue(event, f)
            );
            
            // Simulate ML prediction
            const prediction = this.simulateMLPrediction(modelId, featureVector);
            
            return {
              ...event,
              prediction,
              modelId,
              timestamp: new Date()
            };
          })
        );
      };
    };
  }

  private evaluateCondition(event: any, condition: string): boolean {
    try {
      // Simple condition evaluation - in production use a proper evaluator
      return eval(condition);
    } catch {
      return true;
    }
  }

  private applyTransformation(event: any, transformation: any): any {
    if (typeof transformation === 'function') {
      return transformation(event);
    }
    
    // Apply simple transformations
    const result = { ...event };
    
    Object.entries(transformation).forEach(([key, value]) => {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Field reference
        result[key] = this.extractFieldValue(event, value.slice(1));
      } else {
        result[key] = value;
      }
    });
    
    return result;
  }

  private extractFieldValue(event: any, field: string): any {
    const parts = field.split('.');
    let value = event;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    
    return value;
  }

  private simulateMLPrediction(modelId: string, features: number[]): number {
    // Simulate prediction
    return features.reduce((a, b) => a + b, 0) / features.length * Math.random();
  }

  destroy(): void {
    // Stop all active streams
    this.activeStreams.forEach((instance, streamId) => {
      instance.stop();
    });
    this.activeStreams.clear();
    
    this.removeAllListeners();
  }
}

// Stream instance that handles the actual processing
class StreamInstance extends EventEmitter {
  private stream: StreamingAnalyticsType;
  private processors: Map<string, ProcessorFunction>;
  private config: Required<StreamingConfig>;
  private sources$: Subject<any>[] = [];
  private subscription: any;
  private metricsInterval?: NodeJS.Timeout;
  private latencyBuffer: number[] = [];
  private eventsProcessed = 0;
  private lastEventTime = Date.now();

  constructor(
    stream: StreamingAnalyticsType,
    processors: Map<string, ProcessorFunction>,
    config: Required<StreamingConfig>
  ) {
    super();
    this.stream = stream;
    this.processors = processors;
    this.config = config;
  }

  async start(): Promise<void> {
    // Create source observables
    this.sources$ = this.stream.sources.map(source => 
      this.createSourceObservable(source)
    );

    // Merge all sources
    let pipeline$ = merge(...this.sources$);

    // Apply processors
    for (const processor of this.stream.processors) {
      const processorFn = this.processors.get(processor.type);
      if (processorFn) {
        pipeline$ = processorFn(processor.config)(pipeline$);
      }
    }

    // Apply window if configured
    if (this.stream.windowConfig) {
      pipeline$ = this.applyWindow(pipeline$, this.stream.windowConfig);
    }

    // Subscribe and route to sinks
    this.subscription = pipeline$.pipe(
      tap(event => this.updateMetrics(event)),
      catchError((error, caught) => {
        this.handleError(error);
        return caught;
      }),
      retry(3)
    ).subscribe(
      event => this.routeToSinks(event),
      error => this.handleError(error)
    );

    // Start metrics reporting
    this.startMetricsReporting();
  }

  async stop(): Promise<void> {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.sources$.forEach(source => source.complete());

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  async pause(): Promise<void> {
    // Pause processing
    this.sources$.forEach(source => source.complete());
  }

  async resume(): Promise<void> {
    // Resume processing
    await this.start();
  }

  private createSourceObservable(source: StreamSource): Subject<any> {
    const subject = new Subject<any>();

    switch (source.type) {
      case 'metrics':
        // Simulate metrics stream
        interval(1000).subscribe(() => {
          subject.next({
            type: 'metric',
            systemId: `system-${Math.floor(Math.random() * 5) + 1}`,
            metric: 'cpu_usage',
            value: Math.random() * 100,
            timestamp: new Date()
          });
        });
        break;

      case 'events':
        // Simulate event stream
        interval(5000).subscribe(() => {
          subject.next({
            type: 'event',
            eventType: 'system_alert',
            severity: Math.random() > 0.5 ? 'warning' : 'info',
            message: 'System event occurred',
            timestamp: new Date()
          });
        });
        break;

      case 'websocket':
        // Would connect to WebSocket
        break;

      case 'kafka':
        // Would connect to Kafka
        break;
    }

    return subject;
  }

  private applyWindow(
    source$: Observable<any>,
    config: WindowConfig
  ): Observable<any> {
    switch (config.type) {
      case 'tumbling':
        return source$.pipe(
          bufferTime(config.size),
          filter(buffer => buffer.length > 0)
        );

      case 'sliding':
        return source$.pipe(
          windowTime(config.size, config.slide || config.size / 2),
          map(window$ => window$.pipe(scan((acc, val) => [...acc, val], [])))
        );

      case 'session':
        // Simplified session window
        return source$.pipe(
          buffer(source$.pipe(debounceTime(config.gap || 30000)))
        );

      default:
        return source$;
    }
  }

  private routeToSinks(event: any): void {
    this.stream.sinks.forEach(sink => {
      try {
        this.sendToSink(event, sink);
      } catch (error) {
        if (sink.errorHandling) {
          this.handleSinkError(error, sink, event);
        } else {
          throw error;
        }
      }
    });
  }

  private sendToSink(event: any, sink: StreamSink): void {
    switch (sink.type) {
      case 'dashboard':
        this.emit('event', {
          type: AnalyticsEventType.WIDGET_UPDATE,
          timestamp: new Date(),
          data: event
        });
        break;

      case 'storage':
        // Would write to storage
        logger.debug('Writing to storage', { event });
        break;

      case 'alert':
        if (this.shouldTriggerAlert(event, sink.config)) {
          this.emit('event', {
            type: AnalyticsEventType.STREAM_ALERT,
            timestamp: new Date(),
            data: {
              alert: sink.config.alertName,
              event
            }
          });
        }
        break;

      case 'websocket':
        // Would send via WebSocket
        break;

      case 'kafka':
        // Would send to Kafka
        break;
    }
  }

  private shouldTriggerAlert(event: any, config: any): boolean {
    if (!config.condition) return false;
    
    try {
      return eval(config.condition);
    } catch {
      return false;
    }
  }

  private handleSinkError(error: any, sink: StreamSink, event: any): void {
    const errorConfig = sink.errorHandling!;
    
    switch (errorConfig.strategy) {
      case 'retry':
        // Implement retry logic
        logger.warn('Sink error, retrying', { sink: sink.id, error });
        break;

      case 'dead_letter':
        // Send to dead letter queue
        logger.warn('Sending to dead letter', { event, error });
        break;

      case 'ignore':
        // Log and continue
        logger.debug('Ignoring sink error', { sink: sink.id, error });
        break;

      case 'fail':
        throw error;
    }
  }

  private updateMetrics(event: any): void {
    this.eventsProcessed++;
    
    const now = Date.now();
    const latency = now - this.lastEventTime;
    this.latencyBuffer.push(latency);
    
    // Keep only recent latencies
    if (this.latencyBuffer.length > 1000) {
      this.latencyBuffer.shift();
    }
    
    this.lastEventTime = now;
  }

  private startMetricsReporting(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.calculateMetrics();
      this.emit('metrics', metrics);
    }, 5000); // Report every 5 seconds
  }

  private calculateMetrics(): StreamMetrics {
    const sortedLatencies = [...this.latencyBuffer].sort((a, b) => a - b);
    const throughput = this.eventsProcessed / 5; // Events per second
    
    return {
      eventsProcessed: this.eventsProcessed,
      throughput,
      latency: {
        p50: this.percentile(sortedLatencies, 0.5),
        p95: this.percentile(sortedLatencies, 0.95),
        p99: this.percentile(sortedLatencies, 0.99),
        max: Math.max(...sortedLatencies, 0)
      },
      backpressure: this.sources$.reduce((sum, source) => 
        sum + (source.observers.length > 0 ? 0 : 1), 0
      ) / this.sources$.length
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private handleError(error: any): void {
    const streamError: StreamError = {
      timestamp: new Date(),
      processor: 'unknown',
      error: error.message || String(error),
      count: 1
    };
    
    this.emit('error', streamError);
    logger.error('Stream processing error', { streamId: this.stream.id, error });
  }
}

type ProcessorFunction = (config: ProcessorConfig) => (source$: Observable<any>) => Observable<any>;

// Fix for missing debounceTime import
import { debounceTime } from 'rxjs/operators';