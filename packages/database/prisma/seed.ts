import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Demo Organization',
      slug: 'demo-org',
      description: 'Default organization for testing',
    },
  });

  // Create admin user
  const adminPassword = await hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@cmdiagnostics.com',
      username: 'admin',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      emailVerified: true,
      organizations: {
        create: {
          organizationId: organization.id,
          role: 'OWNER',
        },
      },
    },
  });

  // Create regular user
  const userPassword = await hash('user123', 10);
  const regularUser = await prisma.user.create({
    data: {
      email: 'user@cmdiagnostics.com',
      username: 'demouser',
      password: userPassword,
      firstName: 'Demo',
      lastName: 'User',
      role: 'USER',
      emailVerified: true,
      organizations: {
        create: {
          organizationId: organization.id,
          role: 'MEMBER',
        },
      },
    },
  });

  // Create CM Systems
  const cmSystems = await Promise.all([
    prisma.cMSystem.create({
      data: {
        organizationId: organization.id,
        name: 'Production CM 23.4',
        description: 'Main production Content Manager instance',
        version: '23.4',
        connectionType: 'DIRECT_DB',
        connectionConfig: {
          host: 'cm-prod.example.com',
          port: 1433,
          database: 'CM_PROD',
          encrypted: true,
        },
        healthStatus: 'HEALTHY',
      },
    }),
    prisma.cMSystem.create({
      data: {
        organizationId: organization.id,
        name: 'Development CM 23.4',
        description: 'Development Content Manager instance',
        version: '23.4',
        connectionType: 'DIRECT_DB',
        connectionConfig: {
          host: 'cm-dev.example.com',
          port: 1433,
          database: 'CM_DEV',
          encrypted: false,
        },
        healthStatus: 'WARNING',
      },
    }),
    prisma.cMSystem.create({
      data: {
        organizationId: organization.id,
        name: 'Legacy CM 10.1',
        description: 'Legacy Content Manager instance (to be migrated)',
        version: '10.1',
        connectionType: 'REST_API',
        connectionConfig: {
          baseUrl: 'https://legacy-cm.example.com/api',
          apiVersion: 'v1',
        },
        healthStatus: 'CRITICAL',
      },
    }),
  ]);

  // Create diagnostic profiles
  const diagnosticProfiles = await Promise.all([
    prisma.diagnosticProfile.create({
      data: {
        organizationId: organization.id,
        name: 'Daily Health Check',
        description: 'Basic daily health check for all systems',
        rules: {
          checks: [
            'database_connectivity',
            'disk_space',
            'memory_usage',
            'service_status',
            'backup_status',
          ],
        },
        schedule: '0 6 * * *', // Daily at 6 AM
        isActive: true,
        autoRemediate: false,
        severity: ['CRITICAL', 'HIGH'],
      },
    }),
    prisma.diagnosticProfile.create({
      data: {
        organizationId: organization.id,
        name: 'Comprehensive Scan',
        description: 'Full system diagnostic scan',
        rules: {
          checks: [
            'database_connectivity',
            'disk_space',
            'memory_usage',
            'service_status',
            'backup_status',
            'configuration_validation',
            'security_audit',
            'performance_analysis',
            'data_integrity',
            'integration_health',
          ],
        },
        schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
        isActive: true,
        autoRemediate: true,
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      },
    }),
  ]);

  // Create some sample diagnostic runs
  const diagnosticRun = await prisma.diagnosticRun.create({
    data: {
      cmSystemId: cmSystems[0].id,
      profileId: diagnosticProfiles[1].id,
      userId: adminUser.id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
      completedAt: new Date(Date.now() - 1800000), // 30 minutes ago
      duration: 1800000, // 30 minutes
      totalIssues: 5,
      criticalIssues: 1,
      warningIssues: 2,
      infoIssues: 2,
      summary: {
        scannedItems: 1250,
        passedChecks: 1245,
        failedChecks: 5,
      },
    },
  });

  // Create sample issues
  await Promise.all([
    prisma.issue.create({
      data: {
        diagnosticRunId: diagnosticRun.id,
        category: 'CONFIGURATION',
        severity: 'CRITICAL',
        code: 'CFG-001',
        title: 'Invalid Database Connection Pool Size',
        description: 'The database connection pool size is set too low for production workload',
        details: {
          current: 10,
          recommended: 50,
          impact: 'Performance degradation during peak hours',
        },
        impact: 'Users may experience slow response times during peak usage',
        recommendation: 'Increase connection pool size to 50 in configuration',
        autoFixAvailable: true,
      },
    }),
    prisma.issue.create({
      data: {
        diagnosticRunId: diagnosticRun.id,
        category: 'PERFORMANCE',
        severity: 'HIGH',
        code: 'PERF-002',
        title: 'Missing Database Indexes',
        description: 'Several critical database indexes are missing',
        details: {
          missingIndexes: [
            'IX_Documents_CreatedDate',
            'IX_Documents_ModifiedDate',
            'IX_Users_Email',
          ],
        },
        impact: 'Slow query performance affecting user experience',
        recommendation: 'Create the missing indexes to improve query performance',
        autoFixAvailable: true,
      },
    }),
    prisma.issue.create({
      data: {
        diagnosticRunId: diagnosticRun.id,
        category: 'SECURITY',
        severity: 'HIGH',
        code: 'SEC-003',
        title: 'Weak Password Policy',
        description: 'Password policy does not meet security standards',
        details: {
          currentPolicy: {
            minLength: 6,
            requireUppercase: false,
            requireNumbers: false,
            requireSpecialChars: false,
          },
          recommendedPolicy: {
            minLength: 12,
            requireUppercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
          },
        },
        impact: 'System vulnerable to brute force attacks',
        recommendation: 'Update password policy to meet security standards',
        autoFixAvailable: false,
      },
    }),
  ]);

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });