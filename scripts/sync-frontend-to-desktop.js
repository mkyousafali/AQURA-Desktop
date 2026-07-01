/**
 * Sync Frontend from Web Repository
 * 
 * Copies Svelte frontend from C:\Aqura\frontend to desktop/frontend
 * while preserving desktop-specific files.
 */

const fs = require('fs');
const path = require('path');

const WEB_FRONTEND = path.join(__dirname, '../../frontend');
const DESKTOP_FRONTEND = path.join(__dirname, '../frontend');

// Paths to preserve (desktop-specific)
const PRESERVE_PATHS = [
  'src/desktop/',
  'package.json',
  'vite.config.desktop.ts',
  '.env.desktop',
  'svelte.config.desktop.js'
];

// Paths to skip entirely
const SKIP_PATHS = [
  'node_modules',
  'build',
  'dist',
  '.svelte-kit',
  '.git'
];

/**
 * Check if path should be preserved
 */
function shouldPreserve(relativePath) {
  return PRESERVE_PATHS.some(preserve => 
    relativePath === preserve || 
    relativePath.startsWith(preserve + '/')
  );
}

/**
 * Check if path should be skipped
 */
function shouldSkip(relativePath) {
  return SKIP_PATHS.some(skip => 
    relativePath === skip || 
    relativePath.startsWith(skip + '/')
  );
}

/**
 * Copy directory recursively
 */
function copyDir(source, dest, relativePath = '') {
  // Create destination if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);
    const newRelativePath = path.join(relativePath, entry.name).replace(/\\/g, '/');

    // Skip certain paths
    if (shouldSkip(newRelativePath)) {
      console.log(`⏭️  SKIP: ${newRelativePath}`);
      continue;
    }

    // Preserve desktop-specific paths
    if (shouldPreserve(newRelativePath)) {
      if (fs.existsSync(destPath)) {
        console.log(`💾 PRESERVE: ${newRelativePath}`);
      } else {
        console.log(`⚠️  MISSING: ${newRelativePath} (desktop-specific, should exist)`);
      }
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(sourcePath, destPath, newRelativePath);
    } else {
      // Check if file needs updating
      let needsUpdate = true;
      
      if (fs.existsSync(destPath)) {
        const sourceContent = fs.readFileSync(sourcePath);
        const destContent = fs.readFileSync(destPath);
        needsUpdate = !sourceContent.equals(destContent);
      }

      if (needsUpdate) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ UPDATE: ${newRelativePath}`);
      } else {
        console.log(`   UNCHANGED: ${newRelativePath}`);
      }
    }
  }
}

/**
 * Main sync function
 */
function sync() {
  console.log('🔄 Syncing Frontend from Web Repository\n');
  console.log(`Source: ${WEB_FRONTEND}`);
  console.log(`Destination: ${DESKTOP_FRONTEND}\n`);

  if (!fs.existsSync(WEB_FRONTEND)) {
    console.error('❌ Web frontend not found at:', WEB_FRONTEND);
    process.exit(1);
  }

  console.log('📁 Copying files...\n');
  copyDir(WEB_FRONTEND, DESKTOP_FRONTEND);

  console.log('\n✅ Sync complete!');
  console.log('\n📝 Desktop-specific files preserved:');
  PRESERVE_PATHS.forEach(p => console.log(`   - ${p}`));
}

// Run if called directly
if (require.main === module) {
  sync();
}

module.exports = { sync };
