/**
 * Test Database Sync
 * 
 * Tests syncing data from Supabase without PostgreSQL
 * (Just fetches and displays data)
 */

const DatabaseSync = require('../src/sync/database-sync');
const logger = require('../src/logger/logger');

async function test() {
  console.log('🧪 Testing Database Sync\n');

  try {
    // Initialize
    console.log('📡 Initializing database sync...');
    const dbSync = new DatabaseSync();
    await dbSync.initialize();
    console.log('✅ Initialized\n');

    // Test connection
    console.log('🔌 Testing connection...');
    const connectionTest = await dbSync.testConnection();
    if (connectionTest.success) {
      console.log('✅ Connection successful\n');
    } else {
      console.log('❌ Connection failed:', connectionTest.message);
      process.exit(1);
    }

    // Sync a few tables
    console.log('📥 Syncing tables...\n');

    const tablesToTest = ['branches', 'products', 'product_categories', 'product_units'];

    for (const tableName of tablesToTest) {
      console.log(`📊 Syncing ${tableName}...`);
      const result = await dbSync.syncTable(tableName);

      if (result.success) {
        console.log(`✅ ${tableName}: ${result.records} records`);
      } else {
        console.log(`❌ ${tableName}: ${result.error}`);
      }
    }

    console.log('\n🎉 Sync test complete!');
    console.log('\n📝 Note: Data was fetched but NOT saved to database yet');
    console.log('   (PostgreSQL integration coming next)');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
test();
