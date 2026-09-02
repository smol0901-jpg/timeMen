#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СМЕНАЛАН — автоматическая установка сервера.

Проверяет Python и pip, доустанавливает зависимости (pystray, Pillow, qrcode),
проверяет собранное веб-приложение, рисует иконки и создаёт ярлык
«СменаЛАН — сервер» на рабочем столе.

Запуск:  двойной клик по install.bat (Windows) / install.sh (Linux, macOS)
         или:  python install.py
"""
import os
import socket
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
DIST = (BASE.parent / "dist").resolve()
APP_NAME = "СменаЛАН — сервер"


def step(msg):
    print("  [•] %s" % msg)


def ok(msg):
    print("  [OK] %s" % msg)


def warn(msg):
    print("  [!] %s" % msg)


def fail(msg):
    print("  [X] %s" % msg)


# --------------------------------------------------------------- проверки
def check_python():
    v = sys.version_info
    step("Python %d.%d.%d (%s)" % (v.major, v.minor, v.micro, sys.executable))
    if (v.major, v.minor) < (3, 8):
        fail("Нужен Python 3.8 или новее. Скачайте с https://python.org и повторите.")
        return False
    ok("версия Python подходит")
    return True


def check_pip():
    try:
        import pip  # noqa: F401
        ok("pip уже установлен")
        return True
    except ImportError:
        pass
    warn("pip не найден — ставим через ensurepip…")
    subprocess.run([sys.executable, "-m", "ensurepip", "--upgrade"], check=False)
    try:
        import pip  # noqa: F401
        ok("pip установлен")
        return True
    except ImportError:
        fail("pip недоступен. Переустановите Python, отметив галочку pip.")
        return False


DEPS = [("pystray", "pystray"), ("PIL", "Pillow"), ("qrcode", "qrcode")]


def install_deps():
    step("Проверяем зависимости: pystray (трей), Pillow (графика), qrcode (QR)…")
    missing = [pkg for mod, pkg in DEPS if not can_import(mod)]
    if not missing:
        ok("все зависимости уже установлены")
        return True
    step("Устанавливаем: %s" % ", ".join(missing))
    cmd = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check"] + missing
    r = subprocess.run(cmd)
    if r.returncode != 0:
        warn("Обычная установка не удалась — пробуем с флагом --user…")
        r = subprocess.run(cmd + ["--user"])
    if r.returncode == 0 and all(can_import(m) for m, _ in DEPS):
        ok("зависимости установлены")
        return True
    fail("Не удалось установить зависимости. Проверьте интернет и повторите запуск.")
    return False


def can_import(mod):
    try:
        __import__(mod)
        return True
    except ImportError:
        return False


def check_dist():
    step("Проверяем собранное веб-приложение (папка dist)…")
    if DIST.exists() and (DIST / "index.html").exists():
        ok("сборка найдена: %s" % DIST)
        return True
    fail("Папка dist не найдена. На машине с проектом выполните:  npm install && npm run build")
    return False


# --------------------------------------------------------------- иконки
def make_icon_files():
    step("Рисуем иконки сервера…")
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        warn("Pillow недоступен — иконки будут стандартными")
        return None
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, size - 5, size - 5], radius=size // 4, fill=(229, 111, 36, 255))
    w = size // 14
    pad = size // 5
    d.ellipse([pad, pad, size - pad, size - pad], outline=(255, 255, 255, 255), width=w)
    c = size / 2.0
    d.line([c, c, c, pad + size * 0.09], fill=(255, 255, 255, 255), width=w)
    d.line([c, c, c + size * 0.17, c + size * 0.11], fill=(255, 255, 255, 255), width=w)
    png = BASE / "tray_icon.png"
    img.save(png)
    try:
        img.save(BASE / "tray_icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    except Exception:
        pass
    ok("иконки созданы: tray_icon.png / tray_icon.ico")
    return png


# --------------------------------------------------------------- ярлык
def desktop_dir():
    if sys.platform == "win32":
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command", "[Environment]::GetFolderPath('Desktop')"],
                capture_output=True, text=True,
            )
            p = out.stdout.strip()
            if p:
                return Path(p)
        except Exception:
            pass
        return Path.home() / "Desktop"
    for cand in ("Desktop", "Рабочий стол"):
        p = Path.home() / cand
        if p.exists():
            return p
    return Path.home()


def create_shortcut(icon_png):
    step("Создаём ярлык на рабочем столе…")
    dd = desktop_dir()
    if sys.platform == "win32":
        lnk = dd / ("%s.lnk" % APP_NAME)
        py_exe = sys.executable
        if py_exe.lower().endswith("python.exe"):
            alt = py_exe[: -len("python.exe")] + "pythonw.exe"
            if os.path.exists(alt):
                py_exe = alt  # без чёрного окна консоли
        ico = BASE / "tray_icon.ico"
        ps = (
            "$ws = New-Object -ComObject WScript.Shell;"
            "$s = $ws.CreateShortcut('%s');"
            "$s.TargetPath = '%s';"
            "$s.Arguments = '\"%s\"';"
            "$s.WorkingDirectory = '%s';"
            "$s.Description = 'СменаЛАН — локальный сервер учёта смен';"
            % (lnk, py_exe, BASE / "launcher.py", BASE)
        )
        if ico.exists():
            ps += "$s.IconLocation = '%s';" % ico
        ps += "$s.Save()"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, check=False)
        if lnk.exists():
            ok("ярлык создан: %s" % lnk)
            return lnk
        warn("ярлык не создался — запустите вручную: python launcher.py")
        return None
    else:
        desktop_file = dd / "smenalan-server.desktop"
        icon = icon_png or (BASE / "tray_icon.png")
        desktop_file.write_text(
            "[Desktop Entry]\nType=Application\nName=%s\n"
            "Comment=Локальный сервер учёта смен\nExec=%s %s\n"
            "Icon=%s\nTerminal=false\nCategories=Utility;\n"
            % (APP_NAME, sys.executable, BASE / "launcher.py", icon),
            encoding="utf-8",
        )
        try:
            os.chmod(desktop_file, 0o755)
        except Exception:
            pass
        ok("ярлык создан: %s" % desktop_file)
        return desktop_file


# --------------------------------------------------------------- сеть
def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.6)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return "127.0.0.1"


# --------------------------------------------------------------- main
def main():
    print()
    print("  " + "=" * 50)
    print("  СМЕНАЛАН · автоматическая установка сервера")
    print("  " + "=" * 50)
    print()

    deps_ok = check_python()
    if deps_ok:
        deps_ok = check_pip() and install_deps()
    dist_ok = check_dist()
    print()

    icon = make_icon_files() if deps_ok else None
    if deps_ok:
        create_shortcut(icon)
    print()

    if deps_ok and dist_ok:
        ip = lan_ip()
        print("  " + "-" * 50)
        print("  СИСТЕМА ГОТОВА К ЗАПУСКУ")
        print("  " + "-" * 50)
        print()
        print("  1. Запустите ярлык «%s» на рабочем столе" % APP_NAME)
        print("     (или в этой папке:  python launcher.py)")
        print()
        print("  2. Сервер поселится в трее возле часов.")
        print("     Правый клик по иконке:")
        print("       · готовая ссылка для сотрудников — копируется в один клик")
        print("       · QR-код: сотрудники наводят камеру телефона")
        print("       · настройки: порт, автозапуск вместе с системой")
        print()
        print("  3. При первом запуске Windows спросит про брандмауэр —")
        print("     разрешите доступ для ЧАСТНЫХ сетей, иначе телефоны не подключатся.")
        print()
        print("  Ссылка для сотрудников (после запуска):  http://%s:8080" % ip)
        print("  Логи сервера:  server.log   ·   общая база:  server/data/db.json")
        print()
        print("  Доступы по умолчанию:")
        print("    суперадмин   root  / root")
        print("    админ        plan  / 1234")
        print("    сотрудник    igor  / 1234    (marina — без пароля)")
        print("    PIN терминала: 1234 (меняется в админке → Настройки)")
    else:
        if not deps_ok:
            fail("Установка не завершена: исправьте ошибки с зависимостями выше.")
        if not dist_ok:
            fail("Установка не завершена: нужна собранная папка dist (npm run build).")
    print()


if __name__ == "__main__":
    main()
