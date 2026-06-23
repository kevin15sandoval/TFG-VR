extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VRStart — Versión simplificada sin UI
# Conecta con Firebase, carga config y arranca el juego de gemas
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null

func _ready() -> void:
	print("=== NeuroVR Rehab — Iniciando ===")
	await get_tree().process_frame
	_init_openxr()

	# Conectar señales del GameManager
	GameManager.session_started.connect(_on_session_started)
	GameManager.session_finished.connect(_on_session_finished)
	GameManager.gem_collected.connect(_on_gem_collected)
	GameManager.timer_updated.connect(_on_timer_updated)

	# Crear FirebaseManager dinámicamente si no está en escena
	if has_node("FirebaseManager"):
		firebase_manager = get_node("FirebaseManager")
	else:
		var script = load("res://scripts/firebase_manager.gd")
		firebase_manager = Node.new()
		firebase_manager.set_script(script)
		add_child(firebase_manager)

	firebase_manager.config_loaded.connect(_on_config_loaded)
	firebase_manager.config_error.connect(_on_config_error)
	firebase_manager.results_saved.connect(func(): print("[VR] ✅ Resultados guardados"))
	firebase_manager.results_error.connect(func(e): print("[VR] ❌ Error: ", e))

	print("[VR] Cargando configuración de Firebase...")
	firebase_manager.load_session_config()

func _init_openxr() -> void:
	var xr = XRServer.find_interface("OpenXR")
	if xr == null:
		print("[VR] OpenXR no disponible — modo escritorio")
		return
	if not xr.is_initialized():
		xr.initialize()
	if xr.is_initialized():
		get_viewport().use_xr = true
		print("[VR] ✅ OpenXR activo")

func _on_config_loaded(config: Dictionary) -> void:
	print("[VR] Config recibida: ", config)
	GameManager.apply_config(config)
	await get_tree().create_timer(1.0).timeout
	GameManager.start_session()

func _on_config_error(_msg: String) -> void:
	print("[VR] Sin config — iniciando con defaults")
	GameManager.apply_config({
		"patient_id":    "test",
		"patient_name":  "Prueba",
		"session_id":    "offline_" + str(Time.get_ticks_msec()),
		"duration":      180,
		"difficulty":    "Media",
		"therapy_side":  "Izquierdo",
		"session_type":  "Alcance",
		"game_id":       "gems",
	})
	await get_tree().create_timer(0.5).timeout
	GameManager.start_session()

func _on_session_started() -> void:
	print("[VR] ▶ Sesión iniciada | ", GameManager.difficulty, " | ", GameManager.therapy_side)

func _on_gem_collected(gem_type: String, points: int, total: int) -> void:
	print("[VR] Gema: ", gem_type, " +", points, " → ", total, " pts")

func _on_timer_updated(remaining: float) -> void:
	var m = int(remaining) / 60
	var s = int(remaining) % 60
	# Actualizar UI si existe
	if has_node("UI/LabelTimer"):
		$UI/LabelTimer.text = "%02d:%02d" % [m, s]

func _on_session_finished(results: Dictionary) -> void:
	print("[VR] 🏁 Sesión terminada — Puntos: ", results.get("score", 0))
	firebase_manager.save_results(results)
