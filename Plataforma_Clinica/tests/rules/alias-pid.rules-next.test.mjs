// PR5c-3a - Reglas de identidad de paciente (pid + alias P-NNN + contador config/aliasPacientes) en firestore.rules.next.
// Solo emulador local (demo-tfg-vr), datos SINTÉTICOS, reglas NO desplegadas. Se ejecuta con `pnpm test:rules`.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch, runTransaction,
  serverTimestamp, Timestamp, deleteField,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(here, '..', '..', 'firestore.rules.next');
const FS_HOSTPORT = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let env;
const ok = assertSucceeds;
const ko = assertFails;

before(async () => {
  const [host, port] = FS_HOSTPORT.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-tfg-vr',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });

const gafaDb = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const clinDb = (uid, { verified = true, provider = 'password' } = {}) =>
  env.authenticatedContext(uid, { email: `${uid}@example.invalid`, email_verified: verified, firebase: { sign_in_provider: provider } }).firestore();
const noAuthDb = () => env.unauthenticatedContext().firestore();
const c1 = () => clinDb('clin-1');
const c2 = () => clinDb('clin-2');
const adm = () => clinDb('admin-1');
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    for (const [uid, rol] of [['clin-1', 'fisioterapeuta'], ['clin-2', 'fisioterapeuta'], ['admin-1', 'admin'],
                              ['clin-sinverif', 'fisioterapeuta'], ['gafa-a', 'admin']]) {
      await setDoc(doc(db, `usuarios/${uid}`), { rol, creadoEn: Timestamp.now() });
    }
    for (const id of ['pac-1', 'pac-2', 'pac-3']) await setDoc(doc(db, `pacientes/${id}`), paciente());
  });
});

// ------------------------------------------------------------------ datos
const paciente = (over = {}) => ({
  name: 'Paciente Sintetico', initials: 'PS', age: 67, affectedSide: 'Izquierdo', lastSession: '22 jun 2026',
  progress: 10, diagnosis: 'ictus-sintetico', sessions: 3, status: 'activo', colorIdx: 1, notes: '', ...over,
});
const pidDe = (n) => `pid${String(n).padStart(19, 'x')}`;                  // 22 caracteres válidos
const aliasDe = (n) => `P-${String(n).padStart(3, '0')}`;
const identidad = (n, over = {}) => ({ alias: aliasDe(n), aliasNum: n, pid: pidDe(n), ...over });
const pRef = (db, id) => doc(db, `pacientes/${id}`);
const cRef = (db) => doc(db, 'config/aliasPacientes');
const seedContador = (ultimo, ultimoPacienteId = 'pac-x') => seed((db) => setDoc(cRef(db), {
  ultimo, ultimoPacienteId, actualizadoEn: Timestamp.now(),
}));
const seedAsignado = (id, n) => seed((db) => setDoc(pRef(db, id), paciente(identidad(n))));

/** Asignación completa en un batch (equivalente a la transacción de patientIdentity.ts para las reglas). */
function asigna(db, id, n, pOver = {}, cOver = {}) {
  const b = writeBatch(db);
  b.update(pRef(db, id), { ...identidad(n), updatedAt: serverTimestamp(), ...pOver });
  b.set(cRef(db), { ultimo: n, ultimoPacienteId: id, actualizadoEn: serverTimestamp(), ...cOver });
  return b.commit();
}
const contador = async () => (await seed_get('config/aliasPacientes'));
async function seed_get(path) {
  let out;
  await seed(async (db) => { const s = await getDoc(doc(db, path)); out = s.exists() ? s.data() : null; });
  return out;
}

