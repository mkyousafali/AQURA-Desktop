/**
 * Sync frontend source from the main AQURA web repository.
 * This copies the SvelteKit frontend into the desktop project for building.
 * 
 * Usage:
 *   node scripts/sync-from-web-repo.js              # Uses local C:\Aqura\frontend
 *   node scripts/sync-from-web-repo.js --from-git   # Clones from GitHub (for CI)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DESKTOP_DIR = path.join(__dirname, '..');
const FRONTEND_DEST = path.join(DESKTOP_DIR, 'frontend');

// Source: local development path or git clone
const LOCAL_FRONTEND = 'C:\\Aqura\\frontend';
const WEB_REPO = 'https://github.com/mkyousafali/Aqura.git';

async function main() {
  const useGit = process.argv.includes('--from-git');
  
  let sourceDir;
  
  if (useGit) {
    // CI mode: clone the web repo and use its frontend
    console.log('Cloning web repository...');
    const tempDir = path.join(DESKTOP_DIR, '.temp-web-repo');
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    
    execSync(`git clone --depth 1 ${WEB_REPO} "${tempDir}"`, { stdio: 'inherit' });
    sourceDir = path.join(tempDir, 'frontend');
  } else {
    // Local mode: copy from adjacent folder
    sourceDir = LOCAL_FRONTEND;
    if (!fs.existsSync(sourceDir)) {
      console.error(`Local frontend not found at ${sourceDir}`);
      console.log('Use --from-git flag to clone from GitHub instead.');
      process.exit(1);
    }
  }

  console.log(`Syncing frontend from: ${sourceDir}`);
  
  // Create frontend directory
  if (!fs.existsSync(FRONTEND_DEST)) {
    fs.mkdirSync(FRONTEND_DEST, { recursive: true });
  }

  // Files/folders to copy
  const toCopy = [
    'src',
    'static',
    'package.json',
    'pnpm-lock.yaml',
    'svelte.config.js',
    'vite.config.ts',
    'tsconfig.json',
    'tailwind.config.js',
    'postcss.config.js'
  ];

  for (const item of toCopy) {
    const src = path.join(sourceDir, item);
    const dest = path.join(FRONTEND_DEST, item);
    
    if (!fs.existsSync(src)) {
      console.log(`  Skipping ${item} (not found)`);
      continue;
    }
    
    // Remove existing
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true });
    }
    
    // Copy
    if (fs.statSync(src).isDirectory()) {
      copyDirSync(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
    console.log(`  ✓ ${item}`);
  }

  // Cleanup temp repo
  if (useGit) {
    const tempDir = path.join(DESKTOP_DIR, '.temp-web-repo');
    fs.rmSync(tempDir, { recursive: true });
  }

  console.log('\n✅ Frontend synced successfully!');
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
