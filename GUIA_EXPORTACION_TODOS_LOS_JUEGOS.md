# 🎮 GUÍA DE EXPORTACIÓN Y DESPLIEGUE DE TODOS LOS JUEGOS

## ✅ ESTADO ACTUAL

**Todos los juegos están implementados y listos:**

1. ✅ **Recolectar Gemas** (`gems`) - `World.tscn`
2. ✅ **Laser Vault Escape** (`vault_escape`) - `VaultWorld.tscn`
3. ✅ **Urban Attention Quest** (`urban_attention_quest`) - `CityWorld.tscn`
4. ✅ **Luggage Handler** (`luggage_handler`) - `LuggageWorld.tscn`

**✅ Sistema de auto-detección de juegos implementado** en `vr_start.gd`

---

## 📋 PASO 1: EXPORTAR CADA JUEGO DESDE GODOT

### 1.1 Abrir el Editor de Godot
1. Abre Godot 4.6
2. Carga el proyecto `TFG` desde `c:\Users\USUARIO\Documents\tfg`

### 1.2 Configurar Exportación WebXR

1. Ve a **Project > Export...**
2. Si no existe, añade **Web** como plataforma de exportación
3. Configura cada preset:

#### Preset 1: Gems Game
- **Nombre**: `Gems - WebXR`
- **Export Path**: `builds/gems/index.html`
- **Main Scene**: `res://World.tscn`
- **Custom Template**: Release
- **Head Include**: 
```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
```

#### Preset 2: Vault Escape
- **Nombre**: `Vault - WebXR`
- **Export Path**: `builds/vault_escape/index.html`
- **Main Scene**: `res://VaultWorld.tscn`
- Rest igual que Gems

#### Preset 3: Urban Attention Quest  
- **Nombre**: `City - WebXR`
- **Export Path**: `builds/urban_attention_quest/index.html`
- **Main Scene**: `res://CityWorld.tscn`
- Rest igual que Gems

#### Preset 4: Luggage Handler
- **Nombre**: `Luggage - WebXR`
- **Export Path**: `builds/luggage_handler/index.html`
- **Main Scene**: `res://LuggageWorld.tscn`
- Rest igual que Gems

### 1.3 Exportar Todos los Juegos

Para cada preset:
1. Selecciona el preset
2. Clic en **Export Project**
3. Confirma la ruta en `builds/[nombre_juego]/`
4. Espera a que termine la exportación

**IMPORTANTE**: Asegúrate de que cada build esté en su carpeta:
```
builds/
  ├── gems/
  │   ├── index.html
  │   ├── index.js
  │   ├── index.wasm
  │   ├── index.pck
  │   └── index.audio.worklet.js
  ├── vault_escape/
  │   └── (mismos archivos)
  ├── urban_attention_quest/
  │   └── (mismos archivos)
  └── luggage_handler/
      └── (mismos archivos)
```

---

## 📤 PASO 2: SUBIR A FIREBASE HOSTING

### 2.1 Estructura de Firebase Hosting

Necesitamos crear una estructura que permita acceder a cada juego por URL:

```
https://tfg-vr.web.app/games/gems/
https://tfg-vr.web.app/games/vault_escape/
https://tfg-vr.web.app/games/urban_attention_quest/
https://tfg-vr.web.app/games/luggage_handler/
```

### 2.2 Preparar Archivos para Deploy

1. Ve a la carpeta de la plataforma clínica:
```bash
cd c:\Users\USUARIO\Documents\tfg\Plataforma_Clinica
```

2. Crea la estructura de juegos dentro de `dist/`:
```bash
mkdir dist\games
mkdir dist\games\gems
mkdir dist\games\vault_escape
mkdir dist\games\urban_attention_quest
mkdir dist\games\luggage_handler
```

3. Copia los builds de Godot a Firebase:
```bash
xcopy /E /I ..\builds\gems dist\games\gems
xcopy /E /I ..\builds\vault_escape dist\games\vault_escape
xcopy /E /I ..\builds\urban_attention_quest dist\games\urban_attention_quest
xcopy /E /I ..\builds\luggage_handler dist\games\luggage_handler
```

### 2.3 Actualizar firebase.json

