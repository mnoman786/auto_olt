@echo off
echo Starting Auto OLT Frontend...
cd /d "%~dp0frontend"

echo Installing dependencies...
call npm install

echo.
echo Frontend running at: http://localhost:3000
echo.

call npm run dev
