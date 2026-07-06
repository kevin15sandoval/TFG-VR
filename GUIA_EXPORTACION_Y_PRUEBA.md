# 🚀 GUÍA COMPLETA: EXPORTACIÓN Y PRUEBA DEL SISTEMA

## ✅ VERIFICACIÓN PREVIA

Antes de exportar, verifica que todo esté en orden:

### 1. Verificar Configuración del Proyecto

```bash
# Abrir el archivo para verificar
C:\Users\USUARIO\Documents\tfg\project.godot
```

**Debe contener:**
```ini
[application]
run/main_scene="res://HubWorld.tscn"  ← Debe ser HubWorld

[autoload]
GameManager="*uid://c7175h2t6ufs2"    ← Debe estar presente

[xr]
openxr/enabled=true                    ← Debe ser true
```

### 2. Verificar Permisos de Internet

```bash
# Abrir el archivo para verificar
C:\Users\USUARIO\Documents\tfg\export_presets.cfg
```

**Buscar estas líneas (deben ser true):**
```ini
permissions/internet=true
permissions/access_network_state=true
permissions/access_wifi_state=true
```

### 3. Verificar Escenas de Juegos

**Verificar que estos archivos existen:**
```
✅ C:\Users\USUARIO\Documents\tfg\HubWorld.tscn
✅ C:\Users\USUARIO\Documents\tfg\World.tscn (gems)
✅ C:\Users\USUARIO\Documents\tfg\VaultWorld.tscn
✅ C:\Users\USUARIO\Documents\tfg\CityWorld.tscn
✅ C:\Users\USUARIO\Documents\tfg\LuggageWorld.tscn
```

---

## 📦 EXPORTACIÓN DEL APK

### Paso 1: Abrir Godot

1. Abrir **Godot 4.6**
2. Click en **"Importar"**
3. Navegar a: `C:\Users\USUARIO\Documents\tfg`
4. Seleccionar `project.godot`
5. Click **"Importar y Editar"**

### Paso 2: Verificar Escena Principal

Una vez abierto el proyecto:

1. Ir a **Proyecto → Configuración del Proyecto**
2. En **Application → Run**
3. Verificar que **Main Scene** dice: `res://HubWorld.tscn`
4. Si no es así, hacer click en la carpeta y seleccionar `HubWorld.tscn`
5. Click **"Cerrar"**

### Paso 3: Exportar APK

1. Ir a **Proyecto → Exportar...**
2. En la lista de presets, seleccionar **"APK_0.0.2"** (o el preset de Android)
3. Verificar ruta de exportación: `builds/NeuroVRRehab_v4.0_FINAL.apk`
4. **IMPORTANTE:** Hacer click en **"Exportar Proyecto"** (NO "Exportar PCK")
5. Esperar la compilación (puede tomar 5-10 minutos)
6. Cuando termine, debería aparecer el archivo en:
   ```
   C:\Users\USUARIO\Documents\tfg\builds\NeuroVRRehab_v4.0_FINAL.apk
   ```

---

## 📱 INSTALACIÓN EN META QUEST

### Preparar Meta Quest

1. **Encender Meta Quest**
2. **Activar Modo Desarrollador:**
   - Ir a Settings → System → Developer
   - Activar "USB Connection Dialog"
   - Activar "Developer Mode"

3. **Conectar por USB** al PC (usar cable USB-C)

### Instalar APK con ADB

1. **Abrir PowerShell o CMD**

2. **Navegar a carpeta de ADB:**
   ```powershell
   cd C:\Users\USUARIO\Downloads\platform-tools-latest-windows\platform-tools
   ```

3. **Verificar conexión:**
   ```powershell
   adb devices
   ```
   
   **Debe mostrar algo como:**
   ```
   List of devices attached
   2G0YC5ZG4Q01JK  device
   ```
   
   Si no aparece ningún dispositivo:
   - Verificar que el cable USB funciona (que no sea solo de carga)
   - En las gafas, aceptar el diálogo "Allow USB debugging"
   - Volver a ejecutar `adb devices`

