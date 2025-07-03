import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CMConnectionFactory } from '../../connection-factory';
import { CMVersionDetector } from '../../versions/version-detector';
import { SystemExtractor } from '../../extractors/system-extractor';
import { UserExtractor } from '../../extractors/user-extractor';
import { UnifiedModelFactory } from '../../models/unified-models';
import { getConnectionPool, closeConnectionPool } from '../../utils/connection-pool';
import { CMConnectionConfig, CMSystemInfo } from '../../types';

// Test configurations for different CM versions
const TEST_CONFIGS: Record<string, CMConnectionConfig> = {
  '9.4': {
    type: 'DIRECT_DB',
    host: process.env.CM94_DB_HOST || 'localhost',
    port: parseInt(process.env.CM94_DB_PORT || '1433'),
    database: process.env.CM94_DB_NAME || 'CM94_TEST',
    username: process.env.CM94_DB_USER || 'sa',
    password: process.env.CM94_DB_PASS || 'test',
    databaseType: 'sqlserver',
    encrypted: false,
    trustServerCertificate: true,
    options: {
      requestTimeout: 30000,
      connectionTimeout: 15000
    }
  },
  '10.0': {
    type: 'DIRECT_DB',
    host: process.env.CM10_DB_HOST || 'localhost',
    port: parseInt(process.env.CM10_DB_PORT || '1433'),
    database: process.env.CM10_DB_NAME || 'CM10_TEST',
    username: process.env.CM10_DB_USER || 'sa',
    password: process.env.CM10_DB_PASS || 'test',
    databaseType: 'sqlserver',
    encrypted: false,
    trustServerCertificate: true
  },
  '10.1': {
    type: 'REST_API',
    baseUrl: process.env.CM101_API_URL || 'http://localhost:8080',
    username: process.env.CM101_API_USER || 'admin',
    password: process.env.CM101_API_PASS || 'admin',
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  },
  '23.3': {
    type: 'REST_API',
    baseUrl: process.env.CM233_API_URL || 'http://localhost:8080',
    username: process.env.CM233_API_USER || 'admin',
    password: process.env.CM233_API_PASS || 'admin',
    timeout: 30000
  },
  '23.4': {
    type: 'REST_API',
    baseUrl: process.env.CM234_API_URL || 'http://localhost:8080',
    username: process.env.CM234_API_USER || 'admin',
    password: process.env.CM234_API_PASS || 'admin',
    timeout: 30000
  },
  '24.2': {
    type: 'REST_API',
    baseUrl: process.env.CM242_API_URL || 'http://localhost:8080',
    username: process.env.CM242_API_USER || 'admin',
    password: process.env.CM242_API_PASS || 'admin',
    timeout: 30000
  },
  '24.3': {
    type: 'REST_API',
    baseUrl: process.env.CM243_API_URL || 'http://localhost:8080',
    username: process.env.CM243_API_USER || 'admin',
    password: process.env.CM243_API_PASS || 'admin',
    timeout: 30000
  },
  '24.4': {
    type: 'DIRECT_DB',
    host: process.env.CM244_DB_HOST || 'localhost',
    port: parseInt(process.env.CM244_DB_PORT || '1521'),
    database: process.env.CM244_DB_NAME || 'CM244',
    username: process.env.CM244_DB_USER || 'cm',
    password: process.env.CM244_DB_PASS || 'test',
    databaseType: 'oracle',
    options: {
      connectString: process.env.CM244_ORACLE_CONNECT || 'localhost:1521/CM244'
    }
  },
  '25.1': {
    type: 'REST_API',
    baseUrl: process.env.CM251_API_URL || 'http://localhost:8080',
    username: process.env.CM251_API_USER || 'admin',
    password: process.env.CM251_API_PASS || 'admin',
    timeout: 30000,
    headers: {
      'X-API-Version': '2'
    }
  },
  '25.2': {
    type: 'REST_API',
    baseUrl: process.env.CM252_API_URL || 'http://localhost:8080',
    username: process.env.CM252_API_USER || 'admin',
    password: process.env.CM252_API_PASS || 'admin',
    timeout: 30000,
    headers: {
      'X-API-Version': '2'
    }
  }
};

