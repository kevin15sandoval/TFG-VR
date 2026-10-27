// PR5c-3b-2 - Pruebas PURAS (sin emulador) del ciclo de vida en app/devices.ts: estadoVista, generarSessionId,
// validación de la sesión que ve la Quest, motivo del cierre forzado, constantes y mapa de errores del ViewModel.
// Datos SINTÉTICOS. Las validaciones previas al acceso a Firestore se prueban con un `db` falso que revienta si se usa.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const D = await import(pathToFileURL(join(root, 'app', 'devices.ts')).href);
const I = await import(pathToFileURL(join(root, 'app', 'patientIdentity.ts')).href);
const V = await import(pathToFileURL(join(root, 'app', 'devicesViewModel.ts')).href);

const MIN = 60_000;
const PID = I.generarPid();
const base = (over = {}) => ({
  patientId: PID, patientAlias: 'P-001', gameId: 'gems', duration: 300, difficulty: 'Fácil',
  therapySide: 'Derecho', sessionType: 'Rehabilitación', ...over,
});
const reg = (over = {}) => ({ status: 'pending', venceEn: 1_000_000, motivo: null, resultadoEn: null, ...over });

describe('estadoVista (pura, sin «en línea»)', () => {
  it('pending: pendiente antes de venceEn, vencida derivada en venceEn y después', () => {
    assert.equal(D.estadoVista(reg(), 999_999), 'pendiente');
    assert.equal(D.estadoVista(reg(), 1_000_000), 'vencida');
    assert.equal(D.estadoVista(reg(), 5_000_000), 'vencida');
    assert.equal(D.estadoVista(reg({ venceEn: null }), 5_000_000), 'pendiente', 'marca local aún sin resolver');
  });
  it('el resto de estados se mapea uno a uno', () => {
    const e = (status, over) => D.estadoVista(reg({ status, ...over }), 0);
    assert.equal(e('vencida'), 'vencida');
    assert.equal(e('running'), 'en_curso');
    assert.equal(e('cancel_requested'), 'cancelacion_solicitada');
    assert.equal(e('completed'), 'completada');
    assert.equal(e('cancelled'), 'cancelada');
    assert.equal(e('interrupted', { motivo: 'abandono' }), 'interrumpida');
    assert.equal(e('interrupted', { motivo: 'cancelada_por_web' }), 'interrumpida');
    assert.equal(e('interrupted', { motivo: 'sin_respuesta' }), 'sin_respuesta');
    assert.equal(e('interrupted', { motivo: 'sin_respuesta', resultadoEn: 123 }), 'resultado_tardio');
    assert.equal(e('interrupted', { motivo: 'abandono', resultadoEn: 123 }), 'interrumpida');
  });
  it('un running o completed no depende de venceEn (una sesión iniciada puede acabar tras venceEn)', () => {
    assert.equal(D.estadoVista(reg({ status: 'running' }), 9e9), 'en_curso');
    assert.equal(D.estadoVista(reg({ status: 'completed' }), 9e9), 'completada');
  });
  it('ningún estado produce «en línea»/presencia', () => {
    const estados = ['pending', 'vencida', 'running', 'cancel_requested', 'completed', 'cancelled', 'interrupted'];
    for (const s of estados) assert.doesNotMatch(D.estadoVista(reg({ status: s }), 0), /l[ií]nea|online/i);
  });
  it('estado desconocido -> interrumpida (no lanza)', () => {
    assert.equal(D.estadoVista(reg({ status: 'raro' }), 0), 'interrumpida');
  });
});

describe('generarSessionId', () => {
  it('22 caracteres base64url con WebCrypto y sin colisiones en 5000 muestras', () => {
    const s = new Set();
    for (let i = 0; i < 5000; i++) { const id = D.generarSessionId(); assert.match(id, /^[A-Za-z0-9_-]{22}$/); s.add(id); }
    assert.equal(s.size, 5000);
  });
  it('fuente inyectable y determinista; rechaza fuentes con longitud incorrecta', () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i * 13);
    assert.equal(D.generarSessionId(() => bytes), Buffer.from(bytes).toString('base64url'));
    assert.throws(() => D.generarSessionId(() => new Uint8Array(8)), RangeError);
  });
  it('sin WebCrypto no hay fallback inseguro (Math.random)', () => {
    const c = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      assert.throws(() => D.generarSessionId(), /WebCrypto/);
    } finally { if (c) Object.defineProperty(globalThis, 'crypto', c); }
  });
});

