const queueController = require('../../controllers/queueController');
const Queue = require('../../models/Queue');
const Service = require('../../models/Service');
const { query } = require('../../config/database');

jest.mock('../../models/Queue');
jest.mock('../../models/Service');
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../../socket/queueEvents', () => ({
  emitQueueCreated: jest.fn().mockResolvedValue(undefined),
  emitQueueCancelled: jest.fn().mockResolvedValue(undefined),
}));

describe('Queue Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestQueue', () => {
    it('should create queue when maintenance mode is disabled', async () => {
      const mockUser = { userId: 1, role: 'student' };
      const mockService = {
        id: 1,
        name: 'Registrar',
        is_active: true,
      };
      const mockQueue = {
        id: 1,
        queue_number: 'REG-001',
        queue_position: 1,
        service_id: 1,
        estimated_wait_time: 5,
        status: 'waiting',
        requested_at: new Date(),
      };

      const mockReq = {
        user: mockUser,
        body: { serviceId: 1 },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      // Mock maintenance mode check (system_settings query)
      query.mockResolvedValueOnce({
        rows: [{
          settings: {
            system_maintenance_mode: false,
            maintenance_message: '',
          },
        }],
      });

      Service.findById.mockResolvedValueOnce(mockService);
      Queue.findByUserAndService.mockResolvedValueOnce(null);
      Queue.create.mockResolvedValueOnce(mockQueue);

      await queueController.requestQueue(mockReq, mockRes);

      expect(Service.findById).toHaveBeenCalledWith(1);
      expect(Queue.create).toHaveBeenCalledWith({
        userId: 1,
        serviceId: 1,
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            queueNumber: 'REG-001',
          }),
        })
      );
    });

    it('should block queue request when maintenance mode is enabled', async () => {
      const mockReq = {
        user: { userId: 1 },
        body: { serviceId: 1 },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      // Mock maintenance mode enabled
      query.mockResolvedValueOnce({
        rows: [{
          settings: {
            system_maintenance_mode: true,
            maintenance_message: 'System under maintenance',
          },
        }],
      });

      await queueController.requestQueue(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            maintenanceMode: true,
            message: 'System under maintenance',
          }),
        })
      );
      expect(Queue.create).not.toHaveBeenCalled();
    });

    it('should return error when service not found', async () => {
      const mockReq = {
        user: { userId: 1 },
        body: { serviceId: 999 },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      query.mockResolvedValueOnce({
        rows: [{
          settings: {
            system_maintenance_mode: false,
          },
        }],
      });

      Service.findById.mockResolvedValueOnce(null);

      await queueController.requestQueue(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });
});

