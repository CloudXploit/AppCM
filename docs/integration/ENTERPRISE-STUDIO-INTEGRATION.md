# Enterprise Studio Integration Guide

This guide provides comprehensive instructions for integrating CM Diagnostics with OpenText Enterprise Studio for enhanced workflow automation, process management, and intelligent capture capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Workflow Integration](#workflow-integration)
7. [Intelligent Capture](#intelligent-capture)
8. [Process Automation](#process-automation)
9. [Monitoring & Analytics](#monitoring--analytics)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

## Overview

Enterprise Studio integration enables:
- **Workflow Automation**: Monitor and optimize business processes
- **Intelligent Capture**: Process documents automatically
- **Process Analytics**: Track workflow performance
- **Exception Handling**: Identify and resolve process bottlenecks
- **Integration Monitoring**: Track data flow between systems

### Key Features

- 📋 **Process Monitoring**: Real-time workflow visibility
- 🤖 **Automated Diagnostics**: Detect process inefficiencies
- 📊 **Performance Analytics**: Workflow metrics and KPIs
- 🔄 **Auto-Remediation**: Fix common workflow issues
- 📈 **Predictive Analytics**: Forecast process bottlenecks

## Architecture

### Integration Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   CM Diagnostics    │────▶│    Integration   │────▶│ Enterprise      │
│     Platform        │     │     Service      │     │   Studio        │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │                           │                         │
         ▼                           ▼                         ▼
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Content Manager    │     │   Message Bus    │     │ Process Engine  │
│                     │     │   (RabbitMQ)     │     │                 │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
            ┌───────▼────────┐             ┌─────────▼────────┐
            │ Capture Server │             │ Workflow Engine  │
            │                │             │                  │
            └────────────────┘             └──────────────────┘
```

### Components

1. **Enterprise Studio Server**: Core workflow and capture platform
2. **Process Engine**: Executes business processes
3. **Capture Server**: Processes incoming documents
4. **Integration Service**: Manages communication
5. **Analytics Engine**: Process performance monitoring

## Prerequisites

### System Requirements

#### Enterprise Studio Requirements
- **CPU**: 8+ cores
- **Memory**: 32GB minimum
- **Storage**: 200GB SSD
- **OS**: Windows Server 2019+ or RHEL 8+

#### CM Diagnostics Requirements
- **CPU**: 4+ cores
- **Memory**: 16GB
- **Network**: Low latency connection to ES
- **Java**: JRE 11+

### Software Versions

| Component | Minimum Version | Recommended |
|-----------|----------------|-------------|
| Enterprise Studio | 21.3 | 23.4+ |
| Content Manager | 10.0 | 24.4+ |
| CM Diagnostics | 1.5 | 2.0+ |
| RabbitMQ | 3.8 | 3.11+ |
| PostgreSQL | 12 | 14+ |

### Required Licenses

- Enterprise Studio Server License
- Capture License (if using intelligent capture)
- Process Designer License
- API Access License

## Installation

### Step 1: Install Integration Components

```bash
# Download integration package
cd /opt/cm-diagnostics
wget https://downloads.cm-diagnostics.com/es-integration-2.0.tar.gz
tar -xzvf es-integration-2.0.tar.gz

# Install dependencies
pip install -r requirements-es-integration.txt

# Install message broker
sudo apt-get install rabbitmq-server
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server
```

### Step 2: Configure Message Bus

```bash
# Configure RabbitMQ
sudo rabbitmqctl add_user cm_diagnostics secure_password
sudo rabbitmqctl add_vhost cm_diagnostics
sudo rabbitmqctl set_permissions -p cm_diagnostics cm_diagnostics ".*" ".*" ".*"

# Enable management plugin
sudo rabbitmq-plugins enable rabbitmq_management
```

### Step 3: Deploy Integration Service

```bash
# Deploy service
cd /opt/cm-diagnostics/es-integration
./deploy.sh --env production --config config/es-integration.yml

# Start service
sudo systemctl start cm-es-integration
sudo systemctl enable cm-es-integration
```

## Configuration

### Enterprise Studio Configuration

#### 1. API Configuration
```xml
<!-- ES API Configuration -->
<configuration>
    <api>
        <enabled>true</enabled>
        <port>8443</port>
        <ssl>true</ssl>
        <authentication>
            <type>oauth2</type>
            <clientId>cm-diagnostics</clientId>
            <clientSecret>${ES_CLIENT_SECRET}</clientSecret>
        </authentication>
        <rateLimit>
            <enabled>true</enabled>
            <requestsPerMinute>1000</requestsPerMinute>
        </rateLimit>
    </api>
    
    <integration>
        <messageBus>
            <type>rabbitmq</type>
            <host>rabbitmq.company.com</host>
            <port>5672</port>
            <vhost>cm_diagnostics</vhost>
        </messageBus>
    </integration>
</configuration>
```

#### 2. Process Engine Configuration
```yaml
# process-engine.yml
process_engine:
  monitoring:
    enabled: true
    metrics_endpoint: http://cm-diagnostics:9090/metrics
    event_streaming: true
    
  diagnostics:
    enable_profiling: true
    collect_statistics: true
    retention_days: 90
    
  integration:
    cm_diagnostics:
      enabled: true
      api_endpoint: https://cm-diagnostics.company.com/api/v2
      auth_token: ${CM_DIAG_TOKEN}
```

### CM Diagnostics Configuration

```yaml
# config/es-integration.yml
enterprise_studio:
  enabled: true
  
  connection:
    host: es.company.com
    port: 8443
    ssl: true
    verify_ssl: true
    
  authentication:
    type: oauth2
    client_id: ${ES_CLIENT_ID}
    client_secret: ${ES_CLIENT_SECRET}
    token_endpoint: https://es.company.com/oauth/token
    
  message_bus:
    type: rabbitmq
    host: rabbitmq.company.com
    port: 5672
    username: cm_diagnostics
    password: ${RABBITMQ_PASSWORD}
    vhost: cm_diagnostics
    
  monitoring:
    process_metrics:
      enabled: true
      interval: 60s
      
    capture_metrics:
      enabled: true
      interval: 300s
      
    workflow_analytics:
      enabled: true
      batch_size: 1000
      
  features:
    auto_diagnostics: true
    predictive_analytics: true
    anomaly_detection: true
    workflow_optimization: true
```

## Workflow Integration

### Workflow Monitoring

#### 1. Configure Workflow Events
```javascript
// ES Workflow Configuration
const workflowConfig = {
    monitoring: {
        enabled: true,
        events: [
            'workflow.started',
            'workflow.completed',
            'workflow.failed',
            'task.started',
            'task.completed',
            'task.failed',
            'task.timeout'
        ],
        destination: 'cm-diagnostics'
    }
};
```

#### 2. Implement Event Handlers
```python
# Python event handler
from cm_diagnostics.es import WorkflowMonitor

class ESWorkflowHandler:
    def __init__(self):
        self.monitor = WorkflowMonitor()
        
    def handle_workflow_event(self, event):
        """Process workflow events from Enterprise Studio"""
        
        event_type = event['type']
        workflow_id = event['workflowId']
        timestamp = event['timestamp']
        
        if event_type == 'workflow.failed':
            # Trigger diagnostic analysis
            self.monitor.analyze_failure(
                workflow_id=workflow_id,
                error=event['error'],
                context=event['context']
            )
            
        elif event_type == 'task.timeout':
            # Check for bottlenecks
            self.monitor.analyze_bottleneck(
                task_id=event['taskId'],
                workflow_id=workflow_id,
                timeout_duration=event['duration']
            )
            
        # Store metrics
        self.monitor.record_metric(
            metric_type=event_type,
            workflow_id=workflow_id,
            value=event.get('duration', 0),
            timestamp=timestamp
        )
```

### Process Analytics

#### 1. KPI Monitoring
```yaml
# KPI Configuration
kpis:
  - name: average_process_time
    type: average
    metric: workflow.duration
    window: 1h
    threshold: 300s
    alert_on_breach: true
    
  - name: success_rate
    type: percentage
    metric: workflow.success_count / workflow.total_count
    window: 24h
    threshold: 95%
    alert_on_breach: true
    
  - name: throughput
    type: rate
    metric: workflow.completed_count
    window: 1h
    unit: workflows/hour
```

#### 2. Process Mining
```python
# Process mining implementation
from cm_diagnostics.es import ProcessMiner

miner = ProcessMiner()

# Analyze process patterns
patterns = miner.discover_patterns(
    start_date='2024-01-01',
    end_date='2024-01-31',
    process_types=['invoice_processing', 'contract_approval']
)

# Identify bottlenecks
bottlenecks = miner.find_bottlenecks(
    process_id='invoice_processing',
    percentile=95
)

# Generate optimization recommendations
recommendations = miner.suggest_optimizations(
    process_id='contract_approval',
    target_metric='duration',
    improvement_goal=0.2  # 20% improvement
)
```

## Intelligent Capture

### Capture Integration

#### 1. Configure Capture Server
```xml
<!-- Capture Server Configuration -->
<captureConfig>
    <integration>
        <cmDiagnostics>
            <enabled>true</enabled>
            <endpoint>https://cm-diagnostics.company.com/api/capture</endpoint>
            <events>
                <send>all</send>
                <format>json</format>
            </events>
        </cmDiagnostics>
    </integration>
    
    <monitoring>
        <metrics>
            <collect>true</collect>
            <interval>60</interval>
        </metrics>
        <errors>
            <report>true</report>
            <includeImages>false</includeImages>
        </errors>
    </monitoring>
</captureConfig>
```

#### 2. Document Processing Pipeline
```python
# Document processing monitoring
class CaptureMonitor:
    def __init__(self):
        self.metrics = MetricsCollector()
        
    def monitor_capture_pipeline(self, document):
        """Monitor document through capture pipeline"""
        
        start_time = time.time()
        
        # Track each stage
        stages = [
            'image_enhancement',
            'ocr_processing',
            'data_extraction',
            'validation',
            'classification'
        ]
        
        for stage in stages:
            stage_start = time.time()
            
            # Process stage (pseudo-code)
            result = self.process_stage(document, stage)
            
            # Record metrics
            self.metrics.record(
                f'capture.{stage}.duration',
                time.time() - stage_start
            )
            
            if not result.success:
                self.handle_capture_error(document, stage, result.error)
        
        # Overall metrics
        self.metrics.record(
            'capture.total_duration',
            time.time() - start_time
        )
```

### OCR Quality Monitoring

```python
# OCR quality analysis
class OCRQualityMonitor:
    def analyze_ocr_quality(self, batch_id):
        """Analyze OCR quality metrics"""
        
        results = self.get_batch_results(batch_id)
        
        metrics = {
            'confidence_scores': [],
            'error_rates': [],
            'processing_times': []
        }
        
        for doc in results:
            metrics['confidence_scores'].append(doc['confidence'])
            metrics['error_rates'].append(doc['error_rate'])
            metrics['processing_times'].append(doc['duration'])
        
        # Calculate quality score
        quality_score = self.calculate_quality_score(metrics)
        
        # Alert if below threshold
        if quality_score < 0.85:
            self.alert_low_quality(batch_id, quality_score, metrics)
        
        return {
            'batch_id': batch_id,
            'quality_score': quality_score,
            'metrics': metrics,
            'recommendations': self.get_recommendations(metrics)
        }
```

## Process Automation

### Automated Remediation

#### 1. Common Issues and Fixes
```yaml
# remediation-rules.yml
remediation_rules:
  - issue: workflow_timeout
    conditions:
      - timeout_count > 3
      - duration > 2x average
    actions:
      - increase_timeout: 50%
      - notify_admin: true
      - analyze_root_cause: true
      
  - issue: capture_failure
    conditions:
      - error_type: "ocr_quality_low"
      - confidence < 0.7
    actions:
      - reprocess_with_enhancement: true
      - use_alternative_engine: true
      - manual_review_queue: true
      
  - issue: integration_error
    conditions:
      - error_type: "connection_failed"
      - retry_count > 3
    actions:
      - reset_connection: true
      - failover_to_backup: true
      - alert_operations: true
```

#### 2. Auto-Remediation Implementation
```python
class AutoRemediator:
    def __init__(self):
        self.rules = load_remediation_rules()
        
    def handle_issue(self, issue):
        """Automatically remediate common issues"""
        
        matching_rules = self.find_matching_rules(issue)
        
        for rule in matching_rules:
            if self.evaluate_conditions(issue, rule.conditions):
                self.execute_actions(issue, rule.actions)
                
    def execute_actions(self, issue, actions):
        """Execute remediation actions"""
        
        for action in actions:
            try:
                if action.type == 'increase_timeout':
                    self.increase_workflow_timeout(
                        issue.workflow_id,
                        action.value
                    )
                    
                elif action.type == 'reprocess_with_enhancement':
                    self.reprocess_document(
                        issue.document_id,
                        enhance=True
                    )
                    
                elif action.type == 'reset_connection':
                    self.reset_integration_connection()
                    
                self.log_action(issue, action, 'success')
                
            except Exception as e:
                self.log_action(issue, action, 'failed', str(e))
```

### Workflow Optimization

```python
# Workflow optimizer
class WorkflowOptimizer:
    def optimize_workflow(self, workflow_id):
        """Analyze and optimize workflow performance"""
        
        # Get workflow metrics
        metrics = self.get_workflow_metrics(workflow_id)
        
        # Identify optimization opportunities
        opportunities = []
        
        # Check for parallel execution opportunities
        if self.can_parallelize_tasks(workflow_id):
            opportunities.append({
                'type': 'parallelize_tasks',
                'impact': '30% reduction in duration',
                'tasks': self.get_parallelizable_tasks(workflow_id)
            })
        
        # Check for unnecessary steps
        redundant_steps = self.find_redundant_steps(workflow_id)
        if redundant_steps:
            opportunities.append({
                'type': 'remove_redundant_steps',
                'impact': f'{len(redundant_steps) * 5}% reduction',
                'steps': redundant_steps
            })
        
        # Check for bottlenecks
        bottlenecks = self.identify_bottlenecks(metrics)
        for bottleneck in bottlenecks:
            opportunities.append({
                'type': 'optimize_bottleneck',
                'impact': f'{bottleneck.impact}% improvement',
                'component': bottleneck.component,
                'recommendation': bottleneck.recommendation
            })
        
        return {
            'workflow_id': workflow_id,
            'current_performance': metrics,
            'opportunities': opportunities,
            'estimated_improvement': self.calculate_total_improvement(opportunities)
        }
```

## Monitoring & Analytics

### Real-Time Dashboard

```yaml
# Dashboard configuration
dashboards:
  enterprise_studio:
    panels:
      - title: "Workflow Performance"
        type: timeseries
        metrics:
          - workflow.duration.avg
          - workflow.duration.p95
          - workflow.duration.p99
          
      - title: "Capture Statistics"
        type: stat
        metrics:
          - capture.documents.processed
          - capture.success.rate
          - capture.avg.confidence
          
      - title: "Process Health"
        type: heatmap
        dimensions:
          - process_type
          - hour_of_day
        metric: success_rate
        
      - title: "Error Analysis"
        type: table
        columns:
          - timestamp
          - process
          - error_type
          - count
          - status
```

### Performance Metrics

```python
# Metrics collection
class ESMetricsCollector:
    def collect_metrics(self):
        """Collect Enterprise Studio metrics"""
        
        metrics = {
            'workflow': self.collect_workflow_metrics(),
            'capture': self.collect_capture_metrics(),
            'integration': self.collect_integration_metrics()
        }
        
        # Send to monitoring system
        self.send_to_prometheus(metrics)
        
        return metrics
    
    def collect_workflow_metrics(self):
        return {
            'active_workflows': self.get_active_workflow_count(),
            'completed_today': self.get_completed_count('today'),
            'average_duration': self.get_average_duration(),
            'success_rate': self.get_success_rate(),
            'queue_depth': self.get_queue_depth()
        }
```

### Analytics Reports

```python
# Generate analytics reports
class ESAnalyticsReporter:
    def generate_performance_report(self, date_range):
        """Generate comprehensive performance report"""
        
        report = {
            'summary': self.generate_summary(date_range),
            'workflow_analysis': self.analyze_workflows(date_range),
            'capture_analysis': self.analyze_capture(date_range),
            'bottleneck_analysis': self.analyze_bottlenecks(date_range),
            'recommendations': self.generate_recommendations(date_range)
        }
        
        # Generate visualizations
        report['charts'] = {
            'trend_chart': self.create_trend_chart(date_range),
            'distribution_chart': self.create_distribution_chart(date_range),
            'heatmap': self.create_process_heatmap(date_range)
        }
        
        return report
```

## Security

### Authentication & Authorization

#### 1. OAuth 2.0 Configuration
```yaml
security:
  oauth2:
    provider: enterprise_studio
    token_endpoint: https://es.company.com/oauth/token
    authorization_endpoint: https://es.company.com/oauth/authorize
    scopes:
      - workflow.read
      - capture.read
      - process.monitor
      - api.access
```

#### 2. API Security
```python
# Secure API implementation
from functools import wraps
from flask import request, jsonify

def require_es_auth(scopes=[]):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get('Authorization', '').replace('Bearer ', '')
            
            if not token:
                return jsonify({'error': 'No token provided'}), 401
            
            # Validate token
            claims = validate_es_token(token)
            if not claims:
                return jsonify({'error': 'Invalid token'}), 401
            
            # Check scopes
            if not all(scope in claims.get('scopes', []) for scope in scopes):
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
```

### Data Encryption

```yaml
# Encryption configuration
encryption:
  data_in_transit:
    enabled: true
    protocol: TLS1.3
    cipher_suites:
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256
      
  data_at_rest:
    enabled: true
    algorithm: AES-256-GCM
    key_rotation: 90d
    
  message_bus:
    encrypt_messages: true
    sign_messages: true
    algorithm: AES-256-CBC
```

## Troubleshooting

### Common Issues

#### 1. Connection Issues
```
Error: Failed to connect to Enterprise Studio API
```
**Solution:**
```bash
# Check connectivity
curl -k https://es.company.com:8443/api/health

# Verify credentials
curl -X POST https://es.company.com/oauth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=${ES_CLIENT_ID}" \
  -d "client_secret=${ES_CLIENT_SECRET}"

# Check firewall
telnet es.company.com 8443
```

#### 2. Message Bus Issues
```
Error: Failed to publish message to RabbitMQ
```
**Solution:**
```bash
# Check RabbitMQ status
sudo rabbitmqctl status

# Check queue
sudo rabbitmqctl list_queues -p cm_diagnostics

# Purge stuck messages
sudo rabbitmqctl purge_queue es_events -p cm_diagnostics
```

#### 3. Performance Issues
```
Warning: Workflow processing delayed
```
**Solution:**
1. Check system resources
2. Analyze workflow complexity
3. Review parallel processing settings
4. Scale integration service

### Debug Tools

```python
# Debug utility
class ESDebugger:
    def diagnose_integration(self):
        """Run integration diagnostics"""
        
        checks = {
            'api_connectivity': self.check_api_connection(),
            'authentication': self.check_authentication(),
            'message_bus': self.check_message_bus(),
            'workflow_engine': self.check_workflow_engine(),
            'capture_server': self.check_capture_server()
        }
        
        issues = [k for k, v in checks.items() if not v['success']]
        
        return {
            'healthy': len(issues) == 0,
            'checks': checks,
            'issues': issues,
            'recommendations': self.get_recommendations(issues)
        }
```

### Log Analysis

```bash
# Log locations
/var/log/cm-diagnostics/es-integration.log
/var/log/enterprise-studio/workflow-engine.log
/var/log/enterprise-studio/capture-server.log
/var/log/rabbitmq/rabbit@hostname.log

# Common patterns to check
grep -i "error\|exception\|failed" /var/log/cm-diagnostics/es-integration.log
grep "timeout" /var/log/enterprise-studio/workflow-engine.log

# Performance analysis
awk '/duration/ {sum+=$NF; count++} END {print "Avg:", sum/count}' workflow-engine.log
```

## Best Practices

### 1. Integration Design
- Use asynchronous communication
- Implement circuit breakers
- Design for failure
- Use message queuing for reliability

### 2. Performance Optimization
- Cache frequently accessed data
- Implement connection pooling
- Use batch processing where possible
- Monitor and optimize bottlenecks

### 3. Monitoring Strategy
- Monitor all integration points
- Set up comprehensive alerting
- Track business metrics
- Implement SLAs

### 4. Security
- Use strong authentication
- Encrypt sensitive data
- Implement audit logging
- Regular security reviews

### 5. Maintenance
- Regular health checks
- Keep software updated
- Archive old data
- Performance tuning

### 6. Documentation
- Document integration flows
- Maintain runbooks
- Track configuration changes
- Update procedures regularly

## Appendix

### A. API Reference

#### Workflow API
```
GET /api/v2/workflows - List workflows
GET /api/v2/workflows/{id} - Get workflow details
GET /api/v2/workflows/{id}/metrics - Get workflow metrics
POST /api/v2/workflows/{id}/diagnose - Run diagnostics
```

#### Capture API
```
GET /api/v2/capture/batches - List capture batches
GET /api/v2/capture/batches/{id} - Get batch details
GET /api/v2/capture/statistics - Get capture statistics
POST /api/v2/capture/analyze - Analyze capture quality
```

### B. Message Format

#### Workflow Event
```json
{
  "eventId": "evt_123456",
  "timestamp": "2024-01-15T10:30:00Z",
  "type": "workflow.completed",
  "workflowId": "wf_789",
  "processType": "invoice_processing",
  "duration": 185000,
  "status": "success",
  "metadata": {
    "documentCount": 5,
    "totalValue": 25000.00,
    "department": "Finance"
  }
}
```

#### Capture Event
```json
{
  "eventId": "evt_234567",
  "timestamp": "2024-01-15T11:00:00Z",
  "type": "capture.completed",
  "batchId": "batch_456",
  "documentCount": 100,
  "successRate": 0.98,
  "avgConfidence": 0.92,
  "processingTime": 300000
}
```

### C. Configuration Templates

Complete configuration templates are available at:
- `/opt/cm-diagnostics/templates/es-integration/`
- Online: https://docs.cm-diagnostics.com/integrations/enterprise-studio/

---

For additional support, contact the CM Diagnostics integration team or refer to the Enterprise Studio documentation.