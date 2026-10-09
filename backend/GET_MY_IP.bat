@echo off
title Your Local IP Address
echo ===============================================================================
echo   YOUR LOCAL IP ADDRESS (SHARE THIS WITH YOUR TEAMMATES)
echo ===============================================================================
echo.
echo Your active IPv4 address is:
powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { ($_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Ethernet*' -or $_.InterfaceAlias -like '*Wireless*') -and $_.IPAddress -notlike '169.*' -and $_.IPAddress -notlike '127.*' }).IPAddress | Select-Object -First 1"
echo.
echo ===============================================================================
echo Tell your teammates:
echo "Enter this IP address when prompted in your SET_BACKEND_IP.bat"
echo ===============================================================================
pause
