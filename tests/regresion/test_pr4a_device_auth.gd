extends SceneTree
# ─────────────────────────────────────────────────────────────────────────────
# Prueba de regresión PR4a: FirebaseConfig, DeviceAuth y compatibilidad de FirebaseManager.
# SIN RED: DeviceAuth usa un transporte falso inyectado y relojes simulados; datos sintéticos.
# Ejecutar en una copia aislada (ruta corta) con openxr/enabled=false (solo en la copia):
#     godot --headless --path <copia> --script res://tests/regresion/test_pr4a_device_auth.gd
# Código de salida 0 = todo correcto; 1 = alguna comprobación falla.
# ─────────────────────────────────────────────────────────────────────────────

const Cfg = preload("res://scripts/firebase_config.gd")
const AuthScript = preload("res://scripts/device_auth.gd")
const FbScript = preload("res://scripts/firebase_manager.gd")
const RUTA_CFG := "user://test_pr4a_device_auth.cfg"
const TOKEN_1 := "TOKEN-SINTETICO-UNO"
const TOKEN_2 := "TOKEN-SINTETICO-DOS"
const REFRESH_1 := "REFRESH-SINTETICO-UNO"

var fallos := 0
var llamadas: Array = []     # {url, cabeceras, cuerpo} de cada petición del transporte falso
var respuestas: Array = []   # cola de respuestas simuladas
var reloj_s := 1000.0
var log_capturado := ""

func check(ok: bool, msg: String) -> void:
	print(("PASS " if ok else "FAIL ") + msg)
	if not ok:
		fallos += 1

func _initialize() -> void:
	_run()

func _fake(url: String, cabeceras: Array, _metodo: int, cuerpo: String) -> Dictionary:
	llamadas.append({"url": url, "cabeceras": cabeceras, "cuerpo": cuerpo})
	if respuestas.is_empty():
		return {"result": HTTPRequest.RESULT_CANT_CONNECT, "code": 0, "body": ""}
	return respuestas.pop_front()

func _reloj() -> float:
	return reloj_s

func _ok_signup(token := TOKEN_1) -> Dictionary:
	return {"result": 0, "code": 200, "body": JSON.stringify({"idToken": token, "refreshToken": REFRESH_1, "expiresIn": "3600", "localId": "uid-sintetico"})}

func _ok_refresh(token := TOKEN_2) -> Dictionary:
	return {"result": 0, "code": 200, "body": JSON.stringify({"id_token": token, "refresh_token": REFRESH_1, "expires_in": "3600", "user_id": "uid-sintetico"})}

func _nuevo_auth() -> Node:
	var a: Node = AuthScript.new()
	a.ruta_cfg = RUTA_CFG
	a.transporte = Callable(self, "_fake")
	a.reloj = Callable(self, "_reloj")
	a.tiempos_backoff = [0.01, 0.01, 0.01]   # acelera las esperas (en producción: 2, 5, 10 s)
	root.add_child(a)
	return a

func _leer(ruta: String) -> String:
	return FileAccess.get_file_as_string(ruta)

