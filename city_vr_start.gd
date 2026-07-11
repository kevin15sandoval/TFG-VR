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

var _gaze_time: float = 0.0
var _required_gaze_time: float = 2.0  # 2 segundos mirando
var _being_gazed: bool = false

var _xr_camera: XRCamera3D = null

func _ready() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🏙️ URBAN ATTENTION QUEST — VR System INICIANDO ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[CityVR] _ready() ejecutándose...")
	print("[CityVR] Verificando GameManager...")
	if GameManager:
		print("[CityVR] ✅ GameManager existe")
		print("[CityVR] GameManager.patient_id = '", GameManager.patient_id, "'")
		print("[CityVR] GameManager.session_id = '", GameManager.session_id, "'")
		print("[CityVR] GameManager.game_type = '", GameManager.game_type, "'")
	else:
		print("[CityVR] ❌ GameManager NO existe!")
	
	await get_tree().process_frame
	_init_openxr()
	_setup_vr_quality()  # NUEVO: Configurar calidad VR para evitar throttling
	_create_waiting_ui()
	_create_game_hud()
	# Countdown eliminado - causaba crashes en Meta Quest
	
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
	
	# SIEMPRE iniciar en modo sala de espera con polling
	print("[CityVR] 🏥 Entrando en sala de espera...")
	_show_waiting_message()
	firebase_manager.start_polling()

func _process(_delta: float) -> void:
	# Actualizar posición del jugador en el manager
	if city_manager and _xr_camera:
		city_manager.update_player_position(_xr_camera.global_position)
		city_manager.update_head_rotation(_xr_camera.global_transform)

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

func _setup_vr_quality() -> void:
	print("[CityVR] 🎨 Configurando calidad VR para prevenir throttling...")
	
	var xr_interface = XRServer.find_interface("OpenXR")
	if not xr_interface:
		print("[CityVR] ⚠️ OpenXR no disponible, saltando configuración de calidad")
		return
	
	# ═══ SOLUCIÓN ANTI-THROTTLING ═══
	# CityWorld (procedural_city_5.glb) es MUY pesado, igual que HubWorld
	# Usar EXACTAMENTE la misma configuración que funcionó en HubWorld
	
	# 1. Eliminar super-sampling (1.7x → 1.0x nativo)
	var viewport = get_viewport()
	if viewport:
		viewport.scaling_3d_scale = 1.0  # Resolución nativa, sin super-sampling
		print("[CityVR]   ✅ Super-sampling: DESACTIVADO (1.0x nativo)")
	
	# 2. Activar Foveated Rendering (CRÍTICO para escenas pesadas)
	if xr_interface.is_foveation_supported():
		xr_interface.foveation_level = 2  # Medio (balance perfecto)
		xr_interface.foveation_dynamic = true  # Se adapta a la carga
		print("[CityVR]   ✅ Foveated Rendering: NIVEL 2 (medio, dinámico)")
	else:
		print("[CityVR]   ⚠️ Foveated Rendering no soportado")
	
	# 3. MSAA optimizado (8x → 4x)
	if viewport:
		viewport.msaa_3d = Viewport.MSAA_4X  # Reduce carga sin perder mucha calidad
		print("[CityVR]   ✅ MSAA: 4X (optimizado)")
		
		# Anti-aliasing adicional (TAA + FXAA)
		viewport.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
		viewport.use_taa = true
		print("[CityVR]   ✅ TAA + FXAA: ACTIVADO")
	
	print("[CityVR] ✅ Configuración VR optimizada para escenas pesadas")
	print("[CityVR]   → Previene sobrecalentamiento y throttling")
	print("[CityVR]   → Calidad estable durante toda la sesión")

