extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VaultVRStart — Sistema VR para Laser Vault Escape
# Integra VR, UI, y coordinación con VaultGameManager
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null
var vault_manager: Node = null
var waiting_mode := true

# UI Labels
@onready var label_status: Label3D = null
@onready var label_info: Label3D = null
@onready var hud_score: Label3D = null
@onready var hud_timer: Label3D = null
@onready var hud_instruction: Label3D = null
@onready var hud_laser_hits: Label3D = null

var _countdown_label: Label3D = null
var _ambient_audio: AudioStreamPlayer = null

func _ready() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🔐 LASER VAULT ESCAPE — VR System INICIANDO ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[VaultVR] _ready() ejecutándose...")
	print("[VaultVR] Verificando GameManager...")
	if GameManager:
		print("[VaultVR] ✅ GameManager existe")
		print("[VaultVR] GameManager.patient_id = '", GameManager.patient_id, "'")
		print("[VaultVR] GameManager.session_id = '", GameManager.session_id, "'")
		print("[VaultVR] GameManager.game_type = '", GameManager.game_type, "'")
	else:
		print("[VaultVR] ❌ GameManager NO existe!")
	
	await get_tree().process_frame
	_init_openxr()
	_create_waiting_ui()
	_create_game_hud()
	_create_countdown_ui()
	_setup_ambient_audio()
	
	# Obtener VaultGameManager
	vault_manager = get_node_or_null("VaultGameManager")
	if not vault_manager:
		push_error("[VaultVR] VaultGameManager no encontrado!")
		return
	
	# Conectar señales del VaultGameManager
	vault_manager.game_started.connect(_on_game_started)
	vault_manager.game_finished.connect(_on_game_finished)
	vault_manager.laser_dodged.connect(_on_laser_dodged)
	vault_manager.laser_hit.connect(_on_laser_hit)
	vault_manager.timer_updated.connect(_on_timer_updated)
	
	# Conectar GameManager global
	GameManager.session_started.connect(_on_session_started)
	GameManager.session_finished.connect(_on_session_finished)
	
	# Crear FirebaseManager si no existe
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
	firebase_manager.results_saved.connect(func(): print("[VaultVR] ✅ Resultados guardados"))
	firebase_manager.results_error.connect(func(e): print("[VaultVR] ❌ Error: ", e))
	
	# SIEMPRE iniciar en modo sala de espera con polling
	print("[VaultVR] 🏥 Entrando en sala de espera...")
	_show_waiting_message()
	firebase_manager.start_polling()

func _init_openxr() -> void:
	var xr = XRServer.find_interface("OpenXR")
	if xr == null:
		print("[VaultVR] OpenXR no disponible — modo escritorio")
		return
	if not xr.is_initialized():
		xr.initialize()
	if xr.is_initialized():
		get_viewport().use_xr = true
		print("[VaultVR] ✅ OpenXR activo")

# ─── UI DE SALA DE ESPERA ─────────────────────────────────────────────────────

func _create_waiting_ui() -> void:
	var xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	if not xr_camera:
		return
	
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

