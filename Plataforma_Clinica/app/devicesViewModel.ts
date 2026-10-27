// ─── VIEW-MODEL DE «DISPOSITIVOS VR» (PR5c-2) ─────────────────────────────────
// Lógica PURA de la pantalla: sin React, sin Firebase, sin DOM. Se prueba con `node --test`
// (Node >= 22.18 importa TypeScript "borrable"; por eso las importaciones locales llevan extensión .ts).
//
// Reglas de producto:
//  - Lenguaje para un fisioterapeuta: «Quest», «gafas», «código». Nada de «uid», «documento», «regla».
//  - Nunca se afirma presencia: «Vinculada» NO significa conectada ni «en línea» (no hay presencia en el modelo).
//  - Los mensajes de error se construyen AQUÍ a partir de `ErrorDispositivo.codigo`. No se muestra `message`
//    ni `causa` del error (pueden contener rutas o datos internos) ni se vuelcan a la consola.
//  - Las comprobaciones de cliente son ayuda de UX; la autoridad son las reglas de Firestore.
import {
  normalizarCodigo, codigoValido, aliasDispositivoValido,
  type CodigoErrorDispositivo, type DispositivoVista, type EstadoDispositivoVista,
} from "./devices.ts";

export type { CodigoErrorDispositivo, DispositivoVista, EstadoDispositivoVista };

// ── Código de vinculación ────────────────────────────────────────────────────

export const LONGITUD_CODIGO = 8;
export const MAX_ALIAS = 30;
/** Alfabeto del código (coincide con las reglas): sin 0, O, 1, I ni L. */
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Lo que se guarda en el campo mientras el usuario teclea: mayúsculas, sin espacios ni guiones, máximo 8 símbolos.
 * Acepta «abcd-efgh», «ABCD EFGH», pegado con espacios, etc.
 */
export function limpiarEntradaCodigo(entrada: string): string {
  return normalizarCodigo(entrada).slice(0, LONGITUD_CODIGO);
}

