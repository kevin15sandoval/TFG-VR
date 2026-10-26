// PR5b - Pruebas de la lógica pura de acceso (app/accessState.ts): resolverAcceso, clasificarErrorAcceso,
// obtenerEstadoAcceso con dobles (sin red) y decidirPantalla (decisión de main.tsx). Datos sintéticos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mod = await import(pathToFileURL(join(root, 'app', 'accessState.ts')).href);
const { resolverAcceso, clasificarErrorAcceso, obtenerEstadoAcceso, reevaluarTrasVerificar, decidirPantalla, guardActivo } = mod;

const U = (o = {}) => ({ uid: 'u1', isAnonymous: false, emailVerified: true, ...o });
const CL_OK = { email_verified: true, firebase: { sign_in_provider: 'password' } };
const doc = (rol, existe = true) => ({ tipo: 'doc', existe, rol });
const err = (code) => ({ tipo: 'error', code });

describe('resolverAcceso: tabla de los 7 estados', () => {
  const casos = [
    ['cargando (usuario sin resolver)', { user: undefined }, 'cargando'],
    ['cargando (claims aún no leídos)', { user: U(), claims: undefined }, 'cargando'],
    ['cargando (falta leer el rol)', { user: U(), claims: CL_OK }, 'cargando'],
    ['sin_verificar_email (user.emailVerified false)', { user: U({ emailVerified: false }), claims: { email_verified: false, firebase: { sign_in_provider: 'password' } } }, 'sin_verificar_email'],
    ['sin_verificar_email (sin leer doc aunque haya rol)', { user: U({ emailVerified: false }), claims: CL_OK, lectura: doc('admin') }, 'sin_verificar_email'],
    ['sin_rol (doc inexistente)', { user: U(), claims: CL_OK, lectura: doc(undefined, false) }, 'sin_rol'],
    ['sin_rol (rol desconocido)', { user: U(), claims: CL_OK, lectura: doc('paciente') }, 'sin_rol'],
    ['sin_rol (rol con otra capitalización)', { user: U(), claims: CL_OK, lectura: doc('Admin') }, 'sin_rol'],
    ['rol_ok fisioterapeuta', { user: U(), claims: CL_OK, lectura: doc('fisioterapeuta') }, 'rol_ok'],
    ['rol_ok admin', { user: U(), claims: CL_OK, lectura: doc('admin') }, 'rol_ok'],
    ['denegado (permission-denied)', { user: U(), claims: CL_OK, lectura: err('permission-denied') }, 'denegado'],
    ['denegado (error inesperado)', { user: U(), claims: CL_OK, lectura: err('algo-raro') }, 'denegado'],
    ['denegado (error sin código)', { user: U(), claims: CL_OK, lectura: err(undefined) }, 'denegado'],
    ['denegado (rol no string)', { user: U(), claims: CL_OK, lectura: doc(42) }, 'denegado'],
    ['denegado (rol ausente en un doc existente)', { user: U(), claims: CL_OK, lectura: doc(undefined) }, 'denegado'],
    ['denegado (rol array)', { user: U(), claims: CL_OK, lectura: doc(['admin']) }, 'denegado'],
    ['error_red (unavailable)', { user: U(), claims: CL_OK, lectura: err('unavailable') }, 'error_red'],
    ['error_red (red de Auth)', { user: U(), claims: CL_OK, lectura: err('auth/network-request-failed') }, 'error_red'],
    ['sesion_caducada (usuario nulo)', { user: null }, 'sesion_caducada'],
    ['sesion_caducada (bandera)', { user: U(), claims: CL_OK, lectura: doc('admin'), sesionCaducada: true }, 'sesion_caducada'],
    ['sesion_caducada (unauthenticated)', { user: U(), claims: CL_OK, lectura: err('unauthenticated') }, 'sesion_caducada'],
    ['denegado (claims ilegibles sin error)', { user: U(), claims: null }, 'denegado'],
    ['error_red (claims ilegibles por red)', { user: U(), claims: null, lectura: err('auth/network-request-failed') }, 'error_red'],
    ['sesion_caducada (token expirado al leer claims)', { user: U(), claims: null, lectura: err('auth/user-token-expired') }, 'sesion_caducada'],
  ];
  for (const [nombre, entrada, esperado] of casos) {
    it(nombre, () => assert.equal(resolverAcceso(entrada).estado, esperado));
  }
  it('rol_ok devuelve el rol', () => {
    assert.equal(resolverAcceso({ user: U(), claims: CL_OK, lectura: doc('admin') }).rol, 'admin');
  });
  it('estados que no son rol_ok no devuelven rol', () => {
    assert.equal(resolverAcceso({ user: U(), claims: CL_OK, lectura: doc('x') }).rol, undefined);
  });
});

