@echo off
REM ============================================================
REM AgentForge dev launcher - opens three console windows,
REM one per service. Run from anywhere:  scripts\dev.bat
REM
REM Each service runs in its own window so logs stay readable.
REM Ctrl+C inside a window stops only that service.
REM To stop all three at once:  scripts\dev-stop.bat
REM ============================================================

setlocal

set "REPO_ROOT=%~dp0.."
set "SCRIPTS=%~dp0"

if not exist "%REPO_ROOT%\venv\Scripts\python.exe" (
  echo [dev.bat] ERROR: venv\Scripts\python.exe not found.
  echo            Create it first:  python -m venv venv
  echo            Then:  .\venv\Scripts\activate ^&^& pip install -r Requirements.txt
  exit /b 1
)

if not exist "%REPO_ROOT%\apps\backend\node_modules" (
  echo [dev.bat] WARN: apps\backend\node_modules missing. Run "npm install" at repo root.
)

if not exist "%REPO_ROOT%\.env" (
  echo [dev.bat] WARN: .env not found at repo root. Copy .env.example and fill it in.
)

echo [dev.bat] Launching AI service (port 4000)...
start "AgentForge - AI (4000)" cmd /k "%SCRIPTS%dev-ai.bat"

echo [dev.bat] Launching backend (port 3000)...
start "AgentForge - Backend (3000)" cmd /k "%SCRIPTS%dev-backend.bat"

echo [dev.bat] Launching frontend (port 5173)...
start "AgentForge - Frontend (5173)" cmd /k "%SCRIPTS%dev-frontend.bat"

echo.
echo [dev.bat] All three windows opened. Wait ~10-20s for everything to come up,
echo            then open http://localhost:5173 in your browser.
echo [dev.bat] To stop everything:  scripts\dev-stop.bat
echo.
endlocal
