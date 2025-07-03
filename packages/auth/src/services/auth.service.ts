import { prisma, User, UserRole, Prisma } from '@cm-diagnostics/database';
import { JWTService } from '../utils/jwt';
import { PasswordService } from '../utils/password';
import { AuthConfig, TokenPair, SessionData } from '../types';
import { z } from 'zod';

export class AuthService {
  private jwtService: JWTService;
  private passwordService: PasswordService;
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

  constructor(private config: AuthConfig) {
    this.jwtService = new JWTService(
      config.jwtSecret,
      config.jwtExpiresIn,
      config.refreshTokenSecret,
      config.refreshTokenExpiresIn
    );
    this.passwordService = new PasswordService(
      config.bcryptRounds,
      config.passwordRequirements
    );
  }

  async register(data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    organizationId?: string;
  }): Promise<{ user: User; tokens: TokenPair }> {
    // Validate password
    const passwordValidation = this.passwordService.validate(data.password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Hash password
    const hashedPassword = await this.passwordService.hash(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: UserRole.USER,
        emailVerified: !this.config.requireEmailVerification,
        organizations: data.organizationId
          ? {
              create: {
                organizationId: data.organizationId,
                role: 'MEMBER',
              },
            }
          : undefined,
      },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Create session
    await this.createSession({
      userId: user.id,
      token: tokens.accessToken,
      expiresAt: new Date(Date.now() + this.config.sessionTimeout * 60 * 1000),
    });

    return { user, tokens };
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // Check login attempts
    const attempts = this.loginAttempts.get(email.toLowerCase());
    if (attempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
      const lockoutTime = this.config.lockoutDuration * 60 * 1000;

      if (attempts.count >= this.config.maxLoginAttempts && timeSinceLastAttempt < lockoutTime) {
        const remainingTime = Math.ceil((lockoutTime - timeSinceLastAttempt) / 60000);
        throw new Error(`Account locked. Try again in ${remainingTime} minutes.`);
      }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      this.recordFailedLogin(email);
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Verify password
    const isValidPassword = await this.passwordService.verify(password, user.password);
    if (!isValidPassword) {
      this.recordFailedLogin(email);
      throw new Error('Invalid credentials');
    }

    // Check email verification
    if (this.config.requireEmailVerification && !user.emailVerified) {
      throw new Error('Please verify your email before logging in');
    }

    // Clear login attempts
    this.loginAttempts.delete(email.toLowerCase());

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Create session
    await this.createSession({
      userId: user.id,
      token: tokens.accessToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + this.config.sessionTimeout * 60 * 1000),
    });

    return { user, tokens };
  }

  async logout(token: string): Promise<void> {
    await prisma.session.delete({
      where: { token },
    });
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = this.jwtService.verifyRefreshToken(refreshToken);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    return this.generateTokens(user);
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verifyAccessToken(token);
      
      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            include: {
              organizations: {
                include: {
                  organization: true,
                },
              },
            },
          },
        },
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      return session.user;
    } catch {
      return null;
    }
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await this.passwordService.verify(oldPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const validation = this.passwordService.validate(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Update password
    const hashedPassword = await this.passwordService.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  async requestPasswordReset(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return 'If an account exists, a reset link has been sent';
    }

    // Generate reset token (simplified - in production, use a secure token)
    const resetToken = this.generateResetToken(user.id);
    
    // TODO: Send email with reset link
    
    return 'Password reset link sent to your email';
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Verify token and get user ID
    const userId = this.verifyResetToken(token);
    
    // Validate new password
    const validation = this.passwordService.validate(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Update password
    const hashedPassword = await this.passwordService.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  private generateTokens(user: User & { organizations?: any[] }): TokenPair {
    const primaryOrg = user.organizations?.[0];
    
    return this.jwtService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: primaryOrg?.organizationId,
      orgRole: primaryOrg?.role,
    });
  }

  private async createSession(data: SessionData): Promise<void> {
    await prisma.session.create({
      data: {
        userId: data.userId,
        token: data.token,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
    });
  }

  private recordFailedLogin(email: string): void {
    const key = email.toLowerCase();
    const attempts = this.loginAttempts.get(key) || { count: 0, lastAttempt: new Date() };
    
    attempts.count++;
    attempts.lastAttempt = new Date();
    
    this.loginAttempts.set(key, attempts);
  }

  private generateResetToken(userId: string): string {
    // Simplified - in production, use a secure random token stored in DB
    return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
  }

  private verifyResetToken(token: string): string {
    // Simplified - in production, verify against DB
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId, timestamp] = decoded.split(':');
    
    // Check if token is expired (24 hours)
    if (Date.now() - parseInt(timestamp) > 24 * 60 * 60 * 1000) {
      throw new Error('Reset token expired');
    }
    
    return userId;
  }
}