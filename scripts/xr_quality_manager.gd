extends Node

## XR Quality Manager - Configuración OPTIMIZADA para Meta Quest 2/3/Pro
## Balance entre calidad visual y rendimiento estable
## Previene throttling térmico y degradación progresiva

func _ready():
	print("[XR QUALITY] =====================================================")
	print("[XR QUALITY] Inicializando configuración optimizada VR...")
	print("[XR QUALITY] =====================================================")
	
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
			# ===== RESOLUCIÓN Y ESCALADO =====
			# 1.0 = resolución nativa sin super-sampling
			# Evita sobrecarga y throttling térmico
			viewport.scaling_3d_scale = 1.0
			
			# ===== ANTI-ALIASING =====
			# TAA (Temporal AA) da buena calidad sin overhead
			viewport.use_taa = true
			viewport.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA  # FXAA ligero
			
			# ===== MSAA MODERADO =====
			# 4x MSAA es el sweet spot (2x es poco, 8x es excesivo)
			viewport.msaa_3d = Viewport.MSAA_4X
			
			# ===== TEXTURAS Y HDR =====
			viewport.use_hdr_2d = true
			viewport.use_debanding = true  # Elimina bandas de color
			
			# ===== SHARPENING (NITIDEZ) =====
			if viewport.has_method("set_fsr_sharpness"):
				viewport.set_fsr_sharpness(0.3)  # Nitidez moderada
			
			print("[XR QUALITY] ✓ Viewport configurado (OPTIMIZADO):")
			print("[XR QUALITY]   - Scaling 3D: 1.0 (resolución nativa)")
			print("[XR QUALITY]   - MSAA: 4X (balance calidad/rendimiento)")
			print("[XR QUALITY]   - Screen Space AA: FXAA")
			print("[XR QUALITY]   - TAA: Habilitado")
			print("[XR QUALITY]   - HDR 2D: Habilitado")
			print("[XR QUALITY]   - Debanding: Habilitado")
			print("[XR QUALITY]   - Sharpening: 0.3")
		else:
			print("[XR QUALITY] ⚠ No se pudo obtener viewport")
		
		# ===== RENDER TARGET SIZE =====
		# 1.0x = Resolución nativa (NO super-sampling)
		# Meta Quest 2: 1832x1920 por ojo
		# Meta Quest 3: 2064x2208 por ojo
		# Meta Quest Pro: 1800x1920 por ojo
		# Usar resolución nativa previene throttling
		
		if xr_interface.has_method("set_render_target_size_multiplier"):
			xr_interface.set_render_target_size_multiplier(1.0)  # Resolución nativa
			print("[XR QUALITY] ✓ Render target: 1.0x (resolución nativa)")
		
		# ===== FOVEATED RENDERING =====
		# Nivel 2 = Óptimo para Meta Quest (reduce carga sin pérdida perceptible)
		if xr_interface.has_method("set_foveation_level"):
			xr_interface.set_foveation_level(2)  # Nivel medio (0=off, 1=low, 2=med, 3=high)
			print("[XR QUALITY] ✓ Foveated rendering: Nivel 2 (MEDIO)")
		
		# ===== DYNAMIC FOVEATION =====
		# Ajusta foveation dinámicamente según carga
		if xr_interface.has_method("set_foveation_dynamic"):
			xr_interface.set_foveation_dynamic(true)
			print("[XR QUALITY] ✓ Foveation dinámica: HABILITADA")
		
		# ===== CONFIGURACIÓN ADICIONAL DE CALIDAD =====
		RenderingServer.set_default_clear_color(Color(0, 0, 0, 1))
		
		print("[XR QUALITY] =====================================================")
		print("[XR QUALITY] CONFIGURACIÓN OPTIMIZADA APLICADA")
		print("[XR QUALITY] =====================================================")
		print("[XR QUALITY] Meta Quest 2: 1832x1920 por ojo (nativo)")
		print("[XR QUALITY] Meta Quest 3: 2064x2208 por ojo (nativo)")
		print("[XR QUALITY] Meta Quest Pro: 1800x1920 por ojo (nativo)")
		print("[XR QUALITY] =====================================================")
		print("[XR QUALITY] ✓ Resolución nativa (previene throttling)")
		print("[XR QUALITY] ✓ Anti-aliasing equilibrado (4x MSAA + FXAA + TAA)")
		print("[XR QUALITY] ✓ Foveated rendering nivel 2 (dinámico)")
		print("[XR QUALITY] ✓ Debanding y sharpening habilitados")
		print("[XR QUALITY] =====================================================")
		print("[XR QUALITY] CALIDAD ESTABLE Y RENDIMIENTO SOSTENIDO")
		print("[XR QUALITY] =====================================================")
		
	else:
		print("[XR QUALITY] ⚠ OpenXR interface no disponible")
		print("[XR QUALITY] Ejecutando en modo normal (no VR)")

