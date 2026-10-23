extends Node
# ─────────────────────────────────────────────────────────────────────────────
# VinculacionService — Lógica de vinculación de la gafa (sin escena, sin UI)
# - Genera un código temporal de 8 símbolos (alfabeto de 31, generador criptográfico) y lo registra en
#   Firestore con UN commit atómico: dispositivos/{uid} + vinculos/{codigo} (contrato firestore.rules.next).
# - Consulta cada 3 s SOLO su propio documento dispositivos/{uid} (estado sin_vincular/vinculado/revocado).
# - La gafa NUNCA escribe estado/ownerUid/vinculadoEn/revocadoEn/alias, ni lee datos clínicos ni de personas.
# - Todas las peticiones llevan Authorization (auth.get_headers()); sin token NO se envía ninguna.
# - Persiste en user://vinculacion.cfg {uid, codigo, expira, estado} (nunca tokens) para reutilizar la
#   solicitud vigente al volver al Hub y no duplicar solicitudes.
# Estado visible (estado_ui): "inicial", "iniciando", "pendiente", "caducado", "vinculado", "revocado", "error".
# ─────────────────────────────────────────────────────────────────────────────

const FirebaseConfig = preload("res://scripts/firebase_config.gd")

signal cambiado()

const ALFABETO := "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # 31 símbolos: sin 0, O, 1, I, L
const LONGITUD_CODIGO := 8
const DURACION_S := 600.0                # caducidad visible: 10 min
const MARGEN_RELOJ_S := 15.0             # la expira enviada es 15 s menor: tolera desfase del reloj de la gafa
const MAX_INTENTOS_CODIGO := 5           # colisión de id de vínculo = otro código, máximo 5
const INTERVALO_POLL_S := 3.0            # consulta del documento propio mientras espera o está vinculado
const BACKOFF_POLL_S := [6.0, 12.0, 30.0]   # tras fallos seguidos de red: 3 -> 6 -> 12 -> 30 s (tope)
const MAX_REINTENTOS_AUTH_RED := 3       # fallos de red al autenticar: 3 reintentos espaciados, luego manual
const ESPERA_AUTH_RED_S := 30.0
const TIMEOUT_HTTP_S := 10.0
const RUTA_CFG_DEFECTO := "user://vinculacion.cfg"

## Transporte inyectable (pruebas): Callable(url, cabeceras, metodo, cuerpo) -> {result, code, body}
var transporte: Callable = Callable()
## Reloj inyectable (pruebas): Callable() -> float (segundos Unix)
var reloj: Callable = Callable()
var ruta_cfg := RUTA_CFG_DEFECTO
## Nodo de identidad (DeviceAuth o doble de pruebas): estado, ultimo_error, uid, get_headers(), asegurar_identidad()
var auth: Node = null
## URL base de Firestore; vacía = FirebaseConfig.base_url() (pruebas con emulador pueden fijarla)
var base_url_forzada := ""

var estado_ui := "inicial"
var motivo_error := ""         # "", sin_clave_api, auth_no_habilitada, auth_rechazada, sin_red, permiso_denegado, colision, http_NNN
var codigo := ""               # código activo (sin guion)
var expira := 0.0              # Unix (s) en que caduca el código mostrado
var estado_dispositivo := ""   # último estado remoto leído: sin_vincular / vinculado / revocado
var peticiones_enviadas := 0   # contador (diagnóstico y pruebas)

var _uid := ""
var _ocupado := false          # guard: una sola operación de red a la vez (crear/regenerar/consultar)
var _activo := false
var _proxima_consulta := 0.0
var _fallos_red := 0
var _reintentos_auth := 0
var _proximo_auth := 0.0
var _dispositivo_existe = null   # null = desconocido, true/false tras consultar
var _renovado_401 := false

func _ready() -> void:
	set_process(false)

func _process(_delta: float) -> void:
	tick()

