# Cloud Deployment Guide

This guide provides detailed instructions for deploying CM Diagnostics on major cloud platforms: AWS, Azure, and Google Cloud Platform.

## Table of Contents

1. [Cloud Platform Overview](#cloud-platform-overview)
2. [AWS Deployment](#aws-deployment)
3. [Azure Deployment](#azure-deployment)
4. [Google Cloud Deployment](#google-cloud-deployment)
5. [Multi-Cloud Strategy](#multi-cloud-strategy)
6. [Cost Optimization](#cost-optimization)
7. [Security Best Practices](#security-best-practices)
8. [Monitoring & Compliance](#monitoring--compliance)

## Cloud Platform Overview

### Platform Comparison

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **Compute** | EC2, ECS, EKS | VMs, AKS, Container Instances | Compute Engine, GKE |
| **Database** | RDS, Aurora | SQL Database, Cosmos DB | Cloud SQL, Spanner |
| **Storage** | S3, EFS | Blob Storage, Files | Cloud Storage, Filestore |
| **Cache** | ElastiCache | Cache for Redis | Memorystore |
| **Load Balancing** | ALB, NLB | Application Gateway | Cloud Load Balancing |
| **CDN** | CloudFront | CDN | Cloud CDN |
| **Monitoring** | CloudWatch | Monitor | Cloud Monitoring |

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │     CDN      │
                    │  (Global)    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     WAF      │
                    │ (Regional)   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │Load Balancer │
                    │   (Multi-AZ) │
                    └──────┬──────┘
                           │
            ┌──────────────┴──────────────┐
            │     Container Service       │
            │  (Auto-scaling, Multi-AZ)   │
            └──────────────┬──────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼────────┐                  ┌────────▼───────┐
│Managed Database│                  │ Managed Cache  │
│   (Multi-AZ)   │                  │   (Cluster)    │
└────────────────┘                  └────────────────┘
```

## AWS Deployment

### Prerequisites

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure

# Install additional tools
pip install aws-sam-cli
npm install -g aws-cdk
```

### Infrastructure as Code (Terraform)

```hcl
# versions.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# variables.tf
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "cm-diagnostics"
}

# main.tf
provider "aws" {
  region = var.region
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "${var.app_name}-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  enable_dns_hostnames = true
  
  tags = {
    Environment = var.environment
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = var.app_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "2048"
  memory                   = "4096"
  
  container_definitions = jsonencode([
    {
      name  = "app"
      image = "${aws_ecr_repository.app.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        }
      ]
      
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.db_url.arn
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

# ECS Service
resource "aws_ecs_service" "app" {
  name            = var.app_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3
  launch_type     = "FARGATE"
  
  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = module.vpc.private_subnets
    assign_public_ip = false
  }
  
  load_balancer {
    target_group_arn = aws_alb_target_group.app.id
    container_name   = "app"
    container_port   = 3000
  }
  
  depends_on = [aws_alb_listener.front_end]
}

# Application Load Balancer
resource "aws_alb" "main" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
  
  enable_deletion_protection = true
  enable_http2              = true
  
  tags = {
    Environment = var.environment
  }
}

# RDS Aurora PostgreSQL
resource "aws_rds_cluster" "postgres" {
  cluster_identifier      = "${var.app_name}-db"
  engine                  = "aurora-postgresql"
  engine_version          = "14.6"
  database_name           = "cmdiagnostics"
  master_username         = "cmdiag"
  master_password         = random_password.db_password.result
  
  db_subnet_group_name    = aws_db_subnet_group.postgres.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  serverlessv2_scaling_configuration {
    max_capacity = 4
    min_capacity = 0.5
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.app_name}-redis"
  replication_group_description = "Redis cluster for CM Diagnostics"
  engine                     = "redis"
  engine_version            = "7.0"
  node_type                 = "cache.r6g.large"
  number_cache_clusters     = 3
  
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = random_password.redis_auth.result
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.app_name}-uploads-${data.aws_caller_identity.current.account_id}"
  
  lifecycle_rule {
    enabled = true
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket" "backups" {
  bucket = "${var.app_name}-backups-${data.aws_caller_identity.current.account_id}"
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    enabled = true
    
    noncurrent_version_expiration {
      days = 90
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name = aws_alb.main.dns_name
    origin_id   = "ALB-${aws_alb.main.id}"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  aliases = ["cm-diagnostics.company.com"]
  
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${aws_alb.main.id}"
    
    forwarded_values {
      query_string = true
      headers      = ["Host", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      
      cookies {
        forward = "all"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }
  
  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.main.arn
    ssl_support_method  = "sni-only"
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
```

### Deployment Script

```bash
#!/bin/bash
# deploy-aws.sh

# Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO
docker build -t cm-diagnostics .
docker tag cm-diagnostics:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Deploy infrastructure
cd terraform/aws
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Update ECS service
aws ecs update-service \
  --cluster cm-diagnostics-cluster \
  --service cm-diagnostics \
  --force-new-deployment

# Wait for deployment
aws ecs wait services-stable \
  --cluster cm-diagnostics-cluster \
  --services cm-diagnostics
```

## Azure Deployment

### Prerequisites

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Install Terraform
wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
unzip terraform_1.5.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### Azure Resource Manager (ARM) Template

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "appName": {
      "type": "string",
      "defaultValue": "cm-diagnostics"
    },
    "environment": {
      "type": "string",
      "defaultValue": "production"
    }
  },
  "variables": {
    "location": "[resourceGroup().location]",
    "appServicePlanName": "[concat(parameters('appName'), '-plan')]",
    "webAppName": "[concat(parameters('appName'), '-app')]",
    "sqlServerName": "[concat(parameters('appName'), '-sql')]",
    "databaseName": "cmdiagnostics",
    "redisCacheName": "[concat(parameters('appName'), '-redis')]",
    "storageAccountName": "[concat(replace(parameters('appName'), '-', ''), 'storage')]"
  },
  "resources": [
    {
      "type": "Microsoft.Web/serverfarms",
      "apiVersion": "2021-02-01",
      "name": "[variables('appServicePlanName')]",
      "location": "[variables('location')]",
      "sku": {
        "name": "P2v3",
        "tier": "Premium",
        "capacity": 3
      },
      "properties": {
        "reserved": true
      }
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2021-02-01",
      "name": "[variables('webAppName')]",
      "location": "[variables('location')]",
      "dependsOn": [
        "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]"
      ],
      "properties": {
        "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]",
        "siteConfig": {
          "linuxFxVersion": "NODE|18-lts",
          "appSettings": [
            {
              "name": "NODE_ENV",
              "value": "[parameters('environment')]"
            },
            {
              "name": "DATABASE_URL",
              "value": "[concat('postgresql://', variables('sqlServerName'), '.postgres.database.azure.com:5432/', variables('databaseName'))]"
            }
          ],
          "alwaysOn": true,
          "http20Enabled": true,
          "minTlsVersion": "1.2"
        }
      }
    },
    {
      "type": "Microsoft.DBforPostgreSQL/flexibleServers",
      "apiVersion": "2021-06-01",
      "name": "[variables('sqlServerName')]",
      "location": "[variables('location')]",
      "sku": {
        "name": "Standard_D4ds_v4",
        "tier": "GeneralPurpose"
      },
      "properties": {
        "version": "14",
        "administratorLogin": "cmdiag",
        "administratorLoginPassword": "[concat('P@ssw0rd', uniqueString(resourceGroup().id))]",
        "storage": {
          "storageSizeGB": 128
        },
        "backup": {
          "backupRetentionDays": 7,
          "geoRedundantBackup": "Enabled"
        },
        "highAvailability": {
          "mode": "ZoneRedundant"
        }
      }
    },
    {
      "type": "Microsoft.Cache/redis",
      "apiVersion": "2021-06-01",
      "name": "[variables('redisCacheName')]",
      "location": "[variables('location')]",
      "properties": {
        "sku": {
          "name": "Premium",
          "family": "P",
          "capacity": 1
        },
        "enableNonSslPort": false,
        "minimumTlsVersion": "1.2",
        "redisConfiguration": {
          "maxmemory-policy": "allkeys-lru"
        }
      }
    },
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2021-06-01",
      "name": "[variables('storageAccountName')]",
      "location": "[variables('location')]",
      "sku": {
        "name": "Standard_LRS"
      },
      "kind": "StorageV2",
      "properties": {
        "accessTier": "Hot",
        "supportsHttpsTrafficOnly": true,
        "minimumTlsVersion": "TLS1_2"
      }
    }
  ]
}
```

### Azure Kubernetes Service (AKS) Deployment

```bash
#!/bin/bash
# deploy-aks.sh

# Create resource group
az group create --name cm-diagnostics-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group cm-diagnostics-rg \
  --name cm-diagnostics-aks \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials \
  --resource-group cm-diagnostics-rg \
  --name cm-diagnostics-aks

# Create container registry
az acr create \
  --resource-group cm-diagnostics-rg \
  --name cmdiagnosticsacr \
  --sku Premium

# Build and push image
az acr build \
  --registry cmdiagnosticsacr \
  --image cm-diagnostics:latest .

# Deploy to AKS
kubectl apply -f k8s/azure/
```

### Azure DevOps Pipeline

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
    - main
    - release/*

variables:
  dockerRegistryServiceConnection: 'acr-connection'
  imageRepository: 'cm-diagnostics'
  containerRegistry: 'cmdiagnosticsacr.azurecr.io'
  dockerfilePath: '$(Build.SourcesDirectory)/Dockerfile'
  tag: '$(Build.BuildId)'

stages:
- stage: Build
  displayName: Build and push stage
  jobs:
  - job: Build
    displayName: Build
    pool:
      vmImage: ubuntu-latest
    steps:
    - task: Docker@2
      displayName: Build and push an image to container registry
      inputs:
        command: buildAndPush
        repository: $(imageRepository)
        dockerfile: $(dockerfilePath)
        containerRegistry: $(dockerRegistryServiceConnection)
        tags: |
          $(tag)
          latest

- stage: Deploy
  displayName: Deploy stage
  dependsOn: Build
  condition: succeeded()
  jobs:
  - deployment: Deploy
    displayName: Deploy
    pool:
      vmImage: ubuntu-latest
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: KubernetesManifest@0
            displayName: Deploy to Kubernetes cluster
            inputs:
              action: deploy
              kubernetesServiceConnection: 'aks-connection'
              namespace: 'default'
              manifests: |
                $(Pipeline.Workspace)/manifests/deployment.yml
                $(Pipeline.Workspace)/manifests/service.yml
              containers: |
                $(containerRegistry)/$(imageRepository):$(tag)
```

## Google Cloud Deployment

### Prerequisites

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize gcloud
gcloud init

# Install additional tools
gcloud components install kubectl
gcloud components install gke-gcloud-auth-plugin
```

### Terraform Configuration for GCP

```hcl
# gcp-main.tf
provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "cloudrun.googleapis.com"
  ])
  
  service = each.value
  disable_on_destroy = false
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${var.app_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.app_name}-subnet"
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }
  
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }
}

