// Types
export * from './types';

// Connectors
export { BaseIDOLConnector } from './connectors/base-connector';
export { IDOLServerConnector } from './connectors/idol-connector';
export { CommunityConnector } from './connectors/community-connector';
export { CloudConnector } from './connectors/cloud-connector';
export { IDOLConnectionManager } from './connectors/connection-manager';

// Query builders and services
export { IDOLQueryBuilder, FieldTextBuilder, BooleanQueryBuilder } from './queries/query-builder';
export { IDOLSearchService } from './queries/search-service';
export { IDOLIndexService } from './queries/index-service';
export { CMToIDOLSyncService } from './queries/sync-service';

// Analytics
export { IDOLAnalyticsService } from './analytics/analytics-service';

// Diagnostics
export { idolDiagnosticRules, idolRuleCategories } from './diagnostics/idol-rules';
export { 
  IDOLPerformanceScanner, 
  IDOLContentScanner, 
  IDOLIntegrationScanner,
  idolScanners 
} from './diagnostics/idol-scanner';

// Monitoring
export { IDOLPerformanceMonitor } from './monitoring/performance-monitor';

// Factory function for easy setup
export function createIDOLConnector(config: {
  host: string;
  port: number;
  protocol?: 'http' | 'https';
  username?: string;
  password?: string;
  community?: string;
  type?: 'server' | 'community' | 'cloud';
}) {
  const connection = {
    host: config.host,
    port: config.port,
    protocol: config.protocol || 'http',
    username: config.username,
    password: config.password,
    community: config.community
  };

  switch (config.type) {
    case 'community':
      return new CommunityConnector(connection);
    case 'cloud':
      return new CloudConnector(connection);
    default:
      return new IDOLServerConnector(connection);
  }
}

// Integration helper for CM Diagnostics
export class IDOLIntegration {
  private connectionManager: IDOLConnectionManager;
  private searchServices: Map<string, IDOLSearchService> = new Map();
  private indexServices: Map<string, IDOLIndexService> = new Map();
  private analyticsServices: Map<string, IDOLAnalyticsService> = new Map();
  private monitors: Map<string, IDOLPerformanceMonitor> = new Map();

  constructor() {
    this.connectionManager = new IDOLConnectionManager();
  }

  async addIDOLSystem(
    id: string,
    config: {
      host: string;
      port: number;
      protocol?: 'http' | 'https';
      username?: string;
      password?: string;
      community?: string;
      type?: 'server' | 'community' | 'cloud';
    },
    options?: {
      enableMonitoring?: boolean;
      monitoringInterval?: number;
    }
  ) {
    // Create connection
    const connector = await this.connectionManager.createConnection(id, {
      host: config.host,
      port: config.port,
      protocol: config.protocol || 'http',
      username: config.username,
      password: config.password,
      community: config.community
    });

    // Create services
    const searchService = new IDOLSearchService(connector);
    const indexService = new IDOLIndexService(connector);
    const analyticsService = new IDOLAnalyticsService(connector);

    this.searchServices.set(id, searchService);
    this.indexServices.set(id, indexService);
    this.analyticsServices.set(id, analyticsService);

    // Setup monitoring if enabled
    if (options?.enableMonitoring) {
      const monitor = new IDOLPerformanceMonitor(connector, {
        interval: options.monitoringInterval
      });
      monitor.start();
      this.monitors.set(id, monitor);
    }

    return {
      connector,
      searchService,
      indexService,
      analyticsService
    };
  }

  async removeIDOLSystem(id: string) {
    // Stop monitoring
    const monitor = this.monitors.get(id);
    if (monitor) {
      monitor.stop();
      this.monitors.delete(id);
    }

    // Remove services
    this.searchServices.delete(id);
    this.indexServices.delete(id);
    this.analyticsServices.delete(id);

    // Close connection
    await this.connectionManager.closeConnection(id);
  }

  getSearchService(id: string): IDOLSearchService | undefined {
    return this.searchServices.get(id);
  }

  getIndexService(id: string): IDOLIndexService | undefined {
    return this.indexServices.get(id);
  }

  getAnalyticsService(id: string): IDOLAnalyticsService | undefined {
    return this.analyticsServices.get(id);
  }

  getMonitor(id: string): IDOLPerformanceMonitor | undefined {
    return this.monitors.get(id);
  }

  async getSystemHealth(id: string) {
    const monitor = this.monitors.get(id);
    const connector = await this.connectionManager.getConnection(id);
    
    if (!connector) {
      return null;
    }

    const status = await connector.getStatus();
    const metrics = connector.getMetrics();
    const healthScore = monitor?.getHealthScore() || 0;
    const alerts = monitor?.getAlerts(1) || [];

    return {
      status,
      metrics,
      healthScore,
      alerts
    };
  }

  async getAllSystemsHealth() {
    const systems: Record<string, any> = {};
    
    for (const id of this.connectionManager.getConnectionIds()) {
      systems[id] = await this.getSystemHealth(id);
    }
    
    return systems;
  }
}