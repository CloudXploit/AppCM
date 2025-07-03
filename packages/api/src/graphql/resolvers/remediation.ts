import { GraphQLError } from 'graphql';
import { Context } from '../context';
import { requireAuth, requireRole } from './auth';
import { CredentialManager } from '@cm-diagnostics/cm-connector';
import { publishRemediationUpdate } from './subscriptions';

const credentialManager = new CredentialManager();

export const remediationResolvers = {
  Mutation: {
    executeRemediation: async (
      _: any,
      args: {
        findingId: string;
        actionId: string;
        options?: {
          dryRun?: boolean;
          requireApproval?: boolean;
          comment?: string;
        };
      },
      context: Context
    ) => {
      requireAuth(context);

      // Get finding
      const finding = await context.prisma.diagnosticFinding.findUnique({
        where: { id: args.findingId }
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

      // Get remediation action from finding
      const actions = finding.remediationActions as any[];
      const action = actions?.find(a => a.id === args.actionId);

      if (!action) {
        throw new GraphQLError('Remediation action not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Check if approval is required
      if (action.requiresApproval && !args.options?.requireApproval) {
        throw new GraphQLError('This remediation action requires approval', {
          extensions: { code: 'APPROVAL_REQUIRED' }
        });
      }

      try {
        // Get connector
        const config = credentialManager.decryptConfig(system.connectionConfig as any);
        const connector = await context.connectionPool.acquire(system.id, config);

        // Execute remediation
        const result = await context.diagnostics.remediate(
          finding as any,
          action,
          {
            connector,
            approvedBy: context.user!.username,
            dryRun: args.options?.dryRun
          }
        );

        // Save attempt to database
        const attempt = await context.prisma.remediationAttempt.create({
          data: {
            id: result.attempt.id,
            findingId: args.findingId,
            actionId: args.actionId,
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
        context.connectionPool.release(connector, system.id);

        // Update finding if remediation was successful
        if (result.success && !args.options?.dryRun) {
          await context.prisma.diagnosticFinding.update({
            where: { id: args.findingId },
            data: {
              resolved: true,
              resolvedBy: context.user!.username,
              resolvedAt: new Date()
            }
          });
        }

        // Publish remediation update
        publishRemediationUpdate(context.pubsub, attempt);

        return attempt;
      } catch (error) {
        throw new GraphQLError(`Remediation failed: ${(error as Error).message}`, {
          extensions: { code: 'REMEDIATION_FAILED' }
        });
      }
    },

    approveRemediation: async (
      _: any,
      args: { attemptId: string },
      context: Context
    ) => {
      requireRole(context, 'ADMIN');

      const attempt = await context.prisma.remediationAttempt.findUnique({
        where: { id: args.attemptId }
      });

      if (!attempt) {
        throw new GraphQLError('Remediation attempt not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      if (attempt.status !== 'PENDING') {
        throw new GraphQLError('Remediation is not pending approval', {
          extensions: { code: 'INVALID_STATUS' }
        });
      }

      const updatedAttempt = await context.prisma.remediationAttempt.update({
        where: { id: args.attemptId },
        data: {
          status: 'APPROVED',
          approvedBy: context.user!.username
        }
      });

      // TODO: Trigger actual execution after approval

      return updatedAttempt;
    },

    rollbackRemediation: async (
      _: any,
      args: { attemptId: string; reason: string },
      context: Context
    ) => {
      requireAuth(context);

      const attempt = await context.prisma.remediationAttempt.findUnique({
        where: { id: args.attemptId },
        include: { finding: true }
      });

      if (!attempt) {
        throw new GraphQLError('Remediation attempt not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Verify user owns the system
      const system = await context.prisma.cMSystem.findFirst({
        where: { 
          id: attempt.finding.systemId,
          userId: context.user!.id
        }
      });

      if (!system) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      if (!attempt.success || attempt.rolledBack) {
        throw new GraphQLError('Cannot rollback this remediation', {
          extensions: { code: 'INVALID_STATUS' }
        });
      }

      try {
        // Execute rollback
        const rollbackResult = await context.diagnostics
          .getRemediationEngine()
          .rollback(attempt as any);

        if (rollbackResult.success) {
          // Update attempt
          await context.prisma.remediationAttempt.update({
            where: { id: args.attemptId },
            data: {
              rolledBack: true,
              rollbackAt: new Date(),
              rollbackReason: args.reason
            }
          });

          // Reopen finding
          await context.prisma.diagnosticFinding.update({
            where: { id: attempt.findingId },
            data: {
              resolved: false,
              resolvedBy: null,
              resolvedAt: null
            }
          });
        }

        return attempt;
      } catch (error) {
        throw new GraphQLError(`Rollback failed: ${(error as Error).message}`, {
          extensions: { code: 'ROLLBACK_FAILED' }
        });
      }
    }
  }
};