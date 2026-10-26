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
var gems_missed:     int   = 0   # gemas NO rojas que expiraron sin ser tocadas
var green_gems:      int   = 0
var purple_gems:     int   = 0
var start_time:      float = 0.0
var game_finished:   bool  = false
var session_active:  bool  = false

# ── SISTEMA DE ENERGÍA DEL JUGADOR ───────────────────────────────────────────
var player_energy: float = 100.0  # Energía actual (0-100)
var max_energy: float = 100.0     # Energía máxima
var energy_cost_per_gem: float = 15.0  # ⭐ Cuesta 15 energía (antes 20) - MÁS PERMISIVO
var energy_recharge_rate: float = 20.0  # ⭐ Recarga 20 energía/segundo (antes 15) - MÁS RÁPIDO
signal energy_changed(current: float, max_val: float)  # Señal para actualizar UI

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
var SPAWN_INTERVAL:= {"Fácil": 4.5, "Media": 3.5, "Difícil": 2.5}  # ⭐ AUMENTADO para dar tiempo a recargar

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

var game_type: String = ""  # gems, vault_escape, urban_attention_quest, luggage_handler

func apply_config(config: Dictionary) -> void:
	patient_id      = config.get("patient_id",   "")
	patient_name    = config.get("patient_name", "Paciente")
	session_id      = config.get("session_id",   "")
	therapy_side    = config.get("therapy_side", "Izquierdo")
	difficulty      = config.get("difficulty",   "Media")
	session_type    = config.get("session_type", "Alcance")
	session_duration = float(config.get("duration", 180))
	game_type       = config.get("game_id", "gems")
	print("[GameManager] ═══════════════════════════════════════════")
	print("[GameManager] 📋 CONFIGURACIÓN APLICADA")
	print("[GameManager] ═══════════════════════════════════════════")
	print("[GameManager] Patient ID:  ", patient_id)
	print("[GameManager] Session ID:  ", session_id)
	print("[GameManager] Game Type:   ", game_type)
	print("[GameManager] Difficulty:  ", difficulty)
	print("[GameManager] Therapy Side:", therapy_side)
	print("[GameManager] Duration:    ", session_duration, "s")
	print("[GameManager] ═══════════════════════════════════════════")
	emit_signal("config_ready", config)

func get_gem_speed() -> float:
	return GEM_SPEED.get(difficulty, 1.2)

func get_spawn_interval() -> float:
	return SPAWN_INTERVAL.get(difficulty, 2.0)

# ─── INICIO ───────────────────────────────────────────────────────────────────

func start_session() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🚀 GAMEMANAGER.START_SESSION() EJECUTÁNDOSE ═══")
	print("═══════════════════════════════════════════════════════════════")
	
	score             = 0
	gems_collected    = 0
	normal_gems       = 0
	golden_gems       = 0
	red_gems_hit      = 0
	red_gems_avoided  = 0
	gems_missed       = 0
	green_gems        = 0
	purple_gems       = 0
	movement_log      = []
	game_finished     = false
	session_active    = true
	start_time        = Time.get_ticks_msec() / 1000.0
	_gem_start_time   = start_time
	
	# ⚡ RESETEAR ENERGÍA
	player_energy     = max_energy
	emit_signal("energy_changed", player_energy, max_energy)
	print("[GameManager] ⚡ Energía inicial: ", player_energy, "/", max_energy)

	# Reset contadores de movimiento
	for key in movements_by_type:
		movements_by_type[key]["completed"] = 0
		movements_by_type[key]["total_time"] = 0.0

	print("[GameManager] ✅ Variables reseteadas")
	print("[GameManager] 📊 Estado actual:")
	print("  - session_active:  ", session_active)
	print("  - game_finished:   ", game_finished)
	print("  - score:           ", score)
	print("  - difficulty:      ", difficulty)
	print("  - therapy_side:    ", therapy_side)
	print("  - session_duration:", session_duration, "s")
	print("[GameManager] 📢 Emitiendo señal 'session_started'...")
	
	emit_signal("session_started")
	
	print("[GameManager] ✅ Señal 'session_started' emitida")
	print("═══════════════════════════════════════════════════════════════")
	print("═══ ✅ SESIÓN ACTIVA - JUEGO EN MARCHA ═══")
	print("═══════════════════════════════════════════════════════════════")

# ─── NOTIFICAR NUEVA GEMA (llamar cuando spawna) ─────────────────────────────

func on_gem_spawned() -> void:
	_gem_start_time = Time.get_ticks_msec() / 1000.0

# ─── RECOGER GEMA ─────────────────────────────────────────────────────────────

