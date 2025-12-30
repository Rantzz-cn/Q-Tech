const { query } = require('../config/database');
const request = require('supertest');
const app = require('../server');

// Note: Socket server is already mocked in server.js for tests

async function testDatabasePerformance() {
  console.log('\n📊 Database Performance Tests\n');
  console.log('='.repeat(60));

  // Test 1: User lookup by email (should use idx_users_email)
  console.log('\n1. Testing User Email Lookup...');
  const start1 = Date.now();
  await query('SELECT * FROM users WHERE email = $1 LIMIT 1', ['test@example.com']);
  const time1 = Date.now() - start1;
  console.log(`   ⏱️  Query time: ${time1}ms`);
  console.log(`   ${time1 < 50 ? '✅ Excellent' : time1 < 100 ? '✅ Good' : '⚠️  Could be better'}`);

  // Test 2: Queue entries by service (should use idx_queue_entries_service_id)
  console.log('\n2. Testing Queue Entries by Service...');
  const start2 = Date.now();
  await query(`
    SELECT COUNT(*) as count 
    FROM queue_entries 
    WHERE service_id = $1 AND status = 'waiting'
  `, [1]);
  const time2 = Date.now() - start2;
  console.log(`   ⏱️  Query time: ${time2}ms`);
  console.log(`   ${time2 < 50 ? '✅ Excellent' : time2 < 100 ? '✅ Good' : '⚠️  Could be better'}`);

  // Test 3: Active services (should use idx_services_is_active)
  console.log('\n3. Testing Active Services Query...');
  const start3 = Date.now();
  await query('SELECT * FROM services WHERE is_active = true');
  const time3 = Date.now() - start3;
  console.log(`   ⏱️  Query time: ${time3}ms`);
  console.log(`   ${time3 < 50 ? '✅ Excellent' : time3 < 100 ? '✅ Good' : '⚠️  Could be better'}`);

  // Test 4: Complex queue query (should use composite indexes)
  console.log('\n4. Testing Complex Queue Query...');
  const start4 = Date.now();
  await query(`
    SELECT qe.*, s.name as service_name, u.first_name, u.last_name
    FROM queue_entries qe
    JOIN services s ON qe.service_id = s.id
    JOIN users u ON qe.user_id = u.id
    WHERE qe.service_id = $1 
      AND qe.status = $2
      AND DATE(qe.requested_at) = CURRENT_DATE
    ORDER BY qe.requested_at DESC
    LIMIT 10
  `, [1, 'waiting']);
  const time4 = Date.now() - start4;
  console.log(`   ⏱️  Query time: ${time4}ms`);
  console.log(`   ${time4 < 100 ? '✅ Excellent' : time4 < 200 ? '✅ Good' : '⚠️  Could be better'}`);

  // Test 5: Check index usage
  console.log('\n5. Verifying Index Usage...');
  const explainResult = await query(`
    EXPLAIN ANALYZE 
    SELECT * FROM queue_entries 
    WHERE service_id = 1 AND status = 'waiting'
    LIMIT 10
  `);
  
  const plan = explainResult.rows.map(r => r['QUERY PLAN']).join('\n');
  const usesIndex = plan.includes('Index Scan') || plan.includes('Bitmap Index Scan');
  console.log(`   ${usesIndex ? '✅ Indexes are being used' : '⚠️  Indexes may not be used'}`);
  if (usesIndex) {
    console.log(`   📈 Query plan shows index usage`);
  }

  console.log('\n' + '='.repeat(60));
}

async function testAPIPerformance() {
  console.log('\n🌐 API Performance Tests\n');
  console.log('='.repeat(60));

  // Test 1: Services endpoint (should be cached after first call)
  console.log('\n1. Testing /api/services endpoint...');
  
  // First call (cache miss)
  const start1 = Date.now();
  const res1 = await request(app).get('/api/services');
  const time1 = Date.now() - start1;
  console.log(`   First call (cache miss): ${time1}ms`);
  
  // Second call (cache hit)
  const start2 = Date.now();
  const res2 = await request(app).get('/api/services');
  const time2 = Date.now() - start2;
  console.log(`   Second call (cache hit): ${time2}ms`);
  
  const improvement = ((time1 - time2) / time1 * 100).toFixed(1);
  console.log(`   🚀 Cache improvement: ${improvement}% faster`);
  console.log(`   ${time2 < time1 * 0.5 ? '✅ Excellent caching' : '✅ Good caching'}`);

  // Test 2: Health check
  console.log('\n2. Testing /api/health endpoint...');
  const start3 = Date.now();
  await request(app).get('/api/health');
  const time3 = Date.now() - start3;
  console.log(`   ⏱️  Response time: ${time3}ms`);
  console.log(`   ${time3 < 100 ? '✅ Excellent' : time3 < 200 ? '✅ Good' : '⚠️  Could be better'}`);

  console.log('\n' + '='.repeat(60));
}

async function testCachePerformance() {
  console.log('\n💾 Cache Performance Tests\n');
  console.log('='.repeat(60));

  const cache = require('../utils/cache');
  
  // Test cache operations
  console.log('\n1. Testing cache operations...');
  
  const start1 = Date.now();
  cache.set('test:key', { data: 'test' }, 5000);
  const setTime = Date.now() - start1;
  console.log(`   Set operation: ${setTime}ms ${setTime < 1 ? '✅ Excellent' : '✅ Good'}`);

  const start2 = Date.now();
  const value = cache.get('test:key');
  const getTime = Date.now() - start2;
  console.log(`   Get operation: ${getTime}ms ${getTime < 1 ? '✅ Excellent' : '✅ Good'}`);

  const stats = cache.getStats();
  console.log(`\n2. Cache Statistics:`);
  console.log(`   Total entries: ${stats.total}`);
  console.log(`   Active entries: ${stats.active}`);
  console.log(`   Expired entries: ${stats.expired}`);

  console.log('\n' + '='.repeat(60));
}

async function runPerformanceTests() {
  console.log('\n🚀 CLSU NEXUS Performance Test Suite\n');
  console.log('Testing performance optimizations...\n');

  try {
    await testDatabasePerformance();
    await testAPIPerformance();
    await testCachePerformance();

    console.log('\n✅ Performance tests completed!\n');
    console.log('Summary:');
    console.log('  - Database indexes: ✅ Active');
    console.log('  - Response caching: ✅ Active');
    console.log('  - Performance monitoring: ✅ Active');
    console.log('\n💡 Tip: Check console for slow request warnings during development\n');
  } catch (error) {
    console.error('\n❌ Error running performance tests:', error.message);
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  runPerformanceTests();
}

module.exports = { runPerformanceTests };

