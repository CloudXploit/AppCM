# Monitoring API Documentation

## Overview

The Monitoring API provides real-time metrics, performance data, and system monitoring capabilities for CM24.4 installations. It supports metric collection, alerting, dashboards, and historical data analysis.

## Base URL

```
https://api.cm24.example.com/api/v1/monitoring
```

## Authentication

All endpoints require authentication:

```
Authorization: Bearer {ACCESS_TOKEN}
Scope: read:monitoring
```

## Endpoints

### 1. Get Real-time Metrics

Retrieve current system metrics.

```
GET /metrics/realtime
```

**Query Parameters:**
- `target_id` (required): Target system/component ID
- `metrics` (optional): Comma-separated list of specific metrics
- `include_derived` (optional): Include calculated metrics (default: true)

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/monitoring/metrics/realtime?target_id=srv-12345&metrics=cpu,memory,disk" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "target": {
    "id": "srv-12345",
    "name": "cm24-prod-01",
    "type": "server"
  },
  "timestamp": "2024-04-01T14:30:00Z",
  "metrics": {
    "cpu": {
      "usage_percent": 45.2,
      "load_average": {
        "1min": 2.14,
        "5min": 2.45,
        "15min": 2.32
      },
      "cores": 8,
      "processes": {
        "total": 245,
        "running": 3,
        "sleeping": 242
      }
    },
    "memory": {
      "total_gb": 32,
      "used_gb": 24.5,
      "free_gb": 7.5,
      "usage_percent": 76.6,
      "cache_gb": 8.2,
      "swap": {
        "total_gb": 8,
        "used_gb": 0.5,
        "usage_percent": 6.25
      }
    },
    "disk": {
      "volumes": [
        {
          "mount": "/",
          "device": "/dev/sda1",
          "total_gb": 500,
          "used_gb": 350,
          "free_gb": 150,
          "usage_percent": 70,
          "inode_usage_percent": 45
        },
        {
          "mount": "/data",
          "device": "/dev/sdb1",
          "total_gb": 2000,
          "used_gb": 1500,
          "free_gb": 500,
          "usage_percent": 75,
          "inode_usage_percent": 52
        }
      ],
      "io": {
        "read_mbps": 125.4,
        "write_mbps": 89.2,
        "iops": 4523
      }
    },
    "network": {
      "interfaces": [
        {
          "name": "eth0",
          "status": "up",
          "ip": "10.0.1.10",
          "rx_mbps": 245.8,
          "tx_mbps": 189.4,
          "errors": 0,
          "dropped": 0
        }
      ],
      "connections": {
        "established": 1245,
        "time_wait": 89,
        "close_wait": 12
      }
    }
  }
}
```

### 2. Get Historical Metrics

Retrieve historical metric data.

```
GET /metrics/history
```

**Query Parameters:**
- `target_id` (required): Target system/component ID
- `metrics` (required): Comma-separated list of metrics
- `from` (required): Start time (ISO 8601)
- `to` (required): End time (ISO 8601)
- `resolution` (optional): Data resolution (1m, 5m, 1h, 1d)
- `aggregation` (optional): Aggregation method (avg, min, max, sum)

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/monitoring/metrics/history?target_id=srv-12345&metrics=cpu.usage_percent,memory.usage_percent&from=2024-04-01T00:00:00Z&to=2024-04-01T12:00:00Z&resolution=1h" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "target": {
    "id": "srv-12345",
    "name": "cm24-prod-01"
  },
  "period": {
    "from": "2024-04-01T00:00:00Z",
    "to": "2024-04-01T12:00:00Z",
    "resolution": "1h"
  },
  "data": [
    {
      "timestamp": "2024-04-01T00:00:00Z",
      "cpu.usage_percent": 32.5,
      "memory.usage_percent": 68.2
    },
    {
      "timestamp": "2024-04-01T01:00:00Z",
      "cpu.usage_percent": 28.9,
      "memory.usage_percent": 67.8
    },
    {
      "timestamp": "2024-04-01T02:00:00Z",
      "cpu.usage_percent": 25.4,
      "memory.usage_percent": 66.5
    }
  ],
  "statistics": {
    "cpu.usage_percent": {
      "min": 25.4,
      "max": 78.9,
      "avg": 45.2,
      "p95": 72.1,
      "p99": 77.8
    },
    "memory.usage_percent": {
      "min": 66.5,
      "max": 89.2,
      "avg": 75.8,
      "p95": 86.4,
      "p99": 88.7
    }
  }
}
```

### 3. Create Alert Rule

Define a new monitoring alert rule.

```
POST /alerts/rules
```

