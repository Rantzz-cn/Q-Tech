require('dotenv').config({ path: '../backend/.env' });
const { query } = require('../backend/config/database');

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

async function verifySchema() {
  try {
    console.log(`${colors.blue}🔍 Verifying Database Schema${colors.reset}\n`);

    // Test connection
    await query('SELECT NOW()');
    console.log(`${colors.green}✅ Database connected${colors.reset}\n`);

    // Check if services table exists
    console.log(`${colors.yellow}📊 Checking services table...${colors.reset}`);
    const servicesCheck = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'services'
      ORDER BY ordinal_position;
    `);
    
    console.log(`${colors.green}✅ Services table columns:${colors.reset}`);
    servicesCheck.rows.forEach(col => {
      const hasQueuePrefix = col.column_name === 'queue_prefix';
      const marker = hasQueuePrefix ? `${colors.green}✓${colors.reset}` : ' ';
      console.log(`   ${marker} ${col.column_name} (${col.data_type})`);
    });

    const hasQueuePrefix = servicesCheck.rows.some(col => col.column_name === 'queue_prefix');
    if (!hasQueuePrefix) {
      console.log(`\n${colors.red}❌ queue_prefix column is missing!${colors.reset}`);
      console.log(`${colors.yellow}   Run migration: node scripts/run-migrations.js${colors.reset}\n`);
    } else {
      console.log(`\n${colors.green}✅ queue_prefix column exists${colors.reset}\n`);
    }

    // Check if system_settings table exists
    console.log(`${colors.yellow}📊 Checking system_settings table...${colors.reset}`);
    const settingsCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      );
    `);
    
    if (settingsCheck.rows[0].exists) {
      console.log(`${colors.green}✅ system_settings table exists${colors.reset}\n`);
    } else {
      console.log(`${colors.red}❌ system_settings table is missing!${colors.reset}`);
      console.log(`${colors.yellow}   Run migration: node scripts/run-migrations.js${colors.reset}\n`);
    }

    // Check services count
    const servicesCount = await query('SELECT COUNT(*) FROM services');
    console.log(`${colors.blue}📈 Services in database: ${servicesCount.rows[0].count}${colors.reset}\n`);

    // Try to query services
    console.log(`${colors.yellow}🧪 Testing services query...${colors.reset}`);
    try {
      const services = await query(`
        SELECT id, name, COALESCE(queue_prefix, '') as queue_prefix
        FROM services
        WHERE is_active = true
        LIMIT 5;
      `);
      console.log(`${colors.green}✅ Services query successful${colors.reset}`);
      if (services.rows.length > 0) {
        console.log(`${colors.blue}   Sample services:${colors.reset}`);
        services.rows.forEach(s => {
          console.log(`   - ${s.name} (prefix: ${s.queue_prefix || 'none'})`);
        });
      }
    } catch (queryError) {
      console.log(`${colors.red}❌ Services query failed:${colors.reset}`);
      console.log(`${colors.red}   ${queryError.message}${colors.reset}\n`);
    }

    console.log(`\n${colors.green}✅ Schema verification complete!${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Verification failed:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

verifySchema();

