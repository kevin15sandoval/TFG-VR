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

## PR3 - Propuesta de reglas con roles (`firestore.rules.next`)

IMPORTANTE: `Plataforma_Clinica/firestore.rules.next` es una PROPUESTA. **NO esta desplegada, NO sustituye a `firestore.rules`** (que sigue intacto y es lo que usa `firebase.json`) y la app web y Godot actuales NO son compatibles con ella (ver "Cambios necesarios en clientes"). Solo la carga `roles.rules-next.test.mjs`.

Ejecucion (misma orden que F0/PR1; corre las 3 suites en secuencia, 153 tests: 44 de F0/PR1 contra las reglas actuales + 109 de PR3 contra `rules.next`):

```bash
cd Plataforma_Clinica
pnpm test:rules
```

`roles.rules-next.test.mjs` usa tokens simulados de `@firebase/rules-unit-testing` (`firebase.sign_in_provider` = `anonymous` o `password`, `email_verified`) y, en el ultimo grupo, tokens REALES del emulador de Auth (anonimo y email/password verificado con `accounts:update` + `Bearer owner`, solo emulador).

### Que cubre PR3

- Roles: `usuarios/{uid}` sin escritura de cliente; un anonimo no puede crearse/editarse rol; un clinico no escala a admin; un anonimo con `usuarios/{uid}` plantado NO es clinico; clinico sin rol, rol desconocido o sin email verificado denegado.
- Vinculacion: solicitud de la gafa (batch `dispositivos` + `vinculos`), codigo fuera del alfabeto de 31 simbolos/longitud, `expira` > 10 min, `deviceUid` ajeno, sin batch coherente, colision de codigo; confirmacion valida y todas las denegaciones (expirado, usado, ya vinculado, ownerUid distinto, solo uno de los dos docs, claves extra, timestamps falsos, sin rol, sin email verificado, anonimo, gafa autoautorizandose o cambiando ownerUid/estado, segunda confirmacion).
- Revocacion (propietario y admin si; otro clinico y gafa no; estado terminal; tras revocar la gafa no lee `sesion_activa` ni crea resultados), lectura/listado/borrado de `dispositivos`, aislamiento entre gafas y sin token.
- `dispositivos/{uid}/sesion_activa/current`: publicacion valida/invalida solo por el propietario, sin list, la gafa solo PATCH `status` pending->completed.
- `sesiones` (resultados): create-only por la gafa vinculada con la sesion activa vigente, esquema por juego segun `scripts/firebase_manager.gd`, sin `patientName`, duplicados denegados; lectura propia; update clinico solo `notes`.
- `pacientes`: solo clinico, con validacion de esquema; anonimo/gafa vinculada/sin token sin acceso.
- Ajustes aprobados (21 tests nuevos): `sesiones` update clinico `notes` + `updatedAt`; edicion de `alias` por el propietario; `sesion_activa` vencida; revocacion con el MISMO contexto de auth; coincidencia de `gameId` con la sesion activa.

### Mapa de inversion de hallazgos (F0/PR1 -> PR3)

| Hallazgo actual (suite que NO se toca) | Test que lo invierte en `roles.rules-next.test.mjs` |
|---|---|
| F0: cualquier autenticado lee/escribe pacientes; provider `anonymous` accede | `pacientes` (INV-F0-P) + `token real` (INV-PR1) |
| F0: crear/modificar/borrar sesiones sin auth o con cualquier auth | `resultados`: sin token/clinico no crean; la gafa no actualiza ni borra; `patientName`/campos extra denegados (INV-F0-S) |
| F0: `sesion_activa` legible y listable sin token, escribible por cualquier auth | `sesion_activa`: lectura solo gafa vinculada/propietario, sin list, escritura solo propietario (INV-F0-A) + `aislamiento` |
| F0: `dispositivos` legible/listable/alterable sin auth | `dispositivos: lectura, listado y borrado` (INV-F0-D) + `confirmacion` (gafa no se autoriza) |
| PR1: anonimo con token real lee/escribe pacientes, sesiones, sesion_activa, dispositivos | grupo `token real del emulador de Auth` (INV-PR1) |

### Decisiones de los ajustes de PR3 (aprobadas por el autor) y justificacion

