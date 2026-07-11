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
var is_ready_to_collect: bool = false  # Nueva variable para fase de preparación
var preparation_progress: float = 0.0  # Progreso de preparación (0.0 - 1.0)
var _last_progress_milestone: float = 0.0  # Para reproducir sonidos de progreso

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
	
	# ═══ SISTEMA DE PREPARACIÓN TERAPÉUTICA ═══
	# Detectar si el jugador está haciendo movimiento de preparación (acercar/alejar mano)
	if not is_ready_to_collect:
		_check_preparation_movement(delta)

# ─── DETECCIÓN DE COLISIÓN CON MANOS VR ──────────────────────────────────────

var _hand_distances: Dictionary = {}  # Almacenar distancias de manos para detectar movimiento
var _last_hand_check: float = 0.0

func _find_hand_controller(side: String) -> Node3D:
	# Buscar controlador de mano (izquierda o derecha) en el árbol de escena
	# Intenta múltiples nombres posibles
	var possible_names = []
	
	if side == "left":
		possible_names = ["LeftHand", "Left_Hand", "left_hand", "LeftController", "HandLeft"]
	else:  # right
		possible_names = ["RightHand", "Right_Hand", "right_hand", "RightController", "HandRight"]
	
	# Intentar cada nombre posible
	for name in possible_names:
		var hand = get_tree().root.find_child(name, true, false)
		if hand:
			print("[Gem] ✅ Encontrada mano ", side, " con nombre: ", name)
			return hand
	
	# Si no encontró, buscar por tipo XRController3D con tracker específico
	var root = get_tree().root
	for child in _get_all_children(root):
		if child is XRController3D:
			var tracker_name = child.tracker.to_lower()
			if side in tracker_name:
				print("[Gem] ✅ Encontrada mano ", side, " por tracker: ", child.tracker)
				return child
	
	print("[Gem] ⚠️ NO encontrada mano ", side)
	return null

func _get_all_children(node: Node) -> Array:
	# Recursivamente obtener todos los hijos
	var children = []
	for child in node.get_children():
		children.append(child)
		children.append_array(_get_all_children(child))
	return children

func _check_preparation_movement(delta: float) -> void:
	# Sistema de preparación: El jugador debe acercar y alejar la mano (flexión/relajación)
	# para "activar" la gema antes de poder tocarla
	
	_last_hand_check += delta
	if _last_hand_check < 0.1:  # Chequear cada 0.1s
		return
	_last_hand_check = 0.0
	
	# Buscar controladores XR (manos) - MEJORADO
	var left_hand = _find_hand_controller("left")
	var right_hand = _find_hand_controller("right")
	
	var closest_distance = 999.0
	var hand_name = ""
	
	# Calcular distancia a mano izquierda
	if left_hand:
		var dist = global_position.distance_to(left_hand.global_position)
		if dist < closest_distance:
			closest_distance = dist
			hand_name = "left"
			print("[Gem] 🖐️ Mano izquierda detectada a ", dist, "m")
	
	# Calcular distancia a mano derecha
	if right_hand:
		var dist = global_position.distance_to(right_hand.global_position)
		if dist < closest_distance:
			closest_distance = dist
			hand_name = "right"
			print("[Gem] 🖐️ Mano derecha detectada a ", dist, "m")
	
	# Si hay una mano cerca (< 1.5m), detectar movimiento de acercar/alejar
	if closest_distance < 1.5 and hand_name != "":
		if not _hand_distances.has(hand_name):
			_hand_distances[hand_name] = closest_distance
		else:
			var prev_distance = _hand_distances[hand_name]
			var distance_change = prev_distance - closest_distance
			
			# Si se acercó y luego se alejó (flexión + relajación)
			if distance_change > 0.1:  # Se acercó
				preparation_progress += delta * 0.5  # Aumentar progreso
				print("[Gem] 💪 Preparación: ", int(preparation_progress * 100), "% (acercando)")
			elif distance_change < -0.1:  # Se alejó
				preparation_progress += delta * 0.3  # También cuenta (relajación)
				print("[Gem] 💪 Preparación: ", int(preparation_progress * 100), "% (alejando)")
			
			_hand_distances[hand_name] = closest_distance
			
			# ═══ SONIDOS DE PROGRESO CADA 25% ═══
			if preparation_progress >= 0.25 and _last_progress_milestone < 0.25:
				_last_progress_milestone = 0.25
				_play_progress_beep(1)
			elif preparation_progress >= 0.5 and _last_progress_milestone < 0.5:
				_last_progress_milestone = 0.5
				_play_progress_beep(2)
			elif preparation_progress >= 0.75 and _last_progress_milestone < 0.75:
				_last_progress_milestone = 0.75
				_play_progress_beep(3)
			
			# Actualizar visual según progreso
			if _mesh_instance and _mesh_instance.material_override:
				var mat = _mesh_instance.material_override as StandardMaterial3D
				# Color más brillante según progreso
				var base_color = GEM_COLORS.get(gem_type, Color.WHITE)
				var bright_factor = 1.0 + (preparation_progress * 2.0)  # Más brillante
				mat.emission_energy_multiplier = GEM_EMISSION.get(gem_type, 2.0) * bright_factor
			
			# Si completó la preparación (100%)
			if preparation_progress >= 1.0:
				is_ready_to_collect = true
				print("[Gem] ✅ GEMA ACTIVADA - Lista para recoger!")
				_play_activation_sound()
				_show_ready_feedback()  # NUEVO: Mostrar "¡LISTO!"

