extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VRStart — Sistema de auto-arranque con sala de espera
# El juego espera en modo polling hasta que el fisioterapeuta inicie una sesión
# Incluye HUD con score, timer y feedback visual
# ─────────────────────────────────────────────────────────────────────────────

var firebase_manager: Node = null
var waiting_mode := true  # Modo sala de espera activo

# UI Labels para feedback visual
@onready var label_status: Label3D = null
@onready var label_info: Label3D = null

# HUD Labels para juego
var hud_score: Label3D = null
var hud_timer: Label3D = null
var hud_instruction: Label3D = null
var hud_combo: Label3D = null

var _combo_count: int = 0
var _last_gem_time: float = 0.0

func _ready() -> void:
	print("=== NeuroVR Rehab — Sistema de Auto-Arranque ===")
	await get_tree().process_frame
	_init_openxr()
	_create_waiting_ui()
	_create_game_hud()

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
	label_status.outline_size = 8
	label_status.outline_modulate = Color.BLACK
	add_child(label_status)
	
	label_info = Label3D.new()
	label_info.position = Vector3(0, 1.5, -3)
	label_info.font_size = 32
	label_info.modulate = Color(0.8, 0.8, 0.8)
	label_info.outline_size = 4
	label_info.outline_modulate = Color.BLACK
	add_child(label_info)

# ─── HUD DEL JUEGO ────────────────────────────────────────────────────────────

func _create_game_hud() -> void:
	# Score (arriba izquierda)
	hud_score = Label3D.new()
	hud_score.position = Vector3(-1.5, 2.5, -2.5)
	hud_score.font_size = 48
	hud_score.modulate = Color(1.0, 0.9, 0.0)  # Dorado
	hud_score.outline_size = 6
	hud_score.outline_modulate = Color.BLACK
	hud_score.visible = false
	add_child(hud_score)
	
	# Timer (arriba derecha)
	hud_timer = Label3D.new()
	hud_timer.position = Vector3(1.5, 2.5, -2.5)
	hud_timer.font_size = 48
	hud_timer.modulate = Color(0.2, 1.0, 0.4)  # Verde
	hud_timer.outline_size = 6
	hud_timer.outline_modulate = Color.BLACK
	hud_timer.visible = false
	add_child(hud_timer)
	
	# Instrucción actual (abajo centro)
	hud_instruction = Label3D.new()
	hud_instruction.position = Vector3(0, 0.3, -2.0)
	hud_instruction.font_size = 28
	hud_instruction.modulate = Color(1.0, 1.0, 1.0)
	hud_instruction.outline_size = 4
	hud_instruction.outline_modulate = Color.BLACK
	hud_instruction.visible = false
	add_child(hud_instruction)
	
	# Combo multiplier (centro)
	hud_combo = Label3D.new()
	hud_combo.position = Vector3(0, 1.8, -2.5)
	hud_combo.font_size = 56
	hud_combo.modulate = Color(1.0, 0.4, 0.0)  # Naranja
	hud_combo.outline_size = 8
	hud_combo.outline_modulate = Color.BLACK
	hud_combo.visible = false
	add_child(hud_combo)

func _show_waiting_message() -> void:
	if label_status:
		label_status.text = "🏥 SALA DE ESPERA"
		label_status.visible = true
	if label_info:
		label_info.text = "El fisioterapeuta iniciará tu sesión en breve..."
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
	firebase_manager.save_results(results)
	
	_hide_game_hud()
	
	# Mostrar mensaje de finalización
	if label_status:
		label_status.visible = true
		label_status.text = "✅ ¡SESIÓN COMPLETADA!"
		label_status.modulate = Color(0.2, 1.0, 0.4)
	if label_info:
		label_info.visible = true
		label_info.text = "Puntuación: " + str(results.get("score", 0)) + " pts | Precisión: " + str(results.get("accuracy", 0)) + "%"
	
	# Volver a sala de espera después de 5 segundos
	await get_tree().create_timer(5.0).timeout
	print("[VR] 🔄 Volviendo a sala de espera...")
	waiting_mode = true
	_show_waiting_message()
	firebase_manager.start_polling()  # Reactivar polling para la siguiente sesión
