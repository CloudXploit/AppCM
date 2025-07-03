import { BaseScanner } from './base-scanner';
import type { Finding, ScanContext } from '../types';

interface ConflictCheck {
  name: string;
  description: string;
  checkFunction: (context: ScanContext) => Promise<ConflictResult>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ConflictResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

interface ConflictDetail {
  type: string;
  resource1: string;
  resource2: string;
  description: string;
  impact: string;
}

export class ConflictDetectorScanner extends BaseScanner {
  name = 'Conflict Detector Scanner';
  description = 'Detects configuration conflicts, rule conflicts, and resource conflicts';
  category = 'system_health';

  private conflictChecks: ConflictCheck[] = [
    {
      name: 'port_conflicts',
      description: 'Check for services using the same ports',
      checkFunction: this.checkPortConflicts.bind(this),
      severity: 'critical'
    },
    {
      name: 'permission_conflicts',
      description: 'Check for conflicting permission rules',
      checkFunction: this.checkPermissionConflicts.bind(this),
      severity: 'high'
    },
    {
      name: 'workflow_conflicts',
      description: 'Check for conflicting workflow configurations',
      checkFunction: this.checkWorkflowConflicts.bind(this),
      severity: 'medium'
    },
    {
      name: 'integration_conflicts',
      description: 'Check for conflicting integration configurations',
      checkFunction: this.checkIntegrationConflicts.bind(this),
      severity: 'high'
    },
    {
      name: 'scheduled_job_conflicts',
      description: 'Check for overlapping scheduled jobs',
      checkFunction: this.checkScheduledJobConflicts.bind(this),
      severity: 'medium'
    },
    {
      name: 'resource_allocation_conflicts',
      description: 'Check for resource allocation conflicts',
      checkFunction: this.checkResourceAllocationConflicts.bind(this),
      severity: 'high'
    },
    {
      name: 'cache_configuration_conflicts',
      description: 'Check for conflicting cache configurations',
      checkFunction: this.checkCacheConfigConflicts.bind(this),
      severity: 'medium'
    },
    {
      name: 'database_connection_conflicts',
      description: 'Check for database connection pool conflicts',
      checkFunction: this.checkDatabaseConnectionConflicts.bind(this),
      severity: 'high'
    },
    {
      name: 'security_policy_conflicts',
      description: 'Check for conflicting security policies',
      checkFunction: this.checkSecurityPolicyConflicts.bind(this),
      severity: 'critical'
    },
    {
      name: 'rule_priority_conflicts',
      description: 'Check for diagnostic rule priority conflicts',
      checkFunction: this.checkRulePriorityConflicts.bind(this),
      severity: 'medium'
    }
  ];

  async scan(context: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const check of this.conflictChecks) {
      try {
        const result = await check.checkFunction(context);
        
        if (result.hasConflict) {
          findings.push({
            ruleId: `conflict_${check.name}`,
            severity: check.severity,
            category: 'system_health',
            title: check.description,
            description: this.generateConflictDescription(check.name, result),
            recommendation: this.generateConflictRecommendation(check.name, result),
            metadata: {
              checkName: check.name,
              conflictCount: result.conflicts.length,
              conflicts: result.conflicts
            }
          });
        }
      } catch (error) {
        this.logger.error(`Failed to execute conflict check ${check.name}:`, error);
        findings.push({
          ruleId: `conflict_${check.name}_error`,
          severity: 'low',
          category: 'system_health',
          title: `Unable to check for ${check.description}`,
          description: `The conflict check could not be completed due to an error.`,
          recommendation: 'Review the error logs and ensure the system configuration is accessible.',
          metadata: {
            checkName: check.name,
            error: error.message
          }
        });
      }
    }

    return findings;
  }

  private async checkPortConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    const portMap = new Map<number, string[]>();

    // Get all service configurations
    const services = await this.getServiceConfigurations(context);
    
    // Map ports to services
    for (const service of services) {
      if (service.port) {
        if (!portMap.has(service.port)) {
          portMap.set(service.port, []);
        }
        portMap.get(service.port)!.push(service.name);
      }
    }