func _show_ready_feedback() -> void:
	# Mostrar texto flotante "¡LISTO!" cuando la gema está preparada
	var ready_label = Label3D.new()
	add_child(ready_label)
	ready_label.position = Vector3(0, 0.5, 0)
	ready_label.pixel_size = 0.003
	ready_label.text = "¡LISTO!"
	ready_label.font_size = 72
	ready_label.modulate = Color(0.2, 1.0, 0.3)  # Verde brillante
	ready_label.outline_size = 12
	ready_label.outline_modulate = Color.BLACK
	ready_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	
	# Animación: aparece y desaparece
	var tween = create_tween()
	tween.tween_property(ready_label, "position", Vector3(0, 0.8, 0), 0.8).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(ready_label, "modulate:a", 0.0, 0.8).set_delay(0.3)
	tween.tween_callback(ready_label.queue_free)
	
	# Hacer la gema brillar MUCHO
	if _mesh_instance and _mesh_instance.material_override:
		var mat = _mesh_instance.material_override as StandardMaterial3D
		var base_color = GEM_COLORS.get(gem_type, Color.WHITE)
		
		# Flash brillante
		var flash_tween = create_tween()
		flash_tween.tween_property(mat, "emission_energy_multiplier", 8.0, 0.2)
		flash_tween.tween_property(mat, "emission_energy_multiplier", GEM_EMISSION.get(gem_type, 2.0) * 2.0, 0.3)

func _play_progress_beep(level: int) -> void:
	# Beep corto para indicar progreso (25%, 50%, 75%)
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0
	audio.volume_db = 2.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.05
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Beep corto, más agudo según el nivel
		var hz = 400.0 + (level * 150.0)  # 550Hz, 700Hz, 850Hz
		var frames = int(generator.mix_rate * 0.08)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var envelope = 0.3 * (1.0 - t / 0.08)
			var sample = sin(t * hz * TAU) * envelope
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.1).timeout
	if is_instance_valid(audio):
		audio.queue_free()

