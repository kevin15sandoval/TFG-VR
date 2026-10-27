// ─── OPERACIONES DE DISPOSITIVOS (Quest) — PR5c-1 ────────────────────────────
// Capa de datos SIN pantallas para el contrato de `firestore.rules.next` (NO desplegada):
//   vinculos/{codigo}                      (get clínico; list denegado)
//   dispositivos/{deviceUid}               (list solo con where ownerUid == auth.uid)
//   dispositivos/{deviceUid}/sesion_activa/current
//
// Diseño:
//  - Recibe `db` y `auth` por parámetro (no importa ./firebase) para poder probarse con node contra el emulador.
//    La instancia ligada a la app real está en ./devicesService.ts.
//  - Solo sintaxis "borrable" de TypeScript (node >= 22.18 puede importar este archivo en las pruebas).
//  - Las comprobaciones de cliente (caducidad, estado, propietario) son SOLO ayuda de UX con mensajes claros:
//    la autoridad son las reglas. Los permisos denegados se propagan como ErrorDispositivo("permiso_denegado");
//    nunca se silencian.
//  - Marcas de tiempo: las reglas exigen `== request.time` para confirmadoEn, vinculadoEn, revocadoEn y
//    publicadaEn => se escriben con serverTimestamp() (que se resuelve a request.time). Solo `venceEn` es un
//    Timestamp real calculado en cliente (regla: venceEn > request.time && <= request.time + 24 h).
//  - No hay presencia: "vinculado" NO significa "en línea".
//
// Reenlace de una Quest revocada (resumen; detalle en el procedimiento de PR5c-1): revocado es TERMINAL para ese
// uid (rules.next no permite revocado -> nada). La gafa debe olvidar su identidad local (olvidar_identidad() de
// device_auth, PR6), obtener un uid anónimo NUEVO y un código nuevo; el vínculo se confirma de nuevo con
// confirmarVinculo(). El uid revocado no se reutiliza ni se borra desde cliente (historial intacto).
//
// PR5c-3b-2 (ciclo de vida persistente; contrato de rules.next, bloque 'CICLO DE VIDA DE SESION'):
//   dispositivos/{uid}/sesiones_registro/{sid}  registro = FUENTE DE VERDAD del estado (config inmutable + trazas)
//   dispositivos/{uid}/sesion_activa/current    buzón/puntero {sessionId, publicadaEn, venceEn} (sin config ni status)
//   sesiones/{sid}                              resultado clínico (lo escribe la Quest; la web no)
//  - Publicar = UN writeBatch (registro create + buzón set [+ update 'vencida' de la anterior si procede]).
//  - Nada se borra desde la web: no existe limpiarSesion (las reglas deniegan delete de registro y buzón).
//  - Las comprobaciones previas son solo ayuda de UX; si una escritura es denegada se RELEE el estado y se reclasifica
//    el motivo (sesion_en_curso, sesion_pendiente_viva...). Si el commit no se puede confirmar (red/tiempo) el error es
//    resultado_desconocido y NO se repite nada automáticamente: el llamante relee (leerRegistro) antes de reintentar.
//  - Las decisiones se toman con lecturas al SERVIDOR (getDocFromServer): nunca con datos de caché.
import {
  collection, doc, getDoc, getDocFromServer, getDocs, updateDoc, onSnapshot, query, where,
  serverTimestamp, Timestamp, writeBatch,
  type Firestore, type FieldValue, type Unsubscribe, type WriteBatch,
} from "firebase/firestore";
import { pidValido, generarPid, type FuenteBytes } from "./patientIdentity.ts";

// ── Errores tipados ───────────────────────────────────────────────────────────

export type CodigoErrorDispositivo =
  | "sin_sesion"            // no hay usuario autenticado
  | "sin_permiso"           // usuario anónimo (la gafa nunca opera como clínico)
  | "permiso_denegado"      // las reglas rechazaron la operación (sin rol, sin verificar, ajeno...)
  | "codigo_invalido"       // formato de código incorrecto
  | "alias_invalido"
  | "vinculo_inexistente"
  | "vinculo_caducado"
  | "vinculo_usado"         // ya confirmado (usado=true / estado vinculado)
  | "vinculo_no_pendiente"
  | "vinculo_obsoleto"      // la gafa rotó su código: este ya no es el vigente
  | "dispositivo_inexistente"
  | "dispositivo_ya_vinculado"
  | "dispositivo_revocado"
  | "dispositivo_no_propio"
  | "dispositivo_no_vinculado"
  | "sesion_invalida"
  | "sesion_en_curso"         // PR5c-3b-2: la sesión vigente está running/cancel_requested
  | "sesion_pendiente_viva"   // PR5c-3b-2: hay una sesión pendiente y no vencida: cancelarla antes de publicar otra
  | "sesion_inexistente"      // PR5c-3b-2: el registro no existe
  | "sesion_no_cancelable"    // PR5c-3b-2: el estado actual no admite la operación (cancelar/solicitar/forzar/vencer)
  | "plazo_no_cumplido"       // PR5c-3b-2: cierre forzado antes de tiempo
  | "motivo_invalido"         // PR5c-3b-2: motivo del cierre forzado fuera de 5..200 caracteres
  | "resultado_desconocido"   // PR5c-3b-2: la escritura pudo aplicarse, relee antes de repetir
  | "red"
  | "desconocido";