// Skip tests if environment variable is not set
const SKIP_INTEGRATION_TESTS = process.env.SKIP_CM_INTEGRATION_TESTS === 'true';
const TEST_VERSIONS = process.env.TEST_CM_VERSIONS ? 
  process.env.TEST_CM_VERSIONS.split(',') : 
  Object.keys(TEST_CONFIGS);

describe('CM Version Compatibility Tests', () => {
  let connectionPool: any;

  beforeAll(async () => {
    if (!SKIP_INTEGRATION_TESTS) {
      connectionPool = getConnectionPool({
        maxSize: 5,
        maxIdleTime: 60000,
        healthCheckInterval: 30000
      });
    }
  });

  afterAll(async () => {
    if (!SKIP_INTEGRATION_TESTS) {
      await closeConnectionPool();
    }
  });

  describe.skipIf(SKIP_INTEGRATION_TESTS)('Connection Tests', () => {
    TEST_VERSIONS.forEach(version => {
      const config = TEST_CONFIGS[version];
      if (!config) return;

      describe(`CM ${version}`, () => {
        it('should connect successfully', async () => {
          const connector = await CMConnectionFactory.createConnector(config);
          
          try {
            await connector.connect();
            expect(connector.isConnected()).toBe(true);
            
            const health = await connector.healthCheck();
            expect(['healthy', 'warning']).toContain(health.status);
          } finally {
            await connector.disconnect();
          }
        }, 30000);

        it('should detect version correctly', async () => {
          const connector = await CMConnectionFactory.createConnector(config);
          
          try {
            await connector.connect();
            const systemInfo = await CMVersionDetector.detectVersion(connector);
            
            expect(systemInfo).toBeDefined();
            expect(systemInfo.version).toBeDefined();
            expect(systemInfo.majorVersion).toBeGreaterThanOrEqual(9);
            expect(systemInfo.features).toBeInstanceOf(Array);
          } finally {
            await connector.disconnect();
          }
        }, 30000);
      });
    });
  });

  describe.skipIf(SKIP_INTEGRATION_TESTS)('Data Extraction Tests', () => {
    TEST_VERSIONS.forEach(version => {
      const config = TEST_CONFIGS[version];
      if (!config) return;

      describe(`CM ${version}`, () => {
        let connector: any;
        let systemInfo: CMSystemInfo;
        let adapter: any;

        beforeAll(async () => {
          connector = await CMConnectionFactory.createConnector(config);
          await connector.connect();
          systemInfo = await CMVersionDetector.detectVersion(connector);
          adapter = CMConnectionFactory.createAdapter(systemInfo);
        });

        afterAll(async () => {
          if (connector) {
            await connector.disconnect();
          }
        });

        it('should extract system data', async () => {
          const extractor = new SystemExtractor(connector, adapter);
          const data = await extractor.extractWithValidation();
          
          expect(data).toBeDefined();
          expect(data.system).toBeDefined();
          expect(data.system.version).toBeDefined();
          expect(data.features).toBeInstanceOf(Array);
          expect(data.modules).toBeInstanceOf(Array);
        }, 60000);

        it('should extract user data', async () => {
          const extractor = new UserExtractor(connector, adapter);
          const data = await extractor.extractWithValidation();
          
          expect(data).toBeDefined();
          expect(data.users).toBeInstanceOf(Array);
          expect(data.summary.totalUsers).toBeGreaterThanOrEqual(0);
          
          if (data.users.length > 0) {
            const user = data.users[0];
            expect(user.username).toBeDefined();
            expect(user.isAdmin).toBeDefined();
          }
        }, 60000);

        it('should create unified models', async () => {
          const extractor = new SystemExtractor(connector, adapter);
          const systemData = await extractor.extract();
          
          const unifiedSystem = UnifiedModelFactory.createSystem({
            systemId: systemData.configuration.systemId,
            name: `CM ${version}`,
            version: systemData.configuration.version,
            edition: systemData.configuration.edition,
            installDate: systemData.configuration.installDate,
            database: {
              type: systemData.configuration.databaseType,
              version: systemData.configuration.databaseVersion,
              name: systemData.configuration.databaseName,
              server: systemData.configuration.serverName
            },
            features: systemData.features.map(f => f.name),
            modules: systemData.modules.map(m => m.name)
          }, 'test');
          
          expect(unifiedSystem).toBeDefined();
          expect(unifiedSystem.type).toBe('system');
          expect(unifiedSystem.attributes.version).toBeDefined();
          expect(unifiedSystem.metadata.source).toBe('test');
        }, 30000);
      });
    });
  });

  describe.skipIf(SKIP_INTEGRATION_TESTS)('Connection Pool Tests', () => {
    it('should handle multiple concurrent connections', async () => {
      const version = TEST_VERSIONS[0];
      const config = TEST_CONFIGS[version];
      if (!config) return;

      const promises = [];
      
      // Create 5 concurrent connections
      for (let i = 0; i < 5; i++) {
        promises.push(
          connectionPool.acquire(`test-${version}`, config).then(async (conn: any) => {
            const health = await conn.healthCheck();
            connectionPool.release(conn, `test-${version}`);
            return health;
          })
        );
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(health => {
        expect(['healthy', 'warning', 'critical', 'offline']).toContain(health.status);
      });
    }, 60000);

    it('should reuse connections from pool', async () => {
      const version = TEST_VERSIONS[0];
      const config = TEST_CONFIGS[version];
      if (!config) return;

      const systemId = `reuse-test-${version}`;
      
      // First acquisition
      const conn1 = await connectionPool.acquire(systemId, config);
      const isConnected1 = conn1.isConnected();
      connectionPool.release(conn1, systemId);
      
      // Second acquisition should reuse
      const conn2 = await connectionPool.acquire(systemId, config);
      const isConnected2 = conn2.isConnected();
      connectionPool.release(conn2, systemId);
      
      expect(isConnected1).toBe(true);
      expect(isConnected2).toBe(true);
      expect(conn1).toBe(conn2); // Should be the same instance
    }, 30000);
  });

  describe.skipIf(SKIP_INTEGRATION_TESTS)('Error Handling Tests', () => {
    it('should handle invalid credentials gracefully', async () => {
      const invalidConfig: CMConnectionConfig = {
        ...TEST_CONFIGS[TEST_VERSIONS[0]],
        password: 'invalid_password_12345'
      };
      
      const connector = await CMConnectionFactory.createConnector(invalidConfig);
      
      await expect(connector.connect()).rejects.toThrow();
      expect(connector.isConnected()).toBe(false);
    }, 30000);

    it('should handle network timeouts', async () => {
      const timeoutConfig: CMConnectionConfig = {
        type: 'REST_API',
        baseUrl: 'http://192.168.255.255:9999', // Non-routable IP
        username: 'test',
        password: 'test',
        timeout: 1000 // 1 second timeout
      };
      
      const connector = await CMConnectionFactory.createConnector(timeoutConfig);
      
      await expect(connector.connect()).rejects.toThrow();
    }, 10000);
  });
});

// Helper function to check if a CM instance is available
export async function checkCMAvailability(version: string): Promise<boolean> {
  const config = TEST_CONFIGS[version];
  if (!config) return false;
  
  try {
    const connector = await CMConnectionFactory.createConnector(config);
    await connector.connect();
    const isAvailable = connector.isConnected();
    await connector.disconnect();
    return isAvailable;
  } catch {
    return false;
  }
}

// Report which versions are available for testing
if (!SKIP_INTEGRATION_TESTS && process.env.REPORT_CM_AVAILABILITY === 'true') {
  (async () => {
    console.log('\nChecking CM instance availability...');
    for (const version of TEST_VERSIONS) {
      const available = await checkCMAvailability(version);
      console.log(`CM ${version}: ${available ? '✓ Available' : '✗ Not Available'}`);
    }
  })();
}