import { 
  DiagnosticScanner, 
  DiagnosticCategory,
  ScanContext,
  ScanResult,
  DiagnosticFinding,
  ScanError
} from '../types';
import { RuleEngine } from '../rules/rule-engine';
import { getMonitoring } from '@cm-diagnostics/logger';

const monitoring = getMonitoring();

export abstract class BaseScanner implements DiagnosticScanner {
  id: string;
  name: string;
  category: DiagnosticCategory;
  version: string = '1.0.0';
  supportedRules: string[] = [];
  supportedVersions: string[] = ['*'];
  
  protected logger: any;
  protected metrics: any;
  protected ruleEngine: RuleEngine;
  protected initialized: boolean = false;

  constructor(config: {
    id: string;
    name: string;
    category: DiagnosticCategory;
    version?: string;
    supportedRules?: string[];
    supportedVersions?: string[];
  }) {
    this.id = config.id;
    this.name = config.name;
    this.category = config.category;
    this.version = config.version || this.version;
    this.supportedRules = config.supportedRules || this.supportedRules;
    this.supportedVersions = config.supportedVersions || this.supportedVersions;
    
    this.logger = monitoring.getLogger({ 
      component: 'scanner',
      scanner: this.id 
    });
    this.metrics = monitoring.getMetrics();
    this.ruleEngine = new RuleEngine();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing scanner', { 
      id: this.id,
      category: this.category 
    });
    
    try {
      await this.onInitialize();
      this.initialized = true;
      
      this.metrics.increment('scanner_initialized', {
        scanner: this.id,
        category: this.category
      });
    } catch (error) {
      this.logger.error('Scanner initialization failed', error as Error);
      throw error;
    }
  }

  async scan(context: ScanContext): Promise<ScanResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const findings: DiagnosticFinding[] = [];
    const errors: ScanError[] = [];

    this.logger.info('Starting scan', { 
      systemId: context.systemId,
      rulesCount: context.rules.length 
    });

    try {
      // Extract data for scanning
      const data = await this.extractData(context);
      
      // Evaluate each rule
      for (const rule of context.rules) {
        try {
          // Check if rule is supported
          if (this.supportedRules.length > 0 && !this.supportedRules.includes(rule.id)) {
            this.logger.debug('Rule not supported by scanner', { 
              ruleId: rule.id,
              scanner: this.id 
            });
            continue;
          }

          // Check version compatibility
          if (!this.isVersionSupported(context.systemId, rule.supportedVersions)) {
            this.logger.debug('Rule not applicable to system version', { 
              ruleId: rule.id,
              systemId: context.systemId 
            });
            continue;
          }

          // Evaluate rule
          const finding = await this.ruleEngine.evaluate(rule, data, {
            systemId: context.systemId,
            component: this.category,
            resourcePath: this.getResourcePath(data)
          });

          if (finding) {
            // Check against previous findings to detect duplicates
            if (context.previousFindings) {
              const previousFinding = this.findPreviousFinding(
                finding,
                context.previousFindings
              );
              
              if (previousFinding) {
                // Update occurrence count
                finding.occurrenceCount = previousFinding.occurrenceCount + 1;
                finding.detectedAt = previousFinding.detectedAt;
              }
            }

            findings.push(finding);
            
            this.metrics.increment('scanner_findings', {
              scanner: this.id,
              ruleId: rule.id,
              severity: finding.severity,
              category: finding.category
            });
          }
        } catch (error) {
          const scanError: ScanError = {
            ruleId: rule.id,
            error: (error as Error).message,
            stack: (error as Error).stack,
            retryable: this.isRetryableError(error as Error)
          };
          
          errors.push(scanError);
          
          this.logger.error('Rule evaluation failed', error as Error, { 
            ruleId: rule.id 
          });
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      
      this.logger.info('Scan completed', { 
        duration,
        findingsCount: findings.length,
        errorsCount: errors.length 
      });

      this.metrics.record('scanner_duration', duration, {
        scanner: this.id,
        findingsCount: findings.length
      });

      return {
        scannerId: this.id,
        duration,
        findings,
        errors: errors.length > 0 ? errors : undefined,
        metadata: await this.getMetadata(context)
      };

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      this.logger.error('Scan failed', error as Error);
      
      this.metrics.increment('scanner_errors', {
        scanner: this.id
      });

      return {
        scannerId: this.id,
        duration,
        findings: [],
        errors: [{
          ruleId: 'scanner-error',
          error: (error as Error).message,
          stack: (error as Error).stack,
          retryable: this.isRetryableError(error as Error)
        }]
      };
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up scanner', { id: this.id });
    
    try {
      await this.onCleanup();
      this.initialized = false;
    } catch (error) {
      this.logger.error('Scanner cleanup failed', error as Error);
    }
  }

  // Abstract methods to be implemented by specific scanners
  protected abstract onInitialize(): Promise<void>;
  protected abstract extractData(context: ScanContext): Promise<any>;
  protected abstract onCleanup(): Promise<void>;
  
  // Optional methods that can be overridden
  protected getResourcePath(data: any): string | undefined {
    return undefined;
  }

  protected async getMetadata(context: ScanContext): Promise<Record<string, any> | undefined> {
    return undefined;
  }

  protected isVersionSupported(systemId: string, supportedVersions: string[]): boolean {
    // Simple check - can be overridden for more complex logic
    return supportedVersions.includes('*') || 
           supportedVersions.some(v => systemId.includes(v));
  }

  protected findPreviousFinding(
    finding: DiagnosticFinding,
    previousFindings: DiagnosticFinding[]
  ): DiagnosticFinding | undefined {
    return previousFindings.find(pf => 
      pf.ruleId === finding.ruleId &&
      pf.component === finding.component &&
      pf.resourcePath === finding.resourcePath &&
      !pf.resolved
    );
  }

  protected isRetryableError(error: Error): boolean {
    // Common retryable error patterns
    const retryablePatterns = [
      /timeout/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /socket hang up/i
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message)
    );
  }

  // Helper method to batch process items
  protected async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    
    return results;
  }
}