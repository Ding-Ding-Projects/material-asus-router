@echo off
rem Material Asus Router: install the build dependencies (Node.js through Chocolatey if missing, app and desktop packages).
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1" -DependenciesOnly %*
set "code=%ERRORLEVEL%"
if "%CI%"=="" pause
exit /b %code%
