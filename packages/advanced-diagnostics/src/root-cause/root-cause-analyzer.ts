import { EventEmitter } from 'events';
import * as natural from 'natural';
import { Graph } from 'graphlib';
import * as compromise from 'compromise';
import _ from 'lodash';
import {
  RootCauseAnalysis,
  RootCauseAnalyzer,
  Cause,
  CauseType,
  CausalRelation,
  Evidence,
  EvidenceType,
  Recommendation,
  ImpactLevel,
  EffortLevel,
  Event,
  AnalysisContext
} from '../types';
import { Finding, SystemMetrics } from '@cm-diagnostics/diagnostics';
import { logger } from '@cm-diagnostics/logger';

interface CauseTemplate {
  id: string;
  type: CauseType;
  category: string;
  description: string;
  indicators: string[];
  commonEffects: string[];
  typicalFixes: string[];
}

interface CorrelationResult {
  event1: Event;
  event2: Event;
  correlation: number;
  timeDiff: number;
  relationship: 'causes' | 'contributes' | 'correlates';
}

export class IntelligentRootCauseAnalyzer extends EventEmitter implements RootCauseAnalyzer {
  private causeTemplates: Map<string, CauseTemplate> = new Map();
  private causalGraph: Graph;
  private tfidf: natural.TfIdf;
  private classifier: natural.BayesClassifier;
  
  constructor() {
    super();
    this.causalGraph = new Graph({ directed: true });
    this.tfidf = new natural.TfIdf();
    this.classifier = new natural.BayesClassifier();
    this.initializeCauseTemplates();
    this.trainClassifier();
  }

  private initializeCauseTemplates(): void {
    // Configuration causes
    this.causeTemplates.set('config-timeout', {
      id: 'config-timeout',
      type: CauseType.CONFIGURATION,
      category: 'timeout',
      description: 'Timeout configuration too low',
      indicators: ['timeout', 'connection reset', 'request failed', 'time limit exceeded'],
      commonEffects: ['failed requests', 'user complaints', 'incomplete operations'],
      typicalFixes: ['increase timeout values', 'optimize slow operations', 'implement async processing']
    });

    this.causeTemplates.set('config-pool-size', {
      id: 'config-pool-size',
      type: CauseType.CONFIGURATION,
      category: 'resources',
      description: 'Connection pool size insufficient',
      indicators: ['pool exhausted', 'waiting for connection', 'connection limit'],
      commonEffects: ['slow response', 'connection timeouts', 'request queuing'],
      typicalFixes: ['increase pool size', 'optimize connection usage', 'implement connection pooling']
    });

    // Resource causes
    this.causeTemplates.set('resource-cpu', {
      id: 'resource-cpu',
      type: CauseType.RESOURCE,
      category: 'compute',
      description: 'CPU resources exhausted',
      indicators: ['high cpu', 'cpu usage', 'processor', 'load average'],
      commonEffects: ['slow performance', 'timeouts', 'unresponsive system'],
      typicalFixes: ['scale up CPU', 'optimize code', 'distribute load', 'cache results']
    });

    this.causeTemplates.set('resource-memory', {
      id: 'resource-memory',
      type: CauseType.RESOURCE,
      category: 'memory',
      description: 'Memory pressure or leak',
      indicators: ['out of memory', 'heap space', 'memory usage', 'gc overhead'],
      commonEffects: ['crashes', 'slow gc', 'swap usage', 'oom killer'],
      typicalFixes: ['increase memory', 'fix memory leaks', 'optimize data structures', 'tune gc']
    });

    this.causeTemplates.set('resource-disk', {
      id: 'resource-disk',
      type: CauseType.RESOURCE,
      category: 'storage',
      description: 'Disk space or I/O issues',
      indicators: ['disk full', 'io wait', 'disk usage', 'write failed'],
      commonEffects: ['write errors', 'slow operations', 'data loss'],
      typicalFixes: ['free disk space', 'archive old data', 'optimize io', 'add storage']
    });

    // Workload causes
    this.causeTemplates.set('workload-spike', {
      id: 'workload-spike',
      type: CauseType.WORKLOAD,
      category: 'traffic',
      description: 'Sudden traffic spike',
      indicators: ['request spike', 'high traffic', 'increased load', 'surge'],
      commonEffects: ['overload', 'slow response', 'dropped requests'],
      typicalFixes: ['auto-scaling', 'rate limiting', 'caching', 'load balancing']
    });

    this.causeTemplates.set('workload-pattern', {
      id: 'workload-pattern',
      type: CauseType.WORKLOAD,
      category: 'pattern',
      description: 'Inefficient workload pattern',
      indicators: ['batch job', 'bulk operation', 'concurrent requests', 'peak hours'],
      commonEffects: ['resource contention', 'queue buildup', 'timeouts'],
      typicalFixes: ['schedule optimization', 'batch size tuning', 'request throttling']
    });

    // Dependency causes
    this.causeTemplates.set('dependency-database', {
      id: 'dependency-database',
      type: CauseType.DEPENDENCY,
      category: 'database',
      description: 'Database performance or availability',
      indicators: ['database error', 'query timeout', 'connection failed', 'deadlock'],
      commonEffects: ['data unavailable', 'transaction rollback', 'application errors'],
      typicalFixes: ['optimize queries', 'add indexes', 'scale database', 'connection retry']
    });

    this.causeTemplates.set('dependency-service', {
      id: 'dependency-service',
      type: CauseType.DEPENDENCY,
      category: 'service',
      description: 'External service failure',
      indicators: ['service unavailable', 'api error', 'remote failure', 'network error'],
      commonEffects: ['feature unavailable', 'degraded functionality', 'cascading failure'],
      typicalFixes: ['circuit breaker', 'fallback logic', 'retry mechanism', 'cache responses']
    });

    // Environmental causes
    this.causeTemplates.set('env-network', {
      id: 'env-network',
      type: CauseType.ENVIRONMENTAL,
      category: 'network',
      description: 'Network connectivity issues',
      indicators: ['network unreachable', 'packet loss', 'high latency', 'dns failure'],
      commonEffects: ['connection failures', 'slow transfers', 'intermittent errors'],
      typicalFixes: ['network redundancy', 'dns caching', 'connection pooling', 'retry logic']
    });

    // Software causes
    this.causeTemplates.set('software-bug', {
      id: 'software-bug',
      type: CauseType.SOFTWARE,
      category: 'code',
      description: 'Software bug or regression',
      indicators: ['exception', 'error', 'stack trace', 'null pointer', 'undefined'],
      commonEffects: ['crashes', 'incorrect behavior', 'data corruption'],
      typicalFixes: ['code fix', 'rollback', 'patch deployment', 'workaround']
    });

    this.causeTemplates.set('software-version', {
      id: 'software-version',
      type: CauseType.SOFTWARE,
      category: 'compatibility',
      description: 'Version incompatibility',
      indicators: ['version mismatch', 'incompatible', 'deprecated', 'unsupported'],
      commonEffects: ['feature failures', 'api errors', 'integration issues'],
      typicalFixes: ['version alignment', 'compatibility mode', 'upgrade/downgrade']
    });
  }