# ─── FUNCIONES PURAS ─────────────────────────────────────────────────────────

## Código de 8 símbolos con Crypto (sin sesgo: rechazo de bytes >= 248 = 31 * 8). Nunca randi().
static func generar_codigo() -> String:
	var crypto := Crypto.new()
	var salida := ""
	while salida.length() < LONGITUD_CODIGO:
		var bytes: PackedByteArray = crypto.generate_random_bytes(16)
		for b in bytes:
			if b < 248 and salida.length() < LONGITUD_CODIGO:
				salida += ALFABETO[b % ALFABETO.length()]
	return salida

static func codigo_valido(c: String) -> bool:
	var re := RegEx.new()
	re.compile("^[A-HJ-KM-NP-Z2-9]{8}$")
	return re.search(c) != null

## "ABCDEFGH" -> "ABCD-EFGH" (solo presentación; en Firestore el id es sin guion)
static func formatear_codigo(c: String) -> String:
	if c.length() != LONGITUD_CODIGO:
		return c
	return c.substr(0, 4) + "-" + c.substr(4, 4)

static func formato_mmss(segundos: float) -> String:
	var s := int(ceil(maxf(segundos, 0.0)))
	return "%02d:%02d" % [s / 60, s % 60]

static func timestamp_rfc3339(unix_s: float) -> String:
	return Time.get_datetime_string_from_unix_time(int(unix_s), false) + "Z"

func ahora() -> float:
	if reloj.is_valid():
		return float(reloj.call())
	return Time.get_unix_time_from_system()

func segundos_restantes() -> float:
	if codigo == "":
		return 0.0
	return maxf(expira - ahora(), 0.0)

func cuenta_atras() -> String:
	return formato_mmss(segundos_restantes())

func codigo_mostrado() -> String:
	return formatear_codigo(codigo)

## Estado derivado: un código pendiente cuyo reloj ya pasó es "caducado" aunque el servidor aún no lo sepa
func estado_efectivo() -> String:
	if estado_ui == "pendiente" and ahora() >= expira:
		return "caducado"
	return estado_ui

func puede_regenerar() -> bool:
	if _ocupado:
		return false
	var e := estado_efectivo()
	if e == "pendiente" or e == "caducado":
		return true
	# En error se permite reintentar salvo cuando la causa es de configuración (reintentar no la arregla)
	return e == "error" and motivo_error != "sin_clave_api" and motivo_error != "auth_no_habilitada"

func mensaje() -> String:
	match estado_efectivo():
		"inicial", "iniciando":
			return "Preparando la vinculación..."
		"pendiente":
			return "Indique este código a su fisioterapeuta en la plataforma clínica."
		"caducado":
			return "El código ha caducado. Pulse B para generar uno nuevo."
		"vinculado":
			return "Gafa vinculada correctamente."
		"revocado":
			return "Gafa revocada; contacte con su fisioterapeuta."
		"error":
			return _mensaje_error()
	return ""

func titulo_estado() -> String:
	match estado_efectivo():
		"pendiente": return "Pendiente"
		"caducado": return "Caducado"
		"vinculado": return "Vinculado"
		"revocado": return "Revocado"
		"error": return "Sin conexión" if motivo_error == "sin_red" else "No disponible"
	return "Preparando"

func _mensaje_error() -> String:
	match motivo_error:
		"sin_clave_api":
			return "Vinculación no disponible: falta la clave de la aplicación en esta gafa."
		"auth_no_habilitada":
			return "Vinculación no disponible: autenticación no habilitada."
		"sin_identidad":
			return "Vinculación no disponible: la gafa no tiene identidad. Pulse B para reintentar."
		"auth_rechazada":
			return "Error de autenticación: el servidor rechazó la identidad de la gafa. Pulse B para reintentar."
		"sin_red":
			return "Error de conexión. Compruebe el wifi; se reintentará automáticamente."
		"permiso_denegado":
			return "El servidor rechazó la solicitud. Pulse B para reintentar."
		"colision":
			return "No se pudo reservar un código. Pulse B para reintentar."
	return "Error inesperado (%s). Pulse B para reintentar." % motivo_error

