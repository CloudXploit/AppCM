// Analytics & ML Types
// Core type definitions for analytics, dashboards, ML pipelines, and visualizations

import { SystemMetrics, Finding, DiagnosticResult } from '@cm-diagnostics/diagnostics';
import { Anomaly, Prediction, Pattern, RootCauseAnalysis } from '@cm-diagnostics/advanced-diagnostics';

// Dashboard Types
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  type: DashboardType;
  layout: DashboardLayout;
  widgets: Widget[];
  filters: DashboardFilter[];
  refreshInterval?: number; // seconds
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];
  permissions: DashboardPermissions;
}

export enum DashboardType {
  OVERVIEW = 'overview',
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  CAPACITY = 'capacity',
  CUSTOM = 'custom'
}

export interface DashboardLayout {
  type: 'grid' | 'flex' | 'absolute';
  columns?: number;
  rows?: number;
  breakpoints?: Record<string, number>;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  dataSource: DataSource;
  visualization: VisualizationConfig;
  position: WidgetPosition;
  size: WidgetSize;
  refreshInterval?: number;
  interactions?: WidgetInteraction[];
}

export enum WidgetType {
  METRIC_CARD = 'metric_card',
  TIME_SERIES = 'time_series',
  HEATMAP = 'heatmap',
  PIE_CHART = 'pie_chart',
  BAR_CHART = 'bar_chart',
  SCATTER_PLOT = 'scatter_plot',
  GAUGE = 'gauge',
  TABLE = 'table',
  MAP = 'map',
  SANKEY = 'sankey',
  NETWORK_GRAPH = 'network_graph',
  CUSTOM = 'custom'
}

export interface WidgetPosition {
  x: number;
  y: number;
  z?: number;
}

export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface DataSource {
  type: 'metrics' | 'findings' | 'anomalies' | 'predictions' | 'custom';
  query: DataQuery;
  transforms?: DataTransform[];
}

export interface DataQuery {
  systems?: string[];
  metrics?: string[];
  timeRange?: TimeRange;
  aggregation?: AggregationConfig;
  filters?: QueryFilter[];
  limit?: number;
  sort?: SortConfig[];
}

export interface TimeRange {
  start: Date | string; // ISO string or relative like 'now-1h'
  end: Date | string;
}

export interface AggregationConfig {
  method: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'percentile' | 'stddev';
  interval?: string; // e.g., '5m', '1h', '1d'
  groupBy?: string[];
  percentile?: number;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
  value: any;
}

export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export interface DataTransform {
  type: 'map' | 'filter' | 'reduce' | 'pivot' | 'join' | 'calculate';
  config: Record<string, any>;
}

export interface VisualizationConfig {
  type: string;
  options: Record<string, any>;
  theme?: VisualizationTheme;
}

export interface VisualizationTheme {
  colors?: string[];
  backgroundColor?: string;
  textColor?: string;
  gridColor?: string;
  font?: string;
}

export interface WidgetInteraction {
  type: 'click' | 'hover' | 'select' | 'brush' | 'zoom';
  action: InteractionAction;
}

export interface InteractionAction {
  type: 'filter' | 'drilldown' | 'navigate' | 'tooltip' | 'highlight';
  config: Record<string, any>;
}

export interface DashboardFilter {
  id: string;
  field: string;
  label: string;
  type: 'select' | 'multiselect' | 'daterange' | 'text' | 'number';
  options?: FilterOption[];
  defaultValue?: any;
}

export interface FilterOption {
  label: string;
  value: any;
}

export interface DashboardPermissions {
  owner: string;
  viewers: string[];
  editors: string[];
  public: boolean;
}

// ML Pipeline Types
export interface MLPipeline {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  schedule?: PipelineSchedule;
  triggers?: PipelineTrigger[];
  parameters: PipelineParameter[];
  metadata: PipelineMetadata;
  status: PipelineStatus;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  config: StageConfig;
  dependencies: string[]; // stage ids
  retryPolicy?: RetryPolicy;
  timeout?: number;
}

export enum StageType {
  DATA_INGESTION = 'data_ingestion',
  DATA_VALIDATION = 'data_validation',
  DATA_PREPROCESSING = 'data_preprocessing',
  FEATURE_ENGINEERING = 'feature_engineering',
  MODEL_TRAINING = 'model_training',
  MODEL_EVALUATION = 'model_evaluation',
  MODEL_DEPLOYMENT = 'model_deployment',
  MONITORING = 'monitoring',
  CUSTOM = 'custom'
}

