extends Node
# ─────────────────────────────────────────────────────────────────────────────
# VaultGameManager — Gestor del juego Laser Limbo Escape
# El jugador esquiva láseres que avanzan hacia él (tipo LIMBO)
# ─────────────────────────────────────────────────────────────────────────────

signal game_started
signal game_finished(results: Dictionary)
signal laser_dodged(points: int)
signal laser_hit
signal timer_updated(remaining: float)

var game_active: bool = false
var score: int = 0
var laser_hits: int = 0
var lasers_dodged: int = 0
var start_time: float = 0.0
var game_duration: float = 180.0  # 3 minutos por defecto
var difficulty: String = "Media"

# Métricas terapéuticas
var dodge_times: Array[float] = []
var hit_positions: Array[Vector3] = []

var _timer: Timer

func _ready() -> void:
	print("[VaultManager] 🔐 Vault Limbo Manager inicializado")
	
	_timer = Timer.new()
	add_child(_timer)
	_timer.timeout.connect(_on_timer_tick)
	_timer.wait_time = 1.0
	
	# Conectar con GameManager global si existe
	if GameManager:
		GameManager.session_started.connect(_on_session_started)
		GameManager.session_finished.connect(_on_game_finished)

func _on_session_started() -> void:
	print("[VaultManager] 🚀 Iniciando juego Laser Limbo")
	await get_tree().create_timer(0.5).timeout
	start_game()

func start_game() -> void:
	if game_active:
		return
	
	game_active = true
	score = 0
	laser_hits = 0
	lasers_dodged = 0
	dodge_times.clear()
	hit_positions.clear()
	
	# Aplicar configuración de GameManager
	if GameManager:
		difficulty = GameManager.difficulty
		game_duration = GameManager.session_duration
	
	start_time = Time.get_ticks_msec() / 1000.0
	_timer.start()
	
	game_started.emit()
	print("[VaultManager] ⏱️ Juego iniciado | Dificultad: ", difficulty, " | Duración: ", game_duration, "s")

func _on_timer_tick() -> void:
	if not game_active:
		return
	
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	var remaining = max(0.0, game_duration - elapsed)
	
	timer_updated.emit(remaining)
	
	if remaining <= 0:
		end_game()

func add_dodge_points(points: int) -> void:
	if not game_active:
		return
	
	lasers_dodged += 1
	score += points
	
	var dodge_time = Time.get_ticks_msec() / 1000.0 - start_time
	dodge_times.append(dodge_time)
	
	laser_dodged.emit(points)
	print("[VaultManager] ✅ Láser esquivado +", points, " | Score: ", score, " | Total esquivados: ", lasers_dodged)

func register_laser_hit() -> void:
	if not game_active:
		return
	
	laser_hits += 1
	score = max(0, score - 15)  # Penalización mayor
	
	laser_hit.emit()
	print("[VaultManager] ⚡ Láser tocado! Hits: ", laser_hits, " | Score: ", score)
	
	# Si toca 5 veces, game over
	if laser_hits >= 5:
		print("[VaultManager] 💀 Demasiados toques de láser - Game Over")
		end_game()

func end_game() -> void:
	if not game_active:
		return
	
	game_active = false
	_timer.stop()
	
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	
	// Calcular métricas
	var avg_dodge_time = 0.0
	if dodge_times.size() > 0:
		var total = 0.0
		for t in dodge_times:
			total += t
		avg_dodge_time = total / dodge_times.size()
	
	var dodge_rate = 0.0
	var total_lasers = lasers_dodged + laser_hits
	if total_lasers > 0:
		dodge_rate = (float(lasers_dodged) / float(total_lasers)) * 100.0
	
	var results = {
		"game_type": "vault_escape",
		"game_name": "Laser Limbo Escape",
		"score": score,
		"lasers_dodged": lasers_dodged,
		"laser_hits": laser_hits,
		"dodge_rate_percentage": dodge_rate,
		"time_elapsed": elapsed,
		"difficulty": difficulty,
		"patient_id": GameManager.patient_id if GameManager else "",
		"patient_name": GameManager.patient_name if GameManager else "",
		"session_id": GameManager.session_id if GameManager else "",
		"therapy_side": GameManager.therapy_side if GameManager else "Ambos",
		"session_type": "Equilibrio y Flexibilidad",
		"date": Time.get_date_string_from_system(),
		
		// Métricas terapéuticas
		"avg_dodge_time": avg_dodge_time,
		"total_movements": total_lasers,
		"successful_dodges": lasers_dodged,
		"failed_dodges": laser_hits,
		
		# Datos clínicos
		"motor_control_score": max(0, 100 - (laser_hits * 15)),
		"reaction_time_score": int(max(0, 100 - avg_dodge_time * 10)),
		"flexibility_score": int(dodge_rate),
	}
	
	game_finished.emit(results)
	print("[VaultManager] 🏁 Juego terminado")
	print("  Score: ", score)
	print("  Láseres esquivados: ", lasers_dodged)
	print("  Toques: ", laser_hits)
	print("  Tasa de éxito: ", "%.1f" % dodge_rate, "%")
	print("  Tiempo: ", "%.1f" % elapsed, "s")
	
	# Enviar a GameManager si existe
	if GameManager and GameManager.session_active:
		GameManager.session_active = false
		GameManager.session_finished.emit(results)

func _on_game_finished(_results: Dictionary) -> void:
	# Cleanup si es necesario
	pass

func get_remaining_time() -> float:
	if not game_active:
		return 0.0
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	return max(0.0, game_duration - elapsed)
