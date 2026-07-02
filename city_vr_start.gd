extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# CityVRStart — Sistema VR para Urban Attention Quest
# Juego de atención espacial y navegación urbana para rehabilitación ictus
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null
var city_manager: Node = null
var waiting_mode := true

# UI Labels
@onready var label_status: Label3D = null
@onready var label_info: Label3D = null
@onready var hud_score: Label3D = null
@onready var hud_timer: Label3D = null
@onready var hud_instruction: Label3D = null
@onready var hud_sequence: Label3D = null
@onready var hud_asymmetry: Label3D = null

var _countdown_label: Label3D = null
var _ambient_audio: AudioStreamPlayer = null
var _xr_camera: XRCamera3D = null

func _ready() -> void:
	print("=== 🏙️ URBAN ATTENTION QUEST — VR System ===")
	await get_tree().process_frame
	_init_openxr()
	_create_waiting_ui()
	_create_game_hud()
	_create_countdown_ui()
	_setup_ambient_audio()
	
	# Obtener CityGameManager
	city_manager = get_node_or_null("CityGameManager")
	if not city_manager:
		push_error("[CityVR] CityGameManager no encontrado!")
		return
	
	# Obtener cámara XR para tracking de posición
	_xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	
	# Conectar señales
	city_manager.game_started.connect(_on_game_started)
	city_manager.game_finished.connect(_on_game_finished)
	city_manager.target_collected.connect(_on_target_collected)
	city_manager.sequence_error.connect(_on_sequence_error)
	city_manager.timer_updated.connect(_on_timer_updated)
	
	# Registrar targets
	_register_targets()
	
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
	firebase_manager.results_saved.connect(func(): print("[CityVR] ✅ Resultados guardados"))
	firebase_manager.results_error.connect(func(e): print("[CityVR] ❌ Error: ", e))
	
	print("[CityVR] 🏥 Entrando en sala de espera...")
	_show_waiting_message()
	firebase_manager.start_polling()

func _process(_delta: float) -> void:
	# Actualizar posición del jugador en el manager
	if city_manager and _xr_camera:
		city_manager.update_player_position(_xr_camera.global_position)

func _init_openxr() -> void:
	var xr = XRServer.find_interface("OpenXR")
	if xr == null:
		print("[CityVR] OpenXR no disponible — modo escritorio")
		return
	if not xr.is_initialized():
		xr.initialize()
	if xr.is_initialized():
		get_viewport().use_xr = true
		print("[CityVR] ✅ OpenXR activo")

func _register_targets() -> void:
	var targets_node = get_node_or_null("UrbanTargets")
	if targets_node:
		for target in targets_node.get_children():
			city_manager.register_target(target)
		print("[CityVR] ✅ Registrados ", targets_node.get_child_count(), " targets urbanos")

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
	
	# Instrucción
	hud_instruction = Label3D.new()
	hud_instruction.position = Vector3(0, 1.2, -3.0)
	hud_instruction.font_size = 32
	hud_instruction.modulate = Color(1.0, 1.0, 1.0)
	hud_instruction.outline_size = 4
	hud_instruction.outline_modulate = Color.BLACK
	hud_instruction.visible = false
	add_child(hud_instruction)
	
	# Secuencia actual
	hud_sequence = Label3D.new()
	hud_sequence.position = Vector3(0, 2.8, -2.0)
	hud_sequence.font_size = 56
	hud_sequence.modulate = Color(0.2, 0.8, 1.0)
	hud_sequence.outline_size = 8
	hud_sequence.outline_modulate = Color.BLACK
	hud_sequence.visible = false
	add_child(hud_sequence)
	
	# Indicador de asimetría (negligencia)
	hud_asymmetry = Label3D.new()
	hud_asymmetry.position = Vector3(0, 0.8, -3.0)
	hud_asymmetry.font_size = 28
	hud_asymmetry.modulate = Color(1.0, 0.8, 0.2)
	hud_asymmetry.outline_size = 4
	hud_asymmetry.outline_modulate = Color.BLACK
	hud_asymmetry.visible = false
	add_child(hud_asymmetry)

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
		
		_play_countdown_beep(i)
		await get_tree().create_timer(1.0).timeout
	
	_countdown_label.text = "¡EXPLORA!"
	_countdown_label.modulate = Color(0.2, 1.0, 0.8)
	var final_tween = create_tween()
	final_tween.tween_property(_countdown_label, "scale", Vector3.ONE * 3.0, 0.2).from(Vector3.ZERO)
	final_tween.tween_property(_countdown_label, "modulate:a", 0.0, 0.5).set_delay(0.3)
	
	_play_countdown_beep(0)
	await get_tree().create_timer(1.0).timeout
	_countdown_label.visible = false

func _play_countdown_beep(number: int) -> void:
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		var hz = 600.0 if number > 0 else 1000.0
		var frames = int(generator.mix_rate * 0.15)
		
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var amplitude = 0.4 * (1.0 - t / 0.15)
			var sample = sin(t * hz * TAU) * amplitude
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.2).timeout
	if is_instance_valid(audio):
		audio.queue_free()

