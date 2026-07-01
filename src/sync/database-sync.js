/**
 * Database Sync
 * 
 * Syncs database tables from Supabase to local PostgreSQL
 * using incremental sync with timestamps.
 */

const cloudConfig = require('../config/cloud-config');
const logger = require('../logger/logger');

// Use native fetch
const fetch = globalThis.fetch || require('node-fetch');

class DatabaseSync {
  constructor(credentials) {
    this.credentials = credentials || null;
    this.baseUrl = null;
    this.headers = null;
    
    // Tables will be fetched dynamically from Supabase
    this.tables = [];
    
    // Tables to exclude from sync (system tables, auth tables, etc.)
    this.excludedTables = [
      'schema_migrations',
      'spatial_ref_sys',
      'geography_columns',
      'geometry_columns',
      'raster_columns',
      'raster_overviews',
      // Add any other tables you want to exclude
    ];
  }

  /**
   * Initialize database sync
   */
  async initialize() {
    if (!this.credentials) {
      this.credentials = await cloudConfig.getCredentials();
    }

    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    this.baseUrl = `${this.credentials.url}/rest/v1`;
    this.headers = {
      'apikey': this.credentials.serviceKey,
      'Authorization': `Bearer ${this.credentials.serviceKey}`,
      'Content-Type': 'application/json'
    };

    logger.info('Database sync initialized');
  }

  /**
   * Discover all tables from Supabase
   * Queries the information_schema to get all public tables
   */
  async discoverTables() {
    try {
      logger.info('Discovering tables from Supabase...');
      
      // Query information_schema.tables to get all public tables
      const url = `${this.baseUrl}/rpc/get_public_tables`;
      
      // Try to use RPC function first (if it exists)
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({})
        });
        
