import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { apiLimiter } from '../middleware/rate-limit';
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
router.use(apiLimiter);

// Validation schemas
const executeRemediationSchema = z.object({
  actionId: z.string(),
  options: z.object({
    dryRun: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    comment: z.string().optional()
  }).optional()
});

const rollbackSchema = z.object({
  reason: z.string().min(1).max(500)
});

// Get remediation history for a finding
router.get('/findings/:findingId/remediation-history', async (req: AuthRequest, res) => {
  try {
    // Verify user owns the finding
    const finding = await prisma.diagnosticFinding.findUnique({
      where: { id: req.params.findingId }
    });

    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: finding.systemId,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const history = await prisma.remediationAttempt.findMany({
      where: { findingId: req.params.findingId },
      orderBy: { startedAt: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error('Get remediation history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Execute remediation
router.post('/findings/:findingId/remediate', async (req: AuthRequest, res) => {
  try {
    const data = executeRemediationSchema.parse(req.body);

    // Get finding
    const finding = await prisma.diagnosticFinding.findUnique({
      where: { id: req.params.findingId }
    });

    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    // Verify user owns the system
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: finding.systemId,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get remediation action from finding
    const actions = finding.remediationActions as any[];
    const action = actions?.find(a => a.id === data.actionId);

    if (!action) {
      return res.status(404).json({ error: 'Remediation action not found' });
    }

    // Check if approval is required
    if (action.requiresApproval && !data.options?.requireApproval) {
      return res.status(400).json({ 
        error: 'This remediation action requires approval',
        requiresApproval: true,
        action: {
          id: action.id,
          name: action.name,
          description: action.description,
          risk: action.risk
        }
      });
    }

    // Check for existing in-progress remediation
    const inProgress = await prisma.remediationAttempt.findFirst({
      where: {
        findingId: req.params.findingId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    });

    if (inProgress) {
      return res.status(409).json({ 
        error: 'A remediation is already in progress for this finding' 
      });
    }

    try {
      // Get connector
      const config = credentialManager.decryptConfig(system.connectionConfig as any);
      const connector = await connectionPool.acquire(system.id, config);

      // Execute remediation
      const result = await diagnostics.remediate(
        finding as any,
        action,
        {
          connector,
          approvedBy: req.user!.username,
          dryRun: data.options?.dryRun
        }
      );

      // Save attempt to database
      const attempt = await prisma.remediationAttempt.create({
        data: {
          id: result.attempt.id,
          findingId: req.params.findingId,
          actionId: data.actionId,
          status: result.attempt.status.toUpperCase() as any,
          startedAt: result.attempt.startedAt,
          completedAt: result.attempt.completedAt,
          executedBy: result.attempt.executedBy,
          approvedBy: result.attempt.approvedBy,
          success: result.attempt.success,
          output: result.attempt.output,
          error: result.attempt.error,
          changesMade: result.attempt.changesMade as any,
          rolledBack: false
        }
      });

      // Release connector
      connectionPool.release(connector, system.id);

      // Update finding if remediation was successful
      if (result.success && !data.options?.dryRun) {
        await prisma.diagnosticFinding.update({
          where: { id: req.params.findingId },
          data: {
            resolved: true,
            resolvedBy: req.user!.username,
            resolvedAt: new Date()
          }
        });
      }

      res.status(201).json({
        attempt,
        success: result.success,
        dryRun: data.options?.dryRun || false
      });
    } catch (error) {
      res.status(500).json({ 
        error: `Remediation failed: ${(error as Error).message}` 
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Execute remediation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve remediation (admin only)
router.post('/remediation-attempts/:attemptId/approve', 
  requireRole('ADMIN'), 
  async (req: AuthRequest, res) => {
    try {
      const attempt = await prisma.remediationAttempt.findUnique({
        where: { id: req.params.attemptId }
      });

      if (!attempt) {
        return res.status(404).json({ error: 'Remediation attempt not found' });
      }

      if (attempt.status !== 'PENDING') {
        return res.status(400).json({ 
          error: 'Remediation is not pending approval' 
        });
      }

      const updatedAttempt = await prisma.remediationAttempt.update({
        where: { id: req.params.attemptId },
        data: {
          status: 'APPROVED',
          approvedBy: req.user!.username
        }
      });

      // TODO: Trigger actual execution after approval

      res.json(updatedAttempt);
    } catch (error) {
      console.error('Approve remediation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Rollback remediation
router.post('/remediation-attempts/:attemptId/rollback', async (req: AuthRequest, res) => {
  try {
    const data = rollbackSchema.parse(req.body);

    const attempt = await prisma.remediationAttempt.findUnique({
      where: { id: req.params.attemptId },
      include: { finding: true }
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Remediation attempt not found' });
    }

    // Verify user owns the system
    const system = await prisma.cMSystem.findFirst({
      where: { 
        id: attempt.finding.systemId,
        userId: req.user!.id
      }
    });

    if (!system) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!attempt.success || attempt.rolledBack) {
      return res.status(400).json({ 
        error: 'Cannot rollback this remediation' 
      });
    }

    if (!attempt.changesMade || Object.keys(attempt.changesMade).length === 0) {
      return res.status(400).json({ 
        error: 'No changes to rollback' 
      });
    }

    try {
      // Execute rollback
      const rollbackResult = await diagnostics
        .getRemediationEngine()
        .rollback(attempt as any);

      if (rollbackResult.success) {
        // Update attempt
        await prisma.remediationAttempt.update({
          where: { id: req.params.attemptId },
          data: {
            rolledBack: true,
            rollbackAt: new Date(),
            rollbackReason: data.reason
          }
        });

        // Reopen finding
        await prisma.diagnosticFinding.update({
          where: { id: attempt.findingId },
          data: {
            resolved: false,
            resolvedBy: null,
            resolvedAt: null
          }
        });

        res.json({
          success: true,
          message: 'Remediation rolled back successfully'
        });
      } else {
        res.status(500).json({ 
          error: 'Rollback failed',
          details: rollbackResult.error 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        error: `Rollback failed: ${(error as Error).message}` 
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    console.error('Rollback remediation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all remediation attempts for a system
router.get('/systems/:systemId/remediation-attempts', async (req: AuthRequest, res) => {
  try {
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

    const attempts = await prisma.remediationAttempt.findMany({
      where: {
        finding: {
          systemId: req.params.systemId
        }
      },
      include: {
        finding: {
          select: {
            id: true,
            title: true,
            severity: true,
            category: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json(attempts);
  } catch (error) {
    console.error('Get remediation attempts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;