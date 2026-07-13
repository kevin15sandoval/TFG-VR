# 📦 LUGGAGE HANDLER VR - Juego de Rehabilitación de Fuerza

## 📋 Descripción General

**Luggage Handler VR** es un juego de realidad virtual diseñado específicamente para **rehabilitación de fuerza, resistencia muscular y rotación de tronco** en pacientes con ictus/ACV. El paciente trabaja como manipulador de equipaje en una estación de tren, clasificando maletas que vienen por una cinta transportadora.

---

## 🎯 Objetivos Terapéuticos

### Habilidades Motoras

#### 1. **Fuerza Muscular**
- Levantamiento de objetos con diferentes pesos (2-15 kg)
- Trabajo de deltoides, bíceps, tríceps, trapecio
- Fortalecimiento de musculatura del tronco (core)
- Progresión gradual de carga

#### 2. **Resistencia Muscular**
- Sesiones de 3-5 minutos continuos
- Trabajo bajo carga sostenida
- Desarrollo de tolerancia al esfuerzo
- Mejora de capacidad aeróbica

#### 3. **Rotación de Tronco**
- Giros izquierda/derecha para clasificar
- Trabajo de oblicuos y erectores espinales
- Movilidad funcional de columna
- Transferencia de peso bilateral

#### 4. **Coordinación Bilateral**
- Agarre bimanual de objetos
- Transferencia de mano a mano
- Cruce de línea media
- Simetría de movimientos

#### 5. **Alcance Funcional**
- Alcance multidireccional (adelante, lados, atrás)
- Trabajo en diferentes alturas
- Coordinación ojo-mano bajo carga

### Específico para Post-Ictus
- ✅ Fortalecimiento del lado afectado
- ✅ Trabajo funcional (transferencia a AVD)
- ✅ Ejercicios de manipulación de cargas (compras, mudanzas)
- ✅ Entrenamiento de tareas laborales

---

## 🎮 Mecánicas del Juego

### **Objetivo Principal**
Clasificar maletas que vienen por una cinta transportadora según su color/peso, colocándolas en las zonas correctas.

### **Elementos del Juego**

#### 🟢 **Maletas VERDES (Ligeras)**
- Peso: 2-3 kg
- Puntos: 10 pts
- Zona: IZQUIERDA (verde)
- Tamaño: Pequeño (30×20×40 cm)

#### 🟡 **Maletas AMARILLAS (Medianas)**
- Peso: 5-7 kg
- Puntos: 15 pts
- Zona: DERECHA (amarilla)
- Tamaño: Mediano (40×30×50 cm)

#### 🔴 **Maletas ROJAS (Pesadas)**
- Peso: 10-12 kg
- Puntos: 25 pts
- Zona: ATRÁS (roja)
- Tamaño: Grande (50×40×60 cm)

#### 🟣 **Maletas MORADAS (XL - Bonus)**
- Peso: 15 kg
- Puntos: 40 pts
- Zona: ATRÁS (roja también)
- Tamaño: Extra grande (60×50×70 cm)
- Solo en dificultad DIFÍCIL

### **Cinta Transportadora**
- Movimiento constante hacia el jugador
- Velocidad ajustable según dificultad
- Maletas aparecen cada 2-4 segundos

### **Zonas de Clasificación**
```
        [🟢 VERDE]          [JUGADOR]          [🟡 AMARILLA]
            ↑                   ↑                    ↑
         Izquierda           Centro               Derecha


                         [🔴 ROJA]
                            ↑
                          Atrás
```

---

## 📊 Niveles de Dificultad

### 🟢 **FÁCIL - Aprendizaje**
```
• Velocidad cinta: 0.5 m/s (lento)
• Solo maletas verdes y amarillas (2-5 kg)
• 2 zonas: izquierda y derecha
• 15 maletas en 3 minutos
• Sin límite de tiempo estricto
• Intervalo spawning: 4 segundos
```
**Objetivo**: Familiarización con mecánicas, ganar confianza

---

### 🟡 **MEDIA - Estándar** (Configuración recomendada)
```
• Velocidad cinta: 1.0 m/s (normal)
• Maletas verdes, amarillas y rojas (2-12 kg)
• 3 zonas: izquierda, derecha y atrás
• 25 maletas en 3 minutos
• Rotación de tronco obligatoria (zona atrás)
• Intervalo spawning: 3 segundos
```
**Objetivo**: Trabajo completo de fuerza y rotación

