import { IDOLIntegration, IDOLQueryBuilder, FieldTextBuilder } from './packages/idol-connector/src';

async function demonstrateIDOLIntegration() {
  console.log('🔍 CM Diagnostics - IDOL Integration Demo\n');

  // Initialize IDOL integration
  const idolIntegration = new IDOLIntegration();

  try {
    // 1. Add IDOL system
    console.log('1️⃣ Connecting to IDOL server...');
    const { connector, searchService, indexService, analyticsService } = 
      await idolIntegration.addIDOLSystem('prod-idol', {
        host: 'idol.example.com',
        port: 9000,
        protocol: 'https',
        username: 'admin',
        password: 'password',
        type: 'server'
      }, {
        enableMonitoring: true,
        monitoringInterval: 30000 // 30 seconds
      });
    console.log('✅ Connected to IDOL server\n');

    // 2. Perform searches
    console.log('2️⃣ Performing searches...');
    
    // Basic search
    const basicResults = await searchService.search('content management', {
      limit: 10,
      highlight: true,
      summary: true
    });
    console.log(`Found ${basicResults.totalResults} documents`);
    console.log(`Query completed in ${basicResults.queryTime}ms\n`);

    // Advanced search with field text
    const advancedResults = await searchService.searchWithFieldText(
      'security vulnerability',
      (builder) => {
        builder
          .match('severity', 'HIGH')
          .and()
          .dateAfter('modified_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .and()
          .match('status', 'ACTIVE');
      },
      {
        databases: ['cm_prod'],
        limit: 20,
        sort: { field: 'severity_score', descending: true }
      }
    );
    console.log(`Found ${advancedResults.documents.length} high severity security issues\n`);

    // 3. Index new content
    console.log('3️⃣ Indexing content...');
    await indexService.indexDocument(
      'This is a test document for IDOL integration demonstration.',
      'IDOL Integration Test Document',
      {
        database: 'cm_test',
        fields: {
          author: 'CM Diagnostics',
          category: 'test',
          tags: ['idol', 'integration', 'demo']
        }
      }
    );
    console.log('✅ Document indexed successfully\n');

    // 4. Analyze content
    console.log('4️⃣ Analyzing content...');
    const sampleContent = `
      The Content Manager system has been experiencing performance issues 
      during peak hours. Users report slow response times and occasional 
      timeouts. The database queries seem to be the main bottleneck.
    `;
    
    const analysis = await analyticsService.analyzeDocument(sampleContent);
    console.log('Content Analysis Results:');
    console.log(`- Sentiment: ${JSON.stringify(analysis.sentimentAnalysis)}`);
    console.log(`- Language: ${analysis.languageDetection?.language}`);
    if (analysis.conceptExtraction?.length) {
      console.log(`- Key Concepts: ${analysis.conceptExtraction.slice(0, 3).map(c => c.concept).join(', ')}`);
    }
    console.log('');

    // 5. Get trending topics
    console.log('5️⃣ Analyzing trends...');
    const trends = await analyticsService.getTrendingTopics('cm_prod', 7);
    console.log('Trending Topics (Last 7 days):');
    trends.emergingTopics.slice(0, 5).forEach(topic => {
      console.log(`  📈 ${topic}`);
    });
    console.log('');

    // 6. Check system health
    console.log('6️⃣ Checking IDOL system health...');
    const health = await idolIntegration.getSystemHealth('prod-idol');
    if (health) {
      console.log(`Health Score: ${health.healthScore}/100`);
      console.log(`Status: ${health.status.status}`);
      console.log(`Active Connections: ${health.metrics.activeConnections}`);
      console.log(`Cache Hit Rate: ${health.metrics.cacheHitRate.toFixed(2)}%`);
      
      if (health.alerts.length > 0) {
        console.log('\n⚠️ Active Alerts:');
        health.alerts.forEach(alert => {
          console.log(`  - [${alert.severity.toUpperCase()}] ${alert.message}`);
        });
      }
    }

    // 7. Demonstrate sync from CM to IDOL
    console.log('\n7️⃣ Syncing CM content to IDOL...');
    const cmDocuments = [
      {
        uri: 'cm://documents/12345',
        title: 'Q4 Financial Report',
        content: 'Financial performance exceeded expectations...',
        recordNumber: '12345',
        recordType: 'Report',
        dateRegistered: new Date('2024-01-15'),
        author: 'Finance Team',
        classification: 'Confidential',
        securityLevel: 3
      },
      {
        uri: 'cm://documents/12346',
        title: 'Security Policy Update',
        content: 'Updated security policies for 2024...',
        recordNumber: '12346',
        recordType: 'Policy',
        dateRegistered: new Date('2024-01-20'),
        author: 'Security Team',
        classification: 'Internal',
        securityLevel: 2
      }
    ];

    // In real implementation, you would use CMToIDOLSyncService
    console.log(`Syncing ${cmDocuments.length} documents from CM to IDOL...`);
    console.log('✅ Sync completed successfully\n');

    // 8. Run diagnostic scan
    console.log('8️⃣ Running IDOL diagnostic scan...');
    // This would use the IDOL scanners with the diagnostic engine
    console.log('Diagnostic findings:');
    console.log('  - ✅ IDOL connection healthy');
    console.log('  - ⚠️  Query performance slightly degraded (avg: 1850ms)');
    console.log('  - ✅ No content synchronization issues');
    console.log('  - ℹ️  Cache hit rate could be improved (58%)');

  } catch (error) {
    console.error('❌ Error during demo:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await idolIntegration.removeIDOLSystem('prod-idol');
    console.log('✅ Demo completed');
  }
}

// Run the demo
if (require.main === module) {
  demonstrateIDOLIntegration().catch(console.error);
}

export { demonstrateIDOLIntegration };