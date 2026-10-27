// PR5c-3b-1 - Ciclo de vida persistente de sesión por sessionId, contra firestore.rules.next (NO desplegada).
//   dispositivos/{uid}/sesiones_registro/{sid}  = fuente de verdad del estado (config inmutable + trazas set-once)
//   dispositivos/{uid}/sesion_activa/current    = buzón/puntero {sessionId, publicadaEn, venceEn}
//   sesiones/{sid}                              = resultado clínico (create-only, id == sessionId)
// Solo emulador local (demo-tfg-vr), datos sintéticos. Los tiempos se siembran con offsets relativos al reloj local;
// los márgenes son de minutos, así que la deriva entre el reloj del test y request.time no afecta.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let env;
const ok = assertSucceeds;
const ko = assertFails;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tfg-vr',
    firestore: { rules: readFileSync(join(here, '..', '..', 'firestore.rules.next'), 'utf8'), host, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });

const gafa = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const clin = (uid, { verified = true } = {}) => env.authenticatedContext(uid, { email: `${uid}@example.invalid`, email_verified: verified, firebase: { sign_in_provider: 'password' } }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });
const MIN = 60_000;
const ts = (offsetMs) => Timestamp.fromMillis(Date.now() + offsetMs);

const SA = 'sidAAAAAAAAAAAAAAAAAAA', SB = 'sidBBBBBBBBBBBBBBBBBBB', SC = 'sidCCCCCCCCCCCCCCCCCCC'; // 22 caracteres
const PID = 'pidxxxxxxxxxxxxxxxxxxx';
const regRef = (db, dev, sid) => doc(db, `dispositivos/${dev}/sesiones_registro/${sid}`);
const curRef = (db, dev) => doc(db, `dispositivos/${dev}/sesion_activa/current`);
const resRef = (db, sid) => doc(db, `sesiones/${sid}`);

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    for (const [u, r] of [['clin-1', 'fisioterapeuta'], ['clin-2', 'fisioterapeuta'], ['admin-1', 'admin']]) await setDoc(doc(db, `usuarios/${u}`), { rol: r });
    await setDoc(doc(db, 'usuarios/clin-nv'), { rol: 'fisioterapeuta' });
    await setDoc(doc(db, 'dispositivos/gafa-1'), { estado: 'vinculado', ownerUid: 'clin-1', codigoActual: 'AAAAAAAA', creadoEn: Timestamp.now() });
    await setDoc(doc(db, 'dispositivos/gafa-2'), { estado: 'vinculado', ownerUid: 'clin-2', codigoActual: 'AAAAAAAA', creadoEn: Timestamp.now() });
    await setDoc(doc(db, 'dispositivos/gafa-rev'), { estado: 'revocado', ownerUid: 'clin-1', codigoActual: 'AAAAAAAA', creadoEn: Timestamp.now() });
  });
});

// registro sembrado (sin reglas) en un estado dado; offsets relativos a ahora
const regDoc = (sid, dev, over = {}) => ({
  sessionId: sid, patientId: PID, patientAlias: 'P-001', gameId: 'gems', duration: 600, difficulty: 'Fácil', therapySide: 'Izquierdo',
  sessionType: 'Rehabilitación', deviceUid: dev, ownerUid: dev === 'gafa-2' ? 'clin-2' : 'clin-1',
  publicadaEn: ts(-5 * MIN), venceEn: ts(15 * MIN), status: 'pending', ...over,
});
const seedReg = (sid, dev, over, apuntar = true) => seed(async (db) => {
  const d = regDoc(sid, dev, over);
  await setDoc(regRef(db, dev, sid), d);
  if (apuntar) await setDoc(curRef(db, dev), { sessionId: sid, publicadaEn: d.publicadaEn, venceEn: d.venceEn });
});
// running iniciado hace `mins` minutos (publicado hace 5+mins; la ventana de inicio ya pudo vencer)
const running = (sid, dev, mins = 3, over = {}) => seedReg(sid, dev, { status: 'running', iniciadaEn: ts(-mins * MIN), publicadaEn: ts(-(mins + 2) * MIN), venceEn: ts((20 - 2 - mins) * MIN), ...over });
const terminal = (sid, dev, status = 'completed', over = {}) => seedReg(sid, dev, { status, iniciadaEn: ts(-20 * MIN), finalizadaEn: ts(-1 * MIN), publicadaEn: ts(-25 * MIN), venceEn: ts(-5 * MIN), ...(status === 'interrupted' ? { motivo: 'abandono' } : {}), ...over });

// publicacion atomica registro + buzon. `prev` = registro anterior a pasar a 'vencida' en el mismo batch.
async function publica(db, dev, sid, { over = {}, curOver = {}, prev, uid = 'clin-1' } = {}) {
  const v = ts(20 * MIN);
  const b = writeBatch(db);
  if (prev) b.update(regRef(db, dev, prev), { status: 'vencida', finalizadaEn: serverTimestamp(), motivo: 'vencida' });
  b.set(regRef(db, dev, sid), { sessionId: sid, patientId: PID, patientAlias: 'P-001', gameId: 'gems', duration: 600, difficulty: 'Fácil', therapySide: 'Izquierdo',
    sessionType: 'Rehabilitación', deviceUid: dev, ownerUid: uid, publicadaEn: serverTimestamp(), venceEn: v, status: 'pending', ...over });
  b.set(curRef(db, dev), { sessionId: sid, publicadaEn: serverTimestamp(), venceEn: v, ...curOver });
  return b.commit();
}