---

### 🔴 **DIFÍCIL - Experto**
```
• Velocidad cinta: 1.5 m/s (rápido)
• Todas las maletas incluidas (2-15 kg)
• 3 zonas + posible zona alta (estante arriba)
• 35 maletas en 2 minutos
• Trabajo de fuerza máxima
• Intervalo spawning: 2 segundos
```
**Objetivo**: Máxima demanda física y cognitiva

---

## 📈 Sistema de Puntos y Penalizaciones

### ✅ **PUNTOS POSITIVOS**

| Acción | Puntos |
|--------|--------|
| Maleta verde correcta | +10 pts |
| Maleta amarilla correcta | +15 pts |
| Maleta roja correcta | +25 pts |
| Maleta morada correcta | +40 pts |
| **COMBO x5** (5 seguidas correctas) | **+50 pts BONUS** |

### ❌ **PENALIZACIONES**

| Error | Penalización |
|-------|--------------|
| Maleta caída al suelo | -20 pts |
| Maleta en zona incorrecta | -10 pts |
| Maleta dejada pasar (no agarrada) | -5 pts |

### 🔥 **SISTEMA DE COMBOS**
- **Combo**: Clasificar 5 maletas correctamente sin errores
- **Bonus**: +50 puntos adicionales
- **Reset**: Cualquier error reinicia el combo a 0
- **Máximo combo**: Se registra el combo más largo

---

## 📊 Métricas Terapéuticas Registradas

### **Métricas Completas del Sistema**

```javascript
{
  // === MÉTRICAS BÁSICAS ===
  "score": 450,
  "luggage_placed": 18,              // Maletas clasificadas correctamente
  "luggage_dropped": 1,              // Maletas caídas
  "luggage_wrong": 0,                // Zona incorrecta
  "luggage_missed": 2,               // Dejadas pasar
  "max_combo": 8,                    // Combo más largo
  "accuracy_percentage": 85.7,       // % precisión
  "time_elapsed": 180.0,
  "difficulty": "Media",
  
  // === MÉTRICAS DE FUERZA ===
  "total_weight_moved": 125.5,       // kg total movidos en sesión
  "max_weight_lifted": 12.0,         // kg (maleta más pesada levantada)
  "avg_weight": 6.9,                 // kg promedio por maleta
  "repetitions": 18,                 // Número de levantamientos
  
  // === MÉTRICAS DE RESISTENCIA ===
  "time_under_load": 145.3,          // Segundos sosteniendo peso
  "fatigue_index": 0.18,             // 0-1 (0=sin fatiga, 1=fatiga máxima)
  "avg_placement_time": 8.1,         // Segundos promedio por maleta
  
  // === ROTACIÓN DE TRONCO ===
  "trunk_rotations_left": 8,         // Rotaciones a izquierda
  "trunk_rotations_right": 10,       // Rotaciones a derecha
  "trunk_asymmetry": 11.1,           // % asimetría (|izq-der|/total × 100)
  "crosses_midline": 12,             // Cruces de línea media
  
  // === COORDINACIÓN ===
  "placement_times": [7.2, 8.5, ...],  // Tiempos individuales
  
  // === SCORES CLÍNICOS (0-100) ===
  "clinical_scores": {
    "strength": 80,                  // Basado en peso total y máximo
    "endurance": 72,                 // Basado en tiempo bajo carga
    "trunk_mobility": 85,            // Basado en rotaciones y simetría
    "coordination": 94,              // Basado en precisión
    "processing_speed": 88           // Basado en tiempo de reacción
  },
  
  // === RECOMENDACIONES CLÍNICAS ===
  "clinical_recommendations": [
    "Rendimiento adecuado. Continuar progresión.",
    // O recomendaciones específicas según resultados
  ]
}
```

---

## 🎨 Diseño Visual y Audio

### **Ambiente: Estación de Tren Industrial**
- Plataforma de tren subterránea
- Iluminación industrial (luces colgantes)
- Cinta transportadora metálica en el centro
- Zonas de clasificación marcadas con colores brillantes
- Ambiente realista y funcional

### **Maletas Visuales**
- **Modelo**: Cajas 3D con diferentes tamaños
- **Colores**: Verde, amarillo, rojo, morado (emisión leve)
- **Label flotante**: Muestra peso en kg
- **Material**: Metálico/plástico con fricción realista

