import { 
  DiagnosticRule, 
  RuleCondition, 
  DiagnosticCategory, 
  DiagnosticSeverity,
  RemediationAction 
} from '../types';

export class RuleBuilder {
  private rule: Partial<DiagnosticRule>;

  constructor(id: string) {
    this.rule = {
      id,
      conditions: [],
      tags: [],
      supportedVersions: ['*'],
      enabled: true,
      autoRemediate: false,
      version: '1.0.0'
    };
  }

  name(name: string): RuleBuilder {
    this.rule.name = name;
    return this;
  }

  description(description: string): RuleBuilder {
    this.rule.description = description;
    return this;
  }

  category(category: DiagnosticCategory): RuleBuilder {
    this.rule.category = category;
    return this;
  }

  severity(severity: DiagnosticSeverity): RuleBuilder {
    this.rule.severity = severity;
    return this;
  }

  supportedVersions(...versions: string[]): RuleBuilder {
    this.rule.supportedVersions = versions;
    return this;
  }

  tags(...tags: string[]): RuleBuilder {
    this.rule.tags = tags;
    return this;
  }

  // Add a condition
  when(field: string, operator: RuleCondition['operator'], value: any): RuleBuilder {
    const condition: RuleCondition = { field, operator, value };
    this.rule.conditions!.push(condition);
    return this;
  }

  // Add a threshold condition
  whenThreshold(
    field: string, 
    operator: 'greater_than' | 'less_than', 
    value: number, 
    threshold: number,
    unit?: string
  ): RuleBuilder {
    const condition: RuleCondition = { 
      field, 
      operator, 
      value,
      threshold,
      unit 
    };
    this.rule.conditions!.push(condition);
    return this;
  }

  // Add multiple conditions
  conditions(...conditions: RuleCondition[]): RuleBuilder {
    this.rule.conditions!.push(...conditions);
    return this;
  }

  // Enable auto-remediation
  autoRemediate(enabled: boolean = true): RuleBuilder {
    this.rule.autoRemediate = enabled;
    return this;
  }

  // Add remediation action
  remediate(action: RemediationAction): RuleBuilder {
    if (!this.rule.remediationActions) {
      this.rule.remediationActions = [];
    }
    this.rule.remediationActions.push(action);
    this.rule.autoRemediate = true;
    return this;
  }

  // Set schedule
  schedule(
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly',
    cronExpression?: string
  ): RuleBuilder {
    this.rule.schedule = { frequency, cronExpression };
    return this;
  }

  // Set configuration
  config(config: Record<string, any>): RuleBuilder {
    this.rule.config = config;
    return this;
  }

  // Build the rule
  build(): DiagnosticRule {
    if (!this.rule.name) {
      throw new Error('Rule name is required');
    }
    if (!this.rule.category) {
      throw new Error('Rule category is required');
    }
    if (!this.rule.severity) {
      throw new Error('Rule severity is required');
    }
    if (!this.rule.conditions || this.rule.conditions.length === 0) {
      throw new Error('At least one condition is required');
    }

    return this.rule as DiagnosticRule;
  }

  // Static factory methods for common rules
  static performanceRule(id: string): RuleBuilder {
    return new RuleBuilder(id).category('performance');
  }

  static securityRule(id: string): RuleBuilder {
    return new RuleBuilder(id).category('security');
  }

  static configurationRule(id: string): RuleBuilder {
    return new RuleBuilder(id).category('configuration');
  }

  static dataIntegrityRule(id: string): RuleBuilder {
    return new RuleBuilder(id).category('data-integrity');
  }

  static complianceRule(id: string): RuleBuilder {
    return new RuleBuilder(id).category('compliance');
  }
}

// Remediation action builder
export class RemediationBuilder {
  private action: Partial<RemediationAction>;

  constructor(id: string) {
    this.action = {
      id,
      type: 'automatic',
      riskLevel: 'low',
      requiresApproval: false,
      requiresDowntime: false,
      estimatedDuration: 0,
      canRollback: true
    };
  }

  name(name: string): RemediationBuilder {
    this.action.name = name;
    return this;
  }

  description(description: string): RemediationBuilder {
    this.action.description = description;
    return this;
  }

  type(type: RemediationAction['type']): RemediationBuilder {
    this.action.type = type;
    return this;
  }

  action(action: string, parameters?: Record<string, any>): RemediationBuilder {
    this.action.action = action;
    if (parameters) {
      this.action.parameters = parameters;
    }
    return this;
  }

  riskLevel(level: RemediationAction['riskLevel']): RemediationBuilder {
    this.action.riskLevel = level;
    return this;
  }

  requiresApproval(required: boolean = true): RemediationBuilder {
    this.action.requiresApproval = required;
    return this;
  }

  requiresDowntime(required: boolean = true): RemediationBuilder {
    this.action.requiresDowntime = required;
    return this;
  }

  estimatedDuration(seconds: number): RemediationBuilder {
    this.action.estimatedDuration = seconds;
    return this;
  }

  rollback(action: string, parameters?: Record<string, any>): RemediationBuilder {
    this.action.canRollback = true;
    this.action.rollbackAction = action;
    if (parameters) {
      this.action.rollbackParameters = parameters;
    }
    return this;
  }

  preCondition(condition: RuleCondition): RemediationBuilder {
    if (!this.action.preConditions) {
      this.action.preConditions = [];
    }
    this.action.preConditions.push(condition);
    return this;
  }

  postCondition(condition: RuleCondition): RemediationBuilder {
    if (!this.action.postConditions) {
      this.action.postConditions = [];
    }
    this.action.postConditions.push(condition);
    return this;
  }

  build(): RemediationAction {
    if (!this.action.name) {
      throw new Error('Action name is required');
    }
    if (!this.action.action) {
      throw new Error('Action command is required');
    }

    return this.action as RemediationAction;
  }

  // Static factory methods
  static updateConfig(id: string): RemediationBuilder {
    return new RemediationBuilder(id)
      .type('automatic')
      .riskLevel('low');
  }

  static restartService(id: string): RemediationBuilder {
    return new RemediationBuilder(id)
      .type('semi-automatic')
      .riskLevel('medium')
      .requiresDowntime(true);
  }

  static applyPatch(id: string): RemediationBuilder {
    return new RemediationBuilder(id)
      .type('semi-automatic')
      .riskLevel('high')
      .requiresApproval(true)
      .requiresDowntime(true);
  }
}