extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de regresión F02a (Issue #19): la identidad de sesión no se pierde antes de
# que Vault y Luggage construyan sus resultados (T1), finish_session no la borra y
# release_session sí (T2), y save_results no envía resultados sin identificadores (T4).
# La prueba de City y del orden de temporizadores está en test_f02_orden_temporizadores.gd.
#
# - Datos SINTÉTICOS (TEST-F02-P / TEST-F02-S). Sin red: no se crea ninguna escena ni se
#   llama a Firebase; T4 usa el FirebaseManager real pero con identificadores vacíos, así
#   que save_results se detiene ANTES de cualquier petición.
# - Ejecutar en una copia aislada con openxr/enabled=false (solo en la copia), con timeout:
#     godot --headless --path <copia> --script res://tests/regresion/test_f02a_identidad_sesion.gd
# - Para comprobar que los logs no exponen datos: el nombre sintético "Nombre Sintetico X"
#   no debe aparecer en la salida (grep sobre el log).
# - Código de salida 0 = todo correcto; 1 = alguna comprobación falla.
# ─────────────────────────────────────────────────────────────────────────────

const ID_P := "TEST-F02-P"
const ID_S := "TEST-F02-S"
const CASOS := {
	"vault": "res://scenes/vault_game_manager.gd",
	"luggage": "res://scenes/luggage_game_manager.gd"}
const RUTA_FIREBASE := "res://scripts/firebase_manager.gd"
const RUTA_STUB := "res://tests/regresion/stub_firebase_manager.gd"

var fallos := 0

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

func _config(gm) -> void:
	gm.apply_config({"patient_id": ID_P, "patient_name": "Sintetico", "session_id": ID_S,
		"duration": 3, "difficulty": "Media", "therapy_side": "Ambos", "game_id": "gems"})

func _reiniciar(gm) -> void:
	for c in gm.session_finished.get_connections(): gm.session_finished.disconnect(c["callable"])
	for c in gm.session_started.get_connections(): gm.session_started.disconnect(c["callable"])
	gm.session_active = false
	gm.game_finished = false

func _run() -> void:
	await process_frame
	var gm = root.get_node("GameManager")
	var hay_release: bool = gm.has_method("release_session")

	# ── T1 + T2: Vault y Luggage terminan DESPUÉS de que GameManager agote su tiempo ──
	for caso in CASOS:
		_reiniciar(gm)
		_config(gm)
		var mgr := Node.new()
		mgr.name = "Mgr_" + caso
		mgr.set_script(load(CASOS[caso]))
		root.add_child(mgr)
		var capt := {"n": 0, "pid": "?", "sid": "?", "pname": "?"}
		mgr.game_finished.connect(func(r):
			capt["n"] += 1
			capt["pid"] = str(r.get("patient_id", "<sin campo>"))
			capt["sid"] = str(r.get("session_id", "<sin campo>"))
			capt["pname"] = str(r.get("patient_name", "<sin campo>")))
		gm.start_session()
		await create_timer(7.0).timeout
		check(capt["n"] == 1, "T1 %s: un único evento game_finished (real: %d)" % [caso, capt["n"]])
		check(capt["pid"] == ID_P, "T1 %s: los resultados conservan patient_id" % caso)
		check(capt["sid"] == ID_S, "T1 %s: los resultados conservan session_id" % caso)
		check(capt["pname"] == "Sintetico", "T1 %s: los resultados conservan patient_name" % caso)
		check(gm.patient_id == ID_P and gm.session_id == ID_S, "T2 %s: finish_session no borra la identidad" % caso)
		mgr.queue_free()
		await process_frame

	# ── T2: release_session borra la identidad; la variante condicionada respeta la confirmación ──
	check(hay_release, "T2: GameManager expone release_session()")
	if hay_release:
		_config(gm)
		var stub := Node.new()
		stub.set_script(load(RUTA_STUB))
		root.add_child(stub)
		stub.confirmado = false
		check(gm.release_session_si_confirmado(stub) == false, "T2: sin confirmación NO se libera la identidad")
		check(gm.patient_id == ID_P and gm.session_id == ID_S, "T2: la identidad sigue intacta sin confirmación")
		check(gm.release_session_si_confirmado(null) == false, "T2: sin gestor de Firebase NO se libera la identidad")
		stub.confirmado = true
		check(gm.release_session_si_confirmado(stub) == true, "T2: con guardado confirmado SÍ se libera")
		check(gm.patient_id == "" and gm.session_id == "" and gm.patient_name == "", "T2: tras liberar, la identidad queda vacía")
		_config(gm)
		gm.release_session()
		check(gm.patient_id == "" and gm.session_id == "" and gm.patient_name == "", "T2: release_session() libera de forma explícita")
		stub.queue_free()

	# ── T4: save_results rechaza resultados sin identificadores (sin tocar la red) ──
	# Seguridad: el gestor real se usa FUERA del árbol y con un HTTPRequest tampoco en el árbol,
	# de modo que request() devuelve ERR_UNCONFIGURED y NUNCA sale una petición, aunque la
	# validación fallara. (_ready no se ejecuta; se crea a mano el HTTPRequest de guardado.)
	var fb := Node.new()
	fb.set_script(load(RUTA_FIREBASE))
	fb._http_save = HTTPRequest.new()
	var errores: Array = []
	fb.results_error.connect(func(m): errores.append(m))
	var base := {"patient_name": "Nombre Sintetico X", "game_type": "vault_escape", "score": 1}
	var variantes := {
		"patient_id vacío": {"patient_id": "", "session_id": ID_S},
		"session_id vacío": {"patient_id": ID_P, "session_id": ""},
		"ambos ausentes": {},
		"solo espacios": {"patient_id": "   ", "session_id": "  "}}
	for nombre in variantes:
		var r: Dictionary = base.duplicate()
		r.merge(variantes[nombre])
		var antes: int = errores.size()
		fb.save_results(r)
		check(errores.size() == antes + 1 and errores[errores.size() - 1] == "identidad_incompleta", "T4 %s: results_error('identidad_incompleta')" % nombre)
		check(fb._http_save.get_http_client_status() == HTTPClient.STATUS_DISCONNECTED, "T4 %s: no se inició ninguna petición" % nombre)
		check(fb.has_method("guardado_confirmado") and not fb.guardado_confirmado(), "T4 %s: el guardado no figura como confirmado" % nombre)
	fb.free()

	print("RESULTADO: %s (%d fallos)" % ["OK" if fallos == 0 else "FALLA", fallos])
	quit(1 if fallos > 0 else 0)
