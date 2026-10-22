extends "res://vr_start.gd"
# ─────────────────────────────────────────────────────────────────────────────
# VRStartSinRed — vr_start.gd con la única petición HTTP directa anulada
# Solo para pruebas de regresión. _clear_firestore_session() hace un DELETE
# directo a Firestore con una URL fija; aquí se sustituye por un contador
# para que la prueba no toque nunca la red.
# ─────────────────────────────────────────────────────────────────────────────

var limpiezas := 0

func _clear_firestore_session() -> void:
	limpiezas += 1
