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
	{"name": "Flexión",          "instruction": "Sube el brazo izquierdo",        "type": "normal", "points": 10, "start": Vector3(-3.0, 2.3, -0.3),  "end": Vector3(-0.5, 1.6,  -0.3)},
	{"name": "Extensión",        "instruction": "Baja el brazo izquierdo",         "type": "green",  "points": 10, "start": Vector3(-3.0, 0.7, -0.3),  "end": Vector3(-0.5, 1.2,  -0.3)},
	{"name": "Abducción",        "instruction": "Separa el brazo hacia la izq.",   "type": "purple", "points": 15, "start": Vector3(-3.0, 1.5, -1.0),  "end": Vector3(-0.5, 1.5,  -1.0)},
	{"name": "Aducción",         "instruction": "Lleva el brazo al centro",        "type": "golden", "points": 25, "start": Vector3(-3.0, 1.5,  0.0),  "end": Vector3(-0.5, 1.5,   0.0)},
	{"name": "Rotación externa", "instruction": "Gira el brazo izq. hacia fuera",  "type": "normal", "points": 10, "start": Vector3(-3.0, 2.0, -0.8),  "end": Vector3(-0.5, 1.6,  -0.8)},
	{"name": "Rotación interna", "instruction": "Gira el brazo izq. hacia dentro", "type": "green",  "points": 10, "start": Vector3(-3.0, 1.1, -0.5),  "end": Vector3(-0.5, 1.4,  -0.5)},
	{"name": "Alcance lateral",  "instruction": "Estira hacia el lado izquierdo",  "type": "purple", "points": 15, "start": Vector3(-3.0, 1.5, -1.5),  "end": Vector3(-0.5, 1.5,  -1.5)},
	{"name": "Alcance alto",     "instruction": "Estira el brazo hacia arriba",    "type": "golden", "points": 25, "start": Vector3(-3.0, 2.8, -0.3),  "end": Vector3(-0.5, 2.2,  -0.3)},
]

const EXERCISES_RIGHT := [
	{"name": "Flexión",          "instruction": "Sube el brazo derecho",           "type": "normal", "points": 10, "start": Vector3(-3.0, 2.3,  0.3),  "end": Vector3(-0.5, 1.6,   0.3)},
	{"name": "Extensión",        "instruction": "Baja el brazo derecho",            "type": "green",  "points": 10, "start": Vector3(-3.0, 0.7,  0.3),  "end": Vector3(-0.5, 1.2,   0.3)},
	{"name": "Abducción",        "instruction": "Separa el brazo hacia la der.",    "type": "purple", "points": 15, "start": Vector3(-3.0, 1.5,  1.0),  "end": Vector3(-0.5, 1.5,   1.0)},
	{"name": "Aducción",         "instruction": "Lleva el brazo al centro",         "type": "golden", "points": 25, "start": Vector3(-3.0, 1.5,  0.0),  "end": Vector3(-0.5, 1.5,   0.0)},
	{"name": "Rotación externa", "instruction": "Gira el brazo der. hacia fuera",   "type": "normal", "points": 10, "start": Vector3(-3.0, 2.0,  0.8),  "end": Vector3(-0.5, 1.6,   0.8)},
	{"name": "Rotación interna", "instruction": "Gira el brazo der. hacia dentro",  "type": "green",  "points": 10, "start": Vector3(-3.0, 1.1,  0.5),  "end": Vector3(-0.5, 1.4,   0.5)},
	{"name": "Alcance lateral",  "instruction": "Estira hacia el lado derecho",     "type": "purple", "points": 15, "start": Vector3(-3.0, 1.5,  1.5),  "end": Vector3(-0.5, 1.5,   1.5)},
	{"name": "Alcance alto",     "instruction": "Estira el brazo hacia arriba",     "type": "golden", "points": 25, "start": Vector3(-3.0, 2.8,  0.3),  "end": Vector3(-0.5, 2.2,   0.3)},
]

