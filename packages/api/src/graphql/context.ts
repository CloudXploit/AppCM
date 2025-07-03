import { Request } from 'express';
import { PrismaClient } from '@cm-diagnostics/database';
import { DiagnosticSystem } from '@cm-diagnostics/diagnostics';
import { getConnectionPool } from '@cm-diagnostics/cm-connector';
import { User } from '@prisma/client';
import DataLoader from 'dataloader';

export interface Context {
  req: Request;
  prisma: PrismaClient;
  user: User | null;
  diagnostics: DiagnosticSystem;
  connectionPool: any;
  loaders: {
    systems: DataLoader<string, any>;
    scans: DataLoader<string, any>;
    findings: DataLoader<string, any>;
    users: DataLoader<string, any>;
  };
}

// Create DataLoaders for efficient batching
function createLoaders(prisma: PrismaClient) {
  return {
    systems: new DataLoader(async (ids: readonly string[]) => {
      const systems = await prisma.cMSystem.findMany({
        where: { id: { in: [...ids] } }
      });
      const systemMap = new Map(systems.map(s => [s.id, s]));
      return ids.map(id => systemMap.get(id) || null);
    }),

    scans: new DataLoader(async (ids: readonly string[]) => {
      const scans = await prisma.diagnosticScan.findMany({
        where: { id: { in: [...ids] } }
      });
      const scanMap = new Map(scans.map(s => [s.id, s]));
      return ids.map(id => scanMap.get(id) || null);
    }),

    findings: new DataLoader(async (ids: readonly string[]) => {
      const findings = await prisma.diagnosticFinding.findMany({
        where: { id: { in: [...ids] } }
      });
      const findingMap = new Map(findings.map(f => [f.id, f]));
      return ids.map(id => findingMap.get(id) || null);
    }),

    users: new DataLoader(async (ids: readonly string[]) => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...ids] } }
      });
      const userMap = new Map(users.map(u => [u.id, u]));
      return ids.map(id => userMap.get(id) || null);
    })
  };
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  const prisma = new PrismaClient();
  
  // Get user from request (set by auth middleware)
  const user = (req as any).user || null;

  // Initialize diagnostic system
  const diagnostics = new DiagnosticSystem({
    enableAutoRemediation: true,
    requireApproval: true
  });
  await diagnostics.initialize();

  // Get connection pool
  const connectionPool = getConnectionPool();

  // Create DataLoaders
  const loaders = createLoaders(prisma);

  return {
    req,
    prisma,
    user,
    diagnostics,
    connectionPool,
    loaders
  };
}