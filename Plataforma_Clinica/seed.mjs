import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("tfg-vr-firebase-adminsdk-fbsvc-4848cd0ce2.json", "utf8"));

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const PATIENTS = [
  { name: "Carmen Rodríguez López",   initials: "CR", age: 67, affectedSide: "Izquierdo", diagnosis: "Ictus isquémico",   sessions: 24, status: "activo",   colorIdx: 0, progress: 72, lastSession: "20 jun 2026", notes: "Buena tolerancia al esfuerzo." },
  { name: "José Manuel García Vega",  initials: "JG", age: 58, affectedSide: "Derecho",   diagnosis: "Ictus hemorrágico", sessions: 12, status: "activo",   colorIdx: 1, progress: 45, lastSession: "19 jun 2026", notes: "Inicio reciente. Progreso estable." },
  { name: "María Antonia Pérez Ruiz", initials: "MP", age: 74, affectedSide: "Ambos",     diagnosis: "Ictus isquémico",   sessions: 38, status: "activo",   colorIdx: 2, progress: 88, lastSession: "18 jun 2026", notes: "Excelente adherencia. Cerca del alta." },
  { name: "Antonio Fernández Sanz",   initials: "AF", age: 62, affectedSide: "Derecho",   diagnosis: "AIT recurrente",    sessions:  8, status: "activo",   colorIdx: 3, progress: 31, lastSession: "17 jun 2026", notes: "Requiere supervisión continua." },
  { name: "Isabel Martínez Torres",   initials: "IM", age: 70, affectedSide: "Izquierdo", diagnosis: "Ictus isquémico",   sessions: 19, status: "activo",   colorIdx: 4, progress: 60, lastSession: "15 jun 2026", notes: "Motivada. Mejora semana a semana." },
  { name: "Francisco López Moreno",   initials: "FL", age: 55, affectedSide: "Derecho",   diagnosis: "Ictus lacunar",     sessions: 15, status: "inactivo", colorIdx: 5, progress: 52, lastSession: "14 jun 2026", notes: "En pausa por viaje familiar." },
];

