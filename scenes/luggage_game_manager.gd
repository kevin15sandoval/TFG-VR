extends Node
# ─────────────────────────────────────────────────────────────────────────────
# LuggageGameManager — Gestor del juego Luggage Handler
# Enfoque: Fuerza, resistencia muscular, rotación de tronco, coordinación
# ─────────────────────────────────────────────────────────────────────────────

signal game_started
signal game_finished(results: Dictionary)
signal luggage_placed(zone: String, weight: float, points: int)
signal luggage_error(error_type: String)
signal combo_achieved(combo_count: int)
signal timer_updated(remaining: float)

var game_active: bool = false
var recognition_phase: bool = false  # DESACTIVAR fase de reconocimiento
var recognition_time: float = 0.0  # Sin tiempo de reconocimiento
var recognition_timer: float = 0.0

var score: int = 0
var luggage_placed_count: int = 0
var luggage_dropped_count: int = 0
var luggage_wrong_count: int = 0
var luggage_missed_count: int = 0
var combo_count: int = 0
var max_combo: int = 0

var total_weight_moved: float = 0.0
var max_weight_lifted: float = 0.0
var weights_lifted: Array[float] = []

var trunk_rotations_left: int = 0
var trunk_rotations_right: int = 0
var crosses_midline: int = 0

var time_under_load: float = 0.0
var current_load_start: float = 0.0
var is_holding_luggage: bool = false

var reaction_times: Array[float] = []
var placement_times: Array[float] = []

var start_time: float = 0.0
var game_duration: float = 180.0
var difficulty: String = "Media"

var _timer: Timer
var _luggage_spawner: Node
var _player_rotation_last: float = 0.0
var _player_position: Vector3 = Vector3.ZERO

func _ready() -> void:
	print("[LuggageManager] 📦 Luggage Game Manager inicializado")
	
	_timer = Timer.new()
	add_child(_timer)
	_timer.timeout.connect(_on_timer_tick)
	_timer.wait_time = 1.0
	
	if GameManager:
		GameManager.session_started.connect(_on_session_started)
		GameManager.session_finished.connect(_on_game_finished)

func _on_session_started() -> void:
	print("[LuggageManager] 🚀 Iniciando Luggage Handler")
	start_game()

func start_game() -> void:
	if game_active:
		return
	
	game_active = true
	recognition_phase = false  # Sin fase de reconocimiento
	recognition_timer = 0.0
	
	# Reset stats
	score = 0
	luggage_placed_count = 0
	luggage_dropped_count = 0
	luggage_wrong_count = 0
	luggage_missed_count = 0
	combo_count = 0
	max_combo = 0
	
	total_weight_moved = 0.0
	max_weight_lifted = 0.0
	weights_lifted.clear()
	
	trunk_rotations_left = 0
	trunk_rotations_right = 0
	crosses_midline = 0
	
	time_under_load = 0.0
	is_holding_luggage = false
	
	reaction_times.clear()
	placement_times.clear()
	
	if GameManager:
		difficulty = GameManager.difficulty
		game_duration = GameManager.session_duration
	
	start_time = Time.get_ticks_msec() / 1000.0
	_timer.start()
	
	# INICIAR SPAWNER INMEDIATAMENTE
	_start_spawning()
	
	game_started.emit()
	print("[LuggageManager] ✅ Juego iniciado - Spawner activado")
	print("[LuggageManager] 🎮 Dificultad: ", difficulty, " | Duración: ", game_duration, "s")

func _process(delta: float) -> void:
	if game_active and is_holding_luggage:
		time_under_load += delta

func _on_timer_tick() -> void:
	if not game_active:
		return
	
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	var remaining = max(0.0, game_duration - elapsed)
	timer_updated.emit(remaining)
	
	if remaining <= 0:
		end_game()

func _start_spawning() -> void:
	# Iniciar spawner de maletas
	if _luggage_spawner:
		if _luggage_spawner.has_method("set_difficulty"):
			_luggage_spawner.set_difficulty(difficulty)
		if _luggage_spawner.has_method("start_spawning"):
			_luggage_spawner.start_spawning()
			print("[LuggageManager] ✅ Spawner iniciado correctamente")
		else:
			push_error("[LuggageManager] ❌ Spawner no tiene método start_spawning")
	else:
		push_error("[LuggageManager] ❌ No hay spawner registrado")

func on_luggage_grabbed(luggage: Node, weight: float) -> void:
	if not game_active:
		return
	
	is_holding_luggage = true
	current_load_start = Time.get_ticks_msec() / 1000.0
	
	# Registrar peso
	max_weight_lifted = max(max_weight_lifted, weight)
	weights_lifted.append(weight)
	
	print("[LuggageManager] 🤏 Maleta agarrada | Peso: ", weight, "kg")