export interface StageConfig {
  processor: string;
  parameters: Record<string, any>;
  inputs: DataInput[];
  outputs: DataOutput[];
}

export interface DataInput {
  name: string;
  type: 'dataset' | 'model' | 'artifact';
  source: string;
  schema?: DataSchema;
}

export interface DataOutput {
  name: string;
  type: 'dataset' | 'model' | 'artifact' | 'metrics';
  destination: string;
  schema?: DataSchema;
}

export interface DataSchema {
  fields: SchemaField[];
  version: string;
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  description?: string;
}

export interface PipelineSchedule {
  type: 'cron' | 'interval' | 'once';
  expression: string;
  timezone?: string;
}

export interface PipelineTrigger {
  type: 'event' | 'data' | 'metric' | 'manual';
  config: Record<string, any>;
}

export interface PipelineParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  defaultValue?: any;
  required: boolean;
  description?: string;
}

export interface PipelineMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: string;
  tags: string[];
}

export interface PipelineStatus {
  state: 'idle' | 'running' | 'paused' | 'failed' | 'completed';
  lastRun?: PipelineRun;
  nextRun?: Date;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stageResults: StageResult[];
  metrics: RunMetrics;
  logs: string[];
}

export interface StageResult {
  stageId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  outputs: Record<string, any>;
}

export interface RunMetrics {
  duration: number;
  dataProcessed: number;
  resourceUsage: ResourceUsage;
  costs?: CostBreakdown;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
}

export interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  total: number;
  currency: string;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay?: number;
}

// Visualization Types
export interface Visualization {
  id: string;
  type: VisualizationType;
  data: any[];
  config: VisualizationConfig;
  interactions: VisualizationInteraction[];
}

export enum VisualizationType {
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  SCATTER_PLOT = 'scatter_plot',
  HEATMAP = 'heatmap',
  SANKEY_DIAGRAM = 'sankey_diagram',
  NETWORK_GRAPH = 'network_graph',
  TREEMAP = 'treemap',
  SUNBURST = 'sunburst',
  RADAR_CHART = 'radar_chart',
  GAUGE_CHART = 'gauge_chart',
  CANDLESTICK = 'candlestick',
  CUSTOM = 'custom'
}

export interface VisualizationInteraction {
  type: 'zoom' | 'pan' | 'brush' | 'hover' | 'click' | 'select';
  handler: (event: InteractionEvent) => void;
}

export interface InteractionEvent {
  type: string;
  data: any;
  position: { x: number; y: number };
  target: any;
}

// Analytics Streaming Types
export interface StreamingAnalytics {
  id: string;
  name: string;
  sources: StreamSource[];
  processors: StreamProcessor[];
  sinks: StreamSink[];
  windowConfig: WindowConfig;
  status: StreamStatus;
}

export interface StreamSource {
  id: string;
  type: 'metrics' | 'logs' | 'events' | 'kafka' | 'websocket';
  config: Record<string, any>;
  schema?: DataSchema;
}

export interface StreamProcessor {
  id: string;
  type: 'filter' | 'transform' | 'aggregate' | 'join' | 'ml' | 'custom';
  config: ProcessorConfig;
  parallelism?: number;
}

export interface ProcessorConfig {
  operation: string;
  parameters: Record<string, any>;
  stateManagement?: StateConfig;
}

export interface StateConfig {
  type: 'memory' | 'redis' | 'rocksdb';
  ttl?: number;
  checkpointing?: CheckpointConfig;
}

export interface CheckpointConfig {
  interval: number;
  storage: string;
  retentionPolicy: RetentionPolicy;
}

export interface RetentionPolicy {
  count?: number;
  duration?: number;
}

export interface StreamSink {
  id: string;
  type: 'dashboard' | 'storage' | 'alert' | 'kafka' | 'websocket';
  config: Record<string, any>;
  errorHandling?: ErrorHandlingConfig;
}

export interface ErrorHandlingConfig {
  strategy: 'retry' | 'dead_letter' | 'ignore' | 'fail';
  maxRetries?: number;
  deadLetterTopic?: string;
}

export interface WindowConfig {
  type: 'tumbling' | 'sliding' | 'session';
  size: number;
  slide?: number;
  gap?: number;
  watermark?: WatermarkConfig;
}

export interface WatermarkConfig {
  maxDelay: number;
  updateInterval: number;
}

export interface StreamStatus {
  state: 'running' | 'paused' | 'failed' | 'stopped';
  metrics: StreamMetrics;
  errors: StreamError[];
}

