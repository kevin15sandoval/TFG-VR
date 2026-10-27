extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de regresión: modo local de depuración = CERO peticiones a Firebase.
#
# - Datos SINTÉTICOS. Sin red: ModoLocal.sin_red_real=true cuenta las peticiones que
#   SALDRÍAN por el punto común de salida (ModoLocal.enviar) sin abrir ninguna conexión.
# - Fase A (modo local): arranque/polling, lectura, save_results de los 4 juegos, PATCH de estado,
#   vinculación (device_link), DELETE de sesion_activa en los 4 juegos, Hub durante 11 s
#   (el polling del Hub arranca a los 10 s) y regreso al Hub => 0 peticiones emitidas.
# - Fase B (CONTROL, sin modo local): las mismas operaciones SÍ emiten (14 peticiones),
#   lo que demuestra que la guarda es lo que las evita y que el flujo normal no cambia.
# - No usar con OpenXR activado. Ejecutar en copia aislada con openxr/enabled=false:
#     godot --headless --path <copia> --script res://tests/regresion/test_modo_local_sin_red.gd
# - Código de salida 0 = correcto; 1 = alguna comprobación falla.
# ─────────────────────────────────────────────────────────────────────────────

const JUEGOS := ["gems", "vault_escape", "urban_attention_quest", "luggage_handler"]
const SCRIPTS_JUEGO := ["res://vr_start.gd", "res://vault_vr_start.gd", "res://city_vr_start.gd", "res://luggage_vr_start.gd"]
const EMITIDAS_ESPERADAS := 14  # poll 1 + load 1 + save 4 + patch 1 + link 1 + devpoll 1 + devsession 1 + delete 4

var fallos := 0
var ML

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

func _resultados(game_id: String) -> Dictionary:
	return {"patient_id": "test", "patient_name": "Prueba Local", "session_id": "offline_T_" + game_id,
		"game_type": game_id, "game_name": game_id, "score": 10, "accuracy": 50, "duration": 5,
		"therapy_side": "Izquierdo", "difficulty": "Media"}

func _operaciones(esperar_patch: bool) -> void:
	var fm = load("res://scripts/firebase_manager.gd").new()
	root.add_child(fm)
	var dl = load("res://scripts/device_link.gd").new()
	root.add_child(dl)
	await process_frame
	fm.start_polling()
	fm._polling_enabled = true
	fm._poll_for_new_session()
	fm.load_session_config()
	for g in JUEGOS:
		fm.save_results(_resultados(g))
	if esperar_patch:
		await fm.mark_session_completed()
	else:
		fm.mark_session_completed()  # en el control queda esperando respuesta (no hay red real)
	dl.link_with_code("ABCD")
	dl._poll_device_status()
	dl._load_session_config()
	for r in SCRIPTS_JUEGO:
		var j = load(r).new()
		if esperar_patch:
			await j._clear_firestore_session()
		else:
			j._clear_firestore_session()  # idem
		j.free()
	fm.queue_free()
	dl.queue_free()

func _run() -> void:
	await process_frame
	ML = load("res://scripts/modo_local.gd")
	ML.sin_red_real = true

	# ── Fase A: modo local ──
	ML.activar()
	check(ML.esta_activo(), "modo local activo (is_debug_build=" + str(OS.is_debug_build()) + ")")
	ML.emitidas = 0
	ML.bloqueadas = 0
	var dir := DirAccess.open("user://")
	if dir and dir.dir_exists("pruebas_locales"):
		for f in DirAccess.get_files_at("user://pruebas_locales"):
			DirAccess.remove_absolute("user://pruebas_locales/" + f)
	await _operaciones(true)
	check(ML.emitidas == 0, "A: CERO peticiones emitidas en modo local (emitidas=" + str(ML.emitidas) + ")")
	check(ML.bloqueadas >= 14, "A: peticiones bloqueadas y registradas (bloqueadas=" + str(ML.bloqueadas) + ")")
	for g in JUEGOS:
		check(FileAccess.file_exists("user://pruebas_locales/offline_T_" + g + ".json"), "A: métricas locales guardadas para " + g)
	var txt := FileAccess.get_file_as_string("user://pruebas_locales/offline_T_gems.json")
	var parsed = JSON.parse_string(txt)
	check(parsed is Dictionary and parsed["resultados"]["score"] == 10 and parsed["estado"] == "finalizada", "A: el JSON local contiene los resultados")

	# Hub durante 11 s (polling del Hub a los 10 s) en modo local
	var hub = (load("res://HubWorld.tscn") as PackedScene).instantiate()
	root.add_child(hub)
	await create_timer(11.0).timeout
	var fm_hub = hub.firebase_manager
	check(fm_hub != null and fm_hub._polling_enabled == false, "A: el Hub no habilita el polling en modo local")
	check(ML.emitidas == 0, "A: Hub 11 s => 0 peticiones (emitidas=" + str(ML.emitidas) + ")")

	# Regreso al Hub tras abortar una partida (identidad sintética)
	var gm = root.get_node("GameManager")
	gm.apply_config({"patient_id": "test", "patient_name": "Prueba Local", "session_id": "offline_T_abort", "game_id": "gems"})
	var ret = root.get_node_or_null("DebugReturnToHub")
	check(ret != null, "A: existe DebugReturnToHub")
	if ret:
		ret.volver_al_hub()  # el Hub de pruebas no es current_scene => cambia de escena
		for i in 8:
			await process_frame
		check(FileAccess.file_exists("user://pruebas_locales/offline_T_abort_abortada.json"), "A: aborto deja registro local parcial")
		check(gm.session_id == "", "A: regreso al Hub libera la identidad local")
	check(ML.emitidas == 0, "A: regreso al Hub => 0 peticiones (emitidas=" + str(ML.emitidas) + ")")

	# ── Fase B: control sin modo local ──
	ML.desactivar()
	ML.emitidas = 0
	ML.bloqueadas = 0
	await _operaciones(false)
	check(ML.bloqueadas == 0, "B: sin modo local no se bloquea nada")
	check(ML.emitidas == EMITIDAS_ESPERADAS, "B: control => las mismas operaciones emiten " + str(EMITIDAS_ESPERADAS) + " (emitidas=" + str(ML.emitidas) + ")")

	print("RESULTADO: ", "OK" if fallos == 0 else "FALLOS=" + str(fallos))
	quit(0 if fallos == 0 else 1)
