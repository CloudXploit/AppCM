import { 
  DiagnosticRule, 
  RuleCondition, 
  DiagnosticFinding,
  DiagnosticSeverity,
  DiagnosticCategory,
  RemediationAction
} from '../types';
import { getMonitoring } from '@cm-diagnostics/logger';
import { z } from 'zod';

const monitoring = getMonitoring();

export class RuleEngine {
  private logger: any;
  private metrics: any;

  constructor() {
    this.logger = monitoring.getLogger({ component: 'rule-engine' });
    this.metrics = monitoring.getMetrics();
  }

  // Evaluate a rule against data
  async evaluate(
    rule: DiagnosticRule,
    data: any,
    context: {
      systemId: string;
      component: string;
      resourcePath?: string;
    }
  ): Promise<DiagnosticFinding | null> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Evaluating rule', { 
        ruleId: rule.id,
        component: context.component 
      });

      // Check if all conditions are met
      const conditionsResult = await this.evaluateConditions(rule.conditions, data);
      
      if (!conditionsResult.matched) {
        // No finding if conditions not met
        return null;
      }

      // Create finding
      const finding: DiagnosticFinding = {
        id: this.generateFindingId(),
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        severity: this.calculateSeverity(rule, conditionsResult),
        
        title: this.interpolateString(rule.name, conditionsResult.values),
        description: this.interpolateString(rule.description, conditionsResult.values),
        impact: this.generateImpact(rule, conditionsResult),
        recommendation: this.generateRecommendation(rule, conditionsResult),
        
        systemId: context.systemId,
        component: context.component,
        resourcePath: context.resourcePath,
        
        evidence: {
          actual: conditionsResult.actualValues,
          expected: conditionsResult.expectedValues,
          difference: conditionsResult.differences,
          metadata: conditionsResult.metadata
        },
        
        detectedAt: new Date(),
        lastSeenAt: new Date(),
        occurrenceCount: 1,
        
        remediable: rule.autoRemediate && (rule.remediationActions?.length || 0) > 0,
        remediationActions: rule.remediationActions,
        
        acknowledged: false,
        resolved: false,
        falsePositive: false
      };

      const duration = Date.now() - startTime;
      this.metrics.record('rule_evaluation_duration', duration, {
        ruleId: rule.id,
        matched: true
      });

      return finding;
      
    } catch (error) {
      this.logger.error('Rule evaluation failed', error as Error, { 
        ruleId: rule.id 
      });
      
      this.metrics.increment('rule_evaluation_errors', {
        ruleId: rule.id
      });
      
      return null;
    }
  }

  // Evaluate all conditions
  private async evaluateConditions(
    conditions: RuleCondition[],
    data: any
  ): Promise<{
    matched: boolean;
    values: Record<string, any>;
    actualValues: Record<string, any>;
    expectedValues: Record<string, any>;
    differences: Record<string, any>;
    metadata: Record<string, any>;
  }> {
    const result = {
      matched: true,
      values: {} as Record<string, any>,
      actualValues: {} as Record<string, any>,
      expectedValues: {} as Record<string, any>,
      differences: {} as Record<string, any>,
      metadata: {} as Record<string, any>
    };

    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(data, condition.field);
      const conditionMet = this.evaluateCondition(condition, fieldValue);
      
      result.values[condition.field] = fieldValue;
      result.actualValues[condition.field] = fieldValue;
      result.expectedValues[condition.field] = condition.value;
      
      if (!conditionMet) {
        result.matched = false;
        result.differences[condition.field] = {
          actual: fieldValue,
          expected: condition.value,
          operator: condition.operator
        };
      }
    }

    return result;
  }

  // Evaluate a single condition
  private evaluateCondition(condition: RuleCondition, value: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      
      case 'not_equals':
        return value !== condition.value;
      
      case 'greater_than':
        return Number(value) > Number(condition.value);
      
      case 'less_than':
        return Number(value) < Number(condition.value);
      
      case 'contains':
        return String(value).includes(String(condition.value));
      
      case 'regex':
        try {
          const regex = new RegExp(condition.value);
          return regex.test(String(value));
        } catch {
          return false;
        }
      
      case 'exists':
        return value !== undefined && value !== null;
      
      case 'not_exists':
        return value === undefined || value === null;
      
      default:
        return false;
    }
  }

  // Get field value from data using dot notation
  private getFieldValue(data: any, field: string): any {
    const parts = field.split('.');
    let value = data;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Calculate severity based on conditions
  private calculateSeverity(
    rule: DiagnosticRule,
    conditionsResult: any
  ): DiagnosticSeverity {
    // Override severity based on threshold breaches
    for (const condition of rule.conditions) {
      if (condition.threshold && condition.operator === 'greater_than') {
        const value = conditionsResult.values[condition.field];
        const threshold = condition.threshold;
        
        if (Number(value) > threshold * 2) {
          return 'critical';
        } else if (Number(value) > threshold * 1.5) {
          return 'high';
        }
      }
    }
    
    return rule.severity;
  }

  // Generate impact description
  private generateImpact(rule: DiagnosticRule, conditionsResult: any): string {
    const baseImpact = `This issue can impact ${rule.category} of your Content Manager system.`;
    
    // Add specific impacts based on category
    switch (rule.category) {
      case 'performance':
        return `${baseImpact} System response times may be degraded, affecting user experience.`;
      
      case 'security':
        return `${baseImpact} Your system may be vulnerable to unauthorized access or data breaches.`;
      
      case 'data-integrity':
        return `${baseImpact} Data consistency and reliability may be compromised.`;
      
      case 'availability':
        return `${baseImpact} System availability and uptime may be affected.`;
      
      default:
        return baseImpact;
    }
  }

  // Generate recommendation
  private generateRecommendation(rule: DiagnosticRule, conditionsResult: any): string {
    if (rule.remediationActions && rule.remediationActions.length > 0) {
      const action = rule.remediationActions[0];
      return `${action.description} This can be automatically remediated.`;
    }
    
    // Default recommendations by category
    switch (rule.category) {
      case 'performance':
        return 'Review and optimize the affected components to improve performance.';
      
      case 'security':
        return 'Apply security best practices and update configurations to address this vulnerability.';
      
      case 'configuration':
        return 'Update the configuration settings to align with recommended values.';
      
      default:
        return 'Review and address this issue according to your organization\'s policies.';
    }
  }

  // Interpolate string with values
  private interpolateString(template: string, values: Record<string, any>): string {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      return values[key] !== undefined ? String(values[key]) : match;
    });
  }

  // Generate unique finding ID
  private generateFindingId(): string {
    return `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Validate rule definition
  validateRule(rule: DiagnosticRule): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Validate basic fields
    if (!rule.id) errors.push('Rule ID is required');
    if (!rule.name) errors.push('Rule name is required');
    if (!rule.category) errors.push('Rule category is required');
    if (!rule.severity) errors.push('Rule severity is required');
    if (!rule.conditions || rule.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    // Validate conditions
    rule.conditions?.forEach((condition, index) => {
      if (!condition.field) errors.push(`Condition ${index}: field is required`);
      if (!condition.operator) errors.push(`Condition ${index}: operator is required`);
      if (condition.value === undefined) errors.push(`Condition ${index}: value is required`);
    });

    // Validate remediation actions
    rule.remediationActions?.forEach((action, index) => {
      if (!action.id) errors.push(`Remediation action ${index}: id is required`);
      if (!action.name) errors.push(`Remediation action ${index}: name is required`);
      if (!action.action) errors.push(`Remediation action ${index}: action is required`);
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Create rule from template
  createRuleFromTemplate(
    template: Partial<DiagnosticRule>,
    overrides?: Partial<DiagnosticRule>
  ): DiagnosticRule {
    const rule: DiagnosticRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Unnamed Rule',
      description: 'No description provided',
      category: 'configuration',
      severity: 'medium',
      enabled: true,
      version: '1.0.0',
      supportedVersions: ['*'],
      tags: [],
      conditions: [],
      autoRemediate: false,
      ...template,
      ...overrides
    };

    return rule;
  }
}