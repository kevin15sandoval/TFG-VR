extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VRStart — Sistema de auto-arranque con sala de espera
# El juego espera en modo polling hasta que el fisioterapeuta inicie una sesión
# Incluye HUD con score, timer y feedback visual
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null
var waiting_mode := true  # Modo sala de espera activo
var current_game_manager: Node = null  # Game manager activo según juego

# UI Labels para feedback visual
@onready var label_status: Label3D = null
@ontml:parameter name="label_info: Label3D = null

# HUD Labels para juego
var hud_score: Label3D = null
var hud_timer: Label3D = null
var hud_instruction: Label3D = null
var hud_combo: Label3D = null

var _combo_count: int = 0
var _last_gem_time: float = 0.0
var _ambient_audio: AudioStreamPlayer = null
var _countdown_label: Label3D = null

func _ready() -> void:
	print("=== NeuroVR Rehab — Sistema de Auto-Arranque ===")
	await get_tree().process_frame
	_init_openxr()
	_create_waiting_ui()
	_create_game_hud()
	_create_countdown_ui()
	_setup_ambient_audio()

	# Nota: Las señales se conectan dinámicamente cuando se carga el game manager

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
	# Crear labels 3D ENFRENTE del usuario y LEGIBLES
	label_status = Label3D.new()
	label_status.position = Vector3(-2.0, 1.8, 0)
	label_status.rotation_degrees = Vector3(0, 90, 0)  # 90° para que se lea correctamente
	label_status.font_size = 72
	label_status.modulate = Color(0.2, 0.8, 1.0)
	label_status.outline_size = 8
	label_status.outline_modulate = Color.BLACK
	add_child(label_status)
	
	label_info = Label3D.new()
	label_info.position = Vector3(-2.0, 1.4, 0)
	label_info.rotation_degrees = Vector3(0, 90, 0)  # 90° para que se lea correctamente
	label_info.font_size = 36
	label_info.modulate = Color(0.8, 0.8, 0.8)
	label_info.outline_size = 5
	label_info.outline_modulate = Color.BLACK
	add_child(label_info)
	
	print("[VR] ✅ UI de espera creada")

# ─── HUD DEL JUEGO ────────────────────────────────────────────────────────────

func _create_game_hud() -> void:
	# Score (arriba izquierda ENFRENTE y LEGIBLE)
	hud_score = Label3D.new()
	hud_score.position = Vector3(-1.8, 1.8, -1.0)
	hud_score.rotation_degrees = Vector3(0, 90, 0)  # 90° para que se lea correctamente
	hud_score.font_size = 48
	hud_score.modulate = Color(1.0, 0.9, 0.0)
	hud_score.outline_size = 6
	hud_score.outline_modulate = Color.BLACK
	hud_score.visible = false
	add_child(hud_score)
	
	# Timer (arriba derecha ENFRENTE y LEGIBLE)
	hud_timer = Label3D.new()
	hud_timer.position = Vector3(-1.8, 1.8, 1.0)
	hud_timer.rotation_degrees = Vector3(0, 90, 0)  # 90° para que se lea correctamente
	hud_timer.font_size = 48
	hud_timer.modulate = Color(0.2, 1.0, 0.4)
	hud_timer.outline_size = 6
	hud_timer.outline_modulate = Color.BLACK
	hud_timer.visible = false
	add_child(hud_timer)
	
	# Instrucción actual (abajo centro ENFRENTE y LEGIBLE)
	hud_instruction = Label3D.new()
	hud_instruction.position = Vector3(-1.5, 0.5, 0)
	hud_instruction.rotation_degrees = Vector3(0, 90, 0)  # 90° para que se lea correctamente
	hud_instruction.font_size = 28
	hud_instruction.modulate = Color(1.0, 1.0, 1.0)
	hud_instruction.outline_size = 4
	hud_instruction.outline_modulate = Color.BLACK
	hud_instruction.visible = false
	add_child(hud_instruction)
	
	# Combo multiplier (centro ENFRENTE y LEGIBLE)
	hud_combo = Label3D.new()
	hud_combo.position = Vector3(-1.8, 1.5, 0)
	hud_combo.rotation_degrees = Vector3(0, 90, 0)  # 90° para que se lea correctamente
	hud_combo.font_size = 56
	hud_combo.modulate = Color(1.0, 0.4, 0.0)
	hud_combo.outline_size = 8
	hud_combo.outline_modulate = Color.BLACK
	hud_combo.visible = false
	add_child(hud_combo)

# ─── COUNTDOWN ANIMADO ────────────────────────────────────────────────────────

