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
 * Acepta Date, string, timestamp de Firebase, o cualquier valor convertible
 */
export function formatDate(d: Date | string | number | any): string {
  // Si es null o undefined, retornar guion
  if (!d) return "-";
  
  // Si ya es un Date, usarlo directamente
  if (d instanceof Date) {
    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  
  // Si es un timestamp de Firestore (objeto con toDate)
  if (d && typeof d === "object" && typeof d.toDate === "function") {
    return d.toDate().toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  
  // Si es string o número, intentar convertir a Date
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) {
      // Si la conversión falla, retornar el valor original como string
      return String(d);
    }
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
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

/**
 * Convierte cualquier valor de fecha a objeto Date
 * Maneja: Date, string, timestamp, Firestore Timestamp
 */
export function toDate(d: Date | string | number | any): Date {
  // Si ya es Date, retornar directamente
  if (d instanceof Date) return d;
  
  // Si es timestamp de Firestore (objeto con toDate)
  if (d && typeof d === "object" && typeof d.toDate === "function") {
    return d.toDate();
  }
  
  // Si es string o número, convertir
  try {
    return new Date(d);
  } catch {
    return new Date(); // Fallback a fecha actual
  }
}
