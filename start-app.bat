@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"
if errorlevel 1 (
    echo.
    echo AccessLens could not start. Review the message above.
    pause
)
endlocal
