// ─── DECISIÓN DE MODO EMULADOR (función pura, sin dependencias) ──────────────
// Solo sintaxis "borrable" de TypeScript: node (>=22.18) puede importarla directamente en las pruebas.
//
// Reglas:
//   - VITE_USE_EMULATORS distinto de 'true'            -> false (comportamiento normal, producción).
//   - VITE_USE_EMULATORS === 'true' y DEV              -> true  (se conecta a los emuladores locales).
//   - VITE_USE_EMULATORS === 'true' y NO DEV (build)   -> lanza error: jamás debe empaquetarse así.

export interface EmulatorEnv {
  DEV?: boolean;
  VITE_USE_EMULATORS?: string;
}

export function shouldUseEmulators(env: EmulatorEnv): boolean {
  if (env.VITE_USE_EMULATORS !== "true") return false;
  if (env.DEV !== true) {
    throw new Error(
      "VITE_USE_EMULATORS=true no está permitido fuera del servidor de desarrollo (build de producción). " +
      "Elimina esa variable del entorno del build."
    );
  }
  return true;
}