func on_luggage_released(luggage: Node, position: Vector3) -> void:
	is_holding_luggage = false
	var hold_time = (Time.get_ticks_msec() / 1000.0) - current_load_start
	placement_times.append(hold_time)

func on_luggage_placed_correctly(luggage: Node, zone: String, weight: float, points: int) -> void:
	if not game_active or recognition_phase:
		return
	
	luggage_placed_count += 1
	score += points
	total_weight_moved += weight
	combo_count += 1
	max_combo = max(max_combo, combo_count)
	
	# Detectar rotación de tronco
	_detect_trunk_rotation(zone)
	
	# Bonus por combo
	if combo_count >= 5:
		score += 50
		combo_achieved.emit(combo_count)
		print("[LuggageManager] 🔥 ¡COMBO x", combo_count, "! +50 pts")
	
	luggage_placed.emit(zone, weight, points)
	print("[LuggageManager] ✅ Maleta colocada | Zona: ", zone, " | +", points, " pts | Score: ", score)

func on_luggage_placed_wrong(luggage: Node) -> void:
	if not game_active or recognition_phase:
		return
	
	luggage_wrong_count += 1
	score = max(0, score - 10)
	combo_count = 0
	
	luggage_error.emit("wrong_zone")
	print("[LuggageManager] ❌ Maleta mal colocada | -10 pts")

func on_luggage_dropped(luggage: Node) -> void:
	if not game_active or recognition_phase:
		return
	
	luggage_dropped_count += 1
	score = max(0, score - 20)
	combo_count = 0
	
	luggage_error.emit("dropped")
	print("[LuggageManager] 💥 Maleta caída | -20 pts")

func on_luggage_missed(luggage: Node) -> void:
	if not game_active or recognition_phase:
		return
	
	luggage_missed_count += 1
	score = max(0, score - 5)
	combo_count = 0
	
	luggage_error.emit("missed")
	print("[LuggageManager] ⏭️ Maleta perdida | -5 pts")

func _detect_trunk_rotation(zone: String) -> void:
	# Detectar rotación según zona
	if zone == "green":
		trunk_rotations_left += 1
	elif zone == "yellow":
		trunk_rotations_right += 1
	elif zone == "red":
		# Zona atrás requiere rotación grande
		trunk_rotations_right += 1  # O left dependiendo de cómo gire
	
	# Detectar cruce de línea media
	if abs(_player_position.x) > 0.5:
		crosses_midline += 1

func end_game() -> void:
	if not game_active:
		return
	
	game_active = false
	_timer.stop()
	
	if _luggage_spawner:
		_luggage_spawner.stop_spawning()
	
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	
	# Calcular métricas
	var avg_weight = _calculate_average(weights_lifted)
	var avg_placement_time = _calculate_average(placement_times)
	var total_luggage = luggage_placed_count + luggage_dropped_count + luggage_wrong_count + luggage_missed_count
	var accuracy = 0.0
	if total_luggage > 0:
		accuracy = (float(luggage_placed_count) / float(total_luggage)) * 100.0
	
	var trunk_asymmetry = 0.0
	var total_rotations = trunk_rotations_left + trunk_rotations_right
	if total_rotations > 0:
		trunk_asymmetry = abs(float(trunk_rotations_left - trunk_rotations_right)) / float(total_rotations) * 100.0
	
	var fatigue_index = 0.0
	if placement_times.size() > 2:
		var first_avg = (placement_times[0] + placement_times[1]) / 2.0
		var last_avg = (placement_times[-1] + placement_times[-2]) / 2.0
		fatigue_index = clamp((last_avg - first_avg) / first_avg, 0.0, 1.0)
	
	# Scores clínicos
	var strength_score = _calculate_strength_score(total_weight_moved, max_weight_lifted)
	var endurance_score = _calculate_endurance_score(time_under_load, elapsed)
	var trunk_mobility_score = _calculate_trunk_mobility_score(total_rotations, trunk_asymmetry)
	var coordination_score = int(accuracy)
	var speed_score = _calculate_speed_score(avg_placement_time)
	
	var results = {
		"game_type": "luggage_handler",
		"game_name": "Luggage Handler",
		"score": score,
		"luggage_placed": luggage_placed_count,
		"luggage_dropped": luggage_dropped_count,
		"luggage_wrong": luggage_wrong_count,
		"luggage_missed": luggage_missed_count,
		"max_combo": max_combo,
		"accuracy_percentage": accuracy,
		"time_elapsed": elapsed,
		"difficulty": difficulty,
		"patient_id": GameManager.patient_id,
		"patient_name": GameManager.patient_name,
		"session_id": GameManager.session_id,
		"therapy_side": GameManager.therapy_side,
		"session_type": GameManager.session_type,
		
		# === MÉTRICAS DE FUERZA ===
		"total_weight_moved": total_weight_moved,
		"max_weight_lifted": max_weight_lifted,
		"avg_weight": avg_weight,
		"repetitions": luggage_placed_count,
		
		# === MÉTRICAS DE RESISTENCIA ===
		"time_under_load": time_under_load,
		"fatigue_index": fatigue_index,
		"avg_placement_time": avg_placement_time,
		
		# === ROTACIÓN DE TRONCO ===
		"trunk_rotations_left": trunk_rotations_left,
		"trunk_rotations_right": trunk_rotations_right,
		"trunk_asymmetry": trunk_asymmetry,
		"crosses_midline": crosses_midline,
		
		# === COORDINACIÓN ===
		"placement_times": placement_times,
		
		# === SCORES CLÍNICOS (0-100) ===
		"clinical_scores": {
			"strength": strength_score,
			"endurance": endurance_score,
			"trunk_mobility": trunk_mobility_score,
			"coordination": coordination_score,
			"processing_speed": speed_score
		},
		
		# === RECOMENDACIONES CLÍNICAS ===
		"clinical_recommendations": _generate_clinical_recommendations(
			strength_score,
			endurance_score,
			trunk_asymmetry,
			fatigue_index,
			accuracy
		)
	}
	
	game_finished.emit(results)
	print("[LuggageManager] 🏁 Juego terminado")
	print("  Score: ", score)
	print("  Maletas colocadas: ", luggage_placed_count)
	print("  Peso total: ", total_weight_moved, " kg")
	print("  Precisión: ", "%.1f" % accuracy, "%")
	
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

