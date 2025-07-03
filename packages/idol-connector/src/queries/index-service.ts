import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import { IDOLConnector, IDOLIndexDocument, IDOLDatabase } from '../types';

export interface IndexOptions {
  database?: string;
  reference?: string;
  security?: Array<{ type: string; value: string }>;
  fields?: Record<string, any>;
  language?: string;
  batchSize?: number;
  queueConcurrency?: number;
}

export interface BatchIndexResult {
  success: number;
  failed: number;
  errors: Array<{ document: IDOLIndexDocument; error: Error }>;
  duration: number;
}

export interface ContentUpdate {
  reference: string;
  fields: Record<string, any>;
  mode: 'replace' | 'append';
}

export class IDOLIndexService extends EventEmitter {
  private queue: PQueue;
  private defaultBatchSize = 100;
  private indexStats = {
    totalIndexed: 0,
    totalFailed: 0,
    averageIndexTime: 0
  };

  constructor(private connector: IDOLConnector) {
    super();
    this.queue = new PQueue({ concurrency: 3 });
  }

  async indexDocument(
    content: string,
    title: string,
    options: IndexOptions = {}
  ): Promise<void> {
    const document: IDOLIndexDocument = {
      reference: options.reference || this.generateReference(),
      content,
      title,
      database: options.database,
      fields: options.fields,
      security: options.security
    };

    await this.indexDocuments([document]);
  }

  async indexDocuments(documents: IDOLIndexDocument[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.connector.index(documents);
      
      this.updateStats(documents.length, 0, Date.now() - startTime);
      this.emit('index:success', { count: documents.length });
    } catch (error) {
      this.updateStats(0, documents.length, Date.now() - startTime);
      this.emit('index:error', { error, documents });
      throw error;
    }
  }

  async batchIndex(
    documents: IDOLIndexDocument[],
    options: { batchSize?: number } = {}
  ): Promise<BatchIndexResult> {
    const batchSize = options.batchSize || this.defaultBatchSize;
    const startTime = Date.now();
    const result: BatchIndexResult = {
      success: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    // Split documents into batches
    const batches = this.createBatches(documents, batchSize);
    
    // Process batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.emit('batch:progress', { current: i + 1, total: batches.length });
      
      try {
        await this.queue.add(async () => {
          await this.connector.index(batch);
        });
        
        result.success += batch.length;
      } catch (error) {
        result.failed += batch.length;
        batch.forEach(doc => {
          result.errors.push({ document: doc, error: error as Error });
        });
      }
    }

    result.duration = Date.now() - startTime;
    this.emit('batch:complete', result);
    
    return result;
  }

  async indexFromCM(
    cmDocuments: any[],
    transformer: (doc: any) => IDOLIndexDocument,
    options: IndexOptions = {}
  ): Promise<BatchIndexResult> {
    const idolDocuments = cmDocuments.map(doc => {
      const transformed = transformer(doc);
      return {
        ...transformed,
        database: options.database || transformed.database,
        fields: { ...options.fields, ...transformed.fields }
      };
    });

    return this.batchIndex(idolDocuments, { batchSize: options.batchSize });
  }

  async updateDocument(update: ContentUpdate): Promise<void> {
    if (update.mode === 'replace') {
      // Delete and re-index
      await this.deleteDocuments([update.reference]);
      
      // Fetch existing document first
      const existing = await this.getDocument(update.reference);
      if (existing) {
        await this.indexDocument(
          existing.content,
          existing.title || '',
          {
            reference: update.reference,
            fields: { ...existing.fields, ...update.fields }
          }
        );
      }
    } else {
      // IDOL doesn't support direct field updates, so we need to re-index
      const existing = await this.getDocument(update.reference);
      if (existing) {
        await this.indexDocument(
          existing.content,
          existing.title || '',
          {
            reference: update.reference,
            fields: { ...existing.fields, ...update.fields }
          }
        );
      }
    }
  }

  async deleteDocument(reference: string): Promise<void> {
    await this.deleteDocuments([reference]);
  }

  async deleteDocuments(references: string[]): Promise<void> {
    try {
      await this.connector.delete(references);
      this.emit('delete:success', { references });
    } catch (error) {
      this.emit('delete:error', { error, references });
      throw error;
    }
  }

  async deleteByQuery(query: string, database?: string): Promise<number> {
    // First, find documents matching the query
    const searchResult = await this.connector.query({
      text: query,
      databases: database ? [database] : undefined,
      maxResults: 10000,
      print: 'reference'
    });

    const references = (searchResult.autnresponse.responsedata.hit || [])
      .map(doc => doc.reference)
      .filter(Boolean);

    if (references.length > 0) {
      await this.deleteDocuments(references);
    }

    return references.length;
  }

  async createDatabase(name: string, options: any = {}): Promise<void> {
    await this.connector.executeAction({
      action: 'DRECREATEDBASE',
      parameters: {
        DatabaseName: name,
        ...options
      }
    });
    
    this.emit('database:created', { name });
  }

  async deleteDatabase(name: string): Promise<void> {
    await this.connector.executeAction({
      action: 'DREDELETEDBASE',
      parameters: {
        DatabaseName: name
      }
    });
    
    this.emit('database:deleted', { name });
  }

  async getDatabases(): Promise<IDOLDatabase[]> {
    return this.connector.getDatabases();
  }

  async optimizeDatabase(name?: string): Promise<void> {
    await this.connector.executeAction({
      action: 'DRECOMPACT',
      parameters: name ? { DatabaseName: name } : {}
    });
    
    this.emit('database:optimized', { name });
  }

  async getIndexStats(): Promise<any> {
    return {
      ...this.indexStats,
      databases: await this.getDatabases()
    };
  }

  async validateDocument(document: IDOLIndexDocument): Promise<string[]> {
    const errors: string[] = [];

    if (!document.reference) {
      errors.push('Document reference is required');
    }
    if (!document.content) {
      errors.push('Document content is required');
    }
    if (document.content && document.content.length > 1048576) {
      errors.push('Document content exceeds maximum size (1MB)');
    }
    if (document.reference && document.reference.length > 255) {
      errors.push('Document reference exceeds maximum length (255 chars)');
    }

    return errors;
  }

  private async getDocument(reference: string): Promise<IDOLDocument | null> {
    const result = await this.connector.query({
      fieldText: `DREREFERENCE{${reference}}`,
      maxResults: 1
    });

    const hits = result.autnresponse.responsedata.hit;
    return hits && hits.length > 0 ? hits[0] : null;
  }

  private generateReference(): string {
    return `doc-${Date.now()}-${uuidv4()}`;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateStats(success: number, failed: number, duration: number): void {
    this.indexStats.totalIndexed += success;
    this.indexStats.totalFailed += failed;
    
    const totalOps = this.indexStats.totalIndexed + this.indexStats.totalFailed;
    this.indexStats.averageIndexTime = 
      (this.indexStats.averageIndexTime * (totalOps - success - failed) + duration) / totalOps;
  }
}