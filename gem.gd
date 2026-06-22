extends Area3D

var collected := false

@export var gem_type := "normal"
@export var points := 10

func _process(delta):
	rotation.y += delta * 2.0

func _on_area_entered(area):
	collect()

func _on_body_entered(body):
	collect()

func collect():

	if collected:
		return

	collected = true

	GameManager.collect_gem(gem_type, points)

	match gem_type:

		"normal":
			print("💎 Gema normal +10")

		"golden":
			print("🏆 Gema dorada +25")

		"red":
			print("❌ Obstáculo tocado -5")

		"green":
			print("🟢 Ayuda terapéutica")

		"purple":
			print("🟣 Objetivo lateral")

	queue_free()
