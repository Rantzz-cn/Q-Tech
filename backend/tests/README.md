# Backend Testing Guide

This directory contains unit tests for the CLSU NEXUS backend API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run tests:
```bash
npm test
```

3. Run tests in watch mode:
```bash
npm run test:watch
```

4. Run tests with coverage:
```bash
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.js              # Jest configuration and setup
├── models/               # Unit tests for database models
│   ├── User.test.js
│   ├── Service.test.js
│   └── Queue.test.js
├── controllers/          # Unit tests for API controllers
│   ├── authController.test.js
│   └── queueController.test.js
└── integration/          # Integration tests
    ├── api.test.js
    ├── authFlow.test.js
    ├── queueFlow.test.js
    └── database.test.js
```

## Writing Tests

### Model Tests
Test database operations and business logic in models.

### Controller Tests
Test API endpoints, request/response handling, and error cases.

### Integration Tests
Test complete workflows and API interactions.

## Running Specific Tests

```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run a specific test file
npm test User.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="findByEmail"
```

## Coverage

Coverage reports are generated in the `coverage/` directory after running:
```bash
npm run test:coverage
```

