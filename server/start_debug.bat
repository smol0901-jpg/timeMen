@echo off
chcp 65001 >nul
cd /d "%~dp0"
title СменаЛАН — сервер (отладка)
python server.py
pause
