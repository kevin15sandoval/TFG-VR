extends XRNode3D
# ─────────────────────────────────────────────────────────────────────────────
# XRHandLuggage — Hand Tracking para agarrar maletas CON manos reales
# Compatible con XRNode3D para hand tracking nativo
# ─────────────────────────────────────────────────────────────────────────────

var held_luggage: RigidBody3D = null
var nearby_luggage: RigidBody3D = null
var was_grabbing: bool = false

@onready var grab_area: Area3D = null
@onready var hand_visual: MeshInstance3D = null

func _ready() -> void:
	# Crear visual de mano (esfera pequeña)
	hand_visual = MeshInstance3D.new()
	var sphere = SphereMesh.new()
	sphere.radius = 0.05  # 5cm
	sphere.height = 0.1
	hand_visual.mesh = sphere
	
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.8, 0.6)  # Color piel
	mat.metallic = 0.0
	mat.roughness = 0.7
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color.a = 0.8
	hand_visual.material_override = mat
	add_child(hand_visual)
	
	# Crear área de agarre (más grande para hand tracking)
	grab_area = Area3D.new()
	add_child(grab_area)
	grab_area.collision_layer = 0
	grab_area.collision_mask = 4  # Detectar maletas en layer 4
	
	var grab_collision = CollisionShape3D.new()
	var grab_shape = SphereShape3D.new()
	grab_shape.radius = 0.2  # 20cm de radio
	grab_collision.shape = grab_shape
	grab_area.add_child(grab_collision)
	
	# Conectar señales de área
	grab_area.body_entered.connect(_on_grab_area_entered)
	grab_area.body_exited.connect(_on_grab_area_exited)
	
	print("[XRHand] 🖐️ Hand Tracking activado para ", tracker)

func _process(_delta: float) -> void:
	# Si tenemos maleta agarrada, moverla con la mano
	if held_luggage and is_instance_valid(held_luggage):
		held_luggage.global_position = global_position
		held_luggage.global_rotation = global_rotation
	
	# AUTO-GRAB: Si hay maleta cerca y mano se detiene sobre ella
	if nearby_luggage and not held_luggage and is_instance_valid(nearby_luggage):
		var distance = global_position.distance_to(nearby_luggage.global_position)
		if distance < 0.15:  # Muy cerca (15cm)
			# Si la mano está quieta sobre la maleta por un momento, agarrar
			if not was_grabbing:
				grab_luggage(nearby_luggage)
				was_grabbing = true
	else:
		# Si se aleja, permitir soltar
		if was_grabbing and held_luggage:
			release_luggage()
			was_grabbing = false
	
	# Cambiar color de mano según estado
	if hand_visual and hand_visual.material_override:
		if nearby_luggage and not held_luggage:
			# Verde = puede agarrar
			hand_visual.material_override.albedo_color = Color(0.2, 1.0, 0.3, 0.9)
			hand_visual.scale = Vector3.ONE * 1.5  # Pulsar visual
		elif held_luggage:
			# Amarillo = agarrando
			hand_visual.material_override.albedo_color = Color(1.0, 0.9, 0.2, 0.9)
			hand_visual.scale = Vector3.ONE * 1.2
		else:
			# Normal
			hand_visual.material_override.albedo_color = Color(1.0, 0.8, 0.6, 0.8)
			hand_visual.scale = Vector3.ONE

func _on_grab_area_entered(body: Node3D) -> void:
	if body.has_method("grab") and not held_luggage:
		nearby_luggage = body
		print("[XRHand] 🖐️ Maleta detectada cerca de ", tracker)

func _on_grab_area_exited(body: Node3D) -> void:
	if body == nearby_luggage:
		nearby_luggage = null

func grab_luggage(luggage: RigidBody3D) -> void:
	if held_luggage:
		return
	
	held_luggage = luggage
	
	if luggage.has_method("grab"):
		luggage.grab(self)
	
	print("[XRHand] ✅ Maleta agarrada con ", tracker)

func release_luggage() -> void:
	if not held_luggage:
		return
	
	var luggage = held_luggage
	held_luggage = null
	
	if luggage.has_method("release"):
		luggage.release()
	
	print("[XRHand] 📦 Maleta soltada por ", tracker)
