export interface LogContext {
  userId?: string;
  organizationId?: string;
  systemId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export interface LoggerConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  environment: string;
  serviceName: string;
  serviceVersion?: string;
  prettyPrint?: boolean;
  elasticsearch?: {
    node: string;
    index?: string;
    auth?: {
      username: string;
      password: string;
    };
  };
  redact?: {
    paths: string[];
    censor?: string;
  };
  sampling?: {
    enabled: boolean;
    rate: number;
  };
}

export interface MetricConfig {
  enabled: boolean;
  endpoint?: string;
  interval?: number;
  prefix?: string;
  labels?: Record<string, string>;
}

export interface TracingConfig {
  enabled: boolean;
  endpoint?: string;
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  samplingRate?: number;
}

export interface MonitoringConfig {
  logger: LoggerConfig;
  metrics?: MetricConfig;
  tracing?: TracingConfig;
}

export interface PerformanceMetrics {
  duration: number;
  cpu: number;
  memory: {
    used: number;
    total: number;
  };
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  details?: any;
}