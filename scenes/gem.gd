extends Area3D
# ─────────────────────────────────────────────────────────────────────────────
# Gem — Gema individual de ejercicio terapéutico
# Detecta colisión con las manos VR del paciente
# ─────────────────────────────────────────────────────────────────────────────

signal gem_caught()
signal gem_missed()

var gem_type:      String = "normal"
var points:        int    = 10
var exercise_name: String = ""
var instruction:   String = ""
var exercise_data: Dictionary = {}
var collected:     bool   = false

# Colores por tipo de gema (emisión brillante para VR)
const GEM_COLORS := {
	"normal": Color(0.2,  0.6,  1.0,  1.0),   # Azul
	"golden": Color(1.0,  0.85, 0.0,  1.0),   # Dorado
	"green":  Color(0.0,  0.9,  0.3,  1.0),   # Verde
	"purple": Color(0.7,  0.0,  1.0,  1.0),   # Morado
	"red":    Color(1.0,  0.1,  0.1,  1.0),   # Rojo (obstáculo)
}

const GEM_EMISSION := {
	"normal": 2.0,
	"golden": 4.0,
	"green":  2.5,
	"purple": 3.0,
	"red":    3.5,
}

const GEM_SCALE := {
	"normal": Vector3(0.5, 0.5, 0.5),
	"golden": Vector3(0.65, 0.65, 0.65),
	"green":  Vector3(0.5, 0.5, 0.5),
	"purple": Vector3(0.55, 0.55, 0.55),
	"red":    Vector3(0.6, 0.6, 0.6),
}

var _mesh_instance: MeshInstance3D
var _anim_time: float = 0.0
var _base_y: float = 0.0

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	_mesh_instance = $MeshInstance3D
	_base_y = global_position.y
	_apply_visuals()

func setup(exercise: Dictionary) -> void:
	exercise_data  = exercise
	gem_type       = exercise.get("type",        "normal")
	points         = exercise.get("points",      10)
	exercise_name  = exercise.get("name",        "")
	instruction    = exercise.get("instruction", "")
	global_position = exercise.get("start",      Vector3.ZERO)
	_apply_visuals()

func _apply_visuals() -> void:
	if _mesh_instance == null:
		return

	var mat = StandardMaterial3D.new()
	var color = GEM_COLORS.get(gem_type, GEM_COLORS["normal"])
	mat.albedo_color           = color
	mat.emission_enabled       = true
	mat.emission               = color
	mat.emission_energy_multiplier = GEM_EMISSION.get(gem_type, 2.0)
	mat.roughness              = 0.1
	mat.metallic               = 0.3
	_mesh_instance.surface_material_override[0] = mat

	var scale = GEM_SCALE.get(gem_type, Vector3(0.5, 0.5, 0.5))
	_mesh_instance.scale = scale

func _process(delta: float) -> void:
	if collected:
		return
	# Animación de flotación suave
	_anim_time += delta * 2.0
	_mesh_instance.position.y = sin(_anim_time) * 0.04
	# Rotación constante
	_mesh_instance.rotate_y(delta * 1.5)

# ─── DETECCIÓN DE COLISIÓN CON MANOS VR ──────────────────────────────────────

func _on_body_entered(body: Node) -> void:
	if collected:
		return
	# Las manos VR en Godot OpenXR son XRController3D o tienen grupo "hand"
	if body is XRController3D or body.is_in_group("hand") or body.is_in_group("xr_hand"):
		_catch()

func _on_area_entered(area: Node) -> void:
	if collected:
		return
	if area.is_in_group("hand") or area.is_in_group("xr_hand"):
		_catch()

func _catch() -> void:
	if collected:
		return
	collected = true
	print("[Gem] ✅ Recogida: ", gem_type, " +", points, " pts")
	_play_collect_effect()
	emit_signal("gem_caught")
	await get_tree().create_timer(0.3).timeout
	queue_free()

func miss() -> void:
	if collected:
		return
	collected = true
	print("[Gem] ⏭ Perdida: ", gem_type)
	emit_signal("gem_missed")
	queue_free()

func _play_collect_effect() -> void:
	# Efecto de escala rápida antes de desaparecer
	var tween = create_tween()
	tween.tween_property(_mesh_instance, "scale",
		_mesh_instance.scale * 1.8, 0.15).set_ease(Tween.EASE_OUT)
	tween.tween_property(_mesh_instance, "scale",
		Vector3.ZERO, 0.15).set_ease(Tween.EASE_IN)
