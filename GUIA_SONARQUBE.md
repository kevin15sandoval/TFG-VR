# 📊 GUÍA DE USO DE SONARQUBE PARA EL TFG

## 🎯 ¿QUÉ ES SONARQUBE?

SonarQube es una plataforma de análisis estático de código que evalúa:
- ✅ **Bugs**: Errores de código que pueden causar fallos
- ✅ **Vulnerabilidades**: Problemas de seguridad
- ✅ **Code Smells**: Malas prácticas que dificultan mantenimiento
- ✅ **Duplicación**: Código repetido
- ✅ **Complejidad**: Funciones demasiado complejas
- ✅ **Cobertura**: Porcentaje de código testeado

## 📦 INSTALACIÓN

### Opción 1: Docker (Recomendado - Más fácil)

```bash
# 1. Instalar Docker Desktop desde https://www.docker.com/products/docker-desktop

# 2. Ejecutar SonarQube
docker run -d --name sonarqube -p 9000:9000 sonarqube:latest

# 3. Esperar 1-2 minutos y abrir
http://localhost:9000

# 4. Login inicial
User: admin
Pass: admin
# (te pedirá cambiar la contraseña)
```

### Opción 2: Instalación Manual

```bash
# 1. Descargar SonarQube
https://www.sonarsource.com/products/sonarqube/downloads/

# 2. Descomprimir y ejecutar
cd sonarqube-x.x.x/bin/windows-x86-64
StartSonar.bat

# 3. Abrir navegador
http://localhost:9000
```

### Instalar SonarQube Scanner

```bash
# Con npm (recomendado)
npm install -g sonarqube-scanner

# O descargar desde
https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/
```

## 🔧 CONFIGURACIÓN DEL PROYECTO

### Paso 1: Crear Proyecto en SonarQube

1. Abre http://localhost:9000
2. Login (admin/admin)
3. Click "Create Project"
4. Project key: `tfg-vr-platform`
5. Display name: `TFG - Plataforma Clínica VR`
6. Click "Set Up"

### Paso 2: Generar Token

1. Choose "Locally"
2. Generate Token
3. **Copiar el token** (ejemplo: `sqp_a1b2c3d4e5f6...`)

### Paso 3: Configurar Token en el Script

Editar `Plataforma_Clinica/run-sonar.bat`:

```batch
sonar-scanner ^
  -Dsonar.host.url=http://localhost:9000 ^
  -Dsonar.login=TU_TOKEN_AQUI    <-- PEGAR TOKEN AQUÍ
```

## ▶️ EJECUTAR ANÁLISIS

```bash
cd Plataforma_Clinica
run-sonar.bat
```

El análisis tomará 1-3 minutos. Al terminar:
- ✅ Se abrirá el dashboard automáticamente
- ✅ Verás métricas de calidad del código
- ✅ Podrás explorar problemas detectados

## 📊 INTERPRETANDO LOS RESULTADOS

### Panel Principal (Dashboard)

El dashboard muestra:

1. **Quality Gate**: ✅ PASSED o ❌ FAILED
   - Verde = Código aprobado
   - Rojo = Necesita correcciones

2. **Bugs**: Errores de código
   - 🔴 Blocker/Critical: Arreglar inmediatamente
   - 🟡 Major: Arreglar pronto
   - 🔵 Minor: Mejorar cuando sea posible

3. **Vulnerabilities**: Problemas de seguridad
   - 🔴 Critical: Riesgo de seguridad alto
   - 🟡 Major: Riesgo medio
   - 🔵 Minor: Riesgo bajo

4. **Code Smells**: Malas prácticas
   - Funciones muy largas
   - Código duplicado
   - Complejidad cognitiva alta

5. **Coverage**: Cobertura de tests
   - % de código con tests
   - Verde > 80%
   - Amarillo 50-80%
   - Rojo < 50%

6. **Duplications**: Código repetido
   - % de líneas duplicadas
   - Objetivo: < 3%

### Métricas Clave

