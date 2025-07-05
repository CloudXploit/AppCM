# Monitoring Dashboards Configuration - CM Diagnostics Platform

## Overview
This document defines the comprehensive monitoring strategy and dashboard configurations for the Content Manager Diagnostics & Auto-Remediation Platform.

## Dashboard Architecture

### Dashboard Hierarchy
```
Executive Dashboard
├── Operations Overview
├── Business Metrics
└── Health Summary

Technical Dashboards
├── Application Performance
├── Infrastructure Health
├── Database Monitoring
├── Security Operations
└── Diagnostic Analytics

Specialized Dashboards
├── Content Manager Health
├── IDOL Integration
├── Auto-Remediation Status
└── ML Model Performance
```

## 1. Executive Dashboard

### 1.1 Key Business Metrics
```json
{
  "dashboard": "executive-overview",
  "panels": [
    {
      "title": "Platform Health Score",
      "type": "gauge",
      "metrics": ["platform.health.score"],
      "thresholds": {
        "green": 95,
        "yellow": 85,
        "red": 0
      }
    },
    {
      "title": "Active Users",
      "type": "stat",
      "metrics": ["users.active.count"],
      "sparkline": true
    },
    {
      "title": "Diagnostics Run Today",
      "type": "stat",
      "metrics": ["diagnostics.daily.count"],
      "comparison": "yesterday"
    },
    {
      "title": "Auto-Remediations",
      "type": "stat",
      "metrics": ["remediations.daily.count"],
      "comparison": "yesterday"
    },
    {
      "title": "Cost Savings",
      "type": "currency",
      "metrics": ["business.savings.monthly"],
      "format": "USD"
    }
  ]
}
```

### 1.2 Service Level Indicators (SLIs)
```yaml
uptime_sli:
  name: "Platform Uptime"
  target: 99.99%
  calculation: |
    (1 - (downtime_minutes / total_minutes)) * 100
  
response_time_sli:
  name: "API Response Time"
  target: "< 200ms (p95)"
  calculation: |
    histogram_quantile(0.95, api_response_time_seconds)

diagnostic_accuracy_sli:
  name: "Diagnostic Accuracy"
  target: "> 99%"
  calculation: |
    (correct_diagnostics / total_diagnostics) * 100
```

## 2. Application Performance Dashboard

### 2.1 Frontend Performance
```json
{
  "dashboard": "frontend-performance",
  "refresh": "30s",
  "panels": [
    {
      "title": "Page Load Time",
      "query": "histogram_quantile(0.95, page_load_duration_seconds)",
      "visualization": "timeseries",
      "unit": "seconds"
    },
    {
      "title": "Core Web Vitals",
      "panels": [
        {
          "metric": "lcp",
          "title": "Largest Contentful Paint",
          "target": "< 2.5s"
        },
        {
          "metric": "fid",
          "title": "First Input Delay",
          "target": "< 100ms"
        },
        {
          "metric": "cls",
          "title": "Cumulative Layout Shift",
          "target": "< 0.1"
        }
      ]
    },
    {
      "title": "JavaScript Errors",
      "query": "rate(frontend_errors_total[5m])",
      "alert": {
        "condition": "> 10",
        "severity": "warning"
      }
    }
  ]
}
```

### 2.2 Backend Performance
```json
{
  "dashboard": "backend-performance",
  "panels": [
    {
      "title": "API Response Time",
      "query": "histogram_quantile(0.95, http_request_duration_seconds)",
      "breakdown": ["endpoint", "method"]
    },
    {
      "title": "Request Rate",
      "query": "rate(http_requests_total[5m])",
      "visualization": "timeseries"
    },
    {
      "title": "Error Rate",
      "query": "rate(http_requests_total{status=~'5..'}[5m])",
      "alert": {
        "condition": "> 1%",
        "severity": "critical"
      }
    },
    {
      "title": "Database Query Performance",
      "query": "histogram_quantile(0.95, db_query_duration_seconds)",
      "breakdown": ["query_type"]
    }
  ]
}
```

## 3. Infrastructure Monitoring

