// PR5c-3a - Pruebas PURAS de app/patientIdentity.ts (sin emulador): pid, alias, resolución pid -> paciente,
// reescritura de sesiones y contrato de privacidad hacia la Quest. Datos SINTÉTICOS.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const I = await import(pathToFileURL(join(root, 'app', 'patientIdentity.ts')).href);
const D = await import(pathToFileURL(join(root, 'app', 'devices.ts')).href);

const RE_B64URL_22 = /^[A-Za-z0-9_-]{22}$/;

describe('generarPid', () => {
  it('22 caracteres base64url con la fuente por defecto (WebCrypto)', () => {
    for (let i = 0; i < 200; i++) assert.match(I.generarPid(), RE_B64URL_22);
    assert.equal(I.PID_LONGITUD, 22);
    assert.equal(I.PID_BYTES * 8, 128);
  });
  it('distinto entre llamadas (5000 muestras sin colisión)', () => {
    const s = new Set();
    for (let i = 0; i < 5000; i++) s.add(I.generarPid());
    assert.equal(s.size, 5000);
  });
  it('RNG inyectado: codificación determinista idéntica a Buffer base64url', () => {
    const casos = [new Uint8Array(16), new Uint8Array(16).fill(255), Uint8Array.from({ length: 16 }, (_, i) => i),
                   Uint8Array.from({ length: 16 }, (_, i) => 255 - i * 7)];
    for (const bytes of casos) {
      const pid = I.generarPid((n) => { assert.equal(n, 16); return bytes; });
      assert.equal(pid, Buffer.from(bytes).toString('base64url'));
      assert.match(pid, RE_B64URL_22);
    }
    assert.equal(I.generarPid(() => new Uint8Array(16)), 'AAAAAAAAAAAAAAAAAAAAAA');
  });
  it('rechaza una fuente que devuelve un nº de bytes distinto de 16 o un tipo erróneo', () => {
    assert.throws(() => I.generarPid(() => new Uint8Array(15)), RangeError);
    assert.throws(() => I.generarPid(() => new Uint8Array(17)), RangeError);
    assert.throws(() => I.generarPid(() => [1, 2, 3]), RangeError);
  });
  it('no usa Math.random (se sustituye por una función que falla)', () => {
    const orig = Math.random;
    Math.random = () => { throw new Error('Math.random prohibido para el pid'); };
    try { assert.match(I.generarPid(), RE_B64URL_22); } finally { Math.random = orig; }
  });
  it('sin WebCrypto no genera nada (no hay respaldo inseguro)', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try { assert.throws(() => I.generarPid(), /WebCrypto/); }
    finally { Object.defineProperty(globalThis, 'crypto', desc); }
  });
  it('no depende del alias ni del id: la función no recibe parámetros y el pid no los contiene', () => {
    assert.equal(I.generarPid.length, 0); // solo un parámetro OPCIONAL (la fuente de bytes): nada recibe alias ni id
    for (let i = 0; i < 3000; i++) {
      const pid = I.generarPid();
      assert.ok(!pid.includes('P-001') && !pid.includes('P-007'), pid); // sin relación con un alias concreto
      assert.ok(!pid.includes('paciente'));
    }
  });
  it('pidValido: solo 22 caracteres del alfabeto', () => {
    assert.ok(I.pidValido('A'.repeat(22)));
    for (const v of ['A'.repeat(21), 'A'.repeat(23), 'A'.repeat(21) + '+', 'A'.repeat(21) + '=', '', null, undefined, 5, {}]) {
      assert.equal(I.pidValido(v), false);
    }
  });
});

describe('formato de alias', () => {
  it('P-001 ... P-999, P-1000 ... P-999999, y coincide con devices.formatearAliasPaciente', () => {
    assert.equal(I.aliasDeNumero(1), 'P-001');
    assert.equal(I.aliasDeNumero(9), 'P-009');
    assert.equal(I.aliasDeNumero(10), 'P-010');
    assert.equal(I.aliasDeNumero(99), 'P-099');
    assert.equal(I.aliasDeNumero(100), 'P-100');
    assert.equal(I.aliasDeNumero(999), 'P-999');
    assert.equal(I.aliasDeNumero(1000), 'P-1000');
    assert.equal(I.aliasDeNumero(999999), 'P-999999');
    for (const n of [1, 2, 9, 10, 11, 99, 100, 101, 999, 1000, 54321, 999999]) assert.equal(I.aliasDeNumero(n), D.formatearAliasPaciente(n));
  });
  it('fuera de rango o no entero: error', () => {
    for (const n of [0, -1, 1.5, 1000000, NaN, Infinity]) assert.throws(() => I.aliasDeNumero(n), RangeError);
  });
  it('numeroDeAlias / aliasValido: solo la forma canónica', () => {
    assert.equal(I.numeroDeAlias('P-001'), 1);
    assert.equal(I.numeroDeAlias('P-1000'), 1000);
    for (const a of ['P-1', 'P-01', 'P-0001', 'P-000', 'p-001', 'P-001 ', ' P-001', 'P-1000000', 'P-12a', 'Paciente 1', '', null, 5]) {
      assert.equal(I.numeroDeAlias(a), null, String(a));
      assert.equal(I.aliasValido(a), false);
    }
  });
});

const P = (id, pid, extra = {}) => ({ id, name: `NOMBRE-SINTETICO-${id}`, pid, alias: pid ? 'P-001' : undefined, ...extra });
const PID1 = 'a'.repeat(22);
const PID2 = 'b'.repeat(22);

