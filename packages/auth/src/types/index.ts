import { User, UserRole, Organization, OrgRole } from '@cm-diagnostics/database';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  orgRole?: OrgRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContext {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  permissions: string[];
}

export interface SessionData {
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  passwordRequirements: PasswordRequirements;
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  sessionTimeout: number; // in minutes
  requireEmailVerification: boolean;
}

export interface Permission {
  resource: string;
  action: string;
  scope?: 'own' | 'organization' | 'all';
}

export type PermissionCheck = (
  user: User,
  permission: Permission,
  context?: any
) => boolean | Promise<boolean>;