extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VRStart — VERSIÓN ULTRA SIMPLE - SOLO JUEGO DE GEMAS
# Espera polling de Firestore → Detecta sesión → Inicia gemas
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null
var current_game_manager: Node = null  # Manager del juego actual (vault, city, luggage)
var waiting_mode := true

# UI Labels para feedback visual
@onready var label_status: Label3D = null
@onready var label_info: Label3D = null

# HUD Labels para juego
var hud_score: Label3D = null
var hud_timer: Label3D = null
var hud_instruction: Label3D = null
var hud_combo: Label3D = null
var hud_energy_bar: MeshInstance3D = null  # ⚡ Barra de energía visual
var hud_energy_label: Label3D = null  # ⚡ Texto de energía

var _combo_count: int = 0
var _last_gem_time: float = 0.0
var _ambient_audio: AudioStreamPlayer = null
var _countdown_label: Label3D = null

func _ready() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 💎 GEMS GAME — VR System INICIANDO ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[GemsVR] _ready() ejecutándose...")
	print("[GemsVR] Verificando GameManager...")
	if GameManager:
		print("[GemsVR] ✅ GameManager existe")
		print("[GemsVR] GameManager.patient_id = '", GameManager.patient_id, "'")
		print("[GemsVR] GameManager.session_id = '", GameManager.session_id, "'")
		print("[GemsVR] GameManager.game_type = '", GameManager.game_type, "'")
	else:
		print("[GemsVR] ❌ GameManager NO existe!")
	
	await get_tree().process_frame
	_init_openxr()
	_create_waiting_ui()
	_create_game_hud()
	_create_countdown_ui()
	_setup_ambient_audio()

	# Conectar señales de GameManager
	if not GameManager.session_started.is_connected(_on_session_started):
		GameManager.session_started.connect(_on_session_started)
	if not GameManager.session_finished.is_connected(_on_session_finished):
		GameManager.session_finished.connect(_on_session_finished)
	if not GameManager.gem_collected.is_connected(_on_gem_collected):
		GameManager.gem_collected.connect(_on_gem_collected)
	if not GameManager.timer_updated.is_connected(_on_timer_updated):
		GameManager.timer_updated.connect(_on_timer_updated)
	
	print("[GemsVR] ✅ Señales de GameManager conectadas")

	# Verificar si ya hay sesión configurada (vino desde Hub)
	if GameManager.session_id != "" and GameManager.patient_id != "":
		print("[GemsVR] 🎮 ¡Sesión ya configurada desde Hub!")
		print("[GemsVR] Session ID: ", GameManager.session_id)
		print("[GemsVR] Patient ID: ", GameManager.patient_id)
		print("[GemsVR] ⏱️ Iniciando countdown...")
		_hide_waiting_ui()
		await _show_countdown()
		print("[GemsVR] 🚀 Iniciando sesión...")
		GameManager.start_session()
		return  # No crear FirebaseManager ni hacer polling

	# Si NO hay sesión, entrar en modo sala de espera con polling
	print("[GemsVR] 🔍 No hay sesión configurada, creando FirebaseManager...")
	if has_node("FirebaseManager"):
		firebase_manager = get_node("FirebaseManager")
		print("[GemsVR] ✅ FirebaseManager encontrado en escena")
	else:
		print("[GemsVR] ⚙️ Creando FirebaseManager dinámicamente...")
		var script = load("res://scripts/firebase_manager.gd")
		firebase_manager = Node.new()
		firebase_manager.set_script(script)
		firebase_manager.name = "FirebaseManager"
		add_child(firebase_manager)
		print("[GemsVR] ✅ FirebaseManager creado")

	# Conectar señales de FirebaseManager
	print("[GemsVR] 🔌 Conectando señales de FirebaseManager...")
	firebase_manager.config_loaded.connect(_on_config_loaded)
	firebase_manager.config_error.connect(_on_config_error)
	firebase_manager.new_session_detected.connect(_on_new_session_detected)
	firebase_manager.results_saved.connect(func(): print("[VR] ✅ Resultados guardados"))
	firebase_manager.results_error.connect(func(e): print("[VR] ❌ Error: ", e))
	print("[GemsVR] ✅ Todas las señales conectadas")

	# SIEMPRE iniciar en modo sala de espera con polling
	print("[VR] 🏥 Entrando en sala de espera...")
	print("[VR] 👀 Esperando que el fisioterapeuta inicie sesión...")
	_show_waiting_message()
	print("[VR] 🔄 Iniciando polling de Firestore...")
	firebase_manager.start_polling()
	print("[VR] ✅ Polling activado")
	print("═══════════════════════════════════════════════════════════════")
	print("═══ ⏳ SALA DE ESPERA ACTIVA - POLLING FIRESTORE ═══")
	print("═══════════════════════════════════════════════════════════════")

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
	var xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	if not xr_camera:
		push_error("[VR Gems] No se encontró XRCamera3D!")
		return
	
	# Crear labels 3D hijos de la cámara para que siempre estén visibles
	label_status = Label3D.new()
	label_status.pixel_size = 0.002
	label_status.position = Vector3(0, 0.2, -1.5)
	label_status.font_size = 64
	label_status.modulate = Color(0.2, 0.8, 1.0)
	label_status.outline_size = 8
	label_status.outline_modulate = Color.BLACK
	label_status.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	xr_camera.add_child(label_status)
	
	label_info = Label3D.new()
	label_info.pixel_size = 0.002
	label_info.position = Vector3(0, -0.1, -1.5)
	label_info.font_size = 32
	label_info.modulate = Color(0.8, 0.8, 0.8)
	label_info.outline_size = 5
	label_info.outline_modulate = Color.BLACK
	label_info.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	xr_camera.add_child(label_info)
	
	print("[VR] ✅ UI de espera creada")

