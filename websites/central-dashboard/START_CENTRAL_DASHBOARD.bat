@echo off
title GuardianBand - Central Operations Dashboard (Port 5173)
echo ===============================================================================
echo   STARTING CENTRAL OPERATIONS DASHBOARD
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

echo Starting Vite dev server on http://localhost:5173 ...
start http://localhost:5173
npm run dev
pause