// ======================================================================== asignación válida
describe('asignación válida', () => {
  it('primera asignación: el contador nace con ultimo=1 junto con el paciente', async () => {
    await ok(asigna(c1(), 'pac-1', 1));
    const c = await contador();
    assert.equal(c.ultimo, 1);
    assert.equal(c.ultimoPacienteId, 'pac-1');
    const p = await seed_get('pacientes/pac-1');
    assert.deepEqual([p.alias, p.aliasNum, p.pid], ['P-001', 1, pidDe(1)]);
  });
  it('asignaciones consecutivas N -> N+1 con relleno a 3 dígitos y más allá de 999', async () => {
    await ok(asigna(c1(), 'pac-1', 1));
    await ok(asigna(c2(), 'pac-2', 2));
    await seedContador(98, 'pac-x');
    await ok(asigna(c1(), 'pac-3', 99));
    await seedContador(99, 'pac-x');
    await seed((db) => setDoc(pRef(db, 'pac-4'), paciente()));
    await ok(asigna(c1(), 'pac-4', 100));
    await seedContador(999, 'pac-x');
    await seed((db) => setDoc(pRef(db, 'pac-5'), paciente()));
    await ok(asigna(c1(), 'pac-5', 1000));
    assert.equal((await seed_get('pacientes/pac-5')).alias, 'P-1000');
  });
  it('un admin también asigna; una transacción real del SDK (get + set + update) es válida', async () => {
    await ok(asigna(adm(), 'pac-1', 1));
    const db = c2();
    await ok(runTransaction(db, async (tx) => {
      const c = await tx.get(cRef(db));
      const n = c.data().ultimo + 1;
      await tx.get(pRef(db, 'pac-2'));
      tx.set(cRef(db), { ultimo: n, ultimoPacienteId: 'pac-2', actualizadoEn: serverTimestamp() });
      tx.update(pRef(db, 'pac-2'), { ...identidad(n), updatedAt: serverTimestamp() });
    }));
    assert.equal((await seed_get('pacientes/pac-2')).alias, 'P-002');
  });
  it('un paciente LEGADO con alias de texto libre y sin pid/aliasNum puede recibir su identidad', async () => {
    await seed((db) => setDoc(pRef(db, 'pac-1'), paciente({ alias: 'Paciente 1' })));
    await ok(updateDoc(pRef(c1(), 'pac-1'), { notes: 'sin tocar alias', updatedAt: serverTimestamp() }));
    await ko(updateDoc(pRef(c1(), 'pac-1'), { alias: 'Otro texto' }));
    await ko(updateDoc(pRef(c1(), 'pac-1'), { alias: 'P-001' })); // sin contador
    await ok(asigna(c1(), 'pac-1', 1));
    assert.equal((await seed_get('pacientes/pac-1')).alias, 'P-001');
  });
});

