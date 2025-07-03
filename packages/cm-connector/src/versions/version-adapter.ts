import { CMVersion, CMVersionAdapter, CMQuery } from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';

const monitoring = getMonitoring();
const logger = monitoring.getLogger({ component: 'version-adapter' });

export abstract class BaseVersionAdapter implements CMVersionAdapter {
  version: CMVersion;
  features: Set<string>;

  constructor(version: CMVersion) {
    this.version = version;
    this.features = new Set();
    this.initializeFeatures();
  }

  abstract initializeFeatures(): void;
  abstract getTableName(entity: string): string;
  abstract getColumnName(entity: string, column: string): string;
  abstract buildQuery(operation: string, params: any): CMQuery;
  abstract transformResult(operation: string, result: any[]): any[];

  hasFeature(feature: string): boolean {
    return this.features.has(feature);
  }

  protected logDeprecation(feature: string, alternative?: string): void {
    logger.warn(`Deprecated feature used: ${feature}`, {
      version: this.version.fullVersion,
      alternative
    });
  }
}

// Legacy version adapter (9.x - 10.x)
export class LegacyVersionAdapter extends BaseVersionAdapter {
  initializeFeatures(): void {
    this.features.add('BASIC_SEARCH');
    this.features.add('DOCUMENT_MANAGEMENT');
    this.features.add('WORKFLOW_CLASSIC');
    this.features.add('SECURITY_BASIC');
  }

  getTableName(entity: string): string {
    const tableMap: Record<string, string> = {
      'system': 'TSYSTEM',
      'user': 'TUSERPERSON',
      'document': 'TDOCUMENT',
      'record': 'TRECORD',
      'location': 'TLOCATION',
      'recordtype': 'TRECORDTYPE',
      'security': 'TSECURITY',
      'audit': 'TAUDIT',
      'workflow': 'TWORKFLOW',
      'schedule': 'TSCHEDULE'
    };

    return tableMap[entity.toLowerCase()] || entity.toUpperCase();
  }

  getColumnName(entity: string, column: string): string {
    // Legacy versions use different column naming
    const columnMap: Record<string, Record<string, string>> = {
      'user': {
        'id': 'USP_ID',
        'name': 'USP_NAME',
        'email': 'USP_EMAIL',
        'active': 'USP_ACTIVE',
        'type': 'USP_TYPE'
      },
      'document': {
        'id': 'DOC_ID',
        'title': 'DOC_TITLE',
        'number': 'DOC_NUMBER',
        'dateregistered': 'DOC_DATEREGISTERED',
        'datecreated': 'DOC_DATECREATED'
      },
      'record': {
        'id': 'REC_ID',
        'number': 'REC_NUMBER',
        'title': 'REC_TITLE',
        'recordtype': 'REC_RECORDTYPE',
        'container': 'REC_CONTAINER'
      }
    };

    const entityMap = columnMap[entity.toLowerCase()];
    if (entityMap && entityMap[column.toLowerCase()]) {
      return entityMap[column.toLowerCase()];
    }

    // Default pattern for legacy columns
    const prefix = entity.substring(0, 3).toUpperCase();
    return `${prefix}_${column.toUpperCase()}`;
  }

