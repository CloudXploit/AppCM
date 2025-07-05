# CM Diagnostics Troubleshooting Guide

This comprehensive guide helps diagnose and resolve common issues with CM Diagnostics. Use this guide to quickly identify problems and apply solutions.

## Table of Contents

1. [Quick Troubleshooting Checklist](#quick-troubleshooting-checklist)
2. [Connection Issues](#connection-issues)
3. [Performance Problems](#performance-problems)
4. [Authentication & Authorization](#authentication--authorization)
5. [Data & Database Issues](#data--database-issues)
6. [Integration Problems](#integration-problems)
7. [UI & Display Issues](#ui--display-issues)
8. [API & Service Issues](#api--service-issues)
9. [Deployment Issues](#deployment-issues)
10. [Monitoring & Alerting](#monitoring--alerting)
11. [Diagnostic Tools](#diagnostic-tools)
12. [Log Analysis](#log-analysis)
13. [Common Error Codes](#common-error-codes)
14. [Recovery Procedures](#recovery-procedures)
15. [Getting Support](#getting-support)

## Quick Troubleshooting Checklist

Before diving into specific issues, run through this checklist:

```bash
# 1. Check system status
curl -f http://localhost:3000/health

# 2. Verify all services are running
docker-compose ps  # For Docker
kubectl get pods   # For Kubernetes
systemctl status cm-diagnostics  # For traditional

# 3. Check recent logs
tail -n 100 /var/log/cm-diagnostics/error.log

# 4. Test database connection
psql -h localhost -U cmdiag -d cmdiagnostics -c "SELECT 1"

# 5. Verify network connectivity
ping cm-server.company.com
telnet cm-server.company.com 443

# 6. Check disk space
df -h

# 7. Review system resources
free -m
top -b -n 1
```

## Connection Issues

### Cannot Connect to CM Diagnostics

**Symptoms:**
- Browser shows "Cannot reach this site"
- Connection timeout errors
- ERR_CONNECTION_REFUSED

**Solutions:**

1. **Check if service is running:**
```bash
# Docker
docker ps | grep cm-diagnostics

# Systemd
systemctl status cm-diagnostics

# Check port
netstat -tulpn | grep 3000
```

2. **Verify firewall rules:**
```bash
# Ubuntu/Debian
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# RHEL/CentOS
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=80/tcp --permanent
sudo firewall-cmd --add-port=443/tcp --permanent
sudo firewall-cmd --reload
```

3. **Check Nginx/proxy configuration:**
```bash
# Test Nginx config
sudo nginx -t

# Check proxy upstream
curl -I http://localhost:3000

# Review Nginx logs
tail -f /var/log/nginx/error.log
```

### Cannot Connect to Content Manager

**Symptoms:**
- "Failed to connect to Content Manager" error
- API timeout errors
- Authentication failures

**Solutions:**

1. **Verify CM server accessibility:**
```bash
# Test connectivity
ping cm-server.company.com
telnet cm-server.company.com 443

# Test API endpoint
curl -k https://cm-server.company.com/api/v2/health
```

2. **Check credentials:**
```yaml
# Review configuration
cat /opt/cm-diagnostics/config/cm-connection.yml

# Test authentication
curl -X POST https://cm-server.company.com/api/v2/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"service_account","password":"password"}'
```

3. **SSL certificate issues:**
```bash
# Check certificate
openssl s_client -connect cm-server.company.com:443 -servername cm-server.company.com

# For self-signed certificates, add to config:
content_manager:
  connection:
    verify_ssl: false  # Development only!
```

### Database Connection Failed

**Symptoms:**
- "ECONNREFUSED" errors
- "Connection pool timeout"
- Application won't start

**Solutions:**

1. **Check PostgreSQL service:**
```bash
# Service status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U cmdiag -d cmdiagnostics

# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-14-main.log
```

2. **Verify connection settings:**
```bash
# Check environment variables
echo $DATABASE_URL

# Test with connection string
psql "postgresql://cmdiag:password@localhost:5432/cmdiagnostics"
```

3. **Fix common PostgreSQL issues:**
```bash
# Check pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Ensure: local all all md5

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check max connections
sudo -u postgres psql -c "SHOW max_connections;"
```

## Performance Problems

### Slow Application Response

**Symptoms:**
- Page load times > 5 seconds
- API calls timing out
- High CPU/memory usage

**Solutions:**

1. **Identify bottlenecks:**
```bash
# Check system resources
htop
iostat -x 1
vmstat 1

# Monitor application metrics
curl http://localhost:3000/metrics
```

2. **Database optimization:**
```sql
-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Add missing indexes
EXPLAIN ANALYZE SELECT * FROM your_slow_query;

-- Vacuum and analyze
VACUUM ANALYZE;
```

3. **Application tuning:**
```javascript
// Increase worker processes
// config/performance.js
module.exports = {
  workers: require('os').cpus().length,
  maxMemory: '2GB',
  connectionPool: {
    min: 5,
    max: 20
  }
};
```

4. **Enable caching:**
```yaml
# config/cache.yml
redis:
  enabled: true
  ttl:
    api_responses: 300
    static_content: 3600
    session_data: 1800
```

### Memory Leaks

**Symptoms:**
- Gradual memory increase
- Application crashes with "out of memory"
- Performance degradation over time

**Solutions:**

1. **Monitor memory usage:**
```bash
# Track Node.js memory
node --inspect app.js
# Open chrome://inspect

# Use memory profiling
npm install heapdump
kill -USR2 <pid>  # Generate heap dump
```

2. **Fix common causes:**
```javascript
// Clear intervals and timeouts
const intervals = [];
intervals.push(setInterval(() => {}, 1000));

// Cleanup on exit
process.on('exit', () => {
  intervals.forEach(clearInterval);
});

// Limit array sizes
const cache = [];
const MAX_CACHE_SIZE = 1000;
if (cache.length > MAX_CACHE_SIZE) {
  cache.shift(); // Remove oldest
}
```

## Authentication & Authorization

### Login Failed

**Symptoms:**
- "Invalid credentials" error
- Account locked messages
- Two-factor authentication issues

**Solutions:**

1. **Reset user password:**
```bash
# Via CLI
cd /opt/cm-diagnostics
npm run reset-password -- --user admin@company.com

# Via database
psql -U cmdiag -d cmdiagnostics
UPDATE users SET password_hash = crypt('newpassword', gen_salt('bf')) 
WHERE email = 'admin@company.com';
```

2. **Unlock account:**
```sql
-- Check account status
SELECT email, locked, failed_attempts, locked_until 
FROM users WHERE email = 'user@company.com';

-- Unlock account
UPDATE users SET 
  locked = false, 
  failed_attempts = 0, 
  locked_until = NULL 
WHERE email = 'user@company.com';
```

3. **Fix 2FA issues:**
```bash
# Disable 2FA temporarily
UPDATE users SET two_factor_enabled = false 
WHERE email = 'user@company.com';

# Generate new 2FA secret
npm run generate-2fa -- --user user@company.com
```

### Permission Denied

**Symptoms:**
- "Unauthorized" errors
- Features not accessible
- API returns 403 Forbidden

**Solutions:**

1. **Check user roles:**
```sql
-- View user permissions
SELECT u.email, r.name as role, p.name as permission
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE u.email = 'user@company.com';
```

2. **Grant permissions:**
```sql
-- Add role to user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'user@company.com' AND r.name = 'analyst';
```

### Session Timeout Issues

**Symptoms:**
- Frequent logouts
- "Session expired" messages
- Lost work due to timeouts

**Solutions:**

1. **Adjust session settings:**
```yaml
# config/session.yml
session:
  timeout: 3600000  # 1 hour in milliseconds
  sliding: true     # Reset on activity
  remember_me: 
    enabled: true
    duration: 604800000  # 7 days
```

2. **Implement session persistence:**
```javascript
// Use Redis for sessions
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: false,
  rolling: true
}));
```

## Data & Database Issues

### Data Not Displaying

**Symptoms:**
- Empty dashboards
- Missing metrics
- "No data available" messages

**Solutions:**

1. **Check data collection:**
```bash
# Verify collectors are running
ps aux | grep collector

# Check collection logs
tail -f /var/log/cm-diagnostics/collector.log

# Test data ingestion
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{"metric":"test","value":1}'
```

2. **Verify database queries:**
```sql
-- Check if data exists
SELECT COUNT(*) FROM metrics WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check for connection pool issues
SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';
```

### Database Migration Failed

**Symptoms:**
- Application won't start
- "Migration pending" errors
- Schema version mismatch

**Solutions:**

1. **Run migrations manually:**
```bash
# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate:up

# Rollback if needed
npm run migrate:down
```

2. **Fix migration locks:**
```sql
-- Check for locks
SELECT * FROM schema_migrations WHERE locked = true;

-- Release lock
UPDATE schema_migrations SET locked = false WHERE version = '20240115120000';
```

### Backup/Restore Issues

**Symptoms:**
- Backup jobs failing
- Cannot restore from backup
- Corrupted backup files

**Solutions:**

1. **Manual backup:**
```bash
# Create backup
pg_dump -h localhost -U cmdiag -d cmdiagnostics -F c -f backup_$(date +%Y%m%d).dump

# Verify backup
pg_restore -l backup_20240115.dump
```

2. **Restore procedures:**
```bash
# Drop and recreate database
dropdb cmdiagnostics
createdb cmdiagnostics

# Restore
pg_restore -h localhost -U cmdiag -d cmdiagnostics backup_20240115.dump
```

## Integration Problems

### IDOL Integration Failed

**Symptoms:**
- Search not working
- "IDOL server unreachable"
- Index out of sync

**Solutions:**

1. **Check IDOL connectivity:**
```bash
# Test IDOL ACI port
telnet idol-server.company.com 9000

# Query IDOL status
curl "http://idol-server.company.com:9002/action=GetStatus"
```

2. **Fix indexing issues:**
```bash
# Check connector status
curl "http://localhost:10000/action=GetStatus"

# Force re-index
curl "http://localhost:10000/action=Synchronize&datasource=ContentManager"
```

### Enterprise Studio Integration Issues

**Symptoms:**
- Workflows not triggering
- Missing process data
- Message queue errors

**Solutions:**

1. **Check message bus:**
```bash
# RabbitMQ status
sudo rabbitmqctl status

# List queues
sudo rabbitmqctl list_queues

# Check connections
sudo rabbitmqctl list_connections
```

2. **Reset integration:**
```bash
# Clear stuck messages
sudo rabbitmqctl purge_queue es_integration_queue

# Restart connector
systemctl restart cm-es-connector
```

## UI & Display Issues

### Dashboard Not Loading

**Symptoms:**
- Blank screen
- Spinner never stops
- Console errors

**Solutions:**

1. **Check browser console:**
```javascript
// Common fixes for console errors
// Clear browser cache
// Hard refresh: Ctrl+Shift+R

// Check for blocked resources
// Disable ad blockers
// Check Content Security Policy
```

2. **Verify static assets:**
```bash
# Check if assets are served
curl -I http://localhost:3000/static/js/app.js

# Rebuild assets
npm run build

# Clear CDN cache if using
```

### Charts/Graphs Not Rendering

**Symptoms:**
- Empty chart areas
- "No data to display"
- Rendering errors

**Solutions:**

1. **Check data format:**
```javascript
// Verify API response
fetch('/api/metrics/chart-data')
  .then(res => res.json())
  .then(data => console.log(data));

// Expected format:
{
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{
    label: 'Metrics',
    data: [10, 20, 30]
  }]
}
```

2. **Update chart libraries:**
```bash
npm update chart.js d3 plotly.js
npm run build
```

## API & Service Issues

### API Rate Limiting

**Symptoms:**
- 429 Too Many Requests
- "Rate limit exceeded"
- Throttled responses

**Solutions:**

1. **Check rate limit settings:**
```yaml
# config/rate-limit.yml
rate_limit:
  window: 15m
  max_requests: 1000
  skip_successful_requests: false
  
  # Per-endpoint limits
  endpoints:
    /api/diagnostics: 100
    /api/reports: 10
```

2. **Implement client-side handling:**
```javascript
// Retry with exponential backoff
async function apiCall(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
}
```

### WebSocket Connection Issues

**Symptoms:**
- Real-time updates not working
- "WebSocket connection failed"
- Frequent disconnections

**Solutions:**

1. **Check WebSocket configuration:**
```nginx
# nginx.conf
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

2. **Debug WebSocket:**
```javascript
// Client-side debugging
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => console.log('Connected');
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = (event) => console.log('Disconnected:', event.code, event.reason);
```

## Deployment Issues

### Docker Container Won't Start

**Symptoms:**
- Container exits immediately
- "Container exited with code 1"
- Port binding errors

**Solutions:**

1. **Check container logs:**
```bash
# View logs
docker logs cm-diagnostics-app

# Debug mode
docker run -it --entrypoint /bin/bash cmdiagnostics/app:latest

# Check port conflicts
docker ps --format "table {{.Names}}\t{{.Ports}}"
netstat -tulpn | grep 3000
```

2. **Fix common Docker issues:**
```bash
# Remove old containers
docker rm -f cm-diagnostics-app

# Clean up volumes
docker volume prune

# Rebuild image
docker-compose build --no-cache
```

### Kubernetes Pod Crashes

**Symptoms:**
- CrashLoopBackOff status
- Pod restarts frequently
- Readiness probe failed

**Solutions:**

1. **Debug pod issues:**
```bash
# Get pod details
kubectl describe pod cm-diagnostics-xxxxx

# Check logs
kubectl logs cm-diagnostics-xxxxx --previous

# Execute commands in pod
kubectl exec -it cm-diagnostics-xxxxx -- /bin/bash
```

2. **Fix probe configurations:**
```yaml
# Adjust probe settings
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30  # Increase if slow startup
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

## Monitoring & Alerting

### Alerts Not Triggering

**Symptoms:**
- Known issues not generating alerts
- Email notifications not sent
- Slack integration not working

**Solutions:**

1. **Check alert configuration:**
```yaml
# config/alerts.yml
alerts:
  - name: high_cpu
    condition: cpu_usage > 80
    duration: 5m
    channels: [email, slack]
    enabled: true  # Ensure enabled
```

2. **Test notification channels:**
```bash
# Test email
npm run test-alert -- --channel email --to admin@company.com

# Test Slack
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-type: application/json' \
  -d '{"text":"Test alert from CM Diagnostics"}'
```

### Metrics Not Collecting

**Symptoms:**
- Gaps in metric data
- Prometheus targets down
- Missing custom metrics

**Solutions:**

1. **Check collectors:**
```bash
# Verify metrics endpoint
curl http://localhost:3000/metrics

# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets
```

2. **Fix metric collection:**
```javascript
// Ensure metrics are registered
const prometheus = require('prom-client');
const register = new prometheus.Registry();

// Custom metric
const httpDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Export metrics
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

## Diagnostic Tools

### Built-in Diagnostic Commands

```bash
# Run system diagnostic
cd /opt/cm-diagnostics
npm run diagnose

# Check specific component
npm run diagnose -- --component database
npm run diagnose -- --component redis
npm run diagnose -- --component content-manager

# Generate diagnostic report
npm run diagnose -- --report > diagnostic-report.txt
```

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "=== CM Diagnostics Health Check ==="
echo "Date: $(date)"
echo

# Application health
echo "1. Application Status:"
curl -s http://localhost:3000/health | jq '.'

# Database health
echo -e "\n2. Database Status:"
psql -h localhost -U cmdiag -d cmdiagnostics -c "SELECT version();" 2>&1

# Redis health
echo -e "\n3. Redis Status:"
redis-cli ping

# Disk usage
echo -e "\n4. Disk Usage:"
df -h | grep -E '^/dev|Filesystem'

# Memory usage
echo -e "\n5. Memory Usage:"
free -h

# Service status
echo -e "\n6. Service Status:"
systemctl is-active cm-diagnostics nginx postgresql redis

# Recent errors
echo -e "\n7. Recent Errors (last 10):"
tail -n 10 /var/log/cm-diagnostics/error.log | grep -i error

echo -e "\n=== Health Check Complete ==="
```

### Performance Analysis Tool

```python
#!/usr/bin/env python3
# analyze-performance.py

import psycopg2
import json
from datetime import datetime, timedelta

def analyze_slow_queries(conn):
    """Analyze slow database queries"""
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            query,
            calls,
            total_time,
            mean_time,
            max_time
        FROM pg_stat_statements
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT 20
    """)
    
    print("\n=== Slow Queries ===")
    for row in cur.fetchall():
        print(f"Query: {row[0][:50]}...")
        print(f"  Calls: {row[1]}, Avg: {row[3]:.2f}ms, Max: {row[4]:.2f}ms")
    
def analyze_api_performance(conn):
    """Analyze API endpoint performance"""
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            endpoint,
            method,
            AVG(response_time) as avg_time,
            MAX(response_time) as max_time,
            COUNT(*) as requests
        FROM api_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
        GROUP BY endpoint, method
        ORDER BY avg_time DESC
        LIMIT 20
    """)
    
    print("\n=== API Performance ===")
    for row in cur.fetchall():
        print(f"{row[1]} {row[0]}")
        print(f"  Avg: {row[2]:.2f}ms, Max: {row[3]:.2f}ms, Requests: {row[4]}")

if __name__ == "__main__":
    conn = psycopg2.connect(
        host="localhost",
        database="cmdiagnostics",
        user="cmdiag",
        password="password"
    )
    
    analyze_slow_queries(conn)
    analyze_api_performance(conn)
    conn.close()
```

## Log Analysis

### Log Locations

```bash
# Application logs
/var/log/cm-diagnostics/app.log      # General application log
/var/log/cm-diagnostics/error.log    # Error log
/var/log/cm-diagnostics/access.log   # HTTP access log
/var/log/cm-diagnostics/audit.log    # Security audit log

# System logs
/var/log/nginx/error.log              # Nginx errors
/var/log/postgresql/postgresql.log   # Database logs
/var/log/redis/redis-server.log      # Redis logs

# Docker logs
docker logs cm-diagnostics-app
docker logs cm-diagnostics-db

# Kubernetes logs
kubectl logs -n cm-diagnostics deployment/cm-diagnostics
```

### Log Analysis Commands

```bash
# Find errors in last hour
find /var/log/cm-diagnostics -name "*.log" -mtime -1 | xargs grep -i error

# Count errors by type
grep ERROR /var/log/cm-diagnostics/error.log | awk '{print $5}' | sort | uniq -c | sort -rn

# Monitor logs in real-time
tail -f /var/log/cm-diagnostics/*.log | grep --line-buffered -E 'ERROR|WARN'

# Extract stack traces
awk '/ERROR.*Stack trace:/{flag=1} flag{print} /^[[:space:]]*$/{flag=0}' error.log

# Analyze response times
awk '{print $10}' access.log | sort -n | awk '{a[NR]=$1} END{print "Median:", a[int(NR/2)]}'
```

### Log Parsing Script

```python
#!/usr/bin/env python3
# parse-logs.py

import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

def parse_error_log(filename):
    """Parse error log and generate summary"""
    errors = defaultdict(list)
    error_pattern = re.compile(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*ERROR.*?(\w+Error|Exception): (.+)')
    
    with open(filename, 'r') as f:
        for line in f:
            match = error_pattern.search(line)
            if match:
                timestamp, error_type, message = match.groups()
                errors[error_type].append({
                    'timestamp': timestamp,
                    'message': message[:100]
                })
    
    print("=== Error Summary ===")
    for error_type, occurrences in errors.items():
        print(f"\n{error_type}: {len(occurrences)} occurrences")
        # Show last 3 occurrences
        for err in occurrences[-3:]:
            print(f"  {err['timestamp']}: {err['message']}")

def analyze_performance_log(filename):
    """Analyze performance metrics from logs"""
    response_times = []
    endpoint_times = defaultdict(list)
    
    # Pattern: [2024-01-15 10:30:45] GET /api/users 200 125ms
    pattern = re.compile(r'\[.*?\] (\w+) (.*?) \d+ (\d+)ms')
    
    with open(filename, 'r') as f:
        for line in f:
            match = pattern.search(line)
            if match:
                method, endpoint, duration = match.groups()
                duration = int(duration)
                response_times.append(duration)
                endpoint_times[f"{method} {endpoint}"].append(duration)
    
    if response_times:
        print("\n=== Performance Analysis ===")
        print(f"Total requests: {len(response_times)}")
        print(f"Average response time: {sum(response_times)/len(response_times):.2f}ms")
        print(f"Max response time: {max(response_times)}ms")
        
        print("\nSlowest endpoints:")
        endpoint_avg = {ep: sum(times)/len(times) 
                       for ep, times in endpoint_times.items()}
        for endpoint, avg_time in sorted(endpoint_avg.items(), 
                                       key=lambda x: x[1], 
                                       reverse=True)[:5]:
            print(f"  {endpoint}: {avg_time:.2f}ms")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse-logs.py <logfile>")
        sys.exit(1)
    
    logfile = sys.argv[1]
    
    if 'error' in logfile:
        parse_error_log(logfile)
    elif 'access' in logfile or 'performance' in logfile:
        analyze_performance_log(logfile)
    else:
        print("Unknown log type")
```

## Common Error Codes

### Application Error Codes

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| E001 | CONNECTION_REFUSED | Cannot connect to service | Check if service is running and ports are open |
| E002 | AUTH_FAILED | Authentication failed | Verify credentials and permissions |
| E003 | TIMEOUT | Operation timed out | Increase timeout or check network |
| E004 | RATE_LIMITED | Too many requests | Implement backoff or increase limits |
| E005 | INVALID_CONFIG | Configuration error | Check configuration syntax and values |
| E006 | DATABASE_ERROR | Database operation failed | Check database connectivity and queries |
| E007 | PERMISSION_DENIED | Insufficient permissions | Grant required permissions |
| E008 | NOT_FOUND | Resource not found | Verify resource exists and path is correct |
| E009 | VALIDATION_ERROR | Input validation failed | Check input format and requirements |
| E010 | SERVICE_UNAVAILABLE | Dependency unavailable | Check dependent services |

### HTTP Status Codes

| Code | Status | Common Cause | Solution |
|------|--------|--------------|----------|
| 400 | Bad Request | Invalid input | Validate request format |
| 401 | Unauthorized | Missing/invalid auth | Check authentication |
| 403 | Forbidden | Insufficient permissions | Verify user permissions |
| 404 | Not Found | Wrong URL/missing resource | Check endpoint and resource |
| 429 | Too Many Requests | Rate limit exceeded | Implement rate limiting |
| 500 | Internal Server Error | Application error | Check logs for details |
| 502 | Bad Gateway | Proxy/upstream error | Check upstream services |
| 503 | Service Unavailable | Overload/maintenance | Check system resources |
| 504 | Gateway Timeout | Upstream timeout | Increase timeout values |

### Database Error Codes

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| 23505 | Unique violation | Duplicate key | Check for existing records |
| 23503 | Foreign key violation | Referenced record missing | Ensure parent record exists |
| 42P01 | Undefined table | Table doesn't exist | Run migrations |
| 42703 | Undefined column | Column doesn't exist | Check schema version |
| 53100 | Disk full | No space left | Free up disk space |
| 53200 | Out of memory | Memory exhausted | Increase memory or optimize queries |
| 57014 | Query canceled | Timeout or manual cancel | Optimize query or increase timeout |
| 08001 | Connection error | Cannot connect to database | Check database service |
| 28P01 | Invalid password | Authentication failed | Reset password |

## Recovery Procedures

### Emergency Recovery

```bash
#!/bin/bash
# emergency-recovery.sh

echo "=== Starting Emergency Recovery ==="

# 1. Stop all services
echo "Stopping services..."
docker-compose down || systemctl stop cm-diagnostics

# 2. Backup current state
echo "Creating emergency backup..."
mkdir -p /backup/emergency-$(date +%Y%m%d-%H%M%S)
cp -r /opt/cm-diagnostics/config /backup/emergency-*/
pg_dump -h localhost -U cmdiag -d cmdiagnostics > /backup/emergency-*/database.sql

# 3. Clear problematic data
echo "Clearing caches..."
redis-cli FLUSHALL

# 4. Reset to known good state
echo "Restoring last known good configuration..."
cp /backup/last-known-good/config/* /opt/cm-diagnostics/config/

# 5. Run database repairs
echo "Running database repairs..."
psql -U cmdiag -d cmdiagnostics -c "VACUUM FULL;"
psql -U cmdiag -d cmdiagnostics -c "REINDEX DATABASE cmdiagnostics;"

# 6. Restart services
echo "Restarting services..."
docker-compose up -d || systemctl start cm-diagnostics

# 7. Verify recovery
sleep 30
if curl -f http://localhost:3000/health; then
    echo "Recovery successful!"
else
    echo "Recovery failed - manual intervention required"
    exit 1
fi
```

### Data Recovery

```sql
-- Recover deleted records (if within retention period)
-- Assuming soft delete is implemented

-- View deleted records
SELECT * FROM users WHERE deleted_at IS NOT NULL;

-- Restore specific record
UPDATE users SET deleted_at = NULL WHERE id = 123;

-- Restore all records deleted in last hour
UPDATE users SET deleted_at = NULL 
WHERE deleted_at > NOW() - INTERVAL '1 hour';

-- Recover from audit log
INSERT INTO important_table 
SELECT old_data->>'id', old_data->>'name', old_data->>'value'
FROM audit_log 
WHERE table_name = 'important_table' 
  AND action = 'DELETE'
  AND created_at > '2024-01-15';
```

### Configuration Recovery

```bash
# Restore from version control
cd /opt/cm-diagnostics
git status
git diff
git checkout -- config/  # Revert all config changes

# Restore from backup
tar -xzf /backup/config-20240115.tar.gz -C /opt/cm-diagnostics/

# Validate configuration
npm run validate-config

# Test with minimal config
cat > config/minimal.yml << EOF
app:
  port: 3000
  env: recovery
database:
  url: postgresql://localhost/cmdiagnostics
EOF
```

## Getting Support

### Self-Service Resources

1. **Documentation**
   - Online docs: https://docs.cm-diagnostics.com
   - API reference: https://api.cm-diagnostics.com/docs
   - Video tutorials: https://tutorials.cm-diagnostics.com

2. **Community**
   - Forums: https://community.cm-diagnostics.com
   - Stack Overflow: Tag `cm-diagnostics`
   - GitHub Issues: https://github.com/cm-diagnostics/issues

### Collecting Support Information

```bash
#!/bin/bash
# collect-support-info.sh

OUTPUT_DIR="support-bundle-$(date +%Y%m%d-%H%M%S)"
mkdir -p $OUTPUT_DIR

echo "Collecting support information..."

# System information
echo "=== System Information ===" > $OUTPUT_DIR/system-info.txt
uname -a >> $OUTPUT_DIR/system-info.txt
cat /etc/os-release >> $OUTPUT_DIR/system-info.txt
df -h >> $OUTPUT_DIR/system-info.txt
free -h >> $OUTPUT_DIR/system-info.txt

# Application version
echo -e "\n=== Application Version ===" >> $OUTPUT_DIR/system-info.txt
cd /opt/cm-diagnostics && git describe --tags >> $OUTPUT_DIR/system-info.txt

# Configuration (sanitized)
echo "Copying configuration (sanitized)..."
cp -r /opt/cm-diagnostics/config $OUTPUT_DIR/
find $OUTPUT_DIR/config -type f -exec sed -i 's/password:.*$/password: <REDACTED>/g' {} \;

# Recent logs
echo "Collecting recent logs..."
tail -n 1000 /var/log/cm-diagnostics/*.log > $OUTPUT_DIR/recent-logs.txt

# Database info
echo "Collecting database info..."
psql -U cmdiag -d cmdiagnostics -c "\d+" > $OUTPUT_DIR/database-schema.txt

# Running processes
ps aux | grep -E 'node|postgres|redis|nginx' > $OUTPUT_DIR/processes.txt

# Create archive
tar -czf support-bundle.tar.gz $OUTPUT_DIR/
rm -rf $OUTPUT_DIR/

echo "Support bundle created: support-bundle.tar.gz"
echo "Please attach this file when contacting support"
```

### Contacting Support

**Before contacting support:**
1. Check documentation and FAQs
2. Search existing issues
3. Collect support bundle
4. Prepare reproduction steps

**Support Channels:**
- **Email**: support@cm-diagnostics.com
- **Phone**: 1-800-DIAG-NOW (Priority support)
- **Chat**: Available in application (business hours)
- **Emergency**: emergency@cm-diagnostics.com (P1 issues only)

**Information to provide:**
- Support bundle
- Error messages and codes
- Steps to reproduce
- Expected vs actual behavior
- Business impact
- Environment details

---

For additional troubleshooting resources, visit our knowledge base at https://kb.cm-diagnostics.com