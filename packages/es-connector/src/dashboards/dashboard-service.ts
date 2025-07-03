import { EventEmitter } from 'eventemitter3';
import winston from 'winston';
import { ESClient } from '../api/es-client';
import {
  ESDashboard,
  ESWidget,
  ESDataSource,
  ESDashboardFilter,
  ESWidgetConfig,
  ESThreshold
} from '../types';
import WebSocket from 'ws';

export interface DashboardOptions {
  name: string;
  description?: string;
  layout?: {
    type: 'grid' | 'flow' | 'fixed';
    columns?: number;
    rows?: number;
    responsive?: boolean;
  };
  refreshInterval?: number;
  filters?: DashboardFilterConfig[];
  permissions?: DashboardPermission[];
}

export interface DashboardFilterConfig {
  name: string;
  type: ESDashboardFilter['type'];
  defaultValue?: any;
  options?: any[];
  required?: boolean;
}

export interface DashboardPermission {
  principalType: 'user' | 'role' | 'group';
  principalId: string;
  permissions: ('view' | 'edit' | 'delete' | 'share')[];
}

export interface WidgetOptions {
  title: string;
  type: ESWidget['type'];
  position: { x: number; y: number; width: number; height: number };
  dataSource?: DataSourceConfig;
  config?: Partial<ESWidgetConfig>;
  refreshInterval?: number;
}

export interface DataSourceConfig {
  type: ESDataSource['type'];
  query?: string;
  api?: string;
  workflowId?: string;
  parameters?: Record<string, any>;
  transform?: string;
}

export class ESDashboardService extends EventEmitter {
  private client: ESClient;
  private logger: winston.Logger;
  private websockets: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor(client: ESClient, logger?: winston.Logger) {
    super();
    this.client = client;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    this.setupWebSocketConnection();
  }

  private setupWebSocketConnection(): void {
    const connection = this.client.getConnection();
    if (!connection.wsEndpoint) return;

    const ws = new WebSocket(connection.wsEndpoint);
    
    ws.on('open', () => {
      this.logger.info('WebSocket connection established for dashboards');
      this.emit('websocket:connected');
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        this.logger.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
      this.emit('websocket:error', error);
    });

    ws.on('close', () => {
      this.logger.info('WebSocket connection closed');
      this.emit('websocket:closed');
      // Attempt to reconnect after delay
      setTimeout(() => this.setupWebSocketConnection(), 5000);
    });

    this.websockets.set('main', ws);
  }

  async createDashboard(options: DashboardOptions): Promise<ESDashboard> {
    try {
      const dashboard: Partial<ESDashboard> = {
        name: options.name,
        description: options.description,
        layout: options.layout || {
          type: 'grid',
          columns: 12,
          rows: 8,
          responsive: true
        },
        widgets: [],
        filters: options.filters?.map((f, index) => ({
          id: `filter-${index}`,
          ...f,
          affectsWidgets: []
        })),
        refreshInterval: options.refreshInterval,
        permissions: options.permissions as any,
        createdBy: this.getCurrentUser(),
        createdDate: new Date(),
        modifiedBy: this.getCurrentUser(),
        modifiedDate: new Date()
      };

      const created = await this.client.post<ESDashboard>('/dashboards', dashboard);
      
      this.emit('dashboard:created', created);
      this.logger.info(`Created dashboard: ${created.name} (${created.id})`);
      
      return created;
    } catch (error) {
      this.logger.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  async getDashboard(dashboardId: string): Promise<ESDashboard> {
    try {
      const dashboard = await this.client.get<ESDashboard>(`/dashboards/${dashboardId}`);
      return dashboard;
    } catch (error) {
      this.logger.error(`Failed to get dashboard ${dashboardId}:`, error);
      throw error;
    }
  }

  async getDashboards(filter?: {
    name?: string;
    createdBy?: string;
    tag?: string;
  }): Promise<ESDashboard[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.name) params.append('name', filter.name);
      if (filter?.createdBy) params.append('createdBy', filter.createdBy);
      if (filter?.tag) params.append('tag', filter.tag);

      const dashboards = await this.client.get<ESDashboard[]>(`/dashboards?${params}`);
      return dashboards;
    } catch (error) {
      this.logger.error('Failed to get dashboards:', error);
      throw error;
    }
  }

