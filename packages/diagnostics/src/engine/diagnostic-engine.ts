import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import { 
  DiagnosticRule, 
  DiagnosticScan, 
  DiagnosticScanner, 
  DiagnosticFinding,
  DiagnosticStatus,
  ScanContext,
  ScanResult,
  DiagnosticCategory,
  DiagnosticSeverity
} from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';
import { CMConnector } from '@cm-diagnostics/cm-connector';

const monitoring = getMonitoring();

export interface DiagnosticEngineConfig {
  maxConcurrentScans?: number;
  scanTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableAutoRemediation?: boolean;
}

export class DiagnosticEngine extends EventEmitter {
  private logger: any;
  private metrics: any;
  private scanQueue: PQueue;
  private scanners: Map<string, DiagnosticScanner> = new Map();
  private rules: Map<string, DiagnosticRule> = new Map();
  private activeScans: Map<string, DiagnosticScan> = new Map();
  private config: DiagnosticEngineConfig;

  constructor(config: DiagnosticEngineConfig = {}) {
    super();
    this.config = {
      maxConcurrentScans: 3,
      scanTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 1000,
      enableAutoRemediation: false,
      ...config
    };

    this.logger = monitoring.getLogger({ component: 'diagnostic-engine' });
    this.metrics = monitoring.getMetrics();
    
    this.scanQueue = new PQueue({ 
      concurrency: this.config.maxConcurrentScans 
    });

    this.logger.info('Diagnostic engine initialized', { config: this.config });
  }

  // Register a scanner
  registerScanner(scanner: DiagnosticScanner): void {
    this.logger.info('Registering scanner', { 
      id: scanner.id, 
      name: scanner.name,
      category: scanner.category 
    });
    
    this.scanners.set(scanner.id, scanner);
    this.emit('scanner:registered', scanner);
    
    this.metrics.increment('diagnostic_scanners_registered', {
      scanner: scanner.id,
      category: scanner.category
    });
  }

  // Register a rule
  registerRule(rule: DiagnosticRule): void {
    this.logger.info('Registering rule', { 
      id: rule.id, 
      name: rule.name,
      category: rule.category,
      severity: rule.severity 
    });
    
    this.rules.set(rule.id, rule);
    this.emit('rule:registered', rule);
    
    this.metrics.increment('diagnostic_rules_registered', {
      rule: rule.id,
      category: rule.category,
      severity: rule.severity
    });
  }

  // Create a new scan
  async createScan(
    systemId: string,
    options: {
      name?: string;
      rules?: string[];
      categories?: DiagnosticCategory[];
      connector: CMConnector;
    }
  ): Promise<DiagnosticScan> {
    const scanId = this.generateScanId();
    const rulesToRun = this.selectRules(options.rules, options.categories);
    
    const scan: DiagnosticScan = {
      id: scanId,
      name: options.name || `Scan ${new Date().toISOString()}`,
      systemId,
      rules: rulesToRun.map(r => r.id),
      categories: options.categories,
      status: 'pending',
      progress: 0,
      findingsCount: {
        total: 0,
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        byCategory: {
          performance: 0,
          security: 0,
          configuration: 0,
          'data-integrity': 0,
          compliance: 0,
          availability: 0,
          compatibility: 0
        }
      },
      findings: [],
      triggeredBy: 'manual',
      triggerType: 'manual'
    };
    
    this.activeScans.set(scanId, scan);
    this.emit('scan:created', scan);
    
    this.logger.info('Scan created', { 
      scanId, 
      systemId, 
      rulesCount: rulesToRun.length 
    });
    
    // Queue the scan for execution
    this.scanQueue.add(() => this.executeScan(scan, rulesToRun, options.connector));
    
    return scan;
  }

