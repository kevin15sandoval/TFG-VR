@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM Script de Verificación del Sistema Multi-Juegos
REM ═══════════════════════════════════════════════════════════════════════════

echo.
echo ╔═══════════════════════════════════════════════════════════════════════╗
echo ║   🔍 VERIFICACIÓN DEL SISTEMA MULTI-JUEGOS                            ║
echo ╚═══════════════════════════════════════════════════════════════════════╝
echo.

set ERROR_COUNT=0

REM Verificar archivos críticos
echo [1] Verificando archivos del sistema VR...
echo.

if exist "vr_start.gd" (
    echo ✅ vr_start.gd encontrado
) else (
    echo ❌ vr_start.gd NO encontrado
    set /a ERROR_COUNT+=1
)

if exist "World.tscn" (
    echo ✅ World.tscn encontrado
) else (
    echo ❌ World.tscn NO encontrado
    set /a ERROR_COUNT+=1
)

if exist "VaultWorld.tscn" (
    echo ✅ VaultWorld.tscn encontrado
) else (
    echo ❌ VaultWorld.tscn NO encontrado
    set /a ERROR_COUNT+=1
)

if exist "CityWorld.tscn" (
    echo ✅ CityWorld.tscn encontrado
) else (
    echo ❌ CityWorld.tscn NO encontrado
    set /a ERROR_COUNT+=1
)

if exist "LuggageWorld.tscn" (
    echo ✅ LuggageWorld.tscn encontrado
) else (
    echo ❌ LuggageWorld.tscn NO encontrado
    set /a ERROR_COUNT+=1
)

echo.
echo [2] Verificando Game Managers...
echo.

if exist "scenes\vault_game_manager.gd" (
    echo ✅ vault_game_manager.gd encontrado
) else (
    echo ❌ vault_game_manager.gd NO encontrado
    set /a ERROR_COUNT+=1
)

if exist "scenes\city_game_manager.gd" (
    echo ✅ city_game_manager.gd encontrado
) else (
    echo ❌ city_game_manager.gd NO encontrado
    set /a ERROR_COUNT+=1
)

if exist "scenes\luggage_game_manager.gd" (
    echo ✅ luggage_game_manager.gd encontrado
) else (
    echo ❌ luggage_game_manager.gd NO encontrado
    set /a ERROR_COUNT+=1
)

echo.
echo [3] Verificando estructura de builds...
echo.

if exist "builds\" (
    echo ✅ Carpeta builds/ encontrada
    
    if exist "builds\gems\" (
        echo   ✅ builds\gems\ encontrada
    ) else (
        echo   ⚠️  builds\gems\ NO encontrada - Necesitas exportar desde Godot
    )
    
    if exist "builds\vault_escape\" (
        echo   ✅ builds\vault_escape\ encontrada
    ) else (
        echo   ⚠️  builds\vault_escape\ NO encontrada - Necesitas exportar desde Godot
    )
    
    if exist "builds\urban_attention_quest\" (
        echo   ✅ builds\urban_attention_quest\ encontrada
    ) else (
        echo   ⚠️  builds\urban_attention_quest\ NO encontrada - Necesitas exportar desde Godot
    )
    
    if exist "builds\luggage_handler\" (
        echo   ✅ builds\luggage_handler\ encontrada
    ) else (
        echo   ⚠️  builds\luggage_handler\ NO encontrada - Necesitas exportar desde Godot
    )
) else (
    echo ⚠️  Carpeta builds/ NO encontrada - Se creará al exportar desde Godot
)

echo.
echo [4] Verificando Plataforma Clínica...
echo.

if exist "Plataforma_Clinica\" (
    echo ✅ Carpeta Plataforma_Clinica/ encontrada
    
    if exist "Plataforma_Clinica\firebase.json" (
        echo   ✅ firebase.json encontrado
    ) else (
        echo   ❌ firebase.json NO encontrado
        set /a ERROR_COUNT+=1
    )
    
    if exist "Plataforma_Clinica\package.json" (
        echo   ✅ package.json encontrado
    ) else (
        echo   ❌ package.json NO encontrado
        set /a ERROR_COUNT+=1
    )
    
    if exist "Plataforma_Clinica\.env" (
        echo   ✅ .env encontrado
    ) else (
        echo   ❌ .env NO encontrado
        set /a ERROR_COUNT+=1
    )
) else (
    echo ❌ Carpeta Plataforma_Clinica/ NO encontrada
    set /a ERROR_COUNT+=1
)

echo.
echo [5] Verificando scripts de deploy...
echo.

if exist "deploy_all_games.bat" (
    echo ✅ deploy_all_games.bat encontrado
) else (
    echo ❌ deploy_all_games.bat NO encontrado
    set /a ERROR_COUNT+=1
)

echo.
echo ╔═══════════════════════════════════════════════════════════════════════╗

if %ERROR_COUNT% == 0 (
    echo ║   ✅ SISTEMA VERIFICADO - TODO CORRECTO                               ║
    echo ╚═══════════════════════════════════════════════════════════════════════╝
    echo.
    echo 📋 PRÓXIMOS PASOS:
    echo.
    echo   1. Abre Godot y exporta los 4 juegos
    echo   2. Ejecuta deploy_all_games.bat
    echo   3. ¡Disfruta del sistema multi-juegos!
) else (
    echo ║   ⚠️  ENCONTRADOS %ERROR_COUNT% ERRORES                                         ║
    echo ╚═══════════════════════════════════════════════════════════════════════╝
    echo.
    echo ❌ Por favor revisa los errores arriba antes de continuar
)

echo.
pause
