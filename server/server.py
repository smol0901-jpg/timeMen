# -*- coding: utf-8 -*-
"""
СменаЛАН · LAN-сервер с иконкой в системном трее.

Что умеет:
  - раздаёт собранный фронтенд (../dist) всем устройствам в Wi-Fi сети
  - хранит общую базу в server/data/db.json (API: GET/POST /api/db, GET /api/ping)
  - живёт в трее: ссылка для сотрудников, копирование IP, QR-код,
    настройки (порт, автозапуск, автооткрытие браузера), перезапуск, выход

Запуск:  python server.py   (или ярлыком с рабочего стола)
Зависимости: pystray, Pillow, qrcode  (устанавливаются автоматически через setup.py)
"""
import json
import mimetypes
import os
import socket
import subprocess
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = Path(__file__).resolve().parent
DIST = BASE.parent / "dist"
DATA = BASE / "data"
CONFIG_FILE = BASE / "config.json"
DB_FILE = DATA / "db.json"
DB_PREV = DATA / "db.prev.json"
APP_NAME = "СменаЛАН"
VERSION = "1.0"

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("image/svg+xml", ".svg")

STATE = {"ip": "127.0.0.1", "server": None}

# ---------------------------------------------------------------- конфиг
def load_config():
    cfg = {"port": 8080, "open_browser": True, "autostart": True}
    try:
        if CONFIG_FILE.exists():
            cfg.update(json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    except Exception:
        pass
    return cfg


def save_config(cfg):
    CONFIG_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------- сеть
def get_lan_ip():
    for target in ("192.168.1.1", "10.0.0.1", "172.16.0.1", "8.8.8.8"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.35)
            s.connect((target, 80))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127."):
                return ip
        except Exception:
            continue
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return "127.0.0.1"


def free_port(start):
    for p in range(start, min(start + 40, 65536)):
        try:
            s = socket.socket()
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("0.0.0.0", p))
            s.close()
            return p
        except OSError:
            continue
    return start


# ---------------------------------------------------------------- HTTP + API
class ApiHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _send(self, code, payload, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(payload)
        except Exception:
            pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/ping":
            self._send(200, json.dumps({"ok": True, "app": APP_NAME, "v": VERSION}).encode("utf-8"),
                       "application/json")
            return
        if path == "/api/db":
            if DB_FILE.exists():
                self._send(200, DB_FILE.read_bytes(), "application/json")
            else:
                self._send(404, b'{"error":"empty"}', "application/json")
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/db":
            try:
                ln = int(self.headers.get("Content-Length", "0"))
                if ln <= 0 or ln > 60 * 1024 * 1024:
                    self._send(400, b'{"error":"payload too large"}', "application/json")
                    return
                raw = self.rfile.read(ln)
                d = json.loads(raw.decode("utf-8"))
                if not isinstance(d, dict) or d.get("v") != 4 or not isinstance(d.get("users"), list):
                    self._send(400, b'{"error":"bad schema"}', "application/json")
                    return
                DATA.mkdir(exist_ok=True)
                if DB_FILE.exists():
                    try:
                        DB_PREV.write_bytes(DB_FILE.read_bytes())
                    except Exception:
                        pass
                tmp = DB_FILE.with_suffix(".tmp")
                tmp.write_bytes(raw)
                os.replace(tmp, DB_FILE)
                self._send(200, json.dumps({"ok": True, "bytes": ln}).encode("utf-8"), "application/json")
            except Exception as e:
                self._send(500, json.dumps({"error": str(e)}).encode("utf-8"), "application/json")
            return
        self._send(404, b'{"error":"not found"}', "application/json")


class LanServer:
    def __init__(self, port):
        self.port = port
        self.httpd = None

    def start(self):
        self.port = free_port(self.port)
        handler = partial(ApiHandler, directory=str(DIST))
        self.httpd = ThreadingHTTPServer(("0.0.0.0", self.port), handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def restart(self, port):
        self.stop()
        self.port = port
        self.start()

    def stop(self):
        if self.httpd:
            try:
                self.httpd.shutdown()
                self.httpd.server_close()
            except Exception:
                pass
            self.httpd = None

    @property
    def url(self):
        return f"http://{STATE['ip']}:{self.port}"


# ---------------------------------------------------------------- буфер обмена
def copy_text(text):
    try:
        if sys.platform == "win32":
            import ctypes
            CF_UNICODETEXT = 13
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            user32.OpenClipboard(0)
            user32.EmptyClipboard()
            data = text.encode("utf-16-le") + b"\0\0"
            h = kernel32.GlobalAlloc(0x0042, len(data))
            p = kernel32.GlobalLock(h)
            ctypes.memmove(p, data, len(data))
            kernel32.GlobalUnlock(h)
            user32.SetClipboardData(CF_UNICODETEXT, h)
            user32.CloseClipboard()
            return True
        if sys.platform == "darwin":
            subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)
            return True
        for tool in (["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]):
            try:
                subprocess.run(tool, input=text.encode("utf-8"), check=True)
                return True
            except Exception:
                continue
    except Exception:
        pass
    return False


# ---------------------------------------------------------------- QR / файлы
def open_any(path):
    try:
        if sys.platform == "win32":
            os.startfile(str(path))
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)])
        else:
            subprocess.run(["xdg-open", str(path)])
    except Exception:
        pass