func _create_game_hud() -> void:
	var xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	if not xr_camera:
		return
	
	print("[VaultVR] 🎨 Creando HUD del juego...")
	
	# Score (arriba izquierda) - IGUAL QUE CITYWORLD
	hud_score = Label3D.new()
	hud_score.pixel_size = 0.002
	hud_score.position = Vector3(-0.6, 0.4, -1.2)
	hud_score.font_size = 48
	hud_score.modulate = Color(1.0, 0.9, 0.0)
	hud_score.outline_size = 6
	hud_score.outline_modulate = Color.BLACK
	hud_score.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_score.visible = false
	hud_score.text = "0 pts"
	xr_camera.add_child(hud_score)
	print("[VaultVR]   ✅ Score HUD creado")
	
	# Timer (arriba derecha) - MÁS VISIBLE IGUAL QUE CITYWORLD
	hud_timer = Label3D.new()
	hud_timer.pixel_size = 0.002
	hud_timer.position = Vector3(0.6, 0.4, -1.2)
	hud_timer.font_size = 56  # MÁS GRANDE
	hud_timer.modulate = Color(0.2, 1.0, 0.4)
	hud_timer.outline_size = 8  # BORDE MÁS GRUESO
	hud_timer.outline_modulate = Color.BLACK
	hud_timer.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_timer.visible = false
	hud_timer.text = "03:00"
	xr_camera.add_child(hud_timer)
	print("[VaultVR]   ✅ Timer HUD creado")
	
	# Instrucción (abajo centro) - IGUAL QUE CITYWORLD
	hud_instruction = Label3D.new()
	hud_instruction.pixel_size = 0.002
	hud_instruction.position = Vector3(0, -0.3, -1.5)
	hud_instruction.font_size = 32
	hud_instruction.modulate = Color(1.0, 1.0, 1.0)
	hud_instruction.outline_size = 4
	hud_instruction.outline_modulate = Color.BLACK
	hud_instruction.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_instruction.visible = false
	xr_camera.add_child(hud_instruction)
	print("[VaultVR]   ✅ Instruction HUD creado")
	
	# Indicador de vidas (centro superior)
	hud_laser_hits = Label3D.new()
	hud_laser_hits.pixel_size = 0.002
	hud_laser_hits.position = Vector3(0, 0.5, -1.2)
	hud_laser_hits.font_size = 40
	hud_laser_hits.modulate = Color(1.0, 0.2, 0.2)
	hud_laser_hits.outline_size = 6
	hud_laser_hits.outline_modulate = Color.BLACK
	hud_laser_hits.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_laser_hits.visible = false
	xr_camera.add_child(hud_laser_hits)
	print("[VaultVR]   ✅ Lives HUD creado")
	
	print("[VaultVR] ✅ HUD completo inicializado")

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
		
		var tween = create_tween()
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 2.0, 0.3).from(Vector3.ZERO)
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 1.5, 0.3)
		
		_play_countdown_beep(i)
		await get_tree().create_timer(1.0).timeout
	
	_countdown_label.text = "¡ESCAPE!"
	_countdown_label.modulate = Color(1.0, 0.0, 0.0)
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
	_ambient_audio.volume_db = -20.0  # Muy bajo para ambiente de tensión

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
	print("[VaultVR] 👁️ Mostrando HUD del juego...")
	if hud_score:
		hud_score.visible = true
		hud_score.text = "0 pts"
		print("[VaultVR]   ✅ Score visible")
	if hud_timer:
		hud_timer.visible = true
		print("[VaultVR]   ✅ Timer visible")
	if hud_instruction:
		hud_instruction.visible = true
		hud_instruction.text = "¡Esquiva los láseres que vienen hacia ti!"
		print("[VaultVR]   ✅ Instruction visible")
	if hud_laser_hits:
		hud_laser_hits.visible = true
		hud_laser_hits.text = "⚡ Toques: 0"
		print("[VaultVR]   ✅ Hit counter visible")

func _hide_game_hud() -> void:
	if hud_score:
		hud_score.visible = false
	if hud_timer:
		hud_timer.visible = false
	if hud_instruction:
		hud_instruction.visible = false
	if hud_laser_hits:
		hud_laser_hits.visible = false

# ─── EVENTOS DE SESIÓN ────────────────────────────────────────────────────────

func _on_new_session_detected(config: Dictionary) -> void:
	print("[VaultVR] 🎮 Nueva sesión detectada!")
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
	print("[VaultVR] Iniciando sesión de prueba...")
	GameManager.apply_config({
		"patient_id": "test",
		"patient_name": "Prueba Vault",
		"session_id": "vault_" + str(Time.get_ticks_msec()),
		"duration": 180,
		"difficulty": "Media",
		"therapy_side": "Ambos",
		"session_type": "Coordinación",
		"game_id": "vault_escape",
	})
	
	_hide_waiting_ui()
	await get_tree().create_timer(1.0).timeout
	await _show_countdown()
	GameManager.start_session()

func _on_session_started() -> void:
	print("[VaultVR] ▶ Sesión iniciada")
	_show_game_hud()
	if label_status:
		label_status.text = "¡ESQUIVA LOS LÁSERES!"
		label_status.modulate = Color(1.0, 0.0, 0.0)
		label_status.visible = true
		await get_tree().create_timer(2.0).timeout
		label_status.visible = false

func _on_game_started() -> void:
	print("[VaultVR] 🔐 Vault game started")

