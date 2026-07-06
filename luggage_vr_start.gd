extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# LuggageVRStart — Sistema VR para Luggage Handler
# Juego de fuerza y manipulación de equipaje para rehabilitación
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null
var luggage_manager: Node = null
var waiting_mode := true

# UI Labels
@onready var label_status: Label3D = null
@onready var label_info: Label3D = null
@onready var hud_score: Label3D = null
@onready var hud_timer: Label3D = null
@onready var hud_weight: Label3D = null
@onready var hud_combo: Label3D = null
@onready var hud_instruction: Label3D = null

var _countdown_label: Label3D = null
var _xr_camera: XRCamera3D = null

func _ready() -> void:
	print("=== 📦 LUGGAGE HANDLER VR — VR System ===")
	await get_tree().process_frame
	_init_openxr()
	_create_waiting_ui()
	_create_game_hud()
	_create_countdown_ui()
	
	# Obtener LuggageGameManager
	luggage_manager = get_node_or_null("LuggageGameManager")
	if not luggage_manager:
		push_error("[LuggageVR] LuggageGameManager no encontrado!")
		return
	
	# Obtener cámara XR
	_xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	
	# Conectar señales
	luggage_manager.game_started.connect(_on_game_started)
	luggage_manager.game_finished.connect(_on_game_finished)
	luggage_manager.luggage_placed.connect(_on_luggage_placed)
	luggage_manager.luggage_error.connect(_on_luggage_error)
	luggage_manager.combo_achieved.connect(_on_combo_achieved)
	luggage_manager.timer_updated.connect(_on_timer_updated)
	
	# Registrar spawner
	var spawner = get_node_or_null("LuggageSpawner")
	if spawner:
		luggage_manager.register_spawner(spawner)
	
	# GameManager global
	GameManager.session_started.connect(_on_session_started)
	GameManager.session_finished.connect(_on_session_finished)
	
	# FirebaseManager
	if has_node("FirebaseManager"):
		firebase_manager = get_node("FirebaseManager")
	else:
		var script = load("res://scripts/firebase_manager.gd")
		firebase_manager = Node.new()
		firebase_manager.set_script(script)
		add_child(firebase_manager)
	
	firebase_manager.config_loaded.connect(_on_config_loaded)
	firebase_manager.config_error.connect(_on_config_error)
	firebase_manager.new_session_detected.connect(_on_new_session_detected)
	firebase_manager.results_saved.connect(func(): print("[LuggageVR] ✅ Resultados guardados"))
	firebase_manager.results_error.connect(func(e): print("[LuggageVR] ❌ Error: ", e))
	
	# MODO DEBUG: Si ejecutas esta escena directamente (sin Hub), auto-iniciar
	if OS.is_debug_build():
		print("[LuggageVR] 🔧 MODO DEBUG: Auto-iniciando juego sin polling")
		_on_config_error("Debug mode")
	else:
		print("[LuggageVR] 🏥 Entrando en sala de espera...")
		_show_waiting_message()
		firebase_manager.start_polling()

func _process(_delta: float) -> void:
	if luggage_manager and _xr_camera:
		luggage_manager.update_player_position(_xr_camera.global_position)

func _init_openxr() -> void:
	var xr = XRServer.find_interface("OpenXR")
	if xr == null:
		print("[LuggageVR] OpenXR no disponible — modo escritorio")
		return
	if not xr.is_initialized():
		xr.initialize()
	if xr.is_initialized():
		get_viewport().use_xr = true
		print("[LuggageVR] ✅ OpenXR activo")

# ─── UI DE SALA DE ESPERA ─────────────────────────────────────────────────────

func _create_waiting_ui() -> void:
	label_status = Label3D.new()
	label_status.position = Vector3(0, 2.5, -3.0)
	label_status.font_size = 72
	label_status.modulate = Color(0.2, 0.8, 1.0)
	label_status.outline_size = 8
	label_status.outline_modulate = Color.BLACK
	add_child(label_status)
	
	label_info = Label3D.new()
	label_info.position = Vector3(0, 2.0, -3.0)
	label_info.font_size = 36
	label_info.modulate = Color(0.8, 0.8, 0.8)
	label_info.outline_size = 5
	label_info.outline_modulate = Color.BLACK
	add_child(label_info)

