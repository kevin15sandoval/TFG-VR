# 🔍 DIAGNÓSTICO: ¿POR QUÉ SIGUE EL BUCLE INFINITO?

## ✅ LO QUE ESTÁ BIEN:

1. ✅ **Web crea sesión con `status: "pending"`** (línea 179 de db.ts)
2. ✅ **Juego marca `status: "completed"`** antes de DELETE
3. ✅ **Hub filtra sesiones**: Solo detecta si `status == "pending"`
4. ✅ **Delays implementados**: Hub 10s, Juegos 8s

---

## ❌ POSIBLES CAUSAS DEL BUCLE:

### CAUSA #1: APK VIEJO AÚN INSTALADO ⚠️ (MÁS PROBABLE)

Cuando exportaste el APK, ¿hiciste esto?:

```
1. CERRAR Godot completamente
2. Abrir Godot de nuevo
3. Abrir proyecto: C:\Users\USUARIO\Documents\tfg
4. Project → Export → Android
5. VERIFICAR fecha/hora del APK generado (debe ser HOY)
6. adb install -r nombre_exacto_del_apk.apk
```

**VERIFICACIÓN**: El APK nuevo debe tener fecha/hora de HOY

Si instalaste un APK viejo por error → seguirá el bucle

---

### CAUSA #2: FIREBASE CACHÉ EN QUEST 2

Meta Quest 2 puede cachear datos de Firebase. Solución:

```
1. En las gafas Quest 2, ve a: Settings → Apps
2. Busca la app "TFG" o "TFG-VR"
3. Abre la app
4. Click "Clear Data" y "Clear Cache"
5. Reinstala el APK: adb install -r TFG_VR_FIXED_FINAL.apk
```

---

### CAUSA #3: SESIÓN ZOMBIE EN FIREBASE

Puede haber una sesión con `status: "pending"` que nunca se borró.

**VERIFICACIÓN URGENTE**:

1. Abre: https://console.firebase.google.com/project/tfg-vr/firestore
2. Ve a colección: `sesion_activa`
3. ¿Ves un documento `current`?
   - **SÍ** → Abre el documento
     - ¿Tiene campo `status`?
       - **SÍ** → ¿Valor es "pending" o "completed"?
         - **"pending"** → ¡AHÍ ESTÁ EL PROBLEMA! Bórralo manualmente
         - **"completed"** → El Hub debería ignorarlo (verifica APK)
       - **NO** → Agrega campo: `status: "completed"` O bórralo
   - **NO** → Bien, no hay sesión zombie

---

### CAUSA #4: LOGS NO COINCIDEN CON APK

Puede que estés viendo logs de Godot EDITOR, no de las gafas.

**VERIFICACIÓN**:

Cuando juegas en las gafas, ¿conectas Quest 2 por USB y ves logs en Godot?

Si **NO** ves logs → Los logs que viste eran del EDITOR, no del APK real.

Para ver logs del APK real:

```bash
# Conecta Quest 2 por USB
# En PC, abre terminal:

adb logcat | findstr "Godot\|Firebase\|VR\|Hub\|Gems"
```

Esto te mostrará los logs REALES del APK en las gafas.

---

## 🎯 PLAN DE ACCIÓN URGENTE:

### PASO 1: VERIFICAR FIREBASE (2 minutos)

1. Abre Firebase Console: https://console.firebase.google.com/project/tfg-vr/firestore
2. Ve a: `sesion_activa` → `current`
3. Si existe:
   - **OPCIÓN A**: Elimínalo completamente (botón 3 puntos → Delete)
   - **OPCIÓN B**: Cambia `status` de "pending" → "completed"

---

### PASO 2: LIMPIAR QUEST 2 (3 minutos)

```
En las gafas:
1. Settings → Apps → TFG
2. Click "Clear Data" + "Clear Cache"
3. Click "Uninstall"

En PC:
4. adb uninstall com.godot.tfg  (o el package name que uses)
```

---

### PASO 3: GENERAR APK NUEVO LIMPIO (5 minutos)

```
1. CIERRA Godot completamente (importante)
2. ABRE Godot de nuevo
3. Abre proyecto: C:\Users\USUARIO\Documents\tfg
4. Verifica código:
   - Abre hub_manager.gd
   - Busca: "create_timer(10.0)" ← ¿Lo ves?
   - Si NO lo ves → Haz git pull origin main
5. Project → Export → Android
6. Export Project → Guardar como: TFG_VR_DIAGNOSTIC_v1.apk
7. VERIFICA fecha/hora del archivo APK (debe ser de AHORA)
```

