@echo off
title Installing GuardianBand Dependencies
echo ===============================================================================
echo   GUARDIANBAND ECOSYSTEM: INSTALLING ALL DEPENDENCIES
echo ===============================================================================
echo.

echo [1/5] Installing Backend dependencies...
call npm --prefix backend install
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Backend install failed!
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [2/5] Installing Police Control Room dependencies...
call npm --prefix websites/police-control-room install
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Police Control Room install failed!
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [3/5] Installing Central Dashboard dependencies...
call npm --prefix websites/central-dashboard install
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Central Dashboard install failed!
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [4/5] Installing Guardian Portal dependencies...
call npm --prefix websites/guardian-portal install
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Guardian Portal install failed!
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [5/5] Installing Wearable Device Simulator dependencies...
call npm --prefix websites/device-simulator install
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Device Simulator install failed!
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo ===============================================================================
echo   SUCCESS: All dependencies installed successfully!
echo   You can now run START_SYSTEM.bat to launch all 4 websites and backend!
echo ===============================================================================
pause
