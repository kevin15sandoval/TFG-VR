// PR5c-3a - app/patientIdentity.ts contra Auth Emulator + Firestore Emulator con firestore.rules.next (NO desplegadas).
// SDK web REAL (runTransaction), identidades REALES del emulador (email verificado por Admin SDK; Quest = anónimo real).
// Solo proyecto demo-tfg-vr y datos SINTÉTICOS. Se ejecuta con `pnpm test:emulator`.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, runTransaction, writeBatch, serverTimestamp, Timestamp,
  disableNetwork, enableNetwork, deleteDoc, setDoc,
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

const I = await import(pathToFileURL(join(root, 'app', 'patientIdentity.ts')).href);
const D = await import(pathToFileURL(join(root, 'app', 'devices.ts')).href);

const apps = [];
let adminApp, aAuth, aDb, n = 0;

function cliente() {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `ident-${n++}`);
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
  return c;
}
const codigoAleatorio = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

// Opciones rápidas para pruebas (sin esperas largas entre reintentos).
const asegurar = (c, pacienteId, extra = {}) => I.asegurarIdentidadPaciente({ db: c.db, pacienteId, esperaBaseMs: 5, ...extra });

const paciente = (i) => ({
  name: `PACIENTE-SINTETICO-${i}`, initials: `PS`, age: 60, affectedSide: 'Derecho', lastSession: '', progress: 0,
  diagnosis: 'Dato sintético', sessions: 0, status: 'activo', colorIdx: 1, notes: '', createdAt: AdminTs.now(),
});
const sembrarPacientes = async (ids) => { for (const id of ids) await aDb.doc(`pacientes/${id}`).set(paciente(id)); };
const verPaciente = async (id) => (await aDb.doc(`pacientes/${id}`).get()).data();
const verContador = async () => { const s = await aDb.doc('config/aliasPacientes').get(); return s.exists ? s.data() : null; };
async function limpiarDatos() {
  for (const col of ['pacientes', 'config', 'sesiones']) {
    for (const d of await aDb.collection(col).listDocuments()) await d.delete();
  }
}
const esperarMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** Invariantes globales tras cualquier escenario: alias únicos, consecutivos 1..N y contador == N. */
async function comprobarInvariantes(esperadoN) {
  const snap = await aDb.collection('pacientes').get();
  const conId = snap.docs.map((d) => d.data()).filter((d) => d.pid);
  const nums = conId.map((d) => d.aliasNum).sort((a, b) => a - b);
  assert.deepEqual(nums, Array.from({ length: conId.length }, (_, i) => i + 1), 'aliasNum únicos y consecutivos desde 1');
  assert.equal(new Set(conId.map((d) => d.alias)).size, conId.length, 'alias únicos');
  assert.equal(new Set(conId.map((d) => d.pid)).size, conId.length, 'pid únicos');
  for (const d of conId) assert.equal(d.alias, I.aliasDeNumero(d.aliasNum));
  const c = await verContador();
  assert.equal(c?.ultimo ?? 0, conId.length, 'el contador coincide con los pacientes con identidad (sin huecos ni adelantado)');
  if (esperadoN !== undefined) assert.equal(conId.length, esperadoN);
}

