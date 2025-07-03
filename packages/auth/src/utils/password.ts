import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PasswordRequirements } from '../types';

const commonPasswords = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'password123', 'admin', 'letmein', 'welcome', '123456789',
];

export class PasswordService {
  constructor(
    private bcryptRounds: number,
    private requirements: PasswordRequirements
  ) {}

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.requirements.minLength) {
      errors.push(`Password must be at least ${this.requirements.minLength} characters long`);
    }

    if (this.requirements.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.requirements.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.requirements.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.requirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (this.requirements.preventCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (commonPasswords.some(common => lowerPassword.includes(common))) {
        errors.push('Password is too common or easily guessable');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let chars = '';
    let password = '';

    // Ensure at least one of each required type
    if (this.requirements.requireUppercase) {
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      chars += uppercase;
    }
    if (this.requirements.requireLowercase) {
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      chars += lowercase;
    }
    if (this.requirements.requireNumbers) {
      password += numbers[Math.floor(Math.random() * numbers.length)];
      chars += numbers;
    }
    if (this.requirements.requireSpecialChars) {
      password += special[Math.floor(Math.random() * special.length)];
      chars += special;
    }

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  getPasswordSchema() {
    return z
      .string()
      .min(this.requirements.minLength)
      .refine((password) => {
        const { valid } = this.validate(password);
        return valid;
      }, {
        message: 'Password does not meet requirements',
      });
  }
}