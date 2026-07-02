extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# LaserBeam — Rayo láser que detecta colisión con manos del jugador
# ─────────────────────────────────────────────────────────────────────────────

signal player_hit  # Se emite cuando el jugador toca el láser

@export var laser_length: float = 5.0
@export var laser_thickness: float = 0.05
@export var move_speed: float = 0.5  # Velocidad de movimiento (0 = estático)
@export var move_range: float = 2.0  # Rango de movimiento
@export var blink_enabled: bool = false  # Si parpadea
@export var blink_interval: float = 1.0  # Segundos entre parpadeos

var _mesh_instance: MeshInstance3D
var _area: Area3D
var _collision: CollisionShape3D
var _initial_position: Vector3
var _move_direction: int = 1
var _blink_timer: float = 0.0
var _is_visible: bool = true

func _ready() -> void:
	_initial_position = global_position
	_create_laser_visual()
	_create_collision_area()

func _create_laser_visual() -> void:
	# Crear mesh del láser (cilindro rojo brillante)
	_mesh_instance = MeshInstance3D.new()
	add_child(_mesh_instance)
	
	var cylinder = CylinderMesh.new()
	cylinder.top_radius = laser_thickness
	cylinder.bottom_radius = laser_thickness
	cylinder.height = laser_length
	_mesh_instance.mesh = cylinder
	
	# Material emisivo rojo brillante
	var material = StandardMaterial3D.new()
	material.albedo_color = Color(1.0, 0.0, 0.0, 0.9)
	material.emission_enabled = true
	material.emission = Color(1.0, 0.0, 0.0)
	material.emission_energy_multiplier = 3.0
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mesh_instance.material_override = material
	
	# Partículas de chispas en los extremos
	_create_spark_particles(Vector3(0, laser_length/2, 0))
	_create_spark_particles(Vector3(0, -laser_length/2, 0))

func _create_spark_particles(pos: Vector3) -> void:
	var particles = CPUParticles3D.new()
	_mesh_instance.add_child(particles)
	particles.position = pos
	particles.emitting = true
	particles.amount = 15
	particles.lifetime = 0.3
	particles.explosiveness = 0.2
	
	var sphere = SphereMesh.new()
	sphere.radius = 0.01
	particles.mesh = sphere
	
	particles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	particles.emission_sphere_radius = 0.05
	particles.direction = Vector3(0, 0, 0)
	particles.gravity = Vector3(0, -0.5, 0)
	particles.initial_velocity_min = 0.1
	particles.initial_velocity_max = 0.3
	particles.scale_amount_min = 0.5
	particles.scale_amount_max = 1.0
	particles.color = Color(1.0, 0.2, 0.0, 1.0)

func _create_collision_area() -> void:
	_area = Area3D.new()
	add_child(_area)
	_area.collision_layer = 4  # Layer 3 para láser
	_area.collision_mask = 2   # Detecta manos (layer 2)
	
	_collision = CollisionShape3D.new()
	_area.add_child(_collision)
	
	var shape = CylinderShape3D.new()
	shape.radius = laser_thickness * 1.2  # Un poco más ancho para detección
	shape.height = laser_length
	_collision.shape = shape
	
	_area.body_entered.connect(_on_body_entered)
	_area.area_entered.connect(_on_area_entered)

func _on_body_entered(_body: Node3D) -> void:
	_trigger_hit()

func _on_area_entered(_area_node: Area3D) -> void:
	# Detecta las manos del jugador (Area3D)
	if _area_node.name.contains("Hand"):
		_trigger_hit()

func _trigger_hit() -> void:
	if _is_visible:  # Solo cuenta si el láser está visible
		print("[Laser] ⚡ Jugador tocó el láser!")
		player_hit.emit()
		_flash_effect()

func _flash_effect() -> void:
	# Efecto de flash cuando se toca
	var tween = create_tween()
	tween.tween_property(_mesh_instance, "scale", Vector3(1.3, 1.0, 1.3), 0.1)
	tween.tween_property(_mesh_instance, "scale", Vector3.ONE, 0.1)

func _process(delta: float) -> void:
	# Movimiento del láser
	if move_speed > 0:
		var offset = sin(Time.get_ticks_msec() / 1000.0 * move_speed * PI) * move_range
		global_position = _initial_position + transform.basis.x * offset
	
	# Parpadeo
	if blink_enabled:
		_blink_timer += delta
		if _blink_timer >= blink_interval:
			_blink_timer = 0.0
			_toggle_visibility()

func _toggle_visibility() -> void:
	_is_visible = !_is_visible
	_mesh_instance.visible = _is_visible
	_area.monitoring = _is_visible  # Desactiva colisión cuando invisible

func set_color(color: Color) -> void:
	if _mesh_instance:
		var material = _mesh_instance.material_override as StandardMaterial3D
		if material:
			material.albedo_color = color
			material.emission = color
