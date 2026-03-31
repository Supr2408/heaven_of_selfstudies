@echo off
REM NPTEL Hub - Quick Start Script for Windows

echo ========================================
echo  NPTEL Hub - Starting Development Servers
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
echo Starting Backend Server...
echo ========================================
cd /d "d:\heavens for self studies\nptel-hub\server"
echo Backend directory: %cd%
npm run dev

pause
