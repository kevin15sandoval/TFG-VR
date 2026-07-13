extends Node3D
# ─────────────────────────────────────────────────────────────────────────────
# VaultModelSetup — Modifica materiales del modelo del banco
# Cambia el color de los billetes a verde dólar
# ─────────────────────────────────────────────────────────────────────────────

func _ready() -> void:
	print("[VaultModel] 🏦 Inicializando setup del modelo...")
	await get_tree().process_frame
	_setup_materials()

func _setup_materials() -> void:
	print("[VaultModel] 🎨 Buscando materiales de billetes...")
	
	# Color verde dólar (verde billete americano)
	var dollar_green = Color(0.52, 0.73, 0.55, 1.0)  # Verde dólar característico
	
	var modified_count = 0
	
	# Recursivamente buscar todos los MeshInstance3D
	_process_node(self, dollar_green, modified_count)
	
	print("[VaultModel] ✅ Materiales modificados: ", modified_count)

func _process_node(node: Node, dollar_color: Color, modified_count: int) -> int:
	# Si es un MeshInstance3D, procesar sus materiales
	if node is MeshInstance3D:
		var mesh_instance = node as MeshInstance3D
		
		# Revisar el nombre del nodo para identificar billetes
		var node_name = node.name.to_lower()
		
		# Buscar nodos que puedan ser billetes (bill, money, cash, note, dollar, etc.)
		if "bill" in node_name or "money" in node_name or "cash" in node_name or \
		   "note" in node_name or "dollar" in node_name or "papel" in node_name:
			print("[VaultModel]   💵 Encontrado posible billete: ", node.name)
			modified_count += _modify_material(mesh_instance, dollar_color)
		
		# También buscar por color actual (amarillo/crema)
		elif mesh_instance.mesh:
			for i in range(mesh_instance.mesh.get_surface_count()):
				var mat = mesh_instance.get_surface_override_material(i)
				if not mat:
					mat = mesh_instance.mesh.surface_get_material(i)
				
				if mat and mat is StandardMaterial3D:
					var std_mat = mat as StandardMaterial3D
					var color = std_mat.albedo_color
					
					# Si es amarillo/crema (probablemente billetes)
					if color.r > 0.7 and color.g > 0.7 and color.b < 0.7:
						print("[VaultModel]   💵 Encontrado material amarillo (billete): ", node.name, " surface ", i)
						modified_count += 1
						
						# Crear copia del material y cambiar color
						var new_mat = std_mat.duplicate()
						new_mat.albedo_color = dollar_color
						mesh_instance.set_surface_override_material(i, new_mat)
	
	# Recursivamente procesar hijos
	for child in node.get_children():
		modified_count = _process_node(child, dollar_color, modified_count)
	
	return modified_count

func _modify_material(mesh_instance: MeshInstance3D, dollar_color: Color) -> int:
	var count = 0
	
	if not mesh_instance.mesh:
		return 0
	
	# Modificar todos los materiales del mesh
	for i in range(mesh_instance.mesh.get_surface_count()):
		var mat = mesh_instance.get_surface_override_material(i)
		if not mat:
			mat = mesh_instance.mesh.surface_get_material(i)
		
		if mat and mat is StandardMaterial3D:
			# Crear copia del material y cambiar a verde dólar
			var new_mat = (mat as StandardMaterial3D).duplicate()
			new_mat.albedo_color = dollar_color
			mesh_instance.set_surface_override_material(i, new_mat)
			count += 1
			print("[VaultModel]     ✅ Material cambiado a verde dólar")
	
	return count