### **Feedback Visual**

#### ✅ **Éxito (Correcta)**
- Explosión de partículas del color de la maleta
- Emisión brillante (+3.0)
- Sonido "ding" ascendente (800-1000 Hz)
- Texto flotante: "¡BIEN! +15 pts"

#### ❌ **Error (Incorrecta)**
- Flash rojo en maleta
- Emisión roja
- Sonido grave (300 Hz)
- Texto: "ERROR -10 pts"

#### 💥 **Caída**
- Partículas de impacto
- Vibración háptica fuerte
- Sonido de crash
- Texto: "¡CAÍDA! -20 pts"

#### 🔥 **Combo x5**
- Efecto de fuego dorado
- Texto gigante: "🔥 COMBO x5! +50"
- Sonido épico
- Duración: 1.5 segundos

### **HUD (Heads-Up Display)**
```
┌─────────────────────────────────────────────┐
│  ⭐ 450      ⏱ 02:35      💪 125kg         │
│                                             │
│  🔥 COMBO x8                                │
│                                             │
│  🟢 Izquierda | 🟡 Derecha | 🔴 Atrás      │
└─────────────────────────────────────────────┘
```

### **Audio Espacial 3D**
- **Éxito**: Beep agudo (800 Hz) + eco
- **Error**: Tono bajo (300 Hz) + reverb
- **Combo**: Fanfarria corta + explosión
- **Ambiente**: Sonido de cinta mecánica (loop)
- **Caída**: Crash metálico

### **Vibración Háptica**
- **Proporcional al peso**:
  - 2 kg: Vibración 0.2
  - 5 kg: Vibración 0.4
  - 10 kg: Vibración 0.6
  - 15 kg: Vibración 0.8
- Simula el "esfuerzo" de levantar

---

## 🏋️ Ventajas Terapéuticas

### **1. Transferencia Directa a AVD**
- Levantar bolsas de compra
- Mover cajas en mudanzas
- Cargar maletas en viajes
- Tareas domésticas con peso

### **2. Trabajo Funcional Completo**
- Fuerza + resistencia + coordinación
- Rotación de tronco natural (no forzada)
- Alcance multidireccional realista

### **3. Contexto Laboral Realista**
- Simula trabajo de manipulación de cargas
- Útil para reintegración laboral
- Ambiente industrial profesional

### **4. Progresión Clara**
- Escalable: 2 kg → 15 kg
- Velocidad ajustable
- Dificultad progresiva

### **5. Gamificación Efectiva**
- Sistema de puntos motivador
- Combos emocionantes
- Feedback inmediato constante

### **6. Medición Objetiva**
- Peso exacto movido (kg)
- Tiempo bajo carga (segundos)
- Fatiga cuantificada
- Datos replicables

---

## 🧠 Base Científica

### **Evidencia para Rehabilitación Post-Ictus**

#### 1. **Entrenamiento de Fuerza Post-Ictus**
- **Efectivo**: Aumenta fuerza muscular +30% en 8-12 semanas
- **Seguro**: No aumenta espasticidad ni empeora función
- **Recomendado**: 2-3 sesiones/semana, intensidad moderada-alta

#### 2. **Trabajo Funcional vs. Abstracto**
- Tareas "reales" (maletas) mejoran transferencia a AVD
- Mayor motivación que ejercicios abstractos

#### 3. **Rotación de Tronco**
- Crítico para AVD: vestirse, cocinar, limpiar
- Mejora equilibrio dinámico y estabilidad

#### 4. **Feedback Inmediato**
- Acelera aprendizaje motor
- Aumenta adherencia al tratamiento

---

## 📋 Protocolo Clínico Recomendado

### **Evaluación Inicial**
1. **Test de fuerza** (dinamometría si disponible)
2. **Sesión 1 FÁCIL** (solo 2-5 kg) → baseline
3. **Evaluar tolerancia** (fatiga, dolor, compensaciones)

### **Intervención (8-12 semanas)**

**Semanas 1-3: Nivel FÁCIL**
- Solo maletas verdes y amarillas (2-5 kg)
- 2 sesiones/semana, 2-3 minutos/sesión
- Enfoque: Técnica correcta, sin compensaciones

