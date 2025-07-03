// Main entry point for CM Connector package
export * from './types';
export * from './connection-factory';
export * from './versions/version-detector';
export * from './connectors/database-connector';
export * from './connectors/api-connector';
export * from './extractors/system-extractor';
export * from './extractors/user-extractor';
export * from './extractors/base-extractor';
export * from './models/unified-models';
export * from './utils/connection-pool';
export * from './utils/credential-manager';
export * from './utils/error-handler';
export * from './utils/query-builder';

// Re-export commonly used functions
export { getConnectionPool, closeConnectionPool } from './utils/connection-pool';
export { CMConnectionFactory } from './connection-factory';
export { CMVersionDetector } from './versions/version-detector';