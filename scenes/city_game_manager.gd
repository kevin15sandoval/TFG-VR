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
	
	if GameManager:
		difficulty = GameManager.difficulty
		game_duration = GameManager.session_duration
	
	start_time = Time.get_ticks_msec() / 1000.0
	_timer.start()
	
	game_started.emit()
	print("[CityManager] ⏱️ Juego iniciado | Dificultad: ", difficulty, " | Duración: ", game_duration, "s")

func _on_timer_tick() -> void:
	if not game_active:
		return
	
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	var remaining = max(0.0, game_duration - elapsed)
	
	timer_updated.emit(remaining)
	
	if remaining <= 0:
		end_game()

func collect_target(target_id: int, points: int, target_position: Vector3, sequence_number: int) -> void:
	if not game_active:
		return
	
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
	
	var results = {
		"game_type": "urban_attention_quest",
		"score": score,
		"targets_collected": targets_collected,
		"total_targets": total_targets,
		"sequence_errors": sequence_errors,
		"completion_percentage": completion,
		"time_elapsed": elapsed,
		"difficulty": difficulty,
		
		# Métricas de negligencia espacial
		"left_side_targets": left_side_targets,
		"right_side_targets": right_side_targets,
		"asymmetry_percentage": asymmetry,
		"neglect_score": neglect_score,
		"left_avg_reaction": left_avg,
		"right_avg_reaction": right_avg,
		
		# Métricas espaciales
		"front_targets": front_targets,
		"back_targets": back_targets,
		"high_targets": high_targets,
		"low_targets": low_targets,
		"rotation_180_count": rotation_180_count,
		
		# Métricas generales
		"avg_reaction_time": avg_reaction_time,
		"target_times": target_times,
		
		# Scores clínicos
		"spatial_awareness_score": spatial_awareness_score,
		"orientation_score": orientation_score,
		"processing_speed_score": processing_speed_score,
		"neglect_clinical_score": neglect_score,
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

func _on_game_finished(_results: Dictionary) -> void:
	pass

func get_remaining_time() -> float:
	if not game_active:
		return 0.0
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	return max(0.0, game_duration - elapsed)

func get_next_sequence_number() -> int:
	return current_sequence_number
