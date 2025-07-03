import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { apiLimiter, reportLimiter } from '../middleware/rate-limit';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const dateRangeSchema = z.object({
  start: z.string().transform(str => new Date(str)),
  end: z.string().transform(str => new Date(str))
}).optional();

const generateReportSchema = z.object({
  format: z.enum(['JSON', 'PDF', 'EXCEL']).default('JSON'),
  includeFindings: z.boolean().default(true),
  includeRemediation: z.boolean().default(true),
  includeTrends: z.boolean().default(true)
});

// Get reports for a system
router.get('/systems/:systemId/reports', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const dateRange = dateRangeSchema.parse({
      start: req.query.startDate as string,
      end: req.query.endDate as string
    });

    // Verify user owns the system
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: req.params.systemId,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    const where: any = { systemId: req.params.systemId };

    if (dateRange) {
      where.generatedAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    const reports = await prisma.diagnosticReport.findMany({
      where,
      orderBy: { generatedAt: 'desc' }
    });

    res.json(reports);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific report
router.get('/reports/:id', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const report = await prisma.diagnosticReport.findUnique({
      where: { id: req.params.id }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Verify user owns the system
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: report.systemId,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get findings if requested
    const includeFindings = req.query.includeFindings === 'true';
    
    if (includeFindings) {
      const findings = await prisma.diagnosticFinding.findMany({
        where: { scanId: report.scanId },
        orderBy: { severity: 'desc' }
      });

      return res.json({
        ...report,
        findings
      });
    }

    res.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate report from scan
router.post('/scans/:scanId/generate-report', reportLimiter, async (req: AuthRequest, res) => {
  try {
    const options = generateReportSchema.parse(req.body);

    // Get scan
    const scan = await prisma.diagnosticScan.findUnique({
      where: { id: req.params.scanId },
      include: { findings: true }
    });

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Verify user owns the system
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: scan.systemId,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (scan.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Scan is not completed' });
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

    // Generate trends if requested
    let trends = {};
    if (options.includeTrends) {
      trends = await generateTrends(scan.systemId);
    }

    // Generate recommendations
    const recommendations = generateRecommendations(scan.findings);

    // Create report in database
    const report = await prisma.diagnosticReport.create({
      data: {
        scanId: scan.id,
        systemId: scan.systemId,
        generatedAt: new Date(),
        summary: summary as any,
        trends: trends as any,
        recommendations: recommendations as any
      }
    });

    // Return report based on format
    switch (options.format) {
      case 'PDF':
        await generatePDFReport(res, system, scan, report, options);
        break;
      
      case 'EXCEL':
        await generateExcelReport(res, system, scan, report, options);
        break;
      
      default:
        res.json({
          report,
          findings: options.includeFindings ? scan.findings : undefined,
          remediation: options.includeRemediation ? await getRemediationHistory(scan.findings.map(f => f.id)) : undefined
        });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get statistics
router.get('/statistics', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const { systemId } = req.query;
    const dateRange = dateRangeSchema.parse({
      start: req.query.startDate as string,
      end: req.query.endDate as string
    });

    let systemIds: string[] = [];

    if (systemId) {
      // Verify user owns the system
      const system = await prisma.cMSystem.findFirst({
        where: { 
          id: systemId as string,
          userId: req.user!.id
        }
      });

      if (!system) {
        return res.status(404).json({ error: 'System not found' });
      }

      systemIds = [systemId as string];
    } else {
      // Get all user's systems
      const systems = await prisma.cMSystem.findMany({
        where: { userId: req.user!.id },
        select: { id: true }
      });
      systemIds = systems.map(s => s.id);
    }

    const where: any = { systemId: { in: systemIds } };
    
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    // Get statistics
    const [
      totalScans,
      completedScans,
      totalFindings,
      unresolvedFindings,
      criticalFindings,
      totalRemediations,
      successfulRemediations
    ] = await Promise.all([
      prisma.diagnosticScan.count({ where }),
      prisma.diagnosticScan.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.diagnosticFinding.count({ where }),
      prisma.diagnosticFinding.count({ where: { ...where, resolved: false } }),
      prisma.diagnosticFinding.count({ where: { ...where, severity: 'CRITICAL', resolved: false } }),
      prisma.remediationAttempt.count({
        where: {
          finding: { systemId: { in: systemIds } }
        }
      }),
      prisma.remediationAttempt.count({
        where: {
          finding: { systemId: { in: systemIds } },
          success: true
        }
      })
    ]);

    // Calculate average scan duration
    const scans = await prisma.diagnosticScan.findMany({
      where: { ...where, status: 'COMPLETED', duration: { not: null } },
      select: { duration: true }
    });
    
    const averageScanDuration = scans.length > 0
      ? scans.reduce((sum, s) => sum + (s.duration || 0), 0) / scans.length
      : 0;

    // Get top findings
    const topFindings = await getTopFindings(systemIds, dateRange);

    // Get health score trend
    const healthScoreTrend = await getHealthScoreTrend(systemIds, dateRange);

    res.json({
      overview: {
        totalScans,
        completedScans,
        scanCompletionRate: totalScans > 0 ? (completedScans / totalScans) * 100 : 0,
        averageScanDuration: Math.round(averageScanDuration / 1000), // Convert to seconds
        totalFindings,
        unresolvedFindings,
        criticalFindings,
        resolutionRate: totalFindings > 0 ? ((totalFindings - unresolvedFindings) / totalFindings) * 100 : 100,
        totalRemediations,
        successfulRemediations,
        remediationSuccessRate: totalRemediations > 0 ? (successfulRemediations / totalRemediations) * 100 : 0
      },
      topFindings,
      healthScoreTrend
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
function calculateHealthScore(findings: any[]): number {
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL' && !f.resolved).length;
  const highCount = findings.filter(f => f.severity === 'HIGH' && !f.resolved).length;
  const mediumCount = findings.filter(f => f.severity === 'MEDIUM' && !f.resolved).length;
  const lowCount = findings.filter(f => f.severity === 'LOW' && !f.resolved).length;

  let score = 100;
  score -= criticalCount * 20;
  score -= highCount * 10;
  score -= mediumCount * 5;
  score -= lowCount * 2;

  return Math.max(0, score);
}

async function generateTrends(systemId: string): Promise<any> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const findings = await prisma.diagnosticFinding.findMany({
    where: {
      systemId,
      detectedAt: { gte: thirtyDaysAgo }
    },
    select: {
      detectedAt: true,
      severity: true,
      category: true
    }
  });

  const findingsByDate = new Map<string, number>();
  const severityCount: any = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };
  const categoryCount: any = {};

  findings.forEach(f => {
    const date = f.detectedAt.toISOString().split('T')[0];
    findingsByDate.set(date, (findingsByDate.get(date) || 0) + 1);
    severityCount[f.severity]++;
    categoryCount[f.category] = (categoryCount[f.category] || 0) + 1;
  });

  return {
    findingsOverTime: Array.from(findingsByDate.entries()).map(([date, count]) => ({
      date: new Date(date),
      value: count
    })),
    severityDistribution: severityCount,
    categoryDistribution: categoryCount
  };
}

function generateRecommendations(findings: any[]): any[] {
  const recommendations: any[] = [];
  
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

async function getRemediationHistory(findingIds: string[]) {
  return prisma.remediationAttempt.findMany({
    where: {
      findingId: { in: findingIds },
      success: true
    },
    orderBy: { completedAt: 'desc' }
  });
}

async function getTopFindings(systemIds: string[], dateRange?: any) {
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

  const findings = await prisma.diagnosticFinding.groupBy({
    by: ['ruleId', 'ruleName'],
    where,
    _count: { ruleId: true },
    orderBy: { _count: { ruleId: 'desc' } },
    take: 10
  });

  return findings.map(f => ({
    ruleId: f.ruleId,
    ruleName: f.ruleName,
    count: f._count.ruleId
  }));
}

async function getHealthScoreTrend(systemIds: string[], dateRange?: any) {
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

  const scans = await prisma.diagnosticScan.findMany({
    where,
    orderBy: { completedAt: 'asc' },
    include: { findings: true }
  });

  return scans.map(scan => ({
    date: scan.completedAt,
    value: calculateHealthScore(scan.findings)
  }));
}

async function generatePDFReport(res: any, system: any, scan: any, report: any, options: any) {
  const doc = new PDFDocument();
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.pdf"`);
  
  doc.pipe(res);

  // Title
  doc.fontSize(20).text('Content Manager Diagnostic Report', { align: 'center' });
  doc.moveDown();

  // System info
  doc.fontSize(14).text(`System: ${system.name}`);
  doc.fontSize(12).text(`Version: ${system.version}`);
  doc.text(`Scan Date: ${scan.completedAt?.toLocaleDateString()}`);
  doc.moveDown();

  // Summary
  doc.fontSize(16).text('Summary');
  doc.fontSize(12).text(`Total Findings: ${report.summary.totalFindings}`);
  doc.text(`Critical: ${report.summary.criticalFindings}`);
  doc.text(`High: ${report.summary.highFindings}`);
  doc.text(`Medium: ${report.summary.mediumFindings}`);
  doc.text(`Low: ${report.summary.lowFindings}`);
  doc.text(`Health Score: ${report.summary.healthScore}/100`);
  doc.moveDown();

  // Recommendations
  doc.fontSize(16).text('Recommendations');
  report.recommendations.forEach((rec: any) => {
    doc.fontSize(12).text(`${rec.priority}. ${rec.title}`);
    doc.fontSize(10).text(rec.description, { indent: 20 });
    doc.moveDown(0.5);
  });

  doc.end();
}

async function generateExcelReport(res: any, system: any, scan: any, report: any, options: any) {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ];

  summarySheet.addRows([
    { metric: 'System Name', value: system.name },
    { metric: 'System Version', value: system.version },
    { metric: 'Scan Date', value: scan.completedAt?.toLocaleDateString() },
    { metric: 'Total Findings', value: report.summary.totalFindings },
    { metric: 'Critical Findings', value: report.summary.criticalFindings },
    { metric: 'High Findings', value: report.summary.highFindings },
    { metric: 'Medium Findings', value: report.summary.mediumFindings },
    { metric: 'Low Findings', value: report.summary.lowFindings },
    { metric: 'Health Score', value: `${report.summary.healthScore}/100` }
  ]);

  // Findings sheet
  if (options.includeFindings) {
    const findingsSheet = workbook.addWorksheet('Findings');
    findingsSheet.columns = [
      { header: 'Severity', key: 'severity', width: 15 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Component', key: 'component', width: 20 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    scan.findings.forEach((finding: any) => {
      findingsSheet.addRow({
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        component: finding.component,
        status: finding.resolved ? 'Resolved' : 'Open'
      });
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.xlsx"`);
  
  await workbook.xlsx.write(res);
}

export default router;