# Remediation API Documentation

## Overview

The Remediation API provides automated remediation capabilities for issues identified by the CM24.4 diagnostics system. It supports pre-defined remediation actions, custom scripts, and workflow-based remediation processes.

## Base URL

```
https://api.cm24.example.com/api/v1/remediation
```

## Authentication

All endpoints require authentication with appropriate scopes:

```
Authorization: Bearer {ACCESS_TOKEN}
Scope: write:remediation
```

## Endpoints

### 1. List Available Remediation Actions

Get all available remediation actions for a specific issue type.

```
GET /actions
```

**Query Parameters:**
- `issue_type` (optional): Filter by issue type
- `category` (optional): Filter by category (system, database, network, security)
- `automated` (optional): Filter by automation support (true/false)
- `risk_level` (optional): Filter by risk level (low, medium, high)

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/api/v1/remediation/actions?category=system&automated=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "actions": [
    {
      "id": "rem-act-001",
      "name": "Clean Disk Space",
      "description": "Remove temporary files, old logs, and cache",
      "category": "system",
      "issue_types": ["disk_space_low", "disk_space_critical"],
      "automated": true,
      "risk_level": "low",
      "parameters": [
        {
          "name": "target_paths",
          "type": "array",
          "required": false,
          "default": ["/tmp", "/var/log", "/var/cache"],
          "description": "Paths to clean"
        },
        {
          "name": "age_days",
          "type": "integer",
          "required": false,
          "default": 30,
          "description": "Delete files older than this many days"
        }
      ],
      "estimated_duration": 300,
      "success_rate": 0.95
    },
    {
      "id": "rem-act-002",
      "name": "Restart Service",
      "description": "Restart a system service",
      "category": "system",
      "issue_types": ["service_down", "service_unresponsive"],
      "automated": true,
      "risk_level": "medium",
      "parameters": [
        {
          "name": "service_name",
          "type": "string",
          "required": true,
          "description": "Name of the service to restart"
        },
        {
          "name": "force",
          "type": "boolean",
          "required": false,
          "default": false,
          "description": "Force restart if service is stuck"
        }
      ],
      "estimated_duration": 60,
      "success_rate": 0.92
    }
  ],
  "total": 2
}
```

### 2. Execute Remediation Action

Execute a specific remediation action.

```
POST /execute
```

**Request Body:**
```json
{
  "action_id": "rem-act-001",
  "target": {
    "type": "server",
    "id": "srv-12345",
    "hostname": "cm24-prod-01.example.com"
  },
  "parameters": {
    "target_paths": ["/tmp", "/var/log"],
    "age_days": 7
  },
  "options": {
    "dry_run": false,
    "async": true,
    "approval_required": false,
    "rollback_enabled": true,
    "notification_emails": ["admin@example.com"]
  },
  "diagnostic_reference": {
    "diagnostic_id": "diag-run-789abc",
    "issue_id": "issue-disk-001"
  }
}
```

**Example Request:**
```bash
curl -X POST https://api.cm24.example.com/api/v1/remediation/execute \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "action_id": "rem-act-001",
    "target": {
      "type": "server",
      "id": "srv-12345"
    },
    "parameters": {
      "age_days": 7
    }
  }'