Edita `Plataforma_Clinica/firebase.json` para incluir las rutas de juegos:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/games/**",
        "destination": "/games/**"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/games/**/*.wasm",
        "headers": [
          {
            "key": "Content-Type",
            "value": "application/wasm"
          }
        ]
      },
      {
        "source": "/games/**/*.pck",
        "headers": [
          {
            "key": "Content-Type",
            "value": "application/octet-stream"
          }
        ]
      }
    ]
  }
}
```

### 2.4 Deploy a Firebase

1. Build de la plataforma clínica:
```bash
npm run build
```

2. Deploy a Firebase:
```bash
firebase deploy
```

Esto subirá:
- La plataforma clínica en la raíz
- Los 4 juegos VR en `/games/[nombre]/`

---

## 🔧 PASO 3: ACTUALIZAR LA PLATAFORMA CLÍNICA

### 3.1 Actualizar URLs de Juegos en App.tsx

Los `MINIGAMES` en `App.tsx` ya tienen los IDs correctos:
- `gems` ✅
- `vault_escape` ✅
- `urban_attention_quest` ✅
- `luggage_handler` ✅

### 3.2 Verificar Configuración de Firestore

El documento `sesion_activa/current` debe incluir el campo `game_id`:

```javascript
{
  patient_id: "1",
  patient_name: "Carmen Rodríguez",
  session_id: "session_123",
  game_id: "vault_escape",  // ← Campo crítico
  duration: 180,
  difficulty: "Media",
  therapy_side: "Izquierdo",
  session_type: "Alcance"
}
```

---

## 🧪 PASO 4: PROBAR CADA JUEGO

### 4.1 Prueba Local (Antes de Desplegar)

Para cada juego, puedes probarlo localmente:

1. Abre Godot
2. Selecciona la escena del juego (ej: `VaultWorld.tscn`)
3. Presiona F6 para ejecutar la escena
4. Conecta tu Meta Quest y prueba en VR

### 4.2 Prueba en Producción (Después de Desplegar)

1. Abre la plataforma clínica: `https://tfg-vr.web.app`
2. Inicia sesión como fisioterapeuta
3. Selecciona un paciente
4. En "Iniciar Sesión VR", selecciona un juego diferente:
   - ⭐ Recolectar Gemas
   - 🔐 Laser Vault Escape
   - 🎯 Urban Attention Quest
   - 📦 Luggage Handler
5. Clic en "Iniciar Sesión VR"
6. En tu Meta Quest, abre el navegador y ve a: `https://tfg-vr.web.app/games/[game_id]/`
7. El juego detectará automáticamente la sesión y comenzará

---

## 🚀 FLUJO COMPLETO DE UNA SESIÓN

1. **Fisioterapeuta** abre la plataforma web
2. **Fisioterapeuta** selecciona paciente y juego (ej: "Vault Escape")
3. **Fisioterapeuta** clic en "Iniciar Sesión VR"
4. La configuración se guarda en Firestore `sesion_activa/current` con `game_id: "vault_escape"`
5. **Paciente** con Meta Quest abre `https://tfg-vr.web.app/games/vault_escape/`
6. `vr_start.gd` detecta la sesión activa mediante polling
7. `_load_game_manager("vault_escape")` carga `vault_game_manager.gd`
8. Se muestra countdown 3...2...1...GO!
9. El juego Vault Escape comienza
10. Al terminar, los resultados se guardan en Firestore
11. Vuelve a sala de espera

---

## 📊 URLS FINALES DE LOS JUEGOS

Una vez desplegado en Firebase Hosting:

```
🎮 Gems:                https://tfg-vr.web.app/games/gems/
🔐 Vault Escape:        https://tfg-vr.web.app/games/vault_escape/
🎯 Urban Attention:     https://tfg-vr.web.app/games/urban_attention_quest/
📦 Luggage Handler:     https://tfg-vr.web.app/games/luggage_handler/
```

**IMPORTANTE**: Puedes crear un QR code para cada URL y pegarlo en la clínica para acceso rápido.

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de considerar que todo funciona:

- [ ] Los 4 juegos se exportan correctamente desde Godot
- [ ] Los 4 builds están en `builds/[game_name]/`
- [ ] Los 4 juegos se copian a `dist/games/[game_name]/`
- [ ] `firebase.json` tiene las rewrites y headers correctos
- [ ] `npm run build` ejecuta sin errores
- [ ] `firebase deploy` sube todo correctamente
- [ ] Cada URL de juego carga correctamente en el navegador
- [ ] La plataforma clínica puede iniciar sesiones para cada juego
- [ ] El sistema de polling detecta sesiones de cada juego
- [ ] Los resultados se guardan correctamente en Firestore
- [ ] El HUD muestra información correcta para cada juego

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema: "Error al cargar el juego"
- Verifica que los archivos `.wasm` y `.pck` están en la carpeta correcta
- Revisa los headers en `firebase.json`
- Verifica la consola del navegador para errores de CORS

### Problema: "El juego no detecta la sesión"
- Verifica que `game_id` en Firestore coincide con el esperado
- Revisa que el polling está activo en `vr_start.gd`
- Verifica la conexión a Firestore

### Problema: "Game manager no se carga"
- Verifica que el path en `_load_game_manager()` es correcto
- Asegúrate de que el script existe: `res://scenes/[name]_game_manager.gd`
- Revisa la consola de Godot para errores

---

## 📝 NOTAS ADICIONALES

- **Cada juego es independiente**: No interfieren entre sí
- **El sistema de polling es universal**: Funciona para todos los juegos
- **Los game managers son intercambiables**: Se cargan dinámicamente
- **Los resultados tienen estructura diferente**: Cada juego guarda métricas específicas

---

¡TODOS LOS JUEGOS LISTOS PARA PRODUCCIÓN! 🎉