**Semanas 4-8: Nivel MEDIA**
- Añadir maletas rojas (hasta 12 kg)
- 3 sesiones/semana, 3-5 minutos/sesión
- Enfoque: Progresión de carga, rotación de tronco

**Semanas 9-12: Nivel DIFÍCIL**
- Todas las maletas (hasta 15 kg)
- 3-4 sesiones/semana, 5 minutos/sesión
- Enfoque: Velocidad, resistencia, máxima carga

### **Criterios de Progresión**
- Fatigue index < 0.3 durante 3 sesiones consecutivas
- Precisión > 80%
- Sin dolor durante o después (escala <3/10)
- Tolerancia completa a duración de sesión

### **Indicadores de Mejoría**
- ⬆️ Peso total movido por sesión
- ⬆️ Peso máximo levantado
- ⬆️ Tiempo bajo carga
- ⬇️ Índice de fatiga
- ⬇️ Asimetría troncal
- ⬆️ Precisión de colocación

---

## 🚀 Uso en Godot

### **Archivos Principales**

```
scenes/
├── luggage_game_manager.gd         # Lógica del juego y métricas
├── luggage_spawner.gd              # Generador de maletas
├── luggage_item.gd                 # Maleta individual
└── luggage_item.tscn               # Escena de maleta (crear)

luggage_vr_start.gd                 # Sistema VR + UI + Firebase
LuggageWorld.tscn                   # Mundo principal (crear)

models/
├── abandoned_underground_train_station.glb   # Estación
└── industrial_conveyor_belt.glb              # Cinta
```

### **Crear el Mundo en Godot**

1. **Crear escena LuggageWorld.tscn**
2. **Raíz**: Node3D
3. **Añadir**:
   - XROrigin3D + XRCamera3D
   - Modelo de estación
   - Modelo de cinta transportadora
   - LuggageGameManager (script)
   - LuggageSpawner (script)
   - FirebaseManager
   - 3 zonas de colocación (Area3D con group "placement_zone")
4. **Zonas**:
   - Verde (izquierda): Posición (-2, 1, 0)
   - Amarilla (derecha): Posición (2, 1, 0)
   - Roja (atrás): Posición (0, 1, 3)
   - Cada una con meta "zone_name" = "green"/"yellow"/"red"

---

## 🔧 Configuración desde Plataforma Clínica

```javascript
{
  "game_id": "luggage_handler",
  "difficulty": "Media",          // Fácil/Media/Difícil
  "duration": 180,                // Segundos
  "therapy_side": "Ambos",        // Ambos (bilateral)
  "patient_id": "PAC001",
  "session_id": "SES_12345"
}
```

---

## 📱 Integración con Sistema Global

### **Flujo de Sesión**

1. **Sala de espera VR** → polling Firebase cada 3s
2. **Fisioterapeuta configura** desde plataforma web
3. **Auto-detección** en VR
4. **Countdown 3-2-1** → "¡A TRABAJAR!"
5. **Fase de reconocimiento** (15 segundos) → Observar cinta y zonas
6. **Juego activo** → Clasificar maletas
7. **Finalización** → Tiempo agotado o todas las maletas
8. **Resultados guardados** → Firebase con métricas completas
9. **Vuelta a sala de espera**

---

## 🎓 Comparación con Otros Juegos

| Característica | Gem Collection | Vault Escape | Urban Quest | **Luggage Handler** |
|----------------|----------------|--------------|-------------|---------------------|
| Fuerza muscular | ❌ | ❌ | ❌ | **✅✅** |
| Resistencia | ❌ | ❌ | ❌ | **✅✅** |
| Rotación tronco | ❌ | ❌ | ❌ | **✅✅** |
| Trabajo funcional | ✅ | ❌ | ❌ | **✅✅** |
| Coordinación | ✅ | ✅ | ❌ | **✅** |
| Planificación | ❌ | ✅ | ✅ | **✅** |
| Contexto AVD | ❌ | ❌ | ❌ | **✅✅** |

**Luggage Handler es el ÚNICO que trabaja fuerza, resistencia y rotación de tronco simultáneamente**

---

## 📞 Soporte

Para dudas o mejoras, contacta al equipo de desarrollo del TFG.

**Versión**: 1.0  
**Última actualización**: 2026  
**Licencia**: Uso académico/terapéutico  

---

📦 **¡Fortalécete levantando maletas y recupera tu fuerza funcional!** 💪🏋️

