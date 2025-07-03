import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { Context } from '../context';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

export const authResolvers = {
  Query: {
    me: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return context.user;
    }
  },

  Mutation: {
    login: async (_: any, args: { username: string; password: string }, context: Context) => {
      const { username, password } = args;

      // Find user
      const user = await context.prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'INVALID_CREDENTIALS' }
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'INVALID_CREDENTIALS' }
        });
      }

      // Update last login
      await context.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Generate token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return {
        token,
        user,
        expiresIn: 86400 // 24 hours in seconds
      };
    },

    logout: async (_: any, __: any, context: Context) => {
      // In a real implementation, you might want to invalidate the token
      // For now, we'll just return true
      return true;
    },

    changePassword: async (
      _: any, 
      args: { oldPassword: string; newPassword: string }, 
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const { oldPassword, newPassword } = args;

      // Verify old password
      const user = await context.prisma.user.findUnique({
        where: { id: context.user.id }
      });

      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'USER_NOT_FOUND' }
        });
      }

      const validPassword = await bcrypt.compare(oldPassword, user.password);
      if (!validPassword) {
        throw new GraphQLError('Invalid old password', {
          extensions: { code: 'INVALID_PASSWORD' }
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await context.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      return true;
    },

    updatePreferences: async (
      _: any,
      args: { preferences: any },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const updatedUser = await context.prisma.user.update({
        where: { id: context.user.id },
        data: { preferences: args.preferences }
      });

      return updatedUser;
    }
  }
};

// Helper function to verify JWT token
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Helper function to require authentication
export function requireAuth(context: Context): void {
  if (!context.user) {
    throw new GraphQLError('You must be logged in to perform this action', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
}

// Helper function to require specific role
export function requireRole(context: Context, role: string): void {
  requireAuth(context);
  
  if (context.user!.role !== role && context.user!.role !== 'ADMIN') {
    throw new GraphQLError('You do not have permission to perform this action', {
      extensions: { code: 'FORBIDDEN' }
    });
  }
}