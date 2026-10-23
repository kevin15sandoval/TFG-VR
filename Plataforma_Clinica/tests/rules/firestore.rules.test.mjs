// F0 - Caracterización de las reglas VERSIONADAS actuales (firestore.rules).
// Todos los tests PASAN describiendo el comportamiento de HOY.
// Etiquetas:
//   [ESPERADO]  comportamiento deseable que ya se cumple.
//   [HALLAZGO]  comportamiento indeseado actual; en fases posteriores la
//               aserción deberá invertirse (assertFails <-> assertSucceeds).
// Solo datos sintéticos. Proyecto ficticio, emulador local (sin producción).
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(here, '..', '..', 'firestore.rules');
const PROJECT_ID = 'demo-tfg-vr';

let env;

before(async () => {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [host, port] = hostPort.split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host, port: Number(port) },
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'pacientes/p1'), { nombre: 'Paciente Sintetico', diagnostico: 'ictus-sintetico' });
    await setDoc(doc(db, 'sesiones/s1'), { patientId: 'p1', juego: 'gemas', puntuacion: 10, status: 'completada' });
    await setDoc(doc(db, 'sesion_activa/current'), { patientId: 'p1', patientName: 'Paciente Sintetico', juego: 'gemas' });
    await setDoc(doc(db, 'dispositivos/ABC123'), { estado: 'libre', vinculado: false });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
// Token genérico: cualquier usuario autenticado, sin claims de rol.
const auth = () => env.authenticatedContext('usuario-sintetico', { email: 'x@example.invalid' }).firestore();
// Proveedor 'anonymous' (Firebase Anonymous Auth): para las reglas equivale a un clínico.
const authAnonProvider = () =>
  env.authenticatedContext('anon-sintetico', { firebase: { sign_in_provider: 'anonymous' } }).firestore();

describe('pacientes (regla: read, write si request.auth != null)', () => {
  it('[ESPERADO] no autenticado NO puede leer un paciente', async () => {
    await assertFails(getDoc(doc(anon(), 'pacientes/p1')));
  });
  it('[ESPERADO] no autenticado NO puede listar pacientes', async () => {
    await assertFails(getDocs(collection(anon(), 'pacientes')));
  });
  it('[ESPERADO] no autenticado NO puede crear/actualizar/borrar pacientes', async () => {
    await assertFails(setDoc(doc(anon(), 'pacientes/p2'), { nombre: 'X' }));
    await assertFails(updateDoc(doc(anon(), 'pacientes/p1'), { nombre: 'X' }));
    await assertFails(deleteDoc(doc(anon(), 'pacientes/p1')));
  });
  it('[HALLAZGO] cualquier autenticado lee TODOS los pacientes (sin rol ni vínculo clínico-paciente)', async () => {
    await assertSucceeds(getDoc(doc(auth(), 'pacientes/p1')));
    await assertSucceeds(getDocs(collection(auth(), 'pacientes')));
  });
  it('[HALLAZGO] cualquier autenticado crea, modifica y borra pacientes (sin validación de esquema)', async () => {
    await assertSucceeds(setDoc(doc(auth(), 'pacientes/p2'), { cualquierCosa: true }));
    await assertSucceeds(updateDoc(doc(auth(), 'pacientes/p1'), { nombre: 'Alterado' }));
    await assertSucceeds(deleteDoc(doc(auth(), 'pacientes/p1')));
  });
  it('[HALLAZGO] un usuario con proveedor "anonymous" cuenta como autenticado y accede a pacientes', async () => {
    await assertSucceeds(getDoc(doc(authAnonProvider(), 'pacientes/p1')));
  });
});

describe('sesiones (regla: read si auth; write si true)', () => {
  it('[ESPERADO] no autenticado NO puede leer sesiones (get ni list)', async () => {
    await assertFails(getDoc(doc(anon(), 'sesiones/s1')));
    await assertFails(getDocs(collection(anon(), 'sesiones')));
  });
  it('[ESPERADO] autenticado puede leer sesiones', async () => {
    await assertSucceeds(getDoc(doc(auth(), 'sesiones/s1')));
    await assertSucceeds(getDocs(collection(auth(), 'sesiones')));
  });
  it('[ESPERADO, necesario para Godot] no autenticado puede crear sesiones', async () => {
    await assertSucceeds(addDoc(collection(anon(), 'sesiones'), { patientId: 'p1', juego: 'gemas' }));
  });
  it('[HALLAZGO] no autenticado puede crear sesiones con cualquier contenido/patientId (sin validación)', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'sesiones/falsa'), { patientId: 'inexistente', basura: 'x'.repeat(1000) }));
  });
  it('[HALLAZGO] no autenticado puede MODIFICAR sesiones existentes', async () => {
    await assertSucceeds(updateDoc(doc(anon(), 'sesiones/s1'), { puntuacion: 9999 }));
  });
  it('[HALLAZGO] no autenticado puede BORRAR sesiones', async () => {
    await assertSucceeds(deleteDoc(doc(anon(), 'sesiones/s1')));
  });
  it('[HALLAZGO] autenticado puede modificar y borrar sesiones (sin distinción de rol)', async () => {
    await assertSucceeds(updateDoc(doc(auth(), 'sesiones/s1'), { puntuacion: 1 }));
    await assertSucceeds(deleteDoc(doc(auth(), 'sesiones/s1')));
  });
});

