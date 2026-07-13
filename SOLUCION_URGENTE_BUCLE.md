# 🔥 SOLUCIÓN URGENTE: BUCLE INFINITO PERSISTE

## ❌ PROBLEMA:

La sesión actual en Firebase **NO tiene el campo `status`** porque fue creada ANTES de que el código estuviera actualizado.

El Hub lee la sesión así:
```gdscript
var status = _get_string(fields, "status", "pending")  
// Si no existe el campo, devuelve "pending" por defecto
```

Por eso sigue detectándola como "pending" aunque ya terminó.

---

## ✅ SOLUCIÓN (3 PASOS):

### PASO 1: ELIMINAR SESIÓN ACTUAL EN FIREBASE (MANUAL)

1. Abre Firebase Console:
   ```
   https://console.firebase.google.com/project/tfg-vr/firestore
   ```

2. Navega a:
   ```
   Firestore Database → sesion_activa → current
   ```

3. Haz clic en los **3 puntos** (...) al lado del documento `current`

4. Selecciona **"Delete document"**

5. Confirma la eliminación

**ESTO ES CRÍTICO** ✅

---

### PASO 2: VERIFICAR QUE LA WEB ESTÉ DESPLEGADA CON `status`

La web en `https://tfg-vr.web.app` ya debe tener el código nuevo con `status: "pending"`.

Para verificar, en tu navegador abre:
```
https://tfg-vr.web.app
```

Y crea una nueva sesión. Esta SÍ tendrá el campo `status`.

---

### PASO 3: PROBAR DE NUEVO

1. **Asegúrate de que Firebase NO tiene sesión activa** (después del PASO 1)
2. En la web, crea una **NUEVA sesión**
3. Inicia el juego en VR
4. Termina el juego normalmente
5. **DEBE regresar al Hub sin bucle** ✅

---

## 🔍 CÓMO VERIFICAR QUE FUNCIONÓ:

Después de terminar el juego, en VR deberías ver en los logs:

```
[VR/Vault/City/Luggage] 🔒 Paso 1/2: Marcar sesión como completed...
[Firebase] 🔒 MARCANDO SESIÓN COMO COMPLETED
[Firebase] ✅✅✅ SESIÓN MARCADA COMO COMPLETED ✅✅✅
[VR/Vault/City/Luggage] 🗑️ Paso 2/2: Eliminar sesión...
[VR/Vault/City/Luggage] ✅ Sesión limpiada completamente (completed + deleted)
[VR/Vault/City/Luggage] 🔄 Regresando al HubWorld...
```

Y en el Hub, cuando vuelvas, deberías ver:
```
[Hub] 📡 Poll response - Result: 0 Code: 200
[Hub] 🔍 Status de sesión: 'completed'
[Hub] ⏭️ Sesión NO está pending (status='completed'), ignorando
```

O directamente:
```
[Hub] 📡 Poll response - Result: 0 Code: 404
[Hub] ⏳ Sin sesión activa aún
```

---

## ⚠️ SI SIGUE FALLANDO:

### Opción A: Verificar en Firebase Console en TIEMPO REAL

1. Abre Firebase Console
2. Ve a Firestore → `sesion_activa` → `current`
3. **MIENTRAS el juego está corriendo**, mira el documento
4. Cuando termine el juego, deberías ver:
   - Primero: `status` cambia de "pending" → "completed"
   - Después (0.5s): El documento se ELIMINA completamente

### Opción B: Verificar logs en Android Logcat

Si tienes el Quest conectado por USB, ejecuta:
```bash
adb logcat | grep -i "Firebase\|Hub\|Session"
```

Para ver TODOS los logs de Firebase y detectar el error exacto.

### Opción C: Añadir logging extremo temporal

Si nada funciona, puedo añadir MUCHÍSIMO más logging para diagnosticar exactamente dónde falla.

---

## 🎯 RESUMEN DE 1 MINUTO:

1. **ELIMINA** manualmente `sesion_activa/current` en Firebase Console
2. **CREA** nueva sesión desde la web (tendrá `status: "pending"`)
3. **PRUEBA** el juego de nuevo
4. Debería funcionar ✅

---

## 🔥 SI TIENES PRISA Y NO PUEDES ESPERAR:

### Solución temporal BRUTAL (solo para emergencia):

Modifica `hub_manager.gd` para ignorar TODAS las sesiones durante 10 segundos después de regresar de un juego:

```gdscript
var _just_returned_from_game := false
var _cooldown_timer := 0.0

func _process(delta):
    if _just_returned_from_game:
        _cooldown_timer += delta
        if _cooldown_timer >= 10.0:
            _just_returned_from_game = false
            _cooldown_timer = 0.0

func _on_poll_response(...):
    # AL INICIO de la función, añade:
    if _just_returned_from_game:
        print("[Hub] ❄️ En cooldown, ignorando polling")
        return
    
    # ... resto del código normal

# Y cuando regreses al Hub desde un juego:
func _ready():
    _just_returned_from_game = true
```

Pero esta es una **CHAPUZA TEMPORAL**. La solución real es eliminar la sesión vieja de Firebase.

---

**¿ELIMINASTE YA LA SESIÓN DE FIREBASE CONSOLE?** 🔥
