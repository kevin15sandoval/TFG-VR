// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE JUEGOS VR
// ═══════════════════════════════════════════════════════════════════════════

import {
  Sparkles,
  Lock,
  Crosshair,
  Layers,
  Zap,
  Target,
} from "lucide-react";

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  Icon: any;
  difficulty: string;
  diffColor: string;
  area: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  border: string;
}

export const MINIGAMES: GameInfo[] = [
  {
    id: "gems",
    name: "Recolectar gemas",
    description: "Ejercicio de alcance funcional y coordinación ojo-mano",
    Icon: Sparkles,
    difficulty: "Media",
    diffColor: "amber",
    area: "Alcance · Coordinación ojo-mano",
    bg: "bg-blue-50",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    border: "border-blue-200",
  },
  {
    id: "vault_escape",
    name: "Laser Vault Escape",
    description: "Planificación motora y precisión evitando obstáculos láser",
    Icon: Lock,
    difficulty: "Media",
    diffColor: "amber",
    area: "Planificación · Control postural · Función ejecutiva",
    bg: "bg-slate-50",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    border: "border-slate-200",
  },
  {
    id: "urban_attention_quest",
    name: "Urban Attention Quest",
    description: "Navegación 360° y rehabilitación de negligencia espacial",
    Icon: Crosshair,
    difficulty: "Media",
    diffColor: "amber",
    area: "Negligencia espacial · Rotación cervical · Orientación",
    bg: "bg-cyan-50",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600",
    border: "border-cyan-200",
  },
  {
    id: "luggage_handler",
    name: "Luggage Handler",
    description: "Entrenamiento de fuerza, resistencia y rotación de tronco",
    Icon: Layers,
    difficulty: "Media",
    diffColor: "amber",
    area: "Fuerza · Resistencia · Rotación de tronco",
    bg: "bg-orange-50",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    border: "border-orange-200",
  },
];

// ─── CONFIGURACIÓN ESPECÍFICA POR JUEGO ──────────────────────────────────────

export interface GameConfigField {
  key: string;
  label: string;
  Icon: any;
  iconBg: string;
  iconColor: string;
  options: Array<{ val: string; label: string }>;
}

export interface GameConfig {
  duration: boolean;
  therapySide: boolean;
  difficulty: boolean;
  heightMode: boolean;
  sessionType: boolean;
  customFields?: GameConfigField[];
}

export const GAME_CONFIG_FIELDS: Record<string, GameConfig> = {
  // Recolectar gemas - juego clásico de alcance
  gems: {
    duration: true,
    therapySide: true,
    difficulty: true,
    heightMode: true,
    sessionType: true,
  },

  // Urban Attention Quest - negligencia espacial y rotación cervical
  urban_attention_quest: {
    duration: true,
    therapySide: false,
    difficulty: true,
    heightMode: false,
    sessionType: false,
    customFields: [
      {
        key: "neglectFocus",
        label: "Enfoque de negligencia",
        Icon: Crosshair,
        iconBg: "bg-cyan-100",
        iconColor: "text-cyan-600",
        options: [
          { val: "balanced", label: "Balanceado" },
          { val: "left_emphasis", label: "Énfasis izquierdo" },
          { val: "right_emphasis", label: "Énfasis derecho" },
          { val: "posterior_emphasis", label: "Énfasis posterior" },
        ],
      },
    ],
  },

  // Laser Vault Escape - planificación y memoria espacial
  vault_escape: {
    duration: true,
    therapySide: false,
    difficulty: true,
    heightMode: true,
    sessionType: false,
    customFields: [
      {
        key: "laserPattern",
        label: "Patrón de láser",
        Icon: Zap,
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        options: [
          { val: "static", label: "Estático" },
          { val: "moving", label: "Móvil" },
          { val: "blinking", label: "Parpadeante" },
        ],
      },
    ],
  },

  // Luggage Handler - fuerza y resistencia
  luggage_handler: {
    duration: true,
    therapySide: false,
    difficulty: true,
    heightMode: false,
    sessionType: false,
    customFields: [
      {
        key: "weightRange",
        label: "Rango de peso",
        Icon: Layers,
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        options: [
          { val: "light", label: "Ligero (1-3kg)" },
          { val: "medium", label: "Medio (3-5kg)" },
          { val: "heavy", label: "Pesado (5-7kg)" },
        ],
      },
    ],
  },

  // Valores por defecto para juegos sin configuración específica
  default: {
    duration: true,
    therapySide: true,
    difficulty: true,
    heightMode: true,
    sessionType: true,
  },
};

export function getGameConfig(gameId: string): GameConfig {
  return GAME_CONFIG_FIELDS[gameId] || GAME_CONFIG_FIELDS.default;
}

export function getGameInfo(gameId: string): GameInfo | undefined {
  return MINIGAMES.find((g) => g.id === gameId);
}
