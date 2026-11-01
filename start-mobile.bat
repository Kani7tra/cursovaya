@echo off
chcp 65001 >nul
title GigaKuznya mobile
echo ==== GigaKuznya: mobilnoe prilozhenie ====
echo Server (start.bat) dolzhen byt uzhe zapushen v drugom okne!
echo.
cd /d "%~dp0mobile"
if not exist node_modules (
  echo [1/3] Ustanovka Expo...
  call npm install
  if errorlevel 1 goto error
  echo [2/3] Ustanovka bibliotek pod versiyu Expo...
  call npx expo install react react-native expo-status-bar expo-constants @react-native-async-storage/async-storage react-native-safe-area-context
  if errorlevel 1 goto error
  call npx expo install typescript @types/react -- --save-dev
  call npx expo install --fix
)
if not exist node_modules\expo-build-properties (
  call npx expo install expo-build-properties
)
echo [3/3] Zapusk. Otskaniruyte QR-kod v prilozhenii Expo Go na telefone.
call npx expo start --lan
goto end
:error
echo.
echo OSHIBKA. Sdelayte skrinshot etogo okna.
:end
pause
