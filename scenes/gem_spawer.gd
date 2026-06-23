extends Node3D

@export var gem_scene: PackedScene
@export var gem_speed := 1.2

var current_index := 0
var active_gem = null

var exercises := [
	{
		"name": "Flexión",
		"instruction": "Sube el brazo para alcanzar la gema",
		"start": Vector3(0, 2.2, -4),
		"end": Vector3(0, 1.6, -1.2)
	},
	{
		"name": "Extensión",
		"instruction": "Baja el brazo de forma controlada",
		"start": Vector3(0, 0.8, -4),
		"end": Vector3(0, 1.2, -1.2)
	},
	{
		"name": "Abducción",
		"instruction": "Separa el brazo hacia fuera",
		"start": Vector3(1.6, 1.5, -4),
		"end": Vector3(0.8, 1.5, -1.2)
	},
	{
		"name": "Aducción",
		"instruction": "Lleva el brazo hacia el centro",
		"start": Vector3(-1.6, 1.5, -4),
		"end": Vector3(-0.3, 1.5, -1.2)
	},
	{
		"name": "Rotación externa",
		"instruction": "Gira el brazo hacia fuera",
		"start": Vector3(1.2, 1.9, -4),
		"end": Vector3(0.8, 1.6, -1.2)
	},
	{
		"name": "Rotación interna",
		"instruction": "Gira el brazo hacia dentro",
		"start": Vector3(-1.2, 1.1, -4),
		"end": Vector3(-0.5, 1.4, -1.2)
	}
]

func _ready():
	spawn_next_exercise()

func _process(delta):
	if active_gem == null:
		return

	var target = exercises[current_index]["end"]
	active_gem.global_position = active_gem.global_position.move_toward(target, gem_speed * delta)

func spawn_next_exercise():
	if gem_scene == null:
		print("ERROR: No hay escena de gema asignada")
		return

	if current_index >= exercises.size():
		print("SESIÓN DE PRUEBA COMPLETADA")
		return

	var exercise = exercises[current_index]
	print("Movimiento: ", exercise["name"])
	print("Instrucción: ", exercise["instruction"])

	active_gem = gem_scene.instantiate()
	get_parent().add_child(active_gem)
	active_gem.global_position = exercise["start"]
