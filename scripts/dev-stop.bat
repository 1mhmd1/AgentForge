@echo off
setlocal enabledelayedexpansion

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr ":3000 "') do (
  set "FOUND=1"
  echo Stopping backend on port 3000 ^(PID %%P^)
  taskkill /F /PID %%P /T >nul 2>&1
)
if not defined FOUND echo Nothing listening on port 3000

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr ":4000 "') do (
  set "FOUND=1"
  echo Stopping AI on port 4000 ^(PID %%P^)
  taskkill /F /PID %%P /T >nul 2>&1
)
if not defined FOUND echo Nothing listening on port 4000

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr ":5173 "') do (
  set "FOUND=1"
  echo Stopping frontend on port 5173 ^(PID %%P^)
  taskkill /F /PID %%P /T >nul 2>&1
)
if not defined FOUND echo Nothing listening on port 5173

echo Done.
endlocal
