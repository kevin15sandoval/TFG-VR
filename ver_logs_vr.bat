@echo off
echo ========================================
echo    VER LOGS DE GODOT EN META QUEST
echo ========================================
echo.
echo Conecta las gafas Meta Quest con USB
echo y asegurate de que estan encendidas.
echo.
echo Presiona cualquier tecla para iniciar...
pause > nul

echo.
echo Iniciando captura de logs...
echo (Presiona Ctrl+C para detener)
echo.
echo ========================================
echo.

adb logcat -s godot:V
