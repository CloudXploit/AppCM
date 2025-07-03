import { EventEmitter } from 'events';
import { IDOLConnector, IDOLQueryParams, IDOLDocument, IDOLQueryResponse } from '../types';
import { IDOLQueryBuilder, FieldTextBuilder, BooleanQueryBuilder } from './query-builder';

export interface SearchOptions {
  databases?: string[];
  limit?: number;
  offset?: number;
  sort?: { field: string; descending?: boolean };
  highlight?: boolean;
  summary?: boolean;
  fields?: string[];
  minScore?: number;
  language?: string;
  facets?: string[];
}

export interface SearchResult {
  documents: IDOLDocument[];
  totalResults: number;
  queryTime: number;
  facets?: Record<string, FacetValue[]>;
  suggestions?: string[];
}

export interface FacetValue {
  value: string;
  count: number;
}

export class IDOLSearchService extends EventEmitter {
  constructor(private connector: IDOLConnector) {
    super();
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();

    // Build query parameters
    const queryBuilder = IDOLQueryBuilder.create()
      .text(query)
      .totalResults(true);

    if (options.databases?.length) {
      queryBuilder.databases(...options.databases);
    }
    if (options.limit) {
      queryBuilder.maxResults(options.limit);
    }
    if (options.offset) {
      queryBuilder.start(options.offset);
    }
    if (options.sort) {
      queryBuilder.sort(options.sort.field, options.sort.descending ?? true);
    }
    if (options.highlight !== undefined) {
      queryBuilder.highlight(options.highlight);
    }
    if (options.summary !== undefined) {
      queryBuilder.summary(options.summary);
    }
    if (options.fields?.length) {
      queryBuilder.printFields(...options.fields);
    }
    if (options.minScore) {
      queryBuilder.minScore(options.minScore);
    }
    if (options.language) {
      queryBuilder.languageType(options.language);
    }

    const params = queryBuilder.build();

    // Execute search
    const response = await this.connector.query(params);
    const queryTime = Date.now() - startTime;

    // Extract facets if requested
    const facets = options.facets ? await this.extractFacets(response, options.facets) : undefined;

    // Extract suggestions
    const suggestions = this.extractSuggestions(response);

    const result: SearchResult = {
      documents: response.autnresponse.responsedata.hit || [],
      totalResults: response.autnresponse.responsedata.totalhits || 0,
      queryTime,
      facets,
      suggestions
    };

    this.emit('search:completed', { query, options, result });
    return result;
  }

  async searchWithFieldText(
    query: string,
    fieldTextBuilder: (builder: FieldTextBuilder) => void,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const fieldText = FieldTextBuilder.create();
    fieldTextBuilder(fieldText);

    const params: IDOLQueryParams = {
      ...this.buildSearchParams(query, options),
      fieldText: fieldText.build()
    };

    const response = await this.connector.query(params);
    return this.processSearchResponse(response, Date.now());
  }

  async booleanSearch(
    builder: (qb: BooleanQueryBuilder) => void,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const queryBuilder = BooleanQueryBuilder.create();
    builder(queryBuilder);
    
    const { text, fieldText } = queryBuilder.build();
    const params: IDOLQueryParams = {
      ...this.buildSearchParams(text, options),
      fieldText
    };

    const response = await this.connector.query(params);
    return this.processSearchResponse(response, Date.now());
  }

  async findSimilar(
    reference: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const params: IDOLQueryParams = {
      ...this.buildSearchParams('', options),
      text: `*`,
      fieldText: `DREREFERENCE{${reference}}`,
      combine: 'simple'
    };

    const response = await this.connector.query(params);
    return this.processSearchResponse(response, Date.now());
  }

  async suggest(
    partial: string,
    options: { limit?: number; databases?: string[] } = {}
  ): Promise<string[]> {
    const params: IDOLQueryParams = {
      text: `${partial}*`,
      databases: options.databases,
      maxResults: options.limit || 10,
      print: 'fields',
      printFields: ['DRETITLE', 'DRECONTENT'],
      querySummary: true,
      spellCheck: true
    };

    const response = await this.connector.query(params);
    return this.extractSuggestions(response);
  }

  async facetedSearch(
    query: string,
    facetFields: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    // Perform main search
    const searchResult = await this.search(query, options);
    
    // Get facet values
    const facets: Record<string, FacetValue[]> = {};
    
    for (const field of facetFields) {
      const facetValues = await this.getFacetValues(field, query, options);
      facets[field] = facetValues;
    }

    return {
      ...searchResult,
      facets
    };
  }

  private buildSearchParams(query: string, options: SearchOptions): IDOLQueryParams {
    return IDOLQueryBuilder.create()
      .text(query)
      .databases(...(options.databases || []))
      .maxResults(options.limit || 10)
      .start(options.offset || 0)
      .sort(options.sort?.field || 'relevance', options.sort?.descending ?? true)
      .highlight(options.highlight ?? false)
      .summary(options.summary ?? false)
      .printFields(...(options.fields || []))
      .minScore(options.minScore || 0)
      .languageType(options.language || 'english')
      .totalResults(true)
      .build();
  }

  private processSearchResponse(
    response: IDOLQueryResponse,
    startTime: number
  ): SearchResult {
    return {
      documents: response.autnresponse.responsedata.hit || [],
      totalResults: response.autnresponse.responsedata.totalhits || 0,
      queryTime: Date.now() - startTime
    };
  }

  private async extractFacets(
    response: IDOLQueryResponse,
    facetFields: string[]
  ): Promise<Record<string, FacetValue[]>> {
    // This is a simplified implementation
    // In production, you would use IDOL's FieldCheck action
    const facets: Record<string, FacetValue[]> = {};
    
    for (const field of facetFields) {
      const values = new Map<string, number>();
      
      for (const doc of response.autnresponse.responsedata.hit || []) {
        const value = doc.fields?.[field];
        if (value) {
          const key = String(value);
          values.set(key, (values.get(key) || 0) + 1);
        }
      }
      
      facets[field] = Array.from(values.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    }
    
    return facets;
  }

  private async getFacetValues(
    field: string,
    query: string,
    options: SearchOptions
  ): Promise<FacetValue[]> {
    // Use FieldCheck action to get facet values
    const response = await this.connector.executeAction({
      action: 'FieldCheck',
      parameters: {
        FieldName: field,
        Text: query,
        DatabaseMatch: options.databases?.join(','),
        MaxValues: 20
      }
    });

    // Parse facet response
    return this.parseFacetResponse(response, field);
  }

  private parseFacetResponse(response: any, field: string): FacetValue[] {
    // This would parse the actual IDOL FieldCheck response
    // Simplified for demonstration
    return [];
  }

  private extractSuggestions(response: IDOLQueryResponse): string[] {
    // Extract query suggestions from response
    // This could come from spell corrections or query expansion
    return [];
  }
}