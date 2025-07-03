// Dashboard Manager
// Core dashboard management functionality

import { EventEmitter } from 'events';
import {
  Dashboard,
  DashboardType,
  Widget,
  WidgetType,
  DashboardFilter,
  DataSource,
  DataQuery,
  TimeRange,
  AnalyticsEvent,
  AnalyticsEventType
} from '../types';
import { logger } from '@cm-diagnostics/logger';
import { v4 as uuidv4 } from 'uuid';

export interface DashboardManagerConfig {
  maxDashboards?: number;
  maxWidgetsPerDashboard?: number;
  defaultRefreshInterval?: number;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
}

export class DashboardManager extends EventEmitter {
  private dashboards: Map<string, Dashboard> = new Map();
  private activeDashboard: string | null = null;
  private config: Required<DashboardManagerConfig>;
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(config: DashboardManagerConfig = {}) {
    super();
    
    this.config = {
      maxDashboards: 100,
      maxWidgetsPerDashboard: 50,
      defaultRefreshInterval: 30,
      enableAutoSave: true,
      autoSaveInterval: 60000, // 1 minute
      ...config
    };

    if (this.config.enableAutoSave) {
      this.startAutoSave();
    }

    logger.info('Dashboard Manager initialized', { config: this.config });
  }

  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.saveAll().catch(error => {
        logger.error('Auto-save failed', error);
      });
    }, this.config.autoSaveInterval);
  }

  async createDashboard(
    name: string,
    type: DashboardType,
    createdBy: string
  ): Promise<Dashboard> {
    if (this.dashboards.size >= this.config.maxDashboards) {
      throw new Error(`Maximum number of dashboards (${this.config.maxDashboards}) reached`);
    }

    const dashboard: Dashboard = {
      id: uuidv4(),
      name,
      type,
      layout: {
        type: 'grid',
        columns: 12,
        rows: 8,
        breakpoints: {
          lg: 1200,
          md: 996,
          sm: 768,
          xs: 480
        }
      },
      widgets: [],
      filters: [],
      refreshInterval: this.config.defaultRefreshInterval,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      tags: [],
      permissions: {
        owner: createdBy,
        viewers: [],
        editors: [],
        public: false
      }
    };

    // Add default filters based on type
    dashboard.filters = this.getDefaultFilters(type);

    this.dashboards.set(dashboard.id, dashboard);
    
    this.emit('dashboardCreated', dashboard);
    this.emitAnalyticsEvent({
      type: AnalyticsEventType.DASHBOARD_UPDATE,
      timestamp: new Date(),
      data: { action: 'created', dashboard }
    });

    logger.info('Dashboard created', { id: dashboard.id, name, type });
    
    return dashboard;
  }

  private getDefaultFilters(type: DashboardType): DashboardFilter[] {
    const commonFilters: DashboardFilter[] = [
      {
        id: 'timeRange',
        field: 'timestamp',
        label: 'Time Range',
        type: 'daterange',
        defaultValue: { start: 'now-1h', end: 'now' }
      },
      {
        id: 'systems',
        field: 'systemId',
        label: 'Systems',
        type: 'multiselect',
        options: []
      }
    ];

    switch (type) {
      case DashboardType.PERFORMANCE:
        return [
          ...commonFilters,
          {
            id: 'metric',
            field: 'metric',
            label: 'Metric',
            type: 'select',
            options: [
              { label: 'CPU Usage', value: 'cpu_usage' },
              { label: 'Memory Usage', value: 'memory_usage' },
              { label: 'Response Time', value: 'response_time' },
              { label: 'Throughput', value: 'throughput' }
            ]
          }
        ];

      case DashboardType.SECURITY:
        return [
          ...commonFilters,
          {
            id: 'severity',
            field: 'severity',
            label: 'Severity',
            type: 'multiselect',
            options: [
              { label: 'Critical', value: 'critical' },
              { label: 'High', value: 'high' },
              { label: 'Medium', value: 'medium' },
              { label: 'Low', value: 'low' }
            ]
          }
        ];

      default:
        return commonFilters;
    }
  }

  async addWidget(
    dashboardId: string,
    widget: Omit<Widget, 'id'>
  ): Promise<Widget> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    if (dashboard.widgets.length >= this.config.maxWidgetsPerDashboard) {
      throw new Error(`Maximum widgets (${this.config.maxWidgetsPerDashboard}) reached`);
    }

    const newWidget: Widget = {
      ...widget,
      id: uuidv4()
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = new Date();

    this.emit('widgetAdded', { dashboard, widget: newWidget });
    this.emitAnalyticsEvent({
      type: AnalyticsEventType.WIDGET_UPDATE,
      timestamp: new Date(),
      data: { action: 'added', dashboardId, widget: newWidget }
    });

    logger.debug('Widget added to dashboard', {
      dashboardId,
      widgetId: newWidget.id,
      type: newWidget.type
    });

    return newWidget;
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<Widget>
  ): Promise<Widget> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    const updatedWidget = {
      ...dashboard.widgets[widgetIndex],
      ...updates,
      id: widgetId // Ensure ID doesn't change
    };

    dashboard.widgets[widgetIndex] = updatedWidget;
    dashboard.updatedAt = new Date();

    this.emit('widgetUpdated', { dashboard, widget: updatedWidget });
    this.emitAnalyticsEvent({
      type: AnalyticsEventType.WIDGET_UPDATE,
      timestamp: new Date(),
      data: { action: 'updated', dashboardId, widget: updatedWidget }
    });

    return updatedWidget;
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<void> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    const removed = dashboard.widgets.splice(widgetIndex, 1)[0];
    dashboard.updatedAt = new Date();

    this.emit('widgetRemoved', { dashboard, widget: removed });
    this.emitAnalyticsEvent({
      type: AnalyticsEventType.WIDGET_UPDATE,
      timestamp: new Date(),
      data: { action: 'removed', dashboardId, widgetId }
    });
  }

  async updateDashboard(
    dashboardId: string,
    updates: Partial<Dashboard>
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const updated = {
      ...dashboard,
      ...updates,
      id: dashboardId, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    this.dashboards.set(dashboardId, updated);

    this.emit('dashboardUpdated', updated);
    this.emitAnalyticsEvent({
      type: AnalyticsEventType.DASHBOARD_UPDATE,
      timestamp: new Date(),
      data: { action: 'updated', dashboard: updated }
    });

    return updated;
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    this.dashboards.delete(dashboardId);

    if (this.activeDashboard === dashboardId) {
      this.activeDashboard = null;
    }

    this.emit('dashboardDeleted', dashboard);
    this.emitAnalyticsEvent({
      type: AnalyticsEventType.DASHBOARD_UPDATE,
      timestamp: new Date(),
      data: { action: 'deleted', dashboardId }
    });

    logger.info('Dashboard deleted', { id: dashboardId });
  }

  getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  listDashboards(filters?: {
    type?: DashboardType;
    tags?: string[];
    owner?: string;
  }): Dashboard[] {
    let dashboards = Array.from(this.dashboards.values());

    if (filters) {
      if (filters.type) {
        dashboards = dashboards.filter(d => d.type === filters.type);
      }
      if (filters.tags && filters.tags.length > 0) {
        dashboards = dashboards.filter(d =>
          filters.tags!.some(tag => d.tags.includes(tag))
        );
      }
      if (filters.owner) {
        dashboards = dashboards.filter(d => d.permissions.owner === filters.owner);
      }
    }

    return dashboards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  setActiveDashboard(dashboardId: string): void {
    if (!this.dashboards.has(dashboardId)) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    this.activeDashboard = dashboardId;
    this.emit('activeDashboardChanged', dashboardId);
  }

  getActiveDashboard(): Dashboard | null {
    if (!this.activeDashboard) {
      return null;
    }
    return this.dashboards.get(this.activeDashboard) || null;
  }

  // Widget-specific operations
  async createMetricWidget(
    dashboardId: string,
    metric: string,
    systemIds: string[],
    position: { x: number; y: number }
  ): Promise<Widget> {
    const widget: Omit<Widget, 'id'> = {
      type: WidgetType.METRIC_CARD,
      title: metric.replace(/_/g, ' ').toUpperCase(),
      dataSource: {
        type: 'metrics',
        query: {
          systems: systemIds,
          metrics: [metric],
          timeRange: { start: 'now-1h', end: 'now' },
          aggregation: { method: 'avg', interval: '5m' }
        }
      },
      visualization: {
        type: 'metric',
        options: {
          format: 'number',
          precision: 2,
          sparkline: true,
          comparison: { enabled: true, period: 'previous' }
        }
      },
      position,
      size: { width: 3, height: 2 }
    };

    return this.addWidget(dashboardId, widget);
  }

  async createTimeSeriesWidget(
    dashboardId: string,
    metrics: string[],
    systemIds: string[],
    position: { x: number; y: number }
  ): Promise<Widget> {
    const widget: Omit<Widget, 'id'> = {
      type: WidgetType.TIME_SERIES,
      title: 'Time Series',
      dataSource: {
        type: 'metrics',
        query: {
          systems: systemIds,
          metrics,
          timeRange: { start: 'now-24h', end: 'now' },
          aggregation: { method: 'avg', interval: '5m' }
        }
      },
      visualization: {
        type: 'line',
        options: {
          showLegend: true,
          showGrid: true,
          smooth: true,
          stacked: false,
          animations: true
        }
      },
      position,
      size: { width: 6, height: 4 }
    };

    return this.addWidget(dashboardId, widget);
  }

  async createHeatmapWidget(
    dashboardId: string,
    metric: string,
    systemIds: string[],
    position: { x: number; y: number }
  ): Promise<Widget> {
    const widget: Omit<Widget, 'id'> = {
      type: WidgetType.HEATMAP,
      title: `${metric} Heatmap`,
      dataSource: {
        type: 'metrics',
        query: {
          systems: systemIds,
          metrics: [metric],
          timeRange: { start: 'now-7d', end: 'now' },
          aggregation: { method: 'avg', interval: '1h' }
        }
      },
      visualization: {
        type: 'heatmap',
        options: {
          colorScheme: 'viridis',
          showLabels: true,
          cellGap: 1
        }
      },
      position,
      size: { width: 6, height: 4 }
    };

    return this.addWidget(dashboardId, widget);
  }

  // Dashboard templates
  async createFromTemplate(
    template: DashboardType,
    name: string,
    createdBy: string,
    systemIds: string[]
  ): Promise<Dashboard> {
    const dashboard = await this.createDashboard(name, template, createdBy);

    switch (template) {
      case DashboardType.OVERVIEW:
        await this.setupOverviewDashboard(dashboard.id, systemIds);
        break;
      case DashboardType.PERFORMANCE:
        await this.setupPerformanceDashboard(dashboard.id, systemIds);
        break;
      case DashboardType.SECURITY:
        await this.setupSecurityDashboard(dashboard.id, systemIds);
        break;
      case DashboardType.CAPACITY:
        await this.setupCapacityDashboard(dashboard.id, systemIds);
        break;
    }

    return this.getDashboard(dashboard.id)!;
  }

  private async setupOverviewDashboard(dashboardId: string, systemIds: string[]): Promise<void> {
    // Row 1: Key metrics
    await this.createMetricWidget(dashboardId, 'cpu_usage', systemIds, { x: 0, y: 0 });
    await this.createMetricWidget(dashboardId, 'memory_usage', systemIds, { x: 3, y: 0 });
    await this.createMetricWidget(dashboardId, 'response_time', systemIds, { x: 6, y: 0 });
    await this.createMetricWidget(dashboardId, 'error_rate', systemIds, { x: 9, y: 0 });

    // Row 2-3: Time series
    await this.createTimeSeriesWidget(
      dashboardId,
      ['cpu_usage', 'memory_usage'],
      systemIds,
      { x: 0, y: 2 }
    );
    await this.createTimeSeriesWidget(
      dashboardId,
      ['response_time', 'throughput'],
      systemIds,
      { x: 6, y: 2 }
    );

    // Row 4-5: Heatmap
    await this.createHeatmapWidget(dashboardId, 'cpu_usage', systemIds, { x: 0, y: 6 });
  }

  private async setupPerformanceDashboard(dashboardId: string, systemIds: string[]): Promise<void> {
    // Performance-specific widgets
    await this.createMetricWidget(dashboardId, 'response_time', systemIds, { x: 0, y: 0 });
    await this.createMetricWidget(dashboardId, 'throughput', systemIds, { x: 3, y: 0 });
    await this.createMetricWidget(dashboardId, 'cpu_usage', systemIds, { x: 6, y: 0 });
    await this.createMetricWidget(dashboardId, 'memory_usage', systemIds, { x: 9, y: 0 });

    // Detailed time series
    await this.createTimeSeriesWidget(
      dashboardId,
      ['response_time', 'p95_response_time', 'p99_response_time'],
      systemIds,
      { x: 0, y: 2 }
    );
  }

  private async setupSecurityDashboard(dashboardId: string, systemIds: string[]): Promise<void> {
    // Security metrics
    await this.createMetricWidget(dashboardId, 'auth_failures', systemIds, { x: 0, y: 0 });
    await this.createMetricWidget(dashboardId, 'suspicious_activities', systemIds, { x: 3, y: 0 });
    await this.createMetricWidget(dashboardId, 'permission_changes', systemIds, { x: 6, y: 0 });
  }

  private async setupCapacityDashboard(dashboardId: string, systemIds: string[]): Promise<void> {
    // Capacity planning widgets
    await this.createMetricWidget(dashboardId, 'disk_usage', systemIds, { x: 0, y: 0 });
    await this.createMetricWidget(dashboardId, 'memory_usage', systemIds, { x: 3, y: 0 });
    await this.createMetricWidget(dashboardId, 'connection_pool_usage', systemIds, { x: 6, y: 0 });
  }

  // Persistence methods
  async saveAll(): Promise<void> {
    const dashboards = Array.from(this.dashboards.values());
    logger.debug(`Saving ${dashboards.length} dashboards`);
    // Implementation would save to storage
  }

  async loadAll(): Promise<void> {
    logger.debug('Loading dashboards');
    // Implementation would load from storage
  }

  private emitAnalyticsEvent(event: AnalyticsEvent): void {
    this.emit('analyticsEvent', event);
  }

  // Cleanup
  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    this.removeAllListeners();
    this.dashboards.clear();
  }
}