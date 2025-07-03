# @cm-diagnostics/idol-connector

IDOL integration package for CM Diagnostics, providing comprehensive connectivity, search, analytics, and monitoring capabilities for Micro Focus IDOL servers.

## Features

- 🔌 **Multiple Connector Types**: Support for IDOL Server, Community, and Cloud deployments
- 🔍 **Advanced Search**: Powerful query builders with field text support
- 📊 **Analytics Integration**: Sentiment analysis, concept extraction, entity recognition
- 📈 **Performance Monitoring**: Real-time metrics, alerts, and anomaly detection
- 🔄 **Content Synchronization**: CM to IDOL content sync with conflict resolution
- 🏥 **Diagnostic Rules**: Pre-built rules for IDOL health assessment
- 🛡️ **Security**: SSL/TLS support, authentication, and access control

## Installation

```bash
npm install @cm-diagnostics/idol-connector
```

## Quick Start

```typescript
import { createIDOLConnector, IDOLSearchService } from '@cm-diagnostics/idol-connector';

// Create connector
const connector = createIDOLConnector({
  host: 'idol.example.com',
  port: 9000,
  protocol: 'https',
  username: 'admin',
  password: 'password'
});

// Connect
await connector.connect();

// Create search service
const searchService = new IDOLSearchService(connector);

// Perform search
const results = await searchService.search('content management', {
  databases: ['cm_prod'],
  limit: 10,
  highlight: true
});

console.log(`Found ${results.totalResults} documents`);
```

## Advanced Usage

### Query Building

```typescript
import { IDOLQueryBuilder, FieldTextBuilder } from '@cm-diagnostics/idol-connector';

// Build complex queries
const query = IDOLQueryBuilder.create()
  .text('security audit')
  .databases('cm_prod', 'cm_archive')
  .minScore(70)
  .sort('date', true)
  .build();

// Build field text conditions
const fieldText = FieldTextBuilder.create()
  .match('severity', 'HIGH')
  .and()
  .dateRange('created', '2024-01-01', '2024-12-31')
  .and()
  .notEqual('status', 'RESOLVED')
  .build();
```

### Content Indexing

```typescript
import { IDOLIndexService } from '@cm-diagnostics/idol-connector';

const indexService = new IDOLIndexService(connector);

// Index single document
await indexService.indexDocument(
  'Document content here...',
  'Document Title',
  {
    database: 'cm_content',
    fields: {
      author: 'John Doe',
      department: 'Legal',
      classification: 'Confidential'
    },
    security: [
      { type: 'USER', value: 'john.doe' },
      { type: 'GROUP', value: 'legal-dept' }
    ]
  }
);

// Batch indexing
const documents = [/* array of documents */];
const result = await indexService.batchIndex(documents, {
  batchSize: 100
});
```

### Analytics

```typescript
import { IDOLAnalyticsService } from '@cm-diagnostics/idol-connector';

const analyticsService = new IDOLAnalyticsService(connector);

// Analyze document
const analysis = await analyticsService.analyzeDocument(content, {
  language: 'english',
  sentimentGranularity: 'sentence'
});

console.log('Sentiment:', analysis.sentimentAnalysis);
console.log('Key Concepts:', analysis.conceptExtraction);
console.log('Entities:', analysis.entityExtraction);

// Get trending topics
const trends = await analyticsService.getTrendingTopics('cm_prod', 7);
console.log('Emerging Topics:', trends.emergingTopics);
```

### Performance Monitoring

```typescript
import { IDOLPerformanceMonitor } from '@cm-diagnostics/idol-connector';

const monitor = new IDOLPerformanceMonitor(connector, {
  interval: 60000, // 1 minute
  alertThresholds: {
    queryTime: 2000,
    cpuUsage: 80,
    memoryUsage: 85
  }
});

// Start monitoring
monitor.start();

// Listen for alerts
monitor.on('alert', (alert) => {
  console.log(`Alert: ${alert.severity} - ${alert.message}`);
});

// Get current metrics
const metrics = monitor.getCurrentMetrics();
console.log('Health Score:', monitor.getHealthScore());
```

### CM to IDOL Synchronization

```typescript
import { CMToIDOLSyncService } from '@cm-diagnostics/idol-connector';

const syncService = new CMToIDOLSyncService(indexService, searchService);

// Sync CM documents
const cmDocuments = [/* array of CM documents */];
const syncResult = await syncService.syncDocuments(
  cmDocuments,
  'cm_synchronized',
  {
    batchSize: 50,
    deleteOrphaned: true,
    updateExisting: true,
    fieldMapping: {
      'recordNumber': 'cm_record_id',
      'author': 'creator'
    }
  }
);

console.log(`Synced: ${syncResult.indexed}, Failed: ${syncResult.failed}`);
```

## Diagnostic Integration

The package includes pre-built diagnostic rules and scanners:

```typescript
import { idolDiagnosticRules, IDOLPerformanceScanner } from '@cm-diagnostics/idol-connector';

// Use with diagnostic engine
diagnosticEngine.addRules(idolDiagnosticRules);
diagnosticEngine.addScanner(new IDOLPerformanceScanner());
```

## Configuration

### Connection Types

#### IDOL Server
```typescript
const connector = createIDOLConnector({
  host: 'idol.example.com',
  port: 9000,
  type: 'server'
});
```

#### Community Server
```typescript
const connector = createIDOLConnector({
  host: 'idol.example.com',
  port: 9000,
  type: 'community',
  community: 'legal-dept'
});
```

#### IDOL Cloud
```typescript
const connector = createIDOLConnector({
  host: 'api.idolcloud.com',
  port: 443,
  type: 'cloud',
  username: 'tenant-id',
  password: 'api-key'
});
```

## API Reference

### Classes

- `IDOLServerConnector` - Base IDOL server connector
- `CommunityConnector` - IDOL Community server connector
- `CloudConnector` - IDOL Cloud connector
- `IDOLConnectionManager` - Connection pool management
- `IDOLSearchService` - Search operations
- `IDOLIndexService` - Indexing operations
- `IDOLAnalyticsService` - Analytics and NLP
- `CMToIDOLSyncService` - Content synchronization
- `IDOLPerformanceMonitor` - Performance monitoring

### Diagnostic Components

- `idolDiagnosticRules` - Pre-built diagnostic rules
- `IDOLPerformanceScanner` - Performance scanner
- `IDOLContentScanner` - Content quality scanner
- `IDOLIntegrationScanner` - Integration health scanner

## Error Handling

```typescript
try {
  await connector.connect();
} catch (error) {
  if (error.code === 'IDOL_AUTH_FAILED') {
    console.error('Authentication failed');
  } else if (error.code === 'IDOL_CONNECTION_TIMEOUT') {
    console.error('Connection timeout');
  }
}
```

## Best Practices

1. **Connection Pooling**: Use `IDOLConnectionManager` for multiple connections
2. **Batch Operations**: Use batch indexing for large datasets
3. **Caching**: Enable query caching for frequently accessed data
4. **Monitoring**: Always enable monitoring in production
5. **Error Recovery**: Implement retry logic for transient failures

## License

Part of CM Diagnostics - Enterprise License