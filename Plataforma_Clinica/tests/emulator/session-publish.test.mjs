// PR5c-3b-2 - Operaciones de ciclo de vida de sesión de app/devices.ts contra Auth Emulator + Firestore Emulator con
// firestore.rules.next (NO desplegadas): publicación atómica registro + buzón, cancelar, solicitar cancelación, cierre
// forzado, vencimiento, suscripciones, CONCURRENCIA (Promise.all) y PÉRDIDA DE CONEXIÓN / resultado desconocido.
// Identidades REALES del emulador (fisios con email verificado creados con Admin SDK; Quest = Auth anónima real).
// Admin SDK SOLO para preparar estados sintéticos (documentos con fechas antiguas); nunca en el código de la app.
// Solo proyecto demo-tfg-vr y datos SINTÉTICOS. Se ejecuta con `pnpm test:emulator`.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, updateDoc, writeBatch, serverTimestamp, Timestamp,
  disableNetwork, enableNetwork,
} from 'firebase/firestore';
import { initializeApp as adminInit, deleteApp as adminDelete } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore, Timestamp as AdminTs } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECT_ID = 'demo-tfg-vr';
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PASSWORD = 'PruebaSintetica-123';
const [FS_HOST, FS_PORT] = FS.split(':');
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DOCS = `http://${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const NAME = (p) => `projects/${PROJECT_ID}/databases/(default)/documents/${p}`;
const MIN = 60_000;

const D = await import(pathToFileURL(join(root, 'app', 'devices.ts')).href);
const { generarPid } = await import(pathToFileURL(join(root, 'app', 'patientIdentity.ts')).href);

const apps = [];
let adminApp, aAuth, aDb, n = 0;

function cliente() {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `pub-${n++}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));
  return { app, auth, db };
}
/** Fisio con servicio; `deps` permite inyectar fallos/relojes en ESA instancia. */
async function entrar(email, deps = {}) {
  const c = cliente();
  await signInWithEmailAndPassword(c.auth, email, PASSWORD);
  c.uid = c.auth.currentUser.uid;
  c.svc = D.crearServicioDispositivos({ db: c.db, auth: c.auth, ...deps });
  return c;
}
const codigoAleatorio = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/** Quest = anónimo real + solicitud de vínculo; la confirma `owner` con el servicio. */
async function questVinculada(owner, alias = 'Quest sintetica') {
  const c = cliente();
  const { user } = await signInAnonymously(c.auth);
  const codigo = codigoAleatorio();
  const b = writeBatch(c.db);
  b.set(doc(c.db, 'dispositivos', user.uid), { estado: 'sin_vincular', codigoActual: codigo, creadoEn: serverTimestamp() });
  b.set(doc(c.db, 'vinculos', codigo), {
    deviceUid: user.uid, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(), expira: Timestamp.fromMillis(Date.now() + 9 * MIN),
  });
  await b.commit();
  await owner.svc.confirmarVinculo(codigo, alias);
  return { ...c, uid: user.uid, token: await user.getIdToken() };
}

const sesionOk = (extra = {}) => ({
  patientId: generarPid(), patientAlias: 'P-001', gameId: 'gems', duration: 300,
  difficulty: 'Fácil', therapySide: 'Derecho', sessionType: 'Rehabilitación', ...extra,
});
const regPath = (dev, s) => `dispositivos/${dev}/sesiones_registro/${s}`;
const curPath = (dev) => `dispositivos/${dev}/sesion_activa/current`;
const verReg = async (dev, s) => (await aDb.doc(regPath(dev, s)).get()).data();
const verCur = async (dev) => (await aDb.doc(curPath(dev)).get()).data();
const nRegistros = async (dev) => (await aDb.collection(`dispositivos/${dev}/sesiones_registro`).get()).size;
const codigo = (p) => p.then(() => 'ok', (e) => e?.codigo ?? e?.code ?? String(e));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasta(cond, ms = 10_000, paso = 50) {
  const fin = Date.now() + ms;
  for (;;) {
    const v = await cond();
    if (v) return v;
    if (Date.now() > fin) throw new Error('timeout esperando condición');
    await esperar(paso);
  }
}
const denegado = (e) => e?.code === 'permission-denied' || e?.codigo === 'permiso_denegado';
const assertDenegado = (p, msg) => assert.rejects(p, (e) => { assert.ok(denegado(e), `${msg ?? ''}: esperado denegado, llegó ${e?.code ?? e?.codigo}`); return true; });

