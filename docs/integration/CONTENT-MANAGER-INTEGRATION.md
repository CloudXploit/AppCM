# Content Manager Integration Guide

This guide provides comprehensive instructions for integrating CM Diagnostics with various versions of OpenText Content Manager (9.4 through 25.2).

## Table of Contents

1. [Overview](#overview)
2. [Supported Versions](#supported-versions)
3. [Prerequisites](#prerequisites)
4. [Integration Architecture](#integration-architecture)
5. [Version-Specific Setup](#version-specific-setup)
6. [Configuration](#configuration)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

## Overview

CM Diagnostics integrates with Content Manager through multiple interfaces:
- **REST API**: Primary integration method for modern versions
- **SDK**: Direct integration for advanced features
- **Database**: Read-only access for analytics
- **Event System**: Real-time monitoring and alerts

## Supported Versions

### Fully Supported
- Content Manager 25.2 (Latest)
- Content Manager 25.1
- Content Manager 24.4
- Content Manager 24.3
- Content Manager 23.x
- Content Manager 10.x

### Legacy Support
- Content Manager 9.4
- Content Manager 9.3
- Content Manager 9.2

### Version Feature Matrix

| Feature | 25.x | 24.x | 23.x | 10.x | 9.x |
|---------|------|------|------|------|-----|
| REST API v3 | ✅ | ✅ | ✅ | ❌ | ❌ |
| REST API v2 | ✅ | ✅ | ✅ | ✅ | ❌ |
| REST API v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebDAV | ✅ | ✅ | ✅ | ✅ | ✅ |
| SDK Integration | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Event Streaming | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| GraphQL | ✅ | ⚠️ | ❌ | ❌ | ❌ |

✅ = Supported | ⚠️ = Partial | ❌ = Not Available

## Prerequisites

### System Requirements

#### For Content Manager Server
- **CPU**: 4+ cores recommended
- **Memory**: 16GB minimum
- **Disk**: 50GB free space
- **Network**: 1Gbps connection
- **Ports**: 
  - HTTP: 80/443
  - SDK: 1137
  - Database: 1433/1521

#### For CM Diagnostics
- **CPU**: 2+ cores
- **Memory**: 8GB minimum
- **Disk**: 20GB for application
- **Database**: PostgreSQL 13+

### Required Permissions

#### Content Manager Service Account
```xml
<Permissions>
  <SystemAdministration>View</SystemAdministration>
  <ServerAdministration>View</ServerAdministration>
  <RecordOperations>Read</RecordOperations>
  <SecurityManagement>View</SecurityManagement>
  <AuditLog>Read</AuditLog>
  <EventLog>Read</EventLog>
</Permissions>
```

#### Database Access
```sql
-- Read-only access to CM database
GRANT SELECT ON SCHEMA cmdb TO cm_diagnostics_user;
GRANT SELECT ON ALL TABLES IN SCHEMA cmdb TO cm_diagnostics_user;
```

## Integration Architecture

### High-Level Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  CM Diagnostics │────▶│  Integration     │────▶│ Content Manager │
│    Platform     │     │     Layer        │     │    Server       │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   PostgreSQL    │     │     Redis        │     │    CM Database  │
│   (Metrics)     │     │    (Cache)       │     │   (Read-only)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Connection Methods

#### 1. REST API Connection
- **Protocol**: HTTPS
- **Authentication**: OAuth 2.0 / API Key
- **Format**: JSON
- **Rate Limiting**: 1000 req/min

#### 2. SDK Connection
- **Protocol**: TCP/IP
- **Authentication**: Integrated Windows / SAML
- **Language**: .NET Framework
- **Connection Pooling**: Enabled

#### 3. Database Connection
- **Type**: Read-only replica
- **Protocol**: TDS (SQL Server) / TNS (Oracle)
- **Authentication**: SQL / Windows
- **Connection Pool**: 10-50 connections

## Version-Specific Setup

### Content Manager 25.x

#### 1. Enable REST API v3
```powershell
# Run on CM Server
Set-CMRestAPIVersion -Version 3 -Enable
Set-CMRestAPIAuthentication -Method OAuth2
Restart-Service "HPE CM Service Host"
```

#### 2. Configure OAuth 2.0
```json
{
  "oauth": {
    "clientId": "cm-diagnostics",
    "clientSecret": "<generate-secret>",
    "scopes": ["read", "monitor", "audit"],
    "tokenExpiry": 3600
  }
}
```

#### 3. Enable Event Streaming
```xml
<configuration>
  <eventStreaming enabled="true">
    <endpoint>https://cm-diagnostics.company.com/events</endpoint>
    <authentication>Bearer</authentication>
    <events>
      <include>SystemHealth</include>
      <include>Performance</include>
      <include>Security</include>
      <include>Errors</include>
    </events>
  </eventStreaming>
</configuration>
```

### Content Manager 24.x

#### 1. Enable REST API v2
```powershell
# Configure via CM Admin Console
1. Open Content Manager Administrator
2. Navigate to System → Web Services
3. Enable REST API v2
4. Set Authentication to "API Key"
5. Generate API Key for diagnostics
```

#### 2. Configure API Access
```ini
[WebServices]
RESTAPIEnabled=true
RESTAPIVersion=2
APIKeyAuth=true
MaxConnections=100
Timeout=300
```

#### 3. Database Configuration
```sql
-- Create read-only user
CREATE USER cm_diagnostics WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE CMDB TO cm_diagnostics;
GRANT USAGE ON SCHEMA dbo TO cm_diagnostics;
GRANT SELECT ON ALL TABLES IN SCHEMA dbo TO cm_diagnostics;
```

### Content Manager 10.x

#### 1. Enable Web Services
```xml
<webServices>
  <soap enabled="true" />
  <rest enabled="true" version="1" />
  <authentication>
    <method>Basic</method>
    <realm>CM Diagnostics</realm>
  </authentication>
</webServices>
```

#### 2. Configure SDK Access
```csharp
// SDK Configuration
TrimApplication.Initialize();
Database db = new Database();
db.Id = "CM_PROD";
db.WorkgroupServerName = "cm-server.company.com";
db.WorkgroupServerPort = 1137;
db.Connect();
```

### Content Manager 9.x (Legacy)

#### 1. Enable SOAP Services
```ini
[SOAP]
Enabled=1
Port=8080
MaxConnections=50
Authentication=NTLM
```

#### 2. Configure Database Access
```sql
-- SQL Server specific
EXEC sp_addlinkedserver 
    @server='CM_DIAGNOSTICS',
    @srvproduct='',
    @provider='SQLNCLI',
    @datasrc='diagnostics-server';
```

## Configuration

### CM Diagnostics Configuration

#### 1. Connection Settings
```yaml
# config/cm-connection.yml
content_manager:
  versions:
    - version: "25.2"
      connection:
        type: "rest_v3"
        host: "cm25.company.com"
        port: 443
        ssl: true
        auth:
          type: "oauth2"
          client_id: "${CM_CLIENT_ID}"
          client_secret: "${CM_CLIENT_SECRET}"
      
    - version: "24.4"
      connection:
        type: "rest_v2"
        host: "cm24.company.com"
        port: 443
        ssl: true
        auth:
          type: "api_key"
          key: "${CM_API_KEY}"
    
    - version: "10.0"
      connection:
        type: "sdk"
        host: "cm10.company.com"
        port: 1137
        auth:
          type: "windows"
          domain: "COMPANY"
          username: "${CM_USERNAME}"
          password: "${CM_PASSWORD}"
```

#### 2. Monitoring Configuration
```yaml
# config/monitoring.yml
monitoring:
  intervals:
    health_check: 60s
    performance: 300s
    deep_scan: 3600s
  
  metrics:
    - name: "response_time"
      threshold: 500ms
      alert: warning
    
    - name: "error_rate"
      threshold: 5%
      alert: critical
    
    - name: "queue_length"
      threshold: 1000
      alert: warning
```

#### 3. Integration Features
```yaml
# config/features.yml
features:
  auto_discovery:
    enabled: true
    interval: 24h
  
  event_streaming:
    enabled: true
    buffer_size: 10000
    
  database_sync:
    enabled: true
    interval: 15m
    tables:
      - TSUSER
      - TSRECORD
      - TSLOCATION
      - TSAUDIT
```

### Security Configuration

#### 1. SSL/TLS Setup
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name cm-diagnostics.company.com;
    
    ssl_certificate /etc/ssl/certs/cm-diagnostics.crt;
    ssl_certificate_key /etc/ssl/private/cm-diagnostics.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

#### 2. Firewall Rules
```bash
# Allow CM Diagnostics to CM Server
iptables -A OUTPUT -p tcp --dport 443 -d cm-server.company.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 1137 -d cm-server.company.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 1433 -d cm-db.company.com -j ACCEPT
```

## Testing

### Connection Testing

#### 1. REST API Test
```bash
# Test REST API connection
curl -X GET https://cm-server.company.com/api/v3/health \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json"
```

#### 2. SDK Test
```powershell
# PowerShell test script
$trim = New-Object -ComObject Trim.SDK
$db = $trim.NewDatabase()
$db.Id = "CM_PROD"
$db.Connect()
Write-Host "Connected: $($db.IsConnected)"
```

#### 3. Database Test
```sql
-- Test database connectivity
SELECT TOP 1 
    uri_usn as UserID,
    uri_nam as UserName,
    uri_loc as Location
FROM TSUSER
WHERE uri_del = 0;
```

### Integration Testing

#### 1. Health Check Test
```bash
# Run health check
cd /opt/cm-diagnostics
./bin/cm-diag test health --target cm25.company.com
```

#### 2. Performance Test
```bash
# Run performance test
./bin/cm-diag test performance \
  --target cm25.company.com \
  --duration 300 \
  --concurrent 10
```

#### 3. End-to-End Test
```bash
# Complete integration test
./bin/cm-diag test integration \
  --comprehensive \
  --report ./test-results.html
```

## Troubleshooting

### Common Issues

#### Connection Refused
```
Error: Connection to cm-server.company.com:443 refused
```
**Solution:**
1. Check firewall rules
2. Verify CM web services are running
3. Confirm correct hostname/port
4. Test with telnet: `telnet cm-server.company.com 443`

#### Authentication Failed
```
Error: 401 Unauthorized - Invalid credentials
```
**Solution:**
1. Verify service account credentials
2. Check account permissions in CM
3. Ensure account is not locked
4. For OAuth, verify token not expired

#### Timeout Errors
```
Error: Request timeout after 30000ms
```
**Solution:**
1. Increase timeout in configuration
2. Check network latency
3. Verify CM server performance
4. Consider implementing pagination

#### SSL Certificate Issues
```
Error: SSL certificate verify failed
```
**Solution:**
1. Import CM server certificate
2. Update certificate store
3. For testing only: disable SSL verification
4. Check certificate expiration

### Debug Mode

Enable debug logging:
```yaml
# config/logging.yml
logging:
  level: DEBUG
  modules:
    - integration.cm
    - connection.pool
    - api.client
  output:
    - file: /var/log/cm-diagnostics/integration.log
    - console: true
```

### Performance Tuning

#### 1. Connection Pooling
```yaml
connection_pool:
  min_size: 5
  max_size: 20
  timeout: 30s
  idle_timeout: 300s
  validation_query: "SELECT 1"
```

#### 2. Caching Strategy
```yaml
cache:
  redis:
    enabled: true
    ttl:
      user_data: 3600s
      location_data: 86400s
      config_data: 300s
```

#### 3. Query Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_audit_date ON TSAUDIT(aud_date);
CREATE INDEX idx_record_modified ON TSRECORD(rec_modified);
CREATE INDEX idx_user_active ON TSUSER(uri_del, uri_active);
```

## Best Practices

### 1. Service Account Management
- Use dedicated service accounts
- Implement password rotation
- Follow principle of least privilege
- Monitor account usage

### 2. Connection Management
- Use connection pooling
- Implement retry logic
- Handle graceful degradation
- Monitor connection health

### 3. Data Synchronization
- Sync incrementally when possible
- Use database timestamps
- Implement conflict resolution
- Validate data integrity

### 4. Security Considerations
- Always use SSL/TLS
- Implement API rate limiting
- Log all access attempts
- Regular security audits

### 5. Monitoring
- Track integration health
- Monitor API usage
- Alert on failures
- Maintain audit logs

### 6. Version Management
- Test before upgrading
- Maintain compatibility matrix
- Plan for deprecations
- Document version-specific features

## Appendix

### A. CM API Endpoints

#### Health & Status
- `GET /api/v3/health` - System health
- `GET /api/v3/status` - Service status
- `GET /api/v3/metrics` - Performance metrics

#### Configuration
- `GET /api/v3/config` - System configuration
- `GET /api/v3/users` - User information
- `GET /api/v3/locations` - Location data

#### Monitoring
- `GET /api/v3/events` - Event stream
- `GET /api/v3/audit` - Audit logs
- `GET /api/v3/performance` - Performance data

### B. Database Schema

Key tables for integration:
- `TSUSER` - User information
- `TSRECORD` - Records/documents
- `TSLOCATION` - Physical locations
- `TSAUDIT` - Audit trail
- `TSEVENT` - System events
- `TSQUEUE` - Work queues

### C. Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 1001 | Connection failed | Check network |
| 1002 | Authentication failed | Verify credentials |
| 1003 | Permission denied | Check account rights |
| 1004 | Version mismatch | Update integration |
| 1005 | Rate limit exceeded | Implement backoff |

---

For additional support, contact the CM Diagnostics team or refer to the online documentation.