**Request Body:**
```json
{
  "name": "High CPU Usage Alert",
  "description": "Alert when CPU usage exceeds 90% for 5 minutes",
  "enabled": true,
  "targets": ["srv-12345", "srv-12346"],
  "condition": {
    "metric": "cpu.usage_percent",
    "operator": "greater_than",
    "threshold": 90,
    "duration": "5m",
    "aggregation": "avg"
  },
  "severity": "warning",
  "notifications": [
    {
      "type": "email",
      "recipients": ["ops@example.com"],
      "template": "high_cpu_alert"
    },
    {
      "type": "webhook",
      "url": "https://alerts.example.com/webhook",
      "headers": {
        "Authorization": "Bearer webhook-token"
      }
    }
  ],
  "cooldown": "15m",
  "tags": ["production", "performance"]
}
```

**Response:**
```json
{
  "rule_id": "alert-rule-001",
  "name": "High CPU Usage Alert",
  "status": "active",
  "created_at": "2024-04-01T15:00:00Z",
  "created_by": "user@example.com",
  "next_evaluation": "2024-04-01T15:01:00Z"
}
```

### 4. Get Active Alerts

Retrieve currently active alerts.

```
GET /alerts/active
```

**Query Parameters:**
- `target_id` (optional): Filter by target
- `severity` (optional): Filter by severity (critical, warning, info)
- `rule_id` (optional): Filter by rule ID
- `acknowledged` (optional): Filter by acknowledgment status

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/monitoring/alerts/active?severity=critical&acknowledged=false" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "alerts": [
    {
      "alert_id": "alert-inst-789",
      "rule_id": "alert-rule-002",
      "rule_name": "Disk Space Critical",
      "target": {
        "id": "srv-12345",
        "name": "cm24-prod-01"
      },
      "severity": "critical",
      "status": "active",
      "triggered_at": "2024-04-01T14:45:00Z",
      "details": {
        "metric": "disk.usage_percent",
        "current_value": 95.2,
        "threshold": 90,
        "mount": "/data"
      },
      "acknowledged": false,
      "notification_sent": true
    }
  ],
  "total": 1,
  "summary": {
    "critical": 1,
    "warning": 0,
    "info": 0
  }
}
```

### 5. Acknowledge Alert

Acknowledge an active alert.

```
POST /alerts/{alert_id}/acknowledge
```

**Request Body:**
```json
{
  "comment": "Investigating disk usage issue",
  "acknowledged_by": "ops@example.com",
  "expected_resolution": "2024-04-01T16:00:00Z"
}
```

**Response:**
```json
{
  "alert_id": "alert-inst-789",
  "acknowledged": true,
  "acknowledged_at": "2024-04-01T15:00:00Z",
  "acknowledged_by": "ops@example.com"
}
```

### 6. Create Custom Dashboard

Create a custom monitoring dashboard.

```
POST /dashboards
```

**Request Body:**
```json
{
  "name": "Production Overview",
  "description": "Main production servers monitoring",
  "layout": "grid",
  "refresh_interval": 30,
  "widgets": [
    {
      "id": "widget-001",
      "type": "line_chart",
      "title": "CPU Usage Trend",
      "position": {"x": 0, "y": 0, "w": 6, "h": 4},
      "config": {
        "targets": ["srv-12345", "srv-12346"],
        "metrics": ["cpu.usage_percent"],
        "time_range": "1h",
        "aggregation": "avg"
      }
    },
    {
      "id": "widget-002",
      "type": "gauge",
      "title": "Memory Usage",
      "position": {"x": 6, "y": 0, "w": 3, "h": 4},
      "config": {
        "target": "srv-12345",
        "metric": "memory.usage_percent",
        "thresholds": {
          "green": [0, 70],
          "yellow": [70, 85],
          "red": [85, 100]
        }
      }
    },
    {
      "id": "widget-003",
      "type": "alert_list",
      "title": "Active Alerts",
      "position": {"x": 9, "y": 0, "w": 3, "h": 4},
      "config": {
        "severity_filter": ["critical", "warning"],
        "limit": 10
      }
    }
  ],
  "tags": ["production", "overview"]
}
```

**Response:**
```json
{
  "dashboard_id": "dash-001",
  "name": "Production Overview",
  "created_at": "2024-04-01T15:30:00Z",
  "created_by": "user@example.com",
  "share_url": "https://cm24.example.com/dashboards/dash-001"
}
```

### 7. Get Service Health

Get aggregated health status for services.

```
GET /health/services
```

**Query Parameters:**
- `service` (optional): Filter by service name
- `include_dependencies` (optional): Include dependency health

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/monitoring/health/services?include_dependencies=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "overall_health": "degraded",
  "services": [
    {
      "name": "content-manager-core",
      "status": "healthy",
      "uptime_percent": 99.98,
      "response_time_ms": 45,
      "last_check": "2024-04-01T15:35:00Z",
      "endpoints": [
        {
          "name": "api",
          "url": "/api/v1/health",
          "status": "healthy",
          "response_time_ms": 23
        },
        {
          "name": "database",
          "status": "healthy",
          "response_time_ms": 12
        }
      ]
    },
    {
      "name": "search-service",
      "status": "degraded",
      "uptime_percent": 98.5,
      "response_time_ms": 250,
      "last_check": "2024-04-01T15:35:00Z",
      "issues": [
        {
          "type": "high_latency",
          "message": "Response time above threshold",
          "since": "2024-04-01T15:20:00Z"
        }
      ],
      "dependencies": [
        {
          "name": "elasticsearch",
          "status": "degraded",
          "impact": "performance"
        }
      ]
    }
  ],
  "checked_at": "2024-04-01T15:35:00Z"
}
```