4. **Instalar APK:**
   ```powershell
   adb install -r "C:\Users\USUARIO\Documents\tfg\builds\NeuroVRRehab_v4.0_FINAL.apk"
   ```
   
   **Debe mostrar:**
   ```
   Performing Streamed Install
   Success
   ```

---

## 🎮 PRUEBA DEL SISTEMA COMPLETO

### Fase 1: Verificar Hub World

1. **En Meta Quest:**
   - Ir a **Biblioteca**
   - Click en **Fuentes Desconocidas** (arriba derecha)
   - Buscar **"TFG"** o **"NeuroVRRehab"**
   - Click para iniciar

2. **Deberías ver:**
   - Un ambiente interior (loft)
   - Texto en 3D: "SALA DE ESPERA VR"
   - Texto: "Esperando a que el fisioterapeuta inicie la sesión..."
   
3. **Verificar que NO hay errores:**
   - Las gafas VR funcionan correctamente
   - Los controles se ven (esferas azul y roja en las manos)
   - El ambiente es estable

**✅ Si todo esto funciona, el Hub está OK**

---

### Fase 2: Crear Sesión desde Plataforma Web

1. **En el PC, abrir navegador:**
   ```
   https://tfg-vr.web.app/
   ```

2. **Iniciar sesión:**
   - Usuario: (tu email de fisioterapeuta)
   - Contraseña: (tu contraseña)

3. **Ir a Configuración:**
   - Click en **"Configuración"** (menú lateral)
   - Click en **"Nueva Sesión"**

4. **Llenar formulario:**
   ```
   Paciente: Test Prueba
   Duración: 180 segundos (3 minutos)
   Dificultad: Media
   Lado Afectado: Izquierdo
   Tipo de Sesión: Alcance
   Juego: Recolectar Gemas (gems)
   ```

5. **Click en "Guardar Configuración"**

6. **Verificar que dice:**
   ```
   ✅ Configuración guardada correctamente
   ```

---

### Fase 3: Detección Automática en Hub

1. **Volver a las gafas Meta Quest**

2. **En 3-10 segundos deberías ver:**
   - Texto cambia a: "¡SESIÓN DETECTADA!"
   - Aparece: "Cargando juego..."
   - Aparece nombre del juego: "⭐ Recolectar Gemas"

3. **Luego (después de 2 segundos):**
   - La escena cambia
   - Aparece el ambiente del juego (tren espacial para Gems)
   - El juego inicia automáticamente

**✅ Si esto funciona, el polling y detección están OK**

---

### Fase 4: Jugar y Completar

#### Para Gems Collection:
1. Esperar a que aparezcan gemas flotando
2. Tocar las gemas con las manos (esferas azul/roja)
3. Deberías ver:
   - Gemas desaparecen con efecto de partículas
   - Sonido de colección
   - Score aumenta (visible si hay UI)

4. Jugar durante 3 minutos o hasta que termine

#### Para probar otros juegos:
- **Vault Escape:** Tocar paneles azules, evitar láseres rojos
- **Urban Attention Quest:** Mirar targets amarillos en orden
- **Luggage Handler:** Agarrar maletas de cinta, colocar en zonas

---

### Fase 5: Verificar Resultados

1. **Cuando el juego termina:**
   - Debería volver al Hub (o mostrar pantalla de resultados)
   - Los datos se guardan automáticamente en segundo plano

2. **Volver a la plataforma web:**
   ```
   https://tfg-vr.web.app/
   ```

3. **Ir a "Historial" o "Sesiones"**

4. **Deberías ver:**
   - Nueva sesión registrada
   - Paciente: Test Prueba
   - Juego: Recolectar Gemas
   - Score, precisión, duración
   - Métricas clínicas (movimientos, tiempos, zonas)

**✅ Si los resultados aparecen, Firebase está funcionando correctamente**

---

## 🔍 TROUBLESHOOTING

### Problema 1: Hub no detecta sesión

**Síntomas:**
- Hub se queda en "Esperando a que el fisioterapeuta..."
- No cambia después de guardar config en web

