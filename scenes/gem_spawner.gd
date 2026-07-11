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
var _portal: Node3D = null  # Portal visual de donde salen las gemas

# ─── Definición de ejercicios por lado ───────────────────────────────────────
# Posiciones: start = donde aparece la gema, end = destino (hacia el paciente)
# DISTANCIAS SEGÚN COLOR/DIFICULTAD:
#   - Azul (normal): Cerca (-3.0m)
#   - Verde (green): Cerca (-3.0m)  
#   - Morado (purple): Medio (-4.5m)
#   - Dorado (golden): Lejos (-6.0m)
#   - Rojo (red): Muy lejos (-7.0m) y más rápido

const EXERCISES_LEFT := [
	{"name": "Flexión",          "instruction": "Sube el brazo izquierdo",        "type": "normal", "points": 10, "start": Vector3(-3.0, 2.3, -0.3),  "end": Vector3(-0.5, 1.6,  -0.3)},
	{"name": "Extensión",        "instruction": "Baja el brazo izquierdo",         "type": "green",  "points": 10, "start": Vector3(-3.0, 0.7, -0.3),  "end": Vector3(-0.5, 1.2,  -0.3)},
	{"name": "Abducción",        "instruction": "Separa el brazo hacia la izq.",   "type": "purple", "points": 15, "start": Vector3(-4.5, 1.5, -1.0),  "end": Vector3(-0.5, 1.5,  -1.0)},
	{"name": "Aducción",         "instruction": "Lleva el brazo al centro",        "type": "golden", "points": 25, "start": Vector3(-6.0, 1.5,  0.0),  "end": Vector3(-0.5, 1.5,   0.0)},
	{"name": "Rotación externa", "instruction": "Gira el brazo izq. hacia fuera",  "type": "normal", "points": 10, "start": Vector3(-3.0, 2.0, -0.8),  "end": Vector3(-0.5, 1.6,  -0.8)},
	{"name": "Rotación interna", "instruction": "Gira el brazo izq. hacia dentro", "type": "green",  "points": 10, "start": Vector3(-3.0, 1.1, -0.5),  "end": Vector3(-0.5, 1.4,  -0.5)},
	{"name": "Alcance lateral",  "instruction": "Estira hacia el lado izquierdo",  "type": "purple", "points": 15, "start": Vector3(-4.5, 1.5, -1.5),  "end": Vector3(-0.5, 1.5,  -1.5)},
	{"name": "Alcance alto",     "instruction": "Estira el brazo hacia arriba",    "type": "golden", "points": 25, "start": Vector3(-6.0, 2.8, -0.3),  "end": Vector3(-0.5, 2.2,  -0.3)},
]

const EXERCISES_RIGHT := [
	{"name": "Flexión",          "instruction": "Sube el brazo derecho",           "type": "normal", "points": 10, "start": Vector3(-3.0, 2.3,  0.3),  "end": Vector3(-0.5, 1.6,   0.3)},
	{"name": "Extensión",        "instruction": "Baja el brazo derecho",            "type": "green",  "points": 10, "start": Vector3(-3.0, 0.7,  0.3),  "end": Vector3(-0.5, 1.2,   0.3)},
	{"name": "Abducción",        "instruction": "Separa el brazo hacia la der.",    "type": "purple", "points": 15, "start": Vector3(-4.5, 1.5,  1.0),  "end": Vector3(-0.5, 1.5,   1.0)},
	{"name": "Aducción",         "instruction": "Lleva el brazo al centro",         "type": "golden", "points": 25, "start": Vector3(-6.0, 1.5,  0.0),  "end": Vector3(-0.5, 1.5,   0.0)},
	{"name": "Rotación externa", "instruction": "Gira el brazo der. hacia fuera",   "type": "normal", "points": 10, "start": Vector3(-3.0, 2.0,  0.8),  "end": Vector3(-0.5, 1.6,   0.8)},
	{"name": "Rotación interna", "instruction": "Gira el brazo der. hacia dentro",  "type": "green",  "points": 10, "start": Vector3(-3.0, 1.1,  0.5),  "end": Vector3(-0.5, 1.4,   0.5)},
	{"name": "Alcance lateral",  "instruction": "Estira hacia el lado derecho",     "type": "purple", "points": 15, "start": Vector3(-4.5, 1.5,  1.5),  "end": Vector3(-0.5, 1.5,   1.5)},
	{"name": "Alcance alto",     "instruction": "Estira el brazo hacia arriba",     "type": "golden", "points": 25, "start": Vector3(-6.0, 2.8,  0.3),  "end": Vector3(-0.5, 2.2,   0.3)},
]

