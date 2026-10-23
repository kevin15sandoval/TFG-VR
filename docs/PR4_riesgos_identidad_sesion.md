# PR4: riesgos de identidad de sesión (diseño, sin implementar)

Estado: PROPUESTO para aprobación. PR4a solo añade `firebase_config.gd` y `device_auth.gd` (inactivos). Nada de lo
de abajo está implementado, salvo lo indicado.

## (d) Ruta real del documento de sesión activa (verificado en el código)
La ruta real es **`sesion_activa/current`**. `session_config/active` NO existe en ningún archivo del repositorio
(solo coincide el nombre de la función `load_session_config`).
- Polling: `scripts/firebase_manager.gd:117` (`COL_SESSION_CONFIG="sesion_activa"`, `DOC_ACTIVE="current"`, líneas 12 y 14).
- Carga puntual: `scripts/firebase_manager.gd:197`. `mark_session_completed` (PATCH `status`): `scripts/firebase_manager.gd:433`.
- DELETE directo con URL fija: `vr_start.gd:752`. Escritura web: `Plataforma_Clinica/app/db.ts:172` (`setDoc(... "current")`).
- Resultados: POST a la colección `sesiones` (`scripts/firebase_manager.gd:246`), id de documento autogenerado.

## (a) Autoarranque de sesiones antiguas
Riesgo: `vr_start.gd:64` arranca Gemas si `GameManager` conserva `session_id`/`patient_id`, y el documento `current`
puede quedar `pending` si el PATCH `completed` falla.
Propuesta: (1) estampa de tiempo local `GameManager.sesion_entregada_en` (ticks) y `sesion_origen = "hub"` puestos solo
por `hub_manager.gd` al llamar a `apply_config`; (2) el autoarranque exige `sesion_origen == "hub"` y antigüedad < 10 min,
si no se llama a `release_session()`; (3) la memoria de `GameManager` manda; `user://` NO se usa para reanudar sesiones
(solo para la cola de (b)); (4) ignorar en el polling documentos `pending` con `createdAt` > 30 min (requiere campo en
la web, PR de web).

## (b) Guardado idempotente y sin pérdida silenciosa
Propuesta: POST con `?documentId=<sessionId>`; **409 (ALREADY_EXISTS) se trata como éxito** (ya guardado). Si el
guardado falla (red, 5xx, 401 tras renovar), el resultado se encola en `user://cola_resultados.json` (sin tokens),
con reintento acotado (p. ej. 3 intentos con backoff, y otro al volver al Hub) y aviso visible al terminar. La identidad
no se libera hasta confirmar o encolar (`release_session_si_confirmado` ya cubre la confirmación). Requiere cambiar el
contrato del POST y las reglas a la vez: PR4b/PR5.

## (c) Identidad de prueba ("test")
Fallbacks con `patient_id: "test"`: `vault_vr_start.gd:279`, `luggage_vr_start.gd:253`, `city_vr_start.gd:367`, y
`hub_manager.gd:225` (`test_config`, solo `OS.is_debug_build()`). Propuesta: añadir `modo_prueba: true` a esas configs y que
`FirebaseManager.save_results` rechace (`results_error("modo_prueba")`) cuando `modo_prueba` o `patient_id == "test"`
en release; en debug se permite solo contra el emulador (`FirebaseConfig.es_emulador()`). Toca los `*_vr_start.gd`:
fuera de PR4a.

## (e) Almacén y caducidad de la identidad
- Identidad del dispositivo (PR4a, implementado): `uid` y `refresh_token` en `user://device_auth.cfg`; el `idToken` solo
  en memoria, renovado a ~50 min o tras un 401 (una vez). No caduca por tiempo (lo revoca Firebase); `olvidar_identidad()`
  la borra.
- Identidad clínica de la sesión (`patient_id`, `session_id`, `patient_name`): solo en memoria de `GameManager`, con la
  estampa de (a). Propuesta de caducidad: 10 min sin iniciar juego, o al confirmar el guardado.
- La clave de API no se versiona (`scripts/README_firebase_config.md`).

## Pendiente de PR4a
Anonymous Auth NO está habilitado en producción: `asegurar_identidad()` devolverá `error_auth` y ningún flujo depende de ello.
Probado: lógica con transporte falso (sin red). Sin probar: Auth real, emulador, Quest 3.