// ======================================================================== contador manipulado
describe('contador: manipulación denegada', () => {
  it('saltar número (contador 5, asignar 7)', async () => {
    await seedContador(5);
    await ko(asigna(c1(), 'pac-1', 7));
    await ko(asigna(c1(), 'pac-1', 6, {}, { ultimo: 7 }));
  });
  it('retroceder o repetir (contador 5 -> 4 / 5)', async () => {
    await seedContador(5);
    await seedAsignado('pac-2', 5);
    await ko(asigna(c1(), 'pac-1', 4));
    await ko(asigna(c1(), 'pac-1', 5));
    await ko(asigna(c1(), 'pac-1', 5, {}, { ultimo: 4 }));
  });
  it('primer paciente con número distinto de 1 y contador inexistente', async () => {
    await ko(asigna(c1(), 'pac-1', 2));
    await ko(asigna(c1(), 'pac-1', 0));
  });
  it('incrementar sin asignar paciente (quemar números), +1 o +2, con y sin paciente', async () => {
    await seedContador(5, 'pac-x');
    const d = c1();
    await ko(setDoc(cRef(d), { ultimo: 6, ultimoPacienteId: 'pac-1', actualizadoEn: serverTimestamp() }));
    await ko(setDoc(cRef(d), { ultimo: 7, ultimoPacienteId: 'pac-1', actualizadoEn: serverTimestamp() }));
    await ko(updateDoc(cRef(d), { ultimo: 6 }));
    await ko(updateDoc(cRef(d), { ultimo: 6, actualizadoEn: serverTimestamp() }));
    assert.equal((await contador()).ultimo, 5);
  });
  it('contador +2 con paciente coherente con +2, y paciente coherente con +1 con contador +2', async () => {
    await seedContador(5);
    await ko(asigna(c1(), 'pac-1', 7));
    await ko(asigna(c1(), 'pac-1', 6, {}, { ultimo: 7 }));
    await ko(asigna(c1(), 'pac-1', 7, {}, { ultimo: 6 }));
  });
  it('alias distinto del contador / de aliasNum', async () => {
    await seedContador(5);
    await ko(asigna(c1(), 'pac-1', 6, { alias: 'P-007' }));
    await ko(asigna(c1(), 'pac-1', 6, { alias: 'P-6' }));
    await ko(asigna(c1(), 'pac-1', 6, { alias: 'P-0006' }));
    await ko(asigna(c1(), 'pac-1', 6, { alias: 'p-006' }));
    await ko(asigna(c1(), 'pac-1', 6, { aliasNum: 7 }));
    await ko(asigna(c1(), 'pac-1', 6, { aliasNum: '6' }));
    await ko(asigna(c1(), 'pac-1', 6, { aliasNum: 6.0001 }));
    await ok(asigna(c1(), 'pac-1', 6));
  });
  it('ultimoPacienteId ajeno, inexistente o ya con identidad', async () => {
    await seedContador(5);
    await seedAsignado('pac-3', 3);
    await ko(asigna(c1(), 'pac-1', 6, {}, { ultimoPacienteId: 'pac-2' }));
    await ko(asigna(c1(), 'pac-1', 6, {}, { ultimoPacienteId: 'no-existe' }));
    await ko(asigna(c1(), 'pac-1', 6, {}, { ultimoPacienteId: 'pac-3' }));
    await ko(asigna(c1(), 'pac-1', 6, {}, { ultimoPacienteId: 'a/b' }));
    await ko(asigna(c1(), 'pac-1', 6, {}, { ultimoPacienteId: 7 }));
  });
  it('mismo contador para dos pacientes en el mismo commit', async () => {
    await seedContador(5);
    const d = c1();
    const b = writeBatch(d);
    b.update(pRef(d, 'pac-1'), { ...identidad(6), updatedAt: serverTimestamp() });
    b.update(pRef(d, 'pac-2'), { ...identidad(6, { pid: pidDe(66) }), updatedAt: serverTimestamp() });
    b.set(cRef(d), { ultimo: 6, ultimoPacienteId: 'pac-1', actualizadoEn: serverTimestamp() });
    await ko(b.commit());
  });
  it('asignar alias a OTRO paciente con el mismo contador ya consumido (en commits distintos)', async () => {
    await seedContador(5);
    await ok(asigna(c1(), 'pac-1', 6));
    // pac-2 intenta quedarse con el 6 reutilizando el contador, o con el 7 sin avanzarlo
    await ko(asigna(c2(), 'pac-2', 6));
    const d = c2();
    await ko(updateDoc(pRef(d, 'pac-2'), { ...identidad(7), updatedAt: serverTimestamp() }));
    await ko(updateDoc(pRef(d, 'pac-2'), { ...identidad(6, { pid: pidDe(99) }), updatedAt: serverTimestamp() }));
    assert.equal((await contador()).ultimo, 6);
  });
  it('asignación al paciente SIN tocar el contador, y contador sin tocar el paciente', async () => {
    await ko(updateDoc(pRef(c1(), 'pac-1'), { ...identidad(1), updatedAt: serverTimestamp() }));
    await seedContador(1, 'pac-x');
    await ko(updateDoc(pRef(c1(), 'pac-1'), { ...identidad(2), updatedAt: serverTimestamp() }));
  });
  it('forma del contador: campos extra/faltantes, tipos, actualizadoEn arbitrario, fuera de rango', async () => {
    await seedContador(5);
    await ko(asigna(c1(), 'pac-1', 6, {}, { extra: 1 }));
    await ko(asigna(c1(), 'pac-1', 6, {}, { actualizadoEn: Timestamp.fromMillis(1) }));
    await ko(asigna(c1(), 'pac-1', 6, {}, { actualizadoEn: 'ayer' }));
    const d = c1();
    const b = writeBatch(d);
    b.update(pRef(d, 'pac-1'), { ...identidad(6), updatedAt: serverTimestamp() });
    b.set(cRef(d), { ultimo: 6, actualizadoEn: serverTimestamp() }); // falta ultimoPacienteId
    await ko(b.commit());
    await seedContador(999999, 'pac-x');
    await ko(asigna(c1(), 'pac-1', 1000000));
  });
  it('el contador no se borra ni se lista; get solo clínico', async () => {
    await seedContador(5);
    await ko(deleteDoc(cRef(c1())));
    await ko(deleteDoc(cRef(adm())));
    await ko(getDocs(collection(c1(), 'config')));
    await ok(getDoc(cRef(c1())));
    await ok(getDoc(cRef(adm())));
    assert.equal((await contador()).ultimo, 5);
  });
  it('otros documentos bajo config/ siguen denegados', async () => {
    await ko(setDoc(doc(c1(), 'config/otro'), { x: 1 }));
    await ko(getDoc(doc(c1(), 'config/otro')));
  });
  it('atomicidad: si el paciente es inválido el batch falla y el contador no avanza', async () => {
    await seedContador(5);
    await ko(asigna(c1(), 'pac-1', 6, { extra: 'no permitido' }));
    await ko(asigna(c1(), 'pac-1', 6, { pid: 'corto' }));
    assert.equal((await contador()).ultimo, 5);
    assert.equal((await seed_get('pacientes/pac-1')).aliasNum, undefined);
  });
});

