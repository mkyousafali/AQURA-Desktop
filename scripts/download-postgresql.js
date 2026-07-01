/**
 * Download PostgreSQL portable for bundling with the installer.
 * Used in CI/CD (GitHub Actions) and local development setup.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PG_VERSION = '16.3-1';
const PG_URL = `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-windows-x64-binaries.zip`;
const RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const ZIP_PATH = path.join(RESOURCES_DIR, 'postgresql.zip');
const EXTRACT_DIR = path.join(RESOURCES_DIR, 'postgresql');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading PostgreSQL ${PG_VERSION}...`);
    console.log(`URL: ${url}`);
    
    const file = fs.createWriteStream(dest);
    
    const request = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          request(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;
        
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          const pct = totalSize ? Math.round((downloaded / totalSize) * 100) : '?';
          process.stdout.write(`\rDownloading: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('\nDownload complete!');
          resolve();
        });
      }).on('error', reject);
    };
    
    request(url);
  });
}

async function main() {
  // Check if already exists
  if (fs.existsSync(path.join(EXTRACT_DIR, 'pgsql', 'bin', 'postgres.exe'))) {
    console.log('PostgreSQL already exists, skipping download.');
    return;
  }

  // Create directories
  if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  }

  // Download
  if (!fs.existsSync(ZIP_PATH)) {
    await downloadFile(PG_URL, ZIP_PATH);
  } else {
    console.log('ZIP already downloaded, extracting...');
  }

  // Extract
  console.log('Extracting PostgreSQL...');
  if (!fs.existsSync(EXTRACT_DIR)) {
    fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  }
  
  // Use PowerShell to extract
  execSync(`powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${EXTRACT_DIR}' -Force"`, {
    stdio: 'inherit'
  });

  console.log('PostgreSQL extracted successfully!');
  
  // Clean up zip
  fs.unlinkSync(ZIP_PATH);
  console.log('Cleaned up ZIP file.');
}

main().catch(err => {
  console.error('Failed to download PostgreSQL:', err);
  process.exit(1);
});
