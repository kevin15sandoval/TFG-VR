extends XRController3D
# ─────────────────────────────────────────────────────────────────────────────
# XRHandLuggage — Hand Tracking para agarrar maletas SIN mandos
# Usa gesto de pinza (pulgar + índice) para agarrar/soltar
# ─────────────────────────────────────────────────────────────────────────────

var held_luggage: RigidBody3D = null
var nearby_luggage: RigidBody3D = null
var is_pinching: bool = false
var last_pinch_state: bool = false

@onready var grab_area: Area3D = null
@onready var hand_visual: MeshInstance3D = null

func _ready() -> void:
	# Crear visual de mano (esfera pequeña)
	hand_visual = MeshInstance3D.new()
	var sphere = SphereMesh.new()
	sphere.radius = 0.03  # 3cm - más pequeño para hand tracking
	sphere.height = 0.06
	hand_visual.mesh = sphere
	
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.8, 0.6)  # Color piel
	mat.metallic = 0.0
	mat.roughness = 0.7
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color.a = 0.7  # Semi-transparente
	hand_visual.material_override = mat
	add_child(hand_visual)
	
	# Crear área de agarre
	grab_area = Area3D.new()
	add_child(grab_area)
	grab_area.collision_layer = 0
	grab_area.collision_mask = 4  # Detectar maletas en layer 4
	
	var grab_collision = CollisionShape3D.new()
	var grab_shape = SphereShape3D.new()
	grab_shape.radius = 0.15  # 15cm de radio para hand tracking
	grab_collision.shape = grab_shape
	grab_area.add_child(grab_collision)
	
	grab_area.body_entered.connect(_on_grab_area_entered)
	grab_area.body_exited.connect(_on_grab_area_exited)
	
	# HAND TRACKING: Conectar señales de botones (trigger simula pinza)
	button_pressed.connect(_on_button_pressed)
	button_released.connect(_on_button_released)
	
	print("[XRHand] 🖐️ Hand Tracking activado para ", tracker)

func _process(_delta: float) -> void:
	# Si tenemos maleta agarrada, moverla con la mano
	if held_luggage and is_instance_valid(held_luggage):
		held_luggage.global_position = global_position
		held_luggage.global_rotation = global_rotation
	
	# Cambiar color de mano según estado
	if hand_visual and hand_visual.material_override:
		if nearby_luggage and not held_luggage:
			# Verde = puede agarrar
			hand_visual.material_override.albedo_color = Color(0.2, 1.0, 0.3, 0.8)
			hand_visual.scale = Vector3.ONE * 1.5  # Pulsar visual
		elif held_luggage:
			# Amarillo = agarrando
			hand_visual.material_override.albedo_color = Color(1.0, 0.9, 0.2, 0.9)
			hand_visual.scale = Vector3.ONE * 1.2
		else:
			# Normal
			hand_visual.material_override.albedo_color = Color(1.0, 0.8, 0.6, 0.7)
			hand_visual.scale = Vector3.ONE

func _on_grab_area_entered(body: Node3D) -> void:
	if body.has_method("grab") and not held_luggage:
		nearby_luggage = body
		print("[XRHand] 🖐️ Maleta detectada cerca de ", tracker)

func _on_grab_area_exited(body: Node3D) -> void:
	if body == nearby_luggage:
		nearby_luggage = null

func _on_button_pressed(name: String) -> void:
	# HAND TRACKING: "trigger_click" se activa con gesto de pinza
	# También soporta "grip_click" como fallback
	if name == "trigger_click" or name == "grip_click" or name == "select":
		is_pinching = true
		if nearby_luggage and not held_luggage and is_instance_valid(nearby_luggage):
			grab_luggage(nearby_luggage)

func _on_button_released(name: String) -> void:
	# Soltar cuando se abre la mano (pinza se suelta)
	if name == "trigger_click" or name == "grip_click" or name == "select":
		is_pinching = false
		if held_luggage:
			release_luggage()

func grab_luggage(luggage: RigidBody3D) -> void:
	if held_luggage:
		return
	
	held_luggage = luggage
	
	if luggage.has_method("grab"):
		luggage.grab(self)
	
	# Vibración háptica (si está disponible)
	if has_method("trigger_haptic_pulse"):
		trigger_haptic_pulse("haptic", 0.0, 0.5, 0.1, 0.0)
	
	print("[XRHand] ✅ Maleta agarrada con ", tracker)

func release_luggage() -> void:
	if not held_luggage:
		return
	
	var luggage = held_luggage
	held_luggage = null
	
	if luggage.has_method("release"):
		luggage.release()
	
	# Vibración háptica ligera
	if has_method("trigger_haptic_pulse"):
		trigger_haptic_pulse("haptic", 0.0, 0.3, 0.05, 0.0)
	
	print("[XRHand] 📦 Maleta soltada por ", tracker)