---

### PASO 4: INSTALAR APK LIMPIO (2 minutos)

```bash
# Conecta Quest 2 por USB

# Verifica que esté conectado:
adb devices

# Instala el APK NUEVO:
adb install -r TFG_VR_DIAGNOSTIC_v1.apk

# Verifica que se instaló:
adb shell pm list packages | findstr tfg
```

---

### PASO 5: PRUEBA CON LOGS (10 minutos)

```bash
# TERMINAL 1 - Logs en vivo:
adb logcat -c  # Limpia logs anteriores
adb logcat | findstr "Godot Firebase VR Hub Gems"

# TERMINAL 2 - O usa Godot:
Remote Debug → Deploy with Remote Debug

# Ahora juega en las gafas y OBSERVA los logs
```

---

## 📊 LOGS QUE DEBES VER:

### Si el APK es NUEVO (con hotfix):

```
[Hub] ⏳ Esperando 10 segundos antes de iniciar polling...
... (espera ~10s)
[Hub] ✅ Firebase Manager configurado y polling iniciado
[Hub] 📡 Poll response - Result: 0 Code: 404
[Hub] ⏳ Sin sesión activa aún
```

### Si el APK es VIEJO (sin hotfix):

```
[Hub] (sin mencionar 10 segundos)
[Hub] ✅ Firebase Manager configurado
[Hub] 📡 Poll response - Result: 0 Code: 200  ← Detecta sesión inmediato
[Hub] 🎮 NUEVA SESIÓN DETECTADA
... (carga el juego otra vez)
```

---

## 🚨 SI DESPUÉS DE TODO SIGUE FALLANDO:

Puede que el problema NO sea el bucle, sino que **el juego NO está enviando resultados** a Firebase.

### Verifica en Firebase Console:

1. Ve a: `sesiones` (colección de resultados)
2. ¿Ves resultados nuevos de las sesiones que jugaste?
   - **SÍ** → El juego SÍ envía, problema es solo bucle
   - **NO** → El juego NO envía resultados (problema diferente)

---

## 💡 SOLUCIÓN TEMPORAL SI URGE:

Si necesitas entregar YA y el bucle persiste, puedes:

### OPCIÓN A: Aumentar delays aún más

En `hub_manager.gd`:
```gdscript
await get_tree().create_timer(20.0).timeout  # De 10s → 20s
```

En `vr_start.gd`:
```gdscript
await get_tree().create_timer(15.0).timeout  # De 8s → 15s
```

Total buffer: **35 segundos** (muy conservador)

---

### OPCIÓN B: Desactivar polling automático

En `hub_manager.gd`, comenta la línea:
```gdscript
# firebase_manager.start_polling()  # ← Comentar esta línea
```

Entonces el Hub se queda esperando sin volver a cargar. El fisioterapeuta debe:
1. Reiniciar la app manualmente en las gafas después de cada sesión
2. O usar botón "Restart App" en las gafas

**No es ideal**, pero funciona para la demo.

---

## 📝 RESUMEN DE VERIFICACIÓN:

Marca lo que YA verificaste:

- [ ] Firebase Console: ¿Hay documento en `sesion_activa/current`?
- [ ] Si hay, ¿tiene `status: "completed"` o "pending"?
- [ ] Quest 2: ¿Hice Clear Data + Clear Cache?
- [ ] Godot: ¿hub_manager.gd tiene `create_timer(10.0)`?
- [ ] APK: ¿El archivo .apk tiene fecha/hora de HOY?
- [ ] ADB: ¿Instalé el APK con `adb install -r`?
- [ ] Logs: ¿Veo "Esperando 10 segundos" en los logs?
- [ ] Resultado: ¿El juego vuelve a cargar o se queda en Hub?

---

## 🎯 SIGUIENTE PASO:

**Necesito que me digas**:

1. ¿Abriste Firebase Console y viste `sesion_activa/current`?
2. Si existe, ¿qué dice el campo `status`?
3. ¿El APK que instalaste tiene fecha/hora de HOY?
4. ¿Ves en los logs: "Esperando 10 segundos antes de iniciar polling"?

Con esa info puedo diagnosticar exactamente dónde está el problema.

---

**FECHA**: 13 Julio 2026  
**PRIORIDAD**: 🔥 CRÍTICA  
**PARA ENTREGAR**: Necesitas que esto funcione YA
