/**
 * Fix Decimal Column Types
 * 
 * Drops and recreates tables with decimal value issues
 * so they can be synced with correct NUMERIC types
 */

const { Pool } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'aqura_desktop',
  user: 'postgres',
  password: ''
};

const problematicTables = [
  'customers',
  'flyer_offer_products',
  'vendor_payment_schedule',
  'expense_scheduler'
];

async function fixTables() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔧 Fixing decimal column type issues...\n');
    
    for (const table of problematicTables) {
      console.log(`Dropping table: ${table}`);
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✅ Dropped: ${table}`);
    }
    
    console.log('\n✅ All problematic tables dropped!');
    console.log('📝 They will be recreated with correct NUMERIC types on next sync.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixTables();
