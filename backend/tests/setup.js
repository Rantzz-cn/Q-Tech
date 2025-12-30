// Jest setup file
// This runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// For integration tests, use the existing database
// If DB_NAME is not set in .env, it will default to 'clsu_nexus' from database.js
// To use a separate test database, create it first:
//   CREATE DATABASE clsu_nexus_test;
// Then set DB_NAME=clsu_nexus_test in your .env file

// Mock console methods to reduce noise in tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

