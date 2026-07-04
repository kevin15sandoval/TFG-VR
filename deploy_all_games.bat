@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM Script de Deploy Automático - Sistema Hub World
REM ═══════════════════════════════════════════════════════════════════════════

echo.
echo ╔═══════════════════════════════════════════════════════════════════════╗
echo ║   🏛️ DEPLOY HUB WORLD - TFG NeuroVR                                  ║
echo ╚═══════════════════════════════════════════════════════════════════════╝
echo.

REM Verificar que estamos en el directorio correcto
if not exist "builds\" (
    echo ❌ ERROR: No se encuentra la carpeta builds/
    echo    Por favor ejecuta este script desde la raíz del proyecto TFG
    pause
    exit /b 1
)

if not exist "Plataforma_Clinica\" (
    echo ❌ ERROR: No se encuentra la carpeta Plataforma_Clinica/
    pause
    exit /b 1
)

echo [1/5] 📁 Verificando build del Hub...
echo.

if not exist "builds\hub\" (
    echo ❌ ERROR: No existe builds\hub\
    echo    Primero debes exportar HubWorld.tscn desde Godot
    echo.
    echo    Pasos:
    echo    1. Abre Godot
    echo    2. Project → Export
    echo    3. Exporta HubWorld a builds/hub/index.html
    pause
    exit /b 1
)

echo   ✅ Build del Hub encontrado

cd Plataforma_Clinica

echo.
echo [2/5] 🗑️  Limpiando build anterior...
echo.

if exist "dist\" rmdir /s /q "dist"
mkdir dist

echo [3/5] 📦 Copiando Hub World a dist...
echo.

xcopy /E /I /Q /Y "..\builds\hub\*.*" "dist\" >nul
if errorlevel 1 (
    echo   ❌ ERROR: No se pudo copiar el Hub
    pause
    exit /b 1
) else (
    echo   ✅ Hub World copiado correctamente
)

echo.
echo [4/5] 🏗️  Building plataforma clínica...
echo.

REM Crear carpeta temporal para la plataforma
mkdir dist\app >nul 2>&1

REM Build de la plataforma (esto irá en /app/ o similar)
call npm run build
if errorlevel 1 (
    echo ❌ ERROR: Build de la plataforma falló
    pause
    exit /b 1
)

echo.
echo [5/5] 🚀 Desplegando a Firebase Hosting...
echo.

call firebase deploy --only hosting
if errorlevel 1 (
    echo ❌ ERROR: Deploy a Firebase falló
    pause
    exit /b 1
)

echo.
echo ╔═══════════════════════════════════════════════════════════════════════╗
echo ║   ✅ DEPLOY COMPLETADO EXITOSAMENTE                                   ║
echo ╚═══════════════════════════════════════════════════════════════════════╝
echo.
echo 🏛️ HUB WORLD:            https://tfg-vr.web.app/
echo 🏥 Plataforma Clínica:   https://tfg-vr.web.app/app/
echo.
echo 📝 NOTA: Ahora solo necesitas UNA URL para todos los juegos
echo    Los pacientes siempre van a: https://tfg-vr.web.app/
echo.

cd ..
pause
