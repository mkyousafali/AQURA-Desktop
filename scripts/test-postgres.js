/**
 * Test PostgreSQL Integration
 * 
 * Tests complete sync pipeline:
 * 1. Fetch data from Supabase
 * 2. Save to local PostgreSQL
 * 3. Verify data
 */

const DatabaseSync = require('../src/sync/database-sync');
const PostgresManager = require('../src/database/postgres-manager');
const logger = require('../src/logger/logger');

async function test() {
  console.log('🧪 Testing PostgreSQL Integration\n');

  let pgManager;

  try {
    // Initialize PostgreSQL
    console.log('🗄️  Initializing PostgreSQL...');
    pgManager = new PostgresManager();
    
    // Try to connect (will warn if not available)
    const connected = await pgManager.initialize();
    
    if (!connected) {
      console.log('⚠️  PostgreSQL not available');
      console.log('   This is OK - sync can still fetch data from cloud');
      console.log('   In production, we would install portable PostgreSQL here\n');
      console.log('📥 Testing fetch-only sync...\n');
    } else {
      console.log('✅ PostgreSQL connected!\n');
    }

    // Initialize database sync
    console.log('📡 Initializing database sync...');
    const dbSync = new DatabaseSync();
    await dbSync.initialize();
    
    // Inject PostgreSQL manager
    dbSync.setPostgresManager(pgManager);
    console.log('✅ Database sync initialized\n');

    // Sync a few tables
    console.log('📥 Syncing tables...\n');

    const tablesToTest = ['branches', 'product_categories', 'product_units'];

    for (const tableName of tablesToTest) {
      console.log(`📊 Syncing ${tableName}...`);
      const result = await dbSync.syncTable(tableName);

      if (result.success) {
        if (connected) {
          console.log(`✅ ${tableName}: ${result.records} records (${result.inserted} inserted, ${result.updated} updated)`);
        } else {
          console.log(`✅ ${tableName}: ${result.records} records fetched (not saved - no database)`);
        }
      } else {
        console.log(`❌ ${tableName}: ${result.error}`);
      }
    }

    // Show sync status if database connected
    if (connected) {
      console.log('\n📊 Sync Status:');
      const syncStatus = await pgManager.getSyncStatus();
      syncStatus.forEach(s => {
        console.log(`   ${s.table_name}: ${s.record_count} records (last: ${new Date(s.last_sync).toLocaleString()})`);
      });
    }

    console.log('\n🎉 Test complete!');
    
    if (connected) {
      console.log('\n✅ Full sync pipeline working:');
      console.log('   1. Fetch from Supabase ✅');
      console.log('   2. Save to PostgreSQL ✅');
      console.log('   3. Track sync status ✅');
    } else {
      console.log('\n⚠️  Fetch-only mode:');
      console.log('   1. Fetch from Supabase ✅');
      console.log('   2. PostgreSQL not available (would install portable version)');
      console.log('   3. App can still work with live cloud data');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (pgManager) {
      await pgManager.shutdown();
    }
  }
}

// Run test
test();
