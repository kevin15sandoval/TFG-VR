# Issues del TFG - Sistema VR de Rehabilitación

Este archivo contiene los issues a crear en GitHub para documentar el desarrollo del proyecto.

## ✅ COMPLETADOS

### Issue #1: Implementar sistema de iluminación en todos los mundos VR
**Labels:** `enhancement`, `vr`, `graphics`
**Estado:** CERRADO
**Commit:** `328e574b`

**Descripción:**
Implementar sistema completo de iluminación (DirectionalLight + OmniLights + Sky procedural) en todos los mundos VR para mejorar visibilidad y experiencia del paciente.

**Cambios realizados:**
- ✅ Añadido Sky procedural en CityWorld, VaultWorld, LuggageWorld, World
- ✅ Aumentada energía ambiental (ambient_light_energy)
- ✅ Añadidas OmniLight3D estratégicamente posicionadas
- ✅ Ajustado brillo (adjustment_brightness)
- ✅ Propiedad `visible=true` explícita en DirectionalLight3D

**Mundos actualizados:**
- World.tscn (juego de gemas)
- CityWorld.tscn (ciudad urbana)
- VaultWorld.tscn (bóveda del banco)
- LuggageWorld.tscn (estación de tren)
- HubWorld.tscn (sala de espera)

---

### Issue #2: Sistema de spawneo gradual y colores con puntuación en CityWorld
**Labels:** `enhancement`, `gameplay`, `ux`, `cityworld`
**Estado:** CERRADO
**Commit:** `454fe669`

**Descripción:**
Mejorar el juego Urban Attention Quest (CityWorld) con spawneo gradual de targets, sistema de colores con significado terapéutico, y feedback visual/sonoro mejorado.

**Cambios realizados:**
- ✅ Spawneo gradual: Targets aparecen de 2 en 2 cada 5 segundos
- ✅ Sistema de colores con puntuación:
  - 🟢 Verde = 10 puntos (fácil - frontal, altura media)
  - 🟡 Amarillo = 20 puntos (medio - lateral, alturas variadas)
  - 🔴 Rojo = 30 puntos (difícil - trasero, muy alto/bajo)
- ✅ Feedback visual mejorado:
  - Explosión de partículas escalada según puntos
  - Onda de choque (shockwave)
  - Texto flotante "+XX pts!"
  - HUD late y cambia de color según puntos
- ✅ Feedback sonoro diferenciado por color/puntuación
- ✅ Reducida iluminación excesiva
- ✅ Diálogo inicial se oculta al empezar

**Impacto terapéutico:**
Los colores ahora tienen significado clínico basado en dificultad motora, facilitando la progresión terapéutica.

---

### Issue #3: Integración de métricas clínicas específicas de CityWorld con Firestore
**Labels:** `backend`, `metrics`, `firebase`, `cityworld`
**Estado:** CERRADO
**Commit:** `e35c532f`

**Descripción:**
Guardar métricas terapéuticas específicas de Urban Attention Quest en Firestore y actualizar tipos TypeScript en la plataforma clínica.

**Métricas implementadas:**
- ✅ **Negligencia espacial:**
  - Targets izquierda/derecha
  - Porcentaje de asimetría
  - Score de negligencia (0-100)
- ✅ **Rango de movimiento cervical (ROM):**
  - Rotación izquierda/derecha
  - Extensión/flexión
  - ROM total
- ✅ **Búsqueda visual:**
  - Tiempo promedio de reacción
  - Eficiencia de búsqueda visual
- ✅ **Scores clínicos funcionales:**
  - Conciencia espacial
  - Orientación
  - Velocidad de procesamiento
  - Movilidad cervical

**Archivos modificados:**
- `scripts/firebase_manager.gd` - Función `_add_city_fields()`
- `Plataforma_Clinica/app/types.ts` - Interface `SessionRecord`

---

### Issue #4: Flujo de regreso al HubWorld después de completar juego
**Labels:** `enhancement`, `navigation`, `ux`
**Estado:** CERRADO
**Commit:** `e35c532f`

**Descripción:**
Implementar flujo correcto de navegación: al terminar un juego, el paciente regresa al HubWorld en lugar de volver a sala de espera.

**Cambios realizados:**
- ✅ CityWorld regresa a HubWorld con `get_tree().change_scene_to_file("res://HubWorld.tscn")`
- ✅ Mensaje de resultados se muestra durante 5 segundos antes de regresar
- ✅ Sesión de Firestore se limpia correctamente

**Próximos pasos:**
Aplicar el mismo flujo a VaultWorld, LuggageWorld, y World (gems).

---

## 🔄 EN PROGRESO

### Issue #5: Visualización de métricas específicas por juego en plataforma clínica
**Labels:** `frontend`, `metrics`, `ui`, `enhancement`
**Estado:** EN PROGRESO
**Asignado a:** @kevin15sandoval

**Descripción:**
Actualizar la interfaz de la plataforma clínica para mostrar métricas específicas según el juego jugado.

**Tareas pendientes:**
- [ ] Componente de visualización para métricas de CityWorld
  - [ ] Gráfico de negligencia espacial (izq/der)
  - [ ] Gráfico de ROM cervical (radar chart)
  - [ ] Cards de scores clínicos funcionales
- [ ] Componente de visualización para métricas de VaultWorld
- [ ] Componente de visualización para métricas de LuggageWorld
- [ ] Componente de visualización para métricas de World (gems) - ya implementado

**Archivos a modificar:**
- `Plataforma_Clinica/app/App.tsx`
- Crear componentes específicos de visualización

---

## 📋 TODO (Pendientes)

### Issue #6: Completar implementación de VaultWorld (Laser Vault Escape)
**Labels:** `enhancement`, `gameplay`, `vaultworld`
**Prioridad:** ALTA

