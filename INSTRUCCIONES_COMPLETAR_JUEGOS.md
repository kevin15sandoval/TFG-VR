# 🎮 INSTRUCCIONES PARA COMPLETAR LOS JUEGOS EN GODOT

## ✅ ESTADO ACTUAL

### Lo que YA ESTÁ IMPLEMENTADO:
- ✅ **Todos los scripts de lógica** (game managers, elementos interactivos)
- ✅ **HUD visible en VR** (score, timer, instrucciones)
- ✅ **Sistema de sesiones** (Firebase, polling, configuración)
- ✅ **Iluminación mejorada** en todos los mundos
- ✅ **Mundos con modelos 3D** cargados correctamente

### Lo que FALTA (MANUAL EN GODOT):
Hay que **añadir los elementos interactivos** a cada mundo usando el Editor de Godot. Los scripts ya existen, solo hay que arrastrarlos a las escenas.

---

## 🏙️ 1. CITYWORLD - Urban Attention Quest

### Elementos a añadir:

#### A. Crear contenedor de targets
1. En la escena `CityWorld.tscn`, crear un **Node3D** llamado `UrbanTargets`
2. Este será el contenedor de todos los targets urbanos

#### B. Añadir Urban Targets (15-20 targets)
Para cada target:
1. Instanciar `res://scenes/urban_target.tscn`
2. Posicionarlo en el entorno urbano (en edificios, señales, farolas)
3. Configurar en el Inspector:
   ```
   Target ID: 1, 2, 3, ... (único para cada uno)
   Points: 10
   Target Type: "window", "lamp", "door", "traffic_sign"
   Sequence Number: 0 (sin secuencia) o 1, 2, 3... (con secuencia)
   Target Color: Verde (fáciles), Amarillo (medios), Rojo (difíciles)
   ```

#### C. Distribución espacial recomendada:
- **Frontal**: 5-6 targets (fáciles de ver)
- **Laterales**: 6-8 targets (requieren girar cabeza)
- **Traseros**: 4-5 targets (requieren rotación 180°)
- **Altura variada**: Algunos arriba, algunos abajo
- **Distancia**: 5-15 metros del jugador

#### D. Verificar conexión:
El script `city_vr_start.gd` ya tiene el método `_register_targets()` que busca automáticamente el nodo `UrbanTargets` y registra todos sus hijos con el CityGameManager.

---

## 🔐 2. VAULTWORLD - Laser Vault Escape

### Elementos a añadir:

#### A. Crear contenedor de paneles
1. En `VaultWorld.tscn`, crear un **Node3D** llamado `ControlPanels`
2. Este será el contenedor de todos los paneles de control

#### B. Añadir Control Panels (8-12 paneles)
Para cada panel:
1. Instanciar `res://scenes/control_panel.tscn`
2. Posicionar en las paredes de la bóveda
3. Configurar:
   ```
   Panel ID: 1, 2, 3, ... (único)
   Points: 10 (normal), 25 (golden)
   Panel Type: "normal", "golden", "sequence"
   Sequence Number: -1 (sin secuencia) o 1, 2, 3...
   ```

#### C. Crear sistema de láser
1. Crear un **Node3D** llamado `LaserSetup`
2. Añadir 5-8 instancias de `res://scenes/laser_beam.tscn`
3. Configurar cada láser:
   ```
   Laser Length: 5.0-10.0 (metros)
   Laser Thickness: 0.05
   Move Speed: 0.5-1.5 (0 = estático)
   Move Range: 2.0-4.0 (rango de movimiento)
   Blink Enabled: true/false
   Blink Interval: 1.0-2.0 segundos
   ```

#### D. Posicionamiento de láser:
- **Horizontales**: A altura del pecho (1.5m)
- **Verticales**: Cruzando puertas
- **Diagonales**: Para aumentar dificultad
- **Móviles**: Algunos con move_speed > 0
- **Parpadeantes**: Algunos con blink_enabled = true

#### E. Distribución de paneles:
- **Altura baja**: 3-4 paneles (0.5-1.0m) - requiere agacharse
- **Altura media**: 4-5 paneles (1.5-2.0m) - normal
- **Altura alta**: 2-3 paneles (2.5-3.0m) - requiere estirar
- **Lados alternados**: Forzar cruce de línea media

---

## 📦 3. LUGGAGEWORLD - Luggage Handler

### Elementos a añadir:

#### A. Crear Luggage Spawner
1. En `LuggageWorld.tscn`, crear un **Node3D** llamado `LuggageSpawner`
2. Asignarle el script `res://scenes/luggage_spawner.gd`
3. Configurar en Inspector:
   ```
   Spawn Interval: 3.0 (segundos entre maletas)
   Conveyor Speed: 1.0 (m/s)
   Spawn Position: Vector3(0, 1, -5) (inicio de cinta)
   Difficulty: "Media"
   ```

#### B. Crear zonas de colocación
1. Crear 3 **Area3D** llamadas:
   - `GreenZone` (fácil, izquierda)
   - `YellowZone` (media, derecha)
   - `RedZone` (difícil, atrás)

2. Para cada zona:
   - Añadir un **CollisionShape3D** con **BoxShape3D**
   - Tamaño: Vector3(2, 0.5, 2) - área de 2x2m
   - Añadir al grupo "placement_zone"
   - Configurar metadata: `set_meta("zone_name", "green")`