func _run() -> void:
	await process_frame
	var emu_ant := OS.get_environment(Cfg.ENV_EMULADOR)

	# ── T1: FirebaseConfig (funciones puras con flags inyectados) ──
	check(not Cfg.emulador_permitido(false, "1", PackedStringArray(["--emulator"])), "T1 release ignora emulador (env y argumento)")
	check(Cfg.emulador_permitido(true, "1", PackedStringArray()), "T1 debug + TFGVR_EMULATOR=1 activa emulador")
	check(Cfg.emulador_permitido(true, "", PackedStringArray(["--emulator"])), "T1 debug + --emulator activa emulador")
	check(not Cfg.emulador_permitido(true, "", PackedStringArray()), "T1 debug sin petición NO activa emulador")
	check(not Cfg.emulador_permitido(true, "0", PackedStringArray()), "T1 TFGVR_EMULATOR=0 no activa emulador")
	check(Cfg.base_url_para(false) == "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents", "T1 URL de Firestore de producción idéntica a la histórica")
	check(Cfg.auth_url_para(false).begins_with("https://identitytoolkit.googleapis.com/") and Cfg.token_url_para(false).begins_with("https://securetoken.googleapis.com/"), "T1 URLs de Auth de producción")
	check(Cfg.base_url_para(true).begins_with("http://127.0.0.1:8080/") and Cfg.base_url_para(true).contains("demo-tfg-vr"), "T1 emulador Firestore 8080 / demo-tfg-vr")
	check(Cfg.auth_url_para(true).begins_with("http://127.0.0.1:9099/") and Cfg.token_url_para(true).begins_with("http://127.0.0.1:9099/"), "T1 emulador Auth 9099")
	check(Cfg.api_key_para(true, "", "") == "fake-api-key", "T1 emulador usa fake-api-key")
	check(Cfg.api_key_para(false, "", "") == "", "T1 sin fuentes la clave es vacía")
	check(Cfg.api_key_para(false, "  K-ENV ", "K-ARCHIVO") == "K-ENV" and Cfg.api_key_para(false, "", "K-ARCHIVO") == "K-ARCHIVO", "T1 prioridad entorno > archivo")
	OS.set_environment(Cfg.ENV_EMULADOR, "")
	check(not Cfg.es_emulador() and Cfg.base_url() == Cfg.FIRESTORE_PROD, "T1 por defecto (sin variable) se usa producción")
	OS.set_environment(Cfg.ENV_EMULADOR, "1")
	check(Cfg.es_emulador() == (OS.has_feature("editor") or OS.is_debug_build()), "T1 es_emulador() coherente con el tipo de build real")
	OS.set_environment(Cfg.ENV_EMULADOR, emu_ant)

	# ── T2: 127.0.0.1 solo en consts EMU_ de firebase_config.gd; ninguna credencial administrativa ──
	var fuente_cfg := _leer("res://scripts/firebase_config.gd")
	var fuera := 0
	for l in fuente_cfg.split("\n"):
		if l.contains("127.0.0.1") and not l.begins_with("const EMU_"):
			fuera += 1
	check(fuera == 0, "T2 127.0.0.1 solo aparece en las consts EMU_ de firebase_config.gd")
	var sin_local := true
	var sin_secretos := true
	var d := DirAccess.open("res://scripts")
	for f in d.get_files():
		if not f.ends_with(".gd"):
			continue
		var t := _leer("res://scripts/" + f)
		if f != "firebase_config.gd" and (t.contains("127.0.0.1") or t.contains("localhost")):
			sin_local = false
		for patron in ["private_key", "serviceAccount", "AIza", "BEGIN PRIVATE"]:
			if t.contains(patron):
				sin_secretos = false
				print("   (aparece '%s' en %s)" % [patron, f])
	check(sin_local, "T2 ningún otro script de scripts/ usa 127.0.0.1/localhost")
	check(sin_secretos, "T2 sin private_key/serviceAccount/AIza en scripts/")
	check(not _leer("res://scripts/device_auth.gd").contains("print(\"[DeviceAuth] \", _id_token"), "T2 DeviceAuth no imprime el token")

	# ── T3: DeviceAuth ──
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RUTA_CFG))
	OS.set_environment(Cfg.ENV_API_KEY, "")
	var a := _nuevo_auth()
	var motivos: Array = []
	a.error_auth.connect(func(m): motivos.append(m))
	check(a.estado == "sin_identidad" and a.get_headers().is_empty(), "T3 estado inicial sin_identidad y sin cabecera")
	check(llamadas.is_empty(), "T3 no hay peticiones al cargar el nodo")
	var ok1: bool = await a.asegurar_identidad()
	check(not ok1 and a.estado == "error" and motivos == ["sin_clave_api"] and llamadas.is_empty(), "T3 sin clave: error controlado y sin petición")

	OS.set_environment(Cfg.ENV_API_KEY, "CLAVE-SINTETICA")
	respuestas = [_ok_signup()]
	var n_listo := {"n": 0}
	a.listo.connect(func(): n_listo["n"] += 1)
	var ok2: bool = await a.asegurar_identidad()
	check(ok2 and a.estado == "listo" and n_listo["n"] == 1, "T3 signUp anónimo: estado listo y señal listo")
	check(llamadas.size() == 1 and llamadas[0]["url"].contains("accounts:signUp?key=") and JSON.parse_string(llamadas[0]["cuerpo"]).get("returnSecureToken") == true, "T3 signUp: URL y cuerpo returnSecureToken")
	check(a.get_headers() == PackedStringArray(["Authorization: Bearer " + TOKEN_1]), "T3 get_headers() con token vigente")
	var cfg := ConfigFile.new()
	cfg.load(RUTA_CFG)
	check(cfg.get_value("identidad", "refresh_token", "") == REFRESH_1 and cfg.get_value("identidad", "uid", "") == "uid-sintetico", "T3 persiste uid y refresh_token")
	check(not _leer(RUTA_CFG).contains(TOKEN_1), "T3 el idToken NO se guarda en disco")

	# Reinicio: nueva instancia reutiliza la identidad (refresh, no signUp)
	a.queue_free()
	await process_frame
	llamadas.clear()
	respuestas = [_ok_refresh()]
	a = _nuevo_auth()
	var ok3: bool = await a.asegurar_identidad()
	check(ok3 and llamadas.size() == 1 and llamadas[0]["url"].contains("securetoken") and llamadas[0]["cuerpo"].contains("grant_type=refresh_token"), "T3 reinicio: reutiliza identidad con securetoken (sin nuevo signUp)")
	check(a.uid == "uid-sintetico" and a.get_headers() == PackedStringArray(["Authorization: Bearer " + TOKEN_2]), "T3 reinicio: mismo uid y nuevo token")

	# Expiración y renovación
	reloj_s += 3500.0
	check(a.get_headers().size() == 1 and a._ahora() >= a._renovar_en, "T3 a los ~58 min toca renovar (token aún vigente)")
	reloj_s += 200.0
	check(a.get_headers().is_empty(), "T3 token caducado: sin cabecera")
	llamadas.clear()
	respuestas = [_ok_refresh(TOKEN_1)]
	var ok4: bool = await a.renovar()
	check(ok4 and llamadas.size() == 1 and a.get_headers() == PackedStringArray(["Authorization: Bearer " + TOKEN_1]), "T3 renovar() devuelve token nuevo")

	# 401 una sola vez
	llamadas.clear()
	respuestas = [_ok_refresh(TOKEN_2), _ok_refresh(TOKEN_1)]
	var r401a: bool = await a.notificar_401()
	var r401b: bool = await a.notificar_401()
	check(r401a and not r401b and llamadas.size() == 1, "T3 401: renueva una vez y la segunda se rechaza (sin bucle)")
	a.confirmar_ok()
	respuestas = [_ok_refresh(TOKEN_1)]
	var r401c: bool = await a.notificar_401()
	check(r401c, "T3 tras confirmar_ok() un nuevo 401 puede renovar otra vez")

	# Errores de red: backoff acotado
	llamadas.clear()
	respuestas = []   # el transporte falso devuelve fallo de red
	var motivos2: Array = []
	a.error_auth.connect(func(m): motivos2.append(m))
	var ok5: bool = await a.renovar()
	check(not ok5 and llamadas.size() == 4 and a.estado == "error" and motivos2 == ["sin_red"], "T3 red caída: 1 intento + 3 reintentos y error (real: %d)" % llamadas.size())
	check(a.get_headers().is_empty(), "T3 tras error no hay cabecera")
	# 5xx se reintenta; 4xx (no 400-refresh) no
	llamadas.clear()
	respuestas = [{"result": 0, "code": 503, "body": ""}, _ok_refresh(TOKEN_2)]
	check(await a.renovar() and llamadas.size() == 2, "T3 503 y luego 200: se recupera con 1 reintento")
	llamadas.clear()
	respuestas = [{"result": 0, "code": 403, "body": ""}, _ok_refresh(TOKEN_2)]
	check(not await a.renovar() and llamadas.size() == 1 and a.ultimo_error == "http_403", "T3 403: error inmediato sin reintentos")
	# 400 al refrescar: descarta identidad y crea otra
	llamadas.clear()
	respuestas = [{"result": 0, "code": 400, "body": "{}"}, _ok_signup(TOKEN_1)]
	a.estado = "listo"
	var ok6: bool = await a.asegurar_identidad()
	check(ok6 and llamadas.size() == 2 and llamadas[1]["url"].contains("signUp"), "T3 refresh rechazado (400): se crea una identidad nueva")
	a.queue_free()
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RUTA_CFG))
	OS.set_environment(Cfg.ENV_API_KEY, "")

	# ── T4: FirebaseManager mantiene cabeceras y rutas ──
	var fb: Node = FbScript.new()
	check(fb._cabeceras() == PackedStringArray(), "T4 sin DeviceAuth: peticiones GET sin cabeceras (igual que antes)")
	check(fb._cabeceras(["Content-Type: application/json"]) == PackedStringArray(["Content-Type: application/json"]), "T4 sin token: solo Content-Type (igual que antes)")
	var dummy_auth := _nuevo_auth()
	fb.device_auth = dummy_auth
	check(fb._cabeceras(["Content-Type: application/json"]) == PackedStringArray(["Content-Type: application/json"]), "T4 DeviceAuth sin token: sigue igual")
	OS.set_environment(Cfg.ENV_API_KEY, "CLAVE-SINTETICA")
	respuestas = [_ok_signup()]
	await dummy_auth.asegurar_identidad()
	check(fb._cabeceras(["Content-Type: application/json"]) == PackedStringArray(["Content-Type: application/json", "Authorization: Bearer " + TOKEN_1]), "T4 con token: añade Authorization")
	check(fb._cabeceras() == PackedStringArray(["Authorization: Bearer " + TOKEN_1]), "T4 con token: GET solo con Authorization")
	dummy_auth.queue_free()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RUTA_CFG))
	OS.set_environment(Cfg.ENV_API_KEY, "")
	fb.device_auth = null
	var mapa: Dictionary = fb.get_script().get_script_constant_map()
	check(mapa.get("COL_SESSION_CONFIG") == "sesion_activa" and mapa.get("DOC_ACTIVE") == "current" and mapa.get("COL_RESULTS") == "sesiones", "T4 colecciones/documento sin cambios (sesion_activa/current, sesiones)")
	check(fb._base_url() == "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents" or OS.get_environment(Cfg.ENV_EMULADOR) == "1", "T4 URL base por defecto = producción")
	var fuente_fb := _leer("res://scripts/firebase_manager.gd")
	var rutas_ok := fuente_fb.count('_base_url() + "/" + COL_SESSION_CONFIG + "/" + DOC_ACTIVE') == 4 and fuente_fb.count('_base_url() + "/" + COL_RESULTS') == 1
	check(rutas_ok, "T4 polling, carga, PATCH completed (sesion_activa/current) y POST sesiones: rutas sin cambios")
	check(fuente_fb.contains("var _poll_interval := 3.0") and fuente_fb.contains("METHOD_POST, json_body") and fuente_fb.contains("METHOD_PATCH, json_body"), "T4 polling 3 s y métodos POST/PATCH intactos")
	check(not fuente_fb.contains("device_auth.asegurar_identidad"), "T4 FirebaseManager no inicia la autenticación por sí solo")
	check(fb.has_method("guardado_confirmado") and fb.estado_guardado == "ninguno", "T4 API de la PR #23 (estado_guardado, guardado_confirmado) conservada")
	fb.free()

	print("RESULTADO: %s (%d fallos)" % ["OK" if fallos == 0 else "FALLA", fallos])
	quit(1 if fallos > 0 else 0)
