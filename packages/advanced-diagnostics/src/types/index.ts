import { Finding, DiagnosticResult, SystemMetrics } from '@cm-diagnostics/diagnostics';

// Anomaly Detection Types
export interface Anomaly {
  id: string;
  systemId: string;
  metric: string;
  timestamp: Date;
  value: number;
  expectedRange: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
  severity: AnomalySeverity;
  confidence: number;
  type: AnomalyType;
  context?: Record<string, any>;
}

export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AnomalyType {
  SPIKE = 'spike',
  DROP = 'drop',
  TREND = 'trend',
  PATTERN = 'pattern',
  OUTLIER = 'outlier',
  SEASONALITY = 'seasonality'
}

// Prediction Types
export interface Prediction {
  id: string;
  systemId: string;
  metric: string;
  timestamp: Date;
  predictedValue: number;
  confidence: number;
  timeHorizon: number; // minutes into future
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  factors?: string[];
  model: string;
}

export interface PredictiveInsight {
  id: string;
  systemId: string;
  type: InsightType;
  title: string;
  description: string;
  impact: ImpactLevel;
  likelihood: number; // 0-1
  timeframe: string;
  recommendations: string[];
  relatedMetrics: string[];
  confidence: number;
}

export enum InsightType {
  CAPACITY_WARNING = 'capacity_warning',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  FAILURE_RISK = 'failure_risk',
  SECURITY_THREAT = 'security_threat',
  COMPLIANCE_DRIFT = 'compliance_drift'
}

export enum ImpactLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Pattern Recognition Types
export interface Pattern {
  id: string;
  name: string;
  description: string;
  type: PatternType;
  signature: PatternSignature;
  occurrences: PatternOccurrence[];
  confidence: number;
  impact: ImpactLevel;
}

export enum PatternType {
  PERFORMANCE = 'performance',
  ERROR = 'error',
  USAGE = 'usage',
  SECURITY = 'security',
  WORKFLOW = 'workflow'
}

export interface PatternSignature {
  metrics: MetricPattern[];
  conditions: PatternCondition[];
  timeWindow?: number; // minutes
  frequency?: PatternFrequency;
}

export interface MetricPattern {
  metric: string;
  behavior: 'increase' | 'decrease' | 'stable' | 'oscillating';
  threshold?: number;
  rate?: number; // change per minute
}

export interface PatternCondition {
  type: 'and' | 'or' | 'not';
  conditions?: PatternCondition[];
  metric?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  value?: number;
}

export interface PatternOccurrence {
  timestamp: Date;
  systemId: string;
  matchScore: number;
  context: Record<string, any>;
}

export interface PatternFrequency {
  type: 'recurring' | 'periodic' | 'sporadic';
  interval?: number; // minutes
  variance?: number; // allowed variance in minutes
}

// Root Cause Analysis Types
export interface RootCauseAnalysis {
  id: string;
  findingId: string;
  systemId: string;
  timestamp: Date;
  primaryCause: Cause;
  contributingCauses: Cause[];
  causalChain: CausalRelation[];
  confidence: number;
  evidence: Evidence[];
  recommendations: Recommendation[];
}

export interface Cause {
  id: string;
  type: CauseType;
  description: string;
  probability: number;
  impact: ImpactLevel;
  category: string;
  metadata?: Record<string, any>;
}

export enum CauseType {
  CONFIGURATION = 'configuration',
  RESOURCE = 'resource',
  WORKLOAD = 'workload',
  DEPENDENCY = 'dependency',
  ENVIRONMENTAL = 'environmental',
  HUMAN = 'human',
  HARDWARE = 'hardware',
  SOFTWARE = 'software'
}

export interface CausalRelation {
  from: string; // cause id
  to: string; // cause id
  type: 'causes' | 'contributes' | 'correlates';
  strength: number; // 0-1
}

export interface Evidence {
  type: EvidenceType;
  description: string;
  source: string;
  timestamp: Date;
  relevance: number; // 0-1
  data?: any;
}

export enum EvidenceType {
  METRIC = 'metric',
  LOG = 'log',
  EVENT = 'event',
  CONFIGURATION = 'configuration',
  CORRELATION = 'correlation'
}

export interface Recommendation {
  id: string;
  action: string;
  description: string;
  priority: number;
  estimatedImpact: ImpactLevel;
  estimatedEffort: EffortLevel;
  automatable: boolean;
  risks?: string[];
  prerequisites?: string[];
}

