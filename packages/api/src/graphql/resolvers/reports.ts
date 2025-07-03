import { GraphQLError } from 'graphql';
import { Context } from '../context';
import { requireAuth } from './auth';

export const reportResolvers = {
  Query: {
    reports: async (
      _: any,
      args: { systemId: string; dateRange?: { start: Date; end: Date } },
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

      const where: any = { systemId: args.systemId };

      if (args.dateRange) {
        where.generatedAt = {
          gte: args.dateRange.start,
          lte: args.dateRange.end
        };
      }

      const reports = await context.prisma.diagnosticReport.findMany({
        where,
        orderBy: { generatedAt: 'desc' }
      });

      return reports;
    },

    report: async (_: any, args: { id: string }, context: Context) => {
      requireAuth(context);

      const report = await context.prisma.diagnosticReport.findUnique({
        where: { id: args.id }
      });

      if (!report) {
        throw new GraphQLError('Report not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: report.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return report;
    },

    generateReport: async (
      _: any,
      args: { scanId: string },
      context: Context
    ) => {
      requireAuth(context);

      // Get scan
      const scan = await context.prisma.diagnosticScan.findUnique({
        where: { id: args.scanId },
        include: { findings: true }
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

      if (scan.status !== 'COMPLETED') {
        throw new GraphQLError('Scan is not completed', {
          extensions: { code: 'INVALID_STATUS' }
        });
      }

      // Generate report summary
      const summary = {
        totalFindings: scan.findings.length,
        criticalFindings: scan.findings.filter(f => f.severity === 'CRITICAL').length,
        highFindings: scan.findings.filter(f => f.severity === 'HIGH').length,
        mediumFindings: scan.findings.filter(f => f.severity === 'MEDIUM').length,
        lowFindings: scan.findings.filter(f => f.severity === 'LOW').length,
        remediatedFindings: scan.findings.filter(f => f.resolved).length,
        healthScore: calculateHealthScore(scan.findings)
      };

      // Generate trends
      const trends = await generateTrends(context, scan.systemId);

      // Generate recommendations
      const recommendations = generateRecommendations(scan.findings);

      // Create report
      const report = await context.prisma.diagnosticReport.create({
        data: {
          scanId: scan.id,
          systemId: scan.systemId,
          generatedAt: new Date(),
          summary: summary as any,
          trends: trends as any,
          recommendations: recommendations as any
        }
      });

      return report;
    },

    statistics: async (
      _: any,
      args: { systemId?: string; dateRange?: { start: Date; end: Date } },
      context: Context
    ) => {
      requireAuth(context);

      let systemIds: string[] = [];

      if (args.systemId) {
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

        systemIds = [args.systemId];
      } else {
        // Get all user's systems
        const systems = await context.prisma.cMSystem.findMany({
          where: { userId: context.user!.id },
          select: { id: true }
        });
        systemIds = systems.map(s => s.id);
      }

      const where: any = { systemId: { in: systemIds } };
      
      if (args.dateRange) {
        where.createdAt = {
          gte: args.dateRange.start,
          lte: args.dateRange.end
        };
      }

      // Get statistics
      const totalScans = await context.prisma.diagnosticScan.count({ where });
      const totalFindings = await context.prisma.diagnosticFinding.count({ where });
      const totalRemediations = await context.prisma.remediationAttempt.count({
        where: {
          finding: { systemId: { in: systemIds } },
          success: true
        }
      });

      // Calculate average scan duration
      const scans = await context.prisma.diagnosticScan.findMany({
        where: { ...where, status: 'COMPLETED', duration: { not: null } },
        select: { duration: true }
      });
      
      const averageScanDuration = scans.length > 0
        ? scans.reduce((sum, s) => sum + (s.duration || 0), 0) / scans.length
        : 0;

      // Get health score trend
      const healthScoreTrend = await getHealthScoreTrend(context, systemIds, args.dateRange);

      // Get top findings
      const topFindings = await getTopFindings(context, systemIds, args.dateRange);

      return {
        totalScans,
        totalFindings,
        totalRemediations,
        averageScanDuration,
        healthScoreTrend,
        topFindings
      };
    }
  },

  DiagnosticReport: {
    findings: async (parent: any, _: any, context: Context) => {
      return context.prisma.diagnosticFinding.findMany({
        where: { scanId: parent.scanId },
        orderBy: { severity: 'desc' }
      });
    }
  }
};

// Helper functions
function calculateHealthScore(findings: any[]): number {
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL' && !f.resolved).length;
  const highCount = findings.filter(f => f.severity === 'HIGH' && !f.resolved).length;
  const mediumCount = findings.filter(f => f.severity === 'MEDIUM' && !f.resolved).length;
  const lowCount = findings.filter(f => f.severity === 'LOW' && !f.resolved).length;

  // Calculate score (0-100)
  let score = 100;
  score -= criticalCount * 20;
  score -= highCount * 10;
  score -= mediumCount * 5;
  score -= lowCount * 2;

  return Math.max(0, score);
}

async function generateTrends(context: Context, systemId: string): Promise<any> {
  // Get findings over last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const findings = await context.prisma.diagnosticFinding.findMany({
    where: {
      systemId,
      detectedAt: { gte: thirtyDaysAgo }
    },
    select: {
      detectedAt: true,
      severity: true,
      category: true,
      ruleId: true,
      ruleName: true
    }
  });

  // Group by date
  const findingsByDate = new Map<string, number>();
  findings.forEach(f => {
    const date = f.detectedAt.toISOString().split('T')[0];
    findingsByDate.set(date, (findingsByDate.get(date) || 0) + 1);
  });

  // Count by severity
  const severityCount: any = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };
  findings.forEach(f => {
    severityCount[f.severity]++;
  });

  // Count by category
  const categoryCount: any = {
    PERFORMANCE: 0,
    SECURITY: 0,
    CONFIGURATION: 0,
    DATA_INTEGRITY: 0,
    COMPLIANCE: 0,
    AVAILABILITY: 0,
    COMPATIBILITY: 0
  };
  findings.forEach(f => {
    categoryCount[f.category]++;
  });

  // Top issues
  const issueCount = new Map<string, { count: number; name: string }>();
  findings.forEach(f => {
    const current = issueCount.get(f.ruleId) || { count: 0, name: f.ruleName };
    current.count++;
    issueCount.set(f.ruleId, current);
  });

  const topIssues = Array.from(issueCount.entries())
    .map(([ruleId, data]) => ({
      ruleId,
      ruleName: data.name,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    findingsOverTime: Array.from(findingsByDate.entries()).map(([date, count]) => ({
      date: new Date(date),
      value: count
    })),
    severityDistribution: severityCount,
    categoryDistribution: categoryCount,
    topIssues
  };
}

function generateRecommendations(findings: any[]): any[] {
  const recommendations: any[] = [];

  // Critical findings recommendation
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL' && !f.resolved).length;
  if (criticalCount > 0) {
    recommendations.push({
      priority: 1,
      title: 'Address Critical Issues',
      description: `You have ${criticalCount} critical issues that require immediate attention`,
      impact: 'Critical issues can cause system failures and security vulnerabilities',
      effort: 'high'
    });
  }

  // Security findings recommendation
  const securityCount = findings.filter(f => f.category === 'SECURITY' && !f.resolved).length;
  if (securityCount > 3) {
    recommendations.push({
      priority: 2,
      title: 'Improve Security Posture',
      description: `${securityCount} security issues detected. Consider a security audit.`,
      impact: 'Reduces risk of data breaches and unauthorized access',
      effort: 'medium'
    });
  }

  // Performance findings recommendation
  const performanceCount = findings.filter(f => f.category === 'PERFORMANCE' && !f.resolved).length;
  if (performanceCount > 5) {
    recommendations.push({
      priority: 3,
      title: 'Optimize System Performance',
      description: `${performanceCount} performance issues are affecting system efficiency`,
      impact: 'Improved user experience and reduced resource costs',
      effort: 'medium'
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}

async function getHealthScoreTrend(
  context: Context,
  systemIds: string[],
  dateRange?: { start: Date; end: Date }
): Promise<any[]> {
  // Get completed scans
  const where: any = {
    systemId: { in: systemIds },
    status: 'COMPLETED'
  };

  if (dateRange) {
    where.completedAt = {
      gte: dateRange.start,
      lte: dateRange.end
    };
  }

  const scans = await context.prisma.diagnosticScan.findMany({
    where,
    orderBy: { completedAt: 'asc' },
    include: { findings: true }
  });

  return scans.map(scan => ({
    date: scan.completedAt,
    value: calculateHealthScore(scan.findings)
  }));
}

async function getTopFindings(
  context: Context,
  systemIds: string[],
  dateRange?: { start: Date; end: Date }
): Promise<any[]> {
  const where: any = {
    systemId: { in: systemIds },
    resolved: false
  };

  if (dateRange) {
    where.detectedAt = {
      gte: dateRange.start,
      lte: dateRange.end
    };
  }

  const findings = await context.prisma.diagnosticFinding.findMany({
    where,
    select: {
      ruleId: true,
      ruleName: true
    }
  });

  // Count occurrences
  const ruleCount = new Map<string, { count: number; name: string }>();
  findings.forEach(f => {
    const current = ruleCount.get(f.ruleId) || { count: 0, name: f.ruleName };
    current.count++;
    ruleCount.set(f.ruleId, current);
  });

  return Array.from(ruleCount.entries())
    .map(([ruleId, data]) => ({
      ruleId,
      ruleName: data.name,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}