import { User, UserRole, OrgRole } from '@cm-diagnostics/database';
import { Permission } from '../types';

interface PermissionRule {
  roles: UserRole[];
  orgRoles?: OrgRole[];
  permissions: string[];
}

export class PermissionService {
  private permissionRules: Map<string, PermissionRule> = new Map();

  constructor() {
    this.initializePermissions();
  }

  private initializePermissions() {
    // Super Admin permissions - full access
    this.addRule('super_admin', {
      roles: [UserRole.SUPER_ADMIN],
      permissions: ['*'],
    });

    // Admin permissions
    this.addRule('admin', {
      roles: [UserRole.ADMIN],
      permissions: [
        'users:read',
        'users:create',
        'users:update',
        'users:delete',
        'organizations:read',
        'organizations:update',
        'systems:*',
        'diagnostics:*',
        'remediations:*',
        'metrics:*',
        'reports:*',
      ],
    });

    // User permissions
    this.addRule('user', {
      roles: [UserRole.USER],
      permissions: [
        'users:read:own',
        'users:update:own',
        'organizations:read:own',
        'systems:read:organization',
        'systems:create:organization',
        'systems:update:organization',
        'diagnostics:*:organization',
        'remediations:*:organization',
        'metrics:read:organization',
        'reports:read:organization',
      ],
    });

    // Viewer permissions
    this.addRule('viewer', {
      roles: [UserRole.VIEWER],
      permissions: [
        'users:read:own',
        'organizations:read:own',
        'systems:read:organization',
        'diagnostics:read:organization',
        'remediations:read:organization',
        'metrics:read:organization',
        'reports:read:organization',
      ],
    });

    // Organization role permissions
    this.addRule('org_owner', {
      roles: [UserRole.USER, UserRole.ADMIN],
      orgRoles: [OrgRole.OWNER],
      permissions: [
        'organizations:*:organization',
        'users:*:organization',
        'systems:*:organization',
        'diagnostics:*:organization',
        'remediations:*:organization',
      ],
    });

    this.addRule('org_admin', {
      roles: [UserRole.USER],
      orgRoles: [OrgRole.ADMIN],
      permissions: [
        'organizations:read:organization',
        'organizations:update:organization',
        'users:read:organization',
        'users:invite:organization',
        'systems:*:organization',
        'diagnostics:*:organization',
        'remediations:*:organization',
      ],
    });
  }

  private addRule(name: string, rule: PermissionRule) {
    this.permissionRules.set(name, rule);
  }

  hasPermission(
    user: User & { organizations?: any[] },
    permission: Permission,
    context?: any
  ): boolean {
    // Super admin has all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const permissionString = this.formatPermission(permission);
    const userPermissions = this.getUserPermissions(user);

    // Check exact match
    if (userPermissions.has(permissionString)) {
      return true;
    }

    // Check wildcard permissions
    const wildcardPermissions = this.getWildcardPermissions(permissionString);
    for (const wildcard of wildcardPermissions) {
      if (userPermissions.has(wildcard)) {
        return this.checkScope(permission, user, context);
      }
    }

    return false;
  }

  getUserPermissions(user: User & { organizations?: any[] }): Set<string> {
    const permissions = new Set<string>();

    // Add role-based permissions
    for (const [_, rule] of this.permissionRules) {
      if (rule.roles.includes(user.role)) {
        // Check org role if specified
        if (rule.orgRoles) {
          const hasOrgRole = user.organizations?.some(
            (org) => rule.orgRoles?.includes(org.role)
          );
          if (!hasOrgRole) continue;
        }

        rule.permissions.forEach((perm) => permissions.add(perm));
      }
    }

    return permissions;
  }

  private formatPermission(permission: Permission): string {
    let perm = `${permission.resource}:${permission.action}`;
    if (permission.scope) {
      perm += `:${permission.scope}`;
    }
    return perm;
  }

  private getWildcardPermissions(permission: string): string[] {
    const parts = permission.split(':');
    const wildcards: string[] = ['*'];

    for (let i = 0; i < parts.length; i++) {
      const wildcardParts = [...parts.slice(0, i), '*'];
      wildcards.push(wildcardParts.join(':'));
    }

    return wildcards;
  }

  private checkScope(
    permission: Permission,
    user: User & { organizations?: any[] },
    context?: any
  ): boolean {
    if (!permission.scope) return true;

    switch (permission.scope) {
      case 'own':
        return context?.userId === user.id;
      
      case 'organization':
        if (!context?.organizationId) return false;
        return user.organizations?.some(
          (org) => org.organizationId === context.organizationId
        ) ?? false;
      
      case 'all':
        return true;
      
      default:
        return false;
    }
  }

  can(action: string, resource: string, scope?: 'own' | 'organization' | 'all') {
    return (user: User & { organizations?: any[] }, context?: any) => {
      return this.hasPermission(user, { resource, action, scope }, context);
    };
  }

  // Helper methods for common permission checks
  canReadUser(user: User & { organizations?: any[] }, targetUserId: string): boolean {
    return this.hasPermission(
      user,
      { resource: 'users', action: 'read', scope: 'own' },
      { userId: targetUserId }
    );
  }

  canUpdateUser(user: User & { organizations?: any[] }, targetUserId: string): boolean {
    return this.hasPermission(
      user,
      { resource: 'users', action: 'update', scope: 'own' },
      { userId: targetUserId }
    );
  }

  canAccessOrganization(
    user: User & { organizations?: any[] },
    organizationId: string
  ): boolean {
    return this.hasPermission(
      user,
      { resource: 'organizations', action: 'read', scope: 'organization' },
      { organizationId }
    );
  }

  canManageSystem(
    user: User & { organizations?: any[] },
    systemId: string,
    organizationId: string
  ): boolean {
    return this.hasPermission(
      user,
      { resource: 'systems', action: 'update', scope: 'organization' },
      { systemId, organizationId }
    );
  }
}