  private trainClassifier(): void {
    // Train classifier with cause templates
    this.causeTemplates.forEach((template, id) => {
      // Add indicators as training data
      template.indicators.forEach(indicator => {
        this.classifier.addDocument(indicator, template.type);
        this.tfidf.addDocument(indicator);
      });
      
      // Add description
      this.classifier.addDocument(template.description, template.type);
      
      // Add common effects
      template.commonEffects.forEach(effect => {
        this.classifier.addDocument(effect, template.type);
      });
    });
    
    this.classifier.train();
  }

  async analyze(finding: Finding, context: AnalysisContext): Promise<RootCauseAnalysis> {
    logger.info('Starting root cause analysis', { 
      findingId: finding.id, 
      systemId: context.systemId 
    });
    
    // Gather evidence
    const evidence = await this.gatherEvidence(finding, context);
    
    // Identify potential causes
    const potentialCauses = this.identifyPotentialCauses(finding, evidence);
    
    // Build causal graph
    const causalGraph = this.buildCausalGraph(potentialCauses, evidence);
    
    // Determine primary cause
    const primaryCause = this.determinePrimaryCause(causalGraph, potentialCauses);
    
    // Find contributing causes
    const contributingCauses = this.findContributingCauses(
      causalGraph, 
      potentialCauses, 
      primaryCause
    );
    
    // Extract causal chain
    const causalChain = this.extractCausalChain(causalGraph, primaryCause);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations({
      id: `rca-${Date.now()}`,
      findingId: finding.id,
      systemId: context.systemId,
      timestamp: new Date(),
      primaryCause,
      contributingCauses,
      causalChain,
      confidence: this.calculateConfidence(evidence, potentialCauses),
      evidence,
      recommendations: []
    });
    
    const analysis: RootCauseAnalysis = {
      id: `rca-${Date.now()}`,
      findingId: finding.id,
      systemId: context.systemId,
      timestamp: new Date(),
      primaryCause,
      contributingCauses,
      causalChain,
      confidence: this.calculateConfidence(evidence, potentialCauses),
      evidence,
      recommendations
    };
    
    this.emit('analysisComplete', analysis);
    return analysis;
  }

