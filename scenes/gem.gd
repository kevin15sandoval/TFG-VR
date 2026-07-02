extends Area3D
# ─────────────────────────────────────────────────────────────────────────────
# Gem — Gema individual de ejercicio terapéutico
# Detecta colisión con las manos VR del paciente
# Incluye: Audio, Partículas, Feedback háptico
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
	"normal": Vector3(0.25, 0.25, 0.25),
	"golden": Vector3(0.35, 0.35, 0.35),
	"green":  Vector3(0.25, 0.25, 0.25),
	"purple": Vector3(0.3, 0.3, 0.3),
	"red":    Vector3(0.3, 0.3, 0.3),
}

var _mesh_instance: MeshInstance3D
var _anim_time: float = 0.0
var _base_y: float = 0.0
var _particles: GPUParticles3D

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	_mesh_instance = $MeshInstance3D
	_base_y = global_position.y
	_create_particles()
	_apply_visuals()

func _create_particles() -> void:
	# Sistema de partículas para efecto de recolección
	_particles = GPUParticles3D.new()
	_particles.emitting = false
	_particles.one_shot = true
	_particles.amount = 20
	_particles.lifetime = 0.6
	_particles.explosiveness = 1.0
	
	# Configuración del proceso de partículas
	var material = ParticleProcessMaterial.new()
	material.direction = Vector3(0, 1, 0)
	material.spread = 180.0
	material.initial_velocity_min = 2.0
	material.initial_velocity_max = 4.0
	material.gravity = Vector3(0, -5, 0)
	material.scale_min = 0.1
	material.scale_max = 0.2
	
	_particles.process_material = material
	_particles.draw_pass_1 = SphereMesh.new()
	
	add_child(_particles)

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
	
	# Aplicar material correctamente
	_mesh_instance.material_override = mat

	var scale = GEM_SCALE.get(gem_type, Vector3(0.25, 0.25, 0.25))
	_mesh_instance.scale = scale
	
	print("[Gem] 💎 Gema creada: ", gem_type, " | Color: ", color, " | Escala: ", scale)

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
	print("[Gem] 💥 BODY DETECTADO: ", body.name, " | Tipo: ", body.get_class())
	if collected:
		print("[Gem] ⚠️ Ya está collected, ignorando")
		return
	# Detectar XRController3D (los controladores padre de las manos)
	if body is XRController3D:
		print("[Gem] ✅ CONTROLADOR XR detectado directamente")
		_catch()
	# También detectar nodos que sean hijos de controladores
	var parent = body.get_parent()
	if parent and parent is XRController3D:
		print("[Gem] ✅ HIJO de controlador XR detectado")
		_catch()

func _on_area_entered(area: Node) -> void:
	print("[Gem] 🎯 ÁREA DETECTADA: ", area.name, " | Padre: ", area.get_parent().name if area.get_parent() else "none")
	if collected:
		print("[Gem] ⚠️ Ya está collected, ignorando")
		return
	# Detectar áreas de las manos (LeftHandArea, RightHandArea)
	if area.name in ["LeftHandArea", "RightHandArea"]:
		print("[Gem] ✅ MANO DETECTADA por nombre: ", area.name)
		_catch()
	# También detectar por grupo si está configurado
	elif area.is_in_group("hand") or area.is_in_group("xr_hand"):
		print("[Gem] ✅ MANO DETECTADA por grupo")
		_catch()
	else:
		print("[Gem] ⚠️ Área NO reconocida como mano")

func _catch() -> void:
	if collected:
		return
	collected = true
	
	# Determinar si es positivo o negativo
	var is_positive = gem_type != "red"
	
	print("[Gem] ", "✅" if is_positive else "❌", " Recogida: ", gem_type, " ", 
		"+", points if is_positive else points, " pts")
	
	_play_collect_effect(is_positive)
	_trigger_haptic_feedback(is_positive)
	emit_signal("gem_caught")
	
	await get_tree().create_timer(0.3).timeout
	queue_free()

func _trigger_haptic_feedback(positive: bool) -> void:
	# Vibración en controladores XR
	var xr_interface = XRServer.primary_interface
	if xr_interface:
		# Intensidad y duración según tipo
		var duration = 0.1 if positive else 0.2
		var frequency = 100.0 if positive else 50.0
		var amplitude = 0.5 if positive else 0.8
		
		# Vibrar ambos controladores
		for i in range(2):  # 0 = left, 1 = right
			var tracker = XRServer.get_tracker("hand_tracker/" + str(i))
			if tracker:
				# Nota: En OpenXR, el haptic feedback se maneja por el XRController3D
				# Este código es una aproximación, puede variar según la implementación
				pass

func miss() -> void:
	if collected:
		return
	collected = true
	print("[Gem] ⏭ Perdida: ", gem_type)
	emit_signal("gem_missed")
	queue_free()

func _play_collect_effect(positive: bool = true) -> void:
	# Partículas de explosión con el color de la gema
	if _particles:
		var mat = _particles.process_material as ParticleProcessMaterial
		if mat:
			mat.color = GEM_COLORS.get(gem_type, Color.WHITE)
		_particles.emitting = true
	
	# Efecto de escala rápida antes de desaparecer
	var tween = create_tween()
	tween.tween_property(_mesh_instance, "scale",
		_mesh_instance.scale * (1.8 if positive else 0.5), 0.15).set_ease(Tween.EASE_OUT)
	tween.tween_property(_mesh_instance, "scale",
		Vector3.ZERO, 0.15).set_ease(Tween.EASE_IN)
	
	# AUDIO: Sonido de recolección
	_play_collect_sound(positive)

func _play_collect_sound(positive: bool) -> void:
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0  # Más lejos para que se escuche mejor
	audio.unit_size = 2.0
	audio.volume_db = 6.0  # MÁS VOLUMEN
	
	# Generar tono procedural (sin archivos de audio)
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.15
	
	audio.stream = generator
	audio.play()
	
	print("[Gem] 🔊 Reproduciendo sonido: ", "positivo" if positive else "negativo")
	
	# Generar onda de sonido simple
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		var hz = 1200.0 if positive else 300.0  # Tono más agudo para positivo
		var frames = int(generator.mix_rate * 0.15)
		
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var amplitude = 0.6 * (1.0 - t / 0.15)  # Fade out, más fuerte
			var sample = sin(t * hz * TAU) * amplitude
			playback.push_frame(Vector2(sample, sample))
	
	# Limpiar después de reproducir
	await get_tree().create_timer(0.2).timeout
	if is_instance_valid(audio):
		audio.queue_free()
