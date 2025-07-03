import { EventEmitter } from 'events';
import { IDOLIndexService } from './index-service';
import { IDOLSearchService } from './search-service';
import { IDOLIndexDocument } from '../types';

export interface SyncOptions {
  batchSize?: number;
  deleteOrphaned?: boolean;
  updateExisting?: boolean;
  fieldMapping?: Record<string, string>;
  contentTransformer?: (content: any) => string;
  filter?: (item: any) => boolean;
}

export interface SyncResult {
  indexed: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: number;
  duration: number;
  errors: Array<{ item: any; error: Error }>;
}

export interface CMDocument {
  uri: string;
  title: string;
  content?: string;
  recordNumber?: string;
  recordType?: string;
  dateRegistered?: Date;
  dateModified?: Date;
  author?: string;
  container?: string;
  classification?: string;
  securityLevel?: number;
  metadata?: Record<string, any>;
}

export class CMToIDOLSyncService extends EventEmitter {
  constructor(
    private indexService: IDOLIndexService,
    private searchService: IDOLSearchService
  ) {
    super();
  }

  async syncDocuments(
    cmDocuments: CMDocument[],
    database: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      indexed: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      duration: 0,
      errors: []
    };

    this.emit('sync:start', { total: cmDocuments.length, database });

    // Filter documents if filter provided
    const documentsToSync = options.filter 
      ? cmDocuments.filter(options.filter)
      : cmDocuments;

    // Check for existing documents if updating
    const existingRefs = options.updateExisting 
      ? await this.getExistingReferences(database)
      : new Set<string>();

    // Process documents in batches
    const batchSize = options.batchSize || 100;
    const batches = this.createBatches(documentsToSync, batchSize);

    for (let i = 0; i < batches.length; i++) {
      this.emit('sync:progress', { 
        current: i * batchSize, 
        total: documentsToSync.length 
      });

      try {
        const batch = batches[i];
        const idolDocuments: IDOLIndexDocument[] = [];

        for (const cmDoc of batch) {
          try {
            const reference = this.generateReference(cmDoc);
            const isUpdate = existingRefs.has(reference);

            if (isUpdate && !options.updateExisting) {
              result.skipped++;
              continue;
            }

            const idolDoc = this.transformDocument(cmDoc, database, options);
            idolDocuments.push(idolDoc);

            if (isUpdate) {
              existingRefs.delete(reference);
            }
          } catch (error) {
            result.failed++;
            result.errors.push({ item: cmDoc, error: error as Error });
          }
        }

        // Index the batch
        if (idolDocuments.length > 0) {
          const indexResult = await this.indexService.batchIndex(idolDocuments);
          result.indexed += indexResult.success;
          result.failed += indexResult.failed;
          
          indexResult.errors.forEach(err => {
            result.errors.push({ 
              item: batch.find(d => this.generateReference(d) === err.document.reference),
              error: err.error 
            });
          });
        }
      } catch (error) {
        this.emit('sync:batch:error', { batch: i, error });
      }
    }

    // Handle orphaned documents
    if (options.deleteOrphaned && existingRefs.size > 0) {
      const orphanedRefs = Array.from(existingRefs);
      await this.indexService.deleteDocuments(orphanedRefs);
      result.deleted = orphanedRefs.length;
      this.emit('sync:orphaned:deleted', { count: orphanedRefs.length });
    }

    result.duration = Date.now() - startTime;
    this.emit('sync:complete', result);

    return result;
  }

  async syncFromQuery(
    cmQueryResults: any[],
    database: string,
    documentExtractor: (result: any) => CMDocument,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const cmDocuments = cmQueryResults.map(documentExtractor);
    return this.syncDocuments(cmDocuments, database, options);
  }

  private transformDocument(
    cmDoc: CMDocument,
    database: string,
    options: SyncOptions
  ): IDOLIndexDocument {
    const reference = this.generateReference(cmDoc);
    
    // Build content
    let content = cmDoc.content || '';
    if (options.contentTransformer) {
      content = options.contentTransformer(cmDoc);
    } else if (!content) {
      // Default content if none provided
      content = `${cmDoc.title}\n${JSON.stringify(cmDoc.metadata || {})}`;
    }

    // Map fields
    const fields: Record<string, any> = {
      cm_uri: cmDoc.uri,
      cm_record_number: cmDoc.recordNumber,
      cm_record_type: cmDoc.recordType,
      cm_author: cmDoc.author,
      cm_container: cmDoc.container,
      cm_classification: cmDoc.classification,
      date_registered: cmDoc.dateRegistered?.toISOString(),
      date_modified: cmDoc.dateModified?.toISOString()
    };

    // Apply field mapping
    if (options.fieldMapping) {
      Object.entries(options.fieldMapping).forEach(([cmField, idolField]) => {
        const value = (cmDoc as any)[cmField] || cmDoc.metadata?.[cmField];
        if (value !== undefined) {
          fields[idolField] = value;
        }
      });
    }

    // Add all metadata fields
    if (cmDoc.metadata) {
      Object.entries(cmDoc.metadata).forEach(([key, value]) => {
        fields[`meta_${key}`] = value;
      });
    }

    // Build security
    const security: Array<{ type: string; value: string }> = [];
    if (cmDoc.securityLevel !== undefined) {
      security.push({ type: 'SECURITY_LEVEL', value: String(cmDoc.securityLevel) });
    }
    if (cmDoc.classification) {
      security.push({ type: 'CLASSIFICATION', value: cmDoc.classification });
    }

    return {
      reference,
      title: cmDoc.title,
      content,
      database,
      fields,
      security: security.length > 0 ? security : undefined
    };
  }

  private generateReference(cmDoc: CMDocument): string {
    if (cmDoc.uri) {
      return `cm:${cmDoc.uri}`;
    } else if (cmDoc.recordNumber) {
      return `cm:record:${cmDoc.recordNumber}`;
    } else {
      return `cm:doc:${cmDoc.title.replace(/[^a-zA-Z0-9]/g, '-')}`;
    }
  }

  private async getExistingReferences(database: string): Promise<Set<string>> {
    const references = new Set<string>();
    let start = 0;
    const batchSize = 1000;

    while (true) {
      const result = await this.searchService.search('*', {
        databases: [database],
        limit: batchSize,
        offset: start,
        fields: ['DREREFERENCE']
      });

      result.documents.forEach(doc => {
        if (doc.reference.startsWith('cm:')) {
          references.add(doc.reference);
        }
      });

      if (result.documents.length < batchSize) {
        break;
      }

      start += batchSize;
    }

    return references;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}