@echo off
title GM-COMPONENTS EV2 - Consola de Agentes con EV1

set "ROOT=%~dp0"
set "AGENT_PYTHON=%ROOT%agente\.venv\Scripts\python.exe"

echo ==========================================
echo GM-COMPONENTS EV2 - Consola de Agentes
echo ==========================================
echo.
echo Este script levantara automaticamente:
echo - Backend EV1 groq-proxy en http://localhost:8787
echo - Consola EV2 de agentes usando agente\.venv
echo.
echo Al cerrar esta consola se intentara detener el backend EV1 iniciado por este script.
echo.

if not exist "%AGENT_PYTHON%" (
  echo ERROR: No se encontro el Python del entorno virtual:
  echo %AGENT_PYTHON%
  echo.
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

cd /d "%ROOT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=$env:ROOT; " ^
  "$agentPython=$env:AGENT_PYTHON; " ^
  "$proxyPath=Join-Path $root 'groq-proxy'; " ^
  "Write-Host 'Iniciando groq-proxy EV1...'; " ^
  "$proxy=Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $proxyPath -PassThru -NoNewWindow; " ^
  "Start-Sleep -Seconds 3; " ^
  "try { Invoke-RestMethod 'http://localhost:8787/api/health' | Out-Null; Write-Host 'groq-proxy activo en http://localhost:8787'; } catch { Write-Host 'Advertencia: no se pudo validar health de groq-proxy.'; } " ^
  "Write-Host ''; " ^
  "Write-Host 'Iniciando consola de agentes EV2...'; " ^
  "Write-Host 'Comandos utiles:'; " ^
  "Write-Host '  /faq tienen stock de rtx 4060'; " ^
  "Write-Host '  /rec quiero una grafica'; " ^
  "Write-Host '  salir'; " ^
  "Write-Host ''; " ^
  "try { Set-Location (Join-Path $root 'agente'); & $agentPython 'main.py'; } finally { Write-Host ''; Write-Host 'Deteniendo groq-proxy iniciado por la consola...'; if ($proxy -and -not $proxy.HasExited) { Stop-Process -Id $proxy.Id -Force -ErrorAction SilentlyContinue; } }"

echo.
echo Consola finalizada.
pause
