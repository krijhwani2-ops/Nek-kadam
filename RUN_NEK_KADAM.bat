@echo off
TITLE NEK KADAM - PORTABLE EDITION
COLOR 0B

echo ========================================================
echo    NEK KADAM - CLINICAL SYSTEM (PORTABLE)
echo ========================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this PC.
    echo Please install Node.js from https://nodejs.org/ to run this app.
    pause
    exit /b
)

echo [SYSTEM] Starting Nek Kadam from Pendrive...
echo [SYSTEM] Local IP will be detected automatically.
echo.

:: Start the application
node start.cjs

pause
