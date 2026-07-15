# TAMS Frontend start script (Windows PowerShell)
# Backend is a separate repo: https://github.com/planeteyeai/TAMS-Backend

$ErrorActionPreference = "Stop"

Write-Host "Installing workspace dependencies..." -ForegroundColor Cyan
npm.cmd install

if (-not (Test-Path "frontend/.env")) {
    Write-Host "Creating frontend/.env from .env.example..." -ForegroundColor Yellow
    Copy-Item "frontend/.env.example" "frontend/.env"
}

$backendDirs = @(
    (Join-Path $PSScriptRoot "..\TAMS-Backend"),
    (Join-Path $PSScriptRoot "..\TAMS-Backend-sync"),
    (Join-Path $PSScriptRoot "backend")
)
$backendDir = $backendDirs | Where-Object { Test-Path (Join-Path $_ "app\main.py") } | Select-Object -First 1

if ($backendDir) {
    Write-Host "Starting backend from $backendDir on :8000 ..." -ForegroundColor Green
    $py = Join-Path $backendDir "venv\Scripts\python.exe"
    if (-not (Test-Path $py)) { $py = "python" }
    Start-Process -FilePath $py -ArgumentList "-m","uvicorn","app.main:app","--reload","--host","0.0.0.0","--port","8000" -WorkingDirectory $backendDir -WindowStyle Minimized
} else {
    Write-Host "No local backend found. Clone it next to this repo:" -ForegroundColor Yellow
    Write-Host "  git clone https://github.com/planeteyeai/TAMS-Backend.git ..\TAMS-Backend" -ForegroundColor Yellow
    Write-Host "Frontend will start; API proxy needs backend on :8000." -ForegroundColor Yellow
}

Write-Host "Starting TAMS Frontend on :3000 ..." -ForegroundColor Green
npm.cmd run dev
