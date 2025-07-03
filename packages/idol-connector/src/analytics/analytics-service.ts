import { EventEmitter } from 'events';
import { IDOLConnector, IDOLAnalytics } from '../types';

export interface AnalyticsOptions {
  language?: string;
  maxConcepts?: number;
  maxEntities?: number;
  sentimentGranularity?: 'document' | 'sentence' | 'aspect';
  summaryLength?: 'short' | 'medium' | 'long';
  summaryPercentage?: number;
}

export interface DocumentAnalytics extends IDOLAnalytics {
  documentReference?: string;
  processingTime?: number;
  keywords?: Array<{ keyword: string; score: number }>;
  categories?: Array<{ category: string; confidence: number }>;
  topics?: Array<{ topic: string; relevance: number }>;
}

export interface TrendAnalysis {
  timeRange: { start: Date; end: Date };
  trends: Array<{
    term: string;
    frequency: number[];
    growth: number;
    sentiment: number;
  }>;
  emergingTopics: string[];
  decliningTopics: string[];
}

export interface SentimentTrend {
  positive: number[];
  negative: number[];
  neutral: number[];
  timestamps: Date[];
  overallTrend: 'improving' | 'declining' | 'stable';
}

export class IDOLAnalyticsService extends EventEmitter {
  constructor(private connector: IDOLConnector) {
    super();
  }

  async analyzeDocument(
    content: string,
    options: AnalyticsOptions = {}
  ): Promise<DocumentAnalytics> {
    const startTime = Date.now();
    const analytics: string[] = [
      'sentiment',
      'concepts',
      'entities',
      'language',
      'summary'
    ];

    try {
      const result = await this.connector.analyze(content, analytics);
      
      // Enhance with additional analytics
      const enhanced: DocumentAnalytics = {
        ...result,
        processingTime: Date.now() - startTime,
        keywords: await this.extractKeywords(content, options),
        categories: await this.categorizeContent(content, options),
        topics: await this.extractTopics(content, options)
      };

      this.emit('analytics:complete', enhanced);
      return enhanced;
    } catch (error) {
      this.emit('analytics:error', error);
      throw error;
    }
  }

