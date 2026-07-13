// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE RUTAS - React Router
// ═══════════════════════════════════════════════════════════════════════════

import { createBrowserRouter, Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

/**
 * Definición de rutas de la aplicación
 * Estructura de URLs para navegación con React Router
 */
export const ROUTES = {
  DASHBOARD: "/",
  PATIENTS: "/pacientes",
  NEW_SESSION: "/nueva-sesion",
  MINIGAMES: "/minijuegos",
  HISTORY: "/historial",
  SETTINGS: "/configuracion",
  PATIENT_PROFILE: "/pacientes/:id",
  SESSION_DETAIL: "/historial/:id",
  GAME_SPEC: "/minijuegos/:gameId",
  CONNECT_DEVICE: "/conectar-dispositivo",
  RESULTS: "/resultados",
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