# ─── HUD DEL JUEGO ────────────────────────────────────────────────────────────

func _create_game_hud() -> void:
	var xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	if not xr_camera:
		return
	
	# Score (arriba izquierda)
	hud_score = Label3D.new()
	hud_score.pixel_size = 0.002
	hud_score.position = Vector3(-0.6, 0.4, -1.2)
	hud_score.font_size = 48
	hud_score.modulate = Color(1.0, 0.9, 0.0)
	hud_score.outline_size = 6
	hud_score.outline_modulate = Color.BLACK
	hud_score.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_score.visible = false
	xr_camera.add_child(hud_score)
	
	# Timer (arriba derecha)
	hud_timer = Label3D.new()
	hud_timer.pixel_size = 0.002
	hud_timer.position = Vector3(0.6, 0.4, -1.2)
	hud_timer.font_size = 48
	hud_timer.modulate = Color(0.2, 1.0, 0.4)
	hud_timer.outline_size = 6
	hud_timer.outline_modulate = Color.BLACK
	hud_timer.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_timer.visible = false
	xr_camera.add_child(hud_timer)
	
	# Instrucción actual (abajo centro)
	hud_instruction = Label3D.new()
	hud_instruction.pixel_size = 0.002
	hud_instruction.position = Vector3(0, -0.3, -1.5)
	hud_instruction.font_size = 28
	hud_instruction.modulate = Color(1.0, 1.0, 1.0)
	hud_instruction.outline_size = 4
	hud_instruction.outline_modulate = Color.BLACK
	hud_instruction.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_instruction.visible = false
	xr_camera.add_child(hud_instruction)
	
	# Combo multiplier (centro)
	hud_combo = Label3D.new()
	hud_combo.pixel_size = 0.002
	hud_combo.position = Vector3(0, 0.1, -1.2)
	hud_combo.font_size = 56
	hud_combo.modulate = Color(1.0, 0.4, 0.0)
	hud_combo.outline_size = 8
	hud_combo.outline_modulate = Color.BLACK
	hud_combo.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_combo.visible = false
	xr_camera.add_child(hud_combo)
	
	# ⚡ BARRA DE ENERGÍA (abajo izquierda) - MUY VISIBLE
	_create_energy_bar(xr_camera)

