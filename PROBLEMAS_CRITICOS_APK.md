# 🚨 PROBLEMAS CRÍTICOS DEL APK

## Fecha: 2026-07-06
## Reportados por usuario en Meta Quest

---

## ❌ PROBLEMA 1: Polling detecta pero NO carga juego

### Síntomas:
- Hub detecta sesión correctamente
- Dice "¡SESIÓN DETECTADA!"
- Dice "Cargando juego..."
- **PERO el juego nunca aparece**

### Causa probable:
- Error al cargar escena del juego
- Escena no existe en el APK
- Error de ruta en GAME_SCENES

### Diagnóstico necesario:
```powershell
# Conectar Meta Quest por USB
cd C:\Users\USUARIO\Downloads\platform-tools-latest-windows\platform-tools

# Capturar logs mientras reproduces el problema
adb logcat | findstr "Hub\|Error\|Godot"

# Buscar en logs:
[Hub] 🔄 Cargando juego: urban_attention_quest
[Hub] ✅ Escena del juego cargada  ← Si NO aparece, aquí está el error
[Hub] ✅ Sesión iniciada en GameManager
```

### Posibles soluciones:

**Solución 1: Verificar que escenas están en el APK**
```
Al exportar APK, verificar que están incluidas:
- World.tscn
- VaultWorld.tscn
- CityWorld.tscn
- LuggageWorld.tscn

En Godot:
Proyecto → Exportar → Recursos → Asegurarse que están marcadas
```

**Solución 2: Verificar game_id en configuración web**
```
Solo valores válidos:
- "gems"
- "vault_escape"
- "urban_attention_quest"
- "luggage_handler"

CUALQUIER OTRO VALOR = ERROR
```

**Solución 3: Añadir logs detallados**
```gdscript
// En hub_manager.gd → _load_game()
print("[Hub] 🔄 Cargando juego: ", game_id)
print("[Hub] 📂 Ruta escena: ", scene_path)
print("[Hub] ✅ ResourceLoader.exists: ", ResourceLoader.exists(scene_path))

// Si ResourceLoader.exists = false:
// La escena no está en el APK
```

---

## ❌ PROBLEMA 2: Sin colisiones - jugador atraviesa suelo

### Síntomas:
- En Hub, el jugador se cae por el suelo
- Atraviesa paredes
- No hay física del jugador

### Causa:
**XROrigin3D NO tiene colisión física por defecto**

### Solución: Añadir CharacterBody3D al jugador

#### Opción A: Script de movimiento VR con colisión

Crear `scripts/vr_player_movement.gd`:
```gdscript
extends CharacterBody3D

@onready var xr_origin = $XROrigin3D
@onready var xr_camera = $XROrigin3D/XRCamera3D

const GRAVITY = 9.8
var gravity_velocity = Vector3.ZERO

func _physics_process(delta):
    # Gravedad
    if not is_on_floor():
        gravity_velocity.y -= GRAVITY * delta
    else:
        gravity_velocity.y = 0
    
    # Aplicar velocidad
    velocity = gravity_velocity
    move_and_slide()
    
    # Sincronizar XROrigin con CharacterBody
    if xr_origin:
        xr_origin.global_position = global_position
```

#### Opción B: Añadir suelo invisible con colisión

En HubWorld.tscn:
```gdscript
[node name="InvisibleFloor" type="StaticBody3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="InvisibleFloor"]
shape = BoxShape3D  # size = Vector3(50, 0.5, 50)
position = Vector3(0, -0.25, 0)
```

#### Opción C: Modo Teleport (más fácil para VR)

```gdscript
# Añadir sistema de teleport en lugar de movimiento libre
# El jugador no se mueve con física, solo se teleporta
# Esto evita mareos en VR
```

### Implementación recomendada:

**PARA EL HUB (sala de espera):**
- Opción B: Suelo invisible
- No necesita movimiento, solo estar de pie

**PARA LOS JUEGOS:**
- Opción B: Suelos invisibles grandes
- El jugador se queda en un área definida
- No necesita caminar, solo moverse en espacio de juego

---

## 🔧 SOLUCIÓN RÁPIDA: Suelos con colisión

