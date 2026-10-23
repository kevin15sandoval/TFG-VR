// PR1 - Caracterización del acceso de usuarios ANÓNIMOS (Firebase Auth real del emulador)
// contra las reglas ACTUALES de firestore.rules. Peticiones REST como las haría Godot.
// Etiquetas: [HALLAZGO] inseguro hoy (invertir al endurecer reglas); [ESPERADO] correcto hoy.
// Solo datos sintéticos, emulador local, proyecto ficticio demo-tfg-vr. Sin producción.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(here, '..', '..', 'firestore.rules');
const PROJECT_ID = 'demo-tfg-vr';
const FS_HOSTPORT = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH_HOSTPORT = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const DOCS = `http://${FS_HOSTPORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let env;
let idToken;

const decodeJwt = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));

async function signUpAnonymous() {
  const r = await fetch(
    `http://${AUTH_HOSTPORT}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) },
  );
  assert.equal(r.status, 200, 'signUp anónimo en emulador Auth');
  return (await r.json()).idToken;
}

// Petición REST a Firestore; token opcional (null = sin Authorization, como Godot hoy).
async function fs(method, path, { token = null, fields = null, mask = null } = {}) {
  const qs = mask ? '?' + mask.map((m) => `updateMask.fieldPaths=${m}`).join('&') : '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${DOCS}/${path}${qs}`, {
    method, headers, body: fields ? JSON.stringify({ fields }) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const str = (v) => ({ stringValue: v });
const ok = (r) => assert.equal(r.status, 200, JSON.stringify(r.body));
const denied = (r) => assert.equal(r.status, 403, JSON.stringify(r.body));

before(async () => {
  const [host, port] = FS_HOSTPORT.split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host, port: Number(port) },
  });
  idToken = await signUpAnonymous();
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'pacientes/PACIENTE-SINTETICO-1'), { nombre: 'PACIENTE-SINTETICO-1', diagnostico: 'ictus-sintetico' });
    await setDoc(doc(db, 'sesiones/SESION-SINTETICA-1'), { patientId: 'PACIENTE-SINTETICO-1', juego: 'gemas', puntuacion: 10, status: 'completada' });
    await setDoc(doc(db, 'sesion_activa/current'), { patientId: 'PACIENTE-SINTETICO-1', patientName: 'PACIENTE-SINTETICO-1', juego: 'gemas' });
    await setDoc(doc(db, 'dispositivos/DISP-SINT-1'), { estado: 'libre', vinculado: false });
  });
});

describe('Token anónimo real del emulador de Auth', () => {
  it('[HALLAZGO] el idToken es de un usuario anónimo (sign_in_provider === anonymous)', () => {
    const claims = decodeJwt(idToken);
    assert.equal(claims.firebase.sign_in_provider, 'anonymous');
    assert.ok(claims.user_id || claims.sub);
    assert.equal(claims.email, undefined);
  });
});

describe('Anónimo con token real (vector si se activa Anonymous Auth)', () => {
  it('[HALLAZGO] LEE un paciente', async () => {
    const r = await fs('GET', 'pacientes/PACIENTE-SINTETICO-1', { token: idToken });
    ok(r);
    assert.equal(r.body.fields.nombre.stringValue, 'PACIENTE-SINTETICO-1');
  });

  it('[HALLAZGO] LISTA pacientes', async () => {
    const r = await fs('GET', 'pacientes', { token: idToken });
    ok(r);
    assert.equal(r.body.documents.length, 1);
  });

  it('[HALLAZGO] ESCRIBE (crea) un paciente', async () => {
    ok(await fs('PATCH', 'pacientes/PACIENTE-SINTETICO-2', { token: idToken, fields: { nombre: str('PACIENTE-SINTETICO-2') } }));
  });

  it('[HALLAZGO] MODIFICA y BORRA un paciente', async () => {
    ok(await fs('PATCH', 'pacientes/PACIENTE-SINTETICO-1', { token: idToken, fields: { diagnostico: str('alterado') }, mask: ['diagnostico'] }));
    ok(await fs('DELETE', 'pacientes/PACIENTE-SINTETICO-1', { token: idToken }));
  });

  it('[HALLAZGO] LEE sesiones (get y list)', async () => {
    ok(await fs('GET', 'sesiones/SESION-SINTETICA-1', { token: idToken }));
    const l = await fs('GET', 'sesiones', { token: idToken });
    ok(l);
    assert.equal(l.body.documents.length, 1);
  });

  it('[HALLAZGO] MODIFICA una sesión', async () => {
    ok(await fs('PATCH', 'sesiones/SESION-SINTETICA-1', { token: idToken, fields: { puntuacion: { integerValue: '999' } }, mask: ['puntuacion'] }));
  });

  it('[HALLAZGO] BORRA una sesión', async () => {
    ok(await fs('DELETE', 'sesiones/SESION-SINTETICA-1', { token: idToken }));
  });

  it('[HALLAZGO] ESCRIBE sesion_activa (PATCH) y la BORRA (DELETE)', async () => {
    ok(await fs('PATCH', 'sesion_activa/current', { token: idToken, fields: { patientId: str('PACIENTE-SINTETICO-2') }, mask: ['patientId'] }));
    ok(await fs('DELETE', 'sesion_activa/current', { token: idToken }));
  });

  it('[HALLAZGO] LEE, LISTA y ACTUALIZA dispositivos', async () => {
    ok(await fs('GET', 'dispositivos/DISP-SINT-1', { token: idToken }));
    const l = await fs('GET', 'dispositivos', { token: idToken });
    ok(l);
    assert.equal(l.body.documents.length, 1);
    ok(await fs('PATCH', 'dispositivos/DISP-SINT-1', { token: idToken, fields: { estado: str('ocupado') }, mask: ['estado'] }));
  });

  it('[ESPERADO] colección sin regla sigue denegada también con token anónimo', async () => {
    denied(await fs('GET', 'coleccion_sin_regla/x', { token: idToken }));
  });
});

describe('Sin token (contraste, como Godot hoy)', () => {
  it('[ESPERADO] NO lee ni lista pacientes; NO escribe pacientes', async () => {
    denied(await fs('GET', 'pacientes/PACIENTE-SINTETICO-1'));
    denied(await fs('GET', 'pacientes'));
    denied(await fs('PATCH', 'pacientes/PACIENTE-SINTETICO-2', { fields: { nombre: str('x') } }));
  });

  it('[ESPERADO] NO lee sesiones', async () => {
    denied(await fs('GET', 'sesiones/SESION-SINTETICA-1'));
  });

  it('[ESPERADO] NO escribe ni borra sesion_activa (PATCH/DELETE de Godot fallan)', async () => {
    denied(await fs('PATCH', 'sesion_activa/current', { fields: { patientId: str('x') }, mask: ['patientId'] }));
    denied(await fs('DELETE', 'sesion_activa/current'));
  });

  it('[ESPERADO] NO crea ni borra dispositivos', async () => {
    denied(await fs('PATCH', 'dispositivos/DISP-SINT-2', { fields: { estado: str('libre') } }));
    denied(await fs('DELETE', 'dispositivos/DISP-SINT-1'));
  });

  it('[HALLAZGO] sin token: Godot lee sesion_activa y actualiza dispositivos (contrato actual)', async () => {
    ok(await fs('GET', 'sesion_activa/current'));
    ok(await fs('PATCH', 'dispositivos/DISP-SINT-1', { fields: { estado: str('ocupado') }, mask: ['estado'] }));
  });
});
