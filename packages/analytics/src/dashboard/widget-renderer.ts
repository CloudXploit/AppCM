// Widget Renderer
// Renders dashboard widgets with various visualization types

import {
  Widget,
  WidgetType,
  VisualizationConfig,
  DataSource,
  SystemMetrics,
  Finding,
  Anomaly,
  Prediction
} from '../types';
import { logger } from '@cm-diagnostics/logger';
import * as d3 from 'd3';
import { Chart, ChartConfiguration } from 'chart.js';
import Plot from '@observablehq/plot';

export interface WidgetData {
  type: 'metrics' | 'findings' | 'anomalies' | 'predictions' | 'custom';
  data: any[];
  metadata?: Record<string, any>;
}

export interface RenderOptions {
  container: HTMLElement;
  theme?: 'light' | 'dark';
  interactive?: boolean;
  animations?: boolean;
}

export class WidgetRenderer {
  private chartInstances: Map<string, Chart> = new Map();
  private d3Instances: Map<string, any> = new Map();

  async render(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    logger.debug('Rendering widget', { widgetId: widget.id, type: widget.type });

    // Clear previous render if exists
    this.cleanup(widget.id);

    try {
      switch (widget.type) {
        case WidgetType.METRIC_CARD:
          await this.renderMetricCard(widget, data, options);
          break;
        case WidgetType.TIME_SERIES:
          await this.renderTimeSeries(widget, data, options);
          break;
        case WidgetType.HEATMAP:
          await this.renderHeatmap(widget, data, options);
          break;
        case WidgetType.PIE_CHART:
          await this.renderPieChart(widget, data, options);
          break;
        case WidgetType.BAR_CHART:
          await this.renderBarChart(widget, data, options);
          break;
        case WidgetType.SCATTER_PLOT:
          await this.renderScatterPlot(widget, data, options);
          break;
        case WidgetType.GAUGE:
          await this.renderGauge(widget, data, options);
          break;
        case WidgetType.TABLE:
          await this.renderTable(widget, data, options);
          break;
        case WidgetType.MAP:
          await this.renderMap(widget, data, options);
          break;
        case WidgetType.SANKEY:
          await this.renderSankey(widget, data, options);
          break;
        case WidgetType.NETWORK_GRAPH:
          await this.renderNetworkGraph(widget, data, options);
          break;
        default:
          throw new Error(`Unsupported widget type: ${widget.type}`);
      }
    } catch (error) {
      logger.error('Widget render failed', { widgetId: widget.id, error });
      this.renderError(widget, error as Error, options);
    }
  }

