@echo off
echo ═══════════════════════════════════════════════════════════════
echo    LOGS DE CITYWORLD EN TIEMPO REAL
echo ═══════════════════════════════════════════════════════════════
echo.
echo Conectando con Meta Quest...
echo Presiona Ctrl+C para detener
echo.
echo BUSCA ESTAS LINEAS:
echo   - "🎬 Iniciando countdown" (countdown)
echo   - "👁️ Mostrando HUD" (HUD visible)
echo   - "✅ Score visible" (score funciona)
echo   - "🎲 Intentando spawnar" (spawning)
echo   - "🎨 Configurando calidad VR" (anti-throttling)
echo.
echo ═══════════════════════════════════════════════════════════════
echo.

adb logcat -c
adb logcat | findstr /C:"CityVR" /C:"CityManager" /C:"UrbanTarget"
