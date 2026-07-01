/**
 * API Interceptor - Read-Only Mode
 * 
 * Intercepts all fetch requests and blocks write operations (POST, PUT, DELETE, PATCH)
 * while allowing read operations (GET, HEAD, OPTIONS).
 */

class APIInterceptor {
  constructor() {
    this.enabled = true;
    this.blockedAttempts = [];
    this.allowedHosts = [];
    this.originalFetch = null;
  }

  /**
   * Initialize the interceptor
   */
  init(supabaseUrl) {
    if (typeof supabaseUrl === 'string') {
      const url = new URL(supabaseUrl);
      this.allowedHosts.push(url.hostname);
    }

    // Store original fetch
    this.originalFetch = window.fetch;

    // Override fetch
    window.fetch = this.interceptFetch.bind(this);

    console.log('🛡️ Read-Only Mode: API Interceptor active');
    console.log('📍 Monitoring:', this.allowedHosts);
  }

  /**
   * Intercept fetch requests
   */
  async interceptFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const urlString = typeof url === 'string' ? url : url.toString();

    // Check if this is a Supabase API request
    const isSupabaseRequest = this.allowedHosts.some(host => urlString.includes(host));

    // If not a Supabase request, allow it
    if (!isSupabaseRequest) {
      return this.originalFetch(url, options);
    }

    // Check if this is a write operation
    const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    if (isWriteOperation && this.enabled) {
      // Block the request
      const blockedRequest = {
        url: urlString,
        method: method,
        timestamp: new Date(),
        options: options
      };

      this.blockedAttempts.push(blockedRequest);

      console.warn('🚫 Blocked write operation:', method, urlString);

      // Emit custom event for UI notification
      window.dispatchEvent(new CustomEvent('api-blocked', {
        detail: {
          method,
          url: urlString,
          message: `Cannot ${method} in read-only mode`
        }
      }));

      // Return a fake rejected response
      return Promise.reject(new Error(`READ-ONLY MODE: ${method} operations are blocked. This is a desktop read-only instance.`));
    }

    // Allow read operations
    console.log('✅ Allowed read operation:', method, urlString);
    return this.originalFetch(url, options);
  }

  /**
   * Get blocked attempts
   */
  getBlockedAttempts() {
    return this.blockedAttempts;
  }

  /**
   * Clear blocked attempts history
   */
  clearBlockedAttempts() {
    this.blockedAttempts = [];
  }

  /**
   * Enable/disable interceptor
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`🛡️ Read-Only Mode: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Check if interceptor is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

// Export for use in preload script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIInterceptor;
}
