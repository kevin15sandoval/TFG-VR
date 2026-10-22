extends RefCounted
# ─────────────────────────────────────────────────────────────────────────────
# VRUI — Utilidades estáticas de interfaz VR compartidas entre minijuegos
# Sin estado, sin autoload. Uso:
#   const VRUI = preload("res://scripts/vr_ui.gd")
#   hud_score = VRUI.crear_label(xr_camera, Vector3(-0.6, 0.4, -1.2), 48, Color(1.0, 0.9, 0.0), 6, false)
# ─────────────────────────────────────────────────────────────────────────────

## Crea un Label3D con el formato común del HUD (contorno negro, billboard, pixel_size 0.002)
## y lo añade como hijo de `padre` (normalmente la XRCamera3D). Devuelve la etiqueta creada.
static func crear_label(padre: Node, pos: Vector3, tam_fuente: int, color: Color, contorno: int, visible_inicial := true, texto := "") -> Label3D:
	var label := Label3D.new()
	label.pixel_size = 0.002
	label.position = pos
	label.font_size = tam_fuente
	label.modulate = color
	label.outline_size = contorno
	label.outline_modulate = Color.BLACK
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.visible = visible_inicial
	if texto != "":
		label.text = texto
	padre.add_child(label)
	return label
