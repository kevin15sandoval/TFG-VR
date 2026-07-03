extends XRController3D
# ─────────────────────────────────────────────────────────────────────────────
# XRHandController — Controlador de mano VR para agarrar objetos
# Detecta maletas cercanas y las agarra cuando se aprieta el gatillo
# ─────────────────────────────────────────────────────────────────────────────

@export var grip_button: String = "grip_click"  # Botón de agarre (grip)
@export var hand_name: String = "LeftHand"  # "LeftHand" o "RightHand"

var held_object: RigidBody3D = null  # Objeto que estamos sosteniendo
var is_gripping: bool = false

func _ready() -> void:
	# Añadir a grupo para que las maletas nos detecten
	add_to_group("xr_controller")
	print("[XRHand] Controlador ", hand_name, " inicializado")
	
	# Conectar señales de botones
	button_pressed.connect(_on_button_pressed)
	button_released.connect(_on_button_released)

func _process(_delta: float) -> void:
	# Si estamos sosteniendo algo, moverlo con nuestra mano
	if held_object and is_instance_valid(held_object):
		# La maleta sigue la posición del controlador
		held_object.global_position = global_position
		held_object.global_rotation = global_rotation

func _on_button_pressed(button_name: String) -> void:
	if button_name == grip_button:
		is_gripping = true
		_try_grab()
		print("[XRHand] ", hand_name, " apretó el gatillo")

func _on_button_released(button_name: String) -> void:
	if button_name == grip_button:
		is_gripping = false
		_release()
		print("[XRHand] ", hand_name, " soltó el gatillo")

func _try_grab() -> void:
	# Buscar maleta cercana (las maletas ponen metadata cuando estamos cerca)
	var nearby_luggage = get_meta("nearby_luggage", null)
	
	if nearby_luggage and is_instance_valid(nearby_luggage):
		# Agarrar la maleta
		held_object = nearby_luggage
		held_object.grab(self)
		print("[XRHand] ", hand_name, " agarró maleta ", held_object.luggage_id)
	else:
		print("[XRHand] ", hand_name, " no hay maleta cerca para agarrar")

func _release() -> void:
	if held_object and is_instance_valid(held_object):
		print("[XRHand] ", hand_name, " soltó maleta ", held_object.luggage_id)
		held_object.release()
		held_object = null

func trigger_haptic_pulse(action: String, delay: float, strength: float, duration: float, frequency: float) -> void:
	# Enviar vibración háptica al controlador
	# Esto es específico de OpenXR
	if has_method("trigger_haptic_feedback"):
		call("trigger_haptic_feedback", action, delay, strength, duration, frequency)
