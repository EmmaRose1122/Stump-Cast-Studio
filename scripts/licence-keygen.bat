@echo off
setlocal EnableExtensions
REM  StumpCast Studio - paid licence key tool (seller side).
REM  Double-click it, or run "scripts\licence-keygen.bat" from a terminal in the repo root.
REM  The signing key stays in .secrets on THIS machine and must never be copied into the app.

cd /d "%~dp0.."

REM Ensure System32, Windows, and standard node paths are present in local PATH
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SystemRoot%\System32\WindowsPowerShell\v1.0\;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%PATH%"

set "NODE_CMD=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
  ) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files (x86)\nodejs\node.exe"
  ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
  ) else (
    echo Node.js is not on PATH. Install Node 20 or newer, then open this file again.
    pause
    exit /b 1
  )
)

:menu
echo.
echo  ============================================
echo   StumpCast Studio  -  licence key tool
echo  ============================================
echo   1) Create the signing keypair   (do this once)
echo   2) Issue a paid licence key
echo   3) Verify a licence key
echo   4) Quit
echo.
set "pick="
set /p pick= Pick 1-4:
if "%pick%"=="1" goto init
if "%pick%"=="2" goto issue
if "%pick%"=="3" goto verify
if "%pick%"=="4" goto done
echo Not a 1-4 choice, try again.
goto menu

:init
echo.
"%NODE_CMD%" scripts\licence-keygen.mjs --init
echo.
pause
goto menu

:issue
echo.
set "chan="
set /p chan= Channel handle, e.g. @mychannel:
if not defined chan (echo A channel is required.& goto issue)
set "plan="
set /p plan= Plan - monthly, yearly or lifetime [yearly]:
if not defined plan set "plan=yearly"
set "daysopt="
if /i "%plan%"=="lifetime" goto doissue
set "days="
set /p days= How many days? Press Enter for the plan default:
if defined days set "daysopt=--days %days%"

:doissue
echo.
REM  The token goes to a file on its own so it can be put on the clipboard without the
REM  explanatory lines; the summary is printed straight to the screen.
"%NODE_CMD%" scripts\licence-keygen.mjs --channel "%chan%" --plan "%plan%" %daysopt% 1>"%TEMP%\sc-licence.key"
if errorlevel 1 goto issuefail
type "%TEMP%\sc-licence.key" | clip
echo.
echo  The licence key is on your clipboard - paste it into WhatsApp or an email as it is.
echo  Saved too: %TEMP%\sc-licence.key
echo.
pause
goto menu

:issuefail
echo.
echo  No key was produced. Read the message above, then try again.
echo.
pause
goto menu

:verify
echo.
set "token="
set /p token= Paste a licence key to check:
if not defined token (echo Nothing pasted.& goto menu)
echo.
"%NODE_CMD%" scripts\licence-keygen.mjs --verify "%token%"
echo.
pause
goto menu

:done
endlocal
exit /b 0
