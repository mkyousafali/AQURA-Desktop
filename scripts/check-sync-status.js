/**
 * Check sync status - show what's been synced to local database
 */

const { Pool } = require('pg');

async function checkSyncStatus() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'aqura_desktop',
    user: 'postgres',
    password: '', // Portable PostgreSQL has no password
    max: 5
  });

  try {
    console.log('\n📊 SYNC STATUS - Local PostgreSQL Database\n');
    console.log('='.repeat(80));
    
    // Get all tables
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT IN ('sync_metadata')
      ORDER BY tablename
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(r => r.tablename);
    
    console.log(`\n✅ Tables Created: ${tables.length}\n`);
    
    let totalRecords = 0;
    
    // Count records in each table
    for (const table of tables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        totalRecords += count;
        
        const status = count > 0 ? '✓' : '○';
        const padding = ' '.repeat(Math.max(1, 40 - table.length));
        console.log(`${status} ${table}${padding}${count.toLocaleString()} records`);
      } catch (e) {
        console.log(`✗ ${table}${' '.repeat(40 - table.length)}ERROR: ${e.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📦 TOTAL RECORDS SAVED: ${totalRecords.toLocaleString()}\n`);
    
    // Check sync metadata if it exists
    try {
      const metaResult = await pool.query(`
        SELECT table_name, last_sync, record_count, status 
        FROM sync_metadata 
        ORDER BY last_sync DESC
      `);
      
      if (metaResult.rows.length > 0) {
        console.log('\n📋 SYNC METADATA:\n');
        for (const row of metaResult.rows) {
          const time = new Date(row.last_sync).toLocaleTimeString();
          console.log(`  ${row.table_name}: ${row.record_count} records (${row.status}) at ${time}`);
        }
      }
    } catch (e) {
      // Sync metadata table might not exist yet
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSyncStatus().catch(console.error);