func _calculate_strength_score(total_weight: float, max_weight: float) -> int:
	# Score basado en peso total movido y peso máximo
	var base_score = min(100, int(total_weight / 2.0))
	var bonus = min(20, int(max_weight) * 2)
	return min(100, base_score + bonus)

func _calculate_endurance_score(time_load: float, time_total: float) -> int:
	# Porcentaje de tiempo bajo carga
	if time_total == 0:
		return 0
	var percentage = (time_load / time_total) * 100.0
	return int(clamp(percentage, 0, 100))

func _calculate_trunk_mobility_score(rotations: int, asymmetry: float) -> int:
	var base = min(80, rotations * 5)
	var penalty = int(asymmetry / 2.0)
	return max(0, base - penalty)

func _calculate_speed_score(avg_time: float) -> int:
	if avg_time < 5.0:
		return 100
	elif avg_time < 7.0:
		return 85
	elif avg_time < 10.0:
		return 70
	elif avg_time < 15.0:
		return 55
	else:
		return 40

func _generate_clinical_recommendations(
	strength: int,
	endurance: int,
	asymmetry: float,
	fatigue: float,
	accuracy: float
) -> Array[String]:
	var recs: Array[String] = []
	
	if strength < 60:
		recs.append("FUERZA BAJA: Comenzar con maletas más ligeras (2-5kg). Progresión gradual.")
	
	if endurance < 50:
		recs.append("RESISTENCIA LIMITADA: Sesiones más cortas (2-3 min). Aumentar progresivamente.")
	
	if asymmetry > 20:
		recs.append("ASIMETRÍA TRONCAL: Ejercicios específicos de rotación bilateral. Enfatizar lado débil.")
	
	if fatigue > 0.4:
		recs.append("FATIGA ALTA: Aumentar descansos entre sesiones. Evaluar tolerancia al ejercicio.")
	
	if accuracy < 70:
		recs.append("PRECISIÓN BAJA: Reducir velocidad de cinta. Enfatizar control sobre velocidad.")
	
	if recs.is_empty():
		recs.append("Rendimiento adecuado. Continuar progresión a mayor dificultad.")
	
	return recs

func register_spawner(spawner: Node) -> void:
	_luggage_spawner = spawner
	spawner.luggage_spawned.connect(_on_luggage_spawned)
	print("[LuggageManager] ✅ Spawner registrado")

func _on_luggage_spawned(luggage: RigidBody3D) -> void:
	# Conectar señales de maleta
	if luggage.has_signal("luggage_grabbed"):
		luggage.luggage_grabbed.connect(on_luggage_grabbed.bind(luggage))
	if luggage.has_signal("luggage_released"):
		luggage.luggage_released.connect(on_luggage_released.bind(luggage))
	if luggage.has_signal("luggage_placed_correctly"):
		luggage.luggage_placed_correctly.connect(on_luggage_placed_correctly.bind(luggage))
	if luggage.has_signal("luggage_placed_wrong"):
		luggage.luggage_placed_wrong.connect(on_luggage_placed_wrong.bind(luggage))
	if luggage.has_signal("luggage_dropped"):
		luggage.luggage_dropped.connect(on_luggage_dropped.bind(luggage))

func update_player_position(pos: Vector3) -> void:
	_player_position = pos

func _on_game_finished(_results: Dictionary) -> void:
	pass

func get_remaining_time() -> float:
	if not game_active:
		return 0.0
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	return max(0.0, game_duration - elapsed)
