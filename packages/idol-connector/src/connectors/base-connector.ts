import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';
import { EventEmitter } from 'events';
import winston from 'winston';
import NodeCache from 'node-cache';
import PQueue from 'p-queue';
import {
  IDOLConnection,
  IDOLConnector,
  IDOLQueryParams,
  IDOLQueryResponse,
  IDOLIndexDocument,
  IDOLStatus,
  IDOLDatabase,
  IDOLAction,
  IDOLAnalytics,
  IDOLError,
  IDOLMetrics
} from '../types';

export abstract class BaseIDOLConnector extends EventEmitter implements IDOLConnector {
  protected connection: IDOLConnection;
  protected client: AxiosInstance;
  protected logger: winston.Logger;
  protected cache: NodeCache;
  protected queue: PQueue;
  protected connected: boolean = false;
  protected metrics: IDOLMetrics;

  constructor(connection: IDOLConnection) {
    super();
    this.connection = connection;
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    this.queue = new PQueue({ concurrency: 5 });
    this.metrics = this.initializeMetrics();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.client = axios.create({
      baseURL: `${connection.protocol}://${connection.host}:${connection.port}`,
      timeout: 30000,
      headers: {
        'Accept': 'application/xml',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: connection.username && connection.password ? {
        username: connection.username,
        password: connection.password
      } : undefined
    });

    this.setupInterceptors();
  }

  private initializeMetrics(): IDOLMetrics {
    return {
      totalQueries: 0,
      averageQueryTime: 0,
      totalIndexOperations: 0,
      averageIndexTime: 0,
      errorRate: 0,
      cacheHitRate: 0,
      activeConnections: 0
    };
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        this.metrics.activeConnections++;
        this.logger.debug(`IDOL Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.metrics.activeConnections--;
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.metrics.activeConnections--;
        return response;
      },
      (error) => {
        this.metrics.activeConnections--;
        this.logger.error('IDOL Request failed:', error.message);
        throw this.handleError(error);
      }
    );
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to IDOL server...');
      
      // Test connection with GetStatus action
      const status = await this.executeAction({
        action: 'GetStatus'
      });

      if (status) {
        this.connected = true;
        this.emit('connected', this.connection);
        this.logger.info('Successfully connected to IDOL server');
      }
    } catch (error) {
      this.connected = false;
      throw this.handleError(error);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.cache.flushAll();
    await this.queue.clear();
    this.emit('disconnected');
    this.logger.info('Disconnected from IDOL server');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(params: IDOLQueryParams): Promise<IDOLQueryResponse> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey('query', params);
    
    // Check cache
    const cached = this.cache.get<IDOLQueryResponse>(cacheKey);
    if (cached) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * this.metrics.totalQueries + 1) / (this.metrics.totalQueries + 1);
      return cached;
    }

    try {
      const response = await this.queue.add(async () => {
        return await this.executeAction({
          action: 'Query',
          parameters: this.buildQueryParameters(params)
        });
      });

      const result = await this.parseQueryResponse(response);
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.updateQueryMetrics(duration);
      
      // Cache result
      this.cache.set(cacheKey, result);
      
      this.emit('query', { params, result, duration });
      return result;
    } catch (error) {
      this.metrics.errorRate++;
      throw error;
    }
  }

  async index(documents: IDOLIndexDocument[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Build IDOL index format
      const indexData = this.buildIndexData(documents);
      
      await this.queue.add(async () => {
        return await this.executeAction({
          action: 'DRESADD',
          parameters: {
            Data: indexData
          }
        });
      });

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateIndexMetrics(duration);
      
      this.emit('indexed', { count: documents.length, duration });
      this.logger.info(`Indexed ${documents.length} documents`);
    } catch (error) {
      this.metrics.errorRate++;
      throw error;
    }
  }

  async delete(references: string[]): Promise<void> {
    try {
      await this.queue.add(async () => {
        return await this.executeAction({
          action: 'DREDELETEDOC',
          parameters: {
            Docs: references.join(',')
          }
        });
      });

      this.emit('deleted', { references });
      this.logger.info(`Deleted ${references.length} documents`);
    } catch (error) {
      this.metrics.errorRate++;
      throw error;
    }
  }

  async getStatus(): Promise<IDOLStatus> {
    const cacheKey = 'idol:status';
    const cached = this.cache.get<IDOLStatus>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.executeAction({
        action: 'GetStatus'
      });

      const status = await this.parseStatusResponse(response);
      this.cache.set(cacheKey, status, 30); // Cache for 30 seconds
      
      return status;
    } catch (error) {
      return {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getDatabases(): Promise<IDOLDatabase[]> {
    const response = await this.executeAction({
      action: 'GetDatabases'
    });

    return this.parseDatabasesResponse(response);
  }

  async executeAction(action: IDOLAction): Promise<any> {
    if (!this.connected && action.action !== 'GetStatus') {
      throw new Error('Not connected to IDOL server');
    }

    const params = new URLSearchParams();
    params.append('action', action.action);
    
    if (action.parameters) {
      Object.entries(action.parameters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    try {
      const response = await this.client.post('/action', params, {
        timeout: action.timeout || 30000,
        maxRedirects: 0
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async analyze(content: string, analytics: string[]): Promise<IDOLAnalytics> {
    const results: IDOLAnalytics = {};

    const analysisPromises = analytics.map(async (type) => {
      switch (type) {
        case 'sentiment':
          results.sentimentAnalysis = await this.analyzeSentiment(content);
          break;
        case 'concepts':
          results.conceptExtraction = await this.extractConcepts(content);
          break;
        case 'entities':
          results.entityExtraction = await this.extractEntities(content);
          break;
        case 'language':
          results.languageDetection = await this.detectLanguage(content);
          break;
        case 'summary':
          results.summarization = await this.summarize(content);
          break;
      }
    });

    await Promise.all(analysisPromises);
    return results;
  }

  protected abstract buildQueryParameters(params: IDOLQueryParams): Record<string, any>;
  protected abstract parseQueryResponse(data: any): Promise<IDOLQueryResponse>;
  protected abstract parseStatusResponse(data: any): Promise<IDOLStatus>;
  protected abstract parseDatabasesResponse(data: any): Promise<IDOLDatabase[]>;
  protected abstract buildIndexData(documents: IDOLIndexDocument[]): string;

  private async analyzeSentiment(content: string): Promise<any> {
    const response = await this.executeAction({
      action: 'GetSentiment',
      parameters: { Text: content }
    });
    return this.parseSentimentResponse(response);
  }

  private async extractConcepts(content: string): Promise<any> {
    const response = await this.executeAction({
      action: 'GetConcepts',
      parameters: { Text: content }
    });
    return this.parseConceptsResponse(response);
  }

  private async extractEntities(content: string): Promise<any> {
    const response = await this.executeAction({
      action: 'GetEntities',
      parameters: { Text: content }
    });
    return this.parseEntitiesResponse(response);
  }

  private async detectLanguage(content: string): Promise<any> {
    const response = await this.executeAction({
      action: 'LanguageIdentify',
      parameters: { Text: content }
    });
    return this.parseLanguageResponse(response);
  }

  private async summarize(content: string): Promise<any> {
    const response = await this.executeAction({
      action: 'Summarize',
      parameters: { Text: content }
    });
    return this.parseSummaryResponse(response);
  }

  protected abstract parseSentimentResponse(data: any): Promise<any>;
  protected abstract parseConceptsResponse(data: any): Promise<any>;
  protected abstract parseEntitiesResponse(data: any): Promise<any>;
  protected abstract parseLanguageResponse(data: any): Promise<any>;
  protected abstract parseSummaryResponse(data: any): Promise<any>;

  private getCacheKey(prefix: string, params: any): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  private updateQueryMetrics(duration: number): void {
    this.metrics.totalQueries++;
    this.metrics.averageQueryTime = 
      (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + duration) / 
      this.metrics.totalQueries;
  }

  private updateIndexMetrics(duration: number): void {
    this.metrics.totalIndexOperations++;
    this.metrics.averageIndexTime = 
      (this.metrics.averageIndexTime * (this.metrics.totalIndexOperations - 1) + duration) / 
      this.metrics.totalIndexOperations;
  }

  private handleError(error: any): IDOLError {
    const idolError = new Error(error.message) as IDOLError;
    idolError.code = error.code || 'IDOL_ERROR';
    idolError.details = error.response?.data || error;
    return idolError;
  }

  getMetrics(): IDOLMetrics {
    return { ...this.metrics };
  }
}