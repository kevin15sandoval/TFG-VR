# 🔧 SOLUCIÓN AL PROBLEMA DEL HUB

## ❌ PROBLEMA
El APK exportado sigue usando el modelo antiguo de **ice_scream** en vez del **Loft**, aunque HubWorld.tscn está configurado correctamente.

**Causa:** Godot tiene caché corrupto en la carpeta `.godot/imported/` que contiene versiones antiguas de los modelos.

---

## ✅ SOLUCIÓN PASO A PASO

### 1️⃣ CERRAR GODOT COMPLETAMENTE
- Cierra Godot si está abierto
- Verifica en el Administrador de Tareas que no hay procesos de Godot corriendo

### 2️⃣ EJECUTAR EL SCRIPT DE LIMPIEZA
- Haz doble clic en: **`CLEAR_GODOT_CACHE.bat`**
- El script eliminará:
  - `.godot\imported\` (todos los assets cacheados)
  - `.godot\editor\` (estado del editor)

### 3️⃣ ABRIR GODOT Y ESPERAR RE-IMPORTACIÓN
- Abre Godot
- **ESPERA 1-2 MINUTOS** mientras Godot re-importa todos los assets
- Verás una barra de progreso en la parte inferior: "Importing (X/1200)..."
- **NO HAGAS NADA** hasta que termine completamente

### 4️⃣ VERIFICAR QUE EL HUB ES CORRECTO
- Abre la escena: **`HubWorld.tscn`**
- En el viewport 3D, debes ver el **modelo LOFT** (interior moderno con columnas)
- **NO debe verse** el shopping center de ice_scream

### 5️⃣ EXPORTAR APK DE NUEVO
- Menú: **Project → Export**
- Selecciona: **Android (Runnable)**
- Click: **Export Project**
- Guarda como: **`NeuroVR_Rehab_CLEAN.apk`**

### 6️⃣ INSTALAR EN LA GAFA
```bash
adb install -r NeuroVR_Rehab_CLEAN.apk
```

---

## 🔍 VERIFICACIÓN

Para confirmar que el problema está resuelto:

1. **En Godot (antes de exportar):**
   - Abre HubWorld.tscn
   - Ve el modelo 3D en el viewport
   - Debe ser el Loft (interior moderno), NO shopping center

2. **En la Meta Quest (después de instalar):**
   - Abre NeuroVR Rehab
   - El Hub debe ser el Loft
   - La iluminación debe ser moderada (no muy brillante)
   - Los 4 juegos deben cargar correctamente

---

## 📋 CHECKLIST DE VERIFICACIÓN

- [ ] Godot cerrado completamente
- [ ] Script CLEAR_GODOT_CACHE.bat ejecutado
- [ ] Godot abierto y re-importación completa (1-2 minutos)
- [ ] HubWorld.tscn muestra el modelo Loft en el viewport 3D
- [ ] APK exportado con el nombre NeuroVR_Rehab_CLEAN.apk
- [ ] APK instalado en la gafa con `adb install -r`
- [ ] Hub en VR muestra el Loft (no shopping center)
- [ ] Los 4 juegos cargan correctamente desde el Hub

---

## 🚨 SI EL PROBLEMA PERSISTE

Si después de seguir estos pasos el Hub TODAVÍA muestra ice_scream:

1. Cierra Godot
2. Elimina **TODA la carpeta .godot** (no solo imported/editor)
3. Abre Godot de nuevo (re-creará todo desde cero)
4. Espera 2-3 minutos a la re-importación completa
5. Verifica HubWorld.tscn
6. Exporta APK de nuevo

---

## 📌 ARCHIVOS IMPORTANTES

- **HubWorld.tscn**: Escena del Hub (configurado correctamente con Loft)
- **project.godot**: Configuración de rendering (MSAA, FXAA, anisotropic)
- **models/loft2_free_interior.glb**: Modelo correcto del Hub
- **.godot/imported/**: CACHE (causa del problema)

---

## ✅ ESTADO ACTUAL DEL PROYECTO

- ✅ HubWorld.tscn referencia loft2_free_interior.glb
- ✅ Calidad de renderizado mejorada (MSAA 2, FXAA, aniso 4x)
- ✅ Iluminación moderada (light_energy: 0.9)
- ✅ Todos los juegos cargan desde Hub (GameManager verification)
- ✅ Sin emojis en UI (compatibilidad VR)
- ✅ Colisiones en todos los juegos
- ❌ Cache corrupto en .godot/imported/ (RESOLVER CON ESTE SCRIPT)
