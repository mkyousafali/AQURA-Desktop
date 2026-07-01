/**
 * AQURA Desktop - Preload Script
 * 
 * Secure bridge between main process and renderer process.
 * Exposes ONLY safe operations to the frontend.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Sync operations
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  getDatabaseStatus: () => ipcRenderer.invoke('get-database-status'),
  getStorageStatus: () => ipcRenderer.invoke('get-storage-status'),
  triggerSync: () => ipcRenderer.invoke('trigger-sync'),
  openSyncStatusWindow: () => ipcRenderer.invoke('open-sync-status-window'),
  onSyncStart: (callback) => ipcRenderer.on('sync-start', (_, data) => callback(data)),
  onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (_, data) => callback(data)),
  onSyncComplete: (callback) => ipcRenderer.on('sync-complete', (_, data) => callback(data)),
  onSyncError: (callback) => ipcRenderer.on('sync-error', (_, error) => callback(error)),
  
  // Local database access (replaces Supabase REST API)
  queryLocalDb: (params) => ipcRenderer.invoke('query-local-db', params),
  getLocalApiUrl: () => ipcRenderer.invoke('get-local-api-url'),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  
  // Network status
  onOnline: (callback) => ipcRenderer.on('online', callback),
  onOffline: (callback) => ipcRenderer.on('offline', callback),
  
  // Desktop detection
  isDesktop: () => true,
  
  // Read-only mode
  getBlockedAttempts: () => {
    if (typeof window !== 'undefined' && window.apiInterceptor) {
      return window.apiInterceptor.getBlockedAttempts();
    }
    return [];
  }
});

// Block any attempt to access Node.js APIs directly
delete window.require;
delete window.module;
delete window.process;

console.log('AQURA Desktop preload script loaded');