3. Posiciones recomendadas:
   ```
   GreenZone:  Position(-3, 0.5, 0)   # Izquierda
   YellowZone: Position(3, 0.5, 0)    # Derecha  
   RedZone:    Position(0, 0.5, 3)    # Atrás
   ```

#### C. Indicadores visuales de zonas (opcional)
Para cada zona, añadir un **MeshInstance3D** con **PlaneMesh**:
```
Green: Color(0.2, 1.0, 0.3, 0.5)
Yellow: Color(1.0, 0.9, 0.2, 0.5)
Red: Color(0.9, 0.2, 0.2, 0.5)
```

#### D. Cinta transportadora (modelo visual)
El modelo `industrial_conveyor_belt.glb` ya está en la escena. Posicionarlo en:
```
Position: Vector3(0, 0, -5)
Rotation: Vector3(0, 90, 0)  # Orientada hacia el jugador
```

---

## 💎 4. WORLD - Gem Game (YA FUNCIONA)

Este juego YA ESTÁ COMPLETO. El `gem_spawner.gd` genera las gemas automáticamente.

✅ **No requiere cambios adicionales.**

---

## 🔧 PASOS GENERALES PARA CADA MUNDO

### 1. Abrir la escena en Godot
```
File > Open Scene > [Mundo].tscn
```

### 2. Verificar que el mundo tenga:
- ✅ GameManager (VaultGameManager / CityGameManager / LuggageGameManager)
- ✅ FirebaseManager
- ✅ VR Start script (vault_vr_start.gd / city_vr_start.gd / luggage_vr_start.gd)
- ✅ XROrigin3D con XRCamera3D
- ✅ Modelo 3D del entorno
- ✅ DirectionalLight3D (iluminación)

### 3. Añadir elementos según el tipo de juego (ver arriba)

### 4. Guardar la escena
```
Ctrl+S o Scene > Save Scene
```

### 5. Probar el juego
```
F5 (Run Project) o F6 (Run Current Scene)
```

---

## 🎯 PRIORIDADES

### **PRIORIDAD ALTA** (para juegos jugables):
1. ✅ CityWorld: Añadir 15-20 targets urbanos
2. ✅ VaultWorld: Añadir 10 paneles + 5-8 láser
3. ✅ LuggageWorld: Configurar spawner + 3 zonas

### **PRIORIDAD MEDIA** (mejoras):
- Ajustar posiciones según pruebas de jugabilidad
- Balancear dificultad (más/menos elementos)
- Añadir variantes de color y secuencia

### **PRIORIDAD BAJA** (pulido):
- Efectos visuales adicionales
- Sonido ambiente
- Decoración extra

---

## ✅ VERIFICACIÓN FINAL

Para cada juego, verificar:

1. **CityWorld**:
   - [ ] Hay al menos 15 targets visibles
   - [ ] Los targets tienen IDs únicos (1, 2, 3, ...)
   - [ ] Hay targets en todas direcciones (360°)
   - [ ] Algunos targets están altos, otros bajos

2. **VaultWorld**:
   - [ ] Hay al menos 8 paneles de control
   - [ ] Los paneles tienen IDs únicos
   - [ ] Hay al menos 5 láser activos
   - [ ] Los láser forman obstáculos creíbles
   - [ ] Los paneles están en diferentes alturas

3. **LuggageWorld**:
   - [ ] El spawner está configurado y activo
   - [ ] Las 3 zonas de colocación existen
   - [ ] Las zonas tienen nombres correctos ("green", "yellow", "red")
   - [ ] La cinta transportadora está visible
   - [ ] Las zonas están accesibles desde la posición del jugador

---

## 🐛 TROUBLESHOOTING

### "No aparecen los targets/paneles/láser"
- Verifica que las escenas .tscn estén correctamente instanciadas
- Revisa que los nodos padres existan (UrbanTargets, ControlPanels, LaserSetup)
- Comprueba las posiciones (pueden estar fuera de la vista)

### "Los elementos no responden a interacción"
- Verifica que los scripts estén asignados (.gd files)
- Comprueba que las señales estén conectadas (AutoLoad GameManager)
- Revisa que las capas de colisión sean correctas

### "El juego no inicia"
- Verifica que FirebaseManager esté en la escena
- Comprueba que el game manager específico esté presente
- Revisa la consola de Godot para errores de script

---

## 📝 NOTAS ADICIONALES

### Rendimiento:
- Limitar targets/paneles a 20-25 por escena máximo
- Usar LOD (Level of Detail) en modelos grandes
- Optimizar partículas (max 50 particles por emisor)

### Testing:
- Probar en modo VR (si tienes Quest/PCVR)
- Probar en modo Desktop (para debugging rápido)
- Verificar que el HUD sea legible en VR

### Git:
Después de hacer cambios en Godot:
```bash
git add *.tscn
git commit -m "Add interactive elements to [WorldName]"
git push origin feature/openxr-vr-system
```

---

## 🎉 RESULTADO ESPERADO

Cuando todo esté completado, los 4 juegos serán COMPLETAMENTE JUGABLES:

1. **💎 Gem Game**: Recoger gemas flotantes (YA FUNCIONA)
2. **🏙️ City Game**: Mirar targets urbanos 2 segundos para activarlos
3. **🔐 Vault Game**: Tocar paneles evitando láser rojos
4. **📦 Luggage Game**: Agarrar maletas y colocarlas en zonas por color

¡Todo el código y lógica ya están implementados! Solo falta la colocación manual en Godot. 🚀