describe('resolverAcceso: anónimo y verificación', () => {
  it('anónimo por user.isAnonymous -> denegado, aunque tenga doc de rol admin plantado', () => {
    assert.equal(resolverAcceso({ user: U({ isAnonymous: true }), claims: CL_OK, lectura: doc('admin') }).estado, 'denegado');
  });
  it('anónimo por claim sign_in_provider=anonymous (user.isAnonymous false) -> denegado', () => {
    const c = { email_verified: true, firebase: { sign_in_provider: 'anonymous' } };
    assert.equal(resolverAcceso({ user: U(), claims: c, lectura: doc('admin') }).estado, 'denegado');
  });
  it('anónimo se deniega antes que nada (sin pedir leer ni refrescar)', () => {
    const r = resolverAcceso({ user: U({ isAnonymous: true, emailVerified: false }) });
    assert.deepEqual(r, { estado: 'denegado' });
  });
  it('emailVerified true pero claim falso -> pide refrescar (una vez)', () => {
    const r = resolverAcceso({ user: U(), claims: { email_verified: false, firebase: { sign_in_provider: 'password' } } });
    assert.deepEqual(r, { estado: 'cargando', refrescar: true });
  });
  it('emailVerified true pero claim ausente -> pide refrescar', () => {
    assert.equal(resolverAcceso({ user: U(), claims: { firebase: { sign_in_provider: 'password' } } }).refrescar, true);
  });
  it('tras refrescar y el claim sigue falso -> sin_verificar_email (sin bucle)', () => {
    const r = resolverAcceso({ user: U(), claims: { email_verified: false }, refrescado: true });
    assert.deepEqual(r, { estado: 'sin_verificar_email' });
  });
  it('claim email_verified distinto de true estricto ("true" string) no cuenta como verificado', () => {
    assert.equal(resolverAcceso({ user: U(), claims: { email_verified: 'true' }, refrescado: true }).estado, 'sin_verificar_email');
  });
  it('con email sin verificar no pide leer Firestore', () => {
    const r = resolverAcceso({ user: U({ emailVerified: false }), claims: CL_OK });
    assert.equal(r.leer, undefined);
  });
});

describe('clasificarErrorAcceso', () => {
  it('clasifica', () => {
    assert.equal(clasificarErrorAcceso('permission-denied'), 'permiso');
    assert.equal(clasificarErrorAcceso('firestore/permission-denied'), 'permiso');
    assert.equal(clasificarErrorAcceso('unavailable'), 'red');
    assert.equal(clasificarErrorAcceso('deadline-exceeded'), 'red');
    assert.equal(clasificarErrorAcceso('auth/user-token-expired'), 'sesion');
    for (const c of [undefined, '', 'internal', 'not-found', 'auth/user-disabled', 'cualquier-cosa']) {
      assert.equal(clasificarErrorAcceso(c), 'otro');
    }
  });
});

