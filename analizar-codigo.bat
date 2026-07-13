@echo off
echo ========================================
echo   ANALISIS DE CODIGO CON SONARQUBE
echo ========================================
echo.

echo IMPORTANTE: SonarQube debe estar corriendo en http://localhost:9000
echo Si no lo has iniciado, ejecuta primero: iniciar-sonarqube.bat
echo.
pause

cd Plataforma_Clinica

echo.
echo [1/3] Verificando sonar-scanner...
where sonar-scanner >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo sonar-scanner no encontrado. Instalando...
    call npm install -g sonarqube-scanner
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: No se pudo instalar sonar-scanner
        pause
        exit /b 1
    )
)
echo sonar-scanner: OK
echo.

echo [2/3] Ejecutando analisis de codigo...
echo Esto puede tardar 2-3 minutos...
echo.

sonar-scanner ^
  -Dsonar.projectKey=tfg-vr-platform ^
  -Dsonar.projectName="TFG - Plataforma Clinica VR" ^
  -Dsonar.projectVersion=1.0 ^
  -Dsonar.sources=app ^
  -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.ts,**/*.test.tsx ^
  -Dsonar.host.url=http://localhost:9000 ^
  -Dsonar.token=squ_b8c8b0c8c4e8e8e8e8e8e8e8e8e8e8e8e8e8

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo   ERROR EN EL ANALISIS
    echo ========================================
    echo.
    echo Posibles causas:
    echo 1. SonarQube no esta corriendo
    echo 2. Token invalido
    echo 3. Proyecto no existe en SonarQube
    echo.
    echo SOLUCION:
    echo 1. Abre http://localhost:9000
    echo 2. Login: admin / admin
    echo 3. Crea proyecto "tfg-vr-platform"
    echo 4. Genera un token
    echo 5. Edita este script y pega el token
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ANALISIS COMPLETADO CON EXITO
echo ========================================
echo.
echo [3/3] Abriendo dashboard...

start http://localhost:9000/dashboard?id=tfg-vr-platform

echo.
echo Dashboard abierto en navegador!
echo.
echo Ahora puedes:
echo - Ver metricas de calidad
echo - Revisar bugs y vulnerabilidades
echo - Capturar pantallas para el TFG
echo.
pause