func _create_energy_bar(xr_camera: Node3D) -> void:
	# Contenedor para la barra
	var energy_container = Node3D.new()
	xr_camera.add_child(energy_container)
	energy_container.position = Vector3(-0.7, -0.4, -1.0)
	
	# Fondo de la barra (gris oscuro)
	var bg = MeshInstance3D.new()
	energy_container.add_child(bg)
	var bg_box = BoxMesh.new()
	bg_box.size = Vector3(0.4, 0.08, 0.01)
	bg.mesh = bg_box
	
	var bg_mat = StandardMaterial3D.new()
	bg_mat.albedo_color = Color(0.2, 0.2, 0.2, 0.8)
	bg_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bg_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bg.material_override = bg_mat
	
	# Barra de energía (verde/amarillo/rojo según nivel)
	hud_energy_bar = MeshInstance3D.new()
	energy_container.add_child(hud_energy_bar)
	hud_energy_bar.position = Vector3(0, 0, 0.01)  # Delante del fondo
	
	var bar_box = BoxMesh.new()
	bar_box.size = Vector3(0.38, 0.06, 0.01)  # Llena casi todo el fondo
	hud_energy_bar.mesh = bar_box
	
	var bar_mat = StandardMaterial3D.new()
	bar_mat.albedo_color = Color(0.2, 1.0, 0.3, 1.0)  # Verde
	bar_mat.emission_enabled = true
	bar_mat.emission = Color(0.2, 1.0, 0.3)
	bar_mat.emission_energy_multiplier = 2.0
	bar_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hud_energy_bar.material_override = bar_mat
	
	# Label de energía (porcentaje)
	hud_energy_label = Label3D.new()
	energy_container.add_child(hud_energy_label)
	hud_energy_label.position = Vector3(0, 0, 0.02)
	hud_energy_label.pixel_size = 0.002
	hud_energy_label.text = "⚡ 100%"
	hud_energy_label.font_size = 36
	hud_energy_label.modulate = Color.WHITE
	hud_energy_label.outline_size = 4
	hud_energy_label.outline_modulate = Color.BLACK
	hud_energy_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	
	# Conectar señal de cambio de energía
	if not GameManager.energy_changed.is_connected(_on_energy_changed):
		GameManager.energy_changed.connect(_on_energy_changed)
	
	print("[VR] ⚡ Barra de energía creada")

func _on_energy_changed(current: float, max_val: float) -> void:
	if not hud_energy_bar or not hud_energy_label:
		return
	
	var percentage = (current / max_val) * 100.0
	hud_energy_label.text = "⚡ " + str(int(percentage)) + "%"
	
	# Actualizar escala de la barra (de 0 a 1 en X)
	var scale_x = current / max_val
	hud_energy_bar.scale.x = max(0.05, scale_x)  # Mínimo 5% visible
	
	# Cambiar color según nivel
	var bar_mat = hud_energy_bar.material_override as StandardMaterial3D
	if bar_mat:
		if percentage > 50:
			# Verde
			bar_mat.albedo_color = Color(0.2, 1.0, 0.3, 1.0)
			bar_mat.emission = Color(0.2, 1.0, 0.3)
		elif percentage > 20:
			# Amarillo
			bar_mat.albedo_color = Color(1.0, 0.9, 0.0, 1.0)
			bar_mat.emission = Color(1.0, 0.9, 0.0)
		else:
			# Rojo (poca energía)
			bar_mat.albedo_color = Color(1.0, 0.2, 0.2, 1.0)
			bar_mat.emission = Color(1.0, 0.2, 0.2)
	
	# Si la energía está muy baja, hacer parpadear
	if percentage < 20:
		var tween = create_tween()
		tween.tween_property(hud_energy_label, "modulate:a", 0.3, 0.3)
		tween.tween_property(hud_energy_label, "modulate:a", 1.0, 0.3)

# ─── COUNTDOWN ANIMADO ────────────────────────────────────────────────────────

