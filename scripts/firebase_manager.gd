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
		print("[Firebase] ⏱️ Tiempo de polling alcanzado (", _poll_interval, "s) - ejecutando poll...")
		_poll_for_new_session()

# ─── POLLING AUTOMÁTICO ──────────────────────────────────────────────────────

## Activa el polling para detectar nuevas sesiones automáticamente
func start_polling() -> void:
	print("═══════════════════════════════════════════════════════════════")
	print("═══ 🔄 INICIANDO POLLING AUTOMÁTICO ═══")
	print("═══════════════════════════════════════════════════════════════")
	print("[Firebase] Intervalo: ", _poll_interval, "s")
	print("[Firebase] URL: ", BASE_URL + "/" + COL_SESSION_CONFIG + "/" + DOC_ACTIVE)
	_polling_enabled = true
	_poll_timer = 0.0
	print("[Firebase] ✅ Polling habilitado")
	print("═══════════════════════════════════════════════════════════════")

## Detiene el polling
func stop_polling() -> void:
	print("[Firebase] ⏸️ Deteniendo polling")
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

	print("[Firebase] ✅ Respuesta exitosa del servidor")
	var body_str = body.get_string_from_utf8()
	print("[Firebase] 📄 Body recibido (primeros 200 chars): ", body_str.substr(0, 200))
	
	var json = JSON.new()
	var parse_err = json.parse(body_str)
	if parse_err != OK:
		print("[Firebase] ❌ Error parseando JSON: ", parse_err)
		return

	var data = json.get_data()
	if not data.has("fields"):
		print("[Firebase] ⚠️ Respuesta sin campo 'fields'")
		return
		
	var fields = data.get("fields", {})
	print("[Firebase] 📋 Campos disponibles: ", fields.keys())
	
	var session_id = _get_string(fields, "sessionId")
	print("[Firebase] 🔍 Session ID extraído: '", session_id, "'")
	print("[Firebase] 🔍 Último session ID: '", _last_session_id, "'")
	
	# Si es una sesión nueva (diferente a la última que procesamos)
	if session_id != "" and session_id != _last_session_id:
		print("═══════════════════════════════════════════════════════════════")
		print("═══ 🎮 NUEVA SESIÓN DETECTADA EN FIRESTORE ═══")
		print("═══════════════════════════════════════════════════════════════")
		print("[Firebase] Session ID: ", session_id)
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
		
		print("[Firebase] 📋 Config construida:")
		for key in config.keys():
			print("  - ", key, ": ", config[key])
		print("[Firebase] 📢 Emitiendo señal 'new_session_detected'...")
		emit_signal("new_session_detected", config)
		print("[Firebase] ✅ Señal emitida")
		print("═══════════════════════════════════════════════════════════════")
	else:
		if session_id == "":
			print("[Firebase] ⚠️ Session ID vacío, ignorando")
		else:
			print("[Firebase] ℹ️ Sesión ya procesada, ignorando")

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
	
	var game_type = results.get("game_type", "gems")
	var game_name = results.get("game_name", "Recolectar gemas")
	
	print("[Firebase] 💾 Guardando resultados:")
	print("  - Juego: ", game_name, " (", game_type, ")")
	print("  - Paciente: ", results.get("patient_name", ""))
	print("  - Score: ", results.get("score", 0))
	print("  - Precisión/Completion: ", results.get("accuracy", results.get("completion_percentage", 0)), "%")
	print("  - Duración: ", results.get("duration", results.get("time_elapsed", 0)), "s")
	print("  - Lado: ", results.get("therapy_side", results.get("side", "")))
	print("  - Dificultad: ", results.get("difficulty", ""))

	# Construir body básico (común para todos los juegos)
	var body = {
		"fields": {
			"patientId":       {"stringValue": str(results.get("patient_id", ""))},
			"patientName":     {"stringValue": str(results.get("patient_name", ""))},
			"sessionId":       {"stringValue": str(results.get("session_id", ""))},
			"gameId":          {"stringValue": str(game_type)},
			"game":            {"stringValue": str(game_name)},
			"date":            {"stringValue": str(results.get("date", Time.get_date_string_from_system()))},
			"duration":        {"integerValue": str(int(results.get("duration", results.get("time_elapsed", 0))))},
			"score":           {"integerValue": str(results.get("score", 0))},
			"side":            {"stringValue": str(results.get("therapy_side", results.get("side", "")))},
			"difficulty":      {"stringValue": str(results.get("difficulty", ""))},
			"sessionType":     {"stringValue": str(results.get("session_type", ""))},
			"fromVR":          {"booleanValue": true},
			"notes":           {"stringValue": ""},
		}
	}
	
	# Añadir campos específicos según el tipo de juego
	match game_type:
		"gems":
			_add_gems_fields(body["fields"], results)
		"vault_escape":
			_add_vault_fields(body["fields"], results)
		"urban_attention_quest":
			_add_city_fields(body["fields"], results)
		"luggage_handler":
			_add_luggage_fields(body["fields"], results)
	
	var json_body = JSON.stringify(body)
	var err = _http_save.request(url, headers, HTTPClient.METHOD_POST, json_body)
	if err != OK:
		emit_signal("results_error", "Error al guardar resultados: " + str(err))

