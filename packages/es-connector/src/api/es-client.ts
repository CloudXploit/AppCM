import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { EventEmitter } from 'eventemitter3';
import winston from 'winston';
import { ESConnection, ESSession } from '../types';

export interface ESClientOptions {
  connection: ESConnection;
  logger?: winston.Logger;
  interceptors?: {
    request?: (config: AxiosRequestConfig) => AxiosRequestConfig;
    response?: (response: any) => any;
    error?: (error: any) => any;
  };
}

export class ESClient extends EventEmitter {
  private connection: ESConnection;
  private client: AxiosInstance;
  private logger: winston.Logger;
  private session?: ESSession;
  private refreshTimer?: NodeJS.Timeout;

  constructor(options: ESClientOptions) {
    super();
    this.connection = options.connection;
    
    this.logger = options.logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.client = axios.create({
      baseURL: this.connection.baseUrl,
      timeout: this.connection.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-ES-API-Version': this.connection.apiVersion || '1.0'
      }
    });

    this.setupInterceptors(options.interceptors);
  }

  private setupInterceptors(customInterceptors?: any): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Add authentication token
        if (this.session?.sessionId) {
          config.headers['Authorization'] = `Bearer ${this.session.sessionId}`;
        }

        // Custom request interceptor
        if (customInterceptors?.request) {
          config = customInterceptors.request(config);
        }

        this.logger.debug(`ES API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('ES API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Custom response interceptor
        if (customInterceptors?.response) {
          response = customInterceptors.response(response);
        }
        return response;
      },
      async (error) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          
          try {
            await this.refreshSession();
            error.config.headers['Authorization'] = `Bearer ${this.session?.sessionId}`;
            return this.client(error.config);
          } catch (refreshError) {
            this.emit('session:expired');
            return Promise.reject(refreshError);
          }
        }

        // Custom error interceptor
        if (customInterceptors?.error) {
          error = customInterceptors.error(error);
        }

        this.logger.error('ES API Response Error:', error.response?.data || error.message);
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  async authenticate(): Promise<ESSession> {
    try {
      this.logger.info('Authenticating with Enterprise Studio...');
      
      const response = await this.client.post('/auth/login', {
        username: this.connection.username,
        password: this.connection.password,
        domain: this.connection.domain
      });

      this.session = {
        sessionId: response.data.sessionId,
        userId: response.data.userId,
        userName: response.data.userName,
        roles: response.data.roles || [],
        permissions: response.data.permissions || [],
        expiresAt: new Date(response.data.expiresAt),
        refreshToken: response.data.refreshToken
      };

      // Set up session refresh
      this.scheduleSessionRefresh();
      
      this.emit('authenticated', this.session);
      this.logger.info(`Authenticated as ${this.session.userName}`);
      
      return this.session;
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw this.normalizeError(error);
    }
  }

  async logout(): Promise<void> {
    if (!this.session) return;

    try {
      await this.client.post('/auth/logout', {
        sessionId: this.session.sessionId
      });
    } catch (error) {
      this.logger.warn('Logout failed:', error);
    } finally {
      this.clearSession();
      this.emit('logout');
    }
  }

  private async refreshSession(): Promise<void> {
    if (!this.session?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.client.post('/auth/refresh', {
        refreshToken: this.session.refreshToken
      });

      this.session = {
        ...this.session,
        sessionId: response.data.sessionId,
        expiresAt: new Date(response.data.expiresAt),
        refreshToken: response.data.refreshToken
      };

      this.scheduleSessionRefresh();
      this.emit('session:refreshed', this.session);
      
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  private scheduleSessionRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.session) return;

    const expiresIn = this.session.expiresAt.getTime() - Date.now();
    const refreshIn = Math.max(expiresIn - 5 * 60 * 1000, 0); // Refresh 5 minutes before expiry

    this.refreshTimer = setTimeout(() => {
      this.refreshSession().catch(error => {
        this.logger.error('Session refresh failed:', error);
        this.emit('session:refresh:failed', error);
      });
    }, refreshIn);
  }

  private clearSession(): void {
    this.session = undefined;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  async get<T = any>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(path, config);
    return response.data;
  }

  async post<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(path, data, config);
    return response.data;
  }

  async put<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(path, data, config);
    return response.data;
  }

  async patch<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch(path, data, config);
    return response.data;
  }

  async delete<T = any>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(path, config);
    return response.data;
  }

  async upload(path: string, file: Buffer | FormData, config?: AxiosRequestConfig): Promise<any> {
    const headers = {
      ...config?.headers,
      'Content-Type': file instanceof Buffer ? 'application/octet-stream' : 'multipart/form-data'
    };

    const response = await this.client.post(path, file, {
      ...config,
      headers
    });

    return response.data;
  }

  async download(path: string, config?: AxiosRequestConfig): Promise<Buffer> {
    const response = await this.client.get(path, {
      ...config,
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  }

  private normalizeError(error: any): Error {
    if (error.response?.data) {
      const data = error.response.data;
      const normalized = new Error(data.message || data.error || 'ES API Error') as any;
      normalized.code = data.code || error.response.status;
      normalized.status = error.response.status;
      normalized.details = data.details || data;
      return normalized;
    }
    
    return error;
  }

  isAuthenticated(): boolean {
    return !!this.session && this.session.expiresAt > new Date();
  }

  getSession(): ESSession | undefined {
    return this.session;
  }

  getConnection(): ESConnection {
    return { ...this.connection };
  }

  setRequestTimeout(timeout: number): void {
    this.client.defaults.timeout = timeout;
  }

  addRequestInterceptor(interceptor: (config: AxiosRequestConfig) => AxiosRequestConfig): number {
    return this.client.interceptors.request.use(interceptor);
  }

  removeRequestInterceptor(id: number): void {
    this.client.interceptors.request.eject(id);
  }

  addResponseInterceptor(
    onSuccess: (response: any) => any,
    onError?: (error: any) => any
  ): number {
    return this.client.interceptors.response.use(onSuccess, onError);
  }

  removeResponseInterceptor(id: number): void {
    this.client.interceptors.response.eject(id);
  }
}