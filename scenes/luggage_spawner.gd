extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# LuggageSpawner — Genera maletas en la cinta transportadora
# ─────────────────────────────────────────────────────────────────────────────

signal luggage_spawned(luggage: RigidBody3D)

@export var spawn_interval: float = 3.0  # Segundos entre maletas
@export var conveyor_speed: float = 1.0  # m/s
@export var spawn_position: Vector3 = Vector3(0, 1.0, -3)  # Posición inicial (sobre la cinta)
@export var difficulty: String = "Media"

var _luggage_scene: PackedScene
var _spawn_timer: Timer
var _luggage_counter: int = 0
var _active: bool = false

# Configuración según dificultad
const DIFFICULTY_CONFIG = {
	"Fácil": {
		"types": ["green", "yellow"],
		"interval": 4.0,
		"speed": 0.5
	},
	"Media": {
		"types": ["green", "yellow", "red"],
		"interval": 3.0,
		"speed": 1.0
	},
	"Difícil": {
		"types": ["green", "yellow", "red"],
		"interval": 2.0,
		"speed": 1.5
	}
}

# Configuración de tipos de maletas
const LUGGAGE_CONFIG = {
	"green": {"weight": 2.0, "points": 10, "zone": "green"},
	"yellow": {"weight": 5.0, "points": 15, "zone": "yellow"},
	"red": {"weight": 10.0, "points": 25, "zone": "red"},
	"purple": {"weight": 15.0, "points": 40, "zone": "red"}  # Purple va a zona roja también
}

func _ready() -> void:
	# Cargar escena de maleta
	_luggage_scene = preload("res://scenes/luggage_item.tscn")
	
	# Timer para spawning
	_spawn_timer = Timer.new()
	add_child(_spawn_timer)
	_spawn_timer.timeout.connect(_spawn_luggage)
	
	apply_difficulty_settings()
	
	print("[LuggageSpawner] Spawner inicializado | Dificultad: ", difficulty)

func apply_difficulty_settings() -> void:
	var config = DIFFICULTY_CONFIG.get(difficulty, DIFFICULTY_CONFIG["Media"])
	spawn_interval = config["interval"]
	conveyor_speed = config["speed"]
	_spawn_timer.wait_time = spawn_interval
	print("[LuggageSpawner] Configuración aplicada: intervalo=", spawn_interval, "s, velocidad=", conveyor_speed, "m/s")

func start_spawning() -> void:
	if _active:
		return
	
	_active = true
	_luggage_counter = 0
	_spawn_timer.start()
	print("[LuggageSpawner] ✅ Spawning iniciado")

func stop_spawning() -> void:
	_active = false
	_spawn_timer.stop()
	print("[LuggageSpawner] ⏹ Spawning detenido")

func _spawn_luggage() -> void:
	if not _active:
		return
	
	# Seleccionar tipo aleatorio según dificultad
	var config = DIFFICULTY_CONFIG.get(difficulty, DIFFICULTY_CONFIG["Media"])
	var available_types = config["types"]
	var luggage_type = available_types[randi() % available_types.size()]
	
	# Crear maleta
	var luggage_config = LUGGAGE_CONFIG[luggage_type]
	var luggage = _create_luggage(luggage_type, luggage_config)
	
	if luggage:
		_luggage_counter += 1
		luggage_spawned.emit(luggage)
		print("[LuggageSpawner] 📦 Maleta #", _luggage_counter, " spawneada: ", luggage_type, " (", luggage_config["weight"], "kg)")

func _create_luggage(type: String, config: Dictionary) -> RigidBody3D:
	if not _luggage_scene:
		push_error("[LuggageSpawner] Escena de maleta no cargada")
		return null
	
	var luggage = _luggage_scene.instantiate() as RigidBody3D
	
	# Configurar propiedades
	luggage.set("luggage_id", _luggage_counter + 1)
	luggage.set("luggage_type", type)
	luggage.set("weight", config["weight"])
	luggage.set("points", config["points"])
	luggage.set("target_zone", config["zone"])
	
	# Posicionar en inicio de cinta (con pequeña variación)
	var spawn_offset = Vector3(
		randf_range(-0.15, 0.15),
		0.0,
		randf_range(-0.1, 0.1)
	)
	luggage.global_position = global_position + spawn_offset
	
	# Añadir a escena
	get_parent().add_child(luggage)
	
	# IMPORTANTE: Desactivar gravedad y aplicar velocidad hacia el jugador
	if luggage is RigidBody3D:
		luggage.gravity_scale = 0.0  # Sin gravedad para que no caiga
		luggage.linear_velocity = Vector3(0, 0, conveyor_speed * 3.0)  # Velocidad 3x más rápida hacia jugador (+Z)
	
	print("[LuggageSpawner] 📦 Maleta spawneada en posición: ", luggage.global_position)
	
	return luggage

func set_difficulty(new_difficulty: String) -> void:
	difficulty = new_difficulty
	apply_difficulty_settings()

func get_luggage_count() -> int:
	return _luggage_counter
