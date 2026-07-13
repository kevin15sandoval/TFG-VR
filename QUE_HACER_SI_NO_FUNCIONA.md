# 🔧 QUÉ HACER SI LOS JUEGOS NO FUNCIONAN

## 📋 DIAGNÓSTICO PASO A PASO

Si algún juego no funciona cuando lo pruebes, sigue estos pasos:

---

## 🔍 PASO 1: IDENTIFICAR EL PROBLEMA

### Pregunta 1: ¿El Hub se inicia?
- **SÍ → Ve a Pregunta 2**
- **NO → Problema con escena principal**

### Pregunta 2: ¿El Hub detecta la sesión?
- **SÍ → Ve a Pregunta 3**
- **NO → Problema con Firebase polling**

### Pregunta 3: ¿El juego carga?
- **SÍ → Ve a Pregunta 4**
- **NO → Problema con carga de escena**

### Pregunta 4: ¿El juego se inicia (countdown)?
- **SÍ → Ve a Pregunta 5**
- **NO → Problema con GameManager.start_session()**

### Pregunta 5: ¿Aparecen elementos visuales?
- **SÍ → Ve a Pregunta 6**
- **NO → Problema con instanciación de elementos**

### Pregunta 6: ¿Los elementos responden a interacción?
- **SÍ → Ve a Pregunta 7**
- **NO → Problema con detección de colisión**

### Pregunta 7: ¿Se guardan las métricas al terminar?
- **SÍ → ¡Todo funciona!**
- **NO → Problema con Firebase save**

---

## 🚨 SOLUCIONES POR PROBLEMA

### ❌ PROBLEMA: Hub no se inicia

**Síntomas:**
- APK abre pero pantalla negra
- No aparece el loft ni labels

**Causa probable:**
- Main scene no es HubWorld.tscn
- OpenXR no se inicializa

**Solución:**
```
1. Abrir Godot 4.6
2. Proyecto → Configuración del Proyecto
3. Application → Run → Main Scene
4. Verificar que dice: "res://HubWorld.tscn"
5. Si no, seleccionar HubWorld.tscn
6. Guardar y re-exportar APK
```

**Solución alternativa (modo debug):**
```gdscript
// En hub_manager.gd → _on_config_error()
// Ya existe código para cargar juego de prueba en 5 segundos
// Simplemente espera y debería auto-iniciar
```

---

### ❌ PROBLEMA: Hub no detecta sesión

**Síntomas:**
- Hub se queda en "Esperando que el fisioterapeuta..."
- Guardas config en web pero no pasa nada

**Causa probable:**
- Permisos de Internet NO activados
- Meta Quest sin WiFi
- Firestore no tiene la config

**Solución 1: Verificar permisos**
```
1. Abrir: export_presets.cfg
2. Buscar:
   permissions/internet=true
   permissions/access_network_state=true
3. Si dice false, cambiar a true
4. Guardar y re-exportar APK
```

**Solución 2: Verificar WiFi**
```
En Meta Quest:
Settings → WiFi → Conectar a red
```

**Solución 3: Verificar Firestore**
```
Firebase Console → Firestore Database
Colección: sesion_activa
Documento: current
¿Existe? ¿Tiene sessionId?
```

**Solución 4: Usar modo debug**
```gdscript
// En hub_manager.gd → _on_config_error()
// Después de 5 segundos carga juego de prueba
// Cambiar test_game_id para probar cada juego
```

---

### ❌ PROBLEMA: Juego no carga después de detección

**Síntomas:**
- Hub dice "¡SESIÓN DETECTADA!"
- Pero nunca aparece el juego

**Causa probable:**
- game_id incorrecto en config
- Escena del juego no existe
- Error en _load_game()

**Solución:**
```
Verificar game_id en plataforma web:
- "gems" → World.tscn ✅
- "vault_escape" → VaultWorld.tscn ✅
- "urban_attention_quest" → CityWorld.tscn ✅
- "luggage_handler" → LuggageWorld.tscn ✅

CUALQUIER OTRO VALOR = ERROR
```

**Ver logs en Godot:**
```powershell
# Conectar Meta Quest por USB
cd C:\Users\USUARIO\Downloads\platform-tools-latest-windows\platform-tools
adb logcat | findstr "Hub"

# Buscar:
[Hub] 🔄 Cargando juego: vault_escape
[Hub] ✅ Escena del juego cargada
[Hub] ✅ Sesión iniciada en GameManager
```

---

### ❌ PROBLEMA: Juego carga pero no se inicia (no hay countdown)

**Síntomas:**
- Aparece el ambiente del juego
- Pero no hay countdown "3, 2, 1, GO!"
- No aparece HUD (score, timer)

