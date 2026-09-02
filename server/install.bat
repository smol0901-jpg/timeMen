@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   СменаЛАН - установка сервера (Windows)
echo ============================================
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 install.py
) else (
    python install.py
)
echo.
pause
