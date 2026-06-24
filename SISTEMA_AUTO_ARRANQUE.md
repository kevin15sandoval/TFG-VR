# 🎮 Sistema de Auto-Arranque VR

## 📋 Descripción General

Sistema de comunicación en tiempo real entre la plataforma web del fisioterapeuta y el juego VR en Meta Quest 3. Permite que el juego arranque automáticamente cuando el fisioterapeuta inicia una sesión desde la web.

## 🔄 Flujo Completo

### 1️⃣ Estado Inicial: Sala de Espera VR
- El paciente se pone las Meta Quest 3
- Abre la app **NeuroVR Rehab**
- El juego entra en **modo sala de espera** automáticamente
- Muestra mensaje: *"🏥 SALA DE ESPERA - El fisioterapeuta iniciará tu sesión en breve..."*
- **Polling activo**: Revisa Firestore cada 3 segundos buscando nueva sesión

### 2️⃣ Fisioterapeuta Inicia Sesión desde Web
1. Fisio navega a perfil del paciente
2. Click en **"Iniciar sesión"**
3. Selecciona juego, duración, dificultad, lado afectado
4. Click en **"Enviar sesión a las gafas"**
5. La web escribe la configuración en `sesion_activa/current` en Firestore

### 3️⃣ Auto-Detección y Arranque VR
1. El polling del juego VR detecta la nueva sesión (compara `sessionId`)
2. **Automáticamente**:
   - Detiene el polling
   - Oculta UI de sala de espera
   - Carga la configuración de la sesión
   - Muestra mensaje: *"¡SESIÓN ACTIVA!"* (2 segundos)
   - **Arranca el juego automáticamente** con la config recibida

### 4️⃣ Durante la Sesión
- El paciente juega normalmente
- GameManager registra todos los movimientos, gemas, métricas
- Timer cuenta regresiva según duración configurada

### 5️⃣ Finalización Automática
1. Cuando el timer llega a 0 (o el paciente completa el objetivo):
   - GameManager genera los resultados con todas las métricas
   - FirebaseManager guarda resultados en colección `sesiones`
   - Marca `fromVR: true` para identificar sesión desde VR
   
2. El juego VR muestra:
   - *"✅ ¡SESIÓN COMPLETADA!"*
   - *"Puntuación: XXX pts"*
   - Espera 5 segundos

3. **Auto-retorno a sala de espera**:
   - Vuelve a mostrar mensaje de espera
   - Reactiva el polling
   - Listo para la siguiente sesión

### 6️⃣ Web Detecta Finalización
- La web está suscrita en tiempo real a `sesiones`
- Cuando detecta nueva sesión con `fromVR: true` (< 10 segundos):
  - **Automáticamente limpia** `sesion_activa/current`
  - Previene que el juego intente relanzar la misma sesión
  - Actualiza la lista de sesiones del paciente en tiempo real

## 🔧 Componentes Técnicos

### Firebase Manager (Godot)
**Archivo**: `scripts/firebase_manager.gd`

**Nuevas funcionalidades**:
```gdscript
# Variables de polling
var _polling_enabled := false
var _poll_interval := 3.0  # segundos
var _last_session_id := ""  # para detectar nuevas

# Funciones principales
func start_polling()  # Activa revisión periódica
func stop_polling()   # Detiene revisión
func _poll_for_new_session()  # Revisa Firestore
func _on_poll_response()  # Procesa respuesta

# Nueva señal
signal new_session_detected(config: Dictionary)
```

### VR Start (Godot)
**Archivo**: `vr_start.gd`

**Flujo nuevo**:
```gdscript
func _ready():
    _create_waiting_ui()  # Labels 3D
    firebase_manager.start_polling()  # Activar espera
    _show_waiting_message()

func _on_new_session_detected(config):
    firebase_manager.stop_polling()
    _hide_waiting_ui()
    GameManager.apply_config(config)
    GameManager.start_session()  # AUTO-START

func _on_session_finished(results):
    firebase_manager.save_results(results)
    # Espera 5s y vuelve a sala de espera
    firebase_manager.start_polling()
```

