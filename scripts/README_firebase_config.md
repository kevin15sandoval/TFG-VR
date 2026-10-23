# Configuración de Firebase en Godot (PR4a)

`firebase_config.gd` elige las URLs y la clave pública de cliente. **La clave no está en el repositorio.**

## Clave de API (necesaria solo para `DeviceAuth`)
Sin clave, `DeviceAuth.asegurar_identidad()` emite `error_auth("sin_clave_api")` y el resto del juego funciona igual.
Orden de búsqueda (la primera no vacía):
1. Variable de entorno `TFGVR_FIREBASE_API_KEY`.
2. `user://firebase_public.cfg` (en el Quest: carpeta de datos de la app).
3. `res://firebase_public.cfg` (solo desarrollo; está en `.gitignore`).

Formato del archivo:
```
[firebase]
api_key="<web API key del proyecto tfg-vr>"
```
Es la clave pública de cliente (no es un secreto administrativo), pero no se versiona. Nunca pongas aquí credenciales de
cuenta de servicio.

## Emulador (solo editor o build de depuración)
`TFGVR_EMULATOR=1` o argumento de usuario `--emulator` (`godot -- --emulator`). Usa Firestore 127.0.0.1:8080,
Auth 127.0.0.1:9099, proyecto `demo-tfg-vr` y la clave `fake-api-key`. En una build release se ignora siempre.