  private async gatherEvidence(
    finding: Finding, 
    context: AnalysisContext
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    
    // Add finding details as evidence
    evidence.push({
      type: EvidenceType.METRIC,
      description: finding.description,
      source: 'diagnostic_finding',
      timestamp: finding.detectedAt,
      relevance: 1.0,
      data: finding
    });
    
    // Analyze error messages and logs
    if (finding.details?.errorMessage) {
      const nlpAnalysis = this.analyzeErrorMessage(finding.details.errorMessage);
      evidence.push({
        type: EvidenceType.LOG,
        description: `Error analysis: ${nlpAnalysis.summary}`,
        source: 'error_analysis',
        timestamp: finding.detectedAt,
        relevance: 0.9,
        data: nlpAnalysis
      });
    }
    
    // Add metric anomalies as evidence
    if (finding.details?.metrics) {
      Object.entries(finding.details.metrics).forEach(([metric, value]) => {
        if (this.isAnomalousValue(metric, value as number)) {
          evidence.push({
            type: EvidenceType.METRIC,
            description: `Anomalous ${metric}: ${value}`,
            source: 'metric_analysis',
            timestamp: finding.detectedAt,
            relevance: 0.8,
            data: { metric, value }
          });
        }
      });
    }
    
    // Add related events
    if (context.includeEvents && finding.details?.relatedEvents) {
      (finding.details.relatedEvents as Event[]).forEach(event => {
        evidence.push({
          type: EvidenceType.EVENT,
          description: event.description,
          source: event.source,
          timestamp: event.timestamp,
          relevance: this.calculateEventRelevance(event, finding),
          data: event
        });
      });
    }
    
    // Add configuration changes
    if (finding.details?.configChanges) {
      evidence.push({
        type: EvidenceType.CONFIGURATION,
        description: 'Recent configuration changes detected',
        source: 'config_audit',
        timestamp: finding.detectedAt,
        relevance: 0.85,
        data: finding.details.configChanges
      });
    }
    
    // Add correlations
    const correlations = this.findCorrelations(finding, context);
    correlations.forEach(correlation => {
      evidence.push({
        type: EvidenceType.CORRELATION,
        description: `Correlated with ${correlation.description}`,
        source: 'correlation_analysis',
        timestamp: finding.detectedAt,
        relevance: correlation.strength,
        data: correlation
      });
    });
    
    return evidence;
  }

