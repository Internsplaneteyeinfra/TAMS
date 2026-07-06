@echo off
echo ===================================================
echo Starting TAMS Project Environment Setup & Run
echo ===================================================

:: Check if backend venv exists
if not exist "backend\venv" (
    echo Creating Python virtual environment in backend\venv...
    python -m venv backend\venv
)

:: Install backend requirements
echo Ensuring backend dependencies are installed...
call backend\venv\Scripts\pip install -r backend\requirements.txt

:: Check if frontend node_modules exists
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

:: Check if root node_modules exists
if not exist "node_modules" (
    echo Installing workspace dependencies...
    call npm install
)

echo Starting Frontend (3000) and Backend (8000) concurrently...
call npm run dev
