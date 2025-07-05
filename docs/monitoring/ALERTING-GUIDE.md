# CM Diagnostics Alerting Guide

This guide covers comprehensive alerting setup, configuration, and best practices for CM Diagnostics monitoring.

## Table of Contents

1. [Alerting Overview](#alerting-overview)
2. [Alert Configuration](#alert-configuration)
3. [Alert Rules](#alert-rules)
4. [Notification Channels](#notification-channels)
5. [Alert Routing](#alert-routing)
6. [Alert Templates](#alert-templates)
7. [Escalation Policies](#escalation-policies)
8. [Alert Suppression](#alert-suppression)
9. [Integration Setup](#integration-setup)
10. [Alert Management](#alert-management)
11. [Runbook Integration](#runbook-integration)
12. [Best Practices](#best-practices)

## Alerting Overview

### Alerting Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Metrics Sources                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Prometheus  │  │    Loki     │  │   Custom    │        │
│  │  Metrics    │  │    Logs     │  │   Events    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Alert Manager                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Rules    │  │   Routing   │  │ Suppression │        │
│  │   Engine    │  │   Engine    │  │   Engine    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Notification Channels                        │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │Email │  │Slack │  │ SMS  │  │PagerDuty│ │Webhook│      │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Alert Severity Levels

| Severity | Response Time | Use Case | Notification |
|----------|--------------|----------|--------------|
| **Critical** | Immediate | System down, data loss risk | Phone, SMS, All channels |
| **High** | 15 minutes | Service degraded, high impact | Email, Slack, PagerDuty |
| **Medium** | 1 hour | Performance issues, medium impact | Email, Slack |
| **Low** | 4 hours | Minor issues, monitoring | Email |
| **Info** | Next day | Informational, trends | Dashboard only |

## Alert Configuration

### Basic Configuration

```yaml
# alertmanager.yml
global:
  # Global settings
  resolve_timeout: 5m
  smtp_from: 'alerts@cm-diagnostics.com'
  smtp_smarthost: 'smtp.company.com:587'
  smtp_auth_username: 'alerts@cm-diagnostics.com'
  smtp_auth_password: '${SMTP_PASSWORD}'
  
  # Global notification templates
  slack_api_url: '${SLACK_WEBHOOK_URL}'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

# Templates for notifications
templates:
  - '/etc/alertmanager/templates/*.tmpl'

# Root route
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'default'
  
  routes:
    # Critical alerts
    - match:
        severity: critical
      receiver: 'critical-team'
      group_wait: 0s
      repeat_interval: 1h
      
    # Database alerts
    - match:
        service: database
      receiver: 'dba-team'
      group_by: ['alertname', 'instance']
      
    # Business hours only
    - match:
        severity: low
      receiver: 'business-hours'
      active_time_intervals:
        - business-hours

# Receivers configuration
receivers:
  - name: 'default'
    email_configs:
      - to: 'ops-team@company.com'
        
  - name: 'critical-team'
    email_configs:
      - to: 'critical@company.com'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
    slack_configs:
      - channel: '#alerts-critical'
        title: 'Critical Alert'
        
  - name: 'dba-team'
    email_configs:
      - to: 'dba-team@company.com'
    slack_configs:
      - channel: '#database-alerts'

# Inhibition rules
inhibit_rules:
  - source_matchers:
      - severity = 'critical'
    target_matchers:
      - severity = 'warning'
    equal: ['alertname', 'instance']

# Time intervals
time_intervals:
  - name: business-hours
    time_intervals:
      - times:
          - start_time: '09:00'
            end_time: '17:00'
        weekdays: ['monday:friday']
```

### Environment-Specific Configuration

```yaml
# config/alerting/production.yml
alerting:
  enabled: true
  
  defaults:
    evaluation_interval: 30s
    notification_timeout: 30s
    
  severity_thresholds:
    critical:
      cpu_usage: 95
      memory_usage: 95
      error_rate: 10
      response_time: 5000
      
    high:
      cpu_usage: 85
      memory_usage: 85
      error_rate: 5
      response_time: 2000
      
    medium:
      cpu_usage: 75
      memory_usage: 75
      error_rate: 2
      response_time: 1000
```

## Alert Rules

### System Alert Rules

```yaml
# alerts/system.yml
groups:
  - name: system_alerts
    interval: 30s
    rules:
      # CPU Alerts
      - alert: HighCPUUsage
        expr: |
          100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 5m
        labels:
          severity: high
          service: infrastructure
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is {{ $value | printf \"%.2f\" }}% on {{ $labels.instance }}"
          runbook_url: "https://runbooks.cm-diagnostics.com/HighCPUUsage"
          dashboard_url: "https://grafana.company.com/d/system/overview?var-instance={{ $labels.instance }}"
          
      # Memory Alerts
      - alert: HighMemoryUsage
        expr: |
          (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: high
          service: infrastructure
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is {{ $value | printf \"%.2f\" }}% on {{ $labels.instance }}"
          suggested_action: "Check for memory leaks or increase instance size"
          
      # Disk Space Alerts
      - alert: DiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 15
        for: 5m
        labels:
          severity: high
          service: infrastructure
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"
          description: "Only {{ $value | printf \"%.2f\" }}% disk space remaining on {{ $labels.instance }}"
          
      # Service Down
      - alert: ServiceDown
        expr: up{job="cm-diagnostics"} == 0
        for: 1m
        labels:
          severity: critical
          service: cm-diagnostics
        annotations:
          summary: "CM Diagnostics service is down on {{ $labels.instance }}"
          description: "The service has been down for more than 1 minute"
          impact: "Users cannot access CM Diagnostics"
          action: "Check service logs and restart if necessary"
```

### Application Alert Rules

```yaml
# alerts/application.yml
groups:
  - name: application_alerts
    interval: 30s
    rules:
      # Response Time Alerts
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95,
            sum(rate(cmdiag_api_request_duration_seconds_bucket[5m])) by (le, method, endpoint)
          ) > 2
        for: 5m
        labels:
          severity: medium
          service: api
        annotations:
          summary: "High API response time"
          description: "95th percentile response time is {{ $value | printf \"%.2f\" }}s for {{ $labels.method }} {{ $labels.endpoint }}"
          
      # Error Rate Alerts
      - alert: HighErrorRate
        expr: |
          (sum(rate(cmdiag_api_requests_total{status=~"5.."}[5m])) by (instance)
          /
          sum(rate(cmdiag_api_requests_total[5m])) by (instance)) * 100 > 5
        for: 5m
        labels:
          severity: high
          service: api
        annotations:
          summary: "High error rate on {{ $labels.instance }}"
          description: "Error rate is {{ $value | printf \"%.2f\" }}%"
          
      # Queue Depth Alert
      - alert: QueueBacklog
        expr: cmdiag_queue_depth > 1000
        for: 10m
        labels:
          severity: medium
          service: processing
        annotations:
          summary: "High queue depth: {{ $labels.queue_name }}"
          description: "Queue depth is {{ $value }}, processing may be delayed"
```

### Database Alert Rules

```yaml
# alerts/database.yml
groups:
  - name: database_alerts
    interval: 30s
    rules:
      # Connection Pool Exhaustion
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          (pg_stat_database_numbackends{datname="cmdiagnostics"} 
          / 
          pg_settings_max_connections) > 0.8
        for: 5m
        labels:
          severity: high
          service: database
        annotations:
          summary: "Database connection pool near exhaustion"
          description: "{{ $value | humanizePercentage }} of connections in use"
          
      # Replication Lag
      - alert: DatabaseReplicationLag
        expr: pg_replication_lag_seconds > 10
        for: 5m
        labels:
          severity: high
          service: database
        annotations:
          summary: "Database replication lag detected"
          description: "Replication lag is {{ $value }}s"
          
      # Slow Queries
      - alert: DatabaseSlowQueries
        expr: |
          rate(pg_stat_statements_mean_time_seconds{datname="cmdiagnostics"}[5m]) > 1
        for: 10m
        labels:
          severity: medium
          service: database
        annotations:
          summary: "Slow database queries detected"
          description: "Average query time is {{ $value | printf \"%.2f\" }}s"
```

### Business Metric Alerts

```yaml
# alerts/business.yml
groups:
  - name: business_alerts
    interval: 1m
    rules:
      # SLA Violation
      - alert: SLAViolation
        expr: |
          (sum(rate(cmdiag_api_requests_total{status=~"2.."}[5m]))
          /
          sum(rate(cmdiag_api_requests_total[5m]))) * 100 < 99.9
        for: 5m
        labels:
          severity: high
          service: sla
          team: management
        annotations:
          summary: "SLA violation detected"
          description: "Success rate is {{ $value | printf \"%.2f\" }}%, below 99.9% SLA"
          business_impact: "Potential SLA penalties"
          
      # Document Processing Delays
      - alert: DocumentProcessingDelay
        expr: |
          histogram_quantile(0.95,
            sum(rate(cmdiag_document_processing_duration_seconds_bucket[5m])) by (le)
          ) > 300
        for: 15m
        labels:
          severity: medium
          service: processing
          team: operations
        annotations:
          summary: "Document processing delays"
          description: "95% of documents taking > 5 minutes to process"
```

## Notification Channels

### Email Configuration

```yaml
# Email notification configuration
email_configs:
  - to: 'team@company.com'
    from: 'alerts@cm-diagnostics.com'
    smarthost: 'smtp.company.com:587'
    auth_username: 'alerts@cm-diagnostics.com'
    auth_password: '${EMAIL_PASSWORD}'
    headers:
      Subject: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
      X-Priority: '{{ if eq .Status "firing" }}1{{ else }}3{{ end }}'
    html: |
      <h2>{{ .GroupLabels.alertname }}</h2>
      <p><strong>Status:</strong> {{ .Status | toUpper }}</p>
      {{ range .Alerts }}
        <h3>{{ .Labels.severity | toUpper }}: {{ .Annotations.summary }}</h3>
        <p>{{ .Annotations.description }}</p>
        <p><strong>Instance:</strong> {{ .Labels.instance }}</p>
        <p><strong>Started:</strong> {{ .StartsAt.Format "2006-01-02 15:04:05" }}</p>
        {{ if .Annotations.runbook_url }}
          <p><a href="{{ .Annotations.runbook_url }}">Runbook</a></p>
        {{ end }}
      {{ end }}
```

### Slack Configuration

```yaml
# Slack notification configuration
slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL}'
    channel: '#alerts'
    title: '{{ .GroupLabels.alertname }}'
    title_link: '{{ if .Annotations.dashboard_url }}{{ .Annotations.dashboard_url }}{{ end }}'
    username: 'CM Diagnostics Alerts'
    icon_emoji: ':warning:'
    color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
    text: |
      *Status:* {{ .Status | toUpper }}
      *Severity:* {{ .CommonLabels.severity | toUpper }}
      {{ range .Alerts }}
        *Summary:* {{ .Annotations.summary }}
        *Description:* {{ .Annotations.description }}
        *Instance:* {{ .Labels.instance }}
        {{ if .Annotations.runbook_url }}*Runbook:* <{{ .Annotations.runbook_url }}|View Runbook>{{ end }}
      {{ end }}
    actions:
      - type: button
        text: 'View Dashboard'
        url: '{{ .Annotations.dashboard_url }}'
      - type: button
        text: 'Acknowledge'
        url: 'https://alerts.company.com/acknowledge/{{ .GroupKey }}'
```

### PagerDuty Configuration

```yaml
# PagerDuty configuration
pagerduty_configs:
  - service_key: '${PAGERDUTY_SERVICE_KEY}'
    client: 'CM Diagnostics'
    client_url: 'https://cm-diagnostics.company.com'
    severity: '{{ .CommonLabels.severity }}'
    class: '{{ .GroupLabels.alertname }}'
    component: '{{ .CommonLabels.service }}'
    group: '{{ .GroupLabels.cluster }}'
    details:
      firing: '{{ .Alerts.Firing | len }}'
      resolved: '{{ .Alerts.Resolved | len }}'
      severity: '{{ .CommonLabels.severity }}'
      description: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
      runbook: '{{ (index .Alerts 0).Annotations.runbook_url }}'
```

### SMS Configuration

```yaml
# SMS configuration (using Twilio)
webhook_configs:
  - url: 'https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json'
    http_config:
      basic_auth:
        username: '${TWILIO_ACCOUNT_SID}'
        password: '${TWILIO_AUTH_TOKEN}'
    send_resolved: false
    max_alerts: 1  # Prevent SMS spam
    body: |
      From=${TWILIO_PHONE_NUMBER}&To=${ONCALL_PHONE}&Body=CRITICAL: {{ .GroupLabels.alertname }} - {{ (index .Alerts 0).Annotations.summary }}
```

### Custom Webhook

```javascript
// webhook-handler.js
app.post('/webhook/alerts', async (req, res) => {
  const alert = req.body;
  
  // Custom alert processing
  if (alert.status === 'firing' && alert.commonLabels.severity === 'critical') {
    // Create incident ticket
    const ticket = await createIncidentTicket({
      title: alert.groupLabels.alertname,
      description: alert.commonAnnotations.description,
      priority: 'P1',
      assignee: getOnCallEngineer(),
      labels: ['alert', alert.commonLabels.service]
    });
    
    // Update alert with ticket info
    await updateAlert(alert.groupKey, {
      ticket_id: ticket.id,
      ticket_url: ticket.url
    });
    
    // Send to war room channel
    await postToWarRoom({
      alert: alert,
      ticket: ticket,
      oncall: getOnCallEngineer()
    });
  }
  
  res.json({ status: 'processed' });
});
```

## Alert Routing

### Routing Rules

```yaml
# Advanced routing configuration
route:
  receiver: 'default'
  group_by: ['cluster', 'alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  
  routes:
    # Critical alerts - immediate notification
    - matchers:
        - severity="critical"
      receiver: 'critical-response'
      group_wait: 0s
      repeat_interval: 15m
      continue: true
      
    # Database alerts to DBA team
    - matchers:
        - service=~"database|postgres"
      receiver: 'dba-team'
      group_by: ['alertname', 'instance', 'datname']
      
    # Security alerts
    - matchers:
        - alertname=~"Security.*|.*Unauthorized.*"
      receiver: 'security-team'
      group_wait: 0s
      
    # Business hours only
    - matchers:
        - severity="low"
      receiver: 'business-hours-team'
      active_time_intervals:
        - business-hours
      
    # Different regions
    - match_re:
        instance: '.*\.us-east-1\..*'
      receiver: 'us-east-team'
      
    - match_re:
        instance: '.*\.eu-central-1\..*'
      receiver: 'eu-team'
      
    # Maintenance mode
    - matchers:
        - maintenance="true"
      receiver: 'null'  # Silence during maintenance
```

### Dynamic Routing

```javascript
// dynamic-routing.js
class AlertRouter {
  constructor() {
    this.rules = this.loadRoutingRules();
    this.schedules = this.loadOnCallSchedules();
  }
  
  async route(alert) {
    const routes = [];
    
    // Check on-call schedule
    const oncall = await this.getOnCallForTeam(alert.labels.team);
    if (oncall) {
      routes.push({
        receiver: oncall.contact,
        method: alert.severity === 'critical' ? 'phone' : 'email'
      });
    }
    
    // Check escalation rules
    if (this.shouldEscalate(alert)) {
      const manager = await this.getTeamManager(alert.labels.team);
      routes.push({
        receiver: manager.contact,
        method: 'email',
        delay: '15m'
      });
    }
    
    // Check for VIP services
    if (this.isVIPService(alert.labels.service)) {
      routes.push({
        receiver: 'executive-alerts@company.com',
        method: 'email'
      });
    }
    
    return routes;
  }
  
  shouldEscalate(alert) {
    return alert.severity === 'critical' && 
           alert.duration > 15 * 60 * 1000; // 15 minutes
  }
}
```

## Alert Templates

### Notification Templates

```go
// templates/default.tmpl
{{ define "__subject" }}
[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .GroupLabels.SortedPairs.Values | join " " }} {{ if gt (len .CommonLabels) (len .GroupLabels) }}({{ with .CommonLabels.Remove .GroupLabels.Names }}{{ .Values | join " " }}{{ end }}){{ end }}
{{ end }}

{{ define "__description" }}
{{ range .Alerts }}
*Alert:* {{ .Annotations.summary }}
*Description:* {{ .Annotations.description }}
*Details:*
  {{ range .Labels.SortedPairs }} • *{{ .Name }}:* `{{ .Value }}`
  {{ end }}
*Source:* {{ .GeneratorURL }}
{{ end }}
{{ end }}

{{ define "slack.default.title" }}
{{ template "__subject" . }}
{{ end }}

{{ define "slack.default.text" }}
{{ template "__description" . }}
{{ end }}

{{ define "email.default.subject" }}
{{ template "__subject" . }}
{{ end }}

{{ define "email.default.html" }}
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .alert { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
    .critical { border-color: #f00; background-color: #fee; }
    .warning { border-color: #fa0; background-color: #ffe; }
    .info { border-color: #00f; background-color: #eef; }
    .label { font-weight: bold; }
    .value { font-family: monospace; }
  </style>
</head>
<body>
  <h2>{{ template "__subject" . }}</h2>
  {{ range .Alerts }}
  <div class="alert {{ .Labels.severity }}">
    <h3>{{ .Annotations.summary }}</h3>
    <p>{{ .Annotations.description }}</p>
    <table>
      {{ range .Labels.SortedPairs }}
      <tr>
        <td class="label">{{ .Name }}:</td>
        <td class="value">{{ .Value }}</td>
      </tr>
      {{ end }}
    </table>
    {{ if .Annotations.runbook_url }}
    <p><a href="{{ .Annotations.runbook_url }}">View Runbook</a></p>
    {{ end }}
  </div>
  {{ end }}
</body>
</html>
{{ end }}
```

### Custom Alert Templates

```yaml
# templates/custom-alerts.yml
templates:
  - name: capacity_alert
    annotations:
      summary: "{{ .Labels.resource }} capacity warning"
      description: |
        {{ .Labels.resource }} usage is at {{ $value | humanizePercentage }}.
        Current: {{ $value }}{{ .Labels.unit }}
        Threshold: {{ .Labels.threshold }}{{ .Labels.unit }}
        Forecast: Will reach capacity in {{ .Labels.days_remaining }} days
      runbook_url: "https://runbooks.company.com/capacity/{{ .Labels.resource }}"
      
  - name: sla_alert
    annotations:
      summary: "SLA breach for {{ .Labels.service }}"
      description: |
        Service: {{ .Labels.service }}
        SLA Target: {{ .Labels.sla_target }}%
        Current: {{ $value | humanizePercentage }}%
        Duration: {{ .Labels.duration }}
        Impact: {{ .Labels.affected_users }} users affected
      business_impact: "{{ .Labels.revenue_impact }}"
      
  - name: security_alert
    annotations:
      summary: "Security event: {{ .Labels.event_type }}"
      description: |
        Type: {{ .Labels.event_type }}
        Source: {{ .Labels.source_ip }}
        Target: {{ .Labels.target }}
        Count: {{ $value }} attempts in {{ .Labels.window }}
        Action: {{ .Labels.action_taken }}
      priority: "P1"
      compliance: "{{ .Labels.compliance_framework }}"
```

## Escalation Policies

### Escalation Configuration

```yaml
# escalation-policies.yml
escalation_policies:
  - name: standard_escalation
    levels:
      - level: 1
        wait: 0m
        targets:
          - type: on_call_engineer
            team: operations
            
      - level: 2
        wait: 15m
        targets:
          - type: on_call_engineer
            team: operations
          - type: team_lead
            team: operations
            
      - level: 3
        wait: 30m
        targets:
          - type: manager
            team: operations
          - type: on_call_engineer
            team: senior_engineers
            
      - level: 4
        wait: 1h
        targets:
          - type: director
            department: engineering
            
  - name: critical_escalation
    levels:
      - level: 1
        wait: 0m
        targets:
          - type: on_call_engineer
            team: operations
          - type: team_lead
            team: operations
            
      - level: 2
        wait: 5m
        targets:
          - type: all
            team: operations
          - type: manager
            team: operations
```

### On-Call Schedule Integration

```javascript
// oncall-integration.js
class OnCallManager {
  async getOnCallPerson(team, level = 'primary') {
    const schedule = await this.getSchedule(team);
    const now = new Date();
    
    // Find current on-call
    const current = schedule.rotations.find(rotation => {
      return rotation.start <= now && rotation.end > now;
    });
    
    if (!current) {
      // Fallback to team default
      return this.getTeamDefault(team);
    }
    
    return {
      primary: current.primary,
      secondary: current.secondary,
      manager: current.manager,
      contact: this.getContactInfo(current[level])
    };
  }
  
  async notifyOnCall(alert, team) {
    const oncall = await this.getOnCallPerson(team);
    
    // Primary notification
    await this.notify(oncall.primary, alert, {
      method: alert.severity === 'critical' ? 'phone' : 'sms'
    });
    
    // Secondary notification for critical
    if (alert.severity === 'critical') {
      await this.notify(oncall.secondary, alert, {
        method: 'sms',
        delay: '5m'
      });
    }
    
    // Track acknowledgment
    const ackTimeout = setTimeout(async () => {
      // Escalate if not acknowledged
      await this.escalate(alert, team, oncall);
    }, 15 * 60 * 1000); // 15 minutes
    
    return { oncall, ackTimeout };
  }
}
```

## Alert Suppression

### Suppression Rules

```yaml
# suppression-rules.yml
inhibit_rules:
  # Suppress lower severity when higher exists
  - source_matchers:
      - severity="critical"
    target_matchers:
      - severity=~"warning|info"
    equal: ['alertname', 'instance']
    
  # Suppress component alerts when service is down
  - source_matchers:
      - alertname="ServiceDown"
    target_matchers:
      - alertname=~"HighCPU|HighMemory|HighDisk"
    equal: ['instance']
    
  # Suppress during maintenance
  - source_matchers:
      - alertname="MaintenanceMode"
    target_matchers:
      - severity=~"info|warning"
    equal: ['cluster']
    
  # Suppress downstream when upstream fails
  - source_matchers:
      - alertname="DatabaseDown"
    target_matchers:
      - service="api"
    equal: ['environment']
```

### Silence Management

```javascript
// silence-manager.js
class SilenceManager {
  async createSilence(params) {
    const silence = {
      id: generateId(),
      matchers: params.matchers,
      startsAt: params.startsAt || new Date(),
      endsAt: params.endsAt,
      createdBy: params.user,
      comment: params.reason
    };
    
    // Validate silence
    if (!this.isValid(silence)) {
      throw new Error('Invalid silence configuration');
    }
    
    // Check for overlapping silences
    const overlapping = await this.findOverlapping(silence);
    if (overlapping.length > 0) {
      console.warn('Overlapping silences detected:', overlapping);
    }
    
    // Store silence
    await this.store.save(silence);
    
    // Audit log
    await this.audit.log({
      action: 'silence.create',
      user: params.user,
      silence: silence,
      reason: params.reason
    });
    
    return silence;
  }
  
  async scheduleMaintenance(window) {
    // Create silence for maintenance window
    return this.createSilence({
      matchers: [
        { name: 'environment', value: window.environment },
        { name: 'severity', value: 'info|warning', regex: true }
      ],
      startsAt: window.start,
      endsAt: window.end,
      user: window.requestedBy,
      reason: `Scheduled maintenance: ${window.description}`
    });
  }
}
```

## Integration Setup

### ServiceNow Integration

```javascript
// servicenow-integration.js
class ServiceNowIntegration {
  async createIncident(alert) {
    const incident = {
      short_description: alert.annotations.summary,
      description: this.formatDescription(alert),
      urgency: this.mapUrgency(alert.labels.severity),
      impact: this.mapImpact(alert.labels.service),
      category: 'Software',
      subcategory: 'Application',
      assignment_group: this.getAssignmentGroup(alert.labels.team),
      caller_id: 'cm-diagnostics-alerts',
      u_monitoring_id: alert.fingerprint
    };
    
    const response = await this.client.post('/incident', incident);
    
    // Update alert with incident info
    await this.updateAlert(alert.fingerprint, {
      incident_number: response.data.number,
      incident_url: `${this.baseUrl}/incident.do?sys_id=${response.data.sys_id}`
    });
    
    return response.data;
  }
  
  mapUrgency(severity) {
    const mapping = {
      critical: 1,  // High
      high: 2,      // Medium
      medium: 3,    // Low
      low: 3,       // Low
      info: 3       // Low
    };
    return mapping[severity] || 3;
  }
}
```

### JIRA Integration

```javascript
// jira-integration.js
class JiraIntegration {
  async createIssue(alert) {
    const issue = {
      fields: {
        project: { key: 'CMDIAG' },
        summary: alert.annotations.summary,
        description: this.formatDescription(alert),
        issuetype: { name: 'Incident' },
        priority: { name: this.mapPriority(alert.labels.severity) },
        labels: ['alert', alert.labels.service, alert.labels.severity],
        customfield_10001: alert.fingerprint, // Alert ID
        components: [{ name: alert.labels.service }]
      }
    };
    
    // Add epic link for major incidents
    if (alert.labels.severity === 'critical') {
      issue.fields.customfield_10008 = 'CMDIAG-100'; // Major Incidents Epic
    }
    
    const response = await this.client.post('/rest/api/2/issue', issue);
    
    // Add watchers
    const watchers = await this.getWatchers(alert.labels.team);
    for (const watcher of watchers) {
      await this.client.post(`/rest/api/2/issue/${response.data.key}/watchers`, {
        accountId: watcher
      });
    }
    
    return response.data;
  }
}
```

## Alert Management

### Alert Lifecycle

```javascript
// alert-lifecycle.js
class AlertLifecycle {
  constructor() {
    this.states = {
      PENDING: 'pending',
      FIRING: 'firing',
      ACKNOWLEDGED: 'acknowledged',
      RESOLVED: 'resolved',
      CLOSED: 'closed'
    };
  }
  
  async processAlert(alert) {
    const lifecycle = {
      alertId: alert.fingerprint,
      created: new Date(),
      state: this.states.PENDING,
      history: []
    };
    
    // State machine
    const transitions = {
      [this.states.PENDING]: async () => {
        // Validate alert
        if (await this.validate(alert)) {
          lifecycle.state = this.states.FIRING;
          await this.notify(alert);
        }
      },
      
      [this.states.FIRING]: async () => {
        // Check for acknowledgment
        if (await this.isAcknowledged(alert)) {
          lifecycle.state = this.states.ACKNOWLEDGED;
          await this.stopEscalation(alert);
        }
        // Check for auto-resolution
        else if (await this.isResolved(alert)) {
          lifecycle.state = this.states.RESOLVED;
        }
      },
      
      [this.states.ACKNOWLEDGED]: async () => {
        // Check for resolution
        if (await this.isResolved(alert)) {
          lifecycle.state = this.states.RESOLVED;
          await this.notifyResolution(alert);
        }
      },
      
      [this.states.RESOLVED]: async () => {
        // Auto-close after period
        if (this.shouldClose(lifecycle)) {
          lifecycle.state = this.states.CLOSED;
          await this.archive(alert);
        }
      }
    };
    
    // Execute transition
    const transition = transitions[lifecycle.state];
    if (transition) {
      await transition();
      lifecycle.history.push({
        from: lifecycle.state,
        to: lifecycle.state,
        timestamp: new Date(),
        actor: 'system'
      });
    }
    
    return lifecycle;
  }
}
```

### Alert Analytics

```javascript
// alert-analytics.js
class AlertAnalytics {
  async generateReport(timeframe) {
    const report = {
      timeframe: timeframe,
      summary: await this.getSummary(timeframe),
      trends: await this.getTrends(timeframe),
      mttr: await this.calculateMTTR(timeframe),
      noise: await this.analyzeNoise(timeframe),
      recommendations: []
    };
    
    // Alert volume analysis
    report.volume = {
      total: report.summary.total,
      byHour: await this.getHourlyDistribution(timeframe),
      bySeverity: await this.getBySeverity(timeframe),
      byService: await this.getByService(timeframe)
    };
    
    // Response metrics
    report.response = {
      acknowledgmentTime: await this.getAckTime(timeframe),
      resolutionTime: await this.getResolutionTime(timeframe),
      escalationRate: await this.getEscalationRate(timeframe)
    };
    
    // Generate recommendations
    if (report.noise.percentage > 20) {
      report.recommendations.push({
        type: 'reduce_noise',
        description: 'High percentage of non-actionable alerts',
        suggested_actions: [
          'Review alert thresholds',
          'Implement better grouping',
          'Add suppression rules'
        ]
      });
    }
    
    return report;
  }
  
  async analyzeNoise(timeframe) {
    const allAlerts = await this.getAlerts(timeframe);
    const actionableAlerts = allAlerts.filter(a => 
      a.acknowledged || a.hadAction || a.createdTicket
    );
    
    return {
      total: allAlerts.length,
      actionable: actionableAlerts.length,
      percentage: ((allAlerts.length - actionableAlerts.length) / allAlerts.length) * 100,
      topNoisy: await this.getTopNoisyAlerts(timeframe)
    };
  }
}
```

## Runbook Integration

### Runbook Automation

```yaml
# runbooks/high-cpu.yml
name: HighCPUUsage
description: Runbook for handling high CPU usage alerts
metadata:
  severity: high
  service: infrastructure
  estimated_time: 15m

steps:
  - name: gather_information
    description: Collect system information
    commands:
      - run: "top -b -n 1 | head -20"
        store: top_output
      - run: "ps aux | sort -k3 -r | head -10"
        store: top_processes
      - run: "vmstat 1 5"
        store: vmstat_output
        
  - name: identify_cause
    description: Identify high CPU consumers
    script: |
      # Analyze top processes
      for proc in $(ps aux | awk '$3 > 50 {print $2}'); do
        echo "High CPU process: $(ps -p $proc -o comm=) PID: $proc"
      done
      
  - name: remediation
    description: Take corrective action
    manual_approval: true
    actions:
      - if: "process == 'node'"
        then:
          - restart_service: cm-diagnostics
      - if: "cpu_usage > 95"
        then:
          - scale_horizontally: true
          - notify: ops-team
          
  - name: verify
    description: Verify CPU usage is normal
    wait: 2m
    check:
      - metric: node_cpu_usage
        condition: "< 80"
        duration: 5m
```

### Runbook Executor

```javascript
// runbook-executor.js
class RunbookExecutor {
  async execute(runbookName, context) {
    const runbook = await this.loadRunbook(runbookName);
    const execution = {
      id: generateId(),
      runbook: runbookName,
      startTime: new Date(),
      context: context,
      steps: [],
      status: 'running'
    };
    
    try {
      for (const step of runbook.steps) {
        const stepResult = await this.executeStep(step, execution);
        execution.steps.push(stepResult);
        
        if (stepResult.status === 'failed' && !step.continueOnError) {
          execution.status = 'failed';
          break;
        }
        
        if (step.manual_approval) {
          await this.waitForApproval(execution, step);
        }
      }
      
      execution.status = execution.status === 'running' ? 'completed' : execution.status;
    } catch (error) {
      execution.status = 'error';
      execution.error = error.message;
    }
    
    execution.endTime = new Date();
    await this.saveExecution(execution);
    
    return execution;
  }
  
  async executeStep(step, execution) {
    const result = {
      name: step.name,
      startTime: new Date(),
      outputs: {}
    };
    
    try {
      if (step.commands) {
        for (const command of step.commands) {
          const output = await this.runCommand(command.run);
          if (command.store) {
            result.outputs[command.store] = output;
          }
        }
      }
      
      if (step.script) {
        const scriptResult = await this.runScript(step.script, execution);
        result.outputs.script_output = scriptResult;
      }
      
      if (step.actions) {
        for (const action of step.actions) {
          if (await this.evaluateCondition(action.if, execution)) {
            await this.executeActions(action.then, execution);
          }
        }
      }
      
      result.status = 'completed';
    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
    }
    
    result.endTime = new Date();
    return result;
  }
}
```

## Best Practices

### Alert Design Best Practices

1. **Actionable Alerts**
   ```yaml
   # Good alert
   - alert: DatabaseConnectionPoolExhausted
     expr: db_connections_active / db_connections_max > 0.9
     annotations:
       summary: "Database connection pool nearly exhausted"
       description: "{{ $value | humanizePercentage }} of connections in use"
       action: "Increase connection pool size or investigate connection leaks"
       runbook_url: "https://runbooks.company.com/db-connections"
   
   # Bad alert
   - alert: HighConnections
     expr: db_connections_active > 50
     annotations:
       summary: "Many connections"  # Not actionable, no context
   ```

2. **Symptom-Based Alerting**
   ```yaml
   # Alert on symptoms (user-facing issues)
   - alert: APIHighErrorRate
     expr: |
       (sum(rate(http_requests_total{status=~"5.."}[5m]))
       /
       sum(rate(http_requests_total[5m]))) > 0.05
   
   # Not on causes (infrastructure metrics)
   # This should be a dashboard metric, not an alert
   - alert: CPUHighIOWait  # Bad - alert on the impact instead
     expr: rate(node_cpu_seconds_total{mode="iowait"}[5m]) > 0.5
   ```

3. **Alert Fatigue Prevention**
   ```yaml
   prevention_strategies:
     - group_related_alerts: true
     - use_appropriate_thresholds: true
     - implement_alert_suppression: true
     - regular_alert_review: weekly
     - track_alert_actionability: true
   ```

### Notification Best Practices

1. **Channel Selection**
   ```yaml
   notification_matrix:
     critical:
       primary: pagerduty
       secondary: [slack, email]
       escalation: phone
     high:
       primary: slack
       secondary: email
     medium:
       primary: email
       secondary: ticket
     low:
       primary: ticket
   ```

2. **Message Quality**
   ```yaml
   message_requirements:
     - include_severity: true
     - include_impact: true
     - include_runbook_link: true
     - include_dashboard_link: true
     - avoid_technical_jargon: true
     - specify_required_action: true
   ```

### Maintenance Best Practices

```javascript
// alert-maintenance.js
class AlertMaintenance {
  async performWeeklyReview() {
    const report = {
      date: new Date(),
      metrics: await this.getWeeklyMetrics(),
      recommendations: []
    };
    
    // Check for noisy alerts
    const noisyAlerts = await this.getNoisyAlerts();
    for (const alert of noisyAlerts) {
      report.recommendations.push({
        alert: alert.name,
        issue: 'noisy',
        suggestion: 'Increase threshold or add suppression',
        current_threshold: alert.threshold,
        suggested_threshold: alert.threshold * 1.5
      });
    }
    
    // Check for alerts that never fire
    const deadAlerts = await this.getDeadAlerts();
    for (const alert of deadAlerts) {
      report.recommendations.push({
        alert: alert.name,
        issue: 'never_fires',
        suggestion: 'Review threshold or remove alert',
        last_fired: alert.lastFired
      });
    }
    
    return report;
  }
}
```

---

For more alerting resources and runbook templates, visit: https://alerts.cm-diagnostics.com