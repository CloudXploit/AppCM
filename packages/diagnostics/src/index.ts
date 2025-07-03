// Export all types
export * from './types';

// Export engines
export * from './engine/diagnostic-engine';
export * from './remediation/remediation-engine';

// Export rules
export * from './rules/rule-engine';
export * from './rules/rule-builder';

// Export scanners
export * from './scanners';

// Export remediation components
export * from './remediation';

// Main diagnostic system class
import { DiagnosticEngine } from './engine/diagnostic-engine';
import { RemediationEngine } from './remediation/remediation-engine';
import { getAllScanners } from './scanners';
import { getMonitoring } from '@cm-diagnostics/logger';

const monitoring = getMonitoring();

export interface DiagnosticSystemConfig {
  enableAutoRemediation?: boolean;
  maxConcurrentScans?: number;
  scanTimeout?: number;
  requireApproval?: boolean;
}

export class DiagnosticSystem {
  private logger: any;
  private diagnosticEngine: DiagnosticEngine;
  private remediationEngine: RemediationEngine;
  private initialized: boolean = false;

  constructor(config: DiagnosticSystemConfig = {}) {
    this.logger = monitoring.getLogger({ component: 'diagnostic-system' });
    
    // Initialize engines
    this.diagnosticEngine = new DiagnosticEngine({
      maxConcurrentScans: config.maxConcurrentScans,
      scanTimeout: config.scanTimeout,
      enableAutoRemediation: config.enableAutoRemediation
    });

    this.remediationEngine = new RemediationEngine({
      requireApproval: config.requireApproval ?? true,
      enableRollback: true
    });

    // Wire up events
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing diagnostic system');

    // Register all built-in scanners
    const scanners = getAllScanners();
    for (const scanner of scanners) {
      this.diagnosticEngine.registerScanner(scanner);
    }

    // Load built-in rules (to be implemented)
    await this.loadBuiltInRules();

    this.initialized = true;
    this.logger.info('Diagnostic system initialized', {
      scannersCount: scanners.length,
      rulesCount: this.diagnosticEngine.getRules().length
    });
  }

  async runDiagnostics(systemId: string, options: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.diagnosticEngine.createScan(systemId, options);
  }

  async remediate(finding: any, action: any, options?: any): Promise<any> {
    return this.remediationEngine.execute(finding, action, options);
  }

  getDiagnosticEngine(): DiagnosticEngine {
    return this.diagnosticEngine;
  }

  getRemediationEngine(): RemediationEngine {
    return this.remediationEngine;
  }

  private setupEventHandlers(): void {
    // Handle diagnostic events
    this.diagnosticEngine.on('scan:completed', async (scan) => {
      this.logger.info('Scan completed', {
        scanId: scan.id,
        findingsCount: scan.findingsCount.total
      });
    });

    this.diagnosticEngine.on('remediation:available', async (event) => {
      this.logger.info('Auto-remediation available', {
        scanId: event.scanId,
        findingsCount: event.findings.length
      });
    });

    // Handle remediation events
    this.remediationEngine.on('remediation:completed', (event) => {
      this.logger.info('Remediation completed', {
        findingId: event.finding.id,
        actionId: event.action.id
      });
    });

    this.remediationEngine.on('remediation:failed', (event) => {
      this.logger.error('Remediation failed', event.error, {
        findingId: event.finding.id,
        actionId: event.action.id
      });
    });
  }

  private async loadBuiltInRules(): Promise<void> {
    this.logger.info('Loading built-in diagnostic rules');
    
    try {
      const { builtInRules } = await import('./rules/built-in');
      
      for (const rule of builtInRules) {
        this.diagnosticEngine.registerRule(rule);
      }
      
      this.logger.info('Built-in rules loaded', { 
        count: builtInRules.length 
      });
    } catch (error) {
      this.logger.error('Failed to load built-in rules', error as Error);
    }
  }
}