  async updateDashboard(
    dashboardId: string,
    updates: Partial<ESDashboard>
  ): Promise<ESDashboard> {
    try {
      updates.modifiedBy = this.getCurrentUser();
      updates.modifiedDate = new Date();

      const updated = await this.client.patch<ESDashboard>(
        `/dashboards/${dashboardId}`,
        updates
      );
      
      this.emit('dashboard:updated', updated);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update dashboard ${dashboardId}:`, error);
      throw error;
    }
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    try {
      await this.client.delete(`/dashboards/${dashboardId}`);
      
      // Clean up subscriptions
      this.unsubscribeFromDashboard(dashboardId);
      
      this.emit('dashboard:deleted', { dashboardId });
      this.logger.info(`Deleted dashboard: ${dashboardId}`);
    } catch (error) {
      this.logger.error(`Failed to delete dashboard ${dashboardId}:`, error);
      throw error;
    }
  }

  async addWidget(
    dashboardId: string,
    options: WidgetOptions
  ): Promise<ESWidget> {
    try {
      const widget: Partial<ESWidget> = {
        title: options.title,
        type: options.type,
        position: options.position,
        configuration: {
          ...options.config,
          displayOptions: options.config?.displayOptions || {}
        },
        dataSource: options.dataSource ? {
          type: options.dataSource.type,
          configuration: options.dataSource,
          refreshTrigger: 'interval'
        } : undefined,
        refreshInterval: options.refreshInterval
      };

      const created = await this.client.post<ESWidget>(
        `/dashboards/${dashboardId}/widgets`,
        widget
      );
      
      this.emit('widget:added', { dashboardId, widget: created });
      this.logger.info(`Added widget to dashboard ${dashboardId}: ${created.title}`);
      
      return created;
    } catch (error) {
      this.logger.error('Failed to add widget:', error);
      throw error;
    }
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<ESWidget>
  ): Promise<ESWidget> {
    try {
      const updated = await this.client.patch<ESWidget>(
        `/dashboards/${dashboardId}/widgets/${widgetId}`,
        updates
      );
      
      this.emit('widget:updated', { dashboardId, widget: updated });
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update widget ${widgetId}:`, error);
      throw error;
    }
  }

  async deleteWidget(dashboardId: string, widgetId: string): Promise<void> {
    try {
      await this.client.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`);
      
      this.emit('widget:deleted', { dashboardId, widgetId });
      this.logger.info(`Deleted widget ${widgetId} from dashboard ${dashboardId}`);
    } catch (error) {
      this.logger.error(`Failed to delete widget ${widgetId}:`, error);
      throw error;
    }
  }

  async getWidgetData(
    dashboardId: string,
    widgetId: string,
    filters?: Record<string, any>
  ): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          params.append(key, String(value));
        });
      }

      const data = await this.client.get(
        `/dashboards/${dashboardId}/widgets/${widgetId}/data?${params}`
      );
      
      return data;
    } catch (error) {
      this.logger.error(`Failed to get widget data for ${widgetId}:`, error);
      throw error;
    }
  }

  async refreshWidget(dashboardId: string, widgetId: string): Promise<any> {
    try {
      const data = await this.client.post(
        `/dashboards/${dashboardId}/widgets/${widgetId}/refresh`
      );
      
      this.emit('widget:refreshed', { dashboardId, widgetId, data });
      return data;
    } catch (error) {
      this.logger.error(`Failed to refresh widget ${widgetId}:`, error);
      throw error;
    }
  }

  async cloneDashboard(
    dashboardId: string,
    name: string,
    includeData: boolean = false
  ): Promise<ESDashboard> {
    try {
      const cloned = await this.client.post<ESDashboard>(
        `/dashboards/${dashboardId}/clone`,
        { name, includeData }
      );
      
      this.emit('dashboard:cloned', { original: dashboardId, clone: cloned });
      this.logger.info(`Cloned dashboard ${dashboardId} as ${cloned.name}`);
      
      return cloned;
    } catch (error) {
      this.logger.error(`Failed to clone dashboard ${dashboardId}:`, error);
      throw error;
    }
  }

  async exportDashboard(
    dashboardId: string,
    format: 'json' | 'pdf' | 'png' = 'json'
  ): Promise<Buffer> {
    try {
      const data = await this.client.download(
        `/dashboards/${dashboardId}/export?format=${format}`
      );
      
      return data;
    } catch (error) {
      this.logger.error(`Failed to export dashboard ${dashboardId}:`, error);
      throw error;
    }
  }

  async importDashboard(
    data: Buffer | object,
    format: 'json' = 'json'
  ): Promise<ESDashboard> {
    try {
      const imported = await this.client.post<ESDashboard>(
        '/dashboards/import',
        {
          data: data instanceof Buffer ? data.toString('base64') : data,
          format
        }
      );
      
      this.emit('dashboard:imported', imported);
      return imported;
    } catch (error) {
      this.logger.error('Failed to import dashboard:', error);
      throw error;
    }
  }

  subscribeToDashboard(dashboardId: string, callback: (data: any) => void): void {
    if (!this.subscriptions.has(dashboardId)) {
      this.subscriptions.set(dashboardId, new Set());
      
      // Send subscription request via WebSocket
      const ws = this.websockets.get('main');
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'subscribe',
          dashboardId
        }));
      }
    }
    
    // Store callback
    const callbackId = `${dashboardId}-${Date.now()}`;
    this.on(`dashboard:data:${dashboardId}`, callback);
    this.subscriptions.get(dashboardId)!.add(callbackId);
  }

  unsubscribeFromDashboard(dashboardId: string): void {
    const subs = this.subscriptions.get(dashboardId);
    if (!subs) return;
    
    // Remove all listeners
    this.removeAllListeners(`dashboard:data:${dashboardId}`);
    this.subscriptions.delete(dashboardId);
    
    // Send unsubscribe request
    const ws = this.websockets.get('main');
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'unsubscribe',
        dashboardId
      }));
    }
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'dashboard:update':
        this.emit(`dashboard:data:${message.dashboardId}`, message.data);
        break;
        
      case 'widget:update':
        this.emit(`widget:data:${message.dashboardId}:${message.widgetId}`, message.data);
        break;
        
      case 'error':
        this.logger.error('WebSocket error message:', message.error);
        this.emit('websocket:error', message.error);
        break;
    }
  }

  async shareDashboard(
    dashboardId: string,
    principals: DashboardPermission[]
  ): Promise<void> {
    try {
      await this.client.post(`/dashboards/${dashboardId}/share`, {
        principals
      });
      
      this.emit('dashboard:shared', { dashboardId, principals });
      this.logger.info(`Shared dashboard ${dashboardId}`);
    } catch (error) {
      this.logger.error(`Failed to share dashboard ${dashboardId}:`, error);
      throw error;
    }
  }

  private getCurrentUser(): string {
    const session = this.client.getSession();
    return session?.userId || 'system';
  }

  // Widget builder helpers
  createChartWidget(options: {
    title: string;
    chartType: 'line' | 'bar' | 'pie' | 'donut' | 'scatter';
    dataSource: DataSourceConfig;
    position: { x: number; y: number; width: number; height: number };
  }): WidgetOptions {
    return {
      title: options.title,
      type: 'chart',
      position: options.position,
      dataSource: options.dataSource,
      config: {
        chartType: options.chartType,
        displayOptions: {
          showLegend: true,
          showGrid: true,
          animate: true
        }
      }
    };
  }

  createMetricWidget(options: {
    title: string;
    value: string | number;
    unit?: string;
    thresholds?: ESThreshold[];
    position: { x: number; y: number; width: number; height: number };
  }): WidgetOptions {
    return {
      title: options.title,
      type: 'metric',
      position: options.position,
      dataSource: {
        type: 'static',
        parameters: { value: options.value }
      },
      config: {
        displayOptions: {
          unit: options.unit,
          format: 'number'
        },
        thresholds: options.thresholds
      }
    };
  }

  createTableWidget(options: {
    title: string;
    dataSource: DataSourceConfig;
    columns: { field: string; label: string; sortable?: boolean }[];
    position: { x: number; y: number; width: number; height: number };
  }): WidgetOptions {
    return {
      title: options.title,
      type: 'table',
      position: options.position,
      dataSource: options.dataSource,
      config: {
        displayOptions: {
          columns: options.columns,
          pagination: true,
          pageSize: 10
        }
      }
    };
  }
}