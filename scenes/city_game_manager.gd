extends Node
# ─────────────────────────────────────────────────────────────────────────────
# CityGameManager — Gestor del juego Urban Attention Quest
# Enfoque: Negligencia espacial, orientación urbana, rotación 360°
# ─────────────────────────────────────────────────────────────────────────────

signal game_started
signal game_finished(results: Dictionary)
signal target_collected(target_id: int, points: int)
signal sequence_error(expected: int, touched: int)
signal timer_updated(remaining: float)

var game_active: bool = false
var recognition_phase: bool = true
var recognition_time: float = 15.0  # 15 segundos de reconocimiento
var recognition_timer: float = 0.0
var score: int = 0
var targets_collected: int = 0
var total_targets: int = 0
var current_sequence_number: int = 1
var sequence_errors: int = 0
var start_time: float = 0.0
var game_duration: float = 180.0
var difficulty: String = "Media"

# Métricas terapéuticas específicas para ictus
var left_side_targets: int = 0
var right_side_targets: int = 0
var front_targets: int = 0
var back_targets: int = 0
var high_targets: int = 0
var low_targets: int = 0

var left_side_reaction_times: Array[float] = []
var right_side_reaction_times: Array[float] = []
var target_times: Array[float] = []
var rotation_180_count: int = 0
var last_target_angle: float = 0.0

var player_position: Vector3 = Vector3.ZERO

# Métricas biomecánicas profesionales
var head_rotation_angles: Array[float] = []  # Ángulos de rotación de cabeza
var max_head_rotation_left: float = 0.0
var max_head_rotation_right: float = 0.0
var max_head_elevation: float = 0.0  # Mirar arriba
var max_head_depression: float = 0.0  # Mirar abajo
var total_head_displacement: float = 0.0  # Desplazamiento total de cabeza
var avg_gaze_stability: float = 0.0  # Estabilidad de mirada
var visual_search_times: Array[float] = []  # Tiempos de búsqueda visual
var interrupted_gazes: int = 0  # Veces que perdió fijación

# Referencias
var _targets: Array = []
var _timer: Timer

func _ready() -> void:
	print("[CityManager] 🏙️ City Game Manager inicializado")
	
	_timer = Timer.new()
	add_child(_timer)
	_timer.timeout.connect(_on_timer_tick)
	_timer.wait_time = 1.0
	
	if GameManager:
		GameManager.session_started.connect(_on_session_started)
		GameManager.session_finished.connect(_on_game_finished)

func _on_session_started() -> void:
	print("[CityManager] 🚀 Iniciando Urban Attention Quest")
	start_game()

func start_game() -> void:
	if game_active:
		return
	
	game_active = true
	recognition_phase = true
	recognition_timer = 0.0
	score = 0
	targets_collected = 0
	current_sequence_number = 1
	sequence_errors = 0
	
	left_side_targets = 0
	right_side_targets = 0
	front_targets = 0
	back_targets = 0
	high_targets = 0
	low_targets = 0
	
	left_side_reaction_times.clear()
	right_side_reaction_times.clear()
	target_times.clear()
	rotation_180_count = 0
	last_target_angle = 0.0
	
	# Limpiar métricas biomecánicas
	head_rotation_angles.clear()
	max_head_rotation_left = 0.0
	max_head_rotation_right = 0.0
	max_head_elevation = 0.0
	max_head_depression = 0.0
	total_head_displacement = 0.0
	visual_search_times.clear()
	interrupted_gazes = 0
	
	if GameManager:
		difficulty = GameManager.difficulty
		game_duration = GameManager.session_duration
	
	start_time = Time.get_ticks_msec() / 1000.0
	_timer.start()
	
	game_started.emit()
	print("[CityManager] ⏱️ Fase de reconocimiento iniciada (15 segundos)")
	print("[CityManager] 🎮 Dificultad: ", difficulty, " | Duración total: ", game_duration, "s")

func _on_timer_tick() -> void:
	if not game_active:
		return
	
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	
	# Fase de reconocimiento
	if recognition_phase:
		recognition_timer = elapsed
		var remaining_recognition = max(0.0, recognition_time - elapsed)
		timer_updated.emit(remaining_recognition)
		
		if remaining_recognition <= 0:
			recognition_phase = false
			start_time = Time.get_ticks_msec() / 1000.0  # Reset timer para fase de juego
			print("[CityManager] ✅ Fase de reconocimiento completada. ¡Ahora comienza el ejercicio!")
		return
	
	# Fase de juego normal
	var remaining = max(0.0, game_duration - elapsed)
	timer_updated.emit(remaining)
	
	if remaining <= 0:
		end_game()