func _on_laser_dodged(points: int) -> void:
	# Láser esquivado exitosamente
	if hud_score and vault_manager:
		hud_score.text = str(vault_manager.score) + " pts"
		print("[VaultVR] ✅ Láser esquivado! +", points, " pts | Total: ", vault_manager.score)
		
		# Feedback visual
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.5, 0.15).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.15)
		
		# Flash verde (éxito)
		var original_color = hud_score.modulate
		hud_score.modulate = Color(0.2, 1.0, 0.3)
		
		var color_tween = create_tween()
		color_tween.tween_property(hud_score, "modulate", original_color, 0.5).set_delay(0.2)

func _on_laser_hit(laser: Node) -> void:
	if not hud_laser_hits or not vault_manager:
		return
	
	# Mostrar contador de toques (sin límite)
	hud_laser_hits.text = "⚡ Toques: " + str(vault_manager.laser_hits)
	hud_laser_hits.modulate = Color(1.0, 0.2, 0.2)
	
	# Flash rojo en la pantalla
	_screen_flash_red()
	
	print("[VaultVR] ⚡ Láser tocado!")

func _screen_flash_red() -> void:
	# Crear un panel rojo que cubra la pantalla
	var flash = ColorRect.new()
	get_tree().root.add_child(flash)
	flash.color = Color(1.0, 0.0, 0.0, 0.3)
	flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	
	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0.0, 0.5)
	tween.tween_callback(flash.queue_free)

func _on_timer_updated(remaining: float) -> void:
	if hud_timer:
		var m = int(remaining) / 60
		var s = int(remaining) % 60
		hud_timer.text = "%02d:%02d" % [m, s]
		
		# Cambiar color según tiempo restante - IGUAL QUE CITYWORLD
		if remaining < 30:
			hud_timer.modulate = Color(1.0, 0.2, 0.2)
		elif remaining < 60:
			hud_timer.modulate = Color(1.0, 0.8, 0.0)
		else:
			hud_timer.modulate = Color(0.2, 1.0, 0.4)

func _on_game_finished(results: Dictionary) -> void:
	print("[VaultVR] 🏁 Juego terminado")
	_hide_game_hud()
	
	# Guardar en Firebase
	firebase_manager.save_results(results)
	
	# Mostrar resultado
	if label_status:
		label_status.visible = true
		var dodge_rate = results.get("dodge_rate_percentage", 0)
		if dodge_rate >= 80:
			label_status.text = "🎉 ¡EXCELENTE!"
			label_status.modulate = Color(0.2, 1.0, 0.2)
		elif dodge_rate >= 50:
			label_status.text = "✅ ¡BIEN HECHO!"
			label_status.modulate = Color(0.2, 1.0, 0.8)
		else:
			label_status.text = "⏰ TIEMPO AGOTADO"
			label_status.modulate = Color(1.0, 0.5, 0.0)
	
	if label_info:
		label_info.visible = true
		label_info.text = "Score: " + str(results.get("score", 0)) + " | Esquivados: " + str(results.get("lasers_dodged", 0)) + " | Tocados: " + str(results.get("laser_hits", 0))
	
	print("[VaultVR] 🧹 Limpiando sesión activa de Firestore...")
	
	# CRÍTICO: Primero marcar como completed para que Hub no la detecte
	if firebase_manager:
		print("[VaultVR] 🔒 Paso 1/2: Marcar sesión como completed...")
		await firebase_manager.mark_session_completed()
		await get_tree().create_timer(0.5).timeout
	
	# Ahora sí DELETE
	print("[VaultVR] 🗑️ Paso 2/2: Eliminar sesión...")
	await _clear_firestore_session()  # ESPERAR a que termine la limpieza
	print("[VaultVR] ✅ Sesión limpiada completamente (completed + deleted)")
	
	print("[VaultVR] 🛑 Deteniendo polling de Firebase...")
	if firebase_manager:
		firebase_manager.stop_polling()
		print("[VaultVR] ✅ Polling detenido")
	
	await get_tree().create_timer(8.0).timeout
	print("[VaultVR] 🔄 Regresando al HubWorld...")
	get_tree().change_scene_to_file("res://HubWorld.tscn")

func _on_session_finished(results: Dictionary) -> void:
	pass  # Manejado por _on_game_finished

func _clear_firestore_session() -> void:
	var url = "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents/sesion_activa/current"
	var http = HTTPRequest.new()
	add_child(http)
	http.request(url, [], HTTPClient.METHOD_DELETE)
	await http.request_completed
	http.queue_free()
	print("[VaultVR] ✅ Sesión limpiada")
