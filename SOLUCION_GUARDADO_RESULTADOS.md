# 🔧 SOLUCIÓN: Problemas con guardado de resultados VR → Web

## 📋 RESUMEN DEL PROBLEMA

**Síntomas reportados:**
- Los juegos VR no terminan correctamente
- Se quedan en bucle infinito
- No guardan resultados en la plataforma web
- Vuelven al Hall y reinician el mismo juego automáticamente

## ✅ CÓDIGO REVISADO - TODO ESTÁ CORRECTO

He revisado todo el código de Godot VR y **el sistema de guardado está implementado correctamente**:

### 1. **firebase_manager.gd** ✅
- `save_results()` construye correctamente el JSON para Firestore
- Maneja todos los campos específicos de cada juego:
  - `_add_gems_fields()` - Recolectar Gemas
  - `_add_vault_fields()` - Laser Vault Escape  
  - `_add_city_fields()` - Urban Attention Quest
  - `_add_luggage_fields()` - Luggage Handler
- Envía POST a `/sesiones` en Firestore

### 2. **Flujo de cada juego** ✅

Todos los juegos siguen este flujo al terminar:

```gdscript
func _on_game_finished(results: Dictionary) -> void:
	print("🏁 Juego terminado")
	_hide_game_hud()
	
	# 1. GUARDAR RESULTADOS EN FIREBASE
	firebase_manager.save_results(results)
	
	# 2. MOSTRAR MENSAJE FINAL AL USUARIO
	if label_status:
		label_status.text = "✅ ¡SESIÓN COMPLETADA!"
	if label_info:
		label_info.text = "Score: X pts"
	
	# 3. LIMPIAR SESIÓN ACTIVA DE FIRESTORE
	await _clear_firestore_session()  # ⚠️ CRÍTICO
	
	# 4. DETENER POLLING
	firebase_manager.stop_polling()
	
	# 5. ESPERAR 3 SEGUNDOS
	await get_tree().create_timer(3.0).timeout
	
	# 6. REGRESAR AL HUBWORLD
	get_tree().change_scene_to_file("res://HubWorld.tscn")
```

### 3. **Función de limpieza** ✅

Todos los juegos implementan `_clear_firestore_session()`:

```gdscript
func _clear_firestore_session() -> void:
	var url = "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents/sesion_activa/current"
	var http = HTTPRequest.new()
	add_child(http)
	http.request(url, [], HTTPClient.METHOD_DELETE)
	await http.request_completed  # ESPERA a que termine
	http.queue_free()
```

## 🔍 POSIBLES CAUSAS DEL PROBLEMA

Si el código está correcto pero los juegos no terminan bien, puede ser por:

### **CAUSA 1: El timer nunca llega a 0** ⏱️

**Verificar:**
- ¿El HUD del timer se ve correctamente en VR?
- ¿La cuenta regresiva funciona?
- ¿Llega a 00:00 pero no termina el juego?

**Solución:**
Los game managers tienen esta lógica:

```gdscript
func _process(delta: float) -> void:
	if not game_active:
		return
	
	time_elapsed += delta
	var remaining = session_duration - time_elapsed
	emit_signal("timer_updated", remaining)
	
	if remaining <= 0:
		end_game()  # ⬅️ Debería llamar aquí
```

**Probar en Godot:**
1. Abrir `scenes/vault_game_manager.gd`, `city_game_manager.gd`, `luggage_game_manager.gd`
2. Buscar la función `_process(delta: float)`
3. Agregar prints para debug:

```gdscript
if remaining <= 0:
	print("[Manager] ⏰ TIEMPO AGOTADO - LLAMANDO END_GAME")
	end_game()
```

### **CAUSA 2: La sesión no se está limpiando de Firestore** 🗑️

