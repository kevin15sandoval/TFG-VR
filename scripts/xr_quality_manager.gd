extends Node

## XR Quality Manager - Maximiza calidad de renderizado en VR
## Previene pixelación y mejora claridad visual

func _ready():
	print("[XR QUALITY] Inicializando configuración de calidad VR...")
	
	# Esperar un frame para que XR se inicialice
	await get_tree().process_frame
	
	configure_xr_quality()

func configure_xr_quality():
	var xr_interface = XRServer.find_interface("OpenXR")
	
	if xr_interface and xr_interface.is_initialized():
		print("[XR QUALITY] ✓ OpenXR interface encontrada y inicializada")
		
		# Obtener el viewport principal
		var viewport = get_viewport()
		if viewport:
			# MÁXIMA RESOLUCIÓN - Sin escalado
			viewport.scaling_3d_mode = Viewport.SCALING_3D_MODE_OFF
			viewport.scaling_3d_scale = 1.0
			
			# ANTI-ALIASING MÁXIMO
			viewport.msaa_3d = Viewport.MSAA_8X  # 8x MSAA para máxima calidad
			viewport.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA  # FXAA adicional
			viewport.use_taa = true  # Temporal Anti-Aliasing
			
			# TEXTURAS DE ALTA CALIDAD
			viewport.use_hdr_2d = true
			
			print("[XR QUALITY] ✓ Viewport configurado:")
			print("  - Scaling 3D: OFF (resolución nativa)")
			print("  - MSAA: 8X")
			print("  - Screen Space AA: FXAA")
			print("  - TAA: Habilitado")
			print("  - HDR 2D: Habilitado")
		else:
			print("[XR QUALITY] ⚠ No se pudo obtener viewport")
		
		# Configurar render scale de OpenXR al máximo
		if xr_interface.has_method("set_render_target_size_multiplier"):
			xr_interface.set_render_target_size_multiplier(1.5)  # 150% de resolución nativa
			print("[XR QUALITY] ✓ Render target size: 150% (super-sampling)")
		
		print("[XR QUALITY] ========================")
		print("[XR QUALITY] Configuración de calidad MÁXIMA aplicada")
		print("[XR QUALITY] - Resolución nativa sin reducción")
		print("[XR QUALITY] - Anti-aliasing máximo (8x MSAA + FXAA + TAA)")
		print("[XR QUALITY] - Super-sampling activado (1.5x)")
		print("[XR QUALITY] ========================")
		
	else:
		print("[XR QUALITY] ⚠ OpenXR interface no disponible o no inicializada")
		print("[XR QUALITY] Ejecutando en modo normal (no VR)")
