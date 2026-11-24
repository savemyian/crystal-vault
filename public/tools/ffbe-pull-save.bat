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
set "DEST=%USERPROFILE%\Desktop\ffbe-save"
rem ============================================

cls
echo ==========================================================
echo    FFBE JP  -  copy the live save to your Desktop
echo    (save.db plus its -wal/-shm, so recent edits are kept)
echo ==========================================================
echo.

rem ---- 1. find adb ----------------------------------------------------------
where adb >nul 2>nul
if not errorlevel 1 goto adb_ready
for %%p in (
  "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
  "D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
  "C:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
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

rem ---- 2. which device ------------------------------------------------------
set "SERIAL="
for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices') do (
  if not defined SERIAL if /i "%%e"=="device" set "SERIAL=%%d"
)
if not defined SERIAL (
  echo [X] No authorised device. Start the emulator, then run this file again.
  echo.
  "%ADB%" devices
  goto abort
)
echo device : %SERIAL%

rem ---- 3. read access to /data/data needs root ------------------------------
"%ADB%" -s %SERIAL% root >nul 2>nul
timeout /t 3 >nul

rem ---- 4. stop the game so nothing changes while we copy --------------------
echo.
echo Stopping the game so the files hold still ...
"%ADB%" -s %SERIAL% shell "am force-stop %PKG%" >nul 2>nul
timeout /t 2 >nul

rem ---- 5. copy the three files where pull can read them ---------------------
echo Copying the save aside ...
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull; mkdir -p /sdcard/ffbe-pull; cat %DEVICE_DB% > /sdcard/ffbe-pull/save.db; if [ -f %DEVICE_DB%-wal ]; then cat %DEVICE_DB%-wal > /sdcard/ffbe-pull/save.db-wal; fi; if [ -f %DEVICE_DB%-shm ]; then cat %DEVICE_DB%-shm > /sdcard/ffbe-pull/save.db-shm; fi; ls -l /sdcard/ffbe-pull" > "%TEMP%\ffbe_pull.txt" 2>nul
type "%TEMP%\ffbe_pull.txt"

if exist "%DEST%" rd /s /q "%DEST%" >nul 2>nul
mkdir "%DEST%" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db "%DEST%\save.db" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db-wal "%DEST%\save.db-wal" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db-shm "%DEST%\save.db-shm" >nul 2>nul
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull" >nul 2>nul
del "%TEMP%\ffbe_pull.txt" >nul 2>nul

rem ---- 6. report ------------------------------------------------------------
echo.
if not exist "%DEST%\save.db" (
  echo [X] save.db could not be pulled. Is the game installed on this device?
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

echo.
echo Folder: %DEST%
echo Zip that folder ^(right-click, Send to, Compressed folder^) and attach it.
echo.
start "" explorer "%DEST%"
pause
exit /b 0

:abort
echo.
pause
exit /b 1
