// ─── IDENTIDAD PSEUDÓNIMA DE PACIENTE — PR5c-3a ──────────────────────────────
// Qué es: el par (pid, alias) que identifica a un paciente ante la Quest SIN revelar su nombre, DNI, correo ni el
// id real del documento de Firestore.
//   pid    22 caracteres base64url, 128 bits aleatorios (WebCrypto), opaco y estable. NO derivado del alias ni del id.
//   alias  'P-001', 'P-002'... (global, único, monótono). Es lo que ve la gafa/el terapeuta junto al pid.
// Dónde se guarda: pacientes/{id}.{pid, alias, aliasNum} y el contador config/aliasPacientes {ultimo,
// ultimoPacienteId, actualizadoEn}. Se asignan juntos en UNA transacción (rules.next lo impone con getAfter).
//
// Diseño del módulo (como devices.ts): recibe `db` por parámetro (se puede probar con node contra el emulador)
// y solo usa sintaxis TypeScript "borrable" (node >= 22.18 lo importa directamente).
//
// Contratos importantes:
//  - asegurarIdentidadPaciente es IDEMPOTENTE: si el paciente ya tiene pid+alias los devuelve sin escribir.
//    Dos pestañas/clientes sobre el mismo paciente obtienen el mismo resultado (el SDK reintenta por concurrencia
//    optimista y el segundo lee la identidad ya escrita).
//  - La resolución pid -> paciente es SOLO en memoria, sobre la lista de pacientes que el clínico ya puede leer.
//    No hay colección pública ni consultas nuevas.
//  - Las sesiones antiguas (patientId = id de Firestore) NO se migran ni se reescriben: siguen resolviéndose por id.
import {
  doc, getDoc, runTransaction, serverTimestamp, type Firestore, type Transaction,
} from "firebase/firestore";

// ── Errores tipados ───────────────────────────────────────────────────────────

export type CodigoErrorIdentidad =
  | "paciente_inexistente"
  | "identidad_inconsistente"  // documento con identidad a medias (p. ej. pid sin alias): no se repara en silencio
  | "contador_invalido"
  | "alias_agotado"
  | "pid_invalido"             // el generador devolvió un pid que no cumple el formato
  | "sin_identidad"            // se pidió el identificador de la Quest de un paciente aún sin alias/pid
  | "permiso_denegado"
  | "conflicto"                // reintentos por concurrencia agotados
  | "red"
  | "desconocido";

export class ErrorIdentidad extends Error {
  codigo: CodigoErrorIdentidad;
  causa?: unknown;
  /**
   * true si la escritura PUDO llegar a confirmarse (timeout o corte durante el commit). El llamante NO debe
   * suponer que no se asignó nada: al reintentar, asegurarIdentidadPaciente consulta primero la identidad existente.
   */
  resultadoDesconocido: boolean;
  constructor(codigo: CodigoErrorIdentidad, mensaje: string, causa?: unknown, resultadoDesconocido = false) {
    super(mensaje);
    this.resultadoDesconocido = resultadoDesconocido;
    this.name = "ErrorIdentidad";
    this.codigo = codigo;
    this.causa = causa;
  }
}

const MENSAJES: Record<CodigoErrorIdentidad, string> = {
  paciente_inexistente: "El paciente no existe.",
  identidad_inconsistente: "El paciente tiene una identidad incompleta; requiere revisión manual.",
  contador_invalido: "El contador de alias es inválido.",
  alias_agotado: "Se agotó la numeración de alias.",
  pid_invalido: "El identificador generado no es válido.",
  sin_identidad: "El paciente todavía no tiene alias ni identificador para la gafa.",
  permiso_denegado: "El servidor rechazó la asignación de identidad: sin permiso.",
  conflicto: "No se pudo asignar el alias por concurrencia. Inténtalo de nuevo.",
  red: "Sin conexión con el servidor. Inténtalo de nuevo.",
  desconocido: "Error inesperado al asignar la identidad del paciente.",
};

function err(codigo: CodigoErrorIdentidad, causa?: unknown, resultadoDesconocido = false): ErrorIdentidad {
  return new ErrorIdentidad(codigo, MENSAJES[codigo], causa, resultadoDesconocido);
}

/** Traduce errores del SDK sin ocultar los permisos denegados. */
export function clasificarErrorIdentidad(e: unknown): ErrorIdentidad {
  if (e instanceof ErrorIdentidad) return e;
  const code = String((e as { code?: unknown })?.code ?? "");
  const c = code.startsWith("firestore/") ? code.slice("firestore/".length) : code;
  if (c === "permission-denied") return err("permiso_denegado", e);
  if (c === "unavailable" || c === "deadline-exceeded") return err("red", e, true); // conservador: un corte puede ocurrir tras el commit
  if (c === "aborted" || c === "failed-precondition" || c === "already-exists") return err("conflicto", e);
  return err("desconocido", e);
}

