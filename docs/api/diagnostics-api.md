# Diagnostics API Documentation

## Overview

The Diagnostics API provides endpoints for running system diagnostics, retrieving diagnostic results, and managing diagnostic profiles for Content Manager 24.4 systems.

## Base URL

```
https://api.cm24.example.com/api/v1/diagnostics
```

## Authentication

All endpoints require authentication. Include the Bearer token in the Authorization header:

```
Authorization: Bearer {ACCESS_TOKEN}
```

## Endpoints

### 1. List Diagnostic Profiles

Retrieve all available diagnostic profiles.

```
GET /profiles
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `category` (optional): Filter by category (system, database, network, security)

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/diagnostics/profiles?category=system&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "profiles": [
    {
      "id": "diag-prof-001",
      "name": "System Health Check",
      "description": "Comprehensive system health diagnostic",
      "category": "system",
      "duration_estimate": 300,
      "checks": [
        "cpu_usage",
        "memory_usage",
        "disk_space",
        "service_status"
      ],
      "created_at": "2024-03-01T10:00:00Z",
      "updated_at": "2024-03-15T14:30:00Z"
    },
    {
      "id": "diag-prof-002",
      "name": "Database Performance",
      "description": "Database connection and performance diagnostics",
      "category": "database",
      "duration_estimate": 180,
      "checks": [
        "connection_pool",
        "query_performance",
        "index_health",
        "deadlock_detection"
      ],
      "created_at": "2024-03-01T10:00:00Z",
      "updated_at": "2024-03-10T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "pages": 1
  }
}
```

### 2. Run Diagnostics

Execute a diagnostic check using a specific profile.

```
POST /run
```

**Request Body:**
```json
{
  "profile_id": "diag-prof-001",
  "target": {
    "type": "server",
    "id": "srv-12345",
    "hostname": "cm24-prod-01.example.com"
  },
  "options": {
    "async": true,
    "priority": "high",
    "timeout": 600,
    "notify_on_completion": true
  },
  "metadata": {
    "initiated_by": "user@example.com",
    "reason": "Scheduled maintenance check"
  }
}
```

**Example Request:**
```bash
curl -X POST https://api.cm24.example.com/api/v1/diagnostics/run \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "diag-prof-001",
    "target": {
      "type": "server",
      "id": "srv-12345"
    },
    "options": {
      "async": true
    }
  }'
```

**Response:**
```json
{
  "diagnostic_id": "diag-run-789abc",
  "status": "running",
  "profile_id": "diag-prof-001",
  "started_at": "2024-04-01T10:30:00Z",
  "estimated_completion": "2024-04-01T10:35:00Z",
  "progress_url": "/api/v1/diagnostics/status/diag-run-789abc",
  "results_url": "/api/v1/diagnostics/results/diag-run-789abc"
}
```

### 3. Get Diagnostic Status

Check the status of a running diagnostic.

```
GET /status/{diagnostic_id}
```

**Example Request:**
```bash
curl -X GET https://api.cm24.example.com/api/v1/diagnostics/status/diag-run-789abc \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "diagnostic_id": "diag-run-789abc",
  "status": "running",
  "progress": {
    "current_step": 3,
    "total_steps": 5,
    "percentage": 60,
    "current_check": "disk_space",
    "completed_checks": [
      "cpu_usage",
      "memory_usage"
    ]
  },
  "started_at": "2024-04-01T10:30:00Z",
  "elapsed_time": 180,
  "estimated_remaining": 120
}
```

### 4. Get Diagnostic Results

Retrieve the results of a completed diagnostic.

```
GET /results/{diagnostic_id}
```

**Query Parameters:**
- `format` (optional): Response format (json, pdf, csv) default: json
- `include_raw` (optional): Include raw diagnostic data (boolean)

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/diagnostics/results/diag-run-789abc?include_raw=false" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "diagnostic_id": "diag-run-789abc",
  "profile_id": "diag-prof-001",
  "status": "completed",
  "summary": {
    "health_score": 85,
    "status": "healthy",
    "issues_found": 2,
    "warnings": 5,
    "recommendations": 3
  },
  "results": [
    {
      "check": "cpu_usage",
      "status": "pass",
      "score": 95,
      "details": {
        "average_usage": "45%",
        "peak_usage": "78%",
        "core_count": 8,
        "load_average": [1.2, 1.5, 1.3]
      }
    },
    {
      "check": "memory_usage",
      "status": "warning",
      "score": 70,
      "details": {
        "total_memory": "32GB",
        "used_memory": "28GB",
        "free_memory": "4GB",
        "usage_percentage": "87.5%"
      },
      "message": "Memory usage is high. Consider increasing available memory.",
      "severity": "medium"
    },
    {
      "check": "disk_space",
      "status": "fail",
      "score": 40,
      "details": {
        "volumes": [
          {
            "mount": "/",
            "total": "500GB",
            "used": "450GB",
            "free": "50GB",
            "usage_percentage": "90%"
          },
          {
            "mount": "/data",
            "total": "2TB",
            "used": "1.9TB",
            "free": "100GB",
            "usage_percentage": "95%"
          }
        ]
      },
      "message": "Critical disk space shortage on multiple volumes.",
      "severity": "high",
      "remediation": {
        "auto_available": true,
        "action_id": "rem-disk-cleanup-001",
        "description": "Clean up temporary files and old logs"
      }
    }
  ],
  "metadata": {
    "target": {
      "type": "server",
      "id": "srv-12345",
      "hostname": "cm24-prod-01.example.com"
    },
    "duration": 298,
    "started_at": "2024-04-01T10:30:00Z",
    "completed_at": "2024-04-01T10:34:58Z"
  }
}
```

### 5. List Historical Diagnostics

Retrieve historical diagnostic runs.

```
GET /history
```

**Query Parameters:**
- `target_id` (optional): Filter by target ID
- `profile_id` (optional): Filter by profile ID
- `status` (optional): Filter by status (completed, failed, cancelled)
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)
- `page` (optional): Page number
- `limit` (optional): Items per page

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/diagnostics/history?target_id=srv-12345&status=completed&limit=5" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "diagnostics": [
    {
      "diagnostic_id": "diag-run-789abc",
      "profile_id": "diag-prof-001",
      "profile_name": "System Health Check",
      "target": {
        "type": "server",
        "id": "srv-12345",
        "hostname": "cm24-prod-01.example.com"
      },
      "status": "completed",
      "health_score": 85,
      "started_at": "2024-04-01T10:30:00Z",
      "completed_at": "2024-04-01T10:34:58Z",
      "duration": 298
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 1,
    "pages": 1
  }
}
```

