extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de regresión G1 (fix/007): los impactos y esquives de láser de Vault se registran.
#
# Fallo original: LaserSpawner._on_laser_hit usaba laser.has("laser_type") (Node no tiene
# has()), el handler abortaba y nunca llamaba a VaultGameManager.register_laser_hit().
# Además VaultGameManager daba motor_control_score=100 con 0 eventos y la UI "¡EXCELENTE!"
# podía aparecer sin datos reales.
#
# - Usa el LaserSpawner real y laser_beam.tscn real (los impactos se emiten con la señal
#   real player_hit; el esquive, también por la vía real: _process al sobrepasar Z=7).
# - Datos SINTÉTICOS (TEST-G1-P / TEST-G1-S). Sin red, sin Firebase.
# - Ejecutar en copia aislada con openxr/enabled=false (solo en la copia), con timeout:
#     godot --headless --path <copia> --script res://tests/regresion/test_g1_vault_impactos_laser.gd
# - Código de salida 0 = todo correcto; 1 = alguna comprobación falla.
# ─────────────────────────────────────────────────────────────────────────────

const ID_P := "TEST-G1-P"
const ID_S := "TEST-G1-S"
const RUTA_VAULT := "res://scenes/vault_game_manager.gd"
const RUTA_SPAWNER := "res://scenes/laser_spawner.gd"
const RUTA_LASER := "res://scenes/laser_beam.tscn"
const RUTA_START := "res://vault_vr_start.gd"

var fallos := 0

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

# Escena mínima: raíz con VaultGameManager + LaserSpawner reales.
func _montar(gm) -> Dictionary:
	gm.apply_config({"patient_id": ID_P, "patient_name": "Sintetico", "session_id": ID_S,
		"duration": 60, "difficulty": "Media", "therapy_side": "Ambos", "game_id": "vault"})
	gm.game_finished = false
	gm.session_active = true  # el spawner solo genera láseres con sesión activa
	var raiz := Node3D.new()
	var vault := Node.new()
	vault.name = "VaultGameManager"
	vault.set_script(load(RUTA_VAULT))
	raiz.add_child(vault)
	var spawner := Node3D.new()
	spawner.name = "LaserSpawner"
	spawner.set_script(load(RUTA_SPAWNER))
	spawner.laser_scene = load(RUTA_LASER)
	raiz.add_child(spawner)
	root.add_child(raiz)
	vault.start_game()
	var cap := {"res": null, "n": 0}
	vault.game_finished.connect(func(r):
		cap["res"] = r
		cap["n"] += 1)
	return {"raiz": raiz, "vault": vault, "spawner": spawner, "cap": cap}

# Genera un láser con el flujo real del spawner y lo devuelve.
func _laser(spawner) -> Node:
	spawner._build_sequence()
	spawner._queue_index = 0
	spawner._spawn_next()
	spawner._spawn_timer.stop()
	return spawner._active_lasers[spawner._active_lasers.size() - 1]

func _limpiar(m: Dictionary) -> void:
	m["raiz"].queue_free()
	await process_frame