export class ErrorDispositivo extends Error {
  codigo: CodigoErrorDispositivo;
  causa?: unknown;
  /** Para resultado_desconocido: sesión afectada, para reconciliar con leerRegistro(). */
  sessionId?: string;
  constructor(codigo: CodigoErrorDispositivo, mensaje: string, causa?: unknown, sessionId?: string) {
    super(mensaje);
    this.name = "ErrorDispositivo";
    this.codigo = codigo;
    this.causa = causa;
    if (sessionId !== undefined) this.sessionId = sessionId;
  }
}

const MENSAJES: Record<CodigoErrorDispositivo, string> = {
  sin_sesion: "Debes iniciar sesión.",
  sin_permiso: "Esta cuenta no puede gestionar dispositivos.",
  permiso_denegado: "El servidor rechazó la operación: sin permiso para esta gafa o acción.",
  codigo_invalido: "El código no tiene un formato válido (8 caracteres, sin 0, O, 1, I ni L).",
  alias_invalido: "El nombre de la gafa solo admite letras, números, espacios, punto, guion y guion bajo (1 a 30).",
  vinculo_inexistente: "No existe ninguna gafa esperando con ese código.",
  vinculo_caducado: "El código ha caducado. Pide a la gafa que genere uno nuevo.",
  vinculo_usado: "Ese código ya fue utilizado.",
  vinculo_no_pendiente: "Ese código ya no está pendiente.",
  vinculo_obsoleto: "La gafa generó un código más reciente. Usa el que muestra ahora.",
  dispositivo_inexistente: "El dispositivo no existe.",
  dispositivo_ya_vinculado: "La gafa ya está vinculada.",
  dispositivo_revocado: "La gafa está revocada y no puede volver a vincularse con la misma identidad.",
  dispositivo_no_propio: "El dispositivo no te pertenece.",
  dispositivo_no_vinculado: "El dispositivo no está vinculado (pendiente o revocado).",
  sesion_invalida: "Los datos de la sesión no son válidos.",
  sesion_en_curso: "Hay una sesión en curso en esa Quest. Espera a que termine o solicita su cancelación.",
  sesion_pendiente_viva: "Ya hay una sesión pendiente de iniciar en esa Quest. Cancélala antes de enviar otra.",
  sesion_inexistente: "La sesión no existe en esa Quest.",
  sesion_no_cancelable: "La sesión ya no está en un estado que permita esta acción. Actualiza la pantalla.",
  plazo_no_cumplido: "Todavía no ha pasado el plazo para forzar el cierre de esta sesión.",
  motivo_invalido: "El motivo debe tener entre 5 y 200 caracteres.",
  resultado_desconocido: "No se pudo confirmar si la operación se guardó. Comprueba el estado de la sesión antes de repetirla.",
  red: "Sin conexión con el servidor. Inténtalo de nuevo.",
  desconocido: "Error inesperado.",
};

function err(codigo: CodigoErrorDispositivo, detalle?: string, causa?: unknown, sessionId?: string): ErrorDispositivo {
  return new ErrorDispositivo(codigo, detalle ? `${MENSAJES[codigo]} ${detalle}` : MENSAJES[codigo], causa, sessionId);
}

/** Clasifica cualquier error: los ErrorDispositivo pasan tal cual; los de Firestore se traducen sin ocultar permisos. */
export function clasificarErrorDispositivo(e: unknown): ErrorDispositivo {
  if (e instanceof ErrorDispositivo) return e;
  const code = String((e as { code?: unknown })?.code ?? "");
  const c = code.startsWith("firestore/") ? code.slice("firestore/".length) : code;
  if (c === "permission-denied") return err("permiso_denegado", undefined, e);
  if (c === "unauthenticated") return err("sin_sesion", undefined, e);
  if (c === "unavailable" || c === "deadline-exceeded") return err("red", undefined, e);
  if (c === "not-found") return err("dispositivo_inexistente", undefined, e);
  return err("desconocido", undefined, e);
}

// ── Validaciones puras (espejo de rules.next) ─────────────────────────────────

/** Alfabeto de 31 símbolos y longitud 8 (rules: codigoValido). */
const RE_CODIGO = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/;
/** rules: aliasDispositivoOk */
const RE_ALIAS_DISPOSITIVO = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _.-]{1,30}$/;
/** rules: idOpaco */
const RE_ID_OPACO = /^[A-Za-z0-9_-]{1,64}$/;
/** Alias de paciente P-001, P-002... (mínimo 3 dígitos). */
const RE_ALIAS_PACIENTE = /^P-\d{3,6}$/;

export const JUEGOS_VALIDOS = ["gems", "vault_escape", "urban_attention_quest", "luggage_handler"] as const;
export type JuegoId = (typeof JUEGOS_VALIDOS)[number];

/** Normaliza lo que teclea el usuario: mayúsculas y sin espacios ni guiones (ABCD-EFGH -> ABCDEFGH). */
export function normalizarCodigo(entrada: string): string {
  return String(entrada ?? "").toUpperCase().replace(/[\s-]/g, "");
}

export function codigoValido(c: string): boolean {
  return RE_CODIGO.test(c);
}

export function aliasDispositivoValido(a: string): boolean {
  return RE_ALIAS_DISPOSITIVO.test(a);
}

