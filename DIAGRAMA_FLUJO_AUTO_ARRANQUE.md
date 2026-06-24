# 🔄 Diagrama de Flujo: Sistema Auto-Arranque VR

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE AUTO-ARRANQUE VR                               │
│                     NeuroVR Rehab - TFG 2026                                 │
└─────────────────────────────────────────────────────────────────────────────┘


┏━━━━━━━━━━━━━━━━━━━┓                              ┏━━━━━━━━━━━━━━━━━━━┓
┃   META QUEST 3    ┃                              ┃  PLATAFORMA WEB   ┃
┃   (Paciente)      ┃                              ┃  (Fisioterapeuta) ┃
┗━━━━━━━━━━━━━━━━━━━┛                              ┗━━━━━━━━━━━━━━━━━━━┛
         │                                                    │
         │ 1. Abre app                                       │
         │    NeuroVR Rehab                                  │
         ▼                                                    │
    ┌─────────┐                                              │
    │ _ready()│                                              │
    └────┬────┘                                              │
         │                                                    │
         ▼                                                    │
┌─────────────────────┐                                      │
│ 🏥 SALA DE ESPERA   │                                      │
│ Modo Polling ON     │                                      │
│ Revisa cada 3s      │                                      │
└──────────┬──────────┘                                      │
           │                                                  │
           │ Polling...                                      │
           ▼                    ┌──────────────┐            │
    ╔══════════════╗            │  FIRESTORE   │            │
    ║ GET REQUEST  ║───────────▶│              │            │
    ║ cada 3s      ║            │ sesion_activa│            │
    ╚══════╤═══════╝            │  /current    │            │
           │                    └──────────────┘            │
           │ Sin sesión                  ▲                   │
           │ (404/empty)                 │                   │
           └─────────────────────────────┘                   │
           │                                                  │
           │                                                  │
           │ Sigue esperando...                             │
           │                                     2. Fisio    │
           │                                     selecciona  │
           │                                     paciente    │
           │                                                  ▼
           │                                      ┌─────────────────┐
           │                                      │ Iniciar Sesión  │
           │                                      │ - Juego: Gemas  │
           │                                      │ - Duración: 5min│
           │                                      │ - Dificultad    │
           │                                      │ - Lado afectado │
           │                                      └────────┬────────┘
           │                                               │
           │                                               │ 3. Click
           │                                               │ "Enviar"
           │                    ┌──────────────┐          │
           │                    │  FIRESTORE   │          │
           │                    │              │◀─────────┘
           │                    │ sesion_activa│ setDoc()
           │                    │  /current    │ {
           │                    │              │   sessionId: "123"
           │                    │  ✍️ ESCRITO  │   patientId: "..."
           │                    └──────────────┘   gameId: "gems"
           │                            │           duration: 300
           │                            │           ...
           ▼                            │         }
    ╔══════════════╗                   │
    ║ GET REQUEST  ║───────────────────┘
    ║ (polling)    ║                   
    ╚══════╤═══════╝                   
           │                            
           │ 📥 Detecta nueva sesión!  
           │ (sessionId diferente)     
           ▼                            
┌─────────────────────────┐            
│ new_session_detected()  │            
│                         │            
│ 1. Stop polling         │            
│ 2. Hide waiting UI      │            
│ 3. Load config          │            
└───────────┬─────────────┘            
            │                           
            │ 4. AUTO-START!            
            ▼                           
    ┌──────────────┐                   
    │ GameManager  │                   
    │ .start()     │                   
    └──────┬───────┘                   
           │                            
           ▼                            
┏━━━━━━━━━━━━━━━━━┓                    
┃  🎮 JUGANDO     ┃                    
┃                 ┃                    
┃  - Spawn gemas  ┃                    
┃  - Registrar    ┃                    
┃    movimientos  ┃                    
┃  - Timer activo ┃                    
┃  - Métricas     ┃                    
┗━━━━━━━━┯━━━━━━━━┛                    
         │                              
         │ Timer = 0 o                 
         │ objetivo cumplido           
         ▼                              
┌────────────────────┐                 
│ session_finished() │                 
│                    │                 
│ Calcular:          │                 
│ - Score            │                 
│ - Accuracy         │                 
│ - Movimientos      │                 
│ - Zonas trabajadas │                 
└─────────┬──────────┘                 
          │                             
          │ save_results()             
          ▼                ┌──────────────┐
    ╔═══════════╗         │  FIRESTORE   │
    ║ POST      ║────────▶│              │
    ║ /sesiones ║         │   sesiones   │
    ╚═══════════╝         │  /{newId}    │
                          │              │
                          │  fromVR: true│
                          └──────┬───────┘
                                 │
                                 │ Real-time
                                 │ snapshot
                                 ▼
                        ┏━━━━━━━━━━━━━━━━━┓
                        ┃  PLATAFORMA WEB  ┃
                        ┃                  ┃
                        ┃ subscribeSessions┃
                        ┃ detecta nueva    ┃
                        ┃ sesión fromVR    ┃
                        ┗━━━━━━━┯━━━━━━━━━━┛
                                │
                                │ clearActiveSession()
                                ▼
                          ┌──────────────┐
                          │  FIRESTORE   │
                          │              │
                          │ sesion_activa│
                          │  /current    │
                          │              │
                          │  🗑️ ELIMINADO │
                          └──────────────┘

          │
          │ Mostrar mensaje:
          │ ✅ COMPLETADA
          ▼