func _add_gems_fields(fields: Dictionary, results: Dictionary) -> void:
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

	fields["accuracy"] = {"integerValue": str(results.get("accuracy", 0))}
	fields["gemsNormal"] = {"integerValue": str(results.get("normal_gems", 0))}
	fields["gemsGolden"] = {"integerValue": str(results.get("golden_gems", 0))}
	fields["gemsGreen"] = {"integerValue": str(results.get("green_gems", 0))}
	fields["gemsPurple"] = {"integerValue": str(results.get("purple_gems", 0))}
	fields["gemsRed"] = {"integerValue": str(results.get("red_gems_hit", 0))}
	fields["gemsRedAvoided"] = {"integerValue": str(results.get("red_gems_avoided", 0))}
	fields["totalGems"] = {"integerValue": str(results.get("gems_collected", 0))}
	fields["avgTimePerGem"] = {"doubleValue": results.get("avg_time_per_gem", 0.0)}
	fields["totalMovements"] = {"integerValue": str(results.get("total_movements", 0))}
	fields["movementsSummary"] = movements_array
	fields["zonesWorked"] = {"mapValue": {"fields": {
		"Alto":    {"integerValue": str(zones.get("Alto", 0))},
		"Medio":   {"integerValue": str(zones.get("Medio", 0))},
		"Lateral": {"integerValue": str(zones.get("Lateral", 0))},
		"Bajo":    {"integerValue": str(zones.get("Bajo", 0))},
	}}}

func _add_vault_fields(fields: Dictionary, results: Dictionary) -> void:
	fields["completion_percentage"] = {"doubleValue": results.get("completion_percentage", 0.0)}
	fields["panels_collected"] = {"integerValue": str(results.get("panels_collected", 0))}
	fields["total_panels"] = {"integerValue": str(results.get("total_panels", 0))}
	fields["laser_hits"] = {"integerValue": str(results.get("laser_hits", 0))}
	fields["avg_time_per_panel"] = {"doubleValue": results.get("avg_time_per_panel", 0.0)}
	fields["vertical_range_meters"] = {"doubleValue": results.get("vertical_range_meters", 0.0)}
	fields["crosses_midline"] = {"integerValue": str(results.get("crosses_midline", 0))}
	fields["motor_control_score"] = {"integerValue": str(results.get("motor_control_score", 0))}
	fields["planning_score"] = {"integerValue": str(results.get("planning_score", 0))}
	fields["spatial_awareness_score"] = {"integerValue": str(results.get("spatial_awareness_score", 0))}

