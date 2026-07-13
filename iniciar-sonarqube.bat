@echo off
echo ========================================
echo   INICIANDO SONARQUBE PARA TFG
echo ========================================
echo.

echo [1/4] Verificando Docker Desktop...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker no esta instalado
    echo Descargalo de: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo Docker instalado: OK
echo.

echo [2/4] Verificando si Docker esta corriendo...
docker ps >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Docker no esta corriendo. Iniciando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Esperando 30 segundos a que Docker inicie...
    timeout /t 30 /nobreak
)

echo.
echo [3/4] Iniciando contenedor SonarQube...
docker ps -a | findstr sonarqube >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Contenedor ya existe, reiniciando...
    docker start sonarqube
) else (
    echo Creando nuevo contenedor...
    docker run -d --name sonarqube -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true -p 9000:9000 sonarqube:community
)

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: No se pudo iniciar SonarQube
    pause
    exit /b 1
)

echo.
echo [4/4] Esperando a que SonarQube este listo...
echo Esto puede tardar 1-2 minutos...
timeout /t 60 /nobreak

echo.
echo ========================================
echo   SONARQUBE INICIADO CORRECTAMENTE
echo ========================================
echo.
echo Abre tu navegador en:
echo http://localhost:9000
echo.
echo Login inicial:
echo   Usuario: admin
echo   Password: admin
echo.
echo Presiona cualquier tecla para abrir el navegador...
pause >nul

start http://localhost:9000

echo.
echo NOTA: Si la pagina no carga, espera 1 minuto mas
echo y recarga el navegador (F5)
echo.
pause