// ── Formato (espejo de rules.next: pidOk / aliasDeNum) ────────────────────────

export const PID_BYTES = 16;       // 128 bits
export const PID_LONGITUD = 22;    // ceil(128 / 6)
export const ALIAS_MAX_NUM = 999999;
const RE_PID = /^[A-Za-z0-9_-]{22}$/;
const RE_ALIAS = /^P-(\d{3,6})$/;
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function pidValido(v: unknown): v is string {
  return typeof v === "string" && RE_PID.test(v);
}

/** 'P-' + número rellenado a 3 dígitos: 1 -> P-001, 999 -> P-999, 1000 -> P-1000. */
export function aliasDeNumero(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > ALIAS_MAX_NUM) throw new RangeError("número de alias fuera de rango");
  return `P-${String(n).padStart(3, "0")}`;
}

/** Devuelve el número de un alias bien formado, o null. Admite solo la forma canónica (sin ceros de más). */
export function numeroDeAlias(alias: unknown): number | null {
  if (typeof alias !== "string") return null;
  const m = RE_ALIAS.exec(alias);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= ALIAS_MAX_NUM && aliasDeNumero(n) === alias ? n : null;
}

export function aliasValido(alias: unknown): alias is string {
  return numeroDeAlias(alias) !== null;
}

// ── Generación del pid (función pura con RNG inyectable) ──────────────────────

/** Fuente de bytes aleatorios: recibe cuántos y devuelve exactamente esos bytes. */
export type FuenteBytes = (n: number) => Uint8Array;

/** Por defecto WebCrypto (navegador y Node >= 19 exponen globalThis.crypto). Nunca Math.random. */
export const fuenteBytesCripto: FuenteBytes = (n) => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error("WebCrypto (crypto.getRandomValues) no disponible: no se genera pid sin fuente criptográfica");
  }
  return c.getRandomValues(new Uint8Array(n));
};

/** base64url sin relleno (16 bytes -> 22 caracteres). Implementación propia: sin btoa/Buffer. */
function aBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64URL[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64URL[n & 63];
  }
  return out;
}

/** pid aleatorio y opaco. No recibe alias ni id: es imposible que se derive de ellos. */
export function generarPid(fuente: FuenteBytes = fuenteBytesCripto): string {
  const bytes = fuente(PID_BYTES);
  if (!(bytes instanceof Uint8Array) || bytes.length !== PID_BYTES) {
    throw new RangeError(`la fuente de bytes debe devolver exactamente ${PID_BYTES} bytes`);
  }
  return aBase64Url(bytes);
}

// ── Asignación transaccional ──────────────────────────────────────────────────

export interface IdentidadPaciente {
  pid: string;
  alias: string;
  aliasNum: number;
  /** true si ESTA llamada escribió la identidad; false si ya existía (idempotencia). */
  nueva: boolean;
}

export interface OpcionesAsegurarIdentidad {
  db: Firestore;
  pacienteId: string;
  /** Inyectable en pruebas. Por defecto generarPid() con WebCrypto. */
  generarPid?: () => string;
  /** Inyectable en pruebas (p. ej. fallo de red simulado). Por defecto runTransaction del SDK web. */
  ejecutarTransaccion?: typeof runTransaction;
  /** Reintentos EXTERNOS ante contención; el SDK ya reintenta internamente (maxAttempts). Por defecto 10. */
  reintentos?: number;
  /**
   * Tope de tiempo por intento (ms). HALLAZGO: sin red, runTransaction del SDK reintenta ~5 minutos antes de
   * rendirse; aquí se corta antes con ErrorIdentidad("red"). Si la transacción acabara confirmándose después, no
   * pasa nada: es idempotente y las reglas impiden duplicados. Por defecto 20000.
   */
  tiempoMaxMs?: number;
  /** Tope de la lectura previa (ms). Por defecto 8000. */
  tiempoLecturaMs?: number;
  /** Inyectable en pruebas: lectura simple previa del paciente (null si no existe). Por defecto getDoc. */
  leerPaciente?: (db: Firestore, pacienteId: string) => Promise<Record<string, unknown> | null>;
  /** Espera entre reintentos (ms, con jitter). Por defecto 40. Pruebas: 0. */
  esperaBaseMs?: number;
}

