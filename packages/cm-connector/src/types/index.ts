export interface CMVersion {
  major: number;
  minor: number;
  patch: number;
  build?: number;
  fullVersion: string;
}

export interface CMConnectionConfig {
  type: 'DIRECT_DB' | 'REST_API' | 'SOAP_API' | 'SSH';
  host: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  encrypted?: boolean;
  trustServerCertificate?: boolean;
  connectionTimeout?: number;
  requestTimeout?: number;
  poolSize?: number;
  apiKey?: string;
  baseUrl?: string;
  sshKey?: string;
  additionalOptions?: Record<string, any>;
}

export interface CMSystemInfo {
  version: CMVersion;
  edition: 'Standard' | 'Enterprise' | 'Cloud';
  modules: string[];
  licensedUsers: number;
  installedFeatures: string[];
  databaseType: 'SQLServer' | 'Oracle';
  databaseVersion: string;
}

export interface CMHealthCheck {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  timestamp: Date;
  latency: number;
  checks: {
    database: boolean;
    services: boolean;
    filesystem: boolean;
    network: boolean;
  };
  errors: string[];
  warnings: string[];
}

export interface CMQuery {
  sql: string;
  params?: any[];
  timeout?: number;
}

export interface CMDataExtractor<T = any> {
  extract(): Promise<T>;
  validate(data: T): boolean;
  transform(data: T): any;
}

export interface CMConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  executeQuery<T = any>(query: CMQuery): Promise<T[]>;
  healthCheck(): Promise<CMHealthCheck>;
  getSystemInfo(): Promise<CMSystemInfo>;
}

export interface CMCredentials {
  id: string;
  systemId: string;
  connectionConfig: CMConnectionConfig;
  encryptedPassword?: string;
  encryptedApiKey?: string;
  encryptedSshKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CMConnectionPool {
  acquire(): Promise<CMConnector>;
  release(connector: CMConnector): void;
  drain(): Promise<void>;
  size(): number;
  available(): number;
  pending(): number;
}

export interface CMVersionAdapter {
  version: CMVersion;
  features: Set<string>;
  getTableName(entity: string): string;
  getColumnName(entity: string, column: string): string;
  buildQuery(operation: string, params: any): CMQuery;
  transformResult(operation: string, result: any[]): any[];
}

export interface CMDataModel {
  id: string;
  type: string;
  attributes: Record<string, any>;
  relationships?: Record<string, any>;
  metadata?: Record<string, any>;
}

export type CMErrorCode = 
  | 'CONNECTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'VERSION_UNSUPPORTED'
  | 'QUERY_FAILED'
  | 'INVALID_CONFIG'
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

export class CMError extends Error {
  constructor(
    public code: CMErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CMError';
  }
}