describe('sesion_activa (regla: read si true; write si auth)', () => {
  it('[HALLAZGO] no autenticado LEE sesion_activa/current con patientName (dato personal)', async () => {
    const snap = await assertSucceeds(getDoc(doc(anon(), 'sesion_activa/current')));
    assert.equal(snap.data().patientName, 'Paciente Sintetico');
  });
  it('[HALLAZGO] no autenticado puede LISTAR toda la colección sesion_activa', async () => {
    await assertSucceeds(getDocs(collection(anon(), 'sesion_activa')));
  });
  it('[ESPERADO] no autenticado NO puede crear/actualizar/borrar sesion_activa', async () => {
    await assertFails(setDoc(doc(anon(), 'sesion_activa/otro'), { x: 1 }));
    await assertFails(updateDoc(doc(anon(), 'sesion_activa/current'), { juego: 'x' }));
    await assertFails(deleteDoc(doc(anon(), 'sesion_activa/current')));
  });
  it('[HALLAZGO] cualquier autenticado puede escribir/borrar sesion_activa de cualquier paciente', async () => {
    await assertSucceeds(updateDoc(doc(auth(), 'sesion_activa/current'), { patientName: 'Otro' }));
    await assertSucceeds(setDoc(doc(auth(), 'sesion_activa/otro'), { patientId: 'pX' }));
    await assertSucceeds(deleteDoc(doc(auth(), 'sesion_activa/current')));
  });
});

describe('dispositivos (regla: read true; create auth; update true; delete auth)', () => {
  it('[HALLAZGO] no autenticado puede LEER y LISTAR dispositivos (enumeración de códigos de vinculación)', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'dispositivos/ABC123')));
    await assertSucceeds(getDocs(collection(anon(), 'dispositivos')));
  });
  it('[ESPERADO] no autenticado NO puede crear ni borrar dispositivos', async () => {
    await assertFails(setDoc(doc(anon(), 'dispositivos/NUEVO1'), { estado: 'libre' }));
    await assertFails(deleteDoc(doc(anon(), 'dispositivos/ABC123')));
  });
  it('[ESPERADO, necesario para Godot] no autenticado puede actualizar un dispositivo (vinculación)', async () => {
    await assertSucceeds(updateDoc(doc(anon(), 'dispositivos/ABC123'), { vinculado: true, estado: 'conectado' }));
  });
  it('[HALLAZGO] no autenticado puede alterar CUALQUIER campo de un dispositivo (secuestro de vínculo, sin validar campos)', async () => {
    await assertSucceeds(updateDoc(doc(anon(), 'dispositivos/ABC123'), { patientId: 'p-ajeno', owner: 'atacante' }));
  });
  it('[ESPERADO] autenticado puede crear y borrar dispositivos', async () => {
    await assertSucceeds(setDoc(doc(auth(), 'dispositivos/NUEVO1'), { estado: 'libre' }));
    await assertSucceeds(deleteDoc(doc(auth(), 'dispositivos/ABC123')));
  });
  it('[ESPERADO] autenticado puede actualizar dispositivos', async () => {
    await assertSucceeds(updateDoc(doc(auth(), 'dispositivos/ABC123'), { estado: 'x' }));
  });
});

describe('colecciones no contempladas', () => {
  it('[ESPERADO] denegación por defecto: ni anónimo ni autenticado acceden a colecciones sin regla', async () => {
    await assertFails(getDoc(doc(anon(), 'otra/x')));
    await assertFails(setDoc(doc(auth(), 'otra/x'), { a: 1 }));
  });
});

describe('Contrato Godot/Quest sin token (firebase_manager.gd, device_link.gd)', () => {
  it('GET sesion_activa/current permitido', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'sesion_activa/current')));
  });
  it('POST (create, id automático) en sesiones permitido', async () => {
    await assertSucceeds(addDoc(collection(anon(), 'sesiones'), { patientId: 'p1', juego: 'gemas', puntuacion: 5 }));
  });
  it('PATCH (update) de sesion_activa DENEGADO', async () => {
    await assertFails(updateDoc(doc(anon(), 'sesion_activa/current'), { estado: 'fin' }));
  });
  it('DELETE de sesion_activa DENEGADO', async () => {
    await assertFails(deleteDoc(doc(anon(), 'sesion_activa/current')));
  });
});