func _create_countdown_ui() -> void:
	_countdown_label = Label3D.new()
	_countdown_label.position = Vector3(-1.5, 1.5, 0)
	_countdown_label.rotation_degrees = Vector3(0, 90, 0)  # 90° para que se lea correctamente
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
		
		# Animación de pulso
		var tween = create_tween()
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 2.0, 0.3).from(Vector3.ZERO)
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 1.5, 0.3)
		
		# Sonido de countdown
		_play_countdown_beep(i)
		
		await get_tree().create_timer(1.0).timeout
	
	# ¡GO!
	_countdown_label.text = "¡GO!"
	_countdown_label.modulate = Color(0.2, 1.0, 0.2)  # Verde
	var final_tween = create_tween()
	final_tween.tween_property(_countdown_label, "scale", Vector3.ONE * 3.0, 0.2).from(Vector3.ZERO)
	final_tween.tween_property(_countdown_label, "modulate:a", 0.0, 0.5).set_delay(0.3)
	
	_play_countdown_beep(0)  # Beep especial para GO
	
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
		var hz = 600.0 if number > 0 else 1000.0  # GO! es más agudo
		var frames = int(generator.mix_rate * 0.15)
		
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var amplitude = 0.4 * (1.0 - t / 0.15)
			var sample = sin(t * hz * TAU) * amplitude
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.2).timeout
	if is_instance_valid(audio):
		audio.queue_free()

# ─── AUDIO AMBIENTE ───────────────────────────────────────────────────────────

func _setup_ambient_audio() -> void:
	_ambient_audio = AudioStreamPlayer.new()
	add_child(_ambient_audio)
	_ambient_audio.volume_db = -15.0  # Volumen bajo para no molestar
	
	# Generar tono ambiental procedural (onda espacial continua)
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 2.0
	_ambient_audio.stream = generator
	_ambient_audio.play()
	
	# Generar audio ambiente en background
	_generate_ambient_loop()

func _generate_ambient_loop() -> void:
	await get_tree().process_frame
	if not _ambient_audio or not _ambient_audio.playing:
		return
	
	var playback = _ambient_audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if not playback:
		return
	
	# Generar onda ambiente continua (tono bajo relajante)
	while _ambient_audio and _ambient_audio.playing:
		var frames_available = playback.get_frames_available()
		if frames_available > 0:
			for i in range(min(frames_available, 100)):
				var t = Time.get_ticks_msec() / 1000.0 + float(i) / 44100.0
				# Combinación de frecuencias bajas para ambiente espacial
				var sample = sin(t * 110.0 * TAU) * 0.1  # Nota A baja
				sample += sin(t * 165.0 * TAU) * 0.08   # Nota E
				sample += sin(t * 220.0 * TAU) * 0.05   # Nota A media
				sample *= 0.3  # Volumen muy bajo
				playback.push_frame(Vector2(sample, sample))
		
		await get_tree().process_frame

func _show_waiting_message() -> void:
	if label_status:
		label_status.text = "SALA DE ESPERA"  # Sin emoji
		label_status.visible = true
	if label_info:
		label_info.text = "Polling activo. Esperando sesión..."
		label_info.visible = true
	_hide_game_hud()
	print("[VR] 📺 Mensaje de espera mostrado")

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

func _hide_game_hud() -> void:
	if hud_score:
		hud_score.visible = false
	if hud_timer:
		hud_timer.visible = false
	if hud_instruction:
		hud_instruction.visible = false
	if hud_combo:
		hud_combo.visible = false

# ─── DETECCIÓN AUTOMÁTICA DE NUEVA SESIÓN ─────────────────────────────────────

func _on_new_session_detected(config: Dictionary) -> void:
	print("[VR] 🎮 ¡Nueva sesión detectada! Iniciando automáticamente...")
	if label_info:
		label_info.text = "¡SESIÓN DETECTADA! Iniciando..."
	waiting_mode = false
	firebase_manager.stop_polling()  # Detener polling
	_hide_waiting_ui()
	
	# Aplicar configuración
	GameManager.apply_config(config)
	
	# Cargar el game manager específico según game_id
	var game_id = config.get("game_id", "gems")
	_load_game_manager(game_id)
	
	# Mostrar countdown animado
	await _show_countdown()
	
	# Arrancar sesión
	if current_game_manager and current_game_manager.has_method("start_game"):
		current_game_manager.start_game()
	else:
		GameManager.start_session()