func collect_target(target_id: int, points: int, target_position: Vector3, sequence_number: int) -> void:
	if not game_active or recognition_phase:
		return  # No se pueden recoger durante reconocimiento
	
	var current_time = Time.get_ticks_msec() / 1000.0
	var reaction_time = current_time - start_time
	
	# Verificar secuencia
	if sequence_number > 0:  # Solo si tiene secuencia
		if sequence_number != current_sequence_number:
			# Error de secuencia
			sequence_errors += 1
			score = max(0, score - 5)
			sequence_error.emit(current_sequence_number, sequence_number)
			print("[CityManager] ❌ Error de secuencia! Esperado: ", current_sequence_number, ", Tocado: ", sequence_number)
			return
		else:
			current_sequence_number += 1
	
	targets_collected += 1
	score += points
	target_times.append(reaction_time)
	
	# Analizar posición espacial del target
	_analyze_target_position(target_position, reaction_time)
	
	target_collected.emit(target_id, points)
	print("[CityManager] ✅ Target ", target_id, " recogido | Score: ", score)
	
	# Verificar victoria
	if targets_collected >= total_targets:
		print("[CityManager] 🎉 ¡Todos los targets recogidos!")
		await get_tree().create_timer(1.0).timeout
		end_game()

func _analyze_target_position(pos: Vector3, reaction_time: float) -> void:
	# Analizar lado (izquierda/derecha)
	if pos.x < player_position.x:
		left_side_targets += 1
		left_side_reaction_times.append(reaction_time)
	else:
		right_side_targets += 1
		right_side_reaction_times.append(reaction_time)
	
	# Analizar altura
	if pos.y > player_position.y + 0.5:
		high_targets += 1
	elif pos.y < player_position.y - 0.5:
		low_targets += 1
	
	# Analizar profundidad (adelante/atrás)
	var to_target = pos - player_position
	var angle_to_target = atan2(to_target.x, to_target.z)
	
	if abs(angle_to_target) > PI / 2:
		back_targets += 1
		
		# Detectar rotación 180°
		if abs(angle_to_target - last_target_angle) > PI * 0.8:
			rotation_180_count += 1
	else:
		front_targets += 1
	
	last_target_angle = angle_to_target

