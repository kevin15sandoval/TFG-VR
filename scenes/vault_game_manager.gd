extends Node
# ─────────────────────────────────────────────────────────────────────────────
# VaultGameManager — Gestor del juego Laser Vault Escape
# Coordina láser, paneles, puntuación y métricas terapéuticas
# ─────────────────────────────────────────────────────────────────────────────

signal game_started
signal game_finished(results: Dictionary)
signal panel_collected(panel_id: int, points: int)
signal laser_hit
signal timer_updated(remaining: float)

var game_active: bool = false
var score: int = 0
var laser_hits: int = 0
var panels_collected: int = 0
var total_panels: int = 0
var start_time: float = 0.0
var game_duration: float = 180.0  # 3 minutos por defecto
var difficulty: String = "Media"

# Métricas terapéuticas
var panel_times: Array[float] = []
var movement_range_vertical: Dictionary = {"max": 0.0, "min": 999.0}
var crosses_midline: int = 0
var last_panel_side: String = ""

# Referencias a nodos
var _panels: Array = []
var _lasers: Array = []
var _timer: Timer

func _ready() -> void:
	print("[VaultManager] 🔐 Vault Game Manager inicializado")
	
	_timer = Timer.new()
	add_child(_timer)
	_timer.timeout.connect(_on_timer_tick)
	_timer.wait_time = 1.0
	
	# Conectar con GameManager global si existe
	if GameManager:
		GameManager.session_started.connect(_on_session_started)
		GameManager.session_finished.connect(_on_game_finished)

func _on_session_started() -> void:
	print("[VaultManager] 🚀 Iniciando juego Vault Escape")
	start_game()

func start_game() -> void:
	if game_active:
		return
	
	game_active = true
	score = 0
	laser_hits = 0
	panels_collected = 0
	panel_times.clear()
	movement_range_vertical = {"max": 0.0, "min": 999.0}
	crosses_midline = 0
	last_panel_side = ""
	
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

func collect_panel(panel_id: int, points: int, panel_position: Vector3) -> void:
	if not game_active:
		return
	
	panels_collected += 1
	score += points
	
	# Registrar tiempo del panel
	var panel_time = Time.get_ticks_msec() / 1000.0 - start_time
	panel_times.append(panel_time)
	
	# Registrar rango vertical
	movement_range_vertical["max"] = max(movement_range_vertical["max"], panel_position.y)
	movement_range_vertical["min"] = min(movement_range_vertical["min"], panel_position.y)
	
	# Detectar cruce de línea media
	var current_side = "left" if panel_position.x < 0 else "right"
	if last_panel_side != "" and last_panel_side != current_side:
		crosses_midline += 1
	last_panel_side = current_side
	
	panel_collected.emit(panel_id, points)
	print("[VaultManager] ✅ Panel ", panel_id, " recogido | Score: ", score)
	
	# Verificar si se recogieron todos los paneles
	if panels_collected >= total_panels:
		print("[VaultManager] 🎉 ¡Todos los paneles recogidos!")
		end_game()

func register_laser_hit() -> void:
	if not game_active:
		return
	
	laser_hits += 1
	score = max(0, score - 10)  # Penalización
	
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
	
	# Calcular métricas
	var avg_time_per_panel = 0.0
	if panel_times.size() > 0:
		var total_time = 0.0
		for t in panel_times:
			total_time += t
		avg_time_per_panel = total_time / panel_times.size()
	
	var vertical_range = movement_range_vertical["max"] - movement_range_vertical["min"]
	var precision = 100.0 * float(panels_collected) / float(max(1, total_panels))
	var completion = 100.0 * float(panels_collected) / float(max(1, total_panels))
	
	var results = {
		"game_type": "vault_escape",
		"score": score,
		"panels_collected": panels_collected,
		"total_panels": total_panels,
		"laser_hits": laser_hits,
		"completion_percentage": completion,
		"time_elapsed": elapsed,
		"difficulty": difficulty,
		
		# Métricas terapéuticas
		"avg_time_per_panel": avg_time_per_panel,
		"vertical_range_meters": vertical_range,
		"crosses_midline": crosses_midline,
		"precision_percentage": precision,
		"panel_times": panel_times,
		
		# Datos clínicos
		"motor_control_score": max(0, 100 - (laser_hits * 10)),
		"planning_score": int(100.0 / max(1.0, avg_time_per_panel / 10.0)),
		"spatial_awareness_score": crosses_midline * 10,
	}
	
	game_finished.emit(results)
	print("[VaultManager] 🏁 Juego terminado")
	print("  Score: ", score)
	print("  Paneles: ", panels_collected, "/", total_panels)
	print("  Toques láser: ", laser_hits)
	print("  Tiempo: ", "%.1f" % elapsed, "s")
	print("  Rango vertical: ", "%.2f" % vertical_range, "m")
	print("  Cruces línea media: ", crosses_midline)
	
	# Enviar a GameManager si existe
	if GameManager and GameManager.session_active:
		GameManager.session_active = false
		GameManager.session_finished.emit(results)

func register_panel(panel: Node) -> void:
	_panels.append(panel)
	total_panels += 1
	panel.panel_activated.connect(func(id, pts): 
		collect_panel(id, pts, panel.global_position)
	)

func register_laser(laser: Node) -> void:
	_lasers.append(laser)
	laser.player_hit.connect(register_laser_hit)

func _on_game_finished(_results: Dictionary) -> void:
	# Cleanup si es necesario
	pass

func get_remaining_time() -> float:
	if not game_active:
		return 0.0
	var elapsed = Time.get_ticks_msec() / 1000.0 - start_time
	return max(0.0, game_duration - elapsed)