  private analyzeErrorMessage(errorMessage: string): {
    summary: string;
    keywords: string[];
    causeHints: string[];
    severity: string;
  } {
    // Extract key information using NLP
    const doc = compromise(errorMessage);
    
    // Extract key terms
    const nouns = doc.nouns().out('array');
    const verbs = doc.verbs().out('array');
    
    // Classify error type
    const classification = this.classifier.classify(errorMessage);
    
    // Extract cause hints
    const causeHints: string[] = [];
    this.causeTemplates.forEach(template => {
      const matchCount = template.indicators.filter(indicator => 
        errorMessage.toLowerCase().includes(indicator.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        causeHints.push(template.description);
      }
    });
    
    // Determine severity
    const severityKeywords = {
      critical: ['fatal', 'crash', 'corruption', 'loss'],
      high: ['error', 'failed', 'exception', 'timeout'],
      medium: ['warning', 'slow', 'degraded', 'retry'],
      low: ['info', 'notice', 'debug']
    };
    
    let severity = 'medium';
    for (const [level, keywords] of Object.entries(severityKeywords)) {
      if (keywords.some(kw => errorMessage.toLowerCase().includes(kw))) {
        severity = level;
        break;
      }
    }
    
    return {
      summary: `${classification} error detected`,
      keywords: [...nouns, ...verbs].slice(0, 10),
      causeHints,
      severity
    };
  }

  private isAnomalousValue(metric: string, value: number): boolean {
    // Define thresholds for common metrics
    const thresholds: Record<string, { min: number; max: number }> = {
      cpu_usage: { min: 0, max: 0.9 },
      memory_usage: { min: 0, max: 0.85 },
      error_rate: { min: 0, max: 0.05 },
      response_time: { min: 0, max: 1000 },
      disk_usage: { min: 0, max: 0.9 }
    };
    
    const threshold = thresholds[metric];
    if (!threshold) return false;
    
    return value < threshold.min || value > threshold.max;
  }

  private calculateEventRelevance(event: Event, finding: Finding): number {
    // Time proximity
    const timeDiff = Math.abs(event.timestamp.getTime() - finding.detectedAt.getTime());
    const timeScore = Math.max(0, 1 - timeDiff / (60 * 60 * 1000)); // 1 hour window
    
    // Severity match
    const severityScore = event.severity === finding.severity ? 1 : 0.5;
    
    // Text similarity
    const eventText = `${event.type} ${event.description}`.toLowerCase();
    const findingText = `${finding.title} ${finding.description}`.toLowerCase();
    const similarityScore = this.calculateTextSimilarity(eventText, findingText);
    
    return (timeScore + severityScore + similarityScore) / 3;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private findCorrelations(finding: Finding, context: AnalysisContext): Array<{
    description: string;
    strength: number;
    type: string;
  }> {
    const correlations: Array<{ description: string; strength: number; type: string }> = [];
    
    // Time-based correlations
    if (finding.detectedAt.getHours() >= 0 && finding.detectedAt.getHours() < 6) {
      correlations.push({
        description: 'Occurred during off-peak hours',
        strength: 0.6,
        type: 'temporal'
      });
    }
    
    // Pattern-based correlations
    if (finding.ruleId.includes('performance') && finding.details?.metrics?.cpu_usage as number > 0.8) {
      correlations.push({
        description: 'High CPU usage during performance issue',
        strength: 0.85,
        type: 'metric'
      });
    }
    
    // Category correlations
    if (finding.category === 'security' && finding.details?.source?.includes('external')) {
      correlations.push({
        description: 'Security issue from external source',
        strength: 0.9,
        type: 'category'
      });
    }
    
    return correlations;
  }

  private identifyPotentialCauses(finding: Finding, evidence: Evidence[]): Cause[] {
    const causes: Cause[] = [];
    const causeScores = new Map<string, number>();
    
    // Analyze evidence to score potential causes
    evidence.forEach(ev => {
      this.causeTemplates.forEach((template, id) => {
        let score = causeScores.get(id) || 0;
        
        // Check if evidence matches indicators
        const text = `${ev.description} ${JSON.stringify(ev.data)}`.toLowerCase();
        template.indicators.forEach(indicator => {
          if (text.includes(indicator.toLowerCase())) {
            score += ev.relevance * 0.5;
          }
        });
        
        // Check if evidence type matches cause type
        if (this.evidenceMatchesCauseType(ev.type, template.type)) {
          score += ev.relevance * 0.3;
        }
        
        causeScores.set(id, score);
      });
    });
    
    // Convert scores to causes
    causeScores.forEach((score, templateId) => {
      if (score > 0.3) { // Threshold for considering a cause
        const template = this.causeTemplates.get(templateId)!;
        causes.push({
          id: `cause-${templateId}-${Date.now()}`,
          type: template.type,
          description: template.description,
          probability: Math.min(score, 1),
          impact: this.assessCauseImpact(template, finding),
          category: template.category,
          metadata: {
            templateId,
            matchScore: score,
            indicators: template.indicators
          }
        });
      }
    });
    
    // Sort by probability
    causes.sort((a, b) => b.probability - a.probability);
    
    return causes;
  }

  private evidenceMatchesCauseType(evidenceType: EvidenceType, causeType: CauseType): boolean {
    const mapping: Record<EvidenceType, CauseType[]> = {
      [EvidenceType.METRIC]: [CauseType.RESOURCE, CauseType.WORKLOAD, CauseType.HARDWARE],
      [EvidenceType.LOG]: [CauseType.SOFTWARE, CauseType.DEPENDENCY, CauseType.CONFIGURATION],
      [EvidenceType.EVENT]: [CauseType.ENVIRONMENTAL, CauseType.HUMAN, CauseType.DEPENDENCY],
      [EvidenceType.CONFIGURATION]: [CauseType.CONFIGURATION, CauseType.HUMAN],
      [EvidenceType.CORRELATION]: [CauseType.DEPENDENCY, CauseType.WORKLOAD]
    };
    
    return mapping[evidenceType]?.includes(causeType) || false;
  }

  private assessCauseImpact(template: CauseTemplate, finding: Finding): ImpactLevel {
    // Base impact on finding severity
    const severityImpact = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };
    
    let impactScore = severityImpact[finding.severity] || 2;
    
    // Adjust based on cause type
    const typeMultiplier = {
      [CauseType.SECURITY]: 1.5,
      [CauseType.SOFTWARE]: 1.3,
      [CauseType.DEPENDENCY]: 1.2,
      [CauseType.RESOURCE]: 1.1,
      [CauseType.CONFIGURATION]: 1.0,
      [CauseType.WORKLOAD]: 0.9,
      [CauseType.ENVIRONMENTAL]: 0.8,
      [CauseType.HUMAN]: 0.7,
      [CauseType.HARDWARE]: 1.4
    };
    
    impactScore *= typeMultiplier[template.type] || 1;
    
    if (impactScore >= 4) return ImpactLevel.CRITICAL;
    if (impactScore >= 3) return ImpactLevel.HIGH;
    if (impactScore >= 2) return ImpactLevel.MEDIUM;
    return ImpactLevel.LOW;
  }

  private buildCausalGraph(causes: Cause[], evidence: Evidence[]): Graph {
    const graph = new Graph({ directed: true });
    
    // Add causes as nodes
    causes.forEach(cause => {
      graph.setNode(cause.id, cause);
    });
    
    // Establish relationships based on evidence and domain knowledge
    for (let i = 0; i < causes.length; i++) {
      for (let j = i + 1; j < causes.length; j++) {
        const cause1 = causes[i];
        const cause2 = causes[j];
        
        const relationship = this.determineCausalRelationship(cause1, cause2, evidence);
        if (relationship) {
          if (relationship.direction === 'forward') {
            graph.setEdge(cause1.id, cause2.id, {
              type: relationship.type,
              strength: relationship.strength
            });
          } else {
            graph.setEdge(cause2.id, cause1.id, {
              type: relationship.type,
              strength: relationship.strength
            });
          }
        }
      }
    }
    
    return graph;
  }

  private determineCausalRelationship(
    cause1: Cause, 
    cause2: Cause, 
    evidence: Evidence[]
  ): { type: string; strength: number; direction: 'forward' | 'backward' } | null {
    // Define known causal relationships
    const knownRelationships: Array<{
      from: CauseType;
      to: CauseType;
      type: string;
      strength: number;
    }> = [
      { from: CauseType.WORKLOAD, to: CauseType.RESOURCE, type: 'causes', strength: 0.8 },
      { from: CauseType.RESOURCE, to: CauseType.DEPENDENCY, type: 'causes', strength: 0.7 },
      { from: CauseType.CONFIGURATION, to: CauseType.SOFTWARE, type: 'contributes', strength: 0.6 },
      { from: CauseType.HARDWARE, to: CauseType.RESOURCE, type: 'causes', strength: 0.9 },
      { from: CauseType.ENVIRONMENTAL, to: CauseType.DEPENDENCY, type: 'causes', strength: 0.7 }
    ];
    
    // Check for known relationship
    const known = knownRelationships.find(r => 
      (r.from === cause1.type && r.to === cause2.type) ||
      (r.from === cause2.type && r.to === cause1.type)
    );
    
    if (known) {
      return {
        type: known.type,
        strength: known.strength * ((cause1.probability + cause2.probability) / 2),
        direction: known.from === cause1.type ? 'forward' : 'backward'
      };
    }
    
    // Check temporal relationship in evidence
    const temporalRelation = this.checkTemporalRelationship(cause1, cause2, evidence);
    if (temporalRelation) {
      return temporalRelation;
    }
    
    // Check for correlation
    if (Math.abs(cause1.probability - cause2.probability) < 0.2) {
      return {
        type: 'correlates',
        strength: (cause1.probability + cause2.probability) / 2,
        direction: 'forward'
      };
    }
    
    return null;
  }

  private checkTemporalRelationship(
    cause1: Cause,
    cause2: Cause,
    evidence: Evidence[]
  ): { type: string; strength: number; direction: 'forward' | 'backward' } | null {
    // Find evidence related to each cause
    const evidence1 = evidence.filter(ev => 
      ev.data?.causeId === cause1.id || 
      ev.description.toLowerCase().includes(cause1.category)
    );
    
    const evidence2 = evidence.filter(ev => 
      ev.data?.causeId === cause2.id || 
      ev.description.toLowerCase().includes(cause2.category)
    );
    
    if (evidence1.length === 0 || evidence2.length === 0) {
      return null;
    }
    
    // Compare timestamps
    const avgTime1 = evidence1.reduce((sum, ev) => sum + ev.timestamp.getTime(), 0) / evidence1.length;
    const avgTime2 = evidence2.reduce((sum, ev) => sum + ev.timestamp.getTime(), 0) / evidence2.length;
    
    const timeDiff = Math.abs(avgTime1 - avgTime2);
    
    if (timeDiff > 60000) { // More than 1 minute difference
      return {
        type: 'causes',
        strength: Math.max(0.3, 1 - timeDiff / (3600000)), // Decay over 1 hour
        direction: avgTime1 < avgTime2 ? 'forward' : 'backward'
      };
    }
    
    return null;
  }

  private determinePrimaryCause(graph: Graph, causes: Cause[]): Cause {
    // Calculate centrality scores
    const scores = new Map<string, number>();
    
    causes.forEach(cause => {
      let score = cause.probability * 0.4; // Base score from probability
      
      // In-degree centrality (how many causes lead to this)
      const inEdges = graph.inEdges(cause.id) || [];
      score += inEdges.length * 0.2;
      
      // Out-degree centrality (how many effects this causes)
      const outEdges = graph.outEdges(cause.id) || [];
      score += outEdges.length * 0.1;
      
      // Path centrality (how many paths go through this)
      const pathScore = this.calculatePathCentrality(graph, cause.id);
      score += pathScore * 0.3;
      
      scores.set(cause.id, score);
    });
    
    // Find cause with highest score
    let primaryCause = causes[0];
    let maxScore = 0;
    
    causes.forEach(cause => {
      const score = scores.get(cause.id) || 0;
      if (score > maxScore) {
        maxScore = score;
        primaryCause = cause;
      }
    });
    
    return primaryCause;
  }

  private calculatePathCentrality(graph: Graph, nodeId: string): number {
    const nodes = graph.nodes();
    let pathCount = 0;
    
    // Count paths that include this node
    nodes.forEach(source => {
      if (source === nodeId) return;
      
      nodes.forEach(target => {
        if (target === nodeId || target === source) return;
        
        // Check if there's a path from source to target through nodeId
        if (this.hasPathThrough(graph, source, nodeId, target)) {
          pathCount++;
        }
      });
    });
    
    // Normalize by total possible paths
    const totalPossiblePaths = (nodes.length - 1) * (nodes.length - 2);
    return totalPossiblePaths > 0 ? pathCount / totalPossiblePaths : 0;
  }

  private hasPathThrough(graph: Graph, source: string, through: string, target: string): boolean {
    // Simple DFS to check if path exists
    const visited = new Set<string>();
    
    const dfs = (current: string, destination: string, mustVisit?: string): boolean => {
      if (current === destination) {
        return !mustVisit || visited.has(mustVisit);
      }
      
      visited.add(current);
      
      const neighbors = graph.successors(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor, destination, mustVisit)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    return dfs(source, target, through);
  }

  private findContributingCauses(
    graph: Graph, 
    causes: Cause[], 
    primaryCause: Cause
  ): Cause[] {
    const contributing: Cause[] = [];
    
    // Find causes that lead to the primary cause
    const predecessors = this.getAllPredecessors(graph, primaryCause.id);
    
    causes.forEach(cause => {
      if (cause.id !== primaryCause.id && predecessors.has(cause.id)) {
        contributing.push(cause);
      }
    });
    
    // Sort by probability and impact
    contributing.sort((a, b) => {
      const scoreA = a.probability * (a.impact === ImpactLevel.CRITICAL ? 2 : 1);
      const scoreB = b.probability * (b.impact === ImpactLevel.CRITICAL ? 2 : 1);
      return scoreB - scoreA;
    });
    
    return contributing.slice(0, 5); // Top 5 contributing causes
  }

  private getAllPredecessors(graph: Graph, nodeId: string): Set<string> {
    const predecessors = new Set<string>();
    const visited = new Set<string>();
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const preds = graph.predecessors(currentId) || [];
      preds.forEach(pred => {
        predecessors.add(pred);
        traverse(pred);
      });
    };
    
    traverse(nodeId);
    return predecessors;
  }

  private extractCausalChain(graph: Graph, primaryCause: Cause): CausalRelation[] {
    const relations: CausalRelation[] = [];
    const visited = new Set<string>();
    
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const edges = graph.outEdges(nodeId) || [];
      edges.forEach(edge => {
        const edgeData = graph.edge(edge);
        relations.push({
          from: edge.v,
          to: edge.w,
          type: edgeData.type,
          strength: edgeData.strength
        });
        traverse(edge.w);
      });
    };
    
    // Start from all root nodes
    const roots = graph.nodes().filter(node => 
      (graph.inEdges(node) || []).length === 0
    );
    
    roots.forEach(root => traverse(root));
    
    // If no roots, start from primary cause
    if (roots.length === 0) {
      traverse(primaryCause.id);
    }
    
    return relations;
  }

