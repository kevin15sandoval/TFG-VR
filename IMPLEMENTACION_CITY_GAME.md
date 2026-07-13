# 🚀 IMPLEMENTACIÓN COMPLETA - URBAN ATTENTION QUEST

## ✅ ARCHIVOS CREADOS

### Scripts de Juego
```
✅ scenes/city_game_manager.gd      # Gestor del juego y métricas
✅ scenes/urban_target.gd            # Objetivos/señales urbanas
✅ city_vr_start.gd                  # Sistema VR + UI coordinación
```

### Escenas Godot
```
✅ scenes/urban_target.tscn          # Escena de target reutilizable
✅ CityWorld.tscn                    # Mundo completo de la ciudad
```

### Documentación
```
✅ URBAN_ATTENTION_QUEST.md          # Documentación terapéutica
✅ IMPLEMENTACION_CITY_GAME.md       # Este archivo
```

---

## 🎮 CÓMO PROBAR EL JUEGO

### Abrir en Godot

1. **Abrir Godot**
2. **Cargar proyecto**: `c:\Users\USUARIO\Documents\tfg\`
3. **Abrir escena**: `CityWorld.tscn`
4. **Ejecutar**: Presionar F5 o botón "Play"

---

## 🏗️ ESTRUCTURA COMPLETA

### Jerarquía de CityWorld.tscn

```
CityWorld (Node3D) [city_vr_start.gd]
├── WorldEnvironment (Ambiente día, cielo azul)
├── DirectionalLight3D (Sol direccional)
├── XROrigin3D
│   ├── XRCamera3D
│   ├── LeftHand (XRController3D)
│   │   ├── LeftHandMesh
│   │   ├── LeftHandArea (Area3D)
│   │   └── LeftHandTrail
│   └── RightHand (XRController3D)
│       ├── RightHandMesh
│       ├── RightHandArea (Area3D)
│       └── RightHandTrail
├── CityModel (procedural_city_5.glb)
├── CityGameManager (Node) [city_game_manager.gd]
├── FirebaseManager (Node) [firebase_manager.gd]
└── UrbanTargets (Node3D)
    ├── Target_Window_1 [urban_target.tscn] (seq: 1)
    ├── Target_Window_2 [urban_target.tscn] (seq: 2)
    ├── Target_Lamp_1 [urban_target.tscn] (seq: 3)
    ├── Target_Door_1 [urban_target.tscn] (seq: 4)
    ├── Target_Window_3 [urban_target.tscn] (seq: 5)
    ├── Target_Behind_1 [urban_target.tscn] (seq: 6, atrás)
    ├── Target_Lamp_2 [urban_target.tscn] (seq: 7)
    ├── Target_Window_4 [urban_target.tscn] (seq: 8)
    ├── Target_Door_2 [urban_target.tscn] (seq: 9)
    ├── Target_High_1 [urban_target.tscn] (seq: 10, alto)
    ├── Target_Behind_2 [urban_target.tscn] (seq: 11, atrás)
    └── Target_Low_1 [urban_target.tscn] (seq: 12, bajo)
