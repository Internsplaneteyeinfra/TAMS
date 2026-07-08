@echo off
echo ===================================================
echo Starting TAMS Project Environment Setup and Run
echo ===================================================

:: Check if backend venv exists
if not exist "backend\venv" (
    echo Creating Python virtual environment in backend\venv...
    python -m venv backend\venv
)

:: Upgrade pip and setuptools
echo Upgrading pip, setuptools, and wheel...
call backend\venv\Scripts\python -m pip install --upgrade pip setuptools wheel

:: Install backend requirements
echo Installing backend dependencies...
call backend\venv\Scripts\pip install -r backend\requirements-local.txt

:: Install workspace dependencies (frontend workspace + root devDependencies like concurrently)
echo Installing workspace dependencies...
call npm install

echo Starting Frontend (3000) and Backend (8000) concurrently...
call npm run dev
