import { EventEmitter } from 'eventemitter3';
import winston from 'winston';
import { ESClient } from './es-client';
import { ESConnection, ESSession, ESPermission } from '../types';

export interface AuthOptions {
  autoRefresh?: boolean;
  persistSession?: boolean;
  sessionStorage?: SessionStorage;
  permissionCache?: boolean;
  maxRetries?: number;
}

export interface SessionStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class ESAuthManager extends EventEmitter {
  private client: ESClient;
  private options: AuthOptions;
  private logger: winston.Logger;
  private permissionCache: Map<string, boolean> = new Map();
  private retryCount: number = 0;

  constructor(
    client: ESClient,
    options: AuthOptions = {},
    logger?: winston.Logger
  ) {
    super();
    this.client = client;
    this.options = {
      autoRefresh: true,
      persistSession: false,
      permissionCache: true,
      maxRetries: 3,
      ...options
    };
    
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('authenticated', (session: ESSession) => {
      this.handleAuthentication(session);
    });

    this.client.on('session:expired', () => {
      this.handleSessionExpired();
    });

    this.client.on('session:refreshed', (session: ESSession) => {
      this.handleSessionRefreshed(session);
    });

    this.client.on('logout', () => {
      this.handleLogout();
    });
  }

  async login(
    username?: string,
    password?: string,
    domain?: string
  ): Promise<ESSession> {
    try {
      // Check for persisted session first
      if (this.options.persistSession && this.options.sessionStorage) {
        const persistedSession = await this.loadPersistedSession();
        if (persistedSession && this.isSessionValid(persistedSession)) {
          this.logger.info('Using persisted session');
          return persistedSession;
        }
      }

      // Use provided credentials or fall back to client connection
      const connection = this.client.getConnection();
      if (username) connection.username = username;
      if (password) connection.password = password;
      if (domain) connection.domain = domain;

      const session = await this.client.authenticate();
      this.retryCount = 0;
      
      return session;
    } catch (error) {
      this.logger.error('Login failed:', error);
      
      if (this.retryCount < (this.options.maxRetries || 3)) {
        this.retryCount++;
        this.logger.info(`Retrying login (attempt ${this.retryCount})...`);
        await this.delay(1000 * this.retryCount);
        return this.login(username, password, domain);
      }
      
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.client.logout();
    this.clearPermissionCache();
    
    if (this.options.persistSession && this.options.sessionStorage) {
      await this.options.sessionStorage.delete('es_session');
    }
  }

  async checkPermission(permission: string): Promise<boolean> {
    const session = this.client.getSession();
    if (!session) {
      return false;
    }

    // Check cache first
    if (this.options.permissionCache && this.permissionCache.has(permission)) {
      return this.permissionCache.get(permission)!;
    }

    // Check if permission is in session
    const hasPermission = session.permissions.includes(permission) ||
                         session.permissions.includes('*') ||
                         this.checkWildcardPermission(permission, session.permissions);

    if (this.options.permissionCache) {
      this.permissionCache.set(permission, hasPermission);
    }

    return hasPermission;
  }

  async checkRole(role: string): Promise<boolean> {
    const session = this.client.getSession();
    if (!session) {
      return false;
    }

    return session.roles.includes(role) || session.roles.includes('admin');
  }

  async checkMultiplePermissions(
    permissions: string[],
    requireAll: boolean = true
  ): Promise<boolean> {
    const results = await Promise.all(
      permissions.map(p => this.checkPermission(p))
    );

    return requireAll ? results.every(r => r) : results.some(r => r);
  }

  async getUserPermissions(): Promise<string[]> {
    const session = this.client.getSession();
    return session?.permissions || [];
  }

  async getUserRoles(): Promise<string[]> {
    const session = this.client.getSession();
    return session?.roles || [];
  }

  async impersonate(userId: string): Promise<ESSession> {
    try {
      const response = await this.client.post<ESSession>('/auth/impersonate', {
        userId
      });

      this.logger.info(`Impersonating user: ${userId}`);
      this.emit('impersonation:started', { userId });
      
      return response;
    } catch (error) {
      this.logger.error('Impersonation failed:', error);
      throw error;
    }
  }

  async endImpersonation(): Promise<ESSession> {
    try {
      const response = await this.client.post<ESSession>('/auth/end-impersonation');
      
      this.logger.info('Ended impersonation');
      this.emit('impersonation:ended');
      
      return response;
    } catch (error) {
      this.logger.error('Failed to end impersonation:', error);
      throw error;
    }
  }

  async validateSession(): Promise<boolean> {
    try {
      const session = this.client.getSession();
      if (!session || !this.isSessionValid(session)) {
        return false;
      }

      // Ping the server to validate
      await this.client.get('/auth/validate');
      return true;
    } catch (error) {
      return false;
    }
  }

  private async handleAuthentication(session: ESSession): Promise<void> {
    this.clearPermissionCache();
    
    if (this.options.persistSession && this.options.sessionStorage) {
      await this.persistSession(session);
    }
    
    this.emit('login', session);
  }

  private async handleSessionExpired(): Promise<void> {
    this.clearPermissionCache();
    this.emit('session:expired');
    
    if (this.options.autoRefresh) {
      try {
        await this.login();
        this.emit('session:restored');
      } catch (error) {
        this.logger.error('Failed to restore session:', error);
        this.emit('session:restore:failed', error);
      }
    }
  }

  private async handleSessionRefreshed(session: ESSession): Promise<void> {
    this.clearPermissionCache();
    
    if (this.options.persistSession && this.options.sessionStorage) {
      await this.persistSession(session);
    }
  }

  private async handleLogout(): Promise<void> {
    this.clearPermissionCache();
    this.emit('logout');
  }

  private async persistSession(session: ESSession): Promise<void> {
    if (!this.options.sessionStorage) return;
    
    try {
      const data = JSON.stringify({
        ...session,
        expiresAt: session.expiresAt.toISOString()
      });
      
      await this.options.sessionStorage.set('es_session', data);
    } catch (error) {
      this.logger.error('Failed to persist session:', error);
    }
  }

  private async loadPersistedSession(): Promise<ESSession | null> {
    if (!this.options.sessionStorage) return null;
    
    try {
      const data = await this.options.sessionStorage.get('es_session');
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      parsed.expiresAt = new Date(parsed.expiresAt);
      
      return parsed as ESSession;
    } catch (error) {
      this.logger.error('Failed to load persisted session:', error);
      return null;
    }
  }

  private isSessionValid(session: ESSession): boolean {
    return session.expiresAt > new Date();
  }

  private checkWildcardPermission(
    permission: string,
    userPermissions: string[]
  ): boolean {
    const permParts = permission.split('.');
    
    return userPermissions.some(userPerm => {
      const userParts = userPerm.split('.');
      
      if (userParts.length !== permParts.length) {
        return false;
      }
      
      return userParts.every((part, index) => {
        return part === '*' || part === permParts[index];
      });
    });
  }

  private clearPermissionCache(): void {
    this.permissionCache.clear();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isAuthenticated(): boolean {
    return this.client.isAuthenticated();
  }

  getCurrentUser(): { userId: string; userName: string } | null {
    const session = this.client.getSession();
    if (!session) return null;
    
    return {
      userId: session.userId,
      userName: session.userName
    };
  }
}