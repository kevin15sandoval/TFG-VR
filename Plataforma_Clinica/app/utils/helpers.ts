// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES - Funciones auxiliares
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combina clases CSS condicionalmente
 */
export function cx(...cls: (string | false | null | undefined)[]): string {
  return cls.filter(Boolean).join(" ");
}

/**
 * Obtiene iniciales de un nombre
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "??";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Formatea fecha a formato español
 */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calcula porcentaje
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Formatea número con separadores de miles
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("es-ES");
}