func _load_game_manager(game_id: String) -> void:
	print("[VR] 🎮 Cargando game manager para: ", game_id)
	
	# Limpiar game manager anterior si existe
	if current_game_manager:
		current_game_manager.queue_free()
		current_game_manager = null
	
	# Cargar el script apropiado según el juego
	var game_manager_script: GDScript = null
	
	match game_id:
		"gems":
			# Usar GameManager global (ya existe)
			print("[VR] ✅ Usando GameManager global para Recolectar Gemas")
			GameManager.session_started.connect(_on_session_started)
			GameManager.session_finished.connect(_on_session_finished)
			GameManager.gem_collected.connect(_on_gem_collected)
			GameManager.timer_updated.connect(_on_timer_updated)
			return  # No crear nuevo manager
		
		"vault_escape":
			game_manager_script = load("res://scenes/vault_game_manager.gd")
		
		"urban_attention_quest":
			game_manager_script = load("res://scenes/city_game_manager.gd")
		
		"luggage_handler":
			game_manager_script = load("res://scenes/luggage_game_manager.gd")
		
		_:
			print("[VR] ⚠️ Game ID desconocido: ", game_id, " - Usando gems por defecto")
			GameManager.session_started.connect(_on_session_started)
			GameManager.session_finished.connect(_on_session_finished)
			GameManager.gem_collected.connect(_on_gem_collected)
			GameManager.timer_updated.connect(_on_timer_updated)
			return
	
	# Crear instancia del game manager
	if game_manager_script:
		current_game_manager = Node.new()
		current_game_manager.set_script(game_manager_script)
		current_game_manager.name = "CurrentGameManager"
		add_child(current_game_manager)
		
		# Conectar señales comunes
		if current_game_manager.has_signal("game_started"):
			current_game_manager.game_started.connect(_on_session_started)
		if current_game_manager.has_signal("game_finished"):
			current_game_manager.game_finished.connect(_on_session_finished)
		if current_game_manager.has_signal("timer_updated"):
			current_game_manager.timer_updated.connect(_on_timer_updated)
		
		# Señales específicas por juego
		match game_id:
			"vault_escape":
				if current_game_manager.has_signal("panel_collected"):
					current_game_manager.panel_collected.connect(_on_panel_collected)
				if current_game_manager.has_signal("laser_hit"):
					current_game_manager.laser_hit.connect(_on_laser_hit)
			
			"urban_attention_quest":
				if current_game_manager.has_signal("target_collected"):
					current_game_manager.target_collected.connect(_on_target_collected)
			
			"luggage_handler":
				if current_game_manager.has_signal("luggage_placed"):
					current_game_manager.luggage_placed.connect(_on_luggage_placed)
		
		print("[VR] ✅ Game manager cargado: ", game_id)

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
	print("[VR] [AUTO-START] Iniciando sesión de prueba en 3 segundos...")
	
	# Configuración de prueba (puedes cambiar game_id para probar cada juego)
	var test_game_id = "gems"  # Cambiar a: vault_escape, urban_attention_quest, luggage_handler
	
	GameManager.apply_config({
		"patient_id":    "test",
		"patient_name":  "Prueba Local",
		"session_id":    "offline_" + str(Time.get_ticks_msec()),
		"duration":      180,
		"difficulty":    "Media",
		"therapy_side":  "Izquierdo",
		"session_type":  "Alcance",
		"game_id":       test_game_id,
	})
	
	# Cargar game manager apropiado
	_load_game_manager(test_game_id)
	
	# Mostrar countdown y arrancar
	_hide_waiting_ui()
	await get_tree().create_timer(1.0).timeout
	await _show_countdown()
	
	if current_game_manager and current_game_manager.has_method("start_game"):
		current_game_manager.start_game()
	else:
		GameManager.start_session()

func _on_session_started() -> void:
	print("[VR] ▶ Sesión iniciada | ", GameManager.difficulty, " | ", GameManager.therapy_side)
	_combo_count = 0
	_last_gem_time = 0.0
	
	if label_status:
		label_status.text = "¡SESIÓN ACTIVA!"
		label_status.modulate = Color(0.2, 1.0, 0.2)  # Verde
		await get_tree().create_timer(2.0).timeout
		label_status.visible = false
	if label_info:
		label_info.visible = false
	
	_show_game_hud()

func _on_gem_collected(gem_type: String, points: int, total: int) -> void:
	print("[VR] Gema: ", gem_type, " +", points, " → ", total, " pts")
	
	# Actualizar score HUD
	if hud_score:
		hud_score.text = "⭐ " + str(total)
		# Animación de pulso
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.3, 0.1)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.1)
	
	# Sistema de combos
	var current_time = Time.get_ticks_msec() / 1000.0
	if current_time - _last_gem_time < 2.0 and gem_type != "red":  # Menos de 2s entre gemas
		_combo_count += 1
		if _combo_count >= 3:
			_show_combo()
	else:
		_combo_count = 1
	
	_last_gem_time = current_time

# ─── CALLBACKS ESPECÍFICOS POR JUEGO ─────────────────────────────────────────

