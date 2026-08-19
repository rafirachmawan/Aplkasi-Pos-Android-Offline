@echo off
REM Build & install MarketPos ke emulator/perangkat Android yang aktif.
REM Otomatis mencari JDK 17/21 dari lokasi instalasi umum.
cd /d "%~dp0"

if not defined JAVA_HOME (
  for /d %%i in ("%ProgramFiles%\Eclipse Adoptium\jdk-17*") do set "JAVA_HOME=%%i"
  for /d %%i in ("%ProgramFiles%\Eclipse Adoptium\jdk-21*") do set "JAVA_HOME=%%i"
  for /d %%i in ("%ProgramFiles%\Microsoft\jdk-17*") do set "JAVA_HOME=%%i"
  for /d %%i in ("%ProgramFiles%\Java\jdk-17*") do set "JAVA_HOME=%%i"
  for /d %%i in ("%ProgramFiles%\Java\jdk-21*") do set "JAVA_HOME=%%i"
  if exist "%ProgramFiles%\Android\Android Studio\jbr" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
)

if not defined JAVA_HOME (
  echo.
  echo [ERROR] JDK belum ditemukan di komputer ini.
  echo Install dulu JDK 17, salah satu cara:
  echo   1. Buka PowerShell sebagai Administrator, ketik:
  echo      winget install EclipseAdoptium.Temurin.17.JDK
  echo   2. Atau download manual dari https://adoptium.net/temurin/releases/?version=17
  echo Setelah install selesai, TUTUP terminal ini dan jalankan ulang script ini.
  exit /b 1
)

set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Menggunakan JAVA_HOME=%JAVA_HOME%
echo Y| npx expo run:android
