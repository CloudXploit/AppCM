# CM Diagnostics Deployment Guide

This guide covers deployment strategies, best practices, and production configurations for CM Diagnostics across various environments.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Deployment Strategies](#deployment-strategies)
3. [Production Architecture](#production-architecture)
4. [High Availability Setup](#high-availability-setup)
5. [Load Balancing](#load-balancing)
6. [Database Deployment](#database-deployment)
7. [Caching Strategy](#caching-strategy)
8. [Security Hardening](#security-hardening)
9. [Monitoring & Observability](#monitoring--observability)
10. [Backup & Recovery](#backup--recovery)
11. [Performance Tuning](#performance-tuning)
12. [Disaster Recovery](#disaster-recovery)
13. [Cloud Deployments](#cloud-deployments)
14. [Maintenance Procedures](#maintenance-procedures)

## Deployment Overview

### Deployment Principles

1. **Scalability**: Design for growth
2. **Reliability**: Ensure high availability
3. **Security**: Implement defense in depth
4. **Performance**: Optimize for speed
5. **Maintainability**: Easy to update and manage

### Environment Types

| Environment | Purpose | Configuration |
|------------|---------|---------------|
| Development | Local development | Single instance, minimal resources |
| Testing | QA and integration testing | Scaled-down production mirror |
| Staging | Pre-production validation | Production-like setup |
| Production | Live system | Full HA, monitoring, backups |

## Deployment Strategies

### Blue-Green Deployment

```yaml
# Blue-Green deployment configuration
deployment:
  strategy: blue-green
  environments:
    blue:
      version: 2.0.0
      status: active
      health_check: /health
    green:
      version: 2.1.0
      status: standby
      health_check: /health
  switch_procedure:
    - validate_green_health
    - switch_load_balancer
    - monitor_metrics
    - rollback_if_needed
```

### Rolling Deployment

```yaml
# Kubernetes rolling update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cm-diagnostics
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  template:
    spec:
      containers:
      - name: app
        image: cmdiagnostics/app:2.1.0
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Canary Deployment

```nginx
# Nginx canary configuration
upstream app_servers {
    server app-v2.0:3000 weight=9;  # 90% traffic
    server app-v2.1:3000 weight=1;  # 10% traffic (canary)
}
```

## Production Architecture

### Multi-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   CDN/WAF    │
                    │ (CloudFlare) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │Load Balancer│
                    │  (HAProxy)   │
                    └──────┬──────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼────────┐                  ┌────────▼───────┐
│  Web Server 1  │                  │  Web Server 2  │
│    (Nginx)     │                  │    (Nginx)     │
└───────┬────────┘                  └────────┬───────┘
        │                                     │
        └──────────────┬─────────────────────┘
                       │
            ┌──────────┴──────────┐
            │   App Servers       │
            │  (Load Balanced)    │
            └──────────┬──────────┘
                       │
        ┌──────────────┴──────────────────┐
        │                                 │
┌───────▼────────┐              ┌────────▼───────┐
│  PostgreSQL    │              │     Redis      │
│   Primary      │              │    Cluster     │
└───────┬────────┘              └────────────────┘
        │
┌───────▼────────┐
│  PostgreSQL    │
│   Replica      │
└────────────────┘
```

### Component Specifications

#### Web Tier
- **Servers**: 2+ Nginx instances
- **Configuration**: Reverse proxy, SSL termination
- **Resources**: 2 CPU, 4GB RAM each

#### Application Tier
- **Servers**: 3+ application instances
- **Configuration**: Stateless, horizontally scalable
- **Resources**: 4 CPU, 8GB RAM each

#### Database Tier
- **Primary**: 1 PostgreSQL master
- **Replicas**: 2+ read replicas
- **Resources**: 8 CPU, 32GB RAM, SSD storage

#### Cache Tier
- **Cluster**: Redis Sentinel (3 nodes)
- **Configuration**: High availability
- **Resources**: 2 CPU, 16GB RAM each

## High Availability Setup

### Application HA Configuration

```yaml
# docker-compose-ha.yml
version: '3.8'

services:
  app1:
    image: cmdiagnostics/app:2.0
    hostname: app1
    networks:
      - cmdiag-net
    deploy:
      replicas: 1
      restart_policy:
        condition: any
        delay: 5s
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      
  app2:
    extends: app1
    hostname: app2
    
  app3:
    extends: app1
    hostname: app3
    
  haproxy:
    image: haproxy:2.6
    ports:
      - "80:80"
      - "443:443"
      - "8404:8404"  # Stats
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg
    networks:
      - cmdiag-net
    depends_on:
      - app1
      - app2
      - app3

networks:
  cmdiag-net:
    driver: overlay
    attachable: true
```

### HAProxy Configuration

```
# haproxy.cfg
global
    maxconn 4096
    log stdout local0
    
defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    
frontend web_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/cm-diagnostics.pem
    redirect scheme https if !{ ssl_fc }
    
    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny if { sc_http_req_rate(0) gt 20 }
    
    default_backend web_servers
    
backend web_servers
    balance roundrobin
    option httpchk GET /health
    
    server app1 app1:3000 check inter 2s
    server app2 app2:3000 check inter 2s
    server app3 app3:3000 check inter 2s
    
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
```

## Load Balancing

### Application Load Balancing

```nginx
# nginx-lb.conf
upstream cm_diagnostics {
    least_conn;
    
    server app1.internal:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app2.internal:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app3.internal:3000 weight=1 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name cm-diagnostics.company.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://cm_diagnostics;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://cm_diagnostics;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Database Load Balancing

```yaml
# pgpool.conf
backend_hostname0 = 'pg-primary.internal'
backend_port0 = 5432
backend_weight0 = 0  # Primary - writes only
backend_flag0 = 'ALWAYS_PRIMARY'

backend_hostname1 = 'pg-replica1.internal'
backend_port1 = 5432
backend_weight1 = 1  # Read replica
backend_flag1 = 'DISALLOW_TO_FAILOVER'

backend_hostname2 = 'pg-replica2.internal'
backend_port2 = 5432
backend_weight2 = 1  # Read replica
backend_flag2 = 'DISALLOW_TO_FAILOVER'

# Load balancing
load_balance_mode = on
statement_level_load_balance = on
```

## Database Deployment

### PostgreSQL High Availability

```bash
# Primary server setup
sudo -u postgres psql <<EOF
-- Enable replication
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_segments = 64;
ALTER SYSTEM SET hot_standby = on;

-- Create replication user
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'repl_password';
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Streaming Replication Setup

```bash
# On replica server
# Stop PostgreSQL
sudo systemctl stop postgresql

# Clean data directory
sudo rm -rf /var/lib/postgresql/14/main/*

# Base backup from primary
sudo -u postgres pg_basebackup \
  -h pg-primary.internal \
  -D /var/lib/postgresql/14/main \
  -U replicator \
  -P -v -R -X stream

# Start replica
sudo systemctl start postgresql
```

### Connection Pooling

```ini
# pgbouncer.ini
[databases]
cmdiagnostics = host=pg-primary.internal port=5432 dbname=cmdiagnostics

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_lifetime = 3600
server_idle_timeout = 600
```

## Caching Strategy

### Redis Cluster Setup

```bash
# Create Redis cluster
redis-cli --cluster create \
  redis1.internal:6379 \
  redis2.internal:6379 \
  redis3.internal:6379 \
  redis4.internal:6379 \
  redis5.internal:6379 \
  redis6.internal:6379 \
  --cluster-replicas 1
```

### Redis Sentinel Configuration

```conf
# sentinel.conf
port 26379
sentinel monitor mymaster redis1.internal 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000
sentinel auth-pass mymaster redis_password
```

### Application Caching Configuration

```javascript
// cache-config.js
const Redis = require('ioredis');

const redis = new Redis.Cluster([
  { port: 6379, host: 'redis1.internal' },
  { port: 6379, host: 'redis2.internal' },
  { port: 6379, host: 'redis3.internal' }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
  },
  clusterRetryStrategy(times) {
    return Math.min(times * 100, 3000);
  }
});

// Cache strategies
const cacheConfig = {
  session: {
    ttl: 3600,  // 1 hour
    prefix: 'sess:'
  },
  api: {
    ttl: 300,   // 5 minutes
    prefix: 'api:'
  },
  static: {
    ttl: 86400, // 24 hours
    prefix: 'static:'
  }
};
```

## Security Hardening

### Network Security

```bash
# Firewall configuration (iptables)
# Allow only necessary ports
iptables -A INPUT -p tcp --dport 22 -j ACCEPT   # SSH
iptables -A INPUT -p tcp --dport 80 -j ACCEPT   # HTTP
iptables -A INPUT -p tcp --dport 443 -j ACCEPT  # HTTPS
iptables -A INPUT -p tcp --dport 5432 -s 10.0.0.0/24 -j ACCEPT  # PostgreSQL (internal)
iptables -A INPUT -p tcp --dport 6379 -s 10.0.0.0/24 -j ACCEPT  # Redis (internal)
iptables -A INPUT -j DROP  # Drop all other

# Save rules
iptables-save > /etc/iptables/rules.v4
```

### Application Security

```yaml
# security-config.yml
security:
  # Headers
  headers:
    X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    X-XSS-Protection: 1; mode=block
    Strict-Transport-Security: max-age=31536000; includeSubDomains
    Content-Security-Policy: default-src 'self'
    
  # Rate limiting
  rate_limit:
    window: 15m
    max_requests: 100
    
  # Session
  session:
    secure: true
    httpOnly: true
    sameSite: strict
    maxAge: 3600000
    
  # CORS
  cors:
    origin: https://cm-diagnostics.company.com
    credentials: true
```

### SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
```

## Monitoring & Observability

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cm-diagnostics'
    static_configs:
      - targets: 
        - 'app1.internal:9090'
        - 'app2.internal:9090'
        - 'app3.internal:9090'
        
  - job_name: 'postgres'
    static_configs:
      - targets: ['pg-exporter:9187']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
      
  - job_name: 'node'
    static_configs:
      - targets: 
        - 'node1:9100'
        - 'node2:9100'
        - 'node3:9100'
```

### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "CM Diagnostics Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(http_requests_total[5m])"
        }]
      },
      {
        "title": "Response Time",
        "targets": [{
          "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
        }]
      }
    ]
  }
}
```

### Logging Configuration

```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/cm-diagnostics/*.log
    multiline.pattern: '^\['
    multiline.negate: true
    multiline.match: after
    
output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "cm-diagnostics-%{+yyyy.MM.dd}"
  
processors:
  - add_docker_metadata: ~
  - add_host_metadata: ~
```

## Backup & Recovery

### Automated Backup Strategy

```bash
#!/bin/bash
# backup.sh

# Configuration
BACKUP_DIR="/backup/cm-diagnostics"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database backup
pg_dump -h pg-primary.internal \
  -U cmdiag \
  -d cmdiagnostics \
  -f "$BACKUP_DIR/db_$DATE.sql"

# Application data backup
tar -czf "$BACKUP_DIR/app_data_$DATE.tar.gz" \
  /opt/cm-diagnostics/uploads \
  /opt/cm-diagnostics/config

# Redis backup
redis-cli -h redis1.internal BGSAVE
sleep 10
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Upload to S3
aws s3 sync "$BACKUP_DIR" s3://cm-diagnostics-backups/

# Clean old backups
find "$BACKUP_DIR" -name "*.sql" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

### Recovery Procedures

```bash
#!/bin/bash
# restore.sh

# Restore database
psql -h pg-primary.internal \
  -U cmdiag \
  -d postgres \
  -c "DROP DATABASE IF EXISTS cmdiagnostics"
  
psql -h pg-primary.internal \
  -U cmdiag \
  -d postgres \
  -c "CREATE DATABASE cmdiagnostics"
  
psql -h pg-primary.internal \
  -U cmdiag \
  -d cmdiagnostics \
  -f /backup/db_latest.sql

# Restore application data
tar -xzf /backup/app_data_latest.tar.gz -C /

# Restore Redis
systemctl stop redis
cp /backup/redis_latest.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
systemctl start redis
```

## Performance Tuning

### Application Optimization

```javascript
// Performance configuration
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  const numWorkers = os.cpus().length;
  
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process
  require('./app');
}
```

### Database Optimization

```sql
-- PostgreSQL tuning
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
```

### Nginx Optimization

```nginx
# nginx.conf optimization
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    output_buffers 1 32k;
    postpone_output 1460;
    
    # Timeouts
    client_header_timeout 60s;
    client_body_timeout 60s;
    send_timeout 60s;
    keepalive_timeout 65s;
    keepalive_requests 100;
    
    # Compression
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript;
    gzip_proxied any;
}
```

## Disaster Recovery

### DR Strategy

```yaml
# disaster-recovery.yml
dr_configuration:
  rpo: 15m  # Recovery Point Objective
  rto: 1h   # Recovery Time Objective
  
  primary_site:
    location: us-east-1
    components:
      - app_servers: 3
      - db_primary: 1
      - db_replicas: 2
      - redis_nodes: 3
      
  dr_site:
    location: us-west-2
    mode: warm_standby
    components:
      - app_servers: 2
      - db_replica: 1
      - redis_nodes: 3
      
  replication:
    database:
      method: streaming
      lag_threshold: 60s
    files:
      method: rsync
      interval: 5m
```

### Failover Procedures

```bash
#!/bin/bash
# failover.sh

# Promote DR database
ssh dr-db.internal "sudo -u postgres pg_ctl promote"

# Update DNS
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "cm-diagnostics.company.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "DR_LOAD_BALANCER_IP"}]
      }
    }]
  }'

# Start DR application servers
ansible-playbook -i inventory/dr start-services.yml

# Verify services
curl https://cm-diagnostics.company.com/health
```

## Cloud Deployments

### AWS Deployment

```terraform
# main.tf
resource "aws_ecs_cluster" "cm_diagnostics" {
  name = "cm-diagnostics-cluster"
}

resource "aws_ecs_service" "app" {
  name            = "cm-diagnostics-app"
  cluster         = aws_ecs_cluster.cm_diagnostics.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3
  
  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }
}

resource "aws_rds_cluster" "postgres" {
  cluster_identifier      = "cm-diagnostics-db"
  engine                  = "aurora-postgresql"
  engine_version          = "14.6"
  master_username         = "cmdiag"
  master_password         = var.db_password
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "cm-diagnostics-cache"
  engine               = "redis"
  node_type            = "cache.r6g.large"
  num_cache_nodes      = 3
  parameter_group_name = "default.redis7"
}
```

### Azure Deployment

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.Web/serverfarms",
      "apiVersion": "2021-02-01",
      "name": "cm-diagnostics-plan",
      "location": "[resourceGroup().location]",
      "sku": {
        "name": "P2v3",
        "capacity": 3
      }
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2021-02-01",
      "name": "cm-diagnostics-app",
      "location": "[resourceGroup().location]",
      "properties": {
        "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', 'cm-diagnostics-plan')]"
      }
    }
  ]
}
```

### Google Cloud Deployment

```yaml
# kubernetes-gke.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cm-diagnostics
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cm-diagnostics
  template:
    metadata:
      labels:
        app: cm-diagnostics
    spec:
      containers:
      - name: app
        image: gcr.io/project-id/cm-diagnostics:2.0
        resources:
          requests:
            cpu: "1"
            memory: "2Gi"
          limits:
            cpu: "2"
            memory: "4Gi"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: cm-diagnostics-secrets
              key: database-url
---
apiVersion: v1
kind: Service
metadata:
  name: cm-diagnostics-service
spec:
  type: LoadBalancer
  selector:
    app: cm-diagnostics
  ports:
  - port: 80
    targetPort: 3000
```

## Maintenance Procedures

### Zero-Downtime Updates

```bash
#!/bin/bash
# rolling-update.sh

# Update process
NODES=("app1" "app2" "app3")
NEW_VERSION="2.1.0"

for node in "${NODES[@]}"; do
  echo "Updating $node to version $NEW_VERSION"
  
  # Remove from load balancer
  haproxy-cli disable server web_servers/$node
  
  # Wait for connections to drain
  sleep 30
  
  # Update container
  ssh $node "docker pull cmdiagnostics/app:$NEW_VERSION"
  ssh $node "docker stop cm-diagnostics-app"
  ssh $node "docker run -d --name cm-diagnostics-app cmdiagnostics/app:$NEW_VERSION"
  
  # Health check
  until curl -f http://$node:3000/health; do
    sleep 5
  done
  
  # Add back to load balancer
  haproxy-cli enable server web_servers/$node
  
  # Wait before next node
  sleep 60
done
```

### Database Maintenance

```sql
-- Maintenance tasks
-- Vacuum and analyze
VACUUM ANALYZE;

-- Reindex
REINDEX DATABASE cmdiagnostics;

-- Update statistics
ANALYZE;

-- Check for bloat
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Health Checks

```bash
#!/bin/bash
# health-check.sh

# Application health
for server in app1 app2 app3; do
  response=$(curl -s -o /dev/null -w "%{http_code}" http://$server:3000/health)
  if [ $response -eq 200 ]; then
    echo "✓ $server is healthy"
  else
    echo "✗ $server is unhealthy (HTTP $response)"
  fi
done

# Database health
psql -h pg-primary -U cmdiag -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Database is healthy"
else
  echo "✗ Database is unhealthy"
fi

# Redis health
redis-cli -h redis1 ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Redis is healthy"
else
  echo "✗ Redis is unhealthy"
fi
```

## Best Practices Summary

1. **Always use configuration management** (Ansible, Terraform)
2. **Implement comprehensive monitoring** before issues arise
3. **Test disaster recovery procedures** regularly
4. **Document everything** - runbooks, procedures, configurations
5. **Automate repetitive tasks** to reduce human error
6. **Use immutable infrastructure** where possible
7. **Implement security at every layer**
8. **Plan for capacity** before you need it
9. **Keep systems updated** with security patches
10. **Monitor costs** and optimize resource usage

---

For deployment support, contact: devops@cm-diagnostics.com