  private calculateConfidence(evidence: Evidence[], causes: Cause[]): number {
    // Base confidence on evidence quality
    const evidenceScore = evidence.reduce((sum, ev) => sum + ev.relevance, 0) / evidence.length;
    
    // Factor in cause probabilities
    const causeScore = causes.length > 0 
      ? causes.reduce((sum, c) => sum + c.probability, 0) / causes.length 
      : 0;
    
    // Factor in evidence diversity
    const evidenceTypes = new Set(evidence.map(ev => ev.type));
    const diversityScore = evidenceTypes.size / Object.keys(EvidenceType).length;
    
    return (evidenceScore * 0.4 + causeScore * 0.4 + diversityScore * 0.2);
  }

  async generateRecommendations(analysis: RootCauseAnalysis): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Get template-based recommendations
    const primaryTemplate = this.causeTemplates.get(
      analysis.primaryCause.metadata?.templateId
    );
    
    if (primaryTemplate) {
      primaryTemplate.typicalFixes.forEach((fix, index) => {
        recommendations.push({
          id: `rec-primary-${index}`,
          action: fix,
          description: `${fix} to address ${primaryTemplate.description}`,
          priority: index + 1,
          estimatedImpact: analysis.primaryCause.impact,
          estimatedEffort: this.estimateEffort(fix),
          automatable: this.isAutomatable(fix),
          risks: this.identifyRisks(fix),
          prerequisites: this.identifyPrerequisites(fix)
        });
      });
    }
    
