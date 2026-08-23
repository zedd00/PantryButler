@echo off
REM ==========================================================================
REM  PantryButler - Windows launcher (cmd)
REM
REM  Double-click to start, or run:
REM    start-windows.bat [--reset-db] [--enable-admin-features]
REM
REM  This is a thin wrapper around start-windows.ps1. If execution policy
REM  blocks PowerShell scripts, this wrapper uses Process-scope Bypass so
REM  it should just work.
REM ==========================================================================
setlocal

set "PS1_SCRIPT=%~dp0start-windows.ps1"
set "PS_ARGS="

:parse
if "%~1"=="" goto run
if /i "%~1"=="--reset-db"            set "PS_ARGS=%PS_ARGS% -ResetDb"
if /i "%~1"=="--enable-admin-features" set "PS_ARGS=%PS_ARGS% -EnableAdminFeatures"
shift
goto parse

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_SCRIPT%" %PS_ARGS%
set "EXIT=%ERRORLEVEL%"
if not "%EXIT%"=="0" (
  echo.
  echo PantryButler startup failed with exit code %EXIT%.
  pause
  exit /b %EXIT%
)

endlocal