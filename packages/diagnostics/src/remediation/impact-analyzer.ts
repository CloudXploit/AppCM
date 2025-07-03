import { Logger } from '@cm-diagnostics/logger';
import type { RemediationAction, Finding, ScanContext } from '../types';
import type { CMSystem } from '@cm-diagnostics/cm-connector';

export interface ImpactAnalysis {
  action: RemediationAction;
  finding: Finding;
  risk: RiskAssessment;
  dependencies: DependencyImpact[];
  services: ServiceImpact[];
  users: UserImpact;
  performance: PerformanceImpact;
  availability: AvailabilityImpact;
  dataIntegrity: DataIntegrityImpact;
  security: SecurityImpact;
  recommendations: string[];
  estimatedDuration: number; // in seconds
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
  confidence: number; // 0-100
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: RiskFactor[];
  mitigations: string[];
}

export interface RiskFactor {
  name: string;
  description: string;
  weight: number;
  score: number;
}

export interface DependencyImpact {
  resource: string;
  type: 'service' | 'configuration' | 'database' | 'integration' | 'file';
  impact: 'none' | 'minimal' | 'moderate' | 'severe';
  description: string;
  cascadingEffects: string[];
}

export interface ServiceImpact {
  name: string;
  status: 'unaffected' | 'degraded' | 'offline';
  downtime: number; // in seconds
  restartRequired: boolean;
  configReloadRequired: boolean;
  affectedOperations: string[];
}

export interface UserImpact {
  affectedUsers: number;
  affectedGroups: string[];
  accessImpact: 'none' | 'read-only' | 'limited' | 'full-outage';
  sessionImpact: 'none' | 'warning' | 'disconnect';
  notificationRequired: boolean;
}

export interface PerformanceImpact {
  cpuImpact: 'none' | 'low' | 'medium' | 'high';
  memoryImpact: 'none' | 'low' | 'medium' | 'high';
  diskImpact: 'none' | 'low' | 'medium' | 'high';
  networkImpact: 'none' | 'low' | 'medium' | 'high';
  estimatedDegradation: number; // percentage
  duration: number; // in seconds
}

export interface AvailabilityImpact {
  systemAvailability: number; // percentage
  featureAvailability: Map<string, number>; // feature -> availability %
  maintenanceWindow: boolean;
  emergencyAction: boolean;
}

export interface DataIntegrityImpact {
  dataModification: boolean;
  reversible: boolean;
  backupRequired: boolean;
  validationRequired: boolean;
  affectedTables: string[];
  affectedRecords: number;
}

export interface SecurityImpact {
  authenticationImpact: boolean;
  authorizationImpact: boolean;
  auditingImpact: boolean;
  encryptionImpact: boolean;
  complianceImpact: string[];
}

export class ImpactAnalyzer {
  private logger: Logger;
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private serviceRegistry: Map<string, ServiceInfo> = new Map();
  private historicalData: Map<string, RemediationHistory[]> = new Map();

  constructor() {
    this.logger = new Logger('ImpactAnalyzer');
    this.initializeDependencyGraph();
  }

  async analyzeImpact(
    action: RemediationAction,
    finding: Finding,
    context: ScanContext
  ): Promise<ImpactAnalysis> {
    this.logger.info(`Analyzing impact for action ${action.type} on finding ${finding.ruleId}`);

    // Gather system information
    const systemInfo = await this.gatherSystemInfo(context);
    
    // Analyze different impact dimensions
    const [
      risk,
      dependencies,
      services,
      users,
      performance,
      availability,
      dataIntegrity,
      security
    ] = await Promise.all([
      this.assessRisk(action, finding, systemInfo),
      this.analyzeDependencies(action, finding, systemInfo),
      this.analyzeServiceImpact(action, finding, systemInfo),
      this.analyzeUserImpact(action, finding, systemInfo),
      this.analyzePerformanceImpact(action, finding, systemInfo),
      this.analyzeAvailabilityImpact(action, finding, systemInfo),
      this.analyzeDataIntegrityImpact(action, finding, systemInfo),
      this.analyzeSecurityImpact(action, finding, systemInfo)
    ]);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      action, risk, dependencies, services, users, performance
    );

