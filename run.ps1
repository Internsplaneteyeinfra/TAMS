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

# 2. Install workspace dependencies (frontend workspace + root devDependencies like concurrently)
Write-Host "Installing workspace dependencies..." -ForegroundColor Cyan
npm.cmd install

# Ensure env files exist (from templates) before start
if (-not (Test-Path "frontend/.env")) {
    Write-Host "Creating frontend/.env from .env.example..." -ForegroundColor Yellow
    Copy-Item "frontend/.env.example" "frontend/.env"
}
if (-not (Test-Path "backend/.env")) {
    Write-Host "Creating backend/.env from .env.example..." -ForegroundColor Yellow
    Copy-Item "backend/.env.example" "backend/.env"
}

# 4. Start Services Concurrently
Write-Host "Starting TAMS Frontend (Port 3000) & Backend (Port 8000 from backend/.env)..." -ForegroundColor Green
Write-Host "  Frontend proxies /api → BACKEND_URL in frontend/.env" -ForegroundColor DarkGray
npm.cmd run dev
