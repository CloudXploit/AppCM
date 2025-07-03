# CM Diagnostics Package

This package provides the core diagnostic and auto-remediation functionality for Content Manager systems.

## Features

- **Diagnostic Engine**: Orchestrates scans across multiple scanners
- **Rule System**: Flexible rule-based issue detection
- **Scanner Modules**: Specialized scanners for different aspects (performance, security, configuration)
- **Remediation Engine**: Automated and semi-automated issue resolution
- **Built-in Rules**: Pre-configured rules for common issues
- **Plugin Architecture**: Extensible system for custom rules and scanners

## Installation

```bash
npm install @cm-diagnostics/diagnostics
```

## Usage

### Basic Usage

```typescript
import { DiagnosticSystem } from '@cm-diagnostics/diagnostics';
import { CMConnectionFactory } from '@cm-diagnostics/cm-connector';

// Initialize the diagnostic system
const diagnostics = new DiagnosticSystem({
  enableAutoRemediation: true,
  requireApproval: true
});

await diagnostics.initialize();

// Create a connection to CM
const connector = await CMConnectionFactory.createConnector(config);
await connector.connect();

// Run diagnostics
const scan = await diagnostics.runDiagnostics('system-001', {
  name: 'Full System Scan',
  categories: ['performance', 'security', 'configuration'],
  connector
});

// Handle findings
scan.on('completed', (scanResult) => {
  console.log(`Found ${scanResult.findingsCount.total} issues`);
  
  // Remediate critical findings
  const criticalFindings = scanResult.findings.filter(f => f.severity === 'critical');
  for (const finding of criticalFindings) {
    if (finding.remediable && finding.remediationActions) {
      const action = finding.remediationActions[0];
      await diagnostics.remediate(finding, action, {
        connector,
        approvedBy: 'admin@example.com'
      });
    }
  }
});
```

### Using Individual Components

```typescript
import { 
  DiagnosticEngine, 
  RemediationEngine,
  RuleBuilder,
  PerformanceScanner 
} from '@cm-diagnostics/diagnostics';

// Create custom rule
const customRule = RuleBuilder.performanceRule('custom-memory-check')
  .name('High Memory Usage')
  .description('Memory usage exceeds threshold')
  .severity('high')
  .whenThreshold('performance.memoryUsage', 'greater_than', 80, 80, '%')
  .build();

// Initialize engine
const engine = new DiagnosticEngine();
engine.registerRule(customRule);
engine.registerScanner(new PerformanceScanner());

// Run scan
const scan = await engine.createScan('system-001', {
  rules: ['custom-memory-check'],
  connector
});
```

## Built-in Rules

The package includes 15+ built-in rules across three categories:

### Performance Rules
- High CPU Usage
- Critical CPU Usage
- Slow Database Queries
- Connection Pool Exhaustion
- Low Cache Hit Rate

### Security Rules
- Weak Password Policy
- Default Account Active
- Inactive Users with Access
- Excessive Failed Login Attempts
- Security Audit Disabled
- Insufficient Audit Retention

### Configuration Rules
- Query Timeout Too Low
- Session Timeout Configuration
- Database Maintenance Disabled
- Backup Not Configured
- Index Maintenance Threshold

## Architecture

### Components

1. **Diagnostic Engine** (`engine/diagnostic-engine.ts`)
   - Manages the scanning process
   - Coordinates multiple scanners
   - Handles rule evaluation
   - Emits events for scan lifecycle

2. **Rule System** (`rules/`)
   - Rule engine for evaluating conditions
   - Rule builder for creating rules programmatically
   - Built-in rules for common scenarios

3. **Scanners** (`scanners/`)
   - Base scanner class for consistency
   - Specialized scanners:
     - Performance Scanner
     - Security Scanner
     - Configuration Scanner

4. **Remediation Engine** (`remediation/remediation-engine.ts`)
   - Executes remediation actions
   - Supports dry-run mode
   - Rollback capabilities
   - Approval workflow

## Events

The diagnostic system emits various events:

```typescript
// Diagnostic Engine Events
diagnosticEngine.on('scan:created', (scan) => {});
diagnosticEngine.on('scan:started', (scan) => {});
diagnosticEngine.on('scan:progress', ({ scanId, progress }) => {});
diagnosticEngine.on('scan:completed', (scan) => {});
diagnosticEngine.on('scan:failed', ({ scan, error }) => {});
diagnosticEngine.on('remediation:available', ({ scanId, findings }) => {});

// Remediation Engine Events
remediationEngine.on('remediation:started', ({ finding, action, attempt }) => {});
remediationEngine.on('remediation:executing', ({ finding, action, attempt }) => {});
remediationEngine.on('remediation:completed', ({ finding, action, attempt }) => {});
remediationEngine.on('remediation:failed', ({ finding, action, attempt, error }) => {});
remediationEngine.on('remediation:approval-required', ({ finding, action, attempt }) => {});
```

## Custom Rules

Create custom rules using the RuleBuilder:

```typescript
const myRule = RuleBuilder.performanceRule('my-custom-rule')
  .name('Custom Performance Check')
  .description('Checks for specific performance issue')
  .severity('medium')
  .when('metrics.customValue', 'greater_than', 100)
  .remediate(
    RemediationBuilder.updateConfig('fix-custom-issue')
      .name('Fix Custom Issue')
      .description('Applies custom fix')
      .action('custom_action')
      .riskLevel('low')
      .build()
  )
  .build();
```

## Custom Scanners

Extend the BaseScanner class:

```typescript
import { BaseScanner } from '@cm-diagnostics/diagnostics';

export class CustomScanner extends BaseScanner {
  constructor() {
    super({
      id: 'custom-scanner',
      name: 'Custom Scanner',
      category: 'custom',
      supportedRules: ['rule1', 'rule2']
    });
  }

  protected async onInitialize(): Promise<void> {
    // Initialize scanner resources
  }

  protected async extractData(context: ScanContext): Promise<any> {
    // Extract data for analysis
    return {};
  }

  protected async onCleanup(): Promise<void> {
    // Clean up resources
  }
}
```

## Configuration

### Diagnostic System Options

```typescript
{
  enableAutoRemediation: boolean;  // Enable automatic remediation
  maxConcurrentScans: number;      // Max parallel scans (default: 3)
  scanTimeout: number;             // Scan timeout in ms (default: 300000)
  requireApproval: boolean;        // Require approval for remediation
}
```

### Remediation Engine Options

```typescript
{
  maxConcurrentActions: number;    // Max parallel actions (default: 1)
  actionTimeout: number;           // Action timeout in ms (default: 300000)
  requireApproval: boolean;        // Require approval (default: true)
  dryRun: boolean;                // Dry run mode (default: false)
  enableRollback: boolean;         // Enable rollback (default: true)
}
```

## Best Practices

1. **Always test rules in dry-run mode first**
2. **Require approval for high-risk remediation actions**
3. **Monitor diagnostic events for audit trail**
4. **Use appropriate severity levels for findings**
5. **Implement proper error handling for custom scanners**
6. **Keep remediation actions idempotent**
7. **Document custom rules and actions**