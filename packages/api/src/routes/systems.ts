import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { apiLimiter } from '../middleware/rate-limit';
import { CMConnectionFactory, CMVersionDetector, CredentialManager } from '@cm-diagnostics/cm-connector';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const credentialManager = new CredentialManager();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(apiLimiter);

// Validation schemas
const addSystemSchema = z.object({
  name: z.string().min(1).max(100),
  config: z.object({
    databaseType: z.enum(['SQLSERVER', 'ORACLE']),
    host: z.string(),
    port: z.number().optional(),
    database: z.string(),
    username: z.string(),
    password: z.string(),
    apiEndpoint: z.string().optional(),
    apiKey: z.string().optional()
  })
});

const updateSystemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.object({
    databaseType: z.enum(['SQLSERVER', 'ORACLE']),
    host: z.string(),
    port: z.number().optional(),
    database: z.string(),
    username: z.string(),
    password: z.string(),
    apiEndpoint: z.string().optional(),
    apiKey: z.string().optional()
  }).optional()
});

// Get all systems for the authenticated user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const systems = await prisma.cMSystem.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        version: true,
        edition: true,
        lastConnected: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(systems);
  } catch (error) {
    console.error('Get systems error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific system
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    // Get health status
    const latestScan = await prisma.diagnosticScan.findFirst({
      where: { 
        systemId: system.id,
        status: 'COMPLETED'
      },
      orderBy: { completedAt: 'desc' },
      include: {
        _count: {
          select: {
            findings: {
              where: {
                resolved: false,
                severity: { in: ['CRITICAL', 'HIGH'] }
              }
            }
          }
        }
      }
    });

    const health = {
      status: 'unknown',
      lastCheck: latestScan?.completedAt || system.lastConnected,
      issues: latestScan?._count.findings || 0
    };

    res.json({
      ...system,
      connectionConfig: undefined, // Don't expose encrypted config
      health
    });
  } catch (error) {
    console.error('Get system error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new system
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = addSystemSchema.parse(req.body);

    // Test connection
    const connector = await CMConnectionFactory.createConnector(data.config);
    await connector.connect();
    
    // Detect version
    const systemInfo = await CMVersionDetector.detectVersion(connector);
    
    await connector.disconnect();

    // Encrypt sensitive config
    const encryptedConfig = credentialManager.encryptConfig(data.config);

    // Create system record
    const system = await prisma.cMSystem.create({
      data: {
        name: data.name,
        version: systemInfo.version,
        edition: systemInfo.edition || 'Unknown',
        connectionConfig: encryptedConfig as any,
        userId: req.user!.id,
        lastConnected: new Date()
      }
    });

    res.status(201).json({
      id: system.id,
      name: system.name,
      version: system.version,
      edition: system.edition,
      features: systemInfo.features || [],
      modules: systemInfo.modules || []
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Add system error:', error);
    res.status(500).json({ 
      error: `Failed to add system: ${(error as Error).message}` 
    });
  }
});

// Update a system
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const data = updateSystemSchema.parse(req.body);

    // Check if system exists and belongs to user
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    const updateData: any = {};
    
    if (data.name) {
      updateData.name = data.name;
    }

    if (data.config) {
      // Test new connection
      const connector = await CMConnectionFactory.createConnector(data.config);
      await connector.connect();
      await connector.disconnect();

      updateData.connectionConfig = credentialManager.encryptConfig(data.config);
      updateData.lastConnected = new Date();
    }

    const updatedSystem = await prisma.cMSystem.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        version: true,
        edition: true,
        lastConnected: true,
        updatedAt: true
      }
    });

    res.json(updatedSystem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Update system error:', error);
    res.status(500).json({ 
      error: `Failed to update system: ${(error as Error).message}` 
    });
  }
});

// Delete a system
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    // Check if system exists and belongs to user
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    // Delete related data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete remediation attempts
      await tx.remediationAttempt.deleteMany({
        where: {
          finding: {
            systemId: req.params.id
          }
        }
      });

      // Delete findings
      await tx.diagnosticFinding.deleteMany({
        where: { systemId: req.params.id }
      });

      // Delete reports
      await tx.diagnosticReport.deleteMany({
        where: { systemId: req.params.id }
      });

      // Delete scans
      await tx.diagnosticScan.deleteMany({
        where: { systemId: req.params.id }
      });

      // Delete system
      await tx.cMSystem.delete({
        where: { id: req.params.id }
      });
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete system error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test system connection
router.post('/:id/test', async (req: AuthRequest, res) => {
  try {
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    // Decrypt config and test connection
    const config = credentialManager.decryptConfig(system.connectionConfig as any);
    const connector = await CMConnectionFactory.createConnector(config);
    
    const startTime = Date.now();
    await connector.connect();
    const latency = Date.now() - startTime;
    
    const isConnected = connector.isConnected();
    const health = await connector.healthCheck();
    
    await connector.disconnect();

    // Update last connected time
    await prisma.cMSystem.update({
      where: { id: req.params.id },
      data: { lastConnected: new Date() }
    });

    res.json({
      connected: isConnected,
      latency,
      health: {
        status: health.status,
        responseTime: health.responseTime,
        details: health.details
      }
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(200).json({
      connected: false,
      error: (error as Error).message
    });
  }
});

export default router;