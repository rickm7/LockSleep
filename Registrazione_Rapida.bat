@echo off
title LockSleep - Registrazione Rapida
set "HTML_PATH=%~dp0index.html"
set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"

if exist "%CHROME_PATH%" (
    start "" "%CHROME_PATH%" --app="file:///%HTML_PATH%?autostart=1" --allow-file-access-from-files --start-maximized
    exit /b
)

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="file:///%HTML_PATH%?autostart=1" --allow-file-access-from-files --start-maximized
    exit /b
)
