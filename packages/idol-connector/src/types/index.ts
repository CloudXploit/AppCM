export interface IDOLConnection {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  aciPort?: number;
  indexPort?: number;
  servicePort?: number;
  username?: string;
  password?: string;
  community?: string;
  ssl?: {
    rejectUnauthorized?: boolean;
    cert?: string;
    key?: string;
    ca?: string;
  };
}

export interface IDOLQueryParams {
  text?: string;
  databases?: string[];
  maxResults?: number;
  start?: number;
  print?: string;
  printFields?: string[];
  sort?: string;
  minScore?: number;
  totalResults?: boolean;
  summary?: boolean;
  highlight?: boolean;
  languageType?: string;
  outputEncoding?: string;
  fieldText?: string;
  combine?: 'simple' | 'fieldcheck' | 'datenewer';
  prediction?: boolean;
  querySummary?: boolean;
  spellCheck?: boolean;
}

export interface IDOLDocument {
  reference: string;
  title?: string;
  content?: string;
  database?: string;
  weight?: number;
  links?: number;
  date?: Date;
  fields?: Record<string, any>;
  highlight?: string;
  summary?: string;
}

export interface IDOLQueryResponse {
  autnresponse: {
    action: string;
    response: string;
    responsedata: {
      numhits: number;
      totalhits?: number;
      hit?: IDOLDocument[];
      warning?: string;
      error?: string;
    };
  };
}

export interface IDOLIndexDocument {
  reference: string;
  content: string;
  title?: string;
  database?: string;
  fields?: Record<string, any>;
  security?: {
    type: string;
    value: string;
  }[];
}

export interface IDOLAction {
  action: string;
  parameters?: Record<string, any>;
  timeout?: number;
  retries?: number;
}

export interface IDOLStatus {
  status: 'running' | 'stopped' | 'error' | 'initializing';
  version?: string;
  uptime?: number;
  databases?: IDOLDatabase[];
  totalDocuments?: number;
  indexSize?: number;
  lastError?: string;
  performance?: {
    queryRate: number;
    indexRate: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

export interface IDOLDatabase {
  name: string;
  documents: number;
  size: number;
  internal: boolean;
  readonly: boolean;
  fields?: string[];
}

export interface IDOLAnalytics {
  sentimentAnalysis?: {
    positive: number;
    negative: number;
    neutral: number;
  };
  conceptExtraction?: {
    concept: string;
    occurrences: number;
    relevance: number;
  }[];
  entityExtraction?: {
    type: string;
    text: string;
    positions: number[];
    confidence: number;
  }[];
  languageDetection?: {
    language: string;
    confidence: number;
  };
  summarization?: {
    summary: string;
    sentences: string[];
  };
}

export interface IDOLConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query(params: IDOLQueryParams): Promise<IDOLQueryResponse>;
  index(documents: IDOLIndexDocument[]): Promise<void>;
  delete(references: string[]): Promise<void>;
  getStatus(): Promise<IDOLStatus>;
  getDatabases(): Promise<IDOLDatabase[]>;
  executeAction(action: IDOLAction): Promise<any>;
  analyze(content: string, analytics: string[]): Promise<IDOLAnalytics>;
}

export interface IDOLError extends Error {
  code: string;
  action?: string;
  details?: any;
}

export interface IDOLMetrics {
  totalQueries: number;
  averageQueryTime: number;
  totalIndexOperations: number;
  averageIndexTime: number;
  errorRate: number;
  cacheHitRate: number;
  activeConnections: number;
}