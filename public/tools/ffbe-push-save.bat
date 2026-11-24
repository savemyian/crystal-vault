@echo off
setlocal EnableExtensions
title FFBE JP save pusher
chcp 65001 >nul

rem ================= settings =================
rem Leave ADB=adb if adb is on your PATH. Otherwise put the full path here,
rem e.g. set "ADB=D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
set "ADB=adb"
set "PKG=com.square_enix.ffbejpn"
set "OWNER=u0_a57"

set "DEVICE_DIR=/data/data/%PKG%/files/lapis/root/data"
set "DEVICE_DB=%DEVICE_DIR%/save.db"
set "TMP_DB=/data/local/tmp/save.db"
rem ============================================

cls
echo ==========================================================
echo    FFBE JP  -  push an exported save.db to the device
echo ==========================================================
echo.

rem ---- 1. which file? -------------------------------------------------------
set "SOURCE=%~1"
if defined SOURCE goto have_source

for /f "delims=" %%f in ('dir /b /o-d "%USERPROFILE%\Downloads\*.db" 2^>nul') do (
  if not defined SOURCE set "SOURCE=%USERPROFILE%\Downloads\%%f"
)
if defined SOURCE (
  echo Using the newest .db in Downloads:
  echo    %SOURCE%
  echo    ^(drop another file on this .bat to pick a different one^)
  echo.
  goto have_source
)

echo Drop the exported .db onto this .bat, or type the path here.
set /p "SOURCE=Path: "
if not defined SOURCE goto abort

:have_source
set "SOURCE=%SOURCE:"=%"
if not exist "%SOURCE%" (
  echo.
  echo [X] File not found: %SOURCE%
  goto abort
)

rem ---- 2. find adb ----------------------------------------------------------
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

rem ---- 3. which device ------------------------------------------------------
set "SERIAL="
for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices') do (
  if not defined SERIAL if /i "%%e"=="device" set "SERIAL=%%d"
)
if not defined SERIAL (
  echo [X] No authorised device.
  echo     Connect the phone / start the emulator, accept the USB prompt,
  echo     then run this file again.
  echo.
  "%ADB%" devices
  goto abort
)

rem ---- 4. show what will happen --------------------------------------------
echo.
echo Source file : %SOURCE%
for %%s in ("%SOURCE%") do echo Size        : %%~zs bytes
echo Device      : %SERIAL%
echo Target      : %DEVICE_DB%
echo.

set "LOCAL_MD5="
for /f "skip=1 delims=" %%h in ('certutil -hashfile "%SOURCE%" MD5') do (
  if not defined LOCAL_MD5 set "LOCAL_MD5=%%h"
)
set "LOCAL_MD5=%LOCAL_MD5: =%"
echo Local MD5   : %LOCAL_MD5%
echo.
echo Press any key to write this file to the device, or Ctrl+C to cancel.
pause >nul

rem ---- 5. can we write there? ----------------------------------------------
"%ADB%" -s %SERIAL% shell "test -w %DEVICE_DIR% && echo WRITABLE" > "%TEMP%\ffbe_w.txt" 2>nul
findstr /c:"WRITABLE" "%TEMP%\ffbe_w.txt" >nul
del "%TEMP%\ffbe_w.txt" >nul 2>nul
if errorlevel 1 (
  echo [!] The save folder is not writable as shell - trying "adb root" ...
  "%ADB%" -s %SERIAL% root >nul 2>nul
  timeout /t 2 >nul
)

rem ---- 6. back up the save currently on the device -------------------------
set "STAMP=%DATE:~-4%%DATE:~3,2%%DATE:~0,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
set "STAMP=%STAMP:/=-%"
set "STAMP=%STAMP:\=-%"
set "STAMP=%STAMP::=-%"
set "STAMP=%STAMP: =0%"
if not exist "%~dp0backups" mkdir "%~dp0backups" >nul 2>nul

echo.
echo Backing up the current device save ...
"%ADB%" -s %SERIAL% shell "cat %DEVICE_DB% > /sdcard/ffbe-save-backup.db" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/ffbe-save-backup.db "%~dp0backups\save-%STAMP%.db" >nul 2>nul
"%ADB%" -s %SERIAL% shell "rm -f /sdcard/ffbe-save-backup.db" >nul 2>nul
if exist "%~dp0backups\save-%STAMP%.db" (
  echo    backup: %~dp0backups\save-%STAMP%.db
) else (
  echo    [!] backup could not be pulled - carrying on anyway
)

rem ---- 7. stop the game and clear its WAL files ----------------------------
echo.
echo Stopping the game ...
"%ADB%" -s %SERIAL% shell "am force-stop %PKG%"
"%ADB%" -s %SERIAL% shell "rm -f %DEVICE_DB%-wal %DEVICE_DB%-shm"

rem ---- 8. upload to /data/local/tmp and check the upload -------------------
echo Uploading ...
"%ADB%" -s %SERIAL% push "%SOURCE%" %TMP_DB%
if errorlevel 1 (
  echo [X] adb push failed.
  goto abort
)

set "PUSH_MD5="
"%ADB%" -s %SERIAL% shell "md5sum %TMP_DB%" > "%TEMP%\ffbe_md5.txt" 2>nul
if exist "%TEMP%\ffbe_md5.txt" set /p PUSH_MD5=<"%TEMP%\ffbe_md5.txt"
del "%TEMP%\ffbe_md5.txt" >nul 2>nul
set "PUSH_MD5=%PUSH_MD5:~0,32%"
if /i not "%PUSH_MD5%"=="%LOCAL_MD5%" (
  echo.
  echo [X] Upload is corrupt: device %PUSH_MD5%  vs  local %LOCAL_MD5%
  echo     The live save was NOT touched.
  goto abort
)
echo    upload verified: %PUSH_MD5%

rem ---- 9. copy over the live save and fix the owner ------------------------
echo.
echo Writing the live save ...
"%ADB%" -s %SERIAL% shell "cat %TMP_DB% > %DEVICE_DB% && chown %OWNER%:%OWNER% %DEVICE_DB% && rm -f %TMP_DB% && rm -f %DEVICE_DB%-wal %DEVICE_DB%-shm"
if errorlevel 1 (
  echo [X] Could not write %DEVICE_DB%
  echo     Usually this means adb is not running as root. Try:  adb root
  goto abort
)

rem ---- 10. verify the file that the game will read -------------------------
set "DEV_MD5="
"%ADB%" -s %SERIAL% shell "md5sum %DEVICE_DB%" > "%TEMP%\ffbe_md5.txt" 2>nul
if exist "%TEMP%\ffbe_md5.txt" set /p DEV_MD5=<"%TEMP%\ffbe_md5.txt"
del "%TEMP%\ffbe_md5.txt" >nul 2>nul
set "DEV_MD5=%DEV_MD5:~0,32%"

echo.
if /i "%DEV_MD5%"=="%LOCAL_MD5%" (
  echo [OK] Save replaced and verified.
  echo      device md5: %DEV_MD5%
  echo      backup    : %~dp0backups\save-%STAMP%.db
  echo.
  choice /c YN /n /m "Start the game now? [Y/N] "
  if not errorlevel 2 "%ADB%" -s %SERIAL% shell "monkey -p %PKG% -c android.intent.category.LAUNCHER 1" >nul 2>nul
  goto done
)
echo [X] The device file does not match what we sent.
echo     device %DEV_MD5%  vs  local %LOCAL_MD5%
echo     Restore the backup above before launching the game.
goto abort

:abort
echo.
pause
exit /b 1

:done
echo.
pause
exit /b 0
