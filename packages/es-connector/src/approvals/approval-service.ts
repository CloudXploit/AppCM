import { EventEmitter } from 'eventemitter3';
import winston from 'winston';
import { ESClient } from '../api/es-client';
import {
  ESApproval,
  ESApprover,
  ESApprovalComment,
  ESAttachment,
  ESNotification
} from '../types';

export interface ApprovalOptions {
  title: string;
  description?: string;
  approvers: ApproverConfig[];
  dueDate?: Date;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
  attachments?: ESAttachment[];
  notificationTemplate?: string;
  escalationRules?: EscalationRule[];
  delegationAllowed?: boolean;
  requireAllApprovers?: boolean;
  requireComments?: boolean;
}

export interface ApproverConfig {
  userId?: string;
  role?: string;
  group?: string;
  level?: number;
}

export interface EscalationRule {
  afterHours: number;
  escalateTo: ApproverConfig[];
  notificationTemplate?: string;
}

export interface ApprovalDecision {
  approved: boolean;
  comments?: string;
  attachments?: ESAttachment[];
  delegateTo?: string;
}

export interface ApprovalSearchOptions {
  status?: string;
  approver?: string;
  requester?: string;
  workflowInstanceId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  dueDate?: Date;
  limit?: number;
  offset?: number;
}