interface Contador { ultimo: number }

function leerIdentidadExistente(p: Record<string, unknown>): IdentidadPaciente | null {
  const tienePid = p.pid !== undefined, tieneNum = p.aliasNum !== undefined;
  if (!tienePid && !tieneNum) return null; // sin identidad (el alias legado de texto libre se ignora y se sustituye)
  const num = numeroDeAlias(p.alias);
  if (!pidValido(p.pid) || !Number.isInteger(p.aliasNum) || num === null || num !== p.aliasNum) {
    throw err("identidad_inconsistente");
  }
  return { pid: p.pid, alias: p.alias as string, aliasNum: num, nueva: false };
}

// Una lectura denegada es una denegación REAL (sin rol, sin verificar, Quest...): se marca como definitiva
// (ErrorIdentidad) para no confundirla con la denegación por CONTENCIÓN que el servidor devuelve al commit.
async function leer(tx: Transaction, ref: ReturnType<typeof doc>) {
  try {
    return await tx.get(ref);
  } catch (e) {
    const c = clasificarErrorIdentidad(e);
    if (c.codigo === "permiso_denegado") throw c; // definitiva
    throw e;                                      // aborted/red/...: que decida el SDK y el bucle externo
  }
}

async function transaccion(tx: Transaction, db: Firestore, pacienteId: string, nuevoPid: () => string): Promise<IdentidadPaciente> {
  const pRef = doc(db, "pacientes", pacienteId);
  const cRef = doc(db, "config", "aliasPacientes");
  // Todas las lecturas antes de cualquier escritura.
  const pSnap = await leer(tx, pRef);
  if (!pSnap.exists()) throw err("paciente_inexistente");
  const existente = leerIdentidadExistente(pSnap.data() as Record<string, unknown>);
  if (existente) return existente; // idempotente: no escribe nada

  const cSnap = await leer(tx, cRef);
  let ultimo = 0;
  if (cSnap.exists()) {
    const u = (cSnap.data() as Partial<Contador>).ultimo;
    if (typeof u !== "number" || !Number.isInteger(u) || u < 0) throw err("contador_invalido");
    ultimo = u;
  }
  const aliasNum = ultimo + 1;
  if (aliasNum > ALIAS_MAX_NUM) throw err("alias_agotado");
  const pid = nuevoPid();
  if (!pidValido(pid)) throw err("pid_invalido");
  const alias = aliasDeNumero(aliasNum);

  tx.set(cRef, { ultimo: aliasNum, ultimoPacienteId: pacienteId, actualizadoEn: serverTimestamp() });
  tx.update(pRef, { alias, aliasNum, pid, updatedAt: serverTimestamp() });
  return { pid, alias, aliasNum, nueva: true };
}

function conTope<T>(p: Promise<T>, ms: number, desconocido = true): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rej) => { t = setTimeout(() => rej(err("red", undefined, desconocido)), ms); });
  p.catch(() => undefined); // si pierde la carrera, que su rechazo tardío no quede sin tratar
  return Promise.race([p, limite]).finally(() => clearTimeout(t));
}

