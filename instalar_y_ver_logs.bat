@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   INSTALAR APK Y VER LOGS EN META QUEST
echo ========================================
echo.

REM Verificar si existe el APK
if not exist "TFG.apk" (
    echo [ERROR] No se encuentra TFG.apk en esta carpeta
    echo.
    echo Por favor:
    echo 1. Exporta el proyecto desde Godot
    echo 2. Guarda el APK como TFG.apk en esta carpeta
    echo 3. Ejecuta este script de nuevo
    echo.
    pause
    exit /b 1
)

echo [1/4] Verificando conexion con Meta Quest...
adb devices
if errorlevel 1 (
    echo.
    echo [ERROR] ADB no esta instalado o no esta en el PATH
    echo.
    echo Necesitas Android Debug Bridge ^(ADB^)
    echo Descargalo de: https://developer.android.com/tools/releases/platform-tools
    echo.
    pause
    exit /b 1
)

echo.
echo [2/4] Conecta las gafas Meta Quest con USB
echo       y asegurate de que estan encendidas.
echo.
echo Presiona cualquier tecla cuando esten conectadas...
pause > nul

echo.
echo [3/4] Instalando TFG.apk en Meta Quest...
echo       (Esto puede tardar 30-60 segundos)
echo.
adb install -r TFG.apk

if errorlevel 1 (
    echo.
    echo [ERROR] Fallo la instalacion del APK
    echo.
    echo Posibles causas:
    echo - Las gafas no estan conectadas
    echo - No habilitaste el modo desarrollador en las gafas
    echo - El APK esta corrupto
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   INSTALACION EXITOSA
echo ========================================
echo.
echo Ahora vamos a ver los logs en tiempo real.
echo.
echo INSTRUCCIONES:
echo 1. Deja esta ventana abierta
echo 2. Ponte las gafas Meta Quest
echo 3. Abre la aplicacion TFG en las gafas
echo 4. Ve al portal web: https://tfg-vr.web.app
echo 5. Crea una nueva sesion
echo 6. Observa los logs en esta ventana
echo.
echo Deberias ver estas fases:
echo   - FASE 1: STARTUP
echo   - FASE 2: POLLING
echo   - FASE 3: DETECCION
echo   - FASE 4: INICIO
echo   - FASE 5: SPAWNER
echo   - FASE 6: JUEGO ACTIVO
echo.
echo Si ves hasta FASE 6: ¡FUNCIONA!
echo Si se detiene antes: copia los logs y enviaselos a Kevin
echo.
echo Presiona cualquier tecla para iniciar captura de logs...
pause > nul

echo.
echo [4/4] Capturando logs de Godot...
echo       (Presiona Ctrl+C para detener)
echo.
echo ========================================
echo.

adb logcat -c
adb logcat -s godot:V

endlocal
