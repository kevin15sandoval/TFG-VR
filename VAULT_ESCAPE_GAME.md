# 🔐 LASER VAULT ESCAPE - Juego de Rehabilitación Cognitivo-Motora

## 📋 Descripción General

**Laser Vault Escape** es un juego de realidad virtual diseñado para rehabilitación neurológica, especialmente para pacientes con ictus/ACV. El paciente se encuentra dentro de una caja fuerte con rayos láser rojos y debe activar paneles de control sin tocar los láser.

---

## 🎯 Objetivos Terapéuticos

### Habilidades Motoras
- ✅ **Alcance selectivo**: Tocar objetivos específicos con precisión
- ✅ **Control postural**: Mantener equilibrio mientras se mueve
- ✅ **Coordinación ojo-mano**: Precisión espacial
- ✅ **Rango de movimiento**: Ejercicios multi-direccionales

### Habilidades Cognitivas
- ✅ **Planificación motora**: Calcular trayectorias seguras
- ✅ **Memoria de trabajo**: Recordar paneles activados
- ✅ **Atención sostenida**: Vigilar múltiples elementos
- ✅ **Función ejecutiva**: Toma de decisiones rápidas
- ✅ **Procesamiento espacial**: Percepción de profundidad

### Específico para Post-Ictus
- ✅ **Compensación bilateral**: Uso de ambos brazos
- ✅ **Cruce de línea media**: Alcanzar lado contrario
- ✅ **Negligencia espacial**: Atención a todo el campo visual

---

## 🎮 Mecánicas del Juego

### Elementos Principales

#### 🟢 Paneles de Control (Objetivos)
- **Normales (Verde)**: 10 puntos cada uno
- **Dorados**: 25 puntos (más difíciles de alcanzar)
- **Secuenciales (Azul)**: 15 puntos (deben tocarse en orden)

#### 🔴 Rayos Láser (Obstáculos)
- **Estáticos**: Fijos en el espacio
- **Móviles**: Se desplazan lentamente
- **Parpadeantes**: Aparecen/desaparecen (requieren timing)
- **Configuración**: Horizontal, vertical, diagonal

#### ⚠️ Sistema de Penalización
- Tocar un láser: **-10 puntos** + efecto visual rojo
- 5 toques de láser: **Game Over**
- Tiempo agotado: Sesión terminada

---

## 📊 Niveles de Dificultad

### 🟢 FÁCIL - Fase Aguda (1-3 meses post-ictus)
```
• 4 rayos láser estáticos
• Espacio amplio entre láser
• 5 paneles cerca del paciente
• Sin límite de tiempo
• Objetivos a altura del pecho
```
**Trabaja**: Confianza, rango básico de movimiento

### 🟡 MEDIA - Fase Subaguda (3-6 meses)
```
• 6-8 rayos láser (algunos móviles)
• Espacio reducido
• 8 paneles en diferentes alturas
• Tiempo límite: 3 minutos
• Requiere agacharse y estirarse
• Cruces de línea media
```
**Trabaja**: Planificación, memoria, compensación

### 🔴 DIFÍCIL - Fase Crónica (6+ meses)
```
• 10-12 rayos láser (varios móviles + parpadeantes)
• Espacios muy reducidos
• 10+ paneles en posiciones complejas
• Tiempo límite: 2 minutos
• Secuencia obligatoria (números)
• Coordinación bilateral simultánea
```
**Trabaja**: Función ejecutiva, velocidad de procesamiento

---

## 📈 Métricas Terapéuticas Registradas

El juego registra datos clínicos precisos:

```javascript
{
  // Métricas básicas
  "score": 150,
  "panels_collected": 8,
  "total_panels": 10,
  "laser_hits": 2,
  "completion_percentage": 80,
  "time_elapsed": 145.2,
  
  // Métricas cognitivas
  "avg_time_per_panel": 18.2,          // Planificación motora
  "panel_times": [12.3, 15.1, ...],    // Velocidad individual
  
  // Métricas motoras
  "vertical_range_meters": 1.6,        // Amplitud vertical
  "crosses_midline": 4,                // Compensación hemisférica
  
  // Scores clínicos (0-100)
  "motor_control_score": 80,           // 100 - (láser_hits × 10)
  "planning_score": 55,                // Basado en tiempos
  "spatial_awareness_score": 40,       // Cruces × 10
  
  // Precisión
  "precision_percentage": 87           // Éxito de alcance
}
```

---

## 🎨 Diseño Visual

### Ambiente
- Interior de caja fuerte metálica (gris/plateado)
- Iluminación tenue con acentos industriales
- Rayos láser rojos brillantes con partículas
- Paneles con emisión luminosa (verde/dorado/azul)
- Efectos de niebla para profundidad

