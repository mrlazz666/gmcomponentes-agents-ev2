@echo off
title GM-COMPONENTS EV2 - Lanzador completo

set "ROOT=%~dp0"
set "AGENT_PYTHON=%ROOT%agente\.venv\Scripts\python.exe"

echo ==========================================
echo GM-COMPONENTS EV2 - Lanzador completo
echo ==========================================
echo.
echo Se abriran tres ventanas:
echo 1. Backend EV1 groq-proxy   http://localhost:8787
echo 2. Servicio EV2 agentes     http://localhost:8790
echo 3. Frontend Angular/Ionic
echo.

if not exist "%AGENT_PYTHON%" (
  echo ERROR: No se encontro el Python del entorno virtual:
  echo %AGENT_PYTHON%
  echo.
  echo Ejecuta primero instalar_dependencias_ev2.bat
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  echo ERROR: No se encontro node_modules en la raiz.
  echo Ejecuta primero instalar_dependencias_ev2.bat
  pause
  exit /b 1
)

if not exist "%ROOT%groq-proxy\node_modules" (
  echo ERROR: No se encontro groq-proxy\node_modules.
  echo Ejecuta primero instalar_dependencias_ev2.bat
  pause
  exit /b 1
)

start "GM-COMPONENTS EV1 - groq-proxy 8787" cmd /k cd /d "%ROOT%groq-proxy" ^&^& npm.cmd start

timeout /t 3 /nobreak > nul

start "GM-COMPONENTS EV2 - Agentes FastAPI 8790" cmd /k cd /d "%ROOT%agente" ^&^& "%AGENT_PYTHON%" -m uvicorn app:app --reload --port 8790

timeout /t 3 /nobreak > nul

start "GM-COMPONENTS Frontend Angular" cmd /k cd /d "%ROOT%" ^&^& npm.cmd start

echo.
echo Servicios lanzados.
echo.
echo Health checks sugeridos:
echo   http://localhost:8787/api/health
echo   http://localhost:8790/health
echo   http://localhost:8787/api/agent/health
echo.
pause