func collect_gem(gem_type: String, points: int, exercise_name: String = "") -> void:
	if game_finished or not session_active:
		return

	var elapsed_for_gem = (Time.get_ticks_msec() / 1000.0) - _gem_start_time

	# gems_collected cuenta SOLO gemas buenas recogidas: ni la roja tocada (red_gems_hit)
	# ni la roja esquivada (red_gems_avoided) son "recogidas".
	match gem_type:
		"red":
			# Penalización única por toque, siempre resta (aunque llegue con signo positivo).
			red_gems_hit += 1
			points = -absi(points)
		"red_avoided":
			red_gems_avoided += 1
			points = absi(points)
		_:
			gems_collected += 1
			match gem_type:
				"golden": golden_gems += 1
				"green":  green_gems  += 1
				"purple": purple_gems += 1
				_:        normal_gems += 1
	# La puntuación nunca es negativa (convención del resto de minijuegos).
	score = maxi(0, score + points)

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

## Gema NO roja que expira sin ser tocada: cuenta como fallo, no como recogida ni puntúa.
func register_gem_missed() -> void:
	if game_finished or not session_active:
		return
	gems_missed += 1
	_gem_start_time = Time.get_ticks_msec() / 1000.0

# ─── FIN DE SESIÓN ────────────────────────────────────────────────────────────

func finish_session() -> void:
	if game_finished:
		return
	game_finished  = true
	session_active = false
	
	print("[GameManager] 🏁 Finalizando sesión...")
	print("[GameManager] Limpiando IDs de sesión...")

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

	# Sin eventos reales (0 recogidas, 0 rojas tocadas/esquivadas, 0 perdidas) no se afirma
	# rendimiento: accuracy y score quedan en 0 y se marca "sin_datos" = true.
	var sin_datos: bool = _total_events() == 0

	var results = {
		"sin_datos":        sin_datos,
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
		"game_type":        "gems",
		"game_name":        "Recolectar gemas",
		# Gemas
		"gems_collected":   gems_collected,
		"normal_gems":      normal_gems,
		"golden_gems":      golden_gems,
		"red_gems_hit":     red_gems_hit,
		"red_gems_avoided": red_gems_avoided,
		"gems_missed":      gems_missed,
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
	# La identidad (patient_id, session_id, patient_name) NO se borra aquí: los gestores de
	# Vault, City y Luggage la leen al terminar su propio temporizador, que puede ser posterior.
	# Se libera con release_session() cuando el guardado está confirmado.

# ─── IDENTIDAD DE SESIÓN ──────────────────────────────────────────────────────

## Borra la identidad de la sesión (evita reutilizar ids antiguos, p. ej. el autoarranque de Gemas).
func release_session() -> void:
	patient_id = ""
	session_id = ""
	patient_name = ""
	print("[GameManager] 🧹 Identidad de sesión liberada")

## Libera la identidad SOLO si el gestor de Firebase confirma que los resultados se guardaron.
## Devuelve true si se liberó; si no, la conserva (guardado pendiente o fallido).
func release_session_si_confirmado(gestor_firebase: Node) -> bool:
	if gestor_firebase == null or not gestor_firebase.has_method("guardado_confirmado") or not gestor_firebase.guardado_confirmado():
		print("[GameManager] ⚠️ Identidad de sesión conservada: guardado sin confirmar")
		return false
	release_session()
	return true

# ─── HELPERS ─────────────────────────────────────────────────────────────────

## Eventos reales de la sesión: recogidas, rojas tocadas, rojas esquivadas y gemas perdidas.
func _total_events() -> int:
	return gems_collected + red_gems_hit + red_gems_avoided + gems_missed

## % de resultados correctos (recogida buena o roja esquivada) sobre todos los eventos reales.
func _calculate_accuracy() -> int:
	var total := _total_events()
	if total == 0: return 0
	var good := gems_collected + red_gems_avoided
	return int((float(good) / float(total)) * 100.0)

func get_elapsed_time() -> float:
	if not session_active and not game_finished: return 0.0
	return (Time.get_ticks_msec() / 1000.0) - start_time

func get_remaining_time() -> float:
	return max(session_duration - get_elapsed_time(), 0.0)

func get_average_time_per_gem() -> float:
	if gems_collected <= 0: return 0.0
	return get_elapsed_time() / float(gems_collected)

# ─── SISTEMA DE ENERGÍA ──────────────────────────────────────────────────────

## Verificar si el jugador tiene suficiente energía para recolectar
func has_energy_for_gem() -> bool:
	return player_energy >= energy_cost_per_gem

## Consumir energía al recolectar una gema
func consume_energy() -> bool:
	if player_energy >= energy_cost_per_gem:
		player_energy -= energy_cost_per_gem
		player_energy = max(0.0, player_energy)
		print("[GameManager] ⚡ Energía consumida: -", energy_cost_per_gem, " → Restante: ", player_energy)
		emit_signal("energy_changed", player_energy, max_energy)
		return true
	return false

## Recargar energía (llamar cuando el jugador hace movimiento de flexión/relajación)
func recharge_energy(delta: float) -> void:
	if player_energy < max_energy:
		player_energy += energy_recharge_rate * delta
		player_energy = min(max_energy, player_energy)
		emit_signal("energy_changed", player_energy, max_energy)

## Obtener porcentaje de energía actual
func get_energy_percentage() -> float:
	return (player_energy / max_energy) * 100.0
