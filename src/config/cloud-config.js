/**
 * Cloud Configuration Manager
 * 
 * Handles Supabase credentials storage and retrieval using:
 * 1. Electron-store with encryption - Primary
 */

const Store = require('electron-store');
const logger = require('../logger/logger');

// Use native fetch (Node.js v18+) or polyfill
const fetch = globalThis.fetch || require('node-fetch');

const SERVICE_NAME = 'AQURA-Desktop';
const ACCOUNT_URL = 'supabase-url';
const ACCOUNT_KEY = 'supabase-service-key';

// Encrypted storage for credentials
const store = new Store({
  name: 'credentials',
  encryptionKey: 'aqura-desktop-credentials-backup'
});

class CloudConfig {
  constructor() {
    this.credentials = null;
  }

  /**
   * Parse .env file to extract credentials
   * Used by installer
   */
  static parseEnvFile(envContent) {
    const lines = envContent.split('\n');
    const config = {};

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse KEY=VALUE
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        config[key] = value;
      }
    }

    return {
      url: config.VITE_SUPABASE_URL || null,
      serviceKey: config.VITE_SUPABASE_SERVICE_KEY || null
    };
  }

  /**
   * Test connection to Supabase
   */
  static async testConnection(credentials) {
    try {
      const { url, serviceKey } = credentials;
      
      if (!url || !serviceKey) {
        return {
          success: false,
          message: 'Missing URL or Service Key'
        };
      }

      // Test REST API connection
      const response = await fetch(`${url}/rest/v1/branches?limit=1`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful'
        };
      } else {
        return {
          success: false,
          message: `Connection failed: HTTP ${response.status}`
        };
      }
    } catch (error) {
      logger.error('Connection test failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Store credentials
   */
  async setCredentials(credentials) {
    try {
      const { url, serviceKey } = credentials;

      if (!url || !serviceKey) {
        throw new Error('Missing URL or Service Key');
      }

      // Store in encrypted electron-store
      store.set('url', url);
      store.set('serviceKey', serviceKey);

      this.credentials = { url, serviceKey };
      logger.info('Credentials stored successfully');

      return true;
    } catch (error) {
      logger.error('Failed to store credentials:', error);
      throw error;
    }
  }

  /**
   * Retrieve credentials
   */
  async getCredentials() {
    try {
      const url = store.get('url');
      const serviceKey = store.get('serviceKey');

      if (url && serviceKey) {
        this.credentials = { url, serviceKey };
        logger.info('Credentials loaded from Windows Credential Manager');
        return this.credentials;
      }

      logger.warn('No credentials found');
      return null;
    } catch (error) {
      logger.error('Failed to retrieve credentials:', error);
      return null;
    }
  }

  /**
   * Update credentials
   */
  async updateCredentials(credentials) {
    // Test connection first
    const testResult = await CloudConfig.testConnection(credentials);
    
    if (!testResult.success) {
      throw new Error(testResult.message);
    }

    // Store new credentials
    await this.setCredentials(credentials);
  }

  /**
   * Delete credentials (for uninstall)
   */
  async deleteCredentials() {
    try {
      store.clear();
      this.credentials = null;
      logger.info('Credentials deleted');
    } catch (error) {
      logger.error('Failed to delete credentials:', error);
      throw error;
    }
  }
}

module.exports = new CloudConfig();