1. **Borrado de `dispositivos/{uid}`**: la gafa solo lo borra en `sin_vincular`. Vinculado o revocado no se borra desde cliente (si no, borrar y recrear evadiria la revocacion). Cubierto por tests.
2. **`sesiones` update clinico**: `affectedKeys().hasOnly(['notes','updatedAt'])`; `notes` string <= 2000; si `updatedAt` cambia debe ser `== request.time` (timestamp del servidor; un tiempo falso, ajeno o de otro tipo se deniega). Ningun campo protegido (`patientId`, `deviceUid`, `sessionId`, `score`, metricas, `createdAt`...). La gafa no actualiza. Esto conserva el `updatedAt` que ya escribe `updateSession` en la web.
3. **Alias de gafa**: update de `dispositivos` con `affectedKeys().hasOnly(['alias'])`, alias obligatorio (no se puede borrar) y validado (regex acotada, 1-30). Lo hace el propietario **o un admin** (coherente con la revocacion, que ya permitia admin). Solo con estado `vinculado`: en `revocado` (terminal) no se edita, y en `sin_vincular` no hay propietario. La gafa nunca.
4. **Sesion activa**:
   - (a) El `gameId` del resultado debe coincidir con el de `dispositivos/{uid}/sesion_activa/current` (antes era una limitacion documentada; ahora es regla).
   - (b) Vencimiento: crear resultado exige `request.time < venceEn` (denegado en `>=`); el PATCH `status` de la gafa tambien exige `request.time < venceEn`.
   - **Lectura de una sesion vencida por la gafa vinculada: PERMITIDA** (decision). Denegarla produciria un 403 indistinguible del 403 por revocacion/no vinculada, y el cliente Godot lo trata como fallo de polling, lo que podria interpretarse como revocacion. Permitirla no abre ninguna escritura (resultados y cierre ya estan denegados) y el cliente debe ignorar la sesion si `venceEn <= ahora`. El propietario puede republicar encima de una vencida.
5. **Roles**: se crean a mano en consola (Admin SDK/consola). No hay nada que implementar ni scripts con secretos; `usuarios/**` sigue sin escritura de cliente.

**Revocacion (requisito adicional)**: los tests usan el MISMO handle de auth (mismo uid/token) antes y despues de revocar. Antes: lee `sesion_activa`, crea resultado, hace PATCH `completed`, lee su resultado. Tras revocar (propietario pone `estado: revocado`), todo denegado, incluso con una `sesion_activa` pending y vigente que quede en curso. Ademas no puede borrar su doc de `dispositivos`, ni "recrearlo"/rehabilitarlo (`setDoc` sobre el existente, `estado` sin_vincular/vinculado, nuevo codigo, borrar `revocadoEn`), ni lanzar un batch de nueva solicitud, ni editar/borrar/crear `vinculos`. Una gafa A revocada tampoco puede escribir resultados con `deviceUid` de otra gafa B (ni leer/cerrar la sesion de B), y B sigue operativa. Se ajusto ademas `get` de `sesiones` por la gafa: solo mientras este `vinculado` (una revocada pierde incluso la lectura de sus resultados).

### Limites de reglas y decisiones tecnicas


- Limite de accesos a documentos (10 por operacion simple, 20 en batch): la confirmacion de vinculacion toca ~5 documentos distintos (`usuarios/uid`, `dispositivos/X`, `vinculos/C`; los accesos repetidos se cachean), muy por debajo del limite.
- Limite de 1000 expresiones por evaluacion: el esquema de resultados lo supero con helpers por campo opcional. Se resolvio con comparaciones directas y campos especificos de cada juego OBLIGATORIOS (un tipo erroneo provoca error de evaluacion = denegado). No distingue int de float en esos campos.
- `list + list` no existe en reglas: se usa `list.concat(list)`.
- Los tiempos son deterministas via `withSecurityRulesDisabled` (se siembra `venceEn` pasado/futuro con margen). No se puede probar el instante exacto `request.time == venceEn` (el reloj del servidor lo fija el emulador); la regla usa `<` estricto, es decir `>=` deniega.
- Reglas no pueden impedir que un cliente ignore `venceEn` al leer una sesion vencida (ver decision 4); solo garantizan que no puede escribir con ella.
- Si una gafa revocada es eliminada por Admin SDK/consola, el UID anonimo puede iniciar de nuevo el flujo de vinculacion como una gafa nueva (sin permisos heredados): la revocacion es terminal por UID mientras el documento exista. Si se necesita una lista negra permanente, hay que conservar el doc `revocado` (no borrarlo) o anadir una coleccion de bloqueo escrita solo por Admin.
- `notes` puede quedar eliminado (campo borrado) por un clinico con `deleteField()` en update; no afecta a metricas. Si se quiere impedir, exigir `'notes' in request.resource.data` cuando `notes` cambie.
- Los elementos de `movementsSummary` no son validables (sin bucles): solo tipo lista y <= 50 elementos.

### Cambios necesarios en clientes (no hechos en PR3)

Godot: Anonymous Auth, `deviceUid` en cada resultado, no enviar `patientName`, nueva ruta de `sesion_activa`, flujo `dispositivos`/`vinculos`. Web: login con email verificado + `usuarios/{uid}` creado con Admin SDK, `addSession`/`seedIfEmpty` (create de `sesiones` ya no permitido a clinicos), `updateSession` (ahora compatible: `notes` + `updatedAt` serverTimestamp), `publishActiveSession` (nueva ruta/esquema, sin nombre), `createDeviceLink`/`subscribeDeviceLink` (modelo antiguo).