// ── Alias de paciente (helper PURO) ───────────────────────────────────────────
// ÁMBITO: por fisioterapeuta. Cada fisio lleva su propia numeración P-001, P-002... No usa nombre, DNI ni id de
// Firestore: solo un contador. NO REUTILIZABLE: el siguiente número es max(últimoEmitido, mayor existente) + 1,
// donde `ultimoEmitido` es la marca de agua persistida (high-water mark) del fisio; así, borrar al paciente con el
// número más alto no libera su alias. La PERSISTENCIA (campo `alias` del paciente y la marca de agua en un doc
// del fisio, asignada de forma transaccional) queda para PR5c-3; aquí no se cambia el modelo Patient.

export function numeroDeAliasPaciente(alias: string): number | null {
  const m = /^P-(\d{3,6})$/.exec(alias);
  return m ? parseInt(m[1], 10) : null;
}

export function formatearAliasPaciente(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999999) throw new RangeError("número de alias fuera de rango");
  return `P-${String(n).padStart(3, "0")}`;
}

export function siguienteAliasPaciente(
  existentes: Iterable<string>,
  ultimoEmitido = 0,
): { alias: string; numero: number } {
  let max = Number.isInteger(ultimoEmitido) && ultimoEmitido > 0 ? ultimoEmitido : 0;
  for (const a of existentes) {
    const n = numeroDeAliasPaciente(a);
    if (n !== null && n > max) max = n;
  }
  const numero = max + 1;
  return { alias: formatearAliasPaciente(numero), numero };
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type EstadoDispositivoVista = "pendiente" | "vinculado" | "revocado";

export interface DispositivoVista {
  uid: string;
  estado: EstadoDispositivoVista;
  alias: string | null;
  vinculadoEn: number | null;   // ms epoch
  revocadoEn: number | null;
}

/**
 * Configuración de la sesión que se publica en una Quest. Sin nombre del paciente ni datos personales.
 * NO lleva sessionId: lo genera el servicio (22 caracteres base64url, WebCrypto) para que nadie pueda fijarlo.
 */
export interface SesionParaDispositivo {
  patientId: string;       // pid opaco de 22 caracteres (identificadorParaQuest().patientId); nunca el id de Firestore
  patientAlias: string;    // P-001
  gameId: JuegoId;
  duration: number;        // segundos configurados, entero 1..7200
  difficulty: string;
  therapySide: string;
  sessionType: string;
}

export interface OpcionesPublicacion {
  /** Vigencia para INICIAR la sesión, en ms (por defecto 20 min; máximo 55 min: las reglas aceptan hasta 1 h). */
  ttlMs?: number;
}

export const TTL_SESION_POR_DEFECTO_MS = 20 * 60_000;
export const TTL_SESION_MAXIMO_MS = 55 * 60_000;
/** Holgura ante desfase del reloj del navegador al decidir «vencida» o «plazo cumplido» (las reglas usan la hora del servidor). */
export const MARGEN_RELOJ_MS = 5_000;
/** Plazos del contrato (espejo de rules.next): cierre forzado de una running y de una cancel_requested. */
export const GRACIA_CIERRE_MS = 30 * 60_000;
export const PLAZO_CANCELACION_MS = 2 * 60_000;

export type EstadoRegistro =
  | "pending" | "running" | "cancel_requested" | "completed" | "interrupted" | "cancelled" | "vencida";

const ESTADOS_REGISTRO: readonly string[] =
  ["pending", "running", "cancel_requested", "completed", "interrupted", "cancelled", "vencida"];

/** Registro de sesión tal como lo ve la web (fechas en ms epoch; null si no existe o aún es una marca local). */
export interface RegistroVista {
  sessionId: string;
  deviceUid: string;
  patientId: string;
  patientAlias: string;
  gameId: string;
  duration: number;
  difficulty: string;
  therapySide: string;
  sessionType: string;
  status: EstadoRegistro;
  publicadaEn: number | null;
  venceEn: number | null;
  iniciadaEn: number | null;
  finalizadaEn: number | null;
  motivo: string | null;
  cierrePor: string | null;
  cancelSolicitadaEn: number | null;
  forzadoEn: number | null;
  forzadoMotivo: string | null;
  resultadoEn: number | null;
  tardio: boolean;
}

/** Estado derivado para mostrar (nunca «en línea»: no hay presencia). */
export type EstadoVistaSesion =
  | "pendiente"               // pending y no vencida
  | "vencida"                 // pending con ahora >= venceEn, o status 'vencida'
  | "en_curso"                // running
  | "cancelacion_solicitada"  // cancel_requested
  | "completada"
  | "interrumpida"
  | "cancelada"
  | "sin_respuesta"           // cierre forzado por la web, sin resultado de la Quest
  | "resultado_tardio";       // cierre forzado y la Quest entregó después su resultado

/**
 * Estado de vista PURO a partir del registro y la hora local. `vencida` se DERIVA aquí (las reglas no se ejecutan
 * solas); la hora del servidor manda al escribir. Un `completed` con tardio=true sigue siendo «completada»
 * (el indicador tardio está en el registro).
 */
export function estadoVista(r: Pick<RegistroVista, "status" | "venceEn" | "motivo" | "resultadoEn">, ahoraMs: number): EstadoVistaSesion {
  switch (r.status) {
    case "pending": return r.venceEn !== null && ahoraMs >= r.venceEn ? "vencida" : "pendiente";
    case "vencida": return "vencida";
    case "running": return "en_curso";
    case "cancel_requested": return "cancelacion_solicitada";
    case "completed": return "completada";
    case "cancelled": return "cancelada";
    case "interrupted":
      if (r.motivo === "sin_respuesta") return r.resultadoEn !== null ? "resultado_tardio" : "sin_respuesta";
      return "interrumpida";
    default: return "interrumpida";
  }
}

const RE_SESSION_ID = /^[A-Za-z0-9_-]{22}$/;

/** sessionId aleatorio de 22 caracteres base64url (128 bits de WebCrypto). Misma construcción que el pid. */
export function generarSessionId(fuente?: FuenteBytes): string {
  return generarPid(fuente);
}

const CLAVES_SESION = ["patientId", "patientAlias", "gameId", "duration", "difficulty",
  "therapySide", "sessionType"] as const;

function textoAcotado(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length >= 1 && v.length <= max;
}

/** Valida y reconstruye la sesión con lista blanca de claves. Lanza sesion_invalida (p. ej. si trae patientName). */
export function validarSesionParaDispositivo(s: SesionParaDispositivo): SesionParaDispositivo {
  const obj = s as unknown as Record<string, unknown>;
  if (obj === null || typeof obj !== "object") throw err("sesion_invalida");
  const extra = Object.keys(obj).filter((k) => !(CLAVES_SESION as readonly string[]).includes(k));
  if (extra.length) throw err("sesion_invalida", `Campos no permitidos: ${extra.join(", ")}.`);
  // El patientId que ve la Quest es SIEMPRE el pid opaco (22 car. base64url): se rechazan nombres, ids de Firestore y ids cortos.
  if (!pidValido(s.patientId)) throw err("sesion_invalida", "patientId debe ser el pid opaco de 22 caracteres.");
  if (typeof s.patientAlias !== "string" || !RE_ALIAS_PACIENTE.test(s.patientAlias)) {
    throw err("sesion_invalida", "patientAlias debe ser del tipo P-001.");
  }
  if (!(JUEGOS_VALIDOS as readonly string[]).includes(s.gameId)) throw err("sesion_invalida", "gameId.");
  if (!Number.isInteger(s.duration) || s.duration < 1 || s.duration > 7200) throw err("sesion_invalida", "duration.");
  if (!textoAcotado(s.difficulty, 20)) throw err("sesion_invalida", "difficulty.");
  if (!textoAcotado(s.therapySide, 20)) throw err("sesion_invalida", "therapySide.");
  if (!textoAcotado(s.sessionType, 30)) throw err("sesion_invalida", "sessionType.");
  return {
    patientId: s.patientId, patientAlias: s.patientAlias, gameId: s.gameId,
    duration: s.duration, difficulty: s.difficulty, therapySide: s.therapySide, sessionType: s.sessionType,
  };
}

/** Motivo del cierre forzado: recortado y de 5 a 200 caracteres (code points, como size() de las reglas). */
export function motivoForzadoValido(m: unknown): m is string {
  if (typeof m !== "string") return false;
  const n = Array.from(m).length;
  return n >= 5 && n <= 200;
}

function aRegistroVista(id: string, d: Record<string, unknown>): RegistroVista | null {
  if (typeof d.status !== "string" || !ESTADOS_REGISTRO.includes(d.status)) return null;
  const s = (k: string): string => (typeof d[k] === "string" ? (d[k] as string) : "");
  const sn = (k: string): string | null => (typeof d[k] === "string" ? (d[k] as string) : null);
  return {
    sessionId: id, deviceUid: s("deviceUid"), patientId: s("patientId"), patientAlias: s("patientAlias"),
    gameId: s("gameId"), duration: typeof d.duration === "number" ? d.duration : 0,
    difficulty: s("difficulty"), therapySide: s("therapySide"), sessionType: s("sessionType"),
    status: d.status as EstadoRegistro, publicadaEn: aMs(d.publicadaEn), venceEn: aMs(d.venceEn),
    iniciadaEn: aMs(d.iniciadaEn), finalizadaEn: aMs(d.finalizadaEn), motivo: sn("motivo"), cierrePor: sn("cierrePor"),
    cancelSolicitadaEn: aMs(d.cancelSolicitadaEn), forzadoEn: aMs(d.forzadoEn), forzadoMotivo: sn("forzadoMotivo"),
    resultadoEn: aMs(d.resultadoEn), tardio: d.tardio === true,
  };
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export interface AuthMinimo {
  currentUser: { uid: string; isAnonymous: boolean } | null;
}

export interface DepsDispositivos {
  db: Firestore;
  auth: AuthMinimo;
  /** Reloj inyectable (ms epoch). Por defecto Date.now. */
  ahora?: () => number;
  /** Generador de sessionId (22 car. base64url). Inyectable en pruebas; por defecto WebCrypto. */
  generarSessionId?: () => string;
  /** Ejecuta el commit de un batch. Inyectable en pruebas (fallos de red, resultado desconocido). Por defecto batch.commit(). */
  ejecutarCommit?: (batch: WriteBatch) => Promise<void>;
  /** Tope de cada lectura previa al servidor (ms). Por defecto 8000. */
  tiempoLecturaMs?: number;
  /** Tope de espera de una escritura (ms); al agotarse: resultado_desconocido. Por defecto 20000. */
  tiempoEscrituraMs?: number;
}

const COL_DISPOSITIVOS = "dispositivos";
const COL_VINCULOS = "vinculos";
const SUB_SESION_ACTIVA = "sesion_activa";
const SUB_REGISTRO = "sesiones_registro";
const DOC_SESION = "current";

function conTope<T>(p: Promise<T>, ms: number, alVencer: () => Error): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rej) => { t = setTimeout(() => rej(alVencer()), ms); });
  p.catch(() => undefined); // si pierde la carrera, que su rechazo tardío no quede sin tratar
  return Promise.race([p, limite]).finally(() => clearTimeout(t));
}

