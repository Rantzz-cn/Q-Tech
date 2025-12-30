# Integration Tests

Integration tests verify that multiple components work together correctly, including API endpoints, database operations, and authentication flows.

## Prerequisites

**Important:** Integration tests require a database connection. The tests will use the database specified in your `.env` file (defaults to `clsu_nexus`).

### Option 1: Use Existing Database (Recommended for Development)
The tests will use your existing development database. Make sure your `.env` file has the correct database credentials.

### Option 2: Create a Separate Test Database
If you want to use a separate test database:

1. Create the test database:
```sql
CREATE DATABASE clsu_nexus_test;
```

2. Run migrations on the test database:
```bash
# Update your .env to point to test database temporarily
DB_NAME=clsu_nexus_test
# Then run migrations
```

3. Or set `DB_NAME=clsu_nexus_test` in your `.env` file before running tests.

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm test -- tests/integration/api.test.js
```

## Test Files

### `api.test.js`
Complete API endpoint integration tests covering:
- Health checks
- Authentication flow (register, login, get me)
- Service operations
- Queue operations
- Admin operations
- Error handling

### `authFlow.test.js`
Detailed authentication flow tests:
- Complete registration and login flow
- Token validation
- Password security
- Session management

### `queueFlow.test.js`
Queue lifecycle integration tests:
- Queue creation
- Queue status retrieval
- Queue cancellation
- Queue validation
- Access control

### `database.test.js`
Database operation tests:
- User model operations
- Service model operations
- Queue model operations
- Transaction integrity

## Test Data Cleanup

Integration tests automatically clean up test data after execution. If tests fail, you may need to manually clean up:

```sql
-- Clean up test users
DELETE FROM users WHERE email LIKE '%@example.com';

-- Clean up test services
DELETE FROM services WHERE name LIKE '%Test%';

-- Clean up test queues
DELETE FROM queue_entries WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@example.com'
);
```

## Notes

- Integration tests use the actual database (configured via `.env`)
- Socket.io is mocked to avoid WebSocket connection issues
- Tests should be run in a test environment or with a separate test database
- Each test file handles its own cleanup in `afterAll` hooks
- Tests will skip database operations if the database doesn't exist (graceful failure)

## Troubleshooting

### Error: "database does not exist"
- Make sure your `.env` file has the correct `DB_NAME`
- Or create the test database: `CREATE DATABASE clsu_nexus_test;`
- Check that PostgreSQL is running

### Error: "connection refused"
- Verify PostgreSQL is running
- Check `DB_HOST`, `DB_PORT` in your `.env` file
- Verify database credentials are correct

### Tests failing with 500 errors
- Check that all required database tables exist
- Run migrations: Check `database/migrations/` folder
- Verify `system_settings` table exists (run migration `002_create_system_settings.sql`)