export class ESApprovalService extends EventEmitter {
  private client: ESClient;
  private logger: winston.Logger;
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: ESClient, logger?: winston.Logger) {
    super();
    this.client = client;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });
  }

  async createApproval(
    workflowInstanceId: string,
    stepId: string,
    options: ApprovalOptions
  ): Promise<ESApproval> {
    try {
      // Resolve approvers
      const approvers = await this.resolveApprovers(options.approvers);
      
      const approval: Partial<ESApproval> = {
        workflowInstanceId,
        stepId,
        title: options.title,
        description: options.description,
        requester: this.getCurrentUser(),
        approvers: approvers.map(userId => ({
          userId,
          userName: userId, // Would be resolved from user service
          status: 'pending'
        })),
        status: 'pending',
        createdDate: new Date(),
        dueDate: options.dueDate,
        metadata: options.metadata,
        attachments: options.attachments
      };

      const created = await this.client.post<ESApproval>('/approvals', approval);
      
      // Set up escalation if configured
      if (options.escalationRules?.length) {
        this.setupEscalation(created.id, options.escalationRules);
      }

      // Send notifications
      await this.sendApprovalNotifications(created, 'new', options.notificationTemplate);
      
      this.emit('approval:created', created);
      this.logger.info(`Created approval: ${created.title} (${created.id})`);
      
      return created;
    } catch (error) {
      this.logger.error('Failed to create approval:', error);
      throw error;
    }
  }

  async getApproval(approvalId: string): Promise<ESApproval> {
    try {
      const approval = await this.client.get<ESApproval>(`/approvals/${approvalId}`);
      return approval;
    } catch (error) {
      this.logger.error(`Failed to get approval ${approvalId}:`, error);
      throw error;
    }
  }

  async getApprovals(options: ApprovalSearchOptions = {}): Promise<ESApproval[]> {
    try {
      const params = new URLSearchParams();
      
      if (options.status) params.append('status', options.status);
      if (options.approver) params.append('approver', options.approver);
      if (options.requester) params.append('requester', options.requester);
      if (options.workflowInstanceId) params.append('workflowInstanceId', options.workflowInstanceId);
      if (options.createdAfter) params.append('createdAfter', options.createdAfter.toISOString());
      if (options.createdBefore) params.append('createdBefore', options.createdBefore.toISOString());
      if (options.dueDate) params.append('dueDate', options.dueDate.toISOString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());

      const approvals = await this.client.get<ESApproval[]>(`/approvals?${params}`);
      
      return approvals;
    } catch (error) {
      this.logger.error('Failed to get approvals:', error);
      throw error;
    }
  }

  async approve(
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<ESApproval> {
    return this.makeDecision(approvalId, decision);
  }

  async reject(
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<ESApproval> {
    return this.makeDecision(approvalId, { ...decision, approved: false });
  }

  async delegate(
    approvalId: string,
    delegateToUserId: string,
    comments?: string
  ): Promise<ESApproval> {
    try {
      const approval = await this.getApproval(approvalId);
      const currentUser = this.getCurrentUser();
      
      // Find current user's approver entry
      const approverIndex = approval.approvers.findIndex(a => a.userId === currentUser);
      if (approverIndex === -1) {
        throw new Error('Current user is not an approver');
      }

      // Update approver status
      const updated = await this.client.patch<ESApproval>(`/approvals/${approvalId}`, {
        [`approvers.${approverIndex}.status`]: 'delegated',
        [`approvers.${approverIndex}.delegatedTo`]: delegateToUserId,
        [`approvers.${approverIndex}.respondedDate`]: new Date(),
        [`approvers.${approverIndex}.comments`]: comments
      });

      // Add delegated approver
      await this.addApprover(approvalId, delegateToUserId);
      
      // Send notification
      await this.sendDelegationNotification(updated, delegateToUserId);
      
      this.emit('approval:delegated', { approval: updated, delegatedTo: delegateToUserId });
      this.logger.info(`Delegated approval ${approvalId} to ${delegateToUserId}`);
      
      return updated;
    } catch (error) {
      this.logger.error(`Failed to delegate approval ${approvalId}:`, error);
      throw error;
    }
  }

  async addComment(
    approvalId: string,
    comment: string
  ): Promise<ESApprovalComment> {
    try {
      const currentUser = this.getCurrentUser();
      const commentData: Partial<ESApprovalComment> = {
        userId: currentUser,
        userName: currentUser, // Would be resolved
        comment,
        timestamp: new Date(),
        type: 'comment'
      };

      const created = await this.client.post<ESApprovalComment>(
        `/approvals/${approvalId}/comments`,
        commentData
      );
      
      this.emit('approval:comment:added', { approvalId, comment: created });
      
      return created;
    } catch (error) {
      this.logger.error(`Failed to add comment to approval ${approvalId}:`, error);
      throw error;
    }
  }

  async addAttachment(
    approvalId: string,
    file: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<ESAttachment> {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([file], { type: mimeType }), fileName);
      
      const attachment = await this.client.upload(
        `/approvals/${approvalId}/attachments`,
        formData
      );
      
      this.emit('approval:attachment:added', { approvalId, attachment });
      
      return attachment;
    } catch (error) {
      this.logger.error(`Failed to add attachment to approval ${approvalId}:`, error);
      throw error;
    }
  }

  async cancelApproval(approvalId: string, reason?: string): Promise<void> {
    try {
      await this.client.post(`/approvals/${approvalId}/cancel`, { reason });
      
      // Clear escalation timers
      this.clearEscalation(approvalId);
      
      this.emit('approval:cancelled', { approvalId, reason });
      this.logger.info(`Cancelled approval ${approvalId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel approval ${approvalId}:`, error);
      throw error;
    }
  }

  async getMyPendingApprovals(): Promise<ESApproval[]> {
    const currentUser = this.getCurrentUser();
    return this.getApprovals({
      approver: currentUser,
      status: 'pending'
    });
  }

  async getMyApprovalHistory(): Promise<ESApproval[]> {
    const currentUser = this.getCurrentUser();
    return this.getApprovals({
      approver: currentUser,
      status: 'completed,rejected'
    });
  }

  async bulkApprove(
    approvalIds: string[],
    decision: ApprovalDecision
  ): Promise<ESApproval[]> {
    const results: ESApproval[] = [];
    
    for (const approvalId of approvalIds) {
      try {
        const result = await this.approve(approvalId, decision);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to approve ${approvalId}:`, error);
      }
    }
    
    return results;
  }

  private async makeDecision(
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<ESApproval> {
    try {
      const approval = await this.getApproval(approvalId);
      const currentUser = this.getCurrentUser();
      
      // Find current user's approver entry
      const approverIndex = approval.approvers.findIndex(a => a.userId === currentUser);
      if (approverIndex === -1) {
        throw new Error('Current user is not an approver');
      }

      // Check if already responded
      if (approval.approvers[approverIndex].status !== 'pending') {
        throw new Error('Approval already responded to');
      }

      // Update approver decision
      const updated = await this.client.patch<ESApproval>(`/approvals/${approvalId}`, {
        [`approvers.${approverIndex}.status`]: decision.approved ? 'approved' : 'rejected',
        [`approvers.${approverIndex}.respondedDate`]: new Date(),
        [`approvers.${approverIndex}.comments`]: decision.comments
      });

      // Check if approval is complete
      const allResponded = updated.approvers.every(a => a.status !== 'pending');
      if (allResponded) {
        await this.completeApproval(approvalId, updated);
      }

      this.emit('approval:decision', { 
        approval: updated, 
        decision, 
        approver: currentUser 
      });
      
      return updated;
    } catch (error) {
      this.logger.error(`Failed to make decision on approval ${approvalId}:`, error);
      throw error;
    }
  }

  private async completeApproval(
    approvalId: string,
    approval: ESApproval
  ): Promise<void> {
    const approvedCount = approval.approvers.filter(a => a.status === 'approved').length;
    const rejectedCount = approval.approvers.filter(a => a.status === 'rejected').length;
    
    let finalStatus: 'approved' | 'rejected';
    
    // Determine final status based on approval logic
    if (approval.metadata?.requireAllApprovers) {
      finalStatus = rejectedCount > 0 ? 'rejected' : 'approved';
    } else {
      finalStatus = approvedCount > 0 ? 'approved' : 'rejected';
    }

    await this.client.patch(`/approvals/${approvalId}`, {
      status: finalStatus,
      completedDate: new Date()
    });

    // Clear escalation timers
    this.clearEscalation(approvalId);
    
    // Send completion notification
    await this.sendCompletionNotification(approval, finalStatus);
    
    this.emit('approval:completed', { approval, status: finalStatus });
  }

  private async resolveApprovers(configs: ApproverConfig[]): Promise<string[]> {
    const approvers: Set<string> = new Set();
    
    for (const config of configs) {
      if (config.userId) {
        approvers.add(config.userId);
      } else if (config.role) {
        // Would resolve users with role
        const users = await this.client.get<string[]>(`/users?role=${config.role}`);
        users.forEach(u => approvers.add(u));
      } else if (config.group) {
        // Would resolve users in group
        const users = await this.client.get<string[]>(`/groups/${config.group}/members`);
        users.forEach(u => approvers.add(u));
      }
    }
    
    return Array.from(approvers);
  }

  private async addApprover(approvalId: string, userId: string): Promise<void> {
    await this.client.post(`/approvals/${approvalId}/approvers`, {
      userId,
      userName: userId, // Would be resolved
      status: 'pending'
    });
  }

  private setupEscalation(approvalId: string, rules: EscalationRule[]): void {
    for (const rule of rules) {
      const timer = setTimeout(async () => {
        try {
          await this.escalateApproval(approvalId, rule);
        } catch (error) {
          this.logger.error(`Failed to escalate approval ${approvalId}:`, error);
        }
      }, rule.afterHours * 60 * 60 * 1000);
      
      this.escalationTimers.set(`${approvalId}-${rule.afterHours}`, timer);
    }
  }

  private clearEscalation(approvalId: string): void {
    for (const [key, timer] of this.escalationTimers.entries()) {
      if (key.startsWith(approvalId)) {
        clearTimeout(timer);
        this.escalationTimers.delete(key);
      }
    }
  }

  private async escalateApproval(
    approvalId: string,
    rule: EscalationRule
  ): Promise<void> {
    const approval = await this.getApproval(approvalId);
    
    // Only escalate if still pending
    if (approval.status !== 'pending') return;
    
    // Add escalation approvers
    const escalationApprovers = await this.resolveApprovers(rule.escalateTo);
    for (const approver of escalationApprovers) {
      await this.addApprover(approvalId, approver);
    }
    
    // Send escalation notifications
    await this.sendEscalationNotification(approval, escalationApprovers, rule);
    
    this.emit('approval:escalated', { approval, escalatedTo: escalationApprovers });
  }

  private async sendApprovalNotifications(
    approval: ESApproval,
    type: 'new' | 'reminder',
    template?: string
  ): Promise<void> {
    const notifications = approval.approvers.map(approver => ({
      userId: approver.userId,
      type: 'info' as const,
      title: `Approval Required: ${approval.title}`,
      message: approval.description || 'Please review and approve',
      template: template || 'approval-request',
      data: {
        approvalId: approval.id,
        dueDate: approval.dueDate,
        requester: approval.requester
      }
    }));

    await this.client.post('/notifications/bulk', notifications);
  }

  private async sendDelegationNotification(
    approval: ESApproval,
    delegatedTo: string
  ): Promise<void> {
    await this.client.post('/notifications', {
      userId: delegatedTo,
      type: 'info',
      title: `Approval Delegated: ${approval.title}`,
      message: 'You have been delegated an approval request',
      template: 'approval-delegation',
      data: {
        approvalId: approval.id,
        delegatedBy: this.getCurrentUser()
      }
    });
  }

  private async sendCompletionNotification(
    approval: ESApproval,
    status: 'approved' | 'rejected'
  ): Promise<void> {
    await this.client.post('/notifications', {
      userId: approval.requester,
      type: status === 'approved' ? 'success' : 'warning',
      title: `Approval ${status}: ${approval.title}`,
      message: `Your approval request has been ${status}`,
      template: 'approval-complete',
      data: {
        approvalId: approval.id,
        status
      }
    });
  }

  private async sendEscalationNotification(
    approval: ESApproval,
    escalatedTo: string[],
    rule: EscalationRule
  ): Promise<void> {
    const notifications = escalatedTo.map(userId => ({
      userId,
      type: 'warning' as const,
      title: `Escalated Approval: ${approval.title}`,
      message: `This approval has been escalated after ${rule.afterHours} hours`,
      template: rule.notificationTemplate || 'approval-escalation',
      data: {
        approvalId: approval.id,
        escalationReason: 'timeout'
      }
    }));

    await this.client.post('/notifications/bulk', notifications);
  }

  private getCurrentUser(): string {
    const session = this.client.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    return session.userId;
  }
}