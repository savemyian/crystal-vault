@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Crystal Vault - Save Tools
chcp 65001 >nul

rem ============================================================
rem  Crystal Vault save tools
rem  One file, two actions. No commands to type.
rem    1 = pull the live save from MuMu
rem    2 = push the edited save back
rem ============================================================

set "PKG=com.square_enix.ffbejpn"
set "DEFAULT_DIR=/data/data/%PKG%/files/lapis/root/data"
set "DEVICE_DB="
set "APP_UID="
set "SERIAL="
set "SOURCE="
set "BACKUP="

set "WORK=%~dp0ffbe-save"
if "%WORK:~-1%"=="\" set "WORK=%WORK:~0,-1%"
if not exist "%WORK%" mkdir "%WORK%" >nul 2>nul
if not exist "%WORK%" (
  set "WORK=%USERPROFILE%\Downloads\ffbe-save"
  mkdir "%WORK%" >nul 2>nul
)
set "INI=%~dp0ffbe-save-tools.ini"
set "TMP=%TEMP%\crystal-vault-save"
if not exist "%TMP%" mkdir "%TMP%" >nul 2>nul

if exist "%INI%" for /f "usebackq tokens=1,* delims==" %%a in ("%INI%") do (
  if /i "%%a"=="ADB" set "ADB=%%b"
)

rem A file dropped on the .bat goes straight to the push step.
if not "%~1"=="" if exist "%~1" (
  set "SOURCE=%~1"
  goto PUSH
)

:MENU
cls
echo ============================================================
echo    Crystal Vault - Save Tools
echo ============================================================
echo.
echo    1. Pull the save from MuMu
echo    2. Push the edited save back to MuMu
echo    3. Open the save folder
echo    4. Exit
echo.
if defined SOURCE echo    Push source: %SOURCE%
echo.
echo    Tip: drag save.db onto this file to push it directly.
echo.
choice /c 1234 /n /m "Choose 1-4: "
if errorlevel 4 goto END
if errorlevel 3 goto OPEN_FOLDER
if errorlevel 2 goto PUSH
goto PULL

rem ============================================================
rem  Pull
rem ============================================================
:PULL
cls
echo ============================================================
echo    Step 1 - pull the live save
echo ============================================================
echo.
call :FIND_ADB
if not defined ADB (
  echo [X] adb.exe was not found.
  echo     Install or open MuMu, then run this tool again.
  echo     If MuMu is installed in a custom folder, choose its adb.exe
  echo     in the file picker and it will be remembered.
  goto PAUSE_MENU
)
echo adb     : %ADB%

call :FIND_DEVICE
if not defined SERIAL (
  echo [X] No emulator was found.
  echo     Start MuMu, wait for the home screen, then try again.
  goto PAUSE_MENU
)
echo device  : %SERIAL%

call :ENSURE_ROOT
if errorlevel 1 goto PAUSE_MENU

call :FIND_DEVICE_DB
if not defined DEVICE_DB (
  echo [X] The FFBE save was not found on the device.
  echo     Open the game once so the server creates its save, then try again.
  goto PAUSE_MENU
)
echo save    : %DEVICE_DB%

echo.
echo Stopping the game so the files hold still ...
call :STOP_GAME

echo Copying save.db, save.db-wal and save.db-shm ...
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull; mkdir -p /sdcard/ffbe-pull" >nul 2>nul
"%ADB%" -s %SERIAL% shell "cat %DEVICE_DB% > /sdcard/ffbe-pull/save.db; if [ -f %DEVICE_DB%-wal ]; then cat %DEVICE_DB%-wal > /sdcard/ffbe-pull/save.db-wal; fi; if [ -f %DEVICE_DB%-shm ]; then cat %DEVICE_DB%-shm > /sdcard/ffbe-pull/save.db-shm; fi; chmod 644 /sdcard/ffbe-pull/* 2>/dev/null" >nul 2>nul