```

---

## 🎯 CARACTERÍSTICAS IMPLEMENTADAS

### ✅ Mecánicas de Juego
- [x] 12 targets urbanos en secuencia
- [x] **Detección por MIRADA (gaze-based)** - NO táctil
- [x] **2 segundos mirando** para activar
- [x] **Barra de progreso visual** que crece al mirar
- [x] Feedback visual: escala crece + brillo aumenta
- [x] Progreso se pierde lentamente si dejas de mirar
- [x] Sistema de secuencia numerada (1→2→3...)
- [x] Penalización por orden incorrecto (-5 pts)
- [x] Sistema de puntuación
- [x] Timer con límite de tiempo
- [x] Fin automático al completar o timeout

### ✅ Targets Urbanos
- [x] 4 tipos: ventana, farola, puerta, señal_tráfico
- [x] Esfera brillante con emisión 4x
- [x] Anillo exterior rotante (torus)
- [x] Flecha direccional flotante
- [x] Número de secuencia visible
- [x] 30 partículas flotantes por target
- [x] Explosión de 80 partículas al activar
- [x] Animación de pulso continua
- [x] Sonido 3D espacial (tono aumenta con secuencia)

### ✅ Distribución Espacial Terapéutica
- [x] Targets izquierda y derecha (bilateral)
- [x] Targets adelante y atrás (rotación 180°)
- [x] Targets altos (6m) y bajos (0.8m)
- [x] 2 targets específicamente atrás para rotación

### ✅ Visual Ultra Profesional
- [x] Ambiente día realista (cielo azul, sol)
- [x] Ciudad procedural (modelo 3D completo)
- [x] Iluminación direccional con sombras
- [x] Niebla atmosférica ligera
- [x] Efectos glow y bloom
- [x] Partículas con colores vivos

### ✅ Audio Espacial
- [x] Beep de activación (frecuencia variable)
- [x] Audio 3D posicional
- [x] Countdown animado con sonido
- [x] Ambiente urbano (opcional)

### ✅ HUD Completo en VR
- [x] Score en tiempo real
- [x] Timer contando hacia atrás
- [x] "Siguiente: X" (número de secuencia)
- [x] Indicador de asimetría (negligencia)
- [x] Instrucciones en pantalla
- [x] Flash de error visual

### ✅ Métricas Terapéuticas Únicas
- [x] Left/right side targets (bilateral)
- [x] Asimetría porcentual (negligencia)
- [x] Tiempos de reacción por lado
- [x] Targets adelante/atrás
- [x] Targets altos/bajos
- [x] Rotaciones 180° detectadas
- [x] Errores de secuencia
- [x] Scores clínicos:
  - Spatial awareness (0-100)
  - Orientation (0-100)
  - Processing speed (0-100)
  - Neglect clinical score (0-100)

### ✅ Integración Total
- [x] Sala de espera con polling
- [x] Auto-inicio desde plataforma clínica
- [x] Countdown animado (3, 2, 1, ¡EXPLORA!)
- [x] Guardado automático en Firebase
- [x] Vuelta a sala de espera
- [x] Tracking de posición del jugador

---

## 📊 DATOS REGISTRADOS EN FIREBASE

```javascript
{
  "game_type": "urban_attention_quest",
  "patient_id": "PAC001",
  "session_id": "SES_67890",
  "timestamp": "2026-07-02T11:00:00Z",
  "difficulty": "Media",
  "duration": 180,
  
  "results": {
    "score": 115,
    "targets_collected": 12,
    "total_targets": 12,
    "sequence_errors": 1,
    "completion_percentage": 100,
    "time_elapsed": 142.5,
    
    // NEGLIGENCIA ESPACIAL
    "left_side_targets": 5,
    "right_side_targets": 7,
    "asymmetry_percentage": 16.7,
    "neglect_score": 83.3,
    "left_avg_reaction": 3.2,
    "right_avg_reaction": 2.1,
    
    // ORIENTACIÓN ESPACIAL
    "front_targets": 6,
    "back_targets": 4,
    "high_targets": 4,
    "low_targets": 2,
    "rotation_180_count": 4,
    
    // VELOCIDAD
    "avg_reaction_time": 2.8,
    "target_times": [2.1, 3.5, 2.8, 4.1, ...],
    
    // SCORES CLÍNICOS
    "spatial_awareness_score": 85,
    "orientation_score": 70,
    "processing_speed_score": 75,
    "neglect_clinical_score": 83
  }
}
```

---

## 🔄 FLUJO DE SESIÓN COMPLETA

```
1. VR Boot
   └─> Inicializa OpenXR
   └─> Crea UI de espera
   └─> Crea HUD (oculto)
   └─> Registra 12 targets con CityGameManager
   └─> Inicia polling de Firebase

2. Esperando Sesión
   └─> Muestra "SALA DE ESPERA"
   └─> Polling cada 3 segundos
   └─> Ciudad visible pero targets inactivos

3. Fisioterapeuta inicia desde web
   └─> Crea documento en Firestore: sesion_activa/current

4. Auto-Detección
   └─> Firebase detecta nueva sesión
   └─> Lee configuración (dificultad, duración)
   └─> Detiene polling
   └─> Oculta UI de espera

5. Countdown
   └─> Muestra "3... 2... 1... ¡EXPLORA!"
   └─> Sonidos de beep
   └─> Animación de escala

6. Juego Activo
   └─> Muestra HUD (score, timer, secuencia, asimetría)
   └─> Activa targets
   └─> Tracking de posición del jugador
   └─> Registra eventos:
       ├─> Target tocado → +pts, actualiza secuencia
       ├─> Error de secuencia → -5pts, flash rojo
       ├─> Detecta lado (izq/der)
       ├─> Detecta profundidad (adelante/atrás)
       ├─> Detecta altura (alto/bajo)
       ├─> Calcula rotaciones 180°
       └─> Timer tick → actualiza HUD

7. Fin de Juego (tiempo o completar)
   └─> Calcula métricas terapéuticas:
       ├─> Asimetría izq/der
       ├─> Neglect score
       ├─> Spatial awareness score
       ├─> Orientation score
       ├─> Processing speed score
   └─> Guarda resultados en Firestore
   └─> Muestra mensaje final:
       ├─> "🎉 ¡COMPLETADO!" (si terminó)
       └─> "⏰ TIEMPO AGOTADO" (si no)
   └─> Muestra stats: Score | Negligencia score
   └─> Limpia sesión de Firestore

