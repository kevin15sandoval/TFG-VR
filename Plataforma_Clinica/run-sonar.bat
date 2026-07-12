@echo off
REM ============================================
REM SCRIPT PARA EJECUTAR SONARQUBE SCANNER
REM ============================================

echo ========================================
echo   ANALISIS DE CALIDAD CON SONARQUBE
echo ========================================
echo.

REM Verificar que existe sonar-scanner
where sonar-scanner >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: sonar-scanner no esta instalado
    echo.
    echo Instalalo con: npm install -g sonarqube-scanner
    echo O descargalo de: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/
    pause
    exit /b 1
)

echo [1/2] Ejecutando analisis de codigo...
echo.

REM Ejecutar sonar-scanner
sonar-scanner ^
  -Dsonar.host.url=http://localhost:9000 ^
  -Dsonar.login=YOUR_TOKEN_HERE

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: El analisis fallo
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ANALISIS COMPLETADO CON EXITO
echo ========================================
echo.
echo Abre: http://localhost:9000/dashboard?id=tfg-vr-platform
echo.
pause
