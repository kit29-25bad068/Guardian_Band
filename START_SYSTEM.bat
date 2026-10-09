@echo off
title GuardianBand Ecosystem Master Launcher
echo ===============================================================================
echo   GUARDIANBAND MISSION CRITICAL EMERGENCY ECOSYSTEM
echo ===============================================================================
echo.
echo Starting all system services...
echo.

:: 1. Check if backend node_modules exist
if not exist "backend\node_modules" (
  echo [Notice] Dependencies not found. Running INSTALL_ALL.bat first...
  call INSTALL_ALL.bat
)

:: 2. Start Backend API on Port 5000
echo [1/5] Launching Backend API Engine (Port 5000)...
start "GuardianBand: Backend API (5000)" cmd /k "cd backend && npm start"

:: Wait 2 seconds for backend to initialize
timeout /t 2 /nobreak > nul

:: 3. Start Police Emergency Control Room on Port 5174
echo [2/5] Launching Police Emergency Control Room (Port 5174)...
start "GuardianBand: Police Control Room (5174)" cmd /k "cd websites\police-control-room && npm run dev"

:: 4. Start Central Operations Dashboard on Port 5173
echo [3/5] Launching Central Operations Dashboard (Port 5173)...
start "GuardianBand: Central Dashboard (5173)" cmd /k "cd websites\central-dashboard && npm run dev"

:: 5. Start Guardian & Wearer Portal on Port 5175
echo [4/5] Launching Guardian Safety Portal (Port 5175)...
start "GuardianBand: Guardian Portal (5175)" cmd /k "cd websites\guardian-portal && npm run dev"

:: 6. Start Wearable Device Simulator on Port 5176
echo [5/5] Launching Wearable Device Simulator (Port 5176)...
start "GuardianBand: Device Simulator (5176)" cmd /k "cd websites\device-simulator && npm run dev"

echo.
echo ===============================================================================
echo   ALL 4 WEBSITES AND BACKEND ENGINE ARE RUNNING!
echo.
echo   * Central Dashboard:      http://localhost:5173
echo   * Police Control Room:    http://localhost:5174
echo   * Guardian Safety Portal: http://localhost:5175
echo   * Wearable Simulator:     http://localhost:5176
echo   * Backend API Engine:     http://localhost:5000/health
echo ===============================================================================
echo.
echo Opening websites in your default browser...
timeout /t 3 /nobreak > nul

start http://localhost:5173
start http://localhost:5174
start http://localhost:5175
start http://localhost:5176

echo Done! Keep the terminal windows open while using GuardianBand.
pause
