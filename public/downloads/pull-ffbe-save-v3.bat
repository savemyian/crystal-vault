@echo off
setlocal EnableExtensions
title FFBE JP - pull the save (db + wal + shm)
chcp 65001 >nul

rem ================= settings =================
rem Leave ADB=adb if adb is on your PATH. Otherwise put the full path here,
rem e.g. set "ADB=D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
set "ADB=adb"
set "PKG=com.square_enix.ffbejpn"

set "DEVICE_DIR=/data/data/%PKG%/files/lapis/root/data"
set "DEVICE_DB=%DEVICE_DIR%/save.db"
rem Downloads, not Desktop: on many PCs Desktop is redirected into OneDrive
rem and the pull then has nowhere to land.
set "DEST=%USERPROFILE%\Downloads\ffbe-save"
rem ============================================

cls
echo ==========================================================
echo    FFBE JP  -  copy the live save to your Downloads
echo    (save.db plus its -wal/-shm, so recent edits are kept)
echo ==========================================================
echo.

rem ---- 0. pick a folder that really exists ---------------------------------
mkdir "%DEST%" >nul 2>nul
if not exist "%DEST%" set "DEST=%~dp0ffbe-save"
mkdir "%DEST%" >nul 2>nul
if not exist "%DEST%" set "DEST=%TEMP%\ffbe-save"
mkdir "%DEST%" >nul 2>nul
if not exist "%DEST%" (
  echo [X] No writable folder for the copy.
  goto abort
)

rem ---- 1. find adb ---------------------------------------------------------
where adb >nul 2>nul
if not errorlevel 1 goto adb_ready
for %%p in (
  "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
  "D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
  "C:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
  "D:\Program Files\Netease\MuMuPlayer-12.0\shell\adb.exe"
  "C:\Program Files\Netease\MuMuPlayer-12.0\shell\adb.exe"
  "C:\LDPlayer\LDPlayer9\adb.exe"
  "C:\Program Files\BlueStacks_nxt\HD-Adb.exe"
) do if exist %%p (
  set "ADB=%%~p"
  goto adb_ready
)

:adb_ready
"%ADB%" version >nul 2>nul
if errorlevel 1 (
  echo [X] adb was not found. Edit the ADB= line at the top of this .bat
  echo     and point it at your adb.exe, then run it again.
  goto abort
)
echo adb    : %ADB%

rem ---- 2. which device -----------------------------------------------------
set "SERIAL="
for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices') do (
  if not defined SERIAL if /i "%%e"=="device" set "SERIAL=%%d"
)
if not defined SERIAL (
  echo Connecting to MuMu on 127.0.0.1:16384 ...
  "%ADB%" connect 127.0.0.1:16384 >nul 2>nul
  for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices') do (
    if not defined SERIAL if /i "%%e"=="device" set "SERIAL=%%d"
  )
)
if not defined SERIAL (
  echo [X] No authorised device. Start the emulator, then run this file again.
  echo.
  "%ADB%" devices
  goto abort
)
echo device : %SERIAL%

rem ---- 3. read access to /data/data needs root -----------------------------
"%ADB%" -s %SERIAL% root >nul 2>nul
timeout /t 3 >nul
"%ADB%" -s %SERIAL% wait-for-device >nul 2>nul

rem ---- 4. stop the game so nothing changes while we copy -------------------
echo.
echo Stopping the game so the files hold still ...
"%ADB%" -s %SERIAL% shell "am force-stop %PKG%" >nul 2>nul
timeout /t 2 >nul

rem ---- 5. copy the three files where pull can read them --------------------
echo Copying the save aside ...
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull; mkdir -p /sdcard/ffbe-pull; cat %DEVICE_DB% > /sdcard/ffbe-pull/save.db; if [ -f %DEVICE_DB%-wal ]; then cat %DEVICE_DB%-wal > /sdcard/ffbe-pull/save.db-wal; fi; if [ -f %DEVICE_DB%-shm ]; then cat %DEVICE_DB%-shm > /sdcard/ffbe-pull/save.db-shm; fi; chmod 644 /sdcard/ffbe-pull/save.db* 2>/dev/null; ls -l /sdcard/ffbe-pull" > "%TEMP%\ffbe_pull.txt" 2>nul
type "%TEMP%\ffbe_pull.txt"

if exist "%DEST%\save.db" del /q "%DEST%\save.db" >nul 2>nul
if exist "%DEST%\save.db-wal" del /q "%DEST%\save.db-wal" >nul 2>nul
if exist "%DEST%\save.db-shm" del /q "%DEST%\save.db-shm" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull "%DEST%" >nul 2>nul
if not exist "%DEST%\save.db" (
  rem one more try, file by file, in case the folder pull refused
  "%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db "%DEST%\save.db" >nul 2>nul
  "%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db-wal "%DEST%\save.db-wal" >nul 2>nul
  "%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db-shm "%DEST%\save.db-shm" >nul 2>nul
)
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull" >nul 2>nul
del "%TEMP%\ffbe_pull.txt" >nul 2>nul

rem start the game again, the copy is done
"%ADB%" -s %SERIAL% shell "monkey -p %PKG% -c android.intent.category.LAUNCHER 1" >nul 2>nul

rem ---- 6. report -----------------------------------------------------------
echo.
if not exist "%DEST%\save.db" (
  echo [X] save.db could not be pulled. Is the game installed on this device?
  echo     Try: mkdir "%DEST%"  and run this again.
  pause
  exit /b 1
)

for %%f in ("%DEST%\save.db") do echo [OK] save.db       %%~zf bytes
if exist "%DEST%\save.db-wal" (
  for %%f in ("%DEST%\save.db-wal") do echo [OK] save.db-wal   %%~zf bytes
  echo.
  echo That -wal file holds the newest edits; they are NOT inside save.db yet.
) else (
  echo      no save.db-wal - everything is already inside save.db
)

rem ---- 7. zip it, ready to attach -----------------------------------------
echo.
echo Packing save.zip ...
if exist "%DEST%\save.zip" del /q "%DEST%\save.zip" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -LiteralPath '%DEST%\save.db','%DEST%\save.db-wal' -DestinationPath '%DEST%\save.zip'" >nul 2>nul
if exist "%DEST%\save.zip" (
  for %%f in ("%DEST%\save.zip") do echo [OK] save.zip      %%~zf bytes
) else (
  echo [!] Zip failed. Right-click the folder - Send to - Compressed folder.
)

echo.
echo Folder: %DEST%
echo Attach save.zip from that folder.
echo.
start "" explorer "%DEST%"
pause
exit /b 0

:abort
echo.
pause
exit /b 1