def make_qr(url):
    import qrcode
    from PIL import Image, ImageDraw, ImageFont

    qr = qrcode.QRCode(box_size=10, border=3)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#171b22", back_color="#edf0f3").convert("RGB")
    w, h = img.size
    canvas = Image.new("RGB", (w, h + 70), "#edf0f3")
    canvas.paste(img, (0, 0))
    d = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.load_default(size=17)
    except TypeError:
        font = ImageFont.load_default()
    d.text((18, h + 12), "СменаЛАН — откройте на телефоне:", fill="#5d6a80", font=font)
    d.text((18, h + 38), url, fill="#171b22", font=font)
    DATA.mkdir(exist_ok=True)
    out = DATA / "qr_connect.png"
    canvas.save(out)
    return out


# ---------------------------------------------------------------- автозапуск
def apply_autostart(enable):
    try:
        if sys.platform == "win32":
            import winreg
            pyw = Path(sys.executable).with_name("pythonw.exe")
            exe = str(pyw) if pyw.exists() else sys.executable
            cmd = f'"{exe}" "{Path(__file__).resolve()}"'
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                 r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
            if enable:
                winreg.SetValueEx(key, "SmenaLAN", 0, winreg.REG_SZ, cmd)
            else:
                try:
                    winreg.DeleteValue(key, "SmenaLAN")
                except OSError:
                    pass
            winreg.CloseKey(key)
        else:
            autostart = Path.home() / ".config" / "autostart"
            target = autostart / "smenalan.desktop"
            if enable:
                autostart.mkdir(parents=True, exist_ok=True)
                target.write_text(
                    "[Desktop Entry]\nType=Application\nName=СменаЛАН\n"
                    f"Exec={sys.executable} {Path(__file__).resolve()}\nTerminal=false\n",
                    encoding="utf-8")
            else:
                target.unlink(missing_ok=True)
    except Exception as e:
        print("Автозапуск:", e)


# ---------------------------------------------------------------- окно настроек (tkinter)
def open_settings(icon):
    threading.Thread(target=_settings_ui, args=(icon,), daemon=True).start()


def _settings_ui(icon):
    import tkinter as tk
    cfg = load_config()
    root = tk.Tk()
    root.title("СменаЛАН — настройки сервера")
    root.geometry("400x310")
    root.resizable(False, False)
    try:
        root.attributes("-topmost", True)
    except Exception:
        pass

    tk.Label(root, text="Порт сервера (1024–65535):", anchor="w", font=("Segoe UI", 10, "bold")).pack(fill="x", padx=18, pady=(18, 2))
    port_var = tk.StringVar(value=str(cfg.get("port", 8080)))
    tk.Entry(root, textvariable=port_var, font=("Consolas", 12), justify="center").pack(padx=18)

    open_var = tk.BooleanVar(value=bool(cfg.get("open_browser", True)))
    auto_var = tk.BooleanVar(value=bool(cfg.get("autostart", True)))
    tk.Checkbutton(root, text="Открывать браузер при запуске сервера", variable=open_var,
                   anchor="w", font=("Segoe UI", 10)).pack(fill="x", padx=14, pady=(12, 0))
    tk.Checkbutton(root, text="Запускать вместе с Windows (автозагрузка)", variable=auto_var,
                   anchor="w", font=("Segoe UI", 10)).pack(fill="x", padx=14)

    info = tk.Label(root, text=f"Сейчас: {STATE['server'].url}", fg="#5d6a80", font=("Segoe UI", 9))
    info.pack(pady=(10, 0))

    def save():
        try:
            p = int(port_var.get())
        except ValueError:
            p = 8080
        p = max(1024, min(65535, p))
        cfg2 = {"port": p, "open_browser": bool(open_var.get()), "autostart": bool(auto_var.get())}
        save_config(cfg2)
        apply_autostart(cfg2["autostart"])
        srv = STATE["server"]
        if p != srv.port:
            srv.restart(p)
            try:
                icon.notify(f"Сервер перезапущен: {srv.url}", APP_NAME)
            except Exception:
                pass
        try:
            icon.notify("Настройки сохранены", APP_NAME)
        except Exception:
            pass
        root.destroy()

    btns = tk.Frame(root)
    btns.pack(pady=16)
    tk.Button(btns, text="Сохранить", width=14, command=save, font=("Segoe UI", 10, "bold")).pack(side="left", padx=6)
    tk.Button(btns, text="Отмена", width=10, command=root.destroy, font=("Segoe UI", 10)).pack(side="left", padx=6)
    root.mainloop()