async function leerPacienteSimple(db: Firestore, id: string): Promise<Record<string, unknown> | null> {
  const s = await getDoc(doc(db, "pacientes", id));
  return s.exists() ? (s.data() as Record<string, unknown>) : null;
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Asigna (si falta) y devuelve el alias + pid del paciente. Transaccional, idempotente y segura frente a
 * concurrencia: dos clínicos a la vez obtienen alias consecutivos distintos; dos pestañas sobre el mismo
 * paciente obtienen el mismo par. Si el servidor deniega, lanza ErrorIdentidad("permiso_denegado") (no se silencia).
 */
export async function asegurarIdentidadPaciente(o: OpcionesAsegurarIdentidad): Promise<IdentidadPaciente> {
  if (typeof o.pacienteId !== "string" || o.pacienteId.length === 0 || o.pacienteId.includes("/")) {
    throw err("paciente_inexistente");
  }
  const run = o.ejecutarTransaccion ?? runTransaction;
  const nuevoPid = o.generarPid ?? (() => generarPid());
  const maxIntentos = Math.max(1, (o.reintentos ?? 10) + 1);
  const base = o.esperaBaseMs ?? 40;
  let ultimoError: unknown;
  const leer1 = o.leerPaciente ?? leerPacienteSimple;
  for (let intento = 0; intento < maxIntentos; intento++) {
    // LECTURA PREVIA SIEMPRE (también tras un resultado desconocido): si ya hay identidad válida se devuelve sin
    // abrir transacción ni escribir. Si la lectura falla (red/permisos) se propaga SIN escribir nada.
    try {
      const previo = await conTope(leer1(o.db, o.pacienteId), o.tiempoLecturaMs ?? 8000, false);
      if (previo === null) throw err("paciente_inexistente");
      const existente = leerIdentidadExistente(previo);
      if (existente) return existente;
    } catch (e) {
      const c = clasificarErrorIdentidad(e);
      c.resultadoDesconocido = false; // una lectura no escribe: aquí nunca hay resultado desconocido
      throw c;
    }
    try {
      // maxAttempts alto: bajo contención el SDK reintenta él mismo antes de rendirse (por defecto son 5).
      return await conTope(
        run(o.db, (tx) => transaccion(tx, o.db, o.pacienteId, nuevoPid), { maxAttempts: 15 }),
        o.tiempoMaxMs ?? 20000,
      );
    } catch (e) {
      ultimoError = e;
      const c = clasificarErrorIdentidad(e);
      // Se reintenta la CONTENCIÓN: ABORTED/FAILED_PRECONDITION del servidor y también PERMISSION_DENIED al
      // commit (HALLAZGO del emulador: las reglas se evalúan antes que la precondición de la transacción; si otro
      // cliente avanzó el contador entre la lectura y el commit, las reglas ven el contador nuevo y deniegan).
      // Cada reintento vuelve a leer, así que una denegación real de escritura acaba tras agotar los reintentos
      // como permiso_denegado. NO se reintenta: una lectura denegada (ErrorIdentidad ya clasificado), la red
      // (la UI decide) ni los datos inválidos.
      const yaClasificado = e instanceof ErrorIdentidad;
      if (yaClasificado || (c.codigo !== "conflicto" && c.codigo !== "permiso_denegado")) throw c;
      if (base > 0) await esperar(base * Math.min(intento + 1, 5) + Math.floor(Math.random() * base * 2));
    }
  }
  throw clasificarErrorIdentidad(ultimoError);
}

// ── Resolución pid -> paciente (en memoria, SIN consultas nuevas) ─────────────

export interface PacienteConIdentidad {
  id: string;
  pid?: string;
  alias?: string;
}

/** Índice pid -> paciente construido con la lista que el clínico ya puede leer. Ignora pids mal formados. */
export function construirMapaPidAPaciente<P extends PacienteConIdentidad>(pacientes: Iterable<P>): Map<string, P> {
  const m = new Map<string, P>();
  for (const p of pacientes) {
    if (p && typeof p.id === "string" && pidValido(p.pid)) m.set(p.pid, p);
  }
  return m;
}

/** Devuelve el paciente con ese pid o null (pid ausente, mal formado o de un paciente borrado). */
export function resolverPacientePorPid<P extends PacienteConIdentidad>(pacientes: Iterable<P>, pid: unknown): P | null {
  if (!pidValido(pid)) return null;
  for (const p of pacientes) {
    if (p && p.pid === pid && typeof p.id === "string") return p;
  }
  return null;
}

export interface SesionConPatientId {
  patientId?: unknown;
}

/**
 * Compatibilidad de lectura para W1/W2: si `sesion.patientId` es un pid conocido devuelve una COPIA con
 * patientId = id de Firestore del paciente y `patientIdPid` = el pid original. No muta el original.
 * Si no hay patientId, no es un pid conocido o es el id de Firestore de una sesión antigua, devuelve la MISMA
 * sesión sin cambios (sin migrar nada).
 */
export function reescribirPatientId<S extends SesionConPatientId>(
  sesion: S,
  mapaPidAPaciente: ReadonlyMap<string, { id: string }>,
): S & { patientIdPid?: string } {
  const pid = sesion?.patientId;
  if (typeof pid !== "string") return sesion;
  const p = mapaPidAPaciente.get(pid);
  if (!p) return sesion;
  return { ...sesion, patientId: p.id, patientIdPid: pid };
}

// ── Contrato de privacidad: lo único que ve la Quest ──────────────────────────

export interface IdentificadorQuest {
  patientId: string;     // = pid (clave que Godot ya usa; el valor ya no es el id de Firestore)
  patientAlias: string;  // = alias P-NNN
}

/** Lista blanca explícita: nunca copia nombre, DNI, correo, iniciales, notas ni el id de Firestore. */
export function identificadorParaQuest(p: { pid?: unknown; alias?: unknown }): IdentificadorQuest {
  if (!pidValido(p?.pid) || !aliasValido(p?.alias)) throw err("sin_identidad");
  return { patientId: p.pid, patientAlias: p.alias };
}
