// PR3 - Pruebas de la PROPUESTA firestore.rules.next (diseño PR2: roles + vinculación + sesión activa + resultados).
// Carga firestore.rules.next (NO las reglas actuales, NO desplegada). Solo emulador local, proyecto ficticio
// demo-tfg-vr, datos sintéticos. Las suites F0/PR1 siguen probando firestore.rules actual y no se tocan.
//
// Mapa de inversión de hallazgos F0/PR1 -> test nuevo (ver también tests/rules/README.md):
//   F0 pacientes: lee todos / escribe sin esquema / provider anonymous  -> grupo "pacientes" (INV-F0-P*)
//   F0 sesiones: crear sin validar / modificar / borrar sin auth        -> grupo "resultados" (INV-F0-S*)
//   F0 sesion_activa: lectura pública + list + escritura por cualquier auth -> grupo "sesion_activa" (INV-F0-A*)
//   F0 dispositivos: lectura/list públicos, alteración sin auth          -> grupo "dispositivos" / "aislamiento" (INV-F0-D*)
//   PR1 anónimo con token real: pacientes/sesiones/sesion_activa/dispositivos -> grupo "token real del emulador de Auth" (INV-PR1-*)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  writeBatch, serverTimestamp, Timestamp, deleteField,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(here, '..', '..', 'firestore.rules.next');
const PROJECT_ID = 'demo-tfg-vr';
const FS_HOSTPORT = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH_HOSTPORT = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const DOCS = `http://${FS_HOSTPORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let env;
const ok = assertSucceeds;
const ko = assertFails;

before(async () => {
  const [host, port] = FS_HOSTPORT.split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });

// ------------------------------------------------------------------ identidades simuladas
const CODE = 'ABCDEFGH';            // 8 símbolos del alfabeto válido
const CODE2 = 'JKMNPQRS';
const gafaDb = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const clinDb = (uid, { verified = true, provider = 'password' } = {}) =>
  env.authenticatedContext(uid, { email: `${uid}@example.invalid`, email_verified: verified, firebase: { sign_in_provider: provider } }).firestore();
const noAuthDb = () => env.unauthenticatedContext().firestore();

const GAFA_A = 'gafa-a';
const GAFA_B = 'gafa-b';
const CLIN1 = 'clin-1';
const CLIN2 = 'clin-2';
const ADMIN = 'admin-1';

const inMin = (m) => Timestamp.fromMillis(Date.now() + m * 60_000);
const gA = () => gafaDb(GAFA_A);
const gB = () => gafaDb(GAFA_B);
const c1 = () => clinDb(CLIN1);
const c2 = () => clinDb(CLIN2);
const adm = () => clinDb(ADMIN);

async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, `usuarios/${CLIN1}`), { rol: 'fisioterapeuta', creadoEn: Timestamp.now() });
    await setDoc(doc(db, `usuarios/${CLIN2}`), { rol: 'fisioterapeuta', creadoEn: Timestamp.now() });
    await setDoc(doc(db, `usuarios/${ADMIN}`), { rol: 'admin', creadoEn: Timestamp.now() });
    await setDoc(doc(db, 'usuarios/clin-sinverif'), { rol: 'fisioterapeuta', creadoEn: Timestamp.now() });
    // anónimo con doc usuarios plantado (no debe contar como clínico)
    await setDoc(doc(db, `usuarios/${GAFA_A}`), { rol: 'admin', creadoEn: Timestamp.now() });
  });
});

// ------------------------------------------------------------------ semillas de dominio
const seedDevice = (uid, extra = {}) => seed((db) => setDoc(doc(db, `dispositivos/${uid}`), {
  estado: 'sin_vincular', codigoActual: CODE, creadoEn: Timestamp.now(), ...extra,
}));
const seedLinkedDevice = (uid, owner = CLIN1, extra = {}) => seedDevice(uid, {
  estado: 'vinculado', ownerUid: owner, vinculadoEn: Timestamp.now(), ...extra,
});
const seedVinculo = (code, deviceUid, extra = {}) => seed((db) => setDoc(doc(db, `vinculos/${code}`), {
  deviceUid, estado: 'pendiente', usado: false, creadoEn: Timestamp.now(), expira: inMin(5), ...extra,
}));
const seedActiva = (deviceUid, extra = {}) => seed((db) => setDoc(doc(db, `dispositivos/${deviceUid}/sesion_activa/current`), {
  sessionId: 'sess-1', patientId: 'pac-1', patientAlias: 'Paciente S.', gameId: 'gems', duration: 300,
  difficulty: 'Media', therapySide: 'Izquierdo', sessionType: 'Alcance', status: 'pending',
  publicadaEn: Timestamp.now(), venceEn: inMin(60), ...extra,
}));
const seedPaciente = (id = 'pac-1') => seed((db) => setDoc(doc(db, `pacientes/${id}`), validPaciente()));

/** Gafa A vinculada a CLIN1 con sesión activa vigente. */
async function setupVinculadaConSesion() {
  await seedLinkedDevice(GAFA_A);
  await seedActiva(GAFA_A);
}

// ------------------------------------------------------------------ datos válidos
const validPaciente = (over = {}) => ({
  name: 'Paciente Sintetico', initials: 'PS', age: 67, affectedSide: 'Izquierdo', lastSession: '22 jun 2026',
  progress: 10, diagnosis: 'ictus-sintetico', sessions: 3, status: 'activo', colorIdx: 1, notes: '', ...over,
});
const newPaciente = (over = {}) => ({ ...validPaciente(over), createdAt: serverTimestamp() });

const validActiva = (over = {}) => ({
  sessionId: 'sess-1', patientId: 'pac-1', patientAlias: 'Paciente S.', gameId: 'gems', duration: 300,
  difficulty: 'Media', therapySide: 'Izquierdo', sessionType: 'Alcance', status: 'pending',
  publicadaEn: serverTimestamp(), venceEn: inMin(60), ...over,
});

const common = (gameId, over = {}) => ({
  patientId: 'pac-1', sessionId: 'sess-1', deviceUid: GAFA_A, gameId, game: 'Juego', date: '2026-10-01',
  duration: 300, score: 100, side: 'Izquierdo', difficulty: 'Media', sessionType: 'Alcance', fromVR: true, notes: '', ...over,
});
const gems = (over = {}) => ({
  ...common('gems'), accuracy: 80, gemsNormal: 5, gemsGolden: 1, gemsGreen: 1, gemsPurple: 0, gemsRed: 1,
  gemsRedAvoided: 3, totalGems: 8, avgTimePerGem: 2.5, totalMovements: 20,
  movementsSummary: [{ name: 'Alcance', completed: 5, avg_time_s: 1.5 }],
  zonesWorked: { Alto: 1, Medio: 2, Lateral: 3, Bajo: 4 }, ...over,
});
const vault = (over = {}) => ({
  ...common('vault_escape'), completion_percentage: 50.5, panels_collected: 3, total_panels: 6, laser_hits: 2,
  avg_time_per_panel: 4.2, vertical_range_meters: 1.2, crosses_midline: 3, motor_control_score: 70,
  planning_score: 60, spatial_awareness_score: 50, ...over,
});
const city = (over = {}) => ({
  ...common('urban_attention_quest'), accuracy: 70, completion_percentage: 70.0, targets_collected: 7, total_targets: 10,
  sequence_errors: 1, left_side_targets: 3, right_side_targets: 4, asymmetry_percentage: 12.5, neglect_score: 3.1,
  avg_reaction_time: 1.7, cervical_rom_left: 60.0, cervical_rom_right: 55.0, cervical_rom_extension: 30.0,
  cervical_rom_flexion: 40.0, cervical_rom_total: 185.0, spatial_awareness: 60, orientation: 70, processing_speed: 55,
  cervical_mobility: 65, visual_search_efficiency: 75, ...over,
});
const luggage = (over = {}) => ({
  ...common('luggage_handler'), accuracy_percentage: 90.0, luggage_placed: 8, luggage_dropped: 1, luggage_wrong: 1,
  max_combo: 4, total_weight_moved: 120.5, max_weight_lifted: 15.0, time_under_load: 60.0, trunk_rotations_left: 5,
  trunk_rotations_right: 6, trunk_asymmetry: 3.2, strength_score: 70, endurance_score: 60, trunk_mobility_score: 65,
  coordination_score: 55, ...over,
});

// Operaciones de dominio (batches)
const gafaSolicita = (db, uid = GAFA_A, code = CODE, over = {}, devOver = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, `dispositivos/${uid}`), { estado: 'sin_vincular', codigoActual: code, creadoEn: serverTimestamp(), ...devOver });
  b.set(doc(db, `vinculos/${code}`), {
    deviceUid: uid, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(), expira: inMin(9), ...over,
  });
  return b.commit();
};
const confirmaVinculo = (db, uid, { code = CODE, device = GAFA_A, vOver = {}, dOver = {}, soloVinculo = false, soloDisp = false } = {}) => {
  const b = writeBatch(db);
  if (!soloDisp) {
    b.update(doc(db, `vinculos/${code}`), {
      estado: 'vinculado', usado: true, confirmadoPor: uid, confirmadoEn: serverTimestamp(), ...vOver,
    });
  }
  if (!soloVinculo) {
    b.update(doc(db, `dispositivos/${device}`), {
      ownerUid: uid, estado: 'vinculado', vinculadoEn: serverTimestamp(), alias: 'Quest sala 1', ...dOver,
    });
  }
  return b.commit();
};
const sinVincularConVinculo = async (uid = GAFA_A, code = CODE, vOver = {}) => {
  await seedDevice(uid, { codigoActual: code });
  await seedVinculo(code, uid, vOver);
};

// ======================================================================== ROLES
describe('usuarios y roles', () => {
  it('[INV-PR1] anónimo NO puede crear usuarios/{su uid}, ni siquiera con rol admin', async () => {
    await ko(setDoc(doc(gB(), `usuarios/${GAFA_B}`), { rol: 'admin', creadoEn: serverTimestamp() }));
    await ko(setDoc(doc(gB(), `usuarios/${GAFA_B}`), { rol: 'fisioterapeuta' }));
  });
  it('anónimo NO puede editar usuarios/{su uid} existente', async () => {
    await ko(updateDoc(doc(gA(), `usuarios/${GAFA_A}`), { rol: 'fisioterapeuta' }));
  });
  it('un clínico NO puede escalar a admin editando su doc, ni crear/borrar el de otro', async () => {
    await ko(updateDoc(doc(c1(), `usuarios/${CLIN1}`), { rol: 'admin' }));
    await ko(setDoc(doc(c1(), `usuarios/${CLIN1}`), { rol: 'admin', creadoEn: serverTimestamp() }));
    await ko(setDoc(doc(c1(), 'usuarios/nuevo'), { rol: 'fisioterapeuta' }));
    await ko(deleteDoc(doc(c1(), `usuarios/${CLIN2}`)));
    await ko(updateDoc(doc(adm(), `usuarios/${CLIN1}`), { rol: 'admin' })); // ni siquiera un admin desde cliente
  });
  it('get: solo el propio uid; list denegado', async () => {
    await ok(getDoc(doc(c1(), `usuarios/${CLIN1}`)));
    await ko(getDoc(doc(c1(), `usuarios/${CLIN2}`)));
    await ko(getDoc(doc(noAuthDb(), `usuarios/${CLIN1}`)));
    await ko(getDocs(collection(c1(), 'usuarios')));
  });
  it('un anónimo con usuarios/{uid} plantado (rol admin) NO es clínico: provider anonymous lo bloquea', async () => {
    await seedPaciente();
    await ko(getDoc(doc(gA(), 'pacientes/pac-1')));
    await ko(getDoc(doc(gA(), `vinculos/${CODE}`)));
  });
  it('clínico sin doc usuarios o con email NO verificado no es clínico', async () => {
    await seedPaciente();
    await ko(getDoc(doc(clinDb('sin-rol'), 'pacientes/pac-1')));
    await ko(getDoc(doc(clinDb('clin-sinverif', { verified: false }), 'pacientes/pac-1')));
    await ok(getDoc(doc(clinDb('clin-sinverif', { verified: true }), 'pacientes/pac-1'))); // control: con verificación sí
  });
  it('doc usuarios con rol desconocido no concede acceso', async () => {
    await seed((db) => setDoc(doc(db, 'usuarios/rolraro'), { rol: 'superadmin' }));
    await seedPaciente();
    await ko(getDoc(doc(clinDb('rolraro'), 'pacientes/pac-1')));
  });
});

// ======================================================================== VINCULACIÓN
describe('solicitud de vinculación (gafa anónima)', () => {
  it('válida: batch dispositivo + vínculo coherentes', async () => {
    await ok(gafaSolicita(gA()));
    await seed(async (db) => {
      const v = await getDoc(doc(db, `vinculos/${CODE}`));
      assert.equal(v.data().estado, 'pendiente');
    });
  });
  it('código fuera del alfabeto / longitud errónea', async () => {
    for (const bad of ['ABCDEF0H', 'ABCDEFOH', 'ABCDEF1H', 'ABCDEFIH', 'ABCDEFLH', 'abcdefgh', 'ABCDEFG', 'ABCDEFGHJ']) {
      await ko(gafaSolicita(gA(), GAFA_A, bad));
    }
  });
  it('expira > 10 min, en el pasado, o no timestamp', async () => {
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { expira: inMin(11) }));
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { expira: inMin(-1) }));
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { expira: 'mañana' }));
  });
  it('deviceUid ajeno', async () => {
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { deviceUid: GAFA_B }));
    await ko(gafaSolicita(gA(), GAFA_B)); // dispositivos/{otro uid}
  });
  it('sin batch coherente: vínculo solo, o dispositivo con otro código', async () => {
    await seedDevice(GAFA_A, { codigoActual: CODE2 });
    await ko(setDoc(doc(gA(), `vinculos/${CODE}`), { deviceUid: GAFA_A, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(), expira: inMin(5) }));
    const g = gA(); const b = writeBatch(g);
    b.update(doc(g, `dispositivos/${GAFA_A}`), { codigoActual: CODE2 });
    b.set(doc(g, `vinculos/${CODE}`), { deviceUid: GAFA_A, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(), expira: inMin(5) });
    await ko(b.commit());
  });
  it('estado/usado/claves extra inválidos', async () => {
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { estado: 'vinculado' }));
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { usado: true }));
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { confirmadoPor: CLIN1 }));
    await ko(gafaSolicita(gA(), GAFA_A, CODE, { creadoEn: Timestamp.fromMillis(1) }));
  });
  it('dispositivo nacido ya vinculado / con ownerUid -> denegado (la gafa no se autoriza)', async () => {
    await ko(gafaSolicita(gA(), GAFA_A, CODE, {}, { estado: 'vinculado', ownerUid: GAFA_A }));
    await ko(setDoc(doc(gA(), `dispositivos/${GAFA_A}`), { estado: 'vinculado', ownerUid: GAFA_A, codigoActual: CODE, creadoEn: serverTimestamp() }));
  });
  it('colisión de código: otra gafa no puede crear el mismo vínculo', async () => {
    await ok(gafaSolicita(gA()));
    await ko(gafaSolicita(gB()));
  });
  it('un clínico o un no autenticado NO crea solicitudes', async () => {
    await ko(gafaSolicita(c1()));
    await ko(gafaSolicita(noAuthDb()));
  });
  it('get de vínculo solo clínico; list nadie; la gafa no lee su propio vínculo', async () => {
    await sinVincularConVinculo();
    await ok(getDoc(doc(c1(), `vinculos/${CODE}`)));
    await ko(getDoc(doc(gA(), `vinculos/${CODE}`)));
    await ko(getDoc(doc(noAuthDb(), `vinculos/${CODE}`)));
    await ko(getDocs(collection(c1(), 'vinculos')));
    await ko(getDocs(collection(adm(), 'vinculos')));
  });
  it('la gafa puede cancelar su solicitud pendiente; otra gafa no', async () => {
    await sinVincularConVinculo();
    await ko(deleteDoc(doc(gB(), `vinculos/${CODE}`)));
    await ok(deleteDoc(doc(gA(), `vinculos/${CODE}`)));
  });
  it('la gafa NO puede borrar un vínculo ya vinculado', async () => {
    await sinVincularConVinculo(GAFA_A, CODE, { estado: 'vinculado', usado: true });
    await ko(deleteDoc(doc(gA(), `vinculos/${CODE}`)));
  });
  it('la gafa rota su código mientras sin_vincular (batch nuevo vínculo)', async () => {
    await sinVincularConVinculo();
    const g = gA(); const b = writeBatch(g);
    b.update(doc(g, `dispositivos/${GAFA_A}`), { codigoActual: CODE2 });
    b.set(doc(g, `vinculos/${CODE2}`), { deviceUid: GAFA_A, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(), expira: inMin(9) });
    await ok(b.commit());
  });
});

describe('confirmación de vinculación (clínico)', () => {
  beforeEach(async () => { await sinVincularConVinculo(); });

  it('válida: batch vínculo + dispositivo', async () => {
    await ok(confirmaVinculo(c1(), CLIN1));
    await seed(async (db) => {
      const d = (await getDoc(doc(db, `dispositivos/${GAFA_A}`))).data();
      assert.equal(d.estado, 'vinculado');
      assert.equal(d.ownerUid, CLIN1);
    });
  });
  it('válida también sin alias (alias es opcional)', async () => {
    await ok(confirmaVinculoSinAlias());
  });
  it('alias demasiado largo o con caracteres no permitidos', async () => {
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { alias: 'x'.repeat(31) } }));
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { alias: '<script>' } }));
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { alias: 42 } }));
  });
  it('expirado', async () => {
    await seedVinculo(CODE, GAFA_A, { expira: Timestamp.fromMillis(Date.now() - 1000) });
    await ko(confirmaVinculo(c1(), CLIN1));
  });
  it('vínculo ya usado / ya vinculado', async () => {
    await seedVinculo(CODE, GAFA_A, { usado: true });
    await ko(confirmaVinculo(c1(), CLIN1));
    await seedVinculo(CODE, GAFA_A, { estado: 'vinculado', usado: false });
    await ko(confirmaVinculo(c1(), CLIN1));
  });
  it('dispositivo ya vinculado a otro: no se puede revincular', async () => {
    await seedLinkedDevice(GAFA_A, CLIN2, { codigoActual: CODE });
    await ko(confirmaVinculo(c1(), CLIN1));
  });
  it('ownerUid distinto del clínico que confirma', async () => {
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { ownerUid: CLIN2 } }));
    await ko(confirmaVinculo(c1(), CLIN1, { vOver: { confirmadoPor: CLIN2 } }));
  });
  it('solo uno de los dos docs (solo vínculo / solo dispositivo)', async () => {
    await ko(confirmaVinculo(c1(), CLIN1, { soloVinculo: true }));
    await ko(confirmaVinculo(c1(), CLIN1, { soloDisp: true }));
  });
  it('clave extra en vínculo o en dispositivo', async () => {
    await ko(confirmaVinculo(c1(), CLIN1, { vOver: { extra: 1 } }));
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { extra: 1 } }));
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { codigoActual: CODE2 } }));
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { revocadoEn: serverTimestamp() } }));
  });
  it('timestamps falsos (confirmadoEn / vinculadoEn distintos de request.time)', async () => {
    await ko(confirmaVinculo(c1(), CLIN1, { vOver: { confirmadoEn: Timestamp.fromMillis(1) } }));
    await ko(confirmaVinculo(c1(), CLIN1, { dOver: { vinculadoEn: Timestamp.fromMillis(1) } }));
  });
  it('clínico sin usuarios/rol, con email sin verificar, o con rol inválido', async () => {
    await ko(confirmaVinculo(clinDb('sin-rol'), 'sin-rol'));
    await ko(confirmaVinculo(clinDb('clin-sinverif', { verified: false }), 'clin-sinverif'));
  });
  it('anónimo intentando confirmar (incluso con usuarios/{uid} plantado)', async () => {
    await ko(confirmaVinculo(gB(), GAFA_B));
    await ko(confirmaVinculo(gA(), GAFA_A)); // la propia gafa, con doc usuarios admin plantado
  });
  it('gafa autoautorizándose: no puede cambiar estado/ownerUid/vinculadoEn/alias/revocadoEn', async () => {
    const g = gA();
    await ko(updateDoc(doc(g, `dispositivos/${GAFA_A}`), { estado: 'vinculado' }));
    await ko(updateDoc(doc(g, `dispositivos/${GAFA_A}`), { ownerUid: GAFA_A }));
    await ko(updateDoc(doc(g, `dispositivos/${GAFA_A}`), { estado: 'vinculado', ownerUid: GAFA_A, vinculadoEn: serverTimestamp() }));
    await ko(updateDoc(doc(g, `dispositivos/${GAFA_A}`), { alias: 'mi gafa' }));
    await ko(updateDoc(doc(g, `dispositivos/${GAFA_A}`), { revocadoEn: serverTimestamp() }));
    // ni siquiera con un "vínculo confirmado" fabricado por ella en el mismo batch
    const b = writeBatch(g);
    b.update(doc(g, `vinculos/${CODE}`), { estado: 'vinculado', usado: true, confirmadoPor: GAFA_A, confirmadoEn: serverTimestamp() });
    b.update(doc(g, `dispositivos/${GAFA_A}`), { ownerUid: GAFA_A, estado: 'vinculado', vinculadoEn: serverTimestamp() });
    await ko(b.commit());
  });
  it('gafa vinculada tampoco cambia ownerUid/estado ni código', async () => {
    await seedLinkedDevice(GAFA_A, CLIN1);
    await ko(updateDoc(doc(gA(), `dispositivos/${GAFA_A}`), { ownerUid: GAFA_A }));
    await ko(updateDoc(doc(gA(), `dispositivos/${GAFA_A}`), { estado: 'sin_vincular' }));
    await ko(updateDoc(doc(gA(), `dispositivos/${GAFA_A}`), { codigoActual: CODE2 }));
  });
  it('segunda confirmación del mismo código: denegada (también por otro clínico)', async () => {
    await ok(confirmaVinculo(c1(), CLIN1));
    await ko(confirmaVinculo(c1(), CLIN1));
    await ko(confirmaVinculo(c2(), CLIN2));
  });
  it('clínico no puede secuestrar el vínculo de OTRA gafa cambiando deviceUid', async () => {
    await ko(confirmaVinculo(c1(), CLIN1, { vOver: { deviceUid: GAFA_B } }));
  });
  it('gafa B no puede apuntar su codigoActual al código de A y vincularse', async () => {
    await seedDevice(GAFA_B, { codigoActual: CODE });
    await ko(confirmaVinculo(c1(), CLIN1, { device: GAFA_B }));
  });
});

// helper aparte (alias omitido): se define fuera para no tener que usar undefined en updateDoc
function confirmaVinculoSinAlias() {
  const db = c1();
  const b = writeBatch(db);
  b.update(doc(db, `vinculos/${CODE}`), { estado: 'vinculado', usado: true, confirmadoPor: CLIN1, confirmadoEn: serverTimestamp() });
  b.update(doc(db, `dispositivos/${GAFA_A}`), { ownerUid: CLIN1, estado: 'vinculado', vinculadoEn: serverTimestamp() });
  return b.commit();
}

// ======================================================================== DISPOSITIVOS / REVOCACIÓN / AISLAMIENTO
describe('dispositivos: revocación', () => {
  beforeEach(async () => { await setupVinculadaConSesion(); });
  const revoca = (db) => updateDoc(doc(db, `dispositivos/${GAFA_A}`), { estado: 'revocado', revocadoEn: serverTimestamp() });

  it('el propietario revoca', async () => { await ok(revoca(c1())); });
  it('un admin revoca', async () => { await ok(revoca(adm())); });
  it('otro clínico NO revoca', async () => { await ko(revoca(c2())); });
  it('la gafa NO se revoca ni se "desrevoca"', async () => {
    await ko(revoca(gA()));
    await ok(revoca(c1()));
    await ko(updateDoc(doc(gA(), `dispositivos/${GAFA_A}`), { estado: 'sin_vincular' }));
  });
  it('revocado es terminal: nadie lo vuelve a vincular/revocar; la gafa no lo borra', async () => {
    await ok(revoca(c1()));
    await ko(updateDoc(doc(c1(), `dispositivos/${GAFA_A}`), { estado: 'vinculado', revocadoEn: serverTimestamp() }));
    await ko(revoca(adm()));
    await ko(deleteDoc(doc(gA(), `dispositivos/${GAFA_A}`)));
  });
  it('revocación con claves extra o timestamp falso denegada', async () => {
    await ko(updateDoc(doc(c1(), `dispositivos/${GAFA_A}`), { estado: 'revocado', revocadoEn: serverTimestamp(), ownerUid: CLIN2 }));
    await ko(updateDoc(doc(c1(), `dispositivos/${GAFA_A}`), { estado: 'revocado', revocadoEn: Timestamp.fromMillis(1) }));
  });
  it('tras revocar: la gafa NO lee sesion_activa ni crea resultados', async () => {
    await ok(getDoc(doc(gA(), `dispositivos/${GAFA_A}/sesion_activa/current`)));
    await ok(revoca(c1()));
    await ko(getDoc(doc(gA(), `dispositivos/${GAFA_A}/sesion_activa/current`)));
    await ko(setDoc(doc(gA(), 'sesiones/sess-1'), gems()));
    await ko(updateDoc(doc(gA(), `dispositivos/${GAFA_A}/sesion_activa/current`), { status: 'completed' }));
  });
  it('tras revocar, el propietario ya no publica sesiones pero sí puede limpiar', async () => {
    await ok(revoca(c1()));
    await ko(setDoc(doc(c1(), `dispositivos/${GAFA_A}/sesion_activa/current`), validActiva()));
    await ok(deleteDoc(doc(c1(), `dispositivos/${GAFA_A}/sesion_activa/current`)));
  });
});

describe('dispositivos: lectura, listado y borrado', () => {
  it('get: la gafa su doc, clínico cualquiera; otra gafa y sin token no', async () => {
    await seedLinkedDevice(GAFA_A);
    await ok(getDoc(doc(gA(), `dispositivos/${GAFA_A}`)));
    await ok(getDoc(doc(c2(), `dispositivos/${GAFA_A}`)));
    await ko(getDoc(doc(gB(), `dispositivos/${GAFA_A}`)));
    await ko(getDoc(doc(noAuthDb(), `dispositivos/${GAFA_A}`)));
  });
  it('list: clínico solo con filtro ownerUid == su uid; sin filtro, ajeno, gafa o sin token no', async () => {
    await seedLinkedDevice(GAFA_A, CLIN1);
    await seedLinkedDevice(GAFA_B, CLIN2);
    const own = await ok(getDocs(query(collection(c1(), 'dispositivos'), where('ownerUid', '==', CLIN1))));
    assert.equal(own.size, 1);
    await ko(getDocs(collection(c1(), 'dispositivos')));
    await ko(getDocs(query(collection(c1(), 'dispositivos'), where('ownerUid', '==', CLIN2))));
    await ko(getDocs(collection(gA(), 'dispositivos')));
    await ko(getDocs(query(collection(gA(), 'dispositivos'), where('ownerUid', '==', GAFA_A))));
    await ko(getDocs(collection(noAuthDb(), 'dispositivos')));
  });
  it('delete: la gafa borra el suyo solo si sin_vincular; nunca vinculado/ajeno/clínico', async () => {
    await seedDevice(GAFA_A);
    await ko(deleteDoc(doc(gB(), `dispositivos/${GAFA_A}`)));
    await ko(deleteDoc(doc(c1(), `dispositivos/${GAFA_A}`)));
    await ok(deleteDoc(doc(gA(), `dispositivos/${GAFA_A}`)));
    await seedLinkedDevice(GAFA_B);
    await ko(deleteDoc(doc(gB(), `dispositivos/${GAFA_B}`)));
  });
  it('sin token: ni crea ni altera dispositivos (INV-F0-D)', async () => {
    await seedDevice(GAFA_A);
    await ko(setDoc(doc(noAuthDb(), 'dispositivos/NUEVO'), { estado: 'sin_vincular' }));
    await ko(updateDoc(doc(noAuthDb(), `dispositivos/${GAFA_A}`), { estado: 'vinculado' }));
  });
});

describe('aislamiento entre gafas', () => {
  beforeEach(async () => {
    await seedLinkedDevice(GAFA_A, CLIN1);
    await seedLinkedDevice(GAFA_B, CLIN2);
    await seedActiva(GAFA_A, { sessionId: 'sa' });
    await seedActiva(GAFA_B, { sessionId: 'sb' });
    await seed((db) => setDoc(doc(db, 'sesiones/sb'), gems({ sessionId: 'sb', deviceUid: GAFA_B })));
  });
  it('gafa A no lee dispositivo / sesion_activa / resultados de gafa B', async () => {
    await ko(getDoc(doc(gA(), `dispositivos/${GAFA_B}`)));
    await ko(getDoc(doc(gA(), `dispositivos/${GAFA_B}/sesion_activa/current`)));
    await ko(getDoc(doc(gA(), 'sesiones/sb')));
    await ok(getDoc(doc(gB(), 'sesiones/sb')));
  });
  it('gafa A no escribe en la sesion_activa de B ni crea resultados con deviceUid de B', async () => {
    await ko(updateDoc(doc(gA(), `dispositivos/${GAFA_B}/sesion_activa/current`), { status: 'completed' }));
    await ko(setDoc(doc(gA(), 'sesiones/sa'), gems({ sessionId: 'sa', deviceUid: GAFA_B })));
  });
  it('el clínico propietario de B no lee/publica en la sesion_activa de A', async () => {
    await ko(getDoc(doc(c2(), `dispositivos/${GAFA_A}/sesion_activa/current`)));
    await ko(setDoc(doc(c2(), `dispositivos/${GAFA_A}/sesion_activa/current`), validActiva()));
  });
  it('gafa sin vincular no lee su sesion_activa', async () => {
    await seedDevice('gafa-nueva');
    await seed((db) => setDoc(doc(db, 'dispositivos/gafa-nueva/sesion_activa/current'), { sessionId: 'x', patientId: 'p', patientAlias: 'a', gameId: 'gems', duration: 1, difficulty: 'a', therapySide: 'a', sessionType: 'a', status: 'pending', publicadaEn: Timestamp.now(), venceEn: inMin(5) }));
    await ko(getDoc(doc(gafaDb('gafa-nueva'), 'dispositivos/gafa-nueva/sesion_activa/current')));
  });
  it('sin token no se lee nada', async () => {
    const n = noAuthDb();
    await ko(getDoc(doc(n, `dispositivos/${GAFA_A}`)));
    await ko(getDoc(doc(n, `dispositivos/${GAFA_A}/sesion_activa/current`)));
    await ko(getDoc(doc(n, 'sesiones/sb')));
    await ko(getDocs(collection(n, 'sesiones')));
    await ko(getDocs(collection(n, 'pacientes')));
    await ko(getDoc(doc(n, 'sesion_activa/current'))); // ruta antigua en raíz: sin regla
  });
});

// ======================================================================== SESIÓN ACTIVA
describe('sesion_activa (dispositivos/{uid}/sesion_activa/current)', () => {
  const path = (d) => `dispositivos/${d}/sesion_activa/current`;
  beforeEach(async () => { await seedLinkedDevice(GAFA_A, CLIN1); });

  it('el propietario publica una sesión válida (INV-F0-A: ya no la escribe cualquier autenticado)', async () => {
    await ok(setDoc(doc(c1(), path(GAFA_A)), validActiva()));
  });
  it('republicar (update completo) por el propietario válido', async () => {
    await seedActiva(GAFA_A);
    await ok(setDoc(doc(c1(), path(GAFA_A)), validActiva({ sessionId: 'sess-2' })));
  });
  it('inválidas: status completed al crear, patientName, clave extra, enums y rangos', async () => {
    const d = () => doc(c1(), path(GAFA_A));
    await ko(setDoc(d(), validActiva({ status: 'completed' })));
    await ko(setDoc(d(), validActiva({ patientName: 'Nombre Real' })));
    await ko(setDoc(d(), validActiva({ extra: 1 })));
    await ko(setDoc(d(), validActiva({ gameId: 'otro' })));
    await ko(setDoc(d(), validActiva({ duration: 0 })));
    await ko(setDoc(d(), validActiva({ duration: 99999 })));
    await ko(setDoc(d(), validActiva({ duration: 30.5 })));
    await ko(setDoc(d(), validActiva({ patientAlias: 'x'.repeat(31) })));
    await ko(setDoc(d(), validActiva({ patientId: 'tiene espacios!' })));
    await ko(setDoc(d(), validActiva({ venceEn: inMin(-5) })));
    await ko(setDoc(d(), validActiva({ venceEn: inMin(60 * 25) })));
    await ko(setDoc(d(), validActiva({ publicadaEn: Timestamp.fromMillis(1) })));
    const { sessionType, ...incompleto } = validActiva();
    await ko(setDoc(d(), incompleto));
  });
  it('otro clínico, admin ajeno, anónimo y sin token NO publican', async () => {
    await ko(setDoc(doc(c2(), path(GAFA_A)), validActiva()));
    await ko(setDoc(doc(adm(), path(GAFA_A)), validActiva()));
    await ko(setDoc(doc(gA(), path(GAFA_A)), validActiva()));
    await ko(setDoc(doc(noAuthDb(), path(GAFA_A)), validActiva()));
  });
  it('solo el doc "current": otro id denegado', async () => {
    await ko(setDoc(doc(c1(), `dispositivos/${GAFA_A}/sesion_activa/otra`), validActiva()));
  });
  it('lectura: la gafa vinculada y el propietario; otro clínico no; list nadie (INV-F0-A)', async () => {
    await seedActiva(GAFA_A);
    await ok(getDoc(doc(gA(), path(GAFA_A))));
    await ok(getDoc(doc(c1(), path(GAFA_A))));
    await ko(getDoc(doc(c2(), path(GAFA_A))));
    await ko(getDocs(collection(c1(), `dispositivos/${GAFA_A}/sesion_activa`)));
    await ko(getDocs(collection(gA(), `dispositivos/${GAFA_A}/sesion_activa`)));
  });
  it('la gafa solo PATCH status pending -> completed', async () => {
    await seedActiva(GAFA_A);
    await ok(updateDoc(doc(gA(), path(GAFA_A)), { status: 'completed' }));
  });
  it('la gafa NO vuelve a pending ni toca otros campos ni borra ni crea', async () => {
    await seedActiva(GAFA_A, { status: 'completed' });
    await ko(updateDoc(doc(gA(), path(GAFA_A)), { status: 'pending' }));
    await seedActiva(GAFA_A);
    await ko(updateDoc(doc(gA(), path(GAFA_A)), { patientId: 'otro' }));
    await ko(updateDoc(doc(gA(), path(GAFA_A)), { status: 'completed', patientId: 'otro' }));
    await ko(updateDoc(doc(gA(), path(GAFA_A)), { venceEn: inMin(1000) }));
    await ko(updateDoc(doc(gA(), path(GAFA_A)), { status: 'cualquiera' }));
    await ko(deleteDoc(doc(gA(), path(GAFA_A))));
    await seed((db) => deleteDoc(doc(db, path(GAFA_A))));
    await ko(setDoc(doc(gA(), path(GAFA_A)), validActiva()));
  });
  it('el propietario borra la sesión activa; otro no', async () => {
    await seedActiva(GAFA_A);
    await ko(deleteDoc(doc(c2(), path(GAFA_A))));
    await ok(deleteDoc(doc(c1(), path(GAFA_A))));
  });
});

// ======================================================================== RESULTADOS
describe('resultados (sesiones)', () => {
  beforeEach(async () => { await setupVinculadaConSesion(); });
  const crea = (data, id = data.sessionId ?? 'sess-1', db = gA()) => setDoc(doc(db, `sesiones/${id}`), data);

  it('válido para los 4 juegos (campos exactos de firebase_manager.gd)', async () => {
    await ok(crea(gems()));
    await seedActiva(GAFA_A, { sessionId: 'v1', gameId: 'vault_escape' });
    await ok(crea(vault({ sessionId: 'v1' })));
    await seedActiva(GAFA_A, { sessionId: 'c1', gameId: 'urban_attention_quest' });
    await ok(crea(city({ sessionId: 'c1' })));
    await seedActiva(GAFA_A, { sessionId: 'l1', gameId: 'luggage_handler' });
    await ok(crea(luggage({ sessionId: 'l1' })));
  });
  it('válido con mínimo de campos comunes (los específicos del juego son obligatorios) y rechazo si faltan', async () => {
    const { game, date, side, difficulty, sessionType, fromVR, notes, ...min } = gems();
    await ok(crea(min));
    await seedActiva(GAFA_A, { sessionId: 'sess-2' });
    const { accuracy, ...sinAccuracy } = gems({ sessionId: 'sess-2' });
    await ko(crea(sinAccuracy));
    await ko(crea({ patientId: 'pac-1', sessionId: 'sess-2', deviceUid: GAFA_A, gameId: 'gems', duration: 10, score: 0 }));
  });
  it('(INV-F0-S) NO admite patientName ni campos extra', async () => {
    await ko(crea(gems({ patientName: 'Nombre Real' })));
    await ko(crea(gems({ extra: 'x' })));
    await ko(crea(gems({ cervical_rom_left: 1.0 }))); // clave de otro juego
  });
  it('id de documento != sessionId', async () => {
    await ko(crea(gems(), 'otro-id'));
  });
  it('patientId distinto de la sesión activa', async () => {
    await ko(crea(gems({ patientId: 'pac-2' })));
  });
  it('deviceUid distinto del uid de la gafa', async () => {
    await ko(crea(gems({ deviceUid: GAFA_B })));
  });
  it('sesión activa completed / vencida / sin sesión activa / sessionId distinto', async () => {
    await seedActiva(GAFA_A, { status: 'completed' });
    await ko(crea(gems()));
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() - 1000) });
    await ko(crea(gems()));
    await seedActiva(GAFA_A, { sessionId: 'otra' });
    await ko(crea(gems()));
    await seed((db) => deleteDoc(doc(db, `dispositivos/${GAFA_A}/sesion_activa/current`)));
    await ko(crea(gems()));
  });
  it('gafa sin vincular o sin doc de dispositivo no crea', async () => {
    await seed((db) => updateDoc(doc(db, `dispositivos/${GAFA_A}`), { estado: 'sin_vincular' }));
    await ko(crea(gems()));
    await seed((db) => deleteDoc(doc(db, `dispositivos/${GAFA_A}`)));
    await ko(crea(gems()));
  });
  it('tipos y rangos', async () => {
    await ko(crea(gems({ score: -1 })));
    await ko(crea(gems({ score: 1.5 })));
    await ko(crea(gems({ score: '100' })));
    await ko(crea(gems({ accuracy: 101 })));
    await ko(crea(gems({ duration: 'mucho' })));
    await ko(crea(gems({ duration: 999999 })));
    await ko(crea(gems({ gameId: 'otro' })));
    await ko(crea(gems({ fromVR: false })));
    await ko(crea(gems({ notes: 'texto libre de la gafa' })));
    await ko(crea(gems({ game: 'x'.repeat(61) })));
    await ko(crea(gems({ movementsSummary: new Array(51).fill({ name: 'a' }) })));
    await ko(crea(gems({ movementsSummary: 'no-lista' })));
    await ko(crea(gems({ zonesWorked: { Alto: 1, Otra: 2 } })));
    await ko(crea(gems({ patientId: 'x y' })));
    await ko(crea(gems({ gameId: 'vault_escape' }))); // claves de gems con gameId vault
    await ko(crea(gems({ createdAt: Timestamp.fromMillis(1) })));
  });
  it('gameId del resultado distinto del de la sesión activa -> denegado (válido en esquema pero otro juego)', async () => {
    // la sesión activa es 'gems'; un resultado 'vault_escape' completo y bien formado se deniega
    await ko(crea(vault()));
    await ko(crea(city()));
    await ko(crea(luggage()));
    await ok(crea(gems())); // control: el mismo sessionId con el gameId correcto sí
  });
  it('vigencia: venceEn futuro permite, venceEn pasado deniega (tiempos fijados con seed, deterministas)', async () => {
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() + 120_000) });
    await ok(crea(gems()));
    await seedActiva(GAFA_A, { sessionId: 'sess-2', venceEn: Timestamp.fromMillis(Date.now() - 1) });
    await ko(crea(gems({ sessionId: 'sess-2' })));
    await seedActiva(GAFA_A, { sessionId: 'sess-3', venceEn: Timestamp.fromMillis(Date.now() - 3_600_000) });
    await ko(crea(gems({ sessionId: 'sess-3' })));
    // control: la misma sesión 'sess-3' vuelve a ser válida si se republica con vencimiento futuro
    await seedActiva(GAFA_A, { sessionId: 'sess-3', venceEn: Timestamp.fromMillis(Date.now() + 60_000) });
    await ok(crea(gems({ sessionId: 'sess-3' })));
  });
  it('duplicado: el segundo create del mismo sessionId se deniega (idempotente)', async () => {
    await ok(crea(gems()));
    await ko(crea(gems({ score: 999 })));
    await ko(crea(gems()));
  });
  it('la gafa NO actualiza ni borra resultados (INV-F0-S: sin modificar/borrar sin auth)', async () => {
    await ok(crea(gems()));
    await ko(updateDoc(doc(gA(), 'sesiones/sess-1'), { score: 9999 }));
    await ko(updateDoc(doc(gA(), 'sesiones/sess-1'), { notes: 'x' }));
    await ko(deleteDoc(doc(gA(), 'sesiones/sess-1')));
  });
  it('sin token o clínico no crean resultados', async () => {
    await ko(crea(gems(), 'sess-1', noAuthDb()));
    await ko(crea(gems(), 'sess-1', c1()));
  });
  it('lectura: la gafa dueña sí, otra gafa no; clínico get/list; sin token no', async () => {
    await ok(crea(gems()));
    await ok(getDoc(doc(gA(), 'sesiones/sess-1')));
    await ko(getDoc(doc(gB(), 'sesiones/sess-1')));
    await ko(getDoc(doc(noAuthDb(), 'sesiones/sess-1')));
    await ok(getDoc(doc(c2(), 'sesiones/sess-1')));
    const l = await ok(getDocs(collection(c1(), 'sesiones')));
    assert.equal(l.size, 1);
    await ko(getDocs(collection(gA(), 'sesiones')));
    await ko(getDocs(query(collection(gA(), 'sesiones'), where('deviceUid', '==', GAFA_A))));
  });
  it('clínico: update solo notes; delete sí; otros campos no', async () => {
    await seed((db) => setDoc(doc(db, 'sesiones/sess-1'), gems()));
    await ok(updateDoc(doc(c1(), 'sesiones/sess-1'), { notes: 'nota del fisio' }));
    await ko(updateDoc(doc(c1(), 'sesiones/sess-1'), { score: 1 }));
    await ko(updateDoc(doc(c1(), 'sesiones/sess-1'), { notes: 5 }));
    await ko(updateDoc(doc(gA(), 'sesiones/sess-1'), { notes: 'x' }));
    await ok(deleteDoc(doc(c1(), 'sesiones/sess-1')));
  });
});

// ======================================================================== AJUSTES PR3: sesiones (notes + updatedAt)
describe('sesiones: update clínico notes + updatedAt', () => {
  const ref = (db) => doc(db, 'sesiones/sess-1');
  beforeEach(async () => { await seed((db) => setDoc(doc(db, 'sesiones/sess-1'), gems())); });

  it('notes + updatedAt == request.time válido (clínico y admin); updatedAt solo también', async () => {
    await ok(updateDoc(ref(c1()), { notes: 'nota', updatedAt: serverTimestamp() }));
    await ok(updateDoc(ref(adm()), { notes: 'otra', updatedAt: serverTimestamp() }));
    await ok(updateDoc(ref(c2()), { updatedAt: serverTimestamp() }));
  });
  it('updatedAt con tiempo falso / ajeno / tipo erróneo denegado', async () => {
    await ko(updateDoc(ref(c1()), { notes: 'n', updatedAt: Timestamp.fromMillis(1) }));
    await ko(updateDoc(ref(c1()), { notes: 'n', updatedAt: inMin(60) }));
    await ko(updateDoc(ref(c1()), { notes: 'n', updatedAt: Timestamp.now() }));
    await ko(updateDoc(ref(c1()), { notes: 'n', updatedAt: 'hoy' }));
    await ko(updateDoc(ref(c1()), { notes: 'n', updatedAt: Date.now() }));
  });
  it('updatedAt + campo protegido denegado', async () => {
    for (const f of [{ patientId: 'otro' }, { deviceUid: GAFA_B }, { sessionId: 'x' }, { score: 1 },
                     { accuracy: 1 }, { createdAt: serverTimestamp() }, { gameId: 'vault_escape' }, { fromVR: false }]) {
      await ko(updateDoc(ref(c1()), { notes: 'n', updatedAt: serverTimestamp(), ...f }));
    }
  });
  it('notes demasiado largo o no string denegado; 2000 exactos permitido', async () => {
    await ko(updateDoc(ref(c1()), { notes: 'x'.repeat(2001), updatedAt: serverTimestamp() }));
    await ko(updateDoc(ref(c1()), { notes: 7, updatedAt: serverTimestamp() }));
    await ok(updateDoc(ref(c1()), { notes: 'x'.repeat(2000), updatedAt: serverTimestamp() }));
  });
  it('la gafa (dueña), otra gafa y sin token NO pueden (ni con updatedAt)', async () => {
    await ko(updateDoc(ref(gA()), { notes: 'x', updatedAt: serverTimestamp() }));
    await ko(updateDoc(ref(gA()), { updatedAt: serverTimestamp() }));
    await ko(updateDoc(ref(gB()), { notes: 'x', updatedAt: serverTimestamp() }));
    await ko(updateDoc(ref(noAuthDb()), { notes: 'x', updatedAt: serverTimestamp() }));
  });
});

// ======================================================================== AJUSTES PR3: alias de dispositivo
describe('dispositivos: edición de alias', () => {
  const ref = (db, d = GAFA_A) => doc(db, `dispositivos/${d}`);
  beforeEach(async () => { await seedLinkedDevice(GAFA_A, CLIN1, { alias: 'Quest sala 1' }); });

  it('el propietario cambia el alias; un admin también (coherente con revocar)', async () => {
    await ok(updateDoc(ref(c1()), { alias: 'Quest sala 2' }));
    await ok(updateDoc(ref(adm()), { alias: 'Quest-Admin_3.0' }));
    await ok(updateDoc(ref(c1()), { alias: 'x'.repeat(30) }));
    await ok(updateDoc(ref(c1()), { alias: 'Ñandú áéí' }));
  });
  it('el alias se puede fijar en una gafa vinculada que no lo tenía', async () => {
    await seedLinkedDevice(GAFA_B, CLIN1);
    await ok(updateDoc(ref(c1(), GAFA_B), { alias: 'Nueva' }));
  });
  it('otro clínico, la gafa, otra gafa y sin token NO', async () => {
    await ko(updateDoc(ref(c2()), { alias: 'robada' }));
    await ko(updateDoc(ref(gA()), { alias: 'mia' }));
    await ko(updateDoc(ref(gB()), { alias: 'ajena' }));
    await ko(updateDoc(ref(noAuthDb()), { alias: 'anon' }));
    await ko(updateDoc(ref(clinDb('clin-sinverif', { verified: false })), { alias: 'x' }));
  });
  it('alias inválido: largo, caracteres, tipo, vacío; no se puede borrar', async () => {
    await ko(updateDoc(ref(c1()), { alias: 'x'.repeat(31) }));
    await ko(updateDoc(ref(c1()), { alias: '' }));
    await ko(updateDoc(ref(c1()), { alias: '<script>alert(1)</script>' }));
    await ko(updateDoc(ref(c1()), { alias: 'a/b' }));
    await ko(updateDoc(ref(c1()), { alias: 42 }));
    await ko(updateDoc(ref(c1()), { alias: null }));
    await ko(updateDoc(ref(c1()), { alias: deleteField() }));
  });
  it('alias + otro campo denegado (ownerUid/estado/vinculadoEn/revocadoEn/codigoActual/creadoEn/extra)', async () => {
    for (const f of [{ ownerUid: CLIN2 }, { estado: 'revocado' }, { estado: 'sin_vincular' },
                     { vinculadoEn: serverTimestamp() }, { revocadoEn: serverTimestamp() },
                     { codigoActual: CODE2 }, { creadoEn: serverTimestamp() }, { deviceUid: GAFA_B }, { extra: 1 }]) {
      await ko(updateDoc(ref(c1()), { alias: 'ok', ...f }));
    }
  });
  it('dispositivo REVOCADO o sin vincular: el alias no se edita (revocado es terminal)', async () => {
    await seed((db) => updateDoc(ref(db), { estado: 'revocado', revocadoEn: Timestamp.now() }));
    await ko(updateDoc(ref(c1()), { alias: 'tras revocar' }));
    await ko(updateDoc(ref(adm()), { alias: 'tras revocar' }));
    await seedDevice(GAFA_B);
    await ko(updateDoc(ref(c1(), GAFA_B), { alias: 'sin vincular' })); // aún sin propietario
  });
});

// ======================================================================== AJUSTES PR3: sesion_activa vencida
describe('sesion_activa vencida', () => {
  const path = `dispositivos/${GAFA_A}/sesion_activa/current`;
  beforeEach(async () => { await seedLinkedDevice(GAFA_A, CLIN1); });

  it('PATCH completed: vigente permitido; vencida denegado', async () => {
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() + 120_000) });
    await ok(updateDoc(doc(gA(), path), { status: 'completed' }));
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() - 1) });
    await ko(updateDoc(doc(gA(), path), { status: 'completed' }));
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() - 3_600_000) });
    await ko(updateDoc(doc(gA(), path), { status: 'completed' }));
  });
  it('DECISIÓN: la gafa vinculada SÍ puede leer una sesión vencida (el 403 queda reservado a revocación/no vinculada)', async () => {
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() - 3_600_000) });
    const snap = await ok(getDoc(doc(gA(), path)));
    assert.ok(snap.data().venceEn.toMillis() < Date.now()); // el cliente la ignora comparando venceEn
    await ok(getDoc(doc(c1(), path)));
    await ko(getDoc(doc(gB(), path)));
  });
  it('y aun leyéndola, una vencida no admite resultados', async () => {
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() - 1000) });
    await ok(getDoc(doc(gA(), path)));
    await ko(setDoc(doc(gA(), 'sesiones/sess-1'), gems()));
  });
  it('el propietario puede republicar sobre una vencida (nueva sesión vigente)', async () => {
    await seedActiva(GAFA_A, { venceEn: Timestamp.fromMillis(Date.now() - 1000) });
    await ok(setDoc(doc(c1(), path), validActiva({ sessionId: 'sess-nueva' })));
    await ok(setDoc(doc(gA(), 'sesiones/sess-nueva'), gems({ sessionId: 'sess-nueva' })));
  });
});

// ======================================================================== AJUSTES PR3: revocación con el MISMO contexto
describe('revocación: el mismo contexto de auth pierde todo permiso', () => {
  const act = `dispositivos/${GAFA_A}/sesion_activa/current`;
  const revoca = (db) => updateDoc(doc(db, `dispositivos/${GAFA_A}`), { estado: 'revocado', revocadoEn: serverTimestamp() });

  it('misma gafa (mismo handle/uid): antes lee, crea resultado, cierra y lee su resultado; después TODO denegado', async () => {
    await seedLinkedDevice(GAFA_A, CLIN1);
    await seedActiva(GAFA_A);
    await seedVinculo(CODE, GAFA_A, { estado: 'vinculado', usado: true });
    const g = gA(); // MISMO contexto antes y después de revocar
    await ok(getDoc(doc(g, act)));
    await ok(setDoc(doc(g, 'sesiones/sess-1'), gems()));
    await ok(updateDoc(doc(g, act), { status: 'completed' }));
    await ok(getDoc(doc(g, 'sesiones/sess-1')));

    await ok(revoca(c1())); // el propietario revoca

    // sesión que "quedó en curso" tras la revocación (vigente y pending)
    await seedActiva(GAFA_A, { sessionId: 'sess-2', status: 'pending', venceEn: inMin(60) });
    await ko(getDoc(doc(g, act)));
    await ko(setDoc(doc(g, 'sesiones/sess-2'), gems({ sessionId: 'sess-2' })));
    await ko(updateDoc(doc(g, act), { status: 'completed' }));
    await ko(getDoc(doc(g, 'sesiones/sess-1'))); // ni siquiera sus resultados previos
    await ko(deleteDoc(doc(g, act)));
  });
  it('misma gafa revocada: no borra su dispositivo, no lo recrea/rehabilita, no toca vínculos', async () => {
    await seedLinkedDevice(GAFA_A, CLIN1);
    await seedVinculo(CODE, GAFA_A, { estado: 'vinculado', usado: true });
    const g = gA();
    await ok(getDoc(doc(g, `dispositivos/${GAFA_A}`)));
    await ok(revoca(c1()));
    const d = doc(g, `dispositivos/${GAFA_A}`);
    await ko(deleteDoc(d));
    // "recrear" para evadir la revocación (setDoc sobre doc existente = update): con estado sin_vincular y código nuevo
    await ko(setDoc(d, { estado: 'sin_vincular', codigoActual: CODE2, creadoEn: serverTimestamp() }));
    await ko(updateDoc(d, { estado: 'sin_vincular' }));
    await ko(updateDoc(d, { estado: 'vinculado', ownerUid: GAFA_A, vinculadoEn: serverTimestamp() }));
    await ko(updateDoc(d, { codigoActual: CODE2 }));
    await ko(updateDoc(d, { revocadoEn: deleteField() }));
    // batch completo de nueva solicitud de vinculación (como una gafa nueva)
    await ko(gafaSolicita(g, GAFA_A, CODE2));
    // vínculos: ni editar, ni borrar, ni crear uno pendiente nuevo
    await ko(updateDoc(doc(g, `vinculos/${CODE}`), { estado: 'pendiente', usado: false }));
    await ko(deleteDoc(doc(g, `vinculos/${CODE}`)));
    await ko(setDoc(doc(g, `vinculos/${CODE2}`), { deviceUid: GAFA_A, estado: 'pendiente', usado: false, creadoEn: serverTimestamp(), expira: inMin(5) }));
    await seed(async (db) => {
      const x = (await getDoc(doc(db, `dispositivos/${GAFA_A}`))).data();
      assert.equal(x.estado, 'revocado');
    });
  });
  it('revocada y borrada por consola: el doc recreado por la gafa nace sin_vincular (no hereda permisos)', async () => {
    // Si el doc desapareciera (p. ej. borrado administrativo) la gafa solo puede volver al flujo normal de vinculación.
    await seedLinkedDevice(GAFA_A, CLIN1);
    await seedActiva(GAFA_A);
    const g = gA();
    await ok(revoca(c1()));
    await seed((db) => deleteDoc(doc(db, `dispositivos/${GAFA_A}`)));
    await ko(getDoc(doc(g, act)));
    await ko(setDoc(doc(g, 'sesiones/sess-1'), gems()));
    await ok(gafaSolicita(g, GAFA_A, CODE2)); // sin_vincular: sigue sin poder leer ni escribir resultados
    await ko(getDoc(doc(g, act)));
    await ko(setDoc(doc(g, 'sesiones/sess-1'), gems()));
  });
  it('gafa A revocada escribiendo resultados con deviceUid de otra gafa (B vinculada y con sesión): denegado', async () => {
    await seedLinkedDevice(GAFA_A, CLIN1);
    await seedLinkedDevice(GAFA_B, CLIN2);
    await seedActiva(GAFA_A, { sessionId: 'sa' });
    await seedActiva(GAFA_B, { sessionId: 'sb' });
    const g = gA();
    await ok(revoca(c1()));
    await ko(setDoc(doc(g, 'sesiones/sb'), gems({ sessionId: 'sb', deviceUid: GAFA_B })));
    await ko(setDoc(doc(g, 'sesiones/sa'), gems({ sessionId: 'sa', deviceUid: GAFA_B })));
    await ko(setDoc(doc(g, 'sesiones/sa'), gems({ sessionId: 'sa', deviceUid: GAFA_A })));
    await ko(updateDoc(doc(g, `dispositivos/${GAFA_B}/sesion_activa/current`), { status: 'completed' }));
    await ko(getDoc(doc(g, `dispositivos/${GAFA_B}/sesion_activa/current`)));
    // control: B sigue operativa con su propio contexto
    await ok(setDoc(doc(gB(), 'sesiones/sb'), gems({ sessionId: 'sb', deviceUid: GAFA_B })));
  });
  it('otra gafa con el mismo patrón no queda afectada por la revocación de A', async () => {
    await seedLinkedDevice(GAFA_A, CLIN1);
    await seedLinkedDevice(GAFA_B, CLIN2);
    await seedActiva(GAFA_B, { sessionId: 'sb' });
    await ok(revoca(c1()));
    await ok(getDoc(doc(gB(), `dispositivos/${GAFA_B}/sesion_activa/current`)));
    await ok(updateDoc(doc(gB(), `dispositivos/${GAFA_B}/sesion_activa/current`), { status: 'completed' }));
  });
});

// ======================================================================== PACIENTES
describe('pacientes', () => {
  it('(INV-F0-P) clínico lee, lista, crea, edita y borra con esquema válido', async () => {
    await seedPaciente();
    await ok(getDoc(doc(c1(), 'pacientes/pac-1')));
    const l = await ok(getDocs(collection(c1(), 'pacientes')));
    assert.equal(l.size, 1);
    await ok(setDoc(doc(c1(), 'pacientes/pac-2'), newPaciente()));
    await ok(updateDoc(doc(c1(), 'pacientes/pac-1'), { notes: 'ok', updatedAt: serverTimestamp() }));
    await ok(deleteDoc(doc(c1(), 'pacientes/pac-1')));
  });
  it('esquema: campos extra, tipos, rangos y enums denegados', async () => {
    const d = (id) => doc(c1(), `pacientes/${id}`);
    await ko(setDoc(d('x1'), newPaciente({ extra: 1 })));
    await ko(setDoc(d('x2'), newPaciente({ age: 200 })));
    await ko(setDoc(d('x3'), newPaciente({ age: '67' })));
    await ko(setDoc(d('x4'), newPaciente({ status: 'otro' })));
    await ko(setDoc(d('x5'), newPaciente({ affectedSide: 'Arriba' })));
    await ko(setDoc(d('x6'), newPaciente({ name: '' })));
    await ko(setDoc(d('x7'), newPaciente({ notes: 'x'.repeat(2001) })));
    await ko(setDoc(d('x8'), { ...validPaciente() })); // sin createdAt = request.time
    await ok(setDoc(d('x9'), newPaciente())); // PR5c-3a: alias/pid/aliasNum ya NO se aceptan al crear
  });
  it('update: no se puede reescribir createdAt', async () => {
    await seedPaciente();
    await ko(updateDoc(doc(c1(), 'pacientes/pac-1'), { createdAt: serverTimestamp() }));
  });
  it('(INV-F0-P / INV-PR1) anónimo, gafa vinculada y sin token NO acceden', async () => {
    await seedPaciente();
    await seedLinkedDevice(GAFA_A);
    for (const g of [gB(), gA(), noAuthDb()]) {
      await ko(getDoc(doc(g, 'pacientes/pac-1')));
      await ko(getDocs(collection(g, 'pacientes')));
      await ko(setDoc(doc(g, 'pacientes/pac-9'), newPaciente()));
      await ko(updateDoc(doc(g, 'pacientes/pac-1'), { notes: 'x' }));
      await ko(deleteDoc(doc(g, 'pacientes/pac-1')));
    }
  });
  it('(INV-F0-P) un usuario autenticado cualquiera (sin rol) ya no accede', async () => {
    await seedPaciente();
    await ko(getDoc(doc(env.authenticatedContext('usuario-sintetico', { email: 'x@example.invalid' }).firestore(), 'pacientes/pac-1')));
  });
  it('colección sin regla (p. ej. sesion_activa en raíz) denegada', async () => {
    await ko(setDoc(doc(c1(), 'sesion_activa/current'), validActiva()));
    await ko(getDoc(doc(c1(), 'otra_coleccion/x')));
  });
});

// ======================================================================== TOKEN REAL DEL EMULADOR DE AUTH
async function authPost(path, body, headers = {}) {
  const r = await fetch(`http://${AUTH_HOSTPORT}/identitytoolkit.googleapis.com/v1/${path}?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const decodeJwt = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));