    // Estimate duration and complexity
    const estimatedDuration = this.estimateDuration(action, dependencies, services);
    const rollbackComplexity = this.assessRollbackComplexity(action, dataIntegrity);
    const confidence = this.calculateConfidence(action, finding, systemInfo);

    return {
      action,
      finding,
      risk,
      dependencies,
      services,
      users,
      performance,
      availability,
      dataIntegrity,
      security,
      recommendations,
      estimatedDuration,
      rollbackComplexity,
      confidence
    };
  }

  private async assessRisk(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];

    // Action type risk
    const actionRisk = this.getActionTypeRisk(action.type);
    factors.push({
      name: 'Action Type',
      description: `Risk associated with ${action.type} operations`,
      weight: 0.25,
      score: actionRisk
    });

    // System criticality
    const criticalityScore = this.getSystemCriticalityScore(systemInfo);
    factors.push({
      name: 'System Criticality',
      description: 'Importance of the system in the infrastructure',
      weight: 0.20,
      score: criticalityScore
    });

    // Time of execution
    const timeRisk = this.getTimeBasedRisk(new Date());
    factors.push({
      name: 'Execution Time',
      description: 'Risk based on when the action will be executed',
      weight: 0.15,
      score: timeRisk
    });

    // Historical success rate
    const historicalRisk = await this.getHistoricalRisk(action.type);
    factors.push({
      name: 'Historical Success',
      description: 'Risk based on past execution history',
      weight: 0.20,
      score: historicalRisk
    });

    // Complexity
    const complexityScore = this.getComplexityScore(action);
    factors.push({
      name: 'Action Complexity',
      description: 'Complexity of the remediation action',
      weight: 0.20,
      score: complexityScore
    });

    // Calculate overall risk score
    const totalScore = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);
    
    const level = this.getRiskLevel(totalScore);
    const mitigations = this.getRiskMitigations(factors, level);

    return {
      level,
      score: Math.round(totalScore),
      factors,
      mitigations
    };
  }

  private async analyzeDependencies(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<DependencyImpact[]> {
    const impacts: DependencyImpact[] = [];
    
    // Get resources affected by this action
    const affectedResources = this.getAffectedResources(action);
    
    for (const resource of affectedResources) {
      const dependencies = this.dependencyGraph.get(resource) || new Set();
      
      for (const dep of dependencies) {
        const impact = await this.assessDependencyImpact(resource, dep, action);
        impacts.push(impact);
      }
    }

    // Check for configuration dependencies
    if (action.type === 'update_configuration') {
      const configDeps = await this.analyzeConfigurationDependencies(action.parameters);
      impacts.push(...configDeps);
    }

    // Check for database dependencies
    if (this.actionAffectsDatabase(action)) {
      const dbDeps = await this.analyzeDatabaseDependencies(action);
      impacts.push(...dbDeps);
    }

    return impacts;
  }

  private async analyzeServiceImpact(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<ServiceImpact[]> {
    const impacts: ServiceImpact[] = [];
    
    for (const [serviceName, serviceInfo] of this.serviceRegistry) {
      const impact = await this.assessServiceImpact(serviceName, serviceInfo, action);
      
      if (impact.status !== 'unaffected') {
        impacts.push(impact);
      }
    }

    // Sort by severity of impact
    return impacts.sort((a, b) => {
      const statusOrder = { 'offline': 2, 'degraded': 1, 'unaffected': 0 };
      return statusOrder[b.status] - statusOrder[a.status];
    });
  }

  private async analyzeUserImpact(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<UserImpact> {
    let affectedUsers = 0;
    const affectedGroups: string[] = [];
    let accessImpact: UserImpact['accessImpact'] = 'none';
    let sessionImpact: UserImpact['sessionImpact'] = 'none';
    let notificationRequired = false;

    // Analyze based on action type
    switch (action.type) {
      case 'restart_service':
        affectedUsers = systemInfo.activeUsers;
        accessImpact = 'full-outage';
        sessionImpact = 'disconnect';
        notificationRequired = true;
        break;
        
      case 'update_configuration':
        if (this.isAuthenticationConfig(action.parameters)) {
          affectedUsers = systemInfo.totalUsers;
          affectedGroups.push('all');
          accessImpact = 'limited';
          sessionImpact = 'warning';
          notificationRequired = true;
        }
        break;
        
      case 'clear_cache':
        affectedUsers = Math.floor(systemInfo.activeUsers * 0.3); // 30% might notice
        accessImpact = 'none';
        sessionImpact = 'none';
        break;
    }

    // Check for specific user group impacts
    if (action.parameters?.targetGroups) {
      affectedGroups.push(...action.parameters.targetGroups);
    }

    return {
      affectedUsers,
      affectedGroups,
      accessImpact,
      sessionImpact,
      notificationRequired
    };
  }

  private async analyzePerformanceImpact(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<PerformanceImpact> {
    let cpuImpact: PerformanceImpact['cpuImpact'] = 'none';
    let memoryImpact: PerformanceImpact['memoryImpact'] = 'none';
    let diskImpact: PerformanceImpact['diskImpact'] = 'none';
    let networkImpact: PerformanceImpact['networkImpact'] = 'none';
    let estimatedDegradation = 0;
    let duration = 0;

    // Analyze based on action type
    switch (action.type) {
      case 'rebuild_index':
        cpuImpact = 'high';
        diskImpact = 'high';
        estimatedDegradation = 40;
        duration = 300; // 5 minutes
        break;
        
      case 'clear_cache':
        cpuImpact = 'low';
        memoryImpact = 'medium';
        estimatedDegradation = 20;
        duration = 60; // 1 minute
        break;
        
      case 'restart_service':
        cpuImpact = 'medium';
        memoryImpact = 'medium';
        estimatedDegradation = 100; // Full outage during restart
        duration = 30; // 30 seconds
        break;
        
      case 'update_configuration':
        cpuImpact = 'low';
        estimatedDegradation = 5;
        duration = 10;
        break;
    }

    // Adjust based on system load
    if (systemInfo.currentLoad > 0.7) {
      estimatedDegradation *= 1.5;
      duration *= 1.5;
    }

    return {
      cpuImpact,
      memoryImpact,
      diskImpact,
      networkImpact,
      estimatedDegradation: Math.min(100, estimatedDegradation),
      duration
    };
  }

  private async analyzeAvailabilityImpact(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<AvailabilityImpact> {
    let systemAvailability = 100;
    const featureAvailability = new Map<string, number>();
    let maintenanceWindow = false;
    let emergencyAction = false;

    // Check if action requires downtime
    if (action.type === 'restart_service') {
      systemAvailability = 0;
      maintenanceWindow = true;
    } else if (action.type === 'update_configuration') {
      // Some features might be affected during config update
      featureAvailability.set('authentication', 90);
      featureAvailability.set('api', 95);
    }

    // Check if this is an emergency action
    if (finding.severity === 'critical' && action.parameters?.immediate) {
      emergencyAction = true;
    }

    // Check if we're in a maintenance window
    maintenanceWindow = this.isInMaintenanceWindow(new Date());

    return {
      systemAvailability,
      featureAvailability,
      maintenanceWindow,
      emergencyAction
    };
  }

  private async analyzeDataIntegrityImpact(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<DataIntegrityImpact> {
    let dataModification = false;
    let reversible = true;
    let backupRequired = false;
    let validationRequired = false;
    const affectedTables: string[] = [];
    let affectedRecords = 0;

    // Analyze based on action type
    switch (action.type) {
      case 'update_data':
        dataModification = true;
        backupRequired = true;
        validationRequired = true;
        affectedTables.push(...(action.parameters?.tables || []));
        affectedRecords = action.parameters?.recordCount || 0;
        break;
        
      case 'rebuild_index':
        dataModification = false;
        reversible = true;
        backupRequired = false;
        affectedTables.push(...(action.parameters?.tables || []));
        break;
        
      case 'delete_data':
        dataModification = true;
        reversible = false;
        backupRequired = true;
        validationRequired = true;
        affectedTables.push(...(action.parameters?.tables || []));
        affectedRecords = action.parameters?.recordCount || 0;
        break;
    }

    return {
      dataModification,
      reversible,
      backupRequired,
      validationRequired,
      affectedTables,
      affectedRecords
    };
  }

  private async analyzeSecurityImpact(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): Promise<SecurityImpact> {
    let authenticationImpact = false;
    let authorizationImpact = false;
    let auditingImpact = false;
    let encryptionImpact = false;
    const complianceImpact: string[] = [];

    // Check for security-related impacts
    if (action.type === 'update_configuration') {
      const config = action.parameters?.configuration || {};
      
      if (config.authentication) authenticationImpact = true;
      if (config.permissions || config.roles) authorizationImpact = true;
      if (config.auditLog) auditingImpact = true;
      if (config.encryption || config.tls) encryptionImpact = true;
    }

    if (action.type === 'rotate_credentials' || action.type === 'reset_password') {
      authenticationImpact = true;
      complianceImpact.push('password-policy');
    }

    // Check compliance requirements
    if (authenticationImpact || authorizationImpact) {
      complianceImpact.push('access-control');
    }
    
    if (auditingImpact) {
      complianceImpact.push('audit-trail');
    }

    return {
      authenticationImpact,
      authorizationImpact,
      auditingImpact,
      encryptionImpact,
      complianceImpact
    };
  }

  private generateRecommendations(
    action: RemediationAction,
    risk: RiskAssessment,
    dependencies: DependencyImpact[],
    services: ServiceImpact[],
    users: UserImpact,
    performance: PerformanceImpact
  ): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (risk.level === 'high' || risk.level === 'critical') {
      recommendations.push('Consider scheduling during maintenance window');
      recommendations.push('Ensure rollback plan is tested and ready');
      recommendations.push('Have support team on standby');
    }

    // Service impact recommendations
    if (services.some(s => s.status === 'offline')) {
      recommendations.push('Notify users before executing the action');
      recommendations.push('Prepare service health monitoring');
    }

    // User impact recommendations
    if (users.affectedUsers > 100) {
      recommendations.push('Send advance notification to affected users');
    }
    
    if (users.sessionImpact === 'disconnect') {
      recommendations.push('Schedule during low-usage period');
    }

    // Performance recommendations
    if (performance.estimatedDegradation > 30) {
      recommendations.push('Consider executing in phases to minimize impact');
      recommendations.push('Monitor system resources during execution');
    }

    // Dependency recommendations
    if (dependencies.length > 5) {
      recommendations.push('Review all dependent systems before proceeding');
      recommendations.push('Consider creating a dependency impact matrix');
    }

    return recommendations;
  }

  private estimateDuration(
    action: RemediationAction,
    dependencies: DependencyImpact[],
    services: ServiceImpact[]
  ): number {
    let baseDuration = this.getBaseActionDuration(action.type);
    
    // Add time for dependencies
    baseDuration += dependencies.length * 5;
    
    // Add time for service restarts
    const restartingServices = services.filter(s => s.restartRequired);
    baseDuration += restartingServices.length * 30;
    
    // Add buffer for safety
    return Math.ceil(baseDuration * 1.2);
  }

  private assessRollbackComplexity(
    action: RemediationAction,
    dataIntegrity: DataIntegrityImpact
  ): 'simple' | 'moderate' | 'complex' {
    if (!dataIntegrity.reversible) {
      return 'complex';
    }
    
    if (dataIntegrity.dataModification && dataIntegrity.affectedRecords > 1000) {
      return 'complex';
    }
    
    if (action.type === 'update_configuration' || action.type === 'clear_cache') {
      return 'simple';
    }
    
    return 'moderate';
  }

  private calculateConfidence(
    action: RemediationAction,
    finding: Finding,
    systemInfo: SystemInfo
  ): number {
    let confidence = 80; // Base confidence
    
    // Adjust based on historical success
    const history = this.historicalData.get(action.type) || [];
    if (history.length > 0) {
      const successRate = history.filter(h => h.success).length / history.length;
      confidence = confidence * 0.5 + (successRate * 100 * 0.5);
    }
    
    // Adjust based on system state
    if (systemInfo.currentLoad > 0.8) {
      confidence -= 10;
    }
    
    // Adjust based on action complexity
    const complexity = this.getComplexityScore(action);
    confidence -= complexity * 0.2;
    
    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  // Helper methods
  private initializeDependencyGraph(): void {
    // Initialize with common dependencies
    this.dependencyGraph.set('database', new Set(['api', 'web', 'reports']));
    this.dependencyGraph.set('cache', new Set(['api', 'web']));
    this.dependencyGraph.set('authentication', new Set(['api', 'web', 'admin']));
    this.dependencyGraph.set('configuration', new Set(['all']));
  }

  private getActionTypeRisk(type: string): number {
    const riskScores: Record<string, number> = {
      'restart_service': 70,
      'update_configuration': 40,
      'clear_cache': 20,
      'rebuild_index': 50,
      'update_data': 60,
      'delete_data': 90,
      'rotate_credentials': 50
    };
    
    return riskScores[type] || 50;
  }

  private getSystemCriticalityScore(systemInfo: SystemInfo): number {
    if (systemInfo.environment === 'production') {
      return 90;
    } else if (systemInfo.environment === 'staging') {
      return 50;
    }
    return 20;
  }

  private getTimeBasedRisk(time: Date): number {
    const hour = time.getHours();
    
    // Business hours (9-5) are higher risk
    if (hour >= 9 && hour <= 17) {
      return 80;
    }
    
    // Early morning (2-5) is lowest risk
    if (hour >= 2 && hour <= 5) {
      return 20;
    }
    
    return 50;
  }

  private async getHistoricalRisk(actionType: string): Promise<number> {
    const history = this.historicalData.get(actionType) || [];
    
    if (history.length === 0) {
      return 50; // Unknown risk
    }
    
    const failures = history.filter(h => !h.success).length;
    const failureRate = failures / history.length;
    
    return Math.round(failureRate * 100);
  }

  private getComplexityScore(action: RemediationAction): number {
    let score = 20; // Base complexity
    
    // Add complexity for parameters
    const paramCount = Object.keys(action.parameters || {}).length;
    score += paramCount * 5;
    
    // Add complexity for specific action types
    if (action.type === 'update_data' || action.type === 'delete_data') {
      score += 30;
    }
    
    return Math.min(100, score);
  }

  private getRiskLevel(score: number): RiskAssessment['level'] {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  private getRiskMitigations(factors: RiskFactor[], level: RiskAssessment['level']): string[] {
    const mitigations: string[] = [];
    
    if (level === 'high' || level === 'critical') {
      mitigations.push('Create comprehensive backup before execution');
      mitigations.push('Test in non-production environment first');
      mitigations.push('Have rollback procedure ready');
    }
    
    // Add specific mitigations based on high-scoring factors
    const highFactors = factors.filter(f => f.score > 70);
    
    for (const factor of highFactors) {
      switch (factor.name) {
        case 'System Criticality':
          mitigations.push('Schedule during maintenance window');
          break;
        case 'Historical Success':
          mitigations.push('Review previous failure logs');
          break;
        case 'Action Complexity':
          mitigations.push('Break down into smaller actions if possible');
          break;
      }
    }
    
    return mitigations;
  }

  private getAffectedResources(action: RemediationAction): string[] {
    const resources: string[] = [];
    
    switch (action.type) {
      case 'restart_service':
        resources.push(action.parameters?.service || 'unknown');
        break;
      case 'update_configuration':
        resources.push('configuration');
        break;
      case 'clear_cache':
        resources.push('cache');
        break;
      case 'rebuild_index':
        resources.push('database');
        break;
    }
    
    return resources;
  }

  private async assessDependencyImpact(
    resource: string,
    dependency: string,
    action: RemediationAction
  ): Promise<DependencyImpact> {
    let impact: DependencyImpact['impact'] = 'none';
    const cascadingEffects: string[] = [];
    
    if (action.type === 'restart_service' && resource === action.parameters?.service) {
      impact = 'severe';
      cascadingEffects.push(`${dependency} will lose connection`);
      cascadingEffects.push(`${dependency} may need restart`);
    } else if (action.type === 'update_configuration') {
      impact = 'moderate';
      cascadingEffects.push(`${dependency} may need configuration reload`);
    }
    
    return {
      resource: dependency,
      type: 'service',
      impact,
      description: `${dependency} depends on ${resource}`,
      cascadingEffects
    };
  }

  private async gatherSystemInfo(context: ScanContext): Promise<SystemInfo> {
    // This would gather real system information
    return {
      environment: 'production',
      activeUsers: 150,
      totalUsers: 1000,
      currentLoad: 0.65,
      services: []
    };
  }

  private actionAffectsDatabase(action: RemediationAction): boolean {
    return ['rebuild_index', 'update_data', 'delete_data'].includes(action.type);
  }

  private isAuthenticationConfig(params: any): boolean {
    return params?.configuration?.authentication || 
           params?.configuration?.ldap ||
           params?.configuration?.sso;
  }

  private isInMaintenanceWindow(time: Date): boolean {
    const day = time.getDay();
    const hour = time.getHours();
    
    // Saturday 2-5 AM
    return day === 6 && hour >= 2 && hour <= 5;
  }

  private getBaseActionDuration(actionType: string): number {
    const durations: Record<string, number> = {
      'restart_service': 30,
      'update_configuration': 10,
      'clear_cache': 5,
      'rebuild_index': 300,
      'update_data': 60,
      'delete_data': 60,
      'rotate_credentials': 20
    };
    
    return durations[actionType] || 30;
  }

  private async analyzeConfigurationDependencies(params: any): Promise<DependencyImpact[]> {
    const impacts: DependencyImpact[] = [];
    // Implementation would analyze configuration dependencies
    return impacts;
  }

  private async analyzeDatabaseDependencies(action: RemediationAction): Promise<DependencyImpact[]> {
    const impacts: DependencyImpact[] = [];
    // Implementation would analyze database dependencies
    return impacts;
  }

  private async assessServiceImpact(
    serviceName: string,
    serviceInfo: ServiceInfo,
    action: RemediationAction
  ): Promise<ServiceImpact> {
    let status: ServiceImpact['status'] = 'unaffected';
    let downtime = 0;
    let restartRequired = false;
    let configReloadRequired = false;
    const affectedOperations: string[] = [];
    
    if (action.type === 'restart_service' && action.parameters?.service === serviceName) {
      status = 'offline';
      downtime = 30;
      restartRequired = true;
      affectedOperations.push('all');
    }
    
    return {
      name: serviceName,
      status,
      downtime,
      restartRequired,
      configReloadRequired,
      affectedOperations
    };
  }
}

// Type definitions
interface SystemInfo {
  environment: 'production' | 'staging' | 'development';
  activeUsers: number;
  totalUsers: number;
  currentLoad: number;
  services: string[];
}

interface ServiceInfo {
  name: string;
  critical: boolean;
  dependencies: string[];
}

interface RemediationHistory {
  timestamp: Date;
  success: boolean;
  duration: number;
  error?: string;
}

// Export singleton instance
export const impactAnalyzer = new ImpactAnalyzer();