@echo off
title Servidor de Alertas OBS - by @realproska
color 0D

echo ===================================================
echo        INICIANDO SERVIDOR DE ALERTAS TWITCH
echo                  Creado por @realproska
echo ===================================================
echo.

:: 1. COMPROBAR SI NODE.JS ESTÁ INSTALADO
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js no esta instalado en tu PC.
    echo [!] Descargando Node.js automaticamente...
    echo.
    
    :: Descargar el instalador oficial de Node.js LTS
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.13.1/node-v20.13.1-x64.msi' -OutFile 'Instalador_Node.msi'"
    
    echo [!] Instalando Node.js... 
    echo [!] Por favor, dale a "Si" cuando Windows te pida permisos de Administrador.
    
    :: Ejecutar la instalacion pasiva (solo barra de progreso)
    msiexec.exe /i Instalador_Node.msi /passive /norestart
    
    :: Borrar el archivo instalador para no dejar basura
    del Instalador_Node.msi
    
    :: TRUCO: Le enseñamos a la consola actual dónde se instaló Node
    :: para que pueda continuar sin necesidad de reiniciar el archivo.
    set "PATH=%PATH%;C:\Program Files\nodejs"
    
    echo.
    echo [OK] Instalacion base completada. Continuando automaticamente...
    echo.
)

:: 2. COMPROBAR SI LAS LIBRERIAS DEL PROGRAMA ESTAN INSTALADAS
IF NOT EXIST "node_modules\" (
    echo [!] Descargando archivos necesarios para el servidor...
    call npm install express socket.io tmi.js axios
    echo [ok] Instalacion completa.
    echo.
)

:: 3. INICIAR EL SERVIDOR
echo Conectando con Twitch y abriendo tu panel de control...
node server.js

pause