const gems = (sid, over = {}) => ({
  patientId: PID, sessionId: sid, deviceUid: 'gafa-1', gameId: 'gems', duration: 600, score: 10, fromVR: true, notes: '', createdAt: serverTimestamp(),
  status: 'completed', durationUnit: 's', patientAlias: 'P-001',
  accuracy: 90, gemsNormal: 1, gemsGolden: 0, gemsGreen: 0, gemsPurple: 0, gemsRed: 0, gemsRedAvoided: 0, totalGems: 1, avgTimePerGem: 2,
  totalMovements: 5, movementsSummary: [], zonesWorked: { Alto: 1, Medio: 0, Lateral: 0, Bajo: 0 }, ...over,
});
// cierre atomico de la Quest: resultado + registro en un batch
async function cierra(db, dev, sid, { reg = {}, res = {}, sinResultado = false, status = 'completed', tardio = false } = {}) {
  const b = writeBatch(db);
  if (!sinResultado) b.set(resRef(db, sid), gems(sid, { deviceUid: dev, status, ...res }));
  const cambios = { status, finalizadaEn: serverTimestamp(), tardio, ...(sinResultado ? {} : { resultadoEn: serverTimestamp() }), ...reg };
  if (status === 'interrupted') cambios.motivo = reg.motivo ?? 'abandono';
  b.update(regRef(db, dev, sid), cambios);
  return b.commit();
}
// resultado tardio tras cierre forzado: resultado (interrupted) + facet resultadoEn/tardio en el registro
async function tardio(db, dev, sid, { res = {}, reg = {} } = {}) {
  const b = writeBatch(db);
  b.set(resRef(db, sid), gems(sid, { deviceUid: dev, status: 'interrupted', ...res }));
  b.update(regRef(db, dev, sid), { resultadoEn: serverTimestamp(), tardio: true, ...reg });
  return b.commit();
}
const forzado = (extra = {}) => ({ status: 'interrupted', finalizadaEn: serverTimestamp(), motivo: 'sin_respuesta', cierrePor: 'clin-1', forzadoPor: 'clin-1', forzadoEn: serverTimestamp(), forzadoMotivo: 'Sin respuesta de la gafa', ...extra });
const inicia = (db, dev, sid) => updateDoc(regRef(db, dev, sid), { status: 'running', iniciadaEn: serverTimestamp() });
const cancela = (db, dev, sid, uid = 'clin-1') => updateDoc(regRef(db, dev, sid), { status: 'cancelled', finalizadaEn: serverTimestamp(), motivo: 'cancelada_por_web', cierrePor: uid });
const solicita = (db, dev, sid, uid = 'clin-1') => updateDoc(regRef(db, dev, sid), { status: 'cancel_requested', cancelSolicitadaEn: serverTimestamp(), cancelSolicitadaPor: uid });
const leeReg = (dev, sid) => { let r; return seed(async (db) => { r = (await getDoc(regRef(db, dev, sid))).data(); }).then(() => r); };

// ====================================================================================== publicacion
describe('publicacion atomica (registro + buzon en un batch)', () => {
  it('propietario: registro pending + current en el mismo batch', async () => { await ok(publica(clin('clin-1'), 'gafa-1', SA)); });
  it('registro solo (sin current) denegado', async () => { await ko(setDoc(regRef(clin('clin-1'), 'gafa-1', SA), regDoc(SA, 'gafa-1', { publicadaEn: serverTimestamp() }))); });
  it('current solo (sin registro) denegado', async () => { await ko(setDoc(curRef(clin('clin-1'), 'gafa-1'), { sessionId: SA, publicadaEn: serverTimestamp(), venceEn: ts(20 * MIN) })); });
  it('current apuntando a OTRO sessionId que el registro del batch: denegado', async () => {
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { curOver: { sessionId: SB } }));
  });
  it('venceEn del buzon distinto del registro: denegado', async () => { await ko(publica(clin('clin-1'), 'gafa-1', SA, { curOver: { venceEn: ts(5 * MIN) } })); });
  it('otro fisio no publica en gafa ajena', async () => { await ko(publica(clin('clin-2'), 'gafa-1', SA, { uid: 'clin-2' })); });
  it('ownerUid falso en el registro denegado', async () => { await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { ownerUid: 'clin-2' } })); });
  it('Quest, anonimo, sin rol/no verificado y admin (sin rama) no publican', async () => {
    await ko(publica(gafa('gafa-1'), 'gafa-1', SA, { uid: 'gafa-1' }));
    await ko(publica(anon(), 'gafa-1', SA));
    await ko(publica(clin('clin-nv', { verified: false }), 'gafa-1', SA, { uid: 'clin-nv' }));
    await ko(publica(clin('sin-rol'), 'gafa-1', SA, { uid: 'sin-rol' }));
    await ko(publica(clin('admin-1'), 'gafa-1', SA, { uid: 'admin-1' }));
  });
  it('Quest revocada: no se publica', async () => { await ko(publica(clin('clin-1'), 'gafa-rev', SA)); });
  it('venceEn > 1 h, sessionId corto: denegado; 20 min y exactamente <= 1 h: OK', async () => {
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { venceEn: ts(90 * MIN) }, curOver: { venceEn: ts(90 * MIN) } }));
    await ko(publica(clin('clin-1'), 'gafa-1', 'corto'));
    await ok(publica(clin('clin-1'), 'gafa-1', SA, { over: { venceEn: ts(55 * MIN) }, curOver: { venceEn: ts(55 * MIN) } }));
  });
  it('patientId con pid de 22 caracteres y alias P-ddd..dddddd: formas invalidas denegadas', async () => {
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientId: 'corto' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientId: PID + 'x' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientId: 'pid con espacios!!!!!' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientAlias: 'P-01' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientAlias: 'P-1234567' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientAlias: 'Juan Perez' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientAlias: 'p-001' } }));
    await ok(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientAlias: 'P-123456' } }));
  });
  it('status != pending al crear / campos extra / nombre real: denegado', async () => {
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { status: 'running' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { patientName: 'Nombre Real' } }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { iniciadaEn: serverTimestamp() } }));
  });
  it('duration: configurada int 1..7200', async () => {
    for (const d of [0, 7201, 1.5, '600', -1]) await ko(publica(clin('clin-1'), 'gafa-1', SA, { over: { duration: d } }));
    await ok(publica(clin('clin-1'), 'gafa-1', SA, { over: { duration: 7200 } }));
  });
  it('D11: no se pisa una pending viva (ni marcandola vencida antes de tiempo)', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ko(publica(clin('clin-1'), 'gafa-1', SB));
    await ko(publica(clin('clin-1'), 'gafa-1', SB, { prev: SA }));
    assert.equal((await leeReg('gafa-1', SA)).status, 'pending');
  });
  it('D11: no se pisa running ni cancel_requested', async () => {
    await running(SA, 'gafa-1');
    await ko(publica(clin('clin-1'), 'gafa-1', SB));
    await seed((db) => updateDoc(regRef(db, 'gafa-1', SA), { status: 'cancel_requested', cancelSolicitadaEn: ts(-1 * MIN), cancelSolicitadaPor: 'clin-1' }));
    await ko(publica(clin('clin-1'), 'gafa-1', SB));
  });
  for (const st of ['completed', 'cancelled', 'interrupted']) {
    it(`tras ${st}: se puede publicar la siguiente`, async () => {
      await terminal(SA, 'gafa-1', st);
      await ok(publica(clin('clin-1'), 'gafa-1', SB));
      assert.equal((await leeReg('gafa-1', SB)).status, 'pending');
    });
  }
  it('pending vencida: solo con el batch que la pasa a vencida', async () => {
    await seedReg(SA, 'gafa-1', { publicadaEn: ts(-30 * MIN), venceEn: ts(-10 * MIN) });
    await ko(publica(clin('clin-1'), 'gafa-1', SB));
    await ok(publica(clin('clin-1'), 'gafa-1', SB, { prev: SA }));
    const a = await leeReg('gafa-1', SA);
    assert.equal(a.status, 'vencida'); assert.equal(a.motivo, 'vencida');
  });
  it('publicar el mismo sessionId dos veces (registro existente): denegado', async () => {
    await ok(publica(clin('clin-1'), 'gafa-1', SA));
    await seed((db) => updateDoc(regRef(db, 'gafa-1', SA), { status: 'cancelled', finalizadaEn: ts(0), motivo: 'cancelada_por_web', cierrePor: 'clin-1' }));
    await ko(publica(clin('clin-1'), 'gafa-1', SA));
  });
  it('lecturas: tras publicar, Quest y propietario ven el puntero; ajenos no', async () => {
    await ok(publica(clin('clin-1'), 'gafa-1', SA));
    await ok(getDoc(curRef(gafa('gafa-1'), 'gafa-1'))); await ok(getDoc(regRef(gafa('gafa-1'), 'gafa-1', SA)));
    await ko(getDoc(curRef(gafa('gafa-2'), 'gafa-1'))); await ko(getDoc(regRef(clin('clin-2'), 'gafa-1', SA)));
  });
});

