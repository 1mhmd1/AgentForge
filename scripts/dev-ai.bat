@echo off
REM Per-service launcher for the Python AI FastAPI server (port 4000).
REM Spawned by scripts\dev.bat into its own console window.

set "REPO_ROOT=%~dp0.."
if not exist "%REPO_ROOT%\venv\Scripts\python.exe" (
  echo ERROR: %REPO_ROOT%\venv\Scripts\python.exe not found.
  echo Create the venv first:  python -m venv venv
  pause
  exit /b 1
)

cd /d "%REPO_ROOT%\apps\ai"
"%REPO_ROOT%\venv\Scripts\python.exe" server.py

REM If python exits (crash or Ctrl+C), keep the window open so the user
REM can read the traceback.
echo.
echo [AI service exited]
pause
