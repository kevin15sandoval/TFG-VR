# 🔍 VER LOGS EN TIEMPO REAL DESDE LA GAFA

## 📋 PROPÓSITO

Ver exactamente QUÉ está pasando cuando intentas cargar un juego desde el Hub.
Esto nos dirá si el problema está en:
- Hub detectando sesión
- Hub cambiando de escena  
- Juego ejecutando _ready()
- GameManager teniendo configuración

---

## 🛠️ HERRAMIENTAS NECESARIAS

1. **ADB** (Android Debug Bridge) - Ya lo tienes instalado
2. **Cable USB-C** - Para conectar la gafa al PC
3. **Meta Quest** - Con NeuroVR Rehab instalado

---

## 📝 PASOS PARA VER LOGS

### 1️⃣ CONECTAR LA GAFA AL PC

```bash
# Conecta la gafa con cable USB-C al PC

# Verifica que está conectada:
adb devices
```

**Debes ver algo como:**
```
List of devices attached
1WMHH8XXXX1234   device
```

Si dice **"unauthorized"**, ponte las gafas y acepta el permiso de USB debugging.

---

### 2️⃣ ABRIR APP EN LA GAFA

```bash
# Inicia la app NeuroVR Rehab en las gafas
# (Hazlo manualmente desde el menú de Quest)
```

---

### 3️⃣ VER LOGS EN TIEMPO REAL

```bash
# Este comando muestra SOLO los logs de Godot:
adb logcat -s godot:V
```

**IMPORTANTE:** Deja esta ventana de CMD abierta. Verás los logs en tiempo real.

---

### 4️⃣ CREAR SESIÓN EN LA WEB

1. Abre https://tfg-vr.web.app
2. Crea un paciente (si no existe)
3. Inicia una sesión nueva con game_id: **"gems"**

---

### 5️⃣ OBSERVAR LOS LOGS

Deberías ver en la consola ADB:

```
[Hub] 🎮 ¡NUEVA SESIÓN DETECTADA!
[Hub] Game ID: gems
[Hub] Paciente: Test Patient
[Hub] ⏳ Esperando 2 segundos antes de cargar...
[Hub] ⏰ Timeout completado, llamando _load_game()...
[Hub] 🔄 INICIANDO CARGA DE JUEGO
[Hub] 📂 Ruta de escena: res://World.tscn
[Hub] 🔍 Verificando existencia de escena...
[Hub] 🔍 ¿Escena existe en APK? true
[Hub] ✅ Escena verificada, procediendo a cargar...
[Hub] 📋 Verificando GameManager...
[Hub] ✅ GameManager encontrado
[Hub] 📋 Aplicando configuración a GameManager...
[GameManager] ═══════════════════════════════════════════
[GameManager] 📋 CONFIGURACIÓN APLICADA
[GameManager] Patient ID:  test123
[GameManager] Session ID:  session_xyz
[GameManager] Game Type:   gems
[Hub] ✅ Configuración aplicada a GameManager
[Hub] 📦 Cargando recurso de escena con ResourceLoader.load()...
[Hub] 🔍 Resultado de ResourceLoader.load(): [PackedScene:1234]
[Hub] ✅ Recurso cargado exitosamente
[Hub] 🔄 Llamando get_tree().change_scene_to_packed()...
[Hub] 🔍 Resultado de change_scene_to_packed(): 0
[Hub] ✅ change_scene_to_packed() ejecutado sin errores
[Hub] 🎮 ¡CAMBIO DE ESCENA SOLICITADO!

═══════════════════════════════════════════════════════════════
═══ 💎 GEMS GAME — VR System INICIANDO ═══
═══════════════════════════════════════════════════════════════
[GemsVR] _ready() ejecutándose...
[GemsVR] Verificando GameManager...
[GemsVR] ✅ GameManager existe
[GemsVR] GameManager.patient_id = 'test123'
[GemsVR] GameManager.session_id = 'session_xyz'
[GemsVR] GameManager.game_type = 'gems'
[GemsVR] ✅ Cargado desde Hub - Sesión ya configurada
[GemsVR] 🎮 Iniciando juego directamente...
```

---

## 🚨 DIAGNÓSTICO DE PROBLEMAS

### ❌ **PROBLEMA 1: No ves logs del Hub**
```
[Hub] 🎮 ¡NUEVA SESIÓN DETECTADA!
```

**Causa:** El polling de Firebase NO está funcionando
**Solución:** Verificar Firebase config y permisos de internet

