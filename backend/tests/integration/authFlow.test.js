const request = require('supertest');
const app = require('../../server');
const { query } = require('../../config/database');

// Mock socket server
jest.mock('../../socket/socketServer', () => ({
  initialize: jest.fn(),
  emitQueueUpdate: jest.fn(),
  emitQueueCalled: jest.fn(),
  emitCounterUpdate: jest.fn(),
}));

describe('Authentication Flow Integration Tests', () => {
  let userToken;
  let userId;

  afterAll(async () => {
    // Clean up
    try {
      await query(`DELETE FROM users WHERE email = 'authflow@example.com'`).catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Registration and Login Flow', () => {
    it('should complete full registration flow', async () => {
      // Step 1: Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'authflow@example.com',
          password: 'SecurePass123!',
          firstName: 'Auth',
          lastName: 'Flow',
          studentId: 'AUTH001',
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe('authflow@example.com');
      expect(registerResponse.body.data.token).toBeDefined();

      userId = registerResponse.body.data.user.id;
      userToken = registerResponse.body.data.token;

      // Step 2: Verify token works by getting user info
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(meResponse.body.data.id).toBe(userId);
      expect(meResponse.body.data.email).toBe('authflow@example.com');
    });

    it('should login and maintain session', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authflow@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      const newToken = loginResponse.body.data.token;

      // Use new token to access protected route
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(meResponse.body.data.email).toBe('authflow@example.com');
    });

    it('should handle case-insensitive email login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'AUTHFLOW@EXAMPLE.COM',
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Token Validation', () => {
    it('should reject invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords and not return them in responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authflow@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      // Verify password_hash is not in response
      expect(response.body.data.user.password_hash).toBeUndefined();
      expect(response.body.data.user.password).toBeUndefined();
    });
  });
});