describe('PR5c-3a identidad de paciente contra rules.next', () => {
  let FA, FB, FC, FD, SINROL, NOVERIF, ADMIN;
  before(async () => {
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
    await fetch(`http://${FS}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
    adminApp = adminInit({ projectId: PROJECT_ID }, 'ident-admin');
    aAuth = adminAuth(adminApp);
    aDb = adminFirestore(adminApp);
    const us = [
      ['id-fisio-a', 'ia@example.test', true, 'fisioterapeuta'], ['id-fisio-b', 'ib@example.test', true, 'fisioterapeuta'],
      ['id-fisio-c', 'ic@example.test', true, 'fisioterapeuta'], ['id-fisio-d', 'id@example.test', true, 'fisioterapeuta'],
      ['id-sinrol', 'isinrol@example.test', true, null], ['id-noverif', 'inoverif@example.test', false, 'fisioterapeuta'],
      ['id-admin', 'iadmin@example.test', true, 'admin'],
    ];
    for (const [uid, email, emailVerified, rol] of us) {
      await aAuth.createUser({ uid, email, password: PASSWORD, emailVerified });
      if (rol) await aDb.doc(`usuarios/${uid}`).set({ rol });
    }
    FA = await entrar('ia@example.test'); FB = await entrar('ib@example.test');
    FC = await entrar('ic@example.test'); FD = await entrar('id@example.test');
    SINROL = await entrar('isinrol@example.test'); NOVERIF = await entrar('inoverif@example.test');
    ADMIN = await entrar('iadmin@example.test');
  });
  after(async () => {
    for (const a of apps) { try { await deleteApp(a); } catch { /* ya cerrada */ } }
    try { await adminDelete(adminApp); } catch { /* ya cerrada */ }
  });
  beforeEach(limpiarDatos);

  // ------------------------------------------------------------------ camino feliz
  it('asigna alias P-001 + pid al primer paciente y P-002 al segundo; idempotente al repetir', async () => {
    await sembrarPacientes(['p1', 'p2']);
    const r1 = await asegurar(FA, 'p1');
    assert.equal(r1.alias, 'P-001'); assert.equal(r1.aliasNum, 1); assert.equal(r1.nueva, true);
    assert.match(r1.pid, /^[A-Za-z0-9_-]{22}$/);
    const antes = await verContador();
    const r1b = await asegurar(FB, 'p1'); // otro fisio, mismo paciente: ya tiene identidad
    assert.deepEqual({ ...r1b, nueva: true }, r1);
    assert.equal(r1b.nueva, false);
    const despues = await verContador();
    assert.equal(despues.actualizadoEn.toMillis(), antes.actualizadoEn.toMillis(), 'idempotente: no escribe el contador');
    const r2 = await asegurar(FA, 'p2');
    assert.equal(r2.alias, 'P-002');
    assert.notEqual(r2.pid, r1.pid);
    await comprobarInvariantes(2);
    const doc1 = await verPaciente('p1');
    assert.equal(doc1.pid, r1.pid);
    assert.equal(doc1.name, 'PACIENTE-SINTETICO-p1', 'no se tocan otros campos');
    assert.notEqual(doc1.pid, 'p1'); assert.ok(!doc1.pid.includes('p1'), 'pid sin relación con el id');
  });
  it('un admin también asigna', async () => {
    await sembrarPacientes(['p1']);
    assert.equal((await asegurar(ADMIN, 'p1')).alias, 'P-001');
  });
  it('pid inyectado (RNG de prueba) se respeta; uno inválido se rechaza ANTES de escribir', async () => {
    await sembrarPacientes(['p1', 'p2']);
    const pid = I.generarPid(() => Uint8Array.from({ length: 16 }, (_, i) => i));
    const r = await asegurar(FA, 'p1', { generarPid: () => pid });
    assert.equal(r.pid, pid);
    await assert.rejects(asegurar(FA, 'p2', { generarPid: () => 'corto' }), (e) => e.codigo === 'pid_invalido');
    await comprobarInvariantes(1);
  });
  it('paciente inexistente / id inválido: error tipado y nada escrito', async () => {
    await assert.rejects(asegurar(FA, 'no-existe'), (e) => e.codigo === 'paciente_inexistente');
    await assert.rejects(asegurar(FA, 'a/b'), (e) => e.codigo === 'paciente_inexistente');
    await assert.rejects(asegurar(FA, ''), (e) => e.codigo === 'paciente_inexistente');
    assert.equal(await verContador(), null);
  });
  it('paciente LEGADO con alias de texto libre: se sustituye por P-NNN; identidad a medias: error y sin escritura', async () => {
    await aDb.doc('pacientes/leg').set({ ...paciente('leg'), alias: 'Paciente 1' });
    const r = await asegurar(FA, 'leg');
    assert.equal(r.alias, 'P-001');
    await aDb.doc('pacientes/medias').set({ ...paciente('medias'), pid: 'a'.repeat(22) });
    await assert.rejects(asegurar(FA, 'medias'), (e) => e.codigo === 'identidad_inconsistente');
    assert.equal((await verContador()).ultimo, 1);
  });

  // ------------------------------------------------------------------ concurrencia (revisiones obligatorias)
  it('DOS fisioterapeutas a la vez, pacientes distintos: alias consecutivos únicos (20 rondas)', async () => {
    let reintentosTotales = 0;
    for (let ronda = 0; ronda < 20; ronda++) {
      await limpiarDatos();
      await sembrarPacientes(['x', 'y']);
      let llamadas = 0;
      const contar = (db, fn, opt) => runTransaction(db, (tx) => { llamadas++; return fn(tx); }, opt);
      const [a, b] = await Promise.all([
        asegurar(FA, 'x', { ejecutarTransaccion: contar }), asegurar(FB, 'y', { ejecutarTransaccion: contar }),
      ]);
      assert.deepEqual([a.aliasNum, b.aliasNum].sort(), [1, 2]);
      assert.notEqual(a.pid, b.pid);
      assert.equal((await verPaciente('x')).alias, a.alias);
      assert.equal((await verPaciente('y')).alias, b.alias);
      await comprobarInvariantes(2);
      reintentosTotales += llamadas - 2;
    }
    console.log(`    [info] reintentos internos del SDK en 20 rondas de 2 fisios: ${reintentosTotales}`);
  });
  it('DOS PESTAÑAS (dos clientes del mismo usuario) sobre el MISMO paciente: un solo alias/pid, contador +1 (20 rondas)', async () => {
    const T2 = await entrar('ia@example.test');
    for (let ronda = 0; ronda < 20; ronda++) {
      await limpiarDatos();
      await sembrarPacientes(['z']);
      const [a, b] = await Promise.all([asegurar(FA, 'z'), asegurar(T2, 'z')]);
      assert.equal(a.alias, 'P-001'); assert.equal(a.pid, b.pid); assert.equal(a.alias, b.alias);
      assert.equal([a, b].filter((r) => r.nueva).length, 1, 'solo una pestaña escribe');
      assert.equal((await verContador()).ultimo, 1);
      await comprobarInvariantes(1);
    }
  });
  it('N=10 pacientes distintos en paralelo desde 4 clientes: alias 1..10 sin duplicados ni huecos', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `n${i}`);
    await sembrarPacientes(ids);
    const clientes = [FA, FB, FC, FD];
    const res = await Promise.all(ids.map((id, i) => asegurar(clientes[i % 4], id)));
    assert.deepEqual(res.map((r) => r.aliasNum).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(new Set(res.map((r) => r.pid)).size, 10);
    await comprobarInvariantes(10);
  });
  it('N=10 en paralelo sobre el MISMO paciente desde 4 clientes: una sola identidad', async () => {
    await sembrarPacientes(['mismo']);
    const clientes = [FA, FB, FC, FD];
    const res = await Promise.all(Array.from({ length: 10 }, (_, i) => asegurar(clientes[i % 4], 'mismo')));
    assert.equal(new Set(res.map((r) => r.pid)).size, 1);
    assert.equal(new Set(res.map((r) => r.alias)).size, 1);
    assert.equal(res.filter((r) => r.nueva).length, 1);
    await comprobarInvariantes(1);
  });
  it('mezcla: 6 pacientes, 12 llamadas (cada paciente dos veces, de clientes distintos)', async () => {
    const ids = Array.from({ length: 6 }, (_, i) => `m${i}`);
    await sembrarPacientes(ids);
    const cs = [FA, FB, FC, FD];
    const res = await Promise.all([...ids, ...ids].map((id, i) => asegurar(cs[i % 4], id)));
    const porId = new Map();
    ids.forEach((id, i) => { assert.equal(res[i].pid, res[i + 6].pid, id); porId.set(id, res[i].aliasNum); });
    assert.deepEqual([...porId.values()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
    await comprobarInvariantes(6);
  });

  // ------------------------------------------------------------------ red y atomicidad
  it('fallo de red REAL (Firestore apuntando a un puerto sin servicio): error tipado "red", nada escrito; luego se asigna una sola vez', async () => {
    await sembrarPacientes(['r1']);
    // Auth real (puerto correcto) pero Firestore en un puerto cerrado: las llamadas de la transacción no llegan.
    // (disableNetwork NO sirve: runTransaction usa RPC unarias y lo ignora; ver informe.)
    const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `ident-caida-${n++}`);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
    await signInWithEmailAndPassword(auth, 'ia@example.test', PASSWORD);
    const db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 1);
    await assert.rejects(I.asegurarIdentidadPaciente({ db, pacienteId: 'r1', esperaBaseMs: 5, tiempoMaxMs: 4000 }),
      (e) => e instanceof I.ErrorIdentidad && e.codigo === 'red', 'sin red -> red');
    assert.equal(await verContador(), null);
    assert.equal((await verPaciente('r1')).pid, undefined);
    const r = await asegurar(FA, 'r1'); // la red "vuelve" (cliente sano)
    assert.equal(r.alias, 'P-001');
    await comprobarInvariantes(1);
  });
  it('commit exitoso pero respuesta perdida (fallo inyectado tras escribir): el reintento NO duplica', async () => {
    await sembrarPacientes(['r2', 'r3']);
    const perderRespuesta = async (db, fn, opt) => { await runTransaction(db, fn, opt); const e = new Error('respuesta perdida'); e.code = 'unavailable'; throw e; };
    await assert.rejects(asegurar(FA, 'r2', { ejecutarTransaccion: perderRespuesta }), (e) => e.codigo === 'red');
    const existente = await verPaciente('r2');
    assert.equal(existente.alias, 'P-001');
    const r = await asegurar(FA, 'r2'); // reintento del usuario
    assert.equal(r.pid, existente.pid); assert.equal(r.nueva, false);
    assert.equal((await verContador()).ultimo, 1, 'el contador no avanzó dos veces');
    await asegurar(FB, 'r3');
    await comprobarInvariantes(2);
  });
  // ------------------------------------------------------------------ resultado desconocido (timeout)
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  it('timeout: ErrorIdentidad("red") con resultadoDesconocido=true; otros errores lo llevan a false', async () => {
    await sembrarPacientes(['u0']);
    const colgada = () => new Promise(() => {});
    await assert.rejects(asegurar(FA, 'u0', { ejecutarTransaccion: colgada, tiempoMaxMs: 100 }),
      (e) => e instanceof I.ErrorIdentidad && e.codigo === 'red' && e.resultadoDesconocido === true);
    await assert.rejects(asegurar(SINROL, 'u0'), (e) => e.codigo === 'permiso_denegado' && e.resultadoDesconocido === false);
    await assert.rejects(asegurar(FA, 'nope'), (e) => e.codigo === 'paciente_inexistente' && e.resultadoDesconocido === false);
    assert.equal(await verContador(), null);
  });
  it('CONFIRMACIÓN TARDÍA tras el timeout + reintento inmediato: una identidad, contador +1, el reintento no abre transacción', async () => {
    await sembrarPacientes(['u1']);
    // la transacción real se confirma YA, pero su resolución llega después del tope (el llamante ve timeout)
    const tardia = async (db, fn, opt) => { const r = await runTransaction(db, fn, opt); await dormir(500); return r; };
    await assert.rejects(asegurar(FA, 'u1', { ejecutarTransaccion: tardia, tiempoMaxMs: 150 }),
      (e) => e.codigo === 'red' && e.resultadoDesconocido === true);
    let abiertas = 0;
    const cuenta = (db, fn, opt) => { abiertas++; return runTransaction(db, fn, opt); };
    const r = await asegurar(FA, 'u1', { ejecutarTransaccion: cuenta }); // reintento del llamante
    assert.equal(abiertas, 0, 'la lectura previa evita la transacción');
    assert.equal(r.nueva, false); assert.equal(r.alias, 'P-001');
    assert.equal(r.pid, (await verPaciente('u1')).pid);
    await comprobarInvariantes(1);
  });
  it('CARRERA: el reintento ocurre ANTES de que se confirme la primera transacción: una sola identidad, contador +1', async () => {
    for (let ronda = 0; ronda < 5; ronda++) {
      await limpiarDatos();
      await sembrarPacientes(['u2']);
      // la primera transacción arranca con retraso (se confirmará después del timeout y del reintento)
      const lenta = async (db, fn, opt) => { await dormir(400); return runTransaction(db, fn, opt); };
      const primera = asegurar(FA, 'u2', { ejecutarTransaccion: lenta, tiempoMaxMs: 100 });
      await assert.rejects(primera, (e) => e.codigo === 'red' && e.resultadoDesconocido === true);
      const r = await asegurar(FA, 'u2'); // el reintento se adelanta y asigna
      assert.equal(r.alias, 'P-001');
      await dormir(700); // deja que la primera se confirme (leerá la identidad ya escrita y no escribirá)
      const final = await verPaciente('u2');
      assert.equal(final.pid, r.pid);
      assert.equal((await verContador()).ultimo, 1);
      await comprobarInvariantes(1);
    }
  });
  it('lectura previa: con identidad existente NO se abre transacción ni se escribe; sin ella sí', async () => {
    await sembrarPacientes(['u3', 'u4']);
    const a = await asegurar(FA, 'u3');
    const antes = await verContador();
    const prohibida = () => { throw new Error('no debe abrirse transacción'); };
    const b = await asegurar(FB, 'u3', { ejecutarTransaccion: prohibida });
    assert.deepEqual([b.pid, b.alias, b.nueva], [a.pid, a.alias, false]);
    assert.equal((await verContador()).actualizadoEn.toMillis(), antes.actualizadoEn.toMillis());
    let abiertas = 0;
    await asegurar(FA, 'u4', { ejecutarTransaccion: (db, fn, opt) => { abiertas++; return runTransaction(db, fn, opt); } });
    assert.ok(abiertas >= 1);
  });
  it('lectura previa que falla por red o se cuelga: se propaga SIN abrir transacción ni escribir', async () => {
    await sembrarPacientes(['u5']);
    const prohibida = () => { throw new Error('no debe abrirse transacción'); };
    const sinRed = async () => { const e = new Error('sin red'); e.code = 'unavailable'; throw e; };
    await assert.rejects(asegurar(FA, 'u5', { leerPaciente: sinRed, ejecutarTransaccion: prohibida }),
      (e) => e.codigo === 'red' && e.resultadoDesconocido === false);
    await assert.rejects(asegurar(FA, 'u5', { leerPaciente: () => new Promise(() => {}), tiempoLecturaMs: 100, ejecutarTransaccion: prohibida }),
      (e) => e.codigo === 'red' && e.resultadoDesconocido === false);
    assert.equal(await verContador(), null);
    assert.equal((await verPaciente('u5')).pid, undefined);
  });
  it('fallo ANTES del commit (inyectado): ni contador adelantado ni paciente a medias', async () => {
    await sembrarPacientes(['r4']);
    const falla = async () => { const e = new Error('sin red'); e.code = 'unavailable'; throw e; };
    await assert.rejects(asegurar(FA, 'r4', { ejecutarTransaccion: falla }), (e) => e.codigo === 'red');
    assert.equal(await verContador(), null);
    assert.equal((await verPaciente('r4')).pid, undefined);
    await comprobarInvariantes(0);
  });
  it('atomicidad en el servidor: si la escritura del paciente es inválida, el contador tampoco avanza', async () => {
    await sembrarPacientes(['a1']);
    const db = FA.db;
    await assert.rejects(runTransaction(db, async (tx) => {
      await tx.get(doc(db, 'pacientes/a1'));
      tx.set(doc(db, 'config/aliasPacientes'), { ultimo: 1, ultimoPacienteId: 'a1', actualizadoEn: serverTimestamp() });
      tx.update(doc(db, 'pacientes/a1'), { alias: 'P-001', aliasNum: 1, pid: 'invalido', updatedAt: serverTimestamp() });
    }), (e) => e.code === 'permission-denied');
    assert.equal(await verContador(), null);
    assert.equal((await verPaciente('a1')).alias, undefined);
  });
  it('el servidor impide saltarse el módulo: contador +2, retroceso y pacientes ajenos con el SDK web real', async () => {
    await sembrarPacientes(['b1', 'b2', 'b3']);
    await asegurar(FA, 'b1'); // contador = 1
    const db = FB.db;
    const intento = (id, num, ctr) => runTransaction(db, async (tx) => {
      await tx.get(doc(db, `pacientes/${id}`));
      tx.set(doc(db, 'config/aliasPacientes'), { ultimo: ctr, ultimoPacienteId: id, actualizadoEn: serverTimestamp() });
      tx.update(doc(db, `pacientes/${id}`), { alias: num === 0 ? 'P-000' : I.aliasDeNumero(num), aliasNum: num, pid: I.generarPid(), updatedAt: serverTimestamp() });
    });
    for (const [id, num, ctr] of [['b2', 3, 3], ['b2', 1, 1], ['b2', 2, 3], ['b2', 3, 2], ['b2', 0, 0]]) {
      await assert.rejects(intento(id, num, ctr), (e) => e.code === 'permission-denied', `${id} ${num} ${ctr}`);
    }
    await intento('b2', 2, 2); // el válido sí pasa
    await comprobarInvariantes(2);
  });

  // ------------------------------------------------------------------ inmutabilidad y reutilización
  it('inmutabilidad con SDK real: pid/alias/aliasNum no se pueden cambiar ni reasignar', async () => {
    await sembrarPacientes(['i1', 'i2']);
    const r = await asegurar(FA, 'i1');
    const { updateDoc } = await import('firebase/firestore');
    for (const cambio of [{ pid: I.generarPid() }, { alias: 'P-009' }, { aliasNum: 9 }, { alias: 'P-009', aliasNum: 9, pid: I.generarPid() }]) {
      await assert.rejects(updateDoc(doc(FB.db, 'pacientes/i1'), cambio), (e) => e.code === 'permission-denied');
    }
    const r2 = await asegurar(FB, 'i1');
    assert.deepEqual([r2.pid, r2.alias, r2.aliasNum], [r.pid, r.alias, r.aliasNum]);
  });
  it('borrar el paciente con el número más alto y recrear (mismo id): no se reutiliza alias ni pid', async () => {
    await sembrarPacientes(['d1', 'd2']);
    const a = await asegurar(FA, 'd1'); const b = await asegurar(FA, 'd2');
    assert.deepEqual([a.alias, b.alias], ['P-001', 'P-002']);
    await deleteDoc(doc(FA.db, 'pacientes/d2'));
    assert.equal((await verContador()).ultimo, 2, 'el contador no baja al borrar');
    await setDoc(doc(FA.db, 'pacientes/d2'), { ...paciente('d2'), createdAt: serverTimestamp() });
    const c = await asegurar(FA, 'd2');
    assert.equal(c.alias, 'P-003'); assert.notEqual(c.pid, b.pid);
    const todos = (await aDb.collection('pacientes').get()).docs.map((d) => d.data().alias);
    assert.ok(!todos.includes('P-002'));
  });

  // ------------------------------------------------------------------ permisos
  it('sin rol, correo sin verificar y Quest anónima: permiso_denegado y NADA escrito', async () => {
    await sembrarPacientes(['s1']);
    const q = cliente();
    await signInAnonymously(q.auth);
    for (const c of [SINROL, NOVERIF, q]) {
      await assert.rejects(asegurar(c, 's1'), (e) => e instanceof I.ErrorIdentidad && e.codigo === 'permiso_denegado');
    }
    assert.equal(await verContador(), null);
    assert.equal((await verPaciente('s1')).pid, undefined);
  });
  it('la Quest no lee el contador ni los pacientes', async () => {
    await sembrarPacientes(['s2']);
    await asegurar(FA, 's2');
    const q = cliente();
    await signInAnonymously(q.auth);
    await assert.rejects(getDoc(doc(q.db, 'config/aliasPacientes')), (e) => e.code === 'permission-denied');
    await assert.rejects(getDoc(doc(q.db, 'pacientes/s2')), (e) => e.code === 'permission-denied');
  });

  // ------------------------------------------------------------------ privacidad extremo a extremo
  it('la sesión que ve la Quest lleva solo pid + alias: ni nombre, ni id de Firestore', async () => {
    const id = 'AbCdEfGhIjKlMnOpQrSt';
    await aDb.doc(`pacientes/${id}`).set({ ...paciente(id), name: 'NOMBRE-SINTETICO-PRIVADO', notes: 'nota-privada' });
    const ident = await asegurar(FA, id);
    const quest = cliente();
    const { user } = await signInAnonymously(quest.auth);
    const codigo = codigoAleatorio();
    const b = writeBatch(quest.db);
    b.set(doc(quest.db, 'dispositivos', user.uid), { estado: 'sin_vincular', codigoActual: codigo, creadoEn: serverTimestamp() });
    b.set(doc(quest.db, 'vinculos', codigo), {
      deviceUid: user.uid, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(),
      expira: Timestamp.fromMillis(Date.now() + 9 * 60_000),
    });
    await b.commit();
    const svc = D.crearServicioDispositivos({ db: FA.db, auth: FA.auth });
    await svc.confirmarVinculo(codigo, 'Quest sintética');
    const paraQuest = I.identificadorParaQuest({ id, name: 'NOMBRE-SINTETICO-PRIVADO', ...ident });
    // El fisio solo entrega a la web lo que sale de identificadorParaQuest: pid + alias (+ configuración)
    const pub = await svc.publicarSesionEnDispositivo(user.uid, {
      ...paraQuest, gameId: 'gems', duration: 300,
      difficulty: 'Fácil', therapySide: 'Derecho', sessionType: 'Rehabilitación',
    });
    // La Quest lee el buzón (puntero) y luego el registro: nada de nombre, notas ni id de Firestore en ninguno
    const buzon = (await getDoc(doc(quest.db, `dispositivos/${user.uid}/sesion_activa/current`))).data();
    const visto = (await getDoc(doc(quest.db, `dispositivos/${user.uid}/sesiones_registro/${pub.sessionId}`))).data();
    assert.equal(buzon.sessionId, pub.sessionId);
    const txt = JSON.stringify([buzon, visto]);
    assert.equal(visto.patientId, ident.pid);
    assert.equal(visto.patientAlias, ident.alias);
    assert.match(visto.patientId, /^[A-Za-z0-9_-]{22}$/);
    assert.notEqual(visto.patientId, id, 'el patientId que ve la Quest no es el id de Firestore');
    for (const prohibido of ['NOMBRE', 'PRIVADO', 'nota-privada', id, 'AbCdEf']) assert.ok(!txt.includes(prohibido), prohibido);
    // y el cliente rechaza el id de Firestore o el nombre como patientId
    for (const malo of [id, 'NOMBRE-SINTETICO-PRIVADO']) {
      await assert.rejects(svc.publicarSesionEnDispositivo(user.uid, { ...paraQuest, patientId: malo, gameId: 'gems', duration: 300, difficulty: 'Fácil', therapySide: 'Derecho', sessionType: 'Rehabilitación' }), (e) => e.codigo === 'sesion_invalida');
    }
  });
});
