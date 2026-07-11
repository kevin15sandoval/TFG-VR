extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# LaserBeam — Láser que AVANZA hacia el jugador (tipo LIMBO)
# El jugador debe ESQUIVAR moviendo el cuerpo (agacharse, inclinarse, etc.)
# ─────────────────────────────────────────────────────────────────────────────

signal player_hit  # Se emite cuando el jugador toca el láser
signal laser_dodged  # Se emite cuando el jugador esquiva exitosamente

@export_enum("horizontal_high", "horizontal_mid", "horizontal_low", "vertical_left", "vertical_right", "diagonal") var laser_type: String = "horizontal_mid"
@export var advance_speed: float = 1.5  # Velocidad de avance hacia el jugador (m/s)
@export var laser_thickness: float = 0.08
@export var warn_distance: float = 5.0  # Distancia a la que aparece advertencia

var _mesh_instance: MeshInstance3D
var _area: Area3D
var _collision: CollisionShape3D
var _warning_area: Area3D
var _start_position: Vector3
var _has_warned: bool = false
var _has_been_dodged: bool = false
var _player_in_danger: bool = false

# Dimensiones del láser según tipo
var _laser_dimensions: Dictionary = {
	"horizontal_high": {"width": 6.0, "height": 0.08, "y_pos": 1.9},  # Agacharse
	"horizontal_mid": {"width": 6.0, "height": 0.08, "y_pos": 1.3},   # Inclinarse
	"horizontal_low": {"width": 6.0, "height": 0.08, "y_pos": 0.7},   # Saltar/subir brazos
	"vertical_left": {"width": 0.08, "height": 3.0, "x_pos": -1.5},   # Inclinarse derecha
	"vertical_right": {"width": 0.08, "height": 3.0, "x_pos": 1.5},   # Inclinarse izquierda
	"diagonal": {"width": 8.0, "height": 0.08, "rotation": 45.0},     # Combinar movimientos
}

func _ready() -> void:
	_start_position = global_position
	_create_laser_visual()
	_create_collision_areas()
	_create_warning_visual()

func _create_laser_visual() -> void:
	# Crear mesh del láser según tipo
	_mesh_instance = MeshInstance3D.new()
	add_child(_mesh_instance)
	
	var dims = _laser_dimensions.get(laser_type, _laser_dimensions["horizontal_mid"])
	
	# Usar BoxMesh para láseres rectangulares
	var box = BoxMesh.new()
	box.size = Vector3(dims.get("width", 6.0), dims.get("height", 0.08), laser_thickness)
	_mesh_instance.mesh = box
	
	# IMPORTANTE: Ajustar posición Y según tipo DE LÁSER
	if laser_type.begins_with("horizontal"):
		# Láseres horizontales: ajustar altura Y
		var y_offset = 0.0
		if laser_type == "horizontal_high":
			y_offset = 1.9
		elif laser_type == "horizontal_mid":
			y_offset = 1.3
		elif laser_type == "horizontal_low":
			y_offset = 0.7
		_mesh_instance.position.y = y_offset
		print("[Laser] 🔴 Láser HORIZONTAL '", laser_type, "' en altura Y=", y_offset)
	
	elif laser_type.begins_with("vertical"):
		# Láseres verticales: ajustar posición X
		var x_offset = 0.0
		if laser_type == "vertical_left":
			x_offset = -1.5
		elif laser_type == "vertical_right":
			x_offset = 1.5
		_mesh_instance.position.x = x_offset
		_mesh_instance.position.y = 1.5  # Centrado verticalmente
		print("[Laser] 🔴 Láser VERTICAL '", laser_type, "' en posición X=", x_offset)
	
	elif laser_type == "diagonal":
		# Láser diagonal: rotar 45 grados
		_mesh_instance.rotation_degrees.z = 45.0
		_mesh_instance.position.y = 1.5
		print("[Laser] 🔴 Láser DIAGONAL con rotación 45°")
	
	# Material emisivo rojo BRILLANTE y peligroso
	var material = StandardMaterial3D.new()
	material.albedo_color = Color(1.0, 0.0, 0.0, 0.95)
	material.emission_enabled = true
	material.emission = Color(1.0, 0.0, 0.0)
	material.emission_energy_multiplier = 5.0  # MUY brillante
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mesh_instance.material_override = material
	
	print("[Laser] 🔴 Láser tipo '", laser_type, "' creado en posición: ", global_position)

func _create_warning_visual() -> void:
	# Crear indicador visual de advertencia (líneas punteadas que se acercan)
	# TODO: Implementar sistema de advertencia visual
	pass

