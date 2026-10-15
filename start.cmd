@echo off
cd /d "%~dp0"
call npm start
if errorlevel 1 exit /b 1
pause
