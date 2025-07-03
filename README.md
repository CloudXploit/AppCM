# CM Diagnostics

Enterprise-grade diagnostic and auto-remediation web application for Content Manager systems.

## 🚀 Features

### Core Capabilities
- **🔐 Authentication & Authorization**: JWT-based auth with role-based access control
- **📊 Real-time Monitoring**: System metrics, performance tracking, and health monitoring
- **🔍 Automated Diagnostics**: Rule-based diagnostic engine with customizable checks
- **🔧 Auto-Remediation**: Automated fixes with approval workflows
- **🤖 Machine Learning**: Anomaly detection, predictive analytics, and pattern recognition
- **📈 Analytics & Dashboards**: Interactive dashboards with 15+ visualization types
- **🔄 Workflow Automation**: Event-driven workflows with conditional logic
- **🔌 Integration Hub**: Pre-built integrations (Slack, PagerDuty, JIRA, etc.)
- **⏰ Job Scheduling**: Cron-based job scheduling with persistence
- **📬 Notifications**: Multi-channel notifications (Email, Slack, SMS, Webhooks)
- **💾 Caching**: Redis-based caching with TTL support
- **📝 Comprehensive Logging**: Structured logging with multiple transports

### Advanced Features
- **ML Pipeline Framework**: Build, train, and deploy ML models
- **Streaming Analytics**: Real-time data processing with backpressure handling
- **Model Registry**: Version control and deployment for ML models
- **Root Cause Analysis**: AI-powered causality inference
- **Predictive Insights**: Time series forecasting and capacity planning
- **Pattern Recognition**: Automatic discovery of system behavior patterns

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose (optional, for services)
- PostgreSQL (or use Docker)
- Redis (or use Docker)
- Elasticsearch (or use Docker)

## 🛠️ Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/your-org/cm-diagnostics.git
cd cm-diagnostics
```

### 2. Run the setup script
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Or manually:

### 3. Install dependencies
```bash
npm install
```

### 4. Set up environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 5. Start services with Docker
```bash
docker-compose up -d postgres redis elasticsearch
```

### 6. Build packages
```bash
npm run build:packages
```

### 7. Start the application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 8. Run the demo
```bash
npm run demo
```

## 🏗️ Architecture

### Monorepo Structure
```
cm-diagnostics/
├── packages/              # Core packages
│   ├── core/             # Core system functionality
│   ├── auth/             # Authentication & authorization
│   ├── cache/            # Caching layer
│   ├── logger/           # Logging system
│   ├── notifications/    # Notification system
│   ├── monitoring/       # Monitoring & metrics
│   ├── diagnostics/      # Diagnostic engine
│   ├── remediation/      # Auto-remediation
│   ├── workflow/         # Workflow engine
│   ├── integrations/     # External integrations
│   ├── scheduler/        # Job scheduling
│   ├── advanced-diagnostics/  # ML-based diagnostics
│   └── analytics/        # Analytics & dashboards
├── apps/                 # Applications
├── scripts/              # Utility scripts
├── config/              # Configuration files
├── docs/                # Documentation
└── tests/               # Integration tests
```

### Technology Stack
- **Backend**: Node.js, TypeScript, Express
- **Databases**: PostgreSQL, Redis, Elasticsearch
- **ML/AI**: TensorFlow.js, Brain.js, Natural
- **Monitoring**: Prometheus, Grafana, Jaeger
- **Message Queue**: RabbitMQ
- **Storage**: MinIO (S3-compatible)
- **Container**: Docker, Docker Compose

## 📚 API Documentation

### Authentication
```bash
# Register user
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Diagnostics
```bash
# Run diagnostics
POST /api/diagnostics/run
{
  "systemId": "cm-prod-01",
  "rules": ["all"]
}

# Get findings
GET /api/diagnostics/findings?systemId=cm-prod-01
```

### Monitoring
```bash
# Get system metrics
GET /api/monitoring/metrics/cm-prod-01

# Get system health
GET /api/monitoring/health/cm-prod-01
```

### Analytics
```bash
# Create dashboard
POST /api/analytics/dashboards
{
  "name": "Performance Dashboard",
  "type": "performance"
}

# Execute query
POST /api/analytics/query
{
  "query": "SELECT * FROM metrics WHERE timestamp > NOW() - INTERVAL '1 hour'"
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific package tests
npm test -- --filter=@cm-diagnostics/diagnostics
```

## 🚀 Deployment

### Using Docker

```bash
# Build production image
docker build -t cm-diagnostics:latest .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start
```

## 📊 Monitoring

- **Metrics**: http://localhost:9090 (Prometheus)
- **Dashboards**: http://localhost:3001 (Grafana)
- **Tracing**: http://localhost:16686 (Jaeger)
- **Logs**: http://localhost:5601 (Kibana)

## 🔧 Configuration

### Environment Variables
See `.env.example` for all available configuration options.

### Key Configurations
- `NODE_ENV`: Environment (development/production)
- `PORT`: Application port
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret for JWT tokens
- `ENABLE_AUTO_REMEDIATION`: Enable/disable auto-remediation
- `ML_ENABLED`: Enable/disable ML features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Enterprise License - see LICENSE file for details.

## 🆘 Support

- Documentation: [docs.cm-diagnostics.com](https://docs.cm-diagnostics.com)
- Issues: [GitHub Issues](https://github.com/your-org/cm-diagnostics/issues)
- Email: support@cm-diagnostics.com

## 🎯 Roadmap

- [ ] Multi-cloud support (AWS, Azure, GCP)
- [ ] Mobile application
- [ ] Advanced ML models
- [ ] Kubernetes operator
- [ ] GraphQL API
- [ ] Real-time collaboration
- [ ] Advanced security features
- [ ] Performance optimizations

## 👥 Team

- **Project Lead**: Your Name
- **Contributors**: See CONTRIBUTORS.md

---

Built with ❤️ by the CM Diagnostics Team
