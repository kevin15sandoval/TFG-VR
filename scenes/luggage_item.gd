extends RigidBody3D
# ─────────────────────────────────────────────────────────────────────────────
# LuggageItem — Maleta individual con peso simulado
# ─────────────────────────────────────────────────────────────────────────────

signal luggage_grabbed(item: RigidBody3D, weight: float)
signal luggage_released(item: RigidBody3D, position: Vector3)
signal luggage_placed_correctly(item: RigidBody3D, zone: String, weight: float, points: int)
signal luggage_placed_wrong(item: RigidBody3D)
signal luggage_dropped(item: RigidBody3D)

@export var luggage_id: int = 0
@export var luggage_type: String = "green"  # green, yellow, red, purple
@export var weight: float = 5.0  # kg
@export var points: int = 10
@export var target_zone: String = "green"  # green, yellow, red

var is_grabbed: bool = false
var grabbed_by: Node3D = null  # Referencia al controlador XR que la agarró
var spawn_time: float = 0.0
var lifetime: float = 0.0
var on_conveyor: bool = true
var has_been_placed: bool = false

var _mesh: MeshInstance3D
var _collision: CollisionShape3D
var _particles: GPUParticles3D
var _label: Label3D
var _grab_area: Area3D  # Área para detectar controladores cerca

# Colores según tipo
const COLORS = {
	"green": Color(0.2, 0.8, 0.3),
	"yellow": Color(1.0, 0.9, 0.2),
	"red": Color(0.9, 0.2, 0.2),
	"purple": Color(0.7, 0.2, 0.9)
}

# Tamaños según tipo (MÁS PEQUEÑAS para caber en la cinta)
const SIZES = {
	"green": Vector3(0.2, 0.15, 0.25),    # Pequeña
	"yellow": Vector3(0.25, 0.2, 0.3),   # Mediana
	"red": Vector3(0.3, 0.25, 0.35),      # Grande
	"purple": Vector3(0.35, 0.3, 0.4)    # XL
}

func _ready() -> void:
	spawn_time = Time.get_ticks_msec() / 1000.0
	_create_visual()
	_setup_physics()
	_create_grab_area()
	
	# Conectar señales de colisión
	body_entered.connect(_on_body_entered)
	
	print("[Luggage] Maleta ", luggage_id, " creada | Tipo: ", luggage_type, " | Peso: ", weight, "kg")

func _create_visual() -> void:
	# Crear mesh (caja)
	_mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = SIZES.get(luggage_type, Vector3(0.4, 0.3, 0.5))
	_mesh.mesh = box
	
	# Material con color según tipo
	var mat = StandardMaterial3D.new()
	mat.albedo_color = COLORS.get(luggage_type, Color.WHITE)
	mat.metallic = 0.2
	mat.roughness = 0.8
	_mesh.material_override = mat
	
	add_child(_mesh)
	
	# Collision shape
	_collision = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = SIZES.get(luggage_type, Vector3(0.4, 0.3, 0.5))
	_collision.shape = shape
	add_child(_collision)
	
	# Partículas para feedback
	_particles = GPUParticles3D.new()
	_particles.amount = 20
	_particles.lifetime = 0.5
	_particles.one_shot = true
	_particles.emitting = false
	_particles.explosiveness = 1.0
	add_child(_particles)
	
	# Label con peso
	_label = Label3D.new()
	_label.text = str(int(weight)) + "kg"
	_label.font_size = 32
	_label.modulate = Color.WHITE
	_label.outline_size = 8
	_label.outline_modulate = Color.BLACK
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.position = Vector3(0, SIZES.get(luggage_type, Vector3.ONE).y / 2 + 0.15, 0)
	add_child(_label)

func _setup_physics() -> void:
	mass = weight
	gravity_scale = 1.0
	collision_layer = 4  # Layer 4 para maletas
	collision_mask = 1   # Detecta suelo y zonas
	
	# Fricción para simular peso
	physics_material_override = PhysicsMaterial.new()
	physics_material_override.friction = 0.8
	physics_material_override.bounce = 0.1

func _create_grab_area() -> void:
	# Crear área de detección para controladores VR
	_grab_area = Area3D.new()
	add_child(_grab_area)
	_grab_area.collision_layer = 0
	_grab_area.collision_mask = 8  # Layer 8 para detectar manos VR
	
	# Collision shape para área (ligeramente más grande que la maleta)
	var grab_collision = CollisionShape3D.new()
	var grab_shape = SphereShape3D.new()
	grab_shape.radius = 0.2  # 20cm de radio para agarrar
	grab_collision.shape = grab_shape
	_grab_area.add_child(grab_collision)
	
	# Conectar señales
	_grab_area.body_entered.connect(_on_grab_area_entered)
	_grab_area.body_exited.connect(_on_grab_area_exited)
	_grab_area.area_entered.connect(_on_grab_area_entered_area)
	_grab_area.area_exited.connect(_on_grab_area_exited_area)
	
	print("[Luggage] Área de agarre creada (radio 0.2m)")

func _on_grab_area_entered_area(area: Area3D) -> void:
	# Detectar si es un controlador XR
	if area.get_parent() and area.get_parent() is XRController3D and not is_grabbed:
		print("[Luggage] Controlador XR cerca de maleta ", luggage_id)
		area.get_parent().set_meta("nearby_luggage", self)

