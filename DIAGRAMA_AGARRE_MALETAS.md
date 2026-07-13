# 📦 DIAGRAMA: Sistema de Agarre de Maletas VR

## 🎯 FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 1: DETECCIÓN                            │
└─────────────────────────────────────────────────────────────────┘

    [CONTROLADOR VR]              [MALETA]
    (Tu mano izquierda)           (RigidBody3D)
           │                            │
           │                            │
           │  Acercas la mano          │
           │────────────────────────────>│
           │                            │
           │        ¿Está dentro        │
           │      del Area3D?           │
           │         (30cm)             │
           │                            │
           │<─────────────✓─────────────│
           │                            │
           │  Se guarda metadata        │
           │  "nearby_luggage" = maleta │
           │                            │


┌─────────────────────────────────────────────────────────────────┐
│                    FASE 2: AGARRE                               │
└─────────────────────────────────────────────────────────────────┘

    [CONTROLADOR VR]              [MALETA]
           │                            │
           │  Aprietas GRIP             │
    [👋 GRIP]                          │
           │                            │
           │  _on_button_pressed()      │
           │  _try_grab()               │
           │                            │
           │  held_object.grab(self) ───>│
           │                            │
           │                    grab(hand):
           │                    - freeze = true
           │                    - grabbed_by = hand
           │                    - vibración háptica
           │                            │
           │<────── Vibración ──────────│
           │      💪 Según peso         │


┌─────────────────────────────────────────────────────────────────┐
│                  FASE 3: MOVIMIENTO                             │
└─────────────────────────────────────────────────────────────────┘

    [CONTROLADOR VR]              [MALETA]
           │                            │
           │  Cada frame (60 FPS)       │
           │  _process(delta):          │
           │                            │
    Mueves la mano                      │
           │                            │
           │  held_object.position      │
           │  = global_position    ──────>│
           │                            │
           │                      Maleta se mueve
           │                      a tu posición
           │                      (sin física)
           │                            │
    [✋ Mano arriba]              [📦 Maleta arriba]
    [✋ Mano abajo]               [📦 Maleta abajo]
    [✋ Mano gira]                [📦 Maleta gira]


┌─────────────────────────────────────────────────────────────────┐
│                    FASE 4: SOLTAR                               │
└─────────────────────────────────────────────────────────────────┘

    [CONTROLADOR VR]              [MALETA]
           │                            │
           │  Sueltas GRIP              │
    [👋]                                │
           │                            │
           │  _on_button_released()     │
           │  _release()                │
           │                            │
           │  held_object.release() ────>│
           │                            │
           │                    release():
           │                    - freeze = false
           │                    - gravedad activa
           │                    - impulso hacia abajo
           │                            │
           │                     [📦 ↓]  Cae
           │                            │
           │                     [💥]  Aterriza
           │                     (colisión con suelo)
```

---

## 🔍 VISTA TÉCNICA

### **1. ESTRUCTURA DE NODOS**

```
LuggageWorld
│
├── XROrigin3D
│   ├── XRCamera3D
│   ├── LeftHand (XRController3D)
│   │   └── [Script: xr_hand_controller.gd]
│   │       Variables:
│   │       - held_object: RigidBody3D = null
│   │       - is_gripping: bool = false
│   │
│   └── RightHand (XRController3D)
│       └── [Script: xr_hand_controller.gd]
│
└── Luggage (Spawned dynamically)
    └── LuggageItem (RigidBody3D)
        ├── MeshInstance3D (visual 3D box)
        ├── CollisionShape3D (física)
        ├── Label3D (peso en kg)
        ├── GPUParticles3D (efectos)
        └── GrabArea (Area3D) ← CLAVE
            └── CollisionShape3D (SphereShape3D)
                Radio: 0.3 metros
```

---

### **2. CÓDIGO CLAVE**

#### **En el Controlador (xr_hand_controller.gd):**

```gdscript
# DETECTAR BOTÓN
func _on_button_pressed(button_name: String) -> void:
    if button_name == "grip_click":
        _try_grab()

# AGARRAR
func _try_grab() -> void:
    var nearby = get_meta("nearby_luggage", null)
    if nearby:
        held_object = nearby
        held_object.grab(self)

# MOVER
func _process(_delta: float) -> void:
    if held_object:
        held_object.global_position = global_position

# SOLTAR
func _release() -> void:
    if held_object:
        held_object.release()
        held_object = null
```

#### **En la Maleta (luggage_item.gd):**

```gdscript
# CREAR ÁREA DE DETECCIÓN
func _create_grab_area() -> void:
    _grab_area = Area3D.new()
    # ... configurar sphere de 30cm radio
    _grab_area.body_entered.connect(_on_grab_area_entered)