### Database Layer (Web)
**Archivo**: `Plataforma_Clinica/app/db.ts`

**Funciones clave**:
```typescript
// Escribe config que el juego leerá
export async function publishActiveSession(
  config, patient, sessionId
)

// Limpia config cuando termina
export async function clearActiveSession()

// Suscripción con auto-limpieza
export function subscribeSessions(cb) {
  // Detecta nueva sesión fromVR
  // Auto-limpia sesion_activa
}
```

## 📊 Colecciones Firestore

### `sesion_activa` (colección)
**Documento**: `current`

**Estructura**:
```javascript
{
  patientId: "abc123",
  patientName: "Juan Pérez",
  sessionId: "session_1719234567890",
  duration: 300,  // segundos
  difficulty: "Media",
  therapySide: "Izquierdo",
  sessionType: "Alcance",
  gameId: "gems",
  publishedAt: Timestamp
}
```

**Ciclo de vida**:
- ✍️ Creado: Cuando fisio pulsa "Enviar sesión"
- 👁️ Leído: Por polling del juego VR cada 3s
- 🗑️ Eliminado: Cuando web detecta que sesión terminó (fromVR: true)

### `sesiones` (colección)
**Estructura**: Ver `SessionRecord` en `types.ts`

**Campo clave**: `fromVR: boolean`
- `true`: Sesión creada por el juego VR al terminar
- `false`: Sesión manual creada por el fisio

## 🎯 Ventajas del Sistema

✅ **Cero intervención manual**: Paciente solo se pone las gafas  
✅ **Fisio controla todo**: Configuración centralizada desde web  
✅ **Sincronización automática**: Detección en tiempo real  
✅ **Resistente a fallos**: Si no hay red, usa config por defecto  
✅ **Ciclo continuo**: Vuelve automáticamente a espera  
✅ **Feedback visual**: Paciente ve estado en todo momento  

## 🧪 Modos de Prueba

### Modo Debug (sin web)
Si el juego arranca en `OS.is_debug_build()` y no hay config:
```gdscript
# Usa valores por defecto
patient_id: "test"
duration: 180
difficulty: "Media"
```

### Modo Producción
Requiere que la app web publique la sesión primero.

## 🔍 Logs de Depuración

**VR (Godot)**:
```
[Firebase] Iniciando polling cada 3.0s
[VR] 🏥 Entrando en sala de espera...
[VR] 👀 Esperando que el fisioterapeuta inicie sesión...
[Firebase] 🎮 Nueva sesión detectada: session_1719234567890
[VR] 🎮 ¡Nueva sesión detectada! Iniciando automáticamente...
[GameManager] ▶ Sesión iniciada | Media | Izquierdo
[VR] 🏁 Sesión terminada — Puntos: 2450
[Firebase] ✅ Resultados guardados
[VR] 🔄 Volviendo a sala de espera...
```

**Web (Navegador)**:
```
[DB] Nueva sesión VR detectada, limpiando sesión activa...
```

## 🚀 Próximos Pasos (Opcional)

1. **Sistema de códigos de vinculación** (4 caracteres)
   - Para emparejar headset específico con fisio
   - Ya preparado en `createDeviceLink`, `subscribeDeviceLink`

2. **Notificaciones push**
   - Avisar al fisio cuando sesión termina
   - Firebase Cloud Messaging

3. **Streaming de métricas en vivo**
   - Ver puntuación en tiempo real desde web
   - Actualizar Firestore cada X segundos durante sesión

4. **Multi-juego**
   - Extender a todos los minijuegos
   - Selector dinámico según `gameId`

---

**Desarrollado para**: TFG NeuroVR Rehab  
**Tecnologías**: Godot 4.3, Firebase Firestore, React + TypeScript  
**Última actualización**: 2026-06-24