func _create_game_hud() -> void:
	# Score
	hud_score = Label3D.new()
	hud_score.position = Vector3(-3.0, 2.5, -2.0)
	hud_score.font_size = 48
	hud_score.modulate = Color(1.0, 0.9, 0.0)
	hud_score.outline_size = 6
	hud_score.outline_modulate = Color.BLACK
	hud_score.visible = false
	add_child(hud_score)
	
	# Timer
	hud_timer = Label3D.new()
	hud_timer.position = Vector3(3.0, 2.5, -2.0)
	hud_timer.font_size = 48
	hud_timer.modulate = Color(0.2, 1.0, 0.4)
	hud_timer.outline_size = 6
	hud_timer.outline_modulate = Color.BLACK
	hud_timer.visible = false
	add_child(hud_timer)
	
	# Peso total
	hud_weight = Label3D.new()
	hud_weight.position = Vector3(-3.0, 2.0, -2.0)
	hud_weight.font_size = 32
	hud_weight.modulate = Color(1.0, 0.6, 0.2)
	hud_weight.outline_size = 4
	hud_weight.outline_modulate = Color.BLACK
	hud_weight.visible = false
	add_child(hud_weight)
	
	# Combo
	hud_combo = Label3D.new()
	hud_combo.position = Vector3(0, 2.8, -2.0)
	hud_combo.font_size = 56
	hud_combo.modulate = Color(1.0, 0.3, 0.9)
	hud_combo.outline_size = 8
	hud_combo.outline_modulate = Color.BLACK
	hud_combo.visible = false
	add_child(hud_combo)
	
	# Instrucción
	hud_instruction = Label3D.new()
	hud_instruction.position = Vector3(0, 1.2, -3.0)
	hud_instruction.font_size = 32
	hud_instruction.modulate = Color(1.0, 1.0, 1.0)
	hud_instruction.outline_size = 4
	hud_instruction.outline_modulate = Color.BLACK
	hud_instruction.visible = false
	add_child(hud_instruction)

func _create_countdown_ui() -> void:
	_countdown_label = Label3D.new()
	_countdown_label.position = Vector3(0, 2.2, -3.0)
	_countdown_label.font_size = 144
	_countdown_label.modulate = Color(1.0, 1.0, 0.0)
	_countdown_label.outline_size = 16
	_countdown_label.outline_modulate = Color.BLACK
	_countdown_label.visible = false
	add_child(_countdown_label)

func _show_countdown() -> void:
	if not _countdown_label:
		return
	
	_countdown_label.visible = true
	
	for i in range(3, 0, -1):
		_countdown_label.text = str(i)
		_countdown_label.modulate = Color(1.0, 0.3, 0.0) if i == 1 else Color(1.0, 1.0, 0.0)
		
		var tween = create_tween()
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 2.0, 0.3).from(Vector3.ZERO)
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 1.5, 0.3)
		
		await get_tree().create_timer(1.0).timeout
	
	_countdown_label.text = "¡A TRABAJAR!"
	_countdown_label.modulate = Color(0.2, 1.0, 0.8)
	var final_tween = create_tween()
	final_tween.tween_property(_countdown_label, "scale", Vector3.ONE * 3.0, 0.2).from(Vector3.ZERO)
	final_tween.tween_property(_countdown_label, "modulate:a", 0.0, 0.5).set_delay(0.3)
	
	await get_tree().create_timer(1.0).timeout
	_countdown_label.visible = false

func _show_waiting_message() -> void:
	if label_status:
		label_status.text = "SALA DE ESPERA"
		label_status.visible = true
	if label_info:
		label_info.text = "Esperando sesión..."
		label_info.visible = true
	_hide_game_hud()

func _hide_waiting_ui() -> void:
	if label_status:
		label_status.visible = false
	if label_info:
		label_info.visible = false

func _show_game_hud() -> void:
	if hud_score:
		hud_score.visible = true
	if hud_timer:
		hud_timer.visible = true
	if hud_weight:
		hud_weight.visible = true
	if hud_instruction:
		hud_instruction.visible = true
		hud_instruction.text = "🟢 Izquierda | 🟡 Derecha | 🔴 Atrás"

func _hide_game_hud() -> void:
	if hud_score:
		hud_score.visible = false
	if hud_timer:
		hud_timer.visible = false
	if hud_weight:
		hud_weight.visible = false
	if hud_combo:
		hud_combo.visible = false
	if hud_instruction:
		hud_instruction.visible = false

# ─── EVENTOS DE SESIÓN ────────────────────────────────────────────────────────

func _on_new_session_detected(config: Dictionary) -> void:
	print("[LuggageVR] 📦 Nueva sesión detectada!")
	if label_info:
		label_info.text = "¡SESIÓN DETECTADA! Iniciando..."
	waiting_mode = false
	firebase_manager.stop_polling()
	_hide_waiting_ui()
	
	GameManager.apply_config(config)
	await _show_countdown()
	GameManager.start_session()

func _on_config_loaded(config: Dictionary) -> void:
	GameManager.apply_config(config)
	await get_tree().create_timer(1.0).timeout
	GameManager.start_session()

