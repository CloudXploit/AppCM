# CM Diagnostics Monitoring Guide

This comprehensive guide covers monitoring setup, dashboard configuration, metrics collection, and observability best practices for CM Diagnostics.

## Table of Contents

1. [Monitoring Overview](#monitoring-overview)
2. [Metrics Architecture](#metrics-architecture)
3. [Core Metrics](#core-metrics)
4. [Dashboard Setup](#dashboard-setup)
5. [Prometheus Configuration](#prometheus-configuration)
6. [Grafana Dashboards](#grafana-dashboards)
7. [Custom Metrics](#custom-metrics)
8. [Log Monitoring](#log-monitoring)
9. [Application Performance Monitoring](#application-performance-monitoring)
10. [Infrastructure Monitoring](#infrastructure-monitoring)
11. [SLIs and SLOs](#slis-and-slos)
12. [Monitoring Best Practices](#monitoring-best-practices)

## Monitoring Overview

CM Diagnostics provides comprehensive monitoring through:
- **Built-in Dashboards**: Pre-configured for CM environments
- **Metrics Export**: Prometheus-compatible metrics
- **Log Aggregation**: Centralized logging
- **Distributed Tracing**: Request flow visualization
- **Custom Metrics**: Application-specific monitoring

### Monitoring Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     Applications                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │CM Diagnostics│  │Content Mgr  │  │   IDOL      │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Metrics Collection                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Prometheus  │  │   Loki      │  │   Jaeger    │        │
│  │  (Metrics)  │  │   (Logs)    │  │  (Traces)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Visualization                             │
│  ┌────────────────────────────────────────────────┐        │
│  │                    Grafana                      │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │        │
│  │  │Dashboards│  │  Alerts  │  │ Reports  │    │        │
│  │  └──────────┘  └──────────┘  └──────────┘    │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Metrics Architecture

### Metric Types

1. **Counter**: Cumulative metrics that only increase
   - Request count
   - Error count
   - Documents processed

2. **Gauge**: Metrics that can go up or down
   - Current users
   - Memory usage
   - Queue depth

3. **Histogram**: Distribution of values
   - Request duration
   - Response size
   - Processing time

4. **Summary**: Similar to histogram with quantiles
   - API latency percentiles
   - Database query times

### Metric Naming Convention

```
<namespace>_<subsystem>_<metric>_<unit>

Examples:
cmdiag_api_requests_total
cmdiag_db_connections_active
cmdiag_cm_documents_processed_total
cmdiag_cache_hit_ratio
```

## Core Metrics

### Application Metrics

```yaml
# Essential application metrics
application_metrics:
  - name: cmdiag_api_requests_total
    type: counter
    labels: [method, endpoint, status]
    description: Total API requests
    
  - name: cmdiag_api_request_duration_seconds
    type: histogram
    labels: [method, endpoint]
    description: API request duration
    
  - name: cmdiag_active_users
    type: gauge
    description: Currently active users
    
  - name: cmdiag_error_rate
    type: gauge
    labels: [type, severity]
    description: Error rate per minute
```

### Content Manager Metrics

```yaml
cm_metrics:
  - name: cmdiag_cm_connection_status
    type: gauge
    labels: [instance]
    description: CM connection status (1=up, 0=down)
    
  - name: cmdiag_cm_response_time_ms
    type: histogram
    labels: [operation]
    description: CM operation response time
    
  - name: cmdiag_cm_documents_processed
    type: counter
    labels: [type, status]
    description: Documents processed
    
  - name: cmdiag_cm_queue_depth
    type: gauge
    labels: [queue_name]
    description: Current queue depth
```

### System Metrics

```yaml
system_metrics:
  - name: node_cpu_usage_percent
    type: gauge
    labels: [cpu, mode]
    
  - name: node_memory_usage_bytes
    type: gauge
    labels: [type]
    
  - name: node_disk_usage_percent
    type: gauge
    labels: [mountpoint]
    
  - name: node_network_throughput_bytes
    type: counter
    labels: [interface, direction]
```

## Dashboard Setup

### Built-in Dashboards

CM Diagnostics includes pre-configured dashboards:

1. **Executive Overview**
   - System health score
   - Key performance indicators
   - Availability metrics
   - Business metrics

2. **Operations Dashboard**
   - Real-time system status
   - Active alerts
   - Performance metrics
   - Resource utilization

3. **Performance Analysis**
   - Response time trends
   - Throughput metrics
   - Error rates
   - Bottleneck identification

4. **Content Manager Health**
   - CM-specific metrics
   - Queue status
   - Document processing
   - User activity

### Dashboard Configuration

```json
// dashboard-config.json
{
  "dashboard": {
    "title": "CM Diagnostics Overview",
    "refresh": "10s",
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "panels": [
      {
        "id": 1,
        "title": "System Health Score",
        "type": "stat",
        "gridPos": {"x": 0, "y": 0, "w": 6, "h": 4},
        "targets": [
          {
            "expr": "cmdiag_health_score",
            "refId": "A"
          }
        ],
        "options": {
          "colorMode": "value",
          "thresholds": {
            "steps": [
              {"value": 0, "color": "red"},
              {"value": 80, "color": "yellow"},
              {"value": 95, "color": "green"}
            ]
          }
        }
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "gridPos": {"x": 6, "y": 0, "w": 12, "h": 8},
        "targets": [
          {
            "expr": "rate(cmdiag_api_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}",
            "refId": "A"
          }
        ]
      }
    ]
  }
}
```

### Creating Custom Dashboards

```javascript
// custom-dashboard.js
const dashboard = {
  title: "Custom CM Performance",
  panels: [
    {
      title: "Document Processing Rate",
      query: "rate(cmdiag_cm_documents_processed[5m])",
      visualization: "timeseries",
      unit: "docs/sec"
    },
    {
      title: "Queue Depth Heatmap",
      query: "cmdiag_cm_queue_depth",
      visualization: "heatmap",
      groupBy: ["queue_name", "time"]
    },
    {
      title: "Error Distribution",
      query: "sum by(error_type) (increase(cmdiag_errors_total[1h]))",
      visualization: "piechart"
    }
  ]
};

// Deploy dashboard
POST /api/dashboards
Content-Type: application/json
Authorization: Bearer ${API_TOKEN}

${JSON.stringify(dashboard)}
```

## Prometheus Configuration

### Prometheus Setup

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: 'production'
    region: 'us-east-1'

# Alerting configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Load rules
rule_files:
  - "alerts/*.yml"
  - "recording_rules/*.yml"

# Scrape configurations
scrape_configs:
  # CM Diagnostics metrics
  - job_name: 'cm-diagnostics'
    static_configs:
      - targets: 
        - 'cm-diagnostics-1:9090'
        - 'cm-diagnostics-2:9090'
        - 'cm-diagnostics-3:9090'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        regex: '([^:]+):.*'
        
  # Content Manager metrics
  - job_name: 'content-manager'
    static_configs:
      - targets: ['cm-exporter:9100']
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'cm_.*'
        target_label: __tmp_keep
        replacement: 'true'
      - source_labels: [__tmp_keep]
        regex: 'true'
        action: keep
        
  # Node exporter for system metrics
  - job_name: 'node'
    static_configs:
      - targets: 
        - 'node1:9100'
        - 'node2:9100'
        - 'node3:9100'
        
  # PostgreSQL exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Recording Rules

```yaml
# recording_rules/aggregations.yml
groups:
  - name: cmdiag_aggregations
    interval: 30s
    rules:
      # Request rate by endpoint
      - record: cmdiag:request_rate_5m
        expr: |
          sum by (method, endpoint) (
            rate(cmdiag_api_requests_total[5m])
          )
          
      # Error rate percentage
      - record: cmdiag:error_rate_percentage
        expr: |
          100 * sum(rate(cmdiag_api_requests_total{status=~"5.."}[5m])) 
          / 
          sum(rate(cmdiag_api_requests_total[5m]))
          
      # P95 response time
      - record: cmdiag:response_time_p95
        expr: |
          histogram_quantile(0.95, 
            sum by (le, method, endpoint) (
              rate(cmdiag_api_request_duration_seconds_bucket[5m])
            )
          )
          
      # CM health score
      - record: cmdiag:health_score
        expr: |
          (
            (1 - cmdiag:error_rate_percentage/100) * 40 +
            (cmdiag_cm_connection_status) * 30 +
            (1 - saturation_metrics) * 30
          )
```

### Federation Setup

```yaml
# prometheus-federation.yml
# For multi-region deployments
scrape_configs:
  - job_name: 'federate'
    scrape_interval: 15s
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job=~"cm-diagnostics|content-manager"}'
        - 'cmdiag:.*'  # All recording rules
    static_configs:
      - targets:
        - 'prometheus-us-west:9090'
        - 'prometheus-eu-central:9090'
        - 'prometheus-ap-south:9090'
```

## Grafana Dashboards

### Dashboard Templates

```json
// cm-diagnostics-overview.json
{
  "dashboard": {
    "id": null,
    "title": "CM Diagnostics - System Overview",
    "tags": ["cm-diagnostics", "overview"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Health Score",
        "type": "gauge",
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 0},
        "targets": [{
          "expr": "cmdiag:health_score",
          "legendFormat": "Health Score"
        }],
        "options": {
          "showThresholdLabels": true,
          "showThresholdMarkers": true
        },
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"color": "red", "value": null},
                {"color": "yellow", "value": 80},
                {"color": "green", "value": 95}
              ]
            },
            "unit": "percent",
            "min": 0,
            "max": 100
          }
        }
      },
      {
        "title": "Request Rate",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 18, "x": 6, "y": 0},
        "targets": [{
          "expr": "sum(rate(cmdiag_api_requests_total[5m])) by (method)",
          "legendFormat": "{{method}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "custom": {
              "lineInterpolation": "smooth",
              "showPoints": "never",
              "spanNulls": true
            }
          }
        }
      },
      {
        "title": "Error Rate",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [{
          "expr": "cmdiag:error_rate_percentage",
          "legendFormat": "Error %"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "custom": {
              "fillOpacity": 10,
              "lineWidth": 2
            },
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 1},
                {"color": "red", "value": 5}
              ]
            }
          }
        }
      },
      {
        "title": "Response Time (P50, P95, P99)",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "histogram_quantile(0.5, sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P99"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "custom": {
              "lineInterpolation": "smooth"
            }
          }
        }
      }
    ]
  }
}
```

### CM-Specific Dashboard

```json
// content-manager-health.json
{
  "dashboard": {
    "title": "Content Manager Health",
    "panels": [
      {
        "title": "CM Instance Status",
        "type": "state-timeline",
        "targets": [{
          "expr": "cmdiag_cm_connection_status",
          "legendFormat": "{{instance}}"
        }],
        "options": {
          "showValue": "never",
          "alignValue": "center",
          "mergeValues": false
        }
      },
      {
        "title": "Document Processing Rate",
        "type": "timeseries",
        "targets": [{
          "expr": "sum(rate(cmdiag_cm_documents_processed[5m])) by (type)",
          "legendFormat": "{{type}}"
        }]
      },
      {
        "title": "Queue Depths",
        "type": "bargauge",
        "targets": [{
          "expr": "cmdiag_cm_queue_depth",
          "legendFormat": "{{queue_name}}"
        }],
        "options": {
          "displayMode": "gradient",
          "orientation": "horizontal",
          "showUnfilled": true
        }
      },
      {
        "title": "CM API Response Times",
        "type": "heatmap",
        "targets": [{
          "expr": "sum(increase(cmdiag_cm_response_time_ms_bucket[1m])) by (le, operation)",
          "format": "heatmap"
        }],
        "options": {
          "calculate": true,
          "yAxis": {
            "unit": "ms",
            "decimals": 0
          }
        }
      }
    ]
  }
}
```

### Dashboard Variables

```json
{
  "templating": {
    "list": [
      {
        "name": "datasource",
        "type": "datasource",
        "query": "prometheus",
        "current": {
          "text": "Prometheus",
          "value": "prometheus"
        }
      },
      {
        "name": "environment",
        "type": "query",
        "query": "label_values(cmdiag_api_requests_total, environment)",
        "multi": false,
        "includeAll": false,
        "current": {
          "text": "production",
          "value": "production"
        }
      },
      {
        "name": "instance",
        "type": "query",
        "query": "label_values(cmdiag_api_requests_total{environment=\"$environment\"}, instance)",
        "multi": true,
        "includeAll": true
      },
      {
        "name": "interval",
        "type": "interval",
        "query": "1m,5m,10m,30m,1h",
        "current": {
          "text": "5m",
          "value": "5m"
        }
      }
    ]
  }
}
```

## Custom Metrics

### Implementing Custom Metrics

```javascript
// custom-metrics.js
const prometheus = require('prom-client');

// Create a custom registry
const register = new prometheus.Registry();

// Define custom metrics
const customMetrics = {
  // Business metric: Documents awaiting approval
  documentsAwaiting: new prometheus.Gauge({
    name: 'cmdiag_documents_awaiting_approval',
    help: 'Number of documents awaiting approval',
    labelNames: ['department', 'priority'],
    registers: [register]
  }),
  
  // Performance metric: Search query duration
  searchDuration: new prometheus.Histogram({
    name: 'cmdiag_search_duration_seconds',
    help: 'Search query execution time',
    labelNames: ['index', 'query_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register]
  }),
  
  // Custom counter: Integration events
  integrationEvents: new prometheus.Counter({
    name: 'cmdiag_integration_events_total',
    help: 'Total integration events processed',
    labelNames: ['source', 'event_type', 'status'],
    registers: [register]
  })
};

// Update metrics
function updateMetrics() {
  // Update documents awaiting approval
  const awaitingDocs = getAwaitingDocuments();
  awaitingDocs.forEach(doc => {
    customMetrics.documentsAwaiting
      .labels(doc.department, doc.priority)
      .set(doc.count);
  });
  
  // Track search performance
  const searchTimer = customMetrics.searchDuration
    .labels('main', 'fulltext')
    .startTimer();
  
  performSearch().then(() => {
    searchTimer(); // End timer
  });
}

// Export metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
});
```

### Business Metrics

```yaml
# business-metrics.yml
business_metrics:
  - name: document_processing_sla
    description: "Percentage of documents processed within SLA"
    query: |
      100 * sum(
        cmdiag_cm_documents_processed{status="completed", processing_time_le="300"}
      ) / sum(
        cmdiag_cm_documents_processed{status="completed"}
      )
      
  - name: user_satisfaction_score
    description: "User satisfaction based on response times and errors"
    query: |
      100 * (1 - (
        (cmdiag:error_rate_percentage / 100) * 0.5 +
        (clamp_max(cmdiag:response_time_p95 - 1, 1) / 5) * 0.5
      ))
      
  - name: system_efficiency_score
    description: "Overall system efficiency"
    query: |
      (
        (cmdiag_cm_documents_processed / cmdiag_cpu_usage_percent) * 
        (1 - cmdiag:error_rate_percentage/100)
      )
```

## Log Monitoring

### Centralized Logging with Loki

```yaml
# loki-config.yml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /tmp/loki
  storage:
    filesystem:
      chunks_directory: /tmp/loki/chunks
      rules_directory: /tmp/loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093
  enable_api: true
  
limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

### Log Shipping Configuration

```yaml
# promtail-config.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: cm_diagnostics
    static_configs:
      - targets:
          - localhost
        labels:
          job: cm_diagnostics
          __path__: /var/log/cm-diagnostics/*.log
    
    pipeline_stages:
      - multiline:
          firstline: '^\[\d{4}-\d{2}-\d{2}'
          max_wait_time: 3s
          
      - regex:
          expression: '^\[(?P<timestamp>[^\]]+)\] (?P<level>\w+) (?P<message>.*)'
          
      - labels:
          level:
          
      - timestamp:
          source: timestamp
          format: '2006-01-02 15:04:05'
          
  - job_name: nginx
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx
          __path__: /var/log/nginx/*.log
          
    pipeline_stages:
      - regex:
          expression: '^(?P<remote_addr>\S+) .* "(?P<method>\S+) (?P<uri>\S+) .*" (?P<status>\d+) (?P<bytes_sent>\d+) ".*" "(?P<user_agent>.*)"'
          
      - labels:
          method:
          status:
```

### Log-based Metrics

```yaml
# log-metrics.yml
groups:
  - name: log_based_metrics
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate({job="cm_diagnostics"} |= "ERROR" [5m])) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in logs"
          description: "Error rate is {{ $value }} errors/sec"
          
      - record: cmdiag:log_error_rate
        expr: |
          sum by (level) (
            rate({job="cm_diagnostics"} [5m])
          )
          
      - alert: SecurityEvent
        expr: |
          sum(rate({job="cm_diagnostics"} |~ "unauthorized|forbidden|security" [1m])) > 0
        labels:
          severity: critical
        annotations:
          summary: "Security event detected"
          description: "Security-related log entry detected"
```

## Application Performance Monitoring

### Distributed Tracing with Jaeger

```yaml
# jaeger-config.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: jaeger-config
data:
  collector.yaml: |
    receivers:
      jaeger:
        protocols:
          grpc:
            endpoint: 0.0.0.0:14250
          thrift_http:
            endpoint: 0.0.0.0:14268
            
    processors:
      batch:
        timeout: 1s
        send_batch_size: 1024
        
    exporters:
      jaeger:
        endpoint: jaeger-collector:14250
        
    service:
      pipelines:
        traces:
          receivers: [jaeger]
          processors: [batch]
          exporters: [jaeger]
```

### APM Integration

```javascript
// apm-setup.js
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');

// Initialize tracing
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'cm-diagnostics',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
  }),
});

// Configure exporter
const jaegerExporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces',
});

// Add span processor
provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));

// Register the provider
provider.register();

// Instrument HTTP requests
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({
      requestHook: (span, request) => {
        span.setAttributes({
          'http.request.body': request.body,
          'custom.user_id': request.user?.id,
        });
      },
    }),
    new ExpressInstrumentation(),
  ],
});
```

### Performance Profiling

```javascript
// performance-profiling.js
const v8Profiler = require('v8-profiler-next');
const fs = require('fs');

class PerformanceProfiler {
  startCPUProfile(duration = 10000) {
    const profileId = `cpu-profile-${Date.now()}`;
    v8Profiler.startProfiling(profileId, true);
    
    setTimeout(() => {
      const profile = v8Profiler.stopProfiling(profileId);
      profile.export((error, result) => {
        if (!error) {
          fs.writeFileSync(`./profiles/${profileId}.cpuprofile`, result);
          console.log(`CPU profile saved: ${profileId}.cpuprofile`);
        }
        profile.delete();
      });
    }, duration);
  }
  
  takeHeapSnapshot() {
    const snapshotId = `heap-snapshot-${Date.now()}`;
    const snapshot = v8Profiler.takeSnapshot(snapshotId);
    
    snapshot.export((error, result) => {
      if (!error) {
        fs.writeFileSync(`./profiles/${snapshotId}.heapsnapshot`, result);
        console.log(`Heap snapshot saved: ${snapshotId}.heapsnapshot`);
      }
      snapshot.delete();
    });
  }
  
  measureEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      if (lag > 10) {
        console.warn(`Event loop lag detected: ${lag}ms`);
        metrics.eventLoopLag.observe(lag);
      }
    });
  }
}

// Schedule regular profiling in development
if (process.env.NODE_ENV === 'development') {
  const profiler = new PerformanceProfiler();
  
  // CPU profile every hour
  setInterval(() => profiler.startCPUProfile(), 3600000);
  
  // Heap snapshot every 4 hours
  setInterval(() => profiler.takeHeapSnapshot(), 14400000);
  
  // Monitor event loop lag
  setInterval(() => profiler.measureEventLoopLag(), 1000);
}
```

## Infrastructure Monitoring

### Node Monitoring

```yaml
# node-exporter-config.yml
node_exporter:
  collectors:
    enabled:
      - cpu
      - meminfo
      - diskstats
      - netdev
      - filefd
      - filesystem
      - loadavg
      - systemd
      - textfile
      
  textfile_directory: /var/lib/node_exporter/
  
  filesystem:
    ignored_mount_points: "^/(sys|proc|dev|host|etc)($|/)"
    ignored_fs_types: "^(sysfs|procfs|autofs|cgroup|devpts|tmpfs|overlay)$"
```

### Container Monitoring

```yaml
# cadvisor-config.yml
cadvisor:
  port: 8080
  storage_duration: 5m
  housekeeping_interval: 10s
  
  metrics:
    - container_cpu_usage_seconds_total
    - container_memory_usage_bytes
    - container_network_receive_bytes_total
    - container_network_transmit_bytes_total
    - container_fs_usage_bytes
    
  docker_endpoints:
    - unix:///var/run/docker.sock
    
  container_labels:
    - com.docker.compose.project
    - com.docker.compose.service
    - io.kubernetes.pod.name
    - io.kubernetes.pod.namespace
```

### Database Monitoring

```yaml
# postgres-exporter.yml
data_source_name: "postgresql://monitor:password@postgres:5432/cmdiagnostics?sslmode=disable"

queries:
  - query: |
      SELECT 
        datname as database,
        numbackends as connections,
        xact_commit as commits,
        xact_rollback as rollbacks,
        tup_returned as rows_returned,
        tup_fetched as rows_fetched,
        tup_inserted as rows_inserted,
        tup_updated as rows_updated,
        tup_deleted as rows_deleted
      FROM pg_stat_database
      WHERE datname NOT IN ('template0', 'template1', 'postgres')
    metrics:
      - database:
          usage: "LABEL"
          description: "Database name"
      - connections:
          usage: "GAUGE"
          description: "Number of active connections"
      - commits:
          usage: "COUNTER"
          description: "Total commits"
      - rollbacks:
          usage: "COUNTER"
          description: "Total rollbacks"
          
  - query: |
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 20
    metrics:
      - schemaname:
          usage: "LABEL"
      - tablename:
          usage: "LABEL"
      - size:
          usage: "GAUGE"
          description: "Table size"
```

## SLIs and SLOs

### Service Level Indicators

```yaml
# sli-definitions.yml
slis:
  - name: availability
    description: "Service availability"
    query: |
      avg_over_time(
        up{job="cm-diagnostics"}[5m]
      ) * 100
      
  - name: latency_p95
    description: "95th percentile latency"
    query: |
      histogram_quantile(0.95,
        sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le)
      )
      
  - name: error_rate
    description: "Error rate percentage"
    query: |
      100 * sum(rate(cmdiag_api_requests_total{status=~"5.."}[5m]))
      / sum(rate(cmdiag_api_requests_total[5m]))
      
  - name: throughput
    description: "Request throughput"
    query: |
      sum(rate(cmdiag_api_requests_total[5m]))
```

### Service Level Objectives

```yaml
# slo-definitions.yml
slos:
  - name: "API Availability"
    sli: availability
    target: 99.9
    window: 30d
    burn_rate_alerts:
      - window: 1h
        burn_rate: 14.4
        severity: critical
      - window: 6h
        burn_rate: 6
        severity: warning
        
  - name: "API Latency"
    sli: latency_p95
    target_value: 1.0  # 1 second
    target_percentage: 95
    window: 7d
    
  - name: "Error Budget"
    sli: error_rate
    target_value: 1.0  # 1% error rate
    window: 30d
    alerts:
      - remaining_budget: 25
        severity: warning
      - remaining_budget: 10
        severity: critical
```

### Error Budget Monitoring

```javascript
// error-budget.js
class ErrorBudgetMonitor {
  constructor(slo) {
    this.slo = slo;
    this.window = slo.window;
    this.target = slo.target;
  }
  
  calculateErrorBudget() {
    const totalTime = this.window * 24 * 60; // minutes
    const allowedDowntime = totalTime * (1 - this.target / 100);
    
    const actualDowntime = this.getDowntimeMinutes();
    const consumedBudget = (actualDowntime / allowedDowntime) * 100;
    const remainingBudget = Math.max(0, 100 - consumedBudget);
    
    return {
      total: allowedDowntime,
      consumed: actualDowntime,
      remaining: allowedDowntime - actualDowntime,
      percentageRemaining: remainingBudget,
      burnRate: this.calculateBurnRate()
    };
  }
  
  calculateBurnRate() {
    const recentErrors = this.getRecentErrorRate('1h');
    const allowedErrorRate = 1 - (this.target / 100);
    return recentErrors / allowedErrorRate;
  }
  
  shouldAlert(budget) {
    if (budget.percentageRemaining < 10) {
      return { alert: true, severity: 'critical' };
    } else if (budget.percentageRemaining < 25) {
      return { alert: true, severity: 'warning' };
    } else if (budget.burnRate > 10) {
      return { alert: true, severity: 'warning', reason: 'high_burn_rate' };
    }
    return { alert: false };
  }
}
```

## Monitoring Best Practices

### 1. Metric Design

```yaml
best_practices:
  naming:
    - Use consistent prefixes (cmdiag_)
    - Include units in metric names (_seconds, _bytes)
    - Use descriptive names
    
  labels:
    - Keep cardinality low
    - Use meaningful label names
    - Avoid high-cardinality labels (user_id, session_id)
    
  collection:
    - Set appropriate scrape intervals
    - Use recording rules for expensive queries
    - Implement metric expiration
```

### 2. Dashboard Design

```javascript
// dashboard-best-practices.js
const dashboardGuidelines = {
  layout: {
    criticalMetrics: "Top row, full width",
    trends: "Middle section with time series",
    details: "Bottom section with tables/lists"
  },
  
  colors: {
    success: "#73BF69",
    warning: "#FADE2A",
    error: "#F2495C",
    info: "#5794F2"
  },
  
  refreshRates: {
    realtime: "5s",
    operational: "30s",
    analytical: "5m"
  },
  
  widgets: {
    maxPerDashboard: 20,
    maxQueriesPerWidget: 5,
    preferredTypes: ["timeseries", "stat", "gauge", "table"]
  }
};
```

### 3. Alert Design

```yaml
# alert-best-practices.yml
alerting_principles:
  - name: "Symptom-based alerts"
    description: "Alert on user-facing symptoms, not causes"
    example: "High error rate, not high CPU"
    
  - name: "Actionable alerts"
    description: "Every alert should have a clear action"
    includes:
      - Runbook link
      - Severity level
      - Impact description
      
  - name: "Alert fatigue prevention"
    strategies:
      - Group related alerts
      - Set appropriate thresholds
      - Use alert suppression
      - Implement business hours routing
      
  - name: "Testing alerts"
    practices:
      - Test in staging first
      - Verify notification delivery
      - Simulate failure scenarios
      - Document false positive handling
```

### 4. Capacity Planning

```python
# capacity-planning.py
class CapacityPlanner:
    def __init__(self, prometheus_url):
        self.prom = PrometheusClient(prometheus_url)
        
    def forecast_resource_usage(self, metric, days_ahead=30):
        """Forecast resource usage using linear regression"""
        # Get historical data
        query = f'{metric}[30d:1h]'
        data = self.prom.query_range(query)
        
        # Perform linear regression
        x = np.array(range(len(data)))
        y = np.array([point.value for point in data])
        
        slope, intercept = np.polyfit(x, y, 1)
        
        # Forecast
        future_x = len(data) + (days_ahead * 24)
        forecast = slope * future_x + intercept
        
        return {
            'current': y[-1],
            'forecast': forecast,
            'days_until_limit': self.calculate_days_to_limit(
                current=y[-1],
                rate=slope,
                limit=self.get_resource_limit(metric)
            )
        }
        
    def generate_capacity_report(self):
        """Generate comprehensive capacity report"""
        resources = [
            'node_memory_available_bytes',
            'node_filesystem_free_bytes',
            'cmdiag_database_size_bytes',
            'cmdiag_active_users'
        ]
        
        report = {}
        for resource in resources:
            report[resource] = self.forecast_resource_usage(resource)
            
        return report
```

### 5. Monitoring Automation

```yaml
# monitoring-automation.yml
automation:
  dashboard_generation:
    - Auto-create service dashboards
    - Template-based generation
    - Dynamic panel creation
    
  alert_tuning:
    - ML-based threshold adjustment
    - Seasonality detection
    - Automatic silence windows
    
  report_generation:
    schedule: "0 8 * * MON"  # Weekly on Monday
    recipients: ["ops-team@company.com"]
    contents:
      - SLO compliance
      - Incident summary
      - Capacity forecast
      - Performance trends
      
  metric_lifecycle:
    - Auto-discover new metrics
    - Deprecate unused metrics
    - Archive old data
    - Optimize storage
```

---

For additional monitoring resources and dashboard templates, visit: https://monitoring.cm-diagnostics.com