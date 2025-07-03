import { GraphQLError } from 'graphql';
import { Context } from '../context';
import { requireAuth } from './auth';
import { CredentialManager } from '@cm-diagnostics/cm-connector';
import { 
  publishScanProgress, 
  publishScanCompleted, 
  publishNewFindings 
} from './subscriptions';

const credentialManager = new CredentialManager();

export const diagnosticResolvers = {
  Query: {
    scans: async (
      _: any,
      args: { systemId?: string; status?: string; pagination?: any },
      context: Context
    ) => {
      requireAuth(context);

      const where: any = {};
      
      if (args.systemId) {
        // Verify user owns this system
        const system = await context.prisma.cMSystem.findFirst({
          where: { 
            id: args.systemId,
            userId: context.user!.id
          }
        });
        
        if (!system) {
          throw new GraphQLError('System not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }
        
        where.systemId = args.systemId;
      } else {
        // Get all systems for user
        const systems = await context.prisma.cMSystem.findMany({
          where: { userId: context.user!.id },
          select: { id: true }
        });
        
        where.systemId = { in: systems.map(s => s.id) };
      }

      if (args.status) {
        where.status = args.status;
      }

      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = args.pagination || {};
      
      const scans = await context.prisma.diagnosticScan.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          findings: true
        }
      });

      return scans.map(scan => ({
        ...scan,
        findingsCount: {
          total: scan.findings.length,
          bySeverity: {
            low: scan.findings.filter(f => f.severity === 'LOW').length,
            medium: scan.findings.filter(f => f.severity === 'MEDIUM').length,
            high: scan.findings.filter(f => f.severity === 'HIGH').length,
            critical: scan.findings.filter(f => f.severity === 'CRITICAL').length
          },
          byCategory: {
            performance: scan.findings.filter(f => f.category === 'PERFORMANCE').length,
            security: scan.findings.filter(f => f.category === 'SECURITY').length,
            configuration: scan.findings.filter(f => f.category === 'CONFIGURATION').length,
            dataIntegrity: scan.findings.filter(f => f.category === 'DATA_INTEGRITY').length,
            compliance: scan.findings.filter(f => f.category === 'COMPLIANCE').length,
            availability: scan.findings.filter(f => f.category === 'AVAILABILITY').length,
            compatibility: scan.findings.filter(f => f.category === 'COMPATIBILITY').length
          }
        }
      }));
    },

    scan: async (_: any, args: { id: string }, context: Context) => {
      requireAuth(context);

      const scan = await context.loaders.scans.load(args.id);
      
      if (!scan) {
        throw new GraphQLError('Scan not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: scan.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return scan;
    },

    findings: async (
      _: any,
      args: {
        scanId?: string;
        systemId?: string;
        severity?: string;
        category?: string;
        resolved?: boolean;
        pagination?: any;
      },
      context: Context
    ) => {
      requireAuth(context);

      const where: any = {};

      if (args.scanId) {
        where.scanId = args.scanId;
      }

      if (args.systemId) {
        // Verify user owns this system
        const system = await context.prisma.cMSystem.findFirst({
          where: { 
            id: args.systemId,
            userId: context.user!.id
          }
        });
        
        if (!system) {
          throw new GraphQLError('System not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }
        
        where.systemId = args.systemId;
      }

      if (args.severity) {
        where.severity = args.severity;
      }

      if (args.category) {
        where.category = args.category;
      }

      if (args.resolved !== undefined) {
        where.resolved = args.resolved;
      }

      const { page = 1, limit = 20, sortBy = 'detectedAt', sortOrder = 'desc' } = args.pagination || {};

      const findings = await context.prisma.diagnosticFinding.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          remediationHistory: true
        }
      });

      return findings;
    },

    finding: async (_: any, args: { id: string }, context: Context) => {
      requireAuth(context);

      const finding = await context.loaders.findings.load(args.id);
      
      if (!finding) {
        throw new GraphQLError('Finding not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: finding.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return finding;
    },

    rules: async (
      _: any,
      args: { category?: string; enabled?: boolean },
      context: Context
    ) => {
      requireAuth(context);

      const rules = context.diagnostics.getDiagnosticEngine().getRules();
      
      let filteredRules = rules;
      
      if (args.category) {
        filteredRules = filteredRules.filter(r => r.category === args.category.toLowerCase());
      }
      
      if (args.enabled !== undefined) {
        filteredRules = filteredRules.filter(r => r.enabled === args.enabled);
      }

      return filteredRules;
    },

    rule: async (_: any, args: { id: string }, context: Context) => {
      requireAuth(context);

      const rules = context.diagnostics.getDiagnosticEngine().getRules();
      const rule = rules.find(r => r.id === args.id);
      
      if (!rule) {
        throw new GraphQLError('Rule not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      return rule;
    }
  },

  Mutation: {
    createScan: async (
      _: any,
      args: { systemId: string; options: any },
      context: Context
    ) => {
      requireAuth(context);

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: args.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('System not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      try {
        // Get connector from pool
        const config = credentialManager.decryptConfig(system.connectionConfig as any);
        const connector = await context.connectionPool.acquire(system.id, config);

        // Create scan using diagnostic engine
        const engineScan = await context.diagnostics.runDiagnostics(args.systemId, {
          name: args.options.name,
          rules: args.options.rules,
          categories: args.options.categories?.map((c: string) => c.toLowerCase()),
          connector
        });

        // Save scan to database
        const dbScan = await context.prisma.diagnosticScan.create({
          data: {
            id: engineScan.id,
            name: engineScan.name,
            systemId: args.systemId,
            status: engineScan.status,
            progress: engineScan.progress,
            rules: engineScan.rules,
            categories: args.options.categories || [],
            triggeredBy: context.user!.username,
            triggerType: 'MANUAL'
          }
        });

        // Listen for scan progress updates
        context.diagnostics.getDiagnosticEngine().on('scan:progress', (progress) => {
          if (progress.scanId === engineScan.id) {
            publishScanProgress(context.pubsub, {
              id: progress.scanId,
              progress: progress.progress,
              status: progress.status,
              currentStep: progress.currentStep
            });
          }
        });

        // Listen for scan completion to save findings
        context.diagnostics.getDiagnosticEngine().once('scan:completed', async (completedScan) => {
          if (completedScan.id === engineScan.id) {
            // Save findings to database
            const savedFindings = [];
            for (const finding of completedScan.findings) {
              const savedFinding = await context.prisma.diagnosticFinding.create({
                data: {
                  id: finding.id,
                  scanId: completedScan.id,
                  systemId: args.systemId,
                  ruleId: finding.ruleId,
                  ruleName: finding.ruleName,
                  category: finding.category.toUpperCase() as any,
                  severity: finding.severity.toUpperCase() as any,
                  title: finding.title,
                  description: finding.description,
                  impact: finding.impact,
                  recommendation: finding.recommendation,
                  component: finding.component,
                  resourcePath: finding.resourcePath,
                  evidence: finding.evidence as any,
                  detectedAt: finding.detectedAt,
                  lastSeenAt: finding.lastSeenAt,
                  occurrenceCount: finding.occurrenceCount,
                  remediable: finding.remediable,
                  remediationActions: finding.remediationActions as any,
                  acknowledged: false,
                  resolved: false,
                  falsePositive: false
                }
              });
              savedFindings.push(savedFinding);
            }

            // Update scan status
            const updatedScan = await context.prisma.diagnosticScan.update({
              where: { id: completedScan.id },
              data: {
                status: 'COMPLETED',
                progress: 100,
                completedAt: completedScan.completedAt,
                duration: completedScan.duration
              }
            });

            // Publish events
            publishScanCompleted(context.pubsub, updatedScan);
            publishNewFindings(context.pubsub, savedFindings);

            // Release connector
            context.connectionPool.release(connector, system.id);
          }
        });

        return dbScan;
      } catch (error) {
        throw new GraphQLError(`Failed to create scan: ${(error as Error).message}`, {
          extensions: { code: 'SCAN_FAILED' }
        });
      }
    },

    cancelScan: async (_: any, args: { id: string }, context: Context) => {
      requireAuth(context);

      const scan = await context.prisma.diagnosticScan.findUnique({
        where: { id: args.id }
      });

      if (!scan) {
        throw new GraphQLError('Scan not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: scan.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      // Cancel in engine
      await context.diagnostics.getDiagnosticEngine().cancelScan(args.id);

      // Update database
      const updatedScan = await context.prisma.diagnosticScan.update({
        where: { id: args.id },
        data: { 
          status: 'CANCELLED',
          completedAt: new Date()
        }
      });

      return updatedScan;
    },

    acknowledgeFinding: async (
      _: any,
      args: { id: string; comment?: string },
      context: Context
    ) => {
      requireAuth(context);

      const finding = await context.prisma.diagnosticFinding.findUnique({
        where: { id: args.id }
      });

      if (!finding) {
        throw new GraphQLError('Finding not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: finding.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const updatedFinding = await context.prisma.diagnosticFinding.update({
        where: { id: args.id },
        data: {
          acknowledged: true,
          acknowledgedBy: context.user!.username,
          acknowledgedAt: new Date()
        }
      });

      return updatedFinding;
    },

    markFindingResolved: async (
      _: any,
      args: { id: string; comment?: string },
      context: Context
    ) => {
      requireAuth(context);

      const finding = await context.prisma.diagnosticFinding.findUnique({
        where: { id: args.id }
      });

      if (!finding) {
        throw new GraphQLError('Finding not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: finding.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const updatedFinding = await context.prisma.diagnosticFinding.update({
        where: { id: args.id },
        data: {
          resolved: true,
          resolvedBy: context.user!.username,
          resolvedAt: new Date()
        }
      });

      return updatedFinding;
    },

    markFindingFalsePositive: async (
      _: any,
      args: { id: string; reason: string },
      context: Context
    ) => {
      requireAuth(context);

      const finding = await context.prisma.diagnosticFinding.findUnique({
        where: { id: args.id }
      });

      if (!finding) {
        throw new GraphQLError('Finding not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: finding.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const updatedFinding = await context.prisma.diagnosticFinding.update({
        where: { id: args.id },
        data: {
          falsePositive: true,
          resolved: true,
          resolvedBy: context.user!.username,
          resolvedAt: new Date()
        }
      });

      return updatedFinding;
    },

    updateRule: async (
      _: any,
      args: { id: string; enabled?: boolean; config?: any },
      context: Context
    ) => {
      requireAuth(context);

      const engine = context.diagnostics.getDiagnosticEngine();
      
      if (args.enabled !== undefined) {
        engine.setRuleEnabled(args.id, args.enabled);
      }
      
      if (args.config) {
        engine.updateRuleConfig(args.id, args.config);
      }

      const rules = engine.getRules();
      const rule = rules.find(r => r.id === args.id);
      
      if (!rule) {
        throw new GraphQLError('Rule not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      return rule;
    }
  },

  DiagnosticScan: {
    system: async (parent: any, _: any, context: Context) => {
      return context.loaders.systems.load(parent.systemId);
    },

    findings: async (parent: any, _: any, context: Context) => {
      return context.prisma.diagnosticFinding.findMany({
        where: { scanId: parent.id },
        orderBy: { severity: 'desc' }
      });
    }
  },

  DiagnosticFinding: {
    remediationHistory: async (parent: any, _: any, context: Context) => {
      return context.prisma.remediationAttempt.findMany({
        where: { findingId: parent.id },
        orderBy: { startedAt: 'desc' }
      });
    }
  }
};