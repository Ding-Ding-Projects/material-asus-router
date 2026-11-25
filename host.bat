@echo off
rem Material Asus Router: one-click hosting with Docker on this computer or on another host over SSH.
rem
rem   host.bat                          menu: pick the target and what to do
rem   host.bat --detached               start in the background on this computer
rem   host.bat --logs                   start, then watch status and logs
rem   host.bat --stop                   stop it (settings and history are kept)
rem   host.bat --remote user@host       any of the above on a Docker host over SSH
rem   host.bat --port 8790 --tag 0.1.0  host port and image version
rem   host.bat --demo                   use the built-in pretend router instead of a real one
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\host.ps1" %*
set "code=%ERRORLEVEL%"
if "%~1"=="" pause
exit /b %code%
