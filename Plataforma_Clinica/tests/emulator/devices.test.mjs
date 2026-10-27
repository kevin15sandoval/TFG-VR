// PR5c-1 - Operaciones de dispositivos (app/devices.ts) contra Auth Emulator + Firestore Emulator con las reglas
// firestore.rules.next. Identidades REALES del emulador (email/contraseña verificados por Admin SDK; la Quest =
// Auth anónima real). Solo proyecto demo-tfg-vr y datos SINTÉTICOS. Se ejecuta con `pnpm test:emulator`.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously,
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs,
  collection, query, where, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { initializeApp as adminInit, deleteApp as adminDelete } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore, Timestamp as AdminTs } from 'firebase-admin/firestore';

const SKIP_3B2 = 'PR5c-3b-2: devices.ts aún publica el modelo antiguo de sesion_activa (config completa, delete, sessionId corto); se reactiva al migrar publicarSesionEnDispositivo/limpiarSesion/cancelarSesion al batch registro+buzón';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECT_ID = 'demo-tfg-vr';
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PASSWORD = 'PruebaSintetica-123';
const [FS_HOST, FS_PORT] = FS.split(':');
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const D = await import(pathToFileURL(join(root, 'app', 'devices.ts')).href);

const apps = [];
let adminApp, aAuth, aDb;
let n = 0;

