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
	
	# Ajustar posición Y según tipo
	if "y_pos" in dims:
		_mesh_instance.position.y = dims["y_pos"] - 1.5  # Offset desde el centro
	
	# Aplicar rotación para diagonales
	if "rotation" in dims:
		_mesh_instance.rotation_degrees.z = dims["rotation"]
	
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
	shape.size = Vector3(dims.get("width", 6.0), dims.get("height", 0.08) * 2.0, laser_thickness * 2.0)
	_collision.shape = shape
	
	# Ajustar posición de colisión según tipo
	if "y_pos" in dims:
		_collision.position.y = dims["y_pos"] - 1.5
	
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
	# El láser desaparece después de tocar
	await get_tree().create_timer(0.3).timeout
	queue_free()

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
	
	# Verificar si pasó al jugador sin tocar (ESQUIVADO)
	if global_position.z > 2.0 and not _has_been_dodged and not _player_in_danger:
		_has_been_dodged = true
		print("[Laser] ✅ ¡LÁSER ESQUIVADO! +puntos")
		laser_dodged.emit()
		# Desaparecer
		queue_free()
	
	# Eliminar si se fue muy lejos
	if global_position.z > 5.0:
		queue_free()

func set_start_position(pos: Vector3) -> void:
	_start_position = pos
	global_position = pos
