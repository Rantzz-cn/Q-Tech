const User = require('../../models/User');
const { query } = require('../../config/database');

// Mock the database query function
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
      };

      query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await User.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test@example.com']
      );
    });

    it('should return null when email does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when id exists', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      };

      query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await User.findById(1);

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    it('should return null when id does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findById(999);

      expect(result).toBeNull();
    });
  });
});