// ======================================================================== inmutabilidad
describe('inmutabilidad de pid, alias y aliasNum', () => {
  beforeEach(async () => {
    await seedContador(3, 'pac-1');
    await seedAsignado('pac-1', 3);
  });
  it('no se puede cambiar, quitar ni reasignar ninguno de los tres (solos o combinados)', async () => {
    const d = () => pRef(c1(), 'pac-1');
    await ko(updateDoc(d(), { pid: pidDe(50) }));
    await ko(updateDoc(d(), { alias: 'P-004' }));
    await ko(updateDoc(d(), { aliasNum: 4 }));
    await ko(updateDoc(d(), identidad(4)));
    await ko(updateDoc(d(), { pid: deleteField() }));
    await ko(updateDoc(d(), { alias: deleteField() }));
    await ko(updateDoc(d(), { aliasNum: deleteField() }));
    await ko(updateDoc(d(), { pid: deleteField(), alias: deleteField(), aliasNum: deleteField() }));
  });
  it('ni siquiera con un incremento válido del contador se reasigna a quien ya tiene identidad', async () => {
    await ko(asigna(c1(), 'pac-1', 4));
    await ko(asigna(adm(), 'pac-1', 4, { pid: pidDe(3) }));
    assert.equal((await contador()).ultimo, 3);
  });
  it('el mismo valor sí pasa (edición de otros campos reenviando la identidad); editar notas funciona', async () => {
    await ok(updateDoc(pRef(c1(), 'pac-1'), { ...identidad(3), notes: 'nota', updatedAt: serverTimestamp() }));
    await ok(updateDoc(pRef(c1(), 'pac-1'), { notes: 'otra', progress: 50 }));
    const p = await seed_get('pacientes/pac-1');
    assert.deepEqual([p.alias, p.aliasNum, p.pid, p.notes], ['P-003', 3, pidDe(3), 'otra']);
  });
  it('setDoc (reemplazo completo) sin identidad o con otra: denegado', async () => {
    await ko(setDoc(pRef(c1(), 'pac-1'), paciente({ createdAt: Timestamp.now() })));
    await ko(setDoc(pRef(c1(), 'pac-1'), paciente(identidad(9))));
  });
  it('borrar y recrear NO reutiliza alias ni pid: el recreado nace sin identidad y recibe el siguiente número', async () => {
    await ok(deleteDoc(pRef(c1(), 'pac-1')));
    await ko(setDoc(pRef(c1(), 'pac-1'), { ...paciente(identidad(3)), createdAt: serverTimestamp() }));
    await ok(setDoc(pRef(c1(), 'pac-1'), { ...paciente(), createdAt: serverTimestamp() }));
    assert.equal((await seed_get('pacientes/pac-1')).alias, undefined);
    await ko(asigna(c1(), 'pac-1', 3));
    await ok(asigna(c1(), 'pac-1', 4));
    assert.equal((await seed_get('pacientes/pac-1')).alias, 'P-004');
    assert.equal((await contador()).ultimo, 4);
  });
});