**Causa probable:**
- GameManager.start_session() no se llama
- vr_start no escucha session_started

**Solución (YA ARREGLADA en código):**
```gdscript
// En hub_manager.gd → _load_game()
// Línea crítica:
await get_tree().process_frame
if GameManager:
    GameManager.start_session()  // ← Esto debe estar

// Si falta, añadir y re-exportar
```

**Verificar logs:**
```
[Hub] ✅ Sesión iniciada en GameManager
[VaultVR] ▶ Sesión iniciada
```

---

### ❌ PROBLEMA: No aparecen elementos visuales

**Síntomas:**
- Juego inicia (countdown funciona)
- Pero no aparecen gemas / paneles / targets / maletas

**Causa probable (por juego):**

#### Gems Collection:
```
Problema: gem_spawner no genera gemas
Verificar:
1. ¿Existe nodo "GemSpawner" en World.tscn?
2. ¿GemSpawner tiene script gem_spawner.gd?
3. ¿gem.tscn existe en scenes/?

Solución rápida:
- Abrir World.tscn en Godot
- Verificar GemSpawner existe y tiene script
- Ejecutar escena (F6) para probar
```

#### Vault Escape:
```
Problema: Paneles o láseres no aparecen
Verificar:
1. VaultWorld.tscn tiene nodos:
   - ControlPanels (con 6 hijos)
   - LaserSetup (con 3 hijos)
2. vault_vr_start.gd llama _register_game_elements()

Solución rápida:
- Abrir VaultWorld.tscn
- Verificar ControlPanels tiene 6 Panel1-Panel6
- Verificar LaserSetup tiene 3 Laser1-Laser3
```

#### Urban Attention Quest:
```
Problema: Targets no aparecen
Verificar:
1. CityWorld.tscn tiene nodo UrbanTargets con 10 hijos
2. city_vr_start.gd llama _register_targets()

Solución:
- Abrir CityWorld.tscn
- Contar hijos de UrbanTargets (debe ser 10)
```

#### Luggage Handler:
```
Problema: No aparecen maletas
Verificar:
1. LuggageWorld.tscn tiene LuggageSpawner
2. luggage_spawner.gd está asignado
3. luggage_item.tscn existe

Solución:
- Verificar LuggageSpawner tiene script
- Verificar conveyor_speed > 0
```

---

### ❌ PROBLEMA: Elementos no responden a interacción

**Síntomas:**
- Elementos visuales SÍ aparecen
- Pero NO responden cuando los tocas/miras

**Causa probable:**
- Area3D sin CollisionShape3D
- Señales no conectadas
- Detección de mano/mirada desactivada

**Solución por juego:**

#### Gems:
```gdscript
// En gem.gd verificar:
func _ready():
    body_entered.connect(_on_body_entered)  // ← Debe estar
    area_entered.connect(_on_area_entered)  // ← Debe estar

func _on_body_entered(body):
    if "Hand" in body.name:
        _collect()  // ← Debe llamar esto
```

#### Vault Escape - Paneles:
```gdscript
// En control_panel.gd verificar:
func _ready():
    area_entered.connect(_on_area_entered)

func _on_area_entered(area):
    if "Hand" in area.name:
        emit_signal("panel_activated", panel_id, points)
```

#### Vault Escape - Láseres:
```gdscript
// En laser_beam.gd verificar:
func _ready():
    body_entered.connect(_on_body_entered)

func _on_body_entered(body):
    if body is CharacterBody3D or "Player" in body.name:
        emit_signal("player_hit")
```

#### Urban Attention Quest:
```gdscript
// En urban_target.gd verificar:
func _process(delta):
    _check_gaze_detection()  // ← Debe ejecutarse

func _check_gaze_detection():
    // Detecta si cámara mira al target
    if looking_at_me:
        gaze_time += delta
        if gaze_time >= activation_time:
            _activate()
```

#### Luggage Handler:
```gdscript
// En luggage_item.gd verificar:
func _ready():
    input_event.connect(_on_input_event)

func _on_input_event(camera, event, position, normal, shape_idx):
    if event is InputEventMouseButton and event.pressed:
        _grab()
```

---

### ❌ PROBLEMA: Métricas no se guardan al terminar

**Síntomas:**
- Juego termina correctamente
- Pero no aparecen resultados en Firebase/plataforma web

**Causa probable:**
- Firebase no tiene permisos de Internet
- game_finished no emite resultados
- firebase_manager.save_results() falla

**Solución:**

**1. Verificar permisos Internet (otra vez):**
```
export_presets.cfg → permissions/internet=true
```

