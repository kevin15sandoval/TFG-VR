extends Node
# ─────────────────────────────────────────────────────────────────────────────
# FirebaseManager — Comunicación con Firestore via REST API
# Lee la configuración de sesión activa y guarda resultados al terminar
# NUEVO: Sistema de polling para detectar nuevas sesiones automáticamente
# ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID := "tfg-vr"
const BASE_URL := "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents"

# Colecciones Firestore
const COL_SESSION_CONFIG := "sesion_activa"   # Web escribe aquí la config
const COL_RESULTS        := "sesiones"         # Godot escribe aquí los resultados
const DOC_ACTIVE         := "current"          # Documento único de sesión activa

signal config_loaded(config: Dictionary)
signal config_error(msg: String)
signal results_saved()
signal results_error(msg: String)
signal new_session_detected(config: Dictionary)  # Nueva señal para detección automática

var _http_load: HTTPRequest
var _http_save: HTTPRequest
var _http_poll: HTTPRequest

# Sistema de polling
var _polling_enabled := false
var _poll_interval := 3.0  # Revisar cada 3 segundos
var _last_session_id := ""  # Para detectar nuevas sesiones
var _poll_timer := 0.0

func _ready() -> void:
	_http_load = HTTPRequest.new()
	add_child(_http_load)
	_http_load.request_completed.connect(_on_config_received)

	_http_save = HTTPRequest.new()
	add_child(_http_save)
	_http_save.request_completed.connect(_on_results_saved)

	_http_poll = HTTPRequest.new()
	add_child(_http_poll)
	_http_poll.request_completed.connect(_on_poll_response)

func _process(delta: float) -> void:
	if not _polling_enabled:
		return
	
	_poll_timer += delta
	if _poll_timer >= _poll_interval:
		_poll_timer = 0.0
		_poll_for_new_session()

# ─── POLLING AUTOMÁTICO ──────────────────────────────────────────────────────

## Activa el polling para detectar nuevas sesiones automáticamente
func start_polling() -> void:
	print("[Firebase] Iniciando polling cada ", _poll_interval, "s")
	_polling_enabled = true
	_poll_timer = 0.0

## Detiene el polling
func stop_polling() -> void:
	print("[Firebase] Deteniendo polling")
	_polling_enabled = false

func _poll_for_new_session() -> void:
	var url = BASE_URL + "/" + COL_SESSION_CONFIG + "/" + DOC_ACTIVE
	print("[Firebase] 🔍 Polling sesión activa: ", url)
	var err = _http_poll.request(url, [], HTTPClient.METHOD_GET)
	if err != OK:
		print("[Firebase] ❌ Error en polling: ", err)

func _on_poll_response(result: int, code: int, _headers, body: PackedByteArray) -> void:
	print("[Firebase] 📡 Poll response - Result: ", result, " Code: ", code)
	
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		# Sin sesión activa, seguir esperando
		if code != 404:  # Solo loguear si no es "no encontrado"
			print("[Firebase] ⏳ Sin sesión activa aún (código ", code, ")")
		return

	var json = JSON.new()
	var parse_err = json.parse(body.get_string_from_utf8())
	if parse_err != OK:
		return

	var data = json.get_data()
	var fields = data.get("fields", {})
	
	var session_id = _get_string(fields, "sessionId")
	
	# Si es una sesión nueva (diferente a la última que procesamos)
	if session_id != "" and session_id != _last_session_id:
		print("[Firebase] 🎮 Nueva sesión detectada: ", session_id)
		_last_session_id = session_id
		
		var config := {
			"patient_id":    _get_string(fields, "patientId"),
			"patient_name":  _get_string(fields, "patientName"),
			"duration":      _get_int(fields,    "duration",    180),
			"difficulty":    _get_string(fields, "difficulty",  "Media"),
			"therapy_side":  _get_string(fields, "therapySide", "Izquierdo"),
			"session_type":  _get_string(fields, "sessionType", "Alcance"),
			"game_id":       _get_string(fields, "gameId",      "gems"),
			"session_id":    session_id,
		}
		
		emit_signal("new_session_detected", config)

# ─── LEER CONFIG DE SESIÓN ───────────────────────────────────────────────────

func load_session_config() -> void:
	var url = BASE_URL + "/" + COL_SESSION_CONFIG + "/" + DOC_ACTIVE
	var err = _http_load.request(url, [], HTTPClient.METHOD_GET)
	if err != OK:
		emit_signal("config_error", "Error al conectar con Firestore: " + str(err))

