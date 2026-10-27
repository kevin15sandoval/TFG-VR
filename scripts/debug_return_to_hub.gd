extends Node
# ─────────────────────────────────────────────────────────────────────────────
# DebugReturnToHub — vuelta manual al Hub desde cualquier juego (SOLO depuración)
# ─────────────────────────────────────────────────────────────────────────────
# Lo crea el Hub (solo si OS.is_debug_build()) y se cuelga de la raíz del árbol para
# sobrevivir al cambio de escena sin tocar las escenas de los juegos.
# Gesto en Quest 3: botón MENÚ del mando izquierdo, o X + Y del mando izquierdo a la vez.
# Escritorio: tecla Escape.
# No guarda resultados ni toca Firebase: solo cambia a res://HubWorld.tscn.
# ─────────────────────────────────────────────────────────────────────────────

const ModoLocalScript = preload("res://scripts/modo_local.gd")
const HUB_SCENE := "res://HubWorld.tscn"
const TRACKERS := [&"left_hand"]

var _x := false
var _y := false
var _conectados: Array = []

func _ready() -> void:
	name = "DebugReturnToHub"
	XRServer.tracker_added.connect(_on_tracker_added)
	for t in TRACKERS:
		_conectar(XRServer.get_tracker(t))

func _on_tracker_added(nombre: StringName, _tipo: int) -> void:
	if nombre in TRACKERS:
		_conectar(XRServer.get_tracker(nombre))

func _conectar(tracker) -> void:
	if tracker == null or tracker in _conectados:
		return
	_conectados.append(tracker)
	tracker.button_pressed.connect(_on_button_pressed)
	tracker.button_released.connect(_on_button_released)

func _on_button_pressed(nombre: String) -> void:
	match nombre:
		"menu_button":
			volver_al_hub()
		"ax_button":
			_x = true
		"by_button":
			_y = true
	if _x and _y:
		volver_al_hub()

func _on_button_released(nombre: String) -> void:
	if nombre == "ax_button":
		_x = false
	elif nombre == "by_button":
		_y = false

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		volver_al_hub()

func volver_al_hub() -> void:
	var actual := get_tree().current_scene
	if actual != null and actual.scene_file_path == HUB_SCENE:
		return
	print("[DebugReturn] Volviendo al Hub por gesto manual")
	_x = false
	_y = false
	# Sesión abortada a mano: no se envía nada a Firebase. Se deja un registro local parcial.
	if GameManager:
		if ModoLocalScript.esta_activo() and GameManager.session_id != "":
			ModoLocalScript.guardar_resultados({
				"session_id": GameManager.session_id,
				"patient_id": GameManager.patient_id,
				"game_type": GameManager.game_type,
				"difficulty": GameManager.difficulty,
				"score": GameManager.score,
				"gems_collected": GameManager.gems_collected,
				"duration": int(GameManager.get_elapsed_time()),
				"nota": "abortada por gesto; solo contadores de GameManager, sin datos propios de Vault/City/Luggage",
			}, "abortada")
		GameManager.session_active = false
		GameManager.release_session()
	get_tree().change_scene_to_file(HUB_SCENE)
