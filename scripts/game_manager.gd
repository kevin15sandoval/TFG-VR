extends Node
# ─────────────────────────────────────────────────────────────────────────────
# GameManager — Autoload
# Gestiona sesión, puntuación y métricas clínicas reales por movimiento
# ─────────────────────────────────────────────────────────────────────────────

# ── Señales ───────────────────────────────────────────────────────────────────
signal session_started()
signal gem_collected(gem_type: String, points: int, total_score: int)
signal session_finished(results: Dictionary)
signal config_ready(config: Dictionary)
signal timer_updated(remaining: float)

# ── Config de sesión ──────────────────────────────────────────────────────────
var patient_id:      String = ""
var patient_name:    String = ""
var session_id:      String = ""
var therapy_side:    String = "Izquierdo"
var difficulty:      String = "Media"
var session_type:    String = "Alcance"
var session_duration: float = 180.0

# ── Estado de sesión ──────────────────────────────────────────────────────────
var score:           int   = 0
var gems_collected:  int   = 0
var normal_gems:     int   = 0
var golden_gems:     int   = 0
var red_gems_hit:    int   = 0
var red_gems_avoided:int   = 0
var green_gems:      int   = 0
var purple_gems:     int   = 0
var start_time:      float = 0.0
var game_finished:   bool  = false
var session_active:  bool  = false

# ── Métricas clínicas por movimiento ─────────────────────────────────────────
# Cada entrada: { name, exercise_type, completed, time_seconds, side }
var movement_log: Array = []
var _gem_start_time: float = 0.0

# Contadores por tipo de movimiento terapéutico
var movements_by_type: Dictionary = {
	"Flexión":          {"completed": 0, "total_time": 0.0},
	"Extensión":        {"completed": 0, "total_time": 0.0},
	"Abducción":        {"completed": 0, "total_time": 0.0},
	"Aducción":         {"completed": 0, "total_time": 0.0},
	"Rotación externa": {"completed": 0, "total_time": 0.0},
	"Rotación interna": {"completed": 0, "total_time": 0.0},
	"Alcance lateral":  {"completed": 0, "total_time": 0.0},
	"Alcance alto":     {"completed": 0, "total_time": 0.0},
	"Flexión bilateral":{"completed": 0, "total_time": 0.0},
	"Otro":             {"completed": 0, "total_time": 0.0},
}

# ── Velocidades y frecuencias según dificultad ───────────────────────────────
var GEM_SPEED     := {"Fácil": 0.7, "Media": 1.2, "Difícil": 1.9}
var SPAWN_INTERVAL:= {"Fácil": 3.0, "Media": 2.0, "Difícil": 1.2}

func _ready() -> void:
	print("[GameManager] Listo")

func _process(_delta: float) -> void:
	if not session_active or game_finished:
		return
	var remaining = get_remaining_time()
	emit_signal("timer_updated", remaining)
	if remaining <= 0.0:
		finish_session()

# ─── CONFIGURAR SESIÓN ────────────────────────────────────────────────────────

func apply_config(config: Dictionary) -> void:
	patient_id      = config.get("patient_id",   "")
	patient_name    = config.get("patient_name", "Paciente")
	session_id      = config.get("session_id",   "")
	therapy_side    = config.get("therapy_side", "Izquierdo")
	difficulty      = config.get("difficulty",   "Media")
	session_type    = config.get("session_type", "Alcance")
	session_duration = float(config.get("duration", 180))
	print("[GameManager] Config: ", config)
	emit_signal("config_ready", config)

func get_gem_speed() -> float:
	return GEM_SPEED.get(difficulty, 1.2)

func get_spawn_interval() -> float:
	return SPAWN_INTERVAL.get(difficulty, 2.0)

# ─── INICIO ───────────────────────────────────────────────────────────────────

func start_session() -> void:
	score             = 0
	gems_collected    = 0
	normal_gems       = 0
	golden_gems       = 0
	red_gems_hit      = 0
	red_gems_avoided  = 0
	green_gems        = 0
	purple_gems       = 0
	movement_log      = []
	game_finished     = false
	session_active    = true
	start_time        = Time.get_ticks_msec() / 1000.0
	_gem_start_time   = start_time

	# Reset contadores de movimiento
	for key in movements_by_type:
		movements_by_type[key]["completed"] = 0
		movements_by_type[key]["total_time"] = 0.0

	print("[GameManager] ▶ Sesión iniciada | ", difficulty, " | ", therapy_side)
	emit_signal("session_started")

# ─── NOTIFICAR NUEVA GEMA (llamar cuando spawna) ─────────────────────────────

func on_gem_spawned() -> void:
	_gem_start_time = Time.get_ticks_msec() / 1000.0