### HubWorld.tscn
```gdscript
[node name="Floor" type="StaticBody3D" parent="."]

[node name="MeshInstance3D" type="MeshInstance3D" parent="Floor"]
mesh = BoxMesh  # size = Vector3(50, 0.1, 50)
material_override = StandardMaterial3D  # transparent = true, albedo = invisible

[node name="CollisionShape3D" type="CollisionShape3D" parent="Floor"]
shape = BoxShape3D  # size = Vector3(50, 0.1, 50)
position = Vector3(0, -0.05, 0)
```

### World.tscn (Gems)
```gdscript
[node name="Floor" type="StaticBody3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Floor"]
shape = BoxShape3D
size = Vector3(20, 0.5, 30)
position = Vector3(0, -0.25, 0)
```

### VaultWorld.tscn
```gdscript
[node name="Floor" type="StaticBody3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Floor"]
shape = BoxShape3D
size = Vector3(10, 0.5, 10)
position = Vector3(0, -0.25, 0)
```

### CityWorld.tscn
```gdscript
[node name="Floor" type="StaticBody3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Floor"]
shape = BoxShape3D
size = Vector3(30, 0.5, 30)
position = Vector3(0, -0.25, 0)
```

### LuggageWorld.tscn
```gdscript
[node name="Floor" type="StaticBody3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Floor"]
shape = BoxShape3D
size = Vector3(15, 0.5, 15)
position = Vector3(0, -0.25, 0)
```

---

## ⚡ PROBLEMA 3: Cámara necesita recentrado

### Síntomas:
- Al iniciar, la cámara está en posición incorrecta
- El jugador aparece "dentro" de objetos
- Labels 3D no se ven bien

### Solución: Sistema de recentrado

```gdscript
// En cada vr_start.gd → _ready()
func _ready():
    await get_tree().process_frame
    _recenter_player()

func _recenter_player():
    # Obtener XROrigin y Cámara
    var xr_origin = get_node_or_null("XROrigin3D")
    var xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
    
    if xr_origin and xr_camera:
        # Posición inicial recomendada
        xr_origin.global_position = Vector3(0, 0, 3)
        
        # Rotar hacia labels si es necesario
        xr_origin.rotation_degrees.y = 0
        
        print("[VR] ✅ Jugador recentrado a posición inicial")
```

### Configurar posiciones iniciales:

**HubWorld:**
```gdscript
XROrigin3D.position = Vector3(0, 0, 5)  # Mirando hacia labels
```

**World (Gems):**
```gdscript
XROrigin3D.position = Vector3(0, 0, 0)  # Centro del tren
```

**VaultWorld:**
```gdscript
XROrigin3D.position = Vector3(0, 0, 3)  # Frente a paneles
```

**CityWorld:**
```gdscript
XROrigin3D.position = Vector3(0, 0, 0)  # Centro de ciudad
```

**LuggageWorld:**
```gdscript
XROrigin3D.position = Vector3(0, 0, -2)  # Frente a cinta
```

---

## 📋 PRIORIDAD DE FIXES

### 🔥 URGENTE (no funciona sin esto):
1. **Problema 1**: Juego no carga después de detección
   - Necesito logs de `adb logcat` para diagnosticar
   - Verificar que escenas están en APK

### ⚠️ IMPORTANTE (malo para experiencia):
2. **Problema 2**: Sin colisiones de suelo
   - Añadir StaticBody3D con BoxShape3D en cada escena
   - Fácil de implementar (5 minutos)

### 👍 MEJORA (nice to have):
3. **Problema 3**: Recentrado de cámara
   - Configurar posiciones iniciales de XROrigin3D
   - Mejora UX pero no bloquea funcionalidad

---

## 🎯 PLAN DE ACCIÓN

1. **AHORA:** Capturar logs del problema 1
   ```powershell
   adb logcat | findstr "Hub" > logs.txt
   ```

2. **DESPUÉS:** Implementar suelos con colisión
   - Abrir cada .tscn
   - Añadir StaticBody3D + CollisionShape3D
   - Probar que jugador no se cae

3. **LUEGO:** Ajustar posiciones de cámara
   - Configurar XROrigin3D.position en cada escena
   - Asegurar que labels y elementos se ven bien

---

**Documento creado:** 2026-07-06  
**Próximo paso:** Obtener logs de adb logcat para diagnosticar Problema 1
