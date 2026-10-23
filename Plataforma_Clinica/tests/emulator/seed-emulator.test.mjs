// PR5a - Pruebas de la infraestructura de emuladores: guard de app/emulators.ts, seguridad del seed sintético
// (no ejecutable contra producción) y resultado del seed cargando firestore.rules.next. Solo emulador local,
// proyecto ficticio demo-tfg-vr, datos sintéticos. Se ejecuta con `pnpm test:emulator` (firebase.emulator.json).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED = join(root, 'scripts', 'seed-emulator.mjs');
const PROJECT_ID = 'demo-tfg-vr';
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PASSWORD = 'PruebaSintetica-123';

// Ejecuta el seed como proceso hijo con un entorno CONTROLADO (sin heredar variables de emulador ni de proyecto).
function runSeed(extraEnv) {
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...extraEnv };
  return spawnSync(process.execPath, [SEED], { env, encoding: 'utf8', timeout: 60_000 });
}
const LOCAL_ENV = { FIRESTORE_EMULATOR_HOST: FS, FIREBASE_AUTH_EMULATOR_HOST: AUTH };

const { shouldUseEmulators } = await import(pathToFileURL(join(root, 'app', 'emulators.ts')).href);

describe('guard de app/emulators.ts (shouldUseEmulators)', () => {

  it('sin variable o distinta de "true": false, en DEV y en build', () => {
    for (const DEV of [true, false, undefined]) {
      for (const v of [undefined, '', 'false', 'TRUE', '1']) {
        assert.equal(shouldUseEmulators({ DEV, VITE_USE_EMULATORS: v }), false);
      }
    }
  });
  it('"true" en DEV: true', () => {
    assert.equal(shouldUseEmulators({ DEV: true, VITE_USE_EMULATORS: 'true' }), true);
  });
  it('"true" fuera de DEV (build de producción): lanza error', () => {
    assert.throws(() => shouldUseEmulators({ DEV: false, VITE_USE_EMULATORS: 'true' }), /no está permitido/);
    assert.throws(() => shouldUseEmulators({ VITE_USE_EMULATORS: 'true' }), /no está permitido/);
  });
  it('firebase.ts usa el guard y solo conecta emuladores con import.meta.env.DEV estático', () => {
    const src = readFileSync(join(root, 'app', 'firebase.ts'), 'utf8');
    assert.match(src, /shouldUseEmulators\(/);
    assert.match(src, /if \(import\.meta\.env\.DEV && useEmulators\) \{\s*connectAuthEmulator[\s\S]*connectFirestoreEmulator/);
  });
});

describe('seed-emulator: aborta si no es seguro (sin red)', () => {
  const expectAbort = (r, re) => {
    assert.notEqual(r.status, 0, `debía fallar; stdout=${r.stdout}`);
    assert.match(r.stderr, /ABORTADO/);
    if (re) assert.match(r.stderr, re);
  };
  it('sin ninguna variable de emulador', () => expectAbort(runSeed({}), /FIRESTORE_EMULATOR_HOST/));
  it('falta FIREBASE_AUTH_EMULATOR_HOST', () =>
    expectAbort(runSeed({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }), /FIREBASE_AUTH_EMULATOR_HOST/));
  it('falta FIRESTORE_EMULATOR_HOST', () =>
    expectAbort(runSeed({ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }), /FIRESTORE_EMULATOR_HOST/));
  it('SEED_PROJECT_ID sin prefijo demo-', () =>
    expectAbort(runSeed({ ...LOCAL_ENV, SEED_PROJECT_ID: 'mi-proyecto-real' }), /demo-/));
  it('GCLOUD_PROJECT sin prefijo demo-', () =>
    expectAbort(runSeed({ ...LOCAL_ENV, GCLOUD_PROJECT: 'mi-proyecto-real' }), /demo-/));
  it('GOOGLE_CLOUD_PROJECT sin prefijo demo-', () =>
    expectAbort(runSeed({ ...LOCAL_ENV, GOOGLE_CLOUD_PROJECT: 'mi-proyecto-real' }), /demo-/));
  it('host de Firestore remoto', () =>
    expectAbort(runSeed({ ...LOCAL_ENV, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' }), /no es 127\.0\.0\.1/));
  it('host de Auth remoto', () =>
    expectAbort(runSeed({ ...LOCAL_ENV, FIREBASE_AUTH_EMULATOR_HOST: '10.0.0.5:9099' }), /no es 127\.0\.0\.1/));
  it('host que solo empieza como local (localhost.evil.com)', () =>
    expectAbort(runSeed({ ...LOCAL_ENV, FIRESTORE_EMULATOR_HOST: 'localhost.evil.com:8080' }), /no es 127\.0\.0\.1/));
  it('host sin puerto', () =>
    expectAbort(runSeed({ ...LOCAL_ENV, FIRESTORE_EMULATOR_HOST: '127.0.0.1' }), /no es 127\.0\.0\.1/));
  it('el script no usa credenciales (sin cert/serviceAccount/applicationDefault)', () => {
    const src = readFileSync(SEED, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /cert\(|serviceAccount|applicationDefault|GOOGLE_APPLICATION_CREDENTIALS/);
  });
});

describe('seed-emulator contra emuladores reales + reglas firestore.rules.next', () => {
  let env;
  const seedOk = () => {
    const r = runSeed(LOCAL_ENV);
    assert.equal(r.status, 0, `seed falló: ${r.stderr}${r.stdout}`);
    return r;
  };
  const signIn = async (email) => {
    const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    });
    assert.equal(r.status, 200, `login de ${email}`);
    return (await r.json()).idToken;
  };
  const rest = (path, token) => fetch(
    `http://${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    token ? { headers: { authorization: `Bearer ${token}` } } : {},
  );
  const snapshot = async () => {
    const out = {};
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const c of ['usuarios', 'pacientes', 'dispositivos', 'vinculos']) {
        const s = await getDocs(collection(db, c));
        out[c] = s.docs.map((d) => d.id).sort();
      }
    });
    return out;
  };

  before(async () => {
    const [host, port] = FS.split(':');
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readFileSync(join(root, 'firestore.rules.next'), 'utf8'), host, port: Number(port) },
    });
    await env.clearFirestore();
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  });
  after(async () => { await env?.cleanup(); });

  it('crea lo esperado y es idempotente (2 ejecuciones)', async () => {
    seedOk();
    const s1 = await snapshot();
    seedOk();
    const s2 = await snapshot();
    assert.deepEqual(s2.usuarios, ['admin-sintetico', 'fisio-sintetico', 'noverificado-sintetico']);
    assert.deepEqual(s2.pacientes, ['paciente-sintetico-1', 'paciente-sintetico-2', 'paciente-sintetico-3']);
    assert.equal(s2.dispositivos.length, 1);
    assert.deepEqual(s2.vinculos, ['PRUEBAS2']);
    assert.deepEqual(s2, s1, 'la segunda ejecución no cambia los datos');

    const list = await (await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' }, body: '{}',
    })).json();
    assert.equal(list.userInfo.length, 5, '4 usuarios con email + 1 gafa anónima, sin duplicados');
    const byMail = Object.fromEntries(list.userInfo.filter((u) => u.email).map((u) => [u.email, u.emailVerified === true]));
    assert.deepEqual(byMail, {
      'fisio.sintetico@example.test': true,
      'admin.sintetico@example.test': true,
      'noverificado.sintetico@example.test': false,
      'sinrol.sintetico@example.test': true,
    });
  });

  it('los pacientes y la solicitud de la gafa son sintéticos y válidos', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const p = (await getDoc(doc(db, 'pacientes/paciente-sintetico-1'))).data();
      assert.equal(p.name, 'PACIENTE-SINTETICO-1');
      assert.equal(p.alias, 'Paciente 1');
      const v = (await getDoc(doc(db, 'vinculos/PRUEBAS2'))).data();
      assert.equal(v.estado, 'pendiente');
      assert.equal(v.usado, false);
      assert.ok(v.expira.toMillis() > Date.now());
      const d = (await getDoc(doc(db, `dispositivos/${v.deviceUid}`))).data();
      assert.equal(d.estado, 'sin_vincular');
      assert.equal(d.codigoActual, 'PRUEBAS2');
    });
  });

  it('con tokens REALES: fisio verificado y admin leen pacientes; no verificado, sin rol y sin token no', async () => {
    const fisio = await signIn('fisio.sintetico@example.test');
    const admin = await signIn('admin.sintetico@example.test');
    const noVer = await signIn('noverificado.sintetico@example.test');
    const sinRol = await signIn('sinrol.sintetico@example.test');
    assert.equal((await rest('pacientes/paciente-sintetico-1', fisio)).status, 200);
    const l = await (await rest('pacientes', fisio)).json();
    assert.equal(l.documents.length, 3);
    assert.equal((await rest('pacientes/paciente-sintetico-1', admin)).status, 200);
    assert.equal((await rest('pacientes/paciente-sintetico-1', noVer)).status, 403);
    assert.equal((await rest('pacientes', noVer)).status, 403);
    assert.equal((await rest('pacientes/paciente-sintetico-1', sinRol)).status, 403);
    assert.equal((await rest('pacientes/paciente-sintetico-1')).status, 403);
    // cada usuario solo lee su propio usuarios/{uid}
    assert.equal((await rest('usuarios/fisio-sintetico', fisio)).status, 200);
    assert.equal((await rest('usuarios/admin-sintetico', fisio)).status, 403);
  });

  it('la gafa anónima ve su propio dispositivo y no pacientes ni el de otra gafa', async () => {
    let deviceUid;
    await env.withSecurityRulesDisabled(async (ctx) => {
      deviceUid = (await getDoc(doc(ctx.firestore(), 'vinculos/PRUEBAS2'))).data().deviceUid;
    });
    const gafa = env.authenticatedContext(deviceUid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertSucceeds(getDoc(doc(gafa, `dispositivos/${deviceUid}`)));
    await assertFails(getDoc(doc(gafa, 'dispositivos/otra-gafa')));
    await assertFails(getDocs(collection(gafa, 'pacientes')));
    await assertFails(getDoc(doc(gafa, 'pacientes/paciente-sintetico-1')));
    await assertFails(getDocs(query(collection(gafa, 'dispositivos'), where('ownerUid', '==', 'x'))));
  });

  it('un usuario anónimo REAL del emulador es la gafa sembrada (provider anonymous, sin email)', async () => {
    const list = await (await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' }, body: '{}',
    })).json();
    const anon = list.userInfo.filter((u) => !u.email);
    assert.equal(anon.length, 1);
    let deviceUid;
    await env.withSecurityRulesDisabled(async (ctx) => {
      deviceUid = (await getDoc(doc(ctx.firestore(), 'vinculos/PRUEBAS2'))).data().deviceUid;
    });
    assert.equal(anon[0].localId, deviceUid);
  });
});
