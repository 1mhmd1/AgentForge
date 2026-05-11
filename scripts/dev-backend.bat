@echo off
REM Per-service launcher for the NestJS backend (port 3000).
REM Spawned by scripts\dev.bat into its own console window.

set "REPO_ROOT=%~dp0.."
cd /d "%REPO_ROOT%\apps\backend"
call npm run dev

echo.
echo [Backend exited]
pause
