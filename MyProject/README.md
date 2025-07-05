# CM Diagnostics Platform

## Overview

CM Diagnostics is an enterprise-grade diagnostic and integration platform for OpenText Content Manager (CM), providing comprehensive system health monitoring, performance analytics, and seamless integration with IDOL and Enterprise Studio.

## Features

- **Real-time Diagnostics**: Monitor CM system health, performance metrics, and user activity
- **Advanced Analytics**: AI-powered insights and predictive maintenance capabilities
- **Multi-System Integration**: Seamless integration with IDOL search and Enterprise Studio
- **Performance Optimization**: Automated performance tuning and resource optimization
- **Security Monitoring**: Real-time security event detection and compliance reporting
- **Scalable Architecture**: Microservices-based design supporting enterprise deployments

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │     │   Mobile App    │     │     CLI Tool    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         └───────────────────────┴─────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │      API Gateway        │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────┴────────┐    ┌─────────┴────────┐    ┌─────────┴────────┐
│  Diagnostics   │    │   Analytics      │    │  Integration     │
│    Service     │    │    Service       │    │    Service       │
└────────────────┘    └──────────────────┘    └──────────────────┘
        │                        │                        │
        └────────────────────────┴────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │      Data Layer         │
                    │  (PostgreSQL + Redis)   │
                    └─────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/cm-diagnostics.git
cd cm-diagnostics
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize the database:
```bash
npm run db:migrate
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

## Development

### Project Structure

```
cm-diagnostics/
├── apps/
│   ├── web/                 # Next.js web application
│   ├── mobile/              # React Native mobile app
│   └── cli/                 # Command-line interface
├── packages/
│   ├── core/                # Core utilities
│   ├── api/                 # GraphQL/REST API
│   ├── database/            # Database models and migrations
│   ├── auth/                # Authentication service
│   ├── diagnostics/         # Diagnostic engine
│   ├── analytics/           # Analytics engine
│   ├── cm-connector/        # CM integration
│   ├── idol-connector/      # IDOL integration
│   ├── es-connector/        # Enterprise Studio integration
│   └── ui/                  # Shared UI components
├── tests/                   # Test suites
├── docs/                    # Documentation
└── scripts/                 # Build and deployment scripts
```

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### Building for Production

```bash
# Build all packages
npm run build

# Build specific app
npm run build:web
npm run build:mobile
npm run build:cli
```

## Deployment

### Docker Deployment

```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n cm-diagnostics
```

## API Documentation

- REST API: http://localhost:3000/api/docs
- GraphQL Playground: http://localhost:3000/graphql

## Configuration

Key configuration options in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cm_diagnostics
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# Content Manager
CM_API_URL=https://your-cm-instance/api
CM_API_KEY=your-api-key

# IDOL
IDOL_HOST=your-idol-host
IDOL_PORT=9000

# Enterprise Studio
ES_API_URL=https://your-es-instance/api
ES_API_KEY=your-api-key
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: https://docs.cm-diagnostics.com
- Issues: https://github.com/your-org/cm-diagnostics/issues
- Email: support@cm-diagnostics.com

## Roadmap

- Q1 2024: Core diagnostics engine
- Q2 2024: IDOL integration
- Q3 2024: Enterprise Studio integration
- Q4 2024: Advanced analytics and ML features
- Q1 2025: Mobile app release
- Q2 2025: Enterprise features and scaling