### 8. Stream Real-time Metrics

Subscribe to real-time metric updates via Server-Sent Events (SSE).

```
GET /metrics/stream
```

**Query Parameters:**
- `target_id` (required): Target to monitor
- `metrics` (required): Comma-separated list of metrics
- `interval` (optional): Update interval in seconds (default: 5)

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/monitoring/metrics/stream?target_id=srv-12345&metrics=cpu.usage_percent,memory.usage_percent" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Accept: text/event-stream"
```

**Response (SSE Stream):**
```
event: metric_update
data: {"timestamp":"2024-04-01T15:40:00Z","cpu.usage_percent":45.2,"memory.usage_percent":76.8}

event: metric_update
data: {"timestamp":"2024-04-01T15:40:05Z","cpu.usage_percent":48.1,"memory.usage_percent":76.9}

event: alert
data: {"type":"threshold_exceeded","metric":"cpu.usage_percent","value":92.5,"threshold":90}
```

### 9. Export Metrics

Export metrics data in various formats.

```
POST /metrics/export
```

**Request Body:**
```json
{
  "targets": ["srv-12345", "srv-12346"],
  "metrics": ["cpu.usage_percent", "memory.usage_percent"],
  "time_range": {
    "from": "2024-04-01T00:00:00Z",
    "to": "2024-04-01T23:59:59Z"
  },
  "format": "csv",
  "resolution": "5m",
  "include_metadata": true
}
```

**Response:**
```json
{
  "export_id": "export-001",
  "status": "processing",
  "estimated_size_mb": 45,
  "download_url": "/api/v1/monitoring/exports/export-001/download",
  "expires_at": "2024-04-08T15:45:00Z"
}
```

### 10. Get Metric Metadata

Retrieve available metrics and their descriptions.

```
GET /metrics/catalog
```

**Query Parameters:**
- `category` (optional): Filter by category
- `target_type` (optional): Filter by target type

**Response:**
```json
{
  "metrics": [
    {
      "name": "cpu.usage_percent",
      "category": "system",
      "type": "gauge",
      "unit": "percent",
      "description": "CPU usage percentage",
      "labels": ["core", "mode"],
      "aggregations": ["avg", "min", "max", "sum"],
      "retention_days": 90
    },
    {
      "name": "http.request_rate",
      "category": "application",
      "type": "counter",
      "unit": "requests/second",
      "description": "HTTP request rate",
      "labels": ["method", "status", "endpoint"],
      "aggregations": ["sum", "avg"],
      "retention_days": 30
    }
  ],
  "total": 2
}
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| MON001 | Invalid metric name | 400 |
| MON002 | Target not found | 404 |
| MON003 | Time range too large | 400 |
| MON004 | Invalid aggregation | 400 |
| MON005 | Alert rule not found | 404 |
| MON006 | Dashboard limit exceeded | 429 |
| MON007 | Export failed | 500 |
| MON008 | Stream connection failed | 503 |
| MON009 | Insufficient data | 404 |
| MON010 | Invalid threshold | 400 |

## Rate Limiting

- **Real-time metrics**: 120 requests per minute
- **Historical queries**: 60 requests per minute
- **Alert operations**: 30 requests per minute
- **Metric streams**: 10 concurrent connections
- **Exports**: 5 requests per hour

## WebSocket Support

For real-time bidirectional communication:

```javascript
const ws = new WebSocket('wss://api.cm24.example.com/api/v1/monitoring/ws');

ws.send(JSON.stringify({
  action: 'subscribe',
  targets: ['srv-12345'],
  metrics: ['cpu.usage_percent', 'memory.usage_percent'],
  interval: 1000
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Metric update:', data);
};
```

## Best Practices

1. **Use appropriate resolutions** for historical queries
2. **Subscribe to specific metrics** rather than all metrics
3. **Implement exponential backoff** for retries
4. **Cache dashboard configurations** client-side
5. **Use metric aggregations** for large time ranges
6. **Set reasonable alert thresholds** to avoid noise
7. **Batch metric requests** when possible