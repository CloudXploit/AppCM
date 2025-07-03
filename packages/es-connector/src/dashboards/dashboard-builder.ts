import {
  ESDashboard,
  ESWidget,
  ESDashboardLayout,
  ESDashboardFilter,
  ESWidgetConfig,
  ESDataSource,
  ESThreshold
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class DashboardBuilder {
  private dashboard: Partial<ESDashboard>;
  private gridSize = { columns: 12, rows: 8 };
  private currentRow = 0;

  constructor(name: string, description?: string) {
    this.dashboard = {
      id: uuidv4(),
      name,
      description,
      layout: {
        type: 'grid',
        columns: this.gridSize.columns,
        rows: this.gridSize.rows,
        responsive: true
      },
      widgets: [],
      filters: [],
      createdDate: new Date(),
      modifiedDate: new Date()
    };
  }

  static create(name: string, description?: string): DashboardBuilder {
    return new DashboardBuilder(name, description);
  }

  layout(type: ESDashboardLayout['type'], options?: {
    columns?: number;
    rows?: number;
    responsive?: boolean;
  }): this {
    this.dashboard.layout = {
      type,
      columns: options?.columns || this.gridSize.columns,
      rows: options?.rows || this.gridSize.rows,
      responsive: options?.responsive ?? true
    };
    
    if (options?.columns) this.gridSize.columns = options.columns;
    if (options?.rows) this.gridSize.rows = options.rows;
    
    return this;
  }

  refreshInterval(seconds: number): this {
    this.dashboard.refreshInterval = seconds * 1000;
    return this;
  }

  filter(config: {
    name: string;
    type: ESDashboardFilter['type'];
    defaultValue?: any;
    options?: any[];
    required?: boolean;
  }): this {
    if (!this.dashboard.filters) {
      this.dashboard.filters = [];
    }

    this.dashboard.filters.push({
      id: `filter-${this.dashboard.filters.length}`,
      ...config,
      affectsWidgets: []
    });

    return this;
  }

  // Widget methods with auto-positioning
  addWidget(widget: ESWidget): this {
    if (!this.dashboard.widgets) {
      this.dashboard.widgets = [];
    }
    
    this.dashboard.widgets.push(widget);
    return this;
  }

  metric(
    title: string,
    dataSource: ESDataSource | string,
    options?: {
      unit?: string;
      format?: string;
      thresholds?: ESThreshold[];
      width?: number;
      height?: number;
      position?: { x: number; y: number };
    }
  ): this {
    const position = options?.position || this.getNextPosition(options?.width || 3, options?.height || 2);
    
    const widget: ESWidget = {
      id: uuidv4(),
      type: 'metric',
      title,
      position: {
        ...position,
        width: options?.width || 3,
        height: options?.height || 2
      },
      dataSource: typeof dataSource === 'string' 
        ? { type: 'query', configuration: { query: dataSource } }
        : dataSource,
      configuration: {
        displayOptions: {
          unit: options?.unit,
          format: options?.format || 'number'
        },
        thresholds: options?.thresholds
      }
    };

    return this.addWidget(widget);
  }

  chart(
    title: string,
    chartType: ESWidgetConfig['chartType'],
    dataSource: ESDataSource | string,
    options?: {
      width?: number;
      height?: number;
      position?: { x: number; y: number };
      xAxis?: string;
      yAxis?: string;
      series?: string[];
    }
  ): this {
    const position = options?.position || this.getNextPosition(options?.width || 6, options?.height || 4);
    
    const widget: ESWidget = {
      id: uuidv4(),
      type: 'chart',
      title,
      position: {
        ...position,
        width: options?.width || 6,
        height: options?.height || 4
      },
      dataSource: typeof dataSource === 'string'
        ? { type: 'query', configuration: { query: dataSource } }
        : dataSource,
      configuration: {
        chartType,
        displayOptions: {
          xAxis: options?.xAxis,
          yAxis: options?.yAxis,
          series: options?.series,
          showLegend: true,
          showGrid: true,
          animate: true
        }
      }
    };

    return this.addWidget(widget);
  }

  table(
    title: string,
    dataSource: ESDataSource | string,
    columns: Array<{
      field: string;
      label: string;
      sortable?: boolean;
      width?: number;
    }>,
    options?: {
      width?: number;
      height?: number;
      position?: { x: number; y: number };
      pageSize?: number;
    }
  ): this {
    const position = options?.position || this.getNextPosition(options?.width || 12, options?.height || 6);
    
    const widget: ESWidget = {
      id: uuidv4(),
      type: 'table',
      title,
      position: {
        ...position,
        width: options?.width || 12,
        height: options?.height || 6
      },
      dataSource: typeof dataSource === 'string'
        ? { type: 'query', configuration: { query: dataSource } }
        : dataSource,
      configuration: {
        displayOptions: {
          columns,
          pagination: true,
          pageSize: options?.pageSize || 10,
          sortable: true,
          filterable: true
        }
      }
    };

    return this.addWidget(widget);
  }

  text(
    title: string,
    content: string,
    options?: {
      width?: number;
      height?: number;
      position?: { x: number; y: number };
      markdown?: boolean;
    }
  ): this {
    const position = options?.position || this.getNextPosition(options?.width || 6, options?.height || 2);
    
    const widget: ESWidget = {
      id: uuidv4(),
      type: 'text',
      title,
      position: {
        ...position,
        width: options?.width || 6,
        height: options?.height || 2
      },
      configuration: {
        displayOptions: {
          content,
          markdown: options?.markdown || false
        }
      }
    };

    return this.addWidget(widget);
  }

  custom(
    title: string,
    componentId: string,
    props: Record<string, any>,
    options?: {
      width?: number;
      height?: number;
      position?: { x: number; y: number };
      dataSource?: ESDataSource;
    }
  ): this {
    const position = options?.position || this.getNextPosition(options?.width || 6, options?.height || 4);
    
    const widget: ESWidget = {
      id: uuidv4(),
      type: 'custom',
      title,
      position: {
        ...position,
        width: options?.width || 6,
        height: options?.height || 4
      },
      dataSource: options?.dataSource,
      configuration: {
        displayOptions: {
          componentId,
          props
        }
      }
    };

    return this.addWidget(widget);
  }

  // Row-based layout helpers
  row(): RowBuilder {
    return new RowBuilder(this, this.currentRow++, this.gridSize.columns);
  }

  // Data source helpers
  queryDataSource(query: string, database?: string): ESDataSource {
    return {
      type: 'query',
      configuration: {
        query,
        database
      }
    };
  }

  apiDataSource(endpoint: string, method: string = 'GET', params?: Record<string, any>): ESDataSource {
    return {
      type: 'api',
      configuration: {
        api: endpoint,
        method,
        parameters: params
      }
    };
  }

  workflowDataSource(workflowId: string, outputField: string): ESDataSource {
    return {
      type: 'workflow',
      configuration: {
        workflowId,
        outputField
      }
    };
  }

  // Threshold helpers
  threshold(value: number, color: string, operator: ESThreshold['operator'] = 'gte'): ESThreshold {
    return { value, color, operator };
  }

  build(): ESDashboard {
    if (!this.dashboard.widgets || this.dashboard.widgets.length === 0) {
      throw new Error('Dashboard must have at least one widget');
    }

    return this.dashboard as ESDashboard;
  }

  private getNextPosition(width: number, height: number): { x: number; y: number } {
    // Simple left-to-right, top-to-bottom positioning
    const widgets = this.dashboard.widgets || [];
    
    if (widgets.length === 0) {
      return { x: 0, y: 0 };
    }

    // Find the first available position
    for (let y = 0; y <= this.gridSize.rows - height; y++) {
      for (let x = 0; x <= this.gridSize.columns - width; x++) {
        if (this.isPositionAvailable(x, y, width, height)) {
          return { x, y };
        }
      }
    }

    // If no position found, extend the grid
    return { x: 0, y: this.gridSize.rows };
  }

  private isPositionAvailable(x: number, y: number, width: number, height: number): boolean {
    const widgets = this.dashboard.widgets || [];
    
    for (const widget of widgets) {
      const wx = widget.position.x;
      const wy = widget.position.y;
      const ww = widget.position.width;
      const wh = widget.position.height;
      
      // Check if rectangles overlap
      if (!(x + width <= wx || x >= wx + ww || y + height <= wy || y >= wy + wh)) {
        return false;
      }
    }
    
    return true;
  }
}

class RowBuilder {
  private widgets: ESWidget[] = [];
  private currentX = 0;

  constructor(
    private parent: DashboardBuilder,
    private row: number,
    private maxColumns: number
  ) {}

  metric(title: string, value: string | number, options?: {
    unit?: string;
    thresholds?: ESThreshold[];
  }): this {
    const width = 3;
    if (this.currentX + width > this.maxColumns) {
      throw new Error('Row is full');
    }

    const widget: ESWidget = {
      id: uuidv4(),
      type: 'metric',
      title,
      position: {
        x: this.currentX,
        y: this.row * 2,
        width,
        height: 2
      },
      dataSource: {
        type: 'static',
        configuration: { value }
      },
      configuration: {
        displayOptions: {
          unit: options?.unit
        },
        thresholds: options?.thresholds
      }
    };

    this.widgets.push(widget);
    this.currentX += width;
    
    return this;
  }

  end(): DashboardBuilder {
    this.widgets.forEach(w => this.parent.addWidget(w));
    return this.parent;
  }
}

// Pre-built dashboard templates
export const DashboardTemplates = {
  systemHealth: () => {
    return DashboardBuilder.create('System Health Dashboard', 'Real-time system health monitoring')
      .refreshInterval(30)
      .filter({
        name: 'timeRange',
        type: 'range',
        defaultValue: { start: '-1h', end: 'now' }
      })
      .row()
        .metric('CPU Usage', '${system.cpu}', { unit: '%', thresholds: [
          { value: 80, color: 'orange', operator: 'gte' },
          { value: 90, color: 'red', operator: 'gte' }
        ]})
        .metric('Memory Usage', '${system.memory}', { unit: '%', thresholds: [
          { value: 80, color: 'orange', operator: 'gte' },
          { value: 90, color: 'red', operator: 'gte' }
        ]})
        .metric('Active Users', '${system.activeUsers}')
        .metric('Response Time', '${system.responseTime}', { unit: 'ms' })
        .end()
      .chart('Performance Trends', 'line', 'SELECT time, cpu, memory FROM metrics WHERE time >= ${timeRange.start}', {
        xAxis: 'time',
        yAxis: 'value',
        series: ['cpu', 'memory']
      })
      .table('Recent Alerts', 'SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 10', [
        { field: 'severity', label: 'Severity', sortable: true },
        { field: 'message', label: 'Message' },
        { field: 'timestamp', label: 'Time', sortable: true }
      ])
      .build();
  },

  workflowMonitoring: () => {
    return DashboardBuilder.create('Workflow Monitoring', 'Monitor workflow execution and performance')
      .refreshInterval(60)
      .metric('Active Workflows', '${workflows.active}')
      .metric('Success Rate', '${workflows.successRate}', { unit: '%' })
      .metric('Avg Duration', '${workflows.avgDuration}', { unit: 's' })
      .metric('Failed Today', '${workflows.failedToday}', {
        thresholds: [{ value: 1, color: 'red', operator: 'gte' }]
      })
      .chart('Execution Trend', 'bar', 'workflow-execution-stats', {
        chartType: 'bar',
        width: 12,
        height: 4
      })
      .table('Recent Executions', 'workflow-instances', [
        { field: 'workflowName', label: 'Workflow' },
        { field: 'status', label: 'Status' },
        { field: 'startTime', label: 'Started' },
        { field: 'duration', label: 'Duration' }
      ], { height: 6 })
      .build();
  }
};