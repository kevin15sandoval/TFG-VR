extends Node
# ─────────────────────────────────────────────────────────────────────────────
# DeviceAuth — Identidad anónima persistente del dispositivo (Firebase Auth REST)
# - signUp anónimo y renovación con securetoken; persiste SOLO {uid, refresh_token} en user://.
# - El idToken vive solo en memoria y NUNCA se escribe en logs.
# - No hace nada al cargarse: solo actúa cuando se llama a asegurar_identidad().
# - Sin clave de API o sin Anonymous Auth habilitado en el proyecto devuelve un error controlado.
# Estados: "sin_identidad", "autenticando", "listo", "error".
# ─────────────────────────────────────────────────────────────────────────────

const FirebaseConfig = preload("res://scripts/firebase_config.gd")

signal listo()
signal error_auth(motivo: String)

const RUTA_CFG_DEFECTO := "user://device_auth.cfg"
const MARGEN_RENOVACION_S := 3000.0   # ~50 min (el idToken dura 60 min)

## Esperas entre reintentos ante fallo de red / 5xx / 429: máximo 3 reintentos (4 intentos en total)
var tiempos_backoff: Array = [2.0, 5.0, 10.0]
var ruta_cfg := RUTA_CFG_DEFECTO
## Transporte inyectable (pruebas): Callable(url, cabeceras, metodo, cuerpo) -> {result, code, body}
var transporte: Callable = Callable()
## Reloj inyectable (pruebas): Callable() -> float (segundos)
var reloj: Callable = Callable()

var estado := "sin_identidad"
var uid := ""
var ultimo_error := ""

var _refresh_token := ""
var _id_token := ""
var _renovar_en := 0.0
var _expira_en := 0.0
var _ocupado := false
var _renovado_tras_401 := false

func _ready() -> void:
	set_process(false)

func _process(_delta: float) -> void:
	# Renovación automática antes de que caduque el token (solo activa tras tener identidad)
	if estado == "listo" and not _ocupado and _ahora() >= _renovar_en:
		renovar()

func _ahora() -> float:
	if reloj.is_valid():
		return float(reloj.call())
	return Time.get_ticks_msec() / 1000.0

## Cabecera de autorización SOLO si hay token vigente; si no, array vacío
func get_headers() -> PackedStringArray:
	if estado == "listo" and _id_token != "" and _ahora() < _expira_en:
		return PackedStringArray(["Authorization: Bearer " + _id_token])
	return PackedStringArray()

func tiene_token_vigente() -> bool:
	return get_headers().size() > 0

# ─── API PRINCIPAL ───────────────────────────────────────────────────────────

## Carga la identidad guardada (o crea una anónima) y obtiene un token. Emite listo / error_auth.
## Devuelve true si quedó en estado "listo".
func asegurar_identidad() -> bool:
	if _ocupado:
		return false
	if FirebaseConfig.api_key() == "":
		_fallar("sin_clave_api")
		return false
	_ocupado = true
	estado = "autenticando"
	_cargar_cfg()
	var ok := false
	if _refresh_token != "":
		ok = await _refrescar()
		if not ok and estado == "sin_identidad":
			# El refresh token ya no vale (rechazado por el servidor): se descarta y se crea otra identidad
			ok = await _registrar()
	else:
		ok = await _registrar()
	_ocupado = false
	return ok

## Renueva el token con el refresh token guardado
func renovar() -> bool:
	if _ocupado or _refresh_token == "":
		return false
	_ocupado = true
	estado = "autenticando"
	var ok := await _refrescar()
	_ocupado = false
	return ok

## Llamar cuando una petición devuelva 401: renueva el token UNA vez. Devuelve true si se renovó
## y conviene reintentar la petición; false si ya se intentó (evita bucles). confirmar_ok() lo rearma.
func notificar_401() -> bool:
	if _renovado_tras_401 or _ocupado:
		return false
	_renovado_tras_401 = true
	return await renovar()

## Llamar tras una respuesta correcta: permite volver a renovar ante un 401 futuro
func confirmar_ok() -> void:
	_renovado_tras_401 = false

## Olvida la identidad (memoria y disco)
func olvidar_identidad() -> void:
	uid = ""
	_refresh_token = ""
	_id_token = ""
	_expira_en = 0.0
	estado = "sin_identidad"
	var cfg := ConfigFile.new()
	cfg.save(ruta_cfg)
	set_process(false)

# ─── OPERACIONES ─────────────────────────────────────────────────────────────

func _registrar() -> bool:
	var url := FirebaseConfig.auth_url() + "?key=" + FirebaseConfig.api_key()
	var r: Dictionary = await _peticion_con_reintentos(url, ["Content-Type: application/json"],
		JSON.stringify({"returnSecureToken": true}))
	if int(r.get("code", 0)) != 200:
		_fallar(_motivo(r))
		return false
	var d := _parsear(r)
	var token := str(d.get("idToken", ""))
	var refresh := str(d.get("refreshToken", ""))
	if token == "" or refresh == "":
		_fallar("respuesta_invalida")
		return false
	uid = str(d.get("localId", ""))
	_refresh_token = refresh
	_aplicar_token(token, d.get("expiresIn", "3600"))
	_guardar_cfg()
	return true