# ─── API PRINCIPAL ───────────────────────────────────────────────────────────

## Arranca la vinculación: identidad, estado remoto y reutilización/creación de la solicitud.
## Si ya hay otra operación en curso no hace nada (guard contra doble creación).
func iniciar() -> void:
	if _ocupado:
		return
	_ocupado = true
	_activo = true
	_fallos_red = 0
	_poner("iniciando", "")
	if not await _asegurar_token():
		_ocupado = false
		return
	_cargar_cfg()
	var r := await _leer_dispositivo()
	if not r.get("ok", false):
		_ocupado = false
		_programar_poll()
		return
	var d: Dictionary = r["doc"]
	if d.is_empty():
		_dispositivo_existe = false
		await _crear_solicitud()
	else:
		_dispositivo_existe = true
		await _aplicar_estado_remoto(d, true)
	_ocupado = false
	_programar_poll()

## Regenera la solicitud (caducada, o pendiente: cancela la anterior y crea otra). Nunca si está revocada.
## Si la identidad falló (error), reintenta todo el arranque.
func regenerar() -> void:
	if _ocupado or not _activo:
		return
	var e := estado_efectivo()
	if e == "revocado" or e == "vinculado" or e == "iniciando":
		return
	if e == "error":
		await iniciar()
		return
	_ocupado = true
	_fallos_red = 0
	var anterior := codigo
	var ok := await _crear_solicitud()
	if ok and anterior != "" and anterior != codigo:
		await _borrar_vinculo(anterior)
	_ocupado = false
	_programar_poll()

## Un ciclo del reloj: consulta periódica (3 s) y reintento de identidad acotado. Lo llama _process.
func tick() -> void:
	if not _activo or _ocupado:
		return
	var t := ahora()
	if estado_ui == "error" and motivo_error == "sin_red" and _uid == "" and _reintentos_auth < MAX_REINTENTOS_AUTH_RED and t >= _proximo_auth:
		_reintentos_auth += 1
		await iniciar()
		return
	# Incluso tras caducar se consulta el estado remoto: el clínico pudo vincular justo antes del vencimiento.
	var consultable := estado_ui == "pendiente" or estado_ui == "caducado" or estado_ui == "vinculado" \
		or (estado_ui == "error" and motivo_error == "sin_red" and _uid != "")
	if consultable and t >= _proxima_consulta:
		await consultar()

## Consulta única del documento propio. Devuelve true si hubo respuesta correcta.
func consultar() -> bool:
	if _ocupado:
		return false
	_ocupado = true
	var r := await _leer_dispositivo()
	var ok: bool = r.get("ok", false)
	if ok:
		var d: Dictionary = r["doc"]
		if d.is_empty():
			# Documento desaparecido (borrado externo): se vuelve a crear una sola solicitud
			_dispositivo_existe = false
			await _crear_solicitud()
		else:
			_dispositivo_existe = true
			await _aplicar_estado_remoto(d, codigo == "")   # sin solicitud local (p. ej. tras caída de red): crear
	_ocupado = false
	_programar_poll()
	return ok

func esta_ocupado() -> bool:
	return _ocupado

func detener() -> void:
	_activo = false
	set_process(false)

# ─── ESTADO REMOTO ───────────────────────────────────────────────────────────

