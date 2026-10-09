@echo off
title Configure Backend Server IP
echo ===============================================================================
echo   CONNECT GUARDIAN SAFETY PORTAL TO TEAMMATE'S BACKEND LAPTOP
echo ===============================================================================
echo.
echo If your teammate is running the Backend Server on another laptop,
echo ask them for their Wi-Fi IPv4 address (e.g., 192.168.1.15).
echo.
set /p BACKEND_IP="Enter Backend Laptop IP (or press Enter for localhost): "

if "%BACKEND_IP%"=="" set BACKEND_IP=localhost

echo.
echo Setting backend URL to: http://%BACKEND_IP%:5000
echo VITE_BACKEND_URL=http://%BACKEND_IP%:5000> .env

echo.
echo [SUCCESS] Config saved to .env!
echo You can now double-click START_GUARDIAN_PORTAL.bat to launch.
echo ===============================================================================
pause
