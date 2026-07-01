# AQURA Desktop

**Offline Windows POS System with One-Way Cloud Sync**

## 🚀 Overview

AQURA Desktop is a Windows desktop application that provides offline access to your AQURA cloud data. It features:

- ✅ **Offline POS System**: Full access to all data without internet
- ✅ **One-Way Sync**: Cloud → Desktop (read-only mode)
- ✅ **Identical UI**: Same Svelte frontend as web version
- ✅ **Local PostgreSQL**: Embedded database for fast performance
- ✅ **Storage Files**: All 34 storage buckets synced locally
- ✅ **Auto-Updates**: Seamless updates via GitHub Releases
- ✅ **Secure**: Credentials stored in Windows Credential Manager

## 🏗️ Architecture

```
AQURA Desktop
├── Electron v28+           (Desktop framework)
├── PostgreSQL 16.x         (Local embedded database)
├── Svelte + SvelteKit      (Frontend - synced from web)
├── Node.js v20+            (Backend services)
└── Supabase REST API       (Cloud sync via HTTPS)
```

## 📁 Directory Structure

```
desktop/
├── main.js                 # Electron main process
├── preload.js              # IPC bridge (secure)
├── package.json            # Dependencies
├── src/
│   ├── sync/               # Sync service
│   │   ├── sync-manager.js
│   │   ├── database-sync.js
│   │   ├── storage-sync.js
│   │   └── schema-migration.js
│   ├── database/           # PostgreSQL management
│   │   ├── postgres-manager.js
│   │   └── query-validator.js
│   ├── config/             # Configuration
│   │   └── cloud-config.js # Credential management
│   ├── updater/            # Auto-updates
│   │   └── github-updater.js
│   └── logger/             # Logging
│       └── logger.js
├── frontend/               # Svelte app (synced from web)
│   ├── src/desktop/        # Desktop-specific components
│   │   ├── DesktopHeader.svelte
│   │   ├── SyncStatusBar.svelte
│   │   └── ReadOnlyWrapper.svelte
│   └── ...                 # (synced from C:\Aqura\frontend)
├── resources/              # Icons, assets
├── installer/              # Inno Setup scripts
└── scripts/                # Build scripts
```

## 🔧 Development Setup

### Prerequisites
- Node.js v20+
- Git
- Windows 10/11

### Installation

```powershell
# Clone repository (when created)
git clone https://github.com/YourOrg/AQURA-Desktop.git
cd AQURA-Desktop

# Install dependencies
npm install

# Sync frontend from web repo (first time)
node scripts/sync-frontend-to-desktop.js

# Start in development mode
npm run dev
```

## 🔨 Development Workflow

### 1. Working on Web Features (Most Common)

```powershell
cd C:\Aqura\frontend
pnpm dev
# Make changes, test, deploy to Vercel
```

### 2. Syncing Web Updates to Desktop

```powershell
cd C:\AQURA-Desktop
node scripts/sync-frontend-to-desktop.js
npm start  # Test desktop app
```

### 3. Desktop-Specific Features

```powershell
cd C:\AQURA-Desktop\frontend\src\desktop
# Edit desktop components only
cd ../..
npm start  # Test
```

## 📦 Building Installer

```powershell
# Build Windows installer
npm run build:windows

# Output: build/AQURA-Desktop-Setup-1.0.0.exe
```

## 🔐 Security

- **Credentials**: Stored in Windows Credential Manager (keytar)
- **Backup**: Encrypted electron-store as fallback
- **Never in Git**: Credentials never committed
- **Installation**: User browses for .env file during install
- **Updates**: Credentials persist automatically (no re-entry)

## 📚 Documentation

See comprehensive guides in `C:\Aqura\Do not delete/`:

- **AQURA_DESKTOP_WINDOWS_DEVELOPMENT_PLAN.md** - Complete A-Z guide
- **DESKTOP_ARCHITECTURE_DECISIONS.md** - Key architectural decisions
- **DESKTOP_PRE_IMPLEMENTATION_CHECKLIST.md** - Pre-implementation verification

## 🧪 Testing

```powershell
# Test connection to Supabase
node scripts/test-connection.js

# Test sync service
node scripts/test-sync.js

# Full installer test (requires clean Windows VM)
build/AQURA-Desktop-Setup-1.0.0.exe
```

## 🚀 Deployment

1. **Tag Release**
   ```powershell
   git tag v1.0.0
   git push --tags
   ```

2. **GitHub Actions** builds installer automatically

3. **GitHub Release** created with installer attached

4. **Users** get update notification via electron-updater

## 📋 Current Status

**Phase:** ✅ Project Structure Created  
**Next:** Implement credential storage and connection testing  
**Timeline:** 4-5 weeks to v1.0.0

### Completed
- [x] Directory structure
- [x] Package.json configuration
- [x] Main process (main.js)
- [x] IPC bridge (preload.js)
- [x] Logger service
- [x] Cloud config (credential manager)
- [x] .gitignore setup

### In Progress
- [ ] Sync service implementation
- [ ] PostgreSQL manager
- [ ] Frontend integration
- [ ] Installer creation

## 🤝 Contributing

This is a private repository. Contact the team lead for access.

## 📝 License

UNLICENSED - Private/Proprietary

---

**Version:** 1.0.0  
**Last Updated:** 2026-07-01  
**Maintained By:** AQURA Development Team