func _aplicar_estado_remoto(d: Dictionary, al_iniciar: bool) -> void:
	var est := _str_campo(d, "estado")
	estado_dispositivo = est
	if est == "vinculado":
		codigo = ""
		_poner("vinculado", "")
		_guardar_cfg()
	elif est == "revocado":
		codigo = ""
		_poner("revocado", "")   # terminal: no se ofrece regenerar
		_guardar_cfg()
	elif est == "sin_vincular":
		var cod_remoto := _str_campo(d, "codigoActual")
		var vigente := codigo != "" and codigo == cod_remoto and ahora() < expira
		if vigente:
			_poner("pendiente", "")
			_guardar_cfg()
		elif codigo != "" and codigo == cod_remoto:
			# Era el nuestro y ya caducó: se muestra "Caducado"; al arrancar se crea uno nuevo, al consultar no
			if al_iniciar:
				await _crear_solicitud()
			else:
				_poner("caducado", "")
				_guardar_cfg()
		elif al_iniciar:
			await _crear_solicitud()      # no había solicitud vigente nuestra: se rota el código
		else:
			_poner("caducado", "")
	else:
		_poner("error", "http_respuesta_invalida")

func _str_campo(d: Dictionary, nombre: String) -> String:
	var f = d.get("fields", {})
	if f is Dictionary and f.has(nombre) and f[nombre] is Dictionary:
		return str(f[nombre].get("stringValue", ""))
	return ""

# ─── CREACIÓN / ROTACIÓN ATÓMICA ─────────────────────────────────────────────

func _crear_solicitud() -> bool:
	if _uid == "" or not await _asegurar_token():
		return false
	var modo_rotar: bool = _dispositivo_existe == true
	for intento in MAX_INTENTOS_CODIGO:
		var nuevo := generar_codigo()
		var t := ahora()
		var expira_nueva := t + DURACION_S - MARGEN_RELOJ_S
		var cuerpo := construir_commit(_nombre_raiz(), _uid, nuevo, expira_nueva, modo_rotar)
		var r := await _enviar(_base() + ":commit", ["Content-Type: application/json"], HTTPClient.METHOD_POST, cuerpo)
		var code := int(r.get("code", 0))
		if code == 200:
			codigo = nuevo
			expira = expira_nueva
			estado_dispositivo = "sin_vincular"
			_dispositivo_existe = true
			_fallos_red = 0
			_poner("pendiente", "")
			_guardar_cfg()
			return true
		if _es_error_red(r):
			_fallo_red()
			return false
		if code == 401:
			_poner("error", "auth_rechazada")
			return false
		if code == 409 or code == 403:
			continue   # colisión de id (o regla): otro código, hasta MAX_INTENTOS_CODIGO
		_poner("error", "http_" + str(code))
		return false
	# Agotados los intentos: puede que la gafa ya esté vinculada/revocada (regla de rotación denegada)
	var r2 := await _leer_dispositivo()
	if r2.get("ok", false) and not (r2["doc"] as Dictionary).is_empty():
		var est := _str_campo(r2["doc"], "estado")
		if est == "vinculado" or est == "revocado":
			await _aplicar_estado_remoto(r2["doc"], false)
			return false
	if estado_ui != "error":
		_dispositivo_existe = null
		_poner("error", "colision")
	return false

## Cuerpo del commit REST. Claves EXACTAS del contrato; creadoEn mediante REQUEST_TIME (serverTimestamp).
## Estático: se prueba sin red.
static func construir_commit(raiz: String, uid: String, cod: String, expira_unix: float, rotar: bool) -> String:
	var escrituras: Array = []
	if rotar:
		# Solo cambia codigoActual (la gafa nunca toca estado/ownerUid/vinculadoEn/revocadoEn/alias)
		escrituras.append({
			"update": {"name": raiz + "/dispositivos/" + uid, "fields": {"codigoActual": {"stringValue": cod}}},
			"updateMask": {"fieldPaths": ["codigoActual"]},
			"currentDocument": {"exists": true}})
	else:
		escrituras.append({
			"update": {"name": raiz + "/dispositivos/" + uid, "fields": {
				"estado": {"stringValue": "sin_vincular"},
				"codigoActual": {"stringValue": cod}}},
			"updateTransforms": [{"fieldPath": "creadoEn", "setToServerValue": "REQUEST_TIME"}],
			"currentDocument": {"exists": false}})
	escrituras.append({
		"update": {"name": raiz + "/vinculos/" + cod, "fields": {
			"deviceUid": {"stringValue": uid},
			"estado": {"stringValue": "pendiente"},
			"usado": {"booleanValue": false},
			"expira": {"timestampValue": timestamp_rfc3339(expira_unix)}}},
		"updateTransforms": [{"fieldPath": "creadoEn", "setToServerValue": "REQUEST_TIME"}],
		"currentDocument": {"exists": false}})
	return JSON.stringify({"writes": escrituras})

