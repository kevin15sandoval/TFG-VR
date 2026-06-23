extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# GemSpawner — Genera gemas de ejercicio adaptadas a la config de sesión
# Se comunica con GameManager (autoload) para saber dificultad y lado
# ─────────────────────────────────────────────────────────────────────────────

@export var gem_scene: PackedScene

var _spawn_timer: Timer
var _active_gems: Array = []
var _exercise_queue: Array = []
var _queue_index: int = 0

# ─── Definición de ejercicios por lado ───────────────────────────────────────
# Posiciones: start = donde aparece la gema, end = destino (hacia el paciente)

const EXERCISES_LEFT := [
	{"name": "Flexión",          "instruction": "Sube el brazo izquierdo",        "type": "normal", "points": 10, "start": Vector3(-0.3, 2.3, -3.5), "end": Vector3(-0.3, 1.6, -1.0)},
	{"name": "Extensión",        "instruction": "Baja el brazo izquierdo",         "type": "green",  "points": 10, "start": Vector3(-0.3, 0.7, -3.5), "end": Vector3(-0.3, 1.2, -1.0)},
	{"name": "Abducción",        "instruction": "Separa el brazo hacia la izq.",   "type": "purple", "points": 15, "start": Vector3(-1.8, 1.5, -3.5), "end": Vector3(-0.9, 1.5, -1.0)},
	{"name": "Aducción",         "instruction": "Lleva el brazo al centro",        "type": "golden", "points": 25, "start": Vector3(-0.8, 1.5, -3.5), "end": Vector3(-0.3, 1.5, -1.0)},
	{"name": "Rotación externa", "instruction": "Gira el brazo izq. hacia fuera",  "type": "normal", "points": 10, "start": Vector3(-1.2, 2.0, -3.5), "end": Vector3(-0.8, 1.6, -1.0)},
	{"name": "Rotación interna", "instruction": "Gira el brazo izq. hacia dentro", "type": "green",  "points": 10, "start": Vector3(-1.2, 1.1, -3.5), "end": Vector3(-0.5, 1.4, -1.0)},
	{"name": "Alcance lateral",  "instruction": "Estira hacia el lado izquierdo",  "type": "purple", "points": 15, "start": Vector3(-2.2, 1.5, -3.0), "end": Vector3(-1.2, 1.5, -1.0)},
	{"name": "Alcance alto",     "instruction": "Estira el brazo hacia arriba",    "type": "golden", "points": 25, "start": Vector3(-0.5, 2.8, -3.5), "end": Vector3(-0.5, 2.0, -1.0)},
]

const EXERCISES_RIGHT := [
	{"name": "Flexión",          "instruction": "Sube el brazo derecho",           "type": "normal", "points": 10, "start": Vector3(0.3, 2.3, -3.5),  "end": Vector3(0.3, 1.6, -1.0)},
	{"name": "Extensión",        "instruction": "Baja el brazo derecho",            "type": "green",  "points": 10, "start": Vector3(0.3, 0.7, -3.5),  "end": Vector3(0.3, 1.2, -1.0)},
	{"name": "Abducción",        "instruction": "Separa el brazo hacia la der.",    "type": "purple", "points": 15, "start": Vector3(1.8, 1.5, -3.5),  "end": Vector3(0.9, 1.5, -1.0)},
	{"name": "Aducción",         "instruction": "Lleva el brazo al centro",         "type": "golden", "points": 25, "start": Vector3(0.8, 1.5, -3.5),  "end": Vector3(0.3, 1.5, -1.0)},
	{"name": "Rotación externa", "instruction": "Gira el brazo der. hacia fuera",   "type": "normal", "points": 10, "start": Vector3(1.2, 2.0, -3.5),  "end": Vector3(0.8, 1.6, -1.0)},
	{"name": "Rotación interna", "instruction": "Gira el brazo der. hacia dentro",  "type": "green",  "points": 10, "start": Vector3(1.2, 1.1, -3.5),  "end": Vector3(0.5, 1.4, -1.0)},
	{"name": "Alcance lateral",  "instruction": "Estira hacia el lado derecho",     "type": "purple", "points": 15, "start": Vector3(2.2, 1.5, -3.0),  "end": Vector3(1.2, 1.5, -1.0)},
	{"name": "Alcance alto",     "instruction": "Estira el brazo hacia arriba",     "type": "golden", "points": 25, "start": Vector3(0.5, 2.8, -3.5),  "end": Vector3(0.5, 2.0, -1.0)},
]