```
Reliability Rating (Bugs)
A = 0 bugs
B = ≥1 minor bug
C = ≥1 major bug
D = ≥1 critical bug
E = ≥1 blocker bug

Security Rating (Vulnerabilities)
A = 0 vulnerabilities
B = ≥1 minor vuln
C = ≥1 major vuln
D = ≥1 critical vuln
E = ≥1 blocker vuln

Maintainability Rating (Code Smells)
A = deuda técnica ≤ 5%
B = deuda técnica 6-10%
C = deuda técnica 11-20%
D = deuda técnica 21-50%
E = deuda técnica > 50%
```

## 📸 CAPTURA DE PANTALLA PARA TFG

Para incluir en tu documentación:

1. **Dashboard Principal**
   - Captura: http://localhost:9000/dashboard?id=tfg-vr-platform
   - Muestra el Quality Gate y métricas generales

2. **Lista de Issues**
   - Captura: http://localhost:9000/project/issues?id=tfg-vr-platform
   - Muestra bugs, vulnerabilities y code smells

3. **Código con Problemas**
   - Click en cualquier issue → se abre el código
   - Muestra exactamente dónde está el problema

4. **Métricas por Archivo**
   - Measures → Files
   - Muestra qué archivos tienen más problemas

## 📝 EJEMPLO DE REPORTE PARA TFG

```
### 4.X Análisis de Calidad del Código

Para evaluar la calidad y seguridad del código desarrollado, se utilizó 
SonarQube, una plataforma de análisis estático que evalúa más de 30 
lenguajes de programación.

#### Configuración

Se configuró SonarQube para analizar el código TypeScript/React de la 
plataforma clínica, excluyendo dependencias de node_modules y archivos 
de configuración.

#### Resultados

El análisis reveló los siguientes resultados:

- **Quality Gate**: ✅ PASSED
- **Bugs**: 0 (Rating A)
- **Vulnerabilities**: 0 (Rating A)
- **Code Smells**: 12 (Rating A)
- **Duplicación**: 0.8%
- **Complejidad ciclomática**: 45 (promedio por función: 2.3)
- **Líneas de código**: 3,245

[INSERTAR CAPTURA DEL DASHBOARD]

La mayoría de los Code Smells detectados corresponden a funciones 
con más de 3 parámetros y algunas variables sin tipo explícito. 
Estos no afectan la funcionalidad pero podrían mejorarse en futuras 
iteraciones.

#### Conclusión

El código cumple con los estándares de calidad establecidos, sin 
bugs críticos ni vulnerabilidades de seguridad. La baja duplicación 
(< 1%) indica buenas prácticas de reutilización de código.
```

## 🔄 INTEGRACIÓN CON GITHUB ACTIONS (OPCIONAL)

Si quieres análisis automático en cada push:

```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

## 🎓 BENEFICIOS PARA EL TFG

✅ **Credibilidad**: Demuestra profesionalismo usando herramientas industry-standard
✅ **Calidad**: Prueba que el código cumple estándares de calidad
✅ **Seguridad**: Detecta vulnerabilidades antes de despliegue
✅ **Documentación**: Reportes visuales para incluir en memoria
✅ **Mejora continua**: Identifica áreas de mejora objetivamente

## 📚 RECURSOS

- **Documentación oficial**: https://docs.sonarqube.org/
- **Reglas TypeScript**: https://rules.sonarsource.com/typescript/
- **Quality Gates**: https://docs.sonarqube.org/latest/user-guide/quality-gates/
- **Métricas**: https://docs.sonarqube.org/latest/user-guide/metric-definitions/

## ⚠️ NOTAS IMPORTANTES

1. **SonarQube debe estar corriendo** en http://localhost:9000 antes de ejecutar el análisis
2. **El token es secreto**: No lo subas a GitHub
3. **Primera ejecución**: Puede tardar más (descarga reglas y plugins)
4. **Para producción**: Usar SonarCloud (gratuito para proyectos públicos)

## 🚀 ALTERNATIVA: SONARCLOUD (ONLINE)

Si no quieres instalar localmente:

1. Ve a https://sonarcloud.io
2. Login con GitHub
3. Import repository: `kevin15sandoval/TFG-VR`
4. Análisis automático en cada push
5. Badge para README: `[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=tfg-vr&metric=alert_status)](https://sonarcloud.io/dashboard?id=tfg-vr)`

---

**Fecha**: 2024  
**Proyecto**: TFG - Plataforma Clínica VR  
**Herramienta**: SonarQube 10.x  
**Lenguaje**: TypeScript, React, GDScript
