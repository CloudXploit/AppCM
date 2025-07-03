import semver from 'semver';
import { CMVersion, CMSystemInfo, CMConnector, CMError } from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';

const monitoring = getMonitoring();
const logger = monitoring.getLogger({ component: 'version-detector' });

export class CMVersionDetector {
  private static versionQueries = {
    SQLServer: `
      SELECT 
        TSYSTEM.TSYS_VERSION as VERSION,
        TSYSTEM.TSYS_DB_VERSION as DB_VERSION,
        TSYSTEM.TSYS_PRODUCT_NAME as PRODUCT_NAME,
        TSYSTEM.TSYS_EDITION as EDITION
      FROM TSYSTEM
      WHERE TSYSTEM.TSYS_ID = 1
    `,
    Oracle: `
      SELECT 
        TSYS_VERSION as VERSION,
        TSYS_DB_VERSION as DB_VERSION,
        TSYS_PRODUCT_NAME as PRODUCT_NAME,
        TSYS_EDITION as EDITION
      FROM TSYSTEM
      WHERE TSYS_ID = 1
    `
  };

  static async detectVersion(connector: CMConnector): Promise<CMSystemInfo> {
    logger.info('Starting Content Manager version detection');

    try {
      // First, try to get basic system info
      const systemInfo = await this.getBasicSystemInfo(connector);
      
      // Parse version information
      const version = this.parseVersion(systemInfo.VERSION);
      
      // Get additional features based on version
      const features = await this.detectFeatures(connector, version);
      
      // Get licensing information
      const licensing = await this.getLicensingInfo(connector, version);

      const result: CMSystemInfo = {
        version,
        edition: this.parseEdition(systemInfo.EDITION),
        modules: features.modules,
        licensedUsers: licensing.users,
        installedFeatures: features.installed,
        databaseType: systemInfo.DB_TYPE,
        databaseVersion: systemInfo.DB_VERSION
      };

      logger.info('Version detection completed', { version: version.fullVersion });
      monitoring.getMetrics().increment('cm_version_detection_success', { version: version.fullVersion });

      return result;
    } catch (error) {
      logger.error('Version detection failed', error as Error);
      monitoring.getMetrics().increment('cm_version_detection_failure');
      throw new CMError('VERSION_UNSUPPORTED', 'Failed to detect Content Manager version', error);
    }
  }

  private static async getBasicSystemInfo(connector: CMConnector): Promise<any> {
    // Try SQL Server query first
    try {
      const result = await connector.executeQuery({
        sql: this.versionQueries.SQLServer,
        timeout: 5000
      });
      
      if (result && result.length > 0) {
        return { ...result[0], DB_TYPE: 'SQLServer' };
      }
    } catch (error) {
      logger.debug('SQL Server query failed, trying Oracle', error);
    }

    // Try Oracle query
    try {
      const result = await connector.executeQuery({
        sql: this.versionQueries.Oracle,
        timeout: 5000
      });
      
      if (result && result.length > 0) {
        return { ...result[0], DB_TYPE: 'Oracle' };
      }
    } catch (error) {
      logger.debug('Oracle query failed', error);
    }

    throw new Error('Unable to query system information from database');
  }

  private static parseVersion(versionString: string): CMVersion {
    // Handle different version formats
    // Examples: "9.4.0.1234", "10.1", "23.3.0", "25.2.0.5678"
    const versionRegex = /^(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?/;
    const match = versionString.match(versionRegex);

    if (!match) {
      throw new Error(`Invalid version format: ${versionString}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: match[3] ? parseInt(match[3], 10) : 0,
      build: match[4] ? parseInt(match[4], 10) : undefined,
      fullVersion: versionString
    };
  }

  private static parseEdition(edition: string): 'Standard' | 'Enterprise' | 'Cloud' {
    const normalized = edition.toLowerCase();
    if (normalized.includes('enterprise')) return 'Enterprise';
    if (normalized.includes('cloud')) return 'Cloud';
    return 'Standard';
  }

  private static async detectFeatures(connector: CMConnector, version: CMVersion): Promise<any> {
    const features = {
      modules: [] as string[],
      installed: [] as string[]
    };

    // Version-specific feature detection
    if (version.major >= 23) {
      // Modern versions have feature table
      try {
        const result = await connector.executeQuery({
          sql: `
            SELECT FEATURE_NAME, FEATURE_STATUS, FEATURE_VERSION
            FROM TFEATURES
            WHERE FEATURE_STATUS = 'ENABLED'
          `
        });

        features.installed = result.map(r => r.FEATURE_NAME);
      } catch (error) {
        logger.debug('Feature detection query failed', error);
      }
    }

    // Detect installed modules
    const moduleQueries = {
      RM: `SELECT COUNT(*) as CNT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TRECORD'`,
      IDOL: `SELECT COUNT(*) as CNT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TIDOLCONFIG'`,
      ES: `SELECT COUNT(*) as CNT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TESENTERPRISE'`,
      WGS: `SELECT COUNT(*) as CNT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TWGSCONFIG'`
    };

    for (const [module, query] of Object.entries(moduleQueries)) {
      try {
        const result = await connector.executeQuery({ sql: query, timeout: 2000 });
        if (result[0]?.CNT > 0) {
          features.modules.push(module);
        }
      } catch (error) {
        logger.debug(`Module detection failed for ${module}`, error);
      }
    }

    return features;
  }

  private static async getLicensingInfo(connector: CMConnector, version: CMVersion): Promise<any> {
    try {
      const result = await connector.executeQuery({
        sql: `
          SELECT 
            LICENSE_TYPE,
            LICENSE_USERS,
            LICENSE_EXPIRY,
            LICENSE_MODULES
          FROM TLICENSE
          WHERE LICENSE_ACTIVE = 1
        `
      });

      if (result && result.length > 0) {
        return {
          users: result[0].LICENSE_USERS || 0,
          expiry: result[0].LICENSE_EXPIRY,
          modules: result[0].LICENSE_MODULES?.split(',') || []
        };
      }
    } catch (error) {
      logger.debug('Licensing info query failed', error);
    }

    return { users: 0, modules: [] };
  }

  static isVersionSupported(version: CMVersion): boolean {
    const supportedVersions = [
      { major: 9, minor: 4 },
      { major: 10, minor: 0 },
      { major: 10, minor: 1 },
      { major: 23, minor: 3 },
      { major: 23, minor: 4 },
      { major: 24, minor: 2 },
      { major: 24, minor: 3 },
      { major: 24, minor: 4 },
      { major: 25, minor: 1 },
      { major: 25, minor: 2 }
    ];

    return supportedVersions.some(
      v => v.major === version.major && v.minor === version.minor
    );
  }

  static getVersionCategory(version: CMVersion): 'legacy' | 'modern' | 'latest' {
    if (version.major < 23) return 'legacy';
    if (version.major === 23 || version.major === 24) return 'modern';
    return 'latest';
  }

  static compareVersions(v1: CMVersion, v2: CMVersion): number {
    const v1String = `${v1.major}.${v1.minor}.${v1.patch}`;
    const v2String = `${v2.major}.${v2.minor}.${v2.patch}`;
    return semver.compare(v1String, v2String);
  }
}