import { EventEmitter } from 'events';
import { NeuralNetwork } from 'brain.js';
import * as natural from 'natural';
import _ from 'lodash';
import { 
  LearningSystem,
  LearningCase,
  Resolution,
  ResolutionOutcome,
  UserFeedback,
  Finding,
  RootCauseAnalysis,
  Recommendation
} from '../types';
import { logger } from '@cm-diagnostics/logger';

interface CaseVector {
  findingType: number;
  severity: number;
  category: number;
  causeType: number;
  timeOfDay: number;
  dayOfWeek: number;
  systemLoad: number;
  errorRate: number;
  responseTime: number;
  resolutionSuccess: number;
}

interface ResolutionPattern {
  pattern: string;
  successRate: number;
  avgTimeToResolve: number;
  applications: number;
  conditions: Record<string, any>;
}

interface SimilarityScore {
  caseId: string;
  score: number;
  matchedFeatures: string[];
}

export class AdaptiveLearningSystem extends EventEmitter implements LearningSystem {
  private cases: Map<string, LearningCase> = new Map();
  private resolutionPatterns: Map<string, ResolutionPattern> = new Map();
  private neuralNetwork: NeuralNetwork;
  private tfidf: natural.TfIdf;
  private caseClassifier: natural.BayesClassifier;
  private successThreshold = 0.8;
  private minCasesForPattern = 3;
  
  constructor() {
    super();
    this.neuralNetwork = new NeuralNetwork({
      hiddenLayers: [20, 10],
      activation: 'sigmoid'
    });
    this.tfidf = new natural.TfIdf();
    this.caseClassifier = new natural.BayesClassifier();
  }

  async recordCase(learningCase: LearningCase): Promise<void> {
    // Store the case
    this.cases.set(learningCase.id, learningCase);
    
    // Add to text analysis
    const caseText = this.extractCaseText(learningCase);
    this.tfidf.addDocument(caseText);
    
    // Update classifier
    if (learningCase.outcome.success) {
      this.caseClassifier.addDocument(caseText, 'successful');
    } else {
      this.caseClassifier.addDocument(caseText, 'failed');
    }
    
    // Extract and update patterns
    this.updateResolutionPatterns(learningCase);
    
    // Log the case
    logger.info('Learning case recorded', {
      caseId: learningCase.id,
      findingId: learningCase.finding.id,
      success: learningCase.outcome.success,
      timeToResolution: learningCase.outcome.timeToResolution
    });
    
    // Trigger learning if we have enough cases
    if (this.cases.size % 10 === 0) {
      await this.learn();
    }
    
    this.emit('caseRecorded', learningCase);
  }

  private extractCaseText(learningCase: LearningCase): string {
    const parts = [
      learningCase.finding.title,
      learningCase.finding.description,
      learningCase.finding.category,
      learningCase.finding.severity,
      learningCase.diagnosis.primaryCause.description,
      learningCase.diagnosis.primaryCause.type,
      ...learningCase.resolution.actions.map(a => a.description),
      ...learningCase.diagnosis.recommendations.map(r => r.action)
    ];
    
    return parts.join(' ');
  }

  private updateResolutionPatterns(learningCase: LearningCase): void {
    if (!learningCase.outcome.success) return;
    
    // Create pattern key from resolution actions
    const patternKey = this.createPatternKey(learningCase.resolution);
    
    let pattern = this.resolutionPatterns.get(patternKey);
    if (!pattern) {
      pattern = {
        pattern: patternKey,
        successRate: 0,
        avgTimeToResolve: 0,
        applications: 0,
        conditions: {}
      };
    }
    
    // Update pattern statistics
    pattern.applications++;
    pattern.successRate = ((pattern.successRate * (pattern.applications - 1)) + 1) / pattern.applications;
    pattern.avgTimeToResolve = ((pattern.avgTimeToResolve * (pattern.applications - 1)) + 
      learningCase.outcome.timeToResolution) / pattern.applications;
    
    // Extract conditions where this pattern works
    pattern.conditions = {
      ...pattern.conditions,
      findingTypes: this.addToSet(pattern.conditions.findingTypes, learningCase.finding.ruleId),
      categories: this.addToSet(pattern.conditions.categories, learningCase.finding.category),
      causeTypes: this.addToSet(pattern.conditions.causeTypes, learningCase.diagnosis.primaryCause.type)
    };
    
    this.resolutionPatterns.set(patternKey, pattern);
  }

  private createPatternKey(resolution: Resolution): string {
    const actionTypes = resolution.actions
      .map(a => a.type)
      .sort()
      .join('|');
    
    return `pattern:${actionTypes}`;
  }

