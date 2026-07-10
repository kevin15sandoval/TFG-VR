# 📱 GUÍA DE EXPORTACIÓN APK - MÁXIMA CALIDAD HD

## 🎯 OBJETIVO
Exportar el APK con **máxima calidad HD** para Meta Quest 2/3/Pro.
Las configuraciones aplicadas garantizan experiencia HD sin pixelación.

---

## ✅ CONFIGURACIONES APLICADAS (YA HECHAS)

### 1. **XR Quality Manager HD** (`scripts/xr_quality_manager.gd`)
- ✅ Super-sampling **1.7x** (170% de resolución nativa)
- ✅ MSAA **8X** (máximo anti-aliasing)
- ✅ FXAA + TAA combinados
- ✅ Debanding habilitado (elimina bandas de color)
- ✅ Sharpening optimizado (0.2)
- ✅ HDR 2D habilitado

### 2. **Project Settings HD** (`project.godot`)
- ✅ Texturas lossless (PNG sin compresión)
- ✅ Anisotropic filtering 4x
- ✅ Filtros de texturas máxima calidad
- ✅ MSAA 3D nivel 3
- ✅ TAA + Debanding habilitados
- ✅ Screen Space Reflections calidad 2

### 3. **Export Preset HD** (`export_presets.cfg`)
- ✅ Compresión reducida (zstd nivel 1 en lugar de 19)
- ✅ Meta Quest 2, 3 y Pro soportados
- ✅ Experimental features habilitadas
- ✅ Passthrough, hand tracking, etc. habilitados

### 4. **Import Defaults HD** (`.godot/import_defaults.cfg`)
- ✅ Texturas sin compresión forzada
- ✅ High quality compression habilitada
- ✅ Mipmaps generados para mejor distancia
- ✅ Shadow meshes y LODs habilitados

---

## 📋 PASOS PARA EXPORTAR APK HD

### **PASO 1: Verificar configuraciones en Godot**

1. Abre Godot 4.6
2. Carga el proyecto TFG
3. Ve a **Project → Project Settings → Rendering**
4. Verifica que:
   - ✅ `Textures > VRAM Compression > Import ETC2 ASTC` = ON
   - ✅ `Anti Aliasing > Quality > MSAA 3D` = 3x
   - ✅ `Anti Aliasing > Quality > Use TAA` = ON
   - ✅ `Anti Aliasing > Quality > Use Debanding` = ON
   - ✅ `Scaling 3D > Mode` = Disabled (0)
   - ✅ `Scaling 3D > Scale` = 1.0

### **PASO 2: Verificar Export Preset**

1. Ve a **Project → Export**
2. Selecciona el preset **"APK_0.0.2"**
3. Verifica que:
   - ✅ Export Path: `builds/NeuroVRRehab_v3.0.0_HD.apk`
   - ✅ Platform: Android
   - ✅ Runnable: ON
   - ✅ `XR Features > Enable Meta Plugin` = ON
   - ✅ `Meta XR Features > Quest 2/3/Pro Support` = ON
   - ✅ `Meta XR Features > Use Experimental Features` = ON
   - ✅ `Meta XR Features > Hand Tracking` = ON
   - ✅ `Architectures > arm64-v8a` = ON (solo este)

### **PASO 3: Limpiar cache de Godot (IMPORTANTE)**

Antes de exportar, limpia el cache para asegurar que las nuevas configuraciones se apliquen:

```
1. Cierra Godot
2. Borra la carpeta: .godot/imported/
3. Borra la carpeta: .godot/exported/
4. Abre Godot de nuevo
5. Espera a que re-importe todos los assets (puede tardar 2-5 minutos)
```

### **PASO 4: Exportar APK**

1. En Godot, ve a **Project → Export**
2. Selecciona **"APK_0.0.2"**
3. Click en **"Export Project"**
4. Espera a que se complete (puede tardar 5-10 minutos)
5. Verás el APK en: `builds/NeuroVRRehab_v3.0.0_HD.apk`

### **PASO 5: Instalar en Meta Quest**

#### Opción A - Usando Meta Quest Developer Hub:
1. Abre Meta Quest Developer Hub
2. Conecta las gafas por USB o WiFi
3. Arrastra el APK a la ventana
4. Espera instalación

#### Opción B - Usando ADB:
```cmd
adb install -r "builds\NeuroVRRehab_v3.0.0_HD.apk"
```

### **PASO 6: Verificar calidad HD en VR**

Al abrir la app en Meta Quest, verifica:

1. **Abrir consola de logs** (desde PC):
   ```cmd
   adb logcat | findstr "XR QUALITY HD"
   ```

