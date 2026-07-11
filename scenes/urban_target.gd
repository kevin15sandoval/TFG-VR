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
	
	# Barra de progreso de mirada
	_create_gaze_progress_bar()

func _create_gaze_progress_bar() -> void:
	var progress_bar = MeshInstance3D.new()
	_mesh_instance.add_child(progress_bar)
	progress_bar.position = Vector3(0, -0.4, 0)
	
	var cylinder = CylinderMesh.new()
	cylinder.top_radius = 0.05
	cylinder.bottom_radius = 0.05
	cylinder.height = 0.0  # Crece con el progreso
	progress_bar.mesh = cylinder
	
	var material = StandardMaterial3D.new()
	material.albedo_color = Color(1.0, 1.0, 1.0, 0.9)
	material.emission_enabled = true
	material.emission = Color(1.0, 1.0, 1.0)
	material.emission_energy_multiplier = 3.0
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	progress_bar.material_override = material
	
	progress_bar.name = "GazeProgressBar"

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
	# No usamos colisión física, usamos detección por mirada (gaze)
	pass

var _gaze_time: float = 0.0
var _required_gaze_time: float = 2.0  # 2 segundos mirando
var _being_gazed: bool = false

func _process(delta: float) -> void:
	if not _is_active or _is_collected:
		return
	
	_check_gaze_detection(delta)

func _check_gaze_detection(delta: float) -> void:
	# Obtener cámara VR
	var camera = get_viewport().get_camera_3d()
	if not camera:
		return
	
	# Vector desde cámara al target
	var to_target = global_position - camera.global_position
	var distance = to_target.length()
	
	# Vector hacia adelante de la cámara (donde mira)
	var forward = -camera.global_transform.basis.z
	
	# Calcular ángulo entre mirada y target
	var angle = forward.angle_to(to_target.normalized())
	
	# Si está mirando al target (ángulo < 15 grados = 0.26 radianes)
	if angle < 0.26 and distance < 15.0:  # 15 metros max distancia
		_being_gazed = true
		_gaze_time += delta
		
		var progress = min(_gaze_time / _required_gaze_time, 1.0)
		
		# Feedback visual de progreso - escala
		if _mesh_instance:
			_mesh_instance.scale = Vector3.ONE * (1.0 + progress * 0.5)
			
			# Cambiar color según progreso (más brillante)
			var mat = _mesh_instance.material_override as StandardMaterial3D
			if mat:
				var color_progress = Color(
					target_color.r + (1.0 - target_color.r) * progress,
					target_color.g + (1.0 - target_color.g) * progress,
					target_color.b
				)
				mat.emission = color_progress
				mat.emission_energy_multiplier = 4.0 + progress * 4.0  # Más brillo
		
		# Actualizar barra de progreso
		var progress_bar = _mesh_instance.get_node_or_null("GazeProgressBar") as MeshInstance3D
		if progress_bar:
			var cylinder = progress_bar.mesh as CylinderMesh
			if cylinder:
				cylinder.height = progress * 0.6  # Crece hasta 0.6m
				progress_bar.position.y = -0.4 + (progress * 0.3)  # Sube mientras crece
		
		# Activar cuando se completa el tiempo
		if _gaze_time >= _required_gaze_time:
			_try_activate()
	else:
		# Resetear si deja de mirar
		if _being_gazed:
			_gaze_time = max(0.0, _gaze_time - delta * 2.0)  # Pierde progreso lentamente
			
			# Registrar interrupción de mirada
			if _gaze_time > 0.5:  # Solo si tenía progreso significativo
				var city_manager = get_tree().root.get_node_or_null("CityWorld/CityGameManager")
				if city_manager:
					city_manager.register_gaze_interruption()
			
			if _gaze_time <= 0.0:
				_being_gazed = false
				if _mesh_instance:
					_mesh_instance.scale = Vector3.ONE
					var mat = _mesh_instance.material_override as StandardMaterial3D
					if mat:
						mat.emission = target_color
						mat.emission_energy_multiplier = 4.0
			
			# Actualizar barra de progreso al decrecer
			var progress = _gaze_time / _required_gaze_time
			var progress_bar = _mesh_instance.get_node_or_null("GazeProgressBar") as MeshInstance3D
			if progress_bar:
				var cylinder = progress_bar.mesh as CylinderMesh
				if cylinder:
					cylinder.height = progress * 0.6
					progress_bar.position.y = -0.4 + (progress * 0.3)

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
	# Explosión de partículas según puntuación
	var explosion = CPUParticles3D.new()
	get_parent().add_child(explosion)
	explosion.global_position = global_position
	explosion.emitting = true
	explosion.one_shot = true
	
	# Más partículas para mayor puntuación
	var particle_count = 80
	if points >= 30:  # Rojo - explosión épica
		particle_count = 150
	elif points >= 20:  # Amarillo - explosión media
		particle_count = 110
	
	explosion.amount = particle_count
	explosion.lifetime = 1.2
	explosion.explosiveness = 1.0
	
	var sphere = SphereMesh.new()
	sphere.radius = 0.08 if points >= 30 else 0.05
	explosion.mesh = sphere
	
	explosion.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	explosion.emission_sphere_radius = 0.3
	explosion.direction = Vector3.ZERO
	explosion.gravity = Vector3(0, -1.5, 0)  # Caen con gravedad
	explosion.initial_velocity_min = 3.0 if points >= 30 else 2.0
	explosion.initial_velocity_max = 6.0 if points >= 30 else 4.0
	explosion.scale_amount_min = 0.8
	explosion.scale_amount_max = 2.0 if points >= 30 else 1.5
	explosion.color = target_color
	
	# Anillo de expansión
	_create_shockwave()
	
	# Escala y desvanece con rebote
	var tween = create_tween()
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE * 3.5, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(_mesh_instance, "modulate:a", 0.0, 0.3)
	
	# Mostrar "+XX pts" flotante
	_show_points_popup()
	
	# Limpiar explosión
	await get_tree().create_timer(1.5).timeout
	explosion.queue_free()

