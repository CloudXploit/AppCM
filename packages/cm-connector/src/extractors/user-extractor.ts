import { BaseExtractor } from './base-extractor';
import { z } from 'zod';

export interface UserData {
  users: CMUser[];
  groups: CMGroup[];
  permissions: CMPermission[];
  roles: CMRole[];
}

export interface CMUser {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  active: boolean;
  type: 'normal' | 'admin' | 'system' | 'external';
  createdDate: Date;
  lastLogin?: Date;
  groups: string[];
  roles: string[];
  permissions: string[];
  settings?: Record<string, any>;
}

export interface CMGroup {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  parentGroupId?: string;
  members: string[];
  permissions: string[];
}

export interface CMPermission {
  id: string;
  name: string;
  category: string;
  description?: string;
  resource: string;
  actions: string[];
}

export interface CMRole {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  permissions: string[];
  assignableBy: string[];
}

export class UserExtractor extends BaseExtractor<UserData> {
  constructor(connector: any, adapter: any) {
    super(connector, adapter, 'UserExtractor');
  }

  getSchema(): z.ZodSchema<UserData> {
    return z.object({
      users: z.array(z.object({
        id: z.string(),
        username: z.string(),
        email: z.string().email().optional(),
        fullName: z.string().optional(),
        active: z.boolean(),
        type: z.enum(['normal', 'admin', 'system', 'external']),
        createdDate: z.date(),
        lastLogin: z.date().optional(),
        groups: z.array(z.string()),
        roles: z.array(z.string()),
        permissions: z.array(z.string()),
        settings: z.record(z.any()).optional()
      })),
      groups: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        active: z.boolean(),
        parentGroupId: z.string().optional(),
        members: z.array(z.string()),
        permissions: z.array(z.string())
      })),
      permissions: z.array(z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        description: z.string().optional(),
        resource: z.string(),
        actions: z.array(z.string())
      })),
      roles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        active: z.boolean(),
        permissions: z.array(z.string()),
        assignableBy: z.array(z.string())
      }))
    });
  }

  async extract(): Promise<UserData> {
    const [users, groups, permissions, roles] = await Promise.all([
      this.extractUsers(),
      this.extractGroups(),
      this.extractPermissions(),
      this.extractRoles()
    ]);

    // Enrich users with group and role data
    const enrichedUsers = await this.enrichUserData(users, groups, roles);

    return {
      users: enrichedUsers,
      groups,
      permissions,
      roles
    };
  }

  validate(data: UserData): boolean {
    try {
      this.getSchema().parse(data);
      return true;
    } catch (error) {
      this.logger.error('User data validation failed', error);
      return false;
    }
  }

  transform(data: UserData): any {
    return {
      summary: {
        totalUsers: data.users.length,
        activeUsers: data.users.filter(u => u.active).length,
        adminUsers: data.users.filter(u => u.type === 'admin').length,
        totalGroups: data.groups.length,
        totalRoles: data.roles.length,
        totalPermissions: data.permissions.length
      },
      users: data.users.map(user => ({
        ...user,
        lastActive: user.lastLogin || user.createdDate,
        isAdmin: user.type === 'admin',
        hasEmail: !!user.email
      })),
      groups: data.groups,
      security: {
        roles: data.roles,
        permissions: data.permissions
      }
    };
  }

  private async extractUsers(): Promise<CMUser[]> {
    const query = this.adapter.buildQuery('GET_USERS', { active: true });
    const result = await this.executeQuery(query);

    return result.map(row => ({
      id: row.id || row.USER_ID,
      username: row.username || row.USER_NAME,
      email: row.email || row.USER_EMAIL,
      fullName: row.fullName || row.FULL_NAME || `${row.FIRST_NAME || ''} ${row.LAST_NAME || ''}`.trim(),
      active: row.active === true || row.ACTIVE === 1,
      type: this.mapUserType(row.type || row.USER_TYPE),
      createdDate: new Date(row.created_date || row.CREATED_DATE),
      lastLogin: row.last_login_date ? new Date(row.last_login_date) : undefined,
      groups: [], // Will be enriched later
      roles: [], // Will be enriched later
      permissions: [], // Will be enriched later
      settings: this.parseUserSettings(row.settings || row.USER_SETTINGS)
    }));
  }

  private mapUserType(type: any): CMUser['type'] {
    if (typeof type === 'string') {
      const normalized = type.toLowerCase();
      if (normalized.includes('admin')) return 'admin';
      if (normalized.includes('system')) return 'system';
      if (normalized.includes('external')) return 'external';
      return 'normal';
    }
    
    // Legacy numeric types
    switch (type) {
      case 0: return 'normal';
      case 1: return 'admin';
      case 2: return 'system';
      case 3: return 'external';
      default: return 'normal';
    }
  }

  private parseUserSettings(settings: any): Record<string, any> | undefined {
    if (!settings) return undefined;
    
    if (typeof settings === 'string') {
      try {
        return JSON.parse(settings);
      } catch {
        return { raw: settings };
      }
    }
    
    return settings;
  }

  private async extractGroups(): Promise<CMGroup[]> {
    try {
      const query = this.adapter.buildQuery('GET_GROUPS', {});
      const result = await this.executeQuery(query);

      const groups = result.map(row => ({
        id: row.id || row.GROUP_ID,
        name: row.name || row.GROUP_NAME,
        description: row.description || row.GROUP_DESCRIPTION,
        active: row.active === true || row.ACTIVE === 1,
        parentGroupId: row.parent_id || row.PARENT_GROUP_ID,
        members: [], // Will be populated separately
        permissions: [] // Will be populated separately
      }));

      // Get group members
      for (const group of groups) {
        group.members = await this.getGroupMembers(group.id);
        group.permissions = await this.getGroupPermissions(group.id);
      }

      return groups;
    } catch (error) {
      this.logger.warn('Failed to extract groups', error);
      return [];
    }
  }

  private async getGroupMembers(groupId: string): Promise<string[]> {
    try {
      const query = {
        sql: `SELECT USER_ID FROM USER_GROUP_MEMBERS WHERE GROUP_ID = ?`,
        params: [groupId]
      };
      const result = await this.executeQuery(query);
      return result.map(row => row.USER_ID);
    } catch {
      return [];
    }
  }

  private async getGroupPermissions(groupId: string): Promise<string[]> {
    try {
      const query = {
        sql: `SELECT PERMISSION_ID FROM GROUP_PERMISSIONS WHERE GROUP_ID = ?`,
        params: [groupId]
      };
      const result = await this.executeQuery(query);
      return result.map(row => row.PERMISSION_ID);
    } catch {
      return [];
    }
  }

  private async extractPermissions(): Promise<CMPermission[]> {
    try {
      const query = this.adapter.buildQuery('GET_PERMISSIONS', {});
      const result = await this.executeQuery(query);

      return result.map(row => ({
        id: row.id || row.PERMISSION_ID,
        name: row.name || row.PERMISSION_NAME,
        category: row.category || row.PERMISSION_CATEGORY || 'General',
        description: row.description || row.PERMISSION_DESCRIPTION,
        resource: row.resource || row.RESOURCE_TYPE || 'System',
        actions: this.parseActions(row.actions || row.ALLOWED_ACTIONS)
      }));
    } catch (error) {
      this.logger.warn('Failed to extract permissions', error);
      return this.getDefaultPermissions();
    }
  }

  private parseActions(actions: any): string[] {
    if (!actions) return ['read'];
    
    if (Array.isArray(actions)) return actions;
    
    if (typeof actions === 'string') {
      // Could be comma-separated or JSON
      if (actions.includes(',')) {
        return actions.split(',').map((a: string) => a.trim());
      }
      
      try {
        const parsed = JSON.parse(actions);
        return Array.isArray(parsed) ? parsed : ['read'];
      } catch {
        return [actions];
      }
    }
    
    return ['read'];
  }

  private getDefaultPermissions(): CMPermission[] {
    // Return common CM permissions if query fails
    return [
      {
        id: 'read_records',
        name: 'Read Records',
        category: 'Records',
        description: 'View records',
        resource: 'Record',
        actions: ['read', 'list']
      },
      {
        id: 'create_records',
        name: 'Create Records',
        category: 'Records',
        description: 'Create new records',
        resource: 'Record',
        actions: ['create']
      },
      {
        id: 'modify_records',
        name: 'Modify Records',
        category: 'Records',
        description: 'Edit existing records',
        resource: 'Record',
        actions: ['update']
      },
      {
        id: 'delete_records',
        name: 'Delete Records',
        category: 'Records',
        description: 'Delete records',
        resource: 'Record',
        actions: ['delete']
      },
      {
        id: 'admin_system',
        name: 'System Administration',
        category: 'Administration',
        description: 'Full system administration',
        resource: 'System',
        actions: ['*']
      }
    ];
  }

  private async extractRoles(): Promise<CMRole[]> {
    try {
      const query = this.adapter.buildQuery('GET_ROLES', {});
      const result = await this.executeQuery(query);

      const roles = result.map(row => ({
        id: row.id || row.ROLE_ID,
        name: row.name || row.ROLE_NAME,
        description: row.description || row.ROLE_DESCRIPTION,
        active: row.active === true || row.ACTIVE === 1,
        permissions: [],
        assignableBy: []
      }));

      // Get role permissions
      for (const role of roles) {
        role.permissions = await this.getRolePermissions(role.id);
        role.assignableBy = await this.getRoleAssigners(role.id);
      }

      return roles;
    } catch (error) {
      this.logger.warn('Failed to extract roles', error);
      return this.getDefaultRoles();
    }
  }

  private async getRolePermissions(roleId: string): Promise<string[]> {
    try {
      const query = {
        sql: `SELECT PERMISSION_ID FROM ROLE_PERMISSIONS WHERE ROLE_ID = ?`,
        params: [roleId]
      };
      const result = await this.executeQuery(query);
      return result.map(row => row.PERMISSION_ID);
    } catch {
      return [];
    }
  }

  private async getRoleAssigners(roleId: string): Promise<string[]> {
    // Simplified - in reality would check role hierarchy
    return ['admin_system'];
  }

  private getDefaultRoles(): CMRole[] {
    return [
      {
        id: 'system_admin',
        name: 'System Administrator',
        description: 'Full system access',
        active: true,
        permissions: ['admin_system'],
        assignableBy: ['system_admin']
      },
      {
        id: 'records_manager',
        name: 'Records Manager',
        description: 'Manage records and classifications',
        active: true,
        permissions: ['read_records', 'create_records', 'modify_records'],
        assignableBy: ['system_admin']
      },
      {
        id: 'user',
        name: 'Standard User',
        description: 'Basic user access',
        active: true,
        permissions: ['read_records'],
        assignableBy: ['system_admin', 'records_manager']
      }
    ];
  }

  private async enrichUserData(
    users: CMUser[], 
    groups: CMGroup[], 
    roles: CMRole[]
  ): Promise<CMUser[]> {
    for (const user of users) {
      // Get user's groups
      user.groups = groups
        .filter(g => g.members.includes(user.id))
        .map(g => g.id);

      // Get user's roles
      try {
        const roleQuery = {
          sql: `SELECT ROLE_ID FROM USER_ROLES WHERE USER_ID = ?`,
          params: [user.id]
        };
        const roleResult = await this.executeQuery(roleQuery);
        user.roles = roleResult.map(r => r.ROLE_ID);
      } catch {
        // Assign default role based on user type
        user.roles = user.type === 'admin' ? ['system_admin'] : ['user'];
      }

      // Compile permissions from groups and roles
      const groupPermissions = groups
        .filter(g => user.groups.includes(g.id))
        .flatMap(g => g.permissions);
      
      const rolePermissions = roles
        .filter(r => user.roles.includes(r.id))
        .flatMap(r => r.permissions);

      user.permissions = [...new Set([...groupPermissions, ...rolePermissions])];
    }

    return users;
  }
}