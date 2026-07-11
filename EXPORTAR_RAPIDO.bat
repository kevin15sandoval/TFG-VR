@echo off
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║         EXPORT RAPIDO - CityWorld v3.9.6 FIXED              ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo [1/3] Limpiando cache .godot...
if exist ".godot" (
    rmdir /s /q ".godot"
    echo      ✓ Cache limpiado
) else (
    echo      ⓘ No hay cache para limpiar
)
echo.
echo [2/3] Verificando errores de compilacion...
"C:\Program Files\Godot_v4.6.1_stable_win64.exe" --headless --editor --quit 2>&1 | findstr /i "error parse failed" > nul
if %errorlevel% equ 0 (
    echo      ✗ HAY ERRORES DE COMPILACION!
    echo      → Ejecuta VERIFICAR_ANTES_EXPORTAR.bat para ver detalles
    pause
    exit /b 1
) else (
    echo      ✓ Sin errores de compilacion
)
echo.
echo [3/3] Exportando APK v3.9.6...
"C:\Program Files\Godot_v4.6.1_stable_win64.exe" --headless --export-release "APK_0.0.2" "builds\NeuroVRRehab_v3.9.6_FIXED.apk"
echo.
if exist "builds\NeuroVRRehab_v3.9.6_FIXED.apk" (
    echo ╔═══════════════════════════════════════════════════════════════╗
    echo ║                  ✓ EXPORT COMPLETADO                         ║
    echo ╚═══════════════════════════════════════════════════════════════╝
    echo.
    echo APK: builds\NeuroVRRehab_v3.9.6_FIXED.apk
    echo.
    echo CAMBIOS EN ESTA VERSION:
    echo   • Pantalla negra ARREGLADA ^(calidad VR revertida^)
    echo   • Numeros de secuencia DELANTE de globos
    echo   • Sonido de error SIN penalizacion
    echo   • Instruccion actualizada durante juego
    echo   • Modelos Sketchfab problematicos excluidos
    echo.
) else (
    echo ╔═══════════════════════════════════════════════════════════════╗
    echo ║                  ✗ EXPORT FALLIDO                            ║
    echo ╚═══════════════════════════════════════════════════════════════╝
    echo.
    echo Revisa los errores arriba
)
echo.
pause