┌──────────────────┐
│ Esperar 5s       │
└─────────┬────────┘
          │
          │ 5. CICLO COMPLETO
          ▼
┌─────────────────────┐
│ 🏥 SALA DE ESPERA   │
│ Polling ON again    │
│ Listo para siguiente│
└─────────────────────┘
          │
          └──────────┐
                     │
                     ▼
              (repetir desde
               el principio)


═══════════════════════════════════════════════════════════════════════════

                              ⏱️ TIMELINE

  0s ──┬─────────────────────┬──────────────┬──────────┬───────────────────
       │                     │              │          │
   VR  │ Sala espera        │ AUTO-START   │ Jugando  │ Finaliza + Volver
       │ (polling 3s)        │ (1.5s)       │ (5 min)  │ espera (5s)
       │                     │              │          │
  Web  │ Fisio config       │              │          │ Detecta fin
       │ + Click enviar     │              │          │ + Limpia config
       │                     │              │          │
═══════════════════════════════════════════════════════════════════════════


🔑 COMPONENTES CLAVE:

┌─────────────────────────────────────────────────────────────────┐
│ FIRESTORE - sesion_activa/current                               │
├─────────────────────────────────────────────────────────────────┤
│ Función: Canal de comunicación web → VR                         │
│ Escritura: Web cuando fisio pulsa "Enviar sesión"               │
│ Lectura: VR polling cada 3s                                     │
│ Eliminación: Web cuando detecta sesión terminada                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FIRESTORE - sesiones/{id}                                       │
├─────────────────────────────────────────────────────────────────┤
│ Función: Almacenamiento permanente de resultados                │
│ Escritura: VR cuando sesión termina                             │
│ Lectura: Web en tiempo real (onSnapshot)                        │
│ Campo clave: fromVR: true (para auto-limpieza)                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ firebase_manager.gd - Sistema de Polling                        │
├─────────────────────────────────────────────────────────────────┤
│ _process(delta):                                                │
│   └─ Cada 3s: _poll_for_new_session()                          │
│       └─ GET sesion_activa/current                             │
│           └─ Compara sessionId                                  │
│               └─ Si nuevo: emit new_session_detected()         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ vr_start.gd - Orquestador Principal                             │
├─────────────────────────────────────────────────────────────────┤
│ _ready():                                                       │
│   └─ start_polling()                                            │
│   └─ _show_waiting_message()                                   │
│                                                                  │
│ _on_new_session_detected(config):                              │
│   └─ stop_polling()                                             │
│   └─ _hide_waiting_ui()                                         │
│   └─ GameManager.apply_config(config)                          │
│   └─ GameManager.start_session() ← AUTO-START                  │
│                                                                  │
│ _on_session_finished(results):                                 │
│   └─ save_results()                                             │
│   └─ wait 5s                                                    │
│   └─ start_polling() again ← CICLO                             │
└─────────────────────────────────────────────────────────────────┘


✨ CARACTERÍSTICAS:

✅ Cero intervención manual del paciente
✅ Control total desde la web
✅ Feedback visual en VR en todo momento
✅ Ciclo automático infinito (múltiples pacientes)
✅ Resistente a fallos de red (sigue polling)
✅ Auto-limpieza de configs antiguas


📊 MÉTRICAS DEL SISTEMA:

- Polling interval: 3 segundos
- Latencia típica detección: 0-3 segundos
- Tiempo auto-start: 1.5 segundos (countdown visual)
- Tiempo post-sesión: 5 segundos (mostrar resultados)
- Ventana de auto-limpieza: 10 segundos (nuevas sesiones VR)


🧪 TESTING:

1. Abrir Meta Quest 3 con app
2. Verificar mensaje "SALA DE ESPERA"
3. En web: Iniciar sesión para un paciente
4. Verificar que juego arranca en <5 segundos
5. Jugar hasta timer = 0
6. Verificar mensaje "COMPLETADA"
7. Verificar que vuelve a sala de espera
8. Verificar que web muestra nueva sesión


⚠️ TROUBLESHOOTING:

Problema: VR no arranca automáticamente
- ✓ Verificar que app está abierta en Quest
- ✓ Verificar internet en Quest (WiFi)
- ✓ Check logs Godot: "[Firebase] 🎮 Nueva sesión detectada"
- ✓ Verificar sesion_activa/current existe en Firestore

Problema: Sesión se relanza múltiples veces
- ✓ Verificar que web limpia sesion_activa después
- ✓ Check timestamp de última sesión (debe ser < 10s)
- ✓ Verificar campo fromVR: true en sesión guardada

Problema: Polling no funciona
- ✓ Check logs: "[Firebase] Iniciando polling cada 3.0s"
- ✓ Verificar _polling_enabled = true
- ✓ Test manual: publishActiveSession desde web


═══════════════════════════════════════════════════════════════════════════

Desarrollado por: Kevin Sandoval
Proyecto: TFG NeuroVR Rehab
Fecha: Junio 2026
Tecnologías: Godot 4.3 + Firebase + React + TypeScript
```
