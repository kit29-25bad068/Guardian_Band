@echo off
title GuardianBand - Guardian & Wearer Safety Portal (Port 5175)
echo ===============================================================================
echo   STARTING GUARDIAN & WEARER SAFETY PORTAL
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

echo Starting Vite dev server on http://localhost:5175 ...
start http://localhost:5175
npm run dev
pause
