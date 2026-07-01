# Download Portable PostgreSQL 16.x for Windows
# This script downloads and extracts PostgreSQL binaries for bundling with the app

$ErrorActionPreference = "Stop"

$POSTGRES_VERSION = "16.3"
$POSTGRES_DOWNLOAD_URL = "https://get.enterprisedb.com/postgresql/postgresql-$POSTGRES_VERSION-1-windows-x64-binaries.zip"
$DOWNLOAD_DIR = "$PSScriptRoot\..\resources"
$POSTGRES_DIR = "$DOWNLOAD_DIR\postgresql"
$ZIP_FILE = "$DOWNLOAD_DIR\postgresql.zip"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Portable Download Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create directories
Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $DOWNLOAD_DIR -Force | Out-Null
New-Item -ItemType Directory -Path $POSTGRES_DIR -Force | Out-Null

# Download PostgreSQL
Write-Host "Downloading PostgreSQL $POSTGRES_VERSION..." -ForegroundColor Yellow
Write-Host "URL: $POSTGRES_DOWNLOAD_URL" -ForegroundColor Gray
Write-Host "This may take several minutes (200+ MB download)..." -ForegroundColor Gray
Write-Host ""

try {
    # Use Invoke-WebRequest with progress
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $POSTGRES_DOWNLOAD_URL -OutFile $ZIP_FILE -UseBasicParsing
    $ProgressPreference = 'Continue'
    
    $fileSize = (Get-Item $ZIP_FILE).Length / 1MB
    $fileSizeRounded = [math]::Round($fileSize, 2)
    Write-Host "[OK] Downloaded successfully! ($fileSizeRounded MB)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ERROR] Download failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Manual download" -ForegroundColor Yellow
    Write-Host "1. Download from: $POSTGRES_DOWNLOAD_URL" -ForegroundColor Gray
    Write-Host "2. Save to: $ZIP_FILE" -ForegroundColor Gray
    Write-Host "3. Re-run this script" -ForegroundColor Gray
    exit 1
}

# Extract PostgreSQL
Write-Host "Extracting PostgreSQL binaries..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $ZIP_FILE -DestinationPath $POSTGRES_DIR -Force
    Write-Host "[OK] Extracted successfully!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ERROR] Extraction failed: $_" -ForegroundColor Red
    exit 1
}

# Verify extracted files
Write-Host "Verifying installation..." -ForegroundColor Yellow
$pgBin = "$POSTGRES_DIR\pgsql\bin\postgres.exe"
if (Test-Path $pgBin) {
    $version = & $pgBin --version
    Write-Host "[OK] PostgreSQL verified: $version" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[ERROR] postgres.exe not found at: $pgBin" -ForegroundColor Red
    exit 1
}

# Clean up zip file
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item $ZIP_FILE -Force
Write-Host "[OK] Removed temporary files" -ForegroundColor Green
Write-Host ""

# Display summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "PostgreSQL Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installation Path: $POSTGRES_DIR\pgsql" -ForegroundColor Cyan
Write-Host "Binaries: $POSTGRES_DIR\pgsql\bin\" -ForegroundColor Cyan
Write-Host "Data Directory: Will be created at first launch" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test the app with bundled PostgreSQL" -ForegroundColor Gray
Write-Host "2. Build the installer with bundled binaries" -ForegroundColor Gray
Write-Host ""
Write-Host "[OK] Ready to bundle with Electron app!" -ForegroundColor Green
