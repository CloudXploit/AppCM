import { 
  CMConnector, 
  CMConnectionConfig, 
  CMSystemInfo, 
  CMVersionAdapter,
  CMError 
} from './types';
import { DatabaseConnector } from './connectors/database-connector';
import { APIConnector } from './connectors/api-connector';
import { getMonitoring } from '@cm-diagnostics/logger';

// Import version adapters
import { V94Adapter } from './versions/adapters/v9.4-adapter';
import { V100Adapter } from './versions/adapters/v10.0-adapter';
import { V101Adapter } from './versions/adapters/v10.1-adapter';
import { V233Adapter } from './versions/adapters/v23.3-adapter';
import { V234Adapter } from './versions/adapters/v23.4-adapter';
import { V242Adapter } from './versions/adapters/v24.2-adapter';
import { V243Adapter } from './versions/adapters/v24.3-adapter';
import { V244Adapter } from './versions/adapters/v24.4-adapter';
import { V251Adapter } from './versions/adapters/v25.1-adapter';
import { V252Adapter } from './versions/adapters/v25.2-adapter';

const monitoring = getMonitoring();
const logger = monitoring.getLogger({ component: 'connection-factory' });

export class CMConnectionFactory {
  private static adapters = new Map<string, new () => CMVersionAdapter>([
    ['9.4', V94Adapter],
    ['10.0', V100Adapter],
    ['10.1', V101Adapter],
    ['23.3', V233Adapter],
    ['23.4', V234Adapter],
    ['24.2', V242Adapter],
    ['24.3', V243Adapter],
    ['24.4', V244Adapter],
    ['25.1', V251Adapter],
    ['25.2', V252Adapter]
  ]);

  static async createConnector(config: CMConnectionConfig): Promise<CMConnector> {
    logger.info('Creating connector', { type: config.type });

    try {
      let connector: CMConnector;

      switch (config.type) {
        case 'DIRECT_DB':
          connector = new DatabaseConnector(config);
          break;
        case 'REST_API':
        case 'SOAP_API':
          connector = new APIConnector(config);
          break;
        default:
          throw new CMError(
            'INVALID_CONFIG',
            `Unsupported connection type: ${config.type}`
          );
      }

      logger.info('Connector created successfully', { type: config.type });
      return connector;
    } catch (error) {
      logger.error('Failed to create connector', error as Error);
      throw error;
    }
  }

  static createAdapter(systemInfo: CMSystemInfo): CMVersionAdapter {
    const versionKey = `${systemInfo.majorVersion}.${systemInfo.minorVersion}`;
    logger.info('Creating adapter for version', { version: versionKey });

    const AdapterClass = this.adapters.get(versionKey);
    if (!AdapterClass) {
      // Fall back to closest version
      const fallbackAdapter = this.findClosestAdapter(systemInfo);
      if (fallbackAdapter) {
        logger.warn('Using fallback adapter', { 
          requested: versionKey, 
          fallback: fallbackAdapter 
        });
        const FallbackClass = this.adapters.get(fallbackAdapter)!;
        return new FallbackClass();
      }

      throw new CMError(
        'UNSUPPORTED_VERSION',
        `No adapter available for CM version ${versionKey}`
      );
    }

    return new AdapterClass();
  }

  private static findClosestAdapter(systemInfo: CMSystemInfo): string | null {
    const targetVersion = systemInfo.majorVersion * 100 + systemInfo.minorVersion;
    let closestVersion: string | null = null;
    let closestDiff = Infinity;

    for (const [version] of this.adapters) {
      const [major, minor] = version.split('.').map(Number);
      const versionNum = major * 100 + minor;
      const diff = Math.abs(versionNum - targetVersion);

      if (diff < closestDiff) {
        closestDiff = diff;
        closestVersion = version;
      }
    }

    return closestVersion;
  }

  static getSupportedVersions(): string[] {
    return Array.from(this.adapters.keys()).sort((a, b) => {
      const [aMajor, aMinor] = a.split('.').map(Number);
      const [bMajor, bMinor] = b.split('.').map(Number);
      return aMajor * 100 + aMinor - (bMajor * 100 + bMinor);
    });
  }

  static isVersionSupported(version: string): boolean {
    const [major, minor] = version.split('.').slice(0, 2);
    const versionKey = `${major}.${minor}`;
    return this.adapters.has(versionKey);
  }
}