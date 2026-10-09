@echo off
title GuardianBand - Wearable Device Simulator (Port 5176)
echo ===============================================================================
echo   STARTING WEARABLE DEVICE SIMULATOR
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

echo Starting Vite dev server on http://localhost:5176 ...
start http://localhost:5176
npm run dev
pause