  private addToSet(existing: string[] | undefined, value: string): string[] {
    const set = new Set(existing || []);
    set.add(value);
    return Array.from(set);
  }

  async learn(): Promise<void> {
    logger.info('Starting learning process', { cases: this.cases.size });
    
    // Prepare training data
    const trainingData = this.prepareTrainingData();
    
    if (trainingData.length < 10) {
      logger.warn('Insufficient data for learning', { samples: trainingData.length });
      return;
    }
    
    try {
      // Train neural network
      await this.trainNeuralNetwork(trainingData);
      
      // Train classifier
      this.caseClassifier.train();
      
      // Analyze patterns
      this.analyzePatternEffectiveness();
      
      // Update success metrics
      this.updateSuccessMetrics();
      
      this.emit('learningComplete', {
        cases: this.cases.size,
        patterns: this.resolutionPatterns.size
      });
      
      logger.info('Learning process completed');
    } catch (error) {
      logger.error('Learning process failed', { error });
      this.emit('learningFailed', error);
    }
  }

  private prepareTrainingData(): Array<{ input: CaseVector; output: { success: number } }> {
    const trainingData: Array<{ input: CaseVector; output: { success: number } }> = [];
    
    this.cases.forEach(learningCase => {
      const vector = this.createCaseVector(learningCase);
      trainingData.push({
        input: vector,
        output: { success: learningCase.outcome.success ? 1 : 0 }
      });
    });
    
    return trainingData;
  }

  private createCaseVector(learningCase: LearningCase): CaseVector {
    // Encode categorical features
    const findingTypes = ['performance', 'security', 'configuration', 'availability'];
    const severities = ['low', 'medium', 'high', 'critical'];
    const categories = ['performance', 'security', 'configuration', 'compliance', 'availability'];
    const causeTypes = ['configuration', 'resource', 'workload', 'dependency', 'environmental', 'human', 'hardware', 'software'];
    
    return {
      findingType: findingTypes.indexOf(learningCase.finding.category) / findingTypes.length,
      severity: severities.indexOf(learningCase.finding.severity) / severities.length,
      category: categories.indexOf(learningCase.finding.category) / categories.length,
      causeType: causeTypes.indexOf(learningCase.diagnosis.primaryCause.type) / causeTypes.length,
      timeOfDay: learningCase.timestamp.getHours() / 24,
      dayOfWeek: learningCase.timestamp.getDay() / 7,
      systemLoad: learningCase.finding.details?.metrics?.cpu_usage || 0,
      errorRate: learningCase.finding.details?.metrics?.error_rate || 0,
      responseTime: Math.min(learningCase.finding.details?.metrics?.response_time || 0, 5000) / 5000,
      resolutionSuccess: learningCase.outcome.success ? 1 : 0
    };
  }

  private async trainNeuralNetwork(trainingData: Array<{ input: CaseVector; output: { success: number } }>): Promise<void> {
    // Convert to format expected by brain.js
    const formattedData = trainingData.map(item => ({
      input: Object.values(item.input),
      output: [item.output.success]
    }));
    
    // Train the network
    const stats = await this.neuralNetwork.trainAsync(formattedData, {
      iterations: 20000,
      errorThresh: 0.005,
      log: false,
      logPeriod: 1000,
      learningRate: 0.3
    });
    
    logger.debug('Neural network training completed', { 
      error: stats.error, 
      iterations: stats.iterations 
    });
  }

  private analyzePatternEffectiveness(): void {
    // Identify highly effective patterns
    const effectivePatterns: ResolutionPattern[] = [];
    
    this.resolutionPatterns.forEach(pattern => {
      if (pattern.successRate >= this.successThreshold && 
          pattern.applications >= this.minCasesForPattern) {
        effectivePatterns.push(pattern);
      }
    });
    
    // Sort by effectiveness
    effectivePatterns.sort((a, b) => {
      const scoreA = a.successRate * Math.log(a.applications + 1);
      const scoreB = b.successRate * Math.log(b.applications + 1);
      return scoreB - scoreA;
    });
    
    logger.info('Effective patterns identified', { 
      count: effectivePatterns.length,
      topPattern: effectivePatterns[0]?.pattern
    });
  }