// ---- Quest simulada (SDK): iniciar, cerrar con resultado, resultado tardío
const iniciaQuest = (q, sid) => updateDoc(doc(q.db, regPath(q.uid, sid)), { status: 'running', iniciadaEn: serverTimestamp() });
const resultado = (dev, sid, pid, status = 'completed') => ({
  patientId: pid, sessionId: sid, deviceUid: dev, gameId: 'gems', duration: 120, score: 10, fromVR: true, notes: '', status,
  durationUnit: 's', patientAlias: 'P-001', accuracy: 80, gemsNormal: 5, gemsGolden: 1, gemsGreen: 0, gemsPurple: 0, gemsRed: 0,
  gemsRedAvoided: 0, totalGems: 6, avgTimePerGem: 2, totalMovements: 6, movementsSummary: [],
  zonesWorked: { Alto: 1, Medio: 2, Lateral: 2, Bajo: 1 },
});
const cierraQuest = (q, sid, pid, status = 'completed', motivo = 'abandono', tardio = false) => {
  const b = writeBatch(q.db);
  b.set(doc(q.db, `sesiones/${sid}`), { ...resultado(q.uid, sid, pid, status), createdAt: serverTimestamp() });
  b.update(doc(q.db, regPath(q.uid, sid)), {
    status, finalizadaEn: serverTimestamp(), tardio, resultadoEn: serverTimestamp(), ...(status === 'interrupted' ? { motivo } : {}),
  });
  return b.commit();
};
const tardioQuest = (q, sid, pid) => {
  const b = writeBatch(q.db);
  b.set(doc(q.db, `sesiones/${sid}`), { ...resultado(q.uid, sid, pid, 'interrupted'), createdAt: serverTimestamp() });
  b.update(doc(q.db, regPath(q.uid, sid)), { resultadoEn: serverTimestamp(), tardio: true });
  return b.commit();
};
/** Inicio por REST (como Godot): mismo token, otra conexión. true = aceptado, false = denegado/precondición. */
async function iniciaRest(q, sid) {
  const body = { writes: [{
    update: { name: NAME(regPath(q.uid, sid)), fields: { status: { stringValue: 'running' } } },
    updateMask: { fieldPaths: ['status'] }, updateTransforms: [{ fieldPath: 'iniciadaEn', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: true },
  }] };
  const r = await fetch(`${DOCS}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${q.token}` }, body: JSON.stringify(body) });
  if (r.status === 200) return true;
  if (r.status === 403 || r.status === 409 || r.status === 400) return false;
  throw new Error(`REST ${r.status}`);
}

// ---- Estados sintéticos con Admin SDK (fechas antiguas imposibles de crear con las reglas)
const T = (msDesdeAhora) => AdminTs.fromMillis(Date.now() + msDesdeAhora);
async function plantar(q, ownerUid, sid, over = {}, { buzon = true } = {}) {
  const base = {
    sessionId: sid, patientId: generarPid(), patientAlias: 'P-001', gameId: 'gems', duration: 60, difficulty: 'Fácil',
    therapySide: 'Derecho', sessionType: 'Rehabilitación', deviceUid: q.uid, ownerUid,
    publicadaEn: T(-3 * 3600_000), venceEn: T(-3 * 3600_000 + 20 * MIN), status: 'pending',
  };
  const d = { ...base, ...over };
  await aDb.doc(regPath(q.uid, sid)).set(d);
  if (buzon) await aDb.doc(curPath(q.uid)).set({ sessionId: sid, publicadaEn: d.publicadaEn, venceEn: d.venceEn });
  return d;
}
const sidNuevo = () => D.generarSessionId();