if not exist "%WORK%\pulled" mkdir "%WORK%\pulled" >nul 2>nul
if exist "%WORK%\save.db" del /q "%WORK%\save.db" >nul 2>nul
if exist "%WORK%\save.db-wal" del /q "%WORK%\save.db-wal" >nul 2>nul
if exist "%WORK%\save.db-shm" del /q "%WORK%\save.db-shm" >nul 2>nul
if exist "%WORK%\pulled\save.db" del /q "%WORK%\pulled\save.db" >nul 2>nul
if exist "%WORK%\pulled\save.db-wal" del /q "%WORK%\pulled\save.db-wal" >nul 2>nul
if exist "%WORK%\pulled\save.db-shm" del /q "%WORK%\pulled\save.db-shm" >nul 2>nul
if exist "%WORK%\save.zip" del /q "%WORK%\save.zip" >nul 2>nul

"%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db "%WORK%\pulled\save.db" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db-wal "%WORK%\pulled\save.db-wal" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/ffbe-pull/save.db-shm "%WORK%\pulled\save.db-shm" >nul 2>nul
"%ADB%" -s %SERIAL% shell "rm -rf /sdcard/ffbe-pull" >nul 2>nul

if not exist "%WORK%\pulled\save.db" (
  echo.
  echo [X] save.db could not be pulled.
  goto PAUSE_MENU
)

echo.
echo Packing save.zip ...
if exist "%WORK%\pulled\save.db-wal" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -LiteralPath '%WORK%\pulled\save.db','%WORK%\pulled\save.db-wal' -DestinationPath '%WORK%\save.zip'" >nul 2>nul
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -LiteralPath '%WORK%\pulled\save.db' -DestinationPath '%WORK%\save.zip'" >nul 2>nul
)

echo.
echo [OK] The save is ready and the game is stopped.
echo      Folder: %WORK%
if exist "%WORK%\save.zip" echo      File  : save.zip  ^(drag this into Crystal Vault^)
if exist "%WORK%\pulled\save.db-wal" echo      WAL   : included; the editor merges it automatically
echo.
echo Keep the game closed until you push the edited save back.
echo Playing now would be overwritten by the push.
start "" explorer "%WORK%"
goto PAUSE_MENU

rem ============================================================
rem  Push
rem ============================================================
:PUSH
cls
echo ============================================================
echo    Step 2 - push the edited save back
echo ============================================================
echo.

if not defined SOURCE call :PICK_SOURCE
if not defined SOURCE (
  echo [X] No edited save was selected.
  goto PAUSE_MENU
)

echo Selected file:
echo    %SOURCE%
for %%s in ("%SOURCE%") do echo    %%~zs bytes  ^(%%~ts^)
echo.
choice /c YN /n /m "Use this file? [Y/N] "
if errorlevel 2 (
  set "SOURCE="
  call :BROWSE_SOURCE
  if not defined SOURCE goto PAUSE_MENU
)

call :CHECK_SQLITE
if errorlevel 1 (
  echo.
  echo [X] That file is not a SQLite database.
  echo     Export the save from Crystal Vault and try again.
  goto PAUSE_MENU
)

call :FIND_ADB
if not defined ADB (
  echo [X] adb.exe was not found. Run the pull step first, or pick adb.exe.
  goto PAUSE_MENU
)
call :FIND_DEVICE
if not defined SERIAL (
  echo [X] No emulator was found. Start MuMu and try again.
  goto PAUSE_MENU
)
call :ENSURE_ROOT
if errorlevel 1 goto PAUSE_MENU
call :FIND_DEVICE_DB
if not defined DEVICE_DB (
  echo [X] The live save was not found on the device.
  goto PAUSE_MENU
)

call :MD5_LOCAL
if not defined LOCAL_MD5 (
  echo [X] Could not read the selected file.
  goto PAUSE_MENU
)
echo md5       : %LOCAL_MD5%

echo.
echo Stopping the game ...
call :STOP_GAME

for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%t"
if not defined STAMP set "STAMP=manual"
if not exist "%WORK%\backups" mkdir "%WORK%\backups" >nul 2>nul
set "BACKUP=%WORK%\backups\save-%STAMP%.db"
set "BACKUP_WAL=%BACKUP%-wal"

