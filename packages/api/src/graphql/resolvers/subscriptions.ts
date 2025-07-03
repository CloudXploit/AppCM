import { withFilter } from 'graphql-subscriptions';
import { GraphQLError } from 'graphql';
import { Context } from '../context';
import { requireAuth } from './auth';

export const subscriptionResolvers = {
  Subscription: {
    scanProgress: {
      subscribe: withFilter(
        (_: any, args: { scanId: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator(`SCAN_PROGRESS_${args.scanId}`);
        },
        async (payload, args, context) => {
          // Verify user owns the scan
          const scan = await context.prisma.diagnosticScan.findUnique({
            where: { id: args.scanId }
          });

          if (!scan) return false;

          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: scan.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    },

    scanCompleted: {
      subscribe: withFilter(
        (_: any, args: { systemId?: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator('SCAN_COMPLETED');
        },
        async (payload, args, context) => {
          // Filter by systemId if provided
          if (args.systemId && payload.scan.systemId !== args.systemId) {
            return false;
          }

          // Verify user owns the system
          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: payload.scan.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    },

    newFindings: {
      subscribe: withFilter(
        (_: any, args: { systemId?: string; severity?: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator('NEW_FINDINGS');
        },
        async (payload, args, context) => {
          // Filter by systemId if provided
          if (args.systemId && payload.finding.systemId !== args.systemId) {
            return false;
          }

          // Filter by severity if provided
          if (args.severity && payload.finding.severity !== args.severity) {
            return false;
          }

          // Verify user owns the system
          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: payload.finding.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    },

    remediationUpdates: {
      subscribe: withFilter(
        (_: any, args: { findingId?: string; systemId?: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator('REMEDIATION_UPDATES');
        },
        async (payload, args, context) => {
          // Filter by findingId if provided
          if (args.findingId && payload.attempt.findingId !== args.findingId) {
            return false;
          }

          // Get finding to check systemId
          const finding = await context.prisma.diagnosticFinding.findUnique({
            where: { id: payload.attempt.findingId }
          });

          if (!finding) return false;

          // Filter by systemId if provided
          if (args.systemId && finding.systemId !== args.systemId) {
            return false;
          }

          // Verify user owns the system
          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: finding.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    },

    systemHealthChanged: {
      subscribe: withFilter(
        (_: any, args: { systemId?: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator('SYSTEM_HEALTH_CHANGED');
        },
        async (payload, args, context) => {
          // Filter by systemId if provided
          if (args.systemId && payload.systemId !== args.systemId) {
            return false;
          }

          // Verify user owns the system
          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: payload.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    },

    systemConnectionChanged: {
      subscribe: withFilter(
        (_: any, args: { systemId: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator(`SYSTEM_CONNECTION_${args.systemId}`);
        },
        async (payload, args, context) => {
          // Verify user owns the system
          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: args.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    },

    alerts: {
      subscribe: withFilter(
        (_: any, args: { systemId?: string; severity?: string; category?: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator('ALERTS');
        },
        async (payload, args, context) => {
          // Filter by systemId if provided
          if (args.systemId && payload.alert.systemId !== args.systemId) {
            return false;
          }

          // Filter by severity if provided
          if (args.severity && payload.alert.severity !== args.severity) {
            return false;
          }

          // Filter by category if provided
          if (args.category && payload.alert.category !== args.category) {
            return false;
          }

          // Verify user owns the system
          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: payload.alert.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    },

    reportGenerated: {
      subscribe: withFilter(
        (_: any, args: { systemId?: string }, context: Context) => {
          requireAuth(context);
          return context.pubsub.asyncIterator('REPORT_GENERATED');
        },
        async (payload, args, context) => {
          // Filter by systemId if provided
          if (args.systemId && payload.report.systemId !== args.systemId) {
            return false;
          }

          // Verify user owns the system
          const system = await context.prisma.cMSystem.findFirst({
            where: { 
              id: payload.report.systemId,
              userId: context.user!.id
            }
          });

          return !!system;
        }
      )
    }
  }
};

// Helper function to publish scan progress updates
export function publishScanProgress(
  pubsub: any,
  scan: {
    id: string;
    progress: number;
    status: string;
    currentStep?: string;
  }
) {
  pubsub.publish(`SCAN_PROGRESS_${scan.id}`, { scanProgress: scan });
}

// Helper function to publish scan completion
export function publishScanCompleted(
  pubsub: any,
  scan: any
) {
  pubsub.publish('SCAN_COMPLETED', { scanCompleted: scan });
}

// Helper function to publish new findings
export function publishNewFindings(
  pubsub: any,
  findings: any[]
) {
  findings.forEach(finding => {
    pubsub.publish('NEW_FINDINGS', { newFindings: finding });
  });
}

// Helper function to publish remediation updates
export function publishRemediationUpdate(
  pubsub: any,
  attempt: any
) {
  pubsub.publish('REMEDIATION_UPDATES', { remediationUpdates: attempt });
}

// Helper function to publish system health changes
export function publishSystemHealthChanged(
  pubsub: any,
  systemId: string,
  health: any
) {
  pubsub.publish('SYSTEM_HEALTH_CHANGED', { 
    systemHealthChanged: {
      systemId,
      health,
      timestamp: new Date()
    }
  });
}

// Helper function to publish system connection changes
export function publishSystemConnectionChanged(
  pubsub: any,
  systemId: string,
  connection: any
) {
  pubsub.publish(`SYSTEM_CONNECTION_${systemId}`, { 
    systemConnectionChanged: {
      systemId,
      connection,
      timestamp: new Date()
    }
  });
}

// Helper function to publish alerts
export function publishAlert(
  pubsub: any,
  alert: {
    id: string;
    systemId: string;
    severity: string;
    category: string;
    title: string;
    message: string;
    timestamp: Date;
  }
) {
  pubsub.publish('ALERTS', { alerts: alert });
}

// Helper function to publish report generation
export function publishReportGenerated(
  pubsub: any,
  report: any
) {
  pubsub.publish('REPORT_GENERATED', { reportGenerated: report });
}