# Cómo Completar la Refactorización - Extraer Pantallas

## Estado Actual
- ✅ Utilidades extraídas (helpers, constants, hooks, config)
- ✅ Componentes compartidos extraídos (AvatarIcon, Badge, Card, etc.)
- ❌ **Pantallas SIGUEN en App.tsx** (3,347 líneas)

## Pantallas a Extraer

Hay **10 pantallas** en App.tsx que necesitan moverse a `components/screens/`:

| # | Pantalla | Líneas aprox | Archivo destino |
|---|----------|--------------|-----------------|
| 1 | DashboardScreen | ~110 | `components/screens/DashboardScreen.tsx` |
| 2 | PatientsScreen | ~160 | `components/screens/PatientsScreen.tsx` |
| 3 | NewSessionScreen | ~300 | `components/screens/NewSessionScreen.tsx` |
| 4 | SessionDetailScreen | ~600 | `components/screens/SessionDetailScreen.tsx` |
| 5 | GameSpecificationScreen | ~220 | `components/screens/GameSpecificationScreen.tsx` |
| 6 | PatientProfileScreen | ~200 | `components/screens/PatientProfileScreen.tsx` |
| 7 | ConnectDeviceScreen | ~190 | `components/screens/ConnectDeviceScreen.tsx` |
| 8 | MinigamesScreen | ~70 | `components/screens/MinigamesScreen.tsx` |
| 9 | ResultsScreen | ~100 | `components/screens/ResultsScreen.tsx` |
| 10 | HistoryScreen | ~140 | `components/screens/HistoryScreen.tsx` |
| 11 | SettingsScreen | ~120 | `components/screens/SettingsScreen.tsx` |

## Proceso Manual (Recomendado)

Para cada pantalla:

### 1. Crear archivo nuevo
```bash
New-Item -Path "app/components/screens/DashboardScreen.tsx" -ItemType File
```

### 2. Copiar estructura base
```tsx
// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD SCREEN
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { /* Importar iconos necesarios */ } from "lucide-react";
import { Card, Badge, AvatarIcon, ProgressBar } from "../shared";
import { cx } from "../../utils/helpers";
import { /* Importar tipos necesarios */ } from "../../types";

interface DashboardScreenProps {
  patients: Patient[];
  sessions: SessionRecord[];
  onNewSession: () => void;
  onViewHistory: () => void;
  onPatients: () => void;
  onSelectPatient: (p: Patient) => void;
}

export function DashboardScreen({
  patients,
  sessions,
  onNewSession,
  onViewHistory,
  onPatients,
  onSelectPatient,
}: DashboardScreenProps) {
  // COPIAR TODO EL CONTENIDO DE LA FUNCIÓN DESDE App.tsx
  
  return (
    // JSX aquí
  );
}
```

### 3. En App.tsx
- Eliminar la función completa
- Agregar import: `import { DashboardScreen } from "./components/screens/DashboardScreen";`

### 4. Verificar
```bash
npm run build
```

## Script Automático (PowerShell)

Crea este archivo `extract-screens.ps1`:

```powershell
# Script para extraer pantallas de App.tsx a archivos separados

$screens = @(
    @{Name="DashboardScreen"; Start=873; End=983},
    @{Name="PatientsScreen"; Start=985; End=1138},
    @{Name="NewSessionScreen"; Start=1140; End=1443},
    @{Name="SessionDetailScreen"; Start=1445; End=2057},
    @{Name="GameSpecificationScreen"; Start=2059; End=2283},
    @{Name="PatientProfileScreen"; Start=2285; End=2489},
    @{Name="ConnectDeviceScreen"; Start=2491; End=2684},
    @{Name="MinigamesScreen"; Start=2686; End=2759},
    @{Name="ResultsScreen"; Start=2761; End=2863},
    @{Name="HistoryScreen"; Start=2865; End=3007},
    @{Name="SettingsScreen"; Start=3009; End=3140}
)

foreach ($screen in $screens) {
    $name = $screen.Name
    $file = "app/components/screens/$name.tsx"
    
    Write-Host "Extrayendo $name..." -ForegroundColor Green
    
    # Leer líneas de App.tsx
    $lines = Get-Content "app/App.tsx" -TotalCount $screen.End | Select-Object -Skip ($screen.Start - 1)
    
    # Crear archivo con estructura
    $content = @"
import { useState } from "react";
import { Card, Badge, AvatarIcon, ProgressBar } from "../shared";
import { cx } from "../../utils/helpers";

export $($lines -join "`n")
"@
    
    Set-Content -Path $file -Value $content
    Write-Host "✓ $name extraído" -ForegroundColor Cyan
}

Write-Host "`n✅ Todas las pantallas extraídas!" -ForegroundColor Green
Write-Host "Ahora actualiza los imports en App.tsx" -ForegroundColor Yellow
```

## Imports a Agregar en App.tsx

Después de extraer, agregar al inicio de App.tsx:

```tsx
import { DashboardScreen } from "./components/screens/DashboardScreen";
import { PatientsScreen } from "./components/screens/PatientsScreen";
import { NewSessionScreen } from "./components/screens/NewSessionScreen";
import { SessionDetailScreen } from "./components/screens/SessionDetailScreen";
import { GameSpecificationScreen } from "./components/screens/GameSpecificationScreen";
import { PatientProfileScreen } from "./components/screens/PatientProfileScreen";
import { ConnectDeviceScreen } from "./components/screens/ConnectDeviceScreen";
import { MinigamesScreen } from "./components/screens/MinigamesScreen";
import { ResultsScreen } from "./components/screens/ResultsScreen";
import { HistoryScreen } from "./components/screens/HistoryScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
```

## Resultado Final Esperado

**App.tsx**: ~200 líneas (solo router y estado global)
**Cada Screen**: ~100-300 líneas
**Total**: Código modular profesional

## Testing

Después de cada extracción:
```bash
npm run build
```

Si falla, revisa:
1. Imports faltantes en el screen
2. Tipos no importados
3. Constantes no importadas

## 🎯 Prioridad

Si tienes poco tiempo, **NO es obligatorio**. Lo que ya hicimos (modularizar utils, hooks, config) ya es una mejora enorme. Las pantallas son un "nice to have" adicional.

**Para el TFG**: Con lo que ya hicimos es suficiente para demostrar buenas prácticas.