export interface StreamMetrics {
  eventsProcessed: number;
  throughput: number;
  latency: LatencyMetrics;
  backpressure: number;
}

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface StreamError {
  timestamp: Date;
  processor: string;
  error: string;
  count: number;
}

// Model Registry Types
export interface MLModel {
  id: string;
  name: string;
  version: string;
  type: ModelType;
  framework: ModelFramework;
  artifacts: ModelArtifact[];
  metadata: ModelMetadata;
  metrics: ModelMetrics;
  status: ModelStatus;
  deployments: ModelDeployment[];
}

export enum ModelType {
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  CLUSTERING = 'clustering',
  ANOMALY_DETECTION = 'anomaly_detection',
  TIME_SERIES = 'time_series',
  NLP = 'nlp',
  COMPUTER_VISION = 'computer_vision',
  REINFORCEMENT_LEARNING = 'reinforcement_learning',
  CUSTOM = 'custom'
}

export enum ModelFramework {
  TENSORFLOW = 'tensorflow',
  PYTORCH = 'pytorch',
  SCIKIT_LEARN = 'scikit_learn',
  XGBOOST = 'xgboost',
  LIGHTGBM = 'lightgbm',
  KERAS = 'keras',
  ONNX = 'onnx',
  CUSTOM = 'custom'
}

export interface ModelArtifact {
  type: 'model' | 'weights' | 'config' | 'preprocessing' | 'postprocessing';
  path: string;
  size: number;
  checksum: string;
}

export interface ModelMetadata {
  createdAt: Date;
  createdBy: string;
  description?: string;
  tags: string[];
  hyperparameters: Record<string, any>;
  trainingData: TrainingDataInfo;
  dependencies: string[];
}

export interface TrainingDataInfo {
  dataset: string;
  version: string;
  size: number;
  features: string[];
  split: DataSplit;
}

export interface DataSplit {
  train: number;
  validation: number;
  test: number;
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  rmse?: number;
  mae?: number;
  custom: Record<string, number>;
}

export interface ModelStatus {
  state: 'training' | 'validating' | 'ready' | 'deployed' | 'deprecated' | 'failed';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastUpdated: Date;
}

export interface ModelDeployment {
  id: string;
  environment: 'development' | 'staging' | 'production';
  endpoint: string;
  version: string;
  instances: DeploymentInstance[];
  scaling: ScalingConfig;
  monitoring: MonitoringConfig;
}

export interface DeploymentInstance {
  id: string;
  status: 'running' | 'starting' | 'stopping' | 'failed';
  resources: ResourceAllocation;
  metrics: InstanceMetrics;
}

export interface ResourceAllocation {
  cpu: number;
  memory: number;
  gpu?: number;
}

export interface InstanceMetrics {
  requests: number;
  latency: LatencyMetrics;
  errors: number;
  availability: number;
}

export interface ScalingConfig {
  min: number;
  max: number;
  targetMetric: string;
  targetValue: number;
}

export interface MonitoringConfig {
  metrics: string[];
  alerts: AlertConfig[];
  logging: LoggingConfig;
}

export interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  actions: string[];
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  destinations: string[];
  sampling?: number;
}

// Analytics API Types
export interface AnalyticsQuery {
  id?: string;
  name?: string;
  query: string | QueryBuilder;
  parameters?: Record<string, any>;
  cache?: CacheConfig;
}

export interface QueryBuilder {
  select: string[];
  from: string;
  where?: WhereClause[];
  groupBy?: string[];
  having?: WhereClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
}

export interface WhereClause {
  field: string;
  operator: string;
  value: any;
  and?: WhereClause[];
  or?: WhereClause[];
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  key?: string;
}

export interface AnalyticsResult {
  query: AnalyticsQuery;
  data: any[];
  metadata: ResultMetadata;
  errors?: AnalyticsError[];
}

export interface ResultMetadata {
  executionTime: number;
  rowCount: number;
  cached: boolean;
  timestamp: Date;
}

export interface AnalyticsError {
  code: string;
  message: string;
  details?: any;
}

// Event types for real-time updates
export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: Date;
  data: any;
}

export enum AnalyticsEventType {
  DASHBOARD_UPDATE = 'dashboard_update',
  WIDGET_UPDATE = 'widget_update',
  PIPELINE_STATUS = 'pipeline_status',
  MODEL_DEPLOYED = 'model_deployed',
  STREAM_ALERT = 'stream_alert',
  METRIC_THRESHOLD = 'metric_threshold'
}

// Export utility types
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>
}[keyof T];