describe('obtenerEstadoAcceso con dobles (sin red)', () => {
  const mkUser = (o = {}, claims = CL_OK) => {
    const calls = { token: [], reload: 0, id: [] };
    return {
      calls,
      uid: 'u1', isAnonymous: false, emailVerified: true, ...o,
      async reload() { calls.reload++; },
      async getIdToken(f) { calls.id.push(!!f); return 't'; },
      async getIdTokenResult(f) {
        calls.token.push(!!f);
        if (typeof claims === 'function') return { claims: claims(f) };
        if (claims instanceof Error) throw claims;
        return { claims };
      },
    };
  };
  const mkDeps = (impl) => { const d = { n: 0, uids: [], async leerRol(uid) { d.n++; d.uids.push(uid); return impl(uid); } }; return d; };

  it('fisio verificado con rol -> rol_ok y exactamente 1 lectura (usuarios/uid)', async () => {
    const d = mkDeps(() => ({ existe: true, rol: 'fisioterapeuta' }));
    const r = await obtenerEstadoAcceso(mkUser(), d);
    assert.deepEqual(r, { estado: 'rol_ok', rol: 'fisioterapeuta' });
    assert.deepEqual(d.uids, ['u1']);
  });
  it('anónimo: denegado SIN leer Firestore ni el token', async () => {
    const u = mkUser({ isAnonymous: true }); const d = mkDeps(() => ({ existe: true, rol: 'admin' }));
    assert.equal((await obtenerEstadoAcceso(u, d)).estado, 'denegado');
    assert.equal(d.n, 0); assert.equal(u.calls.token.length, 0);
  });
  it('email sin verificar: sin leer Firestore', async () => {
    const d = mkDeps(() => ({ existe: true, rol: 'admin' }));
    const u = mkUser({ emailVerified: false }, { email_verified: false, firebase: { sign_in_provider: 'password' } });
    assert.equal((await obtenerEstadoAcceso(u, d)).estado, 'sin_verificar_email');
    assert.equal(d.n, 0);
  });
  it('emailVerified true y claim falso: refresca UNA vez y, si el claim se actualiza, rol_ok', async () => {
    const d = mkDeps(() => ({ existe: true, rol: 'admin' }));
    const u = mkUser({}, (f) => ({ email_verified: f === true, firebase: { sign_in_provider: 'password' } }));
    assert.equal((await obtenerEstadoAcceso(u, d)).estado, 'rol_ok');
    assert.deepEqual(u.calls.token, [false, true]);
  });
  it('emailVerified true y claim sigue falso tras refrescar: sin_verificar_email, sin bucle', async () => {
    const d = mkDeps(() => ({ existe: true, rol: 'admin' }));
    const u = mkUser({}, { email_verified: false, firebase: { sign_in_provider: 'password' } });
    assert.equal((await obtenerEstadoAcceso(u, d)).estado, 'sin_verificar_email');
    assert.deepEqual(u.calls.token, [false, true]); assert.equal(d.n, 0);
  });
  it('permission-denied -> denegado', async () => {
    const d = mkDeps(() => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); });
    assert.equal((await obtenerEstadoAcceso(mkUser(), d)).estado, 'denegado');
  });
  it('unavailable -> error_red', async () => {
    const d = mkDeps(() => { throw Object.assign(new Error('x'), { code: 'unavailable' }); });
    assert.equal((await obtenerEstadoAcceso(mkUser(), d)).estado, 'error_red');
  });
  it('error inesperado (sin code) -> denegado (fallo cerrado)', async () => {
    const d = mkDeps(() => { throw new Error('boom'); });
    assert.equal((await obtenerEstadoAcceso(mkUser(), d)).estado, 'denegado');
  });
  it('lanzar un valor no-Error (string, null, undefined, número) -> denegado', async () => {
    for (const v of ['x', null, undefined, 7]) {
      const d = mkDeps(() => { throw v; });
      assert.equal((await obtenerEstadoAcceso(mkUser(), d)).estado, 'denegado');
    }
  });
  it('respuesta de lectura malformada (undefined / null / {} / existe no booleano) -> nunca rol_ok', async () => {
    for (const v of [undefined, null, {}, { existe: 'si', rol: 'admin' }]) {
      const r = await obtenerEstadoAcceso(mkUser(), mkDeps(() => v));
      assert.notEqual(r.estado, 'rol_ok', JSON.stringify(v));
    }
  });
  it('getIdTokenResult falla: inesperado -> denegado; red -> error_red; token expirado -> sesion_caducada', async () => {
    const d = mkDeps(() => ({ existe: true, rol: 'admin' }));
    assert.equal((await obtenerEstadoAcceso(mkUser({}, new Error('x')), d)).estado, 'denegado');
    assert.equal((await obtenerEstadoAcceso(mkUser({}, Object.assign(new Error('x'), { code: 'auth/network-request-failed' })), d)).estado, 'error_red');
    assert.equal((await obtenerEstadoAcceso(mkUser({}, Object.assign(new Error('x'), { code: 'auth/user-token-expired' })), d)).estado, 'sesion_caducada');
    assert.equal(d.n, 0);
  });
  it('reevaluarTrasVerificar hace reload + getIdToken(true) y luego evalúa', async () => {
    const d = mkDeps(() => ({ existe: true, rol: 'admin' }));
    const u = mkUser();
    assert.equal((await reevaluarTrasVerificar(u, d)).estado, 'rol_ok');
    assert.equal(u.calls.reload, 1); assert.deepEqual(u.calls.id, [true]);
  });
  it('reevaluarTrasVerificar con reload fallido -> nunca rol_ok', async () => {
    const u = mkUser(); u.reload = async () => { throw Object.assign(new Error('x'), { code: 'auth/network-request-failed' }); };
    assert.equal((await reevaluarTrasVerificar(u, mkDeps(() => ({ existe: true, rol: 'admin' })))).estado, 'error_red');
  });
});

