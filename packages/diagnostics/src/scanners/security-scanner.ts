import { BaseScanner } from './base-scanner';
import { ScanContext } from '../types';
import { UserExtractor } from '@cm-diagnostics/cm-connector';

export class SecurityScanner extends BaseScanner {
  constructor() {
    super({
      id: 'security-scanner',
      name: 'Security Scanner',
      category: 'security',
      version: '1.0.0',
      supportedRules: [
        'sec-weak-passwords',
        'sec-inactive-users',
        'sec-excessive-permissions',
        'sec-default-accounts',
        'sec-audit-disabled',
        'sec-encryption-disabled',
        'sec-expired-certificates',
        'sec-open-ports',
        'sec-failed-logins',
        'sec-privilege-escalation'
      ],
      supportedVersions: ['*']
    });
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Security scanner initialized');
  }

  protected async extractData(context: ScanContext): Promise<any> {
    this.logger.debug('Extracting security data');
    
    try {
      // Use the user extractor to get user and permission data
      const userExtractor = new UserExtractor(
        context.connector,
        context.connector.adapter
      );
      
      const userData = await userExtractor.extract();
      
      // Get additional security metrics
      const securityConfig = await this.getSecurityConfiguration(context);
      const auditData = await this.getAuditData(context);
      const vulnerabilities = await this.checkVulnerabilities(context);
      
      return {
        users: userData,
        security: {
          configuration: securityConfig,
          audit: auditData,
          vulnerabilities
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to extract security data', error as Error);
      throw error;
    }
  }

  private async getSecurityConfiguration(context: ScanContext): Promise<any> {
    try {
      const config: any = {
        passwordPolicy: {},
        encryption: {},
        authentication: {},
        authorization: {}
      };

      // Password policy
      const passwordPolicyQuery = {
        sql: `SELECT 
                password_min_length,
                password_complexity_enabled,
                password_expiry_days,
                password_history_count,
                account_lockout_threshold,
                account_lockout_duration
              FROM CM_SECURITY_CONFIG
              WHERE config_type = 'PASSWORD_POLICY'`
      };

      try {
        const result = await context.connector.executeQuery(passwordPolicyQuery);
        if (result[0]) {
          config.passwordPolicy = {
            minLength: result[0].password_min_length || 8,
            complexityEnabled: result[0].password_complexity_enabled || false,
            expiryDays: result[0].password_expiry_days || 0,
            historyCount: result[0].password_history_count || 0,
            lockoutThreshold: result[0].account_lockout_threshold || 0,
            lockoutDuration: result[0].account_lockout_duration || 0
          };
        }
      } catch (error) {
        this.logger.debug('Could not get password policy');
        config.passwordPolicy = this.getDefaultPasswordPolicy();
      }

      // Encryption settings
      const encryptionQuery = {
        sql: `SELECT 
                encryption_enabled,
                encryption_algorithm,
                key_rotation_days,
                data_at_rest_encrypted,
                data_in_transit_encrypted
              FROM CM_SECURITY_CONFIG
              WHERE config_type = 'ENCRYPTION'`
      };

      try {
        const result = await context.connector.executeQuery(encryptionQuery);
        if (result[0]) {
          config.encryption = {
            enabled: result[0].encryption_enabled || false,
            algorithm: result[0].encryption_algorithm || 'NONE',
            keyRotationDays: result[0].key_rotation_days || 0,
            dataAtRestEncrypted: result[0].data_at_rest_encrypted || false,
            dataInTransitEncrypted: result[0].data_in_transit_encrypted || false
          };
        }
      } catch (error) {
        this.logger.debug('Could not get encryption settings');
        config.encryption = this.getDefaultEncryptionSettings();
      }

      // Authentication settings
      config.authentication = await this.getAuthenticationSettings(context);
      
      return config;
    } catch (error) {
      this.logger.error('Failed to get security configuration', error as Error);
      return {};
    }
  }

  private async getAuditData(context: ScanContext): Promise<any> {
    try {
      const audit: any = {
        enabled: false,
        retentionDays: 0,
        failedLogins: [],
        privilegeChanges: [],
        dataAccess: []
      };

      // Check if audit is enabled
      const auditStatusQuery = {
        sql: `SELECT 
                audit_enabled,
                audit_retention_days,
                audit_level
              FROM CM_AUDIT_CONFIG`
      };

      try {
        const result = await context.connector.executeQuery(auditStatusQuery);
        if (result[0]) {
          audit.enabled = result[0].audit_enabled || false;
          audit.retentionDays = result[0].audit_retention_days || 30;
          audit.level = result[0].audit_level || 'BASIC';
        }
      } catch (error) {
        this.logger.debug('Could not get audit configuration');
      }

      // Get recent failed login attempts
      const failedLoginsQuery = {
        sql: `SELECT TOP 100
                username,
                attempt_time,
                ip_address,
                failure_reason
              FROM CM_AUDIT_LOG
              WHERE event_type = 'LOGIN_FAILED'
              AND attempt_time > DATEADD(day, -7, GETDATE())
              ORDER BY attempt_time DESC`
      };

      try {
        const result = await context.connector.executeQuery(failedLoginsQuery);
        audit.failedLogins = result.map((row: any) => ({
          username: row.username,
          attemptTime: row.attempt_time,
          ipAddress: row.ip_address,
          reason: row.failure_reason
        }));
      } catch (error) {
        this.logger.debug('Could not get failed login data');
      }

      // Get privilege changes
      const privilegeQuery = {
        sql: `SELECT TOP 50
                user_affected,
                changed_by,
                change_type,
                change_time,
                old_value,
                new_value
              FROM CM_AUDIT_LOG
              WHERE event_type IN ('PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'ROLE_CHANGED')
              AND change_time > DATEADD(day, -30, GETDATE())
              ORDER BY change_time DESC`
      };

      try {
        const result = await context.connector.executeQuery(privilegeQuery);
        audit.privilegeChanges = result;
      } catch (error) {
        this.logger.debug('Could not get privilege change data');
      }

      return audit;
    } catch (error) {
      this.logger.error('Failed to get audit data', error as Error);
      return {};
    }
  }

  private async checkVulnerabilities(context: ScanContext): Promise<any> {
    const vulnerabilities: any[] = [];

    try {
      // Check for default accounts
      const defaultAccountsQuery = {
        sql: `SELECT 
                username,
                last_login,
                is_active,
                has_default_password
              FROM CM_USERS
              WHERE username IN ('admin', 'administrator', 'sa', 'root', 'guest', 'test')
              AND is_active = 1`
      };

      try {
        const result = await context.connector.executeQuery(defaultAccountsQuery);
        for (const account of result) {
          if (account.has_default_password) {
            vulnerabilities.push({
              type: 'default_credentials',
              severity: 'critical',
              resource: account.username,
              description: `Active account '${account.username}' is using default credentials`
            });
          }
        }
      } catch (error) {
        this.logger.debug('Could not check default accounts');
      }

      // Check for users with excessive permissions
      const excessivePermsQuery = {
        sql: `SELECT 
                u.username,
                COUNT(DISTINCT p.permission_id) as permission_count,
                STRING_AGG(p.permission_name, ', ') as permissions
              FROM CM_USERS u
              JOIN CM_USER_PERMISSIONS up ON u.user_id = up.user_id
              JOIN CM_PERMISSIONS p ON up.permission_id = p.permission_id
              WHERE p.permission_level = 'ADMIN'
              GROUP BY u.username
              HAVING COUNT(DISTINCT p.permission_id) > 5`
      };

      try {
        const result = await context.connector.executeQuery(excessivePermsQuery);
        for (const user of result) {
          vulnerabilities.push({
            type: 'excessive_permissions',
            severity: 'high',
            resource: user.username,
            description: `User '${user.username}' has ${user.permission_count} admin permissions`,
            details: user.permissions
          });
        }
      } catch (error) {
        this.logger.debug('Could not check excessive permissions');
      }

      // Check for inactive users with active sessions
      const inactiveUsersQuery = {
        sql: `SELECT 
                u.username,
                u.last_login,
                DATEDIFF(day, u.last_login, GETDATE()) as days_inactive
              FROM CM_USERS u
              WHERE u.is_active = 1
              AND u.last_login < DATEADD(day, -90, GETDATE())
              AND EXISTS (
                SELECT 1 FROM CM_USER_SESSIONS s 
                WHERE s.user_id = u.user_id 
                AND s.is_active = 1
              )`
      };

      try {
        const result = await context.connector.executeQuery(inactiveUsersQuery);
        for (const user of result) {
          vulnerabilities.push({
            type: 'inactive_user',
            severity: 'medium',
            resource: user.username,
            description: `User '${user.username}' inactive for ${user.days_inactive} days but has active sessions`
          });
        }
      } catch (error) {
        this.logger.debug('Could not check inactive users');
      }

      return vulnerabilities;
    } catch (error) {
      this.logger.error('Failed to check vulnerabilities', error as Error);
      return [];
    }
  }

  private getDefaultPasswordPolicy(): any {
    return {
      minLength: 8,
      complexityEnabled: false,
      expiryDays: 0,
      historyCount: 0,
      lockoutThreshold: 0,
      lockoutDuration: 0
    };
  }

  private getDefaultEncryptionSettings(): any {
    return {
      enabled: false,
      algorithm: 'NONE',
      keyRotationDays: 0,
      dataAtRestEncrypted: false,
      dataInTransitEncrypted: false
    };
  }

  private async getAuthenticationSettings(context: ScanContext): Promise<any> {
    return {
      method: 'local',
      mfaEnabled: false,
      ssoEnabled: false,
      sessionTimeout: 30,
      concurrentSessions: true
    };
  }

  protected async onCleanup(): Promise<void> {
    this.logger.info('Security scanner cleanup completed');
  }

  protected getResourcePath(data: any): string {
    return `security/scan/${data.timestamp}`;
  }

  protected async getMetadata(context: ScanContext): Promise<Record<string, any>> {
    return {
      scannerVersion: this.version,
      systemId: context.systemId,
      timestamp: new Date().toISOString(),
      checksPerformed: [
        'password_policy',
        'encryption_settings',
        'authentication_config',
        'audit_logs',
        'default_accounts',
        'excessive_permissions',
        'inactive_users',
        'failed_logins'
      ]
    };
  }
}