func _refrescar() -> bool:
	var url := FirebaseConfig.token_url() + "?key=" + FirebaseConfig.api_key()
	var cuerpo := "grant_type=refresh_token&refresh_token=" + _refresh_token.uri_encode()
	var r: Dictionary = await _peticion_con_reintentos(url,
		["Content-Type: application/x-www-form-urlencoded"], cuerpo)
	var code := int(r.get("code", 0))
	if code != 200:
		if code == 400:
			# Refresh token inválido/caducado: la identidad guardada ya no sirve
			uid = ""
			_refresh_token = ""
			_id_token = ""
			_guardar_cfg()
			estado = "sin_identidad"
			ultimo_error = "refresh_rechazado"
		else:
			_fallar(_motivo(r))
		return false
	var d := _parsear(r)
	var token := str(d.get("id_token", ""))
	if token == "":
		_fallar("respuesta_invalida")
		return false
	_refresh_token = str(d.get("refresh_token", _refresh_token))
	uid = str(d.get("user_id", uid))
	_aplicar_token(token, d.get("expires_in", "3600"))
	_guardar_cfg()
	return true

## Petición POST con backoff acotado (2, 5, 10 s): reintenta solo ante red caída, 5xx o 429
func _peticion_con_reintentos(url: String, cabeceras: Array, cuerpo: String) -> Dictionary:
	var r: Dictionary = {}
	var intentos := tiempos_backoff.size() + 1
	for i in intentos:
		r = await _enviar(url, cabeceras, cuerpo)
		var res := int(r.get("result", HTTPRequest.RESULT_CANT_CONNECT))
		var code := int(r.get("code", 0))
		var reintentable := res != HTTPRequest.RESULT_SUCCESS or code >= 500 or code == 429
		if not reintentable or i >= tiempos_backoff.size():
			break
		await get_tree().create_timer(float(tiempos_backoff[i])).timeout
	return r

func _enviar(url: String, cabeceras: Array, cuerpo: String) -> Dictionary:
	if transporte.is_valid():
		return await transporte.call(url, cabeceras, HTTPClient.METHOD_POST, cuerpo)
	return await _transporte_http(url, cabeceras, cuerpo)

## Transporte real: un HTTPRequest nuevo por operación (evita ERR_BUSY)
func _transporte_http(url: String, cabeceras: Array, cuerpo: String) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)
	var err := http.request(url, PackedStringArray(cabeceras), HTTPClient.METHOD_POST, cuerpo)
	if err != OK:
		http.queue_free()
		return {"result": HTTPRequest.RESULT_CANT_CONNECT, "code": 0, "body": ""}
	var resp = await http.request_completed
	http.queue_free()
	return {"result": int(resp[0]), "code": int(resp[1]), "body": (resp[3] as PackedByteArray).get_string_from_utf8()}

# ─── AUXILIARES ──────────────────────────────────────────────────────────────

func _aplicar_token(token: String, expira_en_s) -> void:
	_id_token = token
	var vida := maxf(float(expira_en_s), 60.0)
	var ahora := _ahora()
	_expira_en = ahora + vida
	_renovar_en = ahora + minf(MARGEN_RENOVACION_S, maxf(vida - 120.0, 30.0))
	estado = "listo"
	ultimo_error = ""
	set_process(is_inside_tree())
	print("[DeviceAuth] Identidad lista")
	emit_signal("listo")

func _fallar(motivo: String) -> void:
	_id_token = ""
	_expira_en = 0.0
	estado = "error"
	ultimo_error = motivo
	print("[DeviceAuth] Error de autenticación: ", motivo)   # nunca incluye tokens ni la URL
	emit_signal("error_auth", motivo)

func _motivo(r: Dictionary) -> String:
	if int(r.get("result", 0)) != HTTPRequest.RESULT_SUCCESS:
		return "sin_red"
	return "http_" + str(int(r.get("code", 0)))

func _parsear(r: Dictionary) -> Dictionary:
	var j := JSON.new()
	if j.parse(str(r.get("body", ""))) == OK and j.get_data() is Dictionary:
		return j.get_data()
	return {}

func _cargar_cfg() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ruta_cfg) == OK:
		uid = str(cfg.get_value("identidad", "uid", ""))
		_refresh_token = str(cfg.get_value("identidad", "refresh_token", ""))

func _guardar_cfg() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("identidad", "uid", uid)
	cfg.set_value("identidad", "refresh_token", _refresh_token)
	cfg.save(ruta_cfg)
