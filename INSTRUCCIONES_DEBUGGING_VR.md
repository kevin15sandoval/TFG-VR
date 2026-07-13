# 🔧 INSTRUCCIONES PARA DEBUGGING VR

## 📋 CAMBIOS REALIZADOS

He agregado **logging extensivo** en todos los archivos críticos para rastrear el flujo completo del sistema:

### 1. **vr_start.gd**
- ✅ Logging detallado en `_ready()` mostrando estado de GameManager
- ✅ Logging en creación de FirebaseManager
- ✅ Logging en conexión de señales
- ✅ Logging completo en `_on_new_session_detected()` con cada paso
- ✅ Verificación de que `GameManager.apply_config()` se ejecuta
- ✅ Verificación de que `GameManager.start_session()` se llama

### 2. **firebase_manager.gd**
- ✅ Logging en `start_polling()` mostrando URL y configuración
- ✅ Logging en cada ciclo de polling (cada 3 segundos)
- ✅ Logging detallado en `_on_poll_response()` mostrando:
  - Código HTTP recibido
  - Primeros 200 caracteres del body
  - Campos extraídos del JSON
  - Session ID detectado vs último procesado
- ✅ Logging completo al emitir señal `new_session_detected`

### 3. **game_manager.gd**
- ✅ Logging completo en `apply_config()` mostrando toda la configuración
- ✅ Logging detallado en `start_session()` mostrando:
  - Reset de variables
  - Estado de sesión activa
  - Emisión de señal `session_started`

### 4. **gem_spawner.gd**
- ✅ Logging en `_ready()` verificando existencia de GameManager
- ✅ Logging en conexión de señales
- ✅ Logging completo en `_on_session_started()` mostrando:
  - Construcción de cola de ejercicios
  - Configuración del timer
  - Spawn de primera gema

---

## 🎮 FLUJO ESPERADO

Cuando crees una sesión desde el portal web, deberías ver esta secuencia en los logs:

```
═══ FASE 1: STARTUP ═══
[GemsVR] _ready() ejecutándose...
[GemsVR] ✅ GameManager existe
[GemsVR] GameManager.patient_id = ''
[GemsVR] ✅ FirebaseManager creado
[GemsVR] ✅ Todas las señales conectadas
[VR] 🏥 Entrando en sala de espera...
[VR] 📺 Mensaje de espera mostrado
[Firebase] 🔄 INICIANDO POLLING AUTOMÁTICO
[Spawner] 🎯 GEM SPAWNER INICIALIZADO
[Spawner] ✅ Señales conectadas a GameManager

═══ FASE 2: POLLING (cada 3 segundos) ═══
[Firebase] ⏱️ Tiempo de polling alcanzado (3s) - ejecutando poll...
[Firebase] 🔍 Polling sesión activa: https://firestore.googleapis.com/...
[Firebase] 📡 Poll response - Result: 0 Code: 404  <- Sin sesión aún
... (se repite cada 3s)

═══ FASE 3: SESIÓN DETECTADA ═══
[Firebase] 📡 Poll response - Result: 0 Code: 200  <- ¡Sesión encontrada!
[Firebase] ✅ Respuesta exitosa del servidor
[Firebase] 📄 Body recibido (primeros 200 chars): {"name":"projects/tfg-vr/...
[Firebase] 📋 Campos disponibles: [patientId, sessionId, gameId, ...]
[Firebase] 🔍 Session ID extraído: 'abc123...'
[Firebase] 🎮 NUEVA SESIÓN DETECTADA EN FIRESTORE
[Firebase] 📋 Config construida:
  - patient_id: P001
  - session_id: abc123
  - game_id: gems
  - difficulty: Media
  - ...
[Firebase] 📢 Emitiendo señal 'new_session_detected'...
[Firebase] ✅ Señal emitida

═══ FASE 4: INICIO DEL JUEGO ═══
[VR] 🎮 NUEVA SESIÓN DETECTADA
[VR] Config recibida: ...
[VR] ✅ Polling detenido
[VR] ✅ UI de espera ocultada
[VR] 🔧 Aplicando configuración a GameManager...
[GameManager] 📋 CONFIGURACIÓN APLICADA
  - Patient ID: P001
  - Session ID: abc123
  - Game Type: gems
  - ...
[VR] ✅ Configuración aplicada
[VR] 🎮 Cargando game manager para: gems
[VR] ✅ Game manager cargado
[VR] ⏱️ Iniciando countdown...
  ... (3, 2, 1, GO!)
[VR] ✅ Countdown completado
[VR] 🚀 Llamando GameManager.start_session()...
[GameManager] 🚀 GAMEMANAGER.START_SESSION() EJECUTÁNDOSE
[GameManager] ✅ Variables reseteadas
[GameManager] 📊 Estado actual:
  - session_active: true
  - score: 0
  - difficulty: Media
  - ...
[GameManager] 📢 Emitiendo señal 'session_started'...
[GameManager] ✅ Señal 'session_started' emitida
[VR] ✅ start_session() ejecutado

═══ FASE 5: SPAWNER ACTIVADO ═══
[Spawner] 🚀 SPAWNER: SESSION_STARTED RECIBIDA
[Spawner] Construyendo cola de ejercicios...
[Spawner] ✅ Cola construida con 10 ejercicios
[Spawner] ⏱️ Configurando intervalo de spawn...
[Spawner] ✅ Intervalo: 2.0s (dificultad: Media)
[Spawner] 🎮 Iniciando timer de spawn...
[Spawner] ✅ Timer iniciado
[Spawner] 💎 Spawneando primera gema...
[Spawner] Ejercicio: Flexión | Tipo: normal
[Spawner] ✅ Primera gema spawneada
[Spawner] ✅ SPAWNER ACTIVO - GENERANDO GEMAS

═══ FASE 6: JUEGO EN MARCHA ═══
[VR] ▶ Sesión iniciada | Media | Izquierdo
(El juego está corriendo - gemas apareciendo cada 2s)
```

