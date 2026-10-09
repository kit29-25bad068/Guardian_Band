@echo off
title GuardianBand - Central Backend Server (Port 5000)
echo ===============================================================================
echo   STARTING CENTRAL BACKEND API & SOCKET.IO ENGINE
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

echo Starting Node.js server on http://localhost:5000 ...
start http://localhost:5000/health
npm start
pause