async function realAnon() {
  const r = await authPost('accounts:signUp', { returnSecureToken: true });
  assert.equal(r.status, 200);
  return { token: r.body.idToken, uid: decodeJwt(r.body.idToken).user_id ?? decodeJwt(r.body.idToken).sub };
}
async function realPasswordUser(email, verified) {
  const s = await authPost('accounts:signUp', { email, password: 'clave-sintetica-1', returnSecureToken: true });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  if (verified) {
    const u = await authPost('accounts:update', { localId: s.body.localId, emailVerified: true }, { Authorization: 'Bearer owner' });
    assert.equal(u.status, 200, JSON.stringify(u.body));
  }
  const i = await authPost('accounts:signInWithPassword', { email, password: 'clave-sintetica-1', returnSecureToken: true });
  assert.equal(i.status, 200);
  return { token: i.body.idToken, uid: s.body.localId };
}
async function rest(method, p, { token = null, fields = null, mask = null } = {}) {
  const qs = mask ? '?' + mask.map((m) => `updateMask.fieldPaths=${m}`).join('&') : '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${DOCS}/${p}${qs}`, { method, headers, body: fields ? JSON.stringify({ fields }) : undefined });
  return res.status;
}
const S = (v) => ({ stringValue: v });

describe('token real del emulador de Auth (REST, como Godot / la web)', () => {
  it('[INV-PR1] anónimo REAL: no lee ni escribe pacientes, sesiones ni dispositivos ajenos, ni se autoasigna rol', async () => {
    await seedPaciente();
    await seed((db) => setDoc(doc(db, 'sesiones/s0'), gems({ sessionId: 's0', deviceUid: 'otra' })));
    await seedDevice('otra');
    const a = await realAnon();
    assert.equal(decodeJwt(a.token).firebase.sign_in_provider, 'anonymous');
    assert.equal(await rest('GET', 'pacientes/pac-1', { token: a.token }), 403);
    assert.equal(await rest('GET', 'pacientes', { token: a.token }), 403);
    assert.equal(await rest('PATCH', 'pacientes/nuevo', { token: a.token, fields: { name: S('x') } }), 403);
    assert.equal(await rest('GET', 'sesiones/s0', { token: a.token }), 403);
    assert.equal(await rest('DELETE', 'sesiones/s0', { token: a.token }), 403);
    assert.equal(await rest('GET', 'dispositivos/otra', { token: a.token }), 403);
    assert.equal(await rest('GET', 'dispositivos', { token: a.token }), 403);
    assert.equal(await rest('PATCH', 'dispositivos/otra', { token: a.token, fields: { estado: S('vinculado') }, mask: ['estado'] }), 403);
    assert.equal(await rest('PATCH', `usuarios/${a.uid}`, { token: a.token, fields: { rol: S('admin') } }), 403);
  });
  it('anónimo REAL con usuarios/{uid} plantado (admin) sigue sin ser clínico', async () => {
    const a = await realAnon();
    await seed((db) => setDoc(doc(db, `usuarios/${a.uid}`), { rol: 'admin' }));
    await seedPaciente();
    assert.equal(await rest('GET', 'pacientes/pac-1', { token: a.token }), 403);
  });
  it('clínico REAL (password): con email verificado y rol accede; sin verificar o sin rol no', async () => {
    await seedPaciente();
    const v = await realPasswordUser('verificado@example.invalid', true);
    const nv = await realPasswordUser('noverificado@example.invalid', false);
    assert.equal(decodeJwt(v.token).email_verified, true);
    assert.equal(decodeJwt(nv.token).email_verified, false);
    await seed(async (db) => {
      await setDoc(doc(db, `usuarios/${v.uid}`), { rol: 'fisioterapeuta' });
      await setDoc(doc(db, `usuarios/${nv.uid}`), { rol: 'fisioterapeuta' });
    });
    assert.equal(await rest('GET', 'pacientes/pac-1', { token: v.token }), 200);
    assert.equal(await rest('GET', 'pacientes/pac-1', { token: nv.token }), 403);
    // y el verificado tampoco puede escalar su rol
    assert.equal(await rest('PATCH', `usuarios/${v.uid}`, { token: v.token, fields: { rol: S('admin') } }), 403);
  });
  it('gafa y clínico REALES: vinculación de extremo a extremo (batches con claims equivalentes + lecturas REST con el token real)', async () => {
    const g = await realAnon();
    const cl = await realPasswordUser('fisio@example.invalid', true);
    await seed((db) => setDoc(doc(db, `usuarios/${cl.uid}`), { rol: 'fisioterapeuta' }));
    // la gafa hace su batch con el SDK usando un contexto con los mismos claims
    const gdb = gafaDb(g.uid);
    await ok(gafaSolicita(gdb, g.uid, CODE));
    const cdb = clinDb(cl.uid);
    await ok(confirmaVinculo(cdb, cl.uid, { code: CODE, device: g.uid }));
    assert.equal(await rest('GET', `dispositivos/${g.uid}`, { token: g.token }), 200);
    assert.equal(await rest('GET', `vinculos/${CODE}`, { token: g.token }), 403);
    assert.equal(await rest('GET', `vinculos/${CODE}`, { token: cl.token }), 200);
  });
});