// ====================================================================================== inmutabilidad
describe('inmutabilidad del registro', () => {
  const campos = { patientId: 'pidyyyyyyyyyyyyyyyyyyy', patientAlias: 'P-002', gameId: 'vault_escape', duration: 60, difficulty: 'Difícil', therapySide: 'Derecho',
    sessionType: 'x', deviceUid: 'gafa-2', ownerUid: 'clin-2', sessionId: SB };
  for (const [k, v] of Object.entries(campos)) {
    it(`propietario no altera ${k} (ni solo ni junto a una transicion valida)`, async () => {
      await seedReg(SA, 'gafa-1', {});
      await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { [k]: v }));
      await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { status: 'cancelled', finalizadaEn: serverTimestamp(), motivo: 'cancelada_por_web', cierrePor: 'clin-1', [k]: v }));
    });
    it(`Quest no altera ${k} al iniciar ni al cerrar`, async () => {
      await seedReg(SA, 'gafa-1', {});
      await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'running', iniciadaEn: serverTimestamp(), [k]: v }));
      await running(SC, 'gafa-1');
      await ko(cierra(gafa('gafa-1'), 'gafa-1', SC, { reg: { [k]: v } }));
    });
  }
  it('publicadaEn, venceEn y difficulty inmutables (propietario)', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { venceEn: ts(60 * MIN) }));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { publicadaEn: ts(0) }));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { venceEn: ts(60 * MIN), status: 'cancelled', finalizadaEn: serverTimestamp(), motivo: 'cancelada_por_web', cierrePor: 'clin-1' }));
  });
  it('iniciadaEn (set-once): ni reescrita por la Quest ni por el propietario', async () => {
    await running(SA, 'gafa-1');
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { iniciadaEn: serverTimestamp() }));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { iniciadaEn: ts(0) }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { reg: { iniciadaEn: serverTimestamp() } }));
  });
  it('nadie borra registro, buzon ni resultado (propietario, admin, Quest)', async () => {
    await terminal(SA, 'gafa-1', 'completed');
    await seed((db) => setDoc(resRef(db, SA), gems(SA)));
    for (const u of [clin('clin-1'), clin('admin-1'), gafa('gafa-1'), clin('clin-2'), anon()]) {
      await ko(deleteDoc(regRef(u, 'gafa-1', SA)));
      await ko(deleteDoc(curRef(u, 'gafa-1')));
      await ko(deleteDoc(resRef(u, SA)));
    }
  });
  it('el buzon no admite status ni config ni se edita sin publicar un registro nuevo', async () => {
    await terminal(SA, 'gafa-1', 'completed');
    await ko(updateDoc(curRef(clin('clin-1'), 'gafa-1'), { status: 'pending' }));
    await ko(updateDoc(curRef(clin('clin-1'), 'gafa-1'), { venceEn: ts(30 * MIN) }));
    await ko(updateDoc(curRef(gafa('gafa-1'), 'gafa-1'), { venceEn: ts(30 * MIN) }));
    await ko(publica(clin('clin-1'), 'gafa-1', SB, { curOver: { patientId: PID } }));
  });
});