echo Backing up the live save to:
echo    %BACKUP%
"%ADB%" -s %SERIAL% shell "cat %DEVICE_DB% > /sdcard/cv-save-backup.db; if [ -f %DEVICE_DB%-wal ]; then cat %DEVICE_DB%-wal > /sdcard/cv-save-backup.db-wal; else rm -f /sdcard/cv-save-backup.db-wal; fi" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/cv-save-backup.db "%BACKUP%" >nul 2>nul
if exist "%BACKUP%-wal" del /q "%BACKUP%-wal" >nul 2>nul
"%ADB%" -s %SERIAL% pull /sdcard/cv-save-backup.db-wal "%BACKUP_WAL%" >nul 2>nul
"%ADB%" -s %SERIAL% shell "rm -f /sdcard/cv-save-backup.db /sdcard/cv-save-backup.db-wal" >nul 2>nul
if not exist "%BACKUP%" (
  echo.
  echo [X] The live save could not be backed up, so nothing was changed.
  echo     Check that MuMu root is enabled.
  goto PAUSE_MENU
)

echo Uploading the edited save ...
"%ADB%" -s %SERIAL% push "%SOURCE%" /data/local/tmp/cv-save.db >nul 2>nul
if errorlevel 1 (
  echo [X] Upload failed. Nothing was changed.
  goto PAUSE_MENU
)

set "PUSH_MD5="
"%ADB%" -s %SERIAL% shell "md5sum /data/local/tmp/cv-save.db" > "%TMP%\md5.txt" 2>nul
if exist "%TMP%\md5.txt" set /p PUSH_MD5=<"%TMP%\md5.txt"
set "PUSH_MD5=%PUSH_MD5:~0,32%"
if /i not "%PUSH_MD5%"=="%LOCAL_MD5%" (
  echo [X] The upload was damaged. Nothing was changed.
  goto PAUSE_MENU
)

call :GET_APP_UID
echo Writing the live save ...
"%ADB%" -s %SERIAL% shell "cat /data/local/tmp/cv-save.db > %DEVICE_DB% && rm -f /data/local/tmp/cv-save.db %DEVICE_DB%-wal %DEVICE_DB%-shm" >nul 2>nul
if defined APP_UID (
  "%ADB%" -s %SERIAL% shell "chown %APP_UID%:%APP_UID% %DEVICE_DB% 2>/dev/null; restorecon %DEVICE_DB% 2>/dev/null" >nul 2>nul
)

set "DEV_MD5="
"%ADB%" -s %SERIAL% shell "md5sum %DEVICE_DB%" > "%TMP%\md5.txt" 2>nul
if exist "%TMP%\md5.txt" set /p DEV_MD5=<"%TMP%\md5.txt"
set "DEV_MD5=%DEV_MD5:~0,32%"

echo.
set "CLEAN_OK="
if /i "%DEV_MD5%"=="%LOCAL_MD5%" (
  "%ADB%" -s %SERIAL% shell "test ! -e %DEVICE_DB%-wal && test ! -e %DEVICE_DB%-shm && echo CLEAN" > "%TMP%\clean.txt" 2>nul
  findstr /c:"CLEAN" "%TMP%\clean.txt" >nul 2>nul
  if not errorlevel 1 set "CLEAN_OK=1"
  del "%TMP%\clean.txt" >nul 2>nul
)