const EXERCISES_BOTH := [
	{"name": "Flexión bilateral",   "instruction": "Sube ambos brazos",            "type": "golden", "points": 30, "start": Vector3(-6.0, 2.3,  0.0),  "end": Vector3(-0.5, 1.6,   0.0)},
	{"name": "Apertura bilateral",  "instruction": "Abre los brazos",              "type": "purple", "points": 20, "start": Vector3(-4.5, 1.5,  0.0),  "end": Vector3(-0.5, 1.5,   0.0)},
	{"name": "Alcance izquierda",   "instruction": "Estira el brazo izquierdo",    "type": "normal", "points": 10, "start": Vector3(-3.0, 1.5, -1.0),  "end": Vector3(-0.5, 1.5,  -1.0)},
	{"name": "Alcance derecha",     "instruction": "Estira el brazo derecho",      "type": "normal", "points": 10, "start": Vector3(-3.0, 1.5,  1.0),  "end": Vector3(-0.5, 1.5,   1.0)},
	{"name": "Flexión alta izq.",   "instruction": "Sube el brazo izquierdo alto", "type": "green",  "points": 15, "start": Vector3(-3.0, 2.8, -0.3),  "end": Vector3(-0.5, 2.2,  -0.3)},
	{"name": "Flexión alta der.",   "instruction": "Sube el brazo derecho alto",   "type": "green",  "points": 15, "start": Vector3(-3.0, 2.8,  0.3),  "end": Vector3(-0.5, 2.2,   0.3)},
]

