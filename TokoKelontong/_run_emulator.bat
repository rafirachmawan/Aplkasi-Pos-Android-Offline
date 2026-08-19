@echo off
REM Jalankan emulator MarketPosTest (AVD disimpan di D:\AndroidAVD)
set ANDROID_AVD_HOME=D:\AndroidAVD
start "" "C:\Users\Admin\AppData\Local\Android\Sdk\emulator\emulator.exe" -avd MarketPosTest -no-metrics
echo Emulator MarketPosTest sedang dinyalakan...
