# Webhooks Documentation

## Overview

CM24.4 Webhooks allow you to receive real-time notifications when specific events occur in your Content Manager system. Instead of polling for changes, webhooks push event data to your configured endpoints immediately when events happen.

## Webhook Management

### 1. Create Webhook

Register a new webhook endpoint.

```
POST /api/v1/webhooks
```

**Request Body:**
```json
{
  "name": "Production Alerts Webhook",
  "description": "Receives critical system alerts",
  "url": "https://myapp.example.com/webhooks/cm24",
  "events": [
    "diagnostic.completed",
    "remediation.failed",
    "alert.triggered",
    "system.critical"
  ],
  "enabled": true,
  "secret": "webhook-secret-key-123",
  "headers": {
    "X-Custom-Header": "custom-value"
  },
  "retry_policy": {
    "max_attempts": 3,
    "backoff_multiplier": 2,
    "initial_delay_seconds": 5
  },
  "filters": {
    "severity": ["critical", "warning"],
    "targets": ["srv-12345", "srv-12346"]
  }
}
```

**Example Request:**
```bash
curl -X POST https://api.cm24.example.com/api/v1/webhooks \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Alerts",
    "url": "https://myapp.example.com/webhooks/cm24",
    "events": ["alert.triggered"],
    "secret": "my-webhook-secret"
  }'
```

**Response:**
```json
{
  "webhook_id": "webhook-001",
  "name": "Production Alerts Webhook",
  "url": "https://myapp.example.com/webhooks/cm24",
  "status": "active",
  "created_at": "2024-04-01T16:00:00Z",
  "verification_token": "verify-abc123"
}
```

### 2. List Webhooks

Retrieve all configured webhooks.

```
GET /api/v1/webhooks
```

**Query Parameters:**
- `status` (optional): Filter by status (active, paused, failed)
- `event` (optional): Filter by subscribed event type

**Response:**
```json
{
  "webhooks": [
    {
      "webhook_id": "webhook-001",
      "name": "Production Alerts Webhook",
      "url": "https://myapp.example.com/webhooks/cm24",
      "events": ["alert.triggered", "diagnostic.completed"],
      "status": "active",
      "enabled": true,
      "last_triggered": "2024-04-01T15:45:00Z",
      "success_rate": 0.98,
      "created_at": "2024-04-01T10:00:00Z"
    }
  ],
  "total": 1
}
```

### 3. Update Webhook

Update webhook configuration.

```
PUT /api/v1/webhooks/{webhook_id}
```

**Request Body:**
```json
{
  "events": [
    "diagnostic.completed",
    "remediation.failed",
    "alert.triggered",
    "system.critical",
    "service.down"
  ],
  "enabled": true,
  "filters": {
    "severity": ["critical"],
    "targets": ["srv-12345"]
  }
}
```

**Response:**
```json
{
  "webhook_id": "webhook-001",
  "updated_at": "2024-04-01T16:30:00Z",
  "changes": ["events", "filters"]
}
```

### 4. Delete Webhook

Remove a webhook configuration.

```
DELETE /api/v1/webhooks/{webhook_id}
```

**Response:**
```
HTTP/1.1 204 No Content
```

### 5. Test Webhook

Send a test event to verify webhook configuration.

```
POST /api/v1/webhooks/{webhook_id}/test
```

**Request Body:**
```json
{
  "event_type": "test.webhook",
  "sample_data": true
}
```

**Response:**
```json
{
  "test_id": "test-123",
  "webhook_id": "webhook-001",
  "status": "success",
  "response": {
    "status_code": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": "{\"received\": true}",
    "duration_ms": 145
  },
  "timestamp": "2024-04-01T16:45:00Z"
}
```

## Webhook Events

### Event Categories

#### Diagnostic Events

