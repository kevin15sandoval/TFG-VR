// PR5b - Integración REAL del guard de acceso contra Auth Emulator + Firestore Emulator (reglas firestore.rules.next).
// Identidades reales: sign-in con email/contraseña del seed y signInAnonymously real (la gafa), con el SDK web de
// Firebase, sin tokens simulados ni suplantación. Usa la MISMA ruta de código que AccessGuard:
// obtenerEstadoAcceso / reevaluarTrasVerificar (app/accessState.ts) + leerRolUsuario (app/accessData.ts).
// Solo emulador local, proyecto ficticio demo-tfg-vr, datos sintéticos. Se ejecuta con `pnpm test:emulator`.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously, signOut,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeApp as adminInit, deleteApp as adminDelete } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED = join(root, 'scripts', 'seed-emulator.mjs');
const PROJECT_ID = 'demo-tfg-vr';
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PASSWORD = 'PruebaSintetica-123';
const [FS_HOST, FS_PORT] = FS.split(':');

const { obtenerEstadoAcceso, reevaluarTrasVerificar } = await import(pathToFileURL(join(root, 'app', 'accessState.ts')).href);
const { leerRolUsuario } = await import(pathToFileURL(join(root, 'app', 'accessData.ts')).href);

const apps = [];
let adminApp, aAuth, aDb;
let n = 0;

// Cliente web independiente (una app por identidad). fsPort permite apuntar Firestore a un puerto muerto.
function cliente(fsPort = Number(FS_PORT)) {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `acceso-${n++}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST, fsPort);
  return { app, auth, db };
}

// Mismas dependencias que AccessGuard (leerRolUsuario), con un contador para demostrar cuántas lecturas hace.
function depsContadas(db) {
  const d = { lecturas: [], async leerRol(uid) { d.lecturas.push(uid); return leerRolUsuario(db, uid); } };
  return d;
}

async function entrar(email, fsPort) {
  const c = cliente(fsPort);
  const cred = await signInWithEmailAndPassword(c.auth, email, PASSWORD);
  return { ...c, user: cred.user };
}

const pacientes = (token) => fetch(
  `http://${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents/pacientes`,
  { headers: { authorization: `Bearer ${token}` } },
);
const miDoc = (uid, token) => fetch(
  `http://${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents/usuarios/${uid}`,
  { headers: { authorization: `Bearer ${token}` } },
);

