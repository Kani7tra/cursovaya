@echo off
chcp 65001 >nul
title GigaKuznya
echo ==== GigaKuznya: zapusk ====

cd /d "%~dp0server"
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  echo [1/4] Ustanovka zavisimostey servera...
  call npm install
  if errorlevel 1 goto error
)

cd /d "%~dp0web"
if not exist node_modules (
  echo [2/4] Ustanovka zavisimostey sayta...
  call npm install
  if errorlevel 1 goto error
)
if not exist dist (
  echo [3/4] Sborka sayta...
  call npm run build
  if errorlevel 1 goto error
)

cd /d "%~dp0server"
echo [4/4] Migracii bazy dannyh...
call npm run migrate
if errorlevel 1 goto error
echo.
call npm start
goto end

:error
echo.
echo OSHIBKA. Sdelayte skrinshot etogo okna.
echo Proverte parol PostgreSQL v faile server\.env
:end
pause