### Feedback Visual
- ✅ **Panel activado**: Explosión de partículas verdes/doradas + sonido "ding"
- ❌ **Tocar láser**: Flash rojo en pantalla + vibración + sonido alarma
- ⏱️ **Tiempo bajo**: Timer cambia a rojo, aumenta tensión
- 🎉 **Completado**: Confeti + mensaje "¡ESCAPASTE!" + puerta se abre

---

## 🎵 Audio

### Efectos de Sonido
- **Panel activado**: Beep agudo (600-800 Hz)
- **Láser tocado**: Alarma industrial
- **Countdown**: Beeps progresivos
- **Completado**: Fanfarria de éxito

### Música Ambiente
- Tono bajo continuo (110-220 Hz)
- Ambiente espacial/industrial
- Aumenta tensión en los últimos 30 segundos

---

## 🚀 Uso en Godot

### Archivos Principales

```
scenes/
├── vault_game_manager.gd      # Lógica del juego
├── laser_beam.gd               # Rayos láser
├── laser_beam.tscn             # Escena de láser
├── control_panel.gd            # Paneles interactivos
└── control_panel.tscn          # Escena de panel

VaultWorld.tscn                 # Mundo principal
vault_vr_start.gd               # Sistema VR + UI

models/
└── cofre_bank.glb              # Modelo 3D de la caja fuerte
```

### Cómo Crear un Nuevo Nivel

1. **Abrir VaultWorld.tscn** en Godot
2. **Añadir láser**: Instanciar `laser_beam.tscn` en `LaserSetup`
   - Ajustar `laser_length`, `laser_thickness`
   - Configurar `move_speed`, `blink_enabled` para dificultad
3. **Añadir paneles**: Instanciar `control_panel.tscn` en `ControlPanels`
   - Asignar `panel_id` único
   - Elegir `panel_type` (normal/golden/sequence)
   - Posicionar según ejercicio terapéutico
4. **Los paneles y láser se registran automáticamente** con VaultGameManager

---

## 🔧 Configuración desde Plataforma Clínica

El juego recibe configuración de Firebase:

```javascript
{
  "game_id": "vault_escape",
  "difficulty": "Media",          // Fácil/Media/Difícil
  "duration": 180,                // Segundos
  "therapy_side": "Ambos",        // Izquierdo/Derecho/Ambos
  "patient_id": "PAC001",
  "session_id": "SES_12345"
}
```

---

## 📱 Integración con Sistema Global

### Flujo de Sesión

1. **Sala de espera**: VR polling esperando sesión
2. **Fisioterapeuta inicia sesión** desde plataforma web
3. **Auto-detección**: Firebase detecta nueva sesión
4. **Countdown animado**: 3, 2, 1, ¡ESCAPE!
5. **Juego activo**: Paciente completa paneles
6. **Finalización**: Por tiempo o por completar todos
7. **Resultados guardados**: Firebase + métricas clínicas
8. **Vuelta a sala de espera**: Listo para nueva sesión

---

## 🏆 Ventajas Terapéuticas

1. **Dual-Task Training**: Motor + cognitivo simultáneo (evidencia científica)
2. **Gamificación**: Narrativa inmersiva ("escapar") → motivación
3. **Escalabilidad**: Desde fase aguda a crónica
4. **Datos objetivos**: Métricas precisas para evolución
5. **Transferencia funcional**: Movimientos similares a AVD
6. **Engagement**: Más atractivo que ejercicios abstractos
7. **Seguro**: Entorno controlado, sin riesgo de caídas

---

## 🎓 Base Científica

### Conceptos Aplicados
- **Neuroplasticidad**: Repetición intensiva de movimientos
- **Task-Oriented Training**: Tareas funcionales específicas
- **Dual-Task**: Combinar motor + cognitivo mejora resultados
- **Feedback inmediato**: Refuerzo positivo/negativo instantáneo
- **Gradación**: Progresión desde fácil a difícil
- **Motivación intrínseca**: Gamificación aumenta adherencia

---

## 🔮 Futuras Mejoras

### Variantes de Juego
1. **Modo Secuencia de Colores**: Memorizar orden visual
2. **Modo Espejo Cognitivo**: Replicar patrones en pared
3. **Modo Cooperativo**: Terapeuta controla láser desde tablet
4. **Modo Narrativo**: Historia de "robo al banco"

### Características Avanzadas
- **Adaptación dinámica**: AI ajusta dificultad en tiempo real
- **Análisis biomecánico**: Tracking de postura con skeletal
- **Multijugador**: Competir con otros pacientes (ranking)
- **Personalización**: Láser y paneles según ejercicios específicos

---

## 📞 Soporte

Para dudas o mejoras, contacta al equipo de desarrollo del TFG.

**Versión**: 1.0  
**Última actualización**: 2026  
**Licencia**: Uso académico/terapéutico  

---

🎮 **¡Disfruta del escape y recupera tu movilidad!** 🔐
