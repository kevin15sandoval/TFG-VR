extends RefCounted
# ─────────────────────────────────────────────────────────────────────────────
# FirebaseConfig — Selección de URLs y clave pública de Firebase (sin autoload, solo estático)
# Producción por defecto (proyecto tfg-vr). El modo emulador SOLO se activa en el editor o en una
# build de depuración Y con TFGVR_EMULATOR=1 o el argumento de usuario --emulator.
# En una build release el emulador se ignora SIEMPRE.
# Uso: const FirebaseConfig = preload("res://scripts/firebase_config.gd")
# ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID := "tfg-vr"
const FIRESTORE_PROD := "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents"
const SIGNUP_PROD := "https://identitytoolkit.googleapis.com/v1/accounts:signUp"
const TOKEN_PROD := "https://securetoken.googleapis.com/v1/token"

# Emulador local (solo estas consts contienen la IP local; la prueba PR4a lo comprueba)
const EMU_FIRESTORE := "http://127.0.0.1:8080/v1/projects/demo-tfg-vr/databases/(default)/documents"
const EMU_SIGNUP := "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp"
const EMU_TOKEN := "http://127.0.0.1:9099/securetoken.googleapis.com/v1/token"
const EMU_API_KEY := "fake-api-key"

const ENV_EMULADOR := "TFGVR_EMULATOR"
const ENV_API_KEY := "TFGVR_FIREBASE_API_KEY"
const ARG_EMULADOR := "--emulator"
# Archivo local NO versionado con la clave pública de cliente (ver scripts/README_firebase_config.md)
const RUTAS_CFG_CLAVE := ["user://firebase_public.cfg", "res://firebase_public.cfg"]

# ─── Funciones puras (reciben los datos, así se pueden probar) ───────────────

## true solo si es editor/debug Y se pidió el emulador por variable de entorno o argumento
static func emulador_permitido(editor_o_debug: bool, valor_env: String, args: PackedStringArray) -> bool:
	if not editor_o_debug:
		return false
	return valor_env == "1" or args.has(ARG_EMULADOR)

static func base_url_para(emulador: bool) -> String:
	return EMU_FIRESTORE if emulador else FIRESTORE_PROD

static func auth_url_para(emulador: bool) -> String:
	return EMU_SIGNUP if emulador else SIGNUP_PROD

static func token_url_para(emulador: bool) -> String:
	return EMU_TOKEN if emulador else TOKEN_PROD

## Clave de API según el modo: en emulador "fake-api-key"; si no, la primera fuente no vacía
static func api_key_para(emulador: bool, valor_env: String, valor_archivo: String) -> String:
	if emulador:
		return EMU_API_KEY
	if valor_env.strip_edges() != "":
		return valor_env.strip_edges()
	return valor_archivo.strip_edges()

# ─── API pública (lee el entorno real) ───────────────────────────────────────

static func es_emulador() -> bool:
	return emulador_permitido(OS.has_feature("editor") or OS.is_debug_build(),
		OS.get_environment(ENV_EMULADOR), OS.get_cmdline_user_args())

static func base_url() -> String:
	return base_url_para(es_emulador())

static func auth_url() -> String:
	return auth_url_para(es_emulador())

static func token_url() -> String:
	return token_url_para(es_emulador())

## Devuelve "" si no hay clave configurada (DeviceAuth lo trata como error controlado)
static func api_key() -> String:
	var emu := es_emulador()
	if emu:
		return EMU_API_KEY
	return api_key_para(false, OS.get_environment(ENV_API_KEY), _leer_clave_archivo())

static func _leer_clave_archivo() -> String:
	for ruta in RUTAS_CFG_CLAVE:
		var cfg := ConfigFile.new()
		if cfg.load(ruta) == OK:
			var v := str(cfg.get_value("firebase", "api_key", "")).strip_edges()
			if v != "":
				return v
	return ""
