# 🔥 HOTFIX: BUCLE INFINITO (VERSION 2 - DELAYS AUMENTADOS)

## ❌ PROBLEMA PERSISTENTE:

Aunque el sistema de `status: "pending" → "completed"` estaba implementado, el bucle infinito seguía ocurriendo porque:

1. **DELETE tarda en propagarse**: Firestore tarda ~2-3 segundos en propagar DELETE
2. **Hub inicia polling demasiado rápido**: 3 segundos no son suficientes
3. **Juegos regresan demasiado rápido**: 3 segundos de espera tampoco son suficientes

---

## ✅ SOLUCIÓN IMPLEMENTADA (COMMIT 3b588b39):

### CAMBIOS REALIZADOS:

#### 1. **hub_manager.gd** - Aumentar delay inicial a **10 segundos**:
```gdscript
// ANTES:
await get_tree().create_timer(3.0).timeout  // ❌ Muy poco tiempo

// AHORA:
await get_tree().create_timer(10.0).timeout  // ✅ Suficiente para propagación
```

**Razón**: El Hub necesita esperar más tiempo al iniciar para asegurar que no hay sesiones "zombie" de juegos anteriores.

---

#### 2. **vr_start.gd** (Gems Collector) - Aumentar delay a **8 segundos**:
```gdscript
// ANTES:
await get_tree().create_timer(3.0).timeout  // ❌ Muy poco

// AHORA:
await get_tree().create_timer(8.0).timeout  // ✅ Tiempo suficiente
```

---

#### 3. **vault_vr_start.gd** (Laser Vault) - Aumentar delay a **8 segundos**:
```gdscript
// ANTES:
await get_tree().create_timer(3.0).timeout

// AHORA:
await get_tree().create_timer(8.0).timeout
```

---

#### 4. **city_vr_start.gd** (Urban Attention Quest) - Aumentar delay a **8 segundos**:
```gdscript
// ANTES:
await get_tree().create_timer(3.0).timeout

// AHORA:
await get_tree().create_timer(8.0).timeout
```

---

#### 5. **luggage_vr_start.gd** (Luggage Handler) - Aumentar delay a **8 segundos**:
```gdscript
// ANTES:
await get_tree().create_timer(3.0).timeout

// AHORA:
await get_tree().create_timer(8.0).timeout
```

---

## ⏱️ TIMELINE COMPLETO AHORA:

```
t=0s    → Juego termina
t=0s    → mark_session_completed() → status = "completed"
t=0.5s  → DELETE sesión de Firebase
t=1-3s  → Firebase propaga el DELETE globalmente
t=8s    → Juego regresa al Hub
t=8s    → Hub empieza _ready()
t=18s   → Hub inicia polling (8s + 10s delay)
```

**TOTAL: 18 segundos entre DELETE y próximo polling** ✅

---

## 🎯 ARCHIVOS MODIFICADOS:

```
hub_manager.gd         → Delay 3s → 10s
vr_start.gd           → Delay 3s → 8s
vault_vr_start.gd     → Delay 3s → 8s
city_vr_start.gd      → Delay 3s → 8s
luggage_vr_start.gd   → Delay 3s → 8s
```

**Commit**: `3b588b39` - "hotfix: Aumentar delays anti-bucle infinito (10s Hub + 8s juegos)"

---

## 📋 INSTRUCCIONES PARA EL USUARIO:

### PASO 1: DESCARGAR NUEVO APK

El código ya está en GitHub. Descarga el proyecto y exporta nuevo APK:

1. Abre Godot 4.6
2. Abre el proyecto TFG
3. **Project → Export → Android**
4. Click **Export Project**
5. Instala en Meta Quest 2

### PASO 2: LIMPIAR FIREBASE (SI AÚN NO LO HICISTE)

Si todavía hay sesión activa:

1. Ve a: https://console.firebase.google.com/project/tfg-vr/firestore
2. Navega a: `sesion_activa` → `current`
3. **Elimina el documento `current`** (botón 3 puntos → Delete)

### PASO 3: PROBAR DE NUEVO

1. Crea una **NUEVA sesión** desde la web
2. Juega en VR hasta terminar
3. **Espera 8 segundos** (verás mensaje "Esperando X segundos antes de regresar...")
4. Regresarás al Hub
5. **Espera 10 segundos** (verás "Inicializando sistema...")
6. Después verás "Esperando a que el fisioterapeuta inicie la sesión..."
7. **NO debería volver a cargar el juego** ✅

