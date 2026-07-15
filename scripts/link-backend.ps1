# Ensure the Backend repo sits next to this Frontend repo and is ready to run.
# Layout:
#   Desktop/TAMS            ← https://github.com/vishalbhor-45/TAMS
#   Desktop/TAMS-Backend    ← https://github.com/planeteyeai/TAMS-Backend

$ErrorActionPreference = "Stop"
$frontendRoot = Split-Path $PSScriptRoot -Parent
$sibling = Join-Path (Split-Path $frontendRoot -Parent) "TAMS-Backend"
$backendRepo = "https://github.com/planeteyeai/TAMS-Backend.git"

if (-not (Test-Path (Join-Path $sibling "app\main.py"))) {
    Write-Host "Cloning backend to $sibling ..." -ForegroundColor Cyan
    git clone $backendRepo $sibling
} else {
    Write-Host "Backend already at $sibling" -ForegroundColor Green
}

if (-not (Test-Path (Join-Path $sibling ".env"))) {
    $example = Join-Path $sibling ".env.example"
    if (Test-Path $example) {
        Copy-Item $example (Join-Path $sibling ".env")
        Write-Host "Created TAMS-Backend/.env from .env.example" -ForegroundColor Yellow
    }
}

$feEnv = Join-Path $frontendRoot "frontend\.env"
$feExample = Join-Path $frontendRoot "frontend\.env.example"
if (-not (Test-Path $feEnv) -and (Test-Path $feExample)) {
    Copy-Item $feExample $feEnv
    Write-Host "Created frontend/.env from .env.example" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Connection:" -ForegroundColor Cyan
Write-Host "  Frontend  http://localhost:3000"
Write-Host "  Backend   http://127.0.0.1:8000"
Write-Host "  Proxy     /api/*  ->  BACKEND_URL (frontend/.env)"
Write-Host ""
Write-Host "Start stack:  .\run.ps1   or   npm run dev:stack"
Write-Host $sibling