if defined CLEAN_OK (
  echo [OK] Save replaced and verified.
  echo      Backup: %BACKUP%
  echo.
  echo Starting the game ...
  call :START_GAME
  echo Done. Check your account and item world screens.
) else (
  echo [X] The live file did not match the uploaded save.
  echo     Restoring the backup ...
  "%ADB%" -s %SERIAL% push "%BACKUP%" /data/local/tmp/cv-restore.db >nul 2>nul
  "%ADB%" -s %SERIAL% shell "cat /data/local/tmp/cv-restore.db > %DEVICE_DB%; rm -f /data/local/tmp/cv-restore.db %DEVICE_DB%-wal %DEVICE_DB%-shm" >nul 2>nul
  if exist "%BACKUP_WAL%" (
    "%ADB%" -s %SERIAL% push "%BACKUP_WAL%" /data/local/tmp/cv-restore.db-wal >nul 2>nul
    "%ADB%" -s %SERIAL% shell "cat /data/local/tmp/cv-restore.db-wal > %DEVICE_DB%-wal; rm -f /data/local/tmp/cv-restore.db-wal" >nul 2>nul
  )
  if defined APP_UID "%ADB%" -s %SERIAL% shell "chown %APP_UID%:%APP_UID% %DEVICE_DB% 2>/dev/null" >nul 2>nul
  echo     Backup restored: %BACKUP%
  call :START_GAME
)
set "SOURCE="
goto PAUSE_MENU

rem ============================================================
rem  Helpers
rem ============================================================
:FIND_ADB
if defined ADB if exist "%ADB%" (
  "%ADB%" version >nul 2>nul
  if not errorlevel 1 exit /b 0
)
set "ADB="
where adb >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%a in ('where adb') do if not defined ADB set "ADB=%%a"
  if defined ADB exit /b 0
)

for %%p in (
  "%ProgramFiles%\Netease\MuMuPlayer-12.0\shell\adb.exe"
  "%ProgramFiles%\Netease\MuMuPlayer-12.0\nx_main\adb.exe"
  "%ProgramFiles%\Netease\MuMuPlayer\nx_main\adb.exe"
  "%ProgramFiles%\Netease\MuMuPlayer\nx_device\12.0\shell\adb.exe"
  "%ProgramFiles%\Netease\MuMuPlayer-12.0\nx_device\12.0\shell\adb.exe"
  "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
  "C:\LDPlayer\LDPlayer9\adb.exe"
  "C:\LDPlayer\LDPlayer64\adb.exe"
  "%ProgramFiles%\BlueStacks_nxt\HD-Adb.exe"
  "%ProgramFiles%\Nox\bin\adb.exe"
  "%ProgramFiles%\Microvirt\MEmu\adb.exe"
) do if exist %%p (
  set "ADB=%%~p"
  goto :ADB_KNOWN_OK
)

for %%d in (C D E F G) do (
  if exist "%%d:\Program Files\Netease\MuMuPlayer-12.0\shell\adb.exe" set "ADB=%%d:\Program Files\Netease\MuMuPlayer-12.0\shell\adb.exe"
  if exist "%%d:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe" set "ADB=%%d:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
)
if defined ADB goto :ADB_KNOWN_OK

echo MuMu was not found automatically.
echo A file picker will open; choose the adb.exe inside your emulator folder.
for /f "usebackq delims=" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Select adb.exe from your emulator'; $d.Filter='adb.exe^|adb.exe^|All files^|*.*'; if($d.ShowDialog() -eq 'OK'){ $d.FileName }"`) do set "ADB=%%a"

:ADB_KNOWN_OK
if not defined ADB exit /b 1
"%ADB%" version >nul 2>nul
if errorlevel 1 (
  set "ADB="
  exit /b 1
)
echo ADB=%ADB%>"%INI%"
exit /b 0

:FIND_DEVICE
set "SERIAL="
call :LIST_DEVICES
if defined SERIAL exit /b 0
echo Looking for the emulator on common adb ports ...
for %%p in (16384 7555 62001 5555 21503) do (
  "%ADB%" connect 127.0.0.1:%%p >nul 2>nul
)
timeout /t 2 >nul
call :LIST_DEVICES
exit /b 0

:LIST_DEVICES
for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices 2^>nul') do (
  if not defined SERIAL if /i "%%e"=="device" set "SERIAL=%%d"
)
exit /b 0

:ENSURE_ROOT
"%ADB%" -s %SERIAL% root >nul 2>nul
timeout /t 3 >nul
"%ADB%" -s %SERIAL% wait-for-device >nul 2>nul
"%ADB%" -s %SERIAL% shell id > "%TMP%\id.txt" 2>nul
findstr /c:"uid=0" "%TMP%\id.txt" >nul
if errorlevel 1 (
  echo.
  echo [!] MuMu is not giving adb root access.
  echo     Open MuMu settings: Settings ^> Other ^> Root permission, turn it ON,
  echo     then close and reopen MuMu and run this tool again.
  exit /b 1
)
exit /b 0