const EXERCISES_BOTH := [
	{"name": "Flexión bilateral",   "instruction": "Sube ambos brazos",            "type": "golden", "points": 30, "start": Vector3(-3.0, 2.3,  0.0),  "end": Vector3(-0.5, 1.6,   0.0)},
	{"name": "Apertura bilateral",  "instruction": "Abre los brazos",              "type": "purple", "points": 20, "start": Vector3(-3.0, 1.5,  0.0),  "end": Vector3(-0.5, 1.5,   0.0)},
	{"name": "Alcance izquierda",   "instruction": "Estira el brazo izquierdo",    "type": "normal", "points": 10, "start": Vector3(-3.0, 1.5, -1.0),  "end": Vector3(-0.5, 1.5,  -1.0)},
	{"name": "Alcance derecha",     "instruction": "Estira el brazo derecho",      "type": "normal", "points": 10, "start": Vector3(-3.0, 1.5,  1.0),  "end": Vector3(-0.5, 1.5,   1.0)},
	{"name": "Flexión alta izq.",   "instruction": "Sube el brazo izquierdo alto", "type": "green",  "points": 15, "start": Vector3(-3.0, 2.8, -0.3),  "end": Vector3(-0.5, 2.2,  -0.3)},
	{"name": "Flexión alta der.",   "instruction": "Sube el brazo derecho alto",   "type": "green",  "points": 15, "start": Vector3(-3.0, 2.8,  0.3),  "end": Vector3(-0.5, 2.2,   0.3)},
]

const RED_GEMS := [
	{"name": "¡Evita!",   "instruction": "No toques esta gema roja", "type": "red", "points": -15, "start": Vector3(-3.0, 1.5,  0.0), "end": Vector3(-0.5, 1.5,  0.0)},
	{"name": "¡Peligro!", "instruction": "Esquiva la gema roja",     "type": "red", "points": -15, "start": Vector3(-3.0, 1.8,  0.3), "end": Vector3(-0.5, 1.6,  0.3)},
]

func _ready() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🎯 GEM SPAWNER INICIALIZADO ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[Spawner] Verificando GameManager...")
	if GameManager:
		print("[Spawner] ✅ GameManager existe")
		print("[Spawner] Conectando señales...")
		GameManager.session_started.connect(_on_session_started)
		GameManager.session_finished.connect(_on_session_finished)
		print("[Spawner] ✅ Señales conectadas a GameManager")
	else:
		print("[Spawner] ❌ ERROR: GameManager NO existe!")

	_spawn_timer = Timer.new()
	add_child(_spawn_timer)
	_spawn_timer.one_shot = false
	_spawn_timer.timeout.connect(_on_spawn_timer)
	print("[Spawner] ⏱️ Timer de spawn creado")
	print("═══════════════════════════════════════════════════════════════")

func _on_session_started() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🚀 SPAWNER: SESSION_STARTED RECIBIDA ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[Spawner] Construyendo cola de ejercicios...")
	_build_queue()
	print("[Spawner] ✅ Cola construida con ", _exercise_queue.size(), " ejercicios")
	_queue_index = 0
	
	print("[Spawner] 🧹 Limpiando gemas anteriores...")
	_clear_all_gems()
	
	print("[Spawner] ⏱️ Configurando intervalo de spawn...")
	_spawn_timer.wait_time = GameManager.get_spawn_interval()
	print("[Spawner] ✅ Intervalo: ", _spawn_timer.wait_time, "s (dificultad: ", GameManager.difficulty, ")")
	
	print("[Spawner] 🎮 Iniciando timer de spawn...")
	_spawn_timer.start()
	print("[Spawner] ✅ Timer iniciado")
	
	print("[Spawner] 💎 Spawneando primera gema...")
	_spawn_next()
	print("[Spawner] ✅ Primera gema spawneada")
	print("═══════════════════════════════════════════════════════════════")
	print("═══ ✅ SPAWNER ACTIVO - GENERANDO GEMAS ═══")
	print("═══════════════════════════════════════════════════════════════")

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
			var target_pos = ex["end"]
			var current_pos = gem.global_position
			
			# Calcular distancia al objetivo
			var distance = current_pos.distance_to(target_pos)
			
			# SI ESTÁ LEJOS → Mover hacia el objetivo
			if distance > 0.3:  # Margen de 30cm para detenerse
				gem.global_position = current_pos.move_toward(
					target_pos, GameManager.get_gem_speed() * delta
				)
			# SI YA LLEGÓ → Mantener posición flotando (NO atravesar)
			elif distance > 0.05:
				# Quedarse quieta en el rango de agarre
				pass
			# SI PASÓ MUCHO TIEMPO SIN AGARRAR → Perderla
			else:
				if not gem.has_meta("arrival_time"):
					gem.set_meta("arrival_time", Time.get_ticks_msec() / 1000.0)
				
				var arrival_time = gem.get_meta("arrival_time")
				var time_at_position = (Time.get_ticks_msec() / 1000.0) - arrival_time
				
				# Dar 3 segundos para agarrarla antes de perderla
				if time_at_position > 3.0:
					print("[Spawner] ⏰ Gema en posición por ", time_at_position, "s - PERDIENDO")
					gem.miss()