func _on_grab_area_exited_area(area: Area3D) -> void:
	if area.get_parent() and area.get_parent() is XRController3D:
		if area.get_parent().get_meta("nearby_luggage", null) == self:
			area.get_parent().remove_meta("nearby_luggage")
			print("[Luggage] Controlador XR alejado de maleta ", luggage_id)

func _on_grab_area_entered(body: Node3D) -> void:
	# Detectar si es un controlador XR
	if body.is_in_group("xr_controller") and not is_grabbed:
		print("[Luggage] Controlador XR cerca de maleta ", luggage_id)
		# El controlador puede agarrar esta maleta
		body.set_meta("nearby_luggage", self)

func _on_grab_area_exited(body: Node3D) -> void:
	if body.is_in_group("xr_controller"):
		if body.get_meta("nearby_luggage", null) == self:
			body.remove_meta("nearby_luggage")
			print("[Luggage] Controlador XR alejado de maleta ", luggage_id)

func _process(delta: float) -> void:
	if not is_grabbed:
		lifetime += delta
		
		# Si está en la cinta y no ha sido agarrada después de 15 segundos, destruir
		if on_conveyor and lifetime > 15.0 and not has_been_placed:
			print("[Luggage] Maleta ", luggage_id, " expiró (no agarrada)")
			luggage_dropped.emit(self)
			queue_free()
	
	# Si cae por debajo del mundo
	if global_position.y < -5.0:
		print("[Luggage] Maleta ", luggage_id, " cayó al vacío")
		luggage_dropped.emit(self)
		queue_free()

func grab(hand: Node3D) -> void:
	if is_grabbed:
		return
	
	is_grabbed = true
	grabbed_by = hand
	on_conveyor = false
	
	# Cambiar a kinematic para control manual
	freeze = true
	
	# Vibración háptica según peso (más pesado = más vibración)
	var vibration_strength = remap(weight, 2.0, 15.0, 0.2, 0.8)
	_trigger_haptic_feedback(vibration_strength)
	
	print("[Luggage] Maleta ", luggage_id, " agarrada | Peso: ", weight, "kg")
	luggage_grabbed.emit(self, weight)

func release() -> void:
	if not is_grabbed:
		return
	
	is_grabbed = false
	grabbed_by = null
	freeze = false
	
	# Aplicar un pequeño impulso hacia abajo (simular soltar)
	apply_central_impulse(Vector3.DOWN * 2.0)
	
	print("[Luggage] Maleta ", luggage_id, " soltada en ", global_position)
	luggage_released.emit(self, global_position)

func place_in_zone(zone: String) -> void:
	has_been_placed = true
	
	if zone == target_zone:
		# Colocación correcta
		print("[Luggage] ✅ Maleta ", luggage_id, " colocada CORRECTAMENTE en zona ", zone)
		_show_success_effect()
		luggage_placed_correctly.emit(self, zone, weight, points)
	else:
		# Colocación incorrecta
		print("[Luggage] ❌ Maleta ", luggage_id, " colocada MAL (esperado: ", target_zone, ", real: ", zone, ")")
		_show_error_effect()
		luggage_placed_wrong.emit(self)
	
	# Destruir después de un momento
	await get_tree().create_timer(0.5).timeout
	queue_free()

func _show_success_effect() -> void:
	if _particles:
		_particles.emitting = true
	
	if _mesh and _mesh.material_override:
		var mat = _mesh.material_override as StandardMaterial3D
		mat.emission_enabled = true
		mat.emission = Color(0.2, 1.0, 0.3)
		mat.emission_energy = 3.0
	
	# Sonido de éxito
	_play_success_sound()

func _show_error_effect() -> void:
	if _mesh and _mesh.material_override:
		var mat = _mesh.material_override as StandardMaterial3D
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.2, 0.2)
		mat.emission_energy = 3.0
	
	# Sonido de error
	_play_error_sound()

func _play_success_sound() -> void:
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		var frames = int(generator.mix_rate * 0.15)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var freq = 800.0 + (i * 200.0 / frames)  # Subir frecuencia
			var amplitude = 0.3 * (1.0 - t / 0.15)
			var sample = sin(t * freq * TAU) * amplitude
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.2).timeout
	if is_instance_valid(audio):
		audio.queue_free()

func _play_error_sound() -> void:
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		var frames = int(generator.mix_rate * 0.2)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var freq = 300.0  # Tono bajo
			var amplitude = 0.4
			var sample = sin(t * freq * TAU) * amplitude
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.25).timeout
	if is_instance_valid(audio):
		audio.queue_free()

func _trigger_haptic_feedback(strength: float) -> void:
	# Vibración háptica (requiere controlador XR)
	if grabbed_by and grabbed_by.has_method("trigger_haptic_pulse"):
		grabbed_by.trigger_haptic_pulse("haptic", 0.0, strength, 0.1, 0.0)

func _on_body_entered(body: Node) -> void:
	# Detectar si entró en zona de colocación
	if body.is_in_group("placement_zone") and not has_been_placed:
		var zone_name = body.get_meta("zone_name", "")
		if zone_name != "":
			place_in_zone(zone_name)

func get_type_color() -> Color:
	return COLORS.get(luggage_type, Color.WHITE)