func _setup_ambient_audio() -> void:
	_ambient_audio = AudioStreamPlayer.new()
	add_child(_ambient_audio)
	_ambient_audio.volume_db = -18.0

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
	if hud_instruction:
		hud_instruction.visible = true
		hud_instruction.text = "¡Busca y toca las señales en orden!"
	if hud_sequence:
		hud_sequence.visible = true
	if hud_asymmetry:
		hud_asymmetry.visible = true

func _hide_game_hud() -> void:
	if hud_score:
		hud_score.visible = false
	if hud_timer:
		hud_timer.visible = false
	if hud_instruction:
		hud_instruction.visible = false
	if hud_sequence:
		hud_sequence.visible = false
	if hud_asymmetry:
		hud_asymmetry.visible = false

# ─── EVENTOS DE SESIÓN ────────────────────────────────────────────────────────

func _on_new_session_detected(config: Dictionary) -> void:
	print("[CityVR] 🎮 Nueva sesión detectada!")
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
	print("[CityVR] Iniciando sesión de prueba...")
	GameManager.apply_config({
		"patient_id": "test",
		"patient_name": "Prueba City",
		"session_id": "city_" + str(Time.get_ticks_msec()),
		"duration": 180,
		"difficulty": "Media",
		"therapy_side": "Ambos",
		"session_type": "Navegación",
		"game_id": "urban_attention_quest",
	})
	
	_hide_waiting_ui()
	await get_tree().create_timer(1.0).timeout
	await _show_countdown()
	GameManager.start_session()

func _on_session_started() -> void:
	print("[CityVR] ▶ Sesión iniciada")
	_show_game_hud()
	if label_status:
		label_status.text = "¡EXPLORANDO!"
		label_status.modulate = Color(0.2, 1.0, 0.8)
		label_status.visible = true
		await get_tree().create_timer(2.0).timeout
		label_status.visible = false

func _on_game_started() -> void:
	print("[CityVR] 🏙️ Urban Attention Quest iniciado")

func _on_target_collected(target_id: int, points: int) -> void:
	if hud_score and city_manager:
		hud_score.text = "⭐ " + str(city_manager.score)
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.3, 0.1)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.1)
	
	# Actualizar número de secuencia
	if hud_sequence and city_manager:
		hud_sequence.text = "Siguiente: " + str(city_manager.get_next_sequence_number())
	
	# Actualizar asimetría
	_update_asymmetry_display()
	
	print("[CityVR] ✅ Target ", target_id, " +", points, " pts")

func _on_sequence_error(expected: int, touched: int) -> void:
	# Flash visual de error
	if hud_sequence:
		hud_sequence.modulate = Color(1.0, 0.2, 0.2)
		var tween = create_tween()
		tween.tween_property(hud_sequence, "modulate", Color(0.2, 0.8, 1.0), 0.5)
	
	print("[CityVR] ❌ Error de secuencia: esperado ", expected, ", tocado ", touched)

func _update_asymmetry_display() -> void:
	if not hud_asymmetry or not city_manager:
		return
	
	var left = city_manager.left_side_targets
	var right = city_manager.right_side_targets
	
	if left + right > 2:  # Suficientes datos
		var diff = abs(left - right)
		if diff > 2:
			hud_asymmetry.text = "⚠️ Asimetría detectada"
			hud_asymmetry.modulate = Color(1.0, 0.5, 0.0)
		else:
			hud_asymmetry.text = "✅ Exploración equilibrada"
			hud_asymmetry.modulate = Color(0.2, 1.0, 0.4)

func _on_timer_updated(remaining: float) -> void:
	if hud_timer:
		var m = int(remaining) / 60
		var s = int(remaining) % 60
		hud_timer.text = "⏱ %02d:%02d" % [m, s]
		
		if remaining < 30:
			hud_timer.modulate = Color(1.0, 0.2, 0.2)
		elif remaining < 60:
			hud_timer.modulate = Color(1.0, 0.8, 0.0)

func _on_game_finished(results: Dictionary) -> void:
	print("[CityVR] 🏁 Juego terminado")
	_hide_game_hud()
	
	firebase_manager.save_results(results)
	
	if label_status:
		label_status.visible = true
		if results.get("completion_percentage", 0) >= 100:
			label_status.text = "🎉 ¡COMPLETADO!"
			label_status.modulate = Color(0.2, 1.0, 0.2)
		else:
			label_status.text = "⏰ TIEMPO AGOTADO"
			label_status.modulate = Color(1.0, 0.5, 0.0)
	
	if label_info:
		label_info.visible = true
		var neglect = results.get("neglect_score", 0)
		label_info.text = "Score: " + str(results.get("score", 0)) + " | Negligencia: " + str(int(neglect)) + "/100"
	
	_clear_firestore_session()
	
	await get_tree().create_timer(5.0).timeout
	print("[CityVR] 🔄 Volviendo a sala de espera...")
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
	print("[CityVR] ✅ Sesión limpiada")