describe('guard de acceso contra emuladores reales', () => {
  before(async () => {
    // Estado limpio y siembra sintética (proceso hijo con entorno controlado, como en el resto de pruebas).
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
    await fetch(`http://${FS}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
    const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, FIRESTORE_EMULATOR_HOST: FS, FIREBASE_AUTH_EMULATOR_HOST: AUTH };
    const r = spawnSync(process.execPath, [SEED], { env, encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 0, `seed falló: ${r.stderr}${r.stdout}`);
    adminApp = adminInit({ projectId: PROJECT_ID }, 'acceso-admin');
    aAuth = adminAuth(adminApp);
    aDb = adminFirestore(adminApp);
  });
  after(async () => {
    for (const a of apps) { try { await deleteApp(a); } catch { /* ya cerrada */ } }
    try { await adminDelete(adminApp); } catch { /* ya cerrada */ }
  });

  it('fisioterapeuta verificado con rol -> rol_ok, 1 sola lectura (usuarios/uid) y pacientes 200', async () => {
    const c = await entrar('fisio.sintetico@example.test');
    const d = depsContadas(c.db);
    const r = await obtenerEstadoAcceso(c.user, d);
    assert.deepEqual(r, { estado: 'rol_ok', rol: 'fisioterapeuta' });
    assert.deepEqual(d.lecturas, ['fisio-sintetico']);
    assert.equal((await pacientes(await c.user.getIdToken())).status, 200);
  });

  it('admin -> rol_ok y pacientes 200', async () => {
    const c = await entrar('admin.sintetico@example.test');
    const d = depsContadas(c.db);
    assert.deepEqual(await obtenerEstadoAcceso(c.user, d), { estado: 'rol_ok', rol: 'admin' });
    assert.equal((await pacientes(await c.user.getIdToken())).status, 200);
  });

  it('correo sin verificar (con doc de rol) -> sin_verificar_email, 0 lecturas de Firestore y pacientes 403', async () => {
    const c = await entrar('noverificado.sintetico@example.test');
    const d = depsContadas(c.db);
    assert.equal((await obtenerEstadoAcceso(c.user, d)).estado, 'sin_verificar_email');
    assert.deepEqual(d.lecturas, []);
    assert.equal((await pacientes(await c.user.getIdToken())).status, 403);
  });

  it('verificado pero sin doc de rol -> sin_rol y pacientes 403', async () => {
    const c = await entrar('sinrol.sintetico@example.test');
    const d = depsContadas(c.db);
    assert.equal((await obtenerEstadoAcceso(c.user, d)).estado, 'sin_rol');
    assert.deepEqual(d.lecturas, ['sinrol-sintetico']);
    assert.equal((await pacientes(await c.user.getIdToken())).status, 403);
  });

  it('anónimo REAL (la gafa) con doc usuarios/{uid} admin plantado con Admin SDK -> denegado, 0 lecturas, pacientes 403', async () => {
    const c = cliente();
    const { user } = await signInAnonymously(c.auth);
    assert.equal(user.isAnonymous, true);
    await aDb.doc(`usuarios/${user.uid}`).set({ rol: 'admin' }); // plantado: no debe servir de nada
    const d = depsContadas(c.db);
    assert.deepEqual(await obtenerEstadoAcceso(user, d), { estado: 'denegado' });
    assert.deepEqual(d.lecturas, [], 'el guard no lee nada para un anónimo');
    const tok = await user.getIdToken();
    // Defensa en profundidad: las reglas también lo rechazan (provider anonymous), aunque pueda leer su propio doc.
    assert.equal((await pacientes(tok)).status, 403);
    assert.equal((await miDoc(user.uid, tok)).status, 200, 'sin el guard, el doc plantado sí sería legible por su dueño');
    await aDb.doc(`usuarios/${user.uid}`).delete();
  });

  it('anónimo real sin doc -> denegado', async () => {
    const c = cliente();
    const { user } = await signInAnonymously(c.auth);
    assert.equal((await obtenerEstadoAcceso(user, depsContadas(c.db))).estado, 'denegado');
  });

  it('no verificado -> Admin SDK marca emailVerified=true -> reload()+getIdToken(true) -> rol_ok y pacientes 200', async () => {
    const c = await entrar('noverificado.sintetico@example.test');
    const d = depsContadas(c.db);
    assert.equal((await obtenerEstadoAcceso(c.user, d)).estado, 'sin_verificar_email');
    assert.equal(c.user.emailVerified, false);
    assert.equal((await pacientes(await c.user.getIdToken())).status, 403);
    try {
      await aAuth.updateUser('noverificado-sintetico', { emailVerified: true });
      const r = await reevaluarTrasVerificar(c.user, d);
      assert.deepEqual(r, { estado: 'rol_ok', rol: 'fisioterapeuta' });
      assert.equal(c.user.emailVerified, true);
      assert.equal((await pacientes(await c.user.getIdToken())).status, 200);
    } finally {
      await aAuth.updateUser('noverificado-sintetico', { emailVerified: false });
    }
  });

  it('SDK dice emailVerified=true pero el token aún lleva el claim falso -> se refresca una vez y entra', async () => {
    const c = await entrar('noverificado.sintetico@example.test'); // el ID token actual: email_verified=false
    try {
      await aAuth.updateUser('noverificado-sintetico', { emailVerified: true });
      await c.user.reload(); // user.emailVerified pasa a true, pero el ID token cacheado sigue con claim false
      assert.equal(c.user.emailVerified, true);
      assert.equal((await c.user.getIdTokenResult()).claims.email_verified, false, 'precondición: claim antiguo');
      assert.equal((await obtenerEstadoAcceso(c.user, depsContadas(c.db))).estado, 'rol_ok');
      assert.equal((await c.user.getIdTokenResult()).claims.email_verified, true, 'el token quedó refrescado');
    } finally {
      await aAuth.updateUser('noverificado-sintetico', { emailVerified: false });
    }
  });

  it('revocación: quitar usuarios/{uid} -> sin_rol; rol inválido -> sin_rol; rol no string -> denegado; restaurar -> rol_ok', async () => {
    const c = await entrar('fisio.sintetico@example.test');
    const d = depsContadas(c.db);
    const ref = aDb.doc('usuarios/fisio-sintetico');
    const original = (await ref.get()).data();
    try {
      assert.equal((await obtenerEstadoAcceso(c.user, d)).estado, 'rol_ok');
      await ref.delete();
      assert.equal((await obtenerEstadoAcceso(c.user, d)).estado, 'sin_rol');
      assert.equal((await pacientes(await c.user.getIdToken())).status, 403);
      await ref.set({ rol: 'paciente' });
      assert.equal((await obtenerEstadoAcceso(c.user, d)).estado, 'sin_rol');
      assert.equal((await pacientes(await c.user.getIdToken())).status, 403);
      await ref.set({ rol: 7 });
      const r = await obtenerEstadoAcceso(c.user, d);
      assert.notEqual(r.estado, 'rol_ok');
      assert.equal(r.estado, 'denegado');
      await ref.set(original);
      assert.equal((await obtenerEstadoAcceso(c.user, d)).estado, 'rol_ok');
    } finally {
      await ref.set(original);
    }
  });

  it('cuenta deshabilitada tras haber entrado -> nunca rol_ok al reevaluar tras refrescar el token', async () => {
    const c = await entrar('sinrol.sintetico@example.test');
    try {
      await aAuth.updateUser('sinrol-sintetico', { disabled: true });
      const r = await reevaluarTrasVerificar(c.user, depsContadas(c.db));
      assert.notEqual(r.estado, 'rol_ok');
      assert.ok(['denegado', 'sesion_caducada', 'error_red'].includes(r.estado), r.estado);
    } finally {
      await aAuth.updateUser('sinrol-sintetico', { disabled: false });
    }
  });

  it('FALLO CERRADO: Firestore inaccesible (puerto muerto) -> error_red / denegado, NUNCA rol_ok', { timeout: 90_000 }, async (t) => {
    const c = await entrar('admin.sintetico@example.test', 1); // Auth real, Firestore apunta a 127.0.0.1:1
    const d = depsContadas(c.db);
    const r = await obtenerEstadoAcceso(c.user, d);
    t.diagnostic(`estado con Firestore inaccesible: ${r.estado}`);
    assert.deepEqual(d.lecturas, ['admin-sintetico'], 'intentó la lectura y falló');
    assert.notEqual(r.estado, 'rol_ok');
    assert.ok(['error_red', 'denegado'].includes(r.estado), `estado=${r.estado}`);
  });

  it('FALLO CERRADO: error inyectado en la lectura (sin code / unavailable / permission-denied) -> nunca rol_ok', async () => {
    const c = await entrar('fisio.sintetico@example.test');
    const inyecta = (e) => ({ async leerRol() { throw e; } });
    assert.equal((await obtenerEstadoAcceso(c.user, inyecta(new Error('boom')))).estado, 'denegado');
    assert.equal((await obtenerEstadoAcceso(c.user, inyecta(Object.assign(new Error('x'), { code: 'unavailable' })))).estado, 'error_red');
    assert.equal((await obtenerEstadoAcceso(c.user, inyecta(Object.assign(new Error('x'), { code: 'permission-denied' })))).estado, 'denegado');
  });

  it('cerrar sesión (logout del SDK) deja currentUser nulo', async () => {
    const c = await entrar('fisio.sintetico@example.test');
    await signOut(c.auth);
    assert.equal(c.auth.currentUser, null);
  });
});