func _on_spawn_timer() -> void:
	if not GameManager.session_active:
		return
	_spawn_next()

func _spawn_next() -> void:
	print("[Spawner] ═══════════════════════════════════════════════════")
	print("[Spawner] 💎 SPAWNING NUEVA GEMA...")
	print("[Spawner]   - Queue index: ", _queue_index, "/", _exercise_queue.size())
	print("[Spawner]   - Session active: ", GameManager.session_active if GameManager else "N/A")
	
	if _queue_index >= _exercise_queue.size():
		# Reinicia la cola para sesiones largas
		print("[Spawner]   🔄 Reiniciando cola...")
		_build_queue()
		_queue_index = 0
		print("[Spawner]   ✅ Cola reiniciada")

	if gem_scene == null:
		push_error("[Spawner] ❌ gem_scene NO ASIGNADA!")
		return

	var exercise = _exercise_queue[_queue_index]
	_queue_index += 1
	
	print("[Spawner]   📋 Ejercicio seleccionado:")
	print("[Spawner]      - Nombre: ", exercise["name"])
	print("[Spawner]      - Tipo: ", exercise["type"])
	print("[Spawner]      - Puntos: ", exercise["points"])
	print("[Spawner]      - Start: ", exercise["start"])
	print("[Spawner]      - End: ", exercise["end"])

	print("[Spawner]   🏗️ Instanciando gema...")
	var gem = gem_scene.instantiate()
	print("[Spawner]   ✅ Gema instanciada")
	
	print("[Spawner]   ➕ Añadiendo gema al parent...")
	get_parent().add_child(gem)
	print("[Spawner]   ✅ Gema añadida al árbol de escena")
	
	print("[Spawner]   ⚙️ Setup de gema con exercise data...")
	gem.setup(exercise)
	print("[Spawner]   ✅ Setup completado")
	
	print("[Spawner]   🔗 Conectando señales...")
	gem.gem_caught.connect(_on_gem_caught.bind(gem))
	gem.gem_missed.connect(_on_gem_missed.bind(gem))
	print("[Spawner]   ✅ Señales conectadas")
	
	_active_gems.append(gem)
	print("[Spawner]   📊 Gemas activas: ", _active_gems.size())

	print("[Spawner] ✅ GEMA SPAWNEADA EXITOSAMENTE")
	print("[Spawner]   - Posición: ", gem.global_position)
	print("[Spawner]   - Visible: ", gem.visible)
	print("[Spawner] ═══════════════════════════════════════════════════")

func _on_gem_caught(gem) -> void:
	GameManager.on_gem_spawned()
	GameManager.collect_gem(gem.gem_type, gem.points, gem.exercise_name)
	_active_gems.erase(gem)

func _on_gem_missed(gem) -> void:
	if gem.gem_type == "red":
		GameManager.collect_gem("red_avoided", 5, "")
	_active_gems.erase(gem)

func _clear_all_gems() -> void:
	for gem in _active_gems:
		if is_instance_valid(gem):
			gem.queue_free()
	_active_gems.clear()
