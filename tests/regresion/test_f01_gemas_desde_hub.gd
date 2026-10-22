extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de regresión F01 (Issue #18): Gemas iniciadas desde el Hub deben guardar
# los resultados y limpiar la sesión usando el FirebaseManager de la escena.
#
# - Datos SINTÉTICOS. Sin red: FirebaseManager se sustituye por un stub y la única
#   petición directa de vr_start (_clear_firestore_session) se anula.
# - No usar con OpenXR activado. Ejecutar en una copia aislada con
#   openxr/enabled=false (solo en la copia), con timeout y sin bucles:
#     godot --headless --path <copia> --script res://tests/regresion/test_f01_gemas_desde_hub.gd
# - Código de salida 0 = todas las comprobaciones correctas; 1 = alguna falla.
# ─────────────────────────────────────────────────────────────────────────────

# Se cargan en tiempo de ejecución (no con preload): con --script los autoloads
# (GameManager) solo existen una vez arrancado el árbol.
const RUTA_VR_START := "res://tests/regresion/vr_start_sin_red.gd"
const RUTA_STUB := "res://tests/regresion/stub_firebase_manager.gd"

const ID_PACIENTE := "TEST-F01-P"
const ID_SESION := "TEST-F01-S"

var fallos := 0

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

func _run() -> void:
	await process_frame
	var gm = root.get_node("GameManager")

	# Escena mínima equivalente a World.tscn: raíz con el script, cámara XR y nodo FirebaseManager
	var raiz := Node3D.new()
	raiz.name = "GemasPrueba"
	raiz.set_script(load(RUTA_VR_START))
	var origen := Node3D.new()
	origen.name = "XROrigin3D"
	var camara := XRCamera3D.new()
	camara.name = "XRCamera3D"
	origen.add_child(camara)
	raiz.add_child(origen)
	var stub := Node.new()
	stub.name = "FirebaseManager"
	stub.set_script(load(RUTA_STUB))
	raiz.add_child(stub)

	# Estado que deja el Hub antes de cambiar de escena (GameManager.apply_config)
	gm.apply_config({
		"patient_id": ID_PACIENTE, "patient_name": "Sintetico", "session_id": ID_SESION,
		"duration": 30, "difficulty": "Media", "therapy_side": "Ambos",
		"session_type": "Alcance", "game_id": "gems"})

	var iniciada := {"v": false}
	gm.session_started.connect(func(): iniciada["v"] = true)

	root.add_child(raiz)  # arranca _ready: rama "viene del Hub" + cuenta atrás

	# Esperar a que termine la cuenta atrás y arranque la sesión (máx. 15 s)
	var t := 0.0
	while not iniciada["v"] and t < 15.0:
		await create_timer(0.25).timeout
		t += 0.25
	check(iniciada["v"], "la sesión arranca desde el Hub (session_started)")
	check(not stub.polling_iniciado, "no se inicia polling en el flujo desde el Hub")
	check(raiz.firebase_manager == stub, "vr_start usa el FirebaseManager de la escena (no null)")

	# Cortafuegos: tras finish_session, vr_start espera 8 s y cambia a HubWorld (cuyo _ready
	# haría polling real). Si por cualquier fallo esta prueba no terminara antes, se aborta a los 4 s.
	create_timer(4.0).timeout.connect(func():
		print("CORTAFUEGOS: la prueba no terminó a tiempo, se aborta antes del cambio de escena")
		quit(2))

	# Finalizar la sesión como lo hace el juego al agotarse el tiempo
	gm.finish_session()
	await create_timer(1.5).timeout  # cubre el await de 0.5 s previo a la limpieza; NO llega al de 8 s

	check(stub.guardados.size() == 1, "save_results se invoca exactamente 1 vez (real: %d)" % stub.guardados.size())
	if stub.guardados.size() == 1:
		var r: Dictionary = stub.guardados[0]
		check(r.get("patient_id", "") == ID_PACIENTE, "los resultados conservan patient_id sintético")
		check(r.get("session_id", "") == ID_SESION, "los resultados conservan session_id sintético")
		check(r.get("game_type", "") == "gems", "game_type = gems (contrato sin cambios)")
	else:
		check(false, "los resultados conservan patient_id y session_id (no hay resultados)")
	check(stub.completadas == 1, "mark_session_completed se invoca 1 vez (real: %d)" % stub.completadas)
	check(raiz.limpiezas == 1, "se solicita la limpieza de la sesión 1 vez (real: %d)" % raiz.limpiezas)
	var gestores := 0
	for h in raiz.get_children():
		if h.name == "FirebaseManager" or (h.get_script() != null and h.get_script().resource_path.ends_with("firebase_manager.gd")):
			gestores += 1
	check(gestores == 1, "no hay instancias duplicadas de FirebaseManager (real: %d)" % gestores)

	print("RESULTADO: %s (%d fallos)" % ["OK" if fallos == 0 else "FALLA", fallos])
	quit(1 if fallos > 0 else 0)  # sale antes de los 8 s: nunca se cambia de escena
