extends Node
# ─────────────────────────────────────────────────────────────────────────────
# FirebaseManager — Comunicación con Firestore via REST API
# Lee la configuración de sesión activa y guarda resultados al terminar
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

var _http_load: HTTPRequest
var _http_save: HTTPRequest

func _ready() -> void:
	_http_load = HTTPRequest.new()
	add_child(_http_load)
	_http_load.request_completed.connect(_on_config_received)

	_http_save = HTTPRequest.new()
	add_child(_http_save)
	_http_save.request_completed.connect(_on_results_saved)

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
			"gemsRed":         {"integerValue": str(results.get("red_gems", 0))},
			"totalGems":       {"integerValue": str(results.get("gems_collected", 0))},
			"avgTimePerGem":   {"doubleValue": results.get("avg_time_per_gem", 0.0)},
			"fromVR":          {"booleanValue": true},
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
