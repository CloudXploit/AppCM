# CM Connector Package

This package provides connectivity and data extraction capabilities for all supported Content Manager versions (9.4 through 25.2).

## Features

- Version detection and compatibility checking
- Direct database connectivity (SQL Server & Oracle)
- REST/SOAP API connectivity
- Secure credential management
- Connection pooling and optimization
- Unified data models across versions
- Comprehensive error handling
- Health monitoring

## Installation

```bash
npm install @cm-diagnostics/cm-connector
```

## Usage

```typescript
import { CMConnectionFactory } from '@cm-diagnostics/cm-connector';

// Create a connection
const config = {
  type: 'DIRECT_DB',
  host: 'localhost',
  database: 'CM_PROD',
  username: 'sa',
  password: 'password',
  databaseType: 'sqlserver'
};

const connector = await CMConnectionFactory.createConnector(config);
await connector.connect();

// Detect version
const systemInfo = await CMVersionDetector.detectVersion(connector);
console.log(`Connected to CM ${systemInfo.version}`);

// Extract data
const adapter = CMConnectionFactory.createAdapter(systemInfo);
const extractor = new SystemExtractor(connector, adapter);
const data = await extractor.extractWithValidation();

await connector.disconnect();
```

## Supported Versions

- CM 9.4
- CM 10.0
- CM 10.1
- CM 23.3
- CM 23.4
- CM 24.2
- CM 24.3
- CM 24.4
- CM 25.1
- CM 25.2

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

Integration tests require actual CM instances. Configure the following environment variables:

```bash
# Skip integration tests if CM instances are not available
export SKIP_CM_INTEGRATION_TESTS=true

# Test specific versions only
export TEST_CM_VERSIONS="23.4,24.4,25.2"

# CM 9.4 Configuration
export CM94_DB_HOST=localhost
export CM94_DB_PORT=1433
export CM94_DB_NAME=CM94_TEST
export CM94_DB_USER=sa
export CM94_DB_PASS=password

# CM 10.1+ Configuration (API)
export CM101_API_URL=http://localhost:8080
export CM101_API_USER=admin
export CM101_API_PASS=admin

# Add similar variables for other versions...
```

Run integration tests:

```bash
npm run test:integration
```

Check CM availability:

```bash
export REPORT_CM_AVAILABILITY=true
npm run test:integration
```

## Architecture

### Connection Factory

The `CMConnectionFactory` creates appropriate connectors based on configuration:
- `DatabaseConnector` for direct database access
- `APIConnector` for REST/SOAP API access

### Version Detection

`CMVersionDetector` identifies the CM version and available features:
- Parses version strings
- Detects installed modules
- Identifies available features

### Data Extractors

Extractors retrieve specific data types:
- `SystemExtractor` - System configuration and health
- `UserExtractor` - Users, groups, roles, permissions
- `RecordExtractor` - Records and metadata (coming soon)
- `DocumentExtractor` - Documents and content (coming soon)

### Unified Models

Unified models provide consistent data structures across all CM versions:
- `UnifiedSystem` - System information
- `UnifiedUser` - User data
- `UnifiedRecord` - Record data
- `UnifiedDocument` - Document data
- `UnifiedLocation` - Physical locations
- `UnifiedClassification` - Classification schemes

### Connection Pooling

The connection pool manages connections efficiently:
- Reuses existing connections
- Limits concurrent connections
- Monitors connection health
- Cleans up idle connections

## Error Handling

The package uses a comprehensive error system:
- `CMError` - Base error class with error codes
- Automatic retry with exponential backoff
- Detailed error logging
- Connection recovery

## Security

- Credentials are encrypted using AES-256
- Connection strings are never logged
- Supports environment variable configuration
- Implements secure credential storage