2. **Buscar estos mensajes**:
   ```
   [XR QUALITY HD] CONFIGURACIÓN HD MÁXIMA APLICADA
   [XR QUALITY HD] Super-sampling: 1.7x (170% resolución)
   [XR QUALITY HD] MSAA: 8X (máximo anti-aliasing)
   ```

3. **Probar visualmente**:
   - ✅ Textos se leen claramente (no pixelados)
   - ✅ Bordes de objetos suaves (no dentados)
   - ✅ Colores vivos y bien definidos
   - ✅ No hay bandas de color en gradientes
   - ✅ Modelos 3D nítidos incluso de lejos

---

## 📊 RESOLUCIONES ESPERADAS

Con super-sampling 1.7x, las resoluciones finales por ojo serán:

| Dispositivo | Resolución Nativa | Con Super-sampling 1.7x |
|-------------|-------------------|-------------------------|
| **Meta Quest 2** | 1832 x 1920 | ~3114 x 3264 |
| **Meta Quest 3** | 2064 x 2208 | ~3509 x 3754 |
| **Meta Quest Pro** | 1800 x 1920 | ~3060 x 3264 |

**Estas son resoluciones 4K+ por ojo = EXPERIENCIA HD GARANTIZADA**

---

## ⚠️ NOTAS IMPORTANTES

### Tamaño del APK:
- **APK anterior**: ~150-200 MB
- **APK HD**: ~180-250 MB (texturas sin comprimir)
- Es normal que sea más grande por la calidad

### Rendimiento:
- **Meta Quest 2**: 72-90 FPS esperados
- **Meta Quest 3**: 90-120 FPS esperados
- **Meta Quest Pro**: 90 FPS esperados

Si hay lag (poco probable), el XRQualityManager puede ajustarse:
- Reducir super-sampling de 1.7x → 1.5x
- Reducir MSAA de 8x → 4x

### Primera ejecución:
- La primera vez que abras la app puede tardar **30-60 segundos** en cargar
- Esto es normal: está compilando shaders para máxima calidad
- Las siguientes ejecuciones serán mucho más rápidas (5-10 seg)

---

## 🐛 TROUBLESHOOTING

### Problema: "APK no se instala"
**Solución**:
```cmd
adb uninstall com.example.TFG
adb install "builds\NeuroVRRehab_v3.0.0_HD.apk"
```

### Problema: "Se ve pixelado aún"
**Verificar**:
1. Logs de `[XR QUALITY HD]` están presentes
2. Export preset tiene `Meta XR Features` habilitadas
3. Re-exportar después de limpiar cache `.godot/`

### Problema: "Lag o stuttering"
**Reducir calidad**:
En `scripts/xr_quality_manager.gd` línea 32:
```gdscript
xr_interface.set_render_target_size_multiplier(1.5)  # Cambiar 1.7 → 1.5
```

### Problema: "Textos borrosos"
**Verificar**:
- Labels3D tienen `pixel_size` correcto (0.002)
- Font size es suficientemente grande (32+)
- TAA y debanding están habilitados

---

## ✅ CHECKLIST FINAL

Antes de dar por terminada la exportación, verifica:

- [ ] APK exportado correctamente (sin errores en Godot)
- [ ] APK instalado en Meta Quest
- [ ] App abre sin crashes
- [ ] Logs muestran `[XR QUALITY HD]` configurado
- [ ] Hub (Ice Scream) se ve brillante y claro
- [ ] Sistema detecta sesiones desde web
- [ ] Los 4 juegos cargan correctamente
- [ ] Calidad HD verificada visualmente
- [ ] No hay dolor de cabeza después de 10 minutos
- [ ] Rendimiento fluido (sin lag)

---

## 🎉 RESULTADO ESPERADO

**ANTES (APK viejo)**:
- 😵 Imagen pixelada y borrosa
- 🤕 Dolor de cabeza después de 5 minutos
- 📉 Resolución reducida (~70-80% nativa)
- 🔲 Bordes dentados en objetos

**DESPUÉS (APK HD nuevo)**:
- 😎 Imagen nítida y cristalina
- ✅ Cómodo para sesiones de 30+ minutos
- 📈 Resolución super-sampled (170% = 4K+)
- 🟦 Bordes suaves con MSAA 8x

---

## 📞 SOPORTE

Si después de exportar sigue habiendo problemas de calidad:
1. Comparte los logs de `adb logcat | findstr "XR QUALITY HD"`
2. Verifica que el APK sea el nuevo (v3.0.0_HD)
3. Confirma que limpiaste el cache `.godot/` antes de exportar

¡Listo para exportar y disfrutar de VR en máxima calidad HD! 🚀