func _run() -> void:
	await process_frame
	var gm = root.get_node("GameManager")

	# ── T1: un impacto real pasa por el handler del spawner y llega al VaultGameManager ──
	var m := _montar(gm)
	var l1 := _laser(m["spawner"])
	l1.player_hit.emit()
	check(m["vault"].laser_hits == 1, "T1: un impacto queda registrado (hits=%d)" % m["vault"].laser_hits)
	check(m["vault"].score == 0, "T1: el score no baja de 0 por un impacto sin puntos previos (score=%d)" % m["vault"].score)
	check(not m["spawner"]._active_lasers.has(l1), "T1: el láser impactado sale de los activos")
	await _limpiar(m)

	# ── T2: esquive real (el láser sobrepasa al jugador en _process) ──
	m = _montar(gm)
	var l2 := _laser(m["spawner"])
	l2.global_position = Vector3(0, 0, 7.5)
	await process_frame
	await process_frame
	check(m["vault"].lasers_dodged == 1, "T2: un esquive queda registrado (dodged=%d)" % m["vault"].lasers_dodged)
	check(m["vault"].score == 10, "T2: el esquive suma 10 puntos (score=%d)" % m["vault"].score)
	check(m["vault"].laser_hits == 0, "T2: el esquive no cuenta como impacto")
	await _limpiar(m)

	# ── T3: impactos múltiples + esquives ──
	m = _montar(gm)
	for i in 2:
		var ld := _laser(m["spawner"])
		ld.laser_dodged.emit()
	for i in 3:
		var lh := _laser(m["spawner"])
		lh.player_hit.emit()
	var v = m["vault"]
	check(v.lasers_dodged == 2 and v.laser_hits == 3, "T3: 2 esquives y 3 impactos (real: %d/%d)" % [v.lasers_dodged, v.laser_hits])
	check(v.score == 0, "T3: el score nunca es negativo (score=%d)" % v.score)

	# ── T4: finalización con eventos reales: resultados y mensaje final ──
	v.end_game()
	var r = m["cap"]["res"]
	check(m["cap"]["n"] == 1 and r != null, "T4: game_finished se emite una vez")
	if r != null:
		check(r["laser_hits"] == 3 and r["lasers_dodged"] == 2, "T4: resultados con los eventos reales")
		check(is_equal_approx(r["dodge_rate_percentage"], 40.0), "T4: dodge_rate = 2/5 = 40%% (real: %s)" % str(r["dodge_rate_percentage"]))
		check(r["motor_control_score"] == 55, "T4: motor_control = 100-3*15 = 55 (real: %s)" % str(r["motor_control_score"]))
		check(r["total_movements"] == 5 and r.get("sin_datos", false) == false, "T4: 5 eventos y sin_datos=false")
		check(r["patient_id"] == ID_P and r["session_id"] == ID_S, "T4: los resultados conservan la identidad")
		var msg = _mensaje(r)
		check(msg != null and "EXCELENTE" not in msg["text"], "T4: 40% de esquives no muestra EXCELENTE")
	await _limpiar(m)

	# ── T5: caso cero eventos: ni EXCELENTE ni puntuaciones que aparenten buen rendimiento ──
	m = _montar(gm)
	m["vault"].end_game()
	r = m["cap"]["res"]
	check(r != null, "T5: game_finished emitido sin eventos")
	if r != null:
		check(r["laser_hits"] == 0 and r["lasers_dodged"] == 0, "T5: cero eventos registrados")
		check(r.get("sin_datos", false) == true, "T5: resultados marcados sin_datos=true")
		check(r["motor_control_score"] == 0, "T5: motor_control_score no aparenta 100 sin datos (real: %s)" % str(r["motor_control_score"]))
		check(r["reaction_time_score"] == 0, "T5: reaction_time_score = 0 sin datos")
		check(r["dodge_rate_percentage"] == 0.0 and r["flexibility_score"] == 0, "T5: tasas a 0 sin datos")
		var msg0 = _mensaje(r)
		check(msg0 != null and "EXCELENTE" not in msg0["text"] and "BIEN" not in msg0["text"], "T5: mensaje final neutro, no EXCELENTE/BIEN HECHO")
	await _limpiar(m)

	# ── T6: mensaje final con esquives reales ──
	var excelente = _mensaje({"lasers_dodged": 9, "laser_hits": 1, "dodge_rate_percentage": 90.0})
	check(excelente != null and "EXCELENTE" in excelente["text"], "T6: 9 esquives y 1 impacto sí es EXCELENTE")
	var ceroexc = _mensaje({"lasers_dodged": 0, "laser_hits": 0, "dodge_rate_percentage": 100.0})
	check(ceroexc != null and "EXCELENTE" not in ceroexc["text"], "T6: 0 eventos no es EXCELENTE aunque la tasa llegue alterada")

	print("RESULTADO: %s (%d fallos)" % ["OK" if fallos == 0 else "FALLA", fallos])
	quit(1 if fallos > 0 else 0)

# Devuelve null si el script no expone mensaje_final (código original).
func _mensaje(r: Dictionary):
	var s: Script = load(RUTA_START)
	for md in s.get_script_method_list():
		if md["name"] == "mensaje_final":
			return s.mensaje_final(r)
	return null