func _add_city_fields(fields: Dictionary, results: Dictionary) -> void:
	print("[Firebase] 🏙️ Añadiendo campos específicos de CityWorld:")
	
	var completion = results.get("completion_percentage", 0.0)
	fields["accuracy"] = {"integerValue": str(int(completion))}  # Para compatibilidad con la UI de la clínica
	fields["completion_percentage"] = {"doubleValue": completion}
	fields["targets_collected"] = {"integerValue": str(results.get("targets_collected", 0))}
	fields["total_targets"] = {"integerValue": str(results.get("total_targets", 0))}
	fields["sequence_errors"] = {"integerValue": str(results.get("sequence_errors", 0))}
	fields["left_side_targets"] = {"integerValue": str(results.get("left_side_targets", 0))}
	fields["right_side_targets"] = {"integerValue": str(results.get("right_side_targets", 0))}
	fields["asymmetry_percentage"] = {"doubleValue": results.get("asymmetry_percentage", 0.0)}
	fields["neglect_score"] = {"doubleValue": results.get("neglect_score", 0.0)}
	fields["avg_reaction_time"] = {"doubleValue": results.get("avg_reaction_time", 0.0)}
	
	print("  ✅ Score: ", results.get("score", 0))
	print("  ✅ Targets: ", results.get("targets_collected", 0), "/", results.get("total_targets", 0))
	print("  ✅ Lado izq: ", results.get("left_side_targets", 0), " | Lado der: ", results.get("right_side_targets", 0))
	print("  ✅ Asimetría: ", results.get("asymmetry_percentage", 0.0), "% | Negligencia: ", results.get("neglect_score", 0.0))
	
	# ROM cervical
	var cervical = results.get("cervical_rom_degrees", {})
	fields["cervical_rom_left"] = {"doubleValue": cervical.get("rotation_left", 0.0)}
	fields["cervical_rom_right"] = {"doubleValue": cervical.get("rotation_right", 0.0)}
	fields["cervical_rom_extension"] = {"doubleValue": cervical.get("extension_up", 0.0)}
	fields["cervical_rom_flexion"] = {"doubleValue": cervical.get("flexion_down", 0.0)}
	fields["cervical_rom_total"] = {"doubleValue": cervical.get("total_rom", 0.0)}
	
	print("  ✅ ROM cervical total: ", cervical.get("total_rom", 0.0), "°")
	
	# Scores clínicos
	var clinical = results.get("clinical_scores", {})
	fields["spatial_awareness"] = {"integerValue": str(clinical.get("spatial_awareness", 0))}
	fields["orientation"] = {"integerValue": str(clinical.get("orientation", 0))}
	fields["processing_speed"] = {"integerValue": str(clinical.get("processing_speed", 0))}
	fields["cervical_mobility"] = {"integerValue": str(clinical.get("cervical_mobility", 0))}
	fields["visual_search_efficiency"] = {"integerValue": str(clinical.get("visual_search_efficiency", 0))}
	
	print("  ✅ Scores clínicos: conciencia espacial=", clinical.get("spatial_awareness", 0), 
		  " | orientación=", clinical.get("orientation", 0),
		  " | velocidad=", clinical.get("processing_speed", 0))
	print("[Firebase] 💾 Todos los campos de CityWorld añadidos correctamente")

func _add_luggage_fields(fields: Dictionary, results: Dictionary) -> void:
	fields["accuracy_percentage"] = {"doubleValue": results.get("accuracy_percentage", 0.0)}
	fields["luggage_placed"] = {"integerValue": str(results.get("luggage_placed", 0))}
	fields["luggage_dropped"] = {"integerValue": str(results.get("luggage_dropped", 0))}
	fields["luggage_wrong"] = {"integerValue": str(results.get("luggage_wrong", 0))}
	fields["max_combo"] = {"integerValue": str(results.get("max_combo", 0))}
	fields["total_weight_moved"] = {"doubleValue": results.get("total_weight_moved", 0.0)}
	fields["max_weight_lifted"] = {"doubleValue": results.get("max_weight_lifted", 0.0)}
	fields["time_under_load"] = {"doubleValue": results.get("time_under_load", 0.0)}
	fields["trunk_rotations_left"] = {"integerValue": str(results.get("trunk_rotations_left", 0))}
	fields["trunk_rotations_right"] = {"integerValue": str(results.get("trunk_rotations_right", 0))}
	fields["trunk_asymmetry"] = {"doubleValue": results.get("trunk_asymmetry", 0.0)}
	
	# Scores clínicos
	var clinical = results.get("clinical_scores", {})
	fields["strength_score"] = {"integerValue": str(clinical.get("strength", 0))}
	fields["endurance_score"] = {"integerValue": str(clinical.get("endurance", 0))}
	fields["trunk_mobility_score"] = {"integerValue": str(clinical.get("trunk_mobility", 0))}
	fields["coordination_score"] = {"integerValue": str(clinical.get("coordination", 0))}

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
