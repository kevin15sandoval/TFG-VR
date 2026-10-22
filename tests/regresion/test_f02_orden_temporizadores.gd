extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de caracterización F02 (Issue #19): ¿termina GameManager antes que City?
# Y T1 para City: los resultados deben conservar la identidad pese a ello.
#
# City cuenta su duración DESPUÉS de una fase de reconocimiento (recognition_time = 15 s),
# mientras que el temporizador de GameManager corre desde start_session(). Esta prueba
# mide ambos instantes con la configuración real (sin tocar tiempos) y duración 4 s:
#   GameManager termina hacia t≈4 s; City hacia t≈15+4 s.
# Es una prueba que DOCUMENTA el comportamiento actual (fuente de verdad de la duración
# aún sin decidir): si en el futuro se unifican los temporizadores, este test debe revisarse.
#
# - Datos SINTÉTICOS. Sin red ni escenas: solo city_game_manager.gd (sin targets).
# - Duración aproximada: 25 s. Ejecutar en copia aislada con openxr/enabled=false y timeout:
#     godot --headless --path <copia> --script res://tests/regresion/test_f02_orden_temporizadores.gd
# ─────────────────────────────────────────────────────────────────────────────

const ID_P := "TEST-F02-P"
const ID_S := "TEST-F02-S"
const RUTA_CITY := "res://scenes/city_game_manager.gd"

var fallos := 0

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

func _run() -> void:
	await process_frame
	var gm = root.get_node("GameManager")
	var mgr := Node.new()
	mgr.name = "CityManagerPrueba"
	mgr.set_script(load(RUTA_CITY))
	root.add_child(mgr)

	var t := {"gm": -1.0, "city": -1.0, "pid": "?", "sid": "?", "n": 0}
	var inicio := Time.get_ticks_msec() / 1000.0
	gm.session_finished.connect(func(_r): t["gm"] = Time.get_ticks_msec() / 1000.0 - inicio)
	mgr.game_finished.connect(func(r):
		t["n"] += 1
		t["city"] = Time.get_ticks_msec() / 1000.0 - inicio
		t["pid"] = str(r.get("patient_id", "<sin campo>"))
		t["sid"] = str(r.get("session_id", "<sin campo>")))

	gm.apply_config({"patient_id": ID_P, "patient_name": "Sintetico", "session_id": ID_S,
		"duration": 4, "difficulty": "Media", "therapy_side": "Ambos", "game_id": "urban_attention_quest"})
	gm.start_session()

	var espera := 0.0
	while t["city"] < 0.0 and espera < 35.0:
		await create_timer(0.5).timeout
		espera += 0.5

	print("MEDIDA: GameManager terminó a los %.1f s | City terminó a los %.1f s | City - GameManager = %.1f s" % [t["gm"], t["city"], t["city"] - t["gm"]])
	check(t["gm"] >= 0.0 and t["city"] >= 0.0, "ambos terminan dentro del tiempo de espera")
	check(t["n"] == 1, "City emite un único game_finished (real: %d)" % t["n"])
	check(t["city"] - t["gm"] >= 10.0, "GameManager termina antes que City (diferencia >= 10 s; recognition_time = 15 s)")
	check(t["pid"] == ID_P, "T1 city: los resultados conservan patient_id")
	check(t["sid"] == ID_S, "T1 city: los resultados conservan session_id")

	print("RESULTADO: %s (%d fallos)" % ["OK" if fallos == 0 else "FALLA", fallos])
	quit(1 if fallos > 0 else 0)