  buildQuery(operation: string, params: any): CMQuery {
    switch (operation) {
      case 'GET_USERS':
        return {
          sql: `
            SELECT 
              USP_ID as id,
              USP_NAME as name,
              USP_EMAIL as email,
              USP_ACTIVE as active,
              USP_TYPE as type
            FROM TUSERPERSON
            WHERE USP_ACTIVE = 1
            ORDER BY USP_NAME
          `
        };

      case 'GET_RECORD_TYPES':
        return {
          sql: `
            SELECT 
              RCT_ID as id,
              RCT_NAME as name,
              RCT_DESCRIPTION as description,
              RCT_ACTIVE as active
            FROM TRECORDTYPE
            WHERE RCT_ACTIVE = 1
            ORDER BY RCT_NAME
          `
        };

      case 'GET_LOCATIONS':
        return {
          sql: `
            SELECT 
              LOC_ID as id,
              LOC_NAME as name,
              LOC_FORMAL_NAME as formalName,
              LOC_TYPE as type,
              LOC_PARENT as parentId
            FROM TLOCATION
            ORDER BY LOC_FORMAL_NAME
          `
        };

      case 'GET_SYSTEM_OPTIONS':
        // Legacy versions store options differently
        return {
          sql: `
            SELECT 
              SYS_OPTION_NAME as name,
              SYS_OPTION_VALUE as value,
              SYS_OPTION_TYPE as type
            FROM TSYSTEMOPTIONS
          `
        };

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  transformResult(operation: string, result: any[]): any[] {
    // Transform legacy data structures to modern format
    switch (operation) {
      case 'GET_USERS':
        return result.map(user => ({
          ...user,
          type: this.mapLegacyUserType(user.type),
          permissions: this.extractLegacyPermissions(user)
        }));

      case 'GET_RECORD_TYPES':
        return result.map(rt => ({
          ...rt,
          features: this.extractLegacyRecordTypeFeatures(rt)
        }));

      default:
        return result;
    }
  }

  private mapLegacyUserType(type: number): string {
    const typeMap: Record<number, string> = {
      0: 'NORMAL',
      1: 'ADMIN',
      2: 'SYSTEM',
      3: 'EXTERNAL'
    };
    return typeMap[type] || 'UNKNOWN';
  }

  private extractLegacyPermissions(user: any): string[] {
    // Legacy versions encode permissions differently
    const permissions: string[] = [];
    if (user.type === 1) permissions.push('ADMIN');
    if (user.canCreate) permissions.push('CREATE');
    if (user.canModify) permissions.push('MODIFY');
    if (user.canDelete) permissions.push('DELETE');
    return permissions;
  }

  private extractLegacyRecordTypeFeatures(recordType: any): string[] {
    const features: string[] = [];
    // Extract features based on legacy flags
    if (recordType.hasWorkflow) features.push('WORKFLOW');
    if (recordType.hasVersioning) features.push('VERSIONING');
    if (recordType.hasRetention) features.push('RETENTION');
    return features;
  }
}

// Modern version adapter (23.x - 24.x)
export class ModernVersionAdapter extends BaseVersionAdapter {
  initializeFeatures(): void {
    this.features.add('ADVANCED_SEARCH');
    this.features.add('DOCUMENT_MANAGEMENT');
    this.features.add('WORKFLOW_ADVANCED');
    this.features.add('SECURITY_ADVANCED');
    this.features.add('FEDERATION');
    this.features.add('CONTENT_ANALYTICS');
    this.features.add('RETENTION_MANAGEMENT');
    this.features.add('PHYSICAL_RECORDS');
    this.features.add('EMAIL_MANAGEMENT');
  }

  getTableName(entity: string): string {
    const tableMap: Record<string, string> = {
      'system': 'HP_SYSTEM',
      'user': 'HP_USER',
      'document': 'HP_DOCUMENT',
      'record': 'HP_RECORD',
      'location': 'HP_LOCATION',
      'recordtype': 'HP_RECORD_TYPE',
      'security': 'HP_SECURITY',
      'audit': 'HP_AUDIT',
      'workflow': 'HP_WORKFLOW',
      'schedule': 'HP_SCHEDULE',
      'analytics': 'HP_ANALYTICS',
      'federation': 'HP_FEDERATION'
    };

    return tableMap[entity.toLowerCase()] || `HP_${entity.toUpperCase()}`;
  }

  getColumnName(entity: string, column: string): string {
    // Modern versions use consistent column naming
    return column.toLowerCase();
  }

  buildQuery(operation: string, params: any): CMQuery {
    switch (operation) {
      case 'GET_USERS':
        return {
          sql: `
            SELECT 
              id,
              name,
              email,
              active,
              type,
              created_date,
              modified_date,
              last_login_date,
              permissions
            FROM HP_USER
            WHERE active = 1
            ORDER BY name
          `
        };

      case 'GET_RECORD_TYPES':
        return {
          sql: `
            SELECT 
              id,
              name,
              description,
              active,
              features,
              retention_policy_id,
              default_security_level
            FROM HP_RECORD_TYPE
            WHERE active = 1
            ORDER BY name
          `
        };

      case 'GET_LOCATIONS':
        return {
          sql: `
            SELECT 
              id,
              name,
              formal_name,
              type,
              parent_id,
              gps_coordinates,
              time_zone,
              business_unit_id
            FROM HP_LOCATION
            ORDER BY formal_name
          `
        };

      case 'GET_SYSTEM_OPTIONS':
        return {
          sql: `
            SELECT 
              option_category,
              option_name,
              option_value,
              option_type,
              is_encrypted,
              modified_date,
              modified_by
            FROM HP_SYSTEM_OPTIONS
            ORDER BY option_category, option_name
          `
        };

      case 'GET_ANALYTICS_DATA':
        // Modern feature not available in legacy
        return {
          sql: `
            SELECT 
              metric_name,
              metric_value,
              metric_date,
              dimension1,
              dimension2
            FROM HP_ANALYTICS
            WHERE metric_date >= ?
            ORDER BY metric_date DESC
          `,
          params: [params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
        };

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  transformResult(operation: string, result: any[]): any[] {
    // Modern versions return data in standard format
    switch (operation) {
      case 'GET_USERS':
        return result.map(user => ({
          ...user,
          permissions: JSON.parse(user.permissions || '[]')
        }));

      case 'GET_RECORD_TYPES':
        return result.map(rt => ({
          ...rt,
          features: JSON.parse(rt.features || '[]')
        }));

      default:
        return result;
    }
  }
}

// Latest version adapter (25.x+)
export class LatestVersionAdapter extends ModernVersionAdapter {
  initializeFeatures(): void {
    super.initializeFeatures();
    this.features.add('AI_CLASSIFICATION');
    this.features.add('SMART_AUTOMATION');
    this.features.add('CLOUD_NATIVE');
    this.features.add('MICROSERVICES');
    this.features.add('GRAPHQL_API');
    this.features.add('EVENT_STREAMING');
  }

  buildQuery(operation: string, params: any): CMQuery {
    // Latest versions support additional operations
    if (operation === 'GET_AI_SUGGESTIONS') {
      return {
        sql: `
          SELECT 
            suggestion_id,
            suggestion_type,
            confidence_score,
            suggested_value,
            context_data
          FROM HP_AI_SUGGESTIONS
          WHERE entity_type = ? AND entity_id = ?
          ORDER BY confidence_score DESC
        `,
        params: [params.entityType, params.entityId]
      };
    }

    if (operation === 'GET_EVENT_STREAM') {
      return {
        sql: `
          SELECT 
            event_id,
            event_type,
            event_data,
            event_timestamp,
            source_system
          FROM HP_EVENT_STREAM
          WHERE event_timestamp > ?
          ORDER BY event_timestamp
          LIMIT 1000
        `,
        params: [params.since || new Date(Date.now() - 60000)]
      };
    }

    // Fallback to modern adapter for other operations
    return super.buildQuery(operation, params);
  }
}

// Factory to create appropriate adapter
export class VersionAdapterFactory {
  static create(version: CMVersion): CMVersionAdapter {
    logger.info('Creating version adapter', { version: version.fullVersion });

    if (version.major < 23) {
      return new LegacyVersionAdapter(version);
    } else if (version.major < 25) {
      return new ModernVersionAdapter(version);
    } else {
      return new LatestVersionAdapter(version);
    }
  }
}