# TAMS Frontend start script (Windows PowerShell)
# Backend is a separate repo: https://github.com/planeteyeai/TAMS-Backend

$ErrorActionPreference = "Stop"

Write-Host "Installing workspace dependencies..." -ForegroundColor Cyan
npm.cmd install

if (-not (Test-Path "frontend/.env")) {
    Write-Host "Creating frontend/.env from .env.example..." -ForegroundColor Yellow
    Copy-Item "frontend/.env.example" "frontend/.env"
}

$frontendPort = if ($env:PORT) { $env:PORT } else { "3000" }
$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } elseif ($frontendPort -match '^30(\d{2})$') { "80$($Matches[1])" } else { "8000" }

$backendDirs = @(
    (Join-Path $PSScriptRoot "..\tams-backend"),
    (Join-Path $PSScriptRoot "..\TAMS-Backend"),
    (Join-Path $PSScriptRoot "..\TAMS-Backend-sync"),
    (Join-Path $PSScriptRoot "backend")
)
$backendDir = $backendDirs | Where-Object { Test-Path (Join-Path $_ "app\main.py") } | Select-Object -First 1

if ($backendDir) {
    Write-Host "Starting backend from $backendDir on :$backendPort ..." -ForegroundColor Green
    $py = Join-Path $backendDir "venv\Scripts\python.exe"
    if (-not (Test-Path $py)) { $py = "python" }
    Start-Process -FilePath $py -ArgumentList "-m","uvicorn","app.main:app","--reload","--host","0.0.0.0","--port","$backendPort" -WorkingDirectory $backendDir -WindowStyle Minimized
} else {
    Write-Host "No local backend found. Clone it next to this repo:" -ForegroundColor Yellow
    Write-Host "  git clone https://github.com/planeteyeai/TAMS-Backend.git ..\TAMS-Backend" -ForegroundColor Yellow
    Write-Host "Frontend will start; API proxy looks for backend on :$backendPort." -ForegroundColor Yellow
}

$env:PORT = $frontendPort
$env:BACKEND_PORT = $backendPort
Write-Host "Starting TAMS Frontend on :$frontendPort ..." -ForegroundColor Green
npm.cmd run dev
