extends Node

var score: int = 0
var gems_collected: int = 0

var normal_gems: int = 0
var golden_gems: int = 0
var red_gems: int = 0
var green_gems: int = 0
var purple_gems: int = 0

var session_duration: float = 180.0
var start_time: float = 0.0
var game_finished: bool = false

func _ready():
	start_session(180.0)

func start_session(duration_seconds: float):
	score = 0
	gems_collected = 0

	normal_gems = 0
	golden_gems = 0
	red_gems = 0
	green_gems = 0
	purple_gems = 0

	game_finished = false
	session_duration = duration_seconds
	start_time = Time.get_ticks_msec() / 1000.0

	print("Sesión iniciada. Duración: ", session_duration, " segundos")

func _process(delta):
	if game_finished:
		return

	if get_elapsed_time() >= session_duration:
		finish_session()

func collect_gem(gem_type: String, points: int):
	if game_finished:
		return

	score += points
	gems_collected += 1

	match gem_type:
		"normal":
			normal_gems += 1
		"golden":
			golden_gems += 1
		"red":
			red_gems += 1
		"green":
			green_gems += 1
		"purple":
			purple_gems += 1
		_:
			normal_gems += 1

	print("Gema recogida: ", gem_type)
	print("Puntos obtenidos: ", points)
	print("Puntuación total: ", score)
	print("Gemas totales: ", gems_collected)

func get_elapsed_time() -> float:
	return (Time.get_ticks_msec() / 1000.0) - start_time

func get_remaining_time() -> float:
	return max(session_duration - get_elapsed_time(), 0.0)

func get_average_time_per_gem() -> float:
	if gems_collected <= 0:
		return 0.0

	return get_elapsed_time() / gems_collected

func finish_session():
	if game_finished:
		return

	game_finished = true

	print("======== RESULTADOS DE SESIÓN ========")
	print("Puntuación final: ", score)
	print("Gemas totales: ", gems_collected)
	print("Gemas normales: ", normal_gems)
	print("Gemas doradas: ", golden_gems)
	print("Gemas rojas: ", red_gems)
	print("Gemas verdes: ", green_gems)
	print("Gemas moradas: ", purple_gems)
	print("Tiempo total: ", get_elapsed_time())
	print("Tiempo medio por gema: ", get_average_time_per_gem())
