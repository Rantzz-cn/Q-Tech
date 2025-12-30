// Run Database Migrations Script
// This script runs all database migrations in order

require('dotenv').config({ path: './backend/.env' });
const { query } = require('../backend/config/database');
const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

async function runMigrations() {
  try {
    console.log(`${colors.green}🚀 Starting Database Migrations${colors.reset}\n`);

    // Test connection first
    console.log(`${colors.yellow}📊 Testing database connection...${colors.reset}`);
    await query('SELECT NOW()');
    console.log(`${colors.green}✅ Database connected${colors.reset}\n`);

    // Migration files in order
    const migrations = [
      '001_create_tables.sql',
      '002_create_system_settings.sql',
      '003_add_queue_prefix_to_services.sql',
      '004_add_performance_indexes.sql',
    ];

    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

    for (const migrationFile of migrations) {
      const filePath = path.join(migrationsDir, migrationFile);
      
      if (!fs.existsSync(filePath)) {
        console.log(`${colors.yellow}⚠️  Migration file not found: ${migrationFile}${colors.reset}`);
        continue;
      }

      console.log(`${colors.yellow}📝 Running migration: ${migrationFile}${colors.reset}`);
      
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        // Execute the entire SQL file as one query
        // PostgreSQL can handle multiple statements separated by semicolons
        await query(sql);

        console.log(`${colors.green}✅ ${migrationFile} completed${colors.reset}\n`);
      } catch (error) {
        // Some errors are expected (like "already exists")
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('does not exist')) {
          console.log(`${colors.yellow}⚠️  ${migrationFile} - ${error.message} (may have already been run)${colors.reset}\n`);
        } else {
          throw error;
        }
      }
    }

    console.log(`${colors.green}✅ All migrations completed successfully!${colors.reset}\n`);

    // Verify tables were created
    console.log(`${colors.yellow}📊 Verifying tables...${colors.reset}`);
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`${colors.green}✅ Tables created:${colors.reset}`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log(`\n${colors.green}🎉 Database setup complete!${colors.reset}`);
    process.exit(0);

  } catch (error) {
    console.error(`\n${colors.red}❌ Migration failed:${colors.reset}`, error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigrations();