# DETECTAR CONTROLADOR CERCA
func _on_grab_area_entered(body: Node3D) -> void:
    if body.is_in_group("xr_controller"):
        body.set_meta("nearby_luggage", self)

# AGARRAR
func grab(hand: Node3D) -> void:
    is_grabbed = true
    grabbed_by = hand
    freeze = true  # Desactivar física
    _trigger_haptic_feedback(peso)

# SOLTAR
func release() -> void:
    is_grabbed = false
    freeze = false  # Reactivar física
    apply_central_impulse(Vector3.DOWN * 2.0)
```

---

## 🎮 EJEMPLO PRÁCTICO

### **Situación: Jugador agarra maleta roja de 10kg**

```
TIEMPO    EVENTO                          ESTADO
─────────────────────────────────────────────────────────────
0.0s      Jugador acerca mano izquierda  
          Distancia: 0.5m → 0.4m → 0.3m
          
0.5s      Mano entra en GrabArea          nearby_luggage guardado
          (SphereShape radio 0.3m)        
          
1.0s      Jugador aprieta GRIP            LeftHand.is_gripping = true
          (botón lateral Quest)           
          
1.01s     _try_grab() ejecutado           held_object = maleta_roja
                                          maleta_roja.grab(LeftHand)
                                          
1.02s     Vibración háptica enviada       Strength = 0.6 (10kg)
          Duración 0.1s                   
          
1.5s      Jugador sube la mano            maleta.position = hand.position
          Y = 1.2m → 1.5m → 1.8m          (cada frame)
          
2.0s      Jugador mueve a izquierda       maleta.position sigue
          X = 0.0m → -0.5m → -1.0m        
          
2.5s      Jugador suelta GRIP             LeftHand.is_gripping = false
                                          
2.51s     _release() ejecutado            maleta_roja.release()
                                          maleta.freeze = false
                                          
2.52s     Física activada                 Gravedad actúa
          Maleta empieza a caer           Velocity.y = -2.0
          
3.0s      Maleta toca el suelo            Colisión detectada
          Sound: 💥 crash                 Rebote según PhysicsMaterial
```

---

## 📏 DISTANCIAS Y TAMAÑOS

```
Vista Superior (desde arriba):

        [Mano]
          │
          │ ← 0.3m radio
          │
     ┌────●────┐
     │  Área   │  ← GrabArea (invisible)
     │  Grab   │
     └─────────┘
         │
      [📦 Maleta]  ← RigidBody3D (visible)
         │
      (0.4m × 0.3m)


Vista Lateral:

     Altura
       ↑
       │
    2.0m│         [👤 Jugador]
       │            │
       │            │
    1.5m│         [✋ Mano]
       │            │
       │            │ ← 0.3m
       │            ●
    1.0m│         [📦 Maleta]
       │
       │
    0.0m└───────────────────→
         Suelo de la cinta
```

---

## 🔄 ESTADOS DE LA MALETA

```
┌─────────────┐
│   SPAWNED   │ ← Aparece en cinta
└──────┬──────┘
       │
       │ Jugador se acerca
       ▼
┌─────────────┐
│  NEAR HAND  │ ← Dentro de GrabArea (30cm)
└──────┬──────┘
       │
       │ Aprieta GRIP
       ▼
┌─────────────┐
│   GRABBED   │ ← freeze=true, sigue mano
└──────┬──────┘
       │
       │ Suelta GRIP
       ▼
┌─────────────┐
│  FALLING    │ ← freeze=false, gravedad activa
└──────┬──────┘
       │
       │ Colisiona con zona
       ▼
┌─────────────┐
│   PLACED    │ ← Verifica zona correcta
└──────┬──────┘
       │
       │ Destruir después de 0.5s
       ▼
┌─────────────┐
│  DESTROYED  │ ← queue_free()
└─────────────┘
```

---

## 💡 TIPS

### **Hacer más fácil agarrar:**
```gdscript
# Aumentar radio del área
grab_shape.radius = 0.5  # En vez de 0.3
```

### **Hacer más realista:**
```gdscript
# La maleta NO sigue exactamente, tiene retraso
held_object.global_position = lerp(
    held_object.global_position,
    global_position,
    0.5  # Factor de interpolación
)
```

### **Añadir inercia al soltar:**
```gdscript
# Calcular velocidad de la mano
var hand_velocity = (global_position - last_position) / delta
held_object.linear_velocity = hand_velocity
```

---

¿Ahora está más claro? 🤔💡