func _on_panel_collected(panel_id: int, points: int) -> void:
	print("[VR] Panel: ", panel_id, " +", points, " pts")
	if hud_score and current_game_manager:
		hud_score.text = "🔐 " + str(current_game_manager.score)
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.3, 0.1)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.1)

func _on_laser_hit() -> void:
	print("[VR] ⚡ Láser tocado!")
	if hud_instruction:
		hud_instruction.text = "¡CUIDADO CON EL LÁSER!"
		hud_instruction.modulate = Color(1.0, 0.0, 0.0)
		await get_tree().create_timer(1.0).timeout
		hud_instruction.modulate = Color(1.0, 1.0, 1.0)
		hud_instruction.text = ""

func _on_target_collected(target_id: int, points: int) -> void:
	print("[VR] Target: ", target_id, " +", points, " pts")
	if hud_score and current_game_manager:
		hud_score.text = "🎯 " + str(current_game_manager.score)
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.3, 0.1)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.1)

func _on_luggage_placed(zone: String, weight: float, points: int) -> void:
	print("[VR] Maleta colocada en ", zone, " (", weight, "kg) +", points, " pts")
	if hud_score and current_game_manager:
		hud_score.text = "📦 " + str(current_game_manager.score)
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.3, 0.1)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.1)

func _show_combo() -> void:
	if hud_combo:
		hud_combo.text = "x" + str(_combo_count) + " COMBO!"
		hud_combo.visible = true
		hud_combo.modulate = Color(1.0, 0.4, 0.0)
		
		# Animación de aparición y desaparición
		var tween = create_tween()
		tween.tween_property(hud_combo, "scale", Vector3.ONE * 1.5, 0.2).from(Vector3.ZERO)
		tween.tween_property(hud_combo, "modulate:a", 0.0, 0.5).set_delay(1.0)
		tween.tween_callback(func(): hud_combo.visible = false)

func _on_timer_updated(remaining: float) -> void:
	var m = int(remaining) / 60
	var s = int(remaining) % 60
	
	# Actualizar HUD timer
	if hud_timer:
		hud_timer.text = "⏱ %02d:%02d" % [m, s]
		
		# Cambiar color cuando queda poco tiempo
		if remaining < 30:
			hud_timer.modulate = Color(1.0, 0.2, 0.2)  # Rojo
		elif remaining < 60:
			hud_timer.modulate = Color(1.0, 0.8, 0.0)  # Amarillo
		else:
			hud_timer.modulate = Color(0.2, 1.0, 0.4)  # Verde

func _on_session_finished(results: Dictionary) -> void:
	print("[VR] 🏁 Sesión terminada — Puntos: ", results.get("score", 0))
	
	# Guardar resultados en Firestore
	firebase_manager.save_results(results)
	
	_hide_game_hud()
	
	# Mostrar mensaje de finalización
	if label_status:
		label_status.visible = true
		label_status.text = "✅ ¡SESIÓN COMPLETADA!"
		label_status.modulate = Color(0.2, 1.0, 0.4)
	if label_info:
		label_info.visible = true
		var game_type = results.get("game_type", "")
		match game_type:
			"vault_escape":
				label_info.text = "Score: " + str(results.get("score", 0)) + " | Paneles: " + str(results.get("panels_collected", 0))
			"urban_attention_quest":
				label_info.text = "Score: " + str(results.get("score", 0)) + " | Targets: " + str(results.get("targets_collected", 0))
			"luggage_handler":
				label_info.text = "Score: " + str(results.get("score", 0)) + " | Maletas: " + str(results.get("luggage_placed", 0))
			_:
				label_info.text = "Puntuación: " + str(results.get("score", 0)) + " pts | Precisión: " + str(results.get("accuracy", 0)) + "%"
	
	# Limpiar game manager actual
	if current_game_manager:
		current_game_manager.queue_free()
		current_game_manager = null
	
	# Limpiar sesión activa en Firestore para evitar auto-inicio
	print("[VR] 🧹 Limpiando sesión de Firestore...")
	_clear_firestore_session()
	
	# Volver a sala de espera después de 5 segundos
	await get_tree().create_timer(5.0).timeout
	print("[VR] 🔄 Volviendo a sala de espera...")
	waiting_mode = true
	_show_waiting_message()
	firebase_manager.start_polling()  # Reactivar polling para la siguiente sesión

func _clear_firestore_session() -> void:
	# Llamada HTTP DELETE para limpiar sesión activa
	var url = "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents/sesion_activa/current"
	var http = HTTPRequest.new()
	add_child(http)
	http.request(url, [], HTTPClient.METHOD_DELETE)
	await http.request_completed
	http.queue_free()
	print("[VR] ✅ Sesión limpiada de Firestore")
