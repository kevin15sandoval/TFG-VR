extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VRStart — Orquestador principal
# Flujo: OpenXR → Pantalla de código → Vincular → Recibir config → Jugar → Guardar
# ─────────────────────────────────────────────────────────────────────────────

# ── Nodos de UI (asignar en el editor) ────────────────────────────────────────
@onready var label_status:    Label    = $UI/LabelStatus    if has_node("UI/LabelStatus")    else null
@onready var label_code:      Label    = $UI/LabelCode      if has_node("UI/LabelCode")      else null
@onready var label_patient:   Label    = $UI/LabelPatient   if has_node("UI/LabelPatient")   else null
@onready var label_timer:     Label    = $UI/LabelTimer     if has_node("UI/LabelTimer")     else null
@onready var label_score:     Label    = $UI/LabelScore     if has_node("UI/LabelScore")     else null
@onready var input_code:      LineEdit = $UI/InputCode      if has_node("UI/InputCode")      else null
@onready var btn_link:        Button   = $UI/BtnLink        if has_node("UI/BtnLink")        else null

var device_link: Node = null
var firebase:    Node = null

func _ready() -> void:
	print("=== NeuroVR Rehab — Iniciando ===")
	await get_tree().process_frame
	_init_openxr()

	# Instanciar DeviceLink dinámicamente
	var script = load("res://scripts/device_link.gd")
	device_link = Node.new()
	device_link.set_script(script)
	add_child(device_link)
	device_link.device_linked.connect(_on_device_linked)
	device_link.session_received.connect(_on_session_received)
	device_link.link_error.connect(_on_link_error)

	# Instanciar FirebaseManager para guardar resultados
	var fb_script = load("res://scripts/firebase_manager.gd")
	firebase = Node.new()
	firebase.set_script(fb_script)
	add_child(firebase)
	firebase.results_saved.connect(func(): _set_status("✅ Resultados guardados"))
	firebase.results_error.connect(func(e): _set_status("❌ Error: " + e))

	# Conectar señales del GameManager
	GameManager.session_started.connect(_on_session_started)
	GameManager.gem_collected.connect(_on_gem_collected)
	GameManager.timer_updated.connect(_on_timer_updated)
	GameManager.session_finished.connect(_on_session_finished)

	# Si hay InputCode y BtnLink en la escena, conectarlos
	if btn_link:
		btn_link.pressed.connect(_on_btn_link_pressed)

	_set_status("Introduce el código que aparece en la pantalla del fisioterapeuta")
	_set_code_display("----")

func _init_openxr() -> void:
	var xr = XRServer.find_interface("OpenXR")
	if xr == null: return
	if not xr.is_initialized(): xr.initialize()
	if xr.is_initialized():
		get_viewport().use_xr = true
		print("[VRStart] ✅ OpenXR activo")

# ─── VINCULACIÓN ─────────────────────────────────────────────────────────────

func _on_btn_link_pressed() -> void:
	var code = ""
	if input_code:
		code = input_code.text.strip_edges()
	if code.length() == 4:
		_set_status("Vinculando con código " + code + "...")
		device_link.link_with_code(code)
	else:
		_set_status("⚠️ El código debe tener 4 caracteres")

# Llamar directamente si se obtiene el código por otro medio (voz, QR, etc.)
func link_with_code(code: String) -> void:
	device_link.link_with_code(code)

func _on_device_linked() -> void:
	_set_status("✅ Gafas vinculadas — esperando sesión del fisioterapeuta...")
	_set_code_display("OK")

func _on_link_error(msg: String) -> void:
	_set_status("❌ " + msg)

# ─── SESIÓN RECIBIDA ─────────────────────────────────────────────────────────

func _on_session_received(config: Dictionary) -> void:
	_set_status("📥 Sesión recibida — preparando juego...")
	GameManager.apply_config(config)
	if label_patient:
		label_patient.text = config.get("patient_name", "Paciente")
	await get_tree().create_timer(1.5).timeout
	GameManager.start_session()

# ─── DURANTE LA SESIÓN ───────────────────────────────────────────────────────

func _on_session_started() -> void:
	_set_status("▶ Sesión activa — " + GameManager.difficulty + " | " + GameManager.therapy_side)

func _on_gem_collected(gem_type: String, points: int, total_score: int) -> void:
	if label_score:
		label_score.text = "Puntos: " + str(total_score)
	print("[VR] Gema: ", gem_type, " +", points)

func _on_timer_updated(remaining: float) -> void:
	if label_timer:
		var mins = int(remaining) / 60
		var secs = int(remaining) % 60
		label_timer.text = "%02d:%02d" % [mins, secs]

# ─── FIN DE SESIÓN ───────────────────────────────────────────────────────────

func _on_session_finished(results: Dictionary) -> void:
	_set_status("🏁 Sesión terminada — guardando resultados...")
	if label_score:
		label_score.text = "Puntuación final: " + str(results.get("score", 0))
	firebase.save_results(results)

# ─── HELPERS UI ──────────────────────────────────────────────────────────────

func _set_status(msg: String) -> void:
	print("[VRStart] ", msg)
	if label_status: label_status.text = msg

func _set_code_display(code: String) -> void:
	if label_code: label_code.text = code
