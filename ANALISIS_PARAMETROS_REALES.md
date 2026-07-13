# ANÁLISIS: PARÁMETROS QUE SÍ SE USAN EN LOS JUEGOS VR

## 📡 CAMPOS ENVIADOS DE WEB → FIREBASE → GODOT

### ✅ CAMPOS QUE **SÍ SE USAN** (8 campos):

| Campo Firebase | Variable Godot | ¿Se usa? | Cómo se usa |
|---------------|----------------|----------|-------------|
| `patientId` | `patient_id` | ✅ SÍ | Se guarda en resultados |
| `patientName` | `patient_name` | ✅ SÍ | Se guarda en resultados |
| `sessionId` | `session_id` | ✅ SÍ | Se guarda en resultados |
| `duration` | `session_duration` | ✅ SÍ | Timer del juego (segundos) |
| `difficulty` | `difficulty` | ✅ SÍ | Velocidad gemas, spawn interval |
| `therapySide` | `therapy_side` | ✅ SÍ | Filtro de ejercicios (Izq/Der/Ambos) |
| `sessionType` | `session_type` | ✅ SÍ | Se guarda en resultados |
| `gameId` | `game_type` | ✅ SÍ | Selecciona qué juego cargar |

### ✅ CAMPO CRÍTICO SISTEMA:

| Campo Firebase | ¿Se usa? | Cómo se usa |
|---------------|----------|-------------|
| `status` | ✅ SÍ | Sistema anti-bucle infinito ("pending"/"completed") |

---

## 🎮 CÓMO SE USAN EN CADA JUEGO:

### **1. GEMS COLLECTOR (World.tscn)**

#### Parámetros que AFECTAN el juego:
- ✅ **`therapy_side`**: Filtra ejercicios (EXERCISES_LEFT, EXERCISES_RIGHT, EXERCISES_BOTH)
- ✅ **`difficulty`**: Cambia velocidad gemas y spawn interval
  ```gdscript
  const GEM_SPEED = {
      "Fácil": 0.8,
      "Media": 1.2,
      "Difícil": 1.8
  }
  const SPAWN_INTERVAL = {
      "Fácil": 3.0,
      "Media": 2.0,
      "Difícil": 1.2
  }
  ```
- ✅ **`duration`**: Timer del juego (180s, 240s, 300s, etc.)

#### Parámetros que solo se GUARDAN:
- ✅ `patient_id`, `patient_name`, `session_id`, `session_type` → Van a resultados Firebase

---

### **2. LASER VAULT ESCAPE (VaultWorld.tscn)**

#### Parámetros que AFECTAN el juego:
- ✅ **`difficulty`**: Cambia velocidad y cantidad de láseres
- ✅ **`duration`**: Timer del juego

#### Parámetros que NO afectan (Vault no usa therapy_side):
- ⚠️ **`therapy_side`**: No aplica (usa ambas manos + cabeza siempre)

---

### **3. URBAN ATTENTION QUEST (CityWorld.tscn)**

#### Parámetros que AFECTAN el juego:
- ✅ **`difficulty`**: Cambia cantidad de objetivos y tiempo entre objetivos
- ✅ **`duration`**: Timer del juego (incluye fase reconocimiento)

#### Parámetros que NO afectan:
- ⚠️ **`therapy_side`**: No aplica (navegación 360°, ambos lados siempre)

---

### **4. LUGGAGE HANDLER (LuggageWorld.tscn)**

#### Parámetros que AFECTAN el juego:
- ✅ **`difficulty`**: Cambia intervalo spawn y velocidad cinta
  ```gdscript
  const DIFFICULTY_CONFIG = {
      "Fácil":   {"interval": 4.0, "speed": 0.5},
      "Media":   {"interval": 3.0, "speed": 1.0},
      "Difícil": {"interval": 2.0, "speed": 1.5}
  }
  ```
- ✅ **`duration`**: Timer del juego

#### Parámetros que NO afectan:
- ⚠️ **`therapy_side`**: No aplica (usa ambas manos para agarrar siempre)

---

## ⚠️ CAMPOS DE LA WEB QUE **NO SE ENVÍAN** A GODOT:

Estos están en la interfaz web pero NO van a Firebase:

| Campo en UI Web | ¿Va a Firebase? | ¿Lo usa Godot? |
|----------------|----------------|----------------|
| `height` (Altura objetivo) | ❌ NO | ❌ NO |
| `weight` (Peso del paciente) | ❌ NO | ❌ NO |
| `age` (Edad) | ❌ NO | ❌ NO |
| `diagnosis` (Diagnóstico) | ❌ NO | ❌ NO |
| `affectedSide` (Lado afectado del paciente) | ❌ NO* | ❌ NO |

