// CM Diagnostics Main Server
// This is the main entry point for the application

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Load environment variables
dotenv.config();

// Import all packages
import { createCore } from './packages/core/src';
import { createLogger } from './packages/logger/src';
import { createAuthSystem } from './packages/auth/src';
import { createCache } from './packages/cache/src';
import { createNotificationSystem } from './packages/notifications/src';
import { createWorkflowEngine } from './packages/workflow/src';
import { createMonitoringSystem } from './packages/monitoring/src';
import { createDiagnosticsEngine } from './packages/diagnostics/src';
import { createRemediationEngine } from './packages/remediation/src';
import { createIntegrationHub } from './packages/integrations/src';
import { createScheduler } from './packages/scheduler/src';
import { createAdvancedDiagnostics } from './packages/advanced-diagnostics/src';
import { createAnalyticsEngine } from './packages/analytics/src';

// Initialize logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  service: 'cm-diagnostics-server'
});

// Initialize Express app
const app: Express = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize all systems
async function initializeSystems() {
  logger.info('Initializing CM Diagnostics systems...');

  try {
    // Core system
    const core = createCore({
      appName: process.env.APP_NAME || 'CM Diagnostics',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });

    // Auth system
    const auth = createAuthSystem({
      jwtSecret: process.env.JWT_SECRET || 'dev-secret',
      tokenExpiry: '24h',
      refreshTokenExpiry: '7d'
    });

    // Cache system
    const cache = createCache({
      type: 'redis',
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD
      }
    });

    // Notification system
    const notifications = createNotificationSystem({
      channels: {
        email: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        }
      }
    });

    // Workflow engine
    const workflow = createWorkflowEngine({
      maxConcurrentWorkflows: 10,
      enablePersistence: true
    });

    // Monitoring system
    const monitoring = createMonitoringSystem({
      enableMetrics: true,
      enableTracing: true,
      enableLogging: true,
      prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090')
    });

    // Diagnostics engine
    const diagnostics = createDiagnosticsEngine({
      rules: {
        enableBuiltInRules: true,
        customRulesPath: './rules'
      },
      realtime: {
        enabled: true,
        interval: 60000
      }
    });

    // Remediation engine
    const remediation = createRemediationEngine({
      strategies: {
        enableBuiltInStrategies: true
      },
      execution: {
        dryRunByDefault: false,
        requireApproval: true
      }
    });

    // Integration hub
    const integrations = createIntegrationHub();

    // Scheduler
    const scheduler = createScheduler({
      persistence: true,
      maxConcurrentJobs: 20
    });

    // Advanced diagnostics (ML)
    const advancedDiagnostics = createAdvancedDiagnostics({
      anomalyDetection: {
        sensitivity: 0.7,
        algorithms: ['STATISTICAL', 'ISOLATION_FOREST', 'AUTOENCODER']
      },
      enableLearning: true,
      enablePredictions: true
    });

    // Analytics engine
    const analytics = createAnalyticsEngine({
      dashboards: {
        maxDashboards: 100,
        enableAutoSave: true
      },
      pipelines: {
        maxConcurrentRuns: 5,
        enableMetrics: true
      },
      streaming: {
        maxConcurrentStreams: 10,
        enableBackpressure: true
      },
      models: {
        enableVersioning: true,
        autoDeployment: false
      }
    });

    // Store systems in app locals for route access
    app.locals.systems = {
      core,
      auth,
      cache,
      notifications,
      workflow,
      monitoring,
      diagnostics,
      remediation,
      integrations,
      scheduler,
      advancedDiagnostics,
      analytics,
      logger
    };

    // Initialize integrations
    await integrations.initialize();

    // Start monitoring
    await monitoring.startCollecting();

    // Set up real-time connections
    setupWebSocketHandlers(io, app.locals.systems);

    logger.info('All systems initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize systems', error as Error);
    throw error;
  }
}

// WebSocket handlers
function setupWebSocketHandlers(io: SocketIOServer, systems: any) {
  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    // Subscribe to diagnostics events
    socket.on('subscribe:diagnostics', (systemId: string) => {
      socket.join(`diagnostics:${systemId}`);
      logger.debug(`Client ${socket.id} subscribed to diagnostics for ${systemId}`);
    });

    // Subscribe to monitoring events
    socket.on('subscribe:monitoring', (systemId: string) => {
      socket.join(`monitoring:${systemId}`);
      logger.debug(`Client ${socket.id} subscribed to monitoring for ${systemId}`);
    });

    // Subscribe to analytics events
    socket.on('subscribe:analytics', (dashboardId: string) => {
      socket.join(`analytics:${dashboardId}`);
      logger.debug(`Client ${socket.id} subscribed to analytics for ${dashboardId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  // Forward events from systems to WebSocket clients
  systems.diagnostics.on('findingDetected', (finding: any) => {
    io.to(`diagnostics:${finding.systemId}`).emit('finding', finding);
  });

  systems.monitoring.on('metricsCollected', (metrics: any) => {
    io.to(`monitoring:${metrics.systemId}`).emit('metrics', metrics);
  });

  systems.analytics.on('analyticsEvent', (event: any) => {
    io.emit('analytics:event', event);
  });
}

// API Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.use('/api/auth', require('./packages/auth/src/routes').default);

// Diagnostics routes
app.use('/api/diagnostics', require('./packages/diagnostics/src/api').default);

// Remediation routes
app.use('/api/remediation', require('./packages/remediation/src/api').default);

// Monitoring routes
app.use('/api/monitoring', require('./packages/monitoring/src/api').default);

// Workflow routes
app.use('/api/workflows', require('./packages/workflow/src/api').default);

// Analytics routes
app.use('/api/analytics', (req: Request, res: Response, next: NextFunction) => {
  const analytics = req.app.locals.systems.analytics;
  return analytics.getAPIRouter()(req, res, next);
});

// Integration routes
app.use('/api/integrations', require('./packages/integrations/src/api').default);

// Dashboard route (for web UI)
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
async function startServer() {
  try {
    // Initialize all systems
    await initializeSystems();

    const PORT = parseInt(process.env.PORT || '3000');
    const HOST = process.env.HOST || 'localhost';

    server.listen(PORT, HOST, () => {
      logger.info(`CM Diagnostics server running at http://${HOST}:${PORT}`);
      logger.info(`WebSocket server running at ws://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('Development mode enabled - additional logging active');
      }
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close all connections
  const systems = app.locals.systems;
  if (systems) {
    await systems.cache.disconnect();
    await systems.monitoring.stop();
    await systems.scheduler.stop();
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Export for testing
export { app, server };

// Start server if this is the main module
if (require.main === module) {
  startServer();
}