**Descripción:**
Completar la implementación del juego Laser Vault Escape con toda la lógica de juego, métricas terapéuticas y feedback visual/sonoro.

**Tareas:**
- [ ] Revisar iluminación (puede estar demasiado clara/oscura)
- [ ] Implementar spawneo gradual de paneles
- [ ] Sistema de colores/dificultad en paneles
- [ ] Feedback visual/sonoro al tocar panel
- [ ] Feedback visual al tocar láser (penalización)
- [ ] HUD de puntuación y timer
- [ ] Flujo de regreso al HubWorld
- [ ] Métricas: paneles tocados, láseres golpeados, planificación motora, ROM vertical
- [ ] Integración con Firestore

---

### Issue #7: Completar implementación de LuggageWorld (Luggage Handler)
**Labels:** `enhancement`, `gameplay`, `luggageworld`
**Prioridad:** ALTA

**Descripción:**
Completar la implementación del juego Luggage Handler con sistema de spawneo, zonas de colocación, y métricas de fuerza/resistencia.

**Tareas:**
- [ ] Revisar iluminación
- [ ] Configurar LuggageSpawner (intervalo, velocidad cinta)
- [ ] Sistema de colores por peso (verde=ligero, amarillo=medio, rojo=pesado)
- [ ] Zonas de colocación visibles (GreenZone, YellowZone, RedZone)
- [ ] Feedback al colocar maleta correctamente/incorrectamente
- [ ] Sistema de combos
- [ ] HUD: puntuación, timer, combo actual
- [ ] Flujo de regreso al HubWorld
- [ ] Métricas: peso movido, rotaciones de tronco, resistencia
- [ ] Integración con Firestore

---

### Issue #8: Completar implementación de World (Recolectar Gemas)
**Labels:** `enhancement`, `gameplay`, `gems`
**Prioridad:** MEDIA

**Descripción:**
Revisar y completar el juego de recolección de gemas con mejoras de UX.

**Tareas:**
- [ ] Revisar iluminación (puede necesitar ajuste)
- [ ] Feedback visual/sonoro mejorado al recoger gema
- [ ] Diferenciar feedback según tipo de gema (normal, dorada, verde, morada)
- [ ] Flujo de regreso al HubWorld
- [ ] Verificar que todas las métricas se guardan correctamente

---

### Issue #9: Sistema de configuración específica por juego en plataforma clínica
**Labels:** `frontend`, `enhancement`, `ux`
**Prioridad:** MEDIA

**Descripción:**
Adaptar el formulario de configuración de sesión para mostrar opciones relevantes según el juego seleccionado.

**Ejemplos:**
- **CityWorld:** NO mostrar "Modo de manos" (usa solo mirada), SÍ mostrar "Targets totales", "Intervalo de spawneo"
- **VaultWorld:** Mostrar "Número de paneles", "Dificultad de láseres"
- **LuggageWorld:** Mostrar "Peso máximo", "Velocidad de cinta"
- **World (gems):** Mostrar "Modo de altura", "Manos activas"

**Implementación sugerida:**
```typescript
const gameSpecificFields = {
  urban_attention_quest: ['duration', 'difficulty', 'total_targets'],
  vault_escape: ['duration', 'difficulty', 'num_panels', 'laser_difficulty'],
  luggage_handler: ['duration', 'difficulty', 'max_weight', 'conveyor_speed'],
  gems: ['duration', 'difficulty', 'therapy_side', 'height_mode']
}
```

---

### Issue #10: Documentación técnica del sistema
**Labels:** `documentation`
**Prioridad:** MEDIA

**Descripción:**
Crear documentación técnica completa del sistema para el TFG.

**Tareas:**
- [ ] Arquitectura del sistema (diagrama)
- [ ] Flujo de comunicación Godot ↔ Firebase ↔ Web
- [ ] Estructura de datos en Firestore
- [ ] API Reference de cada juego
- [ ] Guía de métricas terapéuticas
- [ ] Manual de instalación y despliegue
- [ ] Troubleshooting común

---

### Issue #11: Tests automatizados
**Labels:** `testing`, `quality`
**Prioridad:** BAJA

**Descripción:**
Implementar tests unitarios y de integración para componentes críticos.

**Áreas a testear:**
- [ ] FirebaseManager (Godot) - guardado y lectura de datos
- [ ] Cálculo de métricas terapéuticas
- [ ] Componentes React de la plataforma clínica
- [ ] Flujos de navegación entre escenas

---

## 📊 MÉTRICAS DEL PROYECTO

**Issues totales:** 11
- ✅ Completados: 4
- 🔄 En progreso: 1
- 📋 Pendientes: 6

**Commits relevantes:**
- `328e574b` - Fix lighting in all worlds
- `454fe669` - CityWorld: spawneo gradual, colores, feedback
- `e35c532f` - CityWorld: métricas y regreso al HubWorld

---

## 🎯 ROADMAP

### Fase 1: Completar juegos individuales (ACTUAL)
- ✅ CityWorld (Urban Attention Quest)
- 🔄 VaultWorld (Laser Vault Escape)
- 🔄 LuggageWorld (Luggage Handler)
- 🔄 World (Recolectar Gemas)

### Fase 2: Integración completa con plataforma clínica
- Visualización de métricas específicas
- Configuración por juego
- Reportes PDF mejorados

### Fase 3: Pulido y testing
- Tests automatizados
- Documentación completa
- Optimización de rendimiento

---

**Fecha de creación:** 11 julio 2026
**Autor:** Sistema TFG VR Rehabilitación
**Repositorio:** https://github.com/kevin15sandoval/TFG-VR