8. Vuelta a Sala de Espera
   └─> Reinicia polling
   └─> Muestra "SALA DE ESPERA"
   └─> Listo para siguiente paciente
```

---

## 🎨 PERSONALIZACIÓN

### Añadir Más Targets

En Godot, en el nodo `UrbanTargets`:

1. Click derecho > Instanciar escena hija
2. Seleccionar `scenes/urban_target.tscn`
3. Configurar en el Inspector:
   ```
   target_id: 13 (único)
   sequence_number: 13 (orden en secuencia)
   target_type: "window" o "lamp" o "door" o "traffic_sign"
   target_color: Color(R, G, B, A)
   points: 10
   ```
4. Posicionar en el espacio 3D:
   - X negativo = izquierda del jugador
   - X positivo = derecha
   - Z negativo = adelante
   - Z positivo = atrás (rotación 180°)
   - Y alto = edificios superiores
   - Y bajo = nivel del suelo

### Ajustar Dificultad

En `city_game_manager.gd`, función `start_game()`:

```gdscript
match difficulty:
    "Fácil":
        # Modificar configuración
        game_duration = 300.0  # 5 minutos
    "Media":
        game_duration = 180.0  # 3 minutos
    "Difícil":
        game_duration = 120.0  # 2 minutos
```

### Cambiar Colores de Targets

En `urban_target.gd`, función `_create_target_visual()`:

```gdscript
match target_type:
    "window":
        target_color = Color(0.2, 1.0, 0.3)  # Verde
    "lamp":
        target_color = Color(0.2, 0.8, 1.0)  # Azul
    "door":
        target_color = Color(1.0, 0.8, 0.2)  # Amarillo
    "traffic_sign":
        target_color = Color(1.0, 0.5, 0.2)  # Naranja
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema: Targets no se detectan

**Solución**:
1. Verificar que `LeftHandArea` y `RightHandArea` tienen:
   - `collision_layer = 2`
   - `collision_mask = 1`
2. Verificar que targets tienen:
   - `collision_layer = 1`
   - `collision_mask = 2`

### Problema: Secuencia no funciona

**Solución**:
1. Verificar que cada target tiene `sequence_number` único (1, 2, 3...)
2. Ver consola: "Error de secuencia: esperado X, tocado Y"
3. Asegurar que CityGameManager está registrando targets correctamente

### Problema: Modelo de ciudad no se ve

**Solución**:
1. Verificar que `models/procedural_city_5.glb` existe
2. Esperar a que Godot importe (ver progress bar)
3. Ajustar escala si necesario: `transform.scale = Vector3(1.5, 1.5, 1.5)`

### Problema: Asimetría siempre en 0%

**Solución**:
1. Verificar que targets están distribuidos en ambos lados (X negativo y positivo)
2. Ver consola: "left_side_targets" y "right_side_targets" deben ser > 0
3. Asegurar que `city_game_manager.gd` llama a `_analyze_target_position()`

---

## 📈 ANÁLISIS DE MÉTRICAS

### Interpretación Clínica

#### **Asimetría > 30%**
```
Indicador: Negligencia espacial significativa
Acción: Incrementar targets en lado afectado
       Usar audio guía direccional
```

#### **Rotaciones 180° < 2**
```
Indicador: Evita girar (miedo o limitación física)
Acción: Empezar con targets solo laterales
       Progresión gradual a targets atrás
```

#### **Neglect Score < 70**
```
Indicador: Negligencia clínicamente relevante
Acción: Sesiones más frecuentes (5x/semana)
       Combinar con terapia convencional
       Considerar audio guía bilateral
```

#### **Errores de Secuencia > 3**
```
Indicador: Dificultad en función ejecutiva
Acción: Empezar sin secuencia (modo exploración)
       Progresión a secuencias cortas (3-5)
       Usar ayudas visuales (flechas)
```

---

## 🔮 MEJORAS FUTURAS

### Variantes de Juego

1. **Modo Audio Guía**
   - Voz indica: "Gira a tu izquierda"
   - Ayuda para pacientes con negligencia severa

2. **Modo Memoria**
   - Targets se muestran 5 segundos y desaparecen
   - Paciente debe recordar posiciones

3. **Modo Funcional AVD**
   - Instrucciones: "Ve a la farmacia", "Encuentra el banco"
   - Reconocimiento de edificios específicos

4. **Modo Competitivo**
   - Ranking de pacientes
   - Progreso semanal visible

---

## 📞 SOPORTE

Para dudas técnicas o mejoras, contacta al equipo del TFG.

**Versión**: 1.0  
**Última actualización**: 2026  
**Licencia**: Uso académico/terapéutico  

---

🏙️ **¡Todo listo para explorar la ciudad virtual!** 🧭