func end_game() -> void:
	if not game_active:
		return
	
	game_active = false
	_timer.stop()
	
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	
	# Calcular métricas
	var avg_reaction_time = _calculate_average(target_times)
	var left_avg = _calculate_average(left_side_reaction_times)
	var right_avg = _calculate_average(right_side_reaction_times)
	
	# Calcular asimetría (negligencia espacial)
	var asymmetry = 0.0
	var neglect_score = 100.0
	if left_side_targets > 0 and right_side_targets > 0:
		var total_sides = left_side_targets + right_side_targets
		asymmetry = abs(float(left_side_targets - right_side_targets)) / float(total_sides) * 100.0
		neglect_score = max(0.0, 100.0 - asymmetry)
	
	# Scores clínicos
	var spatial_awareness_score = _calculate_spatial_score()
	var orientation_score = _calculate_orientation_score()
	var processing_speed_score = _calculate_processing_score(avg_reaction_time)
	
	var completion = 100.0 * float(targets_collected) / float(max(1, total_targets))
	
	# Calcular métricas biomecánicas profesionales
	var cervical_rom_left = abs(max_head_rotation_left)  # Rango de movimiento cervical
	var cervical_rom_right = abs(max_head_rotation_right)
	var cervical_rom_extension = abs(max_head_elevation)  # Extensión (mirar arriba)
	var cervical_rom_flexion = abs(max_head_depression)  # Flexión (mirar abajo)
	var total_cervical_rom = cervical_rom_left + cervical_rom_right + cervical_rom_extension + cervical_rom_flexion
	
	var avg_visual_search_time = _calculate_average(visual_search_times)
	var gaze_interruption_rate = float(interrupted_gazes) / float(max(1, targets_collected + interrupted_gazes)) * 100.0
	
	var results = {
		"game_type": "urban_attention_quest",
		"score": score,
		"targets_collected": targets_collected,
		"total_targets": total_targets,
		"sequence_errors": sequence_errors,
		"completion_percentage": completion,
		"time_elapsed": elapsed,
		"difficulty": difficulty,
		
		# === MÉTRICAS CLÍNICAS DE NEGLIGENCIA ===
		"left_side_targets": left_side_targets,
		"right_side_targets": right_side_targets,
		"asymmetry_percentage": asymmetry,
		"neglect_score": neglect_score,
		"left_avg_reaction": left_avg,
		"right_avg_reaction": right_avg,
		
		# === MÉTRICAS BIOMECÁNICAS PROFESIONALES ===
		"cervical_rom_degrees": {
			"rotation_left": cervical_rom_left,
			"rotation_right": cervical_rom_right,
			"extension_up": cervical_rom_extension,
			"flexion_down": cervical_rom_flexion,
			"total_rom": total_cervical_rom
		},
		"head_displacement_meters": total_head_displacement,
		
		# === MÉTRICAS DE BÚSQUEDA VISUAL ===
		"visual_search_metrics": {
			"avg_search_time_seconds": avg_visual_search_time,
			"gaze_interruption_rate_percent": gaze_interruption_rate,
			"interrupted_gazes_count": interrupted_gazes,
			"gaze_stability_score": max(0, 100 - gaze_interruption_rate)
		},
		
		# === MÉTRICAS ESPACIALES ===
		"spatial_distribution": {
			"front_targets": front_targets,
			"back_targets": back_targets,
			"high_targets": high_targets,
			"low_targets": low_targets,
			"rotation_180_count": rotation_180_count
		},
		
		# === MÉTRICAS TEMPORALES ===
		"avg_reaction_time": avg_reaction_time,
		"target_times": target_times,
		
		# === SCORES CLÍNICOS FUNCIONALES (0-100) ===
		"clinical_scores": {
			"spatial_awareness": spatial_awareness_score,
			"orientation": orientation_score,
			"processing_speed": processing_speed_score,
			"neglect_clinical": neglect_score,
			"cervical_mobility": _calculate_cervical_mobility_score(total_cervical_rom),
			"visual_search_efficiency": _calculate_visual_search_score(avg_visual_search_time),
			"gaze_stability": max(0, 100 - gaze_interruption_rate)
		},
		
		# === RECOMENDACIONES CLÍNICAS ===
		"clinical_recommendations": _generate_clinical_recommendations(
			asymmetry, 
			neglect_score, 
			total_cervical_rom, 
			gaze_interruption_rate,
			rotation_180_count
		)
	}
	
	game_finished.emit(results)
	print("[CityManager] 🏁 Juego terminado")
	print("  Score: ", score)
	print("  Targets: ", targets_collected, "/", total_targets)
	print("  Asimetría: ", "%.1f" % asymmetry, "%")
	print("  Negligencia score: ", "%.1f" % neglect_score)
	print("  Rotaciones 180°: ", rotation_180_count)
	
	if GameManager and GameManager.session_active:
		GameManager.session_active = false
		GameManager.session_finished.emit(results)

func _calculate_average(arr: Array) -> float:
	if arr.size() == 0:
		return 0.0
	var sum = 0.0
	for val in arr:
		sum += val
	return sum / arr.size()

func _calculate_spatial_score() -> int:
	# Score basado en exploración completa del espacio
	var score_val = 0
	if left_side_targets > 0: score_val += 20
	if right_side_targets > 0: score_val += 20
	if front_targets > 0: score_val += 15
	if back_targets > 0: score_val += 25  # Más difícil
	if high_targets > 0: score_val += 10
	if low_targets > 0: score_val += 10
	return score_val

func _calculate_orientation_score() -> int:
	# Score basado en rotaciones y navegación
	var base = 60
	base += rotation_180_count * 10
	base += back_targets * 5
	return min(100, base)

func _calculate_processing_score(avg_time: float) -> int:
	# Menor tiempo = mejor score
	if avg_time < 2.0:
		return 100
	elif avg_time < 3.0:
		return 80
	elif avg_time < 4.0:
		return 60
	elif avg_time < 5.0:
		return 40
	else:
		return 20

