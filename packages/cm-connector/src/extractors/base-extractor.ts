import { CMDataExtractor, CMConnector, CMVersionAdapter } from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';
import { z } from 'zod';

const monitoring = getMonitoring();

export abstract class BaseExtractor<T> implements CMDataExtractor<T> {
  protected logger: any;
  protected metrics: any;

  constructor(
    protected connector: CMConnector,
    protected adapter: CMVersionAdapter,
    protected extractorName: string
  ) {
    this.logger = monitoring.getLogger({ 
      component: 'data-extractor',
      extractor: extractorName 
    });
    this.metrics = monitoring.getMetrics();
  }

  abstract extract(): Promise<T>;
  abstract validate(data: T): boolean;
  abstract transform(data: T): any;
  abstract getSchema(): z.ZodSchema<any>;

  async extractWithValidation(): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting data extraction: ${this.extractorName}`);
      
      // Extract data
      const rawData = await this.extract();
      
      // Validate data
      if (!this.validate(rawData)) {
        throw new Error('Data validation failed');
      }
      
      // Transform data
      const transformedData = this.transform(rawData);
      
      const duration = Date.now() - startTime;
      this.metrics.record('data_extraction_duration', duration, {
        extractor: this.extractorName,
        success: true
      });
      
      this.logger.info(`Data extraction completed: ${this.extractorName}`, { duration });
      
      return transformedData;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.record('data_extraction_duration', duration, {
        extractor: this.extractorName,
        success: false
      });
      
      this.metrics.increment('data_extraction_errors', {
        extractor: this.extractorName
      });
      
      this.logger.error(`Data extraction failed: ${this.extractorName}`, error as Error);
      throw error;
    }
  }

  protected async executeQuery(query: any): Promise<any[]> {
    return this.connector.executeQuery(query);
  }

  protected chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  protected async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const batches = this.chunkArray(items, batchSize);
    const results: R[] = [];
    
    for (const batch of batches) {
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    
    return results;
  }
}