**Soluciones:**
1. Verificar que el APK tiene permisos de Internet:
   ```powershell
   # Verificar en export_presets.cfg
   permissions/internet=true
   ```
2. Volver a exportar APK si es necesario
3. Verificar que Meta Quest tiene WiFi conectado
4. Verificar que Firestore tiene la configuración guardada:
   - Ir a Firebase Console
   - Firestore Database
   - Colección: sesion_activa
   - Documento: current
   - Debe tener datos recientes

### Problema 2: Juego no carga después de detección

**Síntomas:**
- Hub dice "¡SESIÓN DETECTADA!"
- Pero el juego no aparece

**Soluciones:**
1. Verificar que game_id es correcto:
   - Valores válidos: "gems", "vault_escape", "urban_attention_quest", "luggage_handler"
2. Verificar que las escenas existen:
   ```
   World.tscn
   VaultWorld.tscn
   CityWorld.tscn
   LuggageWorld.tscn
   ```
3. Verificar logs de Godot (si exportas con "Export with Debug")

### Problema 3: Resultados no se guardan

**Síntomas:**
- Juego termina
- Pero no aparecen resultados en la web

**Soluciones:**
1. Verificar permisos de Internet (mismo que Problema 1)
2. Verificar PROJECT_ID en firebase_manager.gd:
   ```gdscript
   const PROJECT_ID := "tfg-vr"
   ```
3. Verificar que Firestore tiene reglas correctas:
   ```javascript
   allow write: if true;  // Para colección sesiones
   ```

### Problema 4: OpenXR no funciona

**Síntomas:**
- Juego aparece en 2D en una ventana
- No aparece en las gafas VR

**Soluciones:**
1. Verificar en project.godot:
   ```ini
   [xr]
   openxr/enabled=true
   ```
2. Exportar solo para Android (no Windows)
3. Verificar que Meta Quest está en modo desarrollador

---

## ✅ CHECKLIST DE PRUEBA

Marca cada paso a medida que lo completes:

### Exportación
- [ ] Godot 4.6 abierto
- [ ] Proyecto tfg cargado
- [ ] Main scene es HubWorld.tscn
- [ ] Permisos Internet verificados
- [ ] APK exportado exitosamente
- [ ] APK instalado en Meta Quest

### Hub World
- [ ] APK se inicia correctamente
- [ ] Aparece ambiente loft
- [ ] Labels 3D visibles
- [ ] Dice "Esperando que el fisioterapeuta..."
- [ ] OpenXR funcionando (VR, no 2D)

### Detección de Sesión
- [ ] Config guardada en plataforma web
- [ ] Hub detecta sesión en 3-10 segundos
- [ ] Aparece mensaje "¡SESIÓN DETECTADA!"
- [ ] Aparece nombre del juego

### Carga de Juego
- [ ] Juego carga después de 2 segundos
- [ ] Ambiente del juego correcto
- [ ] Elementos visuales presentes
- [ ] Juego inicia automáticamente

### Gameplay
- [ ] Interacciones funcionan (tocar, agarrar, mirar)
- [ ] Score aumenta
- [ ] Timer funciona
- [ ] Juego termina correctamente

### Resultados
- [ ] Datos se guardan en Firestore
- [ ] Resultados visibles en plataforma web
- [ ] Métricas clínicas correctas
- [ ] No hay errores en consola

---

## 📞 SOPORTE

Si después de seguir esta guía encuentras problemas:

1. **Revisar logs de Godot:**
   - Exportar con "Export with Debug"
   - Conectar Meta Quest por USB
   - Ejecutar: `adb logcat | findstr "Godot"`

2. **Revisar Firebase Console:**
   - https://console.firebase.google.com/
   - Proyecto: tfg-vr
   - Firestore Database
   - Verificar colecciones sesion_activa y sesiones

3. **Revisar código:**
   - AUDITORIA_COMPLETA_SISTEMA.md (este directorio)
   - Verificar que no se hayan hecho cambios no deseados

---

**Guía creada:** 2026-07-06  
**Para sistema:** NeuroVR Rehab v4.0  
**Branch:** feature/openxr-vr-system