func _on_config_received(result: int, code: int, _headers, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		print("[Firebase] No hay sesión activa (código: ", code, ") — usando config por defecto")
		emit_signal("config_error", "Sin sesión activa")
		return

	var json = JSON.new()
	var parse_err = json.parse(body.get_string_from_utf8())
	if parse_err != OK:
		emit_signal("config_error", "Error al parsear respuesta de Firestore")
		return

	var data = json.get_data()
	var fields = data.get("fields", {})

	var config := {
		"patient_id":    _get_string(fields, "patientId"),
		"patient_name":  _get_string(fields, "patientName"),
		"duration":      _get_int(fields,    "duration",    180),
		"difficulty":    _get_string(fields, "difficulty",  "Media"),
		"therapy_side":  _get_string(fields, "therapySide", "Izquierdo"),
		"session_type":  _get_string(fields, "sessionType", "Alcance"),
		"game_id":       _get_string(fields, "gameId",      "gems"),
		"session_id":    _get_string(fields, "sessionId"),
	}

	print("[Firebase] Config cargada: ", config)
	emit_signal("config_loaded", config)

# ─── GUARDAR RESULTADOS ───────────────────────────────────────────────────────

func save_results(results: Dictionary) -> void:
	var url = BASE_URL + "/" + COL_RESULTS
	var headers = ["Content-Type: application/json"]

	# Construir movements_summary como array Firestore
	var movements_array = {"arrayValue": {"values": []}}
	for m in results.get("movements_summary", []):
		movements_array["arrayValue"]["values"].append({
			"mapValue": {"fields": {
				"name":       {"stringValue": str(m.get("name", ""))},
				"completed":  {"integerValue": str(m.get("completed", 0))},
				"avg_time_s": {"doubleValue": float(m.get("avg_time_s", 0.0))},
			}}
		})

	var zones = results.get("zones_worked", {"Alto": 0, "Medio": 0, "Lateral": 0, "Bajo": 0})

	var body := {
		"fields": {
			"patientId":       {"stringValue": str(results.get("patient_id", ""))},
			"patientName":     {"stringValue": str(results.get("patient_name", ""))},
			"sessionId":       {"stringValue": str(results.get("session_id", ""))},
			"gameId":          {"stringValue": "gems"},
			"game":            {"stringValue": "Recolectar gemas"},
			"date":            {"stringValue": str(results.get("date", ""))},
			"duration":        {"integerValue": str(results.get("duration", 0))},
			"score":           {"integerValue": str(results.get("score", 0))},
			"accuracy":        {"integerValue": str(results.get("accuracy", 0))},
			"side":            {"stringValue": str(results.get("therapy_side", ""))},
			"difficulty":      {"stringValue": str(results.get("difficulty", ""))},
			"sessionType":     {"stringValue": str(results.get("session_type", ""))},
			"gemsNormal":      {"integerValue": str(results.get("normal_gems", 0))},
			"gemsGolden":      {"integerValue": str(results.get("golden_gems", 0))},
			"gemsGreen":       {"integerValue": str(results.get("green_gems", 0))},
			"gemsPurple":      {"integerValue": str(results.get("purple_gems", 0))},
			"gemsRed":         {"integerValue": str(results.get("red_gems_hit", 0))},
			"gemsRedAvoided":  {"integerValue": str(results.get("red_gems_avoided", 0))},
			"totalGems":       {"integerValue": str(results.get("gems_collected", 0))},
			"avgTimePerGem":   {"doubleValue": results.get("avg_time_per_gem", 0.0)},
			"totalMovements":  {"integerValue": str(results.get("total_movements", 0))},
			"movementsSummary": movements_array,
			"zonesWorked": {"mapValue": {"fields": {
				"Alto":    {"integerValue": str(zones.get("Alto", 0))},
				"Medio":   {"integerValue": str(zones.get("Medio", 0))},
				"Lateral": {"integerValue": str(zones.get("Lateral", 0))},
				"Bajo":    {"integerValue": str(zones.get("Bajo", 0))},
			}}},
			"fromVR":          {"booleanValue": true},
			"notes":           {"stringValue": ""},
		}
	}

	var json_body = JSON.stringify(body)
	var err = _http_save.request(url, headers, HTTPClient.METHOD_POST, json_body)
	if err != OK:
		emit_signal("results_error", "Error al guardar resultados: " + str(err))

func _on_results_saved(result: int, code: int, _headers, _body: PackedByteArray) -> void:
	if result == HTTPRequest.RESULT_SUCCESS and (code == 200 or code == 201):
		print("[Firebase] Resultados guardados correctamente")
		emit_signal("results_saved")
	else:
		print("[Firebase] Error al guardar resultados, código: ", code)
		emit_signal("results_error", "Error HTTP " + str(code))

# ─── HELPERS ─────────────────────────────────────────────────────────────────

func _get_string(fields: Dictionary, key: String, default_val: String = "") -> String:
	if fields.has(key):
		var f = fields[key]
		if f.has("stringValue"):   return f["stringValue"]
		if f.has("integerValue"):  return str(f["integerValue"])
	return default_val

func _get_int(fields: Dictionary, key: String, default_val: int = 0) -> int:
	if fields.has(key):
		var f = fields[key]
		if f.has("integerValue"):  return int(f["integerValue"])
		if f.has("doubleValue"):   return int(f["doubleValue"])
		if f.has("stringValue"):   return int(f["stringValue"])
	return default_val
