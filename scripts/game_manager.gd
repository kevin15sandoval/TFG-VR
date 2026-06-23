extends Node
# ─────────────────────────────────────────────────────────────────────────────
# GameManager — Autoload
# Gestiona la sesión, puntuación, tipos de gemas y comunicación con Firebase
# ─────────────────────────────────────────────────────────────────────────────

# ── Señales ───────────────────────────────────────────────────────────────────
signal session_started()
signal gem_collected(gem_type: String, points: int, total_score: int)
signal session_finished(results: Dictionary)
signal config_ready(config: Dictionary)
signal timer_updated(remaining: float)

# ── Config de sesión (se sobreescribe con datos de Firebase) ──────────────────
var patient_id:    String = ""
var patient_name:  String = ""
var session_id:    String = ""
var therapy_side:  String = "Izquierdo"   # Izquierdo / Derecho / Ambos
var difficulty:    String = "Media"       # Fácil / Media / Difícil
var session_type:  String = "Alcance"
var session_duration: float = 180.0       # segundos

# ── Estado de sesión ──────────────────────────────────────────────────────────
var score:           int   = 0
var gems_collected:  int   = 0
var normal_gems:     int   = 0
var golden_gems:     int   = 0
var red_gems:        int   = 0
var green_gems:      int   = 0
var purple_gems:     int   = 0
var start_time:      float = 0.0
var game_finished:   bool  = false
var session_active:  bool  = false

# ── Velocidad de gemas según dificultad ───────────────────────────────────────
var GEM_SPEED := {"Fácil": 0.7, "Media": 1.2, "Difícil": 1.9}
var GEM_SPAWN_INTERVAL := {"Fácil": 3.0, "Media": 2.0, "Difícil": 1.2}

func _ready() -> void:
	print("[GameManager] Listo. Esperando config de Firebase...")

func _process(_delta: float) -> void:
	if not session_active or game_finished:
		return
	var remaining = get_remaining_time()
	emit_signal("timer_updated", remaining)
	if remaining <= 0.0:
		finish_session()

# ─── CONFIGURAR SESIÓN DESDE FIREBASE ────────────────────────────────────────

func apply_config(config: Dictionary) -> void:
	patient_id     = config.get("patient_id",   "")
	patient_name   = config.get("patient_name", "Paciente")
	session_id     = config.get("session_id",   "")
	therapy_side   = config.get("therapy_side", "Izquierdo")
	difficulty     = config.get("difficulty",   "Media")
	session_type   = config.get("session_type", "Alcance")
	session_duration = float(config.get("duration", 180))

	print("[GameManager] Config aplicada: ", config)
	emit_signal("config_ready", config)

func get_gem_speed() -> float:
	return GEM_SPEED.get(difficulty, 1.2)

func get_spawn_interval() -> float:
	return GEM_SPAWN_INTERVAL.get(difficulty, 2.0)

# ─── INICIO DE SESIÓN ─────────────────────────────────────────────────────────

func start_session() -> void:
	score          = 0
	gems_collected = 0
	normal_gems    = 0
	golden_gems    = 0
	red_gems       = 0
	green_gems     = 0
	purple_gems    = 0
	game_finished  = false
	session_active = true
	start_time     = Time.get_ticks_msec() / 1000.0

	print("[GameManager] ▶ Sesión iniciada — Duración: ", session_duration, "s | Dificultad: ", difficulty, " | Lado: ", therapy_side)
	emit_signal("session_started")

# ─── RECOGER GEMA ─────────────────────────────────────────────────────────────

func collect_gem(gem_type: String, points: int) -> void:
	if game_finished or not session_active:
		return

	score          += points
	gems_collected += 1

	match gem_type:
		"normal":  normal_gems  += 1
		"golden":  golden_gems  += 1
		"red":     red_gems     += 1
		"green":   green_gems   += 1
		"purple":  purple_gems  += 1
		_:         normal_gems  += 1

	print("[GameManager] Gema '", gem_type, "' +", points, " pts → Total: ", score)
	emit_signal("gem_collected", gem_type, points, score)

# ─── FIN DE SESIÓN ────────────────────────────────────────────────────────────

func finish_session() -> void:
	if game_finished:
		return
	game_finished  = true
	session_active = false

	var elapsed  = get_elapsed_time()
	var accuracy = _calculate_accuracy()

	var results := {
		"patient_id":     patient_id,
		"patient_name":   patient_name,
		"session_id":     session_id,
		"therapy_side":   therapy_side,
		"difficulty":     difficulty,
		"session_type":   session_type,
		"duration":       int(elapsed),
		"score":          score,
		"accuracy":       accuracy,
		"gems_collected": gems_collected,
		"normal_gems":    normal_gems,
		"golden_gems":    golden_gems,
		"red_gems":       red_gems,
		"green_gems":     green_gems,
		"purple_gems":    purple_gems,
		"avg_time_per_gem": get_average_time_per_gem(),
		"date":           Time.get_date_string_from_system(),
	}

	print("════════ RESULTADOS DE SESIÓN ════════")
	print("Puntuación:    ", score)
	print("Precisión:     ", accuracy, "%")
	print("Gemas:         ", gems_collected)
	print("Tiempo:        ", elapsed, "s")
	print("══════════════════════════════════════")

	emit_signal("session_finished", results)

func _calculate_accuracy() -> int:
	if gems_collected == 0:
		return 0
	# Calcula precisión: gemas buenas vs intentos (red = fallo)
	var good = gems_collected - red_gems
	return int((float(good) / float(gems_collected)) * 100.0)

# ─── HELPERS DE TIEMPO ───────────────────────────────────────────────────────

func get_elapsed_time() -> float:
	if not session_active and not game_finished:
		return 0.0
	return (Time.get_ticks_msec() / 1000.0) - start_time

func get_remaining_time() -> float:
	return max(session_duration - get_elapsed_time(), 0.0)

func get_average_time_per_gem() -> float:
	if gems_collected <= 0:
		return 0.0
	return get_elapsed_time() / float(gems_collected)
