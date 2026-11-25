@echo off
rem Material Asus Router: build the Windows desktop app.
rem   build.bat            install what is missing, run the tests, build the app
rem   build.bat -Run       build, then start the app
rem   build.bat -SkipTests build without the test run
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1" %*
set "code=%ERRORLEVEL%"
if "%~1"=="" if "%CI%"=="" pause
exit /b %code%