describe('resolución pid -> paciente (en memoria)', () => {
  const lista = [P('doc1', PID1), P('doc2', PID2), P('legado', undefined), P('malo', 'corto')];
  it('resuelve por pid y devuelve el paciente (misma referencia)', () => {
    assert.equal(I.resolverPacientePorPid(lista, PID1), lista[0]);
    assert.equal(I.resolverPacientePorPid(lista, PID2), lista[1]);
  });
  it('null si no existe, está mal formado o es nulo; los pacientes sin pid o con pid mal formado no se indexan', () => {
    assert.equal(I.resolverPacientePorPid(lista, 'c'.repeat(22)), null);
    assert.equal(I.resolverPacientePorPid(lista, 'corto'), null);
    assert.equal(I.resolverPacientePorPid(lista, undefined), null);
    assert.equal(I.resolverPacientePorPid(lista, 'doc1'), null, 'un id de Firestore NO es un pid');
    assert.equal(I.resolverPacientePorPid([], PID1), null);
    const m = I.construirMapaPidAPaciente(lista);
    assert.deepEqual([...m.keys()].sort(), [PID1, PID2]);
  });
  it('acepta cualquier iterable y no consulta nada más', () => {
    assert.equal(I.resolverPacientePorPid(new Set(lista), PID2).id, 'doc2');
  });
});

describe('reescribirPatientId', () => {
  const lista = [P('doc1', PID1), P('doc2', PID2)];
  const mapa = I.construirMapaPidAPaciente(lista);
  it('sesión nueva (patientId = pid): copia con patientId = id de Firestore y pid original conservado; no muta', () => {
    const s = Object.freeze({ id: 's1', patientId: PID1, score: 5 });
    const r = I.reescribirPatientId(s, mapa);
    assert.notEqual(r, s);
    assert.deepEqual(r, { id: 's1', patientId: 'doc1', score: 5, patientIdPid: PID1 });
    assert.equal(s.patientId, PID1);
  });
  it('sesión ANTIGUA con patientId = id de Firestore: intacta (misma referencia, sin migrar)', () => {
    const s = { id: 's2', patientId: 'doc1', patientName: 'Antiguo' };
    const copia = structuredClone(s);
    const r = I.reescribirPatientId(s, mapa);
    assert.equal(r, s);
    assert.deepEqual(s, copia);
  });
  it('sin patientId, con patientId no string o pid desconocido (paciente borrado): intacta', () => {
    for (const s of [{ id: 'a' }, { id: 'b', patientId: null }, { id: 'c', patientId: 42 }, { id: 'd', patientId: 'z'.repeat(22) }]) {
      assert.equal(I.reescribirPatientId(s, mapa), s);
    }
  });
  it('mapa vacío: todo intacto; el mapa no se modifica', () => {
    const s = { patientId: PID1 };
    assert.equal(I.reescribirPatientId(s, new Map()), s);
    assert.equal(mapa.size, 2);
  });
  it('mezcla: nuevas y antiguas conviven en un mismo listado', () => {
    const out = [{ patientId: PID2 }, { patientId: 'doc2' }, {}].map((s) => I.reescribirPatientId(s, mapa));
    assert.deepEqual(out.map((s) => s.patientId), ['doc2', 'doc2', undefined]);
  });
});

describe('contrato de privacidad hacia la Quest', () => {
  const paciente = {
    id: 'AbCdEfGhIjKlMnOpQrSt', name: 'NOMBRE APELLIDO-SINTETICO', initials: 'NA', dni: '00000000T-SINTETICO',
    email: 'paciente.sintetico@example.test', age: 70, diagnosis: 'dato sintético', notes: 'nota privada',
    pid: PID1, alias: 'P-007', aliasNum: 7,
  };
  it('devuelve SOLO patientId (= pid) y patientAlias (= alias)', () => {
    const r = I.identificadorParaQuest(paciente);
    assert.deepEqual(r, { patientId: PID1, patientAlias: 'P-007' });
    assert.deepEqual(Object.keys(r).sort(), ['patientAlias', 'patientId']);
  });
  it('nunca contiene nombre, DNI, correo, iniciales, notas ni el id de Firestore', () => {
    const txt = JSON.stringify(I.identificadorParaQuest(paciente));
    for (const prohibido of [paciente.name, 'NOMBRE', 'APELLIDO', paciente.dni, '00000000T', paciente.email, '@example',
                             paciente.id, 'AbCdEf', paciente.notes, 'nota privada', paciente.diagnosis]) {
      assert.ok(!txt.includes(prohibido), `contiene ${prohibido}`);
    }
    assert.notEqual(I.identificadorParaQuest(paciente).patientId, paciente.id);
  });
  it('un campo extra en el paciente nunca se cuela (lista blanca)', () => {
    const r = I.identificadorParaQuest({ ...paciente, extra: 'secreto', patientName: 'X' });
    assert.ok(!JSON.stringify(r).includes('secreto'));
    assert.equal(Object.keys(r).length, 2);
  });
  it('sin identidad o con valores inválidos: error tipado sin_identidad (no se improvisa con el id)', () => {
    for (const p of [{ id: 'x' }, { id: 'x', pid: PID1 }, { id: 'x', alias: 'P-001' }, { id: 'x', pid: 'corto', alias: 'P-001' },
                     { id: 'x', pid: PID1, alias: 'Paciente 1' }, null, undefined]) {
      assert.throws(() => I.identificadorParaQuest(p), (e) => e instanceof I.ErrorIdentidad && e.codigo === 'sin_identidad');
    }
  });
});
