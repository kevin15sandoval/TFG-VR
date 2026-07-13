# 🏙️ URBAN ATTENTION QUEST - Juego de Rehabilitación Espacial

## 📋 Descripción General

**Urban Attention Quest** es un juego de realidad virtual diseñado específicamente para rehabilitación de pacientes con ictus/ACV, enfocado en **negligencia espacial unilateral (hemineglect)**, **orientación urbana** y **navegación 360°**.

El paciente explora una ciudad virtual buscando y tocando señales luminosas distribuidas en todo el entorno urbano: ventanas de edificios, farolas, puertas, señales de tráfico.

---

## 🎯 Objetivos Terapéuticos Específicos

### Déficits Post-Ictus Trabajados

#### 1. **Negligencia Espacial Unilateral (Hemineglect)**
- **Síntoma**: Paciente ignora un lado del espacio (comúnmente izquierdo)
- **Tratamiento**: Señales aparecen en ambos lados forzando exploración bilateral
- **Medición**: Asimetría izquierda/derecha, tiempos de reacción por lado

#### 2. **Orientación Espacial y Navegación**
- **Síntoma**: Dificultad para orientarse en espacios
- **Tratamiento**: Contexto urbano realista con landmarks (edificios, calles)
- **Medición**: Targets encontrados adelante/atrás, rotaciones 180°

#### 3. **Atención Dividida y Sostenida**
- **Síntoma**: Dificultad para mantener atención en múltiples estímulos
- **Tratamiento**: Múltiples señales simultáneas, secuencias numeradas
- **Medición**: Errores de secuencia, tiempo de reacción

#### 4. **Rotación de Tronco y Equilibrio Dinámico**
- **Síntoma**: Movimiento reducido, miedo a girar
- **Tratamiento**: Señales detrás del paciente requieren giro completo
- **Medición**: Número de rotaciones 180°, estabilidad

#### 5. **Campo Visual Completo**
- **Síntoma**: Reducción del campo visual funcional
- **Tratamiento**: Targets en 360° (arriba, abajo, lados, atrás)
- **Medición**: Cuadrantes visuales utilizados

#### 6. **Secuenciación y Planificación (AVD)**
- **Síntoma**: Dificultad para planificar acciones cotidianas
- **Tratamiento**: Orden numerado de objetivos
- **Medición**: Errores de secuencia, estrategia de navegación

---

## 🎮 Mecánicas del Juego

### **Objetivo Principal**
Buscar señales luminosas distribuidas en una ciudad virtual y **mirarlas durante 2 segundos** para activarlas, siguiendo el orden numerado (1, 2, 3...).

### **Mecánica de Activación: DETECCIÓN POR MIRADA (GAZE-BASED)**

#### ¿Cómo funciona?
1. **Busca** la señal con el número correcto girando la cabeza
2. **Mira** la señal directamente durante **2 segundos**
3. Verás una **barra de progreso** que crece mientras miras
4. La esfera se hace **más grande y brillante**
5. Al completar 2 segundos → **¡ACTIVADA!** (explosión de partículas)

#### ⚠️ Si dejas de mirar:
- La barra de progreso **baja lentamente**
- Tienes que volver a mirar para completar

#### 👁️ **Ventajas Terapéuticas de Detección por Mirada:**
- ✅ **Trabaja rotación de cuello/cabeza** (no brazos)
- ✅ **No requiere alcance manual** (ideal para pacientes con paresia severa)
- ✅ **Fuerza búsqueda visual activa** (escaneo completo del espacio)
- ✅ **Detecta negligencia visual** más pura (sin compensación manual)
- ✅ **Entrena atención sostenida** (mantener mirada 2 segundos)

### **Elementos del Juego**

#### 🟢 **Ventanas de Edificios**
- Ubicación: Pisos 2°, 3°, 4°, 5°
- **Trabaja**: Alcance vertical, mirar hacia arriba
- Color: Verde brillante

#### 🔵 **Farolas y Postes**
- Ubicación: A nivel de calle, laterales
- **Trabaja**: Rotación de tronco, alcance lateral
- Color: Azul cian

#### 🟡 **Puertas de Tiendas**
- Ubicación: Nivel del suelo
- **Trabaja**: Agacharse, alcance bajo
- Color: Amarillo/dorado

#### 🟠 **Señales Detrás (180°)**
- Ubicación: Detrás del paciente
- **Trabaja**: Rotación completa, conciencia espacial posterior
- Color: Naranja

#### 🟣 **Señales de Tráfico**
- Ubicación: Semáforos, cruces
- **Trabaja**: Reconocimiento urbano funcional
- Color: Múltiples (rojo, verde, amarillo)

### **Sistema de Secuencia**
- Cada señal tiene un **número visible** (1, 2, 3...)
- Debes tocarlas **en orden**
- Tocar fuera de orden: **-5 puntos** + mensaje de error
- El HUD muestra: "Siguiente: 5"

---

## 📊 Niveles de Dificultad

