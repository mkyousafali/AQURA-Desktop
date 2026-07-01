/**
 * AQURA Desktop - Main Process
 * 
 * This is the Electron main process that manages:
 * - Window creation
 * - PostgreSQL lifecycle
 * - Sync service
 * - Auto-updates
 * - Credential management
 */

const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const cloudConfig = require('./src/config/cloud-config');
const logger = require('./src/logger/logger');
const SyncManager = require('./src/sync/sync-manager');
const DatabaseSync = require('./src/sync/database-sync');
const PostgresManager = require('./src/database/postgres-manager');

let mainWindow;
let syncStatusWindow;
let syncManager;
let postgresManager;
let databaseSync;

// Handle credential storage from installer
if (process.argv.includes('--store-credentials')) {
  const url = process.argv[process.argv.indexOf('--store-credentials') + 1];
  const key = process.argv[process.argv.indexOf('--store-credentials') + 2];
  
  if (url && key) {
    cloudConfig.setCredentials({ url, serviceKey: key })
      .then(() => {
        console.log('✅ Credentials stored successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Failed to store credentials:', error);
        process.exit(1);
      });
  } else {
    console.error('❌ Missing credentials');
    process.exit(1);
  }
  return;
}

/**
 * Setup storage interceptor - serves local files instead of cloud URLs
 * This makes the app work fully offline
 */
function setupStorageInterceptor() {
  if (!mainWindow) return;
  
  const storagePath = path.join(app.getPath('userData'), 'storage');
  
  // Intercept requests in the session
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['*://supabase.urbanaqura.com/storage/*'] },
    (details, callback) => {
      try {
        const url = new URL(details.url);
        // Extract path: /storage/v1/object/public/bucket-name/file.jpg
        const storageParts = url.pathname.replace('/storage/v1/object/public/', '').replace('/storage/v1/object/', '');
        const localFilePath = path.join(storagePath, storageParts);
        
        // Check if local file exists
        if (fs.existsSync(localFilePath)) {
          // Redirect to local file
          callback({ redirectURL: `file://${localFilePath.replace(/\\/g, '/')}` });
          return;
        }
      } catch (e) {
        // Fall through to cloud
      }
      
      // File not synced yet - allow cloud request (will work when online)
      callback({});
    }
  );
  
  logger.info('Storage interceptor configured - local files will be served offline');
}

/**
 * Start local REST API server to serve data from local PostgreSQL
 * The frontend will connect to this instead of Supabase
 */
let localApiServer = null;

