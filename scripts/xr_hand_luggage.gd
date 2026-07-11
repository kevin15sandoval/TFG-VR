extends XRController3D
# ─────────────────────────────────────────────────────────────────────────────
# XRHandLuggage — Controlador VR para agarrar y soltar maletas
# ─────────────────────────────────────────────────────────────────────────────

var held_luggage: RigidBody3D = null
var nearby_luggage: RigidBody3D = null

@onready var grab_area: Area3D = null
@onready var hand_visual: MeshInstance3D = null

func _ready() -> void:
	# Crear visual de mano (esfera)
	hand_visual = MeshInstance3D.new()
	var sphere = SphereMesh.new()
	sphere.radius = 0.05  # 5cm
	sphere.height = 0.1
	hand_visual.mesh = sphere
	
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.8, 0.6)  # Color piel
	mat.metallic = 0.0
	mat.roughness = 0.7
	hand_visual.material_override = mat
	add_child(hand_visual)
	
	# Crear área de agarre
	grab_area = Area3D.new()
	add_child(grab_area)
	grab_area.collision_layer = 0
	grab_area.collision_mask = 4  # Detectar maletas en layer 4
	
	var grab_collision = CollisionShape3D.new()
	var grab_shape = SphereShape3D.new()
	grab_shape.radius = 0.25  # 25cm de radio
	grab_collision.shape = grab_shape
	grab_area.add_child(grab_collision)
	
	grab_area.body_entered.connect(_on_grab_area_entered)
	grab_area.body_exited.connect(_on_grab_area_exited)
	
	# Conectar botón de agarre
	button_pressed.connect(_on_button_pressed)
	button_released.connect(_on_button_released)
	
	print("[XRHand] Controlador ", tracker, " inicializado para agarrar maletas")

func _process(_delta: float) -> void:
	# Si tenemos maleta agarrada, moverla con la mano
	if held_luggage and is_instance_valid(held_luggage):
		held_luggage.global_position = global_position
		held_luggage.global_rotation = global_rotation
	
	# Cambiar color de mano si hay maleta cerca
	if hand_visual:
		if nearby_luggage and not held_luggage:
			hand_visual.material_override.albedo_color = Color(0.2, 1.0, 0.3)  # Verde = puede agarrar
		elif held_luggage:
			hand_visual.material_override.albedo_color = Color(1.0, 0.9, 0.2)  # Amarillo = agarrando
		else:
			hand_visual.material_override.albedo_color = Color(1.0, 0.8, 0.6)  # Normal

func _on_grab_area_entered(body: Node3D) -> void:
	if body.has_method("grab") and not held_luggage:
		nearby_luggage = body
		print("[XRHand] Maleta cerca del controlador ", tracker)

func _on_grab_area_exited(body: Node3D) -> void:
	if body == nearby_luggage:
		nearby_luggage = null

func _on_button_pressed(name: String) -> void:
	# Agarrar con trigger o grip
	if name == "trigger_click" or name == "grip_click":
		if nearby_luggage and not held_luggage and is_instance_valid(nearby_luggage):
			grab_luggage(nearby_luggage)

func _on_button_released(name: String) -> void:
	# Soltar con trigger o grip
	if name == "trigger_click" or name == "grip_click":
		if held_luggage:
			release_luggage()

func grab_luggage(luggage: RigidBody3D) -> void:
	if held_luggage:
		return
	
	held_luggage = luggage
	
	if luggage.has_method("grab"):
		luggage.grab(self)
	
	# Vibración háptica
	trigger_haptic_pulse("haptic", 0.0, 0.5, 0.1, 0.0)
	
	print("[XRHand] ✅ Maleta agarrada por ", tracker)

func release_luggage() -> void:
	if not held_luggage:
		return
	
	var luggage = held_luggage
	held_luggage = null
	
	if luggage.has_method("release"):
		luggage.release()
	
	# Vibración háptica ligera
	trigger_haptic_pulse("haptic", 0.0, 0.3, 0.05, 0.0)
	
	print("[XRHand] 📦 Maleta soltada por ", tracker)
