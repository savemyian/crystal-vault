@echo off
setlocal EnableExtensions
title FFBE JP - pull the live save (v2)
mode con cols=92 lines=48 >nul 2>&1
color 0B

rem ===========================================================
rem  v2 - no quoted commands inside for /f (that broke v1)
rem  save goes to %%USERPROFILE%%\Downloads\ffbe-save
rem ===========================================================

set "PKG=com.square_enix.ffbejpn"

set "OUTDIR=%USERPROFILE%\Downloads\ffbe-save"
if not exist "%OUTDIR%" mkdir "%OUTDIR%" >nul 2>&1
if not exist "%OUTDIR%" set "OUTDIR=%~dp0ffbe-save"
if "%OUTDIR:~-1%"=="\" set "OUTDIR=%OUTDIR:~0,-1%"
if not exist "%OUTDIR%" mkdir "%OUTDIR%" >nul 2>&1

echo ============================================================
echo   FFBE JP  -  pull the live save
echo ============================================================
echo.
echo package : %PKG%
echo folder  : %OUTDIR%
echo.

if not exist "%OUTDIR%" (
  echo [X] Cannot create the output folder.
  goto :fail
)

rem ---------- 1. find adb ----------
set "ADB="
if defined ADB_PATH if exist "%ADB_PATH%" set "ADB=%ADB_PATH%"
for %%P in (
  "D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
  "C:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
  "D:\Program Files\Netease\MuMuPlayer-12.0\shell\adb.exe"
  "C:\Program Files\Netease\MuMuPlayer-12.0\shell\adb.exe"
  "D:\Program Files\Netease\MuMuPlayer\shell\adb.exe"
  "C:\Program Files\Netease\MuMuPlayer\shell\adb.exe"
) do if not defined ADB if exist %%P set "ADB=%%~P"
if not defined ADB for /f "delims=" %%I in ('where adb 2^>nul') do if not defined ADB set "ADB=%%I"
if not defined ADB (
  echo [X] adb.exe was not found. Start MuMu and run this again.
  goto :fail
)
echo adb     : %ADB%

rem ---------- 2. find the device ----------
set "SERIAL="
for /f "skip=1 tokens=1,2" %%A in ('"%ADB%" devices') do (
  if not defined SERIAL if /i "%%B"=="device" set "SERIAL=%%A"
)
if not defined SERIAL (
  echo checking the usual MuMu ports ...
  for %%A in (16384 16385 16416 16448 7555 5555 21503 62001 62025) do (
    if not defined SERIAL (
      "%ADB%" connect 127.0.0.1:%%A >nul 2>&1
      for /f "delims=" %%S in ('"%ADB%" -s 127.0.0.1:%%A get-state 2^>nul') do (
        if /i "%%S"=="device" set "SERIAL=127.0.0.1:%%A"
      )
    )
  )
)
if not defined SERIAL (
  echo [X] No device found. Is MuMu running?
  "%ADB%" devices
  goto :fail
)
echo device  : %SERIAL%

rem ---------- 3. root ----------
"%ADB%" -s %SERIAL% root >nul 2>&1
timeout /t 3 /nobreak >nul
"%ADB%" connect %SERIAL% >nul 2>&1
"%ADB%" -s %SERIAL% wait-for-device

set "WHO="
for /f "delims=" %%U in ('"%ADB%" -s %SERIAL% shell id 2^>nul') do set "WHO=%%U"
echo %WHO% | find "uid=0" >nul
if errorlevel 1 (
  echo shell   : NOT root
  echo [X] adb is not root, so the app folder cannot be read.
  echo     Turn on Root permission in MuMu settings, restart MuMu, run again.
  goto :fail
)
echo shell   : root

rem ---------- 4. stop the game, copy the save aside ----------
echo stopping the game ...
"%ADB%" -s %SERIAL% shell am force-stop %PKG% >nul 2>&1

echo copying save.db ...
"%ADB%" -s %SERIAL% shell "rm -f /data/local/tmp/save.db /data/local/tmp/save.db-wal /data/local/tmp/save.db-shm; for p in /data/data/%PKG%/files/lapis/root/data/save.db /data/data/%PKG%/databases/save.db /data/data/%PKG%/files/lapis/save.db /data/data/%PKG%/files/save.db; do if [ -f $p ]; then cp -f $p /data/local/tmp/save.db; cp -f $p-wal /data/local/tmp/save.db-wal; cp -f $p-shm /data/local/tmp/save.db-shm; echo FOUND $p; break; fi; done; if [ ! -s /data/local/tmp/save.db ]; then f=$(find /data/data/%PKG% -maxdepth 10 -name save.db -type f 2>/dev/null | head -n 1); cp -f $f /data/local/tmp/save.db; cp -f $f-wal /data/local/tmp/save.db-wal; cp -f $f-shm /data/local/tmp/save.db-shm; echo FOUND $f; fi; chmod 644 /data/local/tmp/save.db /data/local/tmp/save.db-wal /data/local/tmp/save.db-shm 2>/dev/null; ls -l /data/local/tmp/save.db* 2>/dev/null"

echo starting the game again ...
"%ADB%" -s %SERIAL% shell monkey -p %PKG% -c android.intent.category.LAUNCHER 1 >nul 2>&1

rem ---------- 5. pull ----------
echo pulling ...
for %%N in (save.db save.db-wal save.db-shm) do (
  if exist "%OUTDIR%\%%N" del /q "%OUTDIR%\%%N"
  "%ADB%" -s %SERIAL% pull /data/local/tmp/%%N "%OUTDIR%\%%N" >nul 2>&1
  if exist "%OUTDIR%\%%N" (echo   ok   %%N) else (echo   none %%N)
)

set "DBSIZE="
for %%F in ("%OUTDIR%\save.db") do set "DBSIZE=%%~zF"
if not defined DBSIZE (
  echo.
  echo [X] save.db did not arrive. Files on the device:
  "%ADB%" -s %SERIAL% shell "find /data/data/%PKG% -maxdepth 8 -name '*.db' 2>/dev/null"
  goto :fail
)
echo.
echo save.db : %DBSIZE% bytes
if %DBSIZE% LSS 1000000 (
  echo [X] save.db is far too small - the copy failed.
  goto :fail
)
if not exist "%OUTDIR%\save.db-wal" echo [!] no save.db-wal - recent edits may sit in the game's journal

rem ---------- 6. pack for upload ----------
echo packing save.zip ...
if exist "%OUTDIR%\save.zip" del /q "%OUTDIR%\save.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -LiteralPath '%OUTDIR%\save.db','%OUTDIR%\save.db-wal' -DestinationPath '%OUTDIR%\save.zip'" >nul 2>&1
if exist "%OUTDIR%\save.zip" (echo archive : save.zip) else (echo [!] packing failed - attach save.db and save.db-wal instead)

echo.
echo ============================================================
echo   Done. Attach save.zip from the folder that just opened.
echo ============================================================
start "" "%OUTDIR%"
echo.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo   Stopped before changing anything on the device.
echo ============================================================
echo.
pause
exit /b 1