### 3.1 Kubernetes Dashboard
```yaml
kubernetes_dashboard:
  - panel: "Cluster Health"
    metrics:
      - nodes.ready.count
      - nodes.total.count
      - pods.running.count
      - pods.pending.count
      
  - panel: "Resource Usage"
    metrics:
      - cpu.usage.percentage
      - memory.usage.percentage
      - disk.usage.percentage
      - network.throughput
      
  - panel: "Pod Health"
    table:
      - namespace
      - pod_name
      - status
      - restarts
      - cpu_usage
      - memory_usage
```

### 3.2 Container Metrics
```json
{
  "dashboard": "container-metrics",
  "panels": [
    {
      "title": "Container CPU Usage",
      "query": "rate(container_cpu_usage_seconds_total[5m])",
      "groupBy": ["pod", "container"]
    },
    {
      "title": "Container Memory Usage",
      "query": "container_memory_usage_bytes",
      "groupBy": ["pod", "container"]
    },
    {
      "title": "Container Network I/O",
      "queries": {
        "rx": "rate(container_network_receive_bytes_total[5m])",
        "tx": "rate(container_network_transmit_bytes_total[5m])"
      }
    }
  ]
}
```

## 4. Database Monitoring

### 4.1 PostgreSQL Dashboard
```sql
-- Key metrics queries
-- Connection metrics
SELECT 
  datname,
  numbackends as active_connections,
  xact_commit as transactions_committed,
  xact_rollback as transactions_rolled_back,
  blks_read as blocks_read,
  blks_hit as blocks_hit,
  tup_returned as rows_returned,
  tup_fetched as rows_fetched,
  tup_inserted as rows_inserted,
  tup_updated as rows_updated,
  tup_deleted as rows_deleted
FROM pg_stat_database;

-- Query performance
SELECT 
  queryid,
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  stddev_exec_time,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### 4.2 Redis Dashboard
```json
{
  "dashboard": "redis-monitoring",
  "panels": [
    {
      "title": "Cache Hit Rate",
      "query": "redis_keyspace_hits / (redis_keyspace_hits + redis_keyspace_misses)",
      "target": "> 95%"
    },
    {
      "title": "Memory Usage",
      "query": "redis_memory_used_bytes / redis_memory_max_bytes",
      "alert": {
        "condition": "> 0.9",
        "severity": "warning"
      }
    },
    {
      "title": "Commands/sec",
      "query": "rate(redis_commands_processed_total[5m])"
    },
    {
      "title": "Connected Clients",
      "query": "redis_connected_clients"
    }
  ]
}
```

## 5. Security Operations Dashboard

### 5.1 Security Metrics
```yaml
security_dashboard:
  authentication:
    - failed_login_attempts
    - successful_logins
    - account_lockouts
    - password_resets
    
  authorization:
    - unauthorized_access_attempts
    - privilege_escalations
    - api_key_usage
    - token_expiries
    
  threats:
    - blocked_ips
    - ddos_attempts
    - sql_injection_attempts
    - suspicious_patterns
```

### 5.2 Audit Trail Dashboard
```json
{
  "dashboard": "audit-trail",
  "panels": [
    {
      "title": "User Activity Timeline",
      "type": "timeline",
      "events": [
        "user.login",
        "user.logout",
        "diagnostic.run",
        "remediation.execute",
        "config.change"
      ]
    },
    {
      "title": "Configuration Changes",
      "type": "table",
      "columns": [
        "timestamp",
        "user",
        "action",
        "resource",
        "old_value",
        "new_value"
      ]
    }
  ]
}
```

## 6. Diagnostic Operations Dashboard

### 6.1 Diagnostic Performance
```json
{
  "dashboard": "diagnostic-operations",
  "panels": [
    {
      "title": "Diagnostics by Type",
      "type": "piechart",
      "query": "sum by (diagnostic_type) (diagnostics_total)"
    },
    {
      "title": "Diagnostic Duration",
      "type": "heatmap",
      "query": "diagnostic_duration_seconds",
      "buckets": [1, 5, 10, 30, 60, 300]
    },
    {
      "title": "Issues Detected",
      "type": "timeseries",
      "queries": {
        "critical": "issues_detected{severity='critical'}",
        "high": "issues_detected{severity='high'}",
        "medium": "issues_detected{severity='medium'}",
        "low": "issues_detected{severity='low'}"
      }
    },
    {
      "title": "Top Issues",
      "type": "table",
      "query": "topk(10, issues_by_type)"
    }
  ]
}
```

### 6.2 Auto-Remediation Dashboard
```yaml
remediation_dashboard:
  overview:
    - total_remediations
    - successful_remediations
    - failed_remediations
    - rollback_count
    
  performance:
    - remediation_duration
    - queue_length
    - processing_rate
    
  safety:
    - approval_required
    - auto_approved
    - manual_interventions
    - safety_checks_failed