func _borrar_vinculo(cod: String) -> void:
	# Mejor esfuerzo: solo se puede borrar si sigue pendiente y es nuestro; el resultado se ignora
	await _enviar(_base() + "/vinculos/" + cod, [], HTTPClient.METHOD_DELETE, "")

# ─── LECTURA DEL DOCUMENTO PROPIO ────────────────────────────────────────────

## {ok: bool, doc: Dictionary}; doc vacío = no existe (404). Actualiza estado de error si falla.
func _leer_dispositivo() -> Dictionary:
	if _uid == "" or not await _asegurar_token():
		return {"ok": false, "doc": {}}
	var r := await _enviar(_base() + "/dispositivos/" + _uid, [], HTTPClient.METHOD_GET, "")
	var code := int(r.get("code", 0))
	if code == 200:
		_fallos_red = 0
		var j := JSON.new()
		if j.parse(str(r.get("body", ""))) == OK and j.get_data() is Dictionary:
			return {"ok": true, "doc": j.get_data()}
		_poner("error", "http_respuesta_invalida")
		return {"ok": false, "doc": {}}
	if code == 404:
		_fallos_red = 0
		return {"ok": true, "doc": {}}
	if _es_error_red(r):
		_fallo_red()
	elif code == 401:
		_poner("error", "auth_rechazada")
	elif code == 403:
		_poner("error", "permiso_denegado")
	else:
		_poner("error", "http_" + str(code))
	return {"ok": false, "doc": {}}

# ─── RED E IDENTIDAD ─────────────────────────────────────────────────────────

func _base() -> String:
	return base_url_forzada if base_url_forzada != "" else FirebaseConfig.base_url()

## "projects/<id>/databases/(default)/documents" a partir de la URL base
func _nombre_raiz() -> String:
	var b := _base()
	var i := b.find("projects/")
	return b.substr(i) if i >= 0 else b

func _es_error_red(r: Dictionary) -> bool:
	return int(r.get("result", HTTPRequest.RESULT_CANT_CONNECT)) != HTTPRequest.RESULT_SUCCESS \
		or int(r.get("code", 0)) == 0 or int(r.get("code", 0)) >= 500 or int(r.get("code", 0)) == 429

## Garantiza token vigente; si no lo hay, intenta asegurar la identidad UNA vez. Sin token no hay peticiones.
func _asegurar_token() -> bool:
	if auth == null or not is_instance_valid(auth):
		_poner("error", "sin_identidad")
		return false
	if auth.get_headers().size() > 0 and str(auth.uid) != "":
		_uid = str(auth.uid)
		return true
	var ok: bool = await auth.asegurar_identidad()
	if ok and auth.get_headers().size() > 0 and str(auth.uid) != "":
		_uid = str(auth.uid)
		_reintentos_auth = 0
		return true
	_uid = ""
	var m := str(auth.ultimo_error)
	if m == "sin_clave_api":
		_poner("error", "sin_clave_api")
	elif m == "sin_red":
		_proximo_auth = ahora() + ESPERA_AUTH_RED_S
		_poner("error", "sin_red")
	elif m == "http_400" or m == "http_403":
		_poner("error", "auth_no_habilitada")    # Anonymous Auth no habilitado (OPERATION_NOT_ALLOWED)
	elif m in ["http_401"]:
		_poner("error", "auth_rechazada")
	else:
		_poner("error", "sin_identidad" if m == "" else "auth_rechazada")
	return false