const RED_GEMS := [
	{"name": "¡Evita!",   "instruction": "No toques esta gema roja", "type": "red", "points": -15, "start": Vector3(-7.0, 1.5,  0.0), "end": Vector3(-0.5, 1.5,  0.0)},
	{"name": "¡Peligro!", "instruction": "Esquiva la gema roja",     "type": "red", "points": -15, "start": Vector3(-7.0, 1.8,  0.3), "end": Vector3(-0.5, 1.6,  0.3)},
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
	
	# CREAR PORTAL VISUAL
	_create_spawn_portal()
	print("[Spawner] 🌀 Portal de spawn creado")
	
	print("═══════════════════════════════════════════════════════════════")

func _create_spawn_portal() -> void:
	# Crear portal visual brillante con partículas
	_portal = Node3D.new()
	get_parent().add_child(_portal)
	_portal.position = Vector3(-5.0, 1.5, 0.0)  # Posición fija del portal
	
	# Anillo exterior giratorio
	var outer_ring = MeshInstance3D.new()
	_portal.add_child(outer_ring)
	var torus = TorusMesh.new()
	torus.inner_radius = 0.8
	torus.outer_radius = 1.0
	outer_ring.mesh = torus
	
	var mat_outer = StandardMaterial3D.new()
	mat_outer.albedo_color = Color(0.2, 0.8, 1.0, 0.6)
	mat_outer.emission_enabled = true
	mat_outer.emission = Color(0.2, 0.8, 1.0)
	mat_outer.emission_energy_multiplier = 4.0
	mat_outer.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_outer.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	outer_ring.material_override = mat_outer
	
	# Rotación constante del anillo
	var tween_outer = create_tween()
	tween_outer.set_loops()
	tween_outer.tween_property(outer_ring, "rotation:z", TAU, 3.0).from(0.0)
	
	# Anillo interior giratorio (sentido opuesto)
	var inner_ring = MeshInstance3D.new()
	_portal.add_child(inner_ring)
	var torus2 = TorusMesh.new()
	torus2.inner_radius = 0.4
	torus2.outer_radius = 0.6
	inner_ring.mesh = torus2
	
	var mat_inner = StandardMaterial3D.new()
	mat_inner.albedo_color = Color(0.8, 0.2, 1.0, 0.7)
	mat_inner.emission_enabled = true
	mat_inner.emission = Color(0.8, 0.2, 1.0)
	mat_inner.emission_energy_multiplier = 5.0
	mat_inner.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_inner.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	inner_ring.material_override = mat_inner
	
	# Rotación opuesta
	var tween_inner = create_tween()
	tween_inner.set_loops()
	tween_inner.tween_property(inner_ring, "rotation:z", -TAU, 2.0).from(0.0)
	
	# Centro brillante (vórtice)
	var center = MeshInstance3D.new()
	_portal.add_child(center)
	var sphere = SphereMesh.new()
	sphere.radius = 0.3
	center.mesh = sphere
	
	var mat_center = StandardMaterial3D.new()
	mat_center.albedo_color = Color(1.0, 1.0, 1.0, 0.9)
	mat_center.emission_enabled = true
	mat_center.emission = Color(1.0, 1.0, 1.0)
	mat_center.emission_energy_multiplier = 8.0
	mat_center.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_center.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	center.material_override = mat_center
	
	# Pulso del centro
	var tween_center = create_tween()
	tween_center.set_loops()
	tween_center.tween_property(center, "scale", Vector3.ONE * 1.3, 0.8).set_trans(Tween.TRANS_SINE)
	tween_center.tween_property(center, "scale", Vector3.ONE * 0.8, 0.8).set_trans(Tween.TRANS_SINE)
	
	# Partículas del portal
	var particles = GPUParticles3D.new()
	_portal.add_child(particles)
	particles.emitting = true
	particles.amount = 50
	particles.lifetime = 2.0
	particles.explosiveness = 0.0
	
	var particle_mat = ParticleProcessMaterial.new()
	particle_mat.direction = Vector3.ZERO
	particle_mat.spread = 180.0
	particle_mat.initial_velocity_min = 0.5
	particle_mat.initial_velocity_max = 1.5
	particle_mat.gravity = Vector3.ZERO
	particle_mat.scale_min = 0.05
	particle_mat.scale_max = 0.15
	particle_mat.color = Color(0.5, 0.8, 1.0, 0.8)
	
	particles.process_material = particle_mat
	particles.draw_pass_1 = SphereMesh.new()
	
	print("[Spawner] ✅ Portal creado en posición: ", _portal.position)

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
			
			# VELOCIDAD SEGÚN TIPO DE GEMA
			var speed_multiplier = 1.0
			match gem.gem_type:
				"red":    speed_multiplier = 1.5  # Rojas más rápidas (obstáculos)
				"golden": speed_multiplier = 1.2  # Doradas un poco más rápidas
				"purple": speed_multiplier = 1.0  # Moradas velocidad normal
				_:        speed_multiplier = 0.9  # Normal/verdes más lentas
			
			var gem_speed = GameManager.get_gem_speed() * speed_multiplier
			
			# SI ESTÁ LEJOS → Mover hacia el objetivo
			if distance > 0.3:  # Margen de 30cm para detenerse
				gem.global_position = current_pos.move_toward(target_pos, gem_speed * delta)
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
					print("[Spawner] ⏰ Gema ", gem.gem_type, " en posición por ", time_at_position, "s - PERDIENDO")
					gem.miss()
			
			# ═══ DETECTAR SI PASÓ DE LARGO SIN TOCAR ═══
			# Si la gema pasó DETRÁS del jugador (coordenada Z positiva)
			var player_z = 0.0  # Asumiendo jugador en Z=0
			if gem.global_position.z > player_z + 2.0:  # 2m detrás del jugador
				print("[Spawner] ❌ Gema ", gem.gem_type, " PASÓ DE LARGO - Eliminando")
				gem.miss()  # Ejecutar sonido de error y eliminar

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
	
	# ═══ HACER QUE LA GEMA SALGA DEL PORTAL ═══
	if _portal:
		# Posición inicial = Portal (ignorar exercise["start"])
		gem.global_position = _portal.global_position
		print("[Spawner]   🌀 Gema spawneada DESDE EL PORTAL: ", _portal.global_position)
		
		# Actualizar exercise_data con nueva posición de inicio (portal)
		gem.exercise_data["start"] = _portal.global_position
		
		# Efecto visual de salida del portal
		_create_portal_spawn_effect(gem.global_position, gem.gem_type)
	else:
		print("[Spawner]   ⚠️ Portal no existe, usando posición original")
	
	print("[Spawner]   🔗 Conectando señales...")
	gem.gem_caught.connect(_on_gem_caught.bind(gem))
	gem.gem_missed.connect(_on_gem_missed.bind(gem))
	print("[Spawner]   ✅ Señales conectadas")
	
	_active_gems.append(gem)
	print("[Spawner]   📊 Gemas activas: ", _active_gems.size())

	print("[Spawner] ✅ GEMA SPAWNEADA EXITOSAMENTE")
	print("[Spawner]   - Posición inicial (portal): ", gem.global_position)
	print("[Spawner]   - Posición destino: ", exercise["end"])
	print("[Spawner]   - Visible: ", gem.visible)
	print("[Spawner] ═══════════════════════════════════════════════════")

func _create_portal_spawn_effect(position: Vector3, gem_type: String) -> void:
	# Efecto visual cuando una gema sale del portal
	var spawn_particles = CPUParticles3D.new()
	get_parent().add_child(spawn_particles)
	spawn_particles.global_position = position
	spawn_particles.emitting = true
	spawn_particles.one_shot = true
	spawn_particles.amount = 30
	spawn_particles.lifetime = 0.8
	spawn_particles.explosiveness = 1.0
	
	var sphere = SphereMesh.new()
	sphere.radius = 0.05
	spawn_particles.mesh = sphere
	
	spawn_particles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	spawn_particles.emission_sphere_radius = 0.5
	spawn_particles.direction = Vector3.ZERO
	spawn_particles.gravity = Vector3.ZERO
	spawn_particles.initial_velocity_min = 1.5
	spawn_particles.initial_velocity_max = 3.0
	spawn_particles.scale_amount_min = 0.5
	spawn_particles.scale_amount_max = 1.5
	
	# Color según el tipo de gema
	var gem_colors = {
		"normal": Color(0.2, 0.6, 1.0),
		"golden": Color(1.0, 0.85, 0.0),
		"green": Color(0.0, 0.9, 0.3),
		"purple": Color(0.7, 0.0, 1.0),
		"red": Color(1.0, 0.1, 0.1),
	}
	spawn_particles.color = gem_colors.get(gem_type, Color.WHITE)
	
	# Limpiar después
	await get_tree().create_timer(1.0).timeout
	spawn_particles.queue_free()

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
