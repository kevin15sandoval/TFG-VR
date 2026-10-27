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

## ⚠️ RIESGOS Y PENDIENTES (octubre 2026: G1, G2, W1, W2)

Estado: *pendiente* salvo indicación. Origen: PR #29 (Vault), #30 (Gemas), #31 (historial), #32 (resultados).

### R-REGLAS-01 — Reglas versionadas demasiado permisivas (BLOQUEA cualquier piloto con datos clínicos reales)
- `Plataforma_Clinica/firestore.rules`: `sesiones` con `write: if true`; lectura de `sesiones` y `pacientes` para cualquier cuenta autenticada; `sesion_activa` y `dispositivos` legibles sin autenticación; `dispositivos` con `update: if true`.
- No consta que sean las reglas desplegadas en producción (no comprobado).
- No desplegar `firestore.rules.next` (PR #26) hasta tener compatibles web y Godot (PR5c y PR6).

### PR6 — Contrato Godot → Firestore
- Identificador de sesión consistente (`?documentId=<sessionId>`), autenticación con token, `deviceUid`, alias en lugar de `patientName`.
- `durationUnit: "s"`, `createdAt` coherente, y `status`/`completed`/`interrupted`.
- Distinguir métricas no medidas de ceros legítimos (Godot rellena con 0 los campos ausentes).
- Enviar `gems_missed`, `sin_datos`, `lasers_dodged`, `luggage_missed`.
- Versión de métricas: las de Gemas anteriores a G2 no son comparables con las nuevas.

### Métricas no válidas como medición clínica
- `avg_dodge_time` (Vault) no es un tiempo de reacción: mide desde el inicio de la sesión.
- El tiempo por gema (Gemas) sale ≈0 (`on_gem_spawned()` se llama justo antes de `collect_gem`).
- Revisar `sin_datos` de Vault en la integración con la plataforma.

### Web
- Revisar el aviso «Resultados recibidos» (se muestra antes de validar el paciente).
- Revisar el borrado automático de `sesion_activa` al recibir sesiones.
- El listener de `sesiones` es demasiado amplio (colección completa con filtro en cliente).
- Perfil de paciente y PDF aún mezclan procedencias en promedios y gráficas.
- `addSession` (db.ts) queda sin llamadores tras W2.
- Error genérico y timeout de 15 s de ResultsPage solo probados con tests unitarios.

### Godot
- Investigar el aviso «busy/add_child» y las fugas de RID de `World.tscn`.
- `_active_gems` se modifica durante su iteración (`gem_spawner.gd`).

### PR5c (vinculación de Quest) — riesgos conocidos (PR #34)
- `rules.next` permite leer sesiones activas caducadas: la Quest debe ignorar las de `venceEn` pasado.
- El vencimiento (`venceEn`) depende del reloj del cliente; un desfase de ±1 h puede hacer fallar la publicación.
- Falta protección contra la creación abusiva de códigos de vinculación.
- `difficulty`, `therapySide` y `sessionType` solo se validan en longitud, no contra valores permitidos.
- Las cuentas anónimas huérfanas (Quests revocadas o reinstaladas) necesitan una estrategia de limpieza (Admin SDK).
- El administrador no puede listar dispositivos ajenos con las reglas actuales (`list` exige `ownerUid == auth.uid`).
- La integración de PR5c con W1/W2 necesita una estrategia de ramas (`db.ts` diverge entre #31/#32 y la cadena #26 → #28 → #33 → #34).
- Falta probar con Quest 3 y con un proyecto Firebase de pruebas con Anonymous Auth (nunca en producción por ahora).

### PR5c-2 (pantalla Dispositivos VR) — pendientes (PR #36)
- El menú lateral no es responsive (`w-64` fijo, preexistente): en móvil el contenido queda muy estrecho.
- Prueba física con Meta Quest 3 (sin PR6 no hay gafa que genere códigos de vinculación).
- Validación real de estados de red: la carga inicial sin red no tiene límite y el estado «error» de carga solo está probado como lógica pura.
- Compatibilidad con `rules.next`: contra las reglas actuales la lista sale vacía y vincular da permiso denegado; solo funciona tras desplegar `rules.next` con aprobación explícita.
- Integración con W1/W2: conflictos esperados en `App.tsx` y `types.ts` (hunks aditivos pequeños).

### PR5c-3a (identidad pseudónima del paciente) — riesgos (PR #37)
- **BLOQUEANTE para cualquier piloto con datos clínicos reales (D1):** los pacientes deben quedar aislados mediante permisos adecuados por clínica o profesional. Hoy todos los clínicos verificados ven y modifican todos los pacientes y sesiones; la implementación actual solo está autorizada para datos sintéticos. Mejora: `clinicId`/`ownerUid` en pacientes y sesiones, y contador de alias por clínica (`clinicas/{id}/config/aliasPacientes`).
- Riesgo de sesiones huérfanas al eliminar pacientes: `deletePatient` borra solo por `patientId == id`; las sesiones nuevas con `patientId == pid` quedarían con datos de salud sin propietario (protección de datos). Corregir en PR5c-3c.
- Compatibilidad entre `patientId` antiguo (id de Firestore) y `pid` nuevo en historial (W1) y resultados (W2): integrar `construirMapaPidAPaciente` y `reescribirPatientId`; sin migrar ni reescribir documentos existentes.
- Recuperación segura tras timeout de asignación: el resultado es desconocido (`resultadoDesconocido`) y se consulta primero la identidad existente; verificar el comportamiento también desde la interfaz (PR5c-3c).
- Integridad del contador de alias: las reglas impiden saltos, retrocesos y reutilización, pero un borrado fuera del cliente (consola o Admin SDK) reiniciaría la numeración y generaría duplicados; protegerlo (permisos de consola/Admin, copias, auditoría).
- Validar el comportamiento con múltiples clínicas (aislamiento, contadores independientes, administradores) antes de cualquier piloto.
- El `pid` solo se valida por formato en las reglas; su aleatoriedad depende de WebCrypto en cliente.

### PR5c-3b-1 (reglas del ciclo de vida de sesión) — hallazgos y deuda (PR #38)
- **PR5c-3b-1 no es fusionable por separado:** `devices.ts` sigue escribiendo el modelo antiguo de `sesion_activa`. PR5c-3b-2 es obligatorio antes de cualquier integración y debe reactivar los 8 tests omitidos (`SKIP_3B2` en `tests/emulator/devices.test.mjs` y `patient-identity.test.mjs`).
- **Contención transitoria (hallazgo en emulador):** una escritura concurrente sobre `current`, aunque se deniegue, hace que la regla de inicio devuelva permiso denegado de forma transitoria. En PR6, Godot debe releer `current` y el registro antes de cualquier reintento de inicio, comprobando que sigue siendo la misma sesión pendiente. Sin reintentos ciegos. Por confirmar si ocurre en producción.
- **Límite de 1000 expresiones** en la regla de creación de `sesiones`: márgenes aproximados gemas 320, Vault 405, City 250, Luggage 320. Repetir la sonda de márgenes ante cualquier añadido a esa regla.
- **Archivado lógico de pacientes (PR5c-3c):** con `sesiones delete:false`, `deletePatient` y los borrados de `db.ts` (líneas 119 y 188) fallarían. Modelo propuesto: `estado: 'archivado'` con `archivadoEn` y `archivadoPor`, `delete` de pacientes en `false`, interfaz «Archivar». La supresión o anonimización RGPD será un procedimiento administrativo independiente y autorizado.
- **Recuperación pasadas 24 h:** sin ampliar permisos de escritura ordinarios; procedimiento administrativo autorizado (Admin SDK, motivo, `auditoria_sesiones`) diseñado, no implementado (PR5c-3b-3).
- «Vencida» y el cierre forzado dependen de que alguien escriba (no hay backend); las reglas solo validan la forma de `pid`, `sessionId`, métricas y `tardio`.

### Pruebas pendientes
- Validar puntuación, HUD, controles e integración real en Meta Quest 3 física.
- Validar errores de red y pérdida de conexión.

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