async function startLocalApiServer() {
  const http = require('http');
  const PORT = 54321; // Local API port
  
  localApiServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Only allow GET requests (read-only)
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Read-only mode: only GET allowed' }));
      return;
    }
    
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const pathname = url.pathname;
      
      // REST API endpoint: /rest/v1/tableName
      if (pathname.startsWith('/rest/v1/')) {
        const tableName = pathname.replace('/rest/v1/', '').split('?')[0];
        
        if (!postgresManager || !postgresManager.isConnected) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database not connected' }));
          return;
        }
        
        // Parse query params
        const select = url.searchParams.get('select') || '*';
        const limit = parseInt(url.searchParams.get('limit')) || 1000;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        const order = url.searchParams.get('order');
        
        // Build SQL query
        let sql = `SELECT ${select} FROM ${tableName}`;
        
        // Handle filters (eq, neq, gt, lt, like, ilike, in)
        const filters = [];
        for (const [key, value] of url.searchParams.entries()) {
          if (['select', 'limit', 'offset', 'order'].includes(key)) continue;
          
          // Parse PostgREST-style filters
          if (value.startsWith('eq.')) {
            filters.push(`${key} = '${value.slice(3)}'`);
          } else if (value.startsWith('neq.')) {
            filters.push(`${key} != '${value.slice(4)}'`);
          } else if (value.startsWith('gt.')) {
            filters.push(`${key} > '${value.slice(3)}'`);
          } else if (value.startsWith('lt.')) {
            filters.push(`${key} < '${value.slice(3)}'`);
          } else if (value.startsWith('gte.')) {
            filters.push(`${key} >= '${value.slice(4)}'`);
          } else if (value.startsWith('lte.')) {
            filters.push(`${key} <= '${value.slice(4)}'`);
          } else if (value.startsWith('like.')) {
            filters.push(`${key} LIKE '${value.slice(5)}'`);
          } else if (value.startsWith('ilike.')) {
            filters.push(`${key} ILIKE '${value.slice(6)}'`);
          } else if (value.startsWith('is.')) {
            const isVal = value.slice(3);
            filters.push(`${key} IS ${isVal === 'null' ? 'NULL' : isVal}`);
          } else if (value.startsWith('in.')) {
            const inValues = value.slice(4, -1).split(',').map(v => `'${v}'`).join(',');
            filters.push(`${key} IN (${inValues})`);
          }
        }
        
        if (filters.length > 0) {
          sql += ` WHERE ${filters.join(' AND ')}`;
        }
        
        if (order) {
          const orderParts = order.split('.');
          sql += ` ORDER BY ${orderParts[0]} ${orderParts[1] || 'ASC'}`;
        }
        
        sql += ` LIMIT ${limit} OFFSET ${offset}`;
        
        // Execute query
        const client = await postgresManager.pool.connect();
        try {
          const result = await client.query(sql);
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Content-Range': `0-${result.rows.length}/*`
          });
          res.end(JSON.stringify(result.rows));
        } finally {
          client.release();
        }
        return;
      }
      
      // Storage endpoint: /storage/v1/object/public/bucket/file
      if (pathname.startsWith('/storage/v1/object/')) {
        const filePath = pathname.replace('/storage/v1/object/public/', '').replace('/storage/v1/object/', '');
        const localFile = path.join(app.getPath('userData'), 'storage', filePath);
        
        if (fs.existsSync(localFile)) {
          const stat = fs.statSync(localFile);
          const ext = path.extname(localFile).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf', '.doc': 'application/msword',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.mp4': 'video/mp4', '.mp3': 'audio/mpeg'
          };
          
          res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Content-Length': stat.size
          });
          fs.createReadStream(localFile).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found locally' }));
        }
        return;
      }
      
      // Unknown endpoint
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      
    } catch (error) {
      logger.error('Local API error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  
  localApiServer.listen(PORT, '127.0.0.1', () => {
    logger.info(`Local API server running on http://127.0.0.1:${PORT}`);
  });
  
  localApiServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${PORT} already in use, trying ${PORT + 1}`);
      localApiServer.listen(PORT + 1, '127.0.0.1');
    } else {
      logger.error('Local API server error:', err);
    }
  });
}
/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'resources/icon.ico'),
    title: 'AQURA Desktop',
    show: false
  });

  // Intercept requests to Supabase storage and serve local files
  setupStorageInterceptor();

  // Load the frontend
  const isDev = process.argv.includes('--dev') || !app.isPackaged;
  if (isDev) {
    // Load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Load from built files (for production)
    mainWindow.loadFile(path.join(__dirname, 'frontend/build/index.html'));
  }

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error(`Failed to load page: ${errorDescription} (${errorCode})`);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logger.info('Main window opened');
  });

  // Fallback: show window after timeout even if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      logger.warn('Window not shown after timeout, forcing show');
      mainWindow.show();
    }
  }, 5000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize the application
 */
async function initialize() {
  try {
    logger.info('Starting AQURA Desktop...');

    // Check if credentials exist
    const credentials = await cloudConfig.getCredentials();
    
    if (!credentials) {
      logger.warn('No credentials found');
      dialog.showErrorBox(
        'Configuration Required',
        'AQURA Desktop credentials not found. Please reinstall the application.'
      );
      app.quit();
      return;
    }

    logger.info('Credentials loaded successfully');

    // Initialize PostgreSQL
    logger.info('Initializing PostgreSQL...');
    postgresManager = new PostgresManager();
    const dbConnected = await postgresManager.initialize();
    
    if (dbConnected) {
      logger.info('PostgreSQL ready');
      // Start local API server for frontend to use
      await startLocalApiServer();
    } else {
      logger.warn('PostgreSQL not available - will sync from cloud on demand');
    }

    // Initialize database sync
    logger.info('Initializing sync service...');
    databaseSync = new DatabaseSync(credentials);
    await databaseSync.initialize();
    databaseSync.setPostgresManager(postgresManager);

    // Initialize sync manager
    syncManager = new SyncManager();
    await syncManager.initialize();
    
    // Inject components into sync manager
    syncManager.databaseSync = databaseSync;
    syncManager.postgresManager = postgresManager;

    // Create main window
    createWindow();

    // Set up event forwarding IMMEDIATELY (before sync starts)
    syncManager.on('sync-start', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        logger.info('[MAIN] Forwarding sync-start event to renderer', data);
        mainWindow.webContents.send('sync-start', data);
      }
      // Also forward to sync status window if open
      if (syncStatusWindow && !syncStatusWindow.isDestroyed()) {
        syncStatusWindow.webContents.send('sync-start', data);
      }
    });
    
    syncManager.on('sync-progress', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        logger.info('[MAIN] Forwarding sync-progress event to renderer', data);
        mainWindow.webContents.send('sync-progress', data);
      }
      // Also forward to sync status window if open
      if (syncStatusWindow && !syncStatusWindow.isDestroyed()) {
        syncStatusWindow.webContents.send('sync-progress', data);
      }
    });
    
    syncManager.on('sync-complete', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        logger.info('[MAIN] Forwarding sync-complete event to renderer', data);
        mainWindow.webContents.send('sync-complete', data);
      }
      // Also forward to sync status window if open
      if (syncStatusWindow && !syncStatusWindow.isDestroyed()) {
        syncStatusWindow.webContents.send('sync-complete', data);
      }
    });
    
    syncManager.on('sync-error', (error) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        logger.info('[MAIN] Forwarding sync-error event to renderer', error);
        mainWindow.webContents.send('sync-error', error);
      }
      // Also forward to sync status window if open
      if (syncStatusWindow && !syncStatusWindow.isDestroyed()) {
        syncStatusWindow.webContents.send('sync-error', error);
      }
    });

    // Start automatic sync after window is ready
    mainWindow.once('ready-to-show', () => {
      logger.info('Starting automatic sync...');
      
      // Now start sync with listeners already set up
      syncManager.start(15); // 15 minute intervals
    });

    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start AQURA Desktop: ${error.message}`
    );
    app.quit();
  }
}

