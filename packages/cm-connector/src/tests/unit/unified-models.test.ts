import { describe, it, expect } from '@jest/globals';
import {
  UnifiedModelFactory,
  UnifiedModelValidator,
  UnifiedModelTransformer,
  UnifiedSystem,
  UnifiedUser,
  UnifiedRecord,
  UnifiedDocument
} from '../../models/unified-models';

describe('Unified Models', () => {
  describe('UnifiedModelFactory', () => {
    describe('createSystem', () => {
      it('should create a valid system model', () => {
        const data = {
          systemId: 'CM-001',
          name: 'Production CM',
          version: '23.4.0.1234',
          edition: 'Enterprise',
          installDate: new Date('2023-01-15'),
          lastUpgrade: new Date('2024-06-20'),
          database: {
            type: 'SQLServer',
            version: '2019',
            name: 'CM_PROD',
            server: 'sql-prod-01'
          },
          features: ['Records Management', 'IDOL Integration'],
          modules: ['Core', 'Workflow', 'Email'],
          settings: {
            general: { timezone: 'UTC' }
          },
          health: {
            status: 'healthy' as const,
            lastCheck: new Date(),
            issues: 0
          }
        };

        const model = UnifiedModelFactory.createSystem(data, 'test');

        expect(model.type).toBe('system');
        expect(model.id).toBe('CM-001');
        expect(model.attributes.systemId).toBe('CM-001');
        expect(model.attributes.version).toBe('23.4.0.1234');
        expect(model.attributes.features).toHaveLength(2);
        expect(model.metadata.source).toBe('test');
        expect(model.metadata.extractor).toBe('SystemExtractor');
      });

      it('should handle missing optional fields', () => {
        const minimalData = {
          systemId: 'CM-002',
          name: 'Test CM',
          version: '10.0',
          edition: 'Standard',
          installDate: new Date(),
          database: {
            type: 'Oracle',
            version: '19c',
            name: 'CM_TEST',
            server: 'oracle-test'
          }
        };

        const model = UnifiedModelFactory.createSystem(minimalData, 'test');

        expect(model.attributes.lastUpgrade).toBeUndefined();
        expect(model.attributes.features).toEqual([]);
        expect(model.attributes.modules).toEqual([]);
        expect(model.attributes.settings).toEqual({});
      });
    });

    describe('createUser', () => {
      it('should create a valid user model', () => {
        const data = {
          userId: 'USR-001',
          username: 'john.doe',
          email: 'john.doe@example.com',
          fullName: 'John Doe',
          active: true,
          userType: 'admin',
          createdDate: new Date('2023-01-01'),
          lastLogin: new Date('2024-12-01'),
          groups: ['GRP-001', 'GRP-002'],
          roles: ['ROLE-001'],
          permissions: ['PERM-001', 'PERM-002', 'PERM-003'],
          settings: { theme: 'dark' }
        };

        const model = UnifiedModelFactory.createUser(data, 'test');

        expect(model.type).toBe('user');
        expect(model.id).toBe('USR-001');
        expect(model.attributes.username).toBe('john.doe');
        expect(model.attributes.userType).toBe('admin');
        expect(model.relationships.groups.targetIds).toHaveLength(2);
        expect(model.relationships.roles.targetIds).toHaveLength(1);
        expect(model.relationships.permissions.targetIds).toHaveLength(3);
      });

      it('should handle user type variations', () => {
        const data = {
          id: 'USR-002',
          username: 'system.user',
          active: true,
          type: 'system', // Using 'type' instead of 'userType'
          createdDate: new Date()
        };

        const model = UnifiedModelFactory.createUser(data, 'test');

        expect(model.attributes.userType).toBe('system');
      });
    });

    describe('createRecord', () => {
      it('should create a valid record model', () => {
        const data = {
          recordId: 'REC-001',
          recordNumber: '2024/001234',
          title: 'Contract Agreement',
          recordType: 'Contract',
          classification: 'CONT-LEGAL-001',
          dateCreated: new Date('2024-01-15'),
          dateRegistered: new Date('2024-01-16'),
          dateModified: new Date('2024-06-20'),
          status: 'active',
          location: 'LOC-001',
          container: 'BOX-001',
          owner: 'john.doe',
          assignee: 'jane.smith',
          priority: 'high',
          securityLevel: 3,
          retentionSchedule: 'RETAIN-7Y',
          creatorId: 'USR-001',
          customFields: {
            contractValue: 100000,
            department: 'Legal'
          }
        };

        const model = UnifiedModelFactory.createRecord(data, 'test');

        expect(model.type).toBe('record');
        expect(model.attributes.recordNumber).toBe('2024/001234');
        expect(model.attributes.priority).toBe('high');
        expect(model.attributes.customFields?.contractValue).toBe(100000);
        expect(model.relationships.creator.targetIds).toContain('USR-001');
      });

      it('should handle alternative field names', () => {
        const data = {
          id: 'REC-002',
          number: '2024/5678', // Using 'number' instead of 'recordNumber'
          title: 'Test Record',
          recordType: 'General',
          createdDate: new Date(), // Using 'createdDate' instead of 'dateCreated'
          registeredDate: new Date(), // Using 'registeredDate' instead of 'dateRegistered'
          creator: 'admin' // Using 'creator' instead of 'creatorId'
        };

        const model = UnifiedModelFactory.createRecord(data, 'test');

        expect(model.attributes.recordNumber).toBe('2024/5678');
        expect(model.relationships.creator.targetIds).toContain('admin');
      });
    });

    describe('createDocument', () => {
      it('should create a valid document model', () => {
        const data = {
          documentId: 'DOC-001',
          documentNumber: 'DOC-2024-001',
          title: 'Annual Report 2024',
          documentType: 'Report',
          mimeType: 'application/pdf',
          fileSize: 2048000,
          fileName: 'annual_report_2024.pdf',
          dateCreated: new Date('2024-03-01'),
          dateModified: new Date('2024-03-15'),
          dateRegistered: new Date('2024-03-02'),
          version: 2,
          checksum: 'abc123def456',
          isElectronic: true,
          storageLocation: '/storage/reports/2024/',
          url: 'https://cm.example.com/docs/DOC-001',
          author: 'Finance Team',
          keywords: ['annual', 'report', 'finance'],
          description: 'Annual financial report for 2024',
          pageCount: 45,
          recordId: 'REC-001',
          creatorId: 'USR-001'
        };

        const model = UnifiedModelFactory.createDocument(data, 'test');

        expect(model.type).toBe('document');
        expect(model.attributes.fileSize).toBe(2048000);
        expect(model.attributes.keywords).toHaveLength(3);
        expect(model.attributes.version).toBe(2);
        expect(model.relationships.record.targetIds).toContain('REC-001');
      });

      it('should handle hash as checksum', () => {
        const data = {
          id: 'DOC-002',
          number: 'DOC-2024-002',
          title: 'Test Document',
          type: 'General',
          mimeType: 'text/plain',
          fileSize: 1024,
          fileName: 'test.txt',
          createdDate: new Date(),
          registeredDate: new Date(),
          hash: 'xyz789', // Using 'hash' instead of 'checksum'
          record: 'REC-002', // Using 'record' instead of 'recordId'
          creator: 'admin' // Using 'creator' instead of 'creatorId'
        };

        const model = UnifiedModelFactory.createDocument(data, 'test');

        expect(model.attributes.checksum).toBe('xyz789');
        expect(model.attributes.isElectronic).toBe(true); // Default value
      });
    });
  });

  describe('UnifiedModelValidator', () => {
    it('should validate a valid system model', () => {
      const validSystem: UnifiedSystem = {
        id: 'SYS-001',
        type: 'system',
        version: '1.0',
        metadata: {
          source: 'test',
          extracted: new Date(),
          extractor: 'SystemExtractor',
          version: '1.0'
        },
        attributes: {
          systemId: 'SYS-001',
          name: 'Test System',
          version: '23.4',
          edition: 'Enterprise',
          installDate: new Date(),
          database: {
            type: 'SQLServer',
            version: '2019',
            name: 'TestDB',
            server: 'localhost'
          },
          features: ['Feature1'],
          modules: ['Module1'],
          settings: {},
          health: {
            status: 'healthy',
            lastCheck: new Date(),
            issues: 0
          }
        }
      };

      expect(UnifiedModelValidator.validateSystem(validSystem)).toBe(true);
    });

    it('should reject invalid system model', () => {
      const invalidSystem = {
        id: 'SYS-001',
        type: 'invalid-type', // Wrong type
        version: '1.0',
        metadata: {
          source: 'test',
          extracted: new Date(),
          extractor: 'SystemExtractor',
          version: '1.0'
        },
        attributes: {} // Missing required fields
      };

      expect(UnifiedModelValidator.validateSystem(invalidSystem)).toBe(false);
    });
  });

  describe('UnifiedModelTransformer', () => {
    it('should transform model to JSON', () => {
      const model: UnifiedSystem = {
        id: 'SYS-001',
        type: 'system',
        version: '1.0',
        metadata: {
          source: 'test',
          extracted: new Date('2024-01-01T00:00:00Z'),
          extractor: 'SystemExtractor',
          version: '1.0'
        },
        attributes: {
          systemId: 'SYS-001',
          name: 'Test',
          version: '23.4',
          edition: 'Enterprise',
          installDate: new Date('2023-01-01T00:00:00Z'),
          database: {
            type: 'SQLServer',
            version: '2019',
            name: 'TestDB',
            server: 'localhost'
          },
          features: [],
          modules: [],
          settings: {},
          health: {
            status: 'healthy',
            lastCheck: new Date('2024-01-01T00:00:00Z'),
            issues: 0
          }
        }
      };

      const json = UnifiedModelTransformer.toJSON(model);
      expect(typeof json).toBe('string');
      expect(json).toContain('\"type\": \"system\"');
      expect(json).toContain('\"systemId\": \"SYS-001\"');
    });

    it('should transform model to GraphQL format', () => {
      const model: UnifiedUser = {
        id: 'USR-001',
        type: 'user',
        version: '1.0',
        metadata: {
          source: 'test',
          extracted: new Date('2024-01-01T12:00:00Z'),
          extractor: 'UserExtractor',
          version: '1.0'
        },
        attributes: {
          username: 'test.user',
          active: true,
          userType: 'normal',
          createdDate: new Date('2023-01-01T00:00:00Z')
        },
        relationships: {
          groups: { type: 'many-to-many', target: 'group', targetIds: [] },
          roles: { type: 'many-to-many', target: 'role', targetIds: [] },
          permissions: { type: 'many-to-many', target: 'permission', targetIds: [] }
        }
      };

      const graphQL = UnifiedModelTransformer.toGraphQL(model);
      expect(graphQL.metadata.extracted).toBe('2024-01-01T12:00:00.000Z');
      expect(graphQL.type).toBe('user');
    });

    it('should normalize model collection', () => {
      const models = [
        { id: 'SYS-001', type: 'system', version: '1.0', metadata: {}, attributes: {} },
        { id: 'USR-001', type: 'user', version: '1.0', metadata: {}, attributes: {} },
        { id: 'USR-002', type: 'user', version: '1.0', metadata: {}, attributes: {} }
      ] as any[];

      const normalized = UnifiedModelTransformer.normalize(models);

      expect(normalized.size).toBe(3);
      expect(normalized.has('system:SYS-001')).toBe(true);
      expect(normalized.has('user:USR-001')).toBe(true);
      expect(normalized.has('user:USR-002')).toBe(true);
    });

    it('should parse JSON back to model', () => {
      const originalModel = {
        id: 'TEST-001',
        type: 'system',
        version: '1.0',
        metadata: {
          source: 'test',
          extracted: new Date('2024-01-01T00:00:00Z'),
          extractor: 'TestExtractor',
          version: '1.0'
        },
        attributes: {
          test: true
        }
      };

      const json = JSON.stringify(originalModel);
      const parsed = UnifiedModelTransformer.fromJSON(json);

      expect(parsed.id).toBe('TEST-001');
      expect(parsed.metadata.extracted).toBeInstanceOf(Date);
      expect(parsed.metadata.extracted.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });
  });
});
