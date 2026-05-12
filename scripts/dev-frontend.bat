@echo off
REM Per-service launcher for the Vite frontend (port 5173).
REM Spawned by scripts\dev.bat into its own console window.

set "REPO_ROOT=%~dp0.."
cd /d "%REPO_ROOT%\apps\frontend"
call npm run dev

echo.
echo [Frontend exited]
pause
