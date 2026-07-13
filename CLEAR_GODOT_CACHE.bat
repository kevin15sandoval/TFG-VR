@echo off
echo ========================================
echo  LIMPIEZA DE CACHE DE GODOT
echo ========================================
echo.
echo Este script eliminara completamente el cache de Godot
echo para forzar la re-importacion de todos los assets.
echo.
echo IMPORTANTE: Cierra Godot COMPLETAMENTE antes de continuar!
echo.
pause

echo.
echo [1/3] Cerrando procesos de Godot si existen...
taskkill /F /IM "Godot_v4.6-stable_win64.exe" 2>nul
taskkill /F /IM "godot.exe" 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Eliminando carpeta .godot/imported...
if exist ".godot\imported" (
    rmdir /s /q ".godot\imported"
    echo     - .godot\imported eliminado
) else (
    echo     - .godot\imported no existe
)

echo.
echo [3/3] Eliminando carpeta .godot/editor...
if exist ".godot\editor" (
    rmdir /s /q ".godot\editor"
    echo     - .godot\editor eliminado
) else (
    echo     - .godot\editor no existe
)

echo.
echo ========================================
echo  LIMPIEZA COMPLETADA
echo ========================================
echo.
echo PROXIMOS PASOS:
echo 1. Abre Godot
echo 2. Espera 1-2 minutos a que re-importe todos los assets
echo 3. Abre HubWorld.tscn y verifica que ves el modelo Loft
echo 4. Si ves el Loft correcto, exporta el APK de nuevo
echo.
pause
