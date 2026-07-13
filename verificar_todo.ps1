# ═══════════════════════════════════════════════════════════════════════════
# SCRIPT DE VERIFICACIÓN COMPLETA - NEUROVR REHAB
# Verifica que todo esté configurado correctamente antes de exportar
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🔍 VERIFICACIÓN COMPLETA DEL SISTEMA NEUROVR REHAB" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$errores = 0
$warnings = 0

# ─────────────────────────────────────────────────────────────────────────────
# 1. VERIFICAR ARCHIVOS CRÍTICOS
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "📁 Verificando archivos críticos..." -ForegroundColor Yellow

$archivos_criticos = @(
    "project.godot",
    "export_presets.cfg",
    "HubWorld.tscn",
    "World.tscn",
    "VaultWorld.tscn",
    "CityWorld.tscn",
    "LuggageWorld.tscn",
    "hub_manager.gd",
    "vr_start.gd",
    "vault_vr_start.gd",
    "city_vr_start.gd",
    "luggage_vr_start.gd",
    "scripts/game_manager.gd",
    "scripts/firebase_manager.gd",
    "scenes/vault_game_manager.gd",
    "scenes/city_game_manager.gd",
    "scenes/luggage_game_manager.gd",
    "scenes/gem.tscn",
    "scenes/control_panel.tscn",
    "scenes/laser_beam.tscn",
    "scenes/urban_target.tscn",
    "scenes/luggage_item.tscn"
)

