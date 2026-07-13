# 🚀 INICIO RÁPIDO: SONARQUBE EN 5 PASOS

## ⚡ CONFIGURACIÓN RÁPIDA (10 minutos)

### Paso 1: Instalar Docker Desktop (si no lo tienes)
```
https://www.docker.com/products/docker-desktop
```

### Paso 2: Iniciar SonarQube
```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:latest
```

Esperar 1-2 minutos, luego abrir: http://localhost:9000

### Paso 3: Configurar Proyecto
1. Login: `admin` / `admin`
2. Create New Project
3. Project key: `tfg-vr-platform`
4. Click "Locally"
5. **Generar token** y copiarlo

### Paso 4: Instalar Scanner
```bash
npm install -g sonarqube-scanner
```

### Paso 5: Ejecutar Análisis
```bash
cd Plataforma_Clinica

sonar-scanner \
  -Dsonar.projectKey=tfg-vr-platform \
  -Dsonar.sources=app \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=TU_TOKEN_AQUI
```

## 📊 VER RESULTADOS

Abrir: http://localhost:9000/dashboard?id=tfg-vr-platform

**¡Listo!** Ya tienes tu análisis de calidad del código.

## 📸 PARA EL TFG

1. Captura el **Dashboard** (métricas generales)
2. Captura **Issues** (bugs encontrados)
3. Incluye en sección "Calidad del Software"

## 🎯 RESULTADOS ESPERADOS

Tu proyecto debería mostrar:
- ✅ Quality Gate: PASSED
- ✅ 0 Bugs
- ✅ 0 Vulnerabilities
- ✅ < 5% Code Smells
- ✅ < 3% Duplicación

Esto demuestra que tu código es de **calidad profesional** 🎓