**diagnostic.started**
```json
{
  "event": "diagnostic.started",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T10:30:00Z",
  "data": {
    "diagnostic_id": "diag-run-789abc",
    "profile_id": "diag-prof-001",
    "profile_name": "System Health Check",
    "target": {
      "type": "server",
      "id": "srv-12345",
      "name": "cm24-prod-01"
    },
    "initiated_by": "automation"
  }
}
```

**diagnostic.completed**
```json
{
  "event": "diagnostic.completed",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T10:35:00Z",
  "data": {
    "diagnostic_id": "diag-run-789abc",
    "profile_id": "diag-prof-001",
    "status": "completed",
    "health_score": 85,
    "issues_found": 2,
    "warnings": 5,
    "duration": 298,
    "results_url": "/api/v1/diagnostics/results/diag-run-789abc"
  }
}
```

**diagnostic.failed**
```json
{
  "event": "diagnostic.failed",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T10:32:00Z",
  "data": {
    "diagnostic_id": "diag-run-789abc",
    "error": "Connection timeout",
    "error_code": "DIAG005",
    "failed_at_step": "database_check"
  }
}
```

#### Remediation Events

**remediation.started**
```json
{
  "event": "remediation.started",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T11:00:00Z",
  "data": {
    "execution_id": "rem-exec-456def",
    "action_id": "rem-act-001",
    "action_name": "Clean Disk Space",
    "target": {
      "type": "server",
      "id": "srv-12345"
    },
    "triggered_by": "diagnostic",
    "diagnostic_id": "diag-run-789abc"
  }
}
```

**remediation.completed**
```json
{
  "event": "remediation.completed",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T11:05:00Z",
  "data": {
    "execution_id": "rem-exec-456def",
    "action_id": "rem-act-001",
    "status": "completed",
    "success": true,
    "duration": 298,
    "summary": {
      "space_recovered": "15.7GB",
      "files_deleted": 1847
    }
  }
}
```

**remediation.failed**
```json
{
  "event": "remediation.failed",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T11:03:00Z",
  "data": {
    "execution_id": "rem-exec-456def",
    "action_id": "rem-act-001",
    "error": "Permission denied",
    "error_code": "REM004",
    "rollback_available": false
  }
}
```

#### Alert Events

**alert.triggered**
```json
{
  "event": "alert.triggered",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T14:45:00Z",
  "data": {
    "alert_id": "alert-inst-789",
    "rule_id": "alert-rule-002",
    "rule_name": "High CPU Usage",
    "severity": "critical",
    "target": {
      "type": "server",
      "id": "srv-12345",
      "name": "cm24-prod-01"
    },
    "details": {
      "metric": "cpu.usage_percent",
      "current_value": 95.2,
      "threshold": 90,
      "duration": "5m"
    },
    "notification_sent": true
  }
}
```

**alert.resolved**
```json
{
  "event": "alert.resolved",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T15:00:00Z",
  "data": {
    "alert_id": "alert-inst-789",
    "rule_id": "alert-rule-002",
    "resolved_at": "2024-04-01T15:00:00Z",
    "duration_minutes": 15,
    "resolved_by": "auto"
  }
}
```

#### System Events

**system.critical**
```json
{
  "event": "system.critical",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T16:00:00Z",
  "data": {
    "type": "service_failure",
    "service": "database-primary",
    "message": "Primary database connection lost",
    "impact": "high",
    "affected_components": ["api", "web-ui"],
    "action_required": true
  }
}
```

**service.down**
```json
{
  "event": "service.down",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T16:30:00Z",
  "data": {
    "service": "search-service",
    "instance": "search-01",
    "last_seen": "2024-04-01T16:29:45Z",
    "health_checks_failed": 3,
    "auto_restart_attempted": true
  }
}
```

**deployment.completed**
```json
{
  "event": "deployment.completed",
  "webhook_id": "webhook-001",
  "timestamp": "2024-04-01T17:00:00Z",
  "data": {
    "deployment_id": "deploy-123",
    "version": "24.4.1",
    "environment": "production",
    "status": "success",
    "duration_seconds": 420,
    "deployed_by": "ci-automation"
  }
}
```