    // Find conflicts
    for (const [port, services] of portMap.entries()) {
      if (services.length > 1) {
        conflicts.push({
          type: 'port_conflict',
          resource1: services[0],
          resource2: services.slice(1).join(', '),
          description: `Multiple services configured to use port ${port}`,
          impact: 'Services will fail to start or bind to the specified port'
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkPermissionConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get permission rules
    const permissions = await this.getPermissionRules(context);
    
    // Check for conflicting allow/deny rules
    for (let i = 0; i < permissions.length; i++) {
      for (let j = i + 1; j < permissions.length; j++) {
        const rule1 = permissions[i];
        const rule2 = permissions[j];
        
        if (this.rulesConflict(rule1, rule2)) {
          conflicts.push({
            type: 'permission_conflict',
            resource1: `${rule1.resource}:${rule1.action}`,
            resource2: `${rule2.resource}:${rule2.action}`,
            description: `Conflicting permission rules for the same resource and action`,
            impact: 'Unpredictable access control behavior'
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkWorkflowConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get workflow configurations
    const workflows = await this.getWorkflowConfigurations(context);
    
    // Check for state transition conflicts
    for (const workflow of workflows) {
      const stateTransitions = new Map<string, string[]>();
      
      for (const transition of workflow.transitions || []) {
        const key = `${transition.fromState}-${transition.event}`;
        if (!stateTransitions.has(key)) {
          stateTransitions.set(key, []);
        }
        stateTransitions.get(key)!.push(transition.toState);
      }
      
      // Find conflicts where same state+event leads to different states
      for (const [key, toStates] of stateTransitions.entries()) {
        if (toStates.length > 1) {
          conflicts.push({
            type: 'workflow_conflict',
            resource1: workflow.name,
            resource2: key,
            description: `Multiple transitions defined for the same state and event`,
            impact: 'Non-deterministic workflow behavior'
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkIntegrationConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get integration configurations
    const integrations = await this.getIntegrationConfigurations(context);
    
    // Check for endpoint conflicts
    const endpointMap = new Map<string, string[]>();
    
    for (const integration of integrations) {
      const endpoint = integration.endpoint || integration.url;
      if (endpoint) {
        if (!endpointMap.has(endpoint)) {
          endpointMap.set(endpoint, []);
        }
        endpointMap.get(endpoint)!.push(integration.name);
      }
    }
    
    // Find conflicts
    for (const [endpoint, integrations] of endpointMap.entries()) {
      if (integrations.length > 1) {
        conflicts.push({
          type: 'integration_conflict',
          resource1: integrations[0],
          resource2: integrations.slice(1).join(', '),
          description: `Multiple integrations configured for the same endpoint`,
          impact: 'Potential data synchronization issues and race conditions'
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkScheduledJobConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get scheduled jobs
    const jobs = await this.getScheduledJobs(context);
    
    // Check for overlapping schedules
    for (let i = 0; i < jobs.length; i++) {
      for (let j = i + 1; j < jobs.length; j++) {
        const job1 = jobs[i];
        const job2 = jobs[j];
        
        if (this.schedulesOverlap(job1.schedule, job2.schedule)) {
          // Check if they access same resources
          if (this.jobsAccessSameResources(job1, job2)) {
            conflicts.push({
              type: 'scheduled_job_conflict',
              resource1: job1.name,
              resource2: job2.name,
              description: `Jobs have overlapping schedules and access same resources`,
              impact: 'Resource contention and potential data corruption'
            });
          }
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkResourceAllocationConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get resource allocations
    const allocations = await this.getResourceAllocations(context);
    
    // Calculate total allocated resources
    const totalCPU = allocations.reduce((sum, a) => sum + (a.cpu || 0), 0);
    const totalMemory = allocations.reduce((sum, a) => sum + (a.memory || 0), 0);
    
    // Get system resources
    const systemResources = await this.getSystemResources(context);
    
    if (totalCPU > systemResources.cpu * 0.9) {
      conflicts.push({
        type: 'resource_allocation_conflict',
        resource1: 'CPU',
        resource2: `${totalCPU}% allocated`,
        description: `Total CPU allocation exceeds 90% of available resources`,
        impact: 'System performance degradation and potential service failures'
      });
    }
    
    if (totalMemory > systemResources.memory * 0.9) {
      conflicts.push({
        type: 'resource_allocation_conflict',
        resource1: 'Memory',
        resource2: `${totalMemory}GB allocated`,
        description: `Total memory allocation exceeds 90% of available resources`,
        impact: 'Out of memory errors and system instability'
      });
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkCacheConfigConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get cache configurations
    const cacheConfigs = await this.getCacheConfigurations(context);
    
    // Check for namespace conflicts
    const namespaceMap = new Map<string, string[]>();
    
    for (const config of cacheConfigs) {
      if (config.namespace) {
        if (!namespaceMap.has(config.namespace)) {
          namespaceMap.set(config.namespace, []);
        }
        namespaceMap.get(config.namespace)!.push(config.name);
      }
    }
    
    // Find conflicts
    for (const [namespace, configs] of namespaceMap.entries()) {
      if (configs.length > 1) {
        conflicts.push({
          type: 'cache_config_conflict',
          resource1: configs[0],
          resource2: configs.slice(1).join(', '),
          description: `Multiple cache configurations using the same namespace`,
          impact: 'Cache key collisions and data corruption'
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkDatabaseConnectionConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get database configurations
    const dbConfigs = await this.getDatabaseConfigurations(context);
    
    // Calculate total connection pool size
    const totalConnections = dbConfigs.reduce((sum, config) => sum + (config.maxConnections || 10), 0);
    
    // Get database limits
    const dbLimits = await this.getDatabaseLimits(context);
    
    if (totalConnections > dbLimits.maxConnections * 0.8) {
      conflicts.push({
        type: 'database_connection_conflict',
        resource1: 'Connection Pools',
        resource2: `${totalConnections} total connections`,
        description: `Total connection pool size exceeds 80% of database limit`,
        impact: 'Connection exhaustion and application failures'
      });
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkSecurityPolicyConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get security policies
    const policies = await this.getSecurityPolicies(context);
    
    // Check for conflicting password policies
    const passwordPolicies = policies.filter(p => p.type === 'password');
    if (passwordPolicies.length > 1) {
      for (let i = 0; i < passwordPolicies.length - 1; i++) {
        for (let j = i + 1; j < passwordPolicies.length; j++) {
          if (this.passwordPoliciesConflict(passwordPolicies[i], passwordPolicies[j])) {
            conflicts.push({
              type: 'security_policy_conflict',
              resource1: passwordPolicies[i].name,
              resource2: passwordPolicies[j].name,
              description: `Conflicting password policy requirements`,
              impact: 'Users unable to set passwords that satisfy all policies'
            });
          }
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private async checkRulePriorityConflicts(context: ScanContext): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];
    
    // Get diagnostic rules
    const rules = await this.getDiagnosticRules(context);
    
    // Group rules by priority
    const priorityMap = new Map<number, any[]>();
    
    for (const rule of rules) {
      if (rule.priority !== undefined) {
        if (!priorityMap.has(rule.priority)) {
          priorityMap.set(rule.priority, []);
        }
        priorityMap.get(rule.priority)!.push(rule);
      }
    }
    
    // Check for rules with same priority that might conflict
    for (const [priority, rulesAtPriority] of priorityMap.entries()) {
      if (rulesAtPriority.length > 1) {
        // Check if rules at same priority level could conflict
        for (let i = 0; i < rulesAtPriority.length - 1; i++) {
          for (let j = i + 1; j < rulesAtPriority.length; j++) {
            if (this.diagnosticRulesOverlap(rulesAtPriority[i], rulesAtPriority[j])) {
              conflicts.push({
                type: 'rule_priority_conflict',
                resource1: rulesAtPriority[i].name,
                resource2: rulesAtPriority[j].name,
                description: `Rules have same priority but overlapping conditions`,
                impact: 'Unpredictable rule execution order'
              });
            }
          }
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  // Helper methods
  private generateConflictDescription(checkName: string, result: ConflictResult): string {
    const conflictCount = result.conflicts.length;
    const conflictTypes = [...new Set(result.conflicts.map(c => c.type))].join(', ');
    
    return `Found ${conflictCount} conflict${conflictCount !== 1 ? 's' : ''} of type${conflictTypes.includes(',') ? 's' : ''}: ${conflictTypes}. ${result.conflicts[0]?.description || ''}`;
  }

  private generateConflictRecommendation(checkName: string, result: ConflictResult): string {
    const recommendations: Record<string, string> = {
      port_conflicts: 'Assign unique ports to each service or use a service discovery mechanism.',
      permission_conflicts: 'Review and consolidate permission rules to avoid conflicts.',
      workflow_conflicts: 'Ensure each state-event combination has only one target state.',
      integration_conflicts: 'Use unique endpoints for each integration or implement proper synchronization.',
      scheduled_job_conflicts: 'Adjust job schedules to avoid overlaps or implement resource locking.',
      resource_allocation_conflicts: 'Reduce resource allocations or increase system resources.',
      cache_configuration_conflicts: 'Use unique cache namespaces for each configuration.',
      database_connection_conflicts: 'Reduce connection pool sizes or increase database connection limit.',
      security_policy_conflicts: 'Consolidate security policies to avoid contradictions.',
      rule_priority_conflicts: 'Assign unique priorities or merge overlapping rules.'
    };

    return recommendations[checkName] || 'Review and resolve the identified conflicts.';
  }

  // Stub methods for data retrieval (would be implemented with actual CM connector)
  private async getServiceConfigurations(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getPermissionRules(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getWorkflowConfigurations(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getIntegrationConfigurations(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getScheduledJobs(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getResourceAllocations(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getSystemResources(context: ScanContext): Promise<any> {
    return { cpu: 100, memory: 16 };
  }

  private async getCacheConfigurations(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getDatabaseConfigurations(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getDatabaseLimits(context: ScanContext): Promise<any> {
    return { maxConnections: 100 };
  }

  private async getSecurityPolicies(context: ScanContext): Promise<any[]> {
    return [];
  }

  private async getDiagnosticRules(context: ScanContext): Promise<any[]> {
    return [];
  }

  private rulesConflict(rule1: any, rule2: any): boolean {
    return rule1.resource === rule2.resource && 
           rule1.action === rule2.action && 
           rule1.effect !== rule2.effect;
  }

  private schedulesOverlap(schedule1: string, schedule2: string): boolean {
    // Simplified implementation - would use proper cron parsing
    return schedule1 === schedule2;
  }

  private jobsAccessSameResources(job1: any, job2: any): boolean {
    // Check if jobs access same resources
    return job1.resources?.some((r: string) => job2.resources?.includes(r));
  }

  private passwordPoliciesConflict(policy1: any, policy2: any): boolean {
    // Check for conflicting requirements
    return (policy1.minLength > policy2.maxLength) ||
           (policy1.requireUppercase && policy2.forbidUppercase);
  }

  private diagnosticRulesOverlap(rule1: any, rule2: any): boolean {
    // Check if rules have overlapping conditions
    return rule1.category === rule2.category && 
           rule1.resource === rule2.resource;
  }
}