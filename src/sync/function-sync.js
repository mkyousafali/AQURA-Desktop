/**
 * Function Sync
 * 
 * Syncs all PostgreSQL function definitions (RPCs) from Supabase
 * to the local PostgreSQL database for full offline operation.
 */

const cloudConfig = require('../config/cloud-config');
const logger = require('../logger/logger');

const fetch = globalThis.fetch || require('node-fetch');

class FunctionSync {
  constructor(credentials, pgManager) {
    this.credentials = credentials || null;
    this.baseUrl = null;
    this.headers = null;
    this.pgManager = pgManager;
  }

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
  }

  /**
   * Fetch all function definitions from the cloud server
   */
  async fetchFunctionDefinitions() {
    const url = `${this.baseUrl}/rpc/export_all_function_definitions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch function definitions: ${response.status} ${errorText}`);
    }

    const functions = await response.json();
    logger.info(`Fetched ${functions.length} function definitions from cloud`);
    return functions;
  }

  /**
   * Deploy a single function to local PostgreSQL
   */
  async deployFunction(funcDef) {
    try {
      // Use pgManager's pool directly for function deployment
      const client = await this.pgManager.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(funcDef.function_definition);
        await client.query('COMMIT');
        return { success: true, name: funcDef.function_name };
      } catch (error) {
        await client.query('ROLLBACK');
        return { 
          success: false, 
          name: funcDef.function_name, 
          error: error.message 
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return { 
        success: false, 
        name: funcDef.function_name, 
        error: error.message 
      };
    }
  }

  /**
   * Sync all functions from cloud to local PostgreSQL
   */
  async syncAll(progressCallback = null) {
    const results = {
      total: 0,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      await this.initialize();
      
      logger.info('Starting function sync...');
      if (progressCallback) {
        progressCallback({
          phase: 'functions',
          progress: 0,
          message: 'Fetching function definitions...'
        });
      }

      // Fetch all function definitions
      const functions = await this.fetchFunctionDefinitions();
      results.total = functions.length;

      if (functions.length === 0) {
        logger.warn('No functions returned from server');
        return results;
      }

      // Deploy functions in batches
      const batchSize = 20;
      for (let i = 0; i < functions.length; i += batchSize) {
        const batch = functions.slice(i, i + batchSize);
        
        // Deploy each function in the batch
        const batchResults = await Promise.all(
          batch.map(fn => this.deployFunction(fn))
        );

        for (const result of batchResults) {
          if (result.success) {
            results.synced++;
          } else {
            results.failed++;
            // Only log first 20 errors to avoid noise
            if (results.errors.length < 20) {
              results.errors.push({ name: result.name, error: result.error });
            }
          }
        }

        // Progress update
        const progress = Math.floor(((i + batch.length) / functions.length) * 100);
        if (progressCallback) {
          progressCallback({
            phase: 'functions',
            current: i + batch.length,
            total: functions.length,
            progress,
            message: `Syncing functions (${i + batch.length}/${functions.length})`
          });
        }
      }

      logger.info(`Function sync complete: ${results.synced}/${results.total} synced, ${results.failed} failed`);
      
      if (results.errors.length > 0) {
        logger.warn('Function sync errors (first 20):', results.errors);
      }

    } catch (error) {
      logger.error('Function sync failed:', error);
      results.error = error.message;
    }

    return results;
  }
}

module.exports = FunctionSync;
