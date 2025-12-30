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

describe('Queue Flow Integration Tests', () => {
  let studentToken;
  let adminToken;
  let serviceId;
  let queueId;

  beforeAll(async () => {
    // Create test student
    const studentRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'queuestudent@example.com',
        password: 'Password123!',
        firstName: 'Queue',
        lastName: 'Student',
        role: 'student',
      });

    studentToken = studentRes.body.data.token;

    // Create test admin
    let adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'queueadmin@example.com',
        password: 'Password123!',
        firstName: 'Queue',
        lastName: 'Admin',
        role: 'admin',
      });

    if (adminRes.status === 400) {
      adminRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'queueadmin@example.com',
          password: 'Password123!',
        });
    }

    adminToken = adminRes.body.data.token;

    // Create test service
    const serviceRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Queue Test Service',
        description: 'Service for queue flow testing',
        estimated_service_time: 10,
        max_queue_size: 50,
      });

    serviceId = serviceRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up
    try {
      if (serviceId) {
        await query(`
          DELETE FROM queue_entries WHERE service_id = $1
        `, [serviceId]).catch(() => {});
        await query(`
          DELETE FROM services WHERE id = $1
        `, [serviceId]).catch(() => {});
      }
      await query(`
        DELETE FROM users WHERE email IN ('queuestudent@example.com', 'queueadmin@example.com')
      `).catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Queue Lifecycle', () => {
    it('should create queue entry', async () => {
      const response = await request(app)
        .post('/api/queue/request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ serviceId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.queueNumber).toMatch(/^[A-Z]+-\d+$/);
      expect(response.body.data.status).toBe('waiting');
      expect(response.body.data.queuePosition).toBeGreaterThan(0);

      queueId = response.body.data.id;
    });

    it('should retrieve queue status', async () => {
      const response = await request(app)
        .get(`/api/queue/${queueId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(queueId);
      expect(response.body.data.status).toBe('waiting');
    });

    it('should get service queue status', async () => {
      const response = await request(app)
        .get(`/api/queue/status/${serviceId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.serviceId).toBe(serviceId);
      expect(response.body.data.waitingCount).toBeGreaterThanOrEqual(0);
    });

    it('should cancel queue entry', async () => {
      const response = await request(app)
        .delete(`/api/queue/${queueId}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled');
    });

    it('should not allow operations on cancelled queue', async () => {
      const response = await request(app)
        .get(`/api/queue/${queueId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('Queue Validation', () => {
    it('should reject queue request without serviceId', async () => {
      const response = await request(app)
        .post('/api/queue/request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject queue request for non-existent service', async () => {
      const response = await request(app)
        .post('/api/queue/request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ serviceId: 99999 })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should prevent duplicate active queues for same service', async () => {
      // Create first queue
      const firstQueue = await request(app)
        .post('/api/queue/request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ serviceId })
        .expect(201);

      // Try to create second queue
      const secondQueue = await request(app)
        .post('/api/queue/request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ serviceId })
        .expect(400);

      expect(secondQueue.body.success).toBe(false);
      expect(secondQueue.body.error.message).toContain('already have an active queue');

      // Clean up
      await request(app)
        .delete(`/api/queue/${firstQueue.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`);
    });
  });

  describe('Queue Access Control', () => {
    it('should allow user to access their own queue', async () => {
      const queueRes = await request(app)
        .post('/api/queue/request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ serviceId })
        .expect(201);

      const statusRes = await request(app)
        .get(`/api/queue/${queueRes.body.data.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(statusRes.body.success).toBe(true);

      // Clean up
      await request(app)
        .delete(`/api/queue/${queueRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`);
    });

    it('should require authentication for queue operations', async () => {
      const response = await request(app)
        .post('/api/queue/request')
        .send({ serviceId })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

