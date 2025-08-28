import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateEmail,
  validatePassword,
  parseLimit,
  parseExpiryDays
} from '../../validation/request';

describe('Request Validation', () => {
  describe('validateRequired', () => {
    it('should return valid for all required fields present', () => {
      const fields = { name: 'John', email: 'john@example.com', password: 'secret' };
      const required = ['name', 'email', 'password'];
      
      const result = validateRequired(fields, required);
      
      expect(result.valid).toBe(true);
      expect(result.missing).toBeUndefined();
    });

    it('should return invalid with missing fields', () => {
      const fields = { name: 'John', password: 'secret' };
      const required = ['name', 'email', 'password'];
      
      const result = validateRequired(fields, required);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['email']);
    });

    it('should return invalid with multiple missing fields', () => {
      const fields = { name: 'John' };
      const required = ['name', 'email', 'password'];
      
      const result = validateRequired(fields, required);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['email', 'password']);
    });

    it('should handle empty string values as missing', () => {
      const fields = { name: 'John', email: '', password: 'secret' };
      const required = ['name', 'email', 'password'];
      
      const result = validateRequired(fields, required);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['email']);
    });

    it('should handle null/undefined values as missing', () => {
      const fields = { name: 'John', email: null, password: undefined };
      const required = ['name', 'email', 'password'];
      
      const result = validateRequired(fields, required);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['email', 'password']);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+label@example.org',
        'user123@subdomain.example.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com', 
        'test@',
        'test@example',
        '',
        'test space@example.com'
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate password with 8 or more characters', () => {
      const validPasswords = [
        'password',
        'verylongpassword',
        '12345678',
        'P@ssw0rd!'
      ];

      validPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
      });
    });

    it('should reject passwords with less than 8 characters', () => {
      const invalidPasswords = [
        'short',
        '1234567',
        'abc',
        ''
      ];

      invalidPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Password must be at least 8 characters long');
      });
    });

    it('should handle null/undefined passwords', () => {
      const result1 = validatePassword(null as any);
      const result2 = validatePassword(undefined as any);

      expect(result1.valid).toBe(false);
      expect(result1.message).toBe('Password must be at least 8 characters long');
      expect(result2.valid).toBe(false);
      expect(result2.message).toBe('Password must be at least 8 characters long');
    });
  });

  describe('parseLimit', () => {
    it('should return default limit for undefined input', () => {
      expect(parseLimit(undefined)).toBe(100);
      expect(parseLimit(undefined, 50)).toBe(50);
    });

    it('should parse valid numeric strings', () => {
      expect(parseLimit('25')).toBe(25);
      expect(parseLimit('500')).toBe(500);
      expect(parseLimit('1')).toBe(1);
    });

    it('should enforce maximum limit', () => {
      expect(parseLimit('2000')).toBe(1000); // Default max is 1000
      expect(parseLimit('500', 100, 200)).toBe(200); // Custom max is 200
    });

    it('should return default for invalid inputs', () => {
      expect(parseLimit('invalid')).toBe(100);
      expect(parseLimit('0')).toBe(100);
      expect(parseLimit('-10')).toBe(100);
      expect(parseLimit('')).toBe(100);
    });

    it('should handle custom defaults and maxes', () => {
      expect(parseLimit(undefined, 25, 50)).toBe(25);
      expect(parseLimit('75', 25, 50)).toBe(50);
      expect(parseLimit('30', 25, 50)).toBe(30);
    });
  });

  describe('parseExpiryDays', () => {
    it('should return default days for undefined/null input', () => {
      expect(parseExpiryDays(undefined)).toBe(7);
      expect(parseExpiryDays(null)).toBe(7);
      expect(parseExpiryDays(undefined, 14)).toBe(14);
    });

    it('should parse valid numeric values', () => {
      expect(parseExpiryDays(1)).toBe(1);
      expect(parseExpiryDays(30)).toBe(30);
      expect(parseExpiryDays(90)).toBe(90);
    });

    it('should parse numeric strings', () => {
      expect(parseExpiryDays('15')).toBe(15);
      expect(parseExpiryDays('7')).toBe(7);
      expect(parseExpiryDays('365')).toBe(365);
    });

    it('should enforce maximum days limit', () => {
      expect(parseExpiryDays(500)).toBe(365); // Default max is 365
      expect(parseExpiryDays(100, 7, 30)).toBe(30); // Custom max is 30
    });

    it('should return default for invalid inputs', () => {
      expect(parseExpiryDays(0)).toBe(7);
      expect(parseExpiryDays(-5)).toBe(7);
      expect(parseExpiryDays('invalid')).toBe(7);
      expect(parseExpiryDays('')).toBe(7);
    });

    it('should handle custom defaults and maxes', () => {
      expect(parseExpiryDays(undefined, 14, 30)).toBe(14);
      expect(parseExpiryDays(50, 14, 30)).toBe(30);
      expect(parseExpiryDays(20, 14, 30)).toBe(20);
    });
  });
});