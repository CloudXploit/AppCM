export * from './types';
export * from './services/auth.service';
export * from './services/permission.service';
export * from './middleware/auth.middleware';
export * from './utils/jwt';
export * from './utils/password';

// Default auth configuration
export const defaultAuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'change-this-refresh-secret',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  bcryptRounds: 10,
  passwordRequirements: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
  },
  maxLoginAttempts: 5,
  lockoutDuration: 30, // minutes
  sessionTimeout: 60 * 24, // 24 hours in minutes
  requireEmailVerification: process.env.NODE_ENV === 'production',
};