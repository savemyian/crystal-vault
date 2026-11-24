@echo off
setlocal EnableExtensions
title FFBE JP - pull Lapis server config
chcp 65001 >nul

rem ================= settings =================
rem Leave ADB=adb if adb is on your PATH. Otherwise put the full path here,
rem e.g. set "ADB=D:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe"
set "ADB=adb"
set "PKG=com.square_enix.ffbejpn"

set "DEVICE_CONFIG=/data/data/%PKG%/files/lapis/root/config"
set "DEVICE_STAGE=/sdcard/lapis-config"
set "DEST=%USERPROFILE%\Desktop\lapis-config"
rem ============================================

cls
echo ==========================================================
echo    FFBE JP  -  copy the Lapis server config to your Desktop
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
  echo [X] No authorised device.
  echo     Start the emulator / connect the phone, then run this file again.
  echo.
  "%ADB%" devices
  goto abort
)
echo device : %SERIAL%

rem ---- 3. read access to /data/data needs root ------------------------------
echo.
echo Asking adb for root ...
"%ADB%" -s %SERIAL% root >nul 2>nul
timeout /t 3 >nul

rem ---- 4. stage the folder where pull can always read it --------------------
echo Copying config to /sdcard ...
"%ADB%" -s %SERIAL% shell "rm -rf %DEVICE_STAGE%; cp -r %DEVICE_CONFIG% %DEVICE_STAGE% && echo STAGED" > "%TEMP%\ffbe_stage.txt" 2>nul
set "STAGED="
findstr /c:"STAGED" "%TEMP%\ffbe_stage.txt" >nul
if not errorlevel 1 set "STAGED=1"
if not defined STAGED (
  echo.
  echo [X] The game's config folder could not be copied.
  echo     Make sure adb is root ^(run: adb root^) and the game is installed.
  echo.
  echo     Device said:
  type "%TEMP%\ffbe_stage.txt"
  del "%TEMP%\ffbe_stage.txt" >nul 2>nul
  goto abort
)
del "%TEMP%\ffbe_stage.txt" >nul 2>nul

rem ---- 5. pull it -----------------------------------------------------------
if exist "%DEST%" rd /s /q "%DEST%" >nul 2>nul
echo Pulling to %DEST% ...
"%ADB%" -s %SERIAL% pull %DEVICE_STAGE% "%DEST%"
"%ADB%" -s %SERIAL% shell "rm -rf %DEVICE_STAGE%" >nul 2>nul

rem ---- 6. report ------------------------------------------------------------
echo.
if not exist "%DEST%\equip_grow.yaml" (
  echo [!] equip_grow.yaml is missing from the copy.
  echo     Files that were found:
  if exist "%DEST%" dir /b "%DEST%"
  echo.
  echo     Zip the folder and send it anyway - the list may live elsewhere.
  goto open_folder
)

for %%f in ("%DEST%\equip_grow.yaml") do echo [OK] equip_grow.yaml  %%~zf bytes
echo      folder: %DEST%
echo.
echo Next: zip the folder ^(right-click, Send to, Compressed folder^)
echo       and attach it in the chat.

:open_folder
echo.
if exist "%DEST%" start "" explorer "%DEST%"
pause
exit /b 0

:abort
echo.
pause
exit /b 1