describe('validarSesionParaDispositivo (lo único que ve la Quest)', () => {
  const rechaza = (s) => assert.throws(() => D.validarSesionParaDispositivo(s), (e) => e.codigo === 'sesion_invalida');
  it('acepta la configuración con pid de 22 caracteres y devuelve solo la lista blanca', () => {
    assert.deepEqual(D.validarSesionParaDispositivo(base()), base());
  });
  it('patientId: rechaza nombre, id de Firestore, ids antiguos/cortos/largos y caracteres raros', () => {
    for (const id of ['PACIENTE-SINTETICO-1', 'pac-opaco-1', 'AbCdEfGhIjKlMnOpQrSt', `${PID}x`, PID.slice(1), 'a b'.padEnd(22, 'x'), '', 'Juan Pérez Gómez 1234']) {
      rechaza(base({ patientId: id }));
    }
    rechaza(base({ patientId: undefined })); rechaza(base({ patientId: 12345 }));
  });
  it('sessionId externo y campos fuera de contrato (patientName, dni, notas) rechazados', () => {
    rechaza(base({ sessionId: D.generarSessionId() }));
    rechaza(base({ patientName: 'X' })); rechaza(base({ dni: '1' })); rechaza(base({ notes: 'n' }));
  });
  it('alias, juego y duración', () => {
    rechaza(base({ patientAlias: 'PACIENTE-SINTETICO-1' })); rechaza(base({ patientAlias: 'P-1' }));
    rechaza(base({ gameId: 'otro' })); rechaza(base({ duration: 0 })); rechaza(base({ duration: 7201 })); rechaza(base({ duration: 1.5 }));
    rechaza(base({ difficulty: '' })); rechaza(base({ therapySide: 'x'.repeat(21) })); rechaza(base({ sessionType: 'x'.repeat(31) }));
  });
  it('integra identificadorParaQuest: nunca copia nombre ni id de Firestore', () => {
    const q = I.identificadorParaQuest({ id: 'FS-ID', name: 'NOMBRE', pid: PID, alias: 'P-007' });
    assert.deepEqual(Object.keys(q).sort(), ['patientAlias', 'patientId']);
    assert.doesNotThrow(() => D.validarSesionParaDispositivo(base(q)));
  });
});

describe('motivo del cierre forzado y constantes', () => {
  it('5..200 caracteres (code points)', () => {
    assert.equal(D.motivoForzadoValido('abcd'), false);
    assert.equal(D.motivoForzadoValido('abcde'), true);
    assert.equal(D.motivoForzadoValido('x'.repeat(200)), true);
    assert.equal(D.motivoForzadoValido('x'.repeat(201)), false);
    assert.equal(D.motivoForzadoValido('😀'.repeat(4)), false, '4 code points aunque midan 8 en UTF-16');
    assert.equal(D.motivoForzadoValido('😀'.repeat(5)), true);
    assert.equal(D.motivoForzadoValido(undefined), false);
    assert.equal(D.motivoForzadoValido(12345), false);
  });
  it('TTL por defecto 20 min, tope 55 min (< 1 h de las reglas); plazos del contrato', () => {
    assert.equal(D.TTL_SESION_POR_DEFECTO_MS, 20 * MIN);
    assert.equal(D.TTL_SESION_MAXIMO_MS, 55 * MIN);
    assert.ok(D.TTL_SESION_MAXIMO_MS < 60 * MIN);
    assert.equal(D.GRACIA_CIERRE_MS, 30 * MIN);
    assert.equal(D.PLAZO_CANCELACION_MS, 2 * MIN);
  });
});