---

### ❌ **PROBLEMA 2: Hub detecta sesión pero NO llama _load_game**
```
[Hub] ⏳ Esperando 2 segundos antes de cargar...
[Hub] ⏰ Timeout completado, llamando _load_game()... ← NO APARECE
```

**Causa:** El await get_tree().create_timer() falla
**Solución:** Problema con el árbol de nodos del Hub

---

### ❌ **PROBLEMA 3: _load_game se ejecuta pero escena NO existe**
```
[Hub] 🔍 ¿Escena existe en APK? false
```

**Causa:** La escena NO está incluida en el APK exportado
**Solución:** Verificar export_presets.cfg (export_filter="all_resources")

---

### ❌ **PROBLEMA 4: change_scene_to_packed retorna error**
```
[Hub] 🔍 Resultado de change_scene_to_packed(): 31  ← ERROR CODE
```

**Causa:** El PackedScene está corrupto o no es válido
**Solución:** Re-exportar APK limpio

---

### ❌ **PROBLEMA 5: Cambio de escena OK pero juego NO ejecuta _ready()**
```
[Hub] ✅ change_scene_to_packed() ejecutado sin errores
[Hub] 🎮 ¡CAMBIO DE ESCENA SOLICITADO!

← NO APARECE NADA DEL JUEGO
```

**Causa:** La escena del juego NO tiene el script vr_start.gd adjunto
**Solución:** Abrir World.tscn en Godot y verificar que el nodo raíz tiene el script

---

### ❌ **PROBLEMA 6: Juego ejecuta _ready() pero GameManager está vacío**
```
[GemsVR] GameManager.patient_id = ''
[GemsVR] GameManager.session_id = ''
```

**Causa:** GameManager se resetea entre escenas (NO es autoload)
**Solución:** Verificar que GameManager está en [autoload] en project.godot

---

### ❌ **PROBLEMA 7: Todo OK pero juego NO inicia**
```
[GemsVR] GameManager.patient_id = 'test123'
[GemsVR] GameManager.session_id = 'session_xyz'
[GemsVR] ✅ Cargado desde Hub - Sesión ya configurada
[GemsVR] 🎮 Iniciando juego directamente...

← NO APARECE MÁS NADA
```

**Causa:** Error en _show_countdown() o _start_game()
**Solución:** Revisar el resto del código del juego

---

## 📋 COMANDO ÚTIL: LIMPIAR LOGS

```bash
# Si hay demasiados logs, limpia y vuelve a empezar:
adb logcat -c

# Luego vuelve a ver los logs:
adb logcat -s godot:V
```

---

## 📋 COMANDO ÚTIL: GUARDAR LOGS EN ARCHIVO

```bash
# Guarda todos los logs en un archivo de texto:
adb logcat -s godot:V > logs_neurovr.txt
```

Luego puedes enviarme el archivo `logs_neurovr.txt` para que lo analice.

---

## ✅ LOGS ESPERADOS SI TODO FUNCIONA

```
[Hub] 🎮 ¡NUEVA SESIÓN DETECTADA!
[Hub] ⏳ Esperando 2 segundos...
[Hub] 🔄 INICIANDO CARGA DE JUEGO
[Hub] ✅ Escena verificada
[GameManager] 📋 CONFIGURACIÓN APLICADA
[Hub] ✅ change_scene_to_packed() ejecutado
═══ 💎 GEMS GAME — VR System INICIANDO ═══
[GemsVR] ✅ GameManager existe
[GemsVR] GameManager.patient_id = 'test123'
[GemsVR] ✅ Cargado desde Hub - Sesión ya configurada
[GemsVR] 🎮 Iniciando juego directamente...
[GemsVR] 👻 Ocultando UI de espera
[GemsVR] ⏳ Mostrando countdown...
[GemsVR] 🎮 ¡INICIANDO JUEGO!
```

---

## 🎯 PRÓXIMO PASO

**HAZ ESTO AHORA:**

1. Exporta el APK de nuevo con todos los cambios:
   - `Project → Export → NeuroVR_LOGS.apk`

2. Instala en la gafa:
   ```bash
   adb install -r NeuroVR_LOGS.apk
   ```

3. Conecta la gafa con USB y ejecuta:
   ```bash
   adb logcat -s godot:V
   ```

4. Crea una sesión en la web

5. **COPIA TODOS LOS LOGS** que aparecen y envíamelos

Con esos logs sabré EXACTAMENTE dónde está fallando! 🔍