export enum EffortLevel {
  TRIVIAL = 'trivial',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

// Learning System Types
export interface LearningCase {
  id: string;
  timestamp: Date;
  systemId: string;
  finding: Finding;
  diagnosis: RootCauseAnalysis;
  resolution: Resolution;
  outcome: ResolutionOutcome;
  feedback?: UserFeedback;
}

export interface Resolution {
  id: string;
  actions: ResolutionAction[];
  appliedAt: Date;
  appliedBy: string;
  automated: boolean;
  duration: number; // minutes
  rollbackAvailable: boolean;
}

export interface ResolutionAction {
  type: string;
  description: string;
  parameters: Record<string, any>;
  result: 'success' | 'failure' | 'partial';
  error?: string;
}

export interface ResolutionOutcome {
  success: boolean;
  metrics: {
    before: Record<string, number>;
    after: Record<string, number>;
    improvement: Record<string, number>;
  };
  timeToResolution: number; // minutes
  recurrence?: {
    occurred: boolean;
    timeToRecurrence?: number; // minutes
  };
}

export interface UserFeedback {
  rating: number; // 1-5
  helpful: boolean;
  accurate: boolean;
  comments?: string;
  suggestedImprovements?: string[];
}

// ML Model Types
export interface MLModel {
  id: string;
  name: string;
  type: ModelType;
  version: string;
  status: ModelStatus;
  performance: ModelPerformance;
  trainingData: TrainingDataInfo;
  lastUpdated: Date;
  config: ModelConfig;
}

export enum ModelType {
  ANOMALY_DETECTION = 'anomaly_detection',
  TIME_SERIES_PREDICTION = 'time_series_prediction',
  CLASSIFICATION = 'classification',
  CLUSTERING = 'clustering',
  REGRESSION = 'regression',
  NEURAL_NETWORK = 'neural_network'
}

export enum ModelStatus {
  TRAINING = 'training',
  VALIDATING = 'validating',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  FAILED = 'failed'
}

export interface ModelPerformance {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  mse?: number; // Mean Squared Error
  mae?: number; // Mean Absolute Error
  rmse?: number; // Root Mean Squared Error
  lastEvaluated: Date;
}

export interface TrainingDataInfo {
  samples: number;
  features: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  sources: string[];
}

export interface ModelConfig {
  algorithm: string;
  hyperparameters: Record<string, any>;
  features: FeatureConfig[];
  preprocessing?: PreprocessingStep[];
}

export interface FeatureConfig {
  name: string;
  type: 'numeric' | 'categorical' | 'temporal' | 'text';
  transformation?: 'normalize' | 'standardize' | 'encode' | 'embed';
  importance?: number;
}

export interface PreprocessingStep {
  type: 'impute' | 'scale' | 'encode' | 'filter' | 'aggregate';
  config: Record<string, any>;
}

// Service Interfaces
export interface AnomalyDetector {
  detect(metrics: SystemMetrics[], config?: AnomalyDetectionConfig): Promise<Anomaly[]>;
  train(historicalData: SystemMetrics[]): Promise<void>;
  evaluate(): Promise<ModelPerformance>;
}

export interface PredictiveAnalyzer {
  predict(systemId: string, metric: string, horizon: number): Promise<Prediction>;
  analyzeInsights(systemId: string): Promise<PredictiveInsight[]>;
  updateModel(newData: SystemMetrics[]): Promise<void>;
}

export interface PatternRecognizer {
  findPatterns(data: SystemMetrics[], timeRange: TimeRange): Promise<Pattern[]>;
  matchPattern(pattern: Pattern, data: SystemMetrics[]): Promise<PatternOccurrence[]>;
  registerPattern(pattern: Pattern): Promise<void>;
}

export interface RootCauseAnalyzer {
  analyze(finding: Finding, context: AnalysisContext): Promise<RootCauseAnalysis>;
  correlate(events: Event[], timeWindow: number): Promise<CausalRelation[]>;
  generateRecommendations(analysis: RootCauseAnalysis): Promise<Recommendation[]>;
}

export interface LearningSystem {
  recordCase(learningCase: LearningCase): Promise<void>;
  learn(): Promise<void>;
  getSimilarCases(finding: Finding, limit?: number): Promise<LearningCase[]>;
  getRecommendedResolution(finding: Finding): Promise<Resolution | null>;
  provideFeedback(caseId: string, feedback: UserFeedback): Promise<void>;
}

// Configuration Types
export interface AnomalyDetectionConfig {
  sensitivity: number; // 0-1
  algorithms: AnomalyAlgorithm[];
  windowSize: number; // minutes
  minimumDataPoints: number;
  adaptiveLearning: boolean;
}

export enum AnomalyAlgorithm {
  ISOLATION_FOREST = 'isolation_forest',
  LOCAL_OUTLIER_FACTOR = 'local_outlier_factor',
  ONE_CLASS_SVM = 'one_class_svm',
  AUTOENCODER = 'autoencoder',
  STATISTICAL = 'statistical',
  PROPHET = 'prophet'
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface AnalysisContext {
  systemId: string;
  timeWindow: number; // minutes before and after
  relatedSystems?: string[];
  includeMetrics: string[];
  includeLogs: boolean;
  includeEvents: boolean;
}

export interface Event {
  id: string;
  timestamp: Date;
  type: string;
  source: string;
  severity: string;
  description: string;
  metadata?: Record<string, any>;
}