```

**Response:**
```json
{
  "execution_id": "rem-exec-456def",
  "action_id": "rem-act-001",
  "status": "pending",
  "created_at": "2024-04-01T11:00:00Z",
  "estimated_completion": "2024-04-01T11:05:00Z",
  "approval_status": "not_required",
  "execution_url": "/api/v1/remediation/executions/rem-exec-456def"
}
```

### 3. Get Remediation Status

Check the status of a remediation execution.

```
GET /executions/{execution_id}
```

**Example Request:**
```bash
curl -X GET https://api.cm24.example.com/api/v1/remediation/executions/rem-exec-456def \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "execution_id": "rem-exec-456def",
  "action_id": "rem-act-001",
  "action_name": "Clean Disk Space",
  "status": "running",
  "progress": {
    "percentage": 45,
    "current_step": "Cleaning /var/log",
    "steps_completed": 2,
    "total_steps": 4
  },
  "target": {
    "type": "server",
    "id": "srv-12345",
    "hostname": "cm24-prod-01.example.com"
  },
  "started_at": "2024-04-01T11:00:30Z",
  "logs": [
    {
      "timestamp": "2024-04-01T11:00:30Z",
      "level": "info",
      "message": "Starting disk cleanup"
    },
    {
      "timestamp": "2024-04-01T11:01:00Z",
      "level": "info",
      "message": "Cleaned 2.5GB from /tmp"
    },
    {
      "timestamp": "2024-04-01T11:02:00Z",
      "level": "info",
      "message": "Starting cleanup of /var/log"
    }
  ]
}
```

### 4. Get Remediation Results

Retrieve the results of a completed remediation.

```
GET /executions/{execution_id}/results
```

**Example Request:**
```bash
curl -X GET https://api.cm24.example.com/api/v1/remediation/executions/rem-exec-456def/results \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "execution_id": "rem-exec-456def",
  "status": "completed",
  "success": true,
  "summary": {
    "action": "Clean Disk Space",
    "target": "srv-12345",
    "duration": 298,
    "space_recovered": "15.7GB",
    "files_deleted": 1847
  },
  "details": {
    "paths_cleaned": [
      {
        "path": "/tmp",
        "space_recovered": "2.5GB",
        "files_deleted": 523
      },
      {
        "path": "/var/log",
        "space_recovered": "13.2GB",
        "files_deleted": 1324
      }
    ],
    "before_state": {
      "disk_usage": "95%",
      "free_space": "50GB"
    },
    "after_state": {
      "disk_usage": "82%",
      "free_space": "65.7GB"
    }
  },
  "completed_at": "2024-04-01T11:04:58Z",
  "rollback_available": true,
  "rollback_id": "rem-roll-789ghi"
}
```

### 5. Create Remediation Workflow

Create a multi-step remediation workflow.

```
POST /workflows
```

**Request Body:**
```json
{
  "name": "Database Performance Recovery",
  "description": "Comprehensive workflow to restore database performance",
  "steps": [
    {
      "order": 1,
      "action_id": "rem-act-010",
      "name": "Kill Long Running Queries",
      "parameters": {
        "threshold_seconds": 300
      },
      "continue_on_failure": false
    },
    {
      "order": 2,
      "action_id": "rem-act-011",
      "name": "Optimize Tables",
      "parameters": {
        "tables": ["orders", "customers", "products"]
      },
      "continue_on_failure": true
    },
    {
      "order": 3,
      "action_id": "rem-act-012",
      "name": "Clear Query Cache",
      "parameters": {},
      "continue_on_failure": true
    }
  ],
  "rollback_strategy": "all_or_nothing",
  "notification_config": {
    "on_start": true,
    "on_completion": true,
    "on_failure": true,
    "recipients": ["dba@example.com"]
  }
}
```

**Response:**
```json
{
  "workflow_id": "rem-wf-001",
  "name": "Database Performance Recovery",
  "status": "created",
  "created_at": "2024-04-01T12:00:00Z",
  "created_by": "user@example.com",
  "steps_count": 3
}
```

### 6. Execute Remediation Workflow

Execute a pre-defined remediation workflow.

```
POST /workflows/{workflow_id}/execute
```

**Request Body:**
```json
{
  "target": {
    "type": "database",
    "id": "db-mysql-prod-01",
    "connection_string": "mysql://prod-db.example.com:3306"
  },
  "options": {
    "dry_run": false,
    "parallel_execution": false,
    "stop_on_error": true
  }
}
```

**Response:**
```json
{
  "execution_id": "rem-wf-exec-001",
  "workflow_id": "rem-wf-001",
  "status": "running",
  "current_step": 1,
  "total_steps": 3,
  "started_at": "2024-04-01T12:05:00Z"
}
```

### 7. Rollback Remediation

Rollback a completed remediation action.

```
POST /rollback
```

**Request Body:**
```json
{
  "execution_id": "rem-exec-456def",
  "rollback_id": "rem-roll-789ghi",
  "reason": "Performance degradation observed after cleanup",
  "force": false
}
```

**Response:**
```json
{
  "rollback_execution_id": "rem-roll-exec-001",
  "original_execution_id": "rem-exec-456def",
  "status": "running",
  "estimated_duration": 180,
  "started_at": "2024-04-01T12:30:00Z"
}
```

### 8. Schedule Remediation

Schedule a remediation action to run at a specific time or recurring schedule.

```
POST /schedule
```

**Request Body:**
```json
{
  "action_id": "rem-act-001",
  "target": {
    "type": "server",
    "id": "srv-12345"
  },
  "parameters": {
    "age_days": 30
  },
  "schedule": {
    "type": "recurring",
    "cron": "0 2 * * 0",
    "timezone": "UTC",
    "start_date": "2024-04-07",
    "enabled": true
  },
  "notification_emails": ["admin@example.com"]
}
```

**Response:**
```json
{
  "schedule_id": "rem-sched-001",
  "action_id": "rem-act-001",
  "status": "active",
  "next_run": "2024-04-07T02:00:00Z",
  "created_at": "2024-04-01T13:00:00Z"
}
```

### 9. Get Remediation History

Retrieve historical remediation executions.

```
GET /history
```

**Query Parameters:**
- `target_id` (optional): Filter by target
- `action_id` (optional): Filter by action
- `status` (optional): Filter by status
- `from` (optional): Start date
- `to` (optional): End date
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "executions": [
    {
      "execution_id": "rem-exec-456def",
      "action_name": "Clean Disk Space",
      "target": "srv-12345",
      "status": "completed",
      "success": true,
      "started_at": "2024-04-01T11:00:30Z",
      "completed_at": "2024-04-01T11:04:58Z",
      "duration": 298,
      "executed_by": "automation",
      "rollback_available": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| REM001 | Invalid action ID | 400 |
| REM002 | Target not found | 404 |
| REM003 | Missing required parameters | 400 |
| REM004 | Remediation already running | 409 |
| REM005 | Insufficient permissions | 403 |
| REM006 | Approval required | 202 |
| REM007 | Rollback not available | 400 |
| REM008 | Workflow step failed | 500 |
| REM009 | Schedule conflict | 409 |
| REM010 | Remediation timeout | 408 |

**Error Response Example:**
```json
{
  "error": {
    "code": "REM003",
    "message": "Missing required parameter: service_name",
    "details": {
      "action_id": "rem-act-002",
      "required_parameters": ["service_name"],
      "provided_parameters": []
    }
  }
}
```

## Webhooks Events

Available webhook events for remediation:

- `remediation.started`
- `remediation.completed`
- `remediation.failed`
- `remediation.approved`
- `remediation.rollback_started`
- `remediation.rollback_completed`

**Webhook Payload Example:**
```json
{
  "event": "remediation.completed",
  "execution_id": "rem-exec-456def",
  "action_id": "rem-act-001",
  "target": {
    "type": "server",
    "id": "srv-12345"
  },
  "status": "completed",
  "success": true,
  "duration": 298,
  "timestamp": "2024-04-01T11:04:58Z"
}
```

## Rate Limiting

- **GET endpoints**: 100 requests per minute
- **POST /execute**: 20 requests per minute
- **POST /workflows/*/execute**: 10 requests per minute
- **POST /rollback**: 5 requests per minute

## Best Practices

1. **Always use dry_run** first for critical systems
2. **Enable rollback** for reversible actions
3. **Set appropriate timeouts** based on action complexity
4. **Monitor execution logs** in real-time
5. **Test workflows** in non-production environments first
6. **Use approval workflows** for high-risk actions
7. **Schedule maintenance** during low-traffic periods