const EXERCISES_BOTH := [
	{"name": "Flexión bilateral",   "instruction": "Sube ambos brazos",            "type": "golden", "points": 30, "start": Vector3(0.0, 2.3, -3.5),  "end": Vector3(0.0, 1.6, -1.0)},
	{"name": "Apertura bilateral",  "instruction": "Abre los brazos hacia los lados", "type": "purple", "points": 20, "start": Vector3(0.0, 1.5, -3.5), "end": Vector3(0.0, 1.5, -1.0)},
	{"name": "Alcance izquierda",   "instruction": "Estira el brazo izquierdo",    "type": "normal", "points": 10, "start": Vector3(-1.8, 1.5, -3.5), "end": Vector3(-0.9, 1.5, -1.0)},
	{"name": "Alcance derecha",     "instruction": "Estira el brazo derecho",      "type": "normal", "points": 10, "start": Vector3(1.8, 1.5, -3.5),  "end": Vector3(0.9, 1.5, -1.0)},
	{"name": "Flexión alta izq.",   "instruction": "Sube el brazo izquierdo alto", "type": "green",  "points": 15, "start": Vector3(-0.5, 2.8, -3.5), "end": Vector3(-0.5, 2.0, -1.0)},
	{"name": "Flexión alta der.",   "instruction": "Sube el brazo derecho alto",   "type": "green",  "points": 15, "start": Vector3(0.5, 2.8, -3.5),  "end": Vector3(0.5, 2.0, -1.0)},
]

# Gemas rojas = obstáculos a EVITAR (aparecen mezcladas en dificultad Media/Difícil)
const RED_GEMS := [
	{"name": "¡Evita!",  "instruction": "No toques esta gema roja",  "type": "red", "points": -15, "start": Vector3(0.0, 1.5, -3.0), "end": Vector3(0.0, 1.5, -0.8)},
	{"name": "¡Peligro!", "instruction": "Esquiva la gema roja",     "type": "red", "points": -15, "start": Vector3(0.8, 1.8, -3.0), "end": Vector3(0.3, 1.6, -0.8)},
]

func _ready() -> void:
	GameManager.session_started.connect(_on_session_started)
	GameManager.session_finished.connect(_on_session_finished)

	_spawn_timer = Timer.new()
	add_child(_spawn_timer)
	_spawn_timer.one_shot = false
	_spawn_timer.timeout.connect(_on_spawn_timer)

func _on_session_started() -> void:
	_build_queue()
	_queue_index = 0
	_clear_all_gems()
	_spawn_timer.wait_time = GameManager.get_spawn_interval()
	_spawn_timer.start()
	_spawn_next()

func _on_session_finished(_results: Dictionary) -> void:
	_spawn_timer.stop()
	_clear_all_gems()

func _build_queue() -> void:
	var side = GameManager.therapy_side
	var base: Array

	match side:
		"Izquierdo": base = EXERCISES_LEFT.duplicate(true)
		"Derecho":   base = EXERCISES_RIGHT.duplicate(true)
		_:           base = EXERCISES_BOTH.duplicate(true)

	# En dificultad Media y Difícil mezcla gemas rojas (obstáculos)
	_exercise_queue = base.duplicate(true)
	if GameManager.difficulty in ["Media", "Difícil"]:
		for red in RED_GEMS:
			_exercise_queue.insert(randi() % _exercise_queue.size(), red.duplicate())

	# En Difícil mezcla más gemas rojas y duplica el ciclo
	if GameManager.difficulty == "Difícil":
		for red in RED_GEMS:
			_exercise_queue.insert(randi() % _exercise_queue.size(), red.duplicate())
		_exercise_queue.append_array(base.duplicate(true))

	_exercise_queue.shuffle()

func _process(delta: float) -> void:
	# Mueve las gemas activas hacia su destino
	for gem in _active_gems:
		if is_instance_valid(gem) and not gem.collected:
			var ex = gem.exercise_data
			gem.global_position = gem.global_position.move_toward(
				ex["end"], GameManager.get_gem_speed() * delta
			)
			# Si llegó al final sin ser recogida, la quitamos
			if gem.global_position.distance_to(ex["end"]) < 0.05:
				gem.miss()

func _on_spawn_timer() -> void:
	if not GameManager.session_active:
		return
	_spawn_next()

func _spawn_next() -> void:
	if _queue_index >= _exercise_queue.size():
		# Reinicia la cola para sesiones largas
		_build_queue()
		_queue_index = 0

	if gem_scene == null:
		push_error("[GemSpawner] gem_scene no asignada")
		return

	var exercise = _exercise_queue[_queue_index]
	_queue_index += 1

	var gem = gem_scene.instantiate()
	get_parent().add_child(gem)
	gem.setup(exercise)
	gem.gem_caught.connect(_on_gem_caught.bind(gem))
	gem.gem_missed.connect(_on_gem_missed.bind(gem))
	_active_gems.append(gem)

	print("[Spawner] Ejercicio: ", exercise["name"], " | Tipo: ", exercise["type"])

func _on_gem_caught(gem) -> void:
	GameManager.collect_gem(gem.gem_type, gem.points)
	_active_gems.erase(gem)

func _on_gem_missed(gem) -> void:
	if gem.gem_type == "red":
		# Evitar una gema roja = puntos positivos
		GameManager.collect_gem("red_avoided", 5)
	_active_gems.erase(gem)

func _clear_all_gems() -> void:
	for gem in _active_gems:
		if is_instance_valid(gem):
			gem.queue_free()
	_active_gems.clear()
