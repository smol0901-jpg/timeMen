#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СМЕНАЛАН — локальный LAN-сервер с иконкой в системном трее.

Что делает:
  * раздаёт собранное веб-приложение (папка ../dist) всем устройствам Wi-Fi сети
  * хранит ОБЩУЮ базу данных (server/data/db.json) — все устройства видят одни и те же
    смены, графики, заявки и ленту (веб-приложение синхронизируется через /api/db)
  * живёт в трее: адрес и ссылка для сотрудников, копирование в один клик, QR-код,
    настройки (порт, автозапуск), перезапуск, выход

Запуск:  python launcher.py   (или ярлыком «СменаЛАН — сервер» с рабочего стола)
"""
import json
import logging
import mimetypes
import os
import queue
import socket
import subprocess
import sys
import threading
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE = Path(__file__).resolve().parent
DIST = (BASE.parent / "dist").resolve()
DATA_DIR = BASE / "data"
DB_FILE = DATA_DIR / "db.json"
DB_BAK = DATA_DIR / "db.backup.json"
CONFIG_FILE = BASE / "config.json"
LOG_FILE = BASE / "server.log"
LOCK_PORT = 39517

DEFAULT_CONFIG = {"port": 8080, "open_browser": True, "autostart": False}
CONFIG = dict(DEFAULT_CONFIG)
DB_LOCK = threading.Lock()
HTTPD = None
ICON = None
UI_QUEUE = queue.Queue()
_lock_sock = None

_log = logging.getLogger("smenalan")
_log.setLevel(logging.INFO)
try:
    _h = logging.FileHandler(LOG_FILE, encoding="utf-8")
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    _log.addHandler(_h)
except Exception:
    logging.basicConfig(level=logging.INFO)
    _log = logging.getLogger("smenalan")


# ----------------------------------------------------------------- утилиты
def load_config():
    try:
        if CONFIG_FILE.exists():
            CONFIG.update(json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    except Exception as e:
        _log.warning("ошибка чтения config.json: %s", e)


def save_config():
    try:
        CONFIG_FILE.write_text(json.dumps(CONFIG, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        _log.warning("ошибка записи config.json: %s", e)


def lan_ip():
    """Основной IP машины в локальной сети."""
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
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    return "127.0.0.1"


def all_ips():
    ips = set()
    try:
        _, _, addrs = socket.gethostbyname_ex(socket.gethostname())
        ips.update(a for a in addrs if not a.startswith("127."))
    except Exception:
        pass
    primary = lan_ip()
    if primary != "127.0.0.1":
        ips.add(primary)
    return sorted(ips) or ["127.0.0.1"]


def current_url():
    return "http://%s:%s" % (lan_ip(), CONFIG["port"])


def copy_text(text):
    """Копировать в буфер обмена без сторонних зависимостей."""
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", "Set-Clipboard -Value '%s'" % text],
                capture_output=True, check=False,
            )
        elif sys.platform == "darwin":
            subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=False)
        else:
            for cmd in (["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"], ["wl-copy"]):
                r = subprocess.run(cmd, input=text.encode("utf-8"), capture_output=True)
                if r.returncode == 0:
                    break
    except Exception as e:
        _log.warning("буфер обмена недоступен: %s", e)


def toast(icon, title, msg):
    try:
        icon.notify(msg, title)
    except Exception:
        _log.info("[%s] %s", title, msg)


def acquire_lock():
    """Защита от второго экземпляра."""
    global _lock_sock
    _lock_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        _lock_sock.bind(("127.0.0.1", LOCK_PORT))
        return True
    except OSError:
        return False


# ----------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        _log.info("%s — %s", self.address_string(), fmt % args)

    def _send(self, code, body, ctype="application/json; charset=utf-8", cache=False):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=31536000, immutable" if cache else "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/ping":
            body = json.dumps({"ok": True, "port": CONFIG["port"], "ts": datetime.now().isoformat()})
            self._send(200, body.encode("utf-8"))
            return
        if path == "/api/db":
            with DB_LOCK:
                if DB_FILE.exists():
                    self._send(200, DB_FILE.read_bytes())
                else:
                    self._send(404, b'{"error":"empty"}')
            return
        if path.startswith("/api/"):
            self._send(404, b'{"error":"not found"}')
            return
        self._serve_file(path)

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        if path != "/api/db":
            self._send(404, b'{"error":"not found"}')
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n) if n > 0 else b""
            data = json.loads(raw.decode("utf-8"))
            if not isinstance(data, dict) or not isinstance(data.get("users"), list):
                raise ValueError("похоже, это не база СменаЛАН")
            with DB_LOCK:
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                if DB_FILE.exists():
                    try:
                        DB_BAK.write_bytes(DB_FILE.read_bytes())
                    except Exception:
                        pass
                tmp = DATA_DIR / "db.tmp.json"
                tmp.write_bytes(json.dumps(data, ensure_ascii=False).encode("utf-8"))
                tmp.replace(DB_FILE)
            self._send(200, b'{"ok":true}')
        except Exception as e:
            _log.warning("POST /api/db отклонён: %s", e)
            self._send(400, b'{"error":"bad payload"}')

    def _serve_file(self, path):
        if path in ("", "/"):
            path = "/index.html"
        f = (DIST / path.lstrip("/")).resolve()
        try:
            f.relative_to(DIST)
        except ValueError:
            self._send(403, b"forbidden", "text/plain")
            return
        if not f.is_file():
            f = DIST / "index.html"  # SPA-fallback
            if not f.is_file():
                self._send(404, "Папка dist не найдена. Выполните сборку: npm run build".encode("utf-8"),
                           "text/plain; charset=utf-8")
                return
        ctype, _ = mimetypes.guess_type(str(f))
        if f.suffix == ".webmanifest":
            ctype = "application/manifest+json"
        elif f.suffix == ".svg":
            ctype = "image/svg+xml"
        elif f.suffix == ".ico":
            ctype = "image/x-icon"
        if not ctype:
            ctype = "application/octet-stream"
        if ctype.startswith("text/") or "json" in ctype or "javascript" in ctype or "svg" in ctype:
            ctype += "; charset=utf-8"
        self._send(200, f.read_bytes(), ctype, cache="/assets/" in str(f))


def start_server():
    global HTTPD
    port = int(CONFIG.get("port", 8080))
    for _ in range(15):
        try:
            HTTPD = ThreadingHTTPServer(("0.0.0.0", port), Handler)
            CONFIG["port"] = port
            threading.Thread(target=HTTPD.serve_forever, daemon=True).start()
            return True
        except OSError:
            _log.warning("порт %s занят — пробуем %s", port, port + 1)
            port += 1
    _log.error("свободный порт не найден")
    return False


def restart_server():
    global HTTPD
    if HTTPD:
        try:
            HTTPD.shutdown()
            HTTPD.server_close()
        except Exception:
            pass
    if start_server():
        save_config()
        if ICON:
            toast(ICON, "СменаЛАН", "Сервер запущен: %s" % current_url())
            ICON.update_menu()
        return True
    return False


# ----------------------------------------------------------------- иконка
def make_icon_image(size=64):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([1, 1, size - 2, size - 2], radius=size // 4, fill=(229, 111, 36, 255))
    w = max(2, size // 14)
    pad = size // 5
    d.ellipse([pad, pad, size - pad, size - pad], outline=(255, 255, 255, 255), width=w)
    c = size / 2.0
    d.line([c, c, c, pad + size * 0.09], fill=(255, 255, 255, 255), width=w)
    d.line([c, c, c + size * 0.17, c + size * 0.11], fill=(255, 255, 255, 255), width=w)
    return img


# ----------------------------------------------------------------- действия трея
def act_copy(icon, item):
    copy_text(current_url())
    toast(icon, "Ссылка скопирована", current_url())


def act_qr(icon, item):
    UI_QUEUE.put(show_qr_window)


def act_settings(icon, item):
    UI_QUEUE.put(show_settings_window)


def act_browser(icon, item):
    webbrowser.open(current_url())


def act_restart(icon, item):
    toast(icon, "СменаЛАН", "Перезапуск сервера…")
    threading.Thread(target=restart_server, daemon=True).start()


def act_exit(icon, item):
    global HTTPD
    if HTTPD:
        try:
            HTTPD.shutdown()
        except Exception:
            pass
    try:
        icon.stop()
    except Exception:
        pass
    UI_QUEUE.put(None)


def menu_builder(icon):
    import pystray
    url = current_url()
    return [
        pystray.MenuItem("СМЕНАЛАН · LAN-сервер", None, enabled=False),
        pystray.MenuItem(url, act_copy, default=True),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Скопировать ссылку для сотрудников", act_copy),
        pystray.MenuItem("Показать QR-код для телефона", act_qr),
        pystray.MenuItem("Открыть админку в браузере", act_browser),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Настройки сервера…", act_settings),
        pystray.MenuItem("Перезапустить сервер", act_restart),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Остановить и выйти", act_exit),
    ]


# ----------------------------------------------------------------- окна (tkinter, главный поток)
def show_qr_window():
    import tkinter as tk
    url = current_url()
    root = tk.Tk()
    root.title("QR-код для сотрудников — СменаЛАН")
    root.resizable(False, False)
    try:
        import qrcode
        from PIL import ImageTk
        qr = qrcode.QRCode(box_size=9, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#171b22", back_color="white").convert("RGB")
        photo = ImageTk.PhotoImage(img)
        lbl = tk.Label(root, image=photo)
        lbl.image = photo
        lbl.pack(padx=24, pady=(24, 10))
    except Exception as e:
        _log.warning("QR недоступен: %s", e)
        tk.Label(root, text="(модуль qrcode не установлен)", fg="#a8372b").pack(pady=(20, 0))
    tk.Label(root, text=url, font=("Consolas", 13, "bold"), fg="#171b22").pack(pady=6)
    tk.Label(root, text="Сотрудник наводит камеру телефона на QR-код —\nоткрывается система учёта смен. Логин выдаёт админ.",
             fg="#5d6a80", justify="center").pack(pady=(0, 8))

    def do_copy():
        copy_text(url)
        btn.config(text="Скопировано ✓")
        root.after(1600, lambda: btn.config(text="Скопировать ссылку"))

    btn = tk.Button(root, text="Скопировать ссылку", command=do_copy, padx=14, pady=6)
    btn.pack(pady=(0, 20))
    root.mainloop()


def autostart_path():
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "")
        return Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup" / "СменаЛАН.lnk"
    return Path.home() / ".config" / "autostart" / "smenalan.desktop"


def apply_autostart(enabled):
    p = autostart_path()
    try:
        if not enabled:
            if p.exists():
                p.unlink()
            return
        p.parent.mkdir(parents=True, exist_ok=True)
        if sys.platform == "win32":
            py_exe = sys.executable
            if py_exe.lower().endswith("python.exe"):
                alt = py_exe[: -len("python.exe")] + "pythonw.exe"
                if os.path.exists(alt):
                    py_exe = alt
            ps = (
                "$ws = New-Object -ComObject WScript.Shell;"
                "$s = $ws.CreateShortcut('%s');"
                "$s.TargetPath = '%s';"
                "$s.Arguments = '\"%s\"';"
                "$s.WorkingDirectory = '%s';"
                "$s.Description = 'СменаЛАН — локальный сервер';"
                "$s.Save()" % (p, py_exe, BASE / "launcher.py", BASE)
            )
            subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, check=False)
        else:
            p.write_text(
                "[Desktop Entry]\nType=Application\nName=СменаЛАН — сервер\n"
                "Exec=%s %s\nTerminal=false\n" % (sys.executable, BASE / "launcher.py"),
                encoding="utf-8",
            )
    except Exception as e:
        _log.warning("автозапуск не настроен: %s", e)


def show_settings_window():
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.title("Настройки сервера — СменаЛАН")
    root.resizable(False, False)
    root.geometry("470x430")

    frm = tk.Frame(root, padx=20, pady=16)
    frm.pack(fill="both", expand=True)

    tk.Label(frm, text="Порт сервера", font=("Segoe UI", 10, "bold")).pack(anchor="w")
    port_var = tk.StringVar(value=str(CONFIG["port"]))
    tk.Entry(frm, textvariable=port_var, width=10, font=("Consolas", 12)).pack(anchor="w", pady=(2, 10))

    browser_var = tk.BooleanVar(value=bool(CONFIG["open_browser"]))
    tk.Checkbutton(frm, text="Открывать админку в браузере при запуске", variable=browser_var,
                   font=("Segoe UI", 10)).pack(anchor="w")
    auto_var = tk.BooleanVar(value=bool(CONFIG["autostart"]))
    tk.Checkbutton(frm, text="Запускать сервер вместе с системой (трей)", variable=auto_var,
                   font=("Segoe UI", 10)).pack(anchor="w", pady=(0, 10))

    tk.Label(frm, text="IP-адреса этого компьютера в сети:", font=("Segoe UI", 10, "bold")).pack(anchor="w")
    ips = all_ips()
    for ip in ips:
        line = tk.Frame(frm)
        line.pack(anchor="w", fill="x")
        tk.Label(line, text="http://%s:%s" % (ip, CONFIG["port"]), font=("Consolas", 10), fg="#171b22").pack(side="left")

        def cp(u="http://%s:%s" % (ip, CONFIG["port"]), b=None):
            copy_text(u)

        tk.Button(line, text="копировать", command=cp, font=("Segoe UI", 8)).pack(side="left", padx=(8, 0))

    tk.Label(frm, text="Если адреса 127.0.0.1 — компьютер не подключён к Wi-Fi сети.",
             fg="#5d6a80", font=("Segoe UI", 9), justify="left").pack(anchor="w", pady=(8, 0))

    btns = tk.Frame(frm)
    btns.pack(fill="x", pady=(18, 0))

    def apply():
        try:
            p = int(port_var.get())
        except ValueError:
            messagebox.showerror("СменаЛАН", "Порт должен быть числом")
            return
        if not (1024 <= p <= 65535):
            messagebox.showerror("СменаЛАН", "Допустимый диапазон порта: 1024–65535")
            return
        port_changed = p != CONFIG["port"]
        CONFIG["port"] = p
        CONFIG["open_browser"] = bool(browser_var.get())
        CONFIG["autostart"] = bool(auto_var.get())
        save_config()
        apply_autostart(CONFIG["autostart"])
        root.destroy()
        if port_changed:
            threading.Thread(target=restart_server, daemon=True).start()
        elif ICON:
            ICON.update_menu()
            toast(ICON, "СменаЛАН", "Настройки сохранены")

    tk.Button(btns, text="Отмена", command=root.destroy, padx=16, pady=6).pack(side="left")
    tk.Button(btns, text="Сохранить", command=apply, padx=16, pady=6, bg="#e56f24", fg="white").pack(side="left", padx=8)
    root.mainloop()


# ----------------------------------------------------------------- запуск
def main():
    global ICON
    if not acquire_lock():
        if sys.platform == "win32":
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(
                    0, "Сервер СменаЛАН уже запущен — ищите иконку в трее (возле часов).", "СменаЛАН", 0x40)
            except Exception:
                pass
        else:
            print("Сервер СменаЛАН уже запущен.")
        return

    load_config()
    print("=" * 52)
    print("  СМЕНАЛАН · локальный сервер")
    print("=" * 52)

    if not DIST.exists() or not (DIST / "index.html").exists():
        _log.error("папка dist не найдена рядом с проектом")
        print("  [!] Папка dist не найдена. Выполните сборку: npm run build")
    else:
        print("  веб-приложение: %s" % DIST)

    if not start_server():
        print("  [X] Не удалось занять порт. Подробности в server.log")
        return

    url = current_url()
    print("  сервер запущен:  %s" % url)
    print("  общая база:      %s" % (DB_FILE if DB_FILE.exists() else "будет создана при первом подключении"))
    print("  правый клик по иконке в трее — ссылка, QR-код, настройки")
    print("  (закрывать это окно не обязательно — сервер живёт в трее)")

    if CONFIG.get("open_browser"):
        webbrowser.open(url)

    import pystray
    ICON = pystray.Icon("smenalan", make_icon_image(), "СменаЛАН · %s" % url, pystray.Menu(menu_builder))
    ICON.run_detached()
    toast(ICON, "СменаЛАН", "Сервер запущен: %s" % url)

    while True:
        fn = UI_QUEUE.get()
        if fn is None:
            break
        try:
            fn()
        except Exception:
            _log.exception("ошибка в окне настроек")
    _log.info("сервер остановлен")
    print("  сервер остановлен")


if __name__ == "__main__":
    main()
