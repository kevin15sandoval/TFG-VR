# 🏛️ SISTEMA HUB WORLD - SALA DE ESPERA UNIVERSAL

## 🎯 ¿QUÉ ES EL HUB WORLD?

El **Hub World** es una **sala de espera VR universal** donde los pacientes esperan cómodamente hasta que el fisioterapeuta inicie la sesión desde la plataforma clínica.

### Ventajas

✅ **Una sola URL** para todos los juegos  
✅ **Experiencia unificada** para el paciente  
✅ **Ambiente agradable** mientras espera  
✅ **Carga automática** del juego correcto  
✅ **Sin confusión** sobre qué URL abrir  

---

## 🔄 CÓMO FUNCIONA

### Flujo Completo

```
1. Paciente se pone Meta Quest
   ↓
2. Abre navegador → https://tfg-vr.web.app/
   ↓
3. Entra al HUB WORLD (sala de espera bonita)
   ↓
   💬 "Esperando que el fisioterapeuta inicie la sesión..."
   ↓
4. Fisioterapeuta en la web clínica:
   - Selecciona paciente
   - Elige juego (Gems / Vault / City / Luggage)
   - Configura parámetros
   - Clic "Iniciar Sesión VR"
   ↓
5. Hub detecta la sesión (polling)
   ↓
   💬 "¡Sesión detectada! Cargando Laser Vault Escape..."
   ↓
6. Hub carga dinámicamente el juego correcto
   ↓
7. Paciente comienza a jugar
   ↓
8. Al terminar → Vuelve al Hub (sala de espera)
```

---

## 🎮 ARQUITECTURA DEL SISTEMA

### Antes (Sistema Anterior)

```
❌ 4 URLs diferentes (confusión)
   
   https://tfg-vr.web.app/games/gems/
   https://tfg-vr.web.app/games/vault_escape/
   https://tfg-vr.web.app/games/urban_attention_quest/
   https://tfg-vr.web.app/games/luggage_handler/
   
   Problema: ¿Cuál abrir? El paciente no sabe qué juego tocará hoy
```

### Ahora (Sistema con Hub)

```
✅ 1 SOLA URL (simple y claro)
   
   https://tfg-vr.web.app/
   
   Solución: Siempre abre esta URL. El sistema carga el juego automáticamente.
```

---

## 📁 ESTRUCTURA DE ARCHIVOS

### Nuevos Archivos

```
tfg/
├── HubWorld.tscn              ← Escena de la sala de espera (NUEVO)
├── hub_manager.gd             ← Script del Hub (NUEVO)
│
├── World.tscn                 ← Juego Gems
├── VaultWorld.tscn            ← Juego Vault
├── CityWorld.tscn             ← Juego City
├── LuggageWorld.tscn          ← Juego Luggage
│
└── project.godot              ← Modificado (Main Scene = HubWorld)
```

### Cambios en project.godot

```ini
[application]
run/main_scene="res://HubWorld.tscn"   ← Ahora apunta al Hub
```

---

## 🎨 CONTENIDO DEL HUB

### Elementos Visuales

1. **Ambiente agradable**
   - Iluminación suave
   - Niebla atmosférica
   - Colores relajantes (azul/gris)

2. **Tren decorativo**
   - Modelo 3D del tren sci-fi
   - Añade ambiente futurista

3. **Carteles informativos**
   - **Status**: "SALA DE ESPERA VR"
   - **Info**: "Esperando a que el fisioterapeuta inicie la sesión..."
   - **Game**: Se muestra cuando se detecta sesión ("⭐ Recolectar Gemas")

4. **Suelo**
   - Plataforma de 20x20 metros
   - Material con reflexión sutil

---

## 🔧 FUNCIONALIDAD TÉCNICA

### hub_manager.gd

**Responsabilidades**:

1. **Inicializar OpenXR**
   ```gdscript
   _init_openxr()  # Activa VR
   ```

2. **Configurar Firebase Manager**
   ```gdscript
   firebase_manager.start_polling()  # Polling automático
   ```

3. **Detectar nueva sesión**
   ```gdscript
   _on_new_session_detected(config)
   ```

4. **Cargar juego dinámicamente**
   ```gdscript
   _load_game(game_id, config)
   ```

5. **Aplicar configuración**
   ```gdscript
   GameManager.apply_config(config)
   ```

### Mapeo de Juegos

```gdscript
const GAME_SCENES = {
	"gems": "res://World.tscn",
	"vault_escape": "res://VaultWorld.tscn",
	"urban_attention_quest": "res://CityWorld.tscn",
	"luggage_handler": "res://LuggageWorld.tscn"
}
```

---

## 🚀 EXPORTACIÓN Y DEPLOY

### Paso 1: Exportar Hub World

Ahora solo necesitas **1 export** (el Hub):