### 🟢 **FÁCIL - Exploración Guiada**
```
Targets: 5-6
Distribución: Solo frente y lados (sin atrás)
Altura: Nivel del pecho (1.2-1.8m)
Secuencia: Opcional (sin penalización)
Tiempo: Ilimitado
Asistencia: Flecha apuntando al siguiente target
```
**Objetivo**: Familiarización con entorno urbano, confianza

---

### 🟡 **MEDIA - Navegación Bilateral** (Configuración actual)
```
Targets: 10-12
Distribución: Ambos lados + algunos atrás
Altura: Desde suelo hasta 5m (edificios)
Secuencia: Obligatoria (1→2→3...)
Tiempo: 3 minutos
Asistencia: Indicador de asimetría en HUD
```
**Objetivo**: Detectar y trabajar negligencia espacial

---

### 🔴 **DIFÍCIL - Navegación 360° Completa**
```
Targets: 15-20
Distribución: 360° completo (adelante, atrás, arriba, abajo)
Altura: Desde 0.5m hasta 6m
Secuencia: Obligatoria + algunos targets parpadean
Tiempo: 2 minutos
Asistencia: Ninguna (exploración autónoma)
```
**Objetivo**: Máxima autonomía y exploración espacial

---

## 📈 Métricas Terapéuticas Registradas

### **Métricas Únicas para Ictus**

```javascript
{
  // === NEGLIGENCIA ESPACIAL ===
  "left_side_targets": 5,              // Targets en lado izquierdo
  "right_side_targets": 7,             // Targets en lado derecho
  "asymmetry_percentage": 16.7,        // |izq - der| / total × 100
  "neglect_score": 83.3,               // 100 - asimetría (0-100)
  
  "left_avg_reaction": 3.2,            // Segundos (promedio lado izq)
  "right_avg_reaction": 2.1,           // Segundos (promedio lado der)
  // Si izq >> der → negligencia izquierda
  
  // === ORIENTACIÓN ESPACIAL ===
  "front_targets": 6,                  // Targets adelante
  "back_targets": 4,                   // Targets atrás (requieren giro)
  "rotation_180_count": 4,             // Rotaciones completas
  
  // === CAMPO VISUAL ===
  "high_targets": 4,                   // Arriba (> 2m)
  "low_targets": 2,                    // Abajo (< 1m)
  "visual_quadrants_used": 4,          // De 4 cuadrantes
  
  // === SECUENCIACIÓN ===
  "targets_collected": 12,
  "total_targets": 12,
  "sequence_errors": 1,                // Errores de orden
  "target_times": [2.1, 3.5, ...],     // Tiempo por target
  "avg_reaction_time": 2.8,            // Promedio general
  
  // === SCORES CLÍNICOS (0-100) ===
  "spatial_awareness_score": 85,       // Exploración completa
  "orientation_score": 70,             // Navegación y rotaciones
  "processing_speed_score": 75,        // Velocidad de reacción
  "neglect_clinical_score": 83,        // Negligencia (100 = sin)
  
  // === BÁSICAS ===
  "score": 115,
  "completion_percentage": 100,
  "time_elapsed": 145.2,
  "difficulty": "Media"
}
```

---

## 🎨 Diseño Visual y Audio

### **Ambiente Urbano Realista**
- Ciudad procedural con edificios, calles, aceras
- Iluminación de día (sol direccional)
- Cielo azul con niebla atmosférica ligera
- Sombras para profundidad

### **Señales Visuales Ultra Claras**
- **Esferas brillantes** con emisión 4x
- **Anillos exteriores** rotantes (efecto torus)
- **Flecha direccional** flotante sobre cada target
- **Número grande** visible (1, 2, 3...)
- **Partículas flotantes** alrededor (30 partículas/target)
- **Colores vivos** según tipo:
  - Verde: Ventanas
  - Azul cian: Farolas
  - Amarillo: Puertas
  - Naranja: Targets atrás
  - Rosa: Targets muy altos

### **Feedback Visual**
- **Explosión de 80 partículas** al tocar (color del target)
- **Escala 3x** del target al activar
- **Flash de error** (rojo) si tocas fuera de secuencia
- **Indicador de asimetría** en HUD:
  - Verde: "✅ Exploración equilibrada"
  - Naranja: "⚠️ Asimetría detectada"

### **Audio Espacial 3D**
- **Beep de activación**: Frecuencia aumenta con secuencia
  - Target 1: 700 Hz
  - Target 5: 900 Hz
  - Target 10: 1200 Hz
- **Sonido de error**: Tono bajo (400 Hz)
- **Ambiente urbano**: Pájaros lejanos, viento suave

---

## 🧠 Base Científica

### **Evidencia para Rehabilitación Post-Ictus**

#### 1. **Entornos Ecológicos Mejoran Transferencia**
- Contexto urbano → tareas de vida diaria (AVD)
- Reconocimiento de elementos reales (farolas, puertas)
- Generalización a salir a la calle

