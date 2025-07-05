# Deployment Guide - CM Diagnostics Platform

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Architectures](#deployment-architectures)
4. [Cloud Deployment](#cloud-deployment)
5. [On-Premises Deployment](#on-premises-deployment)
6. [Hybrid Deployment](#hybrid-deployment)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

## Overview

This guide provides comprehensive instructions for deploying the Content Manager Diagnostics & Auto-Remediation Platform across different environments and architectures.

### Supported Deployment Options
- **Cloud**: AWS, Azure, GCP
- **On-Premises**: Docker, Kubernetes
- **Hybrid**: Mixed cloud and on-premises

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 8 cores
- **RAM**: 32GB
- **Storage**: 500GB SSD
- **Network**: 1Gbps

#### Recommended Requirements
- **CPU**: 16 cores
- **RAM**: 64GB
- **Storage**: 1TB NVMe SSD
- **Network**: 10Gbps

### Software Dependencies
```bash
# Required software versions
Docker: 24.0+
Kubernetes: 1.28+
Node.js: 20.x LTS
PostgreSQL: 15+
Redis: 7.0+
```

### Access Requirements
- [ ] Container registry access
- [ ] Database credentials
- [ ] SSL certificates
- [ ] API keys
- [ ] License keys

## Deployment Architectures

### Small Scale (< 100 users)
```yaml
Architecture:
  - 1x Load Balancer
  - 2x Application Servers
  - 1x Database (Primary)
  - 1x Redis Cache
  - 1x Monitoring Stack
```

### Medium Scale (100-1000 users)
```yaml
Architecture:
  - 2x Load Balancers (HA)
  - 4x Application Servers
  - 1x Database Cluster (Primary + Replica)
  - 2x Redis Cluster
  - 1x Monitoring Stack
  - 1x Message Queue
```

### Enterprise Scale (1000+ users)
```yaml
Architecture:
  - Global Load Balancing
  - 8+ Application Servers (Multi-region)
  - Database Cluster (Multi-region)
  - Redis Cluster (Multi-region)
  - Full Monitoring Stack
  - Message Queue Cluster
  - CDN Integration
```

## Cloud Deployment

### AWS Deployment

#### 1. Infrastructure Setup
```bash
# Clone infrastructure repository
git clone https://github.com/your-org/cm-diagnostics-infra.git
cd cm-diagnostics-infra/aws

# Configure AWS credentials
aws configure

# Initialize Terraform
terraform init

# Review deployment plan
terraform plan -var-file=environments/production.tfvars

# Deploy infrastructure
terraform apply -var-file=environments/production.tfvars
```

#### 2. EKS Cluster Configuration
```bash
# Update kubeconfig
aws eks update-kubeconfig --name cm-diagnostics-cluster --region us-east-1

# Verify cluster access
kubectl get nodes

# Install cluster essentials
kubectl apply -f k8s/namespaces.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/storage-classes.yaml
```

#### 3. Application Deployment
```bash
# Create secrets
kubectl create secret generic cm-diagnostics-secrets \
  --from-file=config/secrets.yaml \
  -n cm-diagnostics

# Deploy database
helm install postgresql bitnami/postgresql \
  -f helm/postgresql/values-production.yaml \
  -n cm-diagnostics

# Deploy Redis
helm install redis bitnami/redis \
  -f helm/redis/values-production.yaml \
  -n cm-diagnostics

# Deploy application
helm install cm-diagnostics ./helm/cm-diagnostics \
  -f helm/cm-diagnostics/values-production.yaml \
  -n cm-diagnostics
```

### Azure Deployment

#### 1. AKS Setup
```bash
# Create resource group
az group create --name cm-diagnostics-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group cm-diagnostics-rg \
  --name cm-diagnostics-aks \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-managed-identity \
  --network-plugin azure \
  --network-policy calico

# Get credentials
az aks get-credentials \
  --resource-group cm-diagnostics-rg \
  --name cm-diagnostics-aks
```

#### 2. Azure-Specific Configuration
```yaml
# azure-storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: managed-premium-retain
provisioner: kubernetes.io/azure-disk
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
parameters:
  storageaccounttype: Premium_LRS
  kind: Managed
```

### GCP Deployment

#### 1. GKE Setup
```bash
# Set project
gcloud config set project cm-diagnostics-prod

# Create GKE cluster
gcloud container clusters create cm-diagnostics-gke \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n2-standard-4 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10 \
  --enable-autorepair \
  --enable-autoupgrade

# Get credentials
gcloud container clusters get-credentials cm-diagnostics-gke \
  --zone us-central1-a
```

## On-Premises Deployment

### Docker Compose Deployment

#### 1. Prepare Environment
```bash
# Create deployment directory
mkdir -p /opt/cm-diagnostics
cd /opt/cm-diagnostics

# Download deployment files
wget https://releases.cm-diagnostics.com/latest/docker-compose.yml
wget https://releases.cm-diagnostics.com/latest/env.example

# Configure environment
cp env.example .env
# Edit .env with your configurations
```

#### 2. Deploy with Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  nginx:
    image: cm-diagnostics/nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/conf.d:/etc/nginx/conf.d
    depends_on:
      - app

  app:
    image: cm-diagnostics/app:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./data:/app/data

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=cm_diagnostics
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  monitoring:
    image: cm-diagnostics/monitoring:latest
    ports:
      - "3001:3001"
    environment:
      - METRICS_URL=http://app:3000/metrics

volumes:
  postgres_data:
  redis_data:
```

```bash
# Start services
docker-compose up -d

# Verify deployment
docker-compose ps

# View logs
docker-compose logs -f
```

### Kubernetes On-Premises

#### 1. Prepare Kubernetes Cluster
```bash
# Install MetalLB for load balancing
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml

# Configure IP pool
cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: production-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.240-192.168.1.250
EOF
```

#### 2. Deploy Application
```bash
# Create namespace
kubectl create namespace cm-diagnostics

# Deploy using Helm
helm install cm-diagnostics ./helm/cm-diagnostics \
  -f helm/cm-diagnostics/values-onprem.yaml \
  -n cm-diagnostics
```

## Hybrid Deployment

### Architecture Overview
```yaml
Cloud Components:
  - Web Application (Multi-region)
  - API Gateway
  - CDN
  - Monitoring

On-Premises Components:
  - Database (Primary)
  - Sensitive Data Processing
  - CM System Connections
  - Backup Systems
```

### VPN Configuration
```bash
# Configure site-to-site VPN
# AWS example
aws ec2 create-vpn-connection \
  --type ipsec.1 \
  --customer-gateway-id cgw-0123456789abcdef0 \
  --vpn-gateway-id vgw-0123456789abcdef0
```

### Data Synchronization
```yaml
# Replication configuration
replication:
  source:
    type: on-premises
    database: postgresql://primary.local:5432/cm_diagnostics
  targets:
    - type: cloud
      region: us-east-1
      database: postgresql://replica.aws:5432/cm_diagnostics
    - type: cloud
      region: eu-west-1
      database: postgresql://replica.aws:5432/cm_diagnostics
```

## Post-Deployment

### 1. Health Checks
```bash
# Check application health
curl -k https://your-domain.com/health

# Check database connectivity
kubectl exec -it cm-diagnostics-app-0 -n cm-diagnostics -- \
  psql -h postgres -U cmuser -c "SELECT 1"

# Check Redis connectivity
kubectl exec -it cm-diagnostics-app-0 -n cm-diagnostics -- \
  redis-cli -h redis ping
```

### 2. SSL Configuration
```bash
# Generate Let's Encrypt certificate
certbot certonly --standalone -d your-domain.com

# Apply certificate
kubectl create secret tls cm-diagnostics-tls \
  --cert=fullchain.pem \
  --key=privkey.pem \
  -n cm-diagnostics
```

### 3. Initial Configuration
```bash
# Run database migrations
kubectl exec -it cm-diagnostics-app-0 -n cm-diagnostics -- \
  npm run migrate:production

# Seed initial data
kubectl exec -it cm-diagnostics-app-0 -n cm-diagnostics -- \
  npm run seed:production

# Create admin user
kubectl exec -it cm-diagnostics-app-0 -n cm-diagnostics -- \
  npm run create-admin
```

### 4. Monitoring Setup
```bash
# Deploy Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  -f helm/monitoring/prometheus-values.yaml \
  -n monitoring

# Deploy Grafana dashboards
kubectl apply -f monitoring/dashboards/

# Configure alerts
kubectl apply -f monitoring/alerts/
```

## Backup Configuration

### Database Backup
```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="cm_diagnostics"

# Create backup
pg_dump -h localhost -U cmuser -d $DB_NAME | \
  gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz \
  s3://cm-diagnostics-backups/postgres/

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

### Application Backup
```yaml
# Velero backup configuration
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: cm-diagnostics-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"
  template:
    includedNamespaces:
    - cm-diagnostics
    storageLocation: s3-backup
    ttl: 720h
```

## Security Hardening

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cm-diagnostics-network-policy
  namespace: cm-diagnostics
spec:
  podSelector:
    matchLabels:
      app: cm-diagnostics
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: cm-diagnostics
    ports:
    - protocol: TCP
      port: 3000
```

### Pod Security Policy
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: cm-diagnostics-psp
spec:
  privileged: false
  runAsUser:
    rule: MustRunAsNonRoot
  seLinux:
    rule: RunAsAny
  fsGroup:
    rule: RunAsAny
  volumes:
  - configMap
  - secret
  - persistentVolumeClaim
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check database pod
kubectl get pods -n cm-diagnostics | grep postgres

# View database logs
kubectl logs -n cm-diagnostics postgres-0

# Test connection
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h postgres-service -U cmuser
```

#### 2. Application Crashes
```bash
# Check application logs
kubectl logs -n cm-diagnostics cm-diagnostics-app-0

# Describe pod for events
kubectl describe pod cm-diagnostics-app-0 -n cm-diagnostics

# Check resource usage
kubectl top pod -n cm-diagnostics
```

#### 3. Performance Issues
```bash
# Check resource limits
kubectl get pods -n cm-diagnostics -o yaml | grep -A 5 resources:

# Scale application
kubectl scale deployment cm-diagnostics-app \
  --replicas=5 -n cm-diagnostics

# Check metrics
kubectl port-forward -n cm-diagnostics svc/prometheus 9090:9090
```

### Support Contacts

- **Technical Support**: support@cm-diagnostics.com
- **Emergency Hotline**: +1-800-XXX-XXXX
- **Documentation**: https://docs.cm-diagnostics.com
- **Community Forum**: https://community.cm-diagnostics.com

---

This deployment guide is regularly updated. Always refer to the latest version at https://docs.cm-diagnostics.com/deployment