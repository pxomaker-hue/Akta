@echo off
setlocal
chcp 65001 >nul

rem Se place dans le dossier du script, quel que soit l'endroit d'ou il est lance
cd /d "%~dp0"

echo ========================================
echo   Akta - Compilation de la release
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable. Installe-le depuis https://nodejs.org
  goto :fail
)

if not exist node_modules (
  echo [1/2] Installation des dependances...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo [1/2] Dependances deja installees.
)

echo.
echo [2/2] Compilation et creation de l'installeur dans release\ ...
call npm run dist
if errorlevel 1 goto :fail

echo.
echo ========================================
echo   Termine : les fichiers sont dans release\
echo ========================================
if exist release explorer release
pause
exit /b 0

:fail
echo.
echo [ECHEC] La compilation a rencontre une erreur (voir ci-dessus).
pause
exit /b 1
