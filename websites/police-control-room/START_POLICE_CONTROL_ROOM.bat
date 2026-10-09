@echo off
title GuardianBand - Police Emergency Control Room (Port 5174)
echo ===============================================================================
echo   STARTING POLICE EMERGENCY CONTROL ROOM
echo ===============================================================================
echo.

if not exist "node_modules" (
  echo [Notice] First time setup: Installing dependencies...
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b %ERRORLEVEL%
  )
)

echo Starting Vite dev server on http://localhost:5174 ...
start http://localhost:5174
npm run dev
pause
