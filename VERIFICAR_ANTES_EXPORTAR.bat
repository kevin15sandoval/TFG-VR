@echo off
echo ═══════════════════════════════════════════════════════════════
echo    VERIFICACION PRE-EXPORTACION v3.9.0
echo ═══════════════════════════════════════════════════════════════
echo.

echo [1/5] Verificando rama Git...
git branch --show-current
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: No es un repositorio Git
    pause
    exit /b 1
)
echo ✅ Rama verificada
echo.

echo [2/5] Verificando commits recientes...
git log --oneline -5
echo ✅ Commits mostrados
echo.

echo [3/5] Verificando archivos clave...

findstr /C:"_show_countdown" city_vr_start.gd >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ city_vr_start.gd tiene _show_countdown
) else (
    echo ❌ ERROR: city_vr_start.gd NO tiene _show_countdown
)

findstr /C:"_setup_vr_quality" city_vr_start.gd >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ city_vr_start.gd tiene _setup_vr_quality
) else (
    echo ❌ ERROR: city_vr_start.gd NO tiene _setup_vr_quality
)

findstr /C:"reset_target" scenes\urban_target.gd >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ urban_target.gd tiene reset_target
) else (
    echo ❌ ERROR: urban_target.gd NO tiene reset_target
)

findstr /C:"_spawn_next_targets" scenes\city_game_manager.gd >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ city_game_manager.gd tiene _spawn_next_targets
) else (
    echo ❌ ERROR: city_game_manager.gd NO tiene _spawn_next_targets
)

echo.

echo [4/5] Verificando export preset...
findstr /C:"v3.9.0" export_presets.cfg >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ export_presets.cfg configurado para v3.9.0
) else (
    echo ❌ WARNING: export_presets.cfg NO tiene v3.9.0
    echo    Actualiza manualmente en Godot o cambia export_path
)
echo.

echo [5/5] Limpiando cache Godot...
if exist ".godot" (
    rmdir /s /q .godot
    echo ✅ Cache .godot eliminado
) else (
    echo ℹ️  Cache .godot ya estaba limpio
)
echo.

echo ═══════════════════════════════════════════════════════════════
echo    ✅ VERIFICACION COMPLETADA
echo ═══════════════════════════════════════════════════════════════
echo.
echo AHORA PUEDES:
echo 1. Abrir Godot
echo 2. Project ^> Export
echo 3. Seleccionar "APK_0.0.2"
echo 4. Verificar que dice: builds/NeuroVRRehab_v3.9.0_HD.apk
echo 5. Click "Export Project"
echo 6. Esperar 2-5 minutos
echo.
echo IMPORTANTE: Si ves v3.8.0 en lugar de v3.9.0, cambialo manualmente
echo            en la ventana de exportacion antes de exportar
echo.
pause
