import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  handleRegister, 
  handleLogin, 
  handleGoogleAuth,
  handleMe,
  handleLogout,
  handleProfile,
  handleChangePassword
} from '../../routes/auth';
import { createMockContext, mockUsers } from '../mocks/context';

// Mock dependencies
vi.mock('../../auth', () => ({
  getUidFromSession: vi.fn()
}));

vi.mock('../../user', () => ({
  getUserByName: vi.fn(),
  createNewUserWithSchema: vi.fn()
}));

vi.mock('../../utils', () => ({
  generateIdBase62: vi.fn(() => 'mock_id_123'),
  hashPasswordArgon2id: vi.fn(() => Promise.resolve('mock_hashed_password')),
  verifyPasswordHash: vi.fn(),
  randomHex: vi.fn(() => 'mock_hex_123'),
  nowMs: vi.fn(() => 1756391518443)
}));

vi.mock('../../worker-utils', () => ({
  getAnalyticsManager: vi.fn(() => ({
    trackEvent: vi.fn()
  }))
}));

vi.mock('../../../../../packages/shared/src/cookies', () => ({
  signSession: vi.fn(() => Promise.resolve('mock_session_token'))
}));

import { getUidFromSession } from '../../auth';
import { getUserByName } from '../../user';
import { generateIdBase62, hashPasswordArgon2id, verifyPasswordHash } from '../../utils';
import { getAnalyticsManager } from '../../worker-utils';
import { signSession } from '../../../../../packages/shared/src/cookies';

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleRegister', () => {
    it('should register a new user successfully', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      // Mock successful registration flow
      (getUserByName as any).mockResolvedValue(null); // User doesn't exist
      mockContext.env.KV_USERS.get.mockResolvedValue(null); // Email doesn't exist
      
      await handleRegister(mockContext);

      expect(mockContext.env.KV_USERS.put).toHaveBeenCalledTimes(3); // user, byname, byemail
      expect(mockContext.json).toHaveBeenCalledWith({
        ok: true,
        user: expect.objectContaining({
          uid: 'mock_id_123',
          name: 'Test User',
          email: 'test@example.com'
        }),
        sessionToken: 'mock_session_token'
      });
    });

    it('should return error for missing required fields', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'test@example.com'
        // Missing password and name
      });

      await handleRegister(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing required fields' },
        400
      );
    });

    it('should return error for existing username', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'test@example.com',
        password: 'password123',
        name: 'ExistingUser'
      });

      (getUserByName as any).mockResolvedValue(mockUsers.freeUser); // User exists

      await handleRegister(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Username already taken' },
        400
      );
    });

    it('should return error for existing email', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'existing@example.com',
        password: 'password123',
        name: 'NewUser'
      });

      (getUserByName as any).mockResolvedValue(null); // Username available
      mockContext.env.KV_USERS.get.mockResolvedValue('existing_user_id'); // Email exists

      await handleRegister(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Email already registered' },
        400
      );
    });

    it('should handle registration errors gracefully', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      (getUserByName as any).mockRejectedValue(new Error('Database error'));

      await handleRegister(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Registration failed' },
        500
      );
    });
  });

  describe('handleLogin', () => {
    it('should login user with valid credentials', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'test@example.com',
        password: 'password123'
      });

      // Mock successful login flow
      mockContext.env.KV_USERS.get
        .mockResolvedValueOnce('user_123') // Email lookup
        .mockResolvedValueOnce(JSON.stringify(mockUsers.freeUser)); // User data

      (verifyPasswordHash as any).mockResolvedValue(true);
      (signSession as any).mockResolvedValue('mock_session_token');

      await handleLogin(mockContext);

      expect(mockContext.env.KV_USERS.put).toHaveBeenCalledWith(
        'user:user_123',
        expect.stringContaining('"lastLoginAt"')
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        ok: true,
        user: expect.objectContaining({
          uid: mockUsers.freeUser.uid,
          name: mockUsers.freeUser.name,
          email: mockUsers.freeUser.email
        }),
        sessionToken: 'mock_session_token'
      });
    });

    it('should return error for missing credentials', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'test@example.com'
        // Missing password
      });

      await handleLogin(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing email or password' },
        400
      );
    });

    it('should return error for invalid email', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

      mockContext.env.KV_USERS.get.mockResolvedValue(null); // Email not found

      await handleLogin(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Invalid credentials' },
        401
      );
    });

    it('should return error for invalid password', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      mockContext.env.KV_USERS.get
        .mockResolvedValueOnce('user_123')
        .mockResolvedValueOnce(JSON.stringify(mockUsers.freeUser));

      (verifyPasswordHash as any).mockResolvedValue(false);

      await handleLogin(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Invalid credentials' },
        401
      );
    });
  });

  describe('handleMe', () => {
    it('should return user data for authenticated user', async () => {
      const mockContext = createMockContext();
      
      (getUidFromSession as any).mockResolvedValue('user_123');
      mockContext.env.KV_USERS.get.mockResolvedValue(JSON.stringify(mockUsers.freeUser));

      await handleMe(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          uid: mockUsers.freeUser.uid,
          name: mockUsers.freeUser.name,
          email: mockUsers.freeUser.email,
          plan: mockUsers.freeUser.plan,
          role: mockUsers.freeUser.role
        })
      });
    });

    it('should return unauthorized for unauthenticated user', async () => {
      const mockContext = createMockContext();
      
      (getUidFromSession as any).mockResolvedValue(null);

      await handleMe(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { user: null }
      );
    });

    it('should return not found for non-existent user', async () => {
      const mockContext = createMockContext();
      
      (getUidFromSession as any).mockResolvedValue('user_999');
      mockContext.env.KV_USERS.get.mockResolvedValue(null);

      await handleMe(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { user: null }
      );
    });
  });

  describe('handleLogout', () => {
    it('should return success for logout', async () => {
      const mockContext = createMockContext();

      await handleLogout(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith({
        ok: true
      });
    });
  });

  describe('handleProfile', () => {
    it('should update user profile successfully', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        name: 'Updated Name'
      });

      (getUidFromSession as any).mockResolvedValue('user_123');
      mockContext.env.KV_USERS.get
        .mockResolvedValueOnce(JSON.stringify(mockUsers.freeUser)) // User data
        .mockResolvedValueOnce(null); // Name lookup - name not taken

      await handleProfile(mockContext);

      expect(mockContext.env.KV_USERS.put).toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith({
        ok: true,
        user: { uid: 'user_123', name: 'Updated Name', email: 'test@example.com', plan: 'free' }
      });
    });

    it('should return unauthorized for unauthenticated user', async () => {
      const mockContext = createMockContext();
      
      (getUidFromSession as any).mockResolvedValue(null);

      await handleProfile(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'unauthorized' },
        401
      );
    });
  });

  describe('handleChangePassword', () => {
    it('should change password successfully', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      });

      (getUidFromSession as any).mockResolvedValue('user_123');
      mockContext.env.KV_USERS.get.mockResolvedValue(JSON.stringify({
        ...mockUsers.freeUser,
        passwordHash: 'old_hash'
      }));
      (verifyPasswordHash as any).mockResolvedValue(true);

      await handleChangePassword(mockContext);

      expect(mockContext.env.KV_USERS.put).toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith({
        ok: true
      });
    });

    it('should return error for invalid current password', async () => {
      const mockContext = createMockContext();
      mockContext.req.json.mockResolvedValue({
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      });

      (getUidFromSession as any).mockResolvedValue('user_123');
      mockContext.env.KV_USERS.get.mockResolvedValue(JSON.stringify({
        ...mockUsers.freeUser,
        passwordHash: 'hash'
      }));
      (verifyPasswordHash as any).mockResolvedValue(false);

      await handleChangePassword(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'invalid_password' },
        401
      );
    });

    it('should return unauthorized for unauthenticated user', async () => {
      const mockContext = createMockContext();
      
      (getUidFromSession as any).mockResolvedValue(null);

      await handleChangePassword(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'unauthorized' },
        401
      );
    });
  });
});