func _register_targets() -> void:
	var targets_node = get_node_or_null("UrbanTargets")
	if targets_node:
		for target in targets_node.get_children():
			city_manager.register_target(target)
		print("[CityVR] ✅ Registrados ", targets_node.get_child_count(), " targets urbanos")

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
	if not _xr_camera:
		_xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	if not _xr_camera:
		print("[CityVR] ❌ ERROR: No se encontró XRCamera3D para crear HUD")
		return
	
	print("[CityVR] 🎨 Creando HUD del juego...")
	
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
	hud_score.text = "0 pts"
	_xr_camera.add_child(hud_score)
	print("[CityVR]   ✅ Score HUD creado")
	
	# Timer (arriba derecha) - MÁS VISIBLE
	hud_timer = Label3D.new()
	hud_timer.pixel_size = 0.002
	hud_timer.position = Vector3(0.6, 0.4, -1.2)
	hud_timer.font_size = 56  # MÁS GRANDE
	hud_timer.modulate = Color(0.2, 1.0, 0.4)
	hud_timer.outline_size = 8  # BORDE MÁS GRUESO
	hud_timer.outline_modulate = Color.BLACK
	hud_timer.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_timer.visible = false
	hud_timer.text = "03:00"  # Texto inicial
	_xr_camera.add_child(hud_timer)
	print("[CityVR]   ✅ Timer HUD creado")
	
	# Instrucción (abajo centro)
	hud_instruction = Label3D.new()
	hud_instruction.pixel_size = 0.002
	hud_instruction.position = Vector3(0, -0.3, -1.5)
	hud_instruction.font_size = 32
	hud_instruction.modulate = Color(1.0, 1.0, 1.0)
	hud_instruction.outline_size = 4
	hud_instruction.outline_modulate = Color.BLACK
	hud_instruction.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_instruction.visible = false
	_xr_camera.add_child(hud_instruction)
	print("[CityVR]   ✅ Instruction HUD creado")
	
	# Secuencia actual (centro superior)
	hud_sequence = Label3D.new()
	hud_sequence.pixel_size = 0.002
	hud_sequence.position = Vector3(0, 0.5, -1.2)
	hud_sequence.font_size = 56
	hud_sequence.modulate = Color(0.2, 0.8, 1.0)
	hud_sequence.outline_size = 8
	hud_sequence.outline_modulate = Color.BLACK
	hud_sequence.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_sequence.visible = false
	_xr_camera.add_child(hud_sequence)
	print("[CityVR]   ✅ Sequence HUD creado")
	
	# Indicador de asimetría (negligencia) (abajo)
	hud_asymmetry = Label3D.new()
	hud_asymmetry.pixel_size = 0.002
	hud_asymmetry.position = Vector3(0, -0.5, -1.5)
	hud_asymmetry.font_size = 28
	hud_asymmetry.modulate = Color(1.0, 0.8, 0.2)
	hud_asymmetry.outline_size = 4
	hud_asymmetry.outline_modulate = Color.BLACK
	hud_asymmetry.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hud_asymmetry.visible = false
	_xr_camera.add_child(hud_asymmetry)
	print("[CityVR]   ✅ Asymmetry HUD creado")
	
	print("[CityVR] ✅ HUD completo inicializado")

var _countdown_label: Label3D = null

func _create_countdown_ui() -> void:
	if not _xr_camera:
		_xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
	if not _xr_camera:
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
	_xr_camera.add_child(_countdown_label)