**Verificar en Firebase Console:**
1. Ir a: https://console.firebase.google.com/project/tfg-vr/firestore
2. Navegar a la colección `sesion_activa`
3. ¿Hay un documento `current` después de terminar el juego?
4. Si SÍ existe → La limpieza no funciona
5. Si NO existe → La limpieza funciona

**Si no se limpia:**
El problema puede ser con las **reglas de seguridad de Firestore**.

**Verificar reglas:**
```javascript
// En Firebase Console → Firestore → Reglas
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir DELETE sin autenticación para sesion_activa
    match /sesion_activa/{document=**} {
      allow read, write, delete: if true;
    }
    
    match /sesiones/{document=**} {
      allow read, write, delete: if true;
    }
  }
}
```

### **CAUSA 3: El HubWorld reinicia automáticamente la sesión** 🔄

**Problema:**
Si `sesion_activa/current` NO se borró, cuando regresas al HubWorld, el polling lo detecta como "nueva sesión" y reinicia el juego.

**Solución:**
Asegurar que `_clear_firestore_session()` se complete ANTES de volver al Hub.

**Verificar en cada `*_vr_start.gd`:**

```gdscript
# ⚠️ CRÍTICO: ESPERAR con await
await _clear_firestore_session()  # ← Asegurar que tiene await
print("[VR] ✅ Sesión limpiada COMPLETAMENTE")

# Solo después de limpiar, volver al Hub
await get_tree().create_timer(3.0).timeout
get_tree().change_scene_to_file("res://HubWorld.tscn")
```

### **CAUSA 4: GameManager no resetea IDs** 🧹

**Verificar en `scripts/game_manager.gd`:**

La función `finish_session()` debería resetear:

```gdscript
func finish_session() -> void:
	# ... código de resultados ...
	
	emit_signal("session_finished", results)
	
	# ⭐ RESETEAR IDs para evitar auto-inicio
	patient_id = ""
	session_id = ""
	patient_name = ""
	print("[GameManager] ✅ IDs limpiados")
```

✅ **YA ESTÁ IMPLEMENTADO** (líneas 220-224 de game_manager.gd)

## 🧪 PRUEBAS PARA DIAGNOSTICAR

### Test 1: Verificar que el juego termine

1. Iniciar sesión desde la web (duración: 30 segundos)
2. Jugar en VR
3. Observar:
   - ¿El timer llega a 00:00?
   - ¿Aparece "✅ SESIÓN COMPLETADA!"?
   - ¿Espera 3 segundos?
   - ¿Regresa al Hall?

**Si NO llega a 00:00:** Problema con el timer en el game_manager
**Si llega pero no termina:** Problema con la lógica de `end_game()`

### Test 2: Verificar guardado en Firebase

1. Terminar un juego completo
2. Ir a Firebase Console → Firestore → `sesiones`
3. ¿Aparece un nuevo documento?
4. ¿Tiene todos los campos correctos?

**Si NO aparece:** Problema con `firebase_manager.save_results()`
**Si aparece incompleto:** Problema construyendo el diccionario `results`

### Test 3: Verificar limpieza de sesión activa

1. Terminar un juego
2. ANTES de que vuelva al Hall, abrir Firebase Console
3. Ir a `sesion_activa/current`
4. ¿Existe el documento?

**Si existe:** La limpieza no funciona → Verificar reglas de Firestore
**Si NO existe:** La limpieza funciona correctamente

### Test 4: Verificar polling en HubWorld

1. Terminar un juego y volver al Hall
2. Observar logs de Godot
3. ¿Aparece "[Firebase] 🔍 Polling sesión activa..."?
4. ¿Aparece "🎮 NUEVA SESIÓN DETECTADA"?

**Si aparece "NUEVA SESIÓN":** La sesión no se limpió correctamente
**Si solo muestra polling sin detectar:** Todo correcto

## 🔧 SOLUCIONES RÁPIDAS

### Solución 1: Agregar más logs para debug

En cada `*_vr_start.gd`, en la función `_on_game_finished()`:

