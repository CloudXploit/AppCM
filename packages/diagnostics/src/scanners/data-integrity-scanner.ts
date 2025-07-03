import { BaseScanner } from './base-scanner';
import type { Finding, ScanContext, DiagnosticRule } from '../types';
import type { CMVersionDetector, UnifiedModel } from '@cm-diagnostics/cm-connector';

interface DataIntegrityCheck {
  name: string;
  description: string;
  query: string;
  expectedCondition: (result: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

export class DataIntegrityScanner extends BaseScanner {
  name = 'Data Integrity Scanner';
  description = 'Scans for data consistency, orphaned records, and referential integrity issues';
  category = 'data_integrity';

  private integrityChecks: DataIntegrityCheck[] = [
    {
      name: 'orphaned_documents',
      description: 'Check for documents without parent folders',
      query: `
        SELECT COUNT(*) as count
        FROM documents d
        WHERE d.parent_folder_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM folders f
          WHERE f.id = d.parent_folder_id
        )
      `,
      expectedCondition: (result) => result.count === 0,
      severity: 'high',
      category: 'orphaned_records'
    },
    {
      name: 'duplicate_user_accounts',
      description: 'Check for duplicate user accounts with same email',
      query: `
        SELECT email, COUNT(*) as count
        FROM users
        GROUP BY email
        HAVING COUNT(*) > 1
      `,
      expectedCondition: (result) => result.length === 0,
      severity: 'critical',
      category: 'duplicates'
    },
    {
      name: 'invalid_permissions',
      description: 'Check for permissions referencing non-existent objects',
      query: `
        SELECT COUNT(*) as count
        FROM permissions p
        WHERE NOT EXISTS (
          SELECT 1 FROM objects o
          WHERE o.id = p.object_id
        )
      `,
      expectedCondition: (result) => result.count === 0,
      severity: 'high',
      category: 'referential_integrity'
    },
    {
      name: 'workflow_state_consistency',
      description: 'Check for documents in invalid workflow states',
      query: `
        SELECT COUNT(*) as count
        FROM documents d
        WHERE d.workflow_state IS NOT NULL
        AND d.workflow_state NOT IN (
          SELECT state_name FROM workflow_states
          WHERE workflow_id = d.workflow_id
        )
      `,
      expectedCondition: (result) => result.count === 0,
      severity: 'medium',
      category: 'state_consistency'
    },
    {
      name: 'metadata_schema_compliance',
      description: 'Check for documents with invalid metadata according to schema',
      query: `
        SELECT COUNT(*) as count
        FROM documents d
        WHERE d.document_type_id IS NOT NULL
        AND NOT validate_metadata(d.metadata, d.document_type_id)
      `,
      expectedCondition: (result) => result.count === 0,
      severity: 'medium',
      category: 'schema_compliance'
    },
    {
      name: 'retention_policy_violations',
      description: 'Check for documents past retention date that haven\'t been processed',
      query: `
        SELECT COUNT(*) as count
        FROM documents d
        JOIN retention_policies rp ON d.retention_policy_id = rp.id
        WHERE d.created_date + rp.retention_period < CURRENT_DATE
        AND d.retention_processed = false
      `,
      expectedCondition: (result) => result.count === 0,
      severity: 'high',
      category: 'compliance'
    },
    {
      name: 'circular_folder_references',
      description: 'Check for circular references in folder hierarchy',
      query: `
        WITH RECURSIVE folder_hierarchy AS (
          SELECT id, parent_id, 0 as level, ARRAY[id] as path
          FROM folders
          WHERE parent_id IS NULL
          
          UNION ALL
          
          SELECT f.id, f.parent_id, fh.level + 1, fh.path || f.id
          FROM folders f
          JOIN folder_hierarchy fh ON f.parent_id = fh.id
          WHERE NOT f.id = ANY(fh.path)
          AND fh.level < 100
        )
        SELECT COUNT(*) as count
        FROM folders
        WHERE id NOT IN (SELECT id FROM folder_hierarchy)
      `,
      expectedCondition: (result) => result.count === 0,
      severity: 'critical',
      category: 'data_structure'
    },
    {
      name: 'audit_log_gaps',
      description: 'Check for gaps in audit log sequence',
      query: `
        SELECT COUNT(*) as gaps
        FROM (
          SELECT id, 
                 LAG(id) OVER (ORDER BY id) as prev_id,
                 id - LAG(id) OVER (ORDER BY id) as gap
          FROM audit_logs
        ) t
        WHERE gap > 1
      `,
      expectedCondition: (result) => result.gaps === 0,
      severity: 'high',
      category: 'audit_integrity'
    }
  ];

  async scan(context: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const { cmSystem } = context;

    try {
      // Get version-specific table mappings
      const versionDetector = this.getVersionDetector(cmSystem);
      const version = await versionDetector.detectVersion();
      
      for (const check of this.integrityChecks) {
        try {
          const adaptedQuery = this.adaptQueryForVersion(check.query, version);
          const result = await this.executeQuery(cmSystem, adaptedQuery);
          
          if (!check.expectedCondition(result)) {
            findings.push({
              ruleId: `data_integrity_${check.name}`,
              severity: check.severity,
              category: 'data_integrity',
              title: check.description,
              description: this.generateDescription(check, result),
              recommendation: this.generateRecommendation(check),
              metadata: {
                checkName: check.name,
                category: check.category,
                result: this.sanitizeResult(result)
              }
            });
          }
        } catch (error) {
          this.logger.error(`Failed to execute integrity check ${check.name}:`, error);
          findings.push({
            ruleId: `data_integrity_${check.name}_error`,
            severity: 'medium',
            category: 'data_integrity',
            title: `Unable to verify ${check.description}`,
            description: `The integrity check could not be completed due to an error.`,
            recommendation: 'Review the check query and ensure it\'s compatible with your CM version.',
            metadata: {
              checkName: check.name,
              error: error.message
            }
          });
        }
      }

      // Additional dynamic checks based on system configuration
      const dynamicFindings = await this.performDynamicChecks(context);
      findings.push(...dynamicFindings);

    } catch (error) {
      this.logger.error('Data integrity scan failed:', error);
      throw error;
    }

    return findings;
  }

  private async performDynamicChecks(context: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Check for custom metadata field integrity
    const customFields = await this.getCustomMetadataFields(context);
    for (const field of customFields) {
      const integrityIssues = await this.checkCustomFieldIntegrity(context, field);
      findings.push(...integrityIssues);
    }

    // Check for integration data consistency
    const integrations = await this.getActiveIntegrations(context);
    for (const integration of integrations) {
      const syncIssues = await this.checkIntegrationDataSync(context, integration);
      findings.push(...syncIssues);
    }

    return findings;
  }

  private generateDescription(check: DataIntegrityCheck, result: any): string {
    const descriptions: Record<string, (result: any) => string> = {
      orphaned_documents: (r) => `Found ${r.count} documents without valid parent folders.`,
      duplicate_user_accounts: (r) => `Found ${r.length} email addresses with duplicate user accounts.`,
      invalid_permissions: (r) => `Found ${r.count} permissions referencing non-existent objects.`,
      workflow_state_consistency: (r) => `Found ${r.count} documents in invalid workflow states.`,
      metadata_schema_compliance: (r) => `Found ${r.count} documents with metadata that doesn't comply with their schema.`,
      retention_policy_violations: (r) => `Found ${r.count} documents past retention date that need processing.`,
      circular_folder_references: (r) => `Found ${r.count} folders with circular references in hierarchy.`,
      audit_log_gaps: (r) => `Found ${r.gaps} gaps in the audit log sequence.`
    };

    return descriptions[check.name]?.(result) || `Data integrity issue detected in ${check.name} check.`;
  }

  private generateRecommendation(check: DataIntegrityCheck): string {
    const recommendations: Record<string, string> = {
      orphaned_documents: 'Run cleanup job to reassign orphaned documents to a recovery folder or remove them.',
      duplicate_user_accounts: 'Merge duplicate accounts and update all references to use the primary account.',
      invalid_permissions: 'Remove invalid permission entries and audit permission assignments.',
      workflow_state_consistency: 'Reset documents to valid workflow states or update workflow definitions.',
      metadata_schema_compliance: 'Update document metadata to comply with schema or adjust schema requirements.',
      retention_policy_violations: 'Execute retention policy processor to handle expired documents.',
      circular_folder_references: 'Rebuild folder hierarchy index and fix circular references.',
      audit_log_gaps: 'Investigate missing audit entries and review audit log retention settings.'
    };

    return recommendations[check.name] || 'Review and fix the identified data integrity issues.';
  }

  private sanitizeResult(result: any): any {
    // Limit result size to prevent large payloads
    if (Array.isArray(result) && result.length > 10) {
      return {
        sample: result.slice(0, 10),
        totalCount: result.length,
        truncated: true
      };
    }
    return result;
  }

  private adaptQueryForVersion(query: string, version: any): string {
    // Adapt table and column names based on CM version
    const versionMappings: Record<string, Record<string, string>> = {
      '9.x': {
        'documents': 'dtree',
        'folders': 'dtree',
        'users': 'kuaf',
        'permissions': 'permissions',
        'audit_logs': 'audit'
      },
      '10.x': {
        'documents': 'dtree',
        'folders': 'dtree',
        'users': 'kuaf',
        'permissions': 'llacl',
        'audit_logs': 'daudit'
      },
      '23.x': {
        'documents': 'cm_documents',
        'folders': 'cm_folders',
        'users': 'cm_users',
        'permissions': 'cm_permissions',
        'audit_logs': 'cm_audit'
      }
    };

    let adaptedQuery = query;
    const majorVersion = version.version.split('.')[0];
    const mappings = versionMappings[`${majorVersion}.x`] || versionMappings['23.x'];

    Object.entries(mappings).forEach(([modern, legacy]) => {
      adaptedQuery = adaptedQuery.replace(new RegExp(`\\b${modern}\\b`, 'g'), legacy);
    });

    return adaptedQuery;
  }

  private async getCustomMetadataFields(context: ScanContext): Promise<any[]> {
    // Implementation would fetch custom metadata field definitions
    return [];
  }

  private async checkCustomFieldIntegrity(context: ScanContext, field: any): Promise<Finding[]> {
    // Implementation would check integrity of custom field data
    return [];
  }

  private async getActiveIntegrations(context: ScanContext): Promise<any[]> {
    // Implementation would fetch active integrations
    return [];
  }

  private async checkIntegrationDataSync(context: ScanContext, integration: any): Promise<Finding[]> {
    // Implementation would check data sync status
    return [];
  }

  private getVersionDetector(cmSystem: any): CMVersionDetector {
    // This would use the actual CM connector version detector
    return {} as CMVersionDetector;
  }

  private async executeQuery(cmSystem: any, query: string): Promise<any> {
    // This would use the CM connector to execute the query
    return {};
  }
}