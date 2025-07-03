import { BaseConnector } from './base-connector';
import { CMConnectionConfig, CMQuery, CMSystemInfo, CMError } from '../types';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { parseStringPromise } from 'xml2js';

export class APIConnector extends BaseConnector {
  private axiosInstance?: AxiosInstance;
  private apiType: 'REST' | 'SOAP';
  private sessionToken?: string;

  constructor(config: CMConnectionConfig) {
    super(config);
    this.apiType = config.type === 'REST_API' ? 'REST' : 'SOAP';
  }

  async connect(): Promise<void> {
    this.logger.info(`Connecting to Content Manager ${this.apiType} API`, {
      baseUrl: this.config.baseUrl,
      host: this.config.host
    });

    try {
      const baseURL = this.config.baseUrl || 
        `${this.config.encrypted ? 'https' : 'http'}://${this.config.host}:${this.config.port || (this.apiType === 'REST' ? 8080 : 8088)}/ContentManager`;

      this.axiosInstance = axios.create({
        baseURL,
        timeout: this.config.connectionTimeout || 30000,
        headers: this.getDefaultHeaders(),
        validateStatus: (status) => status < 500
      });

      // Add request/response interceptors
      this.setupInterceptors();

      // Authenticate
      await this.authenticate();

      this.connected = true;
      this.logger.info(`Successfully connected to Content Manager ${this.apiType} API`);
      
      this.metrics.increment('cm_api_connections_success', {
        apiType: this.apiType
      });
    } catch (error) {
      this.metrics.increment('cm_api_connections_failed', {
        apiType: this.apiType
      });
      this.handleError(error, 'connect');
    }
  }

