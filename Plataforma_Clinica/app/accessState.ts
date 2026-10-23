// ─── ESTADO DE ACCESO A LA WEB CLÍNICA (PR5b) ────────────────────────────────
// Lógica pura, SIN imports de firebase ni de React (solo sintaxis "borrable" de TypeScript: node >= 22.18 puede
// importar este archivo directamente en las pruebas). La lectura de Firestore se inyecta (`deps.leerRol`).
//
// Refleja la función esClinico() de firestore.rules.next:
//   signedIn() && provider != 'anonymous' && email_verified == true && usuarios/{uid}.rol in ['fisioterapeuta','admin']
//
// FALLO CERRADO: cualquier error o dato inesperado deniega. Solo `rol_ok` permite montar la aplicación.

export type EstadoAcceso =
  | "cargando"
  | "sin_verificar_email"
  | "sin_rol"
  | "rol_ok"
  | "denegado"
  | "sesion_caducada"
  | "error_red";

export const ROLES_CLINICOS = ["fisioterapeuta", "admin"] as const;

/** Subconjunto de firebase/auth `User` que necesita la lógica (un User real lo cumple estructuralmente). */
export interface UsuarioAcceso {
  uid: string;
  isAnonymous: boolean;
  emailVerified: boolean;
  reload(): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  getIdTokenResult(forceRefresh?: boolean): Promise<{ claims: Record<string, unknown> }>;
}

export interface ClaimsAcceso {
  email_verified?: unknown;
  firebase?: { sign_in_provider?: unknown } | null;
  [k: string]: unknown;
}

export type LecturaRol =
  | { tipo: "doc"; existe: boolean; rol?: unknown }
  | { tipo: "error"; code?: string };

export interface EntradaAcceso {
  /** undefined: aún sin resolver la sesión; null: sin sesión. */
  user: Pick<UsuarioAcceso, "uid" | "isAnonymous" | "emailVerified"> | null | undefined;
  /** Claims del ID token. null: no se pudieron leer. undefined: aún no leídos. */
  claims?: ClaimsAcceso | null;
  /** Resultado de leer usuarios/{uid}. undefined: aún no leído. */
  lectura?: LecturaRol;
  /** true si ya se forzó un refresco del token (getIdToken(true)) en esta evaluación. */
  refrescado?: boolean;
  sesionCaducada?: boolean;
}

export interface ResultadoAcceso {
  estado: EstadoAcceso;
  rol?: string;
  /** Solo con estado "cargando": hay que forzar getIdToken(true) y volver a evaluar. */
  refrescar?: boolean;
  /** Solo con estado "cargando": el siguiente paso es leer usuarios/{uid}. */
  leer?: boolean;
}

const CODIGOS_RED = new Set([
  "unavailable", "deadline-exceeded", "auth/network-request-failed", "auth/timeout",
]);
const CODIGOS_SESION = new Set([
  "unauthenticated", "auth/user-token-expired", "auth/id-token-expired", "auth/id-token-revoked",
  "auth/requires-recent-login",
]);

/** Clasifica un código de error de Firebase (Firestore o Auth). Todo lo no listado es "otro" (-> denegado). */
export function clasificarErrorAcceso(code: string | undefined): "red" | "permiso" | "sesion" | "otro" {
  if (!code) return "otro";
  const c = code.startsWith("firestore/") ? code.slice("firestore/".length) : code;
  if (c === "permission-denied") return "permiso";
  if (CODIGOS_RED.has(c)) return "red";
  if (CODIGOS_SESION.has(c)) return "sesion";
  return "otro";
}

function estadoDeError(code: string | undefined): ResultadoAcceso {
  switch (clasificarErrorAcceso(code)) {
    case "red": return { estado: "error_red" };
    case "sesion": return { estado: "sesion_caducada" };
    default: return { estado: "denegado" }; // permission-denied y cualquier otro: fallo cerrado
  }
}

function esAnonimo(user: { isAnonymous: boolean }, claims: ClaimsAcceso | null | undefined): boolean {
  return user.isAnonymous === true || claims?.firebase?.sign_in_provider === "anonymous";
}

