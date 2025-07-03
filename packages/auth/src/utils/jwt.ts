import jwt from 'jsonwebtoken';
import { JWTPayload, TokenPair } from '../types';

export class JWTService {
  constructor(
    private jwtSecret: string,
    private jwtExpiresIn: string,
    private refreshTokenSecret: string,
    private refreshTokenExpiresIn: string
  ) {}

  generateTokenPair(payload: JWTPayload): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return { accessToken, refreshToken };
  }

  generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'cm-diagnostics',
      audience: 'cm-diagnostics-api',
    });
  }

  generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(
      { userId: payload.userId, type: 'refresh' },
      this.refreshTokenSecret,
      {
        expiresIn: this.refreshTokenExpiresIn,
        issuer: 'cm-diagnostics',
      }
    );
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'cm-diagnostics',
        audience: 'cm-diagnostics-api',
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  verifyRefreshToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'cm-diagnostics',
      }) as { userId: string; type: string };
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      return { userId: decoded.userId };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }
}