func register_target(target: Node) -> void:
	_targets.append(target)
	total_targets += 1
	target.target_activated.connect(func(id, pts, pos, seq): 
		collect_target(id, pts, pos, seq)
	)

func update_player_position(pos: Vector3) -> void:
	player_position = pos

func update_head_rotation(camera_transform: Transform3D) -> void:
	# Registrar ángulos de rotación de cabeza para métricas biomecánicas
	var euler = camera_transform.basis.get_euler()
	
	# Rotación horizontal (yaw) - izquierda/derecha
	var yaw_deg = rad_to_deg(euler.y)
	if yaw_deg < 0:  # Rotación izquierda
		max_head_rotation_left = max(max_head_rotation_left, abs(yaw_deg))
	else:  # Rotación derecha
		max_head_rotation_right = max(max_head_rotation_right, yaw_deg)
	
	# Rotación vertical (pitch) - arriba/abajo
	var pitch_deg = rad_to_deg(euler.x)
	if pitch_deg > 0:  # Mirar abajo (flexión)
		max_head_depression = max(max_head_depression, pitch_deg)
	else:  # Mirar arriba (extensión)
		max_head_elevation = max(max_head_elevation, abs(pitch_deg))
	
	head_rotation_angles.append(yaw_deg)

func register_gaze_interruption() -> void:
	interrupted_gazes += 1

func register_visual_search_time(search_time: float) -> void:
	visual_search_times.append(search_time)

func _on_game_finished(_results: Dictionary) -> void:
	pass

func get_remaining_time() -> float:
	if not game_active:
		return 0.0
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	return max(0.0, game_duration - elapsed)

func get_next_sequence_number() -> int:
	return current_sequence_number

func _calculate_cervical_mobility_score(total_rom: float) -> int:
	# Score basado en rango de movimiento cervical total
	# Normal: 270° (90° rot izq + 90° rot der + 50° ext + 40° flex)
	# Mínimo funcional: 135° (50% de normal)
	if total_rom >= 270.0:
		return 100
	elif total_rom >= 200.0:
		return 80
	elif total_rom >= 135.0:
		return 60
	elif total_rom >= 90.0:
		return 40
	else:
		return 20

func _calculate_visual_search_score(avg_time: float) -> int:
	# Menor tiempo = mejor eficiencia
	if avg_time < 2.0:
		return 100
	elif avg_time < 3.0:
		return 85
	elif avg_time < 4.0:
		return 70
	elif avg_time < 5.0:
		return 55
	elif avg_time < 7.0:
		return 40
	else:
		return 25

func _generate_clinical_recommendations(
	asymmetry: float,
	neglect: float,
	cervical_rom: float,
	gaze_interruption: float,
	rotations_180: int
) -> Array[String]:
	var recommendations: Array[String] = []
	
	# Negligencia espacial
	if asymmetry > 30:
		recommendations.append("NEGLIGENCIA SEVERA: Incrementar targets en lado afectado. Considerar audio guía bilateral.")
	elif asymmetry > 20:
		recommendations.append("Negligencia moderada: Aumentar frecuencia de sesiones (4-5x/semana).")
	
	# Movilidad cervical
	if cervical_rom < 135:
		recommendations.append("ROM CERVICAL LIMITADO: Combinar con ejercicios de movilización cervical pasiva/activa.")
	elif cervical_rom < 200:
		recommendations.append("ROM cervical reducido: Progresión a ejercicios de estiramiento cervical.")
	
	# Estabilidad de mirada
	if gaze_interruption > 40:
		recommendations.append("INESTABILIDAD DE MIRADA: Trabajar fijación visual con targets estáticos primero.")
	elif gaze_interruption > 25:
		recommendations.append("Mejorar estabilidad de mirada con ejercicios de seguimiento visual.")
	
	# Rotación 180°
	if rotations_180 < 2:
		recommendations.append("EVITA ROTACIÓN: Comenzar con targets solo laterales (90°). Progresión gradual.")
	
	# Velocidad de procesamiento
	if neglect < 70 and asymmetry > 25:
		recommendations.append("PRIORIDAD: Tratamiento intensivo de negligencia (terapia convencional + VR 5x/semana).")
	
	if recommendations.is_empty():
		recommendations.append("Rendimiento dentro de parámetros funcionales. Continuar progresión a mayor dificultad.")
	
	return recommendations
