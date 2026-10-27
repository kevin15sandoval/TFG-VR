extends RefCounted
# ─────────────────────────────────────────────────────────────────────────────
# ModoLocal — sesión local de PRUEBA (solo compilaciones de depuración)
# ─────────────────────────────────────────────────────────────────────────────
# Cuando el Hub de depuración arranca con el selector manual, la sesión es local:
#   - NO se escribe, borra ni lee nada del proyecto real de Firebase (tfg-vr).
#   - Las métricas se guardan en user://pruebas_locales/<session_id>.json
# Solo es efectivo si OS.is_debug_build() es true. En release esta_activo() es
# siempre false y todos los puntos de red se comportan exactamente como antes.
#
# Punto común de salida: bloquea_red() (guarda) y enviar() (envío + contador).
# No modifica el contrato Firebase (campos, rutas, formatos).
# ─────────────────────────────────────────────────────────────────────────────

const CARPETA := "user://pruebas_locales"

static var activo := false
## Peticiones bloqueadas en modo local (diagnóstico y pruebas)
static var bloqueadas := 0
## Peticiones que han salido por enviar() (diagnóstico y pruebas)
static var emitidas := 0
## SOLO PRUEBAS: cuenta la petición pero no abre ninguna conexión real
static var sin_red_real := false

static func activar() -> void:
	if OS.is_debug_build():
		activo = true
		print("[LOCAL] Modo local ACTIVO: sin conexión con Firebase; métricas en ", CARPETA)

static func desactivar() -> void:
	activo = false

static func esta_activo() -> bool:
	return activo and OS.is_debug_build()

## true si la petición debe bloquearse (y registra el motivo). Llamar ANTES de crear la petición.
static func bloquea_red(motivo: String) -> bool:
	if not esta_activo():
		return false
	bloqueadas += 1
	print("[LOCAL] escritura Firestore bloqueada: ", motivo)
	return true

## Único punto por el que sale una petición HTTP a Firestore.
static func enviar(http: HTTPRequest, url: String, headers: PackedStringArray, metodo: int, cuerpo: String = "") -> int:
	if esta_activo():
		bloqueadas += 1
		print("[LOCAL] escritura Firestore bloqueada: método ", metodo, " ", url.get_slice("/documents/", 1))
		return ERR_UNAVAILABLE
	emitidas += 1
	if sin_red_real:
		return OK
	return http.request(url, headers, metodo, cuerpo)

## Guarda el diccionario de resultados en user://pruebas_locales/<session_id>.json
static func guardar_resultados(results: Dictionary, estado: String = "finalizada") -> String:
	var sid := str(results.get("session_id", "")).strip_edges()
	if sid == "":
		sid = "sin_id_" + str(Time.get_ticks_msec())
	sid = sid.validate_filename()
	if estado != "finalizada":
		sid += "_" + estado  # no pisa el resultado final si el gesto llega tras terminar la partida
	DirAccess.make_dir_recursive_absolute(CARPETA)
	var ruta := CARPETA + "/" + sid + ".json"
	var registro := {"estado": estado, "guardado": Time.get_datetime_string_from_system(), "resultados": results}
	var f := FileAccess.open(ruta, FileAccess.WRITE)
	if f == null:
		print("[LOCAL] ERROR no se pudo escribir ", ruta, " (", FileAccess.get_open_error(), ")")
		return ""
	f.store_string(JSON.stringify(registro, "\t"))
	f.close()
	print("[LOCAL] RESULTADOS (", estado, ") ", ruta, " = ", OS.get_user_data_dir(), "/pruebas_locales/", sid, ".json")
	print("[LOCAL] RESULTADOS ", JSON.stringify(results).substr(0, 600))
	return ruta
