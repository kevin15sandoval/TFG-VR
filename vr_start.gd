extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VRStart — Sistema de auto-arranque con sala de espera
# El juego espera en modo polling hasta que el fisioterapeuta inicie una sesión
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null
var waiting_mode := true  # Modo sala de espera activo

# UI Labels para feedback visual
@onready var label_status: Label3D = null
@onready var label_info: Label3D = null

func _ready() -> void:
	print("=== NeuroVR Rehab — Sistema de Auto-Arranque ===")
	await get_tree().process_frame
	_init_openxr()
	_create_waiting_ui()

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

	# Conectar señales (incluida la nueva de auto-detección)
	firebase_manager.config_loaded.connect(_on_config_loaded)
	firebase_manager.config_error.connect(_on_config_error)
	firebase_manager.new_session_detected.connect(_on_new_session_detected)
	firebase_manager.results_saved.connect(func(): print("[VR] ✅ Resultados guardados"))
	firebase_manager.results_error.connect(func(e): print("[VR] ❌ Error: ", e))

	# NUEVO: Iniciar en modo sala de espera con polling
	print("[VR] 🏥 Entrando en sala de espera...")
	print("[VR] 👀 Esperando que el fisioterapeuta inicie sesión...")
	_show_waiting_message()
	firebase_manager.start_polling()  # Activar polling automático

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

# ─── UI DE SALA DE ESPERA ─────────────────────────────────────────────────────

func _create_waiting_ui() -> void:
	# Crear labels 3D para mostrar en VR
	label_status = Label3D.new()
	label_status.position = Vector3(0, 2, -3)
	label_status.font_size = 64
	label_status.modulate = Color(0.2, 0.8, 1.0)  # Azul claro
	add_child(label_status)
	
	label_info = Label3D.new()
	label_info.position = Vector3(0, 1.5, -3)
	label_info.font_size = 32
	label_info.modulate = Color(0.8, 0.8, 0.8)
	add_child(label_info)

func _show_waiting_message() -> void:
	if label_status:
		label_status.text = "🏥 SALA DE ESPERA"
		label_status.visible = true
	if label_info:
		label_info.text = "El fisioterapeuta iniciará tu sesión en breve..."
		label_info.visible = true

func _hide_waiting_ui() -> void:
	if label_status:
		label_status.visible = false
	if label_info:
		label_info.visible = false

# ─── DETECCIÓN AUTOMÁTICA DE NUEVA SESIÓN ─────────────────────────────────────

func _on_new_session_detected(config: Dictionary) -> void:
	print("[VR] 🎮 ¡Nueva sesión detectada! Iniciando automáticamente...")
	waiting_mode = false
	firebase_manager.stop_polling()  # Detener polling
	_hide_waiting_ui()
	
	# Aplicar configuración y arrancar
	GameManager.apply_config(config)
	await get_tree().create_timer(1.5).timeout  # Pequeña pausa para que el paciente se prepare
	GameManager.start_session()

func _on_config_loaded(config: Dictionary) -> void:
	# Esta función ya no se usa en el flujo principal
	# El flujo ahora es: polling → new_session_detected → auto-start
	print("[VR] Config recibida (modo legacy): ", config)
	GameManager.apply_config(config)
	await get_tree().create_timer(1.0).timeout
	GameManager.start_session()

func _on_config_error(_msg: String) -> void:
	# En modo sala de espera, no hacer nada, seguir esperando
	# Solo usar defaults si estamos en modo desarrollo/pruebas
	if OS.is_debug_build():
		print("[VR] [DEBUG] Sin config — iniciando con defaults")
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
	if label_status:
		label_status.text = "¡SESIÓN ACTIVA!"
		label_status.modulate = Color(0.2, 1.0, 0.2)  # Verde
		await get_tree().create_timer(2.0).timeout
		label_status.visible = false
	if label_info:
		label_info.visible = false

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
	
	# Mostrar mensaje de finalización
	if label_status:
		label_status.visible = true
		label_status.text = "✅ ¡SESIÓN COMPLETADA!"
		label_status.modulate = Color(0.2, 1.0, 0.4)
	if label_info:
		label_info.visible = true
		label_info.text = "Puntuación: " + str(results.get("score", 0)) + " pts"
	
	# Volver a sala de espera después de 5 segundos
	await get_tree().create_timer(5.0).timeout
	print("[VR] 🔄 Volviendo a sala de espera...")
	waiting_mode = true
	_show_waiting_message()
	firebase_manager.start_polling()  # Reactivar polling para la siguiente sesión