---

## 🔍 CÓMO REVISAR LOS LOGS

### OPCIÓN A: Logs en Godot Editor (Desarrollo)
1. Abre el proyecto en Godot
2. Ve a Output > Debugger
3. Ejecuta la escena World.tscn
4. Observa los logs en la consola
5. Crea una sesión desde el portal web
6. Verifica que aparezcan los logs de FASE 3, 4, 5, 6

### OPCIÓN B: Logs en Meta Quest (Producción) ⭐ RECOMENDADO
Esta es la forma **definitiva** de saber qué está pasando:

1. **Conecta las gafas con USB al PC**
2. **Abre PowerShell o CMD**
3. **Ejecuta este comando:**
   ```
   adb logcat -s godot:V
   ```
4. **Verás los logs en tiempo real**
5. **Ponte las gafas VR**
6. **Abre el juego en las gafas**
7. **Ve al portal web y crea una sesión**
8. **Observa los logs en la PowerShell**

Si ves la secuencia completa hasta FASE 6, el juego **ESTÁ FUNCIONANDO**.

Si los logs se detienen en alguna fase, ahí está el problema.

---

## 🐛 POSIBLES PROBLEMAS Y SOLUCIONES

### Problema 1: No se ven logs de polling (Fase 2)
**Causa:** FirebaseManager no se creó correctamente
**Solución:** Verificar que vr_start.gd se ejecuta y crea FirebaseManager

### Problema 2: Polling se detiene en Code: 404
**Causa:** No hay documento en Firestore en `sesion_activa/current`
**Solución:** 
- Verificar que el portal web está escribiendo correctamente en Firestore
- Ir a Firebase Console → Firestore → Colección `sesion_activa` → Documento `current`
- Debe existir y tener campos: patientId, sessionId, gameId, etc.

### Problema 3: Logs llegan hasta FASE 3 pero no FASE 4
**Causa:** La señal `new_session_detected` no se está conectando o no se emite
**Solución:** Verificar en logs si dice "Señal emitida"

### Problema 4: Logs llegan hasta FASE 4 pero no FASE 5
**Causa:** La señal `session_started` no llega al Spawner
**Solución:** Verificar que GemSpawner está en la escena World.tscn

### Problema 5: Logs llegan hasta FASE 5 pero no aparecen gemas
**Causa:** 
- El `gem_scene` no está asignado en GemSpawner
- Las gemas se están spawneando fuera de la vista
**Solución:**
- Abrir World.tscn en Godot
- Seleccionar GemSpawner
- Verificar que "Gem Scene" apunta a `gem.tscn`

---

## 🎯 PRÓXIMOS PASOS

1. **EXPORTAR NUEVO APK**
   ```
   - Abre Godot
   - Ve a Project → Export
   - Selecciona Android (Quest)
   - Click "Export Project"
   - Guarda el APK
   ```

2. **INSTALAR EN META QUEST**
   ```
   adb install -r TFG.apk
   ```

3. **EJECUTAR Y REVISAR LOGS**
   ```
   adb logcat -s godot:V
   ```

4. **CREAR SESIÓN DESDE PORTAL WEB**
   - Ve a https://tfg-vr.web.app
   - Inicia sesión
   - Crea un paciente (si no existe)
   - Crea una nueva sesión con juego "Recolectar Gemas"
   - Observa los logs en tiempo real

5. **REPORTAR RESULTADOS**
   - Si ves todos los logs hasta FASE 6: ✅ **¡FUNCIONA!**
   - Si se detiene en alguna fase: Copia los últimos 50 logs y envíamelos

---

## 📝 NOTAS IMPORTANTES

- Los logs son **MUY VERBOSOS** ahora - esto es TEMPORAL para debugging
- Una vez que funcione, podemos reducir el logging
- El polling ocurre cada 3 segundos - espera hasta 3-6 segundos después de crear la sesión
- Si no funciona con el APK, prueba primero en el editor de Godot para ver los logs más fácilmente

---

## ✅ RESUMEN DE LO QUE SE ARREGLÓ

1. ✅ Logging extensivo en TODO el flujo
2. ✅ Verificación de señales conectadas
3. ✅ Tracking de cada paso del proceso
4. ✅ Verificación de que `start_session()` se ejecuta
5. ✅ Verificación de que el Spawner recibe la señal

**El código está listo. Ahora necesitas:**
1. Exportar el nuevo APK
2. Instalarlo en las gafas
3. Ejecutar `adb logcat -s godot:V`
4. Crear una sesión desde el portal
5. Ver los logs y reportar qué fase alcanza

¡Suerte! 🚀