    // Add recommendations for contributing causes
    analysis.contributingCauses.slice(0, 3).forEach(cause => {
      const template = this.causeTemplates.get(cause.metadata?.templateId);
      if (template && template.typicalFixes.length > 0) {
        const fix = template.typicalFixes[0];
        recommendations.push({
          id: `rec-contrib-${cause.id}`,
          action: fix,
          description: `${fix} to mitigate ${template.description}`,
          priority: recommendations.length + 1,
          estimatedImpact: cause.impact,
          estimatedEffort: this.estimateEffort(fix),
          automatable: this.isAutomatable(fix),
          risks: this.identifyRisks(fix),
          prerequisites: this.identifyPrerequisites(fix)
        });
      }
    });
    
    // Add preventive recommendations
    recommendations.push(...this.generatePreventiveRecommendations(analysis));
    
    // Sort by priority and impact
    recommendations.sort((a, b) => {
      const impactScore = { 
        critical: 4, 
        high: 3, 
        medium: 2, 
        low: 1 
      };
      const scoreA = (5 - a.priority) * impactScore[a.estimatedImpact];
      const scoreB = (5 - b.priority) * impactScore[b.estimatedImpact];
      return scoreB - scoreA;
    });
    
    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  private estimateEffort(action: string): EffortLevel {
    const effortKeywords = {
      trivial: ['enable', 'disable', 'toggle', 'flag'],
      low: ['increase', 'decrease', 'adjust', 'tune', 'modify'],
      medium: ['implement', 'configure', 'setup', 'deploy'],
      high: ['redesign', 'refactor', 'migrate', 'rebuild'],
      very_high: ['rewrite', 'replace', 'overhaul', 'architect']
    };
    
    const actionLower = action.toLowerCase();
    
    for (const [level, keywords] of Object.entries(effortKeywords)) {
      if (keywords.some(kw => actionLower.includes(kw))) {
        return level as EffortLevel;
      }
    }
    
    return EffortLevel.MEDIUM;
  }

