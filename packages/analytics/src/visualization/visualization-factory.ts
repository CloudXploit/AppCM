// Visualization Factory
// Creates and manages data visualizations

import {
  Visualization,
  VisualizationType,
  VisualizationConfig,
  VisualizationInteraction,
  InteractionEvent,
  SystemMetrics,
  Finding,
  Anomaly,
  Prediction
} from '../types';
import { logger } from '@cm-diagnostics/logger';
import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
Chart.register(...registerables);

export interface VisualizationOptions {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  theme?: 'light' | 'dark';
  responsive?: boolean;
  animations?: boolean;
}

export class VisualizationFactory {
  private visualizations: Map<string, Visualization> = new Map();
  private chartInstances: Map<string, Chart> = new Map();

  create(
    type: VisualizationType,
    data: any[],
    config: VisualizationConfig,
    options?: VisualizationOptions
  ): Visualization {
    const viz: Visualization = {
      id: this.generateId(),
      type,
      data,
      config,
      interactions: []
    };

    this.visualizations.set(viz.id, viz);
    logger.debug('Visualization created', { id: viz.id, type });

    return viz;
  }

  render(
    visualization: Visualization,
    container: HTMLElement,
    options?: VisualizationOptions
  ): void {
    const opts = {
      width: container.clientWidth,
      height: container.clientHeight,
      margin: { top: 20, right: 20, bottom: 40, left: 40 },
      theme: 'light',
      responsive: true,
      animations: true,
      ...options
    };

    try {
      switch (visualization.type) {
        case VisualizationType.LINE_CHART:
          this.renderLineChart(visualization, container, opts);
          break;
        case VisualizationType.BAR_CHART:
          this.renderBarChart(visualization, container, opts);
          break;
        case VisualizationType.PIE_CHART:
          this.renderPieChart(visualization, container, opts);
          break;
        case VisualizationType.SCATTER_PLOT:
          this.renderScatterPlot(visualization, container, opts);
          break;
        case VisualizationType.HEATMAP:
          this.renderHeatmap(visualization, container, opts);
          break;
        case VisualizationType.SANKEY_DIAGRAM:
          this.renderSankeyDiagram(visualization, container, opts);
          break;
        case VisualizationType.NETWORK_GRAPH:
          this.renderNetworkGraph(visualization, container, opts);
          break;
        case VisualizationType.TREEMAP:
          this.renderTreemap(visualization, container, opts);
          break;
        case VisualizationType.SUNBURST:
          this.renderSunburst(visualization, container, opts);
          break;
        case VisualizationType.RADAR_CHART:
          this.renderRadarChart(visualization, container, opts);
          break;
        case VisualizationType.GAUGE_CHART:
          this.renderGaugeChart(visualization, container, opts);
          break;
        case VisualizationType.CANDLESTICK:
          this.renderCandlestick(visualization, container, opts);
          break;
        default:
          throw new Error(`Unsupported visualization type: ${visualization.type}`);
      }
    } catch (error) {
      logger.error('Visualization render failed', { vizId: visualization.id, error });
      this.renderError(container, error as Error);
    }
  }

  private renderLineChart(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    if (this.shouldUseChartJs(viz)) {
      this.renderChartJsLine(viz, container, options);
    } else {
      this.renderPlotLine(viz, container, options);
    }
  }