func _show_countdown() -> void:
	# Crear countdown UI si no existe
	if not _countdown_label:
		if not _xr_camera:
			_xr_camera = get_node_or_null("XROrigin3D/XRCamera3D")
		if not _xr_camera:
			print("[CityVR] ❌ No se puede crear countdown, XRCamera3D no encontrada")
			return
		
		_countdown_label = Label3D.new()
		_countdown_label.pixel_size = 0.003
		_countdown_label.position = Vector3(0, 0, -1.5)
		_countdown_label.font_size = 144
		_countdown_label.modulate = Color(1.0, 1.0, 0.0)
		_countdown_label.outline_size = 16
		_countdown_label.outline_modulate = Color.BLACK
		_countdown_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_countdown_label.visible = false
		_xr_camera.add_child(_countdown_label)
	
	print("[CityVR] 🎬 Iniciando countdown VISUAL (sin audio)...")
	_countdown_label.visible = true
	_countdown_label.scale = Vector3.ONE
	
	# Countdown: 3, 2, 1
	for i in range(3, 0, -1):
		print("[CityVR] Countdown: ", i)
		_countdown_label.text = str(i)
		_countdown_label.modulate = Color(1.0, 0.3, 0.0) if i == 1 else Color(1.0, 1.0, 0.0)
		
		# Animación de escala
		var tween = create_tween()
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 2.5, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tween.tween_property(_countdown_label, "scale", Vector3.ONE * 1.8, 0.7).set_trans(Tween.TRANS_SINE)
		
		await get_tree().create_timer(1.0).timeout
	
	# ¡EXPLORA!
	print("[CityVR] Countdown: ¡EXPLORA!")
	_countdown_label.text = "¡EXPLORA!"
	_countdown_label.modulate = Color(0.2, 1.0, 0.8)
	
	var tween = create_tween()
	tween.tween_property(_countdown_label, "scale", Vector3.ONE * 3.5, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	
	await get_tree().create_timer(1.0).timeout
	_countdown_label.visible = false
	print("[CityVR] ✅ Countdown completado")

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
	print("[CityVR] 👁️ Mostrando HUD del juego...")
	if hud_score:
		hud_score.visible = true
		print("[CityVR]   ✅ Score visible")
	else:
		print("[CityVR]   ❌ hud_score es null!")
		
	if hud_timer:
		hud_timer.visible = true
		print("[CityVR]   ✅ Timer visible")
	else:
		print("[CityVR]   ❌ hud_timer es null!")
		
	if hud_instruction:
		hud_instruction.visible = true
		hud_instruction.text = "¡Mira las señales 2 segundos para activarlas!"
		print("[CityVR]   ✅ Instruction visible")
	else:
		print("[CityVR]   ❌ hud_instruction es null!")
		
	if hud_sequence:
		hud_sequence.visible = true
		print("[CityVR]   ✅ Sequence visible")
	else:
		print("[CityVR]   ❌ hud_sequence es null!")
		
	if hud_asymmetry:
		hud_asymmetry.visible = true
		print("[CityVR]   ✅ Asymmetry visible")
	else:
		print("[CityVR]   ❌ hud_asymmetry es null!")

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
	
	# RESTAURAR COUNTDOWN VISUAL (sin audio para evitar crashes)
	await get_tree().create_timer(0.5).timeout
	await _show_countdown()
	
	GameManager.start_session()

func _on_config_loaded(config: Dictionary) -> void:
	GameManager.apply_config(config)
	await get_tree().create_timer(0.5).timeout
	await _show_countdown()
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
	await get_tree().create_timer(0.5).timeout
	await _show_countdown()
	GameManager.start_session()

func _on_session_started() -> void:
	print("[CityVR] ▶ Sesión iniciada")
	_show_game_hud()
	
	# Inicializar score en 0
	if hud_score:
		hud_score.text = "0 pts"
		print("[CityVR] Score HUD inicializado: 0 pts")
	
	if label_status:
		label_status.text = "¡EXPLORANDO!"
		label_status.modulate = Color(0.2, 1.0, 0.8)
		label_status.visible = true
		await get_tree().create_timer(2.0).timeout
		label_status.visible = false
	# OCULTAR label_info también
	if label_info:
		label_info.visible = false

func _on_game_started() -> void:
	print("[CityVR] 🏙️ Urban Attention Quest iniciado")

func _on_target_collected(target_id: int, points: int) -> void:
	if hud_score and city_manager:
		hud_score.text = str(city_manager.score) + " pts"
		print("[CityVR] 🎯 Score actualizado: ", city_manager.score, " pts")
		
		# Feedback visual más fuerte
		var tween = create_tween()
		tween.tween_property(hud_score, "scale", Vector3.ONE * 1.5, 0.15).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tween.tween_property(hud_score, "scale", Vector3.ONE, 0.15)
		
		# Flash de color según puntos
		var original_color = hud_score.modulate
		if points >= 30:  # Rojo
			hud_score.modulate = Color(1.0, 0.2, 0.2)
		elif points >= 20:  # Amarillo
			hud_score.modulate = Color(1.0, 0.9, 0.2)
		else:  # Verde
			hud_score.modulate = Color(0.2, 1.0, 0.3)
		
		var color_tween = create_tween()
		color_tween.tween_property(hud_score, "modulate", original_color, 0.5).set_delay(0.2)
	
	# Actualizar número de secuencia
	if hud_sequence and city_manager:
		hud_sequence.text = "Siguiente: " + str(city_manager.get_next_sequence_number())
	
	# Actualizar asimetría
	_update_asymmetry_display()
	
	print("[CityVR] ✅ Target ", target_id, " +", points, " pts | Total: ", city_manager.score if city_manager else 0)

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
	if not hud_timer or not city_manager:
		return
	
	# Mostrar diferente en fase de reconocimiento
	if city_manager.recognition_phase:
		var m = int(remaining) / 60
		var s = int(remaining) % 60
		hud_timer.text = "🔍 RECONOCIENDO %02d:%02d" % [m, s]
		hud_timer.modulate = Color(0.2, 0.8, 1.0)  # Azul
		
		if hud_instruction:
			hud_instruction.text = "Observa el entorno. El ejercicio comenzará pronto..."
	else:
		var m = int(remaining) / 60
		var s = int(remaining) % 60
		hud_timer.text = "%02d:%02d" % [m, s]
		
		if remaining < 30:
			hud_timer.modulate = Color(1.0, 0.2, 0.2)
		elif remaining < 60:
			hud_timer.modulate = Color(1.0, 0.8, 0.0)
		else:
			hud_timer.modulate = Color(0.2, 1.0, 0.4)

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
	print("[CityVR] 🔄 Regresando al HubWorld...")
	
	# Regresar al HubWorld
	get_tree().change_scene_to_file("res://HubWorld.tscn")

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