func _create_countdown_ui() -> void:
	var xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	if not xr_camera:
		return
	
	_countdown_label = Label3D.new()
	_countdown_label.pixel_size = 0.002
	_countdown_label.position = Vector3(0, 0, -1.2)
	_countdown_label.font_size = 144
	_countdown_label.modulate = Color(1.0, 1.0, 0.0)
	_countdown_label.outline_size = 16
	_countdown_label.outline_modulate = Color.BLACK
	_countdown_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_countdown_label.visible = false
	xr_camera.add_child(_countdown_label)

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
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🎮 NUEVA SESIÓN DETECTADA ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[VR] Config recibida:")
	print("  - patient_id:   ", config.get("patient_id", ""))
	print("  - session_id:   ", config.get("session_id", ""))
	print("  - game_id:      ", config.get("game_id", "gems"))
	print("  - difficulty:   ", config.get("difficulty", "Media"))
	print("  - duration:     ", config.get("duration", 180), "s")
	print("═══════════════════════════════════════════════════════════════")
	
	if label_info:
		label_info.text = "¡SESIÓN DETECTADA! Iniciando..."
		print("[VR] ✅ Label actualizado")
	
	waiting_mode = false
	firebase_manager.stop_polling()  # Detener polling
	print("[VR] ✅ Polling detenido")
	
	_hide_waiting_ui()
	print("[VR] ✅ UI de espera ocultada")
	
	# Aplicar configuración al GameManager GLOBAL primero
	print("[VR] 🔧 Aplicando configuración a GameManager...")
	GameManager.apply_config(config)
	print("[VR] ✅ Configuración aplicada")
	print("[VR] Verificación post-config:")
	print("  - GameManager.patient_id:  ", GameManager.patient_id)
	print("  - GameManager.session_id:  ", GameManager.session_id)
	print("  - GameManager.game_type:   ", GameManager.game_type)
	
	# Cargar el game manager específico según game_id
	var game_id = config.get("game_id", "gems")
	print("[VR] 🎮 Cargando game manager para: ", game_id)
	_load_game_manager(game_id)
	print("[VR] ✅ Game manager cargado")
	
	# Mostrar countdown animado
	print("[VR] ⏱️ Iniciando countdown...")
	await _show_countdown()
	print("[VR] ✅ Countdown completado")
	
	# CRÍTICO: Iniciar sesión en GameManager GLOBAL (esto dispara session_started)
	print("[VR] 🚀 Llamando GameManager.start_session()...")
	GameManager.start_session()
	print("[VR] ✅ start_session() ejecutado")
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🎮 SESIÓN INICIADA - JUEGO ACTIVO ═══")
	print("═══════════════════════════════════════════════════════════════")
	
	# Los game managers específicos escuchan session_started y arrancan automáticamente

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
			if not GameManager.session_started.is_connected(_on_session_started):
				GameManager.session_started.connect(_on_session_started)
			if not GameManager.session_finished.is_connected(_on_session_finished):
				GameManager.session_finished.connect(_on_session_finished)
			if not GameManager.gem_collected.is_connected(_on_gem_collected):
				GameManager.gem_collected.connect(_on_gem_collected)
			if not GameManager.timer_updated.is_connected(_on_timer_updated):
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
			if not GameManager.session_started.is_connected(_on_session_started):
				GameManager.session_started.connect(_on_session_started)
			if not GameManager.session_finished.is_connected(_on_session_finished):
				GameManager.session_finished.connect(_on_session_finished)
			if not GameManager.gem_collected.is_connected(_on_gem_collected):
				GameManager.gem_collected.connect(_on_gem_collected)
			if not GameManager.timer_updated.is_connected(_on_timer_updated):
				GameManager.timer_updated.connect(_on_timer_updated)
			return
	
	# Crear instancia del game manager
	if game_manager_script:
		current_game_manager = Node.new()
		current_game_manager.set_script(game_manager_script)
		current_game_manager.name = "CurrentGameManager"
		add_child(current_game_manager)
		
		# CRÍTICO: Conectar con GameManager global para que reciba session_started
		if not GameManager.session_started.is_connected(current_game_manager._on_session_started):
			GameManager.session_started.connect(current_game_manager._on_session_started)
		
		# Conectar señales comunes
		if current_game_manager.has_signal("game_started"):
			current_game_manager.game_started.connect(_on_session_started)
		if current_game_manager.has_signal("game_finished"):
			current_game_manager.game_finished.connect(_on_game_finished_wrapper)
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

