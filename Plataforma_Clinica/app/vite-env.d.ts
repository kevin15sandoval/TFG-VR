/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS?: string;
  /** 'strict' activa el guard de acceso (AccessGuard). Cualquier otro valor o ausente = apagado. */
  readonly VITE_ACCESS_GUARD?: string;
}
