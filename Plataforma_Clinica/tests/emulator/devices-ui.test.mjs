// PR5c-2 - Pantalla «Dispositivos VR»: view-model (lógica pura) + comportamiento de datos que la pantalla usa,
// contra Auth Emulator + Firestore Emulator con firestore.rules.next. Solo proyecto demo-tfg-vr y datos SINTÉTICOS.
// Las partes de DOM/foco/navegación se prueban en navegador real (ver informe), no aquí.
// Se ejecuta con `pnpm test:emulator`. La parte 1 (pura) no necesita emulador.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, writeBatch, serverTimestamp, Timestamp, disableNetwork, enableNetwork,
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

const D = await import(pathToFileURL(join(root, 'app', 'devices.ts')).href);
const VM = await import(pathToFileURL(join(root, 'app', 'devicesViewModel.ts')).href);

// ════════════════════════════════════════════════════════════════════════════
// 1. LÓGICA PURA (view-model)
// ════════════════════════════════════════════════════════════════════════════
describe('PR5c-2 view-model: errores', () => {
  const fuente = readFileSync(join(root, 'app', 'devices.ts'), 'utf8');
  const bloque = /export type CodigoErrorDispositivo =([\s\S]*?);/.exec(fuente)[1];
  const todos = [...bloque.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

  it('el test detecta los 25 códigos (18 de PR5c-1 + 7 de PR5c-3b-2) y el mapa los cubre TODOS (y solo ésos)', () => {
    assert.equal(todos.length, 25);
    assert.deepEqual([...VM.CODIGOS_ERROR].sort(), [...todos].sort());
  });

  for (const op of ['cargar', 'vincular', 'renombrar', 'revocar']) {
    it(`todos los códigos tienen texto de interfaz en español (operación ${op})`, () => {
      for (const codigo of todos) {
        const v = VM.errorAVista({ codigo, message: 'MENSAJE INTERNO uid=abc', causa: { secreto: 'X' } }, op);
        assert.ok(v.mensaje.length > 20, codigo);
        assert.ok(/[a-záéíóú]/.test(v.mensaje), codigo);
        assert.ok(!/uid|MENSAJE INTERNO|secreto|Firestore|firestore|documento|undefined|\[object/i.test(v.mensaje), `${codigo}: ${v.mensaje}`);
        assert.equal(typeof v.reintentable, 'boolean');
        assert.equal(typeof v.sinPermisos, 'boolean');
      }
    });
  }

  it('no se filtra `causa` ni `message`; códigos desconocidos o basura caen en «desconocido»', () => {
    for (const x of [undefined, null, 42, 'texto', {}, { codigo: 'inventado' }, { codigo: '__proto__' }, new Error('boom'), { codigo: 'toString' }]) {
      const v = VM.errorAVista(x, 'vincular');
      assert.equal(v.mensaje, VM.errorAVista({ codigo: 'desconocido' }, 'vincular').mensaje);
      assert.equal(v.reintentable, true);
      assert.equal(v.sinPermisos, false);
    }
  });

  it('reintentable solo en fallos transitorios (red, desconocido); permisos marcan sinPermisos', () => {
    const rein = todos.filter((c) => VM.errorAVista({ codigo: c }, 'vincular').reintentable);
    assert.deepEqual(rein.sort(), ['desconocido', 'red']);
    const sp = todos.filter((c) => VM.errorAVista({ codigo: c }, 'vincular').sinPermisos);
    assert.deepEqual(sp.sort(), ['permiso_denegado', 'sin_permiso']);
  });

  it('mensajes clave: caducado, usado, inexistente, revocado y red', () => {
    assert.match(VM.errorAVista({ codigo: 'vinculo_caducado' }, 'vincular').mensaje, /caducado/);
    assert.match(VM.errorAVista({ codigo: 'vinculo_usado' }, 'vincular').mensaje, /ya se ha utilizado/);
    assert.match(VM.errorAVista({ codigo: 'vinculo_inexistente' }, 'vincular').mensaje, /No hay ninguna Quest/);
    assert.match(VM.errorAVista({ codigo: 'dispositivo_revocado' }, 'vincular').mensaje, /vincularla de nuevo con un código nuevo desde la propia gafa/);
    assert.match(VM.errorAVista({ codigo: 'red' }, 'revocar').mensaje, /revocar la Quest/);
  });

  it('el servicio real produce ErrorDispositivo cuyo `codigo` entiende el mapa', () => {
    const e = D.clasificarErrorDispositivo({ code: 'permission-denied' });
    assert.equal(VM.errorAVista(e, 'vincular').sinPermisos, true);
    const r = D.clasificarErrorDispositivo({ code: 'unavailable' });
    assert.equal(VM.errorAVista(r, 'cargar').reintentable, true);
  });
});

describe('PR5c-2 view-model: código y alias', () => {
  it('limpiarEntradaCodigo: mayúsculas, sin guion ni espacios, máx. 8', () => {
    assert.equal(VM.limpiarEntradaCodigo('abcd-efgh'), 'ABCDEFGH');
    assert.equal(VM.limpiarEntradaCodigo(' ab cd - ef gh '), 'ABCDEFGH');
    assert.equal(VM.limpiarEntradaCodigo('abcdefghjk'), 'ABCDEFGH');
    assert.equal(VM.limpiarEntradaCodigo(''), '');
    assert.equal(VM.limpiarEntradaCodigo(undefined), '');
  });
  it('mostrarCodigo inserta el guion solo visual', () => {
    assert.equal(VM.mostrarCodigo('abcd'), 'ABCD');
    assert.equal(VM.mostrarCodigo('abcde'), 'ABCD-E');
    assert.equal(VM.mostrarCodigo('ABCDEFGH'), 'ABCD-EFGH');
  });
  it('validarCodigoEntrada: acepta ABCD-EFGH y minúsculas', () => {
    assert.deepEqual(VM.validarCodigoEntrada('ABCD-EFGH'), { ok: true, codigo: 'ABCDEFGH' });
    assert.deepEqual(VM.validarCodigoEntrada('abcd-efgh'), { ok: true, codigo: 'ABCDEFGH' });
    assert.deepEqual(VM.validarCodigoEntrada('  pru ebas2 '), { ok: true, codigo: 'PRUEBAS2' });
    assert.deepEqual(VM.validarCodigoEntrada('2345-6789'), { ok: true, codigo: '23456789' });
  });
  it('validarCodigoEntrada: rechaza vacío, corto, largo, 0/O/1/I/L y símbolos con mensaje claro', () => {
    assert.match(VM.validarCodigoEntrada('').mensaje, /Escribe el código/);
    assert.match(VM.validarCodigoEntrada('   ').mensaje, /Escribe el código/);
    assert.match(VM.validarCodigoEntrada('ABC').mensaje, /Faltan 5 símbolos/);
    assert.match(VM.validarCodigoEntrada('ABCDEFG').mensaje, /Falta[n]? 1 símbolo\b/);
    assert.match(VM.validarCodigoEntrada('ABCDEFGHJ').mensaje, /demasiados/);
    for (const mal of ['ABCDEFG0', 'ABCDEFGO', 'ABCDEFG1', 'ABCDEFGI', 'ABCDEFGL', 'ABCDEF.H', 'ABCDEFG_', 'ABCDEFGÑ']) {
      const r = VM.validarCodigoEntrada(mal);
      assert.equal(r.ok, false, mal);
      assert.match(r.mensaje, /0, 1, O, I ni L/, mal);
    }
  });
  it('validarCodigoEntrada coincide con codigoValido de PR5c-1 para el alfabeto completo', () => {
    for (let i = 0; i < 200; i++) {
      const c = Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
      assert.equal(VM.validarCodigoEntrada(c).ok, D.codigoValido(c));
    }
  });
  it('validarAliasEntrada: opcional al vincular, obligatorio al renombrar, 1-30 y caracteres de las reglas', () => {
    assert.deepEqual(VM.validarAliasEntrada('', false), { ok: true, alias: null });
    assert.deepEqual(VM.validarAliasEntrada('   ', false), { ok: true, alias: null });
    assert.equal(VM.validarAliasEntrada('', true).ok, false);
    assert.equal(VM.validarAliasEntrada('   ', true).ok, false);
    assert.deepEqual(VM.validarAliasEntrada('  Quest consulta 1 ', true), { ok: true, alias: 'Quest consulta 1' });
    assert.deepEqual(VM.validarAliasEntrada('Sala Ñandú_2.b-3', true), { ok: true, alias: 'Sala Ñandú_2.b-3' });
    assert.equal(VM.validarAliasEntrada('x'.repeat(30), true).ok, true);
    const largo = VM.validarAliasEntrada('x'.repeat(31), true);
    assert.equal(largo.ok, false); assert.match(largo.mensaje, /máximo 30/);
    for (const mal of ['<b>', 'a@b', 'quest#1', 'a/b', 'emoji 😀', 'a\nb']) {
      assert.equal(VM.validarAliasEntrada(mal, false).ok, false, mal);
      assert.equal(D.aliasDispositivoValido(mal), false, mal);
    }
  });
});

describe('PR5c-2 view-model: lista, estados y acciones', () => {
  const v = (uid, estado, alias, vinculadoEn = null, revocadoEn = null) => ({ uid, estado, alias, vinculadoEn, revocadoEn });
  it('orden: vinculadas antes que revocadas; más reciente primero; desempate estable; pendientes fuera', () => {
    const l = VM.prepararLista([
      v('r1', 'revocado', 'R1', 100, 900), v('v1', 'vinculado', 'V1', 100), v('p1', 'pendiente', null),
      v('v2', 'vinculado', 'V2', 300), v('r2', 'revocado', 'R2', 50, 950), v('v3', 'vinculado', null, 300),
    ]);
    assert.deepEqual(l.map((x) => x.uid), ['v2', 'v3', 'v1', 'r2', 'r1']);
  });
  it('no muta la entrada y tolera lista vacía', () => {
    const e = [v('b', 'revocado', null, 1, 2), v('a', 'vinculado', null, 1)];
    const copia = JSON.stringify(e);
    VM.prepararLista(e);
    assert.equal(JSON.stringify(e), copia);
    assert.deepEqual(VM.prepararLista([]), []);
  });
  it('etiquetas de estado: icono + texto, NUNCA «en línea» ni presencia', () => {
    for (const e of ['pendiente', 'vinculado', 'revocado']) {
      const t = VM.etiquetaEstado(e);
      assert.ok(t.texto && ['check', 'ban'].includes(t.icono));
      assert.ok(!/en l[ií]nea|online|conectad/i.test(`${t.texto} ${t.descripcion}`), `${e}: ${t.texto} ${t.descripcion}`);
    }
    assert.equal(VM.etiquetaEstado('vinculado').texto, 'Vinculada');
    assert.equal(VM.etiquetaEstado('revocado').texto, 'Revocada');
    assert.match(VM.NOTA_VINCULADA_NO_CONECTADA, /Vinculada no significa conectada/);
    // ningún texto de la interfaz habla de presencia
    const todo = JSON.stringify(VM.TEXTOS) + VM.TEXTOS.pasos.join('') + VM.TEXTOS.revocarCuerpo.join('');
    assert.ok(!/en l[ií]nea/i.test(todo));
  });
  it('nombreDispositivo: alias o «Sin nombre»', () => {
    assert.equal(VM.nombreDispositivo({ alias: 'Quest sala 2' }), 'Quest sala 2');
    assert.equal(VM.nombreDispositivo({ alias: null }), 'Sin nombre');
    assert.equal(VM.nombreDispositivo({ alias: '   ' }), 'Sin nombre');
  });
  it('acciones por estado: solo «vinculado» renombra y revoca', () => {
    assert.deepEqual(VM.accionesPermitidas('vinculado'), { renombrar: true, revocar: true });
    assert.deepEqual(VM.accionesPermitidas('revocado'), { renombrar: false, revocar: false });
    assert.deepEqual(VM.accionesPermitidas('pendiente'), { renombrar: false, revocar: false });
  });
  it('fechas: «Vinculada el …» / «Revocada el …» solo cuando existen', () => {
    const ms = Date.UTC(2026, 4, 12, 10, 0, 0);
    assert.equal(VM.formatearFecha(ms, true), '12 de mayo de 2026');
    assert.equal(VM.formatearFecha(null), null);
    assert.equal(VM.textoFechaDispositivo(v('a', 'vinculado', null, ms), true), 'Vinculada el 12 de mayo de 2026');
    assert.equal(VM.textoFechaDispositivo(v('a', 'revocado', null, ms, ms + 86_400_000), true), 'Revocada el 13 de mayo de 2026');
    assert.equal(VM.textoFechaDispositivo(v('a', 'vinculado', null, null), true), null);
    assert.equal(VM.textoFechaDispositivo(v('a', 'revocado', null, ms, null), true), null);
  });
  it('estadoDePantalla: carga, vacío, lista, error y sin permisos', () => {
    const e = (codigo) => VM.errorAVista({ codigo }, 'cargar');
    assert.equal(VM.estadoDePantalla({ cargando: true, error: null, dispositivos: [] }), 'cargando');
    assert.equal(VM.estadoDePantalla({ cargando: false, error: null, dispositivos: [] }), 'vacio');
    assert.equal(VM.estadoDePantalla({ cargando: false, error: null, dispositivos: [v('p', 'pendiente', null)] }), 'vacio');
    assert.equal(VM.estadoDePantalla({ cargando: false, error: null, dispositivos: [v('a', 'vinculado', null)] }), 'lista');
    assert.equal(VM.estadoDePantalla({ cargando: false, error: e('red'), dispositivos: [] }), 'error');
    assert.equal(VM.estadoDePantalla({ cargando: false, error: e('desconocido'), dispositivos: [] }), 'error');
    assert.equal(VM.estadoDePantalla({ cargando: false, error: e('permiso_denegado'), dispositivos: [] }), 'sin_permisos');
    assert.equal(VM.estadoDePantalla({ cargando: false, error: e('sin_permiso'), dispositivos: [] }), 'sin_permisos');
  });
  it('texto de revocar: no promete borrar resultados, no habla de «restablecer de fábrica»', () => {
    const t = VM.TEXTOS.revocarCuerpo.join(' ');
    assert.match(t, /dejará de recibir sesiones/);
    assert.match(t, /historial .* no se modifica/);
    assert.match(t, /vincularla de nuevo con un código nuevo desde la propia gafa/);
    assert.ok(!/restablec|f[aá]brica|borr|elimin/i.test(t));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 1b. OPERACIONES LENTAS / SIN CONEXIÓN (resultado desconocido)
// ════════════════════════════════════════════════════════════════════════════
function relojFalso() {
  const pendientes = new Map(); let id = 0; const puestos = [];
  return {
    puestos,
    poner(fn, ms) { const h = ++id; pendientes.set(h, fn); puestos.push(ms); return h; },
    quitar(h) { pendientes.delete(h); },
    avanzar() { for (const [h, fn] of [...pendientes]) { pendientes.delete(h); fn(); } },
    vivos: () => pendientes.size,
  };
}
const tick = () => new Promise((r) => setImmediate(r));

describe('PR5c-2 operaciones sin respuesta: fallo confirmado vs resultado desconocido', () => {
  it('el límite de espera es una constante acotada (15 s) y es el valor por defecto', async () => {
    assert.equal(VM.LIMITE_ESPERA_MS, 15_000);
    const t = relojFalso();
    const r = VM.esperarConLimite(new Promise(() => {}), 'revocar', undefined, t);
    assert.deepEqual(t.puestos, [15_000]);
    t.avanzar();
    assert.deepEqual(await r, { tipo: 'desconocido' });
  });
  it('promesa que nunca responde => desconocido al vencer el plazo (pantalla desbloqueada)', async () => {
    const t = relojFalso();
    const r = VM.esperarConLimite(new Promise(() => {}), 'renombrar', 1000, t);
    await tick(); t.avanzar();
    assert.equal((await r).tipo, 'desconocido');
  });
  it('respuesta a tiempo => ok y el temporizador se cancela', async () => {
    const t = relojFalso();
    const r = await VM.esperarConLimite(Promise.resolve(42), 'vincular', 1000, t);
    assert.deepEqual(r, { tipo: 'ok', valor: 42 });
    assert.equal(t.vivos(), 0);
  });
  it('rechazo del servidor (permiso, código inválido...) => rechazada = fallo CONFIRMADO', async () => {
    for (const codigo of ['permiso_denegado', 'vinculo_caducado', 'alias_invalido', 'dispositivo_revocado', 'desconocido']) {
      const t = relojFalso();
      const r = await VM.esperarConLimite(Promise.reject({ codigo }), 'vincular', 1000, t);
      assert.equal(r.tipo, 'rechazada', codigo);
      assert.equal(r.error.resultadoDesconocido, false, codigo);
      assert.equal(t.vivos(), 0);
    }
  });
  it('sin conexión (código «red») => desconocido, no fallo confirmado', async () => {
    const r = await VM.esperarConLimite(Promise.reject({ codigo: 'red' }), 'vincular', 1000, relojFalso());
    assert.deepEqual(r, { tipo: 'desconocido' });
    const c = [...VM.CODIGOS_ERROR].filter((k) => VM.errorAVista({ codigo: k }, 'revocar').resultadoDesconocido);
    assert.deepEqual(c, ['red']);
  });
  it('la operación NO se cancela: si responde tras el plazo, la promesa original sigue y el resultado no cambia', async () => {
    const t = relojFalso(); let ok; const original = new Promise((res) => { ok = res; });
    const r = VM.esperarConLimite(original, 'revocar', 1000, t);
    t.avanzar();
    assert.equal((await r).tipo, 'desconocido');
    ok('hecho tarde');
    assert.equal(await original, 'hecho tarde');
  });
  it('un rechazo tardío tras el plazo no genera rechazos sin manejar', async () => {
    const t = relojFalso(); let ko; const original = new Promise((_, rej) => { ko = rej; });
    const r = VM.esperarConLimite(original, 'renombrar', 1000, t);
    t.avanzar(); await r;
    let sinManejar = false; const h = () => { sinManejar = true; }; process.once('unhandledRejection', h);
    ko({ codigo: 'permiso_denegado' }); await tick(); await tick();
    process.off('unhandledRejection', h);
    assert.equal(sinManejar, false);
  });
  it('sin reintento automático: vincular y revocar nunca se reintentan; renombrar solo a mano', () => {
    for (const op of ['vincular', 'renombrar', 'revocar']) {
      const a = VM.accionesTrasDesconocido(op);
      assert.equal(a.reintentoAutomatico, false, op);
      assert.equal(a.comprobar, true, op);
    }
    assert.equal(VM.accionesTrasDesconocido('vincular').reintentarManual, false);
    assert.equal(VM.accionesTrasDesconocido('revocar').reintentarManual, false);
    assert.equal(VM.accionesTrasDesconocido('renombrar').reintentarManual, true);
  });
  it('esperarConLimite invoca la operación UNA sola vez (la espera no la repite)', async () => {
    let llamadas = 0; const op = () => { llamadas++; return new Promise(() => {}); };
    const t = relojFalso(); const r = VM.esperarConLimite(op(), 'revocar', 1000, t);
    t.avanzar(); await r; t.avanzar(); await tick();
    assert.equal(llamadas, 1);
  });
  it('coincideEsperado: reconcilia vincular, renombrar y revocar con la lista', () => {
    const v = (uid, estado, alias) => ({ uid, estado, alias, vinculadoEn: 1, revocadoEn: null });
    assert.equal(VM.coincideEsperado({ tipo: 'vincular', uidsAntes: ['a'], alias: null }, [v('a', 'vinculado', 'x')]), false);
    assert.equal(VM.coincideEsperado({ tipo: 'vincular', uidsAntes: ['a'], alias: null }, [v('a', 'vinculado', 'x'), v('b', 'vinculado', null)]), true);
    assert.equal(VM.coincideEsperado({ tipo: 'renombrar', uid: 'a', alias: 'N' }, [v('a', 'vinculado', 'N')]), true);
    assert.equal(VM.coincideEsperado({ tipo: 'renombrar', uid: 'a', alias: 'N' }, [v('a', 'vinculado', 'otro')]), false);
    assert.equal(VM.coincideEsperado({ tipo: 'revocar', uid: 'a', nombre: 'x' }, [v('a', 'revocado', 'x')]), true);
    assert.equal(VM.coincideEsperado({ tipo: 'revocar', uid: 'a', nombre: 'x' }, [v('a', 'vinculado', 'x')]), false);
  });
  it('mensajes de desconocido: no afirman éxito ni fallo y avisan de no repetir sin comprobar', () => {
    assert.match(VM.TEXTOS_DESCONOCIDO.mensaje, /No hemos podido confirmar si se completó\. Comprueba la lista antes de repetir\./);
    assert.ok(!/error|fall[óo]|correctamente/i.test(VM.TEXTOS_DESCONOCIDO.mensaje));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. DATOS CONTRA EMULADORES (lo que usa la pantalla)
// ════════════════════════════════════════════════════════════════════════════
const apps = [];
let adminApp, aAuth, aDb;
let n = 0;

function cliente() {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId: PROJECT_ID, appId: 'demo-app-id' }, `ui-${n++}`);
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
  return { ...c, uid: user.uid, codigo };
}

// Foto de TODOS los documentos (ruta -> updateTime) para detectar escrituras no autorizadas.
async function foto() {
  const out = {};
  async function recorre(col) {
    for (const d of await col.listDocuments()) {
      const s = await d.get();
      if (s.exists) out[d.path] = s.updateTime.toMillis();
      for (const sub of await d.listCollections()) await recorre(sub);
    }
  }
  for (const col of await aDb.listCollections()) await recorre(col);
  return out;
}
function diferencias(antes, despues) {
  const rutas = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  const creados = [], borrados = [], cambiados = [];
  for (const r of rutas) {
    if (!(r in antes)) creados.push(r); else if (!(r in despues)) borrados.push(r); else if (antes[r] !== despues[r]) cambiados.push(r);
  }
  return { creados, borrados, cambiados };
}
async function codigoDe(promesa) {
  try { await promesa; } catch (e) { return e?.codigo ?? `no-ErrorDispositivo:${e?.code}`; }
  return null;
}

describe('PR5c-2 datos de la pantalla contra rules.next', () => {
  let A, B, SINROL, NOVERIF;
  before(async () => {
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
    await fetch(`http://${FS}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
    adminApp = adminInit({ projectId: PROJECT_ID }, 'ui-admin');
    aAuth = adminAuth(adminApp);
    aDb = adminFirestore(adminApp);
    for (const [uid, email, ok, rol] of [
      ['ui-fisio-a', 'ui.a@example.test', true, 'fisioterapeuta'],
      ['ui-fisio-b', 'ui.b@example.test', true, 'fisioterapeuta'],
      ['ui-sinrol', 'ui.sinrol@example.test', true, null],
      ['ui-noverif', 'ui.noverif@example.test', false, 'fisioterapeuta'],
    ]) {
      await aAuth.createUser({ uid, email, password: PASSWORD, emailVerified: ok });
      if (rol) await aDb.doc(`usuarios/${uid}`).set({ rol });
    }
    await aDb.doc('pacientes/pac-ui-1').set({ name: 'PACIENTE-SINTETICO-1' });
    A = await entrar('ui.a@example.test');
    B = await entrar('ui.b@example.test');
    SINROL = await entrar('ui.sinrol@example.test');
    NOVERIF = await entrar('ui.noverif@example.test');
  });
  after(async () => {
    for (const a of apps) { try { await deleteApp(a); } catch { /* ya cerrada */ } }
    try { await adminDelete(adminApp); } catch { /* ya cerrada */ }
  });

  it('estado VACÍO: un fisio sin Quest recibe lista vacía => pantalla «vacio»', async () => {
    const l = await B.svc.listarMisDispositivosUnaVez();
    assert.deepEqual(l, []);
    assert.equal(VM.estadoDePantalla({ cargando: false, error: null, dispositivos: l }), 'vacio');
  });

  it('vincular con código tecleado como el usuario (ABCD-EFGH en minúsculas) + alias; solo cambian dispositivos/ y vinculos/', async () => {
    const q = await crearQuest();
    const antes = await foto();
    const tecleado = VM.mostrarCodigo(q.codigo).toLowerCase();
    const rc = VM.validarCodigoEntrada(tecleado);
    const ra = VM.validarAliasEntrada('  Quest consulta 1 ', false);
    assert.equal(rc.ok, true); assert.equal(ra.ok, true);
    const r = await A.svc.confirmarVinculo(rc.codigo, ra.alias);
    assert.deepEqual(r, { deviceUid: q.uid, alias: 'Quest consulta 1' });
    const dif = diferencias(antes, await foto());
    assert.deepEqual(dif.creados, []); assert.deepEqual(dif.borrados, []);
    assert.deepEqual(dif.cambiados.sort(), [`dispositivos/${q.uid}`, `vinculos/${q.codigo}`].sort());
    const lista = VM.prepararLista(await A.svc.listarMisDispositivosUnaVez());
    const mia = lista.find((x) => x.uid === q.uid);
    assert.equal(mia.estado, 'vinculado');
    assert.equal(VM.nombreDispositivo(mia), 'Quest consulta 1');
    assert.match(VM.textoFechaDispositivo(mia), /^Vinculada el \d{1,2} de [a-z]+ de 20\d\d$/);
    assert.equal(VM.estadoDePantalla({ cargando: false, error: null, dispositivos: lista }), 'lista');
  });

  it('vincular sin alias: «Sin nombre»', async () => {
    const q = await crearQuest();
    await A.svc.confirmarVinculo(q.codigo, VM.validarAliasEntrada('', false).alias ?? undefined);
    const mia = (await A.svc.listarMisDispositivosUnaVez()).find((x) => x.uid === q.uid);
    assert.equal(VM.nombreDispositivo(mia), 'Sin nombre');
  });

  it('código CADUCADO (plantado con Admin SDK): vinculo_caducado, texto de UI y sin escrituras', async () => {
    const q = await crearQuest();
    await aDb.doc(`vinculos/${q.codigo}`).update({ expira: AdminTs.fromMillis(Date.now() - 60_000) });
    const antes = await foto();
    const cod = await codigoDe(A.svc.confirmarVinculo(q.codigo, 'x'));
    assert.equal(cod, 'vinculo_caducado');
    assert.match(VM.errorAVista({ codigo: cod }, 'vincular').mensaje, /caducado.*código nuevo/);
    assert.deepEqual(await foto(), antes, 'un intento fallido no escribe nada');
  });

  it('código USADO (otro fisio ya lo confirmó) e INEXISTENTE', async () => {
    const q = await crearQuest();
    await B.svc.confirmarVinculo(q.codigo, 'De B');
    const antes = await foto();
    assert.equal(await codigoDe(A.svc.confirmarVinculo(q.codigo)), 'vinculo_usado');
    let inex = codigoAleatorio(); while (inex === q.codigo) inex = codigoAleatorio();
    assert.equal(await codigoDe(A.svc.confirmarVinculo(inex)), 'vinculo_inexistente');
    assert.deepEqual(await foto(), antes);
  });

  it('código con formato inválido: la validación de la pantalla lo frena antes de llamar; el servicio también', async () => {
    assert.equal(VM.validarCodigoEntrada('ABC0EFGH').ok, false);
    assert.equal(await codigoDe(A.svc.confirmarVinculo('ABC0EFGH')), 'codigo_invalido');
  });

  it('renombrar: cambia solo dispositivos/{uid}; alias inválido rechazado y sin escritura', async () => {
    const q = await crearQuest();
    await A.svc.confirmarVinculo(q.codigo, 'Antes');
    let antes = await foto();
    const ra = VM.validarAliasEntrada(' Quest sala 2 ', true);
    assert.equal(ra.ok, true);
    await A.svc.renombrarDispositivo(q.uid, ra.alias);
    const dif = diferencias(antes, await foto());
    assert.deepEqual(dif, { creados: [], borrados: [], cambiados: [`dispositivos/${q.uid}`] });
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().alias, 'Quest sala 2');
    antes = await foto();
    assert.equal(VM.validarAliasEntrada('', true).ok, false);
    assert.equal(await codigoDe(A.svc.renombrarDispositivo(q.uid, '<script>')), 'alias_invalido');
    assert.equal(await codigoDe(A.svc.renombrarDispositivo(q.uid, 'x'.repeat(31))), 'alias_invalido');
    assert.deepEqual(await foto(), antes);
  });

  it('revocar: dispositivos/{uid} pasa a revocado, no se borra nada; sesiones/resultados intactos; luego sin acciones', async () => {
    const q = await crearQuest();
    await A.svc.confirmarVinculo(q.codigo, 'A revocar');
    await aDb.doc('sesiones/ses-historica-ui').set({ patientId: 'pac-ui-1', gameId: 'gems', deviceUid: q.uid, score: 7 });
    const antes = await foto();
    await A.svc.revocarDispositivo(q.uid);
    const dif = diferencias(antes, await foto());
    assert.deepEqual(dif, { creados: [], borrados: [], cambiados: [`dispositivos/${q.uid}`] });
    assert.equal((await aDb.doc('sesiones/ses-historica-ui').get()).data().score, 7, 'el historial no se modifica');
    const mia = (await A.svc.listarMisDispositivosUnaVez()).find((x) => x.uid === q.uid);
    assert.equal(mia.estado, 'revocado');
    assert.match(VM.textoFechaDispositivo(mia), /^Revocada el /);
    assert.deepEqual(VM.accionesPermitidas(mia.estado), { renombrar: false, revocar: false });
    // revocado es terminal: las reglas lo rechazan aunque la pantalla no ofrezca el botón
    assert.equal(await codigoDe(A.svc.renombrarDispositivo(q.uid, 'otro')), 'permiso_denegado');
    assert.equal(await codigoDe(A.svc.revocarDispositivo(q.uid)), 'permiso_denegado');
    // y el orden pone las vinculadas primero
    const q2 = await crearQuest();
    await A.svc.confirmarVinculo(q2.codigo, 'Vigente');
    const orden = VM.prepararLista(await A.svc.listarMisDispositivosUnaVez());
    const iRev = orden.findIndex((x) => x.estado === 'revocado');
    assert.ok(orden.slice(iRev).every((x) => x.estado === 'revocado'));
    assert.ok(orden.slice(0, iRev).every((x) => x.estado === 'vinculado'));
  });

  it('OTRO fisioterapeuta: no ve ni opera las Quest de A', async () => {
    const q = await crearQuest();
    await A.svc.confirmarVinculo(q.codigo, 'Solo de A');
    const deB = await B.svc.listarMisDispositivosUnaVez();
    assert.ok(!deB.some((x) => x.uid === q.uid));
    const antes = await foto();
    assert.equal(await codigoDe(B.svc.renombrarDispositivo(q.uid, 'Robada')), 'permiso_denegado');
    assert.equal(await codigoDe(B.svc.revocarDispositivo(q.uid)), 'permiso_denegado');
    assert.deepEqual(await foto(), antes);
    assert.ok((await A.svc.listarMisDispositivosUnaVez()).some((x) => x.uid === q.uid && x.alias === 'Solo de A'));
    // mensaje de UI de esos rechazos
    assert.match(VM.errorAVista({ codigo: 'permiso_denegado' }, 'revocar').mensaje, /no tienes permiso sobre esta Quest/);
  });

  it('SIN ROL y SIN VERIFICAR: listar y vincular denegados => pantalla «sin_permisos»; sin escrituras', async () => {
    const q = await crearQuest();
    const antes = await foto();
    for (const u of [SINROL, NOVERIF]) {
      const cod = await codigoDe(u.svc.listarMisDispositivosUnaVez());
      assert.equal(cod, 'permiso_denegado');
      const ev = VM.errorAVista({ codigo: cod }, 'cargar');
      assert.equal(VM.estadoDePantalla({ cargando: false, error: ev, dispositivos: [] }), 'sin_permisos');
      assert.equal(await codigoDe(u.svc.confirmarVinculo(q.codigo)), 'permiso_denegado');
    }
    assert.deepEqual(await foto(), antes);
  });

  it('la Quest (anónima) no puede usar el servicio como clínico (sin_permiso) => sin permisos', async () => {
    const q = await crearQuest();
    const svc = D.crearServicioDispositivos({ db: q.db, auth: q.auth });
    assert.equal(await codigoDe(svc.listarMisDispositivosUnaVez()), 'sin_permiso');
    assert.throws(() => svc.listarMisDispositivos(() => {}), (e) => e.codigo === 'sin_permiso');
  });

  it('suscripción: tras vincular llega el nuevo dispositivo por onSnapshot (la pantalla no recarga a mano)', async () => {
    const q = await crearQuest();
    let ultimo = [];
    let aviso;
    const visto = new Promise((res) => { aviso = res; });
    const baja = A.svc.listarMisDispositivos((l) => { ultimo = l; if (l.some((x) => x.uid === q.uid && x.alias === 'En vivo')) aviso(); }, () => {});
    await A.svc.confirmarVinculo(q.codigo, 'En vivo');
    await Promise.race([visto, new Promise((_, rej) => setTimeout(() => rej(new Error('sin evento')), 8000))]);
    await A.svc.renombrarDispositivo(q.uid, 'En vivo 2');
    for (let i = 0; i < 50 && !ultimo.some((x) => x.alias === 'En vivo 2'); i++) await new Promise((r) => setTimeout(r, 100));
    baja();
    assert.ok(ultimo.some((x) => x.uid === q.uid && x.alias === 'En vivo 2'));
  });

  it('estado ERROR: un fallo de red del servicio se traduce a pantalla «error» con Reintentar', () => {
    const e = D.clasificarErrorDispositivo({ code: 'unavailable', message: 'detalle interno' });
    const ev = VM.errorAVista(e, 'cargar');
    assert.equal(ev.reintentable, true);
    assert.equal(VM.estadoDePantalla({ cargando: false, error: ev, dispositivos: [] }), 'error');
    assert.ok(!/detalle interno/.test(ev.mensaje));
    assert.equal(VM.estadoDePantalla({ cargando: true, error: null, dispositivos: [] }), 'cargando');
  });

  // ------------------------------------------------------------------ sin conexión (SDK real, emulador)
  it('SIN CONEXIÓN: renombrar queda pendiente => desconocido; al volver la red se completa UNA sola vez', async () => {
    const q = await crearQuest();
    await A.svc.confirmarVinculo(q.codigo, 'Antes offline');
    const off = await entrar('ui.a@example.test');
    await off.svc.listarMisDispositivosUnaVez();
    await disableNetwork(off.db);
    const antes = await foto();
    const t0 = Date.now();
    const p = off.svc.renombrarDispositivo(q.uid, 'Despues offline');
    const r = await VM.esperarConLimite(p, 'renombrar', 1500);
    assert.equal(r.tipo, 'desconocido');
    assert.ok(Date.now() - t0 < 5000, 'la pantalla se desbloquea dentro del plazo');
    assert.deepEqual(await foto(), antes, 'el servidor no ha recibido nada mientras no hay red');
    await enableNetwork(off.db);
    await p; // la operación pendiente se completa (no se canceló, no se repitió)
    const dif = diferencias(antes, await foto());
    assert.deepEqual(dif, { creados: [], borrados: [], cambiados: [`dispositivos/${q.uid}`] });
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().alias, 'Despues offline');
  });

  it('SIN CONEXIÓN: revocar queda pendiente => desconocido, sin reintento; al volver la red se revoca una sola vez', async () => {
    const q = await crearQuest();
    await A.svc.confirmarVinculo(q.codigo, 'Revocar offline');
    const off = await entrar('ui.a@example.test');
    await off.svc.listarMisDispositivosUnaVez();
    await disableNetwork(off.db);
    const antes = await foto();
    let llamadas = 0;
    const p = (() => { llamadas++; return off.svc.revocarDispositivo(q.uid); })();
    const r = await VM.esperarConLimite(p, 'revocar', 1500);
    assert.equal(r.tipo, 'desconocido');
    assert.equal(llamadas, 1);
    assert.deepEqual(await foto(), antes);
    await enableNetwork(off.db);
    await p;
    const dif = diferencias(antes, await foto());
    assert.deepEqual(dif, { creados: [], borrados: [], cambiados: [`dispositivos/${q.uid}`] });
    assert.equal((await aDb.doc(`dispositivos/${q.uid}`).get()).data().estado, 'revocado');
  });

  it('SIN CONEXIÓN: vincular falla al leer (red) => desconocido, no escribe nada; el código sigue disponible', async () => {
    const q = await crearQuest();
    const off = await entrar('ui.a@example.test');
    await off.svc.listarMisDispositivosUnaVez();
    await disableNetwork(off.db);
    const antes = await foto();
    const r = await VM.esperarConLimite(off.svc.confirmarVinculo(q.codigo, 'Offline'), 'vincular', 1500);
    assert.equal(r.tipo, 'desconocido');
    assert.deepEqual(await foto(), antes);
    await enableNetwork(off.db);
    assert.equal((await off.svc.confirmarVinculo(q.codigo, 'Online')).deviceUid, q.uid); // «Comprobar» + repetir a mano funciona
  });
});