  private renderChartJsLine(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const datasets = this.prepareChartJsDatasets(viz.data, viz.config.options);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.extractLabels(viz.data),
        datasets
      },
      options: {
        responsive: options.responsive,
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
            display: viz.config.options.showLegend !== false,
            position: viz.config.options.legendPosition || 'bottom'
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return `${label}: ${this.formatValue(value, viz.config.options.format)}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: viz.config.options.xAxisType || 'category',
            title: {
              display: !!viz.config.options.xAxisLabel,
              text: viz.config.options.xAxisLabel
            }
          },
          y: {
            title: {
              display: !!viz.config.options.yAxisLabel,
              text: viz.config.options.yAxisLabel
            },
            beginAtZero: viz.config.options.beginAtZero !== false
          }
        }
      }
    };

    const chart = new Chart(canvas, config);
    this.chartInstances.set(viz.id, chart);

    // Add interactions
    this.addChartInteractions(chart, viz, canvas);
  }

  private renderPlotLine(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const plot = Plot.plot({
      width: options.width,
      height: options.height,
      margin: options.margin,
      style: {
        background: 'transparent',
        color: options.theme === 'dark' ? '#fff' : '#000'
      },
      marks: [
        Plot.line(viz.data, {
          x: viz.config.options.xField || 'x',
          y: viz.config.options.yField || 'y',
          stroke: viz.config.options.colorField || '#3b82f6',
          strokeWidth: 2
        }),
        Plot.dot(viz.data, {
          x: viz.config.options.xField || 'x',
          y: viz.config.options.yField || 'y',
          r: 3,
          fill: viz.config.options.colorField || '#3b82f6'
        })
      ]
    });

    container.appendChild(plot);
  }

  private renderBarChart(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: this.extractLabels(viz.data),
        datasets: this.prepareChartJsDatasets(viz.data, viz.config.options)
      },
      options: {
        indexAxis: viz.config.options.horizontal ? 'y' : 'x',
        responsive: options.responsive,
        maintainAspectRatio: false,
        animation: {
          duration: options.animations ? 750 : 0
        },
        scales: {
          x: {
            stacked: viz.config.options.stacked || false
          },
          y: {
            stacked: viz.config.options.stacked || false,
            beginAtZero: true
          }
        }
      }
    };

    const chart = new Chart(canvas, config);
    this.chartInstances.set(viz.id, chart);
  }

  private renderPieChart(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const config: ChartConfiguration = {
      type: viz.config.options.doughnut ? 'doughnut' : 'pie',
      data: {
        labels: viz.data.map(d => d.label || d.name || 'Unknown'),
        datasets: [{
          data: viz.data.map(d => d.value || 0),
          backgroundColor: this.generateColors(viz.data.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: options.responsive,
        maintainAspectRatio: false,
        animation: {
          duration: options.animations ? 750 : 0
        },
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    };

    const chart = new Chart(canvas, config);
    this.chartInstances.set(viz.id, chart);
  }

  private renderScatterPlot(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const plot = Plot.plot({
      width: options.width,
      height: options.height,
      margin: options.margin,
      grid: true,
      marks: [
        Plot.dot(viz.data, {
          x: viz.config.options.xField || 'x',
          y: viz.config.options.yField || 'y',
          r: viz.config.options.sizeField ? 
            (d: any) => Math.sqrt(d[viz.config.options.sizeField] || 3) : 3,
          fill: viz.config.options.colorField || '#3b82f6',
          opacity: 0.7,
          title: (d: any) => `${d.x}, ${d.y}`
        })
      ],
      x: {
        label: viz.config.options.xAxisLabel
      },
      y: {
        label: viz.config.options.yAxisLabel
      }
    });

    container.appendChild(plot);
  }

  private renderHeatmap(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const margin = options.margin!;
    const width = (options.width || container.clientWidth) - margin.left - margin.right;
    const height = (options.height || container.clientHeight) - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process data
    const xValues = Array.from(new Set(viz.data.map(d => d.x)));
    const yValues = Array.from(new Set(viz.data.map(d => d.y)));

    // Scales
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, width])
      .padding(0.01);

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([height, 0])
      .padding(0.01);

    const colorScale = this.createColorScale(viz);

    // Draw cells
    svg.selectAll()
      .data(viz.data)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.x)!)
      .attr('y', d => yScale(d.y)!)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', d => colorScale(d.value))
      .on('mouseover', function(event, d) {
        // Tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'viz-tooltip')
          .style('opacity', 0);

        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        
        tooltip.html(`Value: ${d.value}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.selectAll('.viz-tooltip').remove();
      });

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

    svg.append('g')
      .call(d3.axisLeft(yScale));

    // Add color legend
    this.addColorLegend(svg, colorScale, width);
  }

  private renderTreemap(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const width = options.width || container.clientWidth;
    const height = options.height || container.clientHeight;

    // Prepare hierarchical data
    const root = d3.hierarchy(viz.data[0])
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemap = d3.treemap()
      .size([width, height])
      .padding(2);

    treemap(root);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw rectangles
    const nodes = svg.selectAll('g')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    nodes.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .style('fill', d => colorScale(d.parent?.data.name || ''))
      .style('stroke', '#fff');

    // Add labels
    nodes.append('text')
      .attr('x', 4)
      .attr('y', 20)
      .text(d => d.data.name)
      .style('font-size', '12px')
      .style('fill', '#fff');
  }

  private renderSunburst(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const width = options.width || container.clientWidth;
    const height = options.height || container.clientHeight;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Prepare hierarchical data
    const root = d3.hierarchy(viz.data[0])
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition()
      .size([2 * Math.PI, radius]);

    partition(root);

    const arc = d3.arc()
      .startAngle((d: any) => d.x0)
      .endAngle((d: any) => d.x1)
      .innerRadius((d: any) => d.y0)
      .outerRadius((d: any) => d.y1);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw arcs
    svg.selectAll('path')
      .data(root.descendants())
      .enter()
      .append('path')
      .attr('d', arc as any)
      .style('fill', d => colorScale(d.data.name))
      .style('stroke', '#fff')
      .append('title')
      .text(d => `${d.data.name}: ${d.value}`);
  }

  private renderRadarChart(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const config: ChartConfiguration = {
      type: 'radar',
      data: {
        labels: viz.config.options.labels || viz.data.map(d => d.label),
        datasets: [{
          label: viz.config.options.label || 'Values',
          data: viz.data.map(d => d.value || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: '#3b82f6',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#3b82f6'
        }]
      },
      options: {
        responsive: options.responsive,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true
          }
        }
      }
    };

    const chart = new Chart(canvas, config);
    this.chartInstances.set(viz.id, chart);
  }

  private renderGaugeChart(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const width = options.width || container.clientWidth;
    const height = options.height || container.clientHeight;
    const radius = Math.min(width, height) / 2 - 20;

    const value = viz.data[0].value || 0;
    const min = viz.config.options.min || 0;
    const max = viz.config.options.max || 100;
    const percentage = (value - min) / (max - min);

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

    const valueColor = percentage < 0.33 ? '#10b981' :
                      percentage < 0.66 ? '#f59e0b' : '#ef4444';

    g.append('path')
      .attr('d', valueArc as any)
      .style('fill', valueColor);

    // Center text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '32px')
      .style('font-weight', 'bold')
      .text(value.toFixed(viz.config.options.precision || 0));

    // Label
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 40)
      .style('font-size', '16px')
      .style('fill', '#6b7280')
      .text(viz.config.options.label || '');
  }

  private renderCandlestick(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    const margin = options.margin!;
    const width = (options.width || container.clientWidth) - margin.left - margin.right;
    const height = (options.height || container.clientHeight) - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(viz.data, d => new Date(d.date)) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([
        d3.min(viz.data, d => d.low) || 0,
        d3.max(viz.data, d => d.high) || 100
      ])
      .range([height, 0]);

    // Draw candlesticks
    const candleWidth = width / viz.data.length * 0.8;

    viz.data.forEach(d => {
      const x = xScale(new Date(d.date));
      const color = d.close > d.open ? '#10b981' : '#ef4444';

      // High-Low line
      svg.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', yScale(d.high))
        .attr('y2', yScale(d.low))
        .attr('stroke', color)
        .attr('stroke-width', 1);

      // Open-Close rectangle
      svg.append('rect')
        .attr('x', x - candleWidth / 2)
        .attr('y', yScale(Math.max(d.open, d.close)))
        .attr('width', candleWidth)
        .attr('height', Math.abs(yScale(d.open) - yScale(d.close)))
        .attr('fill', color)
        .attr('stroke', color);
    });

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

    svg.append('g')
      .call(d3.axisLeft(yScale));
  }

  private renderSankeyDiagram(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    // Placeholder - would require d3-sankey
    this.renderPlaceholder(container, 'Sankey Diagram', 'Flow visualization');
  }

  private renderNetworkGraph(
    viz: Visualization,
    container: HTMLElement,
    options: VisualizationOptions
  ): void {
    // Placeholder - would require force-directed graph
    this.renderPlaceholder(container, 'Network Graph', 'Relationship visualization');
  }

  private renderPlaceholder(
    container: HTMLElement,
    title: string,
    subtitle: string
  ): void {
    const div = d3.select(container)
      .append('div')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('background', '#f3f4f6')
      .style('border-radius', '8px');

    div.append('div')
      .style('text-align', 'center')
      .html(`
        <h3 style="margin: 0; color: #374151;">${title}</h3>
        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">${subtitle}</p>
      `);
  }

  private renderError(container: HTMLElement, error: Error): void {
    d3.select(container)
      .append('div')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('padding', '16px')
      .style('text-align', 'center')
      .html(`
        <div>
          <p style="color: #ef4444; font-weight: bold; margin: 0;">Visualization Error</p>
          <p style="font-size: 14px; color: #6b7280; margin: 8px 0 0 0;">${error.message}</p>
        </div>
      `);
  }

  // Helper methods
  private shouldUseChartJs(viz: Visualization): boolean {
    // Use Chart.js for certain visualization types
    const chartJsTypes = [
      VisualizationType.LINE_CHART,
      VisualizationType.BAR_CHART,
      VisualizationType.PIE_CHART,
      VisualizationType.RADAR_CHART
    ];
    return chartJsTypes.includes(viz.type);
  }

  private extractLabels(data: any[]): string[] {
    if (data.length === 0) return [];
    
    // Try common label fields
    const labelFields = ['label', 'name', 'category', 'x', 'timestamp'];
    
    for (const field of labelFields) {
      if (data[0][field] !== undefined) {
        return data.map(d => String(d[field]));
      }
    }
    
    // Fall back to indices
    return data.map((_, i) => String(i));
  }

  private prepareChartJsDatasets(data: any[], options: any): any[] {
    // Handle single series
    if (data.length > 0 && typeof data[0] === 'number') {
      return [{
        label: options.label || 'Series 1',
        data: data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }];
    }

    // Handle multiple series
    if (options.series) {
      return options.series.map((series: any, index: number) => ({
        label: series.label || `Series ${index + 1}`,
        data: data.map(d => d[series.field] || 0),
        borderColor: series.color || this.getColor(index),
        backgroundColor: series.backgroundColor || `${this.getColor(index)}20`
      }));
    }

    // Default single series from objects
    return [{
      label: options.label || 'Values',
      data: data.map(d => d.value || d.y || 0),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)'
    }];
  }

  private createColorScale(viz: Visualization): d3.ScaleSequential<string> {
    const extent = d3.extent(viz.data, d => d.value) as [number, number];
    const colorScheme = viz.config.options.colorScheme || 'viridis';
    
    const interpolators: Record<string, any> = {
      viridis: d3.interpolateViridis,
      plasma: d3.interpolatePlasma,
      cool: d3.interpolateCool,
      warm: d3.interpolateWarm,
      turbo: d3.interpolateTurbo
    };

    return d3.scaleSequential()
      .domain(extent)
      .interpolator(interpolators[colorScheme] || d3.interpolateViridis);
  }

  private addColorLegend(
    svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
    colorScale: d3.ScaleSequential<string>,
    width: number
  ): void {
    const legendWidth = 200;
    const legendHeight = 10;

    const legend = svg.append('g')
      .attr('transform', `translate(${width - legendWidth - 20}, -30)`);

    // Create gradient
    const gradient = legend.append('defs')
      .append('linearGradient')
      .attr('id', 'color-gradient');

    const nSteps = 10;
    const domain = colorScale.domain();
    
    for (let i = 0; i <= nSteps; i++) {
      const value = domain[0] + (domain[1] - domain[0]) * (i / nSteps);
      gradient.append('stop')
        .attr('offset', `${(i / nSteps) * 100}%`)
        .attr('stop-color', colorScale(value));
    }

    // Draw gradient rect
    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#color-gradient)');

    // Add labels
    legend.append('text')
      .attr('y', -5)
      .style('font-size', '12px')
      .text(domain[0].toFixed(0));

    legend.append('text')
      .attr('x', legendWidth)
      .attr('y', -5)
      .attr('text-anchor', 'end')
      .style('font-size', '12px')
      .text(domain[1].toFixed(0));
  }

  private addChartInteractions(
    chart: Chart,
    viz: Visualization,
    canvas: HTMLCanvasElement
  ): void {
    // Add click interaction
    canvas.onclick = (event) => {
      const points = chart.getElementsAtEventForMode(
        event,
        'nearest',
        { intersect: true },
        false
      );

      if (points.length > 0) {
        const firstPoint = points[0];
        const datasetIndex = firstPoint.datasetIndex;
        const index = firstPoint.index;
        const value = chart.data.datasets[datasetIndex].data[index];

        const interactionEvent: InteractionEvent = {
          type: 'click',
          data: { datasetIndex, index, value },
          position: { x: event.offsetX, y: event.offsetY },
          target: firstPoint
        };

        viz.interactions.forEach(interaction => {
          if (interaction.type === 'click') {
            interaction.handler(interactionEvent);
          }
        });
      }
    };
  }

  private formatValue(value: number, format?: string): string {
    switch (format) {
      case 'percent':
        return `${(value * 100).toFixed(1)}%`;
      case 'currency':
        return `$${value.toFixed(2)}`;
      case 'bytes':
        return this.formatBytes(value);
      default:
        return value.toFixed(2);
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

  private generateColors(count: number): string[] {
    const baseColors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  private getColor(index: number): string {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];
    return colors[index % colors.length];
  }

  private generateId(): string {
    return `viz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  addInteraction(
    vizId: string,
    interaction: VisualizationInteraction
  ): void {
    const viz = this.visualizations.get(vizId);
    if (viz) {
      viz.interactions.push(interaction);
    }
  }

  updateData(vizId: string, newData: any[]): void {
    const viz = this.visualizations.get(vizId);
    if (viz) {
      viz.data = newData;
      
      // Update Chart.js instance if exists
      const chart = this.chartInstances.get(vizId);
      if (chart) {
        chart.data.datasets[0].data = newData;
        chart.update();
      }
    }
  }

  destroy(vizId: string): void {
    const chart = this.chartInstances.get(vizId);
    if (chart) {
      chart.destroy();
      this.chartInstances.delete(vizId);
    }
    
    this.visualizations.delete(vizId);
  }

  destroyAll(): void {
    this.chartInstances.forEach(chart => chart.destroy());
    this.chartInstances.clear();
    this.visualizations.clear();
  }
}