// Electron API TypeScript definitions for renderer process

interface ElectronAPI {
  // App info
  getAppVersion: () => Promise<string>;
  
  // Settings
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<boolean>;
  
  // Sync operations
  getSyncStatus: () => Promise<{
    isRunning: boolean;
    isSyncing: boolean;
    lastSync: string | null;
    nextSync: number;
    history: any[];
  } | null>;
  
  getDatabaseStatus: () => Promise<{
    isConnected: boolean;
    mode: string;
    portable: boolean;
    config: any;
  } | null>;
  
  triggerSync: () => Promise<{
    success: boolean;
    syncId?: number;
    tables?: any;
    error?: string;
  }>;
  
  // Sync event listeners
  onSyncStart: (callback: (data: { syncId: number; startTime: string }) => void) => void;
  onSyncProgress: (callback: (data: { phase: string; progress: number }) => void) => void;
  onSyncComplete: (callback: (data: any) => void) => void;
  onSyncError: (callback: (error: any) => void) => void;
  
  // Database query (read-only)
  dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
  
  // Credentials
  testCredentials: (credentials: { url: string; serviceKey: string }) => Promise<{ success: boolean; message: string }>;
  updateCredentials: (credentials: { url: string; serviceKey: string }) => Promise<{ success: boolean; message?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
