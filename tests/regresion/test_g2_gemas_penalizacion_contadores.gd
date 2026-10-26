extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de regresión G2 (Gemas): penalización de la gema roja, contadores de recogidas /
# evitadas / perdidas, coherencia puntuación-eventos-resultados y sesión sin eventos.
# - Datos SINTÉTICOS (TEST-G2-P / TEST-G2-S). Sin red: se usa GameManager y el spawner
#   fuera del árbol (sin _ready) con gemas simuladas; no se crea ni se llama a Firebase.
# - Ejecutar en copia aislada con openxr/enabled=false (solo en la copia), con timeout:
#     godot --headless --path <copia> --script res://tests/regresion/test_g2_gemas_penalizacion_contadores.gd
# - Código de salida 0 = todo correcto; 1 = alguna comprobación falla.
# ─────────────────────────────────────────────────────────────────────────────

const RUTA_SPAWNER := "res://scenes/gem_spawner.gd"
const RUTA_GEM := "res://scenes/gem.tscn"

var fallos := 0
var gm

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

func _nueva_sesion() -> Dictionary:
	for c in gm.session_finished.get_connections(): gm.session_finished.disconnect(c["callable"])
	for c in gm.session_started.get_connections(): gm.session_started.disconnect(c["callable"])
	gm.apply_config({"patient_id": "TEST-G2-P", "patient_name": "Sintetico", "session_id": "TEST-G2-S",
		"duration": 600, "difficulty": "Media", "therapy_side": "Ambos", "game_id": "gems"})
	gm.game_finished = false
	gm.start_session()
	var capt := {"r": {}, "n": 0}
	gm.session_finished.connect(func(r):
		capt["r"] = r
		capt["n"] += 1)
	return capt

func _gema_falsa(tipo: String, pts: int) -> Object:
	var s := GDScript.new()
	s.source_code = "extends RefCounted\nvar gem_type = \"%s\"\nvar points = %d\nvar exercise_name = \"Flexión\"\nvar collected = false\n" % [tipo, pts]
	s.reload()
	return s.new()