1. Abre Godot
2. **Project → Export...**
3. Crea preset **"Hub - WebXR"**
   - Export Path: `builds/hub/index.html`
   - Main Scene: `res://HubWorld.tscn` (automático)
4. Clic **"Export Project"**

**IMPORTANTE**: Las escenas de juegos (World.tscn, VaultWorld.tscn, etc.) se incluyen automáticamente como recursos.

### Paso 2: Deploy

```bash
cd Plataforma_Clinica

# Copiar build del Hub
xcopy /E /I ..\builds\hub\* dist\

# Build de plataforma
npm run build

# Deploy
firebase deploy
```

---

## 🌐 URL FINAL

Después del deploy:

```
https://tfg-vr.web.app/
```

**Eso es todo.** Una sola URL, todos los juegos.

---

## 📊 FLUJO DE DATOS

```
Firestore: sesion_activa/current
{
  game_id: "vault_escape",
  patient_id: "1",
  patient_name: "Carmen",
  duration: 180,
  difficulty: "Media",
  ...
}
        ↓ (Polling cada 3 segundos)
HubWorld detecta cambio
        ↓
Lee game_id: "vault_escape"
        ↓
Carga VaultWorld.tscn dinámicamente
        ↓
Aplica configuración (duración, dificultad, etc.)
        ↓
¡Juego comienza!
```

---

## 🎯 VENTAJAS DEL SISTEMA HUB

### Para el Paciente

✅ **Simple**: Solo una URL que recordar  
✅ **Cómodo**: Espera en ambiente agradable  
✅ **Claro**: Sabe cuándo va a empezar  
✅ **Automático**: No necesita hacer nada  

### Para el Fisioterapeuta

✅ **Flexible**: Elige cualquier juego desde la web  
✅ **Control**: Inicia cuando el paciente está listo  
✅ **Datos**: Ve métricas en tiempo real  

### Para el Desarrollador

✅ **Mantenible**: Un solo punto de entrada  
✅ **Escalable**: Fácil añadir nuevos juegos  
✅ **Modular**: Juegos independientes  
✅ **DRY**: No duplicar código  

---

## 🔄 CICLO DE VIDA COMPLETO

```
┌─────────────────────────────────────────┐
│         PACIENTE ENTRA AL HUB           │
│    (https://tfg-vr.web.app/)           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      SALA DE ESPERA (Hub World)         │
│  • Ambiente agradable                   │
│  • Polling activo                       │
│  • Esperando sesión...                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│    FISIOTERAPEUTA INICIA SESIÓN         │
│  • Selecciona juego                     │
│  • Configura parámetros                 │
│  • Guarda en Firestore                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      HUB DETECTA SESIÓN (3s)            │
│  • Lee game_id                          │
│  • Muestra mensaje: "¡Sesión detectada!│
│  • Countdown: 3...2...1                 │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│       CARGA JUEGO DINÁMICAMENTE         │
│  • load("res://VaultWorld.tscn")       │
│  • Aplica configuración                 │
│  • Oculta Hub                           │
│  • Muestra juego                        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│        PACIENTE JUEGA                   │
│  • Vault Escape / Gems / City / Luggage│
│  • Duración configurada                 │
│  • Dificultad aplicada                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         SESIÓN TERMINA                  │
│  • Resultados guardados                 │
│  • Libera recursos del juego            │
│  • Vuelve al Hub                        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      VUELVE A SALA DE ESPERA            │
│  • Reactivar polling                    │
│  • Listo para siguiente sesión          │
└─────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Archivos Creados

- [✅] `HubWorld.tscn` - Escena del Hub
- [✅] `hub_manager.gd` - Script del Hub
- [✅] `HUB_WORLD_SISTEMA.md` - Esta documentación

### Archivos Modificados

- [✅] `project.godot` - Main scene apunta a HubWorld

### Próximos Pasos

- [ ] Exportar HubWorld desde Godot
- [ ] Deploy a Firebase
- [ ] Probar flujo completo
- [ ] Verificar carga de cada juego

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema: "Hub no carga juegos"
**Solución**: Verifica que las rutas en `GAME_SCENES` son correctas:
```gdscript
"gems": "res://World.tscn",  // ← Debe existir
```

### Problema: "Juego no recibe configuración"
**Solución**: GameManager debe estar como autoload en project.godot

### Problema: "No vuelve al Hub después del juego"
**Solución**: Implementar lógica de retorno en cada game manager

---

## 🎉 RESULTADO FINAL

**ANTES**: 4 URLs, confusión, manual

**AHORA**: 1 URL, automático, elegante

```
https://tfg-vr.web.app/
```

**Una URL para gobernarlas a todas** 💍

---

¡SISTEMA HUB COMPLETO! 🏛️✨