# GKE Cluster
resource "google_container_cluster" "primary" {
  name     = "${var.app_name}-gke"
  location = var.region
  
  remove_default_node_pool = true
  initial_node_count       = 1
  
  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name
  
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
  
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
  
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }
}

# GKE Node Pool
resource "google_container_node_pool" "primary_nodes" {
  name       = "${var.app_name}-node-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = 3
  
  autoscaling {
    min_node_count = 3
    max_node_count = 10
  }
  
  node_config {
    preemptible  = false
    machine_type = "n2-standard-4"
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

# Cloud SQL PostgreSQL
resource "google_sql_database_instance" "postgres" {
  name             = "${var.app_name}-db"
  database_version = "POSTGRES_14"
  region           = var.region
  
  settings {
    tier = "db-custom-4-16384"
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }
    
    ip_configuration {
      ipv4_enabled    = true
      private_network = google_compute_network.vpc.id
      require_ssl     = true
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
  }
  
  deletion_protection = true
}

# Memorystore Redis
resource "google_redis_instance" "cache" {
  name           = "${var.app_name}-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 5
  region         = var.region
  
  authorized_network = google_compute_network.vpc.id
  
  redis_version = "REDIS_6_X"
  display_name  = "CM Diagnostics Cache"
  
  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}

# Cloud Storage Buckets
resource "google_storage_bucket" "uploads" {
  name          = "${var.app_name}-uploads-${var.project_id}"
  location      = var.region
  force_destroy = false
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  versioning {
    enabled = true
  }
}

# Cloud Load Balancing
resource "google_compute_global_address" "default" {
  name = "${var.app_name}-ip"
}

resource "google_compute_managed_ssl_certificate" "default" {
  name = "${var.app_name}-cert"
  
  managed {
    domains = ["cm-diagnostics.company.com"]
  }
}

resource "google_compute_backend_service" "default" {
  name        = "${var.app_name}-backend"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 30
  
  backend {
    group = google_container_cluster.primary.instance_group_urls[0]
  }
  
  health_checks = [google_compute_health_check.default.id]
}
```

### Google Cloud Run Deployment

```yaml
# cloudrun-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: cm-diagnostics
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "2"
        autoscaling.knative.dev/maxScale: "100"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 1000
      timeoutSeconds: 300
      containers:
      - image: gcr.io/PROJECT_ID/cm-diagnostics:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: latest
        resources:
          limits:
            cpu: "2"
            memory: "4Gi"
          requests:
            cpu: "1"
            memory: "2Gi"
```

### Deployment Script

```bash
#!/bin/bash
# deploy-gcp.sh

PROJECT_ID="your-project-id"
REGION="us-central1"
APP_NAME="cm-diagnostics"

# Set project
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable container.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com

# Build and push container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$APP_NAME:latest .

# Deploy to GKE
gcloud container clusters get-credentials $APP_NAME-gke --region $REGION
kubectl apply -f k8s/gcp/

# Or deploy to Cloud Run
gcloud run deploy $APP_NAME \
  --image gcr.io/$PROJECT_ID/$APP_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated
```

## Multi-Cloud Strategy

### Cloud-Agnostic Architecture

```yaml
# helm/values-multicloud.yaml
global:
  cloud:
    provider: ${CLOUD_PROVIDER} # aws, azure, gcp
    
storage:
  type: ${STORAGE_TYPE} # s3, blob, gcs
  config:
    aws:
      bucket: cm-diagnostics-uploads
      region: us-east-1
    azure:
      container: uploads
      account: cmdiagnosticsstorage
    gcp:
      bucket: cm-diagnostics-uploads
      
database:
  type: postgresql
  managed: true
  config:
    aws:
      engine: aurora-postgresql
      version: "14.6"
    azure:
      service: flexible-server
      version: "14"
    gcp:
      service: cloud-sql
      version: "POSTGRES_14"
```

### Terraform Multi-Cloud Module

```hcl
# modules/app/main.tf
variable "cloud_provider" {
  description = "Cloud provider (aws, azure, gcp)"
  type        = string
}

module "aws" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  source = "./aws"
  # AWS-specific variables
}

module "azure" {
  count  = var.cloud_provider == "azure" ? 1 : 0
  source = "./azure"
  # Azure-specific variables
}

module "gcp" {
  count  = var.cloud_provider == "gcp" ? 1 : 0
  source = "./gcp"
  # GCP-specific variables
}

output "app_url" {
  value = coalesce(
    try(module.aws[0].app_url, ""),
    try(module.azure[0].app_url, ""),
    try(module.gcp[0].app_url, "")
  )
}
```

## Cost Optimization

### AWS Cost Optimization

```yaml
# cost-optimization/aws.yaml
compute:
  - use_spot_instances: true
    spot_percentage: 60
  - use_savings_plans: true
    commitment: 1_year
  - right_sizing:
      analyze_period: 30d
      downsize_threshold: 20%
      
storage:
  - lifecycle_policies:
      hot_to_warm: 30d
      warm_to_cold: 90d
      delete_after: 365d
  - intelligent_tiering: enabled
  
database:
  - use_aurora_serverless: true
    min_capacity: 0.5
    max_capacity: 4
  - enable_auto_pause: true
    pause_after: 300s
    
monitoring:
  - cost_alerts:
      - threshold: 1000
        action: email
      - threshold: 2000
        action: slack
```

### Azure Cost Optimization

```powershell
# Azure cost optimization script
# Enable auto-shutdown for dev/test
az vm auto-shutdown \
  --resource-group cm-diagnostics-dev \
  --name cm-diagnostics-vm \
  --time 1800

# Use Azure Hybrid Benefit
az vm update \
  --resource-group cm-diagnostics-rg \
  --name cm-diagnostics-vm \
  --license-type Windows_Server

# Enable autoscaling
az monitor autoscale create \
  --resource-group cm-diagnostics-rg \
  --name cm-diagnostics-autoscale \
  --min-count 2 \
  --max-count 10 \
  --count 3
```

### GCP Cost Optimization

```bash
# GCP cost optimization
# Use preemptible VMs
gcloud compute instances create cm-diagnostics-worker \
  --preemptible \
  --machine-type=n2-standard-4

# Set up committed use discounts
gcloud compute commitments create commitment-1 \
  --plan=12-months \
  --resources=vcpu=100,memory=400

# Enable autoscaling
gcloud compute instance-groups managed set-autoscaling \
  cm-diagnostics-mig \
  --max-num-replicas=10 \
  --min-num-replicas=2 \
  --target-cpu-utilization=0.6
```

## Security Best Practices

### Cloud Security Configuration

```yaml
# security/cloud-security.yaml
aws:
  iam:
    - use_roles_not_users: true
    - enable_mfa: true
    - least_privilege: true
  network:
    - vpc_flow_logs: enabled
    - security_groups: restrictive
    - nacls: configured
  encryption:
    - s3_encryption: AES256
    - rds_encryption: enabled
    - ebs_encryption: enabled
    
azure:
  identity:
    - use_managed_identities: true
    - enable_rbac: true
    - conditional_access: enabled
  network:
    - nsg_rules: restrictive
    - ddos_protection: standard
    - firewall: enabled
  encryption:
    - storage_encryption: enabled
    - disk_encryption: enabled
    - tls_minimum: "1.2"
    
gcp:
  iam:
    - use_service_accounts: true
    - workload_identity: enabled
    - binary_authorization: enabled
  network:
    - vpc_flow_logs: enabled
    - cloud_armor: enabled
    - private_google_access: true
  encryption:
    - cmek: enabled
    - application_layer_encryption: true
```

### Compliance Configuration

```yaml
# compliance/standards.yaml
compliance_frameworks:
  - hipaa:
      enabled: true
      requirements:
        - encryption_at_rest
        - encryption_in_transit
        - audit_logging
        - access_controls
        
  - pci_dss:
      enabled: true
      requirements:
        - network_segmentation
        - vulnerability_scanning
        - security_monitoring
        - incident_response
        
  - gdpr:
      enabled: true
      requirements:
        - data_privacy
        - right_to_deletion
        - data_portability
        - consent_management
```

## Monitoring & Compliance

### Cloud-Native Monitoring

```yaml
# monitoring/cloud-monitoring.yaml
aws:
  cloudwatch:
    metrics:
      - application_metrics
      - custom_metrics
      - logs_insights
    alarms:
      - cpu_utilization > 80%
      - memory_utilization > 85%
      - error_rate > 5%
    dashboards:
      - application_health
      - infrastructure_overview
      - cost_analysis
      
azure:
  monitor:
    metrics:
      - app_insights
      - log_analytics
      - custom_metrics
    alerts:
      - metric_alerts
      - log_alerts
      - activity_log_alerts
    workbooks:
      - performance_analysis
      - failure_analysis
      - usage_analytics
      
gcp:
  cloud_monitoring:
    metrics:
      - system_metrics
      - application_metrics
      - custom_metrics
    alerts:
      - uptime_checks
      - metric_thresholds
      - log_based_alerts
    dashboards:
      - sre_golden_signals
      - error_budget
      - service_level_objectives
```

### Compliance Monitoring

```python
# compliance-monitor.py
import boto3
import azure.monitor
from google.cloud import monitoring_v3

class ComplianceMonitor:
    def __init__(self, cloud_provider):
        self.provider = cloud_provider
        
    def check_encryption(self):
        """Check encryption compliance across resources"""
        if self.provider == 'aws':
            return self.check_aws_encryption()
        elif self.provider == 'azure':
            return self.check_azure_encryption()
        elif self.provider == 'gcp':
            return self.check_gcp_encryption()
            
    def check_aws_encryption(self):
        ec2 = boto3.client('ec2')
        s3 = boto3.client('s3')
        rds = boto3.client('rds')
        
        # Check EBS encryption
        volumes = ec2.describe_volumes()
        unencrypted = [v for v in volumes['Volumes'] if not v.get('Encrypted')]
        
        # Check S3 encryption
        buckets = s3.list_buckets()
        for bucket in buckets['Buckets']:
            encryption = s3.get_bucket_encryption(Bucket=bucket['Name'])
            # Process encryption status
            
        return {
            'compliant': len(unencrypted) == 0,
            'issues': unencrypted
        }
```

## Best Practices Summary

### 1. **Infrastructure as Code**
- Use Terraform/CloudFormation/ARM templates
- Version control all infrastructure code
- Implement proper state management

### 2. **Security First**
- Enable encryption everywhere
- Use managed identities/IAM roles
- Implement network segmentation
- Regular security audits

### 3. **High Availability**
- Multi-AZ/multi-region deployments
- Auto-scaling configurations
- Health checks and self-healing

### 4. **Cost Management**
- Use reserved instances/committed use
- Implement auto-scaling
- Regular cost optimization reviews
- Tag all resources

### 5. **Monitoring & Observability**
- Use cloud-native monitoring tools
- Implement comprehensive logging
- Set up proactive alerts
- Track SLIs/SLOs

### 6. **Disaster Recovery**
- Regular backups
- Cross-region replication
- Documented DR procedures
- Regular DR testing

---

For cloud deployment support, contact: cloud-team@cm-diagnostics.com