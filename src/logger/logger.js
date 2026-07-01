/**
 * Logger Service
 * 
 * Winston-based logging system with file rotation
 */

const winston = require('winston');
const path = require('path');
const os = require('os');

// Get user data path for logs
// Handle both Electron and Node.js contexts
let userDataPath;
let appVersion = '1.0.0';

try {
  const { app } = require('electron');
  userDataPath = app.getPath('userData');
  appVersion = app.getVersion();
} catch (e) {
  // Running outside Electron (e.g., in test scripts)
  userDataPath = path.join(os.homedir(), 'AQURA Desktop');
}

const logsPath = path.join(userDataPath, 'logs');

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'aqura-desktop',
    version: appVersion
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsPath, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsPath, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Console output (development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0 && metadata.service) {
            delete metadata.service;
            delete metadata.version;
            if (Object.keys(metadata).length > 0) {
              msg += ` ${JSON.stringify(metadata)}`;
            }
          }
          return msg;
        })
      )
    })
  ]
});

/**
 * Log sync operation
 */
logger.logSync = (operation, data) => {
  logger.info(`[SYNC] ${operation}`, data);
};

/**
 * Log database operation
 */
logger.logDb = (operation, data) => {
  logger.info(`[DB] ${operation}`, data);
};

/**
 * Log storage operation
 */
logger.logStorage = (operation, data) => {
  logger.info(`[STORAGE] ${operation}`, data);
};

module.exports = logger;
