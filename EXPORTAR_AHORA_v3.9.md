# 🚀 EXPORTAR APK v3.9.0 - INSTRUCCIONES RÁPIDAS

## ✅ CAMBIOS EN ESTA VERSIÓN:

### CityWorld - Urban Attention Quest:
1. ✅ Countdown "3, 2, 1, ¡EXPLORA!" restaurado (visual, sin audio)
2. ✅ HUD visible (score y timer) con logs de debugging
3. ✅ Spawning corregido: 2 targets cada 5 segundos
4. ✅ Targets reaparecen infinitamente hasta fin del tiempo
5. ✅ Explosiones y sonido funcionando correctamente
6. ✅ Sistema anti-throttling (foveated rendering + MSAA optimizado)
7. ✅ Previene degradación de calidad (pixelado/blanqueado)

### HubWorld:
- ✅ Ya tiene anti-throttling funcionando

---

## 📱 PASOS PARA EXPORTAR:

### **1. Abrir Godot Editor**
- Abre el proyecto `c:\Users\USUARIO\Documents\tfg\`
- Espera a que importe (aparecerá "Ready" abajo a la derecha)

### **2. Exportar APK**
1. **Project → Export** (menú superior)
2. Selecciona preset: **"APK_0.0.2"** 
3. Verifica que dice: `builds/NeuroVRRehab_v3.9.0_HD.apk`
4. Click **"Export Project"**
5. Espera a que termine (puede tardar 2-5 minutos)

### **3. Instalar en Quest**
Opción A - SideQuest:
```
1. Conecta Meta Quest por USB
2. Abre SideQuest
3. Arrastra builds/NeuroVRRehab_v3.9.0_HD.apk
4. Instala
```

Opción B - ADB:
```cmd
adb install -r builds\NeuroVRRehab_v3.9.0_HD.apk
```

### **4. Probar en Quest**
1. Desinstala la versión anterior si existe
2. Instala la nueva v3.9.0
3. Abre la app
4. Ve al HubWorld → Enter al mundo urbano (CityWorld)
5. Verifica:
   - ✅ Countdown "3, 2, 1, ¡EXPLORA!" se ve
   - ✅ HUD visible (score arriba izq, timer arriba der)
   - ✅ Spawning de 2 en 2 cada 5 segundos
   - ✅ Targets reaparecen tras recogerlos
   - ✅ Calidad NO se degrada (se mantiene nítido)

---

## 🐛 SI ALGO NO FUNCIONA:

### El countdown no aparece:
- Revisa logs: `adb logcat | findstr CityVR`
- Busca: `"🎬 Iniciando countdown"`

### HUD no visible:
- Revisa logs: `adb logcat | findstr "👁️ Mostrando HUD"`
- Busca: `"✅ Score visible"`, `"✅ Timer visible"`

### Todos los targets salen de golpe:
- Revisa logs: `adb logcat | findstr "🎲 Intentando spawnar"`
- Busca: `"✅ Spawneados 2 targets"`

### Targets no reaparecen:
- Revisa logs: `adb logcat | findstr "🔄 Reseteando target"`
- Busca: `"✅ Target X reseteado y listo"`

### Calidad se degrada (pixelado):
- Revisa logs: `adb logcat | findstr "🎨 Configurando calidad VR"`
- Busca: `"✅ Foveated Rendering: NIVEL 2"`

---

## 📊 COMMITS INCLUIDOS:

```
24d5c644 - fix(cityworld): prevenir degradación de calidad progresiva (throttling)
0859f9d3 - fix(cityworld): restaurado countdown visual y corregido HUD y spawning
0fa704ee - fix(cityworld): score HUD actualizado y logs detallados de métricas
2525fa26 - fix(cityworld): corregidos efectos visuales, spawning y reutilización de targets
```

---

## ⚠️ IMPORTANTE:

**DEBES EXPORTAR DESDE GODOT** - Los cambios están en el código pero NO en el APK anterior.

Sin exportar = Sin cambios en la Quest = Mismos problemas

---

## 📝 VERSION INFO:

- **Version**: 3.9.0 HD
- **Fecha**: 2026-07-11
- **Branch**: feature/openxr-vr-system
- **APK**: builds/NeuroVRRehab_v3.9.0_HD.apk
