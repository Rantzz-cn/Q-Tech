const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
// Support DATABASE_URL (Railway, Heroku, etc.) or individual connection parameters
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // SSL only for public URLs, not for internal Railway networking
      ssl: process.env.DATABASE_URL.includes('.proxy.rlwy.net')
        ? { rejectUnauthorized: false }
        : process.env.DATABASE_URL.includes('railway.internal')
        ? false
        : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'clsu_nexus',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool({
  ...poolConfig,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection function
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection test successful:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testConnection,
};

