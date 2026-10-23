extends SceneTree
# Prueba sin red: identidad y respuestas Firestore sintéticas.

const Servicio = preload("res://scripts/vinculacion_service.gd")
const VinculacionPanelScript = preload("res://scripts/vinculacion_panel.gd")

class AuthFalsa extends Node:
	var uid := "gafa-sintetica"
	var ultimo_error := ""
	func get_headers() -> PackedStringArray:
		return PackedStringArray(["Authorization: Bearer token-sintetico"])
	func asegurar_identidad() -> bool:
		return true
	func confirmar_ok() -> void:
		pass

var fallos := 0
var tiempo := 1000.0
var respuestas: Array = []
var llamadas: Array = []

func comprobar(condicion: bool, texto: String) -> void:
	print(("PASS " if condicion else "FAIL ") + texto)
	if not condicion:
		fallos += 1

func reloj() -> float:
	return tiempo

func transportar(url: String, cabeceras: PackedStringArray, metodo: int, cuerpo: String) -> Dictionary:
	llamadas.append({"url": url, "cabeceras": cabeceras, "metodo": metodo, "cuerpo": cuerpo})
	if respuestas.is_empty():
		return {"result": HTTPRequest.RESULT_CANT_CONNECT, "code": 0, "body": ""}
	return respuestas.pop_front()

func respuesta(codigo: int, doc: Dictionary = {}) -> Dictionary:
	return {"result": HTTPRequest.RESULT_SUCCESS, "code": codigo, "body": JSON.stringify(doc)}

func doc_dispositivo(estado: String, codigo: String = "") -> Dictionary:
	return {"fields": {"estado": {"stringValue": estado}, "codigoActual": {"stringValue": codigo}}}

func _initialize() -> void:
	probar()

func probar() -> void:
	await process_frame
	var auth := AuthFalsa.new()
	root.add_child(auth)
	var servicio := Servicio.new()
	servicio.auth = auth
	servicio.reloj = Callable(self, "reloj")
	servicio.transporte = Callable(self, "transportar")
	servicio.base_url_forzada = "http://127.0.0.1:8080/v1/projects/demo-tfg-vr/databases/(default)/documents"
	servicio.ruta_cfg = "user://test_pr4b_vinculacion.cfg"
	root.add_child(servicio)
	respuestas.append(respuesta(404))
	respuestas.append(respuesta(200))
	await servicio.iniciar()
	comprobar(servicio.estado_efectivo() == "pendiente", "crea solicitud pendiente")
	comprobar(Servicio.codigo_valido(servicio.codigo) and servicio.codigo_mostrado().length() == 9, "código válido de 8 símbolos")
	comprobar(llamadas.size() == 2 and llamadas[0].metodo == HTTPClient.METHOD_GET and llamadas[1].metodo == HTTPClient.METHOD_POST, "lee documento propio y crea batch")
	var commit: Dictionary = JSON.parse_string(llamadas[1].cuerpo)
	var escrituras: Array = commit.get("writes", [])
	comprobar(escrituras.size() == 2 and escrituras[0].update.name.ends_with("/dispositivos/gafa-sintetica") and escrituras[1].update.name.ends_with("/vinculos/" + servicio.codigo), "batch atómico con rutas de reglas propuestas")
	comprobar(escrituras[0].update.fields.keys().size() == 2 and escrituras[1].update.fields.keys().size() == 4, "sin campos clínicos ni mutación de propietario")
	var autorizadas := true
	for llamada in llamadas:
		autorizadas = autorizadas and llamada.url.begins_with("http://127.0.0.1:8080/") and llamada.cabeceras.has("Authorization: Bearer token-sintetico")
	comprobar(autorizadas, "todas las peticiones usan emulador e identidad PR4a")
	var codigo_anterior := servicio.codigo
	respuestas.append(respuesta(200, doc_dispositivo("sin_vincular", codigo_anterior)))
	tiempo += 2.9
	servicio.tick()
	comprobar(llamadas.size() == 2, "no consulta antes de 3 segundos")
	tiempo += 0.1
	await servicio.consultar()
	comprobar(servicio.estado_efectivo() == "pendiente", "mantiene estado pendiente")
	respuestas.append(respuesta(200, doc_dispositivo("vinculado", codigo_anterior)))
	tiempo += 3.0
	await servicio.consultar()
	comprobar(servicio.estado_efectivo() == "vinculado" and servicio.codigo == "", "oculta código al vincular")
	comprobar(servicio._proxima_consulta == tiempo + 3.0, "consulta vinculación y revocación cada 3 segundos")
	respuestas.append(respuesta(200, doc_dispositivo("revocado", codigo_anterior)))
	tiempo += 3.0
	await servicio.consultar()
	comprobar(servicio.estado_efectivo() == "revocado" and not servicio.puede_regenerar(), "detecta revocación y bloquea regeneración")
	var panel := VinculacionPanelScript.new()
	root.add_child(panel)
	panel._construir_ui()
	comprobar(panel.get_child_count() == 7 and panel._lbl_titulo.text == "VINCULAR ESTA GAFA", "panel 3D construye sus seis etiquetas")
	comprobar(not panel._lbl_titulo.text.contains("Paciente") and panel._lbl_codigo.text == "", "panel no muestra datos de pacientes")
	panel.queue_free()
	comprobar(load("res://hub_manager.gd") is GDScript, "Hub carga con el panel integrado")
	servicio.detener()
	servicio.queue_free()
	llamadas.clear()
	respuestas.append(respuesta(404))
	respuestas.append(respuesta(200))
	var nuevo_servicio := Servicio.new()
	nuevo_servicio.auth = auth
	nuevo_servicio.reloj = Callable(self, "reloj")
	nuevo_servicio.transporte = Callable(self, "transportar")
	nuevo_servicio.base_url_forzada = "http://127.0.0.1:8080/v1/projects/demo-tfg-vr/databases/(default)/documents"
	nuevo_servicio.ruta_cfg = "user://test_pr4b_caducidad.cfg"
	root.add_child(nuevo_servicio)
	await nuevo_servicio.iniciar()
	var codigo_caducado: String = nuevo_servicio.codigo
	tiempo = nuevo_servicio.expira + 1.0
	comprobar(nuevo_servicio.estado_efectivo() == "caducado" and nuevo_servicio.puede_regenerar(), "detecta caducidad y permite regenerar")
	respuestas.append(respuesta(200))
	respuestas.append(respuesta(200))
	await nuevo_servicio.regenerar()
	comprobar(nuevo_servicio.estado_efectivo() == "pendiente" and nuevo_servicio.codigo != codigo_caducado, "rota código caducado")
	var ultimo_commit: Dictionary = JSON.parse_string(llamadas[2].cuerpo)
	comprobar(ultimo_commit.writes[0].updateMask.fieldPaths == ["codigoActual"] and llamadas[3].metodo == HTTPClient.METHOD_DELETE, "rotación solo cambia codigoActual y cancela vínculo anterior")
	respuestas.append({"result": HTTPRequest.RESULT_CANT_CONNECT, "code": 0, "body": ""})
	await nuevo_servicio.consultar()
	comprobar(nuevo_servicio.estado_efectivo() == "error" and nuevo_servicio.mensaje().contains("wifi"), "error de conexión comprensible")
	nuevo_servicio.detener()
	nuevo_servicio.queue_free()
	auth.queue_free()
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://test_pr4b_vinculacion.cfg"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://test_pr4b_caducidad.cfg"))
	print("PR4b: %d fallos" % fallos)
	quit(1 if fallos > 0 else 0)
