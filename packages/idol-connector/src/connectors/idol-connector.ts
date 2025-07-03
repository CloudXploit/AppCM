import { parseStringPromise } from 'xml2js';
import { BaseIDOLConnector } from './base-connector';
import {
  IDOLQueryParams,
  IDOLQueryResponse,
  IDOLStatus,
  IDOLDatabase,
  IDOLIndexDocument,
  IDOLDocument
} from '../types';

export class IDOLServerConnector extends BaseIDOLConnector {
  protected buildQueryParameters(params: IDOLQueryParams): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (params.text) parameters.Text = params.text;
    if (params.databases?.length) parameters.DatabaseMatch = params.databases.join(',');
    if (params.maxResults) parameters.MaxResults = params.maxResults;
    if (params.start) parameters.Start = params.start;
    if (params.print) parameters.Print = params.print;
    if (params.printFields?.length) parameters.PrintFields = params.printFields.join(',');
    if (params.sort) parameters.Sort = params.sort;
    if (params.minScore) parameters.MinScore = params.minScore;
    if (params.totalResults !== undefined) parameters.TotalResults = params.totalResults;
    if (params.summary !== undefined) parameters.Summary = params.summary;
    if (params.highlight !== undefined) parameters.Highlight = params.highlight;
    if (params.languageType) parameters.LanguageType = params.languageType;
    if (params.outputEncoding) parameters.OutputEncoding = params.outputEncoding;
    if (params.fieldText) parameters.FieldText = params.fieldText;
    if (params.combine) parameters.Combine = params.combine;
    if (params.prediction !== undefined) parameters.Prediction = params.prediction;
    if (params.querySummary !== undefined) parameters.QuerySummary = params.querySummary;
    if (params.spellCheck !== undefined) parameters.SpellCheck = params.spellCheck;

