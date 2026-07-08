# TAMS Start Script for Windows (PowerShell)

# 1. Setup Backend Virtual Environment
if (-not (Test-Path "backend/venv")) {
    Write-Host "Creating Python virtual environment in backend/venv..." -ForegroundColor Cyan
    python -m venv backend/venv
}

# Upgrade pip and setuptools to prevent pkg_resources issues
Write-Host "Upgrading pip, setuptools, and wheel..." -ForegroundColor Cyan
& backend/venv/Scripts/python -m pip install --upgrade pip setuptools wheel

# Install backend dependencies using local lightweight requirements (avoids compilation of heavy libraries)
Write-Host "Installing lightweight local development dependencies..." -ForegroundColor Cyan
& backend/venv/Scripts/pip install -r backend/requirements-local.txt

# 2. Setup Frontend Dependencies
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "Installing frontend dependencies (node_modules)..." -ForegroundColor Cyan
    Set-Location frontend
    npm.cmd install
    Set-Location ..
}

# 3. Setup Root Workspace Dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing workspace dependencies..." -ForegroundColor Cyan
    npm.cmd install
}

# 4. Start Services Concurrently
Write-Host "Starting TAMS Frontend (Port 3000) & Backend (Port 8000)..." -ForegroundColor Green
npm.cmd run dev
