extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VRStart — Script principal de la escena World
# 1. Inicializa OpenXR
# 2. Carga config de Firebase (paciente, dificultad, duración, lado)
# 3. Arranca la sesión
# 4. Al terminar, guarda resultados en Firestore
# ─────────────────────────────────────────────────────────────────────────────

@onready var firebase: Node = $FirebaseManager if has_node("FirebaseManager") else null

func _ready() -> void:
	print("=== NeuroVR Rehab — Iniciando ===")

	# 1. OpenXR
	await get_tree().process_frame
	_init_openxr()

	# 2. Conectar señales del GameManager
	GameManager.session_finished.connect(_on_session_finished)

	# 3. Conectar Firebase si existe en escena
	if firebase:
		firebase.config_loaded.connect(_on_config_loaded)
		firebase.config_error.connect(_on_config_error)
		firebase.results_saved.connect(_on_results_saved)
		firebase.results_error.connect(_on_results_error)
		print("[VRStart] Cargando config de Firebase...")
		firebase.load_session_config()
	else:
		print("[VRStart] Sin FirebaseManager — usando config por defecto")
		_start_with_defaults()

func _init_openxr() -> void:
	var xr = XRServer.find_interface("OpenXR")
	if xr == null:
		print("[VRStart] OpenXR no disponible")
		return
	if not xr.is_initialized():
		xr.initialize()
	if xr.is_initialized():
		get_viewport().use_xr = true
		print("[VRStart] ✅ OpenXR activo")
	else:
		print("[VRStart] ⚠️ OpenXR no pudo iniciarse")

# ─── CONFIG CARGADA DE FIREBASE ──────────────────────────────────────────────

func _on_config_loaded(config: Dictionary) -> void:
	print("[VRStart] Config recibida: ", config)
	GameManager.apply_config(config)
	# Pequeña pausa para que el entorno VR esté listo
	await get_tree().create_timer(1.5).timeout
	GameManager.start_session()

func _on_config_error(msg: String) -> void:
	print("[VRStart] Sin config de Firebase (", msg, ") — iniciando con defaults")
	_start_with_defaults()

func _start_with_defaults() -> void:
	# Config por defecto para pruebas sin conexión
	GameManager.apply_config({
		"patient_id":    "test",
		"patient_name":  "Paciente de prueba",
		"session_id":    "offline_" + str(Time.get_ticks_msec()),
		"duration":      180,
		"difficulty":    "Media",
		"therapy_side":  "Izquierdo",
		"session_type":  "Alcance",
		"game_id":       "gems",
	})
	await get_tree().create_timer(1.0).timeout
	GameManager.start_session()

# ─── SESIÓN TERMINADA → GUARDAR EN FIREBASE ──────────────────────────────────

func _on_session_finished(results: Dictionary) -> void:
	print("[VRStart] Sesión terminada — guardando en Firebase...")
	if firebase:
		firebase.save_results(results)
	else:
		print("[VRStart] Sin Firebase — resultados solo en consola")
		print(results)

func _on_results_saved() -> void:
	print("[VRStart] ✅ Resultados guardados en Firestore")
	# Aquí podrías mostrar una pantalla de resultados en VR

func _on_results_error(msg: String) -> void:
	print("[VRStart] ❌ Error guardando resultados: ", msg)
