// PR5c-3b-1 - Ciclo de vida persistente de sesión + CARRERAS, contra Auth Emulator + Firestore Emulator con
// firestore.rules.next (NO desplegadas). Identidades REALES del emulador (fisios con email verificado creados con Admin
// SDK; Quest = Auth anónima real). Para simular "dos pestañas/dos conexiones" de la MISMA Quest se usa, junto al SDK web,
// un cliente REST (documents:commit) con el mismo idToken, igual que haría Godot. Solo demo-tfg-vr y datos SINTÉTICOS.
// No usa devices.ts (su migración al modelo registro+buzón es PR5c-3b-2): escribe con el SDK/REST los documentos que
// escribirá el cliente final. Se ejecuta con `pnpm test:emulator`.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, updateDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { initializeApp as adminInit, deleteApp as adminDelete } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'demo-tfg-vr';
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PASSWORD = 'PruebaSintetica-123';
const [FS_HOST, FS_PORT] = FS.split(':');
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DOCS = `http://${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const NAME = (p) => `projects/${PROJECT_ID}/databases/(default)/documents/${p}`;
const MIN = 60_000;

const apps = [];
let adminApp, aDb, n = 0;

function cliente() {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `life-${n++}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));
  return { app, auth, db };
}
async function fisio(email) {
  const c = cliente();
  await signInWithEmailAndPassword(c.auth, email, PASSWORD);
  return { ...c, uid: c.auth.currentUser.uid };
}
const codigo = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
const sid = () => randomBytes(16).toString('base64url'); // 22 caracteres base64url
const PID = randomBytes(16).toString('base64url');

/** Quest: anónimo real + solicitud de vínculo (batch dispositivos+vinculos) y confirmación por el fisio (batch). */
async function questVinculada(owner) {
  const c = cliente();
  const { user } = await signInAnonymously(c.auth);
  const cod = codigo();
  const b = writeBatch(c.db);
  b.set(doc(c.db, 'dispositivos', user.uid), { estado: 'sin_vincular', codigoActual: cod, creadoEn: serverTimestamp() });
  b.set(doc(c.db, 'vinculos', cod), { deviceUid: user.uid, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(), expira: Timestamp.fromMillis(Date.now() + 9 * MIN) });
  await b.commit();
  const bc = writeBatch(owner.db);
  bc.update(doc(owner.db, 'vinculos', cod), { estado: 'vinculado', usado: true, confirmadoPor: owner.uid, confirmadoEn: serverTimestamp() });
  bc.update(doc(owner.db, 'dispositivos', user.uid), { ownerUid: owner.uid, estado: 'vinculado', vinculadoEn: serverTimestamp(), alias: 'Quest sintetica' });
  await bc.commit();
  return { ...c, uid: user.uid, token: await user.getIdToken() };
}

