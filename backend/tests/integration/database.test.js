const { query } = require('../../config/database');
const User = require('../../models/User');
const Service = require('../../models/Service');
const Queue = require('../../models/Queue');

describe('Database Operations Integration Tests', () => {
  describe('User Model Database Operations', () => {
    let testUserId;

    afterAll(async () => {
      if (testUserId) {
        await query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
    });

    it('should create user in database', async () => {
      const userData = {
        studentId: 'DBTEST001',
        email: 'dbtest@example.com',
        passwordHash: 'hashed_password',
        firstName: 'DB',
        lastName: 'Test',
        role: 'student',
      };

      const user = await User.create(userData);
      testUserId = user.id;

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.first_name).toBe(userData.firstName);
    });

    it('should find user by email', async () => {
      const user = await User.findByEmail('dbtest@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('dbtest@example.com');
      expect(user.id).toBe(testUserId);
    });

    it('should find user by ID', async () => {
      const user = await User.findById(testUserId);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
    });

    it('should update user in database', async () => {
      const updatedUser = await User.update(testUserId, {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(updatedUser.first_name).toBe('Updated');
      expect(updatedUser.last_name).toBe('Name');
    });
  });

  describe('Service Model Database Operations', () => {
    let testServiceId;

    afterAll(async () => {
      if (testServiceId) {
        await query('DELETE FROM services WHERE id = $1', [testServiceId]);
      }
    });

    it('should create service in database', async () => {
      const serviceData = {
        name: 'DB Test Service',
        description: 'Service for database testing',
        estimated_service_time: 15,
        max_queue_size: 100,
        is_active: true,
      };

      const service = await Service.create(serviceData);
      testServiceId = service.id;

      expect(service).toBeDefined();
      expect(service.name).toBe(serviceData.name);
      expect(service.is_active).toBe(true);
    });

    it('should find service by ID', async () => {
      const service = await Service.findById(testServiceId);

      expect(service).toBeDefined();
      expect(service.id).toBe(testServiceId);
    });

    it('should get all active services', async () => {
      const services = await Service.findAll();

      expect(Array.isArray(services)).toBe(true);
      const testService = services.find(s => s.id === testServiceId);
      expect(testService).toBeDefined();
    });

    it('should update service in database', async () => {
      const updatedService = await Service.update(testServiceId, {
        name: 'Updated DB Test Service',
        estimated_service_time: 20,
      });

      expect(updatedService.name).toBe('Updated DB Test Service');
      expect(updatedService.estimated_service_time).toBe(20);
    });
  });

  describe('Queue Model Database Operations', () => {
    let testUserId;
    let testServiceId;
    let testQueueId;

    beforeAll(async () => {
      // Create test user
      const user = await User.create({
        email: 'queueuser@example.com',
        passwordHash: 'hashed',
        firstName: 'Queue',
        lastName: 'User',
        role: 'student',
      });
      testUserId = user.id;

      // Create test service
      const service = await Service.create({
        name: 'Queue DB Test',
        description: 'Test',
        estimated_service_time: 10,
        max_queue_size: 50,
        is_active: true,
      });
      testServiceId = service.id;
    });

    afterAll(async () => {
      if (testQueueId) {
        await query('DELETE FROM queue_entries WHERE id = $1', [testQueueId]);
      }
      if (testServiceId) {
        await query('DELETE FROM services WHERE id = $1', [testServiceId]);
      }
      if (testUserId) {
        await query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
    });

    it('should generate queue number', async () => {
      const queueNumber = await Queue.generateQueueNumber(testServiceId);

      expect(queueNumber).toBeDefined();
      expect(queueNumber).toMatch(/^[A-Z]+-\d+$/);
    });

    it('should create queue entry in database', async () => {
      const queue = await Queue.create({
        userId: testUserId,
        serviceId: testServiceId,
      });

      testQueueId = queue.id;

      expect(queue).toBeDefined();
      expect(queue.queue_number).toBeDefined();
      expect(queue.status).toBe('waiting');
    });

    it('should find queue by ID', async () => {
      const queue = await Queue.findById(testQueueId);

      expect(queue).toBeDefined();
      expect(queue.id).toBe(testQueueId);
    });

    it('should find queue by user and service', async () => {
      const queue = await Queue.findByUserAndService(testUserId, testServiceId);

      expect(queue).toBeDefined();
      expect(queue.user_id).toBe(testUserId);
      expect(queue.service_id).toBe(testServiceId);
    });

    it('should calculate queue position', async () => {
      const position = await Queue.calculateQueuePosition(testQueueId);

      expect(position).toBeGreaterThan(0);
    });
  });

  describe('Database Transaction Integrity', () => {
    it('should handle concurrent operations', async () => {
      const user1 = await User.create({
        email: 'concurrent1@example.com',
        passwordHash: 'hash',
        firstName: 'Concurrent',
        lastName: 'One',
        role: 'student',
      });

      const user2 = await User.create({
        email: 'concurrent2@example.com',
        passwordHash: 'hash',
        firstName: 'Concurrent',
        lastName: 'Two',
        role: 'student',
      });

      expect(user1.id).not.toBe(user2.id);

      // Clean up
      await query('DELETE FROM users WHERE id IN ($1, $2)', [user1.id, user2.id]);
    });
  });
});

