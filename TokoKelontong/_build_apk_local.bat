@echo off
title Build APK MarketPos (lokal, semua cache di D:)
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
rem Semua cache gradle & file sementara di drive D, jangan di C
set "GRADLE_USER_HOME=D:\GradleHome"
if not exist "D:\tmp\" mkdir "D:\tmp"
set "TMP=D:\tmp"
set "TEMP=D:\tmp"

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not exist "D:\tkb\" mkdir "D:\tkb"
echo [1/4] Menyinkronkan proyek ke D:\tkb (folder build path pendek)...
rem Pass 1: mirror+purge semua KECUALI node_modules dan folder bernama "build"
rem (robocopy /XD hanya andal dengan nama, bukan path relatif).
robocopy "%ROOT%" "D:\tkb" /MIR /MT:16 /R:1 /W:1 /XD .cxx .gradle node_modules build /NFL /NDL /NJH /NJS /NC /NS /NP
rem Pass 2: node_modules disalin TANPA purge agar cache build di D:\tkb tidak hilang.
robocopy "%ROOT%\node_modules" "D:\tkb\node_modules" /E /MT:16 /R:1 /W:1 /XD .cxx /NFL /NDL /NJH /NJS /NC /NS /NP

echo [2/4] Memeriksa cache build dari path lama...
set "POISON="
if exist "D:\tkb\android\build\generated\autolinking\autolinking.json" (
  findstr /C:"Aplkasi" "D:\tkb\android\build\generated\autolinking\autolinking.json" >nul 2>&1 && set "POISON=1"
)
if defined POISON (
  echo   Cache path lama terdeteksi - membersihkan workspace dan D:\tkb...
  if exist "D:\tkb\android\build\" rd /s /q "\\?\D:\tkb\android\build"
  if exist "D:\tkb\android\app\build\" rd /s /q "\\?\D:\tkb\android\app\build"
  if exist "%ROOT%\android\build\" rd /s /q "\\?\%ROOT%\android\build"
  if exist "%ROOT%\android\app\build\" rd /s /q "\\?\%ROOT%\android\app\build"
  for /d %%m in (D:\tkb\node_modules\*\android) do @if exist "%%m\build" rd /s /q "\\?\%%m\build"
  for /d %%m in (D:\tkb\node_modules\@*\*\android) do @if exist "%%m\build" rd /s /q "\\?\%%m\build"
  for /d %%m in ("%ROOT%\node_modules\*\android") do @if exist "%%m\build" rd /s /q "\\?\%%m\build"
  for /d %%m in ("%ROOT%\node_modules\@*\*\android") do @if exist "%%m\build" rd /s /q "\\?\%%m\build"
) else (
  echo   Cache aman - build lanjut incremental, cepat.
)

echo [3/4] Mulai build... (jangan tutup jendela ini)
echo.

cd /d "D:\tkb\android"
call gradlew.bat -I "D:\tkb\mirrors.init.gradle" assembleRelease

echo.
if exist "D:\tkb\android\app\build\outputs\apk\release\app-release.apk" (
  copy /Y "D:\tkb\android\app\build\outputs\apk\release\app-release.apk" "%ROOT%\app-release.apk" >nul
  echo ============================================================
  echo   BUILD SUKSES!
  echo   APK ada di: %ROOT%\app-release.apk
  echo ============================================================
) else (
  echo ============================================================
  echo   BUILD GAGAL - screenshot jendela ini dan kirim ke Qoder.
  echo ============================================================
)
echo.
pause
