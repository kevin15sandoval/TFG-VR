extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# ControlPanel — Botón interactivo que el jugador debe tocar
# ─────────────────────────────────────────────────────────────────────────────

signal panel_activated(panel_id: int, points: int)

@export var panel_id: int = 0
@export var points: int = 10
@export var panel_type: String = "normal"  # normal, golden, sequence
@export var sequence_number: int = -1  # Para modo secuencia

var _mesh_instance: MeshInstance3D
var _area: Area3D
var _label: Label3D
var _is_active: bool = true
var _is_collected: bool = false

func _ready() -> void:
	_create_panel_visual()
	_create_collision_area()
	_create_label()

func _create_panel_visual() -> void:
	_mesh_instance = MeshInstance3D.new()
	add_child(_mesh_instance)
	
	# Usar esfera como botón
	var sphere = SphereMesh.new()
	sphere.radius = 0.15
	_mesh_instance.mesh = sphere
	
	# Material según tipo
	var material = StandardMaterial3D.new()
	match panel_type:
		"golden":
			material.albedo_color = Color(1.0, 0.8, 0.0, 0.95)
			material.emission = Color(1.0, 0.8, 0.0)
			material.emission_energy_multiplier = 4.0
			points = 25
		"sequence":
			material.albedo_color = Color(0.0, 0.8, 1.0, 0.95)
			material.emission = Color(0.0, 0.8, 1.0)
			material.emission_energy_multiplier = 3.0
			points = 15
		_:  # normal
			material.albedo_color = Color(0.2, 1.0, 0.3, 0.95)
			material.emission = Color(0.2, 1.0, 0.3)
			material.emission_energy_multiplier = 3.0
			points = 10
	
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mesh_instance.material_override = material
	
	# Animación de pulso
	_animate_pulse()
	
	# Partículas flotantes
	_create_particles()

func _create_particles() -> void:
	var particles = CPUParticles3D.new()
	add_child(particles)
	particles.emitting = true
	particles.amount = 20
	particles.lifetime = 2.0
	particles.explosiveness = 0.0
	
	var sphere = SphereMesh.new()
	sphere.radius = 0.02
	particles.mesh = sphere
	
	particles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	particles.emission_sphere_radius = 0.2
	particles.direction = Vector3.UP
	particles.gravity = Vector3(0, 0.2, 0)
	particles.initial_velocity_min = 0.1
	particles.initial_velocity_max = 0.2
	particles.scale_amount_min = 0.3
	particles.scale_amount_max = 0.6
	
	match panel_type:
		"golden":
			particles.color = Color(1.0, 0.8, 0.0, 0.8)
		"sequence":
			particles.color = Color(0.0, 0.8, 1.0, 0.8)
		_:
			particles.color = Color(0.2, 1.0, 0.3, 0.8)

func _animate_pulse() -> void:
	var tween = create_tween()
	tween.set_loops()
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 1.2, 0.8).set_trans(Tween.TRANS_SINE)
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 0.9, 0.8).set_trans(Tween.TRANS_SINE)

func _create_label() -> void:
	if sequence_number > 0:
		_label = Label3D.new()
		add_child(_label)
		_label.position = Vector3(0, 0.3, 0)
		_label.text = str(sequence_number)
		_label.font_size = 48
		_label.modulate = Color.WHITE
		_label.outline_size = 8
		_label.outline_modulate = Color.BLACK
		_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED

func _create_collision_area() -> void:
	_area = Area3D.new()
	add_child(_area)
	_area.collision_layer = 1  # Layer 1 para objetivos
	_area.collision_mask = 2   # Detecta manos (layer 2)
	
	var collision = CollisionShape3D.new()
	_area.add_child(collision)
	
	var shape = SphereShape3D.new()
	shape.radius = 0.18
	collision.shape = shape
	
	_area.body_entered.connect(_on_body_entered)
	_area.area_entered.connect(_on_area_entered)

func _on_body_entered(_body: Node3D) -> void:
	_try_activate()

func _on_area_entered(_area_node: Area3D) -> void:
	if _area_node.name.contains("Hand"):
		_try_activate()

func _try_activate() -> void:
	if not _is_active or _is_collected:
		return
	
	_is_collected = true
	print("[Panel] ✅ Panel ", panel_id, " activado! +", points, " pts")
	
	panel_activated.emit(panel_id, points)
	
	# Efecto visual de activación
	_activation_effect()
	
	# Sonido de activación (beep)
	_play_activation_sound()
	
	# Desaparecer después de un momento
	await get_tree().create_timer(0.5).timeout
	queue_free()

func _activation_effect() -> void:
	# Explosión de partículas
	var explosion = CPUParticles3D.new()
	get_parent().add_child(explosion)
	explosion.global_position = global_position
	explosion.emitting = true
	explosion.one_shot = true
	explosion.amount = 50
	explosion.lifetime = 0.8
	explosion.explosiveness = 1.0
	
	var sphere = SphereMesh.new()
	sphere.radius = 0.03
	explosion.mesh = sphere
	
	explosion.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	explosion.emission_sphere_radius = 0.1
	explosion.direction = Vector3.ZERO
	explosion.gravity = Vector3.ZERO
	explosion.initial_velocity_min = 1.0
	explosion.initial_velocity_max = 2.0
	explosion.scale_amount_min = 0.5
	explosion.scale_amount_max = 1.5
	
	match panel_type:
		"golden":
			explosion.color = Color(1.0, 0.8, 0.0, 1.0)
		"sequence":
			explosion.color = Color(0.0, 0.8, 1.0, 1.0)
		_:
			explosion.color = Color(0.2, 1.0, 0.3, 1.0)
	
	# Escala hacia arriba y desvanece
	var tween = create_tween()
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 2.0, 0.3)
	tween.parallel().tween_property(_mesh_instance, "modulate:a", 0.0, 0.3)
	
	# Limpiar explosión después
	await get_tree().create_timer(1.0).timeout
	explosion.queue_free()

func _play_activation_sound() -> void:
	var audio = AudioStreamPlayer3D.new()
	get_parent().add_child(audio)
	audio.global_position = global_position
	audio.max_distance = 10.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		var hz = 800.0 if panel_type == "golden" else 600.0
		var frames = int(generator.mix_rate * 0.2)
		
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var amplitude = 0.3 * (1.0 - t / 0.2)
			var sample = sin(t * hz * TAU) * amplitude
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.3).timeout
	audio.queue_free()

func deactivate() -> void:
	_is_active = false
	modulate = Color(0.3, 0.3, 0.3, 0.5)