  private isAutomatable(action: string): boolean {
    const automatableKeywords = [
      'increase', 'decrease', 'enable', 'disable', 'restart',
      'scale', 'adjust', 'tune', 'clear', 'reset', 'rollback'
    ];
    
    return automatableKeywords.some(kw => 
      action.toLowerCase().includes(kw)
    );
  }

  private identifyRisks(action: string): string[] {
    const risks: string[] = [];
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('increase') || actionLower.includes('scale')) {
      risks.push('Increased resource costs');
    }
    
    if (actionLower.includes('restart') || actionLower.includes('reset')) {
      risks.push('Temporary service disruption');
    }
    
    if (actionLower.includes('rollback') || actionLower.includes('downgrade')) {
      risks.push('Potential data compatibility issues');
    }
    
    if (actionLower.includes('disable') || actionLower.includes('remove')) {
      risks.push('Feature unavailability');
    }
    
    return risks;
  }

  private identifyPrerequisites(action: string): string[] {
    const prerequisites: string[] = [];
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('backup')) {
      prerequisites.push('Sufficient storage space');
    }
    
    if (actionLower.includes('scale') || actionLower.includes('increase')) {
      prerequisites.push('Available resources or budget');
    }
    
    if (actionLower.includes('deploy') || actionLower.includes('implement')) {
      prerequisites.push('Testing in non-production environment');
    }
    
    if (actionLower.includes('migrate') || actionLower.includes('upgrade')) {
      prerequisites.push('Maintenance window scheduled');
      prerequisites.push('Rollback plan prepared');
    }
    
    return prerequisites;
  }

  private generatePreventiveRecommendations(analysis: RootCauseAnalysis): Recommendation[] {
    const preventive: Recommendation[] = [];
    
    // Based on primary cause type
    switch (analysis.primaryCause.type) {
      case CauseType.RESOURCE:
        preventive.push({
          id: 'prev-resource-monitoring',
          action: 'Implement predictive resource monitoring',
          description: 'Set up alerts for resource usage trends to prevent future exhaustion',
          priority: 5,
          estimatedImpact: ImpactLevel.MEDIUM,
          estimatedEffort: EffortLevel.LOW,
          automatable: true,
          risks: [],
          prerequisites: ['Monitoring infrastructure']
        });
        break;
        
      case CauseType.CONFIGURATION:
        preventive.push({
          id: 'prev-config-validation',
          action: 'Implement configuration validation',
          description: 'Add pre-deployment configuration checks to prevent misconfigurations',
          priority: 5,
          estimatedImpact: ImpactLevel.HIGH,
          estimatedEffort: EffortLevel.MEDIUM,
          automatable: true,
          risks: [],
          prerequisites: ['Configuration schema definition']
        });
        break;
        
      case CauseType.SOFTWARE:
        preventive.push({
          id: 'prev-testing',
          action: 'Enhance testing coverage',
          description: 'Increase unit and integration test coverage to catch bugs earlier',
          priority: 5,
          estimatedImpact: ImpactLevel.HIGH,
          estimatedEffort: EffortLevel.HIGH,
          automatable: false,
          risks: [],
          prerequisites: ['Testing framework', 'CI/CD pipeline']
        });
        break;
    }
    
    return preventive;
  }

  async correlate(events: Event[], timeWindow: number): Promise<CausalRelation[]> {
    const relations: CausalRelation[] = [];
    const correlations: CorrelationResult[] = [];
    
    // Analyze event pairs within time window
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];
        
        const timeDiff = Math.abs(
          event1.timestamp.getTime() - event2.timestamp.getTime()
        );
        
        if (timeDiff <= timeWindow * 60000) { // Convert minutes to milliseconds
          const correlation = this.calculateEventCorrelation(event1, event2);
          
          if (correlation > 0.5) {
            correlations.push({
              event1,
              event2,
              correlation,
              timeDiff,
              relationship: this.inferRelationship(event1, event2, timeDiff)
            });
          }
        }
      }
    }
    
    // Convert correlations to causal relations
    correlations.forEach(corr => {
      relations.push({
        from: corr.event1.id,
        to: corr.event2.id,
        type: corr.relationship,
        strength: corr.correlation
      });
    });
    
    return relations;
  }

  private calculateEventCorrelation(event1: Event, event2: Event): number {
    let correlation = 0;
    
    // Type similarity
    if (event1.type === event2.type) {
      correlation += 0.3;
    }
    
    // Source similarity
    if (event1.source === event2.source) {
      correlation += 0.2;
    }
    
    // Severity similarity
    if (event1.severity === event2.severity) {
      correlation += 0.2;
    }
    
    // Text similarity
    const textSim = this.calculateTextSimilarity(
      event1.description,
      event2.description
    );
    correlation += textSim * 0.3;
    
    return correlation;
  }

  private inferRelationship(
    event1: Event, 
    event2: Event, 
    timeDiff: number
  ): 'causes' | 'contributes' | 'correlates' {
    // If events are very close in time, they correlate
    if (timeDiff < 60000) { // Less than 1 minute
      return 'correlates';
    }
    
    // Check for known causal patterns
    const causalPatterns = [
      { from: 'resource_exhaustion', to: 'service_failure', rel: 'causes' },
      { from: 'configuration_change', to: 'service_restart', rel: 'causes' },
      { from: 'traffic_spike', to: 'performance_degradation', rel: 'causes' },
      { from: 'deployment', to: 'error_spike', rel: 'contributes' }
    ];
    
    const pattern = causalPatterns.find(p => 
      event1.type.includes(p.from) && event2.type.includes(p.to)
    );
    
    if (pattern) {
      return pattern.rel as 'causes' | 'contributes';
    }
    
    // Default to contributes if there's a time ordering
    return event1.timestamp < event2.timestamp ? 'contributes' : 'correlates';
  }
}