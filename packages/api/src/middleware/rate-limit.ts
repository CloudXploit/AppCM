import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Redis } from 'ioredis';

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

// General API rate limiter
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Diagnostic scan rate limiter
export const scanLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:scan:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 scans per hour
  message: 'Too many scan requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP
    return (req as any).user?.id || req.ip;
  }
});

// Report generation rate limiter
export const reportLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:report:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 reports per hour
  message: 'Too many report generation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP
    return (req as any).user?.id || req.ip;
  }
});

// GraphQL-specific rate limiter
export const graphqlLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:graphql:'
  }),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many GraphQL requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP for authenticated requests
    return (req as any).user?.id || req.ip;
  }
});

// WebSocket connection rate limiter
export const wsLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:ws:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 WebSocket connections per hour
  message: 'Too many WebSocket connection attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Dynamic rate limiter based on user role
export function createDynamicLimiter(role: string) {
  const limits: { [key: string]: number } = {
    FREE: 50,
    BASIC: 200,
    PREMIUM: 500,
    ADMIN: 1000
  };

  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: `rl:dynamic:${role}:`
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: limits[role] || limits.FREE,
    message: `Rate limit exceeded for ${role} tier`,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return (req as any).user?.id || req.ip;
    }
  });
}

// GraphQL query complexity limiter
export class GraphQLComplexityLimiter {
  private static complexityScores: Map<string, number> = new Map([
    ['systems', 1],
    ['system', 1],
    ['scans', 5],
    ['scan', 2],
    ['findings', 10],
    ['finding', 2],
    ['reports', 5],
    ['report', 3],
    ['statistics', 15],
    ['createScan', 20],
    ['executeRemediation', 15],
    ['generateReport', 10]
  ]);

  static calculateComplexity(query: any): number {
    let complexity = 0;
    
    // Simple complexity calculation based on requested fields
    const fields = this.extractFields(query);
    
    fields.forEach(field => {
      complexity += this.complexityScores.get(field) || 1;
    });

    return complexity;
  }

  private static extractFields(query: any): string[] {
    // This is a simplified field extraction
    // In production, use a proper GraphQL parser
    const fields: string[] = [];
    const regex = /(\w+)\s*(?:\([^)]*\))?\s*{/g;
    let match;
    
    while ((match = regex.exec(query)) !== null) {
      fields.push(match[1]);
    }
    
    return fields;
  }

  static async checkComplexity(userId: string, complexity: number): Promise<boolean> {
    const key = `complexity:${userId}`;
    const window = 60; // 1 minute window
    const maxComplexity = 1000; // Max complexity per window

    const current = await redis.get(key);
    const currentComplexity = current ? parseInt(current) : 0;

    if (currentComplexity + complexity > maxComplexity) {
      return false;
    }

    await redis.multi()
      .incrby(key, complexity)
      .expire(key, window)
      .exec();

    return true;
  }
}