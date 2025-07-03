import {
  ESReport,
  ESReportTemplate,
  ESReportParameter,
  ESReportSection,
  ESReportSchedule,
  ESReportDistribution,
  ESReportStyling
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ReportBuilder {
  private report: Partial<ESReport>;
  private sections: ESReportSection[] = [];
  private parameters: ESReportParameter[] = [];

  constructor(name: string, format: ESReport['format'] = 'pdf') {
    this.report = {
      id: uuidv4(),
      name,
      format,
      createdDate: new Date(),
      modifiedDate: new Date()
    };
  }

  static create(name: string, format: ESReport['format'] = 'pdf'): ReportBuilder {
    return new ReportBuilder(name, format);
  }

  description(description: string): this {
    this.report.description = description;
    return this;
  }

  template(type: ESReportTemplate['type'], templateId?: string): this {
    if (!this.report.template) {
      this.report.template = { type };
    }
    this.report.template.type = type;
    if (templateId) {
      this.report.template.templateId = templateId;
    }
    return this;
  }

  parameter(config: {
    name: string;
    type: string;
    label: string;
    required?: boolean;
    defaultValue?: any;
    validation?: {
      type: 'regex' | 'range' | 'length';
      pattern?: string;
      min?: number;
      max?: number;
      message?: string;
    };
  }): this {
    this.parameters.push(config as ESReportParameter);
    return this;
  }

  // Section builders
  header(content: string | { template: string; data?: Record<string, any> }): this {
    this.addSection('header', content);
    return this;
  }

  footer(content: string | { template: string; data?: Record<string, any> }): this {
    this.addSection('footer', content);
    return this;
  }

  content(
    content: any,
    options?: {
      dataSource?: {
        type: 'query' | 'api' | 'workflow';
        configuration: Record<string, any>;
      };
      conditional?: {
        field: string;
        operator: string;
        value: any;
      };
    }
  ): this {
    this.addSection('content', content, options);
    return this;
  }

  summary(
    template: string,
    dataSource: {
      type: 'query' | 'api' | 'workflow';
      configuration: Record<string, any>;
    }
  ): this {
    this.addSection('summary', { template }, { dataSource });
    return this;
  }

  chart(config: {
    type: 'line' | 'bar' | 'pie' | 'donut' | 'scatter';
    title: string;
    dataSource: {
      type: 'query' | 'api' | 'workflow';
      configuration: Record<string, any>;
    };
    xAxis?: string;
    yAxis?: string;
    series?: string[];
  }): this {
    this.addSection('chart', config, { dataSource: config.dataSource });
    return this;
  }

  table(config: {
    columns: Array<{
      field: string;
      label: string;
      format?: string;
      width?: number;
    }>;
    dataSource: {
      type: 'query' | 'api' | 'workflow';
      configuration: Record<string, any>;
    };
    groupBy?: string;
    sortBy?: string;
    totals?: string[];
  }): this {
    this.addSection('table', config, { dataSource: config.dataSource });
    return this;
  }

  pageBreak(): this {
    this.addSection('content', { pageBreak: true });
    return this;
  }

  // Schedule configuration
  schedule(config: {
    frequency: ESReportSchedule['frequency'];
    cronExpression?: string;
    startDate?: Date;
    endDate?: Date;
    timezone?: string;
  }): this {
    this.report.schedule = {
      enabled: true,
      ...config
    };
    return this;
  }

  // Distribution configuration
  distribute(config: {
    recipients: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    attachReport?: boolean;
    compressionEnabled?: boolean;
  }): this {
    this.report.distribution = config;
    return this;
  }

  // Styling configuration
  styling(config: {
    theme?: string;
    customCSS?: string;
    pageSize?: 'A4' | 'Letter' | 'Legal';
    orientation?: 'portrait' | 'landscape';
    margins?: { top: number; right: number; bottom: number; left: number };
  }): this {
    if (!this.report.template) {
      this.report.template = { type: 'custom' };
    }
    this.report.template.styling = {
      theme: config.theme,
      customCSS: config.customCSS,
      pageSize: config.pageSize,
      orientation: config.orientation,
      margins: config.margins || { top: 20, right: 20, bottom: 20, left: 20 }
    };
    return this;
  }

  // Data source helpers
  queryDataSource(query: string, parameters?: Record<string, any>): {
    type: 'query';
    configuration: Record<string, any>;
  } {
    return {
      type: 'query',
      configuration: {
        query,
        parameters: parameters || {}
      }
    };
  }

  apiDataSource(endpoint: string, method: string = 'GET', params?: Record<string, any>): {
    type: 'api';
    configuration: Record<string, any>;
  } {
    return {
      type: 'api',
      configuration: {
        endpoint,
        method,
        parameters: params || {}
      }
    };
  }

  workflowDataSource(workflowId: string, outputField: string): {
    type: 'workflow';
    configuration: Record<string, any>;
  } {
    return {
      type: 'workflow',
      configuration: {
        workflowId,
        outputField
      }
    };
  }

  build(): ESReport {
    if (!this.report.template) {
      this.report.template = { type: 'custom' };
    }
    
    this.report.template.sections = this.sections;
    this.report.parameters = this.parameters;

    if (this.sections.length === 0) {
      throw new Error('Report must have at least one section');
    }

    return this.report as ESReport;
  }

  private addSection(
    type: ESReportSection['type'],
    content: any,
    options?: {
      dataSource?: ESReportSection['dataSource'];
      conditional?: ESReportSection['conditional'];
    }
  ): void {
    const section: ESReportSection = {
      id: `section-${this.sections.length}`,
      type,
      content,
      dataSource: options?.dataSource,
      conditional: options?.conditional
    };

    this.sections.push(section);
  }
}

// Pre-built report templates
export const ReportTemplates = {
  executiveSummary: () => {
    return ReportBuilder.create('Executive Summary Report', 'pdf')
      .description('High-level summary of system performance and health')
      .parameter({
        name: 'dateRange',
        type: 'dateRange',
        label: 'Date Range',
        required: true,
        defaultValue: { start: '-30d', end: 'now' }
      })
      .styling({
        theme: 'professional',
        pageSize: 'A4',
        orientation: 'portrait'
      })
      .header({
        template: 'executive-header',
        data: { title: 'Executive Summary', date: '${reportDate}' }
      })
      .summary('executive-summary', {
        type: 'query',
        configuration: {
          query: `
            SELECT 
              COUNT(*) as totalSystems,
              SUM(CASE WHEN health = 'healthy' THEN 1 ELSE 0 END) as healthySystems,
              AVG(performance_score) as avgPerformance,
              COUNT(DISTINCT incidents) as totalIncidents
            FROM system_metrics
            WHERE date >= ${dateRange.start}
          `
        }
      })
      .chart({
        type: 'line',
        title: 'System Health Trend',
        dataSource: {
          type: 'query',
          configuration: {
            query: 'SELECT date, health_score FROM daily_health WHERE date >= ${dateRange.start}'
          }
        },
        xAxis: 'date',
        yAxis: 'health_score'
      })
      .table({
        columns: [
          { field: 'system', label: 'System', width: 30 },
          { field: 'status', label: 'Status', width: 20 },
          { field: 'issues', label: 'Open Issues', width: 20 },
          { field: 'performance', label: 'Performance', width: 30 }
        ],
        dataSource: {
          type: 'query',
          configuration: {
            query: 'SELECT * FROM system_overview ORDER BY issues DESC'
          }
        }
      })
      .footer('Generated on ${reportDate} by CM Diagnostics')
      .distribute({
        recipients: ['executives@company.com'],
        subject: 'Monthly Executive Summary - ${reportMonth}',
        body: 'Please find attached the executive summary for ${reportMonth}.',
        attachReport: true
      })
      .schedule({
        frequency: 'monthly',
        timezone: 'UTC'
      })
      .build();
  },

  complianceReport: () => {
    return ReportBuilder.create('Compliance Report', 'pdf')
      .description('Security and compliance audit report')
      .parameter({
        name: 'complianceFramework',
        type: 'select',
        label: 'Compliance Framework',
        required: true,
        defaultValue: 'SOC2',
        validation: {
          type: 'regex',
          pattern: '^(SOC2|ISO27001|HIPAA|GDPR)$',
          message: 'Invalid compliance framework'
        }
      })
      .template('built-in', 'compliance-template')
      .content({
        title: 'Compliance Status Overview',
        framework: '${complianceFramework}'
      })
      .table({
        columns: [
          { field: 'control', label: 'Control' },
          { field: 'status', label: 'Status' },
          { field: 'evidence', label: 'Evidence' },
          { field: 'lastAudit', label: 'Last Audit' }
        ],
        dataSource: {
          type: 'api',
          configuration: {
            endpoint: '/compliance/controls',
            method: 'GET',
            parameters: { framework: '${complianceFramework}' }
          }
        },
        groupBy: 'category'
      })
      .build();
  },

  performanceReport: () => {
    return ReportBuilder.create('Performance Analysis Report', 'pdf')
      .description('Detailed performance metrics and analysis')
      .parameter({
        name: 'systemId',
        type: 'string',
        label: 'System ID',
        required: false
      })
      .parameter({
        name: 'metricType',
        type: 'select',
        label: 'Metric Type',
        defaultValue: 'all',
        required: false
      })
      .content('# Performance Analysis Report\n\nGenerated: ${reportDate}')
      .chart({
        type: 'line',
        title: 'Response Time Trend',
        dataSource: {
          type: 'query',
          configuration: {
            query: 'SELECT timestamp, avg_response_time FROM metrics WHERE system_id = COALESCE(${systemId}, system_id)'
          }
        }
      })
      .chart({
        type: 'bar',
        title: 'Resource Utilization',
        dataSource: {
          type: 'query',
          configuration: {
            query: 'SELECT resource_type, utilization FROM resource_metrics'
          }
        }
      })
      .content({
        template: 'performance-recommendations',
        data: { threshold: 80 }
      }, {
        conditional: {
          field: 'hasRecommendations',
          operator: 'equals',
          value: true
        }
      })
      .build();
  }
};