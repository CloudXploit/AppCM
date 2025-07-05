# IDOL Integration Guide

This guide provides comprehensive instructions for integrating CM Diagnostics with OpenText IDOL (Intelligent Data Operating Layer) for enhanced search, analytics, and content processing capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Search Integration](#search-integration)
7. [Analytics Integration](#analytics-integration)
8. [Content Processing](#content-processing)
9. [Security](#security)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

## Overview

IDOL integration enhances CM Diagnostics with:
- **Advanced Search**: Full-text search with conceptual and contextual understanding
- **Content Analytics**: Sentiment analysis, entity extraction, and categorization
- **Media Processing**: OCR, speech-to-text, and video analysis
- **Predictive Analytics**: Pattern recognition and anomaly detection
- **Knowledge Management**: Automatic tagging and classification

### Benefits

- 🔍 **Enhanced Search Capabilities**: Beyond keyword matching
- 📊 **Deep Analytics**: Understand content meaning and relationships
- 🤖 **AI-Powered Insights**: Machine learning for predictions
- 🌐 **Multi-Language Support**: 150+ languages
- 📹 **Rich Media Analysis**: Process images, audio, and video

## Architecture

### Integration Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   CM Diagnostics    │────▶│  IDOL Connector  │────▶│   IDOL Server   │
│     Platform        │     │     Service      │     │     Complex     │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │                           │                         │
         ▼                           ▼                         ▼
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Content Manager    │     │   Index Queue    │     │  IDOL Content   │
│     Repository      │     │   (Redis/MQ)     │     │     Server      │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
                                                              │
                                    ┌─────────────────────────┴───────┐
                                    │                                 │
                            ┌───────▼────────┐             ┌─────────▼────────┐
                            │  IDOL Media    │             │  IDOL Analytics  │
                            │    Server      │             │     Server       │
                            └────────────────┘             └──────────────────┘
```

### IDOL Components

1. **Content Server**: Indexes and stores content
2. **Media Server**: Processes multimedia content
3. **Analytics Server**: Performs advanced analytics
4. **Connector Framework**: Fetches content from sources
5. **Community Server**: User profiling and personalization
6. **Find Server**: Search interface

## Prerequisites

### System Requirements

#### IDOL Server Requirements
- **CPU**: 8+ cores (16+ recommended)
- **Memory**: 32GB minimum (64GB recommended)
- **Storage**: 500GB+ SSD for indexes
- **OS**: Linux (RHEL 7+, Ubuntu 18.04+) or Windows Server 2016+

#### CM Diagnostics Requirements
- **CPU**: 4+ cores
- **Memory**: 16GB
- **Network**: 10Gbps for large deployments
- **Java**: JRE 11+ for connectors

### Software Versions

| Component | Minimum Version | Recommended |
|-----------|----------------|-------------|
| IDOL Server | 12.0 | 12.10+ |
| Content Manager | 9.4 | 24.4+ |
| CM Diagnostics | 1.0 | 2.0+ |
| Java Runtime | 11 | 17 |
| Redis | 6.0 | 7.0+ |

### Licensing

Required IDOL licenses:
- IDOL Server License
- Connector Framework License
- Media Server License (if processing media)
- Analytics License (for advanced features)

## Installation

### Step 1: Install IDOL Server

#### Linux Installation
```bash
# Download IDOL installer
wget https://delivery.microfocus.com/idol/12.10/IDOL_12.10_LINUX_X86_64.zip
unzip IDOL_12.10_LINUX_X86_64.zip

# Install IDOL
cd IDOL_12.10_LINUX_X86_64
sudo ./install.sh --prefix=/opt/idol --components=all

# Start IDOL services
sudo systemctl start idol-content
sudo systemctl start idol-media
sudo systemctl start idol-analytics
```

#### Windows Installation
```powershell
# Run installer
.\IDOL_12.10_WINDOWS_X86_64.exe

# Configure services
New-Service -Name "IDOL Content" -BinaryPath "C:\IDOL\content\content.exe"
New-Service -Name "IDOL Media" -BinaryPath "C:\IDOL\media\mediaserver.exe"
Start-Service "IDOL Content", "IDOL Media"
```

### Step 2: Install CM Connector

```bash
# Download Content Manager Connector
cd /opt/idol/connectors
wget https://cm-diagnostics.com/downloads/cm-idol-connector-2.0.jar

# Configure connector
cp cm-connector-template.cfg cm-connector.cfg
vim cm-connector.cfg
```

### Step 3: Configure Integration Service

```bash
# Install integration service
cd /opt/cm-diagnostics
./bin/install-idol-integration.sh

# Configure service
cp config/idol-integration.yml.template config/idol-integration.yml
vim config/idol-integration.yml
```

## Configuration

### IDOL Server Configuration

#### 1. Content Server Configuration
```ini
# /opt/idol/content/content.cfg
[Server]
Port=9000
ServicePort=9002
IndexPort=9001

[License]
LicenseServerHost=license.company.com
LicenseServerPort=20000

[Paths]
DataDirectory=/data/idol/content
LogDirectory=/var/log/idol/content

[DatabaseN]
Name=CMDiagnostics
Internal=FALSE
IndexingMode=Traditional
SecurityType=NT
```

#### 2. Media Server Configuration
```ini
# /opt/idol/media/mediaserver.cfg
[Server]
Port=14000
ServicePort=14002

[License]
LicenseServerHost=license.company.com

[Modules]
EnableOCR=TRUE
EnableSpeech=TRUE
EnableFace=TRUE

[OCR]
Languages=eng,fra,deu,spa
OutputFormat=XML
```

#### 3. Analytics Server Configuration
```ini
# /opt/idol/analytics/analytics.cfg
[Server]
Port=15000

[Analytics]
EnableSentiment=TRUE
EnableEntity=TRUE
EnableCategorization=TRUE
EnableSummarization=TRUE

[EntityExtraction]
Types=people,places,companies,dates
```

### CM Connector Configuration

```xml
<!-- cm-connector.cfg -->
<configuration>
    <connector>
        <name>ContentManagerConnector</name>
        <type>CM</type>
        <schedule>
            <type>continuous</type>
            <interval>300</interval>
        </schedule>
    </connector>
    
    <contentmanager>
        <host>cm-server.company.com</host>
        <port>443</port>
        <protocol>https</protocol>
        <authentication>
            <type>oauth2</type>
            <clientId>${CM_CLIENT_ID}</clientId>
            <clientSecret>${CM_CLIENT_SECRET}</clientSecret>
        </authentication>
    </contentmanager>
    
    <indexing>
        <fields>
            <field source="Title" idol="DRETITLE"/>
            <field source="RecordNumber" idol="DREREFERENCE"/>
            <field source="DateCreated" idol="DREDATE"/>
            <field source="Author" idol="AUTHOR"/>
            <field source="SecurityLevel" idol="SECURITY"/>
        </fields>
        <security>
            <mode>mapped</mode>
            <defaultLevel>public</defaultLevel>
        </security>
    </indexing>
    
    <performance>
        <threads>4</threads>
        <batchSize>100</batchSize>
        <maxQueueSize>10000</maxQueueSize>
    </performance>
</configuration>
```

### CM Diagnostics Integration Configuration

```yaml
# config/idol-integration.yml
idol:
  enabled: true
  
  servers:
    content:
      host: idol-content.company.com
      port: 9000
      aciPort: 9002
      indexPort: 9001
      
    media:
      host: idol-media.company.com
      port: 14000
      enabled: true
      
    analytics:
      host: idol-analytics.company.com
      port: 15000
      enabled: true
  
  connector:
    jar: /opt/idol/connectors/cm-idol-connector-2.0.jar
    config: /opt/idol/connectors/cm-connector.cfg
    jvmOptions: "-Xmx4g -Xms2g"
    
  indexing:
    mode: incremental
    fullIndexSchedule: "0 2 * * SUN"
    incrementalInterval: 300
    
  search:
    defaultDatabase: CMDiagnostics
    maxResults: 1000
    timeout: 30s
    highlighting: true
    
  analytics:
    sentiment:
      enabled: true
      languages: ["en", "es", "fr"]
      
    entity:
      enabled: true
      types: ["person", "organization", "location", "date"]
      
    categorization:
      enabled: true
      taxonomyPath: /opt/idol/taxonomies/cm-taxonomy.xml
```

## Search Integration

### Basic Search Configuration

```yaml
# config/search.yml
search:
  engine: idol
  
  idol:
    queryFields:
      - title
      - content
      - metadata
      
    searchModes:
      - boolean
      - conceptual
      - natural
      
    features:
      spellcheck: true
      synonyms: true
      stemming: true
      wildcards: true
```

### Advanced Search Features

#### 1. Conceptual Search
```python
# Python example
from cm_diagnostics.idol import IdolSearch

search = IdolSearch()

# Conceptual search
results = search.conceptual_query(
    text="compliance audit procedures",
    database="CMDiagnostics",
    max_results=50,
    min_score=70
)
```

#### 2. Parametric Search
```python
# Search with filters
results = search.parametric_search(
    query="contract",
    filters={
        "author": "John Doe",
        "date_range": ["2023-01-01", "2024-01-01"],
        "department": "Legal"
    }
)
```

#### 3. Similar Document Search
```python
# Find similar documents
similar = search.find_similar(
    reference="DOC-2024-001",
    max_results=20,
    min_similarity=0.8
)
```

### Search API Implementation

```javascript
// JavaScript/Node.js implementation
const { IdolClient } = require('@cm-diagnostics/idol-client');

class SearchService {
    constructor() {
        this.idol = new IdolClient({
            host: 'idol-content.company.com',
            port: 9002
        });
    }
    
    async search(query, options = {}) {
        const params = {
            text: query,
            database: options.database || 'CMDiagnostics',
            maxResults: options.limit || 100,
            summary: true,
            highlight: true,
            print: 'all'
        };
        
        if (options.filters) {
            params.fieldText = this.buildFieldText(options.filters);
        }
        
        return await this.idol.query(params);
    }
    
    buildFieldText(filters) {
        return Object.entries(filters)
            .map(([field, value]) => `${field}:${value}`)
            .join(' AND ');
    }
}
```

## Analytics Integration

### Content Analytics

#### 1. Sentiment Analysis
```python
# Analyze sentiment of documents
from cm_diagnostics.idol import IdolAnalytics

analytics = IdolAnalytics()

# Analyze customer feedback
sentiment_results = analytics.analyze_sentiment(
    documents=feedback_docs,
    languages=['en', 'es'],
    return_scores=True
)

# Results format
{
    "document_id": "FEEDBACK-001",
    "sentiment": "positive",
    "score": 0.85,
    "aspects": {
        "service": "positive",
        "pricing": "negative",
        "quality": "positive"
    }
}
```

#### 2. Entity Extraction
```python
# Extract entities from documents
entities = analytics.extract_entities(
    document_id="CONTRACT-2024-001",
    entity_types=['person', 'organization', 'date', 'money']
)

# Results
{
    "entities": [
        {"type": "person", "value": "John Smith", "confidence": 0.95},
        {"type": "organization", "value": "Acme Corp", "confidence": 0.92},
        {"type": "date", "value": "2024-01-15", "confidence": 1.0},
        {"type": "money", "value": "$50,000", "confidence": 0.98}
    ]
}
```

#### 3. Auto-Categorization
```python
# Categorize documents automatically
categories = analytics.categorize(
    document_id="DOC-2024-100",
    taxonomy="corporate-taxonomy",
    threshold=0.7
)

# Results
{
    "categories": [
        {"path": "/Legal/Contracts/Service", "score": 0.89},
        {"path": "/Finance/Invoices", "score": 0.72}
    ]
}
```

### Predictive Analytics

```python
# Predict document trends
predictions = analytics.predict_trends(
    metric="document_volume",
    timeframe="next_quarter",
    categories=["contracts", "invoices"],
    confidence_level=0.95
)
```

## Content Processing

### Media Processing Pipeline

#### 1. OCR Processing
```yaml
# config/media-processing.yml
media_processing:
  ocr:
    enabled: true
    languages: ["eng", "spa", "fra"]
    formats: ["pdf", "tiff", "jpeg", "png"]
    quality: high
    output: searchable_pdf
    
  pipeline:
    - step: extract_text
      processor: ocr
    - step: enhance_quality
      processor: image_enhancement
    - step: detect_language
      processor: language_detection
    - step: index_content
      processor: idol_indexer
```

#### 2. Audio/Video Processing
```python
# Process multimedia content
from cm_diagnostics.idol import MediaProcessor

processor = MediaProcessor()

# Transcribe audio
transcription = processor.transcribe_audio(
    file_path="/media/meeting-2024-01-15.mp3",
    language="en-US",
    speaker_detection=True
)

# Extract video insights
video_analysis = processor.analyze_video(
    file_path="/media/training-video.mp4",
    features=['transcription', 'face_detection', 'scene_detection']
)
```

### Batch Processing

```python
# Batch process documents
from cm_diagnostics.idol import BatchProcessor

batch = BatchProcessor(
    max_workers=4,
    batch_size=100
)

# Process queue
batch.process_queue(
    source="content_manager",
    processors=['ocr', 'analytics', 'categorization'],
    callback=lambda result: print(f"Processed: {result['id']}")
)
```

## Security

### Authentication Configuration

#### 1. IDOL Security
```ini
# Security configuration
[Security]
SecurityType=Autonomy
CaseSensitive=FALSE

[Autonomy]
SecurityInfoKeys=AUTONOMY_SECURITY
DocumentSecurity=TRUE
DefaultSecurityType=Public
```

#### 2. User Mapping
```xml
<!-- User security mapping -->
<security_mapping>
    <map>
        <cm_role>Administrators</cm_role>
        <idol_role>idol_admin</idol_role>
        <permissions>all</permissions>
    </map>
    <map>
        <cm_role>Users</cm_role>
        <idol_role>idol_user</idol_role>
        <permissions>read,search</permissions>
    </map>
</security_mapping>
```

### Encryption

```yaml
# Encryption settings
encryption:
  transport:
    enabled: true
    protocol: TLS1.3
    cipher_suites:
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256
      
  data:
    at_rest: true
    algorithm: AES-256-GCM
    key_management: hsm
```

## Monitoring

### Health Monitoring

```yaml
# Monitoring configuration
monitoring:
  idol:
    health_check:
      interval: 60s
      timeout: 10s
      
    metrics:
      - name: index_size
        threshold: 500GB
        alert: warning
        
      - name: query_response_time
        threshold: 2s
        alert: critical
        
      - name: indexing_rate
        threshold: 100docs/s
        alert: info
```

### Performance Metrics

```python
# Monitor IDOL performance
from cm_diagnostics.monitoring import IdolMonitor

monitor = IdolMonitor()

# Get performance metrics
metrics = monitor.get_metrics([
    'query_rate',
    'index_size',
    'document_count',
    'average_response_time',
    'cache_hit_rate'
])

# Set up alerts
monitor.create_alert(
    name="slow_queries",
    condition="avg_response_time > 2000",
    action="notify_ops_team"
)
```

### Dashboard Integration

```javascript
// Grafana dashboard query
{
  "datasource": "prometheus",
  "expr": "idol_query_duration_seconds{job='idol-content'}",
  "legendFormat": "Query Duration - {{instance}}",
  "interval": "30s"
}
```

## Troubleshooting

### Common Issues

#### 1. Indexing Failures
```
Error: Failed to index document: Invalid metadata format
```
**Solution:**
1. Check connector field mappings
2. Validate metadata format
3. Review IDOL index configuration
4. Check disk space

#### 2. Search Performance Issues
```
Warning: Query took 5.2 seconds
```
**Solution:**
1. Optimize IDOL indexes: `IDOL> DRECOMPACT`
2. Increase cache size
3. Add more Content servers
4. Review query complexity

#### 3. Connector Synchronization
```
Error: Connector lost connection to CM
```
**Solution:**
1. Check network connectivity
2. Verify CM credentials
3. Review connector logs
4. Restart connector service

### Debug Commands

```bash
# Check IDOL status
curl "http://idol-content:9002/action=GetStatus"

# View index statistics
curl "http://idol-content:9002/action=GetStatus&type=index"

# Test query
curl "http://idol-content:9002/action=Query&text=test&maxresults=10"

# Check connector status
curl "http://connector:10000/action=GetStatus"
```

### Log Analysis

```bash
# IDOL logs location
/var/log/idol/content/content.log
/var/log/idol/media/mediaserver.log
/var/log/idol/connector/connector.log

# Common log patterns to check
grep -i "error\|fail\|exception" /var/log/idol/content/content.log
grep "OutOfMemory" /var/log/idol/connector/connector.log
```

## Best Practices

### 1. Index Design
- Plan index structure carefully
- Use appropriate field types
- Implement proper security
- Regular index maintenance

### 2. Query Optimization
- Use field restrictions when possible
- Implement query caching
- Paginate large result sets
- Monitor slow queries

### 3. Scalability
- Horizontal scaling for Content servers
- Distribute indexes across servers
- Implement load balancing
- Use distributed indexing

### 4. Maintenance
- Regular index optimization
- Monitor disk usage
- Archive old data
- Update IDOL regularly

### 5. Security
- Implement proper authentication
- Use SSL/TLS everywhere
- Regular security audits
- Monitor access logs

### 6. Integration
- Use asynchronous processing
- Implement retry logic
- Handle failures gracefully
- Monitor integration health

## Appendix

### A. IDOL ACI Commands

Common ACI (Autonomy Content Infrastructure) commands:

| Command | Description | Example |
|---------|-------------|---------|
| Query | Search documents | `action=Query&text=contract` |
| GetContent | Retrieve document | `action=GetContent&reference=DOC001` |
| Index | Add document | `action=DREADDDATA` |
| Delete | Remove document | `action=DREDELETE&docs=DOC001` |
| GetStatus | Server status | `action=GetStatus` |

### B. Field Reference

Standard IDOL fields:

| Field | Description | Type |
|-------|-------------|------|
| DREREFERENCE | Unique ID | Reference |
| DRETITLE | Document title | Text |
| DRECONTENT | Main content | Text |
| DREDATE | Document date | Date |
| DRESECURITY | Security info | Security |

### C. Language Codes

Supported languages:

| Code | Language |
|------|----------|
| eng | English |
| spa | Spanish |
| fra | French |
| deu | German |
| jpn | Japanese |
| chi | Chinese |

---

For additional support, refer to the IDOL documentation or contact the CM Diagnostics support team.