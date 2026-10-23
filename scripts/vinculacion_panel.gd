extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VinculacionPanel — Pantalla de vinculación de la gafa en el Hub (Quest 3)
# - Panel fijo delante del jugador (orientado a él, texto grande, alto contraste, sin parpadeos).
# - Muestra: código XXXX-XXXX, cuenta atrás mm:ss, estado (Pendiente / Vinculado / Revocado / Caducado) y mensajes.
# - Sin datos personales: la pantalla solo conoce el código, su cuenta atrás y el estado de la gafa.
# - Interacción: botón B del mando derecho (by_button) = nuevo código. Si el código sigue pendiente, hay que
#   pulsar B dos veces (confirmación de 4 s) para evitar cancelaciones accidentales. En escritorio: tecla R.
# - No bloquea el Hub: si la autenticación no está disponible solo muestra el aviso.
# Uso (desde hub_manager.gd): panel = VinculacionPanelScript.new(); add_child(panel); panel.iniciar(firebase_manager, hub)
# ─────────────────────────────────────────────────────────────────────────────

const VRUI = preload("res://scripts/vr_ui.gd")
const ServicioScript = preload("res://scripts/vinculacion_service.gd")

const POSICION_PANEL := Vector3(0.0, 1.45, 1.0)   # el jugador está en z ≈ 3, ojos a 1,8 m: ~2 m de distancia
const VENTANA_CONFIRMACION_S := 4.0
const BOTON_REGENERAR := "by_button"

const COLOR_TITULO := Color(0.35, 0.85, 1.0)
const COLOR_CODIGO := Color(1.0, 1.0, 1.0)
const COLOR_TEXTO := Color(0.95, 0.95, 0.95)
const COLOR_PENDIENTE := Color(1.0, 0.85, 0.2)
const COLOR_OK := Color(0.4, 1.0, 0.5)
const COLOR_ERROR := Color(1.0, 0.45, 0.4)

var servicio: Node = null
var _lbl_titulo: Label3D
var _lbl_codigo: Label3D
var _lbl_cuenta: Label3D
var _lbl_estado: Label3D
var _lbl_mensaje: Label3D
var _lbl_ayuda: Label3D
var _confirmar_hasta := 0.0
var _mando: XRController3D = null

## `firebase_manager`: activa DeviceAuth de forma explícita (solo aquí). `hub`: raíz con XROrigin3D (mandos).
func iniciar(firebase_manager: Node, hub: Node = null) -> void:
	_construir_ui()
	servicio = ServicioScript.new()
	servicio.name = "VinculacionService"
	add_child(servicio)
	if firebase_manager != null and firebase_manager.has_method("activar_device_auth"):
		servicio.auth = firebase_manager.activar_device_auth()
	servicio.cambiado.connect(_refrescar)
	if hub != null:
		_mando = hub.get_node_or_null("XROrigin3D/RightController") as XRController3D
		if _mando != null:
			_mando.button_pressed.connect(_on_boton)
	_refrescar()
	servicio.iniciar()   # asíncrono: no bloquea el Hub

func _construir_ui() -> void:
	position = POSICION_PANEL
	name = "VinculacionPanel"
	# Fondo opaco oscuro (billboard) ligeramente detrás de los textos
	var fondo := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(2.3, 1.7)
	fondo.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.03, 0.05, 0.12)
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	fondo.material_override = mat
	fondo.position = Vector3(0.0, 0.0, -0.03)
	fondo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(fondo)
	_lbl_titulo = VRUI.crear_label(self, Vector3(0.0, 0.68, 0.0), 56, COLOR_TITULO, 8, true, "VINCULAR ESTA GAFA")
	_lbl_codigo = VRUI.crear_label(self, Vector3(0.0, 0.36, 0.0), 150, COLOR_CODIGO, 14, true, "")
	_lbl_cuenta = VRUI.crear_label(self, Vector3(0.0, 0.08, 0.0), 60, COLOR_PENDIENTE, 8, true, "")
	_lbl_estado = VRUI.crear_label(self, Vector3(0.0, -0.14, 0.0), 64, COLOR_PENDIENTE, 8, true, "")
	_lbl_mensaje = VRUI.crear_label(self, Vector3(0.0, -0.40, 0.0), 42, COLOR_TEXTO, 6, true, "")
	_lbl_ayuda = VRUI.crear_label(self, Vector3(0.0, -0.70, 0.0), 36, Color(0.7, 0.8, 0.9), 5, true, "")
	for l in [_lbl_mensaje, _lbl_ayuda]:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.width = 1000.0   # píxeles de Label3D (~2 m con pixel_size 0.002)

func _process(_delta: float) -> void:
	# Solo la cuenta atrás cambia con el reloj; los textos se reasignan únicamente si cambian (sin parpadeos)
	if servicio != null:
		_refrescar()

func _refrescar() -> void:
	if servicio == null or _lbl_codigo == null:
		return
	var e: String = servicio.estado_efectivo()
	var con_codigo: bool = servicio.codigo != "" and e != "vinculado" and e != "revocado"
	_poner_texto(_lbl_codigo, servicio.codigo_mostrado() if con_codigo else "")
	var cuenta := ""
	if con_codigo:
		cuenta = "Caducado" if e == "caducado" else "Caduca en " + servicio.cuenta_atras()
	_poner_texto(_lbl_cuenta, cuenta)
	_poner_texto(_lbl_estado, "Estado: " + servicio.titulo_estado())
	var color := COLOR_PENDIENTE
	if e == "vinculado":
		color = COLOR_OK
	elif e == "revocado" or e == "error" or e == "caducado":
		color = COLOR_ERROR
	_lbl_estado.modulate = color
	_lbl_cuenta.modulate = COLOR_ERROR if e == "caducado" else COLOR_PENDIENTE
	_poner_texto(_lbl_mensaje, servicio.mensaje())
	_poner_texto(_lbl_ayuda, _texto_ayuda(e))

func _texto_ayuda(e: String) -> String:
	if _confirmar_hasta > servicio.ahora():
		return "Pulse B otra vez para cancelar este código y crear uno nuevo."
	if e == "pendiente":
		return "B (mando derecho): código nuevo"
	if (e == "caducado" or e == "error") and servicio.puede_regenerar():
		return "B (mando derecho): reintentar"
	return ""

func _poner_texto(l: Label3D, t: String) -> void:
	if l.text != t:
		l.text = t

func _on_boton(nombre: String) -> void:
	if nombre == BOTON_REGENERAR:
		solicitar_regenerar()

func _unhandled_key_input(event: InputEvent) -> void:
	# Escritorio (pruebas sin casco): tecla R
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_R:
		solicitar_regenerar()

## Pulsación del usuario: caducado/error = inmediato; pendiente = doble pulsación en 4 s
func solicitar_regenerar() -> void:
	if servicio == null or not servicio.puede_regenerar():
		return
	var e: String = servicio.estado_efectivo()
	if e == "pendiente":
		var t: float = servicio.ahora()
		if _confirmar_hasta < t:
			_confirmar_hasta = t + VENTANA_CONFIRMACION_S
			_refrescar()
			return
	_confirmar_hasta = 0.0
	servicio.regenerar()