// ====================================================================================== inicio, cancelacion, caducidad
describe('inicio, caducidad y cancelacion', () => {
  it('Quest inicia pending vigente (iniciadaEn = hora del servidor)', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ok(inicia(gafa('gafa-1'), 'gafa-1', SA));
    const r = await leeReg('gafa-1', SA);
    assert.equal(r.status, 'running'); assert.ok(r.iniciadaEn);
  });
  it('segundo inicio denegado (ya running)', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ok(inicia(gafa('gafa-1'), 'gafa-1', SA));
    await ko(inicia(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('now >= venceEn: inicio denegado (pending vencida)', async () => {
    await seedReg(SA, 'gafa-1', { publicadaEn: ts(-30 * MIN), venceEn: ts(-1 * MIN) });
    await ko(inicia(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('iniciadaEn forjada o ausente denegada', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'running', iniciadaEn: ts(60 * MIN) }));
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'running' }));
  });
  it('inicio con puntero de OTRA sesion: denegado (current apunta a B, se intenta iniciar A)', async () => {
    await seedReg(SA, 'gafa-1', {}, false);
    await seed((db) => setDoc(curRef(db, 'gafa-1'), { sessionId: SB, publicadaEn: ts(-1 * MIN), venceEn: ts(19 * MIN) }));
    await ko(inicia(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('inicio sin buzon (current inexistente): denegado', async () => {
    await seedReg(SA, 'gafa-1', {}, false);
    await ko(inicia(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('inicioSessionId: la Quest no puede escribir un sessionId distinto al iniciar', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'running', iniciadaEn: serverTimestamp(), sessionId: SB }));
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'running', iniciadaEn: serverTimestamp(), inicioSessionId: SB }));
  });
  it('Quest ajena / propietario / otro fisio / admin / anonimo no inician', async () => {
    await seedReg(SA, 'gafa-1', {});
    for (const u of [gafa('gafa-2'), clin('clin-1'), clin('clin-2'), clin('admin-1'), anon()]) await ko(inicia(u, 'gafa-1', SA));
  });
  it('Quest revocada no inicia', async () => {
    await seedReg(SA, 'gafa-1', {});
    await seed((db) => updateDoc(doc(db, 'dispositivos/gafa-1'), { estado: 'revocado' }));
    await ko(inicia(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('la Quest no escribe NUNCA vencida (ni sobre una pending caducada)', async () => {
    await seedReg(SA, 'gafa-1', { publicadaEn: ts(-30 * MIN), venceEn: ts(-1 * MIN) });
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'vencida', finalizadaEn: serverTimestamp(), motivo: 'vencida' }));
  });
  it('el propietario marca vencida una pending caducada, no una viva', async () => {
    const v = { status: 'vencida', finalizadaEn: serverTimestamp(), motivo: 'vencida' };
    await seedReg(SA, 'gafa-1', {});
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), v));
    await seedReg(SB, 'gafa-1', { publicadaEn: ts(-30 * MIN), venceEn: ts(-1 * MIN) });
    await ko(updateDoc(regRef(clin('clin-2'), 'gafa-1', SB), v));
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SB), v));
  });
  it('cancelar pending: propietario OK; otro fisio, admin, Quest KO; motivo/cierrePor falsos KO', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ko(cancela(clin('clin-2'), 'gafa-1', SA, 'clin-2'));
    await ko(cancela(clin('admin-1'), 'gafa-1', SA, 'admin-1'));
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'cancelled', finalizadaEn: serverTimestamp(), motivo: 'cancelada_por_web', cierrePor: 'gafa-1' }));
    await ko(cancela(clin('clin-1'), 'gafa-1', SA, 'clin-2'));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { status: 'cancelled', finalizadaEn: serverTimestamp(), motivo: 'abandono', cierrePor: 'clin-1' }));
    await ok(cancela(clin('clin-1'), 'gafa-1', SA));
    const r = await leeReg('gafa-1', SA);
    assert.equal(r.status, 'cancelled'); assert.equal(r.cierrePor, 'clin-1');
  });
  it('cancelada es terminal e inmutable: no se reescribe ni se inicia', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ok(cancela(clin('clin-1'), 'gafa-1', SA));
    await ko(cancela(clin('clin-1'), 'gafa-1', SA));
    await ko(inicia(gafa('gafa-1'), 'gafa-1', SA));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { motivo: 'otro' }));
  });
  it('solicitar cancelacion: solo propietario y solo desde running', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ko(solicita(clin('clin-1'), 'gafa-1', SA)); // pending
    await running(SB, 'gafa-1');
    await ko(solicita(clin('clin-2'), 'gafa-1', SB, 'clin-2'));
    await ko(solicita(clin('admin-1'), 'gafa-1', SB, 'admin-1'));
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SB), { status: 'cancel_requested', cancelSolicitadaEn: serverTimestamp(), cancelSolicitadaPor: 'gafa-1' }));
    await ko(solicita(clin('clin-1'), 'gafa-1', SB, 'clin-2'));
    await ok(solicita(clin('clin-1'), 'gafa-1', SB));
    await ko(solicita(clin('clin-1'), 'gafa-1', SB)); // ya no es running: set-once
  });
  it('(a) cancelacion gana: la Quest ya no puede iniciar', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ok(cancela(clin('clin-1'), 'gafa-1', SA));
    await ko(inicia(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('(a) inicio gana: la cancelacion de pending ya no vale; solo cancel_requested', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ok(inicia(gafa('gafa-1'), 'gafa-1', SA));
    await ko(cancela(clin('clin-1'), 'gafa-1', SA));
    await ok(solicita(clin('clin-1'), 'gafa-1', SA));
  });
});