// ======================================================================== creación y formato
describe('creación de pacientes y formato de pid/alias', () => {
  const nuevo = (over = {}) => ({ ...paciente(over), createdAt: serverTimestamp() });
  it('crear SIN identidad: ok', async () => {
    await ok(setDoc(pRef(c1(), 'nuevo-1'), nuevo()));
  });
  it('crear con alias, pid o aliasNum (arbitrarios o "válidos"): denegado', async () => {
    let i = 0;
    const d = (v) => setDoc(pRef(c1(), `nuevo-${i++}`), nuevo(v));
    await ko(d({ alias: 'P-001' }));
    await ko(d({ alias: 'Paciente 1' }));
    await ko(d({ pid: pidDe(1) }));
    await ko(d({ aliasNum: 1 }));
    await ko(d(identidad(1)));
    await ko(d(identidad(7)));
    // incluso con el contador avanzando a la vez (la identidad nunca nace en el create)
    const db = c1();
    const b = writeBatch(db);
    b.set(pRef(db, 'nuevo-x'), nuevo(identidad(1)));
    b.set(cRef(db), { ultimo: 1, ultimoPacienteId: 'nuevo-x', actualizadoEn: serverTimestamp() });
    await ko(b.commit());
    assert.equal(await contador(), null);
  });
  it('formato de pid: 21 o 23 caracteres, símbolos, tipo, vacío', async () => {
    await seedContador(0 + 5);
    for (const pid of ['x'.repeat(21), 'x'.repeat(23), 'x'.repeat(21) + '+', 'x'.repeat(21) + '/', 'x'.repeat(21) + '=',
                       'x'.repeat(21) + ' ', '', 12345678901234567890123]) {
      await ko(asigna(c1(), 'pac-1', 6, { pid }));
    }
    await ok(asigna(c1(), 'pac-1', 6, { pid: 'Ab0_-'.repeat(4) + 'Ab' }));
  });
  it('un paciente con pid pero sin alias/aliasNum (identidad a medias) no se acepta', async () => {
    await seedContador(5);
    const d = c1();
    const b = writeBatch(d);
    b.update(pRef(d, 'pac-1'), { pid: pidDe(6), updatedAt: serverTimestamp() });
    b.set(cRef(d), { ultimo: 6, ultimoPacienteId: 'pac-1', actualizadoEn: serverTimestamp() });
    await ko(b.commit());
  });
});

// ======================================================================== roles
describe('roles y actores', () => {
  const quiereAsignar = [
    ['sin token', () => noAuthDb()],
    ['anónimo (gafa) con doc usuarios plantado', () => gafaDb('gafa-a')],
    ['anónimo sin doc', () => gafaDb('gafa-z')],
    ['clínico sin verificar correo', () => clinDb('clin-sinverif', { verified: false })],
    ['autenticado sin rol', () => clinDb('sin-rol')],
  ];
  for (const [nombre, f] of quiereAsignar) {
    it(`denegado: ${nombre}`, async () => {
      await ko(asigna(f(), 'pac-1', 1));
      await ko(getDoc(cRef(f())));
      await ko(setDoc(cRef(f()), { ultimo: 1, ultimoPacienteId: 'pac-1', actualizadoEn: serverTimestamp() }));
      await ko(getDoc(pRef(f(), 'pac-1')));
      assert.equal(await contador(), null);
    });
  }
  it('la Quest VINCULADA o REVOCADA no lee pacientes ni el contador y no asigna', async () => {
    await seedContador(5);
    for (const estado of ['vinculado', 'revocado']) {
      await seed((db) => setDoc(doc(db, 'dispositivos/gafa-q'), {
        estado, ownerUid: 'clin-1', codigoActual: 'ABCDEFGH', creadoEn: Timestamp.now(), vinculadoEn: Timestamp.now(),
      }));
      const g = gafaDb('gafa-q');
      await ko(getDoc(cRef(g)));
      await ko(getDoc(pRef(g, 'pac-1')));
      await ko(getDocs(collection(g, 'pacientes')));
      await ko(asigna(g, 'pac-1', 6));
      await ko(updateDoc(pRef(g, 'pac-1'), { notes: 'x' }));
    }
    assert.equal((await contador()).ultimo, 5);
  });
  it('un proveedor anónimo con email_verified y doc de rol sigue sin ser clínico', async () => {
    await ko(asigna(clinDb('gafa-a', { provider: 'anonymous' }), 'pac-1', 1));
  });
});
