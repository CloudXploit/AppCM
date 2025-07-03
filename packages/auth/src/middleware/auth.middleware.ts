import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';
import { Permission } from '../types';
import { User } from '@cm-diagnostics/database';

export interface AuthRequest extends Request {
  user?: User;
  token?: string;
}

export class AuthMiddleware {
  constructor(
    private authService: AuthService,
    private permissionService: PermissionService
  ) {}

  authenticate() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const user = await this.authService.validateToken(token);
        if (!user) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        req.token = token;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }

  requireAuth() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    };
  }

  requirePermission(permission: Permission | ((req: AuthRequest) => Permission)) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const perm = typeof permission === 'function' ? permission(req) : permission;
      const context = this.buildContext(req);

      const hasPermission = this.permissionService.hasPermission(
        req.user,
        perm,
        context
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: perm,
        });
      }

      next();
    };
  }

  requireRole(...roles: string[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
          error: 'Insufficient role',
          required: roles,
          current: req.user.role,
        });
      }

      next();
    };
  }

  requireOrganization() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const organizationId = req.params.organizationId || req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const canAccess = this.permissionService.canAccessOrganization(
        req.user,
        organizationId
      );

      if (!canAccess) {
        return res.status(403).json({ 
          error: 'Access to organization denied',
          organizationId,
        });
      }

      next();
    };
  }

  optional() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        if (token) {
          const user = await this.authService.validateToken(token);
          if (user) {
            req.user = user;
            req.token = token;
          }
        }
      } catch {
        // Ignore errors for optional auth
      }
      next();
    };
  }

  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    // Check query parameter (for WebSocket connections)
    if (req.query.token && typeof req.query.token === 'string') {
      return req.query.token;
    }

    return null;
  }

  private buildContext(req: AuthRequest): any {
    return {
      userId: req.user?.id,
      organizationId: req.params.organizationId || req.body.organizationId,
      systemId: req.params.systemId || req.body.systemId,
      resourceId: req.params.id,
      method: req.method,
      path: req.path,
    };
  }
}