# -*- coding: utf-8 -*-
"""
СменаЛАН · автоматическая установка сервера на ПК.

Что делает:
  1. Проверяет версию Python.
  2. Проверяет и докачивает Python-зависимости (pystray, Pillow, qrcode).
  3. Если нет сборки фронтенда (dist/), проверяет Node.js и собирает его.
  4. Создаёт конфиг server/config.json.
  5. Создаёт ярлык запуска на рабочем столе (Windows / Linux).
  6. Показывает IP и ссылку для сотрудников, предлагает запустить сервер.

Запуск:  python setup.py
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
IS_WIN = sys.platform == "win32"
TOTAL = 6
PYDEPS = [("pystray", "pystray"), ("Pillow", "PIL"), ("qrcode", "qrcode")]


def step(n, text):
    print(f"\n[{n}/{TOTAL}] {text}")


def ok(text):
    print(f"    OK  {text}")


def warn(text):
    print(f"    !!  {text}")


def fail(text):
    print(f"  ОШИБКА  {text}")


# ---------------------------------------------------------------- 1. python
def check_python():
    step(1, "Проверка Python…")
    v = sys.version_info
    ok(f"Python {v.major}.{v.minor}.{v.micro}")
    if (v.major, v.minor) < (3, 8):
        fail("Нужен Python 3.8 или новее: https://www.python.org/downloads/")
        sys.exit(1)


# ---------------------------------------------------------------- 2. pip-зависимости
def check_pip_deps():
    step(2, "Проверка Python-зависимостей (pystray, Pillow, qrcode)…")
    missing = []
    for pkg, mod in PYDEPS:
        try:
            __import__(mod)
            ok(f"{pkg} установлен")
        except ImportError:
            warn(f"{pkg} отсутствует — будет установлен")
            missing.append(pkg)
    if not missing:
        return
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", *missing])
        ok("зависимости установлены: " + ", ".join(missing))
    except Exception as e:
        fail(f"pip install не удался: {e}")
        fail("Установите вручную:  python -m pip install pystray Pillow qrcode")
        sys.exit(1)


# ---------------------------------------------------------------- 3. сборка фронтенда
def ensure_dist():
    step(3, "Проверка сборки фронтенда (папка dist/)…")
    if (ROOT / "dist" / "index.html").exists():
        ok("dist/ найдена — сборка не требуется")
        return
    warn("dist/ нет, нужна сборка (Node.js + npm)")
    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node or not npm:
        fail("Node.js не найден. Установите LTS с https://nodejs.org и повторите запуск setup.py")
        sys.exit(1)
    ok(f"Node.js: {node}")
    try:
        if not (ROOT / "node_modules").exists():
            print("    … npm install (может занять несколько минут)")
            subprocess.check_call("npm install", cwd=ROOT, shell=IS_WIN)
        print("    … npm run build")
        subprocess.check_call("npm run build", cwd=ROOT, shell=IS_WIN)
        ok("фронтенд собран в dist/")
    except Exception as e:
        fail(f"сборка не удалась: {e}")
        sys.exit(1)


# ---------------------------------------------------------------- 4. конфиг
def ensure_config():
    step(4, "Создание конфигурации server/config.json…")
    cfg_file = BASE / "config.json"
    if cfg_file.exists():
        ok("config.json уже существует — не трогаем")
        return
    cfg_file.write_text(json.dumps({"port": 8080, "open_browser": True, "autostart": True},
                                   ensure_ascii=False, indent=2), encoding="utf-8")
    ok("config.json создан (порт 8080, автозапуск включён)")


# ---------------------------------------------------------------- 5. ярлык
def get_desktop():
    home = Path.home()
    if IS_WIN:
        try:
            import ctypes
            buf = ctypes.create_unicode_buffer(260)
            ctypes.windll.shell32.SHGetFolderPathW(None, 16, None, 0, buf)  # CSIDL_DESKTOPDIRECTORY
            if buf.value:
                return Path(buf.value)
        except Exception:
            pass
        return home / "Desktop"
    d = home / "Desktop"
    if not d.exists():
        for cand in ("Рабочий стол", "desktop"):
            c = home / cand
            if c.exists():
                return c
    return d


def make_shortcut():
    step(5, "Создание ярлыка на рабочем столе…")
    desktop = get_desktop()
    pyw = Path(sys.executable).with_name("pythonw.exe")
    exe = str(pyw) if pyw.exists() else sys.executable
    server_py = str(BASE / "server.py")

    if IS_WIN:
        lnk = desktop / "СменаЛАН Сервер.lnk"
        ps = (
            "$ws = New-Object -ComObject WScript.Shell; "
            f"$sc = $ws.CreateShortcut('{lnk}'); "
            f"$sc.TargetPath = '{exe}'; "
            f"$sc.Arguments = '\"{server_py}\"'; "
            f"$sc.WorkingDirectory = '{BASE}'; "
            "$sc.Description = 'СменаЛАН — сервер учёта смен (живёт в трее)'; "
            "$sc.Save()"
        )
        try:
            subprocess.check_call(["powershell", "-NoProfile", "-Command", ps])
            ok(f"ярлык создан: {lnk}")
        except Exception as e:
            warn(f"не удалось создать .lnk: {e}")
            bat = desktop / "СменаЛАН Сервер.bat"
            bat.write_text(f'@echo off\r\nstart "" "{exe}" "{server_py}"\r\n', encoding="ascii")
            ok(f"создан bat-ярлык: {bat}")
    else:
        entry = ("[Desktop Entry]\nType=Application\nName=СменаЛАН Сервер\n"
                 f"Exec={exe} {server_py}\nTerminal=false\nCategories=Utility;\n")
        d = desktop / "smenalan.desktop"
        d.write_text(entry, encoding="utf-8")
        try:
            d.chmod(0o755)
        except Exception:
            pass
        app_dir = Path.home() / ".local" / "share" / "applications"
        app_dir.mkdir(parents=True, exist_ok=True)
        (app_dir / "smenalan.desktop").write_text(entry, encoding="utf-8")
        ok(f"ярлык создан: {d}")


# ---------------------------------------------------------------- 6. финал
def get_lan_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.35)
        s.connect(("192.168.1.1", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def finish():
    step(6, "Готово!")
    port = 8080
    try:
        port = json.loads((BASE / "config.json").read_text(encoding="utf-8")).get("port", 8080)
    except Exception:
        pass
    ip = get_lan_ip()
    url = f"http://{ip}:{port}"
    print()
    print("  ==========================================================")
    print("   СЕРВЕР ГОТОВ К ЗАПУСКУ")
    print("  ==========================================================")
    print(f"   IP этого компьютера : {ip}")
    print(f"   Ссылка сотрудникам  : {url}")
    print()
    print("   Запуск: ярлык «СменаЛАН Сервер» на рабочем столе")
    print("           (или: python server/server.py)")
    print("   Сервер живёт в трее: ссылка, QR-код, настройки, выход.")
    print()
    print("   Вход в админку:  root / root   (суперадмин)")
    print("                    plan / 1234  (админ)")
    print()
    print("   Важно: при первом запуске Windows спросит разрешение для")
    print("   брандмауэра — нажмите «Разрешить доступ», иначе телефоны")
    print("   не увидят сервер.")
    print("  ==========================================================")
    print()
    if sys.stdin.isatty():
        try:
            ans = input("Запустить сервер сейчас? [Y/n] ").strip().lower()
        except Exception:
            ans = ""
        if ans in ("", "y", "yes", "да"):
            pyw = Path(sys.executable).with_name("pythonw.exe")
            exe = str(pyw) if pyw.exists() else sys.executable
            subprocess.Popen([exe, str(BASE / "server.py")], cwd=BASE,
                             creationflags=getattr(subprocess, "DETACHED_PROCESS", 0))
            print("Сервер запущен — ищите иконку в трее.")


def main():
    print("==============================================")
    print("  СменаЛАН · установка локального сервера")
    print("==============================================")
    check_python()
    check_pip_deps()
    ensure_dist()
    ensure_config()
    make_shortcut()
    finish()


if __name__ == "__main__":
    main()
