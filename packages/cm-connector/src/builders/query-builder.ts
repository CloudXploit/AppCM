import { Knex } from 'knex';
import { CMQuery, CMVersionAdapter } from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';

const monitoring = getMonitoring();
const logger = monitoring.getLogger({ component: 'query-builder' });

export interface QueryOptions {
  select?: string[];
  where?: Record<string, any>;
  join?: JoinClause[];
  orderBy?: OrderByClause[];
  groupBy?: string[];
  limit?: number;
  offset?: number;
  raw?: boolean;
}

export interface JoinClause {
  table: string;
  on: string;
  type?: 'inner' | 'left' | 'right' | 'full';
}

export interface OrderByClause {
  column: string;
  direction?: 'asc' | 'desc';
}

export class CMQueryBuilder {
  constructor(
    private knex: Knex,
    private adapter: CMVersionAdapter,
    private databaseType: 'mssql' | 'oracledb'
  ) {}

  // Build a query using the Knex query builder
  build(entity: string, options: QueryOptions = {}): Knex.QueryBuilder {
    const tableName = this.adapter.getTableName(entity);
    let query = this.knex(tableName);

    // Select columns
    if (options.select && options.select.length > 0) {
      const columns = options.select.map(col => {
        const mappedCol = this.adapter.getColumnName(entity, col);
        return `${mappedCol} as ${col}`;
      });
      query = query.select(this.knex.raw(columns.join(', ')));
    } else {
      query = query.select('*');
    }

    // Where conditions
    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        const column = this.adapter.getColumnName(entity, key);
        if (value === null) {
          query = query.whereNull(column);
        } else if (Array.isArray(value)) {
          query = query.whereIn(column, value);
        } else if (typeof value === 'object' && value.operator) {
          query = this.applyOperator(query, column, value);
        } else {
          query = query.where(column, value);
        }
      });
    }

    // Joins
    if (options.join) {
      options.join.forEach(join => {
        const joinTable = this.adapter.getTableName(join.table);
        const joinMethod = join.type || 'inner';
        query = query[`${joinMethod}Join`](joinTable, this.knex.raw(join.on));
      });
    }

    // Group by
    if (options.groupBy) {
      const groupColumns = options.groupBy.map(col => 
        this.adapter.getColumnName(entity, col)
      );
      query = query.groupBy(groupColumns);
    }

    // Order by
    if (options.orderBy) {
      options.orderBy.forEach(order => {
        const column = this.adapter.getColumnName(entity, order.column);
        query = query.orderBy(column, order.direction || 'asc');
      });
    }

    // Pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  // Build raw SQL query
  buildRaw(sql: string, params?: any[]): CMQuery {
    // Handle database-specific syntax differences
    let processedSql = sql;
    let processedParams = params || [];

    if (this.databaseType === 'oracledb') {
      // Convert MSSQL-style parameters to Oracle bind variables
      processedSql = this.convertToOracleBinds(sql);
      
      // Handle Oracle-specific syntax
      processedSql = this.handleOracleSyntax(processedSql);
    } else {
      // Handle SQL Server-specific syntax
      processedSql = this.handleSQLServerSyntax(processedSql);
    }

    return {
      sql: processedSql,
      params: processedParams
    };
  }

  // Common queries
  getSystemInfo(): CMQuery {
    return this.adapter.buildQuery('GET_SYSTEM_INFO', {});
  }

  getUsers(options?: { active?: boolean; type?: string }): CMQuery {
    return this.adapter.buildQuery('GET_USERS', options || {});
  }

  getRecordTypes(options?: { active?: boolean }): CMQuery {
    return this.adapter.buildQuery('GET_RECORD_TYPES', options || {});
  }

  getLocations(options?: { parentId?: string }): CMQuery {
    return this.adapter.buildQuery('GET_LOCATIONS', options || {});
  }

  // Search queries
  searchRecords(criteria: {
    recordType?: string;
    title?: string;
    number?: string;
    dateFrom?: Date;
    dateTo?: Date;
    location?: string;
    status?: string;
    limit?: number;
  }): Knex.QueryBuilder {
    const query = this.build('record', {
      select: ['id', 'number', 'title', 'recordType', 'dateRegistered', 'status'],
      limit: criteria.limit || 100
    });

    if (criteria.recordType) {
      query.where(this.adapter.getColumnName('record', 'recordType'), criteria.recordType);
    }

    if (criteria.title) {
      const titleColumn = this.adapter.getColumnName('record', 'title');
      query.where(titleColumn, 'like', `%${criteria.title}%`);
    }

    if (criteria.number) {
      query.where(this.adapter.getColumnName('record', 'number'), criteria.number);
    }

    if (criteria.dateFrom || criteria.dateTo) {
      const dateColumn = this.adapter.getColumnName('record', 'dateRegistered');
      if (criteria.dateFrom) {
        query.where(dateColumn, '>=', criteria.dateFrom);
      }
      if (criteria.dateTo) {
        query.where(dateColumn, '<=', criteria.dateTo);
      }
    }

    return query;
  }

  // Performance queries
  getDatabaseStats(): CMQuery {
    if (this.databaseType === 'mssql') {
      return {
        sql: `
          SELECT 
            DB_NAME() as database_name,
            SUM(size * 8 / 1024) as size_mb,
            SUM(CASE WHEN type_desc = 'ROWS' THEN size * 8 / 1024 ELSE 0 END) as data_size_mb,
            SUM(CASE WHEN type_desc = 'LOG' THEN size * 8 / 1024 ELSE 0 END) as log_size_mb
          FROM sys.database_files
        `
      };
    } else {
      return {
        sql: `
          SELECT 
            tablespace_name,
            SUM(bytes) / 1024 / 1024 as size_mb,
            SUM(maxbytes) / 1024 / 1024 as max_size_mb,
            SUM(bytes - NVL(free_space, 0)) / 1024 / 1024 as used_mb
          FROM (
            SELECT tablespace_name, SUM(bytes) bytes, SUM(maxbytes) maxbytes
            FROM dba_data_files
            GROUP BY tablespace_name
          ) df
          LEFT JOIN (
            SELECT tablespace_name, SUM(bytes) free_space
            FROM dba_free_space
            GROUP BY tablespace_name
          ) fs ON df.tablespace_name = fs.tablespace_name
          GROUP BY df.tablespace_name
        `
      };
    }
  }

  getTableStats(tableName: string): CMQuery {
    const actualTableName = this.adapter.getTableName(tableName);
    
    if (this.databaseType === 'mssql') {
      return {
        sql: `
          SELECT 
            t.name as table_name,
            p.rows as row_count,
            SUM(a.total_pages) * 8 / 1024 as total_space_mb,
            SUM(a.used_pages) * 8 / 1024 as used_space_mb,
            (SUM(a.total_pages) - SUM(a.used_pages)) * 8 / 1024 as unused_space_mb
          FROM sys.tables t
          INNER JOIN sys.indexes i ON t.object_id = i.object_id
          INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
          INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
          WHERE t.name = ? AND p.rows > 0
          GROUP BY t.name, p.rows
        `,
        params: [actualTableName]
      };
    } else {
      return {
        sql: `
          SELECT 
            table_name,
            num_rows as row_count,
            blocks * 8 / 1024 as total_space_mb,
            avg_row_len * num_rows / 1024 / 1024 as used_space_mb
          FROM user_tables
          WHERE table_name = UPPER(?)
        `,
        params: [actualTableName]
      };
    }
  }

  // Helper methods
  private applyOperator(query: Knex.QueryBuilder, column: string, condition: any): Knex.QueryBuilder {
    switch (condition.operator) {
      case 'gt':
        return query.where(column, '>', condition.value);
      case 'gte':
        return query.where(column, '>=', condition.value);
      case 'lt':
        return query.where(column, '<', condition.value);
      case 'lte':
        return query.where(column, '<=', condition.value);
      case 'ne':
        return query.where(column, '!=', condition.value);
      case 'like':
        return query.where(column, 'like', condition.value);
      case 'in':
        return query.whereIn(column, condition.value);
      case 'notIn':
        return query.whereNotIn(column, condition.value);
      case 'between':
        return query.whereBetween(column, condition.value);
      default:
        return query.where(column, condition.value);
    }
  }

  private convertToOracleBinds(sql: string): string {
    // Convert @param style to :param style for Oracle
    return sql.replace(/@(\w+)/g, ':$1');
  }

  private handleOracleSyntax(sql: string): string {
    // Convert SQL Server specific syntax to Oracle
    let processed = sql;
    
    // TOP N -> ROWNUM
    processed = processed.replace(/SELECT TOP (\d+)/i, 'SELECT * FROM (SELECT');
    if (processed.includes('ROWNUM')) {
      processed += `) WHERE ROWNUM <= $1`;
    }
    
    // GETDATE() -> SYSDATE
    processed = processed.replace(/GETDATE\(\)/gi, 'SYSDATE');
    
    // ISNULL -> NVL
    processed = processed.replace(/ISNULL\(/gi, 'NVL(');
    
    return processed;
  }

  private handleSQLServerSyntax(sql: string): string {
    // Convert Oracle specific syntax to SQL Server
    let processed = sql;
    
    // SYSDATE -> GETDATE()
    processed = processed.replace(/SYSDATE/gi, 'GETDATE()');
    
    // NVL -> ISNULL
    processed = processed.replace(/NVL\(/gi, 'ISNULL(');
    
    // ROWNUM handling
    if (processed.includes('ROWNUM')) {
      processed = processed.replace(/WHERE ROWNUM <= (\d+)/i, '').trim();
      processed = processed.replace(/SELECT/i, `SELECT TOP $1`);
    }
    
    return processed;
  }
}