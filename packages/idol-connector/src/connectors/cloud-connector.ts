import axios from 'axios';
import { IDOLServerConnector } from './idol-connector';
import { IDOLConnection } from '../types';

interface CloudAuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
}

export class CloudConnector extends IDOLServerConnector {
  private authToken?: CloudAuthToken;
  private apiKey?: string;
  private tenantId?: string;

  constructor(connection: IDOLConnection) {
    super(connection);
    
    // Extract cloud-specific config
    this.apiKey = process.env.IDOL_CLOUD_API_KEY || connection.password;
    this.tenantId = process.env.IDOL_CLOUD_TENANT_ID || connection.username;
    
    // Override base URL for cloud
    this.client = axios.create({
      baseURL: `https://${connection.host}/api/v1`,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    this.setupCloudInterceptors();
  }

  private setupCloudInterceptors(): void {
    // Add authentication to all requests
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.authToken || this.isTokenExpired()) {
          await this.authenticate();
        }
        
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken.token}`;
        }
        
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle token refresh on 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          await this.authenticate();
          return this.client(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post(
        `https://${this.connection.host}/auth/token`,
        {
          apiKey: this.apiKey,
          tenantId: this.tenantId
        }
      );

      this.authToken = {
        token: response.data.access_token,
        expiresAt: new Date(Date.now() + (response.data.expires_in * 1000)),
        refreshToken: response.data.refresh_token
      };

      this.logger.info('Successfully authenticated with IDOL Cloud');
    } catch (error) {
      this.logger.error('Failed to authenticate with IDOL Cloud:', error);
      throw new Error('IDOL Cloud authentication failed');
    }
  }

  private isTokenExpired(): boolean {
    if (!this.authToken) return true;
    return new Date() >= this.authToken.expiresAt;
  }

  async executeAction(action: any): Promise<any> {
    // Convert IDOL action to cloud API endpoint
    const endpoint = this.getCloudEndpoint(action.action);
    
    try {
      const response = await this.client.post(endpoint, {
        ...action.parameters,
        action: action.action
      });
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private getCloudEndpoint(action: string): string {
    const endpointMap: Record<string, string> = {
      'Query': '/search',
      'GetStatus': '/status',
      'GetDatabases': '/databases',
      'DRESADD': '/index',
      'DREDELETEDOC': '/delete',
      'GetSentiment': '/analytics/sentiment',
      'GetConcepts': '/analytics/concepts',
      'GetEntities': '/analytics/entities',
      'LanguageIdentify': '/analytics/language',
      'Summarize': '/analytics/summary'
    };
    
    return endpointMap[action] || `/actions/${action.toLowerCase()}`;
  }

  protected async parseQueryResponse(data: any): Promise<any> {
    // Cloud API returns JSON directly
    if (typeof data === 'object') {
      return this.transformCloudResponse(data);
    }
    
    // Fallback to XML parsing if needed
    return super.parseQueryResponse(data);
  }

  private transformCloudResponse(cloudResponse: any): any {
    // Transform cloud JSON response to match expected format
    return {
      autnresponse: {
        action: cloudResponse.action || 'Query',
        response: cloudResponse.status || 'SUCCESS',
        responsedata: {
          numhits: cloudResponse.numResults || 0,
          totalhits: cloudResponse.totalResults,
          hit: cloudResponse.results || [],
          warning: cloudResponse.warning,
          error: cloudResponse.error
        }
      }
    };
  }
}