## Webhook Security

### Signature Verification

All webhook payloads are signed using HMAC-SHA256. Verify the signature to ensure authenticity:

**Headers sent with webhook:**
```
X-CM24-Signature: sha256=a3f2d9b8c7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0
X-CM24-Event: diagnostic.completed
X-CM24-Webhook-ID: webhook-001
X-CM24-Timestamp: 1711983600
```

**Verification Example (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Express.js middleware
app.post('/webhooks/cm24', (req, res) => {
  const signature = req.headers['x-cm24-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  console.log('Webhook verified:', req.body);
  res.status(200).send('OK');
});
```

**Verification Example (Python):**
```python
import hmac
import hashlib

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"sha256={expected_signature}" == signature

# Flask example
@app.route('/webhooks/cm24', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-CM24-Signature')
    payload = request.get_data(as_text=True)
    
    if not verify_webhook_signature(payload, signature, WEBHOOK_SECRET):
        return 'Invalid signature', 401
    
    # Process webhook
    data = request.get_json()
    print(f"Webhook received: {data}")
    return 'OK', 200
```

## Webhook Delivery

### Retry Policy

Failed webhook deliveries are retried with exponential backoff:

1. Initial attempt: Immediate
2. First retry: 5 seconds
3. Second retry: 10 seconds
4. Third retry: 20 seconds

**Failure Conditions:**
- HTTP status codes 5xx
- Connection timeout (30 seconds)
- SSL/TLS errors

### Webhook Response

Your endpoint should return a 2xx status code within 30 seconds:

**Success Response:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"status": "received"}
```

**Error Response:**
```
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{"error": "Processing failed", "retry": true}
```

## Webhook Logs

### Get Webhook Delivery Logs

```
GET /api/v1/webhooks/{webhook_id}/logs
```

**Query Parameters:**
- `from` (optional): Start date
- `to` (optional): End date
- `status` (optional): Filter by delivery status
- `limit` (optional): Number of logs to return

**Response:**
```json
{
  "logs": [
    {
      "delivery_id": "del-123",
      "webhook_id": "webhook-001",
      "event": "diagnostic.completed",
      "timestamp": "2024-04-01T10:35:00Z",
      "attempts": 1,
      "status": "success",
      "response": {
        "status_code": 200,
        "duration_ms": 145
      }
    },
    {
      "delivery_id": "del-124",
      "webhook_id": "webhook-001",
      "event": "alert.triggered",
      "timestamp": "2024-04-01T14:45:00Z",
      "attempts": 3,
      "status": "failed",
      "error": "Connection timeout",
      "last_attempt": "2024-04-01T14:45:35Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2
  }
}
```

## Best Practices

1. **Implement idempotency**: Handle duplicate webhooks gracefully
2. **Verify signatures**: Always validate webhook authenticity
3. **Respond quickly**: Process webhooks asynchronously
4. **Handle retries**: Implement proper error handling
5. **Monitor failures**: Set up alerts for webhook failures
6. **Use HTTPS**: Always use secure endpoints
7. **Implement timeouts**: Don't block on long operations
8. **Log everything**: Keep detailed logs for debugging
9. **Version your endpoints**: Plan for webhook format changes
10. **Test thoroughly**: Use the test endpoint regularly

## Error Handling

Common webhook errors and solutions:

| Error | Description | Solution |
|-------|-------------|----------|
| Invalid signature | Signature verification failed | Check secret key |
| Timeout | Response took > 30 seconds | Process asynchronously |
| SSL error | Certificate validation failed | Update certificates |
| 4xx errors | Client errors | Fix endpoint logic |
| 5xx errors | Server errors | Will be retried |

## Rate Limiting

- Webhook creation: 10 per hour
- Test webhooks: 20 per hour
- Maximum webhooks per account: 50
- Maximum events per webhook: 1000 per minute