function aMs(v: unknown): number | null {
  return v instanceof Timestamp ? v.toMillis() : null;
}

export function crearServicioDispositivos(deps: DepsDispositivos) {
  const { db, auth } = deps;
  const ahora = deps.ahora ?? (() => Date.now());

  /** Usuario no anónimo. El rol/verificación los decide el servidor (reglas). */
  function clinicoActual(): string {
    const u = auth.currentUser;
    if (!u) throw err("sin_sesion");
    if (u.isAnonymous) throw err("sin_permiso");
    return u.uid;
  }

  async function envolver<T>(f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (e) {
      throw clasificarErrorDispositivo(e);
    }
  }

  /** 1. Confirma un vínculo pendiente de forma atómica (batch de 2 escrituras). */
  async function confirmarVinculo(codigoEntrada: string, alias?: string): Promise<{ deviceUid: string; alias: string | null }> {
    const uid = clinicoActual();
    const codigo = normalizarCodigo(codigoEntrada);
    if (!codigoValido(codigo)) throw err("codigo_invalido");
    let aliasLimpio: string | null = null;
    if (alias !== undefined && alias !== null && alias.trim() !== "") {
      aliasLimpio = alias.trim();
      if (!aliasDispositivoValido(aliasLimpio)) throw err("alias_invalido");
    }
    return envolver(async () => {
      const refVinc = doc(db, COL_VINCULOS, codigo);
      const sv = await getDoc(refVinc);
      if (!sv.exists()) throw err("vinculo_inexistente");
      const v = sv.data();
      if (v.estado === "vinculado" || v.usado === true) throw err("vinculo_usado");
      if (v.estado !== "pendiente") throw err("vinculo_no_pendiente");
      const expira = aMs(v.expira);
      if (expira === null || ahora() >= expira) throw err("vinculo_caducado");
      const deviceUid = String(v.deviceUid ?? "");
      if (!deviceUid) throw err("vinculo_no_pendiente");

      const refDisp = doc(db, COL_DISPOSITIVOS, deviceUid);
      const sd = await getDoc(refDisp);
      if (!sd.exists()) throw err("dispositivo_inexistente");
      const d = sd.data();
      if (d.estado === "revocado") throw err("dispositivo_revocado");
      if (d.estado === "vinculado") throw err("dispositivo_ya_vinculado");
      if (d.codigoActual !== codigo) throw err("vinculo_obsoleto");

      const batch = writeBatch(db);
      batch.update(refVinc, {
        estado: "vinculado", usado: true, confirmadoPor: uid, confirmadoEn: serverTimestamp(),
      });
      const cambiosDisp: { [campo: string]: string | FieldValue } = {
        estado: "vinculado", ownerUid: uid, vinculadoEn: serverTimestamp(),
      };
      if (aliasLimpio !== null) cambiosDisp.alias = aliasLimpio;
      batch.update(refDisp, cambiosDisp);
      try {
        await batch.commit();
      } catch (e) {
        // Carrera (otro clínico confirmó entre la lectura y el commit): se refina el motivo si es posible.
        const c = clasificarErrorDispositivo(e);
        if (c.codigo === "permiso_denegado") {
          try {
            const s2 = await getDoc(refVinc);
            if (s2.exists() && (s2.data().usado === true || s2.data().estado === "vinculado")) {
              throw err("vinculo_usado", undefined, e);
            }
          } catch (e2) {
            if (e2 instanceof ErrorDispositivo) throw e2;
          }
        }
        throw c;
      }
      return { deviceUid, alias: aliasLimpio };
    });
  }

  function aVista(id: string, d: Record<string, unknown>): DispositivoVista | null {
    const e = d.estado;
    const estado: EstadoDispositivoVista | null =
      e === "vinculado" ? "vinculado" : e === "revocado" ? "revocado" : e === "sin_vincular" ? "pendiente" : null;
    if (!estado) return null;
    return {
      uid: id, estado, alias: typeof d.alias === "string" ? d.alias : null,
      vinculadoEn: aMs(d.vinculadoEn), revocadoEn: aMs(d.revocadoEn),
    };
  }

  function consultaMisDispositivos(uid: string) {
    // ÚNICA forma de list permitida por las reglas: filtrar por ownerUid == auth.uid.
    return query(collection(db, COL_DISPOSITIVOS), where("ownerUid", "==", uid));
  }

  /** 2a. Suscripción en tiempo real. Estados: pendiente/vinculado/revocado (NO "en línea": no hay presencia). */
  function listarMisDispositivos(
    cb: (d: DispositivoVista[]) => void,
    onError?: (e: ErrorDispositivo) => void,
  ): Unsubscribe {
    const uid = clinicoActual();
    return onSnapshot(
      consultaMisDispositivos(uid),
      (snap) => cb(snap.docs.map((x) => aVista(x.id, x.data())).filter((x): x is DispositivoVista => x !== null)),
      (e) => { if (onError) onError(clasificarErrorDispositivo(e)); },
    );
  }

  /** 2b. Consulta puntual. */
  async function listarMisDispositivosUnaVez(): Promise<DispositivoVista[]> {
    const uid = clinicoActual();
    return envolver(async () => {
      const snap = await getDocs(consultaMisDispositivos(uid));
      return snap.docs.map((x) => aVista(x.id, x.data())).filter((x): x is DispositivoVista => x !== null);
    });
  }

  /** 3. Solo alias (las reglas de dispositivos no permiten updatedAt: affectedKeys debe ser ['alias']). */
  async function renombrarDispositivo(deviceUid: string, alias: string): Promise<void> {
    clinicoActual();
    const a = String(alias ?? "").trim();
    if (!aliasDispositivoValido(a)) throw err("alias_invalido");
    if (!RE_ID_OPACO.test(deviceUid)) throw err("dispositivo_inexistente");
    return envolver(() => updateDoc(doc(db, COL_DISPOSITIVOS, deviceUid), { alias: a }));
  }

  /** 4. vinculado -> revocado (terminal). No borra nada: ni dispositivo, ni sesiones, ni resultados. */
  async function revocarDispositivo(deviceUid: string): Promise<void> {
    clinicoActual();
    if (!RE_ID_OPACO.test(deviceUid)) throw err("dispositivo_inexistente");
    return envolver(() =>
      updateDoc(doc(db, COL_DISPOSITIVOS, deviceUid), { estado: "revocado", revocadoEn: serverTimestamp() }));
  }

  // ── Ciclo de vida de sesión (PR5c-3b-2) ──────────────────────────────────────

  const generarId = deps.generarSessionId ?? (() => generarSessionId());
  const commitar = deps.ejecutarCommit ?? ((b: WriteBatch) => b.commit());
  const tLectura = deps.tiempoLecturaMs ?? 8000;
  const tEscritura = deps.tiempoEscrituraMs ?? 20000;

  const refDisp = (u: string) => doc(db, COL_DISPOSITIVOS, u);
  const refReg = (u: string, s: string) => doc(db, COL_DISPOSITIVOS, u, SUB_REGISTRO, s);
  const refCur = (u: string) => doc(db, COL_DISPOSITIVOS, u, SUB_SESION_ACTIVA, DOC_SESION);

  function idDispositivo(deviceUid: string): void {
    if (typeof deviceUid !== "string" || !RE_ID_OPACO.test(deviceUid)) throw err("dispositivo_inexistente");
  }
  function idSesion(sessionId: string): void {
    if (typeof sessionId !== "string" || !RE_SESSION_ID.test(sessionId)) throw err("sesion_invalida", "sessionId.");
  }

  /** Lectura AL SERVIDOR con tope (nunca decide con caché). Fallo de red -> red; denegado -> permiso_denegado. */
  function leerServidor(ref: ReturnType<typeof doc>) {
    return conTope(getDocFromServer(ref), tLectura, () => err("red"));
  }

  async function cargarRegistro(deviceUid: string, sessionId: string): Promise<RegistroVista> {
    const s = await leerServidor(refReg(deviceUid, sessionId));
    if (!s.exists()) throw err("sesion_inexistente");
    const r = aRegistroVista(s.id, s.data() as Record<string, unknown>);
    if (!r) throw err("sesion_inexistente", "Estado de registro desconocido.");
    return r;
  }

  /**
   * Ejecuta UNA escritura. Denegada -> relee y reclasifica (nunca asume el motivo). Red o tiempo agotado ->
   * resultado_desconocido (pudo aplicarse; NO se repite aquí). El resto se clasifica sin ocultar permisos.
   */
  async function escribir(
    sessionId: string,
    ejecutar: () => Promise<void>,
    reclasificar: (original: ErrorDispositivo) => Promise<ErrorDispositivo>,
  ): Promise<void> {
    try {
      await conTope(ejecutar(), tEscritura, () => err("resultado_desconocido", undefined, undefined, sessionId));
    } catch (e) {
      if (e instanceof ErrorDispositivo) throw e;
      const c = clasificarErrorDispositivo(e);
      if (c.codigo === "red") throw err("resultado_desconocido", undefined, e, sessionId);
      if (c.codigo === "permiso_denegado") throw await reclasificar(c);
      throw c;
    }
  }

  /** Comprobación previa de publicación (ayuda de UX; las reglas deciden). Devuelve la pending vencida a marcar. */
  async function comprobarPublicable(uid: string, deviceUid: string): Promise<{ vencerSid: string | null }> {
    const sd = await leerServidor(refDisp(deviceUid));
    if (!sd.exists()) throw err("dispositivo_inexistente");
    const d = sd.data();
    if (d.ownerUid !== uid) throw err("dispositivo_no_propio");
    if (d.estado !== "vinculado") throw err("dispositivo_no_vinculado");
    const sc = await leerServidor(refCur(deviceUid));
    if (!sc.exists()) return { vencerSid: null };
    const sidPrev = (sc.data() as { sessionId?: unknown }).sessionId;
    if (typeof sidPrev !== "string" || !RE_SESSION_ID.test(sidPrev)) {
      throw err("sesion_inexistente", "El buzón apunta a un identificador inválido.");
    }
    const r = await cargarRegistro(deviceUid, sidPrev);
    if (r.status === "running" || r.status === "cancel_requested") throw err("sesion_en_curso", undefined, undefined, sidPrev);
    if (r.status === "pending") {
      if (r.venceEn !== null && ahora() >= r.venceEn + MARGEN_RELOJ_MS) return { vencerSid: sidPrev };
      throw err("sesion_pendiente_viva", undefined, undefined, sidPrev);
    }
    return { vencerSid: null }; // completed / interrupted / cancelled / vencida: terminal
  }

  /**
   * 5. Publica una sesión nueva en un dispositivo PROPIO y VINCULADO: UN writeBatch atómico con
   *    create del registro (13 claves) + set del buzón {sessionId, publicadaEn, venceEn} + (si la anterior era una
   *    pending vencida) update de esa a 'vencida'. Nunca pisa una sesión viva (D11): sesion_en_curso / sesion_pendiente_viva.
   */
  async function publicarSesionEnDispositivo(
    deviceUid: string,
    sesion: SesionParaDispositivo,
    opciones: OpcionesPublicacion = {},
  ): Promise<{ sessionId: string; venceEn: number; vencidaAnterior: string | null }> {
    const uid = clinicoActual();
    idDispositivo(deviceUid);
    const limpia = validarSesionParaDispositivo(sesion);
    const ttl = opciones.ttlMs ?? TTL_SESION_POR_DEFECTO_MS;
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > TTL_SESION_MAXIMO_MS) {
      throw err("sesion_invalida", "La vigencia debe ser > 0 y <= 55 min.");
    }
    return envolver(async () => {
      const previo = await comprobarPublicable(uid, deviceUid);
      const sessionId = generarId();
      if (typeof sessionId !== "string" || !RE_SESSION_ID.test(sessionId)) throw err("sesion_invalida", "sessionId generado.");
      const venceEnMs = ahora() + ttl;
      const venceEn = Timestamp.fromMillis(venceEnMs); // Timestamp real; regla: (request.time, request.time + 1 h]
      const batch = writeBatch(db);
      if (previo.vencerSid) {
        batch.update(refReg(deviceUid, previo.vencerSid), {
          status: "vencida", finalizadaEn: serverTimestamp(), motivo: "vencida",
        });
      }
      batch.set(refReg(deviceUid, sessionId), {
        ...limpia, sessionId, deviceUid, ownerUid: uid,
        publicadaEn: serverTimestamp(), venceEn, status: "pending",
      });
      batch.set(refCur(deviceUid), { sessionId, publicadaEn: serverTimestamp(), venceEn });
      await escribir(sessionId, () => commitar(batch), async (original) => {
        try { await comprobarPublicable(uid, deviceUid); } catch (e2) { if (e2 instanceof ErrorDispositivo) return e2; }
        return original;
      });
      return { sessionId, venceEn: venceEnMs, vencidaAnterior: previo.vencerSid };
    });
  }

  type Cambios = { [campo: string]: string | FieldValue };

  /** Transición del registro iniciada por el propietario: lectura previa + validación + updateDoc con hasOnly exacto. */
  async function transicion(
    deviceUid: string,
    sessionId: string,
    validar: (r: RegistroVista, ahoraMs: number) => void,
    cambios: (uid: string) => Cambios,
    denegadoPeseAValidar: CodigoErrorDispositivo | null = null,
  ): Promise<void> {
    const uid = clinicoActual();
    idDispositivo(deviceUid);
    idSesion(sessionId);
    return envolver(async () => {
      const r = await cargarRegistro(deviceUid, sessionId);
      validar(r, ahora());
      await escribir(sessionId, () => updateDoc(refReg(deviceUid, sessionId), cambios(uid)), async (original) => {
        try {
          const r2 = await cargarRegistro(deviceUid, sessionId);
          validar(r2, ahora());
          if (denegadoPeseAValidar) return err(denegadoPeseAValidar, undefined, original, sessionId);
        } catch (e2) { if (e2 instanceof ErrorDispositivo) return e2; }
        return original;
      });
    });
  }

  /** 6a. pending -> cancelled. Si la Quest ya la inició, sesion_no_cancelable: usar solicitarCancelacion. */
  function cancelarSesion(deviceUid: string, sessionId: string): Promise<void> {
    return transicion(
      deviceUid, sessionId,
      (r) => { if (r.status !== "pending") throw err("sesion_no_cancelable", undefined, undefined, r.sessionId); },
      (uid) => ({ status: "cancelled", finalizadaEn: serverTimestamp(), motivo: "cancelada_por_web", cierrePor: uid }),
    );
  }

  /** 6b. running -> cancel_requested (la Quest la cierra como interrupted/cancelada_por_web). */
  function solicitarCancelacion(deviceUid: string, sessionId: string): Promise<void> {
    return transicion(
      deviceUid, sessionId,
      (r) => { if (r.status !== "running") throw err("sesion_no_cancelable", undefined, undefined, r.sessionId); },
      (uid) => ({ status: "cancel_requested", cancelSolicitadaEn: serverTimestamp(), cancelSolicitadaPor: uid }),
    );
  }

  /**
   * 7. Cierre forzado (solo propietario; sin rama admin): running pasados duration + 30 min, o cancel_requested pasados
   * 2 min. Motivo 5..200. Set-once: tras forzar el registro es interrupted/sin_respuesta y no se vuelve a forzar.
   */
  function forzarCierre(deviceUid: string, sessionId: string, motivo: string): Promise<void> {
    const m = typeof motivo === "string" ? motivo.trim() : "";
    if (!motivoForzadoValido(m)) return Promise.reject(err("motivo_invalido"));
    return transicion(
      deviceUid, sessionId,
      (r, t) => {
        if (r.status === "running") {
          if (r.iniciadaEn === null || t <= r.iniciadaEn + r.duration * 1000 + GRACIA_CIERRE_MS + MARGEN_RELOJ_MS) {
            throw err("plazo_no_cumplido", undefined, undefined, r.sessionId);
          }
        } else if (r.status === "cancel_requested") {
          if (r.cancelSolicitadaEn === null || t <= r.cancelSolicitadaEn + PLAZO_CANCELACION_MS + MARGEN_RELOJ_MS) {
            throw err("plazo_no_cumplido", undefined, undefined, r.sessionId);
          }
        } else {
          throw err("sesion_no_cancelable", undefined, undefined, r.sessionId);
        }
      },
      (uid) => ({
        status: "interrupted", finalizadaEn: serverTimestamp(), motivo: "sin_respuesta", cierrePor: uid,
        forzadoPor: uid, forzadoEn: serverTimestamp(), forzadoMotivo: m,
      }),
      "plazo_no_cumplido",
    );
  }

  /** 8. Traza explícita 'vencida' de una pending caducada (sin botón de UI; al publicar se hace sola en el batch). */
  function marcarVencida(deviceUid: string, sessionId: string): Promise<void> {
    return transicion(
      deviceUid, sessionId,
      (r, t) => {
        if (r.status !== "pending") throw err("sesion_no_cancelable", undefined, undefined, r.sessionId);
        if (r.venceEn === null || t < r.venceEn + MARGEN_RELOJ_MS) throw err("sesion_pendiente_viva", undefined, undefined, r.sessionId);
      },
      () => ({ status: "vencida", finalizadaEn: serverTimestamp(), motivo: "vencida" }),
      "sesion_pendiente_viva",
    );
  }

  /** Lectura puntual (servidor) del registro; null si no existe. Sirve para reconciliar tras resultado_desconocido. */
  async function leerRegistro(deviceUid: string, sessionId: string): Promise<RegistroVista | null> {
    clinicoActual();
    idDispositivo(deviceUid);
    idSesion(sessionId);
    return envolver(async () => {
      try { return await cargarRegistro(deviceUid, sessionId); } catch (e) {
        if (e instanceof ErrorDispositivo && e.codigo === "sesion_inexistente") return null;
        throw e;
      }
    });
  }

  /** Lectura puntual (servidor) de la sesión vigente según el buzón; null si no hay buzón. */
  async function leerSesionVigente(deviceUid: string): Promise<RegistroVista | null> {
    clinicoActual();
    idDispositivo(deviceUid);
    return envolver(async () => {
      const sc = await leerServidor(refCur(deviceUid));
      if (!sc.exists()) return null;
      const sid = (sc.data() as { sessionId?: unknown }).sessionId;
      if (typeof sid !== "string" || !RE_SESSION_ID.test(sid)) return null;
      try { return await cargarRegistro(deviceUid, sid); } catch (e) {
        if (e instanceof ErrorDispositivo && e.codigo === "sesion_inexistente") return null;
        throw e;
      }
    });
  }

  /** Suscripción a un registro concreto (null si no existe). Sin presencia: no hay «en línea». */
  function suscribirRegistro(
    deviceUid: string,
    sessionId: string,
    cb: (r: RegistroVista | null) => void,
    onError?: (e: ErrorDispositivo) => void,
  ): Unsubscribe {
    clinicoActual();
    idDispositivo(deviceUid);
    idSesion(sessionId);
    return onSnapshot(
      refReg(deviceUid, sessionId),
      (s) => cb(s.exists() ? aRegistroVista(s.id, s.data() as Record<string, unknown>) : null),
      (e) => { if (onError) onError(clasificarErrorDispositivo(e)); },
    );
  }

  /** Suscripción a la sesión VIGENTE: sigue el buzón y, a su vez, el registro apuntado (cambia solo si cambia el sessionId). */
  function suscribirSesionVigente(
    deviceUid: string,
    cb: (r: RegistroVista | null) => void,
    onError?: (e: ErrorDispositivo) => void,
  ): Unsubscribe {
    clinicoActual();
    idDispositivo(deviceUid);
    let activo = true;
    let sidActual: string | null = null;
    let bajaReg: Unsubscribe | null = null;
    const cerrarReg = () => { if (bajaReg) bajaReg(); bajaReg = null; sidActual = null; };
    const falla = (e: unknown) => { if (activo && onError) onError(clasificarErrorDispositivo(e)); };
    const bajaCur = onSnapshot(
      refCur(deviceUid),
      (s) => {
        if (!activo) return;
        const sid = s.exists() ? (s.data() as { sessionId?: unknown }).sessionId : null;
        if (typeof sid !== "string" || !RE_SESSION_ID.test(sid)) { cerrarReg(); cb(null); return; }
        if (sid === sidActual) return;
        cerrarReg();
        sidActual = sid;
        bajaReg = onSnapshot(
          refReg(deviceUid, sid),
          (r) => { if (activo && sidActual === sid) cb(r.exists() ? aRegistroVista(r.id, r.data() as Record<string, unknown>) : null); },
          falla,
        );
      },
      falla,
    );
    return () => { activo = false; cerrarReg(); bajaCur(); };
  }

  return {
    confirmarVinculo, listarMisDispositivos, listarMisDispositivosUnaVez, renombrarDispositivo,
    revocarDispositivo, publicarSesionEnDispositivo, cancelarSesion, solicitarCancelacion, forzarCierre,
    marcarVencida, leerRegistro, leerSesionVigente, suscribirRegistro, suscribirSesionVigente,
  };
}

export type ServicioDispositivos = ReturnType<typeof crearServicioDispositivos>;
