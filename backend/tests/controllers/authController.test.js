const authController = require('../../controllers/authController');
const User = require('../../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../models/User', () => ({
  findByEmail: jest.fn(),
  toSafeUser: jest.fn((user) => {
    if (!user) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }),
}));
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return token and user data on successful login', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
        is_active: true,
      };

      const mockReq = {
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      // Mock User.toSafeUser to return a safe user object
      User.toSafeUser = jest.fn((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      }));

      User.findByEmail.mockResolvedValueOnce(mockUser);
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce('mock-jwt-token');

      await authController.login(mockReq, mockRes);

      // Email is lowercased in the actual implementation
      expect(User.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: 'mock-jwt-token',
          }),
        })
      );
    });

    it('should return error when user not found', async () => {
      const mockReq = {
        body: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      User.findByEmail.mockResolvedValueOnce(null);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should return error when password is incorrect', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashed_password',
        is_active: true,
      };

      const mockReq = {
        body: {
          email: 'test@example.com',
          password: 'wrong_password',
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      User.findByEmail.mockResolvedValueOnce(mockUser);
      bcrypt.compare.mockResolvedValueOnce(false);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });
});

