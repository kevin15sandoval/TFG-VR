# Pruebas de reglas de Firestore (F0)

Suite que carga `Plataforma_Clinica/firestore.rules` (reglas versionadas ACTUALES, sin modificar) en el emulador local de Firestore y comprueba el comportamiento con usuario no autenticado y autenticado (token genérico), usando solo datos sintéticos.

## Ejecución

```bash
cd Plataforma_Clinica
pnpm install          # (o: npx pnpm@9 install)
pnpm test:rules       # arranca emuladores Firestore + Auth, lanza `node --test` (secuencial) y los apaga
```

## Requisitos

- Node 20+ (probado con Node 24; usa `node:test`).
- Java en el PATH. `firebase-tools` 15.x exige **JDK 21 o superior** (con JDK 17 falla con "no longer supports Java version before 21").
- Primera ejecución: `firebase-tools` descarga el JAR del emulador de Firestore (necesita red solo para esa descarga).

## Qué cubre

`pacientes`, `sesiones`, `sesion_activa`, `dispositivos` (lectura, creación, actualización, borrado), colecciones sin regla (denegación por defecto) y el contrato de Godot sin token (GET `sesion_activa/current` y POST `sesiones` permitidos; PATCH y DELETE de `sesion_activa` denegados).

Cada test lleva una etiqueta:

- `[ESPERADO]`: comportamiento deseable que ya se cumple.
- `[HALLAZGO]`: comportamiento indeseado que HOY está permitido (p. ej. anónimo borra sesiones, anónimo lee `sesion_activa` con `patientName`, anónimo altera dispositivos). Los tests pasan describiendo el estado actual; al endurecer las reglas en fases posteriores hay que invertir la aserción (`assertSucceeds` pasa a `assertFails`).

## Seguridad

- Proyecto ficticio `demo-tfg-vr`: el emulador no contacta con ningún proyecto real de Firebase.
- No requiere `firebase login` ni credenciales; no se despliega nada.
- Los logs del emulador (`firestore-debug.log`, etc.) están en `.gitignore`.

## PR1 - Emulador de Auth y acceso anonimo

`firebase.json` incluye el emulador de Authentication (127.0.0.1:9099) y `test:rules` usa `--only firestore,auth`. Los ficheros de test se ejecutan en secuencia (`--test-concurrency=1`) porque comparten el mismo emulador de Firestore y se limpian entre si.

`anonymous-auth.characterization.test.mjs` crea un usuario anonimo REAL en el emulador de Auth (`accounts:signUp`), comprueba en el JWT que `firebase.sign_in_provider === 'anonymous'` y hace peticiones REST a Firestore con `Authorization: Bearer <idToken>`, como lo haria Godot. Demuestra, contra las reglas ACTUALES, que un anonimo con token lee/escribe `pacientes`, lee/modifica/borra `sesiones`, escribe/borra `sesion_activa` y lee/lista/actualiza `dispositivos`: por eso NO se puede activar Anonymous Auth sin endurecer antes las reglas. Incluye contrastes `[ESPERADO]` sin token. Datos solo sinteticos (`PACIENTE-SINTETICO-1`...).

Todo es local: proyecto ficticio `demo-tfg-vr`, sin `firebase login`, sin despliegue, sin red hacia produccion. Requiere JDK 21+.