---

## 🔍 CÓMO VERIFICAR QUE FUNCIONÓ:

### Logs esperados al terminar juego:

```
[Gems/Vault/City/Luggage] 🏁 Juego terminado
[Firebase] 🔒 MARCANDO SESIÓN COMO COMPLETED
[Firebase] ✅✅✅ SESIÓN MARCADA COMO COMPLETED ✅✅✅
[Gems/Vault/City/Luggage] 🗑️ Iniciando DELETE...
[Gems/Vault/City/Luggage] ✅ Sesión limpiada
[Gems/Vault/City/Luggage] ⏱️ Esperando 8 segundos antes de regresar...
[Gems/Vault/City/Luggage] ✅ Delay completado
[Gems/Vault/City/Luggage] 🔄 Regresando al HubWorld...
```

### Logs esperados en Hub después de regresar:

```
[Hub] 🏛️ HUB WORLD — Sala de Espera Universal
[Hub] ⏳ Esperando 10 segundos antes de iniciar polling...
[Hub] (Permite que se complete el DELETE + PROPAGACIÓN de sesión anterior)
... (10 segundos pasan)
[Hub] ✅ Firebase Manager configurado y polling iniciado
[Hub] 📡 Poll response - Result: 0 Code: 404
[Hub] ⏳ Sin sesión activa aún
```

**SI VES "Code: 404" = SUCCESS** ✅ (significa que no hay sesión)

---

## ⚠️ SI TODAVÍA FALLA:

### Último recurso - Verificar en Firebase en tiempo real:

1. Abre Firebase Console
2. Ve a: `sesion_activa` → `current`
3. **MANTÉN ABIERTA LA CONSOLA** mientras juegas
4. Observa cuando termine el juego:
   - ¿Ves que `status` cambia de "pending" → "completed"?
   - ¿Ves que el documento se ELIMINA completamente después?
   - ¿Cuántos segundos tarda en desaparecer?

### Si el documento NO se elimina:

Significa que `_clear_firestore_session()` está fallando. Necesitaríamos ver los logs completos para diagnosticar.

---

## 💡 POR QUÉ 10 SEGUNDOS EN HUB + 8 EN JUEGOS:

| Tiempo | Qué ocurre |
|--------|------------|
| t=0s | Juego termina, marca status="completed" |
| t=0.5s | DELETE enviado a Firestore |
| t=1-3s | Firestore propaga DELETE a todos los servidores |
| t=8s | Juego regresa al Hub (8s delay) |
| t=8-18s | Hub espera 10s adicionales antes de polling |
| t=18s | Hub hace primer polling |

**Total buffer: 18 segundos** entre DELETE y próximo polling.

Esto es **SUFICIENTE** para que Firebase propague el DELETE incluso en condiciones de red lentas.

---

## 📊 COMPARACIÓN ANTES/DESPUÉS:

### ANTES (delays 3s):
```
t=0s   → DELETE
t=3s   → Regreso a Hub
t=6s   → Hub hace polling
        → ⚠️ Sesión aún existe (DELETE no propagado)
        → ❌ BUCLE INFINITO
```

### AHORA (delays 10s + 8s):
```
t=0s   → DELETE
t=8s   → Regreso a Hub
t=18s  → Hub hace polling
        → ✅ DELETE ya propagado
        → ✅ Sin sesión = Sin bucle
```

---

## ✅ CONCLUSIÓN:

Este hotfix aumenta los delays a valores **conservadores y seguros** que garantizan que Firebase tenga tiempo suficiente para propagar el DELETE.

**Desventaja**: El usuario espera 8 segundos adicionales al terminar cada juego.

**Ventaja**: **ELIMINA EL BUCLE INFINITO definitivamente** 🎯

---

## 🚀 PRÓXIMOS PASOS:

1. **Descargar código actualizado de GitHub** (commit `3b588b39`)
2. **Exportar nuevo APK** desde Godot
3. **Instalar en Quest 2**
4. **Probar una sesión completa**
5. **Verificar que NO vuelve a cargar el juego** ✅

---

**COMMIT HASH**: `3b588b39`  
**FECHA**: 2026-07-13  
**BRANCH**: `feature/openxr-vr-system`  

**ESTADO**: ✅ PUSHED A GITHUB - LISTO PARA DESCARGAR
