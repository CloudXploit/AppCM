// Types
export * from './types';

// API Client and Authentication
export { ESClient, ESClientOptions } from './api/es-client';
export { ESAuthManager, AuthOptions, SessionStorage } from './api/auth-manager';

// Workflows
export { ESWorkflowService, WorkflowExecutionOptions } from './workflows/workflow-service';
export { WorkflowBuilder, CommonWorkflows } from './workflows/workflow-builder';

// Process Automation
export { 
  AutomationEngine, 
  AutomationRule, 
  AutomationTrigger,
  AutomationCondition,
  AutomationAction,
  AutomationContext 
} from './automation/automation-engine';

// Approvals
export { 
  ESApprovalService, 
  ApprovalOptions,
  ApprovalDecision,
  ApproverConfig,
  EscalationRule
} from './approvals/approval-service';

// Dashboards
export { 
  ESDashboardService,
  DashboardOptions,
  WidgetOptions,
  DataSourceConfig
} from './dashboards/dashboard-service';
export { DashboardBuilder, DashboardTemplates } from './dashboards/dashboard-builder';

// Reports
export {
  ESReportService,
  ReportOptions,
  ReportExecutionOptions,
  ReportTemplateConfig
} from './reports/report-service';
export { ReportBuilder, ReportTemplates } from './reports/report-builder';

// Main Integration Class
import { ESClient } from './api/es-client';
import { ESAuthManager } from './api/auth-manager';
import { ESWorkflowService } from './workflows/workflow-service';
import { AutomationEngine } from './automation/automation-engine';
import { ESApprovalService } from './approvals/approval-service';
import { ESDashboardService } from './dashboards/dashboard-service';
import { ESReportService } from './reports/report-service';
import { ESConnection } from './types';
import winston from 'winston';
import { EventEmitter } from 'eventemitter3';

export interface ESIntegrationOptions {
  connection: ESConnection;
  logger?: winston.Logger;
  autoConnect?: boolean;
  enableWebSocket?: boolean;
  sessionStorage?: any;
}

export class EnterpriseStudioIntegration extends EventEmitter {
  private client: ESClient;
  private auth: ESAuthManager;
  private workflows: ESWorkflowService;
  private automation: AutomationEngine;
  private approvals: ESApprovalService;
  private dashboards: ESDashboardService;
  private reports: ESReportService;
  private logger: winston.Logger;
  private connected: boolean = false;

  constructor(options: ESIntegrationOptions) {
    super();
    
    this.logger = options.logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    // Initialize client
    this.client = new ESClient({
      connection: options.connection,
      logger: this.logger
    });

    // Initialize services
    this.auth = new ESAuthManager(this.client, {
      persistSession: !!options.sessionStorage,
      sessionStorage: options.sessionStorage
    }, this.logger);

    this.workflows = new ESWorkflowService(this.client, this.logger);
    this.automation = new AutomationEngine(this.client, this.workflows, {
      logger: this.logger
    });
    this.approvals = new ESApprovalService(this.client, this.logger);
    this.dashboards = new ESDashboardService(this.client, this.logger);
    this.reports = new ESReportService(this.client, this.logger);

    this.setupEventForwarding();

    if (options.autoConnect) {
      this.connect().catch(error => {
        this.logger.error('Auto-connect failed:', error);
        this.emit('error', error);
      });
    }
  }

  private setupEventForwarding(): void {
    // Forward authentication events
    this.auth.on('login', (session) => this.emit('authenticated', session));
    this.auth.on('logout', () => this.emit('disconnected'));
    this.auth.on('session:expired', () => this.emit('session:expired'));

    // Forward workflow events
    this.workflows.on('workflow:started', (data) => this.emit('workflow:started', data));
    this.workflows.on('workflow:completed', (data) => this.emit('workflow:completed', data));
    this.workflows.on('workflow:failed', (data) => this.emit('workflow:failed', data));

    // Forward automation events
    this.automation.on('automation:started', (data) => this.emit('automation:started', data));
    this.automation.on('automation:completed', (data) => this.emit('automation:completed', data));
    this.automation.on('automation:failed', (data) => this.emit('automation:failed', data));

    // Forward approval events
    this.approvals.on('approval:created', (data) => this.emit('approval:created', data));
    this.approvals.on('approval:decision', (data) => this.emit('approval:decision', data));
    this.approvals.on('approval:completed', (data) => this.emit('approval:completed', data));
  }

  async connect(username?: string, password?: string): Promise<void> {
    try {
      this.logger.info('Connecting to Enterprise Studio...');
      
      await this.auth.login(username, password);
      this.connected = true;
      
      this.emit('connected');
      this.logger.info('Successfully connected to Enterprise Studio');
    } catch (error) {
      this.connected = false;
      this.logger.error('Failed to connect to Enterprise Studio:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.auth.logout();
      this.connected = false;
      this.emit('disconnected');
      this.logger.info('Disconnected from Enterprise Studio');
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected && this.auth.isAuthenticated();
  }

  // Service getters
  getClient(): ESClient {
    return this.client;
  }

  getAuthManager(): ESAuthManager {
    return this.auth;
  }

  getWorkflowService(): ESWorkflowService {
    return this.workflows;
  }

  getAutomationEngine(): AutomationEngine {
    return this.automation;
  }

  getApprovalService(): ESApprovalService {
    return this.approvals;
  }

  getDashboardService(): ESDashboardService {
    return this.dashboards;
  }

  getReportService(): ESReportService {
    return this.reports;
  }

  // Convenience methods
  async executeWorkflow(workflowId: string, variables?: Record<string, any>): Promise<any> {
    return this.workflows.executeWorkflow(workflowId, { variables });
  }

  async createApproval(workflowInstanceId: string, stepId: string, options: any): Promise<any> {
    return this.approvals.createApproval(workflowInstanceId, stepId, options);
  }

  async getMyPendingApprovals(): Promise<any[]> {
    return this.approvals.getMyPendingApprovals();
  }

  async createDashboard(options: any): Promise<any> {
    return this.dashboards.createDashboard(options);
  }

  async executeReport(reportId: string, parameters?: Record<string, any>): Promise<any> {
    return this.reports.executeReport(reportId, { parameters });
  }

  // Health check
  async healthCheck(): Promise<{
    connected: boolean;
    authenticated: boolean;
    services: Record<string, boolean>;
  }> {
    const health = {
      connected: this.connected,
      authenticated: this.auth.isAuthenticated(),
      services: {
        workflows: false,
        automation: false,
        approvals: false,
        dashboards: false,
        reports: false
      }
    };

    if (health.authenticated) {
      try {
        // Test each service
        await this.workflows.getWorkflows({ limit: 1 });
        health.services.workflows = true;
      } catch {}

      try {
        await this.approvals.getApprovals({ limit: 1 });
        health.services.approvals = true;
      } catch {}

      try {
        await this.dashboards.getDashboards();
        health.services.dashboards = true;
      } catch {}

      try {
        await this.reports.getReports();
        health.services.reports = true;
      } catch {}

      health.services.automation = true; // Always available if authenticated
    }

    return health;
  }
}

// Export factory function
export function createESIntegration(options: ESIntegrationOptions): EnterpriseStudioIntegration {
  return new EnterpriseStudioIntegration(options);
}