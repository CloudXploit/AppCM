# CM Diagnostics Installation Guide

This comprehensive guide covers the installation and initial setup of CM Diagnostics across various deployment scenarios.

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Pre-Installation Checklist](#pre-installation-checklist)
4. [Installation Methods](#installation-methods)
5. [Docker Installation](#docker-installation)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Traditional Installation](#traditional-installation)
8. [Post-Installation Configuration](#post-installation-configuration)
9. [Verification](#verification)
10. [Troubleshooting](#troubleshooting)

## Overview

CM Diagnostics can be deployed using several methods:
- **Docker**: Containerized deployment (recommended)
- **Kubernetes**: Enterprise-scale orchestration
- **Traditional**: Direct installation on servers
- **Cloud**: AWS, Azure, or GCP deployment

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                         │
└─────────────────┬─────────────────┬─────────────────────────┘
                  │                 │
        ┌─────────▼──────┐   ┌──────▼──────────┐
        │ Web Application│   │ Web Application │
        │   (Primary)    │   │   (Secondary)   │
        └────────┬───────┘   └───────┬─────────┘
                 │                   │
        ┌────────▼───────────────────▼─────────┐
        │          Application Server          │
        │         (CM Diagnostics Core)        │
        └────────┬───────────────┬─────────────┘
                 │               │
        ┌────────▼──────┐  ┌─────▼──────────┐
        │  PostgreSQL   │  │     Redis      │
        │   Database    │  │     Cache      │
        └───────────────┘  └────────────────┘
```

## System Requirements

### Hardware Requirements

#### Minimum Requirements (< 100 users)
- **CPU**: 4 cores (2.4 GHz+)
- **RAM**: 16 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps

#### Recommended Requirements (100-1000 users)
- **CPU**: 8 cores (3.0 GHz+)
- **RAM**: 32 GB
- **Storage**: 500 GB SSD
- **Network**: 10 Gbps

#### Enterprise Requirements (1000+ users)
- **CPU**: 16+ cores
- **RAM**: 64+ GB
- **Storage**: 1+ TB SSD (RAID 10)
- **Network**: 10+ Gbps

### Software Requirements

#### Operating System
- **Linux** (Recommended):
  - Ubuntu 20.04/22.04 LTS
  - RHEL 8.x/9.x
  - CentOS Stream 8/9
  - Debian 11/12
  
- **Windows**:
  - Windows Server 2019/2022
  - Windows 10/11 (development only)

#### Dependencies
- Docker 20.10+ (for containerized deployment)
- Kubernetes 1.24+ (for K8s deployment)
- PostgreSQL 14+
- Redis 7.0+
- Node.js 18+ (for traditional installation)
- Git 2.30+

## Pre-Installation Checklist

### 1. System Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y  # Ubuntu/Debian
sudo yum update -y                       # RHEL/CentOS

# Install required tools
sudo apt install -y curl wget git nano htop
```

### 2. Network Configuration
```bash
# Check required ports are available
sudo netstat -tulpn | grep -E ':(80|443|5432|6379|3000|8080)'

# Configure firewall (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5432/tcp  # PostgreSQL
sudo ufw allow 6379/tcp  # Redis
```

### 3. SSL Certificates
```bash
# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/cm-diagnostics.key \
  -out /etc/ssl/certs/cm-diagnostics.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=cm-diagnostics.company.com"
```

### 4. Create Installation Directory
```bash
sudo mkdir -p /opt/cm-diagnostics
sudo mkdir -p /var/log/cm-diagnostics
sudo mkdir -p /etc/cm-diagnostics
```

## Installation Methods

### Quick Start (Docker Compose)
```bash
# Clone repository
git clone https://github.com/cm-diagnostics/cm-diagnostics.git
cd cm-diagnostics

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

## Docker Installation

### 1. Install Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker-compose --version
```

### 2. Create Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: cmdiagnostics/cm-diagnostics:2.0
    container_name: cm-diagnostics-app
    ports:
      - "80:3000"
      - "443:3443"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://cmdiag:password@postgres:5432/cmdiagnostics
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      CM_API_KEY: ${CM_API_KEY}
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    
  postgres:
    image: postgres:14-alpine
    container_name: cm-diagnostics-db
    environment:
      POSTGRES_DB: cmdiagnostics
      POSTGRES_USER: cmdiag
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    container_name: cm-diagnostics-cache
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    container_name: cm-diagnostics-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Environment Configuration
```bash
# .env file
NODE_ENV=production
PORT=3000

# Database
DB_PASSWORD=secure_password_here
DATABASE_URL=postgresql://cmdiag:secure_password_here@postgres:5432/cmdiagnostics

# Redis
REDIS_PASSWORD=redis_password_here
REDIS_URL=redis://:redis_password_here@redis:6379

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Content Manager
CM_API_KEY=your_cm_api_key
CM_HOST=https://cm.company.com
CM_VERSION=24.4

# IDOL Integration
IDOL_HOST=idol.company.com
IDOL_PORT=9000

# Enterprise Studio
ES_HOST=es.company.com
ES_CLIENT_ID=cm-diagnostics
ES_CLIENT_SECRET=es_secret_here
```

### 4. Deploy with Docker
```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Scale application
docker-compose up -d --scale app=3
```

## Kubernetes Deployment

### 1. Prerequisites
```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 2. Create Namespace
```bash
kubectl create namespace cm-diagnostics
```

### 3. Create ConfigMap
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm-diagnostics-config
  namespace: cm-diagnostics
data:
  NODE_ENV: "production"
  CM_HOST: "https://cm.company.com"
  CM_VERSION: "24.4"
  IDOL_HOST: "idol.company.com"
  IDOL_PORT: "9000"
  ES_HOST: "es.company.com"
```

### 4. Create Secrets
```bash
# Create secrets
kubectl create secret generic cm-diagnostics-secrets \
  --from-literal=jwt-secret='your_jwt_secret' \
  --from-literal=db-password='secure_db_password' \
  --from-literal=redis-password='secure_redis_password' \
  --from-literal=cm-api-key='your_cm_api_key' \
  -n cm-diagnostics
```

### 5. Deploy Application
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cm-diagnostics
  namespace: cm-diagnostics
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
        image: cmdiagnostics/cm-diagnostics:2.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: cm-diagnostics-config
              key: NODE_ENV
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: cm-diagnostics-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 6. Create Service
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: cm-diagnostics-service
  namespace: cm-diagnostics
spec:
  selector:
    app: cm-diagnostics
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

### 7. Deploy with Helm
```bash
# Add Helm repository
helm repo add cm-diagnostics https://charts.cm-diagnostics.com
helm repo update

# Install chart
helm install cm-diagnostics cm-diagnostics/cm-diagnostics \
  --namespace cm-diagnostics \
  --values values.yaml
```

## Traditional Installation

### 1. Install Node.js
```bash
# Using NodeSource repository (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER cmdiag WITH PASSWORD 'secure_password';
CREATE DATABASE cmdiagnostics OWNER cmdiag;
GRANT ALL PRIVILEGES ON DATABASE cmdiagnostics TO cmdiag;
EOF
```

### 3. Install Redis
```bash
# Ubuntu/Debian
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: requirepass your_redis_password

# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

### 4. Install Application
```bash
# Clone repository
cd /opt
sudo git clone https://github.com/cm-diagnostics/cm-diagnostics.git
cd cm-diagnostics

# Install dependencies
npm install --production

# Build application
npm run build

# Create systemd service
sudo nano /etc/systemd/system/cm-diagnostics.service
```

### 5. Systemd Service Configuration
```ini
[Unit]
Description=CM Diagnostics Application
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=cmdiag
WorkingDirectory=/opt/cm-diagnostics
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 6. Start Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Start service
sudo systemctl start cm-diagnostics
sudo systemctl enable cm-diagnostics

# Check status
sudo systemctl status cm-diagnostics
```

## Post-Installation Configuration

### 1. Initial Setup Wizard
```bash
# Run setup wizard
cd /opt/cm-diagnostics
npm run setup

# Or via web interface
# Navigate to: https://your-server/setup
```

### 2. Database Initialization
```bash
# Run migrations
npm run migrate

# Seed initial data
npm run seed
```

### 3. Configure Nginx (Reverse Proxy)
```nginx
# /etc/nginx/sites-available/cm-diagnostics
server {
    listen 80;
    server_name cm-diagnostics.company.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cm-diagnostics.company.com;
    
    ssl_certificate /etc/ssl/certs/cm-diagnostics.crt;
    ssl_certificate_key /etc/ssl/private/cm-diagnostics.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### 4. Enable Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/cm-diagnostics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

### 1. Health Check
```bash
# Check application health
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "version": "2.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "contentManager": "connected"
  }
}
```

### 2. Run Diagnostic Tests
```bash
# Run built-in tests
cd /opt/cm-diagnostics
npm run test:integration

# Check logs
tail -f /var/log/cm-diagnostics/app.log
```

### 3. Access Web Interface
- Navigate to: `https://cm-diagnostics.company.com`
- Login with default credentials:
  - Username: `admin`
  - Password: `changeme`
- **Important**: Change default password immediately

### 4. Verify Integrations
```bash
# Test Content Manager connection
curl -X POST http://localhost:3000/api/test/cm-connection \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test IDOL connection
curl -X POST http://localhost:3000/api/test/idol-connection \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: ECONNREFUSED 127.0.0.1:5432
```
**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U cmdiag -d cmdiagnostics

# Check pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Ensure: local all all md5
```

#### 2. Redis Connection Failed
```
Error: Redis connection to localhost:6379 failed
```
**Solution:**
```bash
# Check Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping

# Check Redis config
sudo nano /etc/redis/redis.conf
# Ensure: bind 127.0.0.1 ::1
```

#### 3. Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:**
```bash
# Find process using port
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
PORT=3001
```

#### 4. Permission Denied
```
Error: EACCES: permission denied
```
**Solution:**
```bash
# Fix ownership
sudo chown -R cmdiag:cmdiag /opt/cm-diagnostics
sudo chmod -R 755 /opt/cm-diagnostics

# Fix log directory
sudo chown -R cmdiag:cmdiag /var/log/cm-diagnostics
```

### Installation Logs

Check logs in these locations:
```bash
# Application logs
/var/log/cm-diagnostics/app.log
/var/log/cm-diagnostics/error.log

# System logs
journalctl -u cm-diagnostics -f

# Docker logs
docker logs cm-diagnostics-app

# Kubernetes logs
kubectl logs -f deployment/cm-diagnostics -n cm-diagnostics
```

## Next Steps

1. **Complete Initial Configuration**
   - Set up admin account
   - Configure email settings
   - Set up backup schedule

2. **Configure Integrations**
   - Connect to Content Manager
   - Set up IDOL integration
   - Configure Enterprise Studio

3. **Security Hardening**
   - Enable 2FA
   - Configure firewall rules
   - Set up SSL certificates

4. **Monitoring Setup**
   - Configure Prometheus
   - Set up Grafana dashboards
   - Enable alerting

5. **Review Documentation**
   - [Deployment Guide](DEPLOYMENT-GUIDE.md)
   - [Configuration Guide](../configuration/README.md)
   - [Security Guide](../security/README.md)

---

For installation support, contact: support@cm-diagnostics.com