func _create_shockwave() -> void:
	# Onda de choque expansiva
	var shockwave = MeshInstance3D.new()
	get_parent().add_child(shockwave)
	shockwave.global_position = global_position
	
	var torus = TorusMesh.new()
	torus.inner_radius = 0.3
	torus.outer_radius = 0.35
	shockwave.mesh = torus
	
	var material = StandardMaterial3D.new()
	material.albedo_color = Color(target_color.r, target_color.g, target_color.b, 0.8)
	material.emission_enabled = true
	material.emission = target_color
	material.emission_energy_multiplier = 5.0
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shockwave.material_override = material
	
	# Expandir y desvanecer
	var tween = create_tween()
	tween.tween_property(shockwave, "scale", Vector3.ONE * 8.0, 0.6).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(material, "albedo_color:a", 0.0, 0.6)
	
	await get_tree().create_timer(0.7).timeout
	shockwave.queue_free()

func _show_points_popup() -> void:
	# Label flotante mostrando puntos ganados
	var popup = Label3D.new()
	get_parent().add_child(popup)
	popup.global_position = global_position + Vector3(0, 0.5, 0)
	popup.pixel_size = 0.003
	popup.text = "+" + str(points) + " pts!"
	popup.font_size = 72
	popup.modulate = target_color
	popup.outline_size = 12
	popup.outline_modulate = Color.BLACK
	popup.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	
	# Flotar hacia arriba y desvanecer
	var tween = create_tween()
	tween.tween_property(popup, "global_position", popup.global_position + Vector3(0, 1.5, 0), 1.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(popup, "modulate:a", 0.0, 1.0).set_delay(0.3)
	tween.parallel().tween_property(popup, "scale", Vector3.ONE * 1.5, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	
	await get_tree().create_timer(1.2).timeout
	popup.queue_free()

func _play_activation_sound() -> void:
	# Sonido más rico y satisfactorio
	var audio = AudioStreamPlayer3D.new()
	get_parent().add_child(audio)
	audio.global_position = global_position
	audio.max_distance = 20.0
	audio.unit_size = 5.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Sonido según puntos (color)
		var base_hz = 600.0
		if points >= 30:  # Rojo - sonido épico
			base_hz = 900.0
		elif points >= 20:  # Amarillo - sonido medio
			base_hz = 750.0
		else:  # Verde - sonido suave
			base_hz = 600.0
		
		# Generar sonido con armónicos (más rico)
		var frames = int(generator.mix_rate * 0.35)
		
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var envelope = 0.5 * (1.0 - t / 0.35)
			
			# Tono principal + armónicos
			var sample = sin(t * base_hz * TAU) * envelope * 0.6
			sample += sin(t * base_hz * 2.0 * TAU) * envelope * 0.2  # Octava
			sample += sin(t * base_hz * 1.5 * TAU) * envelope * 0.15  # Quinta
			
			# "Ding" al final para 30pts
			if points >= 30:
				sample += sin(t * 1200.0 * TAU) * envelope * 0.3
			
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.4).timeout
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