# ─── RECOGER GEMA ─────────────────────────────────────────────────────────────

func collect_gem(gem_type: String, points: int, exercise_name: String = "") -> void:
	if game_finished or not session_active:
		return

	var elapsed_for_gem = (Time.get_ticks_msec() / 1000.0) - _gem_start_time
	score          += points
	gems_collected += 1

	match gem_type:
		"normal":       normal_gems       += 1
		"golden":       golden_gems       += 1
		"green":        green_gems        += 1
		"purple":       purple_gems       += 1
		"red":          red_gems_hit      += 1; score -= points  # penalización
		"red_avoided":  red_gems_avoided  += 1
		_:              normal_gems       += 1

	# Registrar en log clínico
	if exercise_name != "" and gem_type != "red":
		var entry = {
			"exercise":    exercise_name,
			"gem_type":    gem_type,
			"time":        round(elapsed_for_gem * 10.0) / 10.0,
			"side":        therapy_side,
			"completed":   gem_type != "red",
		}
		movement_log.append(entry)

		# Acumular por tipo
		var key = exercise_name if movements_by_type.has(exercise_name) else "Otro"
		movements_by_type[key]["completed"] += 1
		movements_by_type[key]["total_time"] += elapsed_for_gem

	_gem_start_time = Time.get_ticks_msec() / 1000.0

	print("[GameManager] ", gem_type, " '", exercise_name, "' +", points, " → ", score)
	emit_signal("gem_collected", gem_type, points, score)

# ─── FIN DE SESIÓN ────────────────────────────────────────────────────────────

func finish_session() -> void:
	if game_finished:
		return
	game_finished  = true
	session_active = false

	var elapsed   = get_elapsed_time()
	var accuracy  = _calculate_accuracy()
	var avg_time  = get_average_time_per_gem()

	# Construir resumen de movimientos para Firestore
	var movements_summary: Array = []
	for mov_name in movements_by_type:
		var data = movements_by_type[mov_name]
		if data["completed"] > 0:
			var avg_t = data["total_time"] / float(data["completed"])
			movements_summary.append({
				"name":        mov_name,
				"completed":   data["completed"],
				"avg_time_s":  round(avg_t * 10.0) / 10.0,
			})

	# Calcular rango de movimiento estimado (% sesiones por zona)
	var zones = {"Alto": 0, "Medio": 0, "Lateral": 0, "Bajo": 0}
	for entry in movement_log:
		var ex = entry["exercise"]
		if "alto" in ex.to_lower() or "Flexión" == ex:
			zones["Alto"] += 1
		elif "lateral" in ex.to_lower() or "abducción" in ex.to_lower() or "aducción" in ex.to_lower():
			zones["Lateral"] += 1
		elif "extensión" in ex.to_lower():
			zones["Bajo"] += 1
		else:
			zones["Medio"] += 1

	var results := {
		# Datos básicos
		"patient_id":       patient_id,
		"patient_name":     patient_name,
		"session_id":       session_id,
		"therapy_side":     therapy_side,
		"difficulty":       difficulty,
		"session_type":     session_type,
		"duration":         int(elapsed),
		"score":            score,
		"accuracy":         accuracy,
		"date":             Time.get_date_string_from_system(),
		# Gemas
		"gems_collected":   gems_collected,
		"normal_gems":      normal_gems,
		"golden_gems":      golden_gems,
		"red_gems_hit":     red_gems_hit,
		"red_gems_avoided": red_gems_avoided,
		"green_gems":       green_gems,
		"purple_gems":      purple_gems,
		# Métricas clínicas
		"avg_time_per_gem":    round(avg_time * 10.0) / 10.0,
		"movements_summary":   movements_summary,
		"zones_worked":        zones,
		"total_movements":     gems_collected,
		"movement_log":        movement_log,
	}

	print("════ RESULTADOS ════")
	print("Puntuación: ", score, " | Precisión: ", accuracy, "% | Tiempo: ", elapsed, "s")
	print("Movimientos: ", movements_summary)
	emit_signal("session_finished", results)

# ─── HELPERS ─────────────────────────────────────────────────────────────────

func _calculate_accuracy() -> int:
	if gems_collected == 0: return 0
	var good = gems_collected - red_gems_hit
	return int((float(good) / float(gems_collected)) * 100.0)

func get_elapsed_time() -> float:
	if not session_active and not game_finished: return 0.0
	return (Time.get_ticks_msec() / 1000.0) - start_time

func get_remaining_time() -> float:
	return max(session_duration - get_elapsed_time(), 0.0)

func get_average_time_per_gem() -> float:
	if gems_collected <= 0: return 0.0
	return get_elapsed_time() / float(gems_collected)
