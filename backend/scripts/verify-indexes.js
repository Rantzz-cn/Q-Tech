const { query } = require('../config/database');

async function verifyIndexes() {
  try {
    const result = await query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%' 
      ORDER BY tablename, indexname
    `);

    console.log('\n✅ Performance Indexes Created:\n');
    
    const byTable = {};
    result.rows.forEach(row => {
      if (!byTable[row.tablename]) {
        byTable[row.tablename] = [];
      }
      byTable[row.tablename].push(row.indexname);
    });

    Object.keys(byTable).sort().forEach(table => {
      console.log(`📊 ${table}:`);
      byTable[table].forEach(index => {
        console.log(`   ✓ ${index}`);
      });
      console.log('');
    });

    console.log(`Total: ${result.rows.length} indexes created\n`);
  } catch (error) {
    console.error('❌ Error verifying indexes:', error.message);
  }
  process.exit(0);
}

verifyIndexes();