  // Execute a scan
  private async executeScan(
    scan: DiagnosticScan,
    rules: DiagnosticRule[],
    connector: CMConnector
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting scan execution', { scanId: scan.id });
      
      scan.status = 'running';
      scan.startedAt = new Date();
      this.emit('scan:started', scan);
      
      // Group rules by scanner category
      const rulesByCategory = this.groupRulesByCategory(rules);
      const totalRules = rules.length;
      let processedRules = 0;
      
      // Execute scanners in parallel for each category
      const scanPromises: Promise<void>[] = [];
      
      for (const [category, categoryRules] of rulesByCategory) {
        const scanner = this.findScannerForCategory(category);
        
        if (!scanner) {
          this.logger.warn('No scanner found for category', { category });
          continue;
        }
        
        const scanPromise = this.runScanner(scanner, {
          systemId: scan.systemId,
          connector,
          rules: categoryRules,
          options: {}
        }).then(result => {
          // Process findings
          scan.findings.push(...result.findings);
          
          // Update progress
          processedRules += categoryRules.length;
          scan.progress = Math.round((processedRules / totalRules) * 100);
          this.emit('scan:progress', { scanId: scan.id, progress: scan.progress });
          
          // Update counts
          this.updateFindingCounts(scan, result.findings);
        });
        
        scanPromises.push(scanPromise);
      }
      
      // Wait for all scanners to complete
      await Promise.all(scanPromises);
      
      // Mark scan as completed
      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.duration = (Date.now() - startTime) / 1000;
      
      this.logger.info('Scan completed', { 
        scanId: scan.id,
        duration: scan.duration,
        findingsCount: scan.findingsCount.total
      });
      
      this.emit('scan:completed', scan);
      
      // Record metrics
      this.metrics.record('diagnostic_scan_duration', scan.duration, {
        systemId: scan.systemId,
        findingsCount: scan.findingsCount.total
      });
      
      this.metrics.increment('diagnostic_scans_completed', {
        systemId: scan.systemId,
        status: 'success'
      });
      
      // Check for auto-remediation
      if (this.config.enableAutoRemediation) {
        await this.checkAutoRemediation(scan);
      }
      
    } catch (error) {
      scan.status = 'failed';
      scan.completedAt = new Date();
      scan.duration = (Date.now() - startTime) / 1000;
      
      this.logger.error('Scan failed', error as Error, { scanId: scan.id });
      this.emit('scan:failed', { scan, error });
      
      this.metrics.increment('diagnostic_scans_completed', {
        systemId: scan.systemId,
        status: 'failed'
      });
      
      throw error;
    } finally {
      this.activeScans.delete(scan.id);
    }
  }

  // Run a specific scanner
  private async runScanner(
    scanner: DiagnosticScanner,
    context: ScanContext
  ): Promise<ScanResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Running scanner', { 
        scannerId: scanner.id,
        rulesCount: context.rules.length 
      });
      
      await scanner.initialize();
      const result = await scanner.scan(context);
      await scanner.cleanup();
      
      const duration = (Date.now() - startTime) / 1000;
      
      this.metrics.record('diagnostic_scanner_duration', duration, {
        scanner: scanner.id,
        findingsCount: result.findings.length
      });
      
      return result;
    } catch (error) {
      this.logger.error('Scanner failed', error as Error, { 
        scannerId: scanner.id 
      });
      
      this.metrics.increment('diagnostic_scanner_errors', {
        scanner: scanner.id
      });
      
      // Return empty result on error
      return {
        scannerId: scanner.id,
        duration: (Date.now() - startTime) / 1000,
        findings: [],
        errors: [{
          ruleId: 'scanner-error',
          error: (error as Error).message,
          stack: (error as Error).stack,
          retryable: true
        }]
      };
    }
  }

  // Select rules to run
  private selectRules(
    ruleIds?: string[],
    categories?: DiagnosticCategory[]
  ): DiagnosticRule[] {
    let selectedRules: DiagnosticRule[] = [];
    
    if (ruleIds && ruleIds.length > 0) {
      // Select specific rules
      selectedRules = ruleIds
        .map(id => this.rules.get(id))
        .filter(rule => rule && rule.enabled) as DiagnosticRule[];
    } else if (categories && categories.length > 0) {
      // Select rules by category
      selectedRules = Array.from(this.rules.values())
        .filter(rule => rule.enabled && categories.includes(rule.category));
    } else {
      // Select all enabled rules
      selectedRules = Array.from(this.rules.values())
        .filter(rule => rule.enabled);
    }
    
    return selectedRules;
  }

  // Group rules by category
  private groupRulesByCategory(
    rules: DiagnosticRule[]
  ): Map<DiagnosticCategory, DiagnosticRule[]> {
    const grouped = new Map<DiagnosticCategory, DiagnosticRule[]>();
    
    for (const rule of rules) {
      const categoryRules = grouped.get(rule.category) || [];
      categoryRules.push(rule);
      grouped.set(rule.category, categoryRules);
    }
    
    return grouped;
  }

  // Find scanner for category
  private findScannerForCategory(category: DiagnosticCategory): DiagnosticScanner | null {
    for (const scanner of this.scanners.values()) {
      if (scanner.category === category) {
        return scanner;
      }
    }
    return null;
  }

  // Update finding counts
  private updateFindingCounts(
    scan: DiagnosticScan,
    findings: DiagnosticFinding[]
  ): void {
    for (const finding of findings) {
      scan.findingsCount.total++;
      scan.findingsCount.bySeverity[finding.severity]++;
      scan.findingsCount.byCategory[finding.category]++;
    }
  }

  // Check for auto-remediation
  private async checkAutoRemediation(scan: DiagnosticScan): Promise<void> {
    const autoRemediableFindings = scan.findings.filter(
      finding => finding.remediable && finding.remediationActions && finding.remediationActions.length > 0
    );
    
    if (autoRemediableFindings.length > 0) {
      this.logger.info('Auto-remediable findings found', { 
        count: autoRemediableFindings.length,
        scanId: scan.id
      });
      
      this.emit('remediation:available', {
        scanId: scan.id,
        findings: autoRemediableFindings
      });
    }
  }

  // Generate unique scan ID
  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get scan by ID
  getScan(scanId: string): DiagnosticScan | undefined {
    return this.activeScans.get(scanId);
  }

  // Get all active scans
  getActiveScans(): DiagnosticScan[] {
    return Array.from(this.activeScans.values());
  }

  // Cancel a scan
  async cancelScan(scanId: string): Promise<void> {
    const scan = this.activeScans.get(scanId);
    if (scan && scan.status === 'running') {
      scan.status = 'cancelled';
      this.emit('scan:cancelled', scan);
      this.activeScans.delete(scanId);
    }
  }

  // Get registered rules
  getRules(): DiagnosticRule[] {
    return Array.from(this.rules.values());
  }

  // Get registered scanners
  getScanners(): DiagnosticScanner[] {
    return Array.from(this.scanners.values());
  }

  // Enable/disable a rule
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.emit('rule:updated', rule);
    }
  }

  // Update rule configuration
  updateRuleConfig(ruleId: string, config: Record<string, any>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.config = { ...rule.config, ...config };
      this.emit('rule:updated', rule);
    }
  }
}