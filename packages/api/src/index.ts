import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { json } from 'body-parser';
import { PrismaClient } from '@prisma/client';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

// Import GraphQL schema and resolvers
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { createContext } from './graphql/context';

// Import REST routes
import authRoutes from './routes/auth';
import systemsRoutes from './routes/systems';
import diagnosticsRoutes from './routes/diagnostics';
import remediationRoutes from './routes/remediation';
import reportsRoutes from './routes/reports';

// Import middleware
import { authenticateWebSocket } from './middleware/auth';
import { graphqlLimiter, wsLimiter } from './middleware/rate-limit';

// Import services
import { DiagnosticsService } from './services/diagnostics-service';
import { ConnectionPool } from './services/connection-pool';

// Initialize services
const prisma = new PrismaClient();
const diagnostics = new DiagnosticsService();
const connectionPool = new ConnectionPool();

// Create Redis clients for pub/sub
const pubClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

const subClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

// Create pub/sub instance
const pubsub = new RedisPubSub({
  publisher: pubClient,
  subscriber: subClient
});

// Create Express app
const app = express();
const httpServer = createServer(app);

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date(),
    services: {
      database: prisma.$queryRaw`SELECT 1` ? 'connected' : 'disconnected',
      redis: pubClient.status === 'ready' ? 'connected' : 'disconnected'
    }
  });
});

// REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/systems', systemsRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/api/remediation', remediationRoutes);
app.use('/api/reports', reportsRoutes);

// Create GraphQL schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// Create WebSocket server for subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
  verifyClient: async (info, cb) => {
    try {
      const token = info.req.headers['authorization']?.split(' ')[1];
      if (!token) {
        cb(false, 401, 'Unauthorized');
        return;
      }

      const user = await authenticateWebSocket(token);
      (info.req as any).user = user;
      cb(true);
    } catch (error) {
      cb(false, 401, 'Unauthorized');
    }
  }
});

// WebSocket server cleanup
const serverCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      const user = (ctx.extra.request as any).user;
      return createContext({ user, pubsub, diagnostics, connectionPool });
    },
    onConnect: async (ctx) => {
      console.log('Client connected:', ctx.connectionParams);
    },
    onDisconnect: async (ctx) => {
      console.log('Client disconnected');
    }
  },
  wsServer
);

// Create Apollo Server
const apolloServer = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          }
        };
      }
    }
  ],
  formatError: (err) => {
    // Log errors for monitoring
    console.error('GraphQL Error:', err);
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && !err.extensions?.code) {
      return new Error('Internal server error');
    }
    
    return err;
  }
});

// Start server
async function startServer() {
  // Start Apollo Server
  await apolloServer.start();

  // Apply GraphQL middleware
  app.use(
    '/graphql',
    graphqlLimiter,
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const token = req.headers.authorization?.split(' ')[1];
        let user = null;

        if (token) {
          try {
            const jwt = require('jsonwebtoken');
            const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
            user = await prisma.user.findUnique({
              where: { id: payload.userId }
            });
          } catch (error) {
            // Invalid token, user remains null
          }
        }

        return createContext({ user, pubsub, diagnostics, connectionPool });
      }
    })
  );

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  });

  // Start HTTP server
  const PORT = process.env.PORT || 4000;
  
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`🚀 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`🚀 WebSocket endpoint: ws://localhost:${PORT}/graphql`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    
    // Close HTTP server
    httpServer.close(() => {
      console.log('HTTP server closed');
    });

    // Close Apollo Server
    await apolloServer.stop();

    // Close WebSocket server
    wsServer.close();

    // Close database connections
    await prisma.$disconnect();
    await connectionPool.closeAll();

    // Close Redis connections
    pubClient.disconnect();
    subClient.disconnect();

    process.exit(0);
  });
}

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});