\* **Nota**: `affectedSide` del paciente se COPIA a `therapySide` de la sesión, pero el valor original no se envía.

---

## 📊 RESUMEN PARA DOCUMENTACIÓN TFG:

### ✅ PARÁMETROS CONFIGURABLES (SÍ funcionan):

1. **Duración** (duration): 60s, 120s, 180s, 240s, 300s
   - ✅ Controla timer en TODOS los juegos

2. **Dificultad** (difficulty): Fácil, Media, Difícil
   - ✅ **Gems**: Velocidad 0.8/1.2/1.8, Spawn 3.0/2.0/1.2s
   - ✅ **Vault**: Velocidad y cantidad láseres
   - ✅ **City**: Cantidad objetivos y tiempos
   - ✅ **Luggage**: Spawn 4.0/3.0/2.0s, Velocidad 0.5/1.0/1.5

3. **Lado terapéutico** (therapySide): Izquierdo, Derecho, Ambos
   - ✅ **Gems**: Filtra EXERCISES_LEFT, EXERCISES_RIGHT, EXERCISES_BOTH
   - ⚠️ **Vault**: NO aplica (usa ambas manos + cabeza)
   - ⚠️ **City**: NO aplica (navegación 360°)
   - ⚠️ **Luggage**: NO aplica (usa ambas manos)

4. **Tipo de sesión** (sessionType): Alcance, Coordinación, Navegación, Resistencia
   - ℹ️ Solo se guarda en resultados (NO afecta juego)

5. **Juego** (gameId): gems, vault_escape, urban_attention_quest, luggage_handler
   - ✅ Selecciona qué escena VR cargar

---

## 🎯 RECOMENDACIÓN PARA DOCUMENTACIÓN:

### EN EL TFG, DOCUMENTAR SOLO ESTO:

#### Parámetros configurables REALES:

1. **Duración**: 60-300 segundos (afecta timer)
2. **Dificultad**: Fácil/Media/Difícil (afecta velocidad/spawn)
3. **Lado terapéutico**: Izquierdo/Derecho/Ambos
   - **IMPORTANTE**: Solo funciona en **Gems Collector**
   - En Vault, City y Luggage: Siempre usan ambas manos
4. **Tipo de juego**: 4 juegos disponibles

#### Datos de paciente (solo para registro):
- ID, Nombre, ID sesión → Se guardan en resultados

---

## ❌ LO QUE NO DEBES DOCUMENTAR COMO "CONFIGURABLE":

- ❌ Altura objetivo (no implementado)
- ❌ Peso del paciente (no implementado)
- ❌ Configuración específica de cada juego (no hay UI para eso)
- ❌ Ajuste dinámico de dificultad (no implementado)

---

## 🔧 SI QUIERES SER 100% HONESTO EN EL TFG:

### Opción 1: Tabla con columna "Aplica a"

| Parámetro | Valores | Gems | Vault | City | Luggage |
|-----------|---------|------|-------|------|---------|
| Duración | 60-300s | ✅ | ✅ | ✅ | ✅ |
| Dificultad | Fácil/Media/Difícil | ✅ | ✅ | ✅ | ✅ |
| Lado | Izq/Der/Ambos | ✅ | ⚠️ Siempre ambos | ⚠️ Siempre 360° | ⚠️ Siempre ambos |

### Opción 2: Nota al pie

> **Nota sobre lado terapéutico**: El parámetro "Lado terapéutico" (Izquierdo/Derecho/Ambos) solo aplica al juego Gems Collector, donde filtra los ejercicios según el lado configurado. Los juegos Vault Escape, Urban Attention Quest y Luggage Handler requieren uso bimanual o exploración 360° por su naturaleza, por lo que este parámetro no afecta su comportamiento.

---

## ✅ CONCLUSIÓN:

**SÍ, todos los parámetros que envías a Firebase SE USAN**, pero:

1. **`therapy_side` solo funciona en Gems Collector**
2. Los demás juegos lo ignoran porque requieren ambas manos
3. Esto NO es un bug, es **por diseño del juego**

**Para el TFG**: Documenta esto honestamente. Es defendible porque tiene sentido clínico (Vault necesita ambas manos para esquivar, City necesita rotación 360°, Luggage necesita ambas manos para agarrar).