func _create_collision_areas() -> void:
	var dims = _laser_dimensions.get(laser_type, _laser_dimensions["horizontal_mid"])
	
	# Área de colisión principal (toca = fallo)
	_area = Area3D.new()
	add_child(_area)
	_area.collision_layer = 4  # Layer 3 para láser
	_area.collision_mask = 2   # Detecta manos y cabeza (layer 2)
	
	_collision = CollisionShape3D.new()
	_area.add_child(_collision)
	
	var shape = BoxShape3D.new()
	shape.size = Vector3(dims.get("width", 6.0), dims.get("height", 0.08) * 3.0, laser_thickness * 3.0)
	_collision.shape = shape
	
	# IMPORTANTE: Ajustar posición de colisión según tipo
	if laser_type.begins_with("horizontal"):
		var y_offset = 0.0
		if laser_type == "horizontal_high":
			y_offset = 1.9
		elif laser_type == "horizontal_mid":
			y_offset = 1.3
		elif laser_type == "horizontal_low":
			y_offset = 0.7
		_collision.position.y = y_offset
	
	elif laser_type.begins_with("vertical"):
		var x_offset = 0.0
		if laser_type == "vertical_left":
			x_offset = -1.5
		elif laser_type == "vertical_right":
			x_offset = 1.5
		_collision.position.x = x_offset
		_collision.position.y = 1.5
	
	elif laser_type == "diagonal":
		_collision.position.y = 1.5
	
	_area.body_entered.connect(_on_player_touch)
	_area.area_entered.connect(_on_player_touch_area)
	
	print("[Laser] ✅ Colisión configurada para tipo: ", laser_type)

func _on_player_touch(_body: Node3D) -> void:
	if not _player_in_danger:
		_player_in_danger = true
		_trigger_hit()

func _on_player_touch_area(_area_node: Area3D) -> void:
	# Detecta manos o cabeza del jugador
	var node_name = _area_node.name.to_lower()
	if "hand" in node_name or "head" in node_name or "camera" in node_name:
		if not _player_in_danger:
			_player_in_danger = true
			_trigger_hit()

func _trigger_hit() -> void:
	print("[Laser] ⚡ ¡JUGADOR TOCÓ EL LÁSER! Tipo: ", laser_type)
	player_hit.emit()
	_flash_hit_effect()
	_play_hit_sound()  # Sonido de error
	# El láser desaparece después de tocar
	await get_tree().create_timer(0.3).timeout
	queue_free()

func _play_hit_sound() -> void:
	# Sonido de error/daño cuando toca el láser
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Sonido grave y desagradable (error)
		var frames = int(generator.mix_rate * 0.3)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var amplitude = 0.6 * (1.0 - t / 0.3)
			var sample = sin(t * 200.0 * TAU) * amplitude  # Frecuencia baja = malo
			sample += sin(t * 150.0 * TAU) * amplitude * 0.5  # Armónico disonante
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.4).timeout
	if is_instance_valid(audio):
		audio.queue_free()

func _play_dodge_sound() -> void:
	# Sonido de éxito cuando esquiva el láser
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Sonido agudo y agradable (éxito)
		var frames = int(generator.mix_rate * 0.2)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var amplitude = 0.4 * (1.0 - t / 0.2)
			var sample = sin(t * 800.0 * TAU) * amplitude  # Frecuencia alta = bueno
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.3).timeout
	if is_instance_valid(audio):
		audio.queue_free()

func _flash_hit_effect() -> void:
	# Efecto de flash rojo intenso
	var tween = create_tween()
	tween.tween_property(_mesh_instance, "scale", Vector3(1.5, 1.5, 1.5), 0.1)
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE, 0.1)
	
	# Cambiar a blanco brillante por un momento
	var mat = _mesh_instance.material_override as StandardMaterial3D
	if mat:
		mat.emission = Color(1.0, 1.0, 1.0)
		mat.emission_energy_multiplier = 10.0
		await get_tree().create_timer(0.1).timeout
		if is_instance_valid(mat):
			mat.emission = Color(1.0, 0.0, 0.0)
			mat.emission_energy_multiplier = 5.0

func _process(delta: float) -> void:
	# MOVIMIENTO: Avanzar hacia el jugador (eje Z positivo en sistema local)
	global_position += global_transform.basis.z * advance_speed * delta
	
	# Verificar si SOBREPASÓ completamente al jugador sin tocar (ESQUIVADO)
	# El jugador está en Z=5, así que debe pasar más allá (Z > 6 o 7)
	if global_position.z > 7.0 and not _has_been_dodged and not _player_in_danger:
		_has_been_dodged = true
		print("[Laser] ✅ ¡LÁSER ESQUIVADO! +puntos")
		_play_dodge_sound()  # Sonido de éxito
		laser_dodged.emit()
		# Desaparecer
		queue_free()
	
	# Eliminar si se fue muy lejos
	if global_position.z > 12.0:
		queue_free()

func set_start_position(pos: Vector3) -> void:
	_start_position = pos
	global_position = pos