  private updateSuccessMetrics(): void {
    let totalCases = 0;
    let successfulCases = 0;
    let totalResolutionTime = 0;
    let recurrenceCases = 0;
    
    this.cases.forEach(learningCase => {
      totalCases++;
      if (learningCase.outcome.success) {
        successfulCases++;
        totalResolutionTime += learningCase.outcome.timeToResolution;
        
        if (learningCase.outcome.recurrence?.occurred) {
          recurrenceCases++;
        }
      }
    });
    
    const metrics = {
      successRate: totalCases > 0 ? successfulCases / totalCases : 0,
      avgResolutionTime: successfulCases > 0 ? totalResolutionTime / successfulCases : 0,
      recurrenceRate: successfulCases > 0 ? recurrenceCases / successfulCases : 0
    };
    
    logger.info('Success metrics updated', metrics);
    this.emit('metricsUpdated', metrics);
  }

  async getSimilarCases(finding: Finding, limit: number = 5): Promise<LearningCase[]> {
    const similarities: SimilarityScore[] = [];
    
    // Create finding text for comparison
    const findingText = `${finding.title} ${finding.description} ${finding.category} ${finding.severity}`;
    
    // Calculate similarity for each case
    this.cases.forEach((learningCase, caseId) => {
      const score = this.calculateSimilarity(finding, learningCase);
      similarities.push({
        caseId,
        score,
        matchedFeatures: this.getMatchedFeatures(finding, learningCase)
      });
    });
    
    // Sort by similarity score
    similarities.sort((a, b) => b.score - a.score);
    
    // Get top similar cases
    const topSimilar = similarities.slice(0, limit);
    const similarCases = topSimilar
      .map(s => this.cases.get(s.caseId))
      .filter(c => c !== undefined) as LearningCase[];
    
    logger.debug('Similar cases found', { 
      findingId: finding.id, 
      similarCount: similarCases.length,
      topScore: topSimilar[0]?.score
    });
    
    return similarCases;
  }

