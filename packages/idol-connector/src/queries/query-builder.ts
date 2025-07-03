import { IDOLQueryParams } from '../types';

export class IDOLQueryBuilder {
  private params: IDOLQueryParams = {};

  static create(): IDOLQueryBuilder {
    return new IDOLQueryBuilder();
  }

  text(query: string): this {
    this.params.text = query;
    return this;
  }

  databases(...databases: string[]): this {
    this.params.databases = databases;
    return this;
  }

  maxResults(limit: number): this {
    this.params.maxResults = limit;
    return this;
  }

  start(offset: number): this {
    this.params.start = offset;
    return this;
  }

  minScore(score: number): this {
    this.params.minScore = score;
    return this;
  }

  sort(field: string, descending: boolean = true): this {
    this.params.sort = `${descending ? '-' : '+'}${field}`;
    return this;
  }

  print(format: string): this {
    this.params.print = format;
    return this;
  }

  printFields(...fields: string[]): this {
    this.params.printFields = fields;
    return this;
  }

  fieldText(fieldText: string): this {
    this.params.fieldText = fieldText;
    return this;
  }

  combine(mode: 'simple' | 'fieldcheck' | 'datenewer'): this {
    this.params.combine = mode;
    return this;
  }

  totalResults(enable: boolean = true): this {
    this.params.totalResults = enable;
    return this;
  }

  summary(enable: boolean = true): this {
    this.params.summary = enable;
    return this;
  }

  highlight(enable: boolean = true): this {
    this.params.highlight = enable;
    return this;
  }

  languageType(language: string): this {
    this.params.languageType = language;
    return this;
  }

  prediction(enable: boolean = true): this {
    this.params.prediction = enable;
    return this;
  }

  querySummary(enable: boolean = true): this {
    this.params.querySummary = enable;
    return this;
  }

  spellCheck(enable: boolean = true): this {
    this.params.spellCheck = enable;
    return this;
  }

  build(): IDOLQueryParams {
    return { ...this.params };
  }
}

export class FieldTextBuilder {
  private conditions: string[] = [];

  static create(): FieldTextBuilder {
    return new FieldTextBuilder();
  }

  match(field: string, value: string): this {
    this.conditions.push(`MATCH{${value}}:${field}`);
    return this;
  }

  matchAll(field: string, ...values: string[]): this {
    this.conditions.push(`MATCHALL{${values.join(',')}}:${field}`);
    return this;
  }

  matchPhrase(field: string, phrase: string): this {
    this.conditions.push(`STRING{${phrase}}:${field}`);
    return this;
  }

  wildcard(field: string, pattern: string): this {
    this.conditions.push(`WILD{${pattern}}:${field}`);
    return this;
  }

  equal(field: string, value: string | number): this {
    this.conditions.push(`EQUAL{${value}}:${field}`);
    return this;
  }

  notEqual(field: string, value: string | number): this {
    this.conditions.push(`NOTEQUAL{${value}}:${field}`);
    return this;
  }

  greater(field: string, value: number): this {
    this.conditions.push(`GREATER{${value}}:${field}`);
    return this;
  }

  less(field: string, value: number): this {
    this.conditions.push(`LESS{${value}}:${field}`);
    return this;
  }

  between(field: string, min: number, max: number): this {
    this.conditions.push(`RANGE{${min},${max}}:${field}`);
    return this;
  }

  exists(field: string): this {
    this.conditions.push(`EXISTS{}:${field}`);
    return this;
  }

  empty(field: string): this {
    this.conditions.push(`EMPTY{}:${field}`);
    return this;
  }

  dateAfter(field: string, date: Date | string): this {
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    this.conditions.push(`DATEAFTER{${dateStr}}:${field}`);
    return this;
  }

  dateBefore(field: string, date: Date | string): this {
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    this.conditions.push(`DATEBEFORE{${dateStr}}:${field}`);
    return this;
  }

  dateRange(field: string, start: Date | string, end: Date | string): this {
    const startStr = typeof start === 'string' ? start : start.toISOString();
    const endStr = typeof end === 'string' ? end : end.toISOString();
    this.conditions.push(`DATERANGE{${startStr},${endStr}}:${field}`);
    return this;
  }

  and(): this {
    if (this.conditions.length > 0) {
      this.conditions.push('AND');
    }
    return this;
  }

  or(): this {
    if (this.conditions.length > 0) {
      this.conditions.push('OR');
    }
    return this;
  }

  not(): this {
    if (this.conditions.length > 0) {
      this.conditions.push('NOT');
    }
    return this;
  }

  group(builder: (fb: FieldTextBuilder) => void): this {
    const subBuilder = new FieldTextBuilder();
    builder(subBuilder);
    const subConditions = subBuilder.build();
    if (subConditions) {
      this.conditions.push(`(${subConditions})`);
    }
    return this;
  }

  build(): string {
    return this.conditions.join(' ');
  }
}

export class BooleanQueryBuilder {
  private mustClauses: string[] = [];
  private shouldClauses: string[] = [];
  private mustNotClauses: string[] = [];
  private filterClauses: string[] = [];

  static create(): BooleanQueryBuilder {
    return new BooleanQueryBuilder();
  }

  must(...queries: string[]): this {
    this.mustClauses.push(...queries);
    return this;
  }

  should(...queries: string[]): this {
    this.shouldClauses.push(...queries);
    return this;
  }

  mustNot(...queries: string[]): this {
    this.mustNotClauses.push(...queries);
    return this;
  }

  filter(fieldText: string): this {
    this.filterClauses.push(fieldText);
    return this;
  }

  build(): { text: string; fieldText?: string } {
    const parts: string[] = [];

    if (this.mustClauses.length > 0) {
      parts.push(`(${this.mustClauses.join(' AND ')})`);
    }

    if (this.shouldClauses.length > 0) {
      const shouldPart = `(${this.shouldClauses.join(' OR ')})`;
      if (parts.length > 0) {
        parts.push(`AND ${shouldPart}`);
      } else {
        parts.push(shouldPart);
      }
    }

    if (this.mustNotClauses.length > 0) {
      const mustNotPart = this.mustNotClauses.map(q => `NOT (${q})`).join(' AND ');
      if (parts.length > 0) {
        parts.push(`AND ${mustNotPart}`);
      } else {
        parts.push(mustNotPart);
      }
    }

    return {
      text: parts.join(' '),
      fieldText: this.filterClauses.length > 0 ? this.filterClauses.join(' AND ') : undefined
    };
  }
}