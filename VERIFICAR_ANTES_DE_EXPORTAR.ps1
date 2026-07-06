# Script de Verificacion Final Antes de Exportar APK
# NeuroVR Rehab - TFG
# Fecha: 2026-07-06

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  VERIFICACION FINAL DEL SISTEMA VR" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$errores = 0
$advertencias = 0

# Verificar Escenas de Juegos
Write-Host "1. VERIFICANDO ESCENAS DE JUEGOS..." -ForegroundColor Yellow

$escenas_requeridas = @(
    "HubWorld.tscn",
    "World.tscn",
    "VaultWorld.tscn",
    "CityWorld.tscn",
    "LuggageWorld.tscn"
)

foreach ($escena in $escenas_requeridas) {
    if (Test-Path $escena) {
        Write-Host "   OK: $escena" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: $escena - NO ENCONTRADA" -ForegroundColor Red
        $errores++
    }
}

# Verificar Colisiones en Escenas
Write-Host ""
Write-Host "2. VERIFICANDO COLISIONES DE SUELO..." -ForegroundColor Yellow

function Verificar-Colision {
    param($archivo)
    
    if (Test-Path $archivo) {
        $contenido = Get-Content $archivo -Raw
        
        $tiene_staticbody = $contenido -match 'StaticBody3D|CollisionFloor'
        $tiene_collision = $contenido -match 'CollisionShape3D'
        $tiene_boxshape = $contenido -match 'BoxShape3D.*floor|BoxShape_floor'
        
        if ($tiene_staticbody -and $tiene_collision -and $tiene_boxshape) {
            Write-Host "   OK: $archivo tiene suelo con colision" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   ADVERTENCIA: $archivo - FALTA COLISION DE SUELO" -ForegroundColor Yellow
            $script:advertencias++
            return $false
        }
    }
    return $false
}

foreach ($escena in $escenas_requeridas) {
    Verificar-Colision $escena | Out-Null
}

# Verificar Scripts Criticos
Write-Host ""
Write-Host "3. VERIFICANDO SCRIPTS CRITICOS..." -ForegroundColor Yellow

$scripts_criticos = @(
    @{Ruta="hub_manager.gd"; Debe="GAME_SCENES"; Descripcion="Mapeo de game_id a escenas"},
    @{Ruta="scripts\game_manager.gd"; Debe="apply_config"; Descripcion="Sistema de configuracion"},
    @{Ruta="scripts\firebase_manager.gd"; Debe="start_polling"; Descripcion="Sistema de polling"},
    @{Ruta="vr_start.gd"; Debe="_on_new_session_detected"; Descripcion="Deteccion de sesion"}
)

foreach ($script in $scripts_criticos) {
    if (Test-Path $script.Ruta) {
        $contenido = Get-Content $script.Ruta -Raw
        if ($contenido -match $script.Debe) {
            Write-Host "   OK: $($script.Ruta) - $($script.Descripcion)" -ForegroundColor Green
        } else {
            Write-Host "   ERROR: $($script.Ruta) - FALTA: $($script.Debe)" -ForegroundColor Red
            $errores++
        }
    } else {
        Write-Host "   ERROR: $($script.Ruta) - NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# Verificar Game Managers
Write-Host ""
Write-Host "4. VERIFICANDO GAME MANAGERS..." -ForegroundColor Yellow

$game_managers = @(
    "scenes\vault_game_manager.gd",
    "scenes\city_game_manager.gd",
    "scenes\luggage_game_manager.gd"
)

foreach ($gm in $game_managers) {
    if (Test-Path $gm) {
        $contenido = Get-Content $gm -Raw
        $tiene_signal = $contenido -match 'GameManager\.session_started\.connect'
        
        if ($tiene_signal) {
            Write-Host "   OK: $gm conectado a session_started" -ForegroundColor Green
        } else {
            Write-Host "   ADVERTENCIA: $gm - No conectado a session_started" -ForegroundColor Yellow
            $advertencias++
        }
    } else {
        Write-Host "   ERROR: $gm - NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# Verificar project.godot
Write-Host ""
Write-Host "5. VERIFICANDO project.godot..." -ForegroundColor Yellow

if (Test-Path "project.godot") {
    $project = Get-Content "project.godot" -Raw
    
    # Verificar HubWorld como main scene
    if ($project -match 'run/main_scene=".*HubWorld\.tscn"') {
        Write-Host "   OK: HubWorld.tscn configurado como main scene" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: HubWorld.tscn NO es la escena principal" -ForegroundColor Red
        $errores++
    }
    
    # Verificar GameManager autoload
    if ($project -match 'GameManager.*game_manager\.gd') {
        Write-Host "   OK: GameManager configurado como autoload" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: GameManager NO esta en autoload" -ForegroundColor Red
        $errores++
    }
    
    # Verificar OpenXR
    if ($project -match 'xr_mode.*1|openxr/enabled.*true') {
        Write-Host "   OK: OpenXR habilitado" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA: OpenXR podria no estar habilitado" -ForegroundColor Yellow
        $advertencias++
    }
    
    # Verificar permisos de Internet
    if ($project -match 'permissions/internet.*true') {
        Write-Host "   OK: Permiso de Internet habilitado" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA: Permiso de Internet podria no estar habilitado" -ForegroundColor Yellow
        $advertencias++
    }
} else {
    Write-Host "   ERROR: project.godot NO ENCONTRADO" -ForegroundColor Red
    $errores++
}

# Verificar Modelos 3D
Write-Host ""
Write-Host "6. VERIFICANDO MODELOS 3D..." -ForegroundColor Yellow

$modelos_requeridos = @(
    "models\loft2_free_interior.glb",
    "models\sci-fi_train.glb",
    "models\cofre_bank.glb",
    "models\procedural_city_5.glb",
    "models\abandoned_underground_train_station.glb",
    "models\industrial_conveyor_belt.glb"
)

foreach ($modelo in $modelos_requeridos) {
    if (Test-Path $modelo) {
        Write-Host "   OK: $modelo" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA: $modelo - NO ENCONTRADO" -ForegroundColor Yellow
        $advertencias++
    }
}

# Resumen Final
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  RESUMEN DE VERIFICACION" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($errores -eq 0 -and $advertencias -eq 0) {
    Write-Host "TODO PERFECTO! Sistema listo para exportar" -ForegroundColor Green
    Write-Host ""
    Write-Host "PROXIMOS PASOS:" -ForegroundColor Cyan
    Write-Host "   1. Abrir Godot" -ForegroundColor White
    Write-Host "   2. Proyecto -> Exportar" -ForegroundColor White
    Write-Host "   3. Seleccionar Android" -ForegroundColor White
    Write-Host "   4. Verificar que todas las escenas .tscn esten incluidas" -ForegroundColor White
    Write-Host "   5. Exportar APK" -ForegroundColor White
    Write-Host "   6. Instalar en Meta Quest con adb install" -ForegroundColor White
} elseif ($errores -eq 0) {
    Write-Host "$advertencias advertencias encontradas" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "El sistema deberia funcionar, pero revisa las advertencias arriba." -ForegroundColor Yellow
} else {
    Write-Host "$errores errores criticos encontrados" -ForegroundColor Red
    Write-Host "$advertencias advertencias encontradas" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "CORRIGE LOS ERRORES ANTES DE EXPORTAR" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Pausa
Read-Host "Presiona Enter para salir"
