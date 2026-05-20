@echo off
title OBS Alerts Server - by @realproska
color 0D

echo ===================================================
echo         STARTING TWITCH ALERTS SERVER
echo             Created by @realproska
echo ===================================================
echo.

:: 1. CHECK IF NODE.JS IS INSTALLED
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js is not installed on your PC.
    echo [!] Downloading Node.js automatically...
    echo.
    
    :: Download the official Node.js LTS installer
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.13.1/node-v20.13.1-x64.msi' -OutFile 'Instalador_Node.msi'"
    
    echo [!] Installing Node.js... 
    echo [!] Please click "Yes" when Windows asks for Administrator permissions.
    
    :: Run passive installation (progress bar only)
    msiexec.exe /i Instalador_Node.msi /passive /norestart
    
    :: Delete the installer file to keep the folder clean
    del Instalador_Node.msi
    
    :: TRICK: Teach the current console where Node was installed
    :: so it can continue without needing to restart the file.
    set "PATH=%PATH%;C:\Program Files\nodejs"
    
    echo.
    echo [OK] Base installation completed. Continuing automatically...
    echo.
)

:: 2. CHECK IF PROGRAM LIBRARIES ARE INSTALLED
IF NOT EXIST "node_modules\" (
    echo [!] Downloading necessary files for the server...
    call npm install express socket.io tmi.js axios
    echo [ok] Installation complete.
    echo.
)

:: 3. START THE SERVER
echo Connecting to Twitch and opening your admin panel...
node server.js

pause