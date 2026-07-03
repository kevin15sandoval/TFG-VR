# 🤏 GUÍA: Cómo Configurar el Agarre de Maletas en VR

## 📋 SISTEMA DE AGARRE

### **¿Cómo funciona?**

```
1. MALETA tiene Area3D → Detecta cuando controlador está cerca
2. CONTROLADOR XR escucha botón "grip" → Al apretar, agarra
3. MALETA se "pega" al controlador → Se mueve con la mano
4. Al soltar grip → Maleta suelta y cae con física
```

---

## 🏗️ CONFIGURACIÓN EN GODOT

### **PASO 1: Configurar XROrigin3D**

En tu escena `LuggageWorld.tscn`:

```
LuggageWorld (Node3D)
├── XROrigin3D
│   ├── XRCamera3D (cámara del jugador)
│   ├── LeftHand (XRController3D) ← AÑADIR SCRIPT
│   └── RightHand (XRController3D) ← AÑADIR SCRIPT
```

#### **1.1 Configurar LeftHand:**
1. Selecciona nodo `LeftHand`
2. **Tracker**: Dejar en `left_hand`
3. **Pose**: `grip`
4. **Attach Script**: `res://scripts/xr_hand_controller.gd`
5. **En Inspector** → Script Variables:
   - `grip_button`: "grip_click"
   - `hand_name`: "LeftHand"

#### **1.2 Configurar RightHand:**
1. Selecciona nodo `RightHand`
2. **Tracker**: `right_hand`
3. **Pose**: `grip`
4. **Attach Script**: `res://scripts/xr_hand_controller.gd`
5. **En Inspector** → Script Variables:
   - `grip_button`: "grip_click"
   - `hand_name`: "RightHand"

---

### **PASO 2: Configurar la Maleta**

La escena `luggage_item.tscn` ya está lista, pero verifica:

```
LuggageItem (RigidBody3D) ← Script: luggage_item.gd
├── CollisionShape3D (BoxShape3D)
├── MeshInstance3D (visual)
├── Label3D (peso en kg)
├── GPUParticles3D (efectos)
└── GrabArea (Area3D) ← SE CREA AUTOMÁTICO EN _ready()
    └── CollisionShape3D (SphereShape3D, radio 0.3m)
```

El script `luggage_item.gd` ya tiene todo listo:
- ✅ Crea `GrabArea` automáticamente
- ✅ Detecta controladores XR cerca
- ✅ Tiene funciones `grab()` y `release()`

---

## 🎮 CÓMO SE USA EN VR

### **En el Meta Quest:**

1. **Acercar mano** a una maleta (radio 30cm)
   - La maleta detecta tu controlador
   - Tu controlador guarda referencia a la maleta

2. **Apretar GRIP** (botón lateral)
   - Controlador llama `maleta.grab(self)`
   - Maleta cambia a `freeze = true` (kinematic)
   - Vibración háptica según peso

3. **Mover la mano**
   - En cada frame (`_process`):
     ```gdscript
     held_object.global_position = global_position
     held_object.global_rotation = global_rotation
     ```
   - La maleta sigue tu mano exactamente

4. **Soltar GRIP**
   - Controlador llama `maleta.release()`
   - Maleta cambia a `freeze = false` (physics)
   - Cae con gravedad y física

---

## 🔧 DETALLES TÉCNICOS

### **¿Por qué funciona?**

#### **1. Detección de proximidad (Area3D)**
```gdscript
# En luggage_item.gd
func _on_grab_area_entered(body: Node3D) -> void:
    if body.is_in_group("xr_controller"):
        # Guardar referencia en el controlador
        body.set_meta("nearby_luggage", self)
```

#### **2. Agarre al apretar botón**
```gdscript
# En xr_hand_controller.gd
func _try_grab() -> void:
    var nearby_luggage = get_meta("nearby_luggage", null)
    if nearby_luggage:
        held_object = nearby_luggage
        held_object.grab(self)
```

#### **3. Seguir mano en cada frame**
```gdscript
# En xr_hand_controller.gd
func _process(_delta: float) -> void:
    if held_object:
        held_object.global_position = global_position
```

#### **4. Soltar con física**
```gdscript
# En luggage_item.gd
func release() -> void:
    freeze = false
    apply_central_impulse(Vector3.DOWN * 2.0)
```

---

## ⚙️ ALTERNATIVA: XR Tools Addon

Si quieres algo **MÁS FÁCIL** y **MÁS COMPLETO**, usa el addon **XR Tools**:

### **Instalar XR Tools:**
1. Descargar: https://github.com/GodotVR/godot-xr-tools
2. Copiar carpeta `addons/godot-xr-tools` a tu proyecto
3. Activar en Project → Project Settings → Plugins

### **Usar XR Tools:**
1. **Mano**: Usar `XRToolsFunctionPickup` en controlador
2. **Objeto**: Usar `XRToolsPickable` en maleta
3. **¡Listo!** Todo funciona automáticamente

**Ventajas:**
- ✅ Física realista automática
- ✅ Múltiples tipos de agarre (precision grip, power grip)
- ✅ Animaciones de manos
- ✅ Muy pulido

**Desventajas:**
- ❌ Dependencia externa
- ❌ Más complejo de configurar

---

## 🐛 TROUBLESHOOTING

### **Problema: No puedo agarrar la maleta**

**Solución 1:** Verifica que el controlador esté en el grupo
```gdscript
# En xr_hand_controller.gd _ready()
add_to_group("xr_controller")
```

**Solución 2:** Verifica el nombre del botón
```gdscript
# Probar diferentes nombres:
grip_button = "grip_click"     # OpenXR estándar
grip_button = "grip"           # Alternativa
grip_button = "trigger_click"  # Si usas trigger
```

**Solución 3:** Aumenta el radio del Area3D
```gdscript
# En luggage_item.gd
grab_shape.radius = 0.5  # Aumentar de 0.3 a 0.5m
```

### **Problema: La maleta "tiembla" en mi mano**

**Solución:** Desactivar colisión mientras está agarrada
```gdscript
func grab(hand: Node3D) -> void:
    freeze = true
    collision_layer = 0  # Desactivar colisión
    collision_mask = 0
```

### **Problema: La maleta no cae bien al soltar**

**Solución:** Aplicar velocidad del controlador
```gdscript
# En xr_hand_controller.gd
var last_position: Vector3
var velocity: Vector3

func _process(delta: float) -> void:
    velocity = (global_position - last_position) / delta
    last_position = global_position
    
func _release() -> void:
    if held_object:
        held_object.linear_velocity = velocity
```

---

## 📝 RESUMEN

### **Archivos necesarios:**
1. ✅ `scenes/luggage_item.gd` (ya actualizado)
2. ✅ `scripts/xr_hand_controller.gd` (creado)
3. ✅ Configurar en Godot (editor)

### **Pasos:**
1. Añadir script a `LeftHand` y `RightHand`
2. Configurar variables en Inspector
3. Probar en VR

### **Botones del Meta Quest:**
- **GRIP** (botón lateral) = Agarrar/Soltar
- **TRIGGER** (gatillo) = Alternativa (si cambias config)

---

## 🎮 ¿LISTO PARA PROBAR?

1. Abre Godot
2. Abre `LuggageWorld.tscn`
3. Añade scripts a controladores
4. Conecta Meta Quest
5. Dale a Play → ¡Agarra maletas! 📦✋

---

**¿Necesitas ayuda con algún paso específico?** 🤔
