extends Node
# ─────────────────────────────────────────────────────────────────────────────
# StubFirebaseManager — Sustituto SIN RED de scripts/firebase_manager.gd
# Solo para pruebas de regresión: registra las llamadas y no hace ninguna petición HTTP.
# Expone la misma interfaz que usan los scripts de arranque de los minijuegos.
# ─────────────────────────────────────────────────────────────────────────────

signal config_loaded(config: Dictionary)
signal config_error(msg: String)
signal results_saved()
signal results_error(msg: String)
signal new_session_detected(config: Dictionary)

var guardados: Array = []   # resultados recibidos en save_results
var completadas := 0        # llamadas a mark_session_completed
var polling_iniciado := false
var polling_detenido := 0

func start_polling() -> void:
	polling_iniciado = true

func stop_polling() -> void:
	polling_detenido += 1

func save_results(results: Dictionary) -> void:
	guardados.append(results)

func mark_session_completed() -> void:
	completadas += 1