  private async renderMetricCard(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const container = options.container;
    const vizOptions = widget.visualization.options;

    // Extract current value
    const currentValue = this.extractMetricValue(data.data);
    const previousValue = vizOptions.comparison?.enabled
      ? this.extractPreviousValue(data.data)
      : null;

    // Create card structure
    const card = d3.select(container)
      .append('div')
      .attr('class', 'metric-card')
      .style('height', '100%')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('padding', '16px');

    // Title
    card.append('div')
      .attr('class', 'metric-title')
      .style('font-size', '14px')
      .style('color', options.theme === 'dark' ? '#ccc' : '#666')
      .text(widget.title);

    // Value
    const valueDiv = card.append('div')
      .attr('class', 'metric-value')
      .style('font-size', '32px')
      .style('font-weight', 'bold')
      .style('color', options.theme === 'dark' ? '#fff' : '#333')
      .style('margin', '8px 0');

    valueDiv.text(this.formatValue(currentValue, vizOptions.format, vizOptions.precision));

    // Comparison
    if (previousValue !== null) {
      const change = ((currentValue - previousValue) / previousValue) * 100;
      const changeDiv = card.append('div')
        .attr('class', 'metric-change')
        .style('font-size', '14px')
        .style('display', 'flex')
        .style('align-items', 'center');

      // Arrow
      changeDiv.append('span')
        .style('margin-right', '4px')
        .text(change > 0 ? '↑' : change < 0 ? '↓' : '→')
        .style('color', change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#6b7280');

      // Change value
      changeDiv.append('span')
        .text(`${Math.abs(change).toFixed(1)}%`)
        .style('color', change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#6b7280');
    }

    // Sparkline
    if (vizOptions.sparkline && data.data.length > 1) {
      const sparklineDiv = card.append('div')
        .attr('class', 'metric-sparkline')
        .style('flex', '1')
        .style('margin-top', '8px');

      this.renderSparkline(sparklineDiv.node()!, data.data, options);
    }

    this.d3Instances.set(widget.id, card);
  }

  private async renderTimeSeries(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const canvas = document.createElement('canvas');
    options.container.appendChild(canvas);

    const chartData = this.prepareTimeSeriesData(data.data, widget.dataSource.query);
    
    const config: ChartConfiguration = {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: options.animations ? 750 : 0
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: widget.visualization.options.showLegend !== false,
            position: 'bottom'
          },
          tooltip: {
            enabled: options.interactive !== false
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                hour: 'HH:mm',
                day: 'MMM DD',
                week: 'MMM DD',
                month: 'MMM YYYY'
              }
            },
            grid: {
              display: widget.visualization.options.showGrid !== false
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              display: widget.visualization.options.showGrid !== false
            }
          }
        }
      }
    };

    const chart = new Chart(canvas, config);
    this.chartInstances.set(widget.id, chart);
  }

  private async renderHeatmap(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const container = options.container;
    const vizOptions = widget.visualization.options;

    // Process data for heatmap
    const processedData = this.processHeatmapData(data.data);

    // Create SVG
    const margin = { top: 30, right: 30, bottom: 60, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(processedData.xLabels)
      .range([0, width])
      .padding(vizOptions.cellGap || 0.01);

    const yScale = d3.scaleBand()
      .domain(processedData.yLabels)
      .range([height, 0])
      .padding(vizOptions.cellGap || 0.01);

    const colorScale = d3.scaleSequential()
      .interpolator(d3.interpolateViridis)
      .domain([processedData.minValue, processedData.maxValue]);

    // Draw cells
    svg.selectAll('.cell')
      .data(processedData.cells)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', d => xScale(d.x)!)
      .attr('y', d => yScale(d.y)!)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', d => colorScale(d.value))
      .style('stroke', 'none');

    // Add axes
    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

    svg.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale));

    // Add labels if enabled
    if (vizOptions.showLabels) {
      svg.selectAll('.label')
        .data(processedData.cells)
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('x', d => xScale(d.x)! + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.y)! + yScale.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('fill', d => d.value > (processedData.maxValue - processedData.minValue) / 2 ? '#fff' : '#000')
        .style('font-size', '10px')
        .text(d => d.value.toFixed(0));
    }

    this.d3Instances.set(widget.id, svg);
  }

  private async renderPieChart(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const canvas = document.createElement('canvas');
    options.container.appendChild(canvas);

    const chartData = this.preparePieData(data.data);
    
    const config: ChartConfiguration = {
      type: 'pie',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: options.animations ? 750 : 0
        },
        plugins: {
          legend: {
            display: true,
            position: 'right'
          },
          tooltip: {
            enabled: options.interactive !== false
          }
        }
      }
    };

    const chart = new Chart(canvas, config);
    this.chartInstances.set(widget.id, chart);
  }

  private async renderBarChart(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const canvas = document.createElement('canvas');
    options.container.appendChild(canvas);

    const chartData = this.prepareBarData(data.data);
    const vizOptions = widget.visualization.options;
    
    const config: ChartConfiguration = {
      type: vizOptions.horizontal ? 'bar' : 'bar',
      data: chartData,
      options: {
        indexAxis: vizOptions.horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: options.animations ? 750 : 0
        },
        plugins: {
          legend: {
            display: chartData.datasets.length > 1
          }
        },
        scales: {
          x: {
            stacked: vizOptions.stacked || false
          },
          y: {
            stacked: vizOptions.stacked || false
          }
        }
      }
    };

    const chart = new Chart(canvas, config);
    this.chartInstances.set(widget.id, chart);
  }

  private async renderScatterPlot(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const container = options.container;
    
    // Use Observable Plot for scatter plots
    const plot = Plot.plot({
      width: container.clientWidth,
      height: container.clientHeight,
      grid: true,
      marks: [
        Plot.dot(data.data, {
          x: widget.visualization.options.xField || 'x',
          y: widget.visualization.options.yField || 'y',
          r: widget.visualization.options.sizeField || 3,
          fill: widget.visualization.options.colorField || '#3b82f6',
          opacity: 0.7
        })
      ]
    });

    container.appendChild(plot);
    this.d3Instances.set(widget.id, plot);
  }

  private async renderGauge(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const container = options.container;
    const value = this.extractMetricValue(data.data);
    const vizOptions = widget.visualization.options;

    const min = vizOptions.min || 0;
    const max = vizOptions.max || 100;
    const percentage = (value - min) / (max - min);

    // Create gauge using D3
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2 - 20;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Background arc
    const backgroundArc = d3.arc()
      .innerRadius(radius * 0.7)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2);

    g.append('path')
      .attr('d', backgroundArc as any)
      .style('fill', '#e5e7eb');

    // Value arc
    const valueArc = d3.arc()
      .innerRadius(radius * 0.7)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + Math.PI * percentage);

    g.append('path')
      .attr('d', valueArc as any)
      .style('fill', this.getGaugeColor(percentage));

    // Value text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .text(value.toFixed(vizOptions.precision || 0));

    // Label
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 30)
      .style('font-size', '14px')
      .style('fill', '#6b7280')
      .text(widget.title);

    this.d3Instances.set(widget.id, svg);
  }

  private async renderTable(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    const container = options.container;
    const vizOptions = widget.visualization.options;

    // Create table structure
    const tableWrapper = d3.select(container)
      .append('div')
      .style('height', '100%')
      .style('overflow', 'auto');

    const table = tableWrapper.append('table')
      .attr('class', 'widget-table')
      .style('width', '100%')
      .style('border-collapse', 'collapse');

    // Extract columns
    const columns = vizOptions.columns || (data.data.length > 0 ? Object.keys(data.data[0]) : []);

    // Header
    const thead = table.append('thead');
    thead.append('tr')
      .selectAll('th')
      .data(columns)
      .enter()
      .append('th')
      .style('padding', '8px')
      .style('text-align', 'left')
      .style('border-bottom', '1px solid #e5e7eb')
      .text(d => d);

    // Body
    const tbody = table.append('tbody');
    const rows = tbody.selectAll('tr')
      .data(data.data)
      .enter()
      .append('tr');

    rows.selectAll('td')
      .data(row => columns.map(col => row[col]))
      .enter()
      .append('td')
      .style('padding', '8px')
      .style('border-bottom', '1px solid #f3f4f6')
      .text(d => this.formatTableCell(d));

    this.d3Instances.set(widget.id, table);
  }

  private async renderMap(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    // Placeholder for map rendering
    // Would integrate with a mapping library like Leaflet or Mapbox
    const container = options.container;
    const placeholder = d3.select(container)
      .append('div')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('background', '#f3f4f6')
      .append('div')
      .style('text-align', 'center')
      .html('<p>Map Visualization</p><p style="font-size: 12px; color: #6b7280;">Requires map library integration</p>');

    this.d3Instances.set(widget.id, placeholder);
  }

  private async renderSankey(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    // Placeholder for Sankey diagram
    const container = options.container;
    const placeholder = d3.select(container)
      .append('div')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('background', '#f3f4f6')
      .append('div')
      .style('text-align', 'center')
      .html('<p>Sankey Diagram</p><p style="font-size: 12px; color: #6b7280;">Flow visualization</p>');

    this.d3Instances.set(widget.id, placeholder);
  }

  private async renderNetworkGraph(
    widget: Widget,
    data: WidgetData,
    options: RenderOptions
  ): Promise<void> {
    // Placeholder for network graph
    const container = options.container;
    const placeholder = d3.select(container)
      .append('div')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('background', '#f3f4f6')
      .append('div')
      .style('text-align', 'center')
      .html('<p>Network Graph</p><p style="font-size: 12px; color: #6b7280;">Relationship visualization</p>');

    this.d3Instances.set(widget.id, placeholder);
  }

  private renderSparkline(container: HTMLElement, data: any[], options: RenderOptions): void {
    const width = container.clientWidth;
    const height = 40;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const values = data.map(d => d.value || d);
    const xScale = d3.scaleLinear()
      .domain([0, values.length - 1])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(values) as [number, number])
      .range([height - 5, 5]);

    const line = d3.line<number>()
      .x((d, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(values)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line);
  }

  private renderError(widget: Widget, error: Error, options: RenderOptions): void {
    const container = options.container;
    d3.select(container)
      .append('div')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('text-align', 'center')
      .style('padding', '16px')
      .html(`
        <div>
          <p style="color: #ef4444; font-weight: bold;">Render Error</p>
          <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">${error.message}</p>
        </div>
      `);
  }

  // Helper methods
  private extractMetricValue(data: any[]): number {
    if (data.length === 0) return 0;
    const latest = data[data.length - 1];
    return typeof latest === 'number' ? latest : latest.value || 0;
  }

  private extractPreviousValue(data: any[]): number | null {
    if (data.length < 2) return null;
    const previous = data[data.length - 2];
    return typeof previous === 'number' ? previous : previous.value || null;
  }

  private formatValue(value: number, format?: string, precision?: number): string {
    const p = precision ?? 2;
    
    switch (format) {
      case 'percent':
        return `${(value * 100).toFixed(p)}%`;
      case 'bytes':
        return this.formatBytes(value);
      case 'duration':
        return this.formatDuration(value);
      default:
        return value.toFixed(p);
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  private formatTableCell(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'number') return value.toFixed(2);
    if (value instanceof Date) return value.toLocaleString();
    return String(value);
  }

  private prepareTimeSeriesData(data: any[], query: DataQuery): any {
    // Implementation would transform data based on query
    return {
      labels: data.map(d => d.timestamp || new Date()),
      datasets: [{
        label: 'Series 1',
        data: data.map(d => d.value || 0),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1
      }]
    };
  }

  private preparePieData(data: any[]): any {
    return {
      labels: data.map(d => d.label || d.name || 'Unknown'),
      datasets: [{
        data: data.map(d => d.value || 0),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#ec4899'
        ]
      }]
    };
  }

  private prepareBarData(data: any[]): any {
    return {
      labels: data.map(d => d.label || d.name || 'Unknown'),
      datasets: [{
        label: 'Values',
        data: data.map(d => d.value || 0),
        backgroundColor: '#3b82f6'
      }]
    };
  }

  private processHeatmapData(data: any[]): any {
    // Process data for heatmap visualization
    const xLabels = Array.from(new Set(data.map(d => d.x || d.hour || '0')));
    const yLabels = Array.from(new Set(data.map(d => d.y || d.day || '0')));
    const values = data.map(d => d.value || 0);

    return {
      xLabels,
      yLabels,
      cells: data.map(d => ({
        x: d.x || d.hour || '0',
        y: d.y || d.day || '0',
        value: d.value || 0
      })),
      minValue: Math.min(...values),
      maxValue: Math.max(...values)
    };
  }

  private getGaugeColor(percentage: number): string {
    if (percentage < 0.33) return '#10b981';
    if (percentage < 0.66) return '#f59e0b';
    return '#ef4444';
  }

  cleanup(widgetId: string): void {
    // Cleanup Chart.js instances
    const chart = this.chartInstances.get(widgetId);
    if (chart) {
      chart.destroy();
      this.chartInstances.delete(widgetId);
    }

    // Cleanup D3 instances
    const d3Instance = this.d3Instances.get(widgetId);
    if (d3Instance) {
      d3Instance.remove();
      this.d3Instances.delete(widgetId);
    }
  }

  destroy(): void {
    // Cleanup all instances
    this.chartInstances.forEach(chart => chart.destroy());
    this.chartInstances.clear();

    this.d3Instances.forEach(instance => instance.remove());
    this.d3Instances.clear();
  }
}