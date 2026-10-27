extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de regresión: selector manual de juegos (solo depuración) y vuelta al Hub.
# - Datos SINTÉTICOS, sin red. No cambia de escena (no carga ningún juego).
# - No usar con OpenXR activado. Ejecutar en una copia aislada con openxr/enabled=false:
#     godot --headless --path <copia> --script res://tests/regresion/test_selector_debug.gd
# - Código de salida 0 = todo correcto; 1 = alguna comprobación falla.
# ─────────────────────────────────────────────────────────────────────────────

var fallos := 0
var elegido := ""

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

func _run() -> void:
	await process_frame
	var hub_script = load("res://hub_manager.gd")
	var ids: Array = []
	var selector_script = load("res://scripts/debug_game_selector.gd")
	for j in selector_script.JUEGOS:
		ids.append(j["id"])
	var esperados: Array = hub_script.GAME_SCENES.keys()
	ids.sort()
	esperados.sort()
	check(ids == esperados, "el selector ofrece exactamente los ids de GAME_SCENES")
	for ruta in hub_script.GAME_SCENES.values():
		check(ResourceLoader.exists(ruta), "existe la escena " + ruta)

	var sel = selector_script.new()
	root.add_child(sel)
	sel.iniciar([])
	sel.game_chosen.connect(func(id): elegido = id)
	sel.siguiente()
	check(sel.indice == 1, "A/X avanza al siguiente juego")
	sel._on_button_pressed("by_button")
	check(elegido == "vault_escape", "B/Y inicia el juego marcado (vault_escape)")
	elegido = ""
	sel._on_button_pressed("by_button")
	check(elegido == "", "tras elegir no se puede elegir de nuevo")

	var hub = (load("res://HubWorld.tscn") as PackedScene).instantiate()
	root.add_child(hub)
	for i in 5:
		await process_frame
	var debug := OS.is_debug_build()
	print("is_debug_build = ", debug)
	if debug:
		check(hub.debug_selector != null, "el Hub crea el selector en depuración")
		check(root.get_node_or_null("DebugReturnToHub") != null, "el Hub crea DebugReturnToHub en la raíz")
	else:
		check(hub.debug_selector == null, "el Hub NO crea el selector fuera de depuración")
	var cfg: Dictionary = hub._config_prueba_local("luggage_handler")
	check(cfg["patient_id"] == "test" and cfg["patient_name"] == "Prueba Local", "config de prueba sintética")
	check(str(cfg["session_id"]).begins_with("offline_") and cfg["game_id"] == "luggage_handler", "session_id offline_* y game_id correcto")

	var ret = root.get_node_or_null("DebugReturnToHub")
	if ret != null:
		check(ret.has_method("volver_al_hub"), "DebugReturnToHub expone volver_al_hub")
	print("RESULTADO: ", "OK" if fallos == 0 else "FALLOS=" + str(fallos))
	quit(0 if fallos == 0 else 1)
