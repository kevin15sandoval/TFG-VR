# 🚀 GUÍA RÁPIDA: Exportar y Probar en Meta Quest

## 📦 PASO 1: EXPORTAR EN GODOT

1. Abre Godot 4.6
2. Ve a: **Proyecto → Exportar**
3. Selecciona el preset: **Android**
4. Haz clic en pestaña: **Recursos**
5. **IMPORTANTE**: Verifica que estén marcadas:
   ```
   ☑ HubWorld.tscn
   ☑ World.tscn  
   ☑ VaultWorld.tscn
   ☑ CityWorld.tscn
   ☑ LuggageWorld.tscn
   ```
6. Haz clic en: **Exportar Proyecto**
7. Guarda como: `NeuroVR_Rehab.apk`

---

## 📲 PASO 2: INSTALAR EN META QUEST

```powershell
# Ir a carpeta de adb
cd C:\Users\USUARIO\Downloads\platform-tools-latest-windows\platform-tools

# Conectar Meta Quest por USB

# Instalar APK
adb install -r NeuroVR_Rehab.apk
```

**Deberías ver**:
```
Performing Streamed Install
Success
```

---

## 🎮 PASO 3: PROBAR EL SISTEMA

### A. Iniciar la App

1. Ponte las gafas Meta Quest
2. Ve a: **Biblioteca → Apps desconocidas**
3. Busca: **NeuroVR Rehab**
4. Haz clic para iniciar

### B. Verificar Sala de Espera

Deberías ver:
```
🏥 SALA DE ESPERA VR
Esperando a que el fisioterapeuta inicie la sesión...
```

### C. Iniciar Sesión desde Web

1. En tu PC, abre: `http://localhost:5000` (plataforma clínica)
2. Crea o selecciona un paciente
3. Haz clic en: **"Iniciar Sesión"**
4. Elige:
   - Juego: Ej: "Urban Attention Quest"
   - Duración: 180 segundos
   - Dificultad: Media
   - Lado de terapia: Derecho
5. Haz clic en: **"Iniciar"**

### D. Verificar en las Gafas

En unos segundos deberías ver:
```
¡SESIÓN DETECTADA!  (verde)
Cargando juego...
🎯 Urban Attention Quest
```

Luego un countdown:
```
3
2
1
¡GO!
```

**Y el juego debe aparecer**

---

## ✅ VERIFICACIONES DURANTE EL JUEGO

### 1. Física
- ✅ **NO** te caes por el suelo
- ✅ **NO** atraviesas paredes
- ✅ Puedes moverte normalmente

### 2. HUD
- ✅ Ves el **score** (arriba izquierda)
- ✅ Ves el **timer** (arriba derecha)
- ✅ Ves **instrucciones** (si aplica)

### 3. Gameplay
- ✅ Los objetos aparecen (gemas, targets, maletas, paneles)
- ✅ Puedes tocar/interactuar con las manos VR
- ✅ El puntaje aumenta cuando recolectas

### 4. Final
- ✅ Cuando termina el tiempo, ves: "¡SESIÓN COMPLETADA!"
- ✅ Ves tu score final
- ✅ Después de 5 segundos vuelves a sala de espera

---

## 🔍 SI ALGO FALLA

### Capturar Logs

```powershell
# En otra ventana CMD/PowerShell mientras juegas
cd C:\Users\USUARIO\Downloads\platform-tools-latest-windows\platform-tools

# Capturar logs del Hub
adb logcat | findstr "Hub" > logs_hub.txt

# Capturar TODOS los logs (más detallado)
adb logcat > logs_completos.txt
```

### Qué buscar en logs_hub.txt

**Si funciona bien:**
```
[Hub] 🎮 ¡Nueva sesión detectada!
[Hub] 🔍 ¿Escena existe en APK? true
[Hub] ✅ Recurso cargado exitosamente
[Hub] ✅ Escena instanciada correctamente
[Hub] ✅ Escena añadida al árbol de nodos
[Hub] 🎮 ¡JUEGO CARGADO Y EN EJECUCIÓN!
```

**Si falla:**
```
[Hub] 🔍 ¿Escena existe en APK? false
[Hub] ❌ ERROR CRÍTICO: No se encuentra la escena
```
→ **Solución**: Vuelve a exportar y asegúrate de incluir todas las escenas en export presets

---

## 🧪 PRUEBA CADA JUEGO

### 1. Recolectar Gemas (`gems`)
- Gemas de colores aparecen flotando
- Toca con las manos para recolectar
- Evita gemas rojas (restan puntos)
- Objetivo: Máximo puntaje

### 2. Laser Vault Escape (`vault_escape`)
- Paneles de control en las paredes
- Toca los paneles en orden
- Evita los láseres (restan puntos)
- Objetivo: Activar todos los paneles

### 3. Urban Attention Quest (`urban_attention_quest`)
- Targets aparecen en edificios de la ciudad
- Toca los targets que se iluminan
- Objetivo: Máxima precisión

### 4. Luggage Handler (`luggage_handler`)
- Maletas aparecen en cinta transportadora
- Agarra las maletas con grip
- Colócalas en la zona correcta (verde/amarilla/roja según peso)
- Objetivo: Colocar correctamente máximo número

---

## 📊 VERIFICAR MÉTRICAS EN FIREBASE

1. Ve a: https://console.firebase.google.com
2. Proyecto: **tfg-vr**
3. Firestore Database
4. Colección: **sesiones**
5. Busca el documento con tu `session_id`

Deberías ver:
```json
{
  "patient_id": "...",
  "session_id": "...",
  "game_type": "urban_attention_quest",
  "score": 850,
  "accuracy": 95,
  "targets_collected": 8,
  "timestamp": "2026-07-06T..."
}
```

---

## ⚠️ PROBLEMAS COMUNES Y SOLUCIONES

| Problema | Solución |
|----------|----------|
| App no aparece en Quest | Revisa "Apps desconocidas" en Biblioteca |
| Se cae por el suelo | Verifica que exportaste con los últimos cambios |
| No detecta sesión | Verifica que plataforma web esté en localhost:5000 y Quest tenga WiFi |
| Juego no carga | Captura logs con `adb logcat` y revisa export presets |
| No se ven objetos | Verifica que modelos .glb estén en carpeta models/ |
| Métricas no guardan | Verifica conexión a Internet del Quest |

---

## 📞 SI NECESITAS AYUDA

Proporciona:
1. ✅ Logs de `adb logcat | findstr "Hub"`
2. ✅ Captura de export presets (pestaña Recursos)
3. ✅ Descripción exacta de qué ves en las gafas
4. ✅ Qué juego intentaste iniciar (game_id)

---

## ✅ CHECKLIST COMPLETO

**Antes de exportar:**
- ☑ Ejecutar `.\VERIFICAR_ANTES_DE_EXPORTAR.ps1`
- ☑ Sin errores críticos

**Al exportar:**
- ☑ Todas las escenas .tscn incluidas
- ☑ Permisos de Internet habilitados

**Después de instalar:**
- ☑ App aparece en Quest
- ☑ Se ve sala de espera
- ☑ Polling funciona (polling activo)

**Al iniciar sesión:**
- ☑ Se detecta en ~3 segundos
- ☑ Aparece countdown
- ☑ Juego carga correctamente

**Durante el juego:**
- ☑ No hay caídas por el suelo
- ☑ HUD visible y funciona
- ☑ Objetos interactuables

**Al terminar:**
- ☑ Mensaje de completado
- ☑ Métricas en Firebase
- ☑ Vuelve a sala de espera

---

**¡Todo listo para probar!** 🚀

