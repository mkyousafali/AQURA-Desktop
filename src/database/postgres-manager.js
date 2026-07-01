/**
 * PostgreSQL Manager
 * 
 * Manages local PostgreSQL database:
 * - Connection pooling
 * - Schema creation
 * - Data operations
 * - Query validation (read-only from UI)
 */

const { Pool } = require('pg');
const logger = require('../logger/logger');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { spawn, execSync } = require('child_process');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

// Handle both Electron and Node.js contexts
let userDataPath;
try {
  const { app } = require('electron');
  userDataPath = app.getPath('userData');
} catch (e) {
  // Running outside Electron (e.g., in test scripts)
  userDataPath = path.join(os.homedir(), 'AQURA Desktop');
}

class PostgresManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.dbConfig = null;
    this.portablePostgresPath = null;
    this.postgresProcess = null;
  }

  /**
   * Check if PostgreSQL is already installed on the system
   */
  async checkSystemPostgres() {
    try {
      // Try to connect to system PostgreSQL
      const testPool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres',
        connectionTimeoutMillis: 2000,
      });
      
      const client = await testPool.connect();
      await client.query('SELECT 1');
      client.release();
      await testPool.end();
      
      logger.info('System PostgreSQL found');
      return true;
    } catch (error) {
      logger.info('System PostgreSQL not found');
      return false;
    }
  }

  /**
   * Check if portable PostgreSQL is already installed
   */
  async checkPortablePostgres() {
    try {
      // First check bundled PostgreSQL (in app resources)
      let bundledPath;
      try {
        const { app } = require('electron');
        
        // In development mode, use desktop/resources path
        // In production mode, use resources next to app.asar
        if (app.isPackaged) {
          bundledPath = path.join(path.dirname(app.getAppPath()), 'resources', 'postgresql', 'pgsql');
        } else {
          // Dev mode: desktop/resources/postgresql/pgsql
          bundledPath = path.join(app.getAppPath(), 'resources', 'postgresql', 'pgsql');
        }
        
        logger.info(`Checking for PostgreSQL at: ${bundledPath}`);
      } catch (e) {
        // Running outside Electron (test scripts)
        bundledPath = path.join(__dirname, '../../resources/postgresql/pgsql');
        logger.info(`Checking for PostgreSQL at (non-Electron): ${bundledPath}`);
      }
      
      const pgBinPath = path.join(bundledPath, 'bin', 'postgres.exe');
      logger.info(`Looking for postgres.exe at: ${pgBinPath}`);
      
      try {
        await fs.access(pgBinPath);
        logger.info(`✓ Bundled PostgreSQL found at: ${bundledPath}`);
        this.portablePostgresPath = bundledPath;
        return true;
      } catch (e) {
        logger.info(`✗ PostgreSQL not found at: ${bundledPath}`);
        logger.info(`Error: ${e.message}`);
        
        // Fallback: check user data path
        const userPortablePath = path.join(userDataPath, 'postgresql', 'pgsql');
        const userPgBinPath = path.join(userPortablePath, 'bin', 'postgres.exe');
        
        logger.info(`Checking user data path: ${userPgBinPath}`);
        await fs.access(userPgBinPath);
        logger.info(`User PostgreSQL found at: ${userPortablePath}`);
        this.portablePostgresPath = userPortablePath;
        return true;
      }
    } catch (error) {
      logger.info('Portable PostgreSQL not installed');
      return false;
    }
  }

  /**
   * Install portable PostgreSQL
   * For production: bundle PostgreSQL with installer
   * For now: use existing system PostgreSQL or skip
   */
  async installPortablePostgres() {
    try {
      logger.info('Installing portable PostgreSQL...');
      
      const portablePath = path.join(userDataPath, 'postgresql');
      const dataPath = path.join(portablePath, 'data');
      
      // In a real installer, PostgreSQL would be bundled
      // For now, we'll create the directories and document the requirement
      await fs.mkdir(portablePath, { recursive: true });
      await fs.mkdir(dataPath, { recursive: true });
      
      logger.warn('Portable PostgreSQL installation requires bundled binaries');
      logger.warn('For now, please install PostgreSQL 16.x manually or use cloud-only mode');
      
      this.portablePostgresPath = portablePath;
      return false; // Not actually installed yet
    } catch (error) {
      logger.error('Failed to install portable PostgreSQL:', error);
      return false;
    }
  }

  /**
   * Start portable PostgreSQL server
   */
  async startPortableServer() {
    if (!this.portablePostgresPath) {
      logger.warn('Portable PostgreSQL path not set');
      return false;
    }

    try {
      const pgBinPath = path.join(this.portablePostgresPath, 'bin', 'postgres.exe');
      const initdbPath = path.join(this.portablePostgresPath, 'bin', 'initdb.exe');
      const dataPath = path.join(userDataPath, 'postgresql-data');
      
      // Check if data directory needs initialization
      let needsInit = false;
      try {
        await fs.access(path.join(dataPath, 'PG_VERSION'));
      } catch (e) {
        needsInit = true;
      }
      
      // Initialize database if needed
      if (needsInit) {
        logger.info('Initializing PostgreSQL database...');
        await fs.mkdir(dataPath, { recursive: true });
        
        try {
          execSync(`"${initdbPath}" -D "${dataPath}" -U postgres -E UTF8 --locale=en_US.UTF-8`, {
            stdio: 'pipe',
            encoding: 'utf8'
          });
          logger.info('PostgreSQL database initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize database:', error);
          return false;
        }
      }
      
      // Check if server is already running
      if (this.postgresProcess && !this.postgresProcess.killed) {
        logger.info('PostgreSQL server already running');
        return true;
      }

      // Start PostgreSQL server
      logger.info('Starting PostgreSQL server...');
      const logPath = path.join(userDataPath, 'logs', 'postgresql.log');
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      
      // Open log file
      const fsSync = require('fs');
      const logFd = fsSync.openSync(logPath, 'a');
      
      this.postgresProcess = spawn(pgBinPath, [
        '-D', dataPath,
        '-p', '5432'
      ], {
        detached: false,
        stdio: ['ignore', logFd, logFd]
      });

      this.postgresProcess.on('error', (error) => {
        logger.error('PostgreSQL process error:', error);
        fsSync.closeSync(logFd);
      });

      this.postgresProcess.on('exit', (code) => {
        logger.warn(`PostgreSQL process exited with code ${code}`);
        this.postgresProcess = null;
        try {
          fsSync.closeSync(logFd);
        } catch (e) {
          // Already closed
        }
      });

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      logger.info('PostgreSQL server started');
      return true;
    } catch (error) {
      logger.error('Failed to start PostgreSQL server:', error);
      return false;
    }
  }

  /**
   * Initialize PostgreSQL connection
   */
  async initialize(config = {}) {
    try {
      // Step 1: Check if system PostgreSQL is available
      const hasSystemPostgres = await this.checkSystemPostgres();
      
      if (!hasSystemPostgres) {
        logger.info('System PostgreSQL not available, checking for portable installation...');
        
        // Step 2: Check if portable PostgreSQL is installed
        const hasPortablePostgres = await this.checkPortablePostgres();
        
        if (!hasPortablePostgres) {
          logger.info('Portable PostgreSQL not found, attempting installation...');
          
          // Step 3: Install portable PostgreSQL
          const installed = await this.installPortablePostgres();
          
          if (!installed) {
            logger.warn('PostgreSQL not available - running in cloud-only mode');
            logger.warn('Data will be fetched from cloud but not persisted locally');
            this.isConnected = false;
            return false;
          }
        }
        
        // Step 4: Start portable PostgreSQL server
        await this.startPortableServer();
      }

      // Get data path  
      const dataPath = config.dataPath || path.join(userDataPath, 'data');

      // Database configuration
      // For portable PostgreSQL (no password), for system use 'postgres'/'postgres'
      const isPortable = this.portablePostgresPath !== null;
      
      this.dbConfig = {
        host: config.host || 'localhost',
        port: config.port || 5432,
        database: config.database || 'aqura_desktop',
        user: config.user || 'postgres',
        password: config.password || (isPortable ? '' : 'postgres'),
        max: 20, // connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000,
      };

      logger.info('Connecting to PostgreSQL...', {
        host: this.dbConfig.host, 
        database: this.dbConfig.database 
      });

      // First, connect to 'postgres' database to create 'aqura_desktop' if needed
      if (isPortable || hasSystemPostgres) {
        try {
          const tempPool = new Pool({
            ...this.dbConfig,
            database: 'postgres' // Connect to default database first
          });
          
          const tempClient = await tempPool.connect();
          
          // Check if aqura_desktop database exists
          const dbCheck = await tempClient.query(
            "SELECT 1 FROM pg_database WHERE datname = 'aqura_desktop'"
          );
          
          if (dbCheck.rows.length === 0) {
            logger.info('Creating aqura_desktop database...');
            await tempClient.query('CREATE DATABASE aqura_desktop');
            logger.info('Database created successfully');
          }
          
          tempClient.release();
          await tempPool.end();
        } catch (error) {
          logger.warn('Could not create database, it may already exist:', error.message);
        }
      }

      // Create connection pool to aqura_desktop
      this.pool = new Pool(this.dbConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('PostgreSQL connected successfully');

      // Create tables if they don't exist
      await this.ensureTables();

      return true;
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      this.isConnected = false;
      
      // Continue in cloud-only mode
      logger.warn('Operating in cloud-only mode (data will not persist locally)');
      return false;
    }
  }

  /**
   * Create tables if they don't exist
   */
  async ensureTables() {
    if (!this.isConnected) return;

    const tables = [
      // Branches table
      `CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY,
        name_en TEXT,
        name_ar TEXT,
        location_en TEXT,
        location_ar TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        barcode TEXT,
        product_serial TEXT,
        product_name_en TEXT,
        product_name_ar TEXT,
        category_id TEXT,
        unit_id TEXT,
        unit_qty NUMERIC,
        sale_price NUMERIC,
        cost NUMERIC,
        profit NUMERIC,
        tax_category_id TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Product categories table
      `CREATE TABLE IF NOT EXISTS product_categories (
        id TEXT PRIMARY KEY,
        name_en TEXT,
        name_ar TEXT,
        display_order INTEGER,
        image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Product units table
      `CREATE TABLE IF NOT EXISTS product_units (
        id TEXT PRIMARY KEY,
        name_en TEXT,
        name_ar TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Tax categories table
      `CREATE TABLE IF NOT EXISTS tax_categories (
        id TEXT PRIMARY KEY,
        name_en TEXT,
        name_ar TEXT,
        tax_percentage NUMERIC,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Vendors table
      `CREATE TABLE IF NOT EXISTS vendors (
        erp_vendor_id INTEGER PRIMARY KEY,
        vendor_name TEXT,
        salesman_name TEXT,
        salesman_contact TEXT,
        status TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Customers table
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        phone TEXT,
        customer_name TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        loyalty_points INTEGER DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        total_spent NUMERIC DEFAULT 0,
        status TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Orders table
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT,
        customer_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        branch_id INTEGER,
        order_type TEXT,
        payment_method TEXT,
        subtotal NUMERIC,
        tax_amount NUMERIC,
        discount_amount NUMERIC,
        total_amount NUMERIC,
        status TEXT,
        notes TEXT,
        delivery_address TEXT,
        delivery_fee NUMERIC,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Order items table
      `CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        product_id TEXT,
        product_name_en TEXT,
        product_name_ar TEXT,
        quantity NUMERIC,
        unit_price NUMERIC,
        line_total NUMERIC,
        discount_amount NUMERIC,
        tax_amount NUMERIC,
        unit_name_en TEXT,
        unit_name_ar TEXT,
        created_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Quick tasks table
      `CREATE TABLE IF NOT EXISTS quick_tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        priority TEXT,
        issue_type TEXT,
        status TEXT,
        assigned_by TEXT,
        assigned_to_branch_id INTEGER,
        deadline_datetime TIMESTAMP,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Tasks table
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        priority TEXT,
        status TEXT,
        created_by TEXT,
        due_date DATE,
        due_time TIME,
        due_datetime TIMESTAMP,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Flyer offers table
      `CREATE TABLE IF NOT EXISTS flyer_offers (
        id TEXT PRIMARY KEY,
        product_id TEXT,
        product_name_en TEXT,
        product_name_ar TEXT,
        offer_type TEXT,
        discount_percentage NUMERIC,
        special_price NUMERIC,
        is_active BOOLEAN DEFAULT true,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,

      // Sync metadata table
      `CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        last_sync TIMESTAMP,
        record_count INTEGER,
        status TEXT
      )`
    ];

    try {
      for (const createTableSQL of tables) {
        await this.pool.query(createTableSQL);
      }
      logger.info('Database tables verified/created');
    } catch (error) {
      logger.error('Failed to create tables:', error);
      throw error;
    }
  }

  /**
   * Ensure table exists with proper structure (creates if missing)
   */
  async ensureTableExists(tableName, sampleRecord, primaryKey = 'id') {
    if (!this.isConnected) return;

    try {
      const client = await this.pool.connect();
      
      try {
        // Check if table exists
        const tableExistsQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `;
        const tableExistsResult = await client.query(tableExistsQuery, [tableName]);
        const tableExists = tableExistsResult.rows[0].exists;
        
        if (!tableExists) {
          // Table doesn't exist - create it from sample record
          logger.info(`Creating table ${tableName} from cloud schema`);
          
          const columns = Object.keys(sampleRecord);
          const columnDefinitions = columns.map(col => {
            const value = sampleRecord[col];
            const pgType = this.inferPostgresType(value);
            
            // Set primary key constraint
            if (col === primaryKey) {
              return `${col} ${pgType} PRIMARY KEY`;
            }
            return `${col} ${pgType}`;
          }).join(', ');
          
          // Only add synced_at if not already in the data
          const hasSyncedAt = columns.includes('synced_at');
          const createTableQuery = `
            CREATE TABLE ${tableName} (
              ${columnDefinitions}${hasSyncedAt ? '' : ',\n              synced_at TIMESTAMP DEFAULT NOW()'}
            )
          `;
          
          await client.query(createTableQuery);
          logger.info(`✓ Table ${tableName} created with ${columns.length} columns`);
        } else {
          // Table exists - just ensure columns are up to date
          await this.ensureColumnsExist(tableName, sampleRecord);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to ensure table ${tableName} exists:`, error);
      throw error;
    }
  }

  /**
   * Ensure all columns from data exist in the table (dynamic schema sync)
   * Note: Does NOT create tables - use ensureTableExists for that
   */
  async ensureColumnsExist(tableName, recordsOrSample) {
    if (!this.isConnected) return;

    try {
      // Handle both single record and array of records
      const records = Array.isArray(recordsOrSample) ? recordsOrSample : [recordsOrSample];
      if (records.length === 0) return;
      
      const client = await this.pool.connect();
      
      try {
        // Check for missing columns (assumes table already exists)
        const columnQuery = `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
        `;
        const result = await client.query(columnQuery, [tableName]);
        const existingColumns = new Map(result.rows.map(row => [row.column_name, row.data_type]));
        
        // Get columns from the first record
        const dataColumns = Object.keys(records[0]);
        
        // Find missing columns
        const missingColumns = dataColumns.filter(col => !existingColumns.has(col));
        
        // Add missing columns - infer type from ALL records, not just first
        if (missingColumns.length > 0) {
          logger.info(`Adding ${missingColumns.length} missing columns to ${tableName}: ${missingColumns.join(', ')}`);
          
          for (const column of missingColumns) {
            // Check ALL records to determine the best type for this column
            let bestType = 'TEXT';
            let hasDecimals = false;
            let hasIntegers = false;
            
            for (const record of records) {
              const value = record[column];
              if (value !== null && value !== undefined) {
                const inferredType = this.inferPostgresType(value);
                if (inferredType === 'NUMERIC') {
                  hasDecimals = true;
                } else if (inferredType === 'INTEGER') {
                  hasIntegers = true;
                } else if (inferredType !== 'TEXT') {
                  bestType = inferredType;
                }
              }
            }
            
            // If any record has decimals, use NUMERIC (not INTEGER)
            if (hasDecimals) {
              bestType = 'NUMERIC';
            } else if (hasIntegers) {
              bestType = 'INTEGER';
            }
            
            const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column} ${bestType}`;
            await client.query(alterQuery);
            logger.info(`Added column: ${tableName}.${column} (${bestType})`);
          }
        }
        
        // Check for type mismatches - check ALL records for decimal values
        for (const column of dataColumns) {
          if (existingColumns.has(column)) {
            const currentType = existingColumns.get(column).toLowerCase();
            
            // If column is INTEGER or BIGINT, check for problematic values
            if (currentType === 'integer' || currentType === 'bigint') {
              let needsNumeric = false;
              let needsBigint = false;
              let needsText = false;
              let problemValue = null;
              
              for (const record of records) {
                const value = record[column];
                if (value === null || value === undefined) continue;
                
                // Empty string in integer column - needs TEXT
                if (value === '') {
                  needsText = true;
                  problemValue = '(empty string)';
                  break;
                }
                
                if (typeof value === 'number') {
                  if (!Number.isInteger(value)) {
                    needsNumeric = true;
                    problemValue = value;
                    break;
                  }
                  if (currentType === 'integer' && (value > 2147483647 || value < -2147483648)) {
                    needsBigint = true;
                    problemValue = value;
                    break;
                  }
                } else if (typeof value === 'string') {
                  const trimmed = value.trim();
                  // Check if it's a pure numeric string
                  if (/^-?\d+$/.test(trimmed)) {
                    // It's a numeric string - check if it exceeds INT range (use string length as proxy for big numbers)
                    if (currentType === 'integer' && (trimmed.length > 10 || (trimmed.length === 10 && trimmed > '2147483647'))) {
                      needsBigint = true;
                      problemValue = value;
                      break;
                    }
                  } else if (/^-?\d+\.\d+$/.test(trimmed)) {
                    needsNumeric = true;
                    problemValue = value;
                    break;
                  } else {
                    // Non-numeric string in integer column
                    needsText = true;
                    problemValue = value;
                    break;
                  }
                }
              }
              
              if (needsText) {
                logger.warn(`Column ${tableName}.${column} is ${currentType.toUpperCase()} but has non-numeric value "${problemValue}", converting to TEXT`);
                try {
                  await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${column} TYPE TEXT USING ${column}::TEXT`);
                  logger.info(`✅ Converted ${tableName}.${column} ${currentType.toUpperCase()} → TEXT`);
                } catch (alterError) {
                  logger.error(`Failed to convert ${tableName}.${column} to TEXT:`, alterError);
                }
              } else if (needsNumeric) {
                logger.warn(`Column ${tableName}.${column} is INTEGER but has decimal value "${problemValue}", converting to NUMERIC`);
                try {
                  await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${column} TYPE NUMERIC USING ${column}::NUMERIC`);
                  logger.info(`✅ Converted ${tableName}.${column} INTEGER → NUMERIC`);
                } catch (alterError) {
                  logger.error(`Failed to convert column ${tableName}.${column} to NUMERIC:`, alterError);
                }
              } else if (needsBigint) {
                logger.warn(`Column ${tableName}.${column} is INTEGER but has value "${problemValue}" exceeding INT range, converting to BIGINT`);
                try {
                  await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${column} TYPE BIGINT USING CASE WHEN ${column}::TEXT ~ '^-?[0-9]+$' THEN ${column}::BIGINT ELSE NULL END`);
                  logger.info(`✅ Converted ${tableName}.${column} INTEGER → BIGINT`);
                } catch (alterError) {
                  // If BIGINT fails, fall back to TEXT
                  try {
                    await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${column} TYPE TEXT USING ${column}::TEXT`);
                    logger.info(`✅ Converted ${tableName}.${column} INTEGER → TEXT (BIGINT failed)`);
                  } catch (e) {
                    logger.error(`Failed to convert ${tableName}.${column}:`, e);
                  }
                }
              }
            }
            
            // If column is JSONB but some records have non-object values (strings), convert to TEXT
            if (currentType === 'jsonb' || currentType === 'json') {
              let hasNonJsonValue = false;
              for (const record of records) {
                const value = record[column];
                if (value !== null && value !== undefined && typeof value === 'string') {
                  // String value going into JSON column - this causes errors
                  hasNonJsonValue = true;
                  break;
                }
              }
              
              if (hasNonJsonValue) {
                logger.warn(`Column ${tableName}.${column} is ${currentType.toUpperCase()} but has string values, converting to TEXT`);
                try {
                  await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${column} TYPE TEXT USING ${column}::TEXT`);
                  logger.info(`✅ Converted ${tableName}.${column} from ${currentType.toUpperCase()} to TEXT`);
                } catch (alterError) {
                  logger.error(`Failed to convert ${tableName}.${column} to TEXT:`, alterError);
                }
              }
            }
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to ensure columns for ${tableName}:`, error);
      // Don't throw - table might not exist yet (will be created by ensureTableExists)
    }
  }

  /**
   * Infer PostgreSQL data type from JavaScript value
   */
  inferPostgresType(value) {
    if (value === null || value === undefined) return 'TEXT';
    
    const type = typeof value;
    
    if (type === 'boolean') return 'BOOLEAN';
    if (type === 'number') {
      if (!Number.isInteger(value)) return 'NUMERIC';
      // Check if exceeds 32-bit integer range
      if (value > 2147483647 || value < -2147483648) return 'BIGINT';
      return 'INTEGER';
    }
    if (type === 'string') {
      // Check if it looks like a timestamp
      if (value.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/)) {
        return 'TIMESTAMP';
      }
      // Check if it looks like a UUID
      if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return 'UUID';
      }
      // Check if it's a numeric string (like "3.05" or "100")
      if (value.match(/^-?\d+(\.\d+)?$/)) {
        // Has decimal point = NUMERIC, otherwise INTEGER
        return value.includes('.') ? 'NUMERIC' : 'INTEGER';
      }
      return 'TEXT';
    }
    if (type === 'object') {
      if (Array.isArray(value)) return 'JSONB';
      return 'JSONB';
    }
    
    return 'TEXT'; // Default fallback
  }

  /**
   * Ensure a UNIQUE constraint exists on the primary key column for ON CONFLICT to work
   */
  async ensurePrimaryKeyConstraint(client, tableName, primaryKey) {
    try {
      // Check if a unique constraint or primary key already exists on this column
      const checkQuery = `
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = $1 AND ccu.column_name = $2 
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        AND tc.table_schema = 'public'
      `;
      const result = await client.query(checkQuery, [tableName, primaryKey]);
      
      if (result.rows.length === 0) {
        // No constraint exists, create a unique constraint
        const constraintName = `${tableName}_${primaryKey}_unique`;
        try {
          await client.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} UNIQUE (${primaryKey})`);
          logger.info(`Added UNIQUE constraint on ${tableName}.${primaryKey}`);
        } catch (e) {
          // If there are duplicates, try to deduplicate first
          if (e.code === '23505') {
            logger.warn(`${tableName}: duplicates exist on ${primaryKey}, deduplicating...`);
            await client.query(`
              DELETE FROM ${tableName} a USING ${tableName} b
              WHERE a.ctid < b.ctid AND a.${primaryKey} = b.${primaryKey}
            `);
            await client.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} UNIQUE (${primaryKey})`);
          } else {
            // Non-critical - fallback will handle it
            logger.warn(`Could not add constraint on ${tableName}.${primaryKey}: ${e.message}`);
          }
        }
      }
    } catch (error) {
      // Non-critical error, the ON CONFLICT might still work if PK exists
      logger.warn(`ensurePrimaryKeyConstraint check failed for ${tableName}: ${error.message}`);
    }
  }

  /**
   * Upsert data into table (insert or update) - BULK mode
   */
  async upsertTable(tableName, records, primaryKey = 'id') {
    if (!this.isConnected || !records || records.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    try {
      // First, ensure all columns exist (dynamic schema sync from cloud)
      await this.ensureColumnsExist(tableName, records);
      
      logger.logDb(`Upserting ${tableName}`, { records: records.length });

      // Get column names from first record (exclude synced_at as we manage it ourselves)
      const columns = Object.keys(records[0]).filter(col => col !== 'synced_at');
      const columnsStr = columns.join(', ');
      
      // Helper to serialize values for PostgreSQL
      const serializeValue = (value) => {
        if (value === null || value === undefined) return null;
        // Empty string should be NULL for non-text columns (prevents "invalid input for integer" errors)
        if (value === '') return null;
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
          return JSON.stringify(value);
        }
        return value;
      };

      // Check if primary key column exists in data
      if (!columns.includes(primaryKey)) {
        // Try to find a suitable primary key from the data
        const possibleKeys = ['id', 'uuid'];
        const foundKey = possibleKeys.find(k => columns.includes(k));
        if (foundKey) {
          primaryKey = foundKey;
        } else {
          // Use first column as primary key
          logger.warn(`${tableName}: primary key '${primaryKey}' not in data, using first column '${columns[0]}'`);
          primaryKey = columns[0];
        }
      }

      // Build UPDATE SET clause (all columns except primary key)
      const updateCols = columns.filter(col => col !== primaryKey);
      const updateSet = updateCols.map(col => `${col} = EXCLUDED.${col}`).join(', ');
      
      const client = await this.pool.connect();
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      
      try {
        // Ensure primary key constraint exists for ON CONFLICT
        await this.ensurePrimaryKeyConstraint(client, tableName, primaryKey);
        
        // Process in chunks - respect PostgreSQL's ~65535 param limit
        const maxParams = 60000;
        const CHUNK_SIZE = Math.max(10, Math.floor(maxParams / columns.length));
        
        for (let chunkStart = 0; chunkStart < records.length; chunkStart += CHUNK_SIZE) {
          const chunk = records.slice(chunkStart, chunkStart + CHUNK_SIZE);
          
          // Build bulk VALUES clause
          const values = [];
          const placeholders = [];
          let paramIdx = 1;
          
          for (const record of chunk) {
            const recordPlaceholders = columns.map(() => `$${paramIdx++}`);
            placeholders.push(`(${recordPlaceholders.join(', ')})`);
            
            for (const col of columns) {
              values.push(serializeValue(record[col]));
            }
          }
          
          const query = `
            INSERT INTO ${tableName} (${columnsStr}, synced_at) 
            VALUES ${placeholders.map(p => p.replace(')', ', NOW())')).join(', ')}
            ON CONFLICT (${primaryKey}) DO UPDATE SET ${updateSet}, synced_at = NOW()
          `;
          
          try {
            const result = await client.query(query, values);
            // PostgreSQL doesn't distinguish inserted vs updated in ON CONFLICT
            updated += chunk.length;
          } catch (chunkError) {
            // If bulk fails, fall back to per-record for this chunk
            logger.warn(`${tableName}: bulk insert failed for chunk, falling back to per-record: ${chunkError.message}`);
            
            for (const record of chunk) {
              try {
                const recordValues = columns.map(col => serializeValue(record[col]));
                const singlePlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
                
                const singleQuery = `
                  INSERT INTO ${tableName} (${columnsStr}, synced_at) 
                  VALUES (${singlePlaceholders}, NOW())
                  ON CONFLICT (${primaryKey}) DO UPDATE SET ${updateSet}, synced_at = NOW()
                `;
                await client.query(singleQuery, recordValues);
                updated++;
              } catch (recordError) {
                skipped++;
                if (skipped <= 3) {
                  logger.warn(`Skipping bad record in ${tableName} (${primaryKey}=${record[primaryKey]}): ${recordError.message}`);
                }
              }
            }
          }
        }

        if (skipped > 0) {
          logger.warn(`${tableName}: skipped ${skipped} bad records`);
        }

        // Update sync metadata
        await client.query(
          `INSERT INTO sync_metadata (table_name, last_sync, record_count, status) 
           VALUES ($1, NOW(), $2, 'success') 
           ON CONFLICT (table_name) DO UPDATE 
           SET last_sync = NOW(), record_count = $2, status = 'success'`,
          [tableName, records.length]
        );

      } catch (error) {
        throw error;
      } finally {
        client.release();
      }

      logger.logDb(`${tableName} upserted`, { inserted, updated, skipped });
      return { inserted, updated };

    } catch (error) {
      logger.error(`Failed to upsert ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Execute query (read-only validation)
   */
  async query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    // Validate read-only (basic check)
    const sqlLower = sql.toLowerCase().trim();
    if (!sqlLower.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed from UI');
    }

    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Query failed:', error);
      throw error;
    }
  }

  /**
   * Get sync status for all tables
   */
  async getSyncStatus() {
    if (!this.isConnected) {
      return [];
    }

    try {
      const result = await this.pool.query(
        'SELECT * FROM sync_metadata ORDER BY table_name'
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to get sync status:', error);
      return [];
    }
  }

  /**
   * Close database connection
   */
  async shutdown() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('PostgreSQL connection closed');
    }
    
    // Stop portable PostgreSQL server if running
    if (this.postgresProcess) {
      try {
        logger.info('Stopping portable PostgreSQL server...');
        this.postgresProcess.kill();
        this.postgresProcess = null;
        logger.info('Portable PostgreSQL server stopped');
      } catch (error) {
        logger.error('Failed to stop PostgreSQL server:', error);
      }
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connected: this.isConnected,
      mode: this.isConnected ? 'Local Database' : 'Cloud-Only Mode',
      portable: !!this.portablePostgresPath,
      postgresPath: this.portablePostgresPath || 'System PostgreSQL',
      config: this.dbConfig ? {
        host: this.dbConfig.host,
        database: this.dbConfig.database
      } : null
    };
  }
}

module.exports = PostgresManager;