### 6. Cancel Running Diagnostic

Cancel a diagnostic that is currently running.

```
POST /cancel/{diagnostic_id}
```

**Request Body:**
```json
{
  "reason": "User requested cancellation",
  "force": false
}
```

**Example Request:**
```bash
curl -X POST https://api.cm24.example.com/api/v1/diagnostics/cancel/diag-run-789abc \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Taking too long"
  }'
```

**Response:**
```json
{
  "diagnostic_id": "diag-run-789abc",
  "status": "cancelled",
  "cancelled_at": "2024-04-01T10:32:30Z",
  "reason": "Taking too long"
}
```

### 7. Create Custom Diagnostic Profile

Create a new diagnostic profile with custom checks.

```
POST /profiles
```

**Request Body:**
```json
{
  "name": "Custom Database Check",
  "description": "Custom diagnostic for database performance",
  "category": "database",
  "checks": [
    {
      "name": "connection_pool",
      "enabled": true,
      "parameters": {
        "max_connections": 100,
        "timeout": 30
      }
    },
    {
      "name": "query_performance",
      "enabled": true,
      "parameters": {
        "slow_query_threshold": 1000,
        "sample_size": 100
      }
    }
  ],
  "schedule": {
    "enabled": true,
    "cron": "0 */6 * * *",
    "timezone": "UTC"
  }
}
```

**Response:**
```json
{
  "id": "diag-prof-custom-001",
  "name": "Custom Database Check",
  "description": "Custom diagnostic for database performance",
  "category": "database",
  "checks": [
    {
      "name": "connection_pool",
      "enabled": true,
      "parameters": {
        "max_connections": 100,
        "timeout": 30
      }
    },
    {
      "name": "query_performance",
      "enabled": true,
      "parameters": {
        "slow_query_threshold": 1000,
        "sample_size": 100
      }
    }
  ],
  "created_at": "2024-04-01T11:00:00Z",
  "created_by": "user@example.com"
}
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| DIAG001 | Invalid profile ID | 400 |
| DIAG002 | Target not found | 404 |
| DIAG003 | Diagnostic already running | 409 |
| DIAG004 | Insufficient permissions | 403 |
| DIAG005 | Diagnostic timeout | 408 |
| DIAG006 | Invalid parameters | 400 |
| DIAG007 | Profile not found | 404 |
| DIAG008 | Results not available | 404 |
| DIAG009 | Cannot cancel diagnostic | 400 |
| DIAG010 | Internal diagnostic error | 500 |

**Error Response Example:**
```json
{
  "error": {
    "code": "DIAG003",
    "message": "A diagnostic is already running for this target",
    "details": {
      "existing_diagnostic_id": "diag-run-456def",
      "started_at": "2024-04-01T10:00:00Z"
    }
  }
}
```

## Rate Limiting

- **GET endpoints**: 100 requests per minute
- **POST /run**: 10 requests per minute
- **POST /profiles**: 5 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1712059200
```

## Webhooks

Configure webhooks to receive diagnostic events:

```json
{
  "event": "diagnostic.completed",
  "diagnostic_id": "diag-run-789abc",
  "profile_id": "diag-prof-001",
  "status": "completed",
  "health_score": 85,
  "summary": {
    "issues_found": 2,
    "warnings": 5
  },
  "timestamp": "2024-04-01T10:34:58Z"
}
```

## Best Practices

1. **Use async mode** for long-running diagnostics
2. **Poll status endpoint** at reasonable intervals (10-30 seconds)
3. **Cache profile information** to reduce API calls
4. **Handle timeouts gracefully** with retry logic
5. **Store diagnostic IDs** for historical tracking