```

## 7. Content Manager Health Dashboard

### 7.1 CM System Metrics
```json
{
  "dashboard": "content-manager-health",
  "panels": [
    {
      "title": "CM Instances",
      "type": "map",
      "data": {
        "instances": "cm_instances_by_location",
        "health": "cm_instance_health_score"
      }
    },
    {
      "title": "CM Version Distribution",
      "type": "barchart",
      "query": "count by (version) (cm_instances)"
    },
    {
      "title": "CM Performance Metrics",
      "panels": [
        {
          "metric": "document_processing_rate",
          "unit": "docs/sec"
        },
        {
          "metric": "index_size",
          "unit": "GB"
        },
        {
          "metric": "query_response_time",
          "unit": "ms"
        }
      ]
    }
  ]
}
```

## 8. Machine Learning Dashboard

### 8.1 Model Performance
```yaml
ml_dashboard:
  model_metrics:
    - accuracy
    - precision
    - recall
    - f1_score
    - auc_roc
    
  inference_metrics:
    - predictions_per_second
    - inference_latency
    - model_load_time
    - cache_hit_rate
    
  training_metrics:
    - training_loss
    - validation_loss
    - epochs_completed
    - learning_rate
```

## 9. Alerting Configuration

### 9.1 Alert Rules
```yaml
alerts:
  - name: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} (threshold: 5%)"
      
  - name: DatabaseConnectionPool
    expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.9
    for: 5m
    severity: warning
    annotations:
      summary: "Database connection pool nearly exhausted"
      
  - name: DiskSpaceLow
    expr: disk_free_bytes / disk_total_bytes < 0.1
    for: 10m
    severity: critical
    annotations:
      summary: "Low disk space on {{ $labels.instance }}"
```

### 9.2 Notification Channels
```json
{
  "notification_channels": [
    {
      "name": "critical-alerts",
      "type": "pagerduty",
      "routing_key": "${PAGERDUTY_KEY}"
    },
    {
      "name": "ops-team",
      "type": "slack",
      "webhook": "${SLACK_WEBHOOK}",
      "channel": "#ops-alerts"
    },
    {
      "name": "email-alerts",
      "type": "email",
      "recipients": ["ops@company.com"]
    }
  ]
}
```

## 10. Custom Dashboard Builder

### 10.1 Dashboard Template
```yaml
custom_dashboard_template:
  metadata:
    name: "custom-dashboard"
    description: "User-defined dashboard"
    tags: ["custom", "user-created"]
    
  variables:
    - name: "environment"
      type: "query"
      query: "label_values(environment)"
      
    - name: "time_range"
      type: "interval"
      options: ["5m", "15m", "1h", "6h", "24h"]
      
  panels: []  # User-defined panels
```

### 10.2 Panel Configuration Options
```json
{
  "panel_types": [
    "timeseries",
    "stat",
    "gauge",
    "table",
    "heatmap",
    "piechart",
    "barchart",
    "text",
    "alert"
  ],
  "visualization_options": {
    "colors": ["green", "yellow", "red"],
    "thresholds": "configurable",
    "legends": "configurable",
    "axes": "configurable"
  }
}
```

## Dashboard Access Control

### Role-Based Dashboard Access
```yaml
dashboard_permissions:
  executive:
    - executive-overview
    - business-metrics
    
  operations:
    - all-dashboards
    
  developers:
    - application-performance
    - infrastructure-health
    - diagnostic-operations
    
  security:
    - security-operations
    - audit-trail
    
  readonly:
    - view-only: all-dashboards
```

---

This monitoring dashboard configuration provides comprehensive visibility into all aspects of the CM Diagnostics Platform. Regular reviews and updates ensure dashboards remain relevant and actionable.