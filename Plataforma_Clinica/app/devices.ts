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
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
  serverTimestamp, Timestamp, writeBatch,
  type Firestore, type FieldValue, type Unsubscribe,
} from "firebase/firestore";

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
  | "red"
  | "desconocido";

export class ErrorDispositivo extends Error {
  codigo: CodigoErrorDispositivo;
  causa?: unknown;
  constructor(codigo: CodigoErrorDispositivo, mensaje: string, causa?: unknown) {
    super(mensaje);
    this.name = "ErrorDispositivo";
    this.codigo = codigo;
    this.causa = causa;
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
  red: "Sin conexión con el servidor. Inténtalo de nuevo.",
  desconocido: "Error inesperado.",
};

function err(codigo: CodigoErrorDispositivo, detalle?: string, causa?: unknown): ErrorDispositivo {
  return new ErrorDispositivo(codigo, detalle ? `${MENSAJES[codigo]} ${detalle}` : MENSAJES[codigo], causa);
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

/** Contenido EXACTO de la sesión activa por dispositivo. Sin nombre del paciente ni datos personales. */
export interface SesionParaDispositivo {
  sessionId: string;
  patientId: string;       // opaco
  patientAlias: string;    // P-001
  gameId: JuegoId;
  duration: number;        // segundos, entero 1..7200
  difficulty: string;
  therapySide: string;
  sessionType: string;
}

export interface OpcionesPublicacion {
  /** Vigencia de la sesión en ms (por defecto 8 h; máximo 23 h para dejar margen al desfase de reloj). */
  ttlMs?: number;
}

export const TTL_SESION_POR_DEFECTO_MS = 8 * 3600_000;
export const TTL_SESION_MAXIMO_MS = 23 * 3600_000;

const CLAVES_SESION = ["sessionId", "patientId", "patientAlias", "gameId", "duration", "difficulty",
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
  if (typeof s.sessionId !== "string" || !RE_ID_OPACO.test(s.sessionId)) throw err("sesion_invalida", "sessionId.");
  if (typeof s.patientId !== "string" || !RE_ID_OPACO.test(s.patientId)) throw err("sesion_invalida", "patientId.");
  if (typeof s.patientAlias !== "string" || !RE_ALIAS_PACIENTE.test(s.patientAlias)) {
    throw err("sesion_invalida", "patientAlias debe ser del tipo P-001.");
  }
  if (!(JUEGOS_VALIDOS as readonly string[]).includes(s.gameId)) throw err("sesion_invalida", "gameId.");
  if (!Number.isInteger(s.duration) || s.duration < 1 || s.duration > 7200) throw err("sesion_invalida", "duration.");
  if (!textoAcotado(s.difficulty, 20)) throw err("sesion_invalida", "difficulty.");
  if (!textoAcotado(s.therapySide, 20)) throw err("sesion_invalida", "therapySide.");
  if (!textoAcotado(s.sessionType, 30)) throw err("sesion_invalida", "sessionType.");
  return {
    sessionId: s.sessionId, patientId: s.patientId, patientAlias: s.patientAlias, gameId: s.gameId,
    duration: s.duration, difficulty: s.difficulty, therapySide: s.therapySide, sessionType: s.sessionType,
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
}

const COL_DISPOSITIVOS = "dispositivos";
const COL_VINCULOS = "vinculos";
const SUB_SESION_ACTIVA = "sesion_activa";
const DOC_SESION = "current";

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

  /** 5. Publica la sesión en un dispositivo PROPIO y VINCULADO. No toca la sesion_activa global de la raíz. */
  async function publicarSesionEnDispositivo(
    deviceUid: string,
    sesion: SesionParaDispositivo,
    opciones: OpcionesPublicacion = {},
  ): Promise<{ venceEn: number }> {
    const uid = clinicoActual();
    if (!RE_ID_OPACO.test(deviceUid)) throw err("dispositivo_inexistente");
    const limpia = validarSesionParaDispositivo(sesion);
    const ttl = opciones.ttlMs ?? TTL_SESION_POR_DEFECTO_MS;
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > TTL_SESION_MAXIMO_MS) {
      throw err("sesion_invalida", "La vigencia debe ser > 0 y <= 23 h.");
    }
    return envolver(async () => {
      const sd = await getDoc(doc(db, COL_DISPOSITIVOS, deviceUid));
      if (!sd.exists()) throw err("dispositivo_inexistente");
      const d = sd.data();
      if (d.ownerUid !== uid) throw err("dispositivo_no_propio");
      if (d.estado !== "vinculado") throw err("dispositivo_no_vinculado");
      const venceEnMs = ahora() + ttl;
      await setDoc(doc(db, COL_DISPOSITIVOS, deviceUid, SUB_SESION_ACTIVA, DOC_SESION), {
        ...limpia,
        status: "pending",
        publicadaEn: serverTimestamp(),            // regla: == request.time
        venceEn: Timestamp.fromMillis(venceEnMs),  // Timestamp real; regla: (request.time, request.time + 24 h]
      });
      return { venceEn: venceEnMs };
    });
  }

  /** 6. Borra la sesión activa del dispositivo (permitido al propietario aunque el dispositivo esté revocado). */
  async function limpiarSesion(deviceUid: string): Promise<void> {
    clinicoActual();
    if (!RE_ID_OPACO.test(deviceUid)) throw err("dispositivo_inexistente");
    return envolver(() => deleteDoc(doc(db, COL_DISPOSITIVOS, deviceUid, SUB_SESION_ACTIVA, DOC_SESION)));
  }

  return {
    confirmarVinculo, listarMisDispositivos, listarMisDispositivosUnaVez, renombrarDispositivo,
    revocarDispositivo, publicarSesionEnDispositivo, limpiarSesion, cancelarSesion: limpiarSesion,
  };
}

export type ServicioDispositivos = ReturnType<typeof crearServicioDispositivos>;
