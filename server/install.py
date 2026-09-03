#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""СменаЛАН — автоустановка: проверка Python/pip, зависимости, сборка, ярлык на рабочем столе."""
import os, shutil, subprocess, sys, sysconfig
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
DIST = ROOT / "dist"
REQ = ["pystray", "Pillow", "qrcode"]


def step(t):
    print(f"\n=== {t} " + "=" * max(0, 46 - len(t)), flush=True)


def ok(t):
    print(f"  [ok] {t}")


def bad(t):
    print(f"  [!!] {t}")


def have(mod):
    try:
        __import__(mod)
        return True
    except ImportError:
        return False


def pip_install(args):
    return subprocess.call([sys.executable, "-m", "pip", "install", *args]) == 0


step("1. Проверка Python")
print(f"  Python: {sys.version.split()[0]} ({sys.executable})")
if sys.version_info < (3, 8):
    bad("Нужен Python 3.8+. Скачайте с python.org и повторите.")
    input("Enter — выход…")
    sys.exit(1)
ok("Версия подходит")

step("2. Проверка pip")
if not have("pip"):
    print("  Ставим pip…")
    pip_install(["--upgrade", "pip"])
ok("pip доступен")

step("3. Зависимости")
missing = [m for m in REQ if not have(m.replace("-", "_").lower() if m != "Pillow" else "PIL")]
if missing:
    print(f"  Достаиваем: {', '.join(missing)}…")
    if not pip_install(missing):
        bad("Не удалось установить пакеты. Проверьте интернет и права.")
        input("Enter — выход…")
        sys.exit(1)
for m in REQ:
    ok(f"{m} установлен")

step("4. Проверка сборки веб-приложения")
if (DIST / "index.html").is_file():
    ok(f"Сборка найдена: {DIST}")
else:
    bad("Нет dist/index.html.")
    if shutil.which("npm") and (ROOT / "package.json").is_file():
        print("  Пробуем собрать: npm run build …")
        r = subprocess.call(["npm", "run", "build"], cwd=ROOT, shell=(os.name == "nt"))
        if r == 0 and (DIST / "index.html").is_file():
            ok("Сборка готова")
        else:
            bad("Сборка не удалась — выполните 'npm run build' вручную в корне проекта.")
    else:
        bad("npm не найден — выполните 'npm run build' в корне проекта, затем запустите сервер.")

step("5. Папки данных")
for d in (BASE / "data", BASE / "data" / "files", BASE / "data" / "backups"):
    d.mkdir(parents=True, exist_ok=True)
ok("server/data готова (база SQLite, файлы, резервные копии)")

step("6. Ярлык на рабочем столе")
launcher = BASE / "launcher.py"
created = False
if os.name == "nt":
    try:
        desktop = Path(os.path.expanduser("~")) / "Desktop"
        if not desktop.exists():
            import ctypes.wintypes
            buf = ctypes.create_unicode_buffer(512)
            ctypes.windll.shell32.SHGetFolderPathW(None, 0, None, 0, buf)
            desktop = Path(buf.value) if buf.value else desktop
        pyw = Path(sysconfig.get_path("scripts")) / "pythonw.exe"
        if not pyw.exists():
            pyw = Path(sys.executable)
        lnk = desktop / "СменаЛАН — сервер.url"
        lnk.write_text(
            "[InternetShortcut]\n"
            f'URL=file:///{str(launcher).replace(os.sep, "/")}\n'
            f"IconIndex=0\n",
            encoding="utf-8",
        )
        # полноценный .lnk через PowerShell, чтобы запускался pythonw (без консоли)
        ps = (
            "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('"
            + str(desktop / "СменаЛАН — сервер.lnk")
            + "'); $s.TargetPath='" + str(pyw) + "'; $s.Arguments='\"" + str(launcher) + "\"'; "
            + "$s.WorkingDirectory='" + str(BASE) + "'; $s.Save()"
        )
        subprocess.call(["powershell", "-NoProfile", "-Command", ps])
        created = (desktop / "СменаЛАН — сервер.lnk").exists() or lnk.exists()
        if created:
            ok(f"Ярлык создан: {desktop}")
    except Exception as e:
        bad(f"Не удалось создать ярлык: {e}")
else:
    desktop = Path(os.path.expanduser("~")) / "Desktop"
    if desktop.exists():
        sh = desktop / "smenalan-server.sh"
        sh.write_text(f"#!/bin/sh\ncd '{BASE}'\n'{sys.executable}' '{launcher}'\n", encoding="utf-8")
        sh.chmod(0o755)
        created = True
        ok(f"Ярлык создан: {sh}")

step("Готово")
print("  Запустите ярлык «СменаЛАН — сервер» на рабочем столе")
print(f"  или:  cd {BASE} && {sys.executable} launcher.py")
print("  Сервер живёт в трее: правый клик — ссылка для сотрудников, QR-код, настройки.")
if not created:
    print("  (ярлык не создался — запускайте командой выше)")
try:
    input("\nEnter — закрыть…")
except (EOFError, KeyboardInterrupt):
    pass