:FIND_DEVICE_DB
set "DEVICE_DB="
for %%p in (
  /data/data/%PKG%/files/lapis/root/data/save.db
  /data/data/%PKG%/databases/save.db
  /data/data/%PKG%/files/lapis/save.db
  /data/data/%PKG%/files/save.db
) do (
  if not defined DEVICE_DB (
    set "FOUND="
    "%ADB%" -s %SERIAL% shell "test -f %%p && echo %%p" > "%TMP%\path.txt" 2>nul
    if exist "%TMP%\path.txt" set /p FOUND=<"%TMP%\path.txt"
    if defined FOUND if "!FOUND:~0,1!"=="/" set "DEVICE_DB=!FOUND!"
  )
)
del "%TMP%\path.txt" >nul 2>nul
if not defined DEVICE_DB exit /b 1
exit /b 0

:GET_APP_UID
set "APP_UID="
"%ADB%" -s %SERIAL% shell "dumpsys package %PKG%" > "%TMP%\pkg.txt" 2>nul
for /f "tokens=2 delims==" %%u in ('findstr /c:"userId=" "%TMP%\pkg.txt" 2^>nul') do (
  if not defined APP_UID set "APP_UID=%%u"
)
set "APP_UID=%APP_UID: =%"
del "%TMP%\pkg.txt" >nul 2>nul
exit /b 0

:STOP_GAME
"%ADB%" -s %SERIAL% shell "am force-stop %PKG%" >nul 2>nul
timeout /t 2 >nul
exit /b 0

:START_GAME
"%ADB%" -s %SERIAL% shell "monkey -p %PKG% -c android.intent.category.LAUNCHER 1" >nul 2>nul
exit /b 0

:MD5_LOCAL
set "LOCAL_MD5="
for /f "skip=1 delims=" %%h in ('certutil -hashfile "%SOURCE%" MD5 2^>nul') do (
  if not defined LOCAL_MD5 set "LOCAL_MD5=%%h"
)
set "LOCAL_MD5=%LOCAL_MD5: =%"
if defined LOCAL_MD5 set "LOCAL_MD5=%LOCAL_MD5:~0,32%"
exit /b 0

:CHECK_SQLITE
powershell -NoProfile -Command "try { $b=[IO.File]::ReadAllBytes('%SOURCE%'); $m=[Text.Encoding]::ASCII.GetString($b,0,16); if($m -ne ('SQLite format 3'+[char]0)){ exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0

:PICK_SOURCE
echo Looking for the newest edited save ...
for /f "usebackq delims=" %%f in (`powershell -NoProfile -Command "$c=@(); if(Test-Path -LiteralPath '%WORK%\save.db'){$c+=Get-Item -LiteralPath '%WORK%\save.db'}; Get-ChildItem -LiteralPath '%USERPROFILE%\Downloads' -Filter *.db -File -ErrorAction SilentlyContinue ^| ForEach-Object { $c+=$_ }; $c ^| Sort-Object LastWriteTime -Descending ^| Select-Object -First 1 -ExpandProperty FullName"`) do set "SOURCE=%%f"
if not defined SOURCE call :BROWSE_SOURCE
exit /b 0

:BROWSE_SOURCE
echo A file picker will open. Choose the exported save.db.
for /f "usebackq delims=" %%f in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Select the edited save.db'; $d.Filter='Save database^|*.db;*.sqlite^|All files^|*.*'; if($d.ShowDialog() -eq 'OK'){ $d.FileName }"`) do set "SOURCE=%%f"
exit /b 0

:OPEN_FOLDER
if not exist "%WORK%" mkdir "%WORK%" >nul 2>nul
start "" explorer "%WORK%"
timeout /t 1 >nul
goto MENU

:PAUSE_MENU
set "SOURCE="
echo.
pause
goto MENU

:END
exit /b 0
