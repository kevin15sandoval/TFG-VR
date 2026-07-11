extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# LaserSpawner — Genera láseres que avanzan hacia el jugador (tipo LIMBO)
# Se comunica con VaultGameManager para puntuación
# ─────────────────────────────────────────────────────────────────────────────

@export var laser_scene: PackedScene

var _spawn_timer: Timer
var _active_lasers: Array = []
var _spawn_queue: Array = []
var _queue_index: int = 0

# Secuencia de láseres según dificultad
const LASER_SEQUENCES = {
	"Fácil": [
		{"type": "horizontal_mid", "speed": 1.0, "delay": 3.5},
		{"type": "horizontal_high", "speed": 1.0, "delay": 3.5},
		{"type": "horizontal_low", "speed": 1.0, "delay": 3.5},
		{"type": "horizontal_mid", "speed": 1.2, "delay": 3.0},
		{"type": "vertical_left", "speed": 1.0, "delay": 3.5},
		{"type": "vertical_right", "speed": 1.0, "delay": 3.5},
	],
	"Media": [
		{"type": "horizontal_high", "speed": 1.3, "delay": 2.8},
		{"type": "horizontal_low", "speed": 1.3, "delay": 2.5},
		{"type": "vertical_left", "speed": 1.2, "delay": 2.8},
		{"type": "horizontal_mid", "speed": 1.4, "delay": 2.5},
		{"type": "vertical_right", "speed": 1.2, "delay": 2.8},
		{"type": "horizontal_high", "speed": 1.5, "delay": 2.3},
		{"type": "horizontal_low", "speed": 1.3, "delay": 2.5},
		{"type": "diagonal", "speed": 1.2, "delay": 3.0},
	],
	"Difícil": [
		{"type": "horizontal_mid", "speed": 1.8, "delay": 2.0},
		{"type": "horizontal_high", "speed": 1.8, "delay": 1.8},
		{"type": "vertical_left", "speed": 1.6, "delay": 2.0},
		{"type": "horizontal_low", "speed": 1.9, "delay": 1.8},
		{"type": "vertical_right", "speed": 1.6, "delay": 2.0},
		{"type": "diagonal", "speed": 1.5, "delay": 2.2},
		{"type": "horizontal_high", "speed": 2.0, "delay": 1.5},
		{"type": "horizontal_mid", "speed": 2.0, "delay": 1.5},
		{"type": "vertical_left", "speed": 1.8, "delay": 1.8},
		{"type": "horizontal_low", "speed": 2.1, "delay": 1.5},
	],
}

func _ready() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🔴 LASER SPAWNER INICIALIZADO ═══")
	print("═══════════════════════════════════════════════════════════════")
	
	if GameManager:
		GameManager.session_started.connect(_on_session_started)
		GameManager.session_finished.connect(_on_session_finished)
		print("[LaserSpawner] ✅ Conectado a GameManager")
	
	_spawn_timer = Timer.new()
	add_child(_spawn_timer)
	_spawn_timer.one_shot = true  # Un shot, reconfigurar cada vez
	_spawn_timer.timeout.connect(_on_spawn_timer)
	print("[LaserSpawner] ⏱️ Timer creado")

func _on_session_started() -> void:
	print("[LaserSpawner] 🚀 Sesión iniciada - Construyendo secuencia...")
	_build_sequence()
	_queue_index = 0
	_clear_all_lasers()
	
	print("[LaserSpawner] 🎯 Spawneando primer láser...")
	_spawn_next()

func _build_sequence() -> void:
	var difficulty = GameManager.difficulty if GameManager else "Media"
	var base_sequence = LASER_SEQUENCES.get(difficulty, LASER_SEQUENCES["Media"])
	
	_spawn_queue = base_sequence.duplicate(true)
	_spawn_queue.shuffle()
	
	print("[LaserSpawner] ✅ Secuencia construida: ", _spawn_queue.size(), " láseres (", difficulty, ")")

func _on_spawn_timer() -> void:
	if GameManager and GameManager.session_active:
		_spawn_next()

func _spawn_next() -> void:
	if not GameManager or not GameManager.session_active:
		return
	
	# Si llegamos al final, reiniciar secuencia (sesiones largas)
	if _queue_index >= _spawn_queue.size():
		print("[LaserSpawner] 🔄 Reiniciando secuencia...")
		_build_sequence()
		_queue_index = 0
	
	if laser_scene == null:
		push_error("[LaserSpawner] ❌ laser_scene NO ASIGNADA!")
		return
	
	var laser_data = _spawn_queue[_queue_index]
	_queue_index += 1
	
	print("[LaserSpawner] 💥 Spawneando láser tipo: ", laser_data["type"], " | velocidad: ", laser_data["speed"])
	
	# Instanciar láser
	var laser = laser_scene.instantiate()
	get_parent().add_child(laser)
	
	# Configurar tipo y velocidad
	laser.laser_type = laser_data["type"]
	laser.advance_speed = laser_data["speed"]
	
	# Posición inicial: al fondo de la bóveda (Z negativo)
	laser.global_position = Vector3(0, 1.5, -8.0)
	
	# Conectar señales
	laser.player_hit.connect(_on_laser_hit.bind(laser))
	laser.laser_dodged.connect(_on_laser_dodged.bind(laser))
	
	_active_lasers.append(laser)
	
	# Programar siguiente láser según delay
	_spawn_timer.wait_time = laser_data["delay"]
	_spawn_timer.start()
	
	print("[LaserSpawner] ⏱️ Próximo láser en ", laser_data["delay"], "s")

func _on_laser_hit(laser: Node) -> void:
	print("[LaserSpawner] ⚡ ¡JUGADOR TOCÓ LÁSER! Tipo: ", laser.laser_type if laser.has("laser_type") else "unknown")
	
	# Notificar al game manager
	if GameManager and GameManager.has_method("register_laser_hit"):
		GameManager.register_laser_hit()
	
	# Buscar VaultGameManager si existe
	var vault_manager = get_parent().get_node_or_null("VaultGameManager")
	if vault_manager and vault_manager.has_method("register_laser_hit"):
		vault_manager.register_laser_hit()
	
	_active_lasers.erase(laser)

func _on_laser_dodged(laser: Node) -> void:
	print("[LaserSpawner] ✅ ¡LÁSER ESQUIVADO! +10 pts")
	
	# Dar puntos por esquivar
	var vault_manager = get_parent().get_node_or_null("VaultGameManager")
	if vault_manager and vault_manager.has_method("add_dodge_points"):
		vault_manager.add_dodge_points(10)
	
	_active_lasers.erase(laser)

func _on_session_finished(_results: Dictionary) -> void:
	print("[LaserSpawner] 🏁 Sesión terminada - Limpiando...")
	_spawn_timer.stop()
	_clear_all_lasers()

func _clear_all_lasers() -> void:
	for laser in _active_lasers:
		if is_instance_valid(laser):
			laser.queue_free()
	_active_lasers.clear()
	print("[LaserSpawner] 🧹 Láseres limpiados")