func _on_config_error(_msg: String) -> void:
	print("[LuggageVR] Iniciando sesión de prueba...")
	GameManager.apply_config({
		"patient_id": "test",
		"patient_name": "Prueba Luggage",
		"session_id": "luggage_" + str(Time.get_ticks_msec()),
		"duration": 180,
		"difficulty": "Media",
		"therapy_side": "Ambos",
		"session_type": "Fuerza",
		"game_id": "luggage_handler",
	})
	
	_hide_waiting_ui()
	await get_tree().create_timer(1.0).timeout
	await _show_countdown()
	GameManager.start_session()

func _on_session_started() -> void:
	print("[LuggageVR] ▶ Sesión iniciada")
	_show_game_hud()
	if label_status:
		label_status.text = "¡TRABAJANDO!"
		label_status.modulate = Color(0.2, 1.0, 0.8)
		label_status.visible = true
		await get_tree().create_timer(2.0).timeout
		label_status.visible = false

func _on_game_started() -> void:
	print("[LuggageVR] 📦 Luggage Handler iniciado")

func _on_luggage_placed(zone: String, weight: float, points: int) -> void:
	if hud_score and luggage_manager:
		hud_score.text = "⭐ " + str(luggage_manager.score)
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.3, 0.1)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.1)
	
	if hud_weight and luggage_manager:
		hud_weight.text = "💪 " + str(int(luggage_manager.total_weight_moved)) + "kg"
	
	print("[LuggageVR] ✅ Maleta colocada | +", points, " pts")

func _on_luggage_error(error_type: String) -> void:
	# Flash visual de error
	if hud_score:
		hud_score.modulate = Color(1.0, 0.2, 0.2)
		var tween = create_tween()
		tween.tween_property(hud_score, "modulate", Color(1.0, 0.9, 0.0), 0.5)
	
	print("[LuggageVR] ❌ Error: ", error_type)

func _on_combo_achieved(combo_count: int) -> void:
	if hud_combo:
		hud_combo.visible = true
		hud_combo.text = "🔥 COMBO x" + str(combo_count) + "!"
		hud_combo.modulate = Color(1.0, 0.5, 0.0)
		
		var tween = create_tween()
		tween.tween_property(hud_combo, "scale", Vector3.ONE * 2.0, 0.2).from(Vector3.ONE * 0.5)
		tween.tween_property(hud_combo, "modulate:a", 0.0, 0.5).set_delay(1.0)
		
		await get_tree().create_timer(1.5).timeout
		hud_combo.visible = false
		hud_combo.scale = Vector3.ONE
		hud_combo.modulate.a = 1.0

func _on_timer_updated(remaining: float) -> void:
	if not hud_timer or not luggage_manager:
		return
	
	if luggage_manager.recognition_phase:
		var m = int(remaining) / 60
		var s = int(remaining) % 60
		hud_timer.text = "🔍 OBSERVA %02d:%02d" % [m, s]
		hud_timer.modulate = Color(0.2, 0.8, 1.0)
		
		if hud_instruction:
			hud_instruction.text = "Observa la cinta y las zonas de colores..."
	else:
		var m = int(remaining) / 60
		var s = int(remaining) % 60
		hud_timer.text = "⏱ %02d:%02d" % [m, s]
		
		if remaining < 30:
			hud_timer.modulate = Color(1.0, 0.2, 0.2)
		elif remaining < 60:
			hud_timer.modulate = Color(1.0, 0.8, 0.0)
		else:
			hud_timer.modulate = Color(0.2, 1.0, 0.4)

func _on_game_finished(results: Dictionary) -> void:
	print("[LuggageVR] 🏁 Juego terminado")
	_hide_game_hud()
	
	firebase_manager.save_results(results)
	
	if label_status:
		label_status.visible = true
		label_status.text = "🎉 ¡SESIÓN COMPLETADA!"
		label_status.modulate = Color(0.2, 1.0, 0.2)
	
	if label_info:
		label_info.visible = true
		var total_weight = results.get("total_weight_moved", 0)
		label_info.text = "Score: " + str(results.get("score", 0)) + " | Peso: " + str(int(total_weight)) + "kg"
	
	_clear_firestore_session()
	
	await get_tree().create_timer(5.0).timeout
	print("[LuggageVR] 🔄 Volviendo a sala de espera...")
	waiting_mode = true
	_show_waiting_message()
	firebase_manager.start_polling()

func _on_session_finished(results: Dictionary) -> void:
	pass

func _clear_firestore_session() -> void:
	var url = "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents/sesion_activa/current"
	var http = HTTPRequest.new()
	add_child(http)
	http.request(url, [], HTTPClient.METHOD_DELETE)
	await http.request_completed
	http.queue_free()
	print("[LuggageVR] ✅ Sesión limpiada")