// ====================================================================================== cierre de la Quest + resultado
describe('cierre de la Quest con resultado atomico', () => {
  it('completed con resultado: OK; el segundo cierre (doble commit) KO', async () => {
    await running(SA, 'gafa-1');
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA));
    const r = await leeReg('gafa-1', SA);
    assert.equal(r.status, 'completed'); assert.equal(r.tardio, false); assert.ok(r.resultadoEn);
  });
  it('completed sin resultado KO; resultado sin cambio de registro KO; registro con resultadoEn sin resultado KO', async () => {
    await running(SA, 'gafa-1');
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: false }));
    await ko(setDoc(resRef(gafa('gafa-1'), SA), gems(SA, { deviceUid: 'gafa-1' })));
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp() }));
  });
  it('interrupted con resultado parcial / sin resultado / motivo invalido', async () => {
    await running(SA, 'gafa-1'); await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { status: 'interrupted', reg: { motivo: 'abandono' } }));
    await running(SB, 'gafa-1'); await ok(cierra(gafa('gafa-1'), 'gafa-1', SB, { status: 'interrupted', sinResultado: true, reg: { motivo: 'reinicio' } }));
    await running(SC, 'gafa-1'); await ko(cierra(gafa('gafa-1'), 'gafa-1', SC, { status: 'interrupted', sinResultado: true, reg: { motivo: 'sin_respuesta' } }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SC, { status: 'interrupted', sinResultado: true, reg: { motivo: 'inventado' } }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SC, { status: 'completed', sinResultado: true }));
    assert.equal((await leeReg('gafa-1', SB)).resultadoEn, undefined);
  });
  it('interrupted SIN resultado deja el registro cerrado y sin documento en sesiones', async () => {
    await running(SA, 'gafa-1');
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { status: 'interrupted', sinResultado: true, reg: { motivo: 'error' } }));
    await seed(async (db) => { assert.equal((await getDoc(resRef(db, SA))).exists(), false); });
  });
  it('estado del resultado debe coincidir con el del registro (completed vs interrupted)', async () => {
    await running(SA, 'gafa-1');
    const d = gafa('gafa-1'); const b = writeBatch(d);
    b.set(resRef(d, SA), gems(SA, { deviceUid: 'gafa-1', status: 'completed' }));
    b.update(regRef(d, 'gafa-1', SA), { status: 'interrupted', motivo: 'abandono', finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp() });
    await ko(b.commit());
  });
  it('cancel_requested -> interrupted/cancelada_por_web con parcial; y tambien completed (la Quest ya habia acabado)', async () => {
    await running(SA, 'gafa-1', 3, { status: 'cancel_requested', cancelSolicitadaEn: ts(-1 * MIN), cancelSolicitadaPor: 'clin-1' });
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { status: 'interrupted', reg: { motivo: 'cancelada_por_web' } }));
    await running(SB, 'gafa-1', 3, { status: 'cancel_requested', cancelSolicitadaEn: ts(-1 * MIN), cancelSolicitadaPor: 'clin-1' });
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SB));
  });
  it('(resultado) otro patientId / otro gameId / otro alias: KO; coherente: OK', async () => {
    await running(SA, 'gafa-1');
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { patientId: 'pidzzzzzzzzzzzzzzzzzzz' } }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { gameId: 'vault_escape' } }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { patientAlias: 'P-002' } }));
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('(resultado) durationUnit debe ser "s"; duracion jugada puede diferir de la configurada', async () => {
    await running(SA, 'gafa-1'); // configurada 600
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { durationUnit: 'min' } }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { durationUnit: 'ms' } }));
    const { durationUnit, ...sinUnidad } = gems(SA);
    const d = gafa('gafa-1'); const b = writeBatch(d);
    b.set(resRef(d, SA), sinUnidad); b.update(regRef(d, 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp() });
    await ko(b.commit());
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { duration: 123 } })); // jugado != configurado
  });
  it('(resultado) Quest ajena no escribe el resultado ni el registro de otra', async () => {
    await running(SA, 'gafa-1');
    await running(SB, 'gafa-2');
    const d1 = gafa('gafa-2'); const b = writeBatch(d1);
    b.set(resRef(d1, SA), gems(SA, { deviceUid: 'gafa-2' }));
    await ko(b.commit());
    const d2 = gafa('gafa-2'); const b2 = writeBatch(d2);
    b2.set(resRef(d2, SA), gems(SA, { deviceUid: 'gafa-2' }));
    b2.update(regRef(d2, 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp() });
    await ko(b2.commit());
  });
  it('(resultado) sessionId inexistente / no asignado: KO', async () => {
    await running(SA, 'gafa-1');
    const d = gafa('gafa-1'); const b = writeBatch(d);
    b.set(resRef(d, SC), gems(SC, { deviceUid: 'gafa-1' }));
    await ko(b.commit());
  });
  it('deviceUid del resultado falso KO', async () => {
    await running(SA, 'gafa-1');
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { deviceUid: 'gafa-2' } }));
  });
  it('registro pending (sin iniciar) o terminal: no admite resultado', async () => {
    await seedReg(SA, 'gafa-1', {});
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA));
    await terminal(SB, 'gafa-1', 'cancelled', { motivo: 'cancelada_por_web', cierrePor: 'clin-1' });
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SB));
  });
  it('(C3) sesion iniciada a los 15 min de la publicacion se cierra DESPUES de venceEn (sin 403 por caducidad)', async () => {
    // publicada hace 40 min (venceEn hace 20 min), iniciada hace 25 min (a los 15 min de publicar), duracion 10 min
    await seedReg(SA, 'gafa-1', { status: 'running', publicadaEn: ts(-40 * MIN), venceEn: ts(-20 * MIN), iniciadaEn: ts(-25 * MIN), duration: 600 });
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { tardio: false }));
  });
  it('(C3 estricto) iniciada hace 8 min con venceEn pasado hace 15: cierra con tardio=false', async () => {
    await seedReg(SA, 'gafa-1', { status: 'running', publicadaEn: ts(-30 * MIN), venceEn: ts(-15 * MIN), iniciadaEn: ts(-8 * MIN), duration: 600 });
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA));
    assert.equal((await leeReg('gafa-1', SA)).tardio, false);
  });
  it('limite duration+30 min: dentro tardio=false OK / tardio=true KO; fuera tardio=true OK / tardio=false KO', async () => {
    await seedReg(SA, 'gafa-1', { status: 'running', iniciadaEn: ts(-39 * MIN), publicadaEn: ts(-45 * MIN), venceEn: ts(-25 * MIN), duration: 600 }); // limite a 40 min
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { tardio: true }));
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { tardio: false }));
    await seedReg(SB, 'gafa-1', { status: 'running', iniciadaEn: ts(-41 * MIN), publicadaEn: ts(-47 * MIN), venceEn: ts(-27 * MIN), duration: 600 });
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SB, { tardio: false }));
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SB, { tardio: true }));
    assert.equal((await leeReg('gafa-1', SB)).tardio, true);
  });
  it('limite 24 h: cierre a las 23 h 50 min OK; pasadas 24 h desde iniciadaEn+duration KO', async () => {
    await seedReg(SA, 'gafa-1', { status: 'running', iniciadaEn: ts(-(24 * 60 + 10 - 5) * MIN), publicadaEn: ts(-1500 * MIN), venceEn: ts(-1400 * MIN), duration: 600 });
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { tardio: true }));
    await seedReg(SB, 'gafa-1', { status: 'running', iniciadaEn: ts(-(24 * 60 + 10 + 5) * MIN), publicadaEn: ts(-1500 * MIN), venceEn: ts(-1400 * MIN), duration: 600 });
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SB, { tardio: true }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SB, { tardio: true, status: 'interrupted', sinResultado: true }));
  });
  it('Quest revocada no cierra ni crea resultado', async () => {
    await running(SA, 'gafa-1');
    await seed((db) => updateDoc(doc(db, 'dispositivos/gafa-1'), { estado: 'revocado' }));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('propietario, otro fisio, admin y anonimo no completan ni crean resultados', async () => {
    await running(SA, 'gafa-1');
    for (const u of [clin('clin-1'), clin('clin-2'), clin('admin-1'), anon()]) {
      await ko(updateDoc(regRef(u, 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp() }));
      await ko(setDoc(resRef(u, SA), gems(SA, { deviceUid: 'gafa-1' })));
    }
  });
  it('resultados: create-only. Un segundo create (mismo id) y updates de contenido, denegados; el fisio solo edita notes', async () => {
    await running(SA, 'gafa-1');
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA));
    await ko(setDoc(resRef(gafa('gafa-1'), SA), gems(SA, { deviceUid: 'gafa-1', score: 99 })));
    await ko(updateDoc(resRef(gafa('gafa-1'), SA), { score: 1 }));
    await ko(updateDoc(resRef(clin('clin-1'), SA), { score: 1 }));
    await ko(updateDoc(resRef(clin('clin-1'), SA), { status: 'interrupted' }));
    await ok(updateDoc(resRef(clin('clin-1'), SA), { notes: 'nota', updatedAt: serverTimestamp() }));
  });
  it('un resultado con id != sessionId o con el id de otra sesion: denegado', async () => {
    await running(SA, 'gafa-1');
    const d = gafa('gafa-1'); const b = writeBatch(d);
    b.set(resRef(d, SB), gems(SA, { deviceUid: 'gafa-1' }));
    b.update(regRef(d, 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp() });
    await ko(b.commit());
  });
});