```gdscript
func _on_game_finished(results: Dictionary) -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("🏁 GAME FINISHED - DEBUG")
	print("═══════════════════════════════════════════════════════════════")
	print("[VR] 1. Ocultando HUD...")
	_hide_game_hud()
	
	print("[VR] 2. Guardando resultados en Firebase...")
	firebase_manager.save_results(results)
	
	print("[VR] 3. Mostrando mensaje final...")
	if label_status:
		label_status.visible = true
		label_status.text = "✅ ¡SESIÓN COMPLETADA!"
	
	print("[VR] 4. Limpiando sesión de Firestore...")
	await _clear_firestore_session()
	print("[VR] ✅ Sesión limpiada")
	
	print("[VR] 5. Deteniendo polling...")
	firebase_manager.stop_polling()
	print("[VR] ✅ Polling detenido")
	
	print("[VR] 6. Esperando 3 segundos...")
	await get_tree().create_timer(3.0).timeout
	print("[VR] ✅ Espera completada")
	
	print("[VR] 7. Regresando al HubWorld...")
	get_tree().change_scene_to_file("res://HubWorld.tscn")
	print("═══════════════════════════════════════════════════════════════")
```

### Solución 2: Forzar duración corta para testing

En la plataforma web, al crear sesión, poner duración de **30 segundos** para probar rápido.

### Solución 3: Verificar que los resultados se construyan bien

En cada `*_game_manager.gd`, al final de `end_game()`:

```gdscript
func end_game() -> void:
	# ... construir results ...
	
	print("[Manager] 📊 RESULTADOS A GUARDAR:")
	print("  - game_type: ", results.get("game_type"))
	print("  - score: ", results.get("score"))
	print("  - patient_id: ", results.get("patient_id"))
	print("  - session_id: ", results.get("session_id"))
	
	game_finished.emit(results)
```

## 📝 CHECKLIST DE VERIFICACIÓN

- [ ] El timer llega a 00:00 en VR
- [ ] Aparece el mensaje "✅ SESIÓN COMPLETADA!"
- [ ] Los logs muestran "💾 Guardando resultados en Firebase..."
- [ ] Los logs muestran "✅ RESULTADOS GUARDADOS EXITOSAMENTE"
- [ ] Los logs muestran "🧹 Limpiando sesión activa de Firestore..."
- [ ] Los logs muestran "✅ SESIÓN ELIMINADA DE FIRESTORE"
- [ ] Firebase Console muestra el nuevo documento en `sesiones`
- [ ] Firebase Console NO muestra `sesion_activa/current` después de terminar
- [ ] El HubWorld NO reinicia automáticamente el juego
- [ ] La web muestra la sesión en el historial
- [ ] La web muestra las métricas correctas (score, duración, etc.)

## 🎯 RECOMENDACIÓN INMEDIATA

**Para tu TFG HOY:**

1. **Hacer una prueba completa** con duración de 30 segundos
2. **Revisar logs de Godot** para ver dónde se detiene el flujo
3. **Verificar Firebase Console** para confirmar que:
   - Se guarda en `sesiones`
   - Se borra `sesion_activa/current`

4. **Si los logs muestran todo correcto pero la web no muestra nada:**
   → Problema en el frontend (ResultsPage.tsx)
   
5. **Si los logs muestran error al guardar:**
   → Problema con permisos de Firestore

6. **Si el juego no termina:**
   → Problema con el timer en game_manager

---

**Archivos clave revisados:**
- ✅ `vr_start.gd` - Juego de gemas
- ✅ `vault_vr_start.gd` - Laser Vault
- ✅ `city_vr_start.gd` - Urban Quest
- ✅ `luggage_vr_start.gd` - Luggage Handler
- ✅ `scripts/firebase_manager.gd`
- ✅ `scripts/game_manager.gd`

**Conclusión:** El código está correcto. El problema es de configuración o timing.
