@echo off
title GM-COMPONENTS EV2 - Instalador de dependencias
set ROOT=%~dp0
set AGENT_VENV=%ROOT%agente\.venv
set AGENT_PYTHON=%AGENT_VENV%\Scripts\python.exe
echo ==========================================
echo GM-COMPONENTS EV2 - Instalador
echo ==========================================
echo.
echo Este script instalara:
echo 1. Dependencias frontend Angular/Ionic
echo 2. Dependencias backend EV1 groq-proxy
echo 3. Entorno virtual Python 3.11 para EV2 agentes
echo.
echo No instala dependencias Python dentro de EV1.
echo No modifica archivos .env.
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm no esta disponible. Instala Node.js antes de continuar.
  pause
  exit /b 1
)
py -3.11 --version >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python 3.11 no esta disponible con el comando py -3.11.
  pause
  exit /b 1
)
pause
echo.
echo ==========================================
echo Instalando dependencias frontend
echo ==========================================
cd /d "%ROOT%"
call npm.cmd install
if errorlevel 1 (
  echo.
  echo ERROR: fallo npm install en frontend.
  pause
  exit /b 1
)
if not exist "%ROOT%node_modules" (
  echo.
  echo ERROR: no se encontro node_modules en la raiz.
  pause
  exit /b 1
)
echo.
echo ==========================================
echo Instalando dependencias backend EV1 groq-proxy
echo ==========================================
cd /d "%ROOT%groq-proxy"
call npm.cmd install
if errorlevel 1 (
  echo.
  echo ERROR: fallo npm install en groq-proxy.
  pause
  exit /b 1
)
if not exist "%ROOT%groq-proxy\node_modules" (
  echo.
  echo ERROR: no se encontro groq-proxy\node_modules.
  pause
  exit /b 1
)
echo.
echo ==========================================
echo Preparando entorno Python 3.11 para EV2 agentes
echo ==========================================
cd /d "%ROOT%agente"
if not exist "%AGENT_VENV%" (
  py -3.11 -m venv "%AGENT_VENV%"
  if errorlevel 1 (
    echo.
    echo ERROR: no se pudo crear agente\.venv.
    pause
    exit /b 1
  )
) else (
  echo Entorno virtual existente encontrado: agente\.venv
)
"%AGENT_PYTHON%" -m pip install --upgrade pip
if errorlevel 1 (
  echo.
  echo ERROR: fallo actualizando pip.
  pause
  exit /b 1
)
"%AGENT_PYTHON%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo ERROR: fallo instalando requirements.txt de agentes EV2.
  pause
  exit /b 1
)
"%AGENT_PYTHON%" -m uvicorn --version >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: uvicorn no quedo instalado en agente\.venv.
  pause
  exit /b 1
)
"%AGENT_PYTHON%" -c "from tools.langchain_tool_registry import get_langchain_tool_names; print(get_langchain_tool_names())"
if errorlevel 1 (
  echo.
  echo ERROR: no se pudo importar LangChain tools desde agente\.venv.
  pause
  exit /b 1
)
echo.
echo ==========================================
echo Configurando archivo .env
echo ==========================================
if not exist "%ROOT%groq-proxy\.env" (
  copy "%ROOT%groq-proxy\.env.example" "%ROOT%groq-proxy\.env"
  echo [LISTO] groq-proxy\.env creado desde .env.example
  echo Abrelo y reemplaza las claves reales antes de iniciar.
) else (
  echo [OK] groq-proxy\.env ya existe, no se sobreescribe.
)
echo.
echo ==========================================
echo Instalacion completada correctamente
echo ==========================================
echo.
echo ==========================================
echo CONFIGURACION REQUERIDA ANTES DE INICIAR
echo ==========================================
echo.
echo Debes abrir y completar el archivo:
echo.
echo   groq-proxy\.env
echo.
echo Reemplaza los siguientes valores con tus claves reales:
echo.
echo   GROQ_API_KEY=tu clave de groq.com
echo   VOYAGE_API_KEY=tu clave de voyageai.com
echo   MONGODB_URI=tu cadena de conexion MongoDB Atlas
echo.
echo Sin esas claves el proyecto NO funcionara.
echo.
echo ==========================================
echo.
echo Solo una vez configurado el .env puedes ejecutar:
echo - iniciar_proyecto_completo_ev2.bat
echo - iniciar_consola_agentes_ev2.bat
echo.
pause