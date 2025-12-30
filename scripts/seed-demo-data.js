// Seed Demo Data Script
// This script populates the database with demo data for portfolio showcase

require('dotenv').config({ path: './backend/.env' });
const { query } = require('../backend/config/database');
const fs = require('fs');
const path = require('path');
const bcrypt = require('../backend/node_modules/bcrypt');

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

async function seedDemoData() {
  try {
    console.log(`${colors.green}🌱 Seeding Demo Data${colors.reset}\n`);

    // Test connection first
    console.log(`${colors.yellow}📊 Testing database connection...${colors.reset}`);
    await query('SELECT NOW()');
    console.log(`${colors.green}✅ Database connected${colors.reset}\n`);

    // Generate password hash for demo accounts
    console.log(`${colors.yellow}🔐 Generating password hashes...${colors.reset}`);
    const demoPasswordHash = await bcrypt.hash('demo123', 10);
    console.log(`${colors.green}✅ Password hash generated${colors.reset}\n`);

    // Read demo data SQL file
    const seedFile = path.join(__dirname, '..', 'database', 'seeds', 'demo-data.sql');
    
    if (!fs.existsSync(seedFile)) {
      throw new Error('Demo data file not found');
    }

    let sql = fs.readFileSync(seedFile, 'utf8');
    
    // Replace placeholder hash with actual hash
    sql = sql.replace(
      /\$2b\$10\$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K/g,
      demoPasswordHash
    );

    // Execute the SQL
    console.log(`${colors.yellow}📝 Inserting demo data...${colors.reset}`);
    await query(sql);

    // Get summary
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const serviceCount = await query('SELECT COUNT(*) as count FROM services');
    const counterCount = await query('SELECT COUNT(*) as count FROM counters');
    const queueCount = await query('SELECT COUNT(*) as count FROM queue_entries');

    console.log(`\n${colors.green}✅ Demo data seeded successfully!${colors.reset}\n`);
    console.log('Summary:');
    console.log(`  - Users: ${userCount.rows[0].count}`);
    console.log(`  - Services: ${serviceCount.rows[0].count}`);
    console.log(`  - Counters: ${counterCount.rows[0].count}`);
    console.log(`  - Queue Entries: ${queueCount.rows[0].count}`);
    console.log(`\n${colors.green}Demo credentials:${colors.reset}`);
    console.log('  Admin: admin@clsu.edu.ph / demo123');
    console.log('  Staff: staff1@clsu.edu.ph / demo123');
    console.log('  Student: student1@clsu.edu.ph / demo123');

    process.exit(0);

  } catch (error) {
    console.error(`\n${colors.red}❌ Error seeding data:${colors.reset}`, error.message);
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`${colors.yellow}⚠️  Some data may already exist. This is okay.${colors.reset}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

seedDemoData();

