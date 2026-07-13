extends Node3D
# ═════════════════════════════════════════════════════════════════════════════
# HUB MANAGER — Sala de espera universal para todos los juegos VR
# ═════════════════════════════════════════════════════════════════════════════
# 
# Este es el punto de entrada único para todos los juegos.
# El paciente se pone las gafas VR, entra aquí, y espera en un ambiente agradable
# hasta que el fisioterapeuta inicie la sesión desde la plataforma clínica.
# 
# Cuando se detecta una sesión:
# 1. Lee el game_id de la configuración
# 2. Carga dinámicamente la escena del juego correspondiente
# 3. Transfiere el control al juego
# 
# ═════════════════════════════════════════════════════════════════════════════

var firebase_manager: Node = null
var waiting_mode := true
var current_game_scene: Node = null

# UI References
var status_label: Label3D
var info_label: Label3D
var game_label: Label3D

# Mapeo de game_id a escenas
const GAME_SCENES = {
	"gems": "res://World.tscn",
	"vault_escape": "res://VaultWorld.tscn",
	"urban_attention_quest": "res://CityWorld.tscn",
	"luggage_handler": "res://LuggageWorld.tscn"
}

const GAME_NAMES = {
	"gems": "Recolectar Gemas",
	"vault_escape": "Laser Vault Escape",
	"urban_attention_quest": "Urban Attention Quest",
	"luggage_handler": "Luggage Handler"
}

func _ready() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("  🏛️ HUB WORLD — Sala de Espera Universal")
	print("═══════════════════════════════════════════════════════════════")
	
	await get_tree().process_frame
	
	# Inicializar OpenXR
	_init_openxr()
	
	# Obtener referencias a los labels
	_get_label_references()
	
	# Configurar FirebaseManager
	_setup_firebase_manager()
	
	# Mostrar mensaje de bienvenida
	_show_welcome_message()
	
	print("[Hub] 👀 Sistema de polling activado")
	print("[Hub] 🏥 Esperando que el fisioterapeuta inicie una sesión...")

func _init_openxr() -> void:
	var xr = XRServer.find_interface("OpenXR")
	if xr == null:
		print("[Hub] ⚠️ OpenXR no disponible — modo escritorio")
		return
	
	if not xr.is_initialized():
		xr.initialize()
	
	if xr.is_initialized():
		get_viewport().use_xr = true
		print("[Hub] ✅ OpenXR activado")
	else:
		print("[Hub] ❌ Error al inicializar OpenXR")

func _get_label_references() -> void:
	var welcome_sign = get_node_or_null("WelcomeSign")
	if welcome_sign:
		status_label = welcome_sign.get_node_or_null("StatusLabel")
		info_label = welcome_sign.get_node_or_null("InfoLabel")
		game_label = welcome_sign.get_node_or_null("GameLabel")
		
		if status_label and info_label and game_label:
			print("[Hub] ✅ Referencias a Labels obtenidas")
		else:
			print("[Hub] ⚠️ No se pudieron obtener todas las referencias a Labels")

func _setup_firebase_manager() -> void:
	# Buscar FirebaseManager en la escena
	if has_node("FirebaseManager"):
		firebase_manager = get_node("FirebaseManager")
	else:
		# Crear dinámicamente si no existe
		var script = load("res://scripts/firebase_manager.gd")
		firebase_manager = Node.new()
		firebase_manager.set_script(script)
		firebase_manager.name = "FirebaseManager"
		add_child(firebase_manager)
	
	# Conectar señales
	firebase_manager.config_loaded.connect(_on_config_loaded)
	firebase_manager.config_error.connect(_on_config_error)
	firebase_manager.new_session_detected.connect(_on_new_session_detected)
	
	# 🔥 CRÍTICO: Esperar 10 segundos antes de iniciar polling
	# Esto da tiempo SUFICIENTE a que se complete el DELETE de sesión anterior
	# y evita que se vuelva a detectar la misma sesión
	print("[Hub] ⏳ Esperando 10 segundos antes de iniciar polling...")
	print("[Hub] (Permite que se complete el DELETE + PROPAGACIÓN de sesión anterior)")
	await get_tree().create_timer(10.0).timeout
	
	# Iniciar polling
	firebase_manager.start_polling()
	print("[Hub] ✅ Firebase Manager configurado y polling iniciado")

func _show_welcome_message() -> void:
	if status_label:
		status_label.text = "SALA DE ESPERA VR"
		status_label.modulate = Color(0.2, 0.8, 1.0)
	
	if info_label:
		info_label.text = "Inicializando sistema..."
		info_label.modulate = Color(0.8, 0.8, 0.8)
	
	if game_label:
		game_label.visible = false
	
	print("[Hub] 💬 Mensaje de bienvenida mostrado")
	
	# Después de 10 segundos (cuando inicie el polling), cambiar el mensaje
	await get_tree().create_timer(10.0).timeout
	
	if info_label and waiting_mode:
		info_label.text = "Esperando a que el fisioterapeuta inicie la sesión..."