    return parameters;
  }

  protected async parseQueryResponse(data: string): Promise<IDOLQueryResponse> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true,
        parseNumbers: true
      });

      const response = parsed.autnresponse;
      const responseData = response.responsedata || {};

      // Parse hits
      let hits: IDOLDocument[] = [];
      if (responseData.hit) {
        const hitArray = Array.isArray(responseData.hit) ? responseData.hit : [responseData.hit];
        hits = hitArray.map((hit: any) => ({
          reference: hit.reference || '',
          title: hit.title,
          content: hit.content,
          database: hit.database,
          weight: hit.weight,
          links: hit.links,
          date: hit.date ? new Date(hit.date) : undefined,
          fields: this.parseFields(hit),
          highlight: hit.highlight,
          summary: hit.summary
        }));
      }

      return {
        autnresponse: {
          action: response.action || '',
          response: response.response || '',
          responsedata: {
            numhits: responseData.numhits || 0,
            totalhits: responseData.totalhits,
            hit: hits,
            warning: responseData.warning,
            error: responseData.error
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to parse query response:', error);
      throw new Error('Invalid IDOL query response format');
    }
  }

  protected async parseStatusResponse(data: string): Promise<IDOLStatus> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true,
        parseNumbers: true
      });

      const response = parsed.autnresponse?.responsedata || {};

      return {
        status: 'running',
        version: response.version,
        uptime: response.uptime,
        totalDocuments: response.totaldocuments,
        indexSize: response.indexsize,
        performance: {
          queryRate: response.queryrate || 0,
          indexRate: response.indexrate || 0,
          cpuUsage: response.cpuusage || 0,
          memoryUsage: response.memoryusage || 0
        }
      };
    } catch (error) {
      this.logger.error('Failed to parse status response:', error);
      throw new Error('Invalid IDOL status response format');
    }
  }

  protected async parseDatabasesResponse(data: string): Promise<IDOLDatabase[]> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true,
        parseNumbers: true
      });

      const databases = parsed.autnresponse?.responsedata?.databases?.database || [];
      const dbArray = Array.isArray(databases) ? databases : [databases];

      return dbArray.map((db: any) => ({
        name: db.name,
        documents: db.documents || 0,
        size: db.size || 0,
        internal: db.internal === 'true',
        readonly: db.readonly === 'true',
        fields: db.fields ? db.fields.split(',') : []
      }));
    } catch (error) {
      this.logger.error('Failed to parse databases response:', error);
      throw new Error('Invalid IDOL databases response format');
    }
  }

  protected buildIndexData(documents: IDOLIndexDocument[]): string {
    const idxData = documents.map(doc => {
      const sections: string[] = [];
      
      sections.push('#DREREFERENCE ' + doc.reference);
      if (doc.title) sections.push('#DRETITLE ' + doc.title);
      if (doc.database) sections.push('#DREDATABASE ' + doc.database);
      
      // Add custom fields
      if (doc.fields) {
        Object.entries(doc.fields).forEach(([field, value]) => {
          sections.push(`#DREFIELD ${field}="${value}"`);
        });
      }
      
      // Add security
      if (doc.security) {
        doc.security.forEach(sec => {
          sections.push(`#DRESECURITY ${sec.type}=${sec.value}`);
        });
      }
      
      sections.push('#DRECONTENT');
      sections.push(doc.content);
      sections.push('#DREENDDOC');
      
      return sections.join('\n');
    });

    return '#DREFORMAT IDX\n' + idxData.join('\n') + '\n#DREENDDATANOOP';
  }

  protected async parseSentimentResponse(data: string): Promise<any> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true,
        parseNumbers: true
      });

      const sentiment = parsed.autnresponse?.responsedata?.sentiment || {};
      
      return {
        positive: sentiment.positive || 0,
        negative: sentiment.negative || 0,
        neutral: sentiment.neutral || 0
      };
    } catch (error) {
      this.logger.error('Failed to parse sentiment response:', error);
      return { positive: 0, negative: 0, neutral: 0 };
    }
  }

  protected async parseConceptsResponse(data: string): Promise<any> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true,
        parseNumbers: true
      });

      const concepts = parsed.autnresponse?.responsedata?.concepts?.concept || [];
      const conceptArray = Array.isArray(concepts) ? concepts : [concepts];
      
      return conceptArray.map((concept: any) => ({
        concept: concept.name || concept.text,
        occurrences: concept.occurrences || 1,
        relevance: concept.relevance || concept.weight || 0
      }));
    } catch (error) {
      this.logger.error('Failed to parse concepts response:', error);
      return [];
    }
  }

  protected async parseEntitiesResponse(data: string): Promise<any> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true,
        parseNumbers: true
      });

      const entities = parsed.autnresponse?.responsedata?.entities?.entity || [];
      const entityArray = Array.isArray(entities) ? entities : [entities];
      
      return entityArray.map((entity: any) => ({
        type: entity.type,
        text: entity.text,
        positions: entity.positions ? entity.positions.split(',').map(Number) : [],
        confidence: entity.confidence || 1
      }));
    } catch (error) {
      this.logger.error('Failed to parse entities response:', error);
      return [];
    }
  }

  protected async parseLanguageResponse(data: string): Promise<any> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true,
        parseNumbers: true
      });

      const language = parsed.autnresponse?.responsedata?.language || {};
      
      return {
        language: language.name || 'unknown',
        confidence: language.confidence || 0
      };
    } catch (error) {
      this.logger.error('Failed to parse language response:', error);
      return { language: 'unknown', confidence: 0 };
    }
  }

  protected async parseSummaryResponse(data: string): Promise<any> {
    try {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        ignoreAttrs: true
      });

      const summary = parsed.autnresponse?.responsedata?.summary || {};
      
      return {
        summary: summary.text || '',
        sentences: summary.sentences ? 
          (Array.isArray(summary.sentences) ? summary.sentences : [summary.sentences]) : []
      };
    } catch (error) {
      this.logger.error('Failed to parse summary response:', error);
      return { summary: '', sentences: [] };
    }
  }

  private parseFields(hit: any): Record<string, any> {
    const fields: Record<string, any> = {};
    
    Object.keys(hit).forEach(key => {
      if (key.startsWith('DREFIELD') || key.startsWith('field_')) {
        const fieldName = key.replace(/^(DREFIELD|field_)/, '');
        fields[fieldName] = hit[key];
      }
    });
    
    return fields;
  }
}