describe('decidirPantalla (decisión de main.tsx) y flag VITE_ACCESS_GUARD', () => {
  const normal = { isAnonymous: false }, anon = { isAnonymous: true };
  it('guardActivo: solo el valor exacto "strict"', () => {
    assert.equal(guardActivo('strict'), true);
    for (const v of [undefined, '', 'off', 'false', 'true', 'STRICT', ' strict', '1']) assert.equal(guardActivo(v), false, String(v));
  });
  it('comprobando sesión -> cargando (con cualquier flag)', () => {
    for (const flag of [undefined, 'off', 'strict']) assert.equal(decidirPantalla({ flag, checking: true, user: null }), 'cargando');
  });
  it('sin usuario -> login', () => {
    for (const flag of [undefined, 'off', 'strict']) assert.equal(decidirPantalla({ flag, checking: false, user: null }), 'login');
  });
  it('guard apagado (flag no definida u "off") + usuario normal -> App directa, sin guard', () => {
    for (const flag of [undefined, 'off', '', 'false']) assert.equal(decidirPantalla({ flag, checking: false, user: normal }), 'app');
  });
  it('anónimo -> bloqueado SIEMPRE (guard apagado o activo)', () => {
    for (const flag of [undefined, 'off', 'strict']) assert.equal(decidirPantalla({ flag, checking: false, user: anon }), 'anonimo_bloqueado');
  });
  it('flag "strict" + usuario normal -> guard', () => {
    assert.equal(decidirPantalla({ flag: 'strict', checking: false, user: normal }), 'guard');
  });
});

describe('análisis estático: sin lecturas antes de rol_ok y sin registro público', () => {
  const src = (f) => readFileSync(join(root, 'app', f), 'utf8');
  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('accessState.ts no importa nada (ni firebase, ni React, ni módulos de la app)', () => {
    const imports = sinComentarios(src('accessState.ts')).match(/^\s*import[^;]*;/gm) ?? [];
    assert.deepEqual(imports, []);
  });
  it('el único acceso a Firestore del guard es getDoc(usuarios/uid) en accessData.ts', () => {
    const data = sinComentarios(src('accessData.ts'));
    assert.match(data, /getDoc\(doc\(db, "usuarios", uid\)\)/);
    assert.doesNotMatch(data, /getDocs|onSnapshot|collection\(|setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction/);
    const guard = sinComentarios(src('AccessGuard.tsx'));
    assert.doesNotMatch(guard, /firebase\/firestore|from "\.\/db"|getDoc|onSnapshot|subscribe/);
    assert.doesNotMatch(sinComentarios(src('accessState.ts')), /getDoc|onSnapshot|subscribe|from ['"]firebase/);
  });
  it('main.tsx: no importa db ni firestore; <App> y <AccessGuard> solo se alcanzan tras decidirPantalla', () => {
    const m = sinComentarios(src('main.tsx'));
    assert.doesNotMatch(m, /from "\.\/db"/);
    assert.doesNotMatch(m, /firebase\/firestore|getDoc/);
    const idxDecision = m.indexOf('decidirPantalla({');
    const idxApp = m.indexOf('<App ');
    const idxGuard = m.indexOf('<AccessGuard');
    assert.ok(idxDecision > 0 && idxApp > idxDecision && idxGuard > idxDecision);
    assert.equal((m.match(/<AccessGuard/g) ?? []).length, 1);
    assert.match(m, /if \(pantalla === "guard"\) \{\s*return \(\s*<AccessGuard/);
  });
  it('con el guard apagado no hay llamadas de PR5b a Firestore en main.tsx (solo se importa el módulo)', () => {
    const m = sinComentarios(src('main.tsx'));
    assert.doesNotMatch(m, /obtenerEstadoAcceso|leerRolUsuario|reevaluarTrasVerificar/);
  });
  it('AccessGuard monta children únicamente en el caso rol_ok', () => {
    const g = sinComentarios(src('AccessGuard.tsx'));
    assert.equal((g.match(/<>\{children\}<\/>/g) ?? []).length, 1);
    assert.match(g, /case "rol_ok":\s*return <>\{children\}<\/>;/);
  });
  it('registro público retirado: sin register/createUser/updateProfile/"Crear cuenta" en el código vivo de acceso', () => {
    for (const f of ['auth.ts', 'AuthScreen.tsx', 'main.tsx', 'AccessGuard.tsx']) {
      const s = sinComentarios(src(f));
      assert.doesNotMatch(s, /createUserWithEmailAndPassword|updateProfile|\bregister\b|RegisterForm|Crear cuenta/, f);
    }
    assert.match(src('AuthScreen.tsx'), /El acceso es solo por invitación\. Solicita tu alta al administrador de la plataforma\./);
  });
  it('el icono de contraseña se renderiza como componente (RightIcon)', () => {
    const s = src('AuthScreen.tsx');
    assert.match(s, /rightIcon: RightIcon/);
    assert.match(s, /<RightIcon size=\{15\} \/>/);
    assert.doesNotMatch(s, /<rightIcon/);
  });
});