func _on_new_session_detected(config: Dictionary) -> void:
	print("[Hub] ═══════════════════════════════════════════════════════════")
	print("[Hub] 🎮 ¡NUEVA SESIÓN DETECTADA!")
	print("[Hub] ═══════════════════════════════════════════════════════════")
	
	var game_id = config.get("game_id", "gems")
	var patient_name = config.get("patient_name", "Paciente")
	
	print("[Hub] Game ID: ", game_id)
	print("[Hub] Paciente: ", patient_name)
	
	waiting_mode = false
	firebase_manager.stop_polling()
	
	# Mostrar mensaje de carga
	if status_label:
		status_label.text = "¡SESIÓN DETECTADA!"
		status_label.modulate = Color(0.2, 1.0, 0.4)
	
	if info_label:
		info_label.text = "Cargando juego..."
	
	if game_label:
		game_label.visible = true
		game_label.text = GAME_NAMES.get(game_id, "Juego")
	
	print("[Hub] ⏳ Esperando 2 segundos antes de cargar...")
	
	# Esperar un momento para que el jugador lea el mensaje
	await get_tree().create_timer(2.0).timeout
	
	print("[Hub] ⏰ Timeout completado, llamando _load_game()...")
	
	# Cargar el juego
	_load_game(game_id, config)

func _load_game(game_id: String, config: Dictionary) -> void:
	print("[Hub] ═══════════════════════════════════════════════════════════")
	print("[Hub] 🔄 INICIANDO CARGA DE JUEGO")
	print("[Hub] ═══════════════════════════════════════════════════════════")
	print("[Hub] Game ID: ", game_id)
	print("[Hub] Config completo: ", config)
	
	# Obtener la ruta de la escena
	var scene_path = GAME_SCENES.get(game_id, GAME_SCENES["gems"])
	print("[Hub] 📂 Ruta de escena: ", scene_path)
	
	# Aplicar configuración a GameManager ANTES de cargar la escena
	print("[Hub] 📋 Aplicando configuración a GameManager...")
	if GameManager:
		print("[Hub] ✅ GameManager encontrado")
		GameManager.apply_config(config)
		print("[Hub] ✅ Configuración aplicada")
		print("[Hub]    - Patient ID: ", GameManager.patient_id)
		print("[Hub]    - Session ID: ", GameManager.session_id)
		print("[Hub]    - Game Type: ", GameManager.game_type)
	else:
		print("[Hub] ❌ ADVERTENCIA: GameManager no encontrado")
	
	# CAMBIAR DE ESCENA DIRECTAMENTE
	print("[Hub] 🔄 Cambiando de escena a: ", scene_path)
	var error = get_tree().change_scene_to_file(scene_path)
	
	if error != OK:
		print("[Hub] ❌ ERROR al cambiar escena: código ", error)
		_show_error_message("Error al cambiar de escena")
		return
	
	print("[Hub] ✅ change_scene_to_file() ejecutado")
	print("[Hub] ═══════════════════════════════════════════════════════════")
	print("[Hub] 🎮 ¡CAMBIO DE ESCENA SOLICITADO!")
	print("[Hub] ═══════════════════════════════════════════════════════════")

func _show_error_message(message: String) -> void:
	if status_label:
		status_label.text = "❌ ERROR"
		status_label.modulate = Color(1.0, 0.2, 0.2)
	
	if info_label:
		info_label.text = message
	
	print("[Hub] ❌ ", message)

func _on_config_loaded(config: Dictionary) -> void:
	# Este callback se llama cuando se carga configuración manualmente
	# En el modo Hub con polling, usamos _on_new_session_detected en su lugar
	print("[Hub] Config cargada (modo manual): ", config)
	_on_new_session_detected(config)

func _on_config_error(error_msg: String) -> void:
	print("[Hub] ⚠️ Error de configuración: ", error_msg)
	
	# En modo producción, simplemente seguir esperando
	# En modo desarrollo, podríamos cargar un juego de prueba
	
	if OS.is_debug_build():
		print("[Hub] 🔧 Modo debug — Cargando juego de prueba en 5 segundos...")
		await get_tree().create_timer(5.0).timeout
		
		var test_config = {
			"patient_id": "test",
			"patient_name": "Prueba Local",
			"session_id": "offline_" + str(Time.get_ticks_msec()),
			"duration": 180,
			"difficulty": "Media",
			"therapy_side": "Izquierdo",
			"session_type": "Alcance",
			"game_id": "gems"
		}
		
		_on_new_session_detected(test_config)