func _play_activation_sound() -> void:
	# Sonido de "¡RECARGADO!" - épico y satisfactorio
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 20.0
	audio.volume_db = 8.0  # MÁS VOLUMEN
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	print("[Gem] 🔊 Reproduciendo sonido de RECARGA")
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Sonido ascendente épico con armónicos (como "power up")
		var frames = int(generator.mix_rate * 0.4)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var progress = t / 0.4
			var hz = 300.0 + (progress * 600.0)  # De 300Hz a 900Hz (ascendente)
			var envelope = 0.6 * (1.0 - progress * 0.3)  # Mantiene volumen
			
			# Tono principal + armónicos para sonido más rico
			var sample = sin(t * hz * TAU) * envelope * 0.6
			sample += sin(t * hz * 2.0 * TAU) * envelope * 0.2  # Octava
			sample += sin(t * hz * 1.5 * TAU) * envelope * 0.15  # Quinta
			
			# "Ding" final
			if progress > 0.7:
				sample += sin(t * 1200.0 * TAU) * envelope * 0.4
			
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.5).timeout
	if is_instance_valid(audio):
		audio.queue_free()

func _on_body_entered(body: Node) -> void:
	print("[Gem] 💥 BODY DETECTADO: ", body.name, " | Tipo: ", body.get_class())
	if collected:
		print("[Gem] ⚠️ Ya está collected, ignorando")
		return
	
	# Detectar XRController3D (los controladores padre de las manos)
	if body is XRController3D:
		print("[Gem] ✅ CONTROLADOR XR detectado: ", body.name)
		_catch()
		return
	
	# Detectar por nombre de nodo (LeftHand, RightHand, etc.)
	var body_name = body.name.to_lower()
	if "hand" in body_name or "left" in body_name or "right" in body_name:
		print("[Gem] ✅ MANO detectada por nombre: ", body.name)
		_catch()
		return
	
	# También detectar nodos que sean hijos de controladores
	var parent = body.get_parent()
	if parent and parent is XRController3D:
		print("[Gem] ✅ HIJO de controlador XR detectado: ", body.name, " (padre: ", parent.name, ")")
		_catch()
		return

func _on_area_entered(area: Node) -> void:
	print("[Gem] 🎯 ÁREA DETECTADA: ", area.name, " | Padre: ", area.get_parent().name if area.get_parent() else "none")
	if collected:
		print("[Gem] ⚠️ Ya está collected, ignorando")
		return
	
	# Detectar áreas de las manos por nombre (cualquier variación)
	var area_name = area.name.to_lower()
	if "hand" in area_name or "left" in area_name or "right" in area_name:
		print("[Gem] ✅ MANO DETECTADA por nombre: ", area.name)
		_catch()
		return
	
	# También detectar por grupo si está configurado
	if area.is_in_group("hand") or area.is_in_group("xr_hand"):
		print("[Gem] ✅ MANO DETECTADA por grupo")
		_catch()
		return
	
	# Detectar si el padre es un controlador XR
	var parent = area.get_parent()
	if parent:
		var parent_name = parent.name.to_lower()
		if parent is XRController3D or "hand" in parent_name or "controller" in parent_name:
			print("[Gem] ✅ MANO DETECTADA por padre XR: ", parent.name)
			_catch()
			return
	
	print("[Gem] ⚠️ Área NO reconocida como mano: ", area.name)

func _catch() -> void:
	if collected:
		return
	
	# ═══ VERIFICAR SI LA GEMA ESTÁ LISTA ═══
	if not is_ready_to_collect:
		print("[Gem] ⚠️ Gema NO activada - Necesitas hacer movimiento de preparación (", int(preparation_progress * 100), "%)")
		# Sonido de "bloqueado"
		_play_blocked_sound()
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

