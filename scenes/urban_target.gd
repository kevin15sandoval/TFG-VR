extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# UrbanTarget — Objetivo/señal en el entorno urbano
# Tipos: window, lamp, door, traffic_sign
# ─────────────────────────────────────────────────────────────────────────────

signal target_activated(target_id: int, points: int, position: Vector3, sequence: int)

@export var target_id: int = 0
@export var points: int = 10
@export var target_type: String = "window"  # window, lamp, door, traffic_sign
@export var sequence_number: int = 0  # 0 = sin secuencia, 1+ = orden
@export var target_color: Color = Color(0.2, 1.0, 0.3)  # Verde por defecto

var _mesh_instance: MeshInstance3D
var _area: Area3D
var _label: Label3D
var _is_active: bool = true
var _is_collected: bool = false
var _particles: CPUParticles3D

func _ready() -> void:
	_create_target_visual()
	_create_collision_area()
	if sequence_number > 0:
		_create_sequence_label()
	_create_particles()
	_create_directional_arrow()

func _create_target_visual() -> void:
	_mesh_instance = MeshInstance3D.new()
	add_child(_mesh_instance)
	
	# Esfera brillante
	var sphere = SphereMesh.new()
	sphere.radius = 0.25
	_mesh_instance.mesh = sphere
	
	# Material según tipo
	var material = StandardMaterial3D.new()
	material.albedo_color = target_color
	material.emission_enabled = true
	material.emission = target_color
	material.emission_energy_multiplier = 4.0
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mesh_instance.material_override = material
	
	# Animación de pulso
	_animate_pulse()
	
	# Anillo exterior
	_create_outer_ring()

func _create_outer_ring() -> void:
	var ring = MeshInstance3D.new()
	_mesh_instance.add_child(ring)
	
	var torus = TorusMesh.new()
	torus.inner_radius = 0.25
	torus.outer_radius = 0.35
	ring.mesh = torus
	
	var material = StandardMaterial3D.new()
	material.albedo_color = Color(target_color.r, target_color.g, target_color.b, 0.5)
	material.emission_enabled = true
	material.emission = target_color
	material.emission_energy_multiplier = 2.0
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = material
	
	# Rotación constante
	var tween = create_tween()
	tween.set_loops()
	tween.tween_property(ring, "rotation:y", TAU, 2.0).from(0.0)

func _create_directional_arrow() -> void:
	# Flecha que apunta al target desde lejos
	var arrow = MeshInstance3D.new()
	add_child(arrow)
	arrow.position = Vector3(0, 0.5, 0)
	
	var cone = CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 0.15
	cone.height = 0.3
	arrow.mesh = cone
	
	var material = StandardMaterial3D.new()
	material.albedo_color = target_color
	material.emission_enabled = true
	material.emission = target_color
	material.emission_energy_multiplier = 3.0
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	arrow.material_override = material
	
	# Animación de bobbing
	var tween = create_tween()
	tween.set_loops()
	tween.tween_property(arrow, "position:y", 0.7, 1.0).set_trans(Tween.TRANS_SINE)
	tween.tween_property(arrow, "position:y", 0.5, 1.0).set_trans(Tween.TRANS_SINE)

func _animate_pulse() -> void:
	var tween = create_tween()
	tween.set_loops()
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 1.3, 0.8).set_trans(Tween.TRANS_SINE)
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 0.9, 0.8).set_trans(Tween.TRANS_SINE)

func _create_sequence_label() -> void:
	_label = Label3D.new()
	add_child(_label)
	_label.position = Vector3(0, 0.4, 0)
	_label.text = str(sequence_number)
	_label.font_size = 64
	_label.modulate = Color.WHITE
	_label.outline_size = 12
	_label.outline_modulate = Color.BLACK
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED

func _create_particles() -> void:
	_particles = CPUParticles3D.new()
	add_child(_particles)
	_particles.emitting = true
	_particles.amount = 30
	_particles.lifetime = 2.0
	_particles.explosiveness = 0.0
	
	var sphere = SphereMesh.new()
	sphere.radius = 0.03
	_particles.mesh = sphere
	
	_particles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	_particles.emission_sphere_radius = 0.3
	_particles.direction = Vector3.UP
	_particles.gravity = Vector3(0, 0.3, 0)
	_particles.initial_velocity_min = 0.2
	_particles.initial_velocity_max = 0.4
	_particles.scale_amount_min = 0.5
	_particles.scale_amount_max = 1.0
	_particles.color = target_color

func _create_collision_area() -> void:
	_area = Area3D.new()
	add_child(_area)
	_area.collision_layer = 1
	_area.collision_mask = 2
	
	var collision = CollisionShape3D.new()
	_area.add_child(collision)
	
	var shape = SphereShape3D.new()
	shape.radius = 0.3
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
	print("[UrbanTarget] ✅ Target ", target_id, " activado! +", points, " pts")
	
	target_activated.emit(target_id, points, global_position, sequence_number)
	
	_activation_effect()
	_play_activation_sound()
	
	await get_tree().create_timer(0.5).timeout
	queue_free()

func _activation_effect() -> void:
	# Explosión de partículas
	var explosion = CPUParticles3D.new()
	get_parent().add_child(explosion)
	explosion.global_position = global_position
	explosion.emitting = true
	explosion.one_shot = true
	explosion.amount = 80
	explosion.lifetime = 1.0
	explosion.explosiveness = 1.0
	
	var sphere = SphereMesh.new()
	sphere.radius = 0.05
	explosion.mesh = sphere
	
	explosion.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	explosion.emission_sphere_radius = 0.2
	explosion.direction = Vector3.ZERO
	explosion.gravity = Vector3.ZERO
	explosion.initial_velocity_min = 2.0
	explosion.initial_velocity_max = 4.0
	explosion.scale_amount_min = 0.8
	explosion.scale_amount_max = 1.5
	explosion.color = target_color
	
	# Escala y desvanece
	var tween = create_tween()
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 3.0, 0.4)
	tween.parallel().tween_property(_mesh_instance, "modulate:a", 0.0, 0.4)
	
	# Limpiar explosión
	await get_tree().create_timer(1.5).timeout
	explosion.queue_free()

func _play_activation_sound() -> void:
	var audio = AudioStreamPlayer3D.new()
	get_parent().add_child(audio)
	audio.global_position = global_position
	audio.max_distance = 15.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		var hz = 700.0 + (sequence_number * 50.0)  # Tono más alto según secuencia
		var frames = int(generator.mix_rate * 0.25)
		
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var amplitude = 0.35 * (1.0 - t / 0.25)
			var sample = sin(t * hz * TAU) * amplitude
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.3).timeout
	audio.queue_free()

func set_active(active: bool) -> void:
	_is_active = active
	if _mesh_instance:
		_mesh_instance.visible = active
	if _area:
		_area.monitoring = active
	if _particles:
		_particles.emitting = active

func highlight(enabled: bool) -> void:
	if not _mesh_instance:
		return
	
	if enabled:
		# Destacar como siguiente objetivo
		var tween = create_tween()
		tween.set_loops()
		tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 1.6, 0.5)
		tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 1.2, 0.5)
	else:
		# Volver a normal
		var tween = create_tween()
		tween.tween_property(_mesh_instance, "scale", Vector3.ONE, 0.3)
