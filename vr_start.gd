extends Node3D

func _ready():
	print("=== PREPARANDO OPENXR ===")
	await get_tree().process_frame
	start_openxr()

func start_openxr():
	print("=== INICIANDO OPENXR ===")

	var xr_interface = XRServer.find_interface("OpenXR")

	if xr_interface == null:
		print("ERROR: OpenXR no encontrado")
		return

	if not xr_interface.is_initialized():
		var initialized = xr_interface.initialize()
		print("Resultado initialize(): ", initialized)

	if xr_interface.is_initialized():
		get_viewport().use_xr = true
		print("OpenXR iniciado correctamente")
	else:
		print("ERROR: OpenXR no pudo inicializarse")
