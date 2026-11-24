@echo off
setlocal EnableExtensions
title FFBE JP - pull the FULL save (db + wal + shm)
chcp 65001 >nul

rem ================= settings =================
rem Leave ADB=adb if adb is on your PATH, otherwise put the full path here.
set "ADB=adb"
set "PKG=com.square_enix.ffbejpn"
set "DEVICE_DIR=/data/data/%PKG%/files/lapis/root/data"
rem 1 = also archive every save-before-*.db backup (can be several hundred MB)
set "ALL_BACKUPS=0"
rem ============================================

set "DEST=%USERPROFILE%\Downloads\ffbe-save"
if not exist "%DEST%" mkdir "%DEST%" >nul 2>nul
if not exist "%DEST%" set "DEST=%~dp0ffbe-save"
if "%DEST:~-1%"=="\" set "DEST=%DEST:~0,-1%"
mkdir "%DEST%" >nul 2>nul

cls
echo ==========================================================
echo    FFBE JP  -  pull the FULL live save
echo    save.db + save.db-wal + save.db-shm  (all three)
echo    plus a listing of the server's own backups
echo ==========================================================
echo.
echo package : %PKG%
echo folder  : %DEST%
echo.

if not exist "%DEST%" (
  echo [X] Cannot create the output folder.
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
  echo [X] adb was not found. Edit the ADB= line at the top of this .bat.
  goto abort
)
echo adb     : %ADB%

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
  echo [X] No authorised device. Start MuMu and run this again.
  "%ADB%" devices
  goto abort
)
echo device  : %SERIAL%

rem ---- 3. root -------------------------------------------------------------
"%ADB%" -s %SERIAL% root >nul 2>nul
timeout /t 3 >nul
"%ADB%" -s %SERIAL% wait-for-device >nul 2>nul

echo.
echo Stopping the game so every file holds still ...
"%ADB%" -s %SERIAL% shell "am force-stop %PKG%" >nul 2>nul
timeout /t 2 >nul

rem ---- 4. copy the whole live set + backup listing --------------------------
echo Copying save.db, save.db-wal, save.db-shm ...
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull; mkdir -p /sdcard/ffbe-pull; for p in /data/data/%PKG%/files/lapis/root/data/save.db /data/data/%PKG%/databases/save.db /data/data/%PKG%/files/lapis/save.db /data/data/%PKG%/files/save.db; do if [ -f $p ]; then cat $p > /sdcard/ffbe-pull/save.db; if [ -f $p-wal ]; then cat $p-wal > /sdcard/ffbe-pull/save.db-wal; fi; if [ -f $p-shm ]; then cat $p-shm > /sdcard/ffbe-pull/save.db-shm; fi; echo FOUND $p; break; fi; done; ls -l /data/data/%PKG%/files/lapis/root/data > /sdcard/ffbe-pull/data-folder.txt 2>/dev/null; ls -l /data/data/%PKG%/files/lapis/root/data/backups > /sdcard/ffbe-pull/backups.txt 2>/dev/null; chmod 644 /sdcard/ffbe-pull/* 2>/dev/null; ls -l /sdcard/ffbe-pull" > "%TEMP%\ffbe_pull.txt" 2>nul
type "%TEMP%\ffbe_pull.txt"

if "%ALL_BACKUPS%"=="1" (
  echo Archiving the backup folder ...
  "%ADB%" -s %SERIAL% shell "tar czf /sdcard/ffbe-pull/backups.tgz -C /data/data/%PKG%/files/lapis/root/data/backups . 2>/dev/null; ls -l /sdcard/ffbe-pull/backups.tgz"
)

echo Starting the game again ...
"%ADB%" -s %SERIAL% shell "monkey -p %PKG% -c android.intent.category.LAUNCHER 1" >nul 2>nul

rem ---- 5. pull -------------------------------------------------------------
echo.
echo Pulling ...
for %%N in (save.db save.db-wal save.db-shm data-folder.txt backups.txt backups.tgz) do (
  if exist "%DEST%\%%N" del /q "%DEST%\%%N" >nul 2>nul
  "%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/%%N "%DEST%\%%N" >nul 2>nul
)
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull" >nul 2>nul
del "%TEMP%\ffbe_pull.txt" >nul 2>nul

rem ---- 6. report -----------------------------------------------------------
echo.
if not exist "%DEST%\save.db" (
  echo [X] save.db could not be pulled.
  pause
  exit /b 1
)

echo [OK] save.db
for %%f in ("%DEST%\save.db") do echo        %%~zf bytes
if exist "%DEST%\save.db-wal" (
  echo [OK] save.db-wal   - the newest edits live here
  for %%f in ("%DEST%\save.db-wal") do echo        %%~zf bytes
) else (
  echo [!] no save.db-wal - the game had already folded it into save.db
)
if exist "%DEST%\save.db-shm" (
  echo [OK] save.db-shm
  for %%f in ("%DEST%\save.db-shm") do echo        %%~zf bytes
) else (
  echo [!] no save.db-shm
)
if exist "%DEST%\backups.txt" (
  echo [OK] backups.txt    - the server's own save-before-*.db list
)
if exist "%DEST%\backups.tgz" (
  echo [OK] backups.tgz    - every backup, archived
) else if "%ALL_BACKUPS%"=="1" (
  echo [!] backups.tgz missing
)

rem ---- 7. zip the live set ------------------------------------------------
echo.
echo Packing save.zip from save.db + save.db-wal ...
if exist "%DEST%\save.zip" del /q "%DEST%\save.zip" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -LiteralPath '%DEST%\save.db','%DEST%\save.db-wal' -DestinationPath '%DEST%\save.zip'" >nul 2>nul
if exist "%DEST%\save.zip" (
  for %%f in ("%DEST%\save.zip") do echo [OK] save.zip       %%~zf bytes
) else (
  echo [!] zip failed - attach save.db and save.db-wal instead
)

echo.
echo Folder: %DEST%
echo Attach save.zip (it is the full live save: db + wal).
echo.
start "" explorer "%DEST%"
pause
exit /b 0

:abort
echo.
pause
exit /b 1