/** Cómo se muestra el código en el campo: ABCD-EFGH (el guion es solo visual). */
export function mostrarCodigo(codigoLimpio: string): string {
  const c = limpiarEntradaCodigo(codigoLimpio);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export type ResultadoCodigo =
  | { ok: true; codigo: string }
  | { ok: false; mensaje: string };

export function validarCodigoEntrada(entrada: string): ResultadoCodigo {
  const crudo = normalizarCodigo(entrada);
  if (crudo.length === 0) {
    return { ok: false, mensaje: "Escribe el código de 8 símbolos que muestra la Quest." };
  }
  const prohibidos = [...new Set(crudo.split("").filter((ch) => !ALFABETO_CODIGO.includes(ch)))];
  if (prohibidos.length > 0) {
    return {
      ok: false,
      mensaje: "El código solo usa letras y números, y nunca contiene 0, 1, O, I ni L. Revisa lo que has escrito.",
    };
  }
  if (crudo.length < LONGITUD_CODIGO) {
    const faltan = LONGITUD_CODIGO - crudo.length;
    return { ok: false, mensaje: `Faltan ${faltan} ${faltan === 1 ? "símbolo" : "símbolos"} para completar el código.` };
  }
  if (crudo.length > LONGITUD_CODIGO) {
    return { ok: false, mensaje: "El código tiene demasiados símbolos: son 8 en total." };
  }
  // Respaldo: la función de PR5c-1 es la referencia (espejo de las reglas).
  if (!codigoValido(crudo)) {
    return { ok: false, mensaje: "El código no tiene un formato válido. Revisa lo que has escrito." };
  }
  return { ok: true, codigo: crudo };
}

// ── Nombre (alias) de la Quest ───────────────────────────────────────────────

export type ResultadoAlias =
  | { ok: true; alias: string | null }
  | { ok: false; mensaje: string };

/**
 * `obligatorio` = true al renombrar (las reglas no permiten quitar el nombre); false al vincular (opcional).
 * Se recortan espacios de los extremos. Se aceptan letras (con tildes y ñ), números, espacios, punto, guion y guion bajo.
 */
export function validarAliasEntrada(entrada: string, obligatorio: boolean): ResultadoAlias {
  const a = String(entrada ?? "").trim();
  if (a === "") {
    return obligatorio
      ? { ok: false, mensaje: "Escribe un nombre para reconocer la Quest (de 1 a 30 caracteres)." }
      : { ok: true, alias: null };
  }
  if (a.length > MAX_ALIAS) {
    return { ok: false, mensaje: `El nombre es demasiado largo: máximo ${MAX_ALIAS} caracteres (ahora tiene ${a.length}).` };
  }
  if (!aliasDispositivoValido(a)) {
    return {
      ok: false,
      mensaje: "El nombre solo admite letras, números, espacios, punto, guion y guion bajo (por ejemplo «Quest consulta 1»).",
    };
  }
  return { ok: true, alias: a };
}

// ── Estados y etiquetas ──────────────────────────────────────────────────────

/** Estados de la pantalla (el estado «pendiente» NO es un dispositivo de la lista: es el flujo de vinculación). */
export type EstadoPantalla = "cargando" | "vacio" | "lista" | "error" | "sin_permisos";

export type IconoEstado = "check" | "ban";
export type TonoEstado = "green" | "gray";

export interface EtiquetaEstado {
  texto: string;
  icono: IconoEstado;
  color: TonoEstado;
  /** Frase breve para lectores de pantalla y subtítulo. Nunca habla de conexión. */
  descripcion: string;
}

export function etiquetaEstado(estado: EstadoDispositivoVista): EtiquetaEstado {
  switch (estado) {
    case "vinculado":
      return { texto: "Vinculada", icono: "check", color: "green", descripcion: "Asociada a tu cuenta; puede recibir sesiones." };
    case "revocado":
      return { texto: "Revocada", icono: "ban", color: "gray", descripcion: "Ya no recibe sesiones de tu cuenta." };
    default:
      // Un dispositivo pendiente no se lista (se filtra en `prepararLista`); texto neutro por seguridad.
      return { texto: "Sin vincular", icono: "ban", color: "gray", descripcion: "Todavía no está asociada a ninguna cuenta." };
  }
}

export const NOTA_VINCULADA_NO_CONECTADA =
  "Vinculada no significa conectada: aquí ves qué Quest están asociadas a tu cuenta, no si están encendidas ahora mismo.";

export function nombreDispositivo(d: Pick<DispositivoVista, "alias">): string {
  const a = d.alias?.trim();
  return a ? a : "Sin nombre";
}

export interface AccionesDispositivo {
  renombrar: boolean;
  revocar: boolean;
}

/** Revocado es terminal: no se renombra ni se vuelve a revocar (las reglas tampoco lo permiten). */
export function accionesPermitidas(estado: EstadoDispositivoVista): AccionesDispositivo {
  return estado === "vinculado" ? { renombrar: true, revocar: true } : { renombrar: false, revocar: false };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «12 de mayo de 2026». Usa la zona horaria local salvo que se indique `utc` (pruebas deterministas). */
export function formatearFecha(ms: number | null, utc = false): string | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  const f = new Date(ms);
  const d = utc ? f.getUTCDate() : f.getDate();
  const m = utc ? f.getUTCMonth() : f.getMonth();
  const a = utc ? f.getUTCFullYear() : f.getFullYear();
  return `${d} de ${MESES[m]} de ${a}`;
}

/** «Vinculada el …» / «Revocada el …» cuando la fecha existe; null si todavía no hay fecha. */
export function textoFechaDispositivo(d: DispositivoVista, utc = false): string | null {
  if (d.estado === "revocado") {
    const f = formatearFecha(d.revocadoEn, utc);
    return f ? `Revocada el ${f}` : null;
  }
  if (d.estado === "vinculado") {
    const f = formatearFecha(d.vinculadoEn, utc);
    return f ? `Vinculada el ${f}` : null;
  }
  return null;
}

/**
 * Lista que se muestra: solo vinculadas y revocadas (las pendientes son parte del flujo guiado, no de la lista).
 * Orden: vinculadas antes que revocadas; dentro de cada grupo, la más reciente primero; desempate estable por uid.
 */
export function prepararLista(entrada: readonly DispositivoVista[]): DispositivoVista[] {
  const peso = (e: EstadoDispositivoVista) => (e === "vinculado" ? 0 : 1);
  const fecha = (d: DispositivoVista) => (d.estado === "revocado" ? d.revocadoEn : d.vinculadoEn) ?? 0;
  return entrada
    .filter((d) => d.estado === "vinculado" || d.estado === "revocado")
    .slice()
    .sort((a, b) => peso(a.estado) - peso(b.estado) || fecha(b) - fecha(a) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}

// ── Errores ──────────────────────────────────────────────────────────────────

export type OperacionDispositivo = "cargar" | "vincular" | "renombrar" | "revocar";

export interface ErrorVista {
  mensaje: string;
  /** Si tiene sentido ofrecer «Reintentar» tal cual (fallos transitorios). Los de datos mal escritos se corrigen, no se reintentan. */
  reintentable: boolean;
  /** La operación no está permitida para esta cuenta: se explica y se oculta el flujo (no hay nada que corregir). */
  sinPermisos: boolean;
  /**
   * El servidor NO confirmó ni rechazó (sin conexión / tiempo agotado en el servicio): la operación puede haberse
   * completado. Se distingue de un fallo confirmado (permiso, código inválido...), donde seguro NO se completó.
   */
  resultadoDesconocido: boolean;
}

const OPERACION_VERBO: Record<OperacionDispositivo, string> = {
  cargar: "cargar tus Quest",
  vincular: "vincular la Quest",
  renombrar: "cambiar el nombre",
  revocar: "revocar la Quest",
};

interface EntradaMapa { mensaje: string | ((op: OperacionDispositivo) => string); reintentable: boolean; sinPermisos: boolean }

/**
 * Mapa EXHAUSTIVO: al ser un Record sobre el tipo de PR5c-1, añadir un código allí rompe la compilación aquí
 * hasta que se escriba su texto de interfaz.
 */
const MAPA_ERRORES: Record<CodigoErrorDispositivo, EntradaMapa> = {
  sin_sesion: { mensaje: "Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.", reintentable: false, sinPermisos: false },
  sin_permiso: { mensaje: "Esta cuenta no puede gestionar Quest. Entra con tu cuenta profesional.", reintentable: false, sinPermisos: true },
  permiso_denegado: {
    mensaje: (op) =>
      op === "vincular" || op === "cargar"
        ? "Tu cuenta no tiene permiso para gestionar Quest, o esta función todavía no está activada. Si crees que es un error, consulta con el administrador."
        : `No se pudo ${OPERACION_VERBO[op]}: no tienes permiso sobre esta Quest.`,
    reintentable: false,
    sinPermisos: true,
  },
  codigo_invalido: { mensaje: "El código no es válido. Son 8 letras y números, sin 0, 1, O, I ni L. Revísalo y vuelve a probar.", reintentable: false, sinPermisos: false },
  alias_invalido: { mensaje: "El nombre no es válido. Usa de 1 a 30 letras, números, espacios, punto, guion o guion bajo.", reintentable: false, sinPermisos: false },
  vinculo_inexistente: { mensaje: "No hay ninguna Quest esperando con ese código. Comprueba que lo has copiado bien de la pantalla de las gafas.", reintentable: false, sinPermisos: false },
  vinculo_caducado: { mensaje: "Ese código ha caducado. En las gafas, pide un código nuevo y escríbelo aquí.", reintentable: false, sinPermisos: false },
  vinculo_usado: { mensaje: "Ese código ya se ha utilizado. Si la Quest no aparece en tu lista, pide un código nuevo en las gafas.", reintentable: false, sinPermisos: false },
  vinculo_no_pendiente: { mensaje: "Ese código ya no está disponible. Pide un código nuevo en las gafas.", reintentable: false, sinPermisos: false },
  vinculo_obsoleto: { mensaje: "Las gafas han generado un código más reciente. Escribe el que muestran ahora.", reintentable: false, sinPermisos: false },
  dispositivo_inexistente: { mensaje: "No se ha encontrado esa Quest. Es posible que ya no esté disponible.", reintentable: false, sinPermisos: false },
  dispositivo_ya_vinculado: { mensaje: "Esa Quest ya está vinculada.", reintentable: false, sinPermisos: false },
  dispositivo_revocado: { mensaje: "Esa Quest está revocada. Para volver a usarla hay que vincularla de nuevo con un código nuevo desde la propia gafa.", reintentable: false, sinPermisos: false },
  dispositivo_no_propio: { mensaje: "Esa Quest no está vinculada a tu cuenta.", reintentable: false, sinPermisos: false },
  dispositivo_no_vinculado: { mensaje: "Esa Quest no está vinculada ahora mismo, así que no se puede hacer esta acción.", reintentable: false, sinPermisos: false },
  sesion_invalida: { mensaje: "No se pudo completar la operación por un problema interno. Inténtalo de nuevo más tarde.", reintentable: false, sinPermisos: false },
  sesion_en_curso: { mensaje: "Esa Quest tiene una sesión en curso. Espera a que termine o pide su cancelación antes de enviar otra.", reintentable: false, sinPermisos: false },
  sesion_pendiente_viva: { mensaje: "Esa Quest ya tiene una sesión pendiente de iniciar. Cancélala antes de enviar otra.", reintentable: false, sinPermisos: false },
  sesion_inexistente: { mensaje: "No se ha encontrado esa sesión. Actualiza la pantalla.", reintentable: false, sinPermisos: false },
  sesion_no_cancelable: { mensaje: "La sesión ya ha cambiado de estado y esta acción no es posible. Actualiza la pantalla para ver cómo está.", reintentable: false, sinPermisos: false },
  plazo_no_cumplido: { mensaje: "Todavía no ha pasado el tiempo de espera necesario para forzar el cierre de esta sesión.", reintentable: false, sinPermisos: false },
  motivo_invalido: { mensaje: "Escribe un motivo de entre 5 y 200 caracteres.", reintentable: false, sinPermisos: false },
  resultado_desconocido: { mensaje: "No se pudo confirmar si la acción se guardó por un fallo de conexión. Comprueba el estado de la sesión antes de repetirla.", reintentable: false, sinPermisos: false },
  red: { mensaje: (op) => `No hay conexión con el servidor y no se pudo ${OPERACION_VERBO[op]}. Comprueba tu conexión e inténtalo de nuevo.`, reintentable: true, sinPermisos: false },
  desconocido: { mensaje: (op) => `Algo ha fallado y no se pudo ${OPERACION_VERBO[op]}. Inténtalo de nuevo; si sigue ocurriendo, avisa al administrador.`, reintentable: true, sinPermisos: false },
};

export const CODIGOS_ERROR = Object.keys(MAPA_ERRORES) as CodigoErrorDispositivo[];

/**
 * Convierte cualquier cosa lanzada por el servicio en un texto de interfaz. Solo lee `codigo` (string);
 * jamás usa `message` ni `causa`. Lo que no se reconoce se trata como «desconocido».
 */
export function errorAVista(error: unknown, operacion: OperacionDispositivo): ErrorVista {
  const c = (error as { codigo?: unknown } | null)?.codigo;
  const codigo: CodigoErrorDispositivo =
    typeof c === "string" && Object.prototype.hasOwnProperty.call(MAPA_ERRORES, c) ? (c as CodigoErrorDispositivo) : "desconocido";
  const e = MAPA_ERRORES[codigo];
  return {
    mensaje: typeof e.mensaje === "function" ? e.mensaje(operacion) : e.mensaje,
    reintentable: e.reintentable,
    sinPermisos: e.sinPermisos,
    resultadoDesconocido: codigo === "red",
  };
}

/** Decide el estado de pantalla a partir de la carga. */
export function estadoDePantalla(entrada: {
  cargando: boolean; error: ErrorVista | null; dispositivos: readonly DispositivoVista[];
}): EstadoPantalla {
  if (entrada.error) return entrada.error.sinPermisos ? "sin_permisos" : "error";
  if (entrada.cargando) return "cargando";
  return prepararLista(entrada.dispositivos).length === 0 ? "vacio" : "lista";
}

// ── Textos de la interfaz ────────────────────────────────────────────────────

export const TEXTOS = {
  titulo: "Dispositivos VR",
  subtitulo: "Gestiona las gafas Meta Quest que usas con tus pacientes.",
  pasos: [
    "En las gafas, abre la aplicación de rehabilitación. Mostrará un código de 8 letras y números.",
    "Escribe aquí ese código (da igual si usas mayúsculas, minúsculas o el guion). El código caduca a los pocos minutos.",
    "Si quieres, ponle un nombre para reconocerla (por ejemplo «Quest consulta 1») y pulsa «Vincular».",
  ],
  revocarTitulo: (nombre: string) => `¿Revocar «${nombre}»?`,
  revocarCuerpo: [
    "La Quest dejará de recibir sesiones de tu cuenta.",
    "El historial de sesiones y resultados no se modifica.",
    "Para volver a usarla habrá que vincularla de nuevo con un código nuevo desde la propia gafa.",
  ],
  vinculadaOk: (alias: string | null) => (alias ? `Quest «${alias}» vinculada correctamente.` : "Quest vinculada correctamente."),
  renombradaOk: (alias: string) => `Nombre cambiado a «${alias}».`,
  revocadaOk: (nombre: string) => `«${nombre}» revocada. Ya no recibirá sesiones.`,
} as const;

// ── Operaciones lentas o sin conexión (resultado desconocido) ────────────────
// updateDoc / writeBatch.commit del SDK quedan PENDIENTES sin conexión (no rechazan). La pantalla no puede quedarse
// bloqueada: se espera un máximo y se informa de «resultado desconocido», que es distinto de «fallo confirmado».
// La operación NO se cancela (el SDK puede completarla después): se reconcilia al terminar.

export const LIMITE_ESPERA_MS = 15_000;

/** Temporizador inyectable (pruebas con reloj falso). */
export interface Temporizador {
  poner(fn: () => void, ms: number): unknown;
  quitar(handle: unknown): void;
}
export const TEMPORIZADOR_REAL: Temporizador = {
  poner: (fn, ms) => setTimeout(fn, ms),
  quitar: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export type ResultadoOperacion<T> =
  | { tipo: "ok"; valor: T }
  | { tipo: "rechazada"; error: ErrorVista }   // fallo CONFIRMADO: el servidor rechazó, seguro no se completó
  | { tipo: "desconocido" };                    // timeout o sin conexión: puede haberse completado

/**
 * Espera `promesa` hasta `ms`. No cancela la operación (sin AbortController en el SDK): si vence el plazo devuelve
 * «desconocido» y la promesa original sigue su curso (el llamador puede engancharse a ella). Nunca lanza.
 */
export function esperarConLimite<T>(
  promesa: Promise<T>, operacion: OperacionDispositivo, ms: number = LIMITE_ESPERA_MS, t: Temporizador = TEMPORIZADOR_REAL,
): Promise<ResultadoOperacion<T>> {
  return new Promise((resolver) => {
    let cerrado = false;
    const handle = t.poner(() => { if (!cerrado) { cerrado = true; resolver({ tipo: "desconocido" }); } }, ms);
    promesa.then(
      (valor) => { if (!cerrado) { cerrado = true; t.quitar(handle); resolver({ tipo: "ok", valor }); } },
      (e) => {
        if (cerrado) return;
        cerrado = true; t.quitar(handle);
        const v = errorAVista(e, operacion);
        resolver(v.resultadoDesconocido ? { tipo: "desconocido" } : { tipo: "rechazada", error: v });
      },
    );
  });
}

/** Qué se ofrece tras un resultado desconocido. Vincular y revocar NUNCA se repiten solos ni se ofrecen como reintento. */
export function accionesTrasDesconocido(op: "vincular" | "renombrar" | "revocar"): { comprobar: boolean; reintentarManual: boolean; reintentoAutomatico: false } {
  return { comprobar: true, reintentarManual: op === "renombrar", reintentoAutomatico: false };
}

export type Pendiente =
  | { tipo: "vincular"; uidsAntes: readonly string[]; alias: string | null }
  | { tipo: "renombrar"; uid: string; alias: string }
  | { tipo: "revocar"; uid: string; nombre: string };

/** ¿La lista actual refleja ya el efecto esperado de la operación pendiente? (Puede ser una vista local aún sin confirmar.) */
export function coincideEsperado(p: Pendiente, lista: readonly DispositivoVista[]): boolean {
  switch (p.tipo) {
    case "vincular": return lista.some((d) => d.estado === "vinculado" && !p.uidsAntes.includes(d.uid));
    case "renombrar": return lista.some((d) => d.uid === p.uid && d.estado === "vinculado" && d.alias === p.alias);
    case "revocar": return lista.some((d) => d.uid === p.uid && d.estado === "revocado");
  }
}

export const TEXTOS_DESCONOCIDO = {
  mensaje: "No hemos podido confirmar si se completó. Comprueba la lista antes de repetir.",
  reflejado: "La lista ya muestra el cambio, pero el servidor todavía no lo ha confirmado. No lo repitas: se confirmará solo cuando haya conexión.",
  noConsta: "Todavía no consta como completada. Si la conexión se recupera, puede completarse sola; comprueba la lista antes de repetir.",
  noSePudoComprobar: "No se pudo comprobar ahora mismo (sin conexión). Inténtalo de nuevo cuando se recupere.",
} as const;
