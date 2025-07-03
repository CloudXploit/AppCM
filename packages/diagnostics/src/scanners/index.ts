export * from './base-scanner';
export * from './performance-scanner';
export * from './security-scanner';
export * from './configuration-scanner';
export * from './data-integrity-scanner';
export * from './conflict-detector-scanner';

// Scanner registry
import { PerformanceScanner } from './performance-scanner';
import { SecurityScanner } from './security-scanner';
import { ConfigurationScanner } from './configuration-scanner';
import { DataIntegrityScanner } from './data-integrity-scanner';
import { ConflictDetectorScanner } from './conflict-detector-scanner';
import { DiagnosticScanner } from '../types';

export const scannerRegistry: Map<string, new () => DiagnosticScanner> = new Map([
  ['performance', PerformanceScanner],
  ['security', SecurityScanner],
  ['configuration', ConfigurationScanner],
  ['data_integrity', DataIntegrityScanner],
  ['conflict_detection', ConflictDetectorScanner]
]);

export function createScanner(category: string): DiagnosticScanner | null {
  const ScannerClass = scannerRegistry.get(category);
  return ScannerClass ? new ScannerClass() : null;
}

export function getAllScanners(): DiagnosticScanner[] {
  const scanners: DiagnosticScanner[] = [];
  
  for (const [_, ScannerClass] of scannerRegistry) {
    scanners.push(new ScannerClass());
  }
  
  return scanners;
}