# Wrapper para game_finished de los otros juegos para que también guarde en GameManager
func _on_game_finished_wrapper(results: Dictionary) -> void:
	print("[VR] 🏁 Juego terminado con métricas")
	# Pasar resultados a _on_session_finished para guardar en Firebase
	_on_session_finished(results)

func _on_config_loaded(config: Dictionary) -> void:
	# Esta función ya no se usa en el flujo principal
	# El flujo ahora es: polling → new_session_detected → auto-start
	print("[VR] Config recibida (modo legacy): ", config)
	GameManager.apply_config(config)
	await get_tree().create_timer(1.0).timeout
	GameManager.start_session()

func _on_config_error(_msg: String) -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ ⚠️ CONFIG ERROR (NO CRITICAL - POLLING ACTIVO) ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[VR] Mensaje de error: ", _msg)
	print("[VR] ℹ️ Esto NO es un error real si el polling está activo")
	print("[VR] ℹ️ El sistema está esperando sesión desde el portal web")
	print("[VR] ℹ️ El fisioterapeuta debe crear una sesión en:")
	print("[VR]     https://tfg-vr.web.app")
	print("═══════════════════════════════════════════════════════════════")
	
	# NO HACER NADA - el polling se encarga de detectar sesiones
	# Esta función solo se llama si se usa load_session_config() directamente
	# que ya NO usamos en el flujo principal

func _on_session_started() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ ▶️ VR_START: SESSION_STARTED RECIBIDA ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[VR] Iniciando juego...")
	print("[VR] Dificultad: ", GameManager.difficulty)
	print("[VR] Lado: ", GameManager.therapy_side)
	print("[VR] Duración: ", GameManager.session_duration, "s")
	
	_combo_count = 0
	_last_gem_time = 0.0
	
	if label_status:
		label_status.text = "¡SESIÓN ACTIVA!"
		label_status.modulate = Color(0.2, 1.0, 0.2)  # Verde
		print("[VR] ✅ Label status actualizado")
		await get_tree().create_timer(2.0).timeout
		label_status.visible = false
		print("[VR] ✅ Label status ocultado")
	if label_info:
		label_info.visible = false
		print("[VR] ✅ Label info ocultado")
	
	print("[VR] 📺 Mostrando HUD del juego...")
	_show_game_hud()
	print("[VR] ✅ HUD mostrado")
	print("═══════════════════════════════════════════════════════════════")
	print("═══ ✅ JUEGO ACTIVO - HUD VISIBLE ═══")
	print("═══════════════════════════════════════════════════════════════")

func _on_gem_collected(gem_type: String, points: int, total: int) -> void:
	print("[VR] Gema: ", gem_type, " +", points, " → ", total, " pts")
	
	# Actualizar score HUD
	if hud_score:
		hud_score.text = str(total) + " pts"
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
		hud_score.text = str(current_game_manager.score) + " pts"
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
		hud_score.text = str(current_game_manager.score) + " pts"
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.3, 0.1)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.1)

func _on_luggage_placed(zone: String, weight: float, points: int) -> void:
	print("[VR] Maleta colocada en ", zone, " (", weight, "kg) +", points, " pts")
	if hud_score and current_game_manager:
		hud_score.text = str(current_game_manager.score) + " pts"
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
		hud_timer.text = "%02d:%02d" % [m, s]
		
		# Cambiar color cuando queda poco tiempo
		if remaining < 30:
			hud_timer.modulate = Color(1.0, 0.2, 0.2)  # Rojo
		elif remaining < 60:
			hud_timer.modulate = Color(1.0, 0.8, 0.0)  # Amarillo
		else:
			hud_timer.modulate = Color(0.2, 1.0, 0.4)  # Verde