func _run() -> void:
	await process_frame
	gm = root.get_node("GameManager")
	var sp := Node3D.new()
	sp.set_script(load(RUTA_SPAWNER))   # fuera del árbol: no se ejecuta _ready (sin portal ni señales)

	# ── T1: gema roja tocada penaliza UNA sola vez (score nunca negativo) ──
	var capt = _nueva_sesion()
	sp._on_gem_caught(_gema_falsa("normal", 10))
	sp._on_gem_caught(_gema_falsa("golden", 25))
	check(gm.score == 35, "T1: tras 10+25 puntos el score es 35 (real: %d)" % gm.score)
	sp._on_gem_caught(_gema_falsa("red", -15))
	check(gm.score == 20, "T1: la gema roja resta 15 una sola vez (esperado 20, real: %d)" % gm.score)
	check(gm.red_gems_hit == 1, "T1: red_gems_hit = 1 (real: %d)" % gm.red_gems_hit)
	check(gm.gems_collected == 2, "T1: la roja tocada NO cuenta como recogida (gems_collected=2, real: %d)" % gm.gems_collected)
	sp._on_gem_caught(_gema_falsa("red", -15))
	sp._on_gem_caught(_gema_falsa("red", -15))
	check(gm.score == 0, "T1: el score no baja de 0 (real: %d)" % gm.score)

	# ── T2: roja evitada no es recogida; no hay doble conteo ──
	capt = _nueva_sesion()
	sp._on_gem_missed(_gema_falsa("red", -15))
	check(gm.red_gems_avoided == 1, "T2: red_gems_avoided = 1 (real: %d)" % gm.red_gems_avoided)
	check(gm.gems_collected == 0, "T2: la roja evitada NO suma a gems_collected (real: %d)" % gm.gems_collected)
	check(gm.red_gems_hit == 0, "T2: la roja evitada no es un impacto (real: %d)" % gm.red_gems_hit)
	check(gm.score == 5, "T2: el bonus por esquivar es +5 (real: %d)" % gm.score)

	# ── T3: gema buena perdida: fallo, no recogida, no puntúa ──
	capt = _nueva_sesion()
	sp._on_gem_missed(_gema_falsa("normal", 10))
	check(gm.gems_collected == 0 and gm.score == 0, "T3: una gema buena perdida no cuenta ni puntúa")
	check(gm.get("gems_missed") == 1, "T3: gems_missed = 1 (real: %s)" % str(gm.get("gems_missed")))

	# ── T4: coherencia puntuación / eventos / resultados enviados ──
	capt = _nueva_sesion()
	sp._on_gem_caught(_gema_falsa("normal", 10))   # +10
	sp._on_gem_caught(_gema_falsa("green", 10))    # +10
	sp._on_gem_caught(_gema_falsa("purple", 15))   # +15
	sp._on_gem_caught(_gema_falsa("red", -15))     # -15
	sp._on_gem_missed(_gema_falsa("red", -15))     # +5 evitada
	sp._on_gem_missed(_gema_falsa("golden", 25))   # perdida
	gm.finish_session()
	var r: Dictionary = capt["r"]
	check(capt["n"] == 1, "T4: un único evento session_finished (real: %d)" % capt["n"])
	check(r.get("score", -1) == 25, "T4: score = 10+10+15-15+5 = 25 (real: %s)" % str(r.get("score")))
	check(r.get("gems_collected", -1) == 3, "T4: gems_collected = 3 (real: %s)" % str(r.get("gems_collected")))
	check(r.get("total_movements", -1) == 3, "T4: total_movements = 3 (real: %s)" % str(r.get("total_movements")))
	check(r.get("red_gems_hit", -1) == 1 and r.get("red_gems_avoided", -1) == 1, "T4: 1 roja tocada y 1 evitada")
	check(r.get("gems_missed", -1) == 1, "T4: gems_missed = 1 (real: %s)" % str(r.get("gems_missed")))
	var suma: int = int(r.get("normal_gems", 0)) + int(r.get("green_gems", 0)) + int(r.get("purple_gems", 0)) + int(r.get("golden_gems", 0))
	check(suma == r.get("gems_collected", -1), "T4: normal+green+purple+golden == gems_collected (real: %d)" % suma)
	# accuracy = (3 buenas + 1 evitada) / (3 + 1 tocada + 1 evitada + 1 perdida) = 4/6 = 66
	check(r.get("accuracy", -1) == 66, "T4: accuracy derivada solo de eventos = 66 (real: %s)" % str(r.get("accuracy")))
	check(r.get("sin_datos", true) == false, "T4: sin_datos = false con eventos")
	check(r.has("movement_log") and r["movement_log"].size() == 3, "T4: movement_log solo con las 3 recogidas buenas")

	# ── T5: sesión SIN eventos: no aparenta rendimiento ──
	capt = _nueva_sesion()
	gm.finish_session()
	r = capt["r"]
	check(r.get("sin_datos", false) == true, "T5: sin_datos = true sin eventos (real: %s)" % str(r.get("sin_datos")))
	check(r.get("score", -1) == 0 and r.get("accuracy", -1) == 0, "T5: score 0 y accuracy 0 sin eventos")
	check(r.get("gems_collected", -1) == 0 and r.get("total_movements", -1) == 0, "T5: contadores a 0")
	check(r.has("red_gems_hit") and r.has("avg_time_per_gem") and r.has("movements_summary"), "T5: se conservan las métricas existentes")

	# ── T6: tras finalizar, eventos tardíos no alteran los resultados (ni suman) ──
	capt = _nueva_sesion()
	sp._on_gem_caught(_gema_falsa("normal", 10))
	gm.finish_session()
	var score_final: int = gm.score
	sp._on_gem_caught(_gema_falsa("golden", 25))
	sp._on_gem_caught(_gema_falsa("red", -15))
	sp._on_gem_missed(_gema_falsa("red", -15))
	sp._on_gem_missed(_gema_falsa("normal", 10))
	check(gm.score == score_final and gm.gems_collected == 1 and gm.red_gems_hit == 0 and gm.red_gems_avoided == 0,
		"T6: eventos posteriores a finish_session se ignoran")
	gm.finish_session()
	check(capt["n"] == 1, "T6: finish_session es idempotente (un solo session_finished)")

	# ── T7: gema real (gem.tscn): captura y pérdida emiten UNA sola señal ──
	capt = _nueva_sesion()
	var cuenta := {"c": 0, "m": 0}
	var rojas: Array = []
	for i in 2:
		var g = load(RUTA_GEM).instantiate()
		root.add_child(g)
		g.setup({"type": "red", "points": -15, "name": "¡Evita!", "start": Vector3.ZERO})
		g.gem_caught.connect(func(): cuenta["c"] += 1)
		g.gem_missed.connect(func(): cuenta["m"] += 1)
		rojas.append(g)
	rojas[0]._catch()
	rojas[0]._catch()
	rojas[0].miss()          # ya capturada: no puede además contarse como perdida
	rojas[1].miss()
	rojas[1].miss()
	rojas[1]._catch()        # ya perdida: no puede además contarse como capturada
	check(cuenta["c"] == 1 and cuenta["m"] == 1, "T7: 1 captura y 1 pérdida en total, sin duplicados (c=%d m=%d)" % [cuenta["c"], cuenta["m"]])

	print("RESULTADO: %s (%d fallos)" % ["OK" if fallos == 0 else "FALLA", fallos])
	quit(1 if fallos > 0 else 0)
