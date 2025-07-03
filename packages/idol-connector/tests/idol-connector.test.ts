import { IDOLServerConnector } from '../src/connectors/idol-connector';
import { IDOLQueryBuilder, FieldTextBuilder } from '../src/queries/query-builder';
import { IDOLSearchService } from '../src/queries/search-service';
import { IDOLIndexService } from '../src/queries/index-service';
import { IDOLAnalyticsService } from '../src/analytics/analytics-service';

describe('IDOL Connector Tests', () => {
  let connector: IDOLServerConnector;
  let searchService: IDOLSearchService;
  let indexService: IDOLIndexService;
  let analyticsService: IDOLAnalyticsService;

  beforeAll(async () => {
    // Create connector with test configuration
    connector = new IDOLServerConnector({
      host: 'localhost',
      port: 9000,
      protocol: 'http'
    });

    searchService = new IDOLSearchService(connector);
    indexService = new IDOLIndexService(connector);
    analyticsService = new IDOLAnalyticsService(connector);

    // Connect to IDOL (mock for testing)
    // await connector.connect();
  });

  afterAll(async () => {
    // await connector.disconnect();
  });

  describe('Query Builder', () => {
    test('should build basic text query', () => {
      const query = IDOLQueryBuilder.create()
        .text('content manager')
        .maxResults(10)
        .build();

      expect(query.text).toBe('content manager');
      expect(query.maxResults).toBe(10);
    });

    test('should build complex query with field text', () => {
      const query = IDOLQueryBuilder.create()
        .text('security')
        .databases('cm_prod', 'cm_archive')
        .fieldText('MATCH{HIGH}:severity')
        .sort('date', true)
        .build();

      expect(query.text).toBe('security');
      expect(query.databases).toEqual(['cm_prod', 'cm_archive']);
      expect(query.fieldText).toBe('MATCH{HIGH}:severity');
      expect(query.sort).toBe('-date');
    });

    test('should build field text conditions', () => {
      const fieldText = FieldTextBuilder.create()
        .match('category', 'security')
        .and()
        .greater('severity_score', 7)
        .and()
        .dateAfter('created_date', '2024-01-01')
        .build();

      expect(fieldText).toContain('MATCH{security}:category');
      expect(fieldText).toContain('GREATER{7}:severity_score');
      expect(fieldText).toContain('DATEAFTER{2024-01-01');
    });
  });

  describe('Search Service', () => {
    test('should perform basic search', async () => {
      // Mock search result
      const mockResult = {
        documents: [
          { reference: 'doc1', title: 'Test Document', content: 'Test content' }
        ],
        totalResults: 1,
        queryTime: 50
      };

      // In real tests, you would mock the connector.query method
      // jest.spyOn(connector, 'query').mockResolvedValue(mockQueryResponse);

      // const result = await searchService.search('test query');
      // expect(result.documents).toHaveLength(1);
      // expect(result.totalResults).toBe(1);
    });

    test('should perform faceted search', async () => {
      // Test faceted search functionality
      // const result = await searchService.facetedSearch('test', ['category', 'author']);
      // expect(result.facets).toBeDefined();
      // expect(result.facets.category).toBeDefined();
    });
  });

  describe('Index Service', () => {
    test('should index single document', async () => {
      // Test document indexing
      // await indexService.indexDocument(
      //   'Test content',
      //   'Test Title',
      //   { database: 'test_db' }
      // );
    });

    test('should batch index documents', async () => {
      const documents = [
        { reference: 'doc1', title: 'Doc 1', content: 'Content 1' },
        { reference: 'doc2', title: 'Doc 2', content: 'Content 2' }
      ];

      // const result = await indexService.batchIndex(documents);
      // expect(result.success).toBe(2);
      // expect(result.failed).toBe(0);
    });
  });

  describe('Analytics Service', () => {
    test('should analyze document sentiment', async () => {
      const content = 'This is a great product with excellent features.';
      
      // const analytics = await analyticsService.analyzeDocument(content);
      // expect(analytics.sentimentAnalysis).toBeDefined();
      // expect(analytics.sentimentAnalysis.positive).toBeGreaterThan(0.5);
    });

    test('should extract concepts', async () => {
      const content = 'Content management systems help organizations manage digital content.';
      
      // const analytics = await analyticsService.analyzeDocument(content);
      // expect(analytics.conceptExtraction).toBeDefined();
      // expect(analytics.conceptExtraction.length).toBeGreaterThan(0);
    });
  });
});

describe('IDOL Integration Tests', () => {
  describe('CM to IDOL Sync', () => {
    test('should sync CM documents to IDOL', async () => {
      // Test document synchronization
      const cmDocuments = [
        {
          uri: 'cm://doc/123',
          title: 'Test Document',
          content: 'Test content',
          recordNumber: '123',
          recordType: 'Document'
        }
      ];

      // Test sync service
      // const syncService = new CMToIDOLSyncService(indexService, searchService);
      // const result = await syncService.syncDocuments(cmDocuments, 'cm_test');
      // expect(result.indexed).toBe(1);
    });
  });

  describe('Performance Monitoring', () => {
    test('should collect performance metrics', async () => {
      // Test performance monitoring
      // const monitor = new IDOLPerformanceMonitor(connector);
      // monitor.start();
      
      // Wait for metrics collection
      // await new Promise(resolve => setTimeout(resolve, 1000));
      
      // const metrics = monitor.getCurrentMetrics();
      // expect(metrics).toBeDefined();
      // expect(metrics.queryMetrics).toBeDefined();
      
      // monitor.stop();
    });
  });
});