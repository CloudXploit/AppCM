import { EventEmitter } from 'eventemitter3';
import winston from 'winston';
import { ESClient } from '../api/es-client';
import {
  ESReport,
  ESReportTemplate,
  ESReportParameter,
  ESReportSchedule,
  ESReportDistribution,
  ESReportSection
} from '../types';

export interface ReportOptions {
  name: string;
  description?: string;
  template: ReportTemplateConfig;
  parameters?: ReportParameterConfig[];
  schedule?: ReportScheduleConfig;
  distribution?: ReportDistributionConfig;
  format: ESReport['format'];
}

export interface ReportTemplateConfig {
  type: ESReportTemplate['type'];
  templateId?: string;
  sections?: ReportSectionConfig[];
  styling?: ReportStylingConfig;
}

export interface ReportSectionConfig {
  type: ESReportSection['type'];
  content: any;
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

export interface ReportParameterConfig {
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
}

export interface ReportScheduleConfig {
  enabled: boolean;
  frequency: ESReportSchedule['frequency'];
  cronExpression?: string;
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
}

export interface ReportDistributionConfig {
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  attachReport?: boolean;
  compressionEnabled?: boolean;
}

export interface ReportStylingConfig {
  theme?: string;
  customCSS?: string;
  pageSize?: string;
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface ReportExecutionOptions {
  parameters?: Record<string, any>;
  format?: ESReport['format'];
  outputPath?: string;
  async?: boolean;
}

export class ESReportService extends EventEmitter {
  private client: ESClient;
  private logger: winston.Logger;
  private scheduledReports: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: ESClient, logger?: winston.Logger) {
    super();
    this.client = client;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });
  }

  async createReport(options: ReportOptions): Promise<ESReport> {
    try {
      const report: Partial<ESReport> = {
        name: options.name,
        description: options.description,
        template: this.buildTemplate(options.template),
        parameters: options.parameters?.map((p, index) => ({
          ...p,
          name: p.name || `param${index}`
        })),
        schedule: options.schedule,
        distribution: options.distribution,
        format: options.format,
        createdBy: this.getCurrentUser(),
        createdDate: new Date(),
        modifiedBy: this.getCurrentUser(),
        modifiedDate: new Date()
      };

      const created = await this.client.post<ESReport>('/reports', report);
      
      // Setup schedule if enabled
      if (created.schedule?.enabled) {
        this.scheduleReport(created);
      }
      
      this.emit('report:created', created);
      this.logger.info(`Created report: ${created.name} (${created.id})`);
      
      return created;
    } catch (error) {
      this.logger.error('Failed to create report:', error);
      throw error;
    }
  }

  async getReport(reportId: string): Promise<ESReport> {
    try {
      const report = await this.client.get<ESReport>(`/reports/${reportId}`);
      return report;
    } catch (error) {
      this.logger.error(`Failed to get report ${reportId}:`, error);
      throw error;
    }
  }

  async getReports(filter?: {
    name?: string;
    createdBy?: string;
    format?: string;
  }): Promise<ESReport[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.name) params.append('name', filter.name);
      if (filter?.createdBy) params.append('createdBy', filter.createdBy);
      if (filter?.format) params.append('format', filter.format);

      const reports = await this.client.get<ESReport[]>(`/reports?${params}`);
      return reports;
    } catch (error) {
      this.logger.error('Failed to get reports:', error);
      throw error;
    }
  }

  async updateReport(
    reportId: string,
    updates: Partial<ESReport>
  ): Promise<ESReport> {
    try {
      updates.modifiedBy = this.getCurrentUser();
      updates.modifiedDate = new Date();

      const updated = await this.client.patch<ESReport>(
        `/reports/${reportId}`,
        updates
      );
      
      // Update schedule if changed
      if (updates.schedule) {
        this.cancelSchedule(reportId);
        if (updates.schedule.enabled) {
          this.scheduleReport(updated);
        }
      }
      
      this.emit('report:updated', updated);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update report ${reportId}:`, error);
      throw error;
    }
  }

  async deleteReport(reportId: string): Promise<void> {
    try {
      await this.client.delete(`/reports/${reportId}`);
      
      // Cancel schedule
      this.cancelSchedule(reportId);
      
      this.emit('report:deleted', { reportId });
      this.logger.info(`Deleted report: ${reportId}`);
    } catch (error) {
      this.logger.error(`Failed to delete report ${reportId}:`, error);
      throw error;
    }
  }

  async executeReport(
    reportId: string,
    options: ReportExecutionOptions = {}
  ): Promise<Buffer | { jobId: string }> {
    try {
      this.logger.info(`Executing report ${reportId}`);
      
      const response = await this.client.post(
        `/reports/${reportId}/execute`,
        {
          parameters: options.parameters || {},
          format: options.format,
          async: options.async
        },
        {
          responseType: options.async ? 'json' : 'arraybuffer'
        }
      );

      if (options.async) {
        const jobId = response.jobId;
        this.emit('report:execution:started', { reportId, jobId });
        return { jobId };
      } else {
        const buffer = Buffer.from(response);
        this.emit('report:execution:completed', { reportId, size: buffer.length });
        return buffer;
      }
    } catch (error) {
      this.logger.error(`Failed to execute report ${reportId}:`, error);
      this.emit('report:execution:failed', { reportId, error });
      throw error;
    }
  }

  async getExecutionStatus(jobId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    result?: string;
    error?: string;
  }> {
    try {
      const status = await this.client.get(`/reports/jobs/${jobId}`);
      return status;
    } catch (error) {
      this.logger.error(`Failed to get execution status for job ${jobId}:`, error);
      throw error;
    }
  }

  async downloadReport(
    reportId: string,
    executionId: string
  ): Promise<Buffer> {
    try {
      const data = await this.client.download(
        `/reports/${reportId}/executions/${executionId}/download`
      );
      
      return data;
    } catch (error) {
      this.logger.error(`Failed to download report ${reportId}:`, error);
      throw error;
    }
  }

  async previewReport(
    reportId: string,
    parameters?: Record<string, any>,
    maxRows: number = 100
  ): Promise<any> {
    try {
      const preview = await this.client.post(
        `/reports/${reportId}/preview`,
        {
          parameters: parameters || {},
          maxRows
        }
      );
      
      return preview;
    } catch (error) {
      this.logger.error(`Failed to preview report ${reportId}:`, error);
      throw error;
    }
  }

  async validateParameters(
    reportId: string,
    parameters: Record<string, any>
  ): Promise<{
    valid: boolean;
    errors?: Array<{ parameter: string; message: string }>;
  }> {
    try {
      const result = await this.client.post(
        `/reports/${reportId}/validate-parameters`,
        parameters
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to validate parameters for report ${reportId}:`, error);
      throw error;
    }
  }

  async cloneReport(
    reportId: string,
    name: string
  ): Promise<ESReport> {
    try {
      const cloned = await this.client.post<ESReport>(
        `/reports/${reportId}/clone`,
        { name }
      );
      
      this.emit('report:cloned', { original: reportId, clone: cloned });
      this.logger.info(`Cloned report ${reportId} as ${cloned.name}`);
      
      return cloned;
    } catch (error) {
      this.logger.error(`Failed to clone report ${reportId}:`, error);
      throw error;
    }
  }

  async getReportHistory(
    reportId: string,
    limit: number = 10
  ): Promise<Array<{
    executionId: string;
    executedAt: Date;
    executedBy: string;
    parameters: Record<string, any>;
    format: string;
    status: string;
    duration?: number;
    size?: number;
  }>> {
    try {
      const history = await this.client.get(
        `/reports/${reportId}/history?limit=${limit}`
      );
      
      return history;
    } catch (error) {
      this.logger.error(`Failed to get report history for ${reportId}:`, error);
      throw error;
    }
  }

  private buildTemplate(config: ReportTemplateConfig): ESReportTemplate {
    const template: ESReportTemplate = {
      type: config.type,
      templateId: config.templateId,
      sections: config.sections?.map((section, index) => ({
        id: `section-${index}`,
        ...section,
        dataSource: section.dataSource ? {
          type: section.dataSource.type as any,
          configuration: section.dataSource.configuration
        } : undefined,
        conditional: section.conditional ? {
          field: section.conditional.field,
          operator: section.conditional.operator,
          value: section.conditional.value,
          action: 'show'
        } : undefined
      })),
      styling: config.styling
    };

    return template;
  }

  private scheduleReport(report: ESReport): void {
    if (!report.schedule || !report.schedule.enabled) return;

    const executeScheduledReport = async () => {
      try {
        this.logger.info(`Executing scheduled report: ${report.name}`);
        
        const result = await this.executeReport(report.id, {
          async: true
        });
        
        if ('jobId' in result) {
          // Wait for completion
          await this.waitForExecution(result.jobId);
          
          // Distribute if configured
          if (report.distribution) {
            await this.distributeReport(report.id, result.jobId, report.distribution);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to execute scheduled report ${report.id}:`, error);
        this.emit('report:schedule:failed', { report, error });
      }
    };

    // Calculate next execution time based on schedule
    const interval = this.calculateInterval(report.schedule);
    if (interval) {
      const timer = setInterval(executeScheduledReport, interval);
      this.scheduledReports.set(report.id, timer);
    }
  }

  private cancelSchedule(reportId: string): void {
    const timer = this.scheduledReports.get(reportId);
    if (timer) {
      clearInterval(timer);
      this.scheduledReports.delete(reportId);
    }
  }

  private calculateInterval(schedule: ESReportSchedule): number | null {
    switch (schedule.frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      case 'custom':
        // Would parse cron expression
        return null;
      default:
        return null;
    }
  }

  private async waitForExecution(jobId: string): Promise<void> {
    const maxWait = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const status = await this.getExecutionStatus(jobId);
      
      if (status.status === 'completed') {
        return;
      } else if (status.status === 'failed') {
        throw new Error(status.error || 'Report execution failed');
      }
      
      await this.delay(5000); // Check every 5 seconds
    }
    
    throw new Error('Report execution timeout');
  }

  private async distributeReport(
    reportId: string,
    executionId: string,
    distribution: ESReportDistribution
  ): Promise<void> {
    try {
      await this.client.post(`/reports/${reportId}/distribute`, {
        executionId,
        distribution
      });
      
      this.emit('report:distributed', { reportId, distribution });
      this.logger.info(`Distributed report ${reportId} to ${distribution.recipients.length} recipients`);
    } catch (error) {
      this.logger.error(`Failed to distribute report ${reportId}:`, error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCurrentUser(): string {
    const session = this.client.getSession();
    return session?.userId || 'system';
  }
}