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
	"gems": "⭐ Recolectar Gemas",
	"vault_escape": "🔐 Laser Vault Escape",
	"urban_attention_quest": "🎯 Urban Attention Quest",
	"luggage_handler": "📦 Luggage Handler"
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
	
	# Iniciar polling
	firebase_manager.start_polling()
	print("[Hub] ✅ Firebase Manager configurado y polling iniciado")

func _show_welcome_message() -> void:
	if status_label:
		status_label.text = "🏥 SALA DE ESPERA VR"
		status_label.modulate = Color(0.2, 0.8, 1.0)
	
	if info_label:
		info_label.text = "Esperando a que el fisioterapeuta inicie la sesión..."
		info_label.modulate = Color(0.8, 0.8, 0.8)
	
	if game_label:
		game_label.visible = false
	
	print("[Hub] 💬 Mensaje de bienvenida mostrado")

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
	
	# Esperar un momento para que el jugador lea el mensaje
	await get_tree().create_timer(2.0).timeout
	
	# Cargar el juego
	_load_game(game_id, config)

func _load_game(game_id: String, config: Dictionary) -> void:
	print("[Hub] 🔄 Cargando juego: ", game_id)
	
	# Obtener la ruta de la escena
	var scene_path = GAME_SCENES.get(game_id, GAME_SCENES["gems"])
	
	if not ResourceLoader.exists(scene_path):
		print("[Hub] ❌ ERROR: No se encuentra la escena: ", scene_path)
		_show_error_message("No se pudo cargar el juego")
		return
	
	# Cargar la escena del juego
	var game_scene_resource = load(scene_path)
	if game_scene_resource == null:
		print("[Hub] ❌ ERROR: No se pudo cargar el recurso de escena")
		_show_error_message("Error al cargar el juego")
		return
	
	# Instanciar la escena
	current_game_scene = game_scene_resource.instantiate()
	
	if current_game_scene == null:
		print("[Hub] ❌ ERROR: No se pudo instanciar la escena")
		_show_error_message("Error al instanciar el juego")
		return
	
	print("[Hub] ✅ Escena del juego cargada")
	
	# Aplicar configuración a GameManager
	if GameManager:
		GameManager.apply_config(config)
		print("[Hub] ✅ Configuración aplicada al GameManager")
	
	# Ocultar el Hub
	_hide_hub()
	
	# Añadir la escena del juego
	get_tree().root.add_child(current_game_scene)
	
	print("[Hub] 🎮 Juego cargado y listo")
	print("[Hub] ═══════════════════════════════════════════════════════════")
	
	# El juego ahora tomará el control

func _hide_hub() -> void:
	# Ocultar todos los elementos visuales del hub
	visible = false
	
	# También podríamos quitar el procesamiento
	set_process(false)
	set_physics_process(false)
	
	print("[Hub] 👻 Hub ocultado")

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