describe('validaciones del servicio que ocurren ANTES de tocar Firestore', () => {
  const dbProhibida = new Proxy({}, { get() { throw new Error('no debe tocarse Firestore'); } });
  const svcCon = (user) => D.crearServicioDispositivos({ db: dbProhibida, auth: { currentUser: user } });
  const clin = svcCon({ uid: 'u', isAnonymous: false });
  const SID = D.generarSessionId();
  const cod = (p) => p.then(() => 'ok', (e) => e.codigo);

  it('TTL fuera de rango, patientId inválido y sessionId inválido', async () => {
    assert.equal(await cod(clin.publicarSesionEnDispositivo('dev', base(), { ttlMs: 56 * MIN })), 'sesion_invalida');
    assert.equal(await cod(clin.publicarSesionEnDispositivo('dev', base(), { ttlMs: 0 })), 'sesion_invalida');
    assert.equal(await cod(clin.publicarSesionEnDispositivo('dev', base(), { ttlMs: -1 })), 'sesion_invalida');
    assert.equal(await cod(clin.publicarSesionEnDispositivo('dev', base({ patientId: 'pac-opaco-1' }))), 'sesion_invalida');
    assert.equal(await cod(clin.cancelarSesion('dev', 'corto')), 'sesion_invalida');
    assert.equal(await cod(clin.solicitarCancelacion('dev', '')), 'sesion_invalida');
    assert.equal(await cod(clin.cancelarSesion('a/b', SID)), 'dispositivo_inexistente');
  });
  it('motivo del forzado inválido se rechaza sin leer nada', async () => {
    for (const m of ['', '    ', 'abcd', 'x'.repeat(201), undefined, null]) {
      assert.equal(await cod(clin.forzarCierre('dev', SID, m)), 'motivo_invalido');
    }
  });
  it('anónimo y sin sesión: sin_permiso / sin_sesion; no existe limpiarSesion', async () => {
    const anon = svcCon({ uid: 'q', isAnonymous: true });
    const nadie = svcCon(null);
    for (const [s, esperado] of [[anon, 'sin_permiso'], [nadie, 'sin_sesion']]) {
      assert.equal(await cod(s.publicarSesionEnDispositivo('dev', base())), esperado);
      assert.equal(await cod(s.cancelarSesion('dev', SID)), esperado);
      assert.equal(await cod(s.solicitarCancelacion('dev', SID)), esperado);
      assert.equal(await cod(s.forzarCierre('dev', SID, 'sin respuesta de la gafa')), esperado);
      assert.equal(await cod(s.marcarVencida('dev', SID)), esperado);
      assert.equal(await cod(s.leerRegistro('dev', SID)), esperado);
      assert.equal(await cod(s.leerSesionVigente('dev')), esperado);
      assert.throws(() => s.suscribirRegistro('dev', SID, () => {}), (e) => e.codigo === esperado);
      assert.throws(() => s.suscribirSesionVigente('dev', () => {}), (e) => e.codigo === esperado);
    }
    assert.equal('limpiarSesion' in clin, false);
    assert.equal(typeof clin.cancelarSesion, 'function');
  });
});

describe('errores nuevos: texto de interfaz exhaustivo en el ViewModel', () => {
  const nuevos = ['sesion_en_curso', 'sesion_pendiente_viva', 'sesion_inexistente', 'sesion_no_cancelable',
    'plazo_no_cumplido', 'motivo_invalido', 'resultado_desconocido'];
  it('cada código nuevo tiene entrada en español, sin datos técnicos', () => {
    for (const c of nuevos) {
      assert.ok(V.CODIGOS_ERROR.includes(c), c);
      const v = V.errorAVista({ codigo: c, message: 'dispositivos/abc/sesiones_registro/xyz permission-denied', causa: { x: 1 } }, 'vincular');
      assert.ok(v.mensaje.length > 15, c);
      assert.doesNotMatch(v.mensaje, /firestore|dispositivos\/|permission|sesiones_registro|undefined|\[object/i, c);
      assert.equal(v.sinPermisos, false);
    }
  });
  it('resultado_desconocido: no se reintenta a ciegas (reintentable false); las pantallas deciden tras releer', () => {
    const v = V.errorAVista({ codigo: 'resultado_desconocido' }, 'vincular');
    assert.equal(v.reintentable, false);
    assert.match(v.mensaje, /Comprueba el estado/);
    assert.equal(V.errorAVista({ codigo: 'sesion_en_curso' }, 'vincular').reintentable, false);
  });
  it('errores tipados conservan sessionId para reconciliar', () => {
    const e = new D.ErrorDispositivo('resultado_desconocido', 'x', undefined, SID_FIJO);
    assert.equal(e.sessionId, SID_FIJO);
  });
});
const SID_FIJO = 'AAAAAAAAAAAAAAAAAAAAAA';