## Envía una petición con Authorization. Sin token: NO sale nada (devuelve error). Renueva el token una vez ante 401.
func _enviar(url: String, cabeceras: Array, metodo: int, cuerpo: String) -> Dictionary:
	var h := PackedStringArray(cabeceras)
	if auth == null or not is_instance_valid(auth) or auth.get_headers().size() == 0:
		return {"result": HTTPRequest.RESULT_CANT_CONNECT, "code": 0, "body": "", "sin_token": true}
	h.append_array(auth.get_headers())
	peticiones_enviadas += 1
	var r: Dictionary = await _transportar(url, h, metodo, cuerpo)
	if int(r.get("code", 0)) == 401 and not _renovado_401 and auth.has_method("notificar_401"):
		_renovado_401 = true
		if await auth.notificar_401() and auth.get_headers().size() > 0:
			var h2 := PackedStringArray(cabeceras)
			h2.append_array(auth.get_headers())
			peticiones_enviadas += 1
			r = await _transportar(url, h2, metodo, cuerpo)
	if int(r.get("code", 0)) >= 200 and int(r.get("code", 0)) < 300:
		_renovado_401 = false
		if auth.has_method("confirmar_ok"):
			auth.confirmar_ok()
	return r

func _transportar(url: String, cabeceras: PackedStringArray, metodo: int, cuerpo: String) -> Dictionary:
	if transporte.is_valid():
		return await transporte.call(url, cabeceras, metodo, cuerpo)
	var http := HTTPRequest.new()
	http.timeout = TIMEOUT_HTTP_S
	add_child(http)
	var err := http.request(url, cabeceras, metodo, cuerpo)
	if err != OK:
		http.queue_free()
		return {"result": HTTPRequest.RESULT_CANT_CONNECT, "code": 0, "body": ""}
	var resp = await http.request_completed
	http.queue_free()
	return {"result": int(resp[0]), "code": int(resp[1]), "body": (resp[3] as PackedByteArray).get_string_from_utf8()}

# ─── PLANIFICACIÓN Y ESTADO ──────────────────────────────────────────────────

func _fallo_red() -> void:
	_fallos_red += 1
	_poner("error", "sin_red")

## Siguiente consulta: 3 s en estados consultables; backoff acotado si falla la red.
func _programar_poll() -> void:
	var t := ahora()
	if _fallos_red > 0:
		var i := mini(_fallos_red - 1, BACKOFF_POLL_S.size() - 1)
		_proxima_consulta = t + float(BACKOFF_POLL_S[i])
	else:
		_proxima_consulta = t + INTERVALO_POLL_S
	set_process(_activo and is_inside_tree())

func _poner(nuevo: String, motivo: String) -> void:
	var antes := estado_ui + "|" + motivo_error
	estado_ui = nuevo
	motivo_error = motivo
	if antes != nuevo + "|" + motivo:
		cambiado.emit()

# ─── PERSISTENCIA (solo código, expira, estado, uid; nunca tokens) ───────────

func _cargar_cfg() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ruta_cfg) != OK:
		return
	if str(cfg.get_value("solicitud", "uid", "")) != _uid:
		return   # otra identidad: no se reutiliza
	var c := str(cfg.get_value("solicitud", "codigo", ""))
	if codigo_valido(c):
		codigo = c
		expira = float(cfg.get_value("solicitud", "expira", 0.0))

func _guardar_cfg() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("solicitud", "uid", _uid)
	cfg.set_value("solicitud", "codigo", codigo)
	cfg.set_value("solicitud", "expira", expira)
	cfg.set_value("solicitud", "estado", estado_ui)
	cfg.save(ruta_cfg)
