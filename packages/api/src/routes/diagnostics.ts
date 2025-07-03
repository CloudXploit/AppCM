import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { apiLimiter, scanLimiter } from '../middleware/rate-limit';
import { DiagnosticsService } from '../services/diagnostics-service';
import { ConnectionPool } from '../services/connection-pool';
import { CredentialManager } from '@cm-diagnostics/cm-connector';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const diagnostics = new DiagnosticsService();
const connectionPool = new ConnectionPool();
const credentialManager = new CredentialManager();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createScanSchema = z.object({
  name: z.string().min(1).max(100),
  rules: z.array(z.string()).optional(),
  categories: z.array(z.enum([
    'PERFORMANCE',
    'SECURITY', 
    'CONFIGURATION',
    'DATA_INTEGRITY',
    'COMPLIANCE',
    'AVAILABILITY',
    'COMPATIBILITY'
  ])).optional()
});

const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Get all scans
router.get('/scans', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const { systemId, status } = req.query;
    const pagination = paginationSchema.parse({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string
    });

    const where: any = {};
    
    if (systemId) {
      // Verify user owns this system
      const system = await prisma.cMSystem.findFirst({
        where: { 
          id: systemId as string,
          userId: req.user!.id
        }
      });
      
      if (!system) {
        return res.status(404).json({ error: 'System not found' });
      }
      
      where.systemId = systemId;
    } else {
      // Get all systems for user
      const systems = await prisma.cMSystem.findMany({
        where: { userId: req.user!.id },
        select: { id: true }
      });
      
      where.systemId = { in: systems.map(s => s.id) };
    }

    if (status) {
      where.status = status;
    }

    const [scans, total] = await Promise.all([
      prisma.diagnosticScan.findMany({
        where,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          _count: {
            select: {
              findings: true
            }
          }
        }
      }),
      prisma.diagnosticScan.count({ where })
    ]);

    res.json({
      data: scans,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Get scans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific scan
router.get('/scans/:id', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const scan = await prisma.diagnosticScan.findUnique({
      where: { id: req.params.id },
      include: {
        findings: {
          orderBy: { severity: 'desc' }
        }
      }
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

    res.json(scan);
  } catch (error) {
    console.error('Get scan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new scan
router.post('/systems/:systemId/scans', scanLimiter, async (req: AuthRequest, res) => {
  try {
    const data = createScanSchema.parse(req.body);

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

    // Check for active scans
    const activeScan = await prisma.diagnosticScan.findFirst({
      where: {
        systemId: req.params.systemId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    });

    if (activeScan) {
      return res.status(409).json({ 
        error: 'Another scan is already in progress for this system' 
      });
    }

    // Get connector from pool
    const config = credentialManager.decryptConfig(system.connectionConfig as any);
    const connector = await connectionPool.acquire(system.id, config);

    // Create scan using diagnostic engine
    const engineScan = await diagnostics.runDiagnostics(req.params.systemId, {
      name: data.name,
      rules: data.rules,
      categories: data.categories?.map(c => c.toLowerCase()),
      connector
    });

    // Save scan to database
    const dbScan = await prisma.diagnosticScan.create({
      data: {
        id: engineScan.id,
        name: engineScan.name,
        systemId: req.params.systemId,
        status: engineScan.status,
        progress: engineScan.progress,
        rules: engineScan.rules,
        categories: data.categories || [],
        triggeredBy: req.user!.username,
        triggerType: 'MANUAL'
      }
    });

    // Handle scan completion asynchronously
    diagnostics.getDiagnosticEngine().once('scan:completed', async (completedScan) => {
      if (completedScan.id === engineScan.id) {
        try {
          // Save findings
          for (const finding of completedScan.findings) {
            await prisma.diagnosticFinding.create({
              data: {
                id: finding.id,
                scanId: completedScan.id,
                systemId: req.params.systemId,
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
          }

          // Update scan status
          await prisma.diagnosticScan.update({
            where: { id: completedScan.id },
            data: {
              status: 'COMPLETED',
              progress: 100,
              completedAt: completedScan.completedAt,
              duration: completedScan.duration
            }
          });
        } catch (error) {
          console.error('Error saving scan results:', error);
        } finally {
          // Release connector
          connectionPool.release(connector, system.id);
        }
      }
    });

    res.status(201).json({
      id: dbScan.id,
      name: dbScan.name,
      status: dbScan.status,
      progress: dbScan.progress
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Create scan error:', error);
    res.status(500).json({ 
      error: `Failed to create scan: ${(error as Error).message}` 
    });
  }
});

// Cancel a scan
router.post('/scans/:id/cancel', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const scan = await prisma.diagnosticScan.findUnique({
      where: { id: req.params.id }
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

    if (scan.status !== 'IN_PROGRESS') {
      return res.status(400).json({ 
        error: 'Scan is not in progress' 
      });
    }

    // Cancel in engine
    await diagnostics.getDiagnosticEngine().cancelScan(req.params.id);

    // Update database
    const updatedScan = await prisma.diagnosticScan.update({
      where: { id: req.params.id },
      data: { 
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    res.json(updatedScan);
  } catch (error) {
    console.error('Cancel scan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get findings
router.get('/findings', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const { systemId, scanId, severity, category, resolved } = req.query;
    const pagination = paginationSchema.parse({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as string || 'detectedAt',
      sortOrder: req.query.sortOrder as string
    });

    const where: any = {};

    if (scanId) {
      where.scanId = scanId;
    }

    if (systemId) {
      // Verify user owns this system
      const system = await prisma.cMSystem.findFirst({
        where: { 
          id: systemId as string,
          userId: req.user!.id
        }
      });
      
      if (!system) {
        return res.status(404).json({ error: 'System not found' });
      }
      
      where.systemId = systemId;
    } else {
      // Get all systems for user
      const systems = await prisma.cMSystem.findMany({
        where: { userId: req.user!.id },
        select: { id: true }
      });
      
      where.systemId = { in: systems.map(s => s.id) };
    }

    if (severity) {
      where.severity = severity;
    }

    if (category) {
      where.category = category;
    }

    if (resolved !== undefined) {
      where.resolved = resolved === 'true';
    }

    const [findings, total] = await Promise.all([
      prisma.diagnosticFinding.findMany({
        where,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      }),
      prisma.diagnosticFinding.count({ where })
    ]);

    res.json({
      data: findings,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Get findings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get diagnostic rules
router.get('/rules', apiLimiter, async (req: AuthRequest, res) => {
  try {
    const { category, enabled } = req.query;
    
    const rules = diagnostics.getDiagnosticEngine().getRules();
    
    let filteredRules = rules;
    
    if (category) {
      filteredRules = filteredRules.filter(r => r.category === (category as string).toLowerCase());
    }
    
    if (enabled !== undefined) {
      filteredRules = filteredRules.filter(r => r.enabled === (enabled === 'true'));
    }

    res.json(filteredRules);
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;