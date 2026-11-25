@echo off
rem Material Asus Router: build the installer (Squirrel.Windows Setup.exe, RELEASES, nupkg) and the portable .exe.
rem   build-installer.bat [-SkipTests]
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-installer.ps1" %*
set "code=%ERRORLEVEL%"
if "%~1"=="" if "%CI%"=="" pause
exit /b %code%
