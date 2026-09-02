#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""СменаЛАН — автоустановка сервера.
Проверяет Python/pip, ставит зависимости, готовит папки данных
и создаёт ярлык «СменаЛАН — сервер» на рабочем столе.
"""
import os, subprocess, sys, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.normpath(os.path.join(ROOT, "..", "dist"))
DATA = os.path.join(ROOT, "data")

def step(ok, text):
    print(("  [ok] " if ok else "  [!!] ") + text)

def main():
    print("=" * 52)
    print("  СМЕНАЛАН · установка локального сервера")
    print("=" * 52)

    # 1. Python
    v = sys.version_info
    step(v >= (3, 8), "Python %d.%d.%d" % (v.major, v.minor, v.micro))
    if v < (3, 8):
        print("  Нужен Python 3.8+ (python.org). Установка остановлена."); input("Enter…"); return

    # 2. pip + зависимости
    try:
        import ensurepip  # noqa
        step(True, "pip доступен")
    except Exception:
        step(False, "pip не найден")
    reqs = os.path.join(ROOT, "requirements.txt")
    print("  Ставлю зависимости (pystray, Pillow, qrcode)…")
    subprocess.call([sys.executable, "-m", "pip", "install", "-r", reqs])
    missing = []
    for m in ("pystray", "PIL", "qrcode"):
        try:
            __import__(m)
        except Exception:
            missing.append(m)
    step(not missing, "Зависимости установлены" if not missing else "Не установились: %s — интернет/антивирус?" % ", ".join(missing))

    # 3. Сборка
    step(os.path.isfile(os.path.join(DIST, "index.html")), "Сборка dist/ найдена" if os.path.isfile(os.path.join(DIST, "index.html")) else "НЕТ dist/ — выполните `npm run build` в корне проекта")

    # 4. Папки данных
    for d in (DATA, os.path.join(DATA, "files"), os.path.join(DATA, "backups")):
        os.makedirs(d, exist_ok=True)
    step(True, "Папки данных: server/data (SQLite, файлы, копии)")

    # 5. Ярлык на рабочем столе
    try:
        if sys.platform == "win32":
            desktop = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")), "Desktop")
            if not os.path.isdir(desktop):
                desktop = os.path.join(os.environ.get("USERPROFILE", ""), "Рабочий стол")
            lnk = os.path.join(desktop, "СменаЛАН — сервер.bat")
            with open(lnk, "w", encoding="utf-8") as f:
                f.write('@echo off\r\ncd /d "%s"\r\nstart "" "%s" "%s"\r\nexit\r\n' % (ROOT, sys.executable, os.path.join(ROOT, "launcher.py")))
            step(True, "Ярлык на рабочем столе: «СменаЛАН — сервер»")
        else:
            desktop = os.path.join(os.path.expanduser("~"), "Desktop")
            os.makedirs(desktop, exist_ok=True)
            sh = os.path.join(desktop, "smenalan-server.sh")
            with open(sh, "w", encoding="utf-8") as f:
                f.write("#!/bin/sh\ncd \"%s\"\n%s launcher.py &\n" % (ROOT, sys.executable))
            os.chmod(sh, 0o755)
            step(True, "Ярлык на рабочем столе: smenalan-server.sh")
    except Exception as e:
        step(False, "Ярлык не создан (%s) — запускайте: python launcher.py" % e)

    # 6. IP
    import socket
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]; s.close()
    except Exception:
        pass
    print("=" * 52)
    print("  Готово! Двойной клик по ярлыку на рабочем столе.")
    print("  Сервер живёт в трее (правый клик — ссылка, QR, настройки).")
    print("  Ссылка для сотрудников:  http://%s:8080" % ip)
    print("  Без трея (сервер/консоль): python launcher.py --console")
    print("=" * 52)
    input("  Нажмите Enter, чтобы закрыть…")

if __name__ == "__main__":
    main()