        if (response.ok) {
          const tables = await response.json();
          this.tables = tables
            .map(t => t.tablename || t.table_name)
            .filter(name => !this.excludedTables.includes(name));
          
          logger.info(`Discovered ${this.tables.length} tables via RPC`);
          return this.tables;
        }
      } catch (rpcError) {
        // RPC function doesn't exist, try alternative method
        logger.info('RPC method not available, using alternative discovery...');
      }
      
      // Alternative: Try to get table list from PostgREST root endpoint
      const rootUrl = this.credentials.url + '/rest/v1/';
      const rootResponse = await fetch(rootUrl, { headers: this.headers });
      
      if (rootResponse.ok) {
        const rootData = await rootResponse.text();
        // PostgREST returns OpenAPI spec at root, but we'll use a simpler approach
      }
      
      // Fallback: Query each known table pattern
      // We'll try to fetch from common table name patterns and see what exists
      const testTables = await this.probeForTables();
      this.tables = testTables.filter(name => !this.excludedTables.includes(name));
      
      logger.info(`Discovered ${this.tables.length} tables`);
      return this.tables;
      
    } catch (error) {
      logger.error('Failed to discover tables:', error);
      // Return empty array, will be populated as we encounter tables
      return [];
    }
  }

  /**
   * Probe for tables by trying common patterns and checking what exists
   * This is a fallback when RPC function is not available
   */
  async probeForTables() {
    const discoveredTables = new Set();
    
    logger.info('Probing for tables... This may take a few minutes for large databases.');
    
    // Try to get a comprehensive list by trying alphabet-based probes
    // Most table names start with common letters
    const commonPrefixes = [
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      // Common patterns
      'hr_', 'employee', 'customer', 'product', 'order', 'task', 'user',
      'vendor', 'branch', 'expense', 'payment', 'invoice', 'receipt',
      'inventory', 'sale', 'purchase', 'report', 'log', 'transaction',
      'category', 'item', 'flyer', 'coupon', 'offer', 'campaign',
      'schedule', 'assignment', 'completion', 'attendance', 'fingerprint',
      'privilege', 'broadcast', 'message', 'notification', 'whatsapp'
    ];
    
    // Try each prefix pattern
    for (const prefix of commonPrefixes) {
      try {
        // Try the base name
        const url = `${this.baseUrl}/${prefix}?select=*&limit=0`;
        const response = await fetch(url, { headers: this.headers });
        
        if (response.ok) {
          discoveredTables.add(prefix);
          logger.info(`Found table: ${prefix}`);
        } else if (response.status === 404) {
          // Try with common suffixes
          const suffixes = ['s', 'es', 'ies', 'logs', 'data', 'list', 'items', 
                          'details', 'history', 'transactions', 'records'];
          for (const suffix of suffixes) {
            const tableName = prefix + suffix;
            try {
              const suffixUrl = `${this.baseUrl}/${tableName}?select=*&limit=0`;
              const suffixResponse = await fetch(suffixUrl, { headers: this.headers });
              if (suffixResponse.ok) {
                discoveredTables.add(tableName);
                logger.info(`Found table: ${tableName}`);
              }
            } catch (e) {
              // Skip
            }
          }
        }
      } catch (error) {
        // Skip this prefix
      }
      
      // Log progress every 10 prefixes
      if (discoveredTables.size > 0 && commonPrefixes.indexOf(prefix) % 10 === 0) {
        logger.info(`Probing progress: found ${discoveredTables.size} tables so far...`);
      }
    }
    
    logger.info(`Probing complete: discovered ${discoveredTables.size} tables`);
    return Array.from(discoveredTables).sort();
  }

  /**
   * Fetch data from Supabase table
   */
  async fetchTable(tableName, options = {}) {
    try {
      const { 
        limit = 1000, 
        offset = 0,
        select = '*',
        order = null
      } = options;

      let url = `${this.baseUrl}/${tableName}?select=${select}&limit=${limit}&offset=${offset}`;
      
      if (order) {
        url += `&order=${order}`;
      }

      logger.logDb(`Fetching ${tableName}`, { limit, offset });

      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      logger.logDb(`Fetched ${tableName}`, { count: data.length });

      return data;

    } catch (error) {
      logger.error(`Failed to fetch ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Fetch table with pagination (for large tables)
   */
  async fetchTableAll(tableName, options = {}) {
    const allData = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const data = await this.fetchTable(tableName, {
        ...options,
        limit: pageSize,
        offset
      });

      allData.push(...data);

      if (data.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    logger.info(`Fetched all ${tableName}: ${allData.length} records`);
    return allData;
  }

  /**
   * Get primary key for table
   */
  getPrimaryKey(tableName) {
    const primaryKeys = {
      'vendors': 'erp_vendor_id',
      'branches': 'id',
      'products': 'id',
      'product_categories': 'id',
      'product_units': 'id',
      'hr_employees': 'id',
      'users': 'id',
      'expense_parent_categories': 'id',
      'expense_sub_categories': 'id',
      'customers': 'id',
      'orders': 'id',
      'order_items': 'id',
      'quick_tasks': 'id',
      'quick_task_assignments': 'id',
      'quick_task_completions': 'id',
      'tasks': 'id',
      'task_assignments': 'id',
      'task_completions': 'id',
      'flyer_offers': 'id',
      'flyer_offer_products': 'id',
      'coupon_campaigns': 'id',
      'vendor_payment_schedule': 'id',
      'expense_scheduler': 'id',
      'hr_fingerprint_transactions': 'id',
      'hr_attendance_corrections': 'id',
      'cashier_device_bindings': 'device_id'
    };

    return primaryKeys[tableName] || 'id';
  }

  /**
   * Set PostgreSQL manager (injected from SyncManager)
   */
  setPostgresManager(pgManager) {
    this.pgManager = pgManager;
  }

  /**
   * Sync single table
   */
  async syncTable(tableName) {
    try {
      logger.logDb(`Syncing table: ${tableName}`, { started: new Date() });

      // Fetch all data from Supabase
      const data = await this.fetchTableAll(tableName);

      // Save to local PostgreSQL if available
      let saved = { inserted: 0, updated: 0 };
      if (this.pgManager && this.pgManager.isConnected) {
        const primaryKey = this.getPrimaryKey(tableName);
        saved = await this.pgManager.upsertTable(tableName, data, primaryKey);
        logger.logDb(`Saved to PostgreSQL`, { 
          table: tableName,
          inserted: saved.inserted,
          updated: saved.updated
        });
      } else {
        logger.warn(`PostgreSQL not available, data not saved to local database`);
      }

      logger.logDb(`Table ${tableName} synced`, { records: data.length });

      return {
        success: true,
        table: tableName,
        records: data.length,
        inserted: saved.inserted,
        updated: saved.updated,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`Failed to sync ${tableName}:`, error);
      return {
        success: false,
        table: tableName,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Initialize all table structures from cloud (first-time setup)
   */
  async initializeTableStructures() {
    if (!this.pgManager || !this.pgManager.isConnected) {
      logger.warn('PostgreSQL not available, skipping table structure initialization');
      return;
    }

    logger.info(`Initializing table structures for ${this.tables.length} tables...`);

    for (const tableName of this.tables) {
      try {
        // Fetch just 1 record as schema sample
        const url = `${this.baseUrl}/${tableName}?limit=1`;
        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) {
          logger.warn(`Table ${tableName} returned ${response.status}, creating empty table`);
          // Create empty table with just ID
          await this.createEmptyTable(tableName);
          continue;
        }

        const data = await response.json();
        
        if (data && data.length > 0) {
          // Create table structure from first record
          const primaryKey = this.getPrimaryKey(tableName);
          await this.pgManager.ensureTableExists(tableName, data[0], primaryKey);
          logger.info(`Table structure initialized: ${tableName}`);
        } else {
          // No data - create empty table
          logger.info(`Table ${tableName} is empty, creating with basic structure`);
          await this.createEmptyTable(tableName);
        }
      } catch (error) {
        logger.error(`Failed to initialize structure for ${tableName}:`, error.message);
        // Try to create empty table as fallback
        try {
          await this.createEmptyTable(tableName);
        } catch (e) {
          logger.error(`Could not create empty table ${tableName}:`, e.message);
        }
      }
    }

    logger.info('Table structure initialization complete');
  }

  /**
   * Create an empty table with basic structure
   */
  async createEmptyTable(tableName) {
    if (!this.pgManager || !this.pgManager.isConnected) {
      return;
    }

    try {
      const primaryKey = this.getPrimaryKey(tableName);
      
      // Determine primary key type based on table
      const pkType = (primaryKey === 'erp_vendor_id' || tableName.includes('_id')) ? 'INTEGER' : 'TEXT';
      
      const createQuery = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${primaryKey} ${pkType} PRIMARY KEY,
          synced_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      const client = await this.pgManager.pool.connect();
      try {
        await client.query(createQuery);
        logger.info(`Empty table created: ${tableName} (will add columns when data syncs)`);
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to create empty table ${tableName}:`, error.message);
    }
  }

  /**
   * Sync all tables
   */
  async syncAll(progressCallback = null) {
    const results = {
      synced: 0,
      failed: 0,
      tables: []
    };

    logger.info('Starting full database sync...');

    // Always re-discover tables to detect new ones added in Supabase
    await this.discoverTables();
    logger.info(`Will sync ${this.tables.length} tables`);

    // First-time: Initialize all table structures from cloud schema
    await this.initializeTableStructures();

    const totalTables = this.tables.length;
    let currentTable = 0;

    for (const tableName of this.tables) {
      currentTable++;
      
      // Call progress callback if provided
      if (progressCallback) {
        const progressData = {
          phase: 'database',
          current: currentTable,
          total: totalTables,
          table: tableName,
          progress: Math.floor((currentTable / totalTables) * 75) + 25, // 25-100%
          message: `Syncing ${tableName} (${currentTable}/${totalTables})`
        };
        logger.info(`[SYNC PROGRESS] ${progressData.message}`, progressData);
        progressCallback(progressData);
      }
      
      try {
        const result = await this.syncTable(tableName);
        results.tables.push(result);

        if (result.success) {
          results.synced++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.tables.push({
          success: false,
          table: tableName,
          error: error.message
        });
      }
    }

    logger.info('Database sync complete', results);
    return results;
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      await this.initialize();
      const data = await this.fetchTable('branches', { limit: 1 });
      return { success: true, message: 'Connection successful', count: data.length };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = DatabaseSync;