/** Función pura: decide el estado de acceso a partir de lo observado hasta ahora. */
export function resolverAcceso(e: EntradaAcceso): ResultadoAcceso {
  if (e.user === undefined) return { estado: "cargando" };
  if (e.user === null || e.sesionCaducada === true) return { estado: "sesion_caducada" };
  const { user, claims } = e;

  // (1) Anónimo (la gafa): nunca entra en la web clínica; no se lee nada.
  if (esAnonimo(user, claims)) return { estado: "denegado" };

  // (2) Correo sin verificar: sin lecturas de Firestore.
  if (user.emailVerified !== true) return { estado: "sin_verificar_email" };
  if (claims === undefined) return { estado: "cargando" };
  if (claims === null) {
    // No se pudo leer el token: el error (si lo hay) decide; sin información -> denegado.
    return e.lectura?.tipo === "error" ? estadoDeError(e.lectura.code) : { estado: "denegado" };
  }
  if (claims.email_verified !== true) {
    // El SDK dice verificado pero el token aún no: refrescar una vez; si persiste, sigue sin verificar.
    return e.refrescado ? { estado: "sin_verificar_email" } : { estado: "cargando", refrescar: true };
  }

  // (3) Rol en usuarios/{uid}
  const l = e.lectura;
  if (l === undefined) return { estado: "cargando", leer: true };
  if (l.tipo === "error") return estadoDeError(l.code);
  if (!l.existe) return { estado: "sin_rol" };
  if (typeof l.rol !== "string") return { estado: "denegado" }; // dato inesperado
  if ((ROLES_CLINICOS as readonly string[]).includes(l.rol)) return { estado: "rol_ok", rol: l.rol };
  return { estado: "sin_rol" };
}

function codigoDe(err: unknown): string | undefined {
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : undefined;
}

export interface DepsAcceso {
  /** Lee usuarios/{uid} (único acceso a Firestore del guard). */
  leerRol(uid: string): Promise<{ existe: boolean; rol?: unknown }>;
}

/**
 * Obtiene el estado real de un usuario del SDK web. Es la ruta de código que usa AccessGuard.
 * Nunca lanza: cualquier fallo se traduce a error_red / sesion_caducada / denegado (fallo cerrado).
 */
export async function obtenerEstadoAcceso(user: UsuarioAcceso, deps: DepsAcceso): Promise<ResultadoAcceso> {
  try {
    if (esAnonimo(user, undefined)) return resolverAcceso({ user, claims: null });

    let claims: ClaimsAcceso | null;
    try {
      claims = (await user.getIdTokenResult()).claims as ClaimsAcceso;
    } catch (err) {
      return resolverAcceso({ user, claims: null, lectura: { tipo: "error", code: codigoDe(err) } });
    }
    let r = resolverAcceso({ user, claims });
    if (r.estado === "cargando" && r.refrescar) {
      try {
        claims = (await user.getIdTokenResult(true)).claims as ClaimsAcceso;
      } catch (err) {
        return resolverAcceso({ user, claims: null, lectura: { tipo: "error", code: codigoDe(err) } });
      }
      r = resolverAcceso({ user, claims, refrescado: true });
    }
    if (r.estado !== "cargando" || !r.leer) {
      return r.estado === "cargando" ? { estado: "denegado" } : r; // "cargando" aquí sería inesperado
    }
    let lectura: LecturaRol;
    try {
      const d = await deps.leerRol(user.uid);
      lectura = { tipo: "doc", existe: d?.existe === true, rol: d?.rol };
    } catch (err) {
      lectura = { tipo: "error", code: codigoDe(err) };
    }
    const fin = resolverAcceso({ user, claims, lectura });
    return fin.estado === "cargando" ? { estado: "denegado" } : fin;
  } catch {
    return { estado: "denegado" };
  }
}

/** "Ya verifiqué mi correo": reload() + getIdToken(true) y nueva evaluación completa. */
export async function reevaluarTrasVerificar(user: UsuarioAcceso, deps: DepsAcceso): Promise<ResultadoAcceso> {
  try {
    await user.reload();
    await user.getIdToken(true);
  } catch (err) {
    return estadoDeError(codigoDe(err));
  }
  return obtenerEstadoAcceso(user, deps);
}

// ─── DECISIÓN DE PANTALLA (main.tsx) ──────────────────────────────────────────

export type Pantalla = "cargando" | "login" | "app" | "guard" | "anonimo_bloqueado";

/** Flag VITE_ACCESS_GUARD: solo el valor exacto 'strict' activa el guard; cualquier otro valor = apagado. */
export function guardActivo(flag: string | undefined): boolean {
  return flag === "strict";
}

/**
 * Qué muestra main.tsx. Con el guard apagado se conserva el comportamiento anterior (usuario -> App directo,
 * sin lecturas extra); lo único que se añade siempre es bloquear a los usuarios anónimos.
 */
export function decidirPantalla(p: {
  flag: string | undefined;
  checking: boolean;
  user: { isAnonymous: boolean } | null;
}): Pantalla {
  if (p.checking) return "cargando";
  if (!p.user) return "login";
  if (p.user.isAnonymous === true) return "anonimo_bloqueado";
  return guardActivo(p.flag) ? "guard" : "app";
}
