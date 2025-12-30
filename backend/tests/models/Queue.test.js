const Queue = require('../../models/Queue');
const { query } = require('../../config/database');

jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

describe('Queue Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateQueueNumber', () => {
    it('should generate queue number with service name prefix when queue_prefix is empty', async () => {
      const mockService = {
        name: 'Registrar',
        queue_prefix: '',
      };

      query
        .mockResolvedValueOnce({ rows: [mockService] }) // Service query
        .mockResolvedValueOnce({ rows: [] }); // Last queue query

      const result = await Queue.generateQueueNumber(1);

      expect(result).toBe('REG-001');
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should generate queue number with custom prefix when queue_prefix is set', async () => {
      const mockService = {
        name: 'Clinic',
        queue_prefix: 'CLI',
      };

      query
        .mockResolvedValueOnce({ rows: [mockService] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await Queue.generateQueueNumber(1);

      expect(result).toBe('CLI-001');
    });

    it('should increment queue number based on last queue', async () => {
      const mockService = {
        name: 'Registrar',
        queue_prefix: '',
      };

      const lastQueue = {
        queue_number: 'REG-005',
      };

      query
        .mockResolvedValueOnce({ rows: [mockService] })
        .mockResolvedValueOnce({ rows: [lastQueue] });

      const result = await Queue.generateQueueNumber(1);

      expect(result).toBe('REG-006');
    });

    it('should throw error when service not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(Queue.generateQueueNumber(999)).rejects.toThrow('Service not found');
    });
  });

  describe('calculateQueuePosition', () => {
    it('should return 1 when no waiting queues exist', async () => {
      query.mockResolvedValueOnce({ rows: [{ position: '0' }] });

      const result = await Queue.calculateQueuePosition(1);

      expect(result).toBe(1);
    });

    it('should return correct position when waiting queues exist', async () => {
      query.mockResolvedValueOnce({ rows: [{ position: '5' }] });

      const result = await Queue.calculateQueuePosition(1);

      expect(result).toBe(6); // position + 1
    });
  });
});

