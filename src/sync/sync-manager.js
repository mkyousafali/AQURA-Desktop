/**
 * Sync Manager
 * 
 * Orchestrates all sync operations:
 * - Database table sync
 * - Storage file sync
 * - Schema migrations
 * - Error handling and retry
 */

const EventEmitter = require('events');
const cloudConfig = require('../config/cloud-config');
const logger = require('../logger/logger');
const StorageSync = require('./storage-sync');

class SyncManager extends EventEmitter {
  constructor() {
    super();
    
    this.isRunning = false;
    this.isSyncing = false;
    this.intervalId = null;
    this.syncInterval = 15 * 60 * 1000; // 15 minutes default
    this.lastSyncTime = null;
    this.syncHistory = [];
    
    // Current sync progress
    this.currentPhase = '';
    this.currentTable = '';
    this.currentBucket = '';
    this.currentProgress = 0;
    this.tableProgress = { current: 0, total: 0 };
    this.syncMessage = '';
    
    // Sync components (will be initialized)
    this.databaseSync = null;
    this.storageSync = null;
    this.schemaMigration = null;
  }

  /**
   * Initialize sync manager
   */
  async initialize() {
    try {
      logger.info('Initializing Sync Manager...');
      
      // Get credentials
      const credentials = await cloudConfig.getCredentials();
      if (!credentials) {
        throw new Error('No credentials found');
      }

      // Initialize sync components
      // this.databaseSync = initialized in main.js
      
      // Initialize storage sync
      this.storageSync = new StorageSync(credentials);
      await this.storageSync.initialize();
      logger.info('Storage sync initialized');
      
      // this.schemaMigration = new SchemaMigration(credentials);

      logger.info('Sync Manager initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Sync Manager:', error);
      throw error;
    }
  }

  /**
   * Start automatic sync
   */
  start(intervalMinutes = 15) {
    if (this.isRunning) {
      logger.warn('Sync Manager already running');
      return;
    }

    this.syncInterval = intervalMinutes * 60 * 1000;
    this.isRunning = true;

    logger.info(`Starting automatic sync (interval: ${intervalMinutes} minutes)`);

    // Do initial sync
    this.syncNow();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.syncNow();
    }, this.syncInterval);

    this.emit('started');
  }

  /**
   * Stop automatic sync
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Sync Manager...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.emit('stopped');

    logger.info('Sync Manager stopped');
  }

  /**
   * Trigger manual sync
   */
  async syncNow() {
    if (this.isSyncing) {
      logger.warn('Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    const syncId = Date.now();
    const startTime = new Date();

    logger.logSync('START', { syncId, startTime });
    this.emit('sync-start', { syncId, startTime });

    const result = {
      syncId,
      startTime,
      endTime: null,
      duration: 0,
      success: false,
      errors: [],
      tables: { synced: 0, failed: 0 },
      files: { synced: 0, failed: 0 }
    };

    try {
      // Phase 1: Check schema changes
      logger.logSync('PHASE 1: Schema check', { syncId });
      this.emit('sync-progress', { 
        phase: 'schema', 
        progress: 0,
        message: 'Checking for schema changes...'
      });

      // TODO: Check and apply schema migrations
      // if (this.schemaMigration) {
      //   await this.schemaMigration.check();
      // }

      // Phase 2: Sync database tables
      logger.logSync('PHASE 2: Database sync', { syncId });
      this.emit('sync-progress', { 
        phase: 'database', 
        progress: 25,
        message: 'Syncing database tables...'
      });

      // Sync tables with progress callback
      if (this.databaseSync) {
        const progressCallback = (data) => {
          // Store current progress
          this.currentPhase = data.phase || 'database';
          this.currentTable = data.table || '';
          this.currentProgress = data.progress || 0;
          this.syncMessage = data.message || '';
          if (data.current && data.total) {
            this.tableProgress = { current: data.current, total: data.total };
          }
          this.emit('sync-progress', data);
        };
        const dbResult = await this.databaseSync.syncAll(progressCallback);
        result.tables = dbResult;
      } else {
        logger.warn('DatabaseSync not initialized');
        result.tables = { synced: 0, failed: 0 };
      }

      // Phase 3: Sync storage files
      logger.logSync('PHASE 3: Storage sync', { syncId });
      this.emit('sync-progress', { 
        phase: 'storage', 
        progress: 50,
        message: 'Syncing storage files...'
      });

      // Sync storage files
      if (this.storageSync) {
        const storageProgressCallback = (data) => {
          this.emit('sync-progress', {
            phase: 'storage',
            progress: 50 + Math.floor((data.current / data.total) * 50),
            bucket: data.bucket,
            file: data.file,
            current: data.current,
            total: data.total,
            message: `Syncing ${data.bucket}... (${data.downloaded} downloaded, ${data.skipped} skipped)`
          });
        };
        const storageResult = await this.storageSync.syncAll(storageProgressCallback);
        result.files = storageResult;
      } else {
        logger.warn('StorageSync not initialized');
        result.files = { downloaded: 0, skipped: 0 };
      }

      // Phase 3: Sync storage files (background, non-blocking)
      logger.logSync('PHASE 3: Storage sync', { syncId });
      this.emit('sync-progress', { 
        phase: 'storage', 
        progress: 75,
        message: 'Starting storage file sync...'
      });

      // TODO: Start storage sync in background
      // if (this.storageSync) {
      //   this.storageSync.syncInBackground();
      // }

      result.files = { synced: 0, failed: 0, pending: 0 };

      // Complete
      result.success = true;
      result.endTime = new Date();
      result.duration = result.endTime - result.startTime;

      logger.logSync('COMPLETE', { 
        syncId, 
        duration: result.duration,
        tables: result.tables,
        files: result.files
      });

      this.lastSyncTime = result.endTime;
      this.syncHistory.push(result);

      // Keep only last 50 sync records
      if (this.syncHistory.length > 50) {
        this.syncHistory.shift();
      }

      this.emit('sync-complete', result);

      return result;

    } catch (error) {
      result.success = false;
      result.endTime = new Date();
      result.duration = result.endTime - result.startTime;
      result.errors.push(error.message);

      logger.error('Sync failed:', error);
      this.emit('sync-error', error);

      return result;

    } finally {
      this.isSyncing = false;
      // Clear current sync progress
      this.currentPhase = '';
      this.currentTable = '';
      this.currentBucket = '';
      this.currentProgress = 0;
      this.tableProgress = { current: 0, total: 0 };
      this.syncMessage = '';
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    const nextSync = this.lastSyncTime 
      ? this.lastSyncTime.getTime() + this.syncInterval 
      : null;
    
    return {
      isRunning: this.isRunning,
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTime,
      lastSyncTime: this.lastSyncTime,
      nextSync: nextSync,
      syncInterval: this.syncInterval,
      history: this.syncHistory.slice(-10), // Last 10 syncs
      // Current sync progress (if syncing)
      currentPhase: this.currentPhase,
      currentTable: this.currentTable,
      currentBucket: this.currentBucket,
      currentProgress: this.currentProgress,
      tableProgress: this.tableProgress,
      syncMessage: this.syncMessage
    };
  }

  /**
   * Get latest sync result
   */
  getLatestSync() {
    return this.syncHistory[this.syncHistory.length - 1] || null;
  }

  /**
   * Update sync interval
   */
  setSyncInterval(minutes) {
    this.syncInterval = minutes * 60 * 1000;
    
    // Restart if running
    if (this.isRunning) {
      this.stop();
      this.start(minutes);
    }

    logger.info(`Sync interval updated to ${minutes} minutes`);
  }
}

module.exports = SyncManager;