  private calculateSimilarity(finding: Finding, learningCase: LearningCase): number {
    let score = 0;
    const weights = {
      category: 0.3,
      severity: 0.2,
      ruleId: 0.2,
      textSimilarity: 0.2,
      metricSimilarity: 0.1
    };
    
    // Category match
    if (finding.category === learningCase.finding.category) {
      score += weights.category;
    }
    
    // Severity match
    if (finding.severity === learningCase.finding.severity) {
      score += weights.severity;
    }
    
    // Rule ID match
    if (finding.ruleId === learningCase.finding.ruleId) {
      score += weights.ruleId;
    }
    
    // Text similarity
    const textSim = this.calculateTextSimilarity(
      `${finding.title} ${finding.description}`,
      `${learningCase.finding.title} ${learningCase.finding.description}`
    );
    score += textSim * weights.textSimilarity;
    
    // Metric similarity
    const metricSim = this.calculateMetricSimilarity(
      finding.details?.metrics || {},
      learningCase.finding.details?.metrics || {}
    );
    score += metricSim * weights.metricSimilarity;
    
    return score;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Use TF-IDF for text similarity
    const tfidf = new natural.TfIdf();
    tfidf.addDocument(text1);
    tfidf.addDocument(text2);
    
    const terms1 = new Set<string>();
    const terms2 = new Set<string>();
    
    tfidf.listTerms(0).forEach(item => terms1.add(item.term));
    tfidf.listTerms(1).forEach(item => terms2.add(item.term));
    
    const intersection = new Set([...terms1].filter(x => terms2.has(x)));
    const union = new Set([...terms1, ...terms2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateMetricSimilarity(metrics1: any, metrics2: any): number {
    const keys1 = Object.keys(metrics1);
    const keys2 = Object.keys(metrics2);
    const commonKeys = keys1.filter(k => keys2.includes(k));
    
    if (commonKeys.length === 0) return 0;
    
    let totalDiff = 0;
    commonKeys.forEach(key => {
      const v1 = metrics1[key];
      const v2 = metrics2[key];
      
      if (typeof v1 === 'number' && typeof v2 === 'number') {
        const diff = Math.abs(v1 - v2) / Math.max(Math.abs(v1), Math.abs(v2), 1);
        totalDiff += 1 - Math.min(diff, 1);
      }
    });
    
    return totalDiff / commonKeys.length;
  }

  private getMatchedFeatures(finding: Finding, learningCase: LearningCase): string[] {
    const features: string[] = [];
    
    if (finding.category === learningCase.finding.category) {
      features.push('category');
    }
    
    if (finding.severity === learningCase.finding.severity) {
      features.push('severity');
    }
    
    if (finding.ruleId === learningCase.finding.ruleId) {
      features.push('rule');
    }
    
    const textSim = this.calculateTextSimilarity(
      finding.description,
      learningCase.finding.description
    );
    if (textSim > 0.5) {
      features.push('description');
    }
    
    return features;
  }

  async getRecommendedResolution(finding: Finding): Promise<Resolution | null> {
    // Get similar cases
    const similarCases = await this.getSimilarCases(finding, 10);
    
    if (similarCases.length === 0) {
      logger.debug('No similar cases found for resolution recommendation');
      return null;
    }
    
    // Filter successful cases
    const successfulCases = similarCases.filter(c => c.outcome.success);
    
    if (successfulCases.length === 0) {
      logger.debug('No successful similar cases found');
      return null;
    }
    
    // Analyze resolution patterns from successful cases
    const resolutionScores = new Map<string, {
      resolution: Resolution;
      score: number;
      count: number;
    }>();
    
    successfulCases.forEach(successCase => {
      const patternKey = this.createPatternKey(successCase.resolution);
      const existing = resolutionScores.get(patternKey);
      
      if (existing) {
        existing.count++;
        existing.score += this.calculateResolutionScore(successCase);
      } else {
        resolutionScores.set(patternKey, {
          resolution: successCase.resolution,
          score: this.calculateResolutionScore(successCase),
          count: 1
        });
      }
    });
    
    // Find best resolution pattern
    let bestPattern: { resolution: Resolution; score: number } | null = null;
    let maxScore = 0;
    
    resolutionScores.forEach(({ resolution, score, count }) => {
      const avgScore = score / count;
      const weightedScore = avgScore * Math.log(count + 1); // Favor patterns used multiple times
      
      if (weightedScore > maxScore) {
        maxScore = weightedScore;
        bestPattern = { resolution, score: avgScore };
      }
    });
    
    if (!bestPattern) {
      return null;
    }
    
    // Predict success probability
    const successProbability = this.predictSuccessProbability(finding, bestPattern.resolution);
    
    // Only recommend if probability is high enough
    if (successProbability < 0.7) {
      logger.debug('Resolution success probability too low', { 
        probability: successProbability 
      });
      return null;
    }
    
    // Create recommended resolution
    const recommendedResolution: Resolution = {
      ...bestPattern.resolution,
      id: `rec-${Date.now()}`,
      appliedAt: new Date(),
      appliedBy: 'learning-system',
      automated: false
    };
    
    logger.info('Resolution recommended', {
      findingId: finding.id,
      patternKey: this.createPatternKey(recommendedResolution),
      successProbability,
      basedOnCases: successfulCases.length
    });
    
    return recommendedResolution;
  }

  private calculateResolutionScore(learningCase: LearningCase): number {
    let score = 0;
    
    // Base score on success
    if (learningCase.outcome.success) {
      score += 1;
    }
    
    // Factor in resolution time (faster is better)
    const timeScore = Math.max(0, 1 - learningCase.outcome.timeToResolution / (24 * 60));
    score += timeScore * 0.3;
    
    // Factor in improvement metrics
    const improvement = this.calculateImprovement(learningCase.outcome.metrics);
    score += improvement * 0.3;
    
    // Factor in non-recurrence
    if (!learningCase.outcome.recurrence?.occurred) {
      score += 0.2;
    }
    
    // Factor in user feedback
    if (learningCase.feedback) {
      score += (learningCase.feedback.rating / 5) * 0.2;
    }
    
    return score;
  }

  private calculateImprovement(metrics: ResolutionOutcome['metrics']): number {
    const improvements: number[] = [];
    
    Object.keys(metrics.improvement).forEach(key => {
      const before = metrics.before[key];
      const after = metrics.after[key];
      
      if (typeof before === 'number' && typeof after === 'number' && before !== 0) {
        const improvementPct = (before - after) / Math.abs(before);
        improvements.push(Math.max(0, Math.min(1, improvementPct)));
      }
    });
    
    return improvements.length > 0 
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length 
      : 0;
  }

  private predictSuccessProbability(finding: Finding, resolution: Resolution): number {
    // Use neural network if we have enough training data
    if (this.cases.size >= 50) {
      const mockCase: LearningCase = {
        id: 'prediction',
        timestamp: new Date(),
        systemId: finding.systemId,
        finding,
        diagnosis: {
          id: 'mock',
          findingId: finding.id,
          systemId: finding.systemId,
          timestamp: new Date(),
          primaryCause: {
            id: 'mock',
            type: 'unknown' as any,
            description: 'Mock cause',
            probability: 0.5,
            impact: 'medium' as any,
            category: 'mock'
          },
          contributingCauses: [],
          causalChain: [],
          confidence: 0.5,
          evidence: [],
          recommendations: []
        },
        resolution,
        outcome: {
          success: true,
          metrics: { before: {}, after: {}, improvement: {} },
          timeToResolution: 0
        }
      };
      
      const vector = this.createCaseVector(mockCase);
      const prediction = this.neuralNetwork.run(Object.values(vector));
      
      return Array.isArray(prediction) ? prediction[0] : prediction;
    }
    
    // Fallback to pattern matching
    const patternKey = this.createPatternKey(resolution);
    const pattern = this.resolutionPatterns.get(patternKey);
    
    if (pattern && pattern.applications >= this.minCasesForPattern) {
      return pattern.successRate;
    }
    
    // Default probability based on similar findings
    const similarCases = Array.from(this.cases.values()).filter(c => 
      c.finding.category === finding.category &&
      c.finding.severity === finding.severity
    );
    
    if (similarCases.length > 0) {
      const successCount = similarCases.filter(c => c.outcome.success).length;
      return successCount / similarCases.length;
    }
    
    return 0.5; // No information, assume 50/50
  }

  async provideFeedback(caseId: string, feedback: UserFeedback): Promise<void> {
    const learningCase = this.cases.get(caseId);
    
    if (!learningCase) {
      throw new Error(`Learning case ${caseId} not found`);
    }
    
    // Update case with feedback
    learningCase.feedback = feedback;
    this.cases.set(caseId, learningCase);
    
    // Update pattern scores based on feedback
    const patternKey = this.createPatternKey(learningCase.resolution);
    const pattern = this.resolutionPatterns.get(patternKey);
    
    if (pattern) {
      // Adjust success rate based on feedback
      const feedbackScore = feedback.helpful ? feedback.rating / 5 : 0;
      pattern.successRate = (pattern.successRate * 0.8) + (feedbackScore * 0.2);
      this.resolutionPatterns.set(patternKey, pattern);
    }
    
    // Log feedback
    logger.info('User feedback received', {
      caseId,
      rating: feedback.rating,
      helpful: feedback.helpful
    });
    
    // Retrain if we have significant feedback
    const feedbackCount = Array.from(this.cases.values())
      .filter(c => c.feedback !== undefined).length;
    
    if (feedbackCount % 5 === 0) {
      await this.learn();
    }
    
    this.emit('feedbackReceived', { caseId, feedback });
  }

  // Helper methods for analysis
  getPatternStatistics(): Array<{
    pattern: string;
    successRate: number;
    applications: number;
    avgTimeToResolve: number;
  }> {
    return Array.from(this.resolutionPatterns.values())
      .filter(p => p.applications >= this.minCasesForPattern)
      .sort((a, b) => b.successRate - a.successRate)
      .map(p => ({
        pattern: p.pattern,
        successRate: p.successRate,
        applications: p.applications,
        avgTimeToResolve: p.avgTimeToResolve
      }));
  }

  getCaseStatistics(): {
    totalCases: number;
    successfulCases: number;
    avgResolutionTime: number;
    mostCommonCauses: Array<{ type: string; count: number }>;
    feedbackStats: {
      avgRating: number;
      helpfulPercentage: number;
    };
  } {
    let successCount = 0;
    let totalResolutionTime = 0;
    const causeTypes = new Map<string, number>();
    let totalRating = 0;
    let helpfulCount = 0;
    let feedbackCount = 0;
    
    this.cases.forEach(learningCase => {
      if (learningCase.outcome.success) {
        successCount++;
        totalResolutionTime += learningCase.outcome.timeToResolution;
      }
      
      // Count cause types
      const causeType = learningCase.diagnosis.primaryCause.type;
      causeTypes.set(causeType, (causeTypes.get(causeType) || 0) + 1);
      
      // Feedback stats
      if (learningCase.feedback) {
        feedbackCount++;
        totalRating += learningCase.feedback.rating;
        if (learningCase.feedback.helpful) {
          helpfulCount++;
        }
      }
    });
    
    // Sort causes by frequency
    const sortedCauses = Array.from(causeTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
    
    return {
      totalCases: this.cases.size,
      successfulCases: successCount,
      avgResolutionTime: successCount > 0 ? totalResolutionTime / successCount : 0,
      mostCommonCauses: sortedCauses,
      feedbackStats: {
        avgRating: feedbackCount > 0 ? totalRating / feedbackCount : 0,
        helpfulPercentage: feedbackCount > 0 ? (helpfulCount / feedbackCount) * 100 : 0
      }
    };
  }
}