**2. Verificar que game_finished se emite:**
```gdscript
// En vault_game_manager.gd → end_game()
game_finished.emit(results)  // ← Debe estar

// En vr_start.gd debe escuchar:
current_game_manager.game_finished.connect(_on_game_finished_wrapper)
```

**3. Verificar logs:**
```
[VaultManager] 🏁 Juego terminado
[VR] 🏁 Sesión terminada — Puntos: 450
[Firebase] 💾 Guardando resultados:
  - Juego: Laser Vault Escape
  - Paciente: ...
[Firebase] ✅ Resultados guardados correctamente
```

**4. Si Firebase falla, verificar PROJECT_ID:**
```gdscript
// En firebase_manager.gd
const PROJECT_ID := "tfg-vr"  // ← Debe ser correcto
```

---

## 🔧 HERRAMIENTAS DE DEBUG

### 1. Logs en tiempo real (Meta Quest conectado)
```powershell
cd C:\Users\USUARIO\Downloads\platform-tools-latest-windows\platform-tools
adb logcat | findstr "Godot"
```

### 2. Exportar con Debug activado
```
Godot → Proyecto → Exportar
Marcar: "Export with Debug"
Esto da más información en logs
```

### 3. Probar en Godot Editor (sin VR)
```
Godot → Abrir World.tscn / VaultWorld.tscn / etc.
Presionar F6 (Run Current Scene)
Probar gameplay sin necesidad de exportar APK
```

### 4. Verificar Firebase Console
```
https://console.firebase.google.com/
Proyecto: tfg-vr
Firestore Database:
- sesion_activa/current → Config de entrada
- sesiones/ → Resultados guardados
```

---

## 📞 SI NADA FUNCIONA

### Opción 1: Cargar juego directo (sin Hub)

Cambiar main scene temporalmente:

```
1. Godot → Proyecto → Configuración
2. Main Scene → Cambiar a "World.tscn" (o el juego que quieras probar)
3. Exportar APK
4. Instalar y probar

Esto omite Hub y carga el juego directamente.
Si funciona = problema está en Hub
Si no funciona = problema está en el juego
```

### Opción 2: Usar configuración de prueba

En cualquier vr_start, añadir al inicio de `_ready()`:

```gdscript
func _ready():
    # Configuración de prueba sin esperar Firebase
    GameManager.apply_config({
        "patient_id": "test",
        "patient_name": "Prueba",
        "session_id": "test_123",
        "duration": 60,  # 1 minuto para probar rápido
        "difficulty": "Fácil",
        "therapy_side": "Izquierdo",
        "session_type": "Alcance",
        "game_id": "gems"
    })
    
    await get_tree().create_timer(2.0).timeout
    GameManager.start_session()
    
    # ... resto del código
```

Esto inicia el juego automáticamente sin esperar config de Firebase.

### Opción 3: Enviarme logs

```powershell
# Conectar Meta Quest
cd C:\Users\USUARIO\Downloads\platform-tools-latest-windows\platform-tools

# Capturar logs a archivo
adb logcat > logs.txt

# Dejar correr 30 segundos mientras pruebas
# Ctrl+C para detener

# Enviarme logs.txt
```

---

## ✅ CHECKLIST DE VERIFICACIÓN RÁPIDA

Antes de reportar problema, verificar:

- [ ] Permisos Internet = true en export_presets.cfg
- [ ] Main scene = HubWorld.tscn en project.godot
- [ ] GameManager registrado como autoload
- [ ] Meta Quest conectado a WiFi
- [ ] APK instalado es el MÁS RECIENTE (v4.0_FINAL)
- [ ] Firestore tiene sesion_activa/current con datos
- [ ] game_id es uno de: gems, vault_escape, urban_attention_quest, luggage_handler
- [ ] Logs de Godot no muestran errores rojos

---

## 🎯 RESUMEN

**Si algo no funciona:**

1. **Identifica el problema** con las preguntas del paso 1
2. **Aplica la solución** correspondiente
3. **Verifica logs** para confirmar
4. **Re-exporta APK** si hiciste cambios
5. **Prueba de nuevo**

**Si sigues con problemas:**
- Usa herramientas de debug
- Prueba opciones alternativas
- Envía logs para análisis

**El código está correcto**, así que cualquier problema será de:
- Configuración (permisos, main scene)
- Exportación (APK viejo)
- Conectividad (WiFi, Firebase)

---

**Documento creado:** 2026-07-06  
**Para:** Troubleshooting NeuroVR Rehab v4.0  
**Si encuentras problemas:** Sigue esta guía paso a paso
