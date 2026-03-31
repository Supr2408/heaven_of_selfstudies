@echo off
REM NPTEL Hub - Frontend Startup Script for Windows

echo ========================================
echo  NPTEL Hub - Frontend Server
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] Node.js found: 
node --version

echo.
echo ========================================
echo Starting Frontend Server...
echo ========================================
cd /d "d:\heavens for self studies\nptel-hub\client"
echo Frontend directory: %cd%
npm run dev

pause