func _on_session_finished(results: Dictionary) -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🏁 VR_START: SESSION_FINISHED RECIBIDA ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[VR] Puntos finales: ", results.get("score", 0))
	print("[VR] Gemas recolectadas: ", results.get("gems_collected", 0))
	
	# Guardar resultados en Firestore
	if firebase_manager:
		print("[VR] 💾 Guardando resultados en Firebase...")
		firebase_manager.save_results(results)
	else:
		print("[VR] ⚠️ Firebase Manager no existe, no se guardan resultados")
	
	_hide_game_hud()
	print("[VR] ✅ HUD ocultado")
	
	# Mostrar mensaje de finalización
	if label_status:
		label_status.visible = true
		label_status.text = "✅ ¡SESIÓN COMPLETADA!"
		label_status.modulate = Color(0.2, 1.0, 0.4)
		print("[VR] ✅ Label status mostrado")
	if label_info:
		label_info.visible = true
		label_info.text = "Puntuación: " + str(results.get("score", 0)) + " pts | Gemas: " + str(results.get("gems_collected", 0))
		print("[VR] ✅ Label info mostrado: ", label_info.text)
	
	# Limpiar game manager actual
	if current_game_manager:
		current_game_manager.queue_free()
		current_game_manager = null
		print("[VR] ✅ Game manager limpiado")
	
	# Limpiar sesión activa en Firestore para evitar auto-inicio
	if firebase_manager:
		print("[VR] 🧹 Limpiando sesión de Firestore...")
		
		# CRÍTICO: Primero marcar como completed para que Hub no la detecte
		print("[VR] 🔒 Paso 1/2: Marcar sesión como completed...")
		await firebase_manager.mark_session_completed()
		
		# Esperar 0.5s adicional para asegurar que Firestore procesó el PATCH
		await get_tree().create_timer(0.5).timeout
		
		# Ahora sí DELETE
		print("[VR] 🗑️ Paso 2/2: Eliminar sesión...")
		await _clear_firestore_session()  # ESPERAR a que termine la limpieza
		print("[VR] ✅ Sesión limpiada completamente (completed + deleted)")
		
		print("[VR] 🛑 Deteniendo polling de Firebase...")
		firebase_manager.stop_polling()
		print("[VR] ✅ Polling detenido")
	else:
		print("[VR] ⚠️ Firebase Manager no existe, saltando limpieza")
	
	# Esperar 3 segundos antes de regresar
	print("[VR] ⏱️ Esperando 3 segundos antes de regresar...")
	await get_tree().create_timer(3.0).timeout
	
	# Regresar al HubWorld (igual que CityWorld)
	print("[VR] 🔄 Regresando al HubWorld...")
	print("═══════════════════════════════════════════════════════════════")
	get_tree().change_scene_to_file("res://HubWorld.tscn")

func _clear_firestore_session() -> void:
	print("[VR] 🗑️ Iniciando DELETE de sesión activa en Firestore...")
	var url = "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents/sesion_activa/current"
	var http = HTTPRequest.new()
	add_child(http)
	
	print("[VR] 📡 Enviando DELETE a: ", url)
	var error = http.request(url, [], HTTPClient.METHOD_DELETE)
	
	if error != OK:
		print("[VR] ❌ Error al enviar DELETE: ", error)
	else:
		print("[VR] ✅ DELETE enviado correctamente, esperando respuesta...")
	
	var response = await http.request_completed
	var result = response[0]
	var code = response[1]
	
	print("[VR] 📩 Respuesta recibida - Result: ", result, " | HTTP Code: ", code)
	
	if code == 200 or code == 204:
		print("[VR] ✅✅✅ SESIÓN ELIMINADA DE FIRESTORE CORRECTAMENTE ✅✅✅")
	else:
		print("[VR] ⚠️ Respuesta inesperada del servidor (puede ser que ya estaba eliminada)")
	
	http.queue_free()
	print("[VR] 🧹 Proceso de limpieza completado")
