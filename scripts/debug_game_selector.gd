extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# DebugGameSelector — selector MANUAL de juegos, SOLO para compilaciones de depuración
# ─────────────────────────────────────────────────────────────────────────────
# Pensado para pruebas locales en Quest 3 sin Firebase ni fisioterapeuta.
# El Hub solo lo crea si OS.is_debug_build() es true; en release no existe.
#
# Mando (Quest 3):  A/X = siguiente juego   |   B/Y = iniciar el juego marcado
# Escritorio:       teclas 1-4 = iniciar ese juego | Tab = siguiente | Enter = iniciar
# No guarda nada ni habla con Firebase: solo emite game_chosen(game_id).
# ─────────────────────────────────────────────────────────────────────────────

signal game_chosen(game_id: String)

const JUEGOS: Array = [
	{"id": "gems", "nombre": "Gemas"},
	{"id": "vault_escape", "nombre": "Vault Escape"},
	{"id": "urban_attention_quest", "nombre": "City (Urban Attention)"},
	{"id": "luggage_handler", "nombre": "Luggage Handler"},
]

var indice := 0
var activo := true
var _label: Label3D = null

func iniciar(controladores: Array) -> void:
	position = Vector3(0.0, 1.5, -2.2)
	_label = Label3D.new()
	_label.pixel_size = 0.0025
	_label.font_size = 40
	_label.outline_size = 10
	_label.modulate = Color(1.0, 0.85, 0.3)
	add_child(_label)
	for c in controladores:
		if c is XRController3D:
			c.button_pressed.connect(_on_button_pressed)
	_refrescar()

func _refrescar() -> void:
	var t := "[DEBUG] SELECTOR DE JUEGO\n"
	for i in JUEGOS.size():
		t += ("> " if i == indice else "   ") + str(i + 1) + ". " + JUEGOS[i]["nombre"] + "\n"
	t += "A/X: siguiente   B/Y: iniciar"
	_label.text = t

func siguiente() -> void:
	indice = (indice + 1) % JUEGOS.size()
	_refrescar()

func elegir(i: int) -> void:
	if not activo or i < 0 or i >= JUEGOS.size():
		return
	indice = i
	activo = false
	_refrescar()
	_label.text = "Cargando " + JUEGOS[i]["nombre"] + "..."
	print("[DebugSelector] Juego elegido: ", JUEGOS[i]["id"])
	game_chosen.emit(JUEGOS[i]["id"])

func _on_button_pressed(nombre: String) -> void:
	if not activo:
		return
	if nombre == "ax_button":
		siguiente()
	elif nombre == "by_button":
		elegir(indice)

func _unhandled_input(event: InputEvent) -> void:
	if not activo or not (event is InputEventKey) or not event.pressed or event.echo:
		return
	match event.keycode:
		KEY_1, KEY_2, KEY_3, KEY_4:
			elegir(event.keycode - KEY_1)
		KEY_TAB:
			siguiente()
		KEY_ENTER, KEY_KP_ENTER:
			elegir(indice)
