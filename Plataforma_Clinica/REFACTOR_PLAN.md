# Plan de Refactorización - Plataforma Clínica

## ✅ Completado

### Estructura base
- ✅ Carpetas creadas: `components/screens`, `components/shared`, `config`, `hooks`, `utils`
- ✅ `constants.ts` - Constantes globales
- ✅ `utils/helpers.ts` - Funciones auxiliares
- ✅ `hooks/usePagination.ts` - Hook personalizado
- ✅ `config/gameConfig.ts` - Configuración de juegos

### Componentes compartidos
- ✅ `components/shared/AvatarIcon.tsx`
- ✅ `components/shared/Badge.tsx`
- ✅ `components/shared/Card.tsx`
- ✅ `components/shared/ProgressBar.tsx`
- ✅ `components/shared/Modal.tsx`
- ✅ `components/shared/index.ts` - Barrel export

## 🔄 Pendiente

### Componentes de UI pequeños (extraer de App.tsx)
- `OptionPill` → `components/shared/OptionPill.tsx`
- `SectionLabel` → `components/shared/SectionLabel.tsx`
- `Paginacion` → `components/shared/Pagination.tsx`

### Pantallas (screens)
- `DashboardScreen` → `components/screens/DashboardScreen.tsx`
- `PatientsScreen` → `components/screens/PatientsScreen.tsx`
- `PatientProfileScreen` → `components/screens/PatientProfileScreen.tsx`
- `NewSessionScreen` → `components/screens/NewSessionScreen.tsx`
- `SessionDetailScreen` → `components/screens/SessionDetailScreen.tsx`
- `MinigamesScreen` → `components/screens/MinigamesScreen.tsx`
- `GameSpecScreen` → `components/screens/GameSpecScreen.tsx`
- `HistoryScreen` → `components/screens/HistoryScreen.tsx`
- `SettingsScreen` → `components/screens/SettingsScreen.tsx`
- `ConnectDeviceScreen` → `components/screens/ConnectDeviceScreen.tsx`

### App.tsx principal
- Limpiar a solo router + navegación
- Mantener lógica de estado global mínima
- Importar screens desde módulos

## Estructura final

```
app/
├── components/
│   ├── screens/           # Pantallas principales (10 archivos)
│   ├── shared/            # Componentes compartidos (8 archivos)
│   └── ui/                # shadcn (existente)
├── config/
│   └── gameConfig.ts      # ✅
├── hooks/
│   └── usePagination.ts   # ✅
├── utils/
│   └── helpers.ts         # ✅
├── constants.ts           # ✅
├── types.ts               # Existente
├── db.ts                  # Existente
├── auth.ts                # Existente
├── pdfReport.ts           # Existente
└── App.tsx                # Refactorizar (solo router)
```

## Beneficios

1. **Mantenibilidad**: Cada archivo < 300 líneas
2. **Testing**: Cada componente testeable individualmente
3. **Reutilización**: Componentes compartidos extraíbles
4. **Colaboración**: Sin conflictos de merge
5. **Performance**: Tree-shaking automático
6. **Profesionalidad**: Código listo para TFG

## Próximos pasos

Dado que extraer cada pantalla individualmente tomaría muchas llamadas, voy a:

1. Crear un script de refactorización automática
2. Usar técnicas de split inteligente
3. Mantener imports correctos
4. Verificar que todo funciona

**Tiempo estimado**: 10-15 minutos
**Impacto**: Alto (código profesional)
