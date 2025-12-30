const Service = require('../../models/Service');
const { query } = require('../../config/database');

jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

describe('Service Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return only active services by default', async () => {
      const mockServices = [
        { id: 1, name: 'Registrar', is_active: true },
        { id: 2, name: 'Clinic', is_active: true },
      ];

      query.mockResolvedValueOnce({ rows: mockServices });

      const result = await Service.findAll();

      expect(result).toEqual(mockServices);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true')
      );
    });

    it('should return all services when includeInactive is true', async () => {
      const mockServices = [
        { id: 1, name: 'Registrar', is_active: true },
        { id: 2, name: 'Clinic', is_active: false },
      ];

      query.mockResolvedValueOnce({ rows: mockServices });

      const result = await Service.findAll(true);

      expect(result).toEqual(mockServices);
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE is_active')
      );
    });
  });

  describe('findById', () => {
    it('should return service when id exists', async () => {
      const mockService = {
        id: 1,
        name: 'Registrar',
        description: 'Registration services',
        is_active: true,
      };

      query.mockResolvedValueOnce({ rows: [mockService] });

      const result = await Service.findById(1);

      expect(result).toEqual(mockService);
    });

    it('should return null when id does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await Service.findById(999);

      expect(result).toBeNull();
    });
  });
});