func _play_blocked_sound() -> void:
	# Sonido de "bloqueado" cuando intentas agarrar sin preparación
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 15.0
	audio.volume_db = 2.0
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Sonido descendente (bloqueado)
		var frames = int(generator.mix_rate * 0.15)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var hz = 300.0 - (t * 100.0)  # De 300Hz a 200Hz (descendente)
			var envelope = 0.2
			var sample = sin(t * hz * TAU) * envelope
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.2).timeout
	if is_instance_valid(audio):
		audio.queue_free()

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
	
	# Solo cuenta como "perdida" si llegó al rango y NO la preparaste/tocaste
	# NO cuenta si simplemente pasó de largo sin llegar al rango
	print("[Gem] ⏭ Perdida: ", gem_type, " - Progreso de preparación: ", int(preparation_progress * 100), "%")
	
	# SONIDO DE ERROR cuando se pierde una gema
	_play_miss_sound()
	
	emit_signal("gem_missed")
	
	# Esperar a que termine el sonido antes de eliminar
	await get_tree().create_timer(0.5).timeout
	queue_free()

func _play_miss_sound() -> void:
	# Sonido de error/desaprobación (buzzer) - IGUAL QUE CITYWORLD
	var audio = AudioStreamPlayer3D.new()
	add_child(audio)
	audio.max_distance = 20.0
	audio.unit_size = 3.0
	audio.volume_db = 8.0  # MÁS VOLUMEN
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	audio.stream = generator
	audio.play()
	
	print("[Gem] 🔊 Reproduciendo sonido de ERROR")
	
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Buzzer desagradable (200Hz bajo) - IGUAL QUE CITYWORLD
		var frames = int(generator.mix_rate * 0.4)
		for i in range(frames):
			var t = float(i) / generator.mix_rate
			var envelope = 0.6 * (1.0 - t / 0.4)
			var sample = sin(t * 200.0 * TAU) * envelope  # Tono bajo y desagradable
			playback.push_frame(Vector2(sample, sample))
	
	await get_tree().create_timer(0.5).timeout
	if is_instance_valid(audio):
		audio.queue_free()

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
	audio.max_distance = 20.0
	audio.unit_size = 3.0
	audio.volume_db = 8.0  # MÁS VOLUMEN
	
	# Generar tono procedural (sin archivos de audio)
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = 0.1
	
	audio.stream = generator
	audio.play()
	
	print("[Gem] 🔊 Reproduciendo sonido: ", "positivo" if positive else "negativo")
	
	# Generar onda de sonido MEJORADA - SIMILAR A CITYWORLD
	await get_tree().process_frame
	var playback = audio.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		if positive:
			# SONIDO POSITIVO - Épico según tipo de gema
			var base_hz = 600.0
			if gem_type == "golden":  # Dorado - sonido épico
				base_hz = 900.0
			elif gem_type == "purple":  # Morado - sonido medio
				base_hz = 750.0
			else:  # Normal/Verde - sonido suave
				base_hz = 600.0
			
			# Generar sonido con armónicos (más rico) - IGUAL QUE CITYWORLD
			var frames = int(generator.mix_rate * 0.35)
			for i in range(frames):
				var t = float(i) / generator.mix_rate
				var envelope = 0.6 * (1.0 - t / 0.35)
				
				# Tono principal + armónicos
				var sample = sin(t * base_hz * TAU) * envelope * 0.6
				sample += sin(t * base_hz * 2.0 * TAU) * envelope * 0.2  # Octava
				sample += sin(t * base_hz * 1.5 * TAU) * envelope * 0.15  # Quinta
				
				# "Ding" al final para gemas doradas
				if gem_type == "golden":
					sample += sin(t * 1200.0 * TAU) * envelope * 0.3
				
				playback.push_frame(Vector2(sample, sample))
		else:
			# SONIDO NEGATIVO (roja) - Buzzer igual que error
			var frames = int(generator.mix_rate * 0.3)
			for i in range(frames):
				var t = float(i) / generator.mix_rate
				var amplitude = 0.5 * (1.0 - t / 0.3)
				var sample = sin(t * 250.0 * TAU) * amplitude  # Tono bajo
				playback.push_frame(Vector2(sample, sample))
	
	# Limpiar después de reproducir
	await get_tree().create_timer(0.4).timeout
	if is_instance_valid(audio):
		audio.queue_free()
