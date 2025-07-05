# CM Diagnostics Dashboard Templates

This guide provides ready-to-use dashboard templates for various monitoring scenarios in CM Diagnostics.

## Table of Contents

1. [Executive Dashboard](#executive-dashboard)
2. [Operations Dashboard](#operations-dashboard)
3. [Performance Dashboard](#performance-dashboard)
4. [Content Manager Dashboard](#content-manager-dashboard)
5. [Infrastructure Dashboard](#infrastructure-dashboard)
6. [Security Dashboard](#security-dashboard)
7. [SLA/SLO Dashboard](#slaslo-dashboard)
8. [Troubleshooting Dashboard](#troubleshooting-dashboard)
9. [Custom Dashboard Creation](#custom-dashboard-creation)

## Executive Dashboard

### Overview
High-level business metrics and system health for executive visibility.

```json
{
  "dashboard": {
    "title": "Executive Overview - CM Diagnostics",
    "refresh": "30s",
    "time": {"from": "now-24h", "to": "now"},
    "panels": [
      {
        "id": 1,
        "title": "System Health Score",
        "type": "stat",
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 0},
        "targets": [{
          "expr": "cmdiag_health_score",
          "legendFormat": "Health Score"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 80},
                {"color": "green", "value": 95}
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "Availability (30 Day)",
        "type": "stat",
        "gridPos": {"h": 8, "w": 6, "x": 6, "y": 0},
        "targets": [{
          "expr": "avg_over_time(up{job=\"cm-diagnostics\"}[30d]) * 100",
          "legendFormat": "Availability"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "decimals": 3
          }
        }
      },
      {
        "id": 3,
        "title": "Active Users",
        "type": "stat",
        "gridPos": {"h": 8, "w": 6, "x": 12, "y": 0},
        "targets": [{
          "expr": "cmdiag_active_users",
          "legendFormat": "Users"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "short"
          }
        }
      },
      {
        "id": 4,
        "title": "Documents Processed Today",
        "type": "stat",
        "gridPos": {"h": 8, "w": 6, "x": 18, "y": 0},
        "targets": [{
          "expr": "increase(cmdiag_documents_processed_total[1d])",
          "legendFormat": "Documents"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "decimals": 0
          }
        }
      },
      {
        "id": 5,
        "title": "Service Availability Trend",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 12, "x": 0, "y": 8},
        "targets": [{
          "expr": "avg by(service) (up{job=~\"cm-diagnostics|content-manager|idol\"})",
          "legendFormat": "{{service}}"
        }],
        "fieldConfig": {
          "defaults": {
            "custom": {
              "lineInterpolation": "smooth",
              "fillOpacity": 10
            }
          }
        }
      },
      {
        "id": 6,
        "title": "Business KPIs",
        "type": "bargauge",
        "gridPos": {"h": 10, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "cmdiag_document_processing_sla_compliance",
            "legendFormat": "Document SLA"
          },
          {
            "expr": "cmdiag_search_performance_score",
            "legendFormat": "Search Performance"
          },
          {
            "expr": "cmdiag_user_satisfaction_score",
            "legendFormat": "User Satisfaction"
          }
        ],
        "options": {
          "displayMode": "gradient",
          "orientation": "horizontal"
        }
      }
    ]
  }
}
```

## Operations Dashboard

### Real-time operational monitoring

```json
{
  "dashboard": {
    "title": "Operations Center - CM Diagnostics",
    "refresh": "5s",
    "panels": [
      {
        "title": "Active Alerts",
        "type": "table",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [{
          "expr": "ALERTS{alertstate=\"firing\"}",
          "format": "table",
          "instant": true
        }],
        "fieldConfig": {
          "overrides": [
            {
              "matcher": {"id": "byName", "options": "severity"},
              "properties": [{
                "id": "custom.displayMode",
                "value": "color-background"
              }]
            }
          ]
        }
      },
      {
        "title": "Service Status",
        "type": "state-timeline",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [{
          "expr": "up{job=~\"cm-diagnostics|content-manager|idol|postgres|redis\"}",
          "legendFormat": "{{job}}"
        }],
        "options": {
          "showValue": "never",
          "alignValue": "center"
        }
      },
      {
        "title": "Request Rate",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 8, "x": 0, "y": 8},
        "targets": [{
          "expr": "sum(rate(cmdiag_api_requests_total[1m])) by (method)",
          "legendFormat": "{{method}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps"
          }
        }
      },
      {
        "title": "Error Rate",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 8, "x": 8, "y": 8},
        "targets": [{
          "expr": "sum(rate(cmdiag_api_requests_total{status=~\"5..\"}[1m])) by (endpoint)",
          "legendFormat": "{{endpoint}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "custom": {
              "fillOpacity": 20,
              "lineWidth": 2
            }
          }
        }
      },
      {
        "title": "Response Time Heatmap",
        "type": "heatmap",
        "gridPos": {"h": 10, "w": 8, "x": 16, "y": 8},
        "targets": [{
          "expr": "sum(increase(cmdiag_api_request_duration_seconds_bucket[1m])) by (le)",
          "format": "heatmap"
        }],
        "options": {
          "calculate": true,
          "yAxis": {
            "unit": "s",
            "decimals": 1
          }
        }
      }
    ]
  }
}
```

## Performance Dashboard

### Detailed performance metrics

```json
{
  "dashboard": {
    "title": "Performance Analysis - CM Diagnostics",
    "panels": [
      {
        "title": "Response Time Percentiles",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.90, sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P90"
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
      },
      {
        "title": "Throughput by Endpoint",
        "type": "bargauge",
        "gridPos": {"h": 10, "w": 12, "x": 12, "y": 0},
        "targets": [{
          "expr": "sum(rate(cmdiag_api_requests_total[5m])) by (endpoint)",
          "legendFormat": "{{endpoint}}"
        }],
        "options": {
          "displayMode": "gradient",
          "orientation": "horizontal",
          "showUnfilled": true
        },
        "fieldConfig": {
          "defaults": {
            "unit": "reqps"
          }
        }
      },
      {
        "title": "Database Query Performance",
        "type": "table",
        "gridPos": {"h": 10, "w": 12, "x": 0, "y": 10},
        "targets": [{
          "expr": "topk(10, pg_stat_statements_mean_time_seconds{datname=\"cmdiagnostics\"})",
          "format": "table"
        }],
        "transformations": [
          {
            "id": "organize",
            "options": {
              "excludeByName": {
                "Time": true
              },
              "renameByName": {
                "query": "Query",
                "mean_time_seconds": "Avg Time (s)",
                "calls": "Calls"
              }
            }
          }
        ]
      },
      {
        "title": "Cache Hit Ratio",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 12, "x": 12, "y": 10},
        "targets": [
          {
            "expr": "redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total)",
            "legendFormat": "Hit Ratio"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percentunit",
            "min": 0,
            "max": 1
          }
        }
      }
    ]
  }
}
```

## Content Manager Dashboard

### CM-specific monitoring

```json
{
  "dashboard": {
    "title": "Content Manager Health - CM Diagnostics",
    "panels": [
      {
        "title": "CM Instance Health",
        "type": "stat",
        "gridPos": {"h": 6, "w": 4, "x": 0, "y": 0},
        "repeat": "instance",
        "repeatDirection": "h",
        "targets": [{
          "expr": "cmdiag_cm_connection_status{instance=\"$instance\"}",
          "legendFormat": "{{instance}}"
        }],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "green", "value": 1}
              ]
            },
            "mappings": [
              {"type": "value", "value": "0", "text": "Down"},
              {"type": "value", "value": "1", "text": "Up"}
            ]
          }
        }
      },
      {
        "title": "Document Processing Rate",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 12, "x": 0, "y": 6},
        "targets": [{
          "expr": "sum(rate(cmdiag_cm_documents_processed[5m])) by (type)",
          "legendFormat": "{{type}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "docs/sec",
            "custom": {
              "fillOpacity": 20,
              "stacking": {
                "mode": "normal"
              }
            }
          }
        }
      },
      {
        "title": "Queue Depths",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 12, "x": 12, "y": 6},
        "targets": [{
          "expr": "cmdiag_cm_queue_depth",
          "legendFormat": "{{queue_name}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "custom": {
              "lineWidth": 2
            }
          }
        }
      },
      {
        "title": "CM API Response Times",
        "type": "heatmap",
        "gridPos": {"h": 10, "w": 24, "x": 0, "y": 16},
        "targets": [{
          "expr": "sum(increase(cmdiag_cm_response_time_ms_bucket[1m])) by (le, operation)",
          "format": "heatmap"
        }],
        "options": {
          "calculate": false,
          "yAxis": {
            "unit": "ms"
          }
        }
      },
      {
        "title": "User Activity",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 26},
        "targets": [
          {
            "expr": "cmdiag_cm_active_sessions",
            "legendFormat": "Active Sessions"
          },
          {
            "expr": "rate(cmdiag_cm_login_total[5m])",
            "legendFormat": "Login Rate"
          }
        ]
      },
      {
        "title": "Storage Usage",
        "type": "piechart",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 26},
        "targets": [{
          "expr": "cmdiag_cm_storage_usage_bytes",
          "legendFormat": "{{storage_type}}"
        }],
        "options": {
          "displayLabels": ["name", "percent"],
          "pieType": "donut"
        }
      }
    ]
  }
}
```

## Infrastructure Dashboard

### System resource monitoring

```json
{
  "dashboard": {
    "title": "Infrastructure - CM Diagnostics",
    "panels": [
      {
        "title": "CPU Usage",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [{
          "expr": "100 - (avg by (instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
          "legendFormat": "{{instance}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100
          }
        }
      },
      {
        "title": "Memory Usage",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [{
          "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
          "legendFormat": "{{instance}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100
          }
        }
      },
      {
        "title": "Disk I/O",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "rate(node_disk_read_bytes_total[5m])",
            "legendFormat": "{{instance}} - Read"
          },
          {
            "expr": "rate(node_disk_written_bytes_total[5m])",
            "legendFormat": "{{instance}} - Write"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "Bps"
          }
        }
      },
      {
        "title": "Network Traffic",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "rate(node_network_receive_bytes_total{device!=\"lo\"}[5m])",
            "legendFormat": "{{instance}} {{device}} - RX"
          },
          {
            "expr": "rate(node_network_transmit_bytes_total{device!=\"lo\"}[5m])",
            "legendFormat": "{{instance}} {{device}} - TX"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "Bps"
          }
        }
      },
      {
        "title": "Disk Space Usage",
        "type": "bargauge",
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 16},
        "targets": [{
          "expr": "(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100",
          "legendFormat": "{{instance}} - {{mountpoint}}"
        }],
        "options": {
          "displayMode": "gradient",
          "orientation": "horizontal"
        },
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 70},
                {"color": "red", "value": 85}
              ]
            }
          }
        }
      }
    ]
  }
}
```

## Security Dashboard

### Security monitoring and audit

```json
{
  "dashboard": {
    "title": "Security Monitoring - CM Diagnostics",
    "panels": [
      {
        "title": "Authentication Events",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "rate(cmdiag_auth_success_total[5m])",
            "legendFormat": "Success"
          },
          {
            "expr": "rate(cmdiag_auth_failure_total[5m])",
            "legendFormat": "Failure"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "events/sec"
          }
        }
      },
      {
        "title": "Failed Login Attempts",
        "type": "table",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [{
          "expr": "topk(10, sum by (username, ip) (increase(cmdiag_auth_failure_total[1h])))",
          "format": "table",
          "instant": true
        }]
      },
      {
        "title": "API Access by User",
        "type": "piechart",
        "gridPos": {"h": 10, "w": 8, "x": 0, "y": 8},
        "targets": [{
          "expr": "sum by (user) (increase(cmdiag_api_requests_total[1h]))",
          "legendFormat": "{{user}}"
        }],
        "options": {
          "displayLabels": ["name", "value"]
        }
      },
      {
        "title": "Suspicious Activities",
        "type": "table",
        "gridPos": {"h": 10, "w": 16, "x": 8, "y": 8},
        "targets": [{
          "expr": "cmdiag_security_events_total",
          "format": "table"
        }],
        "transformations": [
          {
            "id": "organize",
            "options": {
              "renameByName": {
                "event_type": "Event Type",
                "source_ip": "Source IP",
                "user": "User",
                "timestamp": "Time"
              }
            }
          }
        ]
      },
      {
        "title": "Access Control Violations",
        "type": "stat",
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 18},
        "targets": [{
          "expr": "increase(cmdiag_access_denied_total[24h])",
          "legendFormat": "Violations"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 10},
                {"color": "red", "value": 50}
              ]
            }
          }
        }
      },
      {
        "title": "SSL Certificate Expiry",
        "type": "table",
        "gridPos": {"h": 8, "w": 18, "x": 6, "y": 18},
        "targets": [{
          "expr": "(probe_ssl_earliest_cert_expiry - time()) / 86400",
          "format": "table"
        }],
        "transformations": [
          {
            "id": "organize",
            "options": {
              "renameByName": {
                "instance": "Domain",
                "Value": "Days Until Expiry"
              }
            }
          }
        ]
      }
    ]
  }
}
```

## SLA/SLO Dashboard

### Service level monitoring

```json
{
  "dashboard": {
    "title": "SLA/SLO Monitoring - CM Diagnostics",
    "panels": [
      {
        "title": "Service Availability SLO",
        "type": "gauge",
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 0},
        "targets": [{
          "expr": "avg_over_time(up{job=\"cm-diagnostics\"}[30d]) * 100"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 99},
                {"color": "green", "value": 99.9}
              ]
            },
            "min": 95,
            "max": 100
          }
        }
      },
      {
        "title": "Error Budget Remaining",
        "type": "stat",
        "gridPos": {"h": 8, "w": 6, "x": 6, "y": 0},
        "targets": [{
          "expr": "(1 - (1 - avg_over_time(up{job=\"cm-diagnostics\"}[30d])) / 0.001) * 100"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 25},
                {"color": "green", "value": 50}
              ]
            }
          }
        }
      },
      {
        "title": "Latency SLO (P95 < 1s)",
        "type": "gauge",
        "gridPos": {"h": 8, "w": 6, "x": 12, "y": 0},
        "targets": [{
          "expr": "100 * (1 - sum(rate(cmdiag_api_request_duration_seconds_bucket{le=\"1\"}[30d])) / sum(rate(cmdiag_api_request_duration_seconds_count[30d])))"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 5},
                {"color": "red", "value": 10}
              ]
            },
            "max": 20
          }
        }
      },
      {
        "title": "Error Rate SLO",
        "type": "gauge",
        "gridPos": {"h": 8, "w": 6, "x": 18, "y": 0},
        "targets": [{
          "expr": "100 * sum(rate(cmdiag_api_requests_total{status=~\"5..\"}[30d])) / sum(rate(cmdiag_api_requests_total[30d]))"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 0.5},
                {"color": "red", "value": 1}
              ]
            },
            "max": 5
          }
        }
      },
      {
        "title": "SLO Compliance Trend",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 24, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "avg_over_time(up{job=\"cm-diagnostics\"}[1d]) * 100",
            "legendFormat": "Availability"
          },
          {
            "expr": "100 - (100 * sum(rate(cmdiag_api_requests_total{status=~\"5..\"}[1d])) / sum(rate(cmdiag_api_requests_total[1d])))",
            "legendFormat": "Success Rate"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 95,
            "max": 100
          }
        }
      },
      {
        "title": "Error Budget Burn Rate",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 12, "x": 0, "y": 18},
        "targets": [{
          "expr": "(1 - avg_over_time(up{job=\"cm-diagnostics\"}[1h])) / 0.001",
          "legendFormat": "Burn Rate"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "custom": {
              "fillOpacity": 20
            }
          }
        }
      },
      {
        "title": "SLA Violations",
        "type": "table",
        "gridPos": {"h": 10, "w": 12, "x": 12, "y": 18},
        "targets": [{
          "expr": "cmdiag_sla_violations_total",
          "format": "table"
        }]
      }
    ]
  }
}
```

## Troubleshooting Dashboard

### Quick problem identification

```json
{
  "dashboard": {
    "title": "Troubleshooting - CM Diagnostics",
    "panels": [
      {
        "title": "Error Log Stream",
        "type": "logs",
        "gridPos": {"h": 10, "w": 24, "x": 0, "y": 0},
        "targets": [{
          "expr": "{job=\"cm-diagnostics\"} |~ \"ERROR|CRITICAL\"",
          "refId": "A"
        }],
        "options": {
          "showTime": true,
          "showLabels": true,
          "wrapLogMessage": true
        }
      },
      {
        "title": "Slow Queries",
        "type": "table",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 10},
        "targets": [{
          "expr": "topk(10, pg_stat_statements_mean_time_seconds)",
          "format": "table"
        }]
      },
      {
        "title": "Failed API Calls",
        "type": "table",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 10},
        "targets": [{
          "expr": "topk(10, sum by (endpoint, status) (increase(cmdiag_api_requests_total{status=~\"4..|5..\"}[1h])))",
          "format": "table"
        }]
      },
      {
        "title": "Resource Saturation",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 24, "x": 0, "y": 18},
        "targets": [
          {
            "expr": "100 - (avg by (instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "{{instance}} - CPU"
          },
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "{{instance}} - Memory"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent"
          }
        }
      },
      {
        "title": "Correlation Analysis",
        "type": "timeseries",
        "gridPos": {"h": 10, "w": 24, "x": 0, "y": 28},
        "targets": [
          {
            "expr": "rate(cmdiag_api_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "Errors"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P95 Latency"
          },
          {
            "expr": "cmdiag_cm_queue_depth",
            "legendFormat": "Queue Depth"
          }
        ]
      }
    ]
  }
}
```

## Custom Dashboard Creation

### Dashboard Configuration Template

```yaml
# dashboard-config.yml
dashboard:
  title: "Custom Dashboard Template"
  uid: "custom-dashboard-001"
  tags:
    - custom
    - template
  
  time:
    from: "now-6h"
    to: "now"
    
  refresh: "30s"
  
  variables:
    - name: environment
      type: query
      query: "label_values(environment)"
      current: "production"
      
    - name: instance
      type: query
      query: 'label_values(cmdiag_api_requests_total{environment="$environment"}, instance)'
      multi: true
      includeAll: true
      
    - name: interval
      type: interval
      values: ["1m", "5m", "10m", "30m", "1h"]
      current: "5m"
      
  annotations:
    - datasource: "-- Grafana --"
      enable: true
      color: "rgba(0, 211, 255, 1)"
      name: "Deployments"
      query: "tags:deployment AND environment:$environment"
```

### Panel Creation Helper

```javascript
// dashboard-builder.js
class DashboardBuilder {
  constructor(title) {
    this.dashboard = {
      title: title,
      panels: [],
      templating: { list: [] },
      time: { from: "now-6h", to: "now" },
      refresh: "30s"
    };
    this.nextId = 1;
    this.currentY = 0;
  }
  
  addRow(title) {
    this.panels.push({
      id: this.nextId++,
      type: "row",
      title: title,
      gridPos: { h: 1, w: 24, x: 0, y: this.currentY },
      collapsed: false
    });
    this.currentY += 1;
    return this;
  }
  
  addPanel(config) {
    const panel = {
      id: this.nextId++,
      title: config.title,
      type: config.type || "timeseries",
      gridPos: config.gridPos || { h: 8, w: 12, x: 0, y: this.currentY },
      targets: config.targets,
      fieldConfig: config.fieldConfig || {},
      options: config.options || {}
    };
    
    this.panels.push(panel);
    
    // Auto-position next panel
    if (!config.gridPos) {
      this.currentY += 8;
    }
    
    return this;
  }
  
  addVariable(variable) {
    this.dashboard.templating.list.push(variable);
    return this;
  }
  
  build() {
    this.dashboard.panels = this.panels;
    return this.dashboard;
  }
}

// Usage example
const dashboard = new DashboardBuilder("My Custom Dashboard")
  .addVariable({
    name: "service",
    type: "query",
    query: "label_values(service)"
  })
  .addRow("Service Metrics")
  .addPanel({
    title: "Request Rate",
    targets: [{
      expr: 'rate(requests_total{service="$service"}[5m])'
    }]
  })
  .addPanel({
    title: "Error Rate",
    targets: [{
      expr: 'rate(errors_total{service="$service"}[5m])'
    }]
  })
  .build();
```

### Dashboard Best Practices

```yaml
best_practices:
  layout:
    - Use rows to organize related panels
    - Place most important metrics at top
    - Keep panels aligned to grid
    - Limit to 20-30 panels per dashboard
    
  performance:
    - Use recording rules for complex queries
    - Limit time range for detailed views
    - Use appropriate refresh intervals
    - Cache dashboard queries
    
  visualization:
    - Choose appropriate panel types
    - Use consistent color schemes
    - Add meaningful thresholds
    - Include units and descriptions
    
  maintenance:
    - Version control dashboard JSON
    - Document panel purposes
    - Regular review and cleanup
    - Test on different screen sizes
```

---

For more dashboard templates and examples, visit: https://dashboards.cm-diagnostics.com