function cliente() {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `disp-${n++}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));
  return { app, auth, db };
}

async function entrar(email) {
  const c = cliente();
  await signInWithEmailAndPassword(c.auth, email, PASSWORD);
  c.svc = D.crearServicioDispositivos({ db: c.db, auth: c.auth });
  return c;
}

const codigoAleatorio = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

// La Quest simulada: anónimo real + batch dispositivos/{uid} + vinculos/{codigo} (contrato de la gafa).
async function crearQuest() {
  const c = cliente();
  const { user } = await signInAnonymously(c.auth);
  const codigo = codigoAleatorio();
  const b = writeBatch(c.db);
  b.set(doc(c.db, 'dispositivos', user.uid), { estado: 'sin_vincular', codigoActual: codigo, creadoEn: serverTimestamp() });
  b.set(doc(c.db, 'vinculos', codigo), {
    deviceUid: user.uid, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(),
    expira: Timestamp.fromMillis(Date.now() + 9 * 60_000),
  });
  await b.commit();
  c.svc = D.crearServicioDispositivos({ db: c.db, auth: c.auth });
  return { ...c, uid: user.uid, codigo };
}

const sesionOk = (extra = {}) => ({
  sessionId: `ses${codigoAleatorio()}`, patientId: 'pac-opaco-1', patientAlias: 'P-001', gameId: 'gems',
  duration: 300, difficulty: 'Fácil', therapySide: 'Derecho', sessionType: 'Rehabilitación', ...extra,
});

const gemsResultado = (deviceUid, sessionId, patientId) => ({
  patientId, sessionId, deviceUid, gameId: 'gems', duration: 120, score: 10, fromVR: true, notes: '',
  accuracy: 80, gemsNormal: 5, gemsGolden: 1, gemsGreen: 0, gemsPurple: 0, gemsRed: 0, gemsRedAvoided: 0,
  totalGems: 6, avgTimePerGem: 2, totalMovements: 6, movementsSummary: [],
  zonesWorked: { Alto: 1, Medio: 2, Lateral: 2, Bajo: 1 },
});

async function rutas() {
  const out = [];
  async function recorre(colRef) {
    for (const d of await colRef.listDocuments()) {
      if ((await d.get()).exists) out.push(d.path);
      for (const sub of await d.listCollections()) await recorre(sub);
    }
  }
  for (const col of await aDb.listCollections()) await recorre(col);
  return out.sort();
}

const denegado = (e) => e?.code === 'permission-denied' || e?.codigo === 'permiso_denegado';
async function assertDenegado(p, msg) {
  await assert.rejects(p, (e) => { assert.ok(denegado(e), `${msg ?? ''}: esperado denegado, llegó ${e?.code ?? e?.codigo}: ${e?.message}`); return true; });
}
async function assertCodigo(p, codigo) {
  await assert.rejects(p, (e) => { assert.equal(e?.codigo, codigo, `${e?.codigo}: ${e?.message}`); return true; });
}

// Vincula una Quest a un fisio con el servicio y devuelve la Quest.
async function questVinculada(fisio, alias) {
  const q = await crearQuest();
  const r = await fisio.svc.confirmarVinculo(q.codigo, alias);
  assert.equal(r.deviceUid, q.uid);
  return q;
}

describe('PR5c-1 dispositivos contra rules.next', () => {
  let A, B, SINROL, NOVERIF, ADMIN;
  before(async () => {
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
    await fetch(`http://${FS}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
    adminApp = adminInit({ projectId: PROJECT_ID }, 'disp-admin');
    aAuth = adminAuth(adminApp);
    aDb = adminFirestore(adminApp);
    const us = [
      ['pr5c-fisio-a', 'fisio.a@example.test', true, 'fisioterapeuta'],
      ['pr5c-fisio-b', 'fisio.b@example.test', true, 'fisioterapeuta'],
      ['pr5c-sinrol', 'sinrol@example.test', true, null],
      ['pr5c-noverif', 'noverif@example.test', false, 'fisioterapeuta'],
      ['pr5c-admin', 'admin@example.test', true, 'admin'],
    ];
    for (const [uid, email, emailVerified, rol] of us) {
      await aAuth.createUser({ uid, email, password: PASSWORD, emailVerified });
      if (rol) await aDb.doc(`usuarios/${uid}`).set({ rol });
    }
    await aDb.doc('pacientes/pac-opaco-1').set({ name: 'PACIENTE-SINTETICO-1', dni: '00000000T-SINTETICO' });
    await aDb.doc('pacientes/pac-opaco-2').set({ name: 'PACIENTE-SINTETICO-2' });
    A = await entrar('fisio.a@example.test');
    B = await entrar('fisio.b@example.test');
    SINROL = await entrar('sinrol@example.test');
    NOVERIF = await entrar('noverif@example.test');
    ADMIN = await entrar('admin@example.test');
  });
  after(async () => {
    for (const a of apps) { try { await deleteApp(a); } catch { /* ya cerrada */ } }
    try { await adminDelete(adminApp); } catch { /* ya cerrada */ }
  });

  // ------------------------------------------------------------------ camino feliz
  it('camino feliz: confirmar, listar, renombrar, revocar (la publicación se prueba en session-lifecycle.test.mjs; la ruta de devices.ts, en 3b-2)', async () => {
    const q = await crearQuest();
    const antes = await rutas();
    // código tecleado con guion y minúsculas
    const r = await A.svc.confirmarVinculo(`${q.codigo.slice(0, 4)}-${q.codigo.slice(4)}`.toLowerCase(), 'Quest consulta 1');
    assert.deepEqual(r, { deviceUid: q.uid, alias: 'Quest consulta 1' });
    assert.deepEqual(await rutas(), antes, 'confirmar no crea ni borra documentos');
    const dd = (await aDb.doc(`dispositivos/${q.uid}`).get()).data();
    assert.equal(dd.estado, 'vinculado'); assert.equal(dd.ownerUid, 'pr5c-fisio-a'); assert.equal(dd.alias, 'Quest consulta 1');
    const vv = (await aDb.doc(`vinculos/${q.codigo}`).get()).data();
    assert.equal(vv.estado, 'vinculado'); assert.equal(vv.usado, true); assert.equal(vv.confirmadoPor, 'pr5c-fisio-a');
    assert.ok(vv.confirmadoEn && vv.confirmadoEn.toMillis() > 0);

    const lista = await A.svc.listarMisDispositivosUnaVez();
    const mia = lista.find((x) => x.uid === q.uid);
    assert.equal(mia.estado, 'vinculado'); assert.equal(mia.alias, 'Quest consulta 1'); assert.ok(mia.vinculadoEn > 0);
    assert.ok(!('enLinea' in mia) && !('online' in mia), 'sin presencia');

    await A.svc.renombrarDispositivo(q.uid, 'Quest sala 2');
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().alias, 'Quest sala 2');

    await A.svc.revocarDispositivo(q.uid);
    const rv = (await aDb.doc(`dispositivos/${q.uid}`).get()).data();
    assert.equal(rv.estado, 'revocado'); assert.ok(rv.revocadoEn);
    assert.equal((await A.svc.listarMisDispositivosUnaVez()).find((x) => x.uid === q.uid).estado, 'revocado');
    // la revocación no borra el dispositivo ni el historial
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).exists, true);
  });

  it('camino feliz (publicación del modelo antiguo): publicar, limpiar, cancelar', { skip: SKIP_3B2 }, async () => {
    const q = await crearQuest();
    const antes = await rutas();
    // código tecleado con guion y minúsculas
    const r = await A.svc.confirmarVinculo(`${q.codigo.slice(0, 4)}-${q.codigo.slice(4)}`.toLowerCase(), 'Quest consulta 1');
    assert.deepEqual(r, { deviceUid: q.uid, alias: 'Quest consulta 1' });
    assert.deepEqual(await rutas(), antes, 'confirmar no crea ni borra documentos');
    const dd = (await aDb.doc(`dispositivos/${q.uid}`).get()).data();
    assert.equal(dd.estado, 'vinculado'); assert.equal(dd.ownerUid, 'pr5c-fisio-a'); assert.equal(dd.alias, 'Quest consulta 1');
    const vv = (await aDb.doc(`vinculos/${q.codigo}`).get()).data();
    assert.equal(vv.estado, 'vinculado'); assert.equal(vv.usado, true); assert.equal(vv.confirmadoPor, 'pr5c-fisio-a');
    assert.ok(vv.confirmadoEn && vv.confirmadoEn.toMillis() > 0);

    const lista = await A.svc.listarMisDispositivosUnaVez();
    const mia = lista.find((x) => x.uid === q.uid);
    assert.equal(mia.estado, 'vinculado'); assert.equal(mia.alias, 'Quest consulta 1'); assert.ok(mia.vinculadoEn > 0);
    assert.ok(!('enLinea' in mia) && !('online' in mia), 'sin presencia');

    await A.svc.renombrarDispositivo(q.uid, 'Quest sala 2');
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().alias, 'Quest sala 2');

    const pub = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
    assert.ok(pub.venceEn > Date.now());
    const sa = (await aDb.doc(`dispositivos/${q.uid}/sesion_activa/current`).get()).data();
    assert.equal(sa.status, 'pending'); assert.ok(sa.venceEn instanceof AdminTs); assert.ok(sa.publicadaEn instanceof AdminTs);
    assert.equal(sa.patientAlias, 'P-001');
    // republicar (update del propietario)
    await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ gameId: 'luggage_handler' }));

    await A.svc.limpiarSesion(q.uid);
    assert.equal((await aDb.doc(`dispositivos/${q.uid}/sesion_activa/current`).get()).exists, false);
    await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
    await A.svc.cancelarSesion(q.uid);
    assert.equal((await aDb.doc(`dispositivos/${q.uid}/sesion_activa/current`).get()).exists, false);

    await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
    await A.svc.revocarDispositivo(q.uid);
    const rv = (await aDb.doc(`dispositivos/${q.uid}`).get()).data();
    assert.equal(rv.estado, 'revocado'); assert.ok(rv.revocadoEn);
    assert.equal((await A.svc.listarMisDispositivosUnaVez()).find((x) => x.uid === q.uid).estado, 'revocado');
    // el propietario aún puede limpiar tras revocar; el historial no se borra
    await A.svc.limpiarSesion(q.uid);
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).exists, true);
  });

  it('listarMisDispositivos (suscripción) entrega solo los propios', async () => {
    const q = await questVinculada(A, 'Suscripcion A');
    const visto = await new Promise((res, rej) => {
      const un = A.svc.listarMisDispositivos((l) => { un(); res(l); }, rej);
    });
    assert.ok(visto.some((x) => x.uid === q.uid));
    assert.ok(visto.every((x) => ['pendiente', 'vinculado', 'revocado'].includes(x.estado)));
  });

  it('confirmar sin alias es válido (alias null)', async () => {
    const q = await crearQuest();
    assert.deepEqual(await A.svc.confirmarVinculo(q.codigo), { deviceUid: q.uid, alias: null });
  });

  // ------------------------------------------------------------------ códigos
  it('código inexistente, formato inválido y alias inválido -> errores tipados', async () => {
    await assertCodigo(A.svc.confirmarVinculo('AAAAAAAA', 'x'), 'vinculo_inexistente');
    await assertCodigo(A.svc.confirmarVinculo('ABC', 'x'), 'codigo_invalido');
    await assertCodigo(A.svc.confirmarVinculo('OOOO0000', 'x'), 'codigo_invalido');
    const q = await crearQuest();
    await assertCodigo(A.svc.confirmarVinculo(q.codigo, '<script>'), 'alias_invalido');
    await assertCodigo(A.svc.confirmarVinculo(q.codigo, 'x'.repeat(31)), 'alias_invalido');
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().estado, 'sin_vincular', 'nada se escribió');
  });

  it('código caducado: cliente (reloj +11 min) y reglas (vínculo caducado plantado con Admin SDK)', async () => {
    const q = await crearQuest();
    const tarde = D.crearServicioDispositivos({ db: A.db, auth: A.auth, ahora: () => Date.now() + 11 * 60_000 });
    await assertCodigo(tarde.confirmarVinculo(q.codigo, 'x'), 'vinculo_caducado');
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().estado, 'sin_vincular');
    // Reglas: caducado en servidor (Admin SDK escribe expira en el pasado) y escritura cruda del clínico
    await aDb.doc(`vinculos/${q.codigo}`).update({ expira: AdminTs.fromMillis(Date.now() - 60_000) });
    await assertCodigo(A.svc.confirmarVinculo(q.codigo, 'x'), 'vinculo_caducado');
    const b = writeBatch(A.db);
    b.update(doc(A.db, 'vinculos', q.codigo), { estado: 'vinculado', usado: true, confirmadoPor: 'pr5c-fisio-a', confirmadoEn: serverTimestamp() });
    b.update(doc(A.db, 'dispositivos', q.uid), { estado: 'vinculado', ownerUid: 'pr5c-fisio-a', vinculadoEn: serverTimestamp() });
    await assertDenegado(b.commit(), 'las reglas rechazan un vínculo caducado');
  });

  it('código reutilizado (usado=true) y confirmado por otro fisio -> vinculo_usado; B no puede robarlo', async () => {
    const q = await questVinculada(A, 'De A');
    await assertCodigo(A.svc.confirmarVinculo(q.codigo, 'otra'), 'vinculo_usado');
    await assertCodigo(B.svc.confirmarVinculo(q.codigo, 'mia'), 'vinculo_usado');
    const dd = (await aDb.doc(`dispositivos/${q.uid}`).get()).data();
    assert.equal(dd.ownerUid, 'pr5c-fisio-a'); assert.equal(dd.alias, 'De A');
    // escritura cruda de B sobre el dispositivo y el vínculo ya confirmados: denegada por reglas
    const b = writeBatch(B.db);
    b.update(doc(B.db, 'vinculos', q.codigo), { estado: 'vinculado', usado: true, confirmadoPor: 'pr5c-fisio-b', confirmadoEn: serverTimestamp() });
    b.update(doc(B.db, 'dispositivos', q.uid), { estado: 'vinculado', ownerUid: 'pr5c-fisio-b', vinculadoEn: serverTimestamp() });
    await assertDenegado(b.commit());
    await assertDenegado(updateDoc(doc(B.db, 'dispositivos', q.uid), { ownerUid: 'pr5c-fisio-b' }));
  });

  it('dispositivo ya vinculado a otro propietario con un vínculo pendiente plantado -> error en cliente y reglas', async () => {
    const q = await questVinculada(A, 'Ocupada');
    const cod2 = codigoAleatorio();
    await aDb.doc(`vinculos/${cod2}`).set({
      deviceUid: q.uid, estado: 'pendiente', usado: false, creadoEn: AdminTs.now(), expira: AdminTs.fromMillis(Date.now() + 5 * 60_000),
    });
    await assertCodigo(B.svc.confirmarVinculo(cod2, 'robo'), 'dispositivo_ya_vinculado');
    const b = writeBatch(B.db);
    b.update(doc(B.db, 'vinculos', cod2), { estado: 'vinculado', usado: true, confirmadoPor: 'pr5c-fisio-b', confirmadoEn: serverTimestamp() });
    b.update(doc(B.db, 'dispositivos', q.uid), { estado: 'vinculado', ownerUid: 'pr5c-fisio-b', vinculadoEn: serverTimestamp() });
    await assertDenegado(b.commit(), 'reglas: dispositivo no está sin_vincular');
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().ownerUid, 'pr5c-fisio-a');
  });

  it('código de una gafa revocada o cuyo código rotó -> errores tipados', async () => {
    const q = await questVinculada(A, 'R');
    await A.svc.revocarDispositivo(q.uid);
    const cod2 = codigoAleatorio();
    await aDb.doc(`vinculos/${cod2}`).set({
      deviceUid: q.uid, estado: 'pendiente', usado: false, creadoEn: AdminTs.now(), expira: AdminTs.fromMillis(Date.now() + 5 * 60_000),
    });
    await assertCodigo(B.svc.confirmarVinculo(cod2, 'x'), 'dispositivo_revocado');
    // rotación: vínculo pendiente cuyo codigoActual del dispositivo es otro
    const q2 = await crearQuest();
    await updateDoc(doc(q2.db, 'dispositivos', q2.uid), { codigoActual: codigoAleatorio() });
    await assertCodigo(A.svc.confirmarVinculo(q2.codigo, 'x'), 'vinculo_obsoleto');
  });

  // ------------------------------------------------------------------ aislamiento entre fisios
  it('B no puede listar, renombrar, revocar, publicar ni limpiar en dispositivos de A', { skip: SKIP_3B2 }, async () => {
    const q = await questVinculada(A, 'Solo A');
    await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
    assert.equal((await B.svc.listarMisDispositivosUnaVez()).some((x) => x.uid === q.uid), false);
    // list sin filtro por owner, o filtrando por el owner de A: denegado por reglas
    await assertDenegado(getDocs(collection(B.db, 'dispositivos')), 'list sin filtro');
    await assertDenegado(getDocs(query(collection(B.db, 'dispositivos'), where('ownerUid', '==', 'pr5c-fisio-a'))), 'list con owner ajeno');
    await assertDenegado(B.svc.renombrarDispositivo(q.uid, 'hack'));
    await assertDenegado(B.svc.revocarDispositivo(q.uid));
    await assertCodigo(B.svc.publicarSesionEnDispositivo(q.uid, sesionOk()), 'dispositivo_no_propio');
    await assertDenegado(setDoc(doc(B.db, 'dispositivos', q.uid, 'sesion_activa', 'current'), { ...sesionOk(), status: 'pending', publicadaEn: serverTimestamp(), venceEn: Timestamp.fromMillis(Date.now() + 3600_000) }), 'reglas: escritura cruda');
    await assertDenegado(B.svc.limpiarSesion(q.uid));
    await assertDenegado(getDoc(doc(B.db, 'dispositivos', q.uid, 'sesion_activa', 'current')), 'B no lee la sesión de A');
    const dd = (await aDb.doc(`dispositivos/${q.uid}`).get()).data();
    assert.equal(dd.estado, 'vinculado'); assert.equal(dd.alias, 'Solo A');
    assert.equal((await aDb.doc(`dispositivos/${q.uid}/sesion_activa/current`).get()).exists, true, 'la sesión de A sigue');
  });

  // ------------------------------------------------------------------ actores sin acceso
  it('sin rol, no verificado y anónimo: denegado en todas las funciones; no se escribe nada', async () => {
    const q = await crearQuest();
    const qv = await questVinculada(A, 'Para ajenos');
    const antes = await rutas();
    for (const [nombre, X] of [['sin rol', SINROL], ['no verificado', NOVERIF]]) {
      await assertDenegado(X.svc.confirmarVinculo(q.codigo, 'x'), `${nombre}: confirmar`);
      await assertDenegado(X.svc.listarMisDispositivosUnaVez(), `${nombre}: listar`);
      await assertDenegado(X.svc.renombrarDispositivo(qv.uid, 'x'), `${nombre}: renombrar`);
      await assertDenegado(X.svc.revocarDispositivo(qv.uid), `${nombre}: revocar`);
      await assertDenegado(X.svc.publicarSesionEnDispositivo(qv.uid, sesionOk()), `${nombre}: publicar`);
      await assertDenegado(X.svc.limpiarSesion(qv.uid), `${nombre}: limpiar`);
    }
    // Anónimo (la gafa) usando la capa de clínico: rechazo en cliente...
    for (const f of [
      () => qv.svc.confirmarVinculo(q.codigo, 'x'), () => qv.svc.listarMisDispositivosUnaVez(),
      () => qv.svc.renombrarDispositivo(qv.uid, 'x'), () => qv.svc.revocarDispositivo(qv.uid),
      () => qv.svc.publicarSesionEnDispositivo(qv.uid, sesionOk()), () => qv.svc.limpiarSesion(qv.uid),
    ]) await assertCodigo(f(), 'sin_permiso');
    // ...y rechazo por las REGLAS con escrituras crudas del anónimo (defensa en profundidad)
    await assertDenegado(getDoc(doc(qv.db, 'vinculos', q.codigo)), 'anónimo no lee vínculos');
    await assertDenegado(getDocs(query(collection(qv.db, 'dispositivos'), where('ownerUid', '==', 'pr5c-fisio-a'))), 'anónimo no lista');
    await assertDenegado(updateDoc(doc(qv.db, 'dispositivos', qv.uid), { alias: 'mio' }), 'anónimo no renombra');
    await assertDenegado(updateDoc(doc(qv.db, 'dispositivos', qv.uid), { estado: 'revocado', revocadoEn: serverTimestamp() }), 'anónimo no revoca');
    await assertDenegado(setDoc(doc(qv.db, 'dispositivos', qv.uid, 'sesion_activa', 'current'), { ...sesionOk(), status: 'pending', publicadaEn: serverTimestamp(), venceEn: Timestamp.fromMillis(Date.now() + 3600_000) }), 'anónimo no publica');
    // Sin sesión en absoluto
    const anon = cliente();
    anon.svc = D.crearServicioDispositivos({ db: anon.db, auth: anon.auth });
    await assertCodigo(anon.svc.confirmarVinculo(q.codigo, 'x'), 'sin_sesion');
    await assertDenegado(getDoc(doc(anon.db, 'vinculos', q.codigo)), 'sin auth no lee');
    assert.deepEqual(await rutas(), antes, 'no se escribió nada');
  });

  it('admin: lista solo los suyos (las reglas no le dan list global)', async () => {
    const q = await questVinculada(A, 'No de admin');
    assert.equal((await ADMIN.svc.listarMisDispositivosUnaVez()).some((x) => x.uid === q.uid), false);
    await assertDenegado(getDocs(collection(ADMIN.db, 'dispositivos')));
  });

  // ------------------------------------------------------------------ Quest revocada / otras
  it('Quest vinculada lee su sesión, no la de otras, no hace list y el documento no lleva nombre real', { skip: SKIP_3B2 }, async () => {
    const qa = await questVinculada(A, 'QA');
    const qb = await questVinculada(B, 'QB');
    await A.svc.publicarSesionEnDispositivo(qa.uid, sesionOk());
    await B.svc.publicarSesionEnDispositivo(qb.uid, sesionOk({ patientId: 'pac-opaco-2', patientAlias: 'P-002' }));
    const propia = await getDoc(doc(qa.db, 'dispositivos', qa.uid, 'sesion_activa', 'current'));
    assert.equal(propia.exists(), true);
    const claves = Object.keys(propia.data()).sort();
    assert.deepEqual(claves, ['difficulty', 'duration', 'gameId', 'patientAlias', 'patientId', 'publicadaEn', 'sessionId', 'sessionType', 'status', 'therapySide', 'venceEn']);
    const texto = JSON.stringify(propia.data(), (k, v) => (v instanceof Timestamp ? v.toMillis() : v));
    assert.doesNotMatch(texto, /SINTETICO|name|dni|nombre/i, 'sin nombre ni DNI en el payload visible por la Quest');
    // otras gafas / listados / datos de paciente
    await assertDenegado(getDoc(doc(qa.db, 'dispositivos', qb.uid, 'sesion_activa', 'current')), 'Quest A no lee la sesión de Quest B');
    await assertDenegado(getDocs(collection(qa.db, 'dispositivos', qa.uid, 'sesion_activa')), 'list sesion_activa');
    await assertDenegado(getDocs(collection(qa.db, 'dispositivos')), 'list dispositivos');
    await assertDenegado(getDoc(doc(qa.db, 'dispositivos', qb.uid)), 'Quest A no lee el dispositivo de B');
    await assertDenegado(getDoc(doc(qa.db, 'pacientes', 'pac-opaco-1')), 'Quest no lee pacientes');
    await assertDenegado(getDocs(collection(qa.db, 'pacientes')));
    await assertDenegado(getDoc(doc(qa.db, 'sesion_activa', 'current')), 'raíz global denegada');
  });

  it('Quest revocada: no lee la sesión activa ni crea resultados; publicar sobre revocada falla (cliente y reglas)', { skip: SKIP_3B2 }, async () => {
    const q = await questVinculada(A, 'Se revoca');
    const s = sesionOk();
    await A.svc.publicarSesionEnDispositivo(q.uid, s);
    // antes de revocar la gafa sí puede crear el resultado de su sesión
    const idOk = s.sessionId;
    await setDoc(doc(q.db, 'sesiones', idOk), gemsResultado(q.uid, idOk, s.patientId));
    await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
    const s2 = (await aDb.doc(`dispositivos/${q.uid}/sesion_activa/current`).get()).data();
    await A.svc.revocarDispositivo(q.uid);
    await assertDenegado(getDoc(doc(q.db, 'dispositivos', q.uid, 'sesion_activa', 'current')), 'revocada no lee sesión');
    await assertDenegado(setDoc(doc(q.db, 'sesiones', s2.sessionId), gemsResultado(q.uid, s2.sessionId, s2.patientId)), 'revocada no crea resultados');
    await assertDenegado(getDoc(doc(q.db, 'sesiones', idOk)), 'revocada no lee sus resultados');
    await assertDenegado(updateDoc(doc(q.db, 'dispositivos', q.uid, 'sesion_activa', 'current'), { status: 'completed' }), 'revocada no cierra sesión');
    // la gafa sí puede leer su propio dispositivo (para saber que fue revocada)
    assert.equal((await getDoc(doc(q.db, 'dispositivos', q.uid))).data().estado, 'revocado');
    // publicar sobre revocada: cliente
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk()), 'dispositivo_no_vinculado');
    // y reglas (escritura cruda del propietario)
    await assertDenegado(setDoc(doc(A.db, 'dispositivos', q.uid, 'sesion_activa', 'current'), { ...sesionOk(), status: 'pending', publicadaEn: serverTimestamp(), venceEn: Timestamp.fromMillis(Date.now() + 3600_000) }), 'reglas: propietario no publica en revocada');
    // terminal: no se puede volver a vincular ni reactivar
    await assertDenegado(updateDoc(doc(A.db, 'dispositivos', q.uid), { estado: 'vinculado' }), 'revocado es terminal');
    await assertDenegado(updateDoc(doc(q.db, 'dispositivos', q.uid), { codigoActual: codigoAleatorio() }), 'la gafa revocada no rota código');
    await assertDenegado(deleteDoc(doc(q.db, 'dispositivos', q.uid)), 'la gafa revocada no se borra');
  });

  // ------------------------------------------------------------------ venceEn
  it('venceEn: aceptado si válido; rechazado en el pasado o > 24 h (reglas) y por el cliente', { skip: SKIP_3B2 }, async () => {
    const q = await questVinculada(A, 'TTL');
    const ref = (c) => doc(c.db, 'dispositivos', q.uid, 'sesion_activa', 'current');
    const base = () => ({ ...sesionOk(), status: 'pending', publicadaEn: serverTimestamp() });
    await setDoc(ref(A), { ...base(), venceEn: Timestamp.fromMillis(Date.now() + 23 * 3600_000) });
    await A.svc.limpiarSesion(q.uid);
    await assertDenegado(setDoc(ref(A), { ...base(), venceEn: Timestamp.fromMillis(Date.now() + 25 * 3600_000) }), '25 h');
    await assertDenegado(setDoc(ref(A), { ...base(), venceEn: Timestamp.fromMillis(Date.now() - 1000) }), 'pasado');
    await assertDenegado(setDoc(ref(A), { ...base(), venceEn: serverTimestamp() }), 'venceEn == request.time no es > request.time');
    await assertDenegado(setDoc(ref(A), { ...base(), venceEn: Date.now() + 3600_000 }), 'número en lugar de timestamp');
    await assertDenegado(setDoc(ref(A), { ...base(), publicadaEn: Timestamp.fromMillis(Date.now() - 5000), venceEn: Timestamp.fromMillis(Date.now() + 3600_000) }), 'publicadaEn debe ser request.time');
    // cliente
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk(), { ttlMs: 25 * 3600_000 }), 'sesion_invalida');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk(), { ttlMs: -1 }), 'sesion_invalida');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk(), { ttlMs: 0 }), 'sesion_invalida');
    const ok = await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk(), { ttlMs: 2 * 3600_000 });
    assert.ok(ok.venceEn > Date.now() + 3600_000);
    assert.equal((await aDb.doc(`dispositivos/${q.uid}/sesion_activa/current`).get()).exists, true);
  });

  it('publicar: datos personales y campos fuera de contrato rechazados (lista blanca)', async () => {
    const q = await questVinculada(A, 'Lista blanca');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ patientName: 'PACIENTE-SINTETICO-1' })), 'sesion_invalida');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ patientAlias: 'PACIENTE-SINTETICO-1' })), 'sesion_invalida');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ patientId: 'a b' })), 'sesion_invalida');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ gameId: 'otro' })), 'sesion_invalida');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ duration: 0 })), 'sesion_invalida');
    await assertCodigo(A.svc.publicarSesionEnDispositivo(q.uid, sesionOk({ duration: 1.5 })), 'sesion_invalida');
    assert.equal((await aDb.doc(`dispositivos/${q.uid}/sesion_activa/current`).get()).exists, false);
    // reglas: clave extra con escritura cruda
    await assertDenegado(setDoc(doc(A.db, 'dispositivos', q.uid, 'sesion_activa', 'current'), { ...sesionOk(), patientName: 'X', status: 'pending', publicadaEn: serverTimestamp(), venceEn: Timestamp.fromMillis(Date.now() + 3600_000) }));
  });

  it('renombrar: alias inválido (cliente y reglas) y no se puede alterar otra clave', async () => {
    const q = await questVinculada(A, 'Ren');
    await assertCodigo(A.svc.renombrarDispositivo(q.uid, ''), 'alias_invalido');
    await assertCodigo(A.svc.renombrarDispositivo(q.uid, 'a<b'), 'alias_invalido');
    await assertDenegado(updateDoc(doc(A.db, 'dispositivos', q.uid), { alias: 'a<b' }));
    await assertDenegado(updateDoc(doc(A.db, 'dispositivos', q.uid), { alias: 'ok', updatedAt: serverTimestamp() }), 'updatedAt no permitido por las reglas');
    await assertDenegado(updateDoc(doc(A.db, 'dispositivos', q.uid), { ownerUid: 'pr5c-fisio-b' }));
    await A.svc.renombrarDispositivo(q.uid, 'Ñandú_1.2-b');
  });

  // ------------------------------------------------------------------ aislamiento de paciente
  it('un patientId solo es escribible como resultado por la gafa vinculada con sesión activa de ese paciente', { skip: SKIP_3B2 }, async () => {
    const qa = await questVinculada(A, 'P1');
    const qb = await questVinculada(B, 'P2');
    const sa = sesionOk({ patientId: 'pac-opaco-1', patientAlias: 'P-001' });
    const sb = sesionOk({ patientId: 'pac-opaco-2', patientAlias: 'P-002' });
    await A.svc.publicarSesionEnDispositivo(qa.uid, sa);
    await B.svc.publicarSesionEnDispositivo(qb.uid, sb);
    // Quest A con el paciente de la sesión de B / con un sessionId ajeno: denegado
    await assertDenegado(setDoc(doc(qa.db, 'sesiones', sa.sessionId), gemsResultado(qa.uid, sa.sessionId, 'pac-opaco-2')), 'paciente ajeno');
    await assertDenegado(setDoc(doc(qa.db, 'sesiones', sb.sessionId), gemsResultado(qa.uid, sb.sessionId, 'pac-opaco-2')), 'sesión ajena');
    await assertDenegado(setDoc(doc(qb.db, 'sesiones', sa.sessionId), gemsResultado(qb.uid, sa.sessionId, 'pac-opaco-1')), 'Quest B no escribe la sesión de A');
    // Quest sin sesión activa
    const qc = await questVinculada(A, 'Sin sesion');
    await assertDenegado(setDoc(doc(qc.db, 'sesiones', 'sinsesion1'), gemsResultado(qc.uid, 'sinsesion1', 'pac-opaco-1')), 'sin sesión activa');
    // Positivo: la correcta
    await setDoc(doc(qa.db, 'sesiones', sa.sessionId), gemsResultado(qa.uid, sa.sessionId, 'pac-opaco-1'));
    // la gafa no puede leer pacientes ni resultados de otra gafa
    await assertDenegado(getDoc(doc(qa.db, 'pacientes', 'pac-opaco-1')));
    await assertDenegado(getDoc(doc(qb.db, 'sesiones', sa.sessionId)), 'Quest B no lee el resultado de A');
    await assertDenegado(getDocs(collection(qa.db, 'sesiones')), 'list sesiones');
  });

  // ------------------------------------------------------------------ rutas
  it('solo se escriben las rutas esperadas (comparación de documentos antes/después)', { skip: SKIP_3B2 }, async () => {
    const q = await crearQuest();
    const t0 = await rutas();
    await A.svc.confirmarVinculo(q.codigo, 'Rutas');
    assert.deepEqual(await rutas(), t0);
    await A.svc.renombrarDispositivo(q.uid, 'Rutas 2');
    assert.deepEqual(await rutas(), t0);
    await A.svc.publicarSesionEnDispositivo(q.uid, sesionOk());
    assert.deepEqual(await rutas(), [...t0, `dispositivos/${q.uid}/sesion_activa/current`].sort());
    assert.equal((await aDb.doc('sesion_activa/current').get()).exists, false, 'la sesión global de la raíz no se toca');
    await A.svc.limpiarSesion(q.uid);
    assert.deepEqual(await rutas(), t0);
    await A.svc.revocarDispositivo(q.uid);
    assert.deepEqual(await rutas(), t0, 'revocar no borra nada');
  });

  // ------------------------------------------------------------------ alias de paciente (puro)
  it('alias de paciente: unicidad, estabilidad y no reutilización', () => {
    const { siguienteAliasPaciente: sig, formatearAliasPaciente: fmt, numeroDeAliasPaciente: num } = D;
    assert.deepEqual(sig([]), { alias: 'P-001', numero: 1 });
    assert.deepEqual(sig(['P-001']), { alias: 'P-002', numero: 2 });
    // huecos: nunca rellena, siempre max+1
    assert.equal(sig(['P-001', 'P-005']).alias, 'P-006');
    // no reutilización tras borrar el más alto: la marca de agua lo impide
    assert.equal(sig(['P-001', 'P-002'], 3).alias, 'P-004');
    // estabilidad: mismo input, mismo output; orden irrelevante
    assert.deepEqual(sig(['P-003', 'P-001']), sig(['P-001', 'P-003']));
    // ignora basura (nombres, ids de Firestore, otros formatos)
    assert.equal(sig(['Juan Pérez', 'abc123', 'P-1', 'p-004', 'P-002']).alias, 'P-003');
    // unicidad en una secuencia de 1200 emisiones con marca de agua
    const vistos = new Set(); let marca = 0; let existentes = [];
    for (let i = 0; i < 1200; i++) {
      const { alias, numero } = sig(existentes, marca);
      assert.ok(!vistos.has(alias), `repetido ${alias}`);
      vistos.add(alias); marca = numero; existentes = i % 7 === 0 ? [] : [...existentes, alias]; // borrados simulados
      assert.match(alias, /^P-\d{3,6}$/);
    }
    assert.equal(fmt(1000), 'P-1000');
    assert.equal(num('P-042'), 42);
    assert.equal(num('PACIENTE-SINTETICO-1'), null);
    assert.throws(() => fmt(0), RangeError);
  });
});
