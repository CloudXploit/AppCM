import { GraphQLError } from 'graphql';
import { Context } from '../context';
import { requireAuth } from './auth';
import { CMConnectionFactory, CMVersionDetector } from '@cm-diagnostics/cm-connector';
import { CredentialManager } from '@cm-diagnostics/cm-connector';

const credentialManager = new CredentialManager();

export const systemResolvers = {
  Query: {
    systems: async (_: any, __: any, context: Context) => {
      requireAuth(context);

      const systems = await context.prisma.cMSystem.findMany({
        where: { userId: context.user!.id },
        orderBy: { createdAt: 'desc' }
      });

      // Decrypt connection configs
      return systems.map(system => ({
        ...system,
        connectionConfig: credentialManager.decryptConfig(system.connectionConfig as any)
      }));
    },

    system: async (_: any, args: { id: string }, context: Context) => {
      requireAuth(context);

      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: args.id,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('System not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      return {
        ...system,
        connectionConfig: credentialManager.decryptConfig(system.connectionConfig as any)
      };
    },

    testConnection: async (_: any, args: { config: any }, context: Context) => {
      requireAuth(context);

      try {
        const connector = await CMConnectionFactory.createConnector(args.config);
        await connector.connect();
        
        const isConnected = connector.isConnected();
        const health = await connector.healthCheck();
        
        await connector.disconnect();

        return {
          connected: isConnected,
          lastError: null,
          latency: health.responseTime || 0
        };
      } catch (error) {
        return {
          connected: false,
          lastError: (error as Error).message,
          latency: null
        };
      }
    }
  },

  Mutation: {
    addSystem: async (
      _: any, 
      args: { name: string; config: any }, 
      context: Context
    ) => {
      requireAuth(context);

      try {
        // Test connection first
        const connector = await CMConnectionFactory.createConnector(args.config);
        await connector.connect();
        
        // Detect version
        const systemInfo = await CMVersionDetector.detectVersion(connector);
        
        await connector.disconnect();

        // Encrypt sensitive config
        const encryptedConfig = credentialManager.encryptConfig(args.config);

        // Create system record
        const system = await context.prisma.cMSystem.create({
          data: {
            name: args.name,
            version: systemInfo.version,
            edition: systemInfo.edition || 'Unknown',
            connectionConfig: encryptedConfig as any,
            userId: context.user!.id,
            lastConnected: new Date()
          }
        });

        return {
          ...system,
          database: {
            type: args.config.databaseType || 'SQLSERVER',
            version: systemInfo.databaseVersion || 'Unknown',
            name: args.config.database || 'Unknown',
            server: args.config.host || 'Unknown'
          },
          features: systemInfo.features || [],
          modules: systemInfo.modules || [],
          health: {
            status: 'healthy',
            lastCheck: new Date(),
            issues: 0,
            score: 100
          },
          connection: {
            connected: true,
            lastError: null,
            latency: 0
          }
        };
      } catch (error) {
        throw new GraphQLError(`Failed to add system: ${(error as Error).message}`, {
          extensions: { code: 'SYSTEM_ADD_FAILED' }
        });
      }
    },

    updateSystem: async (
      _: any,
      args: { id: string; name?: string; config?: any },
      context: Context
    ) => {
      requireAuth(context);

      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: args.id,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('System not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      const updateData: any = {};
      
      if (args.name) {
        updateData.name = args.name;
      }

      if (args.config) {
        // Test new connection
        const connector = await CMConnectionFactory.createConnector(args.config);
        await connector.connect();
        await connector.disconnect();

        updateData.connectionConfig = credentialManager.encryptConfig(args.config);
      }

      const updatedSystem = await context.prisma.cMSystem.update({
        where: { id: args.id },
        data: updateData
      });

      return {
        ...updatedSystem,
        connectionConfig: credentialManager.decryptConfig(updatedSystem.connectionConfig as any)
      };
    },

    removeSystem: async (
      _: any,
      args: { id: string },
      context: Context
    ) => {
      requireAuth(context);

      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: args.id,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('System not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Delete related data
      await context.prisma.diagnosticFinding.deleteMany({
        where: { systemId: args.id }
      });

      await context.prisma.diagnosticScan.deleteMany({
        where: { systemId: args.id }
      });

      await context.prisma.cMSystem.delete({
        where: { id: args.id }
      });

      return true;
    }
  },

  CMSystem: {
    health: async (parent: any, _: any, context: Context) => {
      // Get latest health check
      const latestScan = await context.prisma.diagnosticScan.findFirst({
        where: { 
          systemId: parent.id,
          status: 'COMPLETED'
        },
        orderBy: { completedAt: 'desc' }
      });

      if (!latestScan) {
        return {
          status: 'unknown',
          lastCheck: parent.lastConnected || new Date(),
          issues: 0,
          score: 100
        };
      }

      const criticalCount = await context.prisma.diagnosticFinding.count({
        where: {
          systemId: parent.id,
          severity: 'CRITICAL',
          resolved: false
        }
      });

      const highCount = await context.prisma.diagnosticFinding.count({
        where: {
          systemId: parent.id,
          severity: 'HIGH',
          resolved: false
        }
      });

      const totalIssues = criticalCount + highCount;
      
      // Calculate health score (0-100)
      const score = Math.max(0, 100 - (criticalCount * 20) - (highCount * 10));

      let status = 'healthy';
      if (criticalCount > 0) status = 'critical';
      else if (highCount > 2) status = 'warning';
      else if (totalIssues > 5) status = 'degraded';

      return {
        status,
        lastCheck: latestScan.completedAt || new Date(),
        issues: totalIssues,
        score
      };
    },

    connection: async (parent: any, _: any, context: Context) => {
      // Check current connection status
      try {
        const config = credentialManager.decryptConfig(parent.connectionConfig);
        const connector = await context.connectionPool.acquire(parent.id, config);
        const isConnected = connector.isConnected();
        context.connectionPool.release(connector, parent.id);

        return {
          connected: isConnected,
          lastError: null,
          latency: 0
        };
      } catch (error) {
        return {
          connected: false,
          lastError: (error as Error).message,
          latency: null
        };
      }
    },

    database: (parent: any) => {
      const config = credentialManager.decryptConfig(parent.connectionConfig);
      return {
        type: config.databaseType || 'SQLSERVER',
        version: parent.databaseVersion || 'Unknown',
        name: config.database || 'Unknown',
        server: config.host || 'Unknown'
      };
    },

    features: (parent: any) => {
      return parent.features || [];
    },

    modules: (parent: any) => {
      return parent.modules || [];
    }
  }
};