// idx -> sesiones (patientIdx es 0-based aquí)
const SESSIONS_BY_IDX = {
  0: [ // Carmen (24 sesiones → seed 12)
    { 
      date: "22 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 8450, accuracy: 84, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 45, gemsRedAvoided: 12, avgTimePerGem: 6.7,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 15, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 12, type: "Abducción" },
        { exercise: "Extensión de codo", count: 10, type: "Extensión" },
        { exercise: "Alcance diagonal", count: 8, type: "Flexión" }
      ],
      zonesWorked: { Alto: 15, Medio: 18, Lateral: 8, Bajo: 4 }
    },
    { 
      date: "20 jun 2026", game: "Seguir luces", gameId: "lights", duration: 5, score: 7800, accuracy: 81, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Coordinación", notes: "",
      totalMovements: 42, gemsRedAvoided: 10, avgTimePerGem: 7.1,
      movementsSummary: [
        { exercise: "Seguimiento horizontal", count: 18, type: "Aducción" },
        { exercise: "Seguimiento vertical", count: 14, type: "Flexión" },
        { exercise: "Seguimiento circular", count: 10, type: "Rotación Externa" }
      ],
      zonesWorked: { Alto: 10, Medio: 20, Lateral: 10, Bajo: 2 }
    },
    { 
      date: "18 jun 2026", game: "Atrapar objetos", gameId: "catch", duration: 3, score: 5200, accuracy: 79, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Precisión", notes: "",
      totalMovements: 28, gemsRedAvoided: 8, avgTimePerGem: 6.4,
      movementsSummary: [
        { exercise: "Alcance frontal", count: 12, type: "Flexión" },
        { exercise: "Alcance lateral", count: 10, type: "Abducción" },
        { exercise: "Cierre de mano", count: 6, type: "Flexión" }
      ],
      zonesWorked: { Alto: 8, Medio: 14, Lateral: 4, Bajo: 2 }
    },
    { 
      date: "15 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 7100, accuracy: 81, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 40, gemsRedAvoided: 9, avgTimePerGem: 7.5,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 14, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 13, type: "Abducción" },
        { exercise: "Extensión de codo", count: 8, type: "Extensión" },
        { exercise: "Alcance bajo", count: 5, type: "Extensión" }
      ],
      zonesWorked: { Alto: 12, Medio: 16, Lateral: 9, Bajo: 3 }
    },
    { 
      date: "12 jun 2026", game: "Objetivos laterales", gameId: "lateral", duration: 10, score: 9800, accuracy: 76, 
      side: "Ambos", difficulty: "Difícil", sessionType: "Movilidad de tronco", notes: "Buena tolerancia hoy",
      totalMovements: 52, gemsRedAvoided: 15, avgTimePerGem: 11.5,
      movementsSummary: [
        { exercise: "Rotación de tronco derecha", count: 16, type: "Rotación Externa" },
        { exercise: "Rotación de tronco izquierda", count: 14, type: "Rotación Interna" },
        { exercise: "Inclinación lateral", count: 12, type: "Abducción" },
        { exercise: "Alcance cruzado", count: 10, type: "Aducción" }
      ],
      zonesWorked: { Alto: 8, Medio: 18, Lateral: 22, Bajo: 4 }
    },
    { 
      date: "10 jun 2026", game: "Seguir luces", gameId: "lights", duration: 5, score: 7200, accuracy: 83, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Coordinación", notes: "",
      totalMovements: 38, gemsRedAvoided: 7, avgTimePerGem: 7.9,
      movementsSummary: [
        { exercise: "Seguimiento horizontal", count: 15, type: "Aducción" },
        { exercise: "Seguimiento vertical", count: 13, type: "Flexión" },
        { exercise: "Seguimiento diagonal", count: 10, type: "Rotación Externa" }
      ],
      zonesWorked: { Alto: 11, Medio: 19, Lateral: 6, Bajo: 2 }
    },
    { 
      date: "8 jun 2026", game: "Evitar obstáculos", gameId: "avoid", duration: 3, score: 5900, accuracy: 78, 
      side: "Izquierdo", difficulty: "Difícil", sessionType: "Equilibrio", notes: "",
      totalMovements: 32, gemsRedAvoided: 11, avgTimePerGem: 5.6,
      movementsSummary: [
        { exercise: "Esquivar lateral", count: 14, type: "Abducción" },
        { exercise: "Agacharse", count: 10, type: "Flexión" },
        { exercise: "Estiramiento vertical", count: 8, type: "Extensión" }
      ],
      zonesWorked: { Alto: 8, Medio: 12, Lateral: 10, Bajo: 2 }
    },
    { 
      date: "5 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 6700, accuracy: 77, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 36, gemsRedAvoided: 8, avgTimePerGem: 8.3,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 12, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 11, type: "Abducción" },
        { exercise: "Alcance frontal", count: 9, type: "Extensión" },
        { exercise: "Alcance lateral bajo", count: 4, type: "Aducción" }
      ],
      zonesWorked: { Alto: 10, Medio: 15, Lateral: 8, Bajo: 3 }
    },
    { date: "2 jun 2026",  game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 4800,  accuracy: 74, side: "Izquierdo", difficulty: "Media",   sessionType: "Precisión",          notes: "" },
    { date: "29 may 2026", game: "Seguir luces",        gameId: "lights",  duration: 5,  score: 6100,  accuracy: 75, side: "Izquierdo", difficulty: "Media",   sessionType: "Coordinación",       notes: "" },
    { 
      date: "26 may 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 5800, accuracy: 73, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 33, gemsRedAvoided: 6, avgTimePerGem: 9.1,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 11, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 10, type: "Abducción" },
        { exercise: "Alcance frontal", count: 8, type: "Extensión" },
        { exercise: "Alcance lateral", count: 4, type: "Aducción" }
      ],
      zonesWorked: { Alto: 9, Medio: 14, Lateral: 7, Bajo: 3 }
    },
    { date: "23 may 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 5500,  accuracy: 71, side: "Izquierdo", difficulty: "Media",   sessionType: "Precisión",          notes: "" },
  ],
  1: [ // José (12 sesiones)
    { 
      date: "19 jun 2026", game: "Atrapar objetos", gameId: "catch", duration: 3, score: 4210, accuracy: 71, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Precisión", notes: "",
      totalMovements: 25, gemsRedAvoided: 5, avgTimePerGem: 7.2,
      movementsSummary: [
        { exercise: "Alcance frontal", count: 11, type: "Flexión" },
        { exercise: "Alcance lateral", count: 8, type: "Abducción" },
        { exercise: "Cierre de mano", count: 6, type: "Flexión" }
      ],
      zonesWorked: { Alto: 6, Medio: 13, Lateral: 4, Bajo: 2 }
    },
    { 
      date: "17 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 3800, accuracy: 65, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "",
      totalMovements: 22, gemsRedAvoided: 4, avgTimePerGem: 13.6,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 10, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 7, type: "Abducción" },
        { exercise: "Extensión de codo", count: 5, type: "Extensión" }
      ],
      zonesWorked: { Alto: 5, Medio: 11, Lateral: 4, Bajo: 2 }
    },
    { 
      date: "15 jun 2026", game: "Seguir luces", gameId: "lights", duration: 3, score: 3200, accuracy: 62, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Coordinación", notes: "",
      totalMovements: 20, gemsRedAvoided: 3, avgTimePerGem: 9.0,
      movementsSummary: [
        { exercise: "Seguimiento horizontal", count: 10, type: "Aducción" },
        { exercise: "Seguimiento vertical", count: 7, type: "Flexión" },
        { exercise: "Seguimiento circular", count: 3, type: "Rotación Externa" }
      ],
      zonesWorked: { Alto: 4, Medio: 12, Lateral: 3, Bajo: 1 }
    },
    { date: "12 jun 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 3600,  accuracy: 67, side: "Derecho",   difficulty: "Fácil",   sessionType: "Precisión",  notes: "" },
    { 
      date: "10 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 3400, accuracy: 64, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "",
      totalMovements: 20, gemsRedAvoided: 3, avgTimePerGem: 15.0,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 9, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 6, type: "Abducción" },
        { exercise: "Extensión de codo", count: 5, type: "Extensión" }
      ],
      zonesWorked: { Alto: 4, Medio: 10, Lateral: 4, Bajo: 2 }
    },
    { date: "8 jun 2026",  game: "Seguir luces",        gameId: "lights",  duration: 3,  score: 3000,  accuracy: 61, side: "Derecho",   difficulty: "Fácil",   sessionType: "Coordinación",notes: "" },
    { date: "5 jun 2026",  game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 2700,  accuracy: 58, side: "Derecho",   difficulty: "Fácil",   sessionType: "Precisión",  notes: "" },
    { 
      date: "2 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 2400, accuracy: 55, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "",
      totalMovements: 16, gemsRedAvoided: 2, avgTimePerGem: 18.8,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 7, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 5, type: "Abducción" },
        { exercise: "Extensión de codo", count: 4, type: "Extensión" }
      ],
      zonesWorked: { Alto: 3, Medio: 8, Lateral: 3, Bajo: 2 }
    },
    { date: "29 may 2026", game: "Seguir luces",        gameId: "lights",  duration: 3,  score: 2100,  accuracy: 52, side: "Derecho",   difficulty: "Fácil",   sessionType: "Coordinación",notes: "" },
    { date: "26 may 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 1800,  accuracy: 49, side: "Derecho",   difficulty: "Fácil",   sessionType: "Precisión",  notes: "" },
    { 
      date: "23 may 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 1500, accuracy: 47, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "",
      totalMovements: 12, gemsRedAvoided: 1, avgTimePerGem: 25.0,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 6, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 4, type: "Abducción" },
        { exercise: "Alcance frontal", count: 2, type: "Extensión" }
      ],
      zonesWorked: { Alto: 2, Medio: 7, Lateral: 2, Bajo: 1 }
    },
    { date: "20 may 2026", game: "Seguir luces",        gameId: "lights",  duration: 3,  score: 1200,  accuracy: 45, side: "Derecho",   difficulty: "Fácil",   sessionType: "Coordinación",notes: "Primera sesión" },
  ],
  2: [ // María (38 → seed 10)
    { 
      date: "18 jun 2026", game: "Seguir luces", gameId: "lights", duration: 10, score: 12300, accuracy: 91, 
      side: "Ambos", difficulty: "Media", sessionType: "Coordinación", notes: "",
      totalMovements: 68, gemsRedAvoided: 22, avgTimePerGem: 8.8,
      movementsSummary: [
        { exercise: "Seguimiento horizontal bilateral", count: 24, type: "Aducción" },
        { exercise: "Seguimiento vertical", count: 20, type: "Flexión" },
        { exercise: "Seguimiento diagonal", count: 14, type: "Rotación Externa" },
        { exercise: "Seguimiento circular", count: 10, type: "Rotación Interna" }
      ],
      zonesWorked: { Alto: 18, Medio: 30, Lateral: 14, Bajo: 6 }
    },
    { 
      date: "16 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 11200, accuracy: 89, 
      side: "Ambos", difficulty: "Difícil", sessionType: "Alcance", notes: "Excelente sesión",
      totalMovements: 62, gemsRedAvoided: 20, avgTimePerGem: 4.8,
      movementsSummary: [
        { exercise: "Flexión bilateral", count: 22, type: "Flexión" },
        { exercise: "Abducción bilateral", count: 18, type: "Abducción" },
        { exercise: "Alcance cruzado", count: 12, type: "Aducción" },
        { exercise: "Extensión completa", count: 10, type: "Extensión" }
      ],
      zonesWorked: { Alto: 20, Medio: 26, Lateral: 12, Bajo: 4 }
    },
    { 
      date: "14 jun 2026", game: "Objetivos laterales", gameId: "lateral", duration: 10, score: 11800, accuracy: 90, 
      side: "Ambos", difficulty: "Difícil", sessionType: "Movilidad de tronco", notes: "",
      totalMovements: 65, gemsRedAvoided: 21, avgTimePerGem: 9.2,
      movementsSummary: [
        { exercise: "Rotación de tronco derecha", count: 20, type: "Rotación Externa" },
        { exercise: "Rotación de tronco izquierda", count: 19, type: "Rotación Interna" },
        { exercise: "Inclinación lateral", count: 16, type: "Abducción" },
        { exercise: "Alcance cruzado profundo", count: 10, type: "Aducción" }
      ],
      zonesWorked: { Alto: 12, Medio: 22, Lateral: 26, Bajo: 5 }
    },
    { date: "12 jun 2026", game: "Evitar obstáculos",   gameId: "avoid",   duration: 5,  score: 10500, accuracy: 88, side: "Ambos",     difficulty: "Difícil", sessionType: "Equilibrio",         notes: "" },
    { date: "10 jun 2026", game: "Seguir luces",        gameId: "lights",  duration: 5,  score: 9800,  accuracy: 86, side: "Ambos",     difficulty: "Media",   sessionType: "Coordinación",       notes: "" },
    { 
      date: "8 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 9200, accuracy: 85, 
      side: "Ambos", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 58, gemsRedAvoided: 18, avgTimePerGem: 5.2,
      movementsSummary: [
        { exercise: "Flexión bilateral", count: 20, type: "Flexión" },
        { exercise: "Abducción bilateral", count: 16, type: "Abducción" },
        { exercise: "Alcance cruzado", count: 12, type: "Aducción" },
        { exercise: "Extensión completa", count: 10, type: "Extensión" }
      ],
      zonesWorked: { Alto: 18, Medio: 24, Lateral: 12, Bajo: 4 }
    },
    { date: "5 jun 2026",  game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 8800,  accuracy: 84, side: "Ambos",     difficulty: "Media",   sessionType: "Precisión",          notes: "" },
    { date: "2 jun 2026",  game: "Seguir luces",        gameId: "lights",  duration: 5,  score: 8300,  accuracy: 82, side: "Ambos",     difficulty: "Media",   sessionType: "Coordinación",       notes: "" },
    { 
      date: "29 may 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 7800, accuracy: 80, 
      side: "Ambos", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 52, gemsRedAvoided: 16, avgTimePerGem: 5.8,
      movementsSummary: [
        { exercise: "Flexión bilateral", count: 18, type: "Flexión" },
        { exercise: "Abducción bilateral", count: 15, type: "Abducción" },
        { exercise: "Alcance cruzado", count: 11, type: "Aducción" },
        { exercise: "Extensión completa", count: 8, type: "Extensión" }
      ],
      zonesWorked: { Alto: 16, Medio: 22, Lateral: 10, Bajo: 4 }
    },
    { date: "26 may 2026", game: "Objetivos laterales", gameId: "lateral", duration: 10, score: 7200,  accuracy: 78, side: "Ambos",     difficulty: "Media",   sessionType: "Movilidad de tronco",notes: "" },
  ],
  3: [ // Antonio (8 sesiones)
    { date: "17 jun 2026", game: "Objetivos laterales", gameId: "lateral", duration: 5,  score: 3120,  accuracy: 58, side: "Derecho",   difficulty: "Difícil", sessionType: "Movilidad de tronco",notes: "" },
    { 
      date: "14 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 2800, accuracy: 55, 
      side: "Derecho", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 18, gemsRedAvoided: 3, avgTimePerGem: 16.7,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 8, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 6, type: "Abducción" },
        { exercise: "Extensión de codo", count: 4, type: "Extensión" }
      ],
      zonesWorked: { Alto: 4, Medio: 9, Lateral: 3, Bajo: 2 }
    },
    { date: "11 jun 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 2400,  accuracy: 52, side: "Derecho",   difficulty: "Fácil",   sessionType: "Precisión",          notes: "Requiere descansos frecuentes" },
    { date: "8 jun 2026",  game: "Seguir luces",        gameId: "lights",  duration: 3,  score: 2000,  accuracy: 49, side: "Derecho",   difficulty: "Fácil",   sessionType: "Coordinación",       notes: "" },
    { 
      date: "5 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 3, score: 1800, accuracy: 46, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "",
      totalMovements: 14, gemsRedAvoided: 2, avgTimePerGem: 12.9,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 7, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 4, type: "Abducción" },
        { exercise: "Alcance frontal", count: 3, type: "Extensión" }
      ],
      zonesWorked: { Alto: 3, Medio: 8, Lateral: 2, Bajo: 1 }
    },
    { date: "2 jun 2026",  game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 1500,  accuracy: 43, side: "Derecho",   difficulty: "Fácil",   sessionType: "Precisión",          notes: "" },
    { date: "30 may 2026", game: "Seguir luces",        gameId: "lights",  duration: 3,  score: 1200,  accuracy: 42, side: "Derecho",   difficulty: "Fácil",   sessionType: "Coordinación",       notes: "" },
    { 
      date: "27 may 2026", game: "Recolectar gemas", gameId: "gems", duration: 3, score: 900, accuracy: 40, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "Primera sesión",
      totalMovements: 10, gemsRedAvoided: 1, avgTimePerGem: 18.0,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 5, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 3, type: "Abducción" },
        { exercise: "Alcance frontal", count: 2, type: "Extensión" }
      ],
      zonesWorked: { Alto: 2, Medio: 6, Lateral: 1, Bajo: 1 }
    },
  ],
  4: [ // Isabel (19 → seed 8)
    { date: "15 jun 2026", game: "Evitar obstáculos",   gameId: "avoid",   duration: 3,  score: 5680,  accuracy: 77, side: "Izquierdo", difficulty: "Difícil", sessionType: "Equilibrio",   notes: "" },
    { 
      date: "13 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 5200, accuracy: 75, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 32, gemsRedAvoided: 8, avgTimePerGem: 9.4,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 12, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 10, type: "Abducción" },
        { exercise: "Extensión de codo", count: 7, type: "Extensión" },
        { exercise: "Alcance diagonal", count: 3, type: "Aducción" }
      ],
      zonesWorked: { Alto: 9, Medio: 15, Lateral: 6, Bajo: 2 }
    },
    { date: "11 jun 2026", game: "Seguir luces",        gameId: "lights",  duration: 5,  score: 4900,  accuracy: 73, side: "Izquierdo", difficulty: "Media",   sessionType: "Coordinación", notes: "" },
    { date: "8 jun 2026",  game: "Objetivos laterales", gameId: "lateral", duration: 5,  score: 4600,  accuracy: 71, side: "Izquierdo", difficulty: "Media",   sessionType: "Movilidad de tronco",notes: "" },
    { date: "5 jun 2026",  game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 4100,  accuracy: 68, side: "Izquierdo", difficulty: "Media",   sessionType: "Precisión",    notes: "" },
    { 
      date: "2 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 3700, accuracy: 65, 
      side: "Izquierdo", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 26, gemsRedAvoided: 5, avgTimePerGem: 11.5,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 10, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 8, type: "Abducción" },
        { exercise: "Extensión de codo", count: 5, type: "Extensión" },
        { exercise: "Alcance bajo", count: 3, type: "Aducción" }
      ],
      zonesWorked: { Alto: 7, Medio: 13, Lateral: 4, Bajo: 2 }
    },
    { date: "29 may 2026", game: "Seguir luces",        gameId: "lights",  duration: 5,  score: 3400,  accuracy: 63, side: "Izquierdo", difficulty: "Fácil",   sessionType: "Coordinación", notes: "" },
    { date: "26 may 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 3100,  accuracy: 61, side: "Izquierdo", difficulty: "Fácil",   sessionType: "Precisión",    notes: "" },
  ],
  5: [ // Francisco (15 → seed 7)
    { 
      date: "14 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 5100, accuracy: 72, 
      side: "Derecho", difficulty: "Media", sessionType: "Alcance", notes: "",
      totalMovements: 31, gemsRedAvoided: 7, avgTimePerGem: 9.7,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 12, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 10, type: "Abducción" },
        { exercise: "Extensión de codo", count: 6, type: "Extensión" },
        { exercise: "Alcance diagonal", count: 3, type: "Aducción" }
      ],
      zonesWorked: { Alto: 8, Medio: 15, Lateral: 6, Bajo: 2 }
    },
    { date: "12 jun 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 4800,  accuracy: 70, side: "Derecho",   difficulty: "Media",   sessionType: "Precisión",    notes: "" },
    { date: "10 jun 2026", game: "Seguir luces",        gameId: "lights",  duration: 5,  score: 4500,  accuracy: 68, side: "Derecho",   difficulty: "Media",   sessionType: "Coordinación", notes: "" },
    { date: "8 jun 2026",  game: "Objetivos laterales", gameId: "lateral", duration: 5,  score: 4200,  accuracy: 66, side: "Derecho",   difficulty: "Media",   sessionType: "Movilidad de tronco",notes: "" },
    { 
      date: "5 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 3900, accuracy: 64, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "",
      totalMovements: 27, gemsRedAvoided: 5, avgTimePerGem: 11.1,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 11, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 9, type: "Abducción" },
        { exercise: "Extensión de codo", count: 5, type: "Extensión" },
        { exercise: "Alcance lateral", count: 2, type: "Aducción" }
      ],
      zonesWorked: { Alto: 7, Medio: 14, Lateral: 4, Bajo: 2 }
    },
    { date: "2 jun 2026",  game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 3600,  accuracy: 62, side: "Derecho",   difficulty: "Fácil",   sessionType: "Precisión",    notes: "" },
    { 
      date: "29 may 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 3300, accuracy: 60, 
      side: "Derecho", difficulty: "Fácil", sessionType: "Alcance", notes: "",
      totalMovements: 24, gemsRedAvoided: 4, avgTimePerGem: 12.5,
      movementsSummary: [
        { exercise: "Flexión de hombro", count: 10, type: "Flexión" },
        { exercise: "Abducción de hombro", count: 8, type: "Abducción" },
        { exercise: "Extensión de codo", count: 4, type: "Extensión" },
        { exercise: "Alcance frontal", count: 2, type: "Aducción" }
      ],
      zonesWorked: { Alto: 6, Medio: 12, Lateral: 4, Bajo: 2 }
    },
  ],
};

async function seed() {
  console.log("🌱 Insertando datos en Firestore...");

  // Insertar pacientes uno a uno y guardar sus IDs
  const patientIds = [];
  for (const patient of PATIENTS) {
    const ref = await db.collection("pacientes").add({
      ...patient,
      createdAt: FieldValue.serverTimestamp(),
    });
    patientIds.push(ref.id);
    console.log(`✅ Paciente: ${patient.name} → ${ref.id}`);
  }

  // Insertar sesiones con el ID real del paciente
  let sessionCount = 0;
  for (let i = 0; i < PATIENTS.length; i++) {
    const sessions = SESSIONS_BY_IDX[i] ?? [];
    for (const session of sessions) {
      await db.collection("sesiones").add({
        ...session,
        patientId: patientIds[i],
        createdAt: FieldValue.serverTimestamp(),
      });
      sessionCount++;
    }
    console.log(`  📋 ${sessions.length} sesiones para ${PATIENTS[i].name}`);
  }

  console.log(`\n✅ Seed completo: ${PATIENTS.length} pacientes, ${sessionCount} sesiones`);
  process.exit(0);
}

seed().catch(e => { console.error("❌ Error:", e); process.exit(1); });