foreach ($archivo in $archivos_criticos) {
    if (Test-Path $archivo) {
        Write-Host "  ✅ $archivo" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FALTA: $archivo" -ForegroundColor Red
        $errores++
    }
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 2. VERIFICAR project.godot
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "⚙️ Verificando project.godot..." -ForegroundColor Yellow

$project_content = Get-Content "project.godot" -Raw

# Main scene
if ($project_content -match 'run/main_scene="res://HubWorld.tscn"') {
    Write-Host "  ✅ Main scene: HubWorld.tscn" -ForegroundColor Green
} else {
    Write-Host "  ❌ Main scene NO es HubWorld.tscn" -ForegroundColor Red
    $errores++
}

# Autoload GameManager
if ($project_content -match '\[autoload\]' -and $project_content -match 'GameManager=') {
    Write-Host "  ✅ GameManager registrado como autoload" -ForegroundColor Green
} else {
    Write-Host "  ❌ GameManager NO está como autoload" -ForegroundColor Red
    $errores++
}

# OpenXR
if ($project_content -match 'openxr/enabled=true') {
    Write-Host "  ✅ OpenXR activado" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ OpenXR no encontrado o desactivado" -ForegroundColor Yellow
    $warnings++
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 3. VERIFICAR export_presets.cfg
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "📦 Verificando export_presets.cfg..." -ForegroundColor Yellow

if (Test-Path "export_presets.cfg") {
    $export_content = Get-Content "export_presets.cfg" -Raw
    
    # Permisos Internet
    if ($export_content -match 'permissions/internet=true') {
        Write-Host "  ✅ Permisos Internet: ACTIVADOS" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Permisos Internet: DESACTIVADOS o NO ENCONTRADOS" -ForegroundColor Red
        Write-Host "     CRÍTICO: Firebase NO funcionará sin esto" -ForegroundColor Red
        $errores++
    }
    
    # Access Network State
    if ($export_content -match 'permissions/access_network_state=true') {
        Write-Host "  ✅ Permisos Access Network State: ACTIVADOS" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Permisos Access Network State: desactivados" -ForegroundColor Yellow
        $warnings++
    }
    
    # WiFi State
    if ($export_content -match 'permissions/access_wifi_state=true') {
        Write-Host "  ✅ Permisos Access WiFi State: ACTIVADOS" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Permisos Access WiFi State: desactivados" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "  ❌ export_presets.cfg NO EXISTE" -ForegroundColor Red
    $errores++
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 4. VERIFICAR FIREBASE_MANAGER
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "🔥 Verificando firebase_manager.gd..." -ForegroundColor Yellow

if (Test-Path "scripts/firebase_manager.gd") {
    $firebase_content = Get-Content "scripts/firebase_manager.gd" -Raw
    
    # PROJECT_ID
    if ($firebase_content -match 'const PROJECT_ID\s*:=\s*"tfg-vr"') {
        Write-Host "  ✅ PROJECT_ID: tfg-vr" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ PROJECT_ID no es tfg-vr" -ForegroundColor Yellow
        $warnings++
    }
    
    # save_results genérico
    if ($firebase_content -match 'func _add_vault_fields' -and 
        $firebase_content -match 'func _add_city_fields' -and
        $firebase_content -match 'func _add_luggage_fields') {
        Write-Host "  ✅ save_results soporta los 4 juegos" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ save_results puede no soportar todos los juegos" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "  ❌ firebase_manager.gd NO EXISTE" -ForegroundColor Red
    $errores++
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 5. VERIFICAR HUB_MANAGER
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "🏛️ Verificando hub_manager.gd..." -ForegroundColor Yellow

if (Test-Path "hub_manager.gd") {
    $hub_content = Get-Content "hub_manager.gd" -Raw
    
    # start_polling
    if ($hub_content -match 'start_polling\(\)') {
        Write-Host "  ✅ Inicia polling automático" -ForegroundColor Green
    } else {
        Write-Host "  ❌ NO inicia polling" -ForegroundColor Red
        $errores++
    }
    
    # GameManager.start_session()
    if ($hub_content -match 'GameManager\.start_session\(\)') {
        Write-Host "  ✅ Llama GameManager.start_session()" -ForegroundColor Green
    } else {
        Write-Host "  ❌ NO llama GameManager.start_session()" -ForegroundColor Red
        $errores++
    }
    
    # GAME_SCENES mapping
    if ($hub_content -match '"gems".*World\.tscn' -and
        $hub_content -match '"vault_escape".*VaultWorld\.tscn' -and
        $hub_content -match '"urban_attention_quest".*CityWorld\.tscn' -and
        $hub_content -match '"luggage_handler".*LuggageWorld\.tscn') {
        Write-Host "  ✅ Mapeo GAME_SCENES correcto" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Mapeo GAME_SCENES incompleto" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "  ❌ hub_manager.gd NO EXISTE" -ForegroundColor Red
    $errores++
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 6. VERIFICAR GAME MANAGERS
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "🎮 Verificando game managers..." -ForegroundColor Yellow

$game_managers = @(
    @{file="scenes/vault_game_manager.gd"; signal="panel_collected"; game_type="vault_escape"},
    @{file="scenes/city_game_manager.gd"; signal="target_collected"; game_type="urban_attention_quest"},
    @{file="scenes/luggage_game_manager.gd"; signal="luggage_placed"; game_type="luggage_handler"}
)

foreach ($gm in $game_managers) {
    if (Test-Path $gm.file) {
        $content = Get-Content $gm.file -Raw
        
        # Tiene señal game_finished
        if ($content -match 'signal game_finished') {
            Write-Host "  ✅ $($gm.file): tiene game_finished" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($gm.file): falta game_finished" -ForegroundColor Red
            $errores++
        }
        
        # Tiene game_type correcto
        if ($content -match "`"game_type`"\s*:\s*`"$($gm.game_type)`"") {
            Write-Host "  ✅ $($gm.file): game_type correcto" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ $($gm.file): game_type no encontrado" -ForegroundColor Yellow
            $warnings++
        }
        
        # Tiene campos de paciente
        if ($content -match 'GameManager\.patient_id') {
            Write-Host "  ✅ $($gm.file): usa campos de paciente" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ $($gm.file): no usa GameManager.patient_id" -ForegroundColor Yellow
            $warnings++
        }
    } else {
        Write-Host "  ❌ $($gm.file) NO EXISTE" -ForegroundColor Red
        $errores++
    }
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 7. VERIFICAR MODELOS 3D
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "🎨 Verificando modelos 3D..." -ForegroundColor Yellow

$modelos = @(
    "models/loft2_free_interior.glb",
    "models/cofre_bank.glb",
    "models/procedural_city_5.glb",
    "models/industrial_conveyor_belt.glb"
)

foreach ($modelo in $modelos) {
    if (Test-Path $modelo) {
        $size = (Get-Item $modelo).Length / 1MB
        Write-Host "  ✅ $modelo ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FALTA: $modelo" -ForegroundColor Red
        $errores++
    }
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# RESUMEN FINAL
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📊 RESUMEN DE VERIFICACIÓN" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($errores -eq 0 -and $warnings -eq 0) {
    Write-Host "  ✅ TODO PERFECTO - Sistema listo para exportar" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Siguiente paso:" -ForegroundColor Cyan
    Write-Host "  1. Abrir Godot 4.6" -ForegroundColor White
    Write-Host "  2. Proyecto → Exportar → APK_0.0.2" -ForegroundColor White
    Write-Host "  3. Export Project" -ForegroundColor White
    Write-Host ""
    exit 0
} elseif ($errores -eq 0) {
    Write-Host "  ⚠️ $warnings advertencias encontradas" -ForegroundColor Yellow
    Write-Host "  El sistema debería funcionar, pero revisa las advertencias" -ForegroundColor Yellow
    Write-Host ""
    exit 0
} else {
    Write-Host "  ❌ $errores ERRORES CRÍTICOS encontrados" -ForegroundColor Red
    Write-Host "  ⚠️ $warnings advertencias" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ¡ARREGLAR ANTES DE EXPORTAR!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Consulta:" -ForegroundColor Cyan
    Write-Host "  - QUE_HACER_SI_NO_FUNCIONA.md" -ForegroundColor White
    Write-Host "  - AUDITORIA_COMPLETA_SISTEMA.md" -ForegroundColor White
    Write-Host ""
    exit 1
}