// ---------------------------------------------------------------- REST (como Godot): commit con transformaciones de hora
const RT = Symbol('REQUEST_TIME');
function val(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  switch (typeof v) {
    case 'string': return { stringValue: v };
    case 'boolean': return { booleanValue: v };
    case 'number': return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    default: return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
  }
}
function parte(path, datos, { crear = false } = {}) {
  const fields = {}; const transforms = [];
  for (const [k, v] of Object.entries(datos)) { if (v === RT) transforms.push({ fieldPath: k, setToServerValue: 'REQUEST_TIME' }); else fields[k] = val(v); }
  const w = { update: { name: NAME(path), fields }, currentDocument: { exists: !crear } };
  if (!crear) w.updateMask = { fieldPaths: Object.keys(fields) };
  if (transforms.length) w.updateTransforms = transforms;
  return w;
}
async function restCommit(token, writes) {
  const r = await fetch(`${DOCS}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ writes }) });
  if (r.status === 200) return true;
  if (r.status === 403 || r.status === 409 || r.status === 400) { const t = await r.text(); if (r.status === 403 || /ALREADY_EXISTS|FAILED_PRECONDITION|NOT_FOUND/.test(t)) return false; throw new Error(`REST ${r.status}: ${t}`); }
  throw new Error(`REST ${r.status}`);
}
async function restGet(token, path) { return (await fetch(`${DOCS}/${path}`, { headers: { Authorization: `Bearer ${token}` } })).status; }

// Convierte "denegado" en false y relanza lo inesperado.
const intenta = async (p) => { try { await p; return true; } catch (e) { if (e?.code === 'permission-denied' || e?.code === 'already-exists' || e?.code === 'failed-precondition' || e?.code === 'not-found') return false; throw e; } };
const gana = (...rs) => rs.filter(Boolean).length;

// ---------------------------------------------------------------- operaciones (SDK y REST)
const regPath = (dev, s) => `dispositivos/${dev}/sesiones_registro/${s}`;
const curPath = (dev) => `dispositivos/${dev}/sesion_activa/current`;
const reg = (dev, s, over = {}) => ({
  sessionId: s, patientId: PID, patientAlias: 'P-001', gameId: 'gems', duration: 600, difficulty: 'Fácil', therapySide: 'Izquierdo',
  sessionType: 'Rehabilitación', deviceUid: dev, ownerUid: null, publicadaEn: serverTimestamp(), venceEn: Timestamp.fromMillis(Date.now() + 20 * MIN), status: 'pending', ...over,
});
const publica = (owner, q, s, { prev, over = {} } = {}) => {
  const r = reg(q.uid, s, { ownerUid: owner.uid, ...over });
  const b = writeBatch(owner.db);
  if (prev) b.update(doc(owner.db, regPath(q.uid, prev)), { status: 'vencida', finalizadaEn: serverTimestamp(), motivo: 'vencida' });
  b.set(doc(owner.db, regPath(q.uid, s)), r);
  b.set(doc(owner.db, curPath(q.uid)), { sessionId: s, publicadaEn: serverTimestamp(), venceEn: r.venceEn });
  return b.commit();
};
const iniciaSdk = (q, s) => updateDoc(doc(q.db, regPath(q.uid, s)), { status: 'running', iniciadaEn: serverTimestamp() });
const iniciaRest = (q, s) => restCommit(q.token, [parte(regPath(q.uid, s), { status: 'running', iniciadaEn: RT })]);
const cancelaSdk = (owner, q, s) => updateDoc(doc(owner.db, regPath(q.uid, s)), { status: 'cancelled', finalizadaEn: serverTimestamp(), motivo: 'cancelada_por_web', cierrePor: owner.uid });
const solicitaSdk = (owner, q, s) => updateDoc(doc(owner.db, regPath(q.uid, s)), { status: 'cancel_requested', cancelSolicitadaEn: serverTimestamp(), cancelSolicitadaPor: owner.uid });
const forzaSdk = (owner, q, s) => updateDoc(doc(owner.db, regPath(q.uid, s)), { status: 'interrupted', finalizadaEn: serverTimestamp(), motivo: 'sin_respuesta', cierrePor: owner.uid, forzadoPor: owner.uid, forzadoEn: serverTimestamp(), forzadoMotivo: 'Sin respuesta de la gafa' });
const resultado = (dev, s, status = 'completed') => ({
  patientId: PID, sessionId: s, deviceUid: dev, gameId: 'gems', duration: 120, score: 10, fromVR: true, notes: '', status, durationUnit: 's', patientAlias: 'P-001',
  accuracy: 80, gemsNormal: 5, gemsGolden: 1, gemsGreen: 0, gemsPurple: 0, gemsRed: 0, gemsRedAvoided: 0, totalGems: 6, avgTimePerGem: 2, totalMovements: 6,
  movementsSummary: [], zonesWorked: { Alto: 1, Medio: 2, Lateral: 2, Bajo: 1 },
});
const cierraSdk = (q, s, status = 'completed', motivo = 'abandono') => {
  const b = writeBatch(q.db);
  b.set(doc(q.db, `sesiones/${s}`), { ...resultado(q.uid, s, status), createdAt: serverTimestamp() });
  b.update(doc(q.db, regPath(q.uid, s)), { status, finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp(), ...(status === 'interrupted' ? { motivo } : {}) });
  return b.commit();
};
const cierraRest = (q, s, status = 'completed') => restCommit(q.token, [
  parte(`sesiones/${s}`, { ...resultado(q.uid, s, status), createdAt: RT }, { crear: true }),
  parte(regPath(q.uid, s), { status, finalizadaEn: RT, tardio: false, resultadoEn: RT, ...(status === 'interrupted' ? { motivo: 'abandono' } : {}) }),
]);
const tardioSdk = (q, s) => {
  const b = writeBatch(q.db);
  b.set(doc(q.db, `sesiones/${s}`), { ...resultado(q.uid, s, 'interrupted'), createdAt: serverTimestamp() });
  b.update(doc(q.db, regPath(q.uid, s)), { resultadoEn: serverTimestamp(), tardio: true });
  return b.commit();
};

// ---------------------------------------------------------------- siembra de estados con Admin SDK (sin reglas)
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms).toDate();
async function siembra(q, owner, s, over = {}, apuntar = true) {
  const d = {
    sessionId: s, patientId: PID, patientAlias: 'P-001', gameId: 'gems', duration: 600, difficulty: 'Fácil', therapySide: 'Izquierdo',
    sessionType: 'Rehabilitación', deviceUid: q.uid, ownerUid: owner.uid, publicadaEn: ts(-5 * MIN), venceEn: ts(15 * MIN), status: 'pending', ...over,
  };
  await aDb.doc(regPath(q.uid, s)).set(d);
  if (apuntar) await aDb.doc(curPath(q.uid)).set({ sessionId: s, publicadaEn: d.publicadaEn, venceEn: d.venceEn });
}
const running = (q, o, s, over = {}) => siembra(q, o, s, { status: 'running', iniciadaEn: ts(-3 * MIN), ...over });
const leer = async (q, s) => (await aDb.doc(regPath(q.uid, s)).get()).data();
const nResultados = async (s) => ((await aDb.doc(`sesiones/${s}`).get()).exists ? 1 : 0);

describe('PR5c-3b-1 ciclo de vida persistente de sesión (emulador, identidades reales)', () => {
  let A, B, ADMIN, NOVERIF;
  before(async () => {
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
    await fetch(`http://${FS}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
    adminApp = adminInit({ projectId: PROJECT_ID }, 'life-admin');
    const aAuth = adminAuth(adminApp);
    aDb = adminFirestore(adminApp);
    for (const [uid, email, ver, rol] of [
      ['life-fisio-a', 'life.a@example.test', true, 'fisioterapeuta'], ['life-fisio-b', 'life.b@example.test', true, 'fisioterapeuta'],
      ['life-admin', 'life.admin@example.test', true, 'admin'], ['life-noverif', 'life.nv@example.test', false, 'fisioterapeuta'],
    ]) { await aAuth.createUser({ uid, email, password: PASSWORD, emailVerified: ver }); await aDb.doc(`usuarios/${uid}`).set({ rol }); }
    A = await fisio('life.a@example.test'); B = await fisio('life.b@example.test');
    ADMIN = await fisio('life.admin@example.test'); NOVERIF = await fisio('life.nv@example.test');
  });
  after(async () => {
    for (const a of apps) { try { await deleteApp(a); } catch { /* ya cerrada */ } }
    try { await adminDelete(adminApp); } catch { /* ya cerrada */ }
  });

  // ------------------------------------------------------------------ flujo con tokens reales
  it('flujo feliz con identidades reales: publicar -> iniciar -> cancelacion solicitada -> cierre interrupted/cancelada_por_web -> siguiente', async () => {
    const q = await questVinculada(A);
    const s1 = sid(), s2 = sid();
    assert.equal(await intenta(publica(A, q, s1)), true);
    assert.equal(await intenta(iniciaSdk(q, s1)), true);
    assert.equal(await intenta(solicitaSdk(A, q, s1)), true);
    assert.equal(await intenta(cierraSdk(q, s1, 'interrupted', 'cancelada_por_web')), true);
    assert.equal(await intenta(publica(A, q, s2)), true);
    assert.equal(await intenta(iniciaSdk(q, s2)), true);
    assert.equal(await intenta(cierraSdk(q, s2)), true);
    const r1 = await leer(q, s1), r2 = await leer(q, s2);
    assert.equal(r1.status, 'interrupted'); assert.equal(r1.motivo, 'cancelada_por_web'); assert.ok(r1.resultadoEn);
    assert.equal(r2.status, 'completed'); assert.equal(r2.tardio, false);
    assert.equal(r2.patientId, PID); assert.equal(r2.patientAlias, 'P-001');
    assert.equal((await aDb.doc(curPath(q.uid)).get()).data().sessionId, s2);
    assert.equal(await nResultados(s1) + await nResultados(s2), 2);
  });

  it('ni el puntero ni el registro llevan nombre real: solo pid (22) + alias', async () => {
    const q = await questVinculada(A);
    const s = sid();
    await publica(A, q, s);
    const cur = (await aDb.doc(curPath(q.uid)).get()).data();
    assert.deepEqual(Object.keys(cur).sort(), ['publicadaEn', 'sessionId', 'venceEn']);
    const r = await leer(q, s);
    assert.equal(r.patientId.length, 22); assert.match(r.patientAlias, /^P-\d{3,6}$/);
    for (const k of Object.keys(r)) assert.ok(!/name|nombre|dni|email/i.test(k), k);
  });

  it('REST como Godot: lee current -> registro, inicia, cierra con commit de 2 escrituras; sin DELETE', async () => {
    const q = await questVinculada(A);
    const s = sid();
    await publica(A, q, s);
    assert.equal(await restGet(q.token, curPath(q.uid)), 200);
    assert.equal(await restGet(q.token, regPath(q.uid, s)), 200);
    assert.equal(await iniciaRest(q, s), true);
    assert.equal(await cierraRest(q, s), true);
    assert.equal((await leer(q, s)).status, 'completed');
    const del = await fetch(`${DOCS}/${regPath(q.uid, s)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${q.token}` } });
    assert.equal(del.status, 403);
    const delc = await fetch(`${DOCS}/${curPath(q.uid)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${q.token}` } });
    assert.equal(delc.status, 403);
  });

  it('actores sin permiso con tokens reales: otro fisio, admin, no verificado, Quest ajena', async () => {
    const q = await questVinculada(A); const q2 = await questVinculada(B);
    const s = sid(); await publica(A, q, s);
    assert.equal(await intenta(publica(B, q, sid(), { prev: s })), false);                 // otro fisio
    assert.equal(await intenta(publica(ADMIN, q, sid(), { prev: s })), false);             // admin sin rama
    assert.equal(await intenta(publica(NOVERIF, q, sid())), false);                        // email sin verificar
    assert.equal(await intenta(cancelaSdk(B, q, s)), false);
    assert.equal(await intenta(cancelaSdk(ADMIN, q, s)), false);
    assert.equal(await intenta(iniciaSdk(q2, s)), false);                                   // la Quest ajena calcula la ruta de otra
    assert.equal(await intenta(getDoc(doc(B.db, regPath(q.uid, s)))), false);
    assert.equal(await intenta(getDoc(doc(q2.db, regPath(q.uid, s)))), false);
    assert.equal(await intenta(getDocs(collection(ADMIN.db, `dispositivos/${q.uid}/sesiones_registro`))), false);
    assert.equal((await leer(q, s)).status, 'pending');
  });

  it('Quest revocada (estado revocado): no inicia, no cierra, no lee; el propietario conserva la lectura', async () => {
    const q = await questVinculada(A);
    const s = sid(); await running(q, A, s);
    await aDb.doc(`dispositivos/${q.uid}`).update({ estado: 'revocado', revocadoEn: new Date() });
    assert.equal(await intenta(cierraSdk(q, s)), false);
    assert.equal(await cierraRest(q, s), false);
    assert.equal(await intenta(getDoc(doc(q.db, regPath(q.uid, s)))), false);
    assert.equal(await intenta(getDoc(doc(A.db, regPath(q.uid, s)))), true);
  });

  // ------------------------------------------------------------------ carreras (Promise.all; exactamente una escritura gana)
  const REPS = 6;

  it('CARRERA dos conexiones de la MISMA Quest (SDK + REST) pending->running: exactamente una gana', async () => {
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const s = sid(); await siembra(q, A, s);
      const [x, y] = await Promise.all([intenta(iniciaSdk(q, s)), iniciaRest(q, s)]);
      assert.equal(gana(x, y), 1, `iteración ${i}: ${x} ${y}`);
      assert.equal((await leer(q, s)).status, 'running');
    }
  });

  it('CARRERA dos Quest: la ajena nunca inicia la sesion de otra; la propia gana', async () => {
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const q2 = await questVinculada(B); const s = sid(); await siembra(q, A, s);
      const [x, y] = await Promise.all([intenta(iniciaSdk(q, s)), intenta(iniciaSdk(q2, s))]);
      assert.deepEqual([x, y], [true, false]);
    }
  });

  it('CARRERA dos pestanas del propietario: cancelar pending vs cancelar pending -> una gana', async () => {
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const s = sid(); await siembra(q, A, s);
      const A2 = await fisio('life.a@example.test');
      const [x, y] = await Promise.all([intenta(cancelaSdk(A, q, s)), intenta(cancelaSdk(A2, q, s))]);
      assert.equal(gana(x, y), 1);
      assert.equal((await leer(q, s)).status, 'cancelled');
    }
  });

  it('CARRERA cancelar (propietario) vs iniciar (Quest): exactamente una gana y el estado es coherente', async () => {
    let cancelGana = 0, iniciaGana = 0;
    for (let i = 0; i < REPS * 2; i++) {
      const q = await questVinculada(A); const s = sid(); await siembra(q, A, s);
      const [c, ini] = await Promise.all([intenta(cancelaSdk(A, q, s)), intenta(iniciaSdk(q, s))]);
      assert.equal(gana(c, ini), 1, `iteración ${i}: cancel=${c} inicia=${ini}`);
      const r = await leer(q, s);
      assert.equal(r.status, c ? 'cancelled' : 'running');
      c ? cancelGana++ : iniciaGana++;
      if (c) assert.equal(r.iniciadaEn, undefined); else assert.equal(r.cierrePor, undefined);
    }
    console.log(`  (cancelar vs iniciar: ganó cancelar ${cancelGana}, ganó iniciar ${iniciaGana})`);
  });

  it('CARRERA solicitar cancelacion vs cierre completed: el cierre siempre prospera; el estado final es completed con UN resultado', async () => {
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const s = sid(); await running(q, A, s);
      const [sol, cie] = await Promise.all([intenta(solicitaSdk(A, q, s)), intenta(cierraSdk(q, s))]);
      assert.equal(cie, true, `iteración ${i}: el cierre de la Quest debe ganar en cualquier orden (solicita=${sol})`);
      const r = await leer(q, s);
      assert.equal(r.status, 'completed');
      assert.equal(await nResultados(s), 1);
      // si la solicitud ganó el orden, queda su traza set-once; si no, no existe
      assert.equal(!!r.cancelSolicitadaEn, sol);
    }
  });

  it('CARRERA doble commit de resultado (SDK + REST, misma Quest): exactamente uno; un solo documento en sesiones', async () => {
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const s = sid(); await running(q, A, s);
      const [x, y] = await Promise.all([intenta(cierraSdk(q, s)), cierraRest(q, s)]);
      assert.equal(gana(x, y), 1, `iteración ${i}: ${x} ${y}`);
      assert.equal(await nResultados(s), 1);
      assert.equal((await leer(q, s)).status, 'completed');
    }
  });

  it('CARRERA forzado (propietario) vs cierre ordinario (Quest) sobre cancel_requested vencida: exactamente uno', async () => {
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const s = sid();
      await running(q, A, s, { status: 'cancel_requested', cancelSolicitadaEn: ts(-5 * MIN), cancelSolicitadaPor: A.uid });
      const [f, c] = await Promise.all([intenta(forzaSdk(A, q, s)), intenta(cierraSdk(q, s, 'interrupted'))]);
      assert.equal(gana(f, c), 1, `iteración ${i}: forzado=${f} cierre=${c}`);
      const r = await leer(q, s);
      if (f) { assert.equal(r.motivo, 'sin_respuesta'); assert.equal(r.forzadoPor, A.uid); assert.equal(r.resultadoEn, undefined); assert.equal(await nResultados(s), 0); }
      else { assert.equal(r.motivo, 'abandono'); assert.equal(r.forzadoPor, undefined); assert.equal(await nResultados(s), 1); }
    }
  });

  it('CARRERA forzado vs resultado tardio: el forzado siempre prospera; el tardio solo si llega despues, sin romper la traza', async () => {
    let tardioGana = 0;
    for (let i = 0; i < REPS * 2; i++) {
      const q = await questVinculada(A); const s = sid();
      await running(q, A, s, { status: 'cancel_requested', cancelSolicitadaEn: ts(-5 * MIN), cancelSolicitadaPor: A.uid });
      const [f, t] = await Promise.all([intenta(forzaSdk(A, q, s)), intenta(tardioSdk(q, s))]);
      assert.equal(f, true);
      const r = await leer(q, s);
      assert.equal(r.status, 'interrupted'); assert.equal(r.motivo, 'sin_respuesta'); assert.equal(r.forzadoMotivo, 'Sin respuesta de la gafa');
      assert.equal(!!r.resultadoEn, t); assert.equal(await nResultados(s), t ? 1 : 0);
      if (t) { assert.equal(r.tardio, true); tardioGana++; }
    }
    console.log(`  (forzado vs tardío: el tardío llegó después en ${tardioGana} de ${REPS * 2})`);
    // determinista: forzado ya aplicado -> el tardío prospera exactamente una vez
    const q = await questVinculada(A); const s = sid();
    await running(q, A, s, { status: 'cancel_requested', cancelSolicitadaEn: ts(-5 * MIN), cancelSolicitadaPor: A.uid });
    assert.equal(await intenta(forzaSdk(A, q, s)), true);
    const [t1, t2] = await Promise.all([intenta(tardioSdk(q, s)), intenta(tardioSdk(q, s))]);
    assert.equal(gana(t1, t2), 1);
    assert.equal(await nResultados(s), 1);
  });

  it('CARRERA publicar vs iniciar: con la pending viva, la publicacion que la pisa NUNCA prospera; el inicio prospera (con reintento si hubo contencion)', async () => {
    let contenciones = 0;
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const s = sid(); const s2 = sid(); await siembra(q, A, s);
      const [p, ini] = await Promise.all([intenta(publica(A, q, s2, { prev: s })), intenta(iniciaSdk(q, s))]);
      assert.equal(p, false, `iteración ${i}: no se pisa una pending viva`);
      if (!ini) {
        // HALLAZGO (emulador): un write concurrente sobre el MISMO buzón (aunque las reglas lo denieguen) bloquea la lectura
        // get(current) de la regla de inicio y esta devuelve PERMISSION_DENIED transitorio. Es un fallo seguro (deniega);
        // la Quest debe reintentar tras releer el buzón. Sin la carrera el inicio prospera.
        contenciones++;
        assert.equal(await intenta(iniciaSdk(q, s)), true, `iteración ${i}: el reintento debe prosperar`);
      }
      assert.equal((await leer(q, s)).status, 'running');
      assert.equal((await aDb.doc(curPath(q.uid)).get()).data().sessionId, s);
      assert.equal((await aDb.doc(regPath(q.uid, s2)).get()).exists, false);
    }
    console.log(`  (publicar vs iniciar: ${contenciones} de ${REPS} inicios necesitaron reintento por contención sobre el buzón)`);
  });

  it('CARRERA dos publicaciones (dos pestanas) tras una sesion terminal: exactamente una gana; la perdedora no deja registro huerfano', async () => {
    for (let i = 0; i < REPS; i++) {
      const q = await questVinculada(A); const s0 = sid(); const s1 = sid(), s2 = sid();
      await siembra(q, A, s0, { status: 'completed', iniciadaEn: ts(-20 * MIN), finalizadaEn: ts(-1 * MIN) });
      const A2 = await fisio('life.a@example.test');
      const [x, y] = await Promise.all([intenta(publica(A, q, s1)), intenta(publica(A2, q, s2))]);
      assert.equal(gana(x, y), 1, `iteración ${i}: ${x} ${y}`);
      const cur = (await aDb.doc(curPath(q.uid)).get()).data().sessionId;
      assert.equal(cur, x ? s1 : s2);
      assert.equal((await aDb.doc(regPath(q.uid, x ? s2 : s1)).get()).exists, false, 'batch atómico: sin registro huérfano');
    }
  });

  it('CARRERA resultado tardio de A mientras se publica/inicia B: B no se ve afectada', async () => {
    for (let i = 0; i < 3; i++) {
      const q = await questVinculada(A); const sa = sid(), sb = sid();
      await siembra(q, A, sa, { status: 'interrupted', motivo: 'sin_respuesta', iniciadaEn: ts(-60 * MIN), finalizadaEn: ts(-20 * MIN), forzadoPor: A.uid, forzadoEn: ts(-20 * MIN), forzadoMotivo: 'abc def', cierrePor: A.uid });
      assert.equal(await intenta(publica(A, q, sb)), true);
      const [t, ini] = await Promise.all([intenta(tardioSdk(q, sa)), intenta(iniciaSdk(q, sb))]);
      assert.equal(t, true); assert.equal(ini, true);
      assert.equal((await leer(q, sb)).status, 'running');
      assert.equal((await leer(q, sa)).tardio, true);
    }
  });
});