// ====================================================================================== cierre forzado y resultado tardio
describe('cierre forzado (D10) y resultado tardio', () => {
  const vencida = (sid = SA) => seedReg(sid, 'gafa-1', { status: 'cancel_requested', iniciadaEn: ts(-10 * MIN), cancelSolicitadaEn: ts(-5 * MIN), cancelSolicitadaPor: 'clin-1', publicadaEn: ts(-20 * MIN), venceEn: ts(-1 * MIN) });
  it('running dentro de duration+30 min: forzar KO; pasado: OK', async () => {
    await running(SA, 'gafa-1', 3);
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await seedReg(SB, 'gafa-1', { status: 'running', iniciadaEn: ts(-45 * MIN), publicadaEn: ts(-60 * MIN), venceEn: ts(-40 * MIN) });
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SB), forzado()));
  });
  it('limite exacto de running: 39 min (duration 10 min) KO, 41 min OK', async () => {
    await seedReg(SA, 'gafa-1', { status: 'running', iniciadaEn: ts(-39 * MIN), publicadaEn: ts(-50 * MIN), venceEn: ts(-30 * MIN) });
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await seedReg(SB, 'gafa-1', { status: 'running', iniciadaEn: ts(-41 * MIN), publicadaEn: ts(-50 * MIN), venceEn: ts(-30 * MIN) });
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SB), forzado()));
  });
  it('cancel_requested: 2 min', async () => {
    await running(SA, 'gafa-1', 3, { status: 'cancel_requested', cancelSolicitadaEn: ts(-1 * MIN), cancelSolicitadaPor: 'clin-1' });
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await seed((db) => updateDoc(regRef(db, 'gafa-1', SA), { cancelSolicitadaEn: ts(-3 * MIN) }));
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
  });
  it('no se fuerza una pending ni una ya terminal', async () => {
    await seedReg(SA, 'gafa-1', { publicadaEn: ts(-30 * MIN), venceEn: ts(-10 * MIN) });
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await terminal(SB, 'gafa-1', 'completed');
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SB), forzado()));
  });
  it('motivo ausente / corto (<5) / largo (>200) / no string: KO; 5 y 200 caracteres: OK', async () => {
    await vencida();
    const { forzadoMotivo, ...sinMotivo } = forzado();
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), sinMotivo));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ forzadoMotivo: 'abcd' })));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ forzadoMotivo: 'x'.repeat(201) })));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ forzadoMotivo: 12345 })));
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ forzadoMotivo: 'x'.repeat(200) })));
    await vencida(SB);
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SB), forzado({ forzadoMotivo: 'abcde' })));
  });
  it('autoria falsa (forzadoPor/cierrePor/forzadoEn), motivo != sin_respuesta, otro fisio, Quest, admin, anonimo: KO', async () => {
    await vencida();
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ forzadoPor: 'clin-2' })));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ cierrePor: 'clin-2' })));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ forzadoEn: ts(-60 * MIN) })));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ motivo: 'abandono' })));
    await ko(updateDoc(regRef(clin('clin-2'), 'gafa-1', SA), forzado({ cierrePor: 'clin-2', forzadoPor: 'clin-2' })));
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), forzado()));
    await ko(updateDoc(regRef(clin('admin-1'), 'gafa-1', SA), forzado({ cierrePor: 'admin-1', forzadoPor: 'admin-1' })));
    await ko(updateDoc(regRef(anon(), 'gafa-1', SA), forzado()));
  });
  it('forzado primero: resultado tardio OK como facet; status sigue interrupted/sin_respuesta; traza intacta', async () => {
    await vencida();
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await ok(tardio(gafa('gafa-1'), 'gafa-1', SA));
    const r = await leeReg('gafa-1', SA);
    assert.equal(r.status, 'interrupted'); assert.equal(r.motivo, 'sin_respuesta'); assert.equal(r.forzadoPor, 'clin-1'); assert.equal(r.tardio, true);
    assert.equal(r.forzadoMotivo, 'Sin respuesta de la gafa');
    assert.ok(r.resultadoEn && r.forzadoEn && r.cierrePor);
  });
  it('tardio: segundo resultado KO; sin facet KO; tardio=false KO; status invalido KO; Quest ajena KO', async () => {
    await vencida();
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    const d = gafa('gafa-1');
    await ko(setDoc(resRef(d, SA), gems(SA, { deviceUid: 'gafa-1', status: 'interrupted' })));            // sin tocar el registro
    await ko(tardio(d, 'gafa-1', SA, { reg: { tardio: false } }));
    await ko(tardio(d, 'gafa-1', SA, { res: { status: 'cancelled' } }));                                  // (g) status invalido
    await ko(tardio(d, 'gafa-1', SA, { res: { status: 'running' } }));
    await ko(tardio(gafa('gafa-2'), 'gafa-1', SA, { res: { deviceUid: 'gafa-2' } }));
    await ok(tardio(d, 'gafa-1', SA));
    await ko(tardio(d, 'gafa-1', SA));
  });
  it('tardio: no cambia status ni toca la traza; propietario no puede escribir el facet', async () => {
    await vencida();
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { resultadoEn: serverTimestamp(), tardio: true }));
    await ko(tardio(gafa('gafa-1'), 'gafa-1', SA, { reg: { status: 'completed' } }));
    await ko(tardio(gafa('gafa-1'), 'gafa-1', SA, { reg: { forzadoMotivo: 'otro texto' } }));
    await ko(tardio(gafa('gafa-1'), 'gafa-1', SA, { reg: { motivo: 'abandono' } }));
  });
  it('forzado vs cierre normal: si el resultado llega primero el forzado ya no procede', async () => {
    await vencida();
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { tardio: false, status: 'interrupted', reg: { motivo: 'cancelada_por_web' } }));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
  });
  it('la traza forzada no se reescribe ni se borra despues', async () => {
    await vencida();
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { forzadoMotivo: 'otro texto distinto' }));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado({ forzadoMotivo: 'segundo forzado' })));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), { status: 'completed' }));
    await ko(updateDoc(regRef(gafa('gafa-1'), 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: true, resultadoEn: serverTimestamp() }));
    await ko(deleteDoc(regRef(clin('clin-1'), 'gafa-1', SA)));
  });
  it('pasadas 24 h desde iniciadaEn+duration: resultado tardio KO (sin ampliar permisos)', async () => {
    await seedReg(SA, 'gafa-1', { status: 'interrupted', motivo: 'sin_respuesta', iniciadaEn: ts(-(24 * 60 + 15) * MIN), finalizadaEn: ts(-24 * 60 * MIN), forzadoPor: 'clin-1', forzadoEn: ts(-24 * 60 * MIN), forzadoMotivo: 'abc defg', cierrePor: 'clin-1', publicadaEn: ts(-26 * 60 * MIN), venceEn: ts(-1500 * MIN) });
    await ko(tardio(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('dentro de las 24 h: tardio OK aunque venceEn y la publicacion sean antiguas', async () => {
    await seedReg(SA, 'gafa-1', { status: 'interrupted', motivo: 'sin_respuesta', iniciadaEn: ts(-5 * 60 * MIN), finalizadaEn: ts(-4 * 60 * MIN), forzadoPor: 'clin-1', forzadoEn: ts(-4 * 60 * MIN), forzadoMotivo: 'abc defg', cierrePor: 'clin-1', publicadaEn: ts(-6 * 60 * MIN), venceEn: ts(-340 * MIN) });
    await ok(tardio(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('tardio independiente de current: current ya apunta a B (publicada tras el forzado), el tardio de A no la sobrescribe; B sigue iniciable', async () => {
    await vencida();
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await ok(publica(clin('clin-1'), 'gafa-1', SB));
    await ok(tardio(gafa('gafa-1'), 'gafa-1', SA));
    await seed(async (db) => {
      assert.equal((await getDoc(curRef(db, 'gafa-1'))).data().sessionId, SB);
      assert.equal((await getDoc(regRef(db, 'gafa-1', SB))).data().status, 'pending');
    });
    await ok(inicia(gafa('gafa-1'), 'gafa-1', SB));
  });
  it('tardio de A con B ya RUNNING: no toca B', async () => {
    await vencida();
    await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
    await ok(publica(clin('clin-1'), 'gafa-1', SB));
    await ok(inicia(gafa('gafa-1'), 'gafa-1', SB));
    await ok(tardio(gafa('gafa-1'), 'gafa-1', SA));
    assert.equal((await leeReg('gafa-1', SB)).status, 'running');
    // y el tardio no sirve para colar un resultado de B ni escribir el registro de B
    const d = gafa('gafa-1'); const b = writeBatch(d);
    b.set(resRef(d, SB), gems(SB, { deviceUid: 'gafa-1', status: 'interrupted' }));
    b.update(regRef(d, 'gafa-1', SB), { resultadoEn: serverTimestamp(), tardio: true });
    await ko(b.commit());
  });
});

// ====================================================================================== lecturas
describe('lecturas por actor', () => {
  beforeEach(async () => { await seedReg(SA, 'gafa-1', {}); });
  it('registro: propietario get/list; Quest propia get; ajenos denegados', async () => {
    await ok(getDoc(regRef(clin('clin-1'), 'gafa-1', SA)));
    await ok(getDocs(collection(clin('clin-1'), 'dispositivos/gafa-1/sesiones_registro')));
    await ok(getDoc(regRef(gafa('gafa-1'), 'gafa-1', SA)));
    await ko(getDocs(collection(gafa('gafa-1'), 'dispositivos/gafa-1/sesiones_registro')));
    await ko(getDoc(regRef(gafa('gafa-2'), 'gafa-1', SA)));
    await ko(getDoc(regRef(clin('clin-2'), 'gafa-1', SA)));
    await ko(getDocs(collection(clin('clin-2'), 'dispositivos/gafa-1/sesiones_registro')));
    await ko(getDoc(regRef(clin('admin-1'), 'gafa-1', SA)));
    await ko(getDoc(regRef(clin('clin-nv', { verified: false }), 'gafa-1', SA)));
    await ko(getDoc(regRef(anon(), 'gafa-1', SA)));
  });
  it('buzon: propietario y Quest propia; revocada, ajena, otro fisio, anonimo no', async () => {
    await ok(getDoc(curRef(clin('clin-1'), 'gafa-1'))); await ok(getDoc(curRef(gafa('gafa-1'), 'gafa-1')));
    await ko(getDoc(curRef(gafa('gafa-2'), 'gafa-1'))); await ko(getDoc(curRef(clin('clin-2'), 'gafa-1'))); await ko(getDoc(curRef(anon(), 'gafa-1')));
    await seed((db) => updateDoc(doc(db, 'dispositivos/gafa-1'), { estado: 'revocado' }));
    await ko(getDoc(curRef(gafa('gafa-1'), 'gafa-1'))); await ko(getDoc(regRef(gafa('gafa-1'), 'gafa-1', SA)));
    await ok(getDoc(regRef(clin('clin-1'), 'gafa-1', SA)));   // el propietario conserva la traza aunque la gafa se revoque
  });
});

// ====================================================================================== secuencia completa
describe('secuencia feliz extremo a extremo', () => {
  it('publicar -> iniciar -> solicitar cancelacion -> cerrar interrupted/cancelada_por_web con parcial -> publicar la siguiente', async () => {
    await ok(publica(clin('clin-1'), 'gafa-1', SA));
    await ok(inicia(gafa('gafa-1'), 'gafa-1', SA));
    await ok(solicita(clin('clin-1'), 'gafa-1', SA));
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { status: 'interrupted', reg: { motivo: 'cancelada_por_web' } }));
    await ok(publica(clin('clin-1'), 'gafa-1', SB));
    await ok(inicia(gafa('gafa-1'), 'gafa-1', SB));
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SB));
    const a = await leeReg('gafa-1', SA); const b = await leeReg('gafa-1', SB);
    assert.equal(a.status, 'interrupted'); assert.equal(a.motivo, 'cancelada_por_web');
    assert.equal(b.status, 'completed');
    await seed(async (db) => { assert.equal((await getDocs(collection(db, 'sesiones'))).size, 2); });
  });
});

describe('resultado tardio: estado declarado vs estado del registro (decision del autor)', () => {
  const vencida = () => seedReg(SA, 'gafa-1', { status: 'cancel_requested', iniciadaEn: ts(-10 * MIN), cancelSolicitadaEn: ts(-5 * MIN), cancelSolicitadaPor: 'clin-1', publicadaEn: ts(-20 * MIN), venceEn: ts(-1 * MIN) });
  for (const st of ['completed', 'interrupted']) {
    it(`(a/b) forzado primero + tardio ${st}: resultado ${st}; registro sigue interrupted/sin_respuesta con forzado* intacto`, async () => {
      await vencida();
      await ok(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
      const antes = await leeReg('gafa-1', SA);
      await ok(tardio(gafa('gafa-1'), 'gafa-1', SA, { res: { status: st } }));
      const r = await leeReg('gafa-1', SA);
      assert.equal(r.status, 'interrupted'); assert.equal(r.motivo, 'sin_respuesta'); assert.equal(r.tardio, true); assert.ok(r.resultadoEn);
      for (const k of ['forzadoPor', 'forzadoEn', 'forzadoMotivo', 'cierrePor', 'finalizadaEn']) assert.deepEqual(r[k], antes[k], k);
      await seed(async (db) => { assert.equal((await getDoc(resRef(db, SA))).data().status, st); });
      await ko(tardio(gafa('gafa-1'), 'gafa-1', SA, { res: { status: st } })); // (e) segundo tardio
    });
  }
  it('(c) cierre normal tardio (duration+30 min..24 h, sin forzar) con completed: registro completed, tardio=true', async () => {
    await seedReg(SA, 'gafa-1', { status: 'running', iniciadaEn: ts(-3 * 60 * MIN), venceEn: ts(-170 * MIN), publicadaEn: ts(-185 * MIN) });
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { tardio: true }));
    const r = await leeReg('gafa-1', SA);
    assert.equal(r.status, 'completed'); assert.equal(r.tardio, true);
  });
  it('(d) resultado primero y luego forzado: forzado denegado', async () => {
    await vencida();
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA, { tardio: false }));
    await ko(updateDoc(regRef(clin('clin-1'), 'gafa-1', SA), forzado()));
  });
  it('(e) segundo resultado tras un cierre normal: denegado', async () => {
    await running(SA, 'gafa-1');
    await ok(cierra(gafa('gafa-1'), 'gafa-1', SA));
    await ko(tardio(gafa('gafa-1'), 'gafa-1', SA));
    await ko(cierra(gafa('gafa-1'), 'gafa-1', SA));
  });
  it('(f) pasadas 24 h: tardio completed denegado', async () => {
    await seedReg(SA, 'gafa-1', { status: 'interrupted', motivo: 'sin_respuesta', iniciadaEn: ts(-(24 * 60 + 15) * MIN), finalizadaEn: ts(-24 * 60 * MIN), forzadoPor: 'clin-1', forzadoEn: ts(-24 * 60 * MIN), forzadoMotivo: 'abc defg', cierrePor: 'clin-1', publicadaEn: ts(-26 * 60 * MIN), venceEn: ts(-1500 * MIN) });
    await ko(tardio(gafa('gafa-1'), 'gafa-1', SA, { res: { status: 'completed' } }));
  });
  it('(h) cierre normal: registro.status y resultado.status deben coincidir', async () => {
    await running(SA, 'gafa-1');
    const d = gafa('gafa-1'); const b = writeBatch(d);
    b.set(resRef(d, SA), gems(SA, { deviceUid: 'gafa-1', status: 'interrupted' }));
    b.update(regRef(d, 'gafa-1', SA), { status: 'completed', finalizadaEn: serverTimestamp(), tardio: false, resultadoEn: serverTimestamp() });
    await ko(b.commit());
  });
  it('(g) status del resultado distinto de completed|interrupted: denegado en cualquier rama', async () => {
    await running(SA, 'gafa-1');
    for (const st of ['cancelled', 'pending', 'vencida', 'running', 'otro']) await ko(cierra(gafa('gafa-1'), 'gafa-1', SA, { res: { status: st } }));
  });
});
