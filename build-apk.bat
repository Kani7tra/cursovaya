@echo off
chcp 65001 >nul
title GigaKuznya APK
echo ==== Sborka APK dlya Android (oblako Expo, ~15-20 minut) ====
cd /d "%~dp0mobile"
if not exist node_modules (
  call npm install
  call npx expo install react react-native expo-status-bar expo-constants @react-native-async-storage/async-storage react-native-safe-area-context
  call npx expo install typescript @types/react -- --save-dev
)
if not exist node_modules\expo-build-properties (
  call npx expo install expo-build-properties
)
call npx expo install --fix
echo.
echo Shag 1: vhod v Expo po tokenu.
echo Sozdayte token: expo.dev - Account settings - Access tokens - Create token
set /p EXPO_TOKEN=Vstavte token i nazhmite Enter: 
echo.
set EAS_NO_VCS=1
echo Shag 2: sborka. Na voprosy otvechayte Y (Enter).
call npx eas-cli@latest build -p android --profile preview
if errorlevel 1 (
  echo.
  echo OSHIBKA sborki. Sdelayte skrinshot.
) else (
  echo.
  echo Gotovo: ssylka na APK vyshe ^(Android app: https://expo.dev/artifacts/...^)
)
pause
