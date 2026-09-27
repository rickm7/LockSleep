@echo off
title LockSleep Desktop App
echo ========================================================
echo        LockSleep - App Desktop Monitoraggio Sonno
echo ========================================================
echo.

set HTML_PATH=%~dp0index.html
set HTML_PATH=%HTML_PATH:\=/%

if not exist node_modules\\electron\\dist\\electron.exe (\r\n    echo Installazione delle dipendenze...\r\n    call npm install\r\n    if errorlevel 1 ( echo Installazione non riuscita. & pause & exit /b 1 )\r\n)\r\necho Avvio di LockSleep con Electron...\r\ncall npm start\r\nexit /b

:: 4. Fallback nel browser predefinito
echo Avvio di LockSleep nel browser predefinito...
start "" "%~dp0index.html"

pause