  private getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'CM-Diagnostics/1.0',
    };

    if (this.apiType === 'REST') {
      headers['Accept'] = 'application/json';
      headers['Content-Type'] = 'application/json';
    } else {
      headers['Content-Type'] = 'text/xml; charset=utf-8';
      headers['SOAPAction'] = '';
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance!.interceptors.request.use(
      (config) => {
        if (this.sessionToken) {
          config.headers['X-Session-Token'] = this.sessionToken;
        }
        
        this.logger.debug('API Request', {
          method: config.method,
          url: config.url,
          headers: this.sanitizeHeaders(config.headers)
        });
        
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance!.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response', {
          status: response.status,
          url: response.config.url
        });
        
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
          // Try to re-authenticate
          this.logger.info('Session expired, re-authenticating');
          await this.authenticate();
          
          // Retry the original request
          if (error.config) {
            return this.axiosInstance!.request(error.config);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async authenticate(): Promise<void> {
    if (this.apiType === 'REST') {
      await this.authenticateREST();
    } else {
      await this.authenticateSOAP();
    }
  }

  private async authenticateREST(): Promise<void> {
    try {
      const response = await this.axiosInstance!.post('/api/v2/login', {
        username: this.config.username,
        password: this.config.password,
        domain: this.config.additionalOptions?.domain
      });

      if (response.data.token) {
        this.sessionToken = response.data.token;
        this.axiosInstance!.defaults.headers['Authorization'] = `Bearer ${this.sessionToken}`;
      } else {
        throw new Error('No token received from login');
      }
    } catch (error) {
      throw new CMError('AUTHENTICATION_FAILED', 'REST API authentication failed', error);
    }
  }

  private async authenticateSOAP(): Promise<void> {
    const soapEnvelope = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <Login xmlns="http://www.opentext.com/cm">
            <username>${this.config.username}</username>
            <password>${this.config.password}</password>
            ${this.config.additionalOptions?.domain ? `<domain>${this.config.additionalOptions.domain}</domain>` : ''}
          </Login>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await this.axiosInstance!.post('/ServiceAPI.svc', soapEnvelope, {
        headers: {
          'SOAPAction': '"http://www.opentext.com/cm/Login"'
        }
      });

      const parsed = await parseStringPromise(response.data);
      const sessionId = parsed['soap:Envelope']['soap:Body'][0]['LoginResponse']?.[0]?.['SessionId']?.[0];
      
      if (sessionId) {
        this.sessionToken = sessionId;
      } else {
        throw new Error('No session ID received from SOAP login');
      }
    } catch (error) {
      throw new CMError('AUTHENTICATION_FAILED', 'SOAP API authentication failed', error);
    }
  }

  async disconnect(): Promise<void> {
    this.logger.info(`Disconnecting from Content Manager ${this.apiType} API`);

    try {
      if (this.connected && this.sessionToken) {
        // Try to logout
        if (this.apiType === 'REST') {
          await this.axiosInstance!.post('/api/v2/logout').catch(() => {
            // Ignore logout errors
          });
        }
      }

      this.axiosInstance = undefined;
      this.sessionToken = undefined;
      this.connected = false;

      this.logger.info(`Successfully disconnected from Content Manager ${this.apiType} API`);
    } catch (error) {
      this.logger.error('Error disconnecting from API', error);
      throw error;
    }
  }

  async executeQuery<T = any>(query: CMQuery): Promise<T[]> {
    if (!this.connected) {
      throw new CMError('CONNECTION_FAILED', 'Not connected to API');
    }

    // For API connectors, we translate SQL-like queries to API calls
    // This is a simplified implementation
    const operation = this.parseQueryToAPICall(query.sql);
    
    try {
      if (this.apiType === 'REST') {
        return await this.executeRESTCall<T>(operation);
      } else {
        return await this.executeSOAPCall<T>(operation);
      }
    } catch (error) {
      this.handleError(error, 'executeQuery');
    }
  }

  private parseQueryToAPICall(sql: string): any {
    // Simple parser to convert SQL-like queries to API operations
    // In production, this would be much more sophisticated
    const upperSQL = sql.toUpperCase();
    
    if (upperSQL.includes('SELECT') && upperSQL.includes('FROM TSYSTEM')) {
      return {
        endpoint: '/api/v2/system/info',
        method: 'GET'
      };
    }
    
    // Default fallback
    return {
      endpoint: '/api/v2/query',
      method: 'POST',
      data: { sql }
    };
  }

  private async executeRESTCall<T>(operation: any): Promise<T[]> {
    const response = await this.axiosInstance!.request({
      method: operation.method,
      url: operation.endpoint,
      data: operation.data,
      params: operation.params
    });

    if (response.status >= 400) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    // Normalize response to array
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    } else if (data.results) {
      return data.results;
    } else if (data.data) {
      return Array.isArray(data.data) ? data.data : [data.data];
    } else {
      return [data];
    }
  }

  private async executeSOAPCall<T>(operation: any): Promise<T[]> {
    // Build SOAP envelope based on operation
    const soapEnvelope = this.buildSOAPEnvelope(operation);
    
    const response = await this.axiosInstance!.post('/ServiceAPI.svc', soapEnvelope, {
      headers: {
        'SOAPAction': `"http://www.opentext.com/cm/${operation.action || 'Query'}"`
      }
    });

    const parsed = await parseStringPromise(response.data);
    const body = parsed['soap:Envelope']['soap:Body'][0];
    
    // Extract results from SOAP response
    const responseKey = Object.keys(body).find(key => key.includes('Response'));
    if (responseKey) {
      const results = body[responseKey][0].Results || body[responseKey][0];
      return Array.isArray(results) ? results : [results];
    }
    
    return [];
  }

  private buildSOAPEnvelope(operation: any): string {
    return `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Header>
          <SessionId xmlns="http://www.opentext.com/cm">${this.sessionToken}</SessionId>
        </soap:Header>
        <soap:Body>
          <Query xmlns="http://www.opentext.com/cm">
            <sql>${operation.sql || ''}</sql>
          </Query>
        </soap:Body>
      </soap:Envelope>
    `;
  }

  async getSystemInfo(): Promise<CMSystemInfo> {
    // For API connections, we need to fetch system info via API
    const info = await this.executeQuery<any>({
      sql: 'SELECT * FROM TSYSTEM WHERE TSYS_ID = 1'
    });

    if (!info || info.length === 0) {
      throw new Error('Unable to fetch system information');
    }

    // Parse the response and construct CMSystemInfo
    // This is simplified - real implementation would handle various API response formats
    return {
      version: {
        major: parseInt(info[0].VERSION?.split('.')[0] || '0'),
        minor: parseInt(info[0].VERSION?.split('.')[1] || '0'),
        patch: parseInt(info[0].VERSION?.split('.')[2] || '0'),
        fullVersion: info[0].VERSION || 'Unknown'
      },
      edition: info[0].EDITION || 'Standard',
      modules: [],
      licensedUsers: parseInt(info[0].LICENSED_USERS || '0'),
      installedFeatures: [],
      databaseType: 'SQLServer', // API doesn't typically expose this
      databaseVersion: 'Unknown'
    };
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    if (sanitized.Authorization) sanitized.Authorization = 'Bearer ***';
    if (sanitized['X-Session-Token']) sanitized['X-Session-Token'] = '***';
    return sanitized;
  }
}