/**
 * App lifecycle events
 */
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  logger.info('Application shutting down...');
  
  // Stop sync service
  if (syncManager) {
    syncManager.stop();
  }
  
  // Stop local API server
  if (localApiServer) {
    localApiServer.close();
    logger.info('Local API server stopped');
  }
  
  // Close PostgreSQL connections
  if (postgresManager) {
    await postgresManager.shutdown();
  }
  
  logger.info('Shutdown complete');
});

/**
 * IPC Handlers
 */

// Get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Get settings
ipcMain.handle('get-settings', () => {
  // Will implement with electron-store
  return {};
});

// Save settings
ipcMain.handle('save-settings', (event, settings) => {
  // Will implement with electron-store
  return true;
});

// Get sync status
ipcMain.handle('get-sync-status', () => {
  if (syncManager) {
    return syncManager.getStatus();
  }
  return null;
});

// Get database status
ipcMain.handle('get-database-status', () => {
  if (postgresManager) {
    return postgresManager.getStatus();
  }
  return null;
});

// Get storage sync status
ipcMain.handle('get-storage-status', () => {
  if (syncManager && syncManager.storageSync) {
    return syncManager.storageSync.getStatus();
  }
  return null;
});

// Get credentials for API interceptor
ipcMain.handle('get-credentials', async () => {
  try {
    const credentials = await cloudConfig.getCredentials();
    return credentials;
  } catch (error) {
    logger.error('Failed to get credentials:', error);
    return null;
  }
});

// Query local database directly (used by frontend instead of Supabase)
ipcMain.handle('query-local-db', async (event, { table, select, filters, order, limit, offset }) => {
  if (!postgresManager || !postgresManager.isConnected) {
    return { error: 'Database not connected', data: [] };
  }
  
  try {
    let sql = `SELECT ${select || '*'} FROM ${table}`;
    const params = [];
    
    if (filters && filters.length > 0) {
      const conditions = filters.map((f, idx) => {
        params.push(f.value);
        return `${f.column} ${f.operator} $${idx + 1}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    if (order) {
      sql += ` ORDER BY ${order}`;
    }
    
    sql += ` LIMIT ${limit || 1000} OFFSET ${offset || 0}`;
    
    const client = await postgresManager.pool.connect();
    try {
      const result = await client.query(sql, params);
      return { data: result.rows, count: result.rowCount };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Local DB query error:', error);
    return { error: error.message, data: [] };
  }
});

// Get local API server port
ipcMain.handle('get-local-api-url', () => {
  return 'http://127.0.0.1:54321';
});

// Trigger manual sync
ipcMain.handle('trigger-sync', async () => {
  if (syncManager) {
    try {
      const result = await syncManager.syncNow();
      return result;
    } catch (error) {
      logger.error('Manual sync failed:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Sync manager not initialized' };
});

// Open sync status window
ipcMain.handle('open-sync-status-window', () => {
  // If window already exists, focus it
  if (syncStatusWindow && !syncStatusWindow.isDestroyed()) {
    syncStatusWindow.focus();
    return;
  }

  // Create new sync status window
  syncStatusWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Sync Status',
    autoHideMenuBar: true
  });

  // Load sync status page
  const isDev = process.argv.includes('--dev') || !app.isPackaged;
  if (isDev) {
    syncStatusWindow.loadURL('http://localhost:5173/desktop-sync-status');
  } else {
    syncStatusWindow.loadFile(path.join(__dirname, 'frontend/build/desktop-sync-status.html'));
  }

  // Clean up reference when window closes
  syncStatusWindow.on('closed', () => {
    syncStatusWindow = null;
  });
});

// Test credentials (for settings page)
ipcMain.handle('test-credentials', async (event, credentials) => {
  try {
    const result = await cloudConfig.testConnection(credentials);
    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Update credentials (for settings page)
ipcMain.handle('update-credentials', async (event, credentials) => {
  try {
    await cloudConfig.updateCredentials(credentials);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Database query (read-only)
ipcMain.handle('db-query', async (event, sql, params) => {
  if (postgresManager && postgresManager.isConnected) {
    try {
      const result = await postgresManager.query(sql, params);
      return result;
    } catch (error) {
      logger.error('Query failed:', error);
      throw error;
    }
  } else {
    throw new Error('Database not connected');
  }
});

logger.info('Main process initialized');