# ---------------------------------------------------------------- трей
def make_icon_image():
    from PIL import Image, ImageDraw
    s = 128
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, s - 4, s - 4], radius=30, fill="#14181f")
    d.arc([24, 24, s - 24, s - 24], start=-70, end=250, fill="#e56f24", width=11)
    d.polygon([(88, 26), (102, 44), (78, 46)], fill="#e56f24")
    d.line([(64, 64), (64, 42)], fill="#edf0f3", width=8)
    d.line([(64, 64), (82, 76)], fill="#edf0f3", width=8)
    d.ellipse([56, 56, 72, 72], fill="#e56f24")
    return img


def build_menu():
    import pystray

    def hdr(item):
        return f"{APP_NAME} · {STATE['server'].url}"

    def act_copy(text):
        def run(icon, item):
            ok = copy_text(text())
            try:
                icon.notify(("Скопировано: " if ok else "") + text(), APP_NAME)
            except Exception:
                pass
        return run

    def act_qr(icon, item):
        def run():
            try:
                out = make_qr(STATE["server"].url)
                open_any(out)
                icon.notify("QR-код сохранён и открыт", APP_NAME)
            except ImportError:
                icon.notify("Модуль qrcode не установлен (pip install qrcode)", APP_NAME)
        threading.Thread(target=run, daemon=True).start()

    return pystray.Menu(
        pystray.MenuItem(hdr, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Скопировать ссылку для сотрудников", act_copy(lambda: STATE["server"].url)),
        pystray.MenuItem("Скопировать IP-адрес", act_copy(lambda: STATE["ip"])),
        pystray.MenuItem("Открыть в браузере", lambda i, _: webbrowser.open(STATE["server"].url)),
        pystray.MenuItem("QR-код для телефона", act_qr),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Настройки сервера…", lambda i, _: open_settings(i)),
        pystray.MenuItem("Перезапустить сервер", lambda i, _: (STATE["server"].restart(load_config()["port"]),
                                                              i.notify(f"Сервер запущен: {STATE['server'].url}", APP_NAME))),
        pystray.MenuItem("Открыть папку с данными", lambda i, _: open_any(DATA)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Выход", lambda i, _: i.stop()),
    )


# ---------------------------------------------------------------- запуск
def main():
    if not DIST.exists():
        print(f"ОШИБКА: папка {DIST} не найдена.")
        print("Соберите фронтенд: запустите  python setup.py  в папке server/")
        input("Нажмите Enter для выхода…")
        sys.exit(1)

    DATA.mkdir(exist_ok=True)
    cfg = load_config()
    STATE["ip"] = get_lan_ip()
    STATE["server"] = LanServer(cfg.get("port", 8080))
    STATE["server"].start()
    apply_autostart(bool(cfg.get("autostart", False)))

    print(f"[СменаЛАН] сервер запущен: {STATE['server'].url}")
    print("[СменаЛАН] управление — иконка в системном трее")

    import pystray
    icon = pystray.Icon(APP_NAME, make_icon_image(), f"{APP_NAME} — {STATE['server'].url}", build_menu())

    def ready(ic):
        try:
            ic.notify(f"Сервер запущен: {STATE['server'].url}", APP_NAME)
        except Exception:
            pass
        if cfg.get("open_browser", True):
            webbrowser.open(STATE["server"].url)

    try:
        icon.run(ready)
    except KeyboardInterrupt:
        pass
    finally:
        STATE["server"].stop()
        print("[СменаЛАН] остановлен")


if __name__ == "__main__":
    main()