describe('PR5c-3b-2 ciclo de vida de sesión (devices.ts) contra rules.next', () => {
  let A, A2, B, ADMIN;
  before(async () => {
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
    await fetch(`http://${FS}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
    adminApp = adminInit({ projectId: PROJECT_ID }, 'pub-admin');
    aAuth = adminAuth(adminApp);
    aDb = adminFirestore(adminApp);
    for (const [uid, email, rol] of [['pub-fisio-a', 'pa@example.test', 'fisioterapeuta'], ['pub-fisio-b', 'pb@example.test', 'fisioterapeuta'], ['pub-admin', 'padmin@example.test', 'admin']]) {
      await aAuth.createUser({ uid, email, password: PASSWORD, emailVerified: true });
      await aDb.doc(`usuarios/${uid}`).set({ rol });
    }
    A = await entrar('pa@example.test');
    A2 = await entrar('pa@example.test'); // "otra pestaña" del mismo fisio
    B = await entrar('pb@example.test');
    ADMIN = await entrar('padmin@example.test');
  });
  after(async () => {
    for (const a of apps) { try { await deleteApp(a); } catch { /* ya cerrada */ } }
    try { await adminDelete(adminApp); } catch { /* ya cerrada */ }
  });

  // ------------------------------------------------------------------ vencimiento y reemplazo (D11)
  describe('publicar sobre sesiones previas', () => {
    it('pending vencida: el mismo batch la marca vencida y publica la nueva; pendiente viva (o dentro del margen) no se pisa', async () => {
      const q = await questVinculada(A);
      const vieja = sidNuevo();
      await plantar(q, 'pub-fisio-a', vieja);
      const pub = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      assert.equal(pub.vencidaAnterior, vieja);
      const v = await verReg(q.uid, vieja);
      assert.equal(v.status, 'vencida'); assert.equal(v.motivo, 'vencida'); assert.ok(v.finalizadaEn instanceof AdminTs);
      assert.equal(v.patientAlias, 'P-001', 'el resto del registro anterior queda intacto');
      assert.equal((await verCur(q.uid)).sessionId, pub.sessionId);
      assert.equal(await nRegistros(q.uid), 2);
      assert.equal(D.estadoVista(await A.svc.leerRegistro(q.uid, vieja), Date.now()), 'vencida');
      // pendiente viva: no se pisa
      assert.equal(await codigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk())), 'sesion_pendiente_viva');
      assert.equal(await nRegistros(q.uid), 2);
      // pendiente que venció hace 1 s: dentro de la holgura del reloj, el cliente no arriesga: sigue «viva»
      const q2 = await questVinculada(A);
      await plantar(q2, 'pub-fisio-a', sidNuevo(), { venceEn: T(-1000) });
      assert.equal(await codigo(A.svc.publicarSesionEnDispositivo(q2.uid, sesionOk())), 'sesion_pendiente_viva');
    });
    it('las terminales (completed, interrupted, cancelled, vencida) se sustituyen sin tocarlas; running/cancel_requested no', async () => {
      for (const [status, extra] of [['completed', {}], ['interrupted', { motivo: 'abandono' }], ['cancelled', { motivo: 'cancelada_por_web' }], ['vencida', { motivo: 'vencida' }]]) {
        const q = await questVinculada(A);
        const prev = sidNuevo();
        const antes = await plantar(q, 'pub-fisio-a', prev, { status, ...extra });
        const pub = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
        assert.equal(pub.vencidaAnterior, null, status);
        assert.deepEqual(await verReg(q.uid, prev), antes, `${status}: registro anterior intacto`);
        assert.equal((await verCur(q.uid)).sessionId, pub.sessionId);
      }
      for (const status of ['running', 'cancel_requested']) {
        const q = await questVinculada(A);
        const prev = sidNuevo();
        await plantar(q, 'pub-fisio-a', prev, { status, iniciadaEn: T(-10 * MIN), ...(status === 'cancel_requested' ? { cancelSolicitadaEn: T(-1000), cancelSolicitadaPor: 'pub-fisio-a' } : {}) });
        assert.equal(await codigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk())), 'sesion_en_curso', status);
        assert.equal((await verCur(q.uid)).sessionId, prev, 'el buzón no cambió');
        assert.equal(await nRegistros(q.uid), 1);
      }
    });
    it('buzón que apunta a un registro inexistente: sesion_inexistente (la web no inventa ni borra)', async () => {
      const q = await questVinculada(A);
      await aDb.doc(curPath(q.uid)).set({ sessionId: sidNuevo(), publicadaEn: T(-1000), venceEn: T(MIN) });
      assert.equal(await codigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk())), 'sesion_inexistente');
    });
    it('marcarVencida: solo pending caducada; la Quest no puede escribir vencida', async () => {
      const q = await questVinculada(A);
      const sid = sidNuevo();
      await plantar(q, 'pub-fisio-a', sid);
      await assertDenegado(updateDoc(doc(q.db, regPath(q.uid, sid)), { status: 'vencida', finalizadaEn: serverTimestamp(), motivo: 'vencida' }), 'la Quest nunca marca vencida');
      await A.svc.marcarVencida(q.uid, sid);
      const v = await verReg(q.uid, sid);
      assert.deepEqual([v.status, v.motivo], ['vencida', 'vencida']);
      assert.equal(await codigo(A.svc.marcarVencida(q.uid, sid)), 'sesion_no_cancelable', 'set-once');
      const q2 = await questVinculada(A);
      const viva = await A.svc.publicarSesionEnDispositivo(q2.uid, sesionOk());
      assert.equal(await codigo(A.svc.marcarVencida(q2.uid, viva.sessionId)), 'sesion_pendiente_viva');
      assert.equal((await verReg(q2.uid, viva.sessionId)).status, 'pending');
      // reloj del navegador adelantado: el cliente la cree vencida, el servidor no: se relee y se explica sin escribir
      const adelantado = await entrar('pa@example.test', { ahora: () => Date.now() + 2 * 3600_000 });
      assert.equal(await codigo(adelantado.svc.marcarVencida(q2.uid, viva.sessionId)), 'sesion_pendiente_viva');
      assert.equal((await verReg(q2.uid, viva.sessionId)).status, 'pending');
    });
  });

  // ------------------------------------------------------------------ cancelar / solicitar / forzar
  describe('cancelación y cierre forzado', () => {
    it('cancelar y solicitar: transiciones exactas y estados no válidos', async () => {
      const q = await questVinculada(A);
      const p1 = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      assert.equal(await codigo(A.svc.solicitarCancelacion(q.uid, p1.sessionId)), 'sesion_no_cancelable', 'solicitar exige running');
      assert.equal(await codigo(A.svc.forzarCierre(q.uid, p1.sessionId, 'motivo suficiente')), 'sesion_no_cancelable', 'forzar no aplica a pending');
      await A.svc.cancelarSesion(q.uid, p1.sessionId);
      assert.equal(await codigo(A.svc.cancelarSesion(q.uid, p1.sessionId)), 'sesion_no_cancelable');
      assert.equal(await codigo(A.svc.cancelarSesion(q.uid, sidNuevo())), 'sesion_inexistente');
      const p2 = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      await iniciaQuest(q, p2.sessionId);
      await A.svc.solicitarCancelacion(q.uid, p2.sessionId);
      assert.equal(await codigo(A.svc.solicitarCancelacion(q.uid, p2.sessionId)), 'sesion_no_cancelable', 'una sola vez');
      // la Quest cierra la cancelación pedida (interrumpida por cancelada_por_web)
      await cierraQuest(q, p2.sessionId, (await verReg(q.uid, p2.sessionId)).patientId, 'interrupted', 'cancelada_por_web');
      const fin = await A.svc.leerRegistro(q.uid, p2.sessionId);
      assert.equal(D.estadoVista(fin, Date.now()), 'interrumpida');
      assert.equal(fin.motivo, 'cancelada_por_web');
      assert.equal(await codigo(A.svc.forzarCierre(q.uid, p2.sessionId, 'motivo suficiente')), 'sesion_no_cancelable', 'terminal');
    });

    it('forzar una running: plazo duration + 30 min, motivo 5..200, traza completa, set-once y resultado tardío posterior', async () => {
      const q = await questVinculada(A);
      const pid = generarPid();
      const sid = sidNuevo();
      // running real, recién iniciada: dentro de plazo -> cliente y reglas lo impiden
      const real = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ duration: 60 }));
      await iniciaQuest(q, real.sessionId);
      assert.equal(await codigo(A.svc.forzarCierre(q.uid, real.sessionId, 'motivo suficiente')), 'plazo_no_cumplido');
      await assertDenegado(updateDoc(doc(A.db, regPath(q.uid, real.sessionId)), {
        status: 'interrupted', finalizadaEn: serverTimestamp(), motivo: 'sin_respuesta', cierrePor: 'pub-fisio-a',
        forzadoPor: 'pub-fisio-a', forzadoEn: serverTimestamp(), forzadoMotivo: 'motivo suficiente' }), 'reglas: forzar antes de plazo');
      assert.equal((await verReg(q.uid, real.sessionId)).status, 'running');
      // running antigua plantada: 2 h desde el inicio con duration 60 s
      await aDb.doc(regPath(q.uid, real.sessionId)).delete(); // limpiar para que current apunte a la plantada
      await plantar(q, 'pub-fisio-a', sid, { patientId: pid, status: 'running', iniciadaEn: T(-2 * 3600_000), publicadaEn: T(-2 * 3600_000 - MIN), venceEn: T(-2 * 3600_000 + 19 * MIN) });
      // motivo
      for (const m of ['abcd', '   ', 'x'.repeat(201)]) assert.equal(await codigo(A.svc.forzarCierre(q.uid, sid, m)), 'motivo_invalido');
      assert.equal((await verReg(q.uid, sid)).status, 'running');
      await A.svc.forzarCierre(q.uid, sid, '  La gafa dejó de responder  ');
      const f = await verReg(q.uid, sid);
      assert.equal(f.status, 'interrupted'); assert.equal(f.motivo, 'sin_respuesta');
      assert.equal(f.cierrePor, 'pub-fisio-a'); assert.equal(f.forzadoPor, 'pub-fisio-a');
      assert.equal(f.forzadoMotivo, 'La gafa dejó de responder', 'motivo recortado');
      assert.ok(f.forzadoEn instanceof AdminTs && f.finalizadaEn instanceof AdminTs);
      assert.equal(D.estadoVista(await A.svc.leerRegistro(q.uid, sid), Date.now()), 'sin_respuesta');
      assert.equal(await codigo(A.svc.forzarCierre(q.uid, sid, 'segundo intento válido')), 'sesion_no_cancelable', 'set-once');
      // la Quest entrega después su resultado: no cambia status ni traza forzada; una sola vez
      await tardioQuest(q, sid, pid);
      const t = await verReg(q.uid, sid);
      assert.equal(t.tardio, true); assert.ok(t.resultadoEn instanceof AdminTs);
      assert.equal(t.status, 'interrupted'); assert.equal(t.forzadoMotivo, 'La gafa dejó de responder');
      assert.equal(D.estadoVista(await A.svc.leerRegistro(q.uid, sid), Date.now()), 'resultado_tardio');
      await assertDenegado(tardioQuest(q, sid, pid), 'un segundo resultado tardío');
    });

    it('forzar una cancel_requested: 2 min tras solicitar; sin rama admin ni fisio ajeno', async () => {
      const q = await questVinculada(A);
      const reciente = sidNuevo();
      await plantar(q, 'pub-fisio-a', reciente, { status: 'running', iniciadaEn: T(-2 * 3600_000), publicadaEn: T(-2 * 3600_000 - MIN), venceEn: T(-100 * MIN), cancelSolicitadaEn: T(-30_000), cancelSolicitadaPor: 'pub-fisio-a' });
      await aDb.doc(regPath(q.uid, reciente)).update({ status: 'cancel_requested' });
      assert.equal(await codigo(A.svc.forzarCierre(q.uid, reciente, 'motivo suficiente')), 'plazo_no_cumplido', 'solo 30 s desde la solicitud');
      await aDb.doc(regPath(q.uid, reciente)).update({ cancelSolicitadaEn: T(-5 * MIN) });
      await assertDenegado(B.svc.forzarCierre(q.uid, reciente, 'motivo suficiente de B'), 'fisio ajeno');
      await assertDenegado(ADMIN.svc.forzarCierre(q.uid, reciente, 'motivo suficiente admin'), 'admin sin ser propietario (3b-3 aún no existe)');
      assert.equal((await verReg(q.uid, reciente)).status, 'cancel_requested');
      await A.svc.forzarCierre(q.uid, reciente, 'Sin respuesta tras solicitar');
      const f = await verReg(q.uid, reciente);
      assert.deepEqual([f.status, f.motivo, f.forzadoMotivo], ['interrupted', 'sin_respuesta', 'Sin respuesta tras solicitar']);
    });

    it('reloj del navegador adelantado: forzar antes de plazo real -> el servidor deniega y se informa plazo_no_cumplido', async () => {
      const q = await questVinculada(A);
      const sid = sidNuevo();
      await plantar(q, 'pub-fisio-a', sid, { status: 'running', iniciadaEn: T(-10 * MIN), duration: 600 });
      const adelantado = await entrar('pa@example.test', { ahora: () => Date.now() + 3 * 3600_000 });
      assert.equal(await codigo(adelantado.svc.forzarCierre(q.uid, sid, 'motivo suficiente')), 'plazo_no_cumplido');
      assert.equal((await verReg(q.uid, sid)).status, 'running');
    });
  });

  // ------------------------------------------------------------------ concurrencia
  describe('concurrencia (Promise.all)', () => {
    it('dos publicar simultáneos en la misma Quest (dos pestañas): gana exactamente uno, el otro no escribe nada', async () => {
      const resultados = [];
      for (let i = 0; i < 6; i++) {
        const q = await questVinculada(A);
        const [r1, r2] = await Promise.allSettled([
          A.svc.publicarSesionEnDispositivo(q.uid, sesionOk()),
          A2.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ gameId: 'luggage_handler' })),
        ]);
        const ok = [r1, r2].filter((r) => r.status === 'fulfilled');
        const ko = [r1, r2].filter((r) => r.status === 'rejected');
        assert.equal(ok.length, 1, `iteración ${i}: exactamente una publicación`);
        resultados.push(ko[0].reason.codigo);
        assert.ok(['sesion_pendiente_viva', 'permiso_denegado'].includes(ko[0].reason.codigo), ko[0].reason.codigo);
        assert.equal(await nRegistros(q.uid), 1, 'sin registros huérfanos del perdedor (batch atómico)');
        assert.equal((await verCur(q.uid)).sessionId, ok[0].value.sessionId, 'el buzón apunta al ganador');
        assert.equal((await verReg(q.uid, ok[0].value.sessionId)).status, 'pending');
      }
      // El perdedor debe quedar clasificado de forma útil (relectura tras la denegación)
      assert.ok(resultados.every((c) => c === 'sesion_pendiente_viva'), `códigos del perdedor: ${resultados.join(',')}`);
    });

    it('tres publicar simultáneos: una sola sesión viva', async () => {
      const q = await questVinculada(A);
      const rs = await Promise.allSettled([1, 2, 3].map((i) => (i === 2 ? A2 : A).svc.publicarSesionEnDispositivo(q.uid, sesionOk())));
      assert.equal(rs.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(await nRegistros(q.uid), 1);
    });

    it('cancelar vs inicio de la Quest (SDK y REST, ambos órdenes): gana uno solo y el otro se explica', async () => {
      const resumen = { canceladas: 0, iniciadas: 0 };
      for (let i = 0; i < 8; i++) {
        const q = await questVinculada(A);
        const { sessionId: sid } = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
        const cancelar = () => A.svc.cancelarSesion(q.uid, sid).then(() => 'ok', (e) => e.codigo);
        const iniciar = () => (i % 2 ? iniciaRest(q, sid) : iniciaQuest(q, sid).then(() => true, () => false));
        const [rc, ri] = i % 4 < 2
          ? await Promise.all([cancelar(), iniciar()])
          : (await Promise.all([iniciar(), cancelar()])).reverse();
        const estado = (await verReg(q.uid, sid)).status;
        assert.notEqual(rc === 'ok', ri === true, `iteración ${i}: cancelar=${rc} iniciar=${ri} estado=${estado}`);
        if (rc === 'ok') { assert.equal(estado, 'cancelled'); resumen.canceladas++; } else {
          assert.equal(rc, 'sesion_no_cancelable'); assert.equal(estado, 'running'); resumen.iniciadas++;
          await A.svc.solicitarCancelacion(q.uid, sid); // si la Quest ganó, la web ofrece la solicitud
          assert.equal((await verReg(q.uid, sid)).status, 'cancel_requested');
        }
      }
      assert.equal(resumen.canceladas + resumen.iniciadas, 8);
    });

    it('dos cancelar y dos solicitar simultáneos: una sola escritura efectiva', async () => {
      const q = await questVinculada(A);
      const { sessionId: s1 } = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      const rs = await Promise.all([A.svc.cancelarSesion(q.uid, s1), A2.svc.cancelarSesion(q.uid, s1)].map(codigo));
      assert.deepEqual(rs.slice().sort(), ['ok', 'sesion_no_cancelable']);
      const { sessionId: s2 } = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      await iniciaQuest(q, s2);
      const rs2 = await Promise.all([A.svc.solicitarCancelacion(q.uid, s2), A2.svc.solicitarCancelacion(q.uid, s2)].map(codigo));
      assert.deepEqual(rs2.slice().sort(), ['ok', 'sesion_no_cancelable']);
    });

    it('dos forzados simultáneos: uno solo se aplica y la traza es la del ganador', async () => {
      const q = await questVinculada(A);
      const sid = sidNuevo();
      await plantar(q, 'pub-fisio-a', sid, { status: 'running', iniciadaEn: T(-2 * 3600_000), publicadaEn: T(-2 * 3600_000 - MIN), venceEn: T(-100 * MIN) });
      const rs = await Promise.all([
        A.svc.forzarCierre(q.uid, sid, 'Motivo desde la pestaña uno'),
        A2.svc.forzarCierre(q.uid, sid, 'Motivo desde la pestaña dos'),
      ].map(codigo));
      assert.deepEqual(rs.slice().sort(), ['ok', 'sesion_no_cancelable']);
      const f = await verReg(q.uid, sid);
      assert.equal(f.status, 'interrupted');
      assert.ok(['Motivo desde la pestaña uno', 'Motivo desde la pestaña dos'].includes(f.forzadoMotivo));
    });

    it('forzar vs cierre normal de la Quest: no hay estado ambiguo', async () => {
      const q = await questVinculada(A);
      const pid = generarPid();
      const sid = sidNuevo();
      await plantar(q, 'pub-fisio-a', sid, { patientId: pid, status: 'running', iniciadaEn: T(-2 * 3600_000), publicadaEn: T(-2 * 3600_000 - MIN), venceEn: T(-100 * MIN) });
      const [rf, rq] = await Promise.all([
        codigo(A.svc.forzarCierre(q.uid, sid, 'Sin respuesta de la gafa')),
        cierraQuest(q, sid, pid, 'completed', 'abandono', true).then(() => 'ok', () => 'denegado'),
      ]);
      const r = await verReg(q.uid, sid);
      if (rf === 'ok') {
        assert.equal(r.status, 'interrupted'); assert.equal(r.motivo, 'sin_respuesta');
        // el cierre normal pierde (status ya no es running); la Quest solo podrá aportar el resultado tardío
        assert.equal(rq, 'denegado');
      } else {
        assert.equal(rq, 'ok'); assert.equal(r.status, 'completed'); assert.equal(rf, 'sesion_no_cancelable');
        assert.ok(!('forzadoMotivo' in r));
      }
    });
  });

  // ------------------------------------------------------------------ pérdida de conexión
  describe('pérdida de conexión y resultado desconocido', () => {
    const errRed = () => Object.assign(new Error('unavailable'), { code: 'unavailable' });

    it('el commit falla ANTES de llegar al servidor: resultado_desconocido, nada escrito, el reintento manual funciona sin duplicados', async () => {
      let llamadas = 0;
      const F = await entrar('pa@example.test', { ejecutarCommit: async () => { llamadas++; throw errRed(); } });
      const q = await questVinculada(A);
      const e = await F.svc.publicarSesionEnDispositivo(q.uid, sesionOk()).catch((x) => x);
      assert.equal(e.codigo, 'resultado_desconocido');
      assert.match(e.sessionId, /^[A-Za-z0-9_-]{22}$/, 'devuelve el sessionId para reconciliar');
      assert.equal(llamadas, 1, 'el servicio NO reintenta solo');
      assert.equal(await F.svc.leerRegistro(q.uid, e.sessionId), null, 'reconciliación: no se escribió');
      assert.equal(await nRegistros(q.uid), 0);
      const ok = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      assert.notEqual(ok.sessionId, e.sessionId);
      assert.equal(await nRegistros(q.uid), 1);
    });

    it('el commit SE APLICA pero la confirmación se pierde: resultado_desconocido; releer muestra la sesión y repetir no la duplica', async () => {
      const F = await entrar('pa@example.test', { ejecutarCommit: async (b) => { await b.commit(); throw errRed(); } });
      const q = await questVinculada(A);
      const e = await F.svc.publicarSesionEnDispositivo(q.uid, sesionOk()).catch((x) => x);
      assert.equal(e.codigo, 'resultado_desconocido');
      const r = await F.svc.leerRegistro(q.uid, e.sessionId);
      assert.equal(r.status, 'pending', 'reconciliación: sí se había aplicado');
      assert.equal((await F.svc.leerSesionVigente(q.uid)).sessionId, e.sessionId);
      // el «reintento» de la UI vuelve a pasar por la comprobación previa y se detiene
      assert.equal(await codigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk())), 'sesion_pendiente_viva');
      assert.equal(await nRegistros(q.uid), 1, 'sin duplicados');
    });

    it('commit colgado (sin respuesta): el tope de espera produce resultado_desconocido', async () => {
      const F = await entrar('pa@example.test', { ejecutarCommit: () => new Promise(() => {}), tiempoEscrituraMs: 300 });
      const q = await questVinculada(A);
      const t0 = Date.now();
      const e = await F.svc.publicarSesionEnDispositivo(q.uid, sesionOk()).catch((x) => x);
      assert.equal(e.codigo, 'resultado_desconocido');
      assert.ok(Date.now() - t0 < 5000);
      assert.equal(await nRegistros(q.uid), 0);
    });

    it('sin red durante las lecturas previas (red desactivada en el SDK): código red y nada se escribe', async () => {
      const q = await questVinculada(A);
      const F = await entrar('pa@example.test', { tiempoLecturaMs: 1500 });
      await disableNetwork(F.db);
      try {
        const sid = (await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk())).sessionId;
        assert.equal(await codigo(F.svc.publicarSesionEnDispositivo(q.uid, sesionOk())), 'red');
        assert.equal(await codigo(F.svc.cancelarSesion(q.uid, sid)), 'red');
        assert.equal(await codigo(F.svc.forzarCierre(q.uid, sid, 'motivo suficiente')), 'red');
        assert.equal(await codigo(F.svc.leerSesionVigente(q.uid)), 'red');
        assert.equal((await verReg(q.uid, sid)).status, 'pending');
        assert.equal(await nRegistros(q.uid), 1);
      } finally { await enableNetwork(F.db); }
    });

    it('puerto cerrado: el servicio responde red en poco tiempo y no escribe', async () => {
      const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `pub-cerrado-${n++}`);
      apps.push(app);
      const db = getFirestore(app);
      connectFirestoreEmulator(db, '127.0.0.1', 1); // nadie escucha
      const svc = D.crearServicioDispositivos({ db, auth: { currentUser: { uid: 'pub-fisio-a', isAnonymous: false } }, tiempoLecturaMs: 800 });
      const t0 = Date.now();
      assert.equal(await codigo(svc.publicarSesionEnDispositivo('dispositivo-x', sesionOk())), 'red');
      assert.equal(await codigo(svc.cancelarSesion('dispositivo-x', sidNuevo())), 'red');
      assert.ok(Date.now() - t0 < 6000);
    });

    it('la red cae justo entre la lectura y la escritura de cancelar: resultado_desconocido; la escritura encolada puede aplicarse y el reintento ya no duplica', async () => {
      const q = await questVinculada(A);
      const { sessionId: sid } = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      let cortada = false;
      let F;
      F = await entrar('pa@example.test', {
        tiempoEscrituraMs: 400,
        ahora: () => { if (!cortada) { cortada = true; disableNetwork(F.db); } return Date.now(); },
      });
      const e = await F.svc.cancelarSesion(q.uid, sid).catch((x) => x);
      assert.equal(e.codigo, 'resultado_desconocido');
      assert.equal(e.sessionId, sid);
      assert.equal((await verReg(q.uid, sid)).status, 'pending', 'aún sin aplicar mientras no hay red');
      await enableNetwork(F.db);
      // Reconciliación: la escritura encolada del SDK llega al recuperar la red
      await hasta(async () => (await verReg(q.uid, sid)).status === 'cancelled');
      assert.equal(await codigo(A.svc.cancelarSesion(q.uid, sid)), 'sesion_no_cancelable', 'repetir no duplica ni falla en silencio');
    });
  });

  // ------------------------------------------------------------------ suscripciones
  describe('suscripciones (sin «en línea»)', () => {
    it('suscribirSesionVigente sigue el buzón y el registro a través de todo el ciclo; suscribirRegistro y baja', async () => {
      const q = await questVinculada(A);
      const vistos = [];
      const errores = [];
      const baja = A.svc.suscribirSesionVigente(q.uid, (r) => vistos.push(r === null ? null : D.estadoVista(r, Date.now())), (e) => errores.push(e));
      await hasta(() => vistos.length > 0);
      assert.equal(vistos.at(-1), null, 'sin buzón: null');
      const p1 = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      await hasta(() => vistos.at(-1) === 'pendiente');
      const regVistos = [];
      const baja2 = A.svc.suscribirRegistro(q.uid, p1.sessionId, (r) => regVistos.push(r && r.status));
      await iniciaQuest(q, p1.sessionId);
      await hasta(() => vistos.at(-1) === 'en_curso');
      await A.svc.solicitarCancelacion(q.uid, p1.sessionId);
      await hasta(() => vistos.at(-1) === 'cancelacion_solicitada');
      await cierraQuest(q, p1.sessionId, (await verReg(q.uid, p1.sessionId)).patientId, 'interrupted', 'cancelada_por_web');
      await hasta(() => vistos.at(-1) === 'interrumpida');
      const p2 = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      await hasta(() => vistos.at(-1) === 'pendiente' && regVistos.includes('interrupted'));
      await A.svc.cancelarSesion(q.uid, p2.sessionId);
      await hasta(() => vistos.at(-1) === 'cancelada');
      assert.ok(regVistos.includes('running') && regVistos.includes('cancel_requested'));
      assert.deepEqual(errores, []);
      for (const v of vistos) assert.ok(v === null || !/l[ií]nea|online/i.test(v));
      baja(); baja2();
      const n0 = vistos.length;
      await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      await esperar(500);
      assert.equal(vistos.length, n0, 'tras darse de baja no llegan más eventos');
    });

    it('un fisio ajeno recibe permiso_denegado por onError (no datos); suscribirRegistro de un registro inexistente da null', async () => {
      const q = await questVinculada(A);
      const p = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
      const errs = []; const datos = [];
      const baja = B.svc.suscribirSesionVigente(q.uid, (r) => datos.push(r), (e) => errs.push(e.codigo));
      const baja2 = B.svc.suscribirRegistro(q.uid, p.sessionId, (r) => datos.push(r), (e) => errs.push(e.codigo));
      await hasta(() => errs.length >= 2);
      assert.deepEqual(errs, ['permiso_denegado', 'permiso_denegado']);
      assert.deepEqual(datos, []);
      baja(); baja2();
      const nulos = [];
      const baja3 = A.svc.suscribirRegistro(q.uid, sidNuevo(), (r) => nulos.push(r));
      await hasta(() => nulos.length > 0);
      assert.deepEqual(nulos, [null]);
      baja3();
    });
  });
});