#### 2. **Estimulación Bilateral Reduce Negligencia**
- Targets balanceados izq/der activan ambos hemisferios
- Detección temprana de asimetría
- Feedback inmediato para compensación

#### 3. **Rotación de Tronco Activa Sistemas Vestibulares**
- Mejora equilibrio dinámico
- Reduce miedo a girar
- Trabaja control postural

#### 4. **Tareas de Búsqueda Visual Reactivan Redes Atencionales**
- Restaura escaneo visual sistemático
- Mejora atención sostenida
- Reduce hemi-inatención

#### 5. **Secuenciación Trabaja Función Ejecutiva**
- Planificación de acciones
- Memoria de trabajo
- Inhibición de respuestas incorrectas

---

## 🏥 Protocolo Clínico Recomendado

### **Evaluación Inicial**
1. **Prueba de cancelación** (papel) → detectar negligencia
2. **Sesión 1 FÁCIL** → establecer baseline sin presión
3. **Análisis de asimetría** → confirmar lado afectado

### **Intervención (8-12 semanas)**
- **Semanas 1-4**: Nivel FÁCIL (sin tiempo, guiado)
- **Semanas 5-8**: Nivel MEDIA (3 min, secuencia obligatoria)
- **Semanas 9-12**: Nivel DIFÍCIL (2 min, 360° completo)
- **Frecuencia**: 3 sesiones/semana, 10-15 min/sesión

### **Criterios de Progresión**
- Asimetría < 20% durante 3 sesiones consecutivas
- Rotaciones 180° sin vacilación
- Errores de secuencia < 2 por sesión

### **Indicadores de Mejoría**
- ⬇️ Asimetría izq/der
- ⬇️ Diferencia en tiempos de reacción por lado
- ⬆️ Targets encontrados atrás (conciencia espacial)
- ⬆️ Rotaciones 180° (confianza en giro)
- ⬆️ Score de negligencia (aproximándose a 100)

---

## 🎯 Comparación con Otros Juegos del Sistema

| Característica | Gemas | Vault Escape | **Urban Quest** |
|----------------|-------|--------------|-----------------|
| Alcance motor | ✅ | ✅ | ✅ |
| Planificación cognitiva | ❌ | ✅ | ✅ |
| Negligencia espacial | ❌ | ❌ | **✅✅** |
| Rotación 360° | ❌ | ❌ | **✅✅** |
| Orientación espacial | ❌ | ❌ | **✅✅** |
| Contexto AVD | ❌ | ❌ | **✅✅** |
| Secuenciación | ❌ | ❌ | **✅** |
| Bilateral simétrico | ❌ | ❌ | **✅** |

**Urban Quest es el ÚNICO que trabaja negligencia espacial y rotación 360°**

---

## 🎮 Variantes Futuras

### **Variante 1: "Encuentra la Farmacia"**
- Instrucciones verbales: "Ve a la farmacia"
- El paciente debe identificar el edificio correcto por señales visuales
- **Trabaja**: Reconocimiento funcional, memoria semántica

### **Variante 2: "Cruce Seguro"**
- Semáforos que cambian de color
- Solo tocar señales cuando el semáforo esté verde
- **Trabaja**: Inhibición, seguridad vial (AVD)

### **Variante 3: "Tour Guiado con Voz"**
- Una voz dice: "Mira la ventana del segundo piso a tu derecha"
- **Trabaja**: Comprensión verbal + orientación espacial
- **Útil para**: Pacientes con afasia (problemas de lenguaje)

### **Variante 4: "Memoria de Secuencia"**
- Todas las señales se muestran por 5 segundos
- Luego desaparecen
- El paciente debe recordar las posiciones
- **Trabaja**: Memoria visual espacial

---

## 🚀 Uso en Godot

### Archivos del Juego

```
scenes/
├── city_game_manager.gd       # Lógica del juego y métricas
├── urban_target.gd             # Objetivos/señales urbanas
└── urban_target.tscn           # Escena reutilizable

CityWorld.tscn                  # Mundo principal
city_vr_start.gd                # Sistema VR + UI

models/
└── procedural_city_5.glb       # Modelo 3D de la ciudad
```

### Cómo Añadir Targets

1. Abrir `CityWorld.tscn`
2. Instanciar `scenes/urban_target.tscn` en nodo `UrbanTargets`
3. Configurar propiedades:
   ```gdscript
   target_id = 13               # Único
   sequence_number = 13         # Orden (1, 2, 3...)
   target_type = "window"       # window/lamp/door/traffic_sign
   target_color = Color(...)    # Verde/Azul/Amarillo/etc
   points = 10                  # Puntos al tocar
   ```
4. Posicionar en el espacio 3D
5. Se registra automáticamente con CityGameManager

---

## 📞 Soporte y Documentación

Para implementación técnica, ver: `IMPLEMENTACION_CITY_GAME.md`

**Versión**: 1.0  
**Última actualización**: 2026  
**Uso**: Académico/Terapéutico  

---

🏙️ **¡Explora la ciudad y recupera tu orientación espacial!** 🧭
