import { IDOLServerConnector } from './idol-connector';
import { IDOLConnection } from '../types';

export class CommunityConnector extends IDOLServerConnector {
  constructor(connection: IDOLConnection) {
    super(connection);
    
    // Community server specific configuration
    if (!this.connection.community) {
      this.connection.community = 'default';
    }
  }

  protected buildQueryParameters(params: any): Record<string, any> {
    const parameters = super.buildQueryParameters(params);
    
    // Add community parameter to all queries
    parameters.Community = this.connection.community;
    
    return parameters;
  }

  async executeAction(action: any): Promise<any> {
    // Add community to all actions
    if (!action.parameters) {
      action.parameters = {};
    }
    action.parameters.Community = this.connection.community;
    
    return super.executeAction(action);
  }
}