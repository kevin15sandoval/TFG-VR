extends Node
# ─────────────────────────────────────────────────────────────────────────────
# DeviceLink — Vinculación de las gafas con la plataforma clínica
# Muestra pantalla de código, espera confirmación y recibe la config de sesión
# ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID := "tfg-vr"
const BASE_URL   := "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents"
const COL_DEVICES := "dispositivos"
const COL_SESSION := "sesion_activa"

signal device_linked()
signal session_received(config: Dictionary)
signal link_error(msg: String)

var _device_id: String = ""
var _current_code: String = ""
var _poll_timer: Timer
var _http_link: HTTPRequest
var _http_poll: HTTPRequest
var _http_session: HTTPRequest

func _ready() -> void:
	_device_id = OS.get_unique_id()

	_http_link = HTTPRequest.new(); add_child(_http_link)
	_http_link.request_completed.connect(_on_link_done)

	_http_poll = HTTPRequest.new(); add_child(_http_poll)
	_http_poll.request_completed.connect(_on_poll_done)

	_http_session = HTTPRequest.new(); add_child(_http_session)
	_http_session.request_completed.connect(_on_session_done)

	_poll_timer = Timer.new()
	_poll_timer.wait_time = 2.0
	_poll_timer.timeout.connect(_poll_device_status)
	add_child(_poll_timer)

# ─── PASO 1: El fisio muestra un código en la web ─────────────────────────────
# Las gafas llaman a esta función con ese código

func link_with_code(code: String) -> void:
	_current_code = code.to_upper().strip_edges()
	if _current_code.length() != 4:
		emit_signal("link_error", "El código debe tener 4 caracteres")
		return

	print("[DeviceLink] Vinculando con código: ", _current_code)
	var url = BASE_URL + "/" + COL_DEVICES + "/" + _current_code
	var body = JSON.stringify({
		"fields": {
			"status":   {"stringValue": "linked"},
			"deviceId": {"stringValue": _device_id},
			"linkedAt": {"stringValue": Time.get_datetime_string_from_system()},
		}
	})
	var headers = ["Content-Type: application/json", "X-HTTP-Method-Override: PATCH"]
	_http_link.request(url, headers, HTTPClient.METHOD_PATCH, body)

func _on_link_done(result: int, code: int, _h, _b: PackedByteArray) -> void:
	if result == HTTPRequest.RESULT_SUCCESS and code in [200, 201]:
		print("[DeviceLink] ✅ Vinculado. Esperando sesión...")
		emit_signal("device_linked")
		_poll_timer.start()
	else:
		print("[DeviceLink] ❌ Error de vinculación (HTTP ", code, ")")
		emit_signal("link_error", "Código incorrecto o expirado")

# ─── PASO 2: Polling — esperar a que el fisio envíe la sesión ─────────────────

func _poll_device_status() -> void:
	var url = BASE_URL + "/" + COL_DEVICES + "/" + _current_code
	_http_poll.request(url, [], HTTPClient.METHOD_GET)

func _on_poll_done(result: int, code: int, _h, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		return
	var json = JSON.new()
	if json.parse(body.get_string_from_utf8()) != OK:
		return
	var fields = json.get_data().get("fields", {})
	var status = _str(fields, "status")
	if status == "session_ready":
		print("[DeviceLink] 📥 Sesión lista. Cargando config...")
		_poll_timer.stop()
		_load_session_config()

func _load_session_config() -> void:
	var url = BASE_URL + "/" + COL_SESSION + "/current"
	_http_session.request(url, [], HTTPClient.METHOD_GET)

func _on_session_done(result: int, code: int, _h, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		emit_signal("link_error", "No se pudo cargar la sesión")
		return
	var json = JSON.new()
	if json.parse(body.get_string_from_utf8()) != OK:
		return
	var fields = json.get_data().get("fields", {})
	var config := {
		"patient_id":   _str(fields, "patientId"),
		"patient_name": _str(fields, "patientName"),
		"session_id":   _str(fields, "sessionId"),
		"duration":     _int(fields, "duration", 180),
		"difficulty":   _str(fields, "difficulty", "Media"),
		"therapy_side": _str(fields, "therapySide", "Izquierdo"),
		"session_type": _str(fields, "sessionType", "Alcance"),
		"game_id":      _str(fields, "gameId", "gems"),
	}
	print("[DeviceLink] ✅ Config recibida: ", config)
	emit_signal("session_received", config)

func stop_polling() -> void:
	_poll_timer.stop()

# ─── Helpers ──────────────────────────────────────────────────────────────────

func _str(f: Dictionary, k: String, d: String = "") -> String:
	return f[k]["stringValue"] if f.has(k) and f[k].has("stringValue") else d

func _int(f: Dictionary, k: String, d: int = 0) -> int:
	if f.has(k):
		if f[k].has("integerValue"): return int(f[k]["integerValue"])
		if f[k].has("doubleValue"):  return int(f[k]["doubleValue"])
	return d
