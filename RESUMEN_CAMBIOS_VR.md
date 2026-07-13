# 📊 RESUMEN DE CAMBIOS - SISTEMA VR

## 🎯 OBJETIVO
Hacer que los juegos VR se inicien automáticamente cuando el fisioterapeuta crea una sesión desde el portal web (https://tfg-vr.web.app).

---

## 🔧 ARCHIVOS MODIFICADOS

### 1. `vr_start.gd` ⭐
**Cambios:**
- ✅ Agregado logging extensivo en `_ready()`
- ✅ Logging detallado en creación de FirebaseManager
- ✅ Logging en conexión de señales
- ✅ Logging paso a paso en `_on_new_session_detected()`
- ✅ Verificación de estado de GameManager después de `apply_config()`
- ✅ Tracking de ejecución de `start_session()`

**Propósito:** Rastrear cada paso desde que se detecta la sesión hasta que el juego inicia.

### 2. `scripts/firebase_manager.gd` ⭐
**Cambios:**
- ✅ Logging en `start_polling()` mostrando configuración
- ✅ Logging en cada ciclo de polling (cada 3 segundos)
- ✅ Logging detallado en `_on_poll_response()`:
  - Código HTTP
  - Body del response (primeros 200 chars)
  - Campos extraídos
  - Session ID detectado
- ✅ Logging completo al emitir `new_session_detected`

**Propósito:** Verificar que el polling está funcionando y detectando nuevas sesiones.

### 3. `scripts/game_manager.gd` ⭐
**Cambios:**
- ✅ Logging detallado en `apply_config()` mostrando toda la configuración
- ✅ Logging completo en `start_session()`:
  - Reset de variables
  - Estado de sesión
  - Confirmación de emisión de `session_started`

**Propósito:** Verificar que GameManager recibe la configuración y emite la señal correctamente.

### 4. `scenes/gem_spawner.gd` ⭐
**Cambios:**
- ✅ Logging en `_ready()` verificando GameManager
- ✅ Logging en conexión de señales
- ✅ Logging paso a paso en `_on_session_started()`:
  - Construcción de cola
  - Configuración de timer
  - Spawn de primera gema

**Propósito:** Verificar que el spawner recibe la señal y empieza a generar gemas.

---

## 📋 FLUJO COMPLETO DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│                    PORTAL WEB (Clinica)                     │
│  https://tfg-vr.web.app                                     │
│                                                             │
│  1. Fisioterapeuta crea sesión                             │
│  2. Se escribe en Firestore: sesion_activa/current         │
│     - patientId, sessionId, gameId, difficulty, etc.       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Escribe en Firestore
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIRESTORE DATABASE                        │
│                                                             │
│  Colección: sesion_activa                                  │
│  Documento: current                                         │
│  Campos:                                                    │
│    - patientId: "P001"                                     │
│    - sessionId: "sess_123..."                              │
│    - gameId: "gems"                                        │
│    - difficulty: "Media"                                   │
│    - duration: 180                                         │
│    - ...                                                   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Polling cada 3s
                            │
┌─────────────────────────────────────────────────────────────┐
│                    META QUEST (VR)                          │
│                                                             │
│  🔄 FIREBASE MANAGER (polling activo)                      │
│     - Revisa Firestore cada 3 segundos                    │
│     - Detecta nueva sesión                                 │
│     - Emite señal: new_session_detected(config)           │
│                                                             │
│  📥 VR_START (escucha señal)                               │
│     - Recibe config                                        │
│     - Aplica config a GameManager                          │
│     - Muestra countdown (3, 2, 1, GO!)                    │
│     - Llama GameManager.start_session()                   │
│                                                             │
│  🎮 GAME MANAGER (autoload global)                         │
│     - Recibe start_session()                              │
│     - Resetea variables                                    │
│     - Emite señal: session_started()                      │
│                                                             │
│  💎 GEM SPAWNER (escucha session_started)                  │
│     - Construye cola de ejercicios                        │
│     - Inicia timer de spawn                               │
│     - ¡Empieza a generar gemas!                           │
│                                                             │
│  ✅ JUEGO ACTIVO                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 DIAGNÓSTICO CON LOGS

### ✅ SI TODO FUNCIONA BIEN
Verás esta secuencia en los logs:

```
FASE 1: STARTUP (al abrir el juego)
  → [GemsVR] _ready()
  → [GemsVR] ✅ GameManager existe
  → [Firebase] 🔄 INICIANDO POLLING
  → [Spawner] 🎯 INICIALIZADO

FASE 2: POLLING (cada 3s mientras espera)
  → [Firebase] ⏱️ Polling...
  → [Firebase] 📡 Code: 404 (sin sesión)
  → ... (se repite)

FASE 3: DETECCIÓN (cuando creas la sesión)
  → [Firebase] 📡 Code: 200 ✅
  → [Firebase] 🎮 NUEVA SESIÓN DETECTADA
  → [Firebase] 📢 Emitiendo señal

FASE 4: INICIO
  → [VR] 🎮 NUEVA SESIÓN DETECTADA
  → [VR] 🔧 Aplicando config
  → [GameManager] 📋 CONFIGURACIÓN APLICADA
  → [VR] ⏱️ Countdown...
  → [VR] 🚀 start_session()
  → [GameManager] 🚀 START_SESSION()
  → [GameManager] 📢 Emitiendo session_started

FASE 5: SPAWNER
  → [Spawner] 🚀 SESSION_STARTED RECIBIDA
  → [Spawner] ✅ Cola construida
  → [Spawner] ✅ Timer iniciado
  → [Spawner] 💎 Primera gema spawneada

FASE 6: JUEGO ACTIVO
  → [VR] ▶ Sesión iniciada
  → Gemas apareciendo cada 2-3 segundos
  → ¡JUEGO FUNCIONANDO! ✅
```

### ❌ SI ALGO FALLA
Si los logs se DETIENEN en alguna fase, ahí está el problema:

- **Se detiene en FASE 1**: FirebaseManager no se creó
- **Se detiene en FASE 2**: Problema de red o URL incorrecta
- **Se detiene en FASE 3**: Firestore no tiene el documento `sesion_activa/current`
- **Se detiene en FASE 4**: La señal no se conectó correctamente
- **Se detiene en FASE 5**: GameManager no emitió `session_started`
- **Se detiene en FASE 6**: GemSpawner no está en la escena o no tiene `gem_scene` asignado

---

## 🚀 PRÓXIMOS PASOS

### PASO 1: Exportar nuevo APK
```
1. Abre Godot 4.6
2. Project → Export
3. Selecciona "Android (Quest)"
4. Click "Export Project"
5. Guarda como TFG.apk
```

### PASO 2: Instalar en Meta Quest
```
1. Conecta las gafas con USB
2. En CMD/PowerShell:
   adb install -r TFG.apk
```

### PASO 3: Ver logs en tiempo real
```
1. Mantén las gafas conectadas con USB
2. Ejecuta: ver_logs_vr.bat
   (o manualmente: adb logcat -s godot:V)
3. Ponte las gafas
4. Abre el juego
```

### PASO 4: Crear sesión y observar
```
1. Ve al portal web: https://tfg-vr.web.app
2. Crea una nueva sesión
3. Observa los logs en el PC
4. Verifica que aparecen TODAS las fases (1-6)
5. ¡Las gemas deberían aparecer en VR!
```

---

## 📝 ARCHIVOS NUEVOS CREADOS

1. **INSTRUCCIONES_DEBUGGING_VR.md** - Guía detallada de debugging
2. **ver_logs_vr.bat** - Script para ver logs fácilmente
3. **RESUMEN_CAMBIOS_VR.md** - Este archivo

---

## ✅ GARANTÍA DE FUNCIONAMIENTO

El código ahora tiene **logging en cada paso crítico**. Si sigues las instrucciones y:

1. ✅ Ves logs hasta FASE 6
2. ✅ No hay errores en los logs
3. ❌ PERO NO APARECEN GEMAS

Entonces el problema NO es de código, sino de:
- Configuración de la escena (GemSpawner sin gem_scene)
- Problema de rendering (gemas fuera de vista)
- Problema de VR headset (posición incorrecta)

**Si NO ves logs hasta FASE 6**, los logs te dirán EXACTAMENTE dónde se detiene el flujo.

---

## 💡 TIPS ADICIONALES

### Para ver logs más limpios:
```bash
adb logcat -s godot:V | findstr "═══"
```
Esto filtra solo las líneas con bordes, mostrando solo los headers importantes.

### Para guardar los logs en un archivo:
```bash
adb logcat -s godot:V > logs_vr.txt
```

### Para limpiar logs anteriores:
```bash
adb logcat -c
```

---

## 🎯 RESUMEN EJECUTIVO

**ANTES:** 
- Sistema de polling implementado pero sin logs
- Difícil saber si funcionaba o dónde fallaba
- Imposible debuggear sin ver en VR

**AHORA:**
- Logging extensivo en cada paso
- Tracking completo del flujo
- Fácil identificar dónde falla el sistema
- Debugging desde el PC con `adb logcat`

**RESULTADO ESPERADO:**
- Portal web crea sesión → VR la detecta en ≤3s → Countdown → Juego inicia → Gemas aparecen ✅

---

¡El código está listo! Solo falta:
1. Exportar APK
2. Instalar en Quest
3. Ver logs con `adb logcat -s godot:V`
4. Crear sesión desde portal
5. ¡Reportar resultados! 🚀