  async analyzeBatch(
    documents: Array<{ reference: string; content: string }>,
    options: AnalyticsOptions = {}
  ): Promise<Map<string, DocumentAnalytics>> {
    const results = new Map<string, DocumentAnalytics>();
    
    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async doc => {
          const analytics = await this.analyzeDocument(doc.content, options);
          return {
            reference: doc.reference,
            analytics: { ...analytics, documentReference: doc.reference }
          };
        })
      );
      
      batchResults.forEach(({ reference, analytics }) => {
        results.set(reference, analytics);
      });
      
      this.emit('batch:progress', { 
        processed: i + batch.length, 
        total: documents.length 
      });
    }
    
    return results;
  }

  async getSentimentOverTime(
    query: string,
    timeRange: { start: Date; end: Date },
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<SentimentTrend> {
    // Execute time-based queries
    const intervals = this.generateTimeIntervals(timeRange, granularity);
    const sentimentData: SentimentTrend = {
      positive: [],
      negative: [],
      neutral: [],
      timestamps: intervals.map(i => i.start),
      overallTrend: 'stable'
    };

    for (const interval of intervals) {
      const response = await this.connector.query({
        text: query,
        fieldText: `DATERANGE{${interval.start.toISOString()},${interval.end.toISOString()}}:date_modified`,
        maxResults: 100
      });

      // Analyze sentiment for documents in this interval
      let positive = 0, negative = 0, neutral = 0;
      
      for (const doc of response.autnresponse.responsedata.hit || []) {
        if (doc.content) {
          const sentiment = await this.analyzeSentiment(doc.content);
          if (sentiment.positive > 0.6) positive++;
          else if (sentiment.negative > 0.6) negative++;
          else neutral++;
        }
      }

      const total = positive + negative + neutral || 1;
      sentimentData.positive.push((positive / total) * 100);
      sentimentData.negative.push((negative / total) * 100);
      sentimentData.neutral.push((neutral / total) * 100);
    }

    // Determine overall trend
    sentimentData.overallTrend = this.calculateTrend(sentimentData.positive);
    
    return sentimentData;
  }

  async getTrendingTopics(
    database: string,
    timeWindow: number = 7, // days
    options: { minFrequency?: number; maxTopics?: number } = {}
  ): Promise<TrendAnalysis> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - timeWindow * 24 * 60 * 60 * 1000);
    
    // Get concepts from recent documents
    const recentConcepts = await this.getConceptsInTimeRange(
      database,
      { start: startDate, end: endDate }
    );
    
    // Get concepts from previous period for comparison
    const previousStart = new Date(startDate.getTime() - timeWindow * 24 * 60 * 60 * 1000);
    const previousConcepts = await this.getConceptsInTimeRange(
      database,
      { start: previousStart, end: startDate }
    );
    
    // Calculate trends
    const trends = this.calculateConceptTrends(previousConcepts, recentConcepts);
    
    return {
      timeRange: { start: startDate, end: endDate },
      trends: trends.slice(0, options.maxTopics || 20),
      emergingTopics: trends
        .filter(t => t.growth > 50)
        .map(t => t.term)
        .slice(0, 10),
      decliningTopics: trends
        .filter(t => t.growth < -30)
        .map(t => t.term)
        .slice(0, 10)
    };
  }

  async findRelatedContent(
    reference: string,
    options: { 
      maxResults?: number; 
      minSimilarity?: number;
      useConceptual?: boolean;
    } = {}
  ): Promise<Array<{ reference: string; similarity: number; title?: string }>> {
    // Get the original document
    const originalDoc = await this.connector.query({
      fieldText: `DREREFERENCE{${reference}}`,
      maxResults: 1
    });

    if (!originalDoc.autnresponse.responsedata.hit?.length) {
      return [];
    }

    const doc = originalDoc.autnresponse.responsedata.hit[0];
    
    // Find similar documents
    const similarResponse = await this.connector.executeAction({
      action: options.useConceptual ? 'QueryConcept' : 'Query',
      parameters: {
        Text: doc.content?.substring(0, 1000) || doc.title,
        MaxResults: options.maxResults || 10,
        MinScore: options.minSimilarity || 60,
        Predict: true
      }
    });

    // Parse and return results
    return this.parseSimilarityResults(similarResponse, reference);
  }

  async generateInsights(
    database: string,
    options: { focus?: string[] } = {}
  ): Promise<Record<string, any>> {
    const insights: Record<string, any> = {};

    // Content volume trends
    insights.contentGrowth = await this.analyzeContentGrowth(database);
    
    // Topic distribution
    insights.topicDistribution = await this.analyzeTopicDistribution(database);
    
    // Sentiment overview
    insights.sentimentOverview = await this.analyzeSentimentDistribution(database);
    
    // Key entities
    insights.keyEntities = await this.extractKeyEntities(database);
    
    // Content gaps
    insights.contentGaps = await this.identifyContentGaps(database, options.focus);
    
    // Anomalies
    insights.anomalies = await this.detectAnomalies(database);
    
    return insights;
  }

  private async extractKeywords(
    content: string,
    options: AnalyticsOptions
  ): Promise<Array<{ keyword: string; score: number }>> {
    const response = await this.connector.executeAction({
      action: 'GetKeywords',
      parameters: {
        Text: content,
        MaxTerms: 20,
        Language: options.language || 'english'
      }
    });

    return this.parseKeywordsResponse(response);
  }

  private async categorizeContent(
    content: string,
    options: AnalyticsOptions
  ): Promise<Array<{ category: string; confidence: number }>> {
    const response = await this.connector.executeAction({
      action: 'Categorize',
      parameters: {
        Text: content,
        MaxCategories: 5,
        MinScore: 0.3
      }
    });

    return this.parseCategoriesResponse(response);
  }

  private async extractTopics(
    content: string,
    options: AnalyticsOptions
  ): Promise<Array<{ topic: string; relevance: number }>> {
    const response = await this.connector.executeAction({
      action: 'GetTopics',
      parameters: {
        Text: content,
        MaxTopics: 10
      }
    });

    return this.parseTopicsResponse(response);
  }

  private async analyzeSentiment(content: string): Promise<any> {
    const analytics = await this.connector.analyze(content, ['sentiment']);
    return analytics.sentimentAnalysis || { positive: 0, negative: 0, neutral: 1 };
  }

  private generateTimeIntervals(
    timeRange: { start: Date; end: Date },
    granularity: string
  ): Array<{ start: Date; end: Date }> {
    const intervals: Array<{ start: Date; end: Date }> = [];
    const current = new Date(timeRange.start);
    
    while (current < timeRange.end) {
      const intervalEnd = new Date(current);
      
      switch (granularity) {
        case 'hour':
          intervalEnd.setHours(intervalEnd.getHours() + 1);
          break;
        case 'day':
          intervalEnd.setDate(intervalEnd.getDate() + 1);
          break;
        case 'week':
          intervalEnd.setDate(intervalEnd.getDate() + 7);
          break;
        case 'month':
          intervalEnd.setMonth(intervalEnd.getMonth() + 1);
          break;
      }
      
      intervals.push({
        start: new Date(current),
        end: new Date(Math.min(intervalEnd.getTime(), timeRange.end.getTime()))
      });
      
      current.setTime(intervalEnd.getTime());
    }
    
    return intervals;
  }

  private calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' {
    if (values.length < 2) return 'stable';
    
    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.5) return 'stable';
    return slope > 0 ? 'improving' : 'declining';
  }

  private async getConceptsInTimeRange(
    database: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Map<string, number>> {
    const concepts = new Map<string, number>();
    
    const response = await this.connector.query({
      text: '*',
      databases: [database],
      fieldText: `DATERANGE{${timeRange.start.toISOString()},${timeRange.end.toISOString()}}:date_modified`,
      maxResults: 1000
    });

    // Extract concepts from documents
    for (const doc of response.autnresponse.responsedata.hit || []) {
      if (doc.content) {
        const docConcepts = await this.connector.analyze(doc.content, ['concepts']);
        if (docConcepts.conceptExtraction) {
          docConcepts.conceptExtraction.forEach((concept: any) => {
            const current = concepts.get(concept.concept) || 0;
            concepts.set(concept.concept, current + concept.occurrences);
          });
        }
      }
    }
    
    return concepts;
  }

  private calculateConceptTrends(
    previous: Map<string, number>,
    recent: Map<string, number>
  ): Array<any> {
    const trends: Array<any> = [];
    
    // Check all concepts from both periods
    const allConcepts = new Set([...previous.keys(), ...recent.keys()]);
    
    allConcepts.forEach(concept => {
      const prevCount = previous.get(concept) || 0;
      const recentCount = recent.get(concept) || 0;
      
      if (recentCount > 0 || prevCount > 0) {
        const growth = prevCount > 0 
          ? ((recentCount - prevCount) / prevCount) * 100 
          : 100;
          
        trends.push({
          term: concept,
          frequency: [prevCount, recentCount],
          growth,
          sentiment: 0 // Would need to calculate actual sentiment
        });
      }
    });
    
    // Sort by absolute growth
    return trends.sort((a, b) => Math.abs(b.growth) - Math.abs(a.growth));
  }

  private parseSimilarityResults(response: any, excludeReference: string): any[] {
    // Implementation would parse IDOL response format
    return [];
  }

  private parseKeywordsResponse(response: any): any[] {
    // Implementation would parse IDOL response format
    return [];
  }

  private parseCategoriesResponse(response: any): any[] {
    // Implementation would parse IDOL response format
    return [];
  }

  private parseTopicsResponse(response: any): any[] {
    // Implementation would parse IDOL response format
    return [];
  }

  private async analyzeContentGrowth(database: string): Promise<any> {
    // Implementation would analyze content growth over time
    return {};
  }

  private async analyzeTopicDistribution(database: string): Promise<any> {
    // Implementation would analyze topic distribution
    return {};
  }

  private async analyzeSentimentDistribution(database: string): Promise<any> {
    // Implementation would analyze sentiment distribution
    return {};
  }

  private async extractKeyEntities(database: string): Promise<any> {
    // Implementation would extract key entities
    return [];
  }

  private async identifyContentGaps(database: string, focus?: string[]): Promise<any> {
    // Implementation would identify content gaps
    return [];
  }

  private async detectAnomalies(database: string): Promise<any> {
    // Implementation would detect anomalies
    return [];
  }
}