# 🚀 PASOS RÁPIDOS PARA DEPLOY DE TODOS LOS JUEGOS

## ⚡ RESUMEN EJECUTIVO

Ya está **TODO IMPLEMENTADO Y LISTO**. Solo necesitas:
1. Exportar los 4 juegos desde Godot
2. Ejecutar el script de deploy
3. ¡Listo! Todo funcionando en Firebase

---

## 📝 PASOS EXACTOS

### PASO 1: Exportar Juegos desde Godot (15 minutos)

1. **Abre Godot 4.6**
2. **Carga el proyecto TFG** desde `c:\Users\USUARIO\Documents\tfg`
3. **Ve a Project → Export...**

4. **Añade preset Web** (si no existe):
   - Clic en "Add..."
   - Selecciona "Web"
   
5. **Crea 4 presets** (uno para cada juego):

   **Preset 1: Gems**
   - Nombre: `Gems WebXR`
   - Export Path: `builds/gems/index.html`
   - Runnable: ✅
   - Clic "Export Project"

   **Preset 2: Vault**
   - Nombre: `Vault WebXR`
   - Export Path: `builds/vault_escape/index.html`
   - Runnable: ✅
   - Clic "Export Project"

   **Preset 3: City**
   - Nombre: `City WebXR`
   - Export Path: `builds/urban_attention_quest/index.html`
   - Runnable: ✅
   - Clic "Export Project"

   **Preset 4: Luggage**
   - Nombre: `Luggage WebXR`
   - Export Path: `builds/luggage_handler/index.html`
   - Runnable: ✅
   - Clic "Export Project"

6. **Espera** a que terminen todas las exportaciones

### PASO 2: Deploy Automático (5 minutos)

1. **Abre CMD** en la carpeta del proyecto:
   ```
   cd c:\Users\USUARIO\Documents\tfg
   ```

2. **Ejecuta el script de deploy**:
   ```
   deploy_all_games.bat
   ```

3. **Espera** a que termine. El script hace:
   - ✅ Copia los 4 juegos a la carpeta de Firebase
   - ✅ Build de la plataforma clínica
   - ✅ Deploy a Firebase Hosting

4. **¡LISTO!** Todos los juegos están en línea

---

## 🌐 URLs FINALES

Después del deploy, estos son los enlaces:

```
🏥 Plataforma Clínica:
   https://tfg-vr.web.app/

🎮 Juegos VR:
   https://tfg-vr.web.app/games/gems/
   https://tfg-vr.web.app/games/vault_escape/
   https://tfg-vr.web.app/games/urban_attention_quest/
   https://tfg-vr.web.app/games/luggage_handler/
```

---

## ✅ VERIFICACIÓN

Para comprobar que todo funciona:

1. **Abre la plataforma**: `https://tfg-vr.web.app`
2. **Inicia sesión** como fisioterapeuta
3. **Selecciona un paciente**
4. **Elige uno de los 4 juegos**:
   - ⭐ Recolectar Gemas
   - 🔐 Laser Vault Escape
   - 🎯 Urban Attention Quest
   - 📦 Luggage Handler
5. **Clic en "Iniciar Sesión VR"**
6. **En tu Meta Quest**:
   - Abre el navegador
   - Ve a la URL del juego elegido
   - Espera 3-5 segundos
   - ¡El juego detectará la sesión y comenzará automáticamente!

---

## 🎯 CONFIGURACIÓN ACTUAL

### ✅ Lo que YA está hecho:

1. **vr_start.gd actualizado** - Detecta automáticamente qué juego cargar
2. **4 game managers implementados**:
   - `gem_spawner.gd` (Gems)
   - `vault_game_manager.gd` (Vault)
   - `city_game_manager.gd` (City)
   - `luggage_game_manager.gd` (Luggage)
3. **4 escenas de mundo listas**:
   - `World.tscn`
   - `VaultWorld.tscn`
   - `CityWorld.tscn`
   - `LuggageWorld.tscn`
4. **Sistema de polling universal** - Funciona para todos los juegos
5. **HUD adaptativo** - Se ajusta según el juego activo
6. **Callbacks específicos** - Cada juego tiene sus propios eventos
7. **Firebase configurado** - Headers y rewrites correctos
8. **Script de deploy automático** - `deploy_all_games.bat`

### ⚙️ Cómo funciona el sistema:

```
1. Fisioterapeuta selecciona juego en la web
   ↓
2. Se guarda configuración en Firestore con game_id
   ↓
3. Paciente abre URL del juego en Meta Quest
   ↓
4. vr_start.gd detecta la sesión activa (polling)
   ↓
5. Lee game_id de la configuración
   ↓
6. Carga el game manager apropiado dinámicamente
   ↓
7. Muestra countdown 3...2...1...GO!
   ↓
8. Inicia el juego específico
   ↓
9. Al terminar, guarda resultados en Firestore
   ↓
10. Vuelve a sala de espera (esperando nueva sesión)
```

---

## 🐛 SOLUCIÓN RÁPIDA DE PROBLEMAS

### "No se encuentra Godot"
→ Asegúrate de tener Godot 4.6 instalado

### "Error al exportar"
→ Verifica que tienes el template de exportación Web instalado
→ En Godot: Editor → Manage Export Templates → Download and Install

### "Deploy falla"
→ Verifica que tienes Firebase CLI instalado: `npm install -g firebase-tools`
→ Verifica que estás logueado: `firebase login`

### "El juego no carga en el navegador"
→ Abre la consola del navegador (F12) y busca errores
→ Verifica que los archivos `.wasm` y `.pck` están en la carpeta correcta

### "El juego no detecta la sesión"
→ Verifica que el `game_id` en Firestore coincide con el juego
→ Revisa la consola del navegador para mensajes de polling

---

## 📊 TIEMPO ESTIMADO TOTAL

- **Primera vez**: 30-40 minutos
  - Exportar juegos: 15 min
  - Build y deploy: 10 min
  - Pruebas: 15 min

- **Siguientes veces**: 10-15 minutos
  - Solo necesitas exportar y ejecutar el script

---

## 💡 TIPS

1. **Exporta todos los juegos de una vez** - No los exportes uno por uno
2. **Usa el script automático** - No copies manualmente
3. **Prueba localmente primero** - Ejecuta cada escena en Godot antes de exportar
4. **Mantén las builds** - No borres la carpeta `builds/` entre deploys

---

¡SISTEMA COMPLETO DE MULTI-JUEGOS LISTO! 🎉
