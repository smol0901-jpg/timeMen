#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""СменаЛАН — локальный LAN-сервер: HTTP + SQLite + трей + автокопии.
Запуск: python launcher.py [--console] [--port 8080]
"""
import base64, datetime, io, json, os, socket, sqlite3, sys, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path(__file__).resolve().parent
DIST = BASE.parent / "dist"
DATA = BASE / "data"
FILES = DATA / "files"
BACKUPS = DATA / "backups"
DBF = DATA / "smenalan.sqlite"
LOGF = BASE / "server.log"
SETTINGS_F = DATA / "server_settings.json"
DB_VERSION = 7
CAM_KEEP_DAYS = 120
START = time.time()

for d in (DATA, FILES, BACKUPS):
    d.mkdir(parents=True, exist_ok=True)


def log(msg):
    line = f"[{datetime.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(line, flush=True)
    try:
        with open(LOGF, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


# ---------------- SQLite ----------------
_lock = threading.Lock()


def conn():
    c = sqlite3.connect(DBF, timeout=10)
    c.execute("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL DEFAULT 0, data TEXT, updated TEXT)")
    return c


def get_state():
    with _lock:
        c = conn()
        row = c.execute("SELECT version FROM state WHERE id=1").fetchone()
        c.close()
        return int(row[0]) if row else 0


def get_db():
    with _lock:
        c = conn()
        row = c.execute("SELECT version, data FROM state WHERE id=1").fetchone()
        c.close()
        if not row or not row[1]:
            return 0, None
        return int(row[0]), json.loads(row[1])


def set_db(data_obj, client_version):
    now = datetime.datetime.now().isoformat(timespec="seconds")
    text = json.dumps(data_obj, ensure_ascii=False)
    with _lock:
        c = conn()
        cur = c.execute("SELECT version FROM state WHERE id=1").fetchone()
        stored = int(cur[0]) if cur else 0
        ver = max(int(client_version or 0), stored + 1)
        if cur:
            c.execute("UPDATE state SET version=?, data=?, updated=? WHERE id=1", (ver, text, now))
        else:
            c.execute("INSERT INTO state (id, version, data, updated) VALUES (1,?,?,?)", (ver, text, now))
        c.commit()
        c.close()
    try:  # зеркало db.json
        with open(DATA / "db.json", "w", encoding="utf-8") as f:
            f.write(text)
    except OSError:
        pass
    return ver


def do_backup(tag="auto"):
    ver, data = get_db()
    if data is None:
        return None
    name = f"smenalan-{datetime.datetime.now():%Y%m%d-%H%M%S}-{tag}-v{ver}.json"
    p = BACKUPS / name
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    # чистка: оставить 20 последних
    olds = sorted(BACKUPS.glob("smenalan-*.json"))[:-20]
    for o in olds:
        try:
            o.unlink()
        except OSError:
            pass
    return name


def backup_loop():
    last = None
    while True:
        today = datetime.date.today()
        weekday = today.weekday()  # 0 = Пн
        if (last != today) and (weekday == 0 or not any(BACKUPS.glob("smenalan-*-auto-*.json"))):
            try:
                n = do_backup("auto")
                if n:
                    log(f"Еженедельная резервная копия: {n}")
                last = today
            except Exception as e:
                log(f"Ошибка автокопии: {e}")
        time.sleep(3600)


def cleanup_camshots():
    """Снимки веб-камер храним CAM_KEEP_DAYS дней."""
    try:
        ver, data = get_db()
        if not data or "camshots" not in data:
            return
        cut = (datetime.datetime.now() - datetime.timedelta(days=CAM_KEEP_DAYS)).isoformat()
        before = len(data.get("camshots", []))
        data["camshots"] = [s for s in data.get("camshots", []) if s.get("ts", "9999") >= cut]
        if len(data["camshots"]) != before:
            set_db(data, ver)
            log(f"Очистка снимков старше {CAM_KEEP_DAYS} дней: удалено {before - len(data['camshots'])}")
    except Exception as e:
        log(f"Ошибка очистки снимков: {e}")


# ---------------- настройки сервера ----------------
def load_settings():
    if SETTINGS_F.exists():
        try:
            return json.loads(SETTINGS_F.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"port": 8080, "token": "", "autostart": False}


def save_settings(s):
    SETTINGS_F.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------- сеть ----------------
def local_ips():
    ips = []
    try:
        st = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        st.connect(("8.8.8.8", 80))
        ips.append(st.getsockname()[0])
        st.close()
    except OSError:
        pass
    try:
        for _, _, addrs in socket.gethostbyname_ex(socket.gethostname())[2:]:
            for a in addrs:
                if a not in ips and not a.startswith("127."):
                    ips.append(a)
    except OSError:
        pass
    return ips or ["127.0.0.1"]


def find_port(prefer):
    for p in range(prefer, prefer + 20):
        try:
            s = socket.socket()
            s.bind(("0.0.0.0", p))
            s.close()
            return p
        except OSError:
            continue
    return prefer


SETTINGS = load_settings()
PORT = find_port(int(SETTINGS.get("port", 8080)))

MIME = {".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css",
        ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webmanifest": "application/manifest+json", ".json": "application/json", ".ico": "image/x-icon",
        ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm"}


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path: Path):
        if not path.is_file():
            return False
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(path.suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)
        return True

    def _body(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            return {}

    def _token_ok(self):
        need = SETTINGS.get("token") or ""
        if not need:
            return True
        got = self.headers.get("X-API-Token") or ""
        if got == need:
            return True
        try:
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return (q.get("token", [""])[0]) == need
        except Exception:
            return False

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        try:
            if path == "/api/ping":
                return self._send(200, {"ok": True, "app": "СменаЛАН"})
            if path == "/api/state":
                return self._send(200, {"version": get_state()})
            if path == "/api/db":
                ver, data = get_db()
                return self._send(200, {"version": ver, "data": data})
            if path == "/api/health":
                ver, _ = get_db()
                return self._send(200, {
                    "ok": True, "version": ver, "port": PORT,
                    "uptime_sec": int(time.time() - START),
                    "db_kb": int(DBF.stat().st_size / 1024) if DBF.exists() else 0,
                    "backups": [{"name": p.name, "size_kb": int(p.stat().st_size / 1024)} for p in sorted(BACKUPS.glob("smenalan-*.json"), reverse=True)[:10]],
                })
            if path == "/api/today":
                _, d = get_db()
                res = []
                if d:
                    for p in d.get("punches", []):
                        if p.get("tout") is None:
                            res.append(p)
                return self._send(200, {"on_shift": res})
            if path == "/api/employees":
                _, d = get_db()
                users = []
                if d:
                    for u in d.get("users", []):
                        c = {k: v for k, v in u.items() if k != "password"}
                        users.append(c)
                return self._send(200, {"users": users})
            if path.startswith("/api/punches"):
                _, d = get_db()
                date = ""
                if "?" in self.path:
                    from urllib.parse import parse_qs, urlparse
                    date = parse_qs(urlparse(self.path).query).get("date", [""])[0]
                ps = [p for p in (d or {}).get("punches", []) if not date or p.get("date") == date]
                return self._send(200, {"punches": ps})
            if path.startswith("/api/stats"):
                _, d = get_db()
                return self._send(200, {"users": [(u.get("name"), u.get("username")) for u in (d or {}).get("users", [])],
                                       "punches": (d or {}).get("punches", []), "schedule": (d or {}).get("schedule", [])})
            if path.startswith("/api/production"):
                _, d = get_db()
                return self._send(200, {"production": (d or {}).get("production", []), "products": (d or {}).get("products", [])})
            if path.startswith("/api/camshots"):
                _, d = get_db()
                shots = (d or {}).get("camshots", [])
                return self._send(200, {"camshots": [{k: (v if k != "src" else "") for k, v in s.items()} for s in shots[:200]]})
            if path.startswith("/api/logs"):
                _, d = get_db()
                return self._send(200, {"logs": (d or {}).get("audit", [])[:500]})
            if path.startswith("/api/sensors/latest"):
                from urllib.parse import parse_qs, urlparse
                name = parse_qs(urlparse(self.path).query).get("name", [""])[0]
                _, d = get_db()
                pts = [p for p in (d or {}).get("sensors", []) if p.get("name") == name]
                return self._send(200, {"latest": pts[0] if pts else None})
            if path == "/api/backups":
                return self._send(200, {"backups": [{"name": p.name, "size_kb": int(p.stat().st_size / 1024)} for p in sorted(BACKUPS.glob("smenalan-*.json"), reverse=True)]})
            if path == "/api/endpoints":
                return self._send(200, {"endpoints": [
                    "GET /api/ping", "GET /api/health", "GET /api/state", "GET /api/db", "POST /api/db",
                    "GET /api/today", "GET /api/employees", "GET /api/punches?date=", "GET /api/stats",
                    "GET /api/production", "GET /api/camshots", "GET /api/logs", "GET /api/sensors/latest?name=",
                    "POST /api/sensors", "POST /api/webcam", "POST /api/telegram", "POST /api/backup",
                    "GET /api/backups", "POST /api/files", "GET /files/<имя>", "GET /api/endpoints"]})
            if path.startswith("/files/"):
                name = os.path.basename(path)
                return self._file(FILES / name) or self._send(404, {"error": "not found"})
            # статика
            rel = path.lstrip("/") or "index.html"
            fp = (DIST / rel).resolve()
            if DIST.resolve() in fp.parents or fp == DIST.resolve():
                if fp.is_file():
                    return self._file(fp)
                if (DIST / "index.html").is_file():
                    return self._file(DIST / "index.html")
            return self._send(404, {"error": "not found"})
        except Exception as e:
            log(f"GET {path} error: {e}")
            return self._send(500, {"error": str(e)})

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            body = self._body()
            if path == "/api/db":
                if not isinstance(body.get("data"), dict) or body["data"].get("v") != DB_VERSION:
                    return self._send(400, {"error": f"bad db version (need v={DB_VERSION})"})
                ver = set_db(body["data"], body.get("version", 0))
                return self._send(200, {"ok": True, "version": ver})
            if path == "/api/sensors":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                ver, d = get_db()
                if not d:
                    return self._send(400, {"error": "db empty"})
                d.setdefault("sensors", []).insert(0, {
                    "id": str(int(time.time() * 1000)), "name": str(body.get("name", "sensor")),
                    "value": body.get("value", 0), "unit": str(body.get("unit", "")),
                    "ts": datetime.datetime.now().isoformat(timespec="seconds")})
                d["sensors"] = d["sensors"][:2000]
                set_db(d, ver)
                return self._send(200, {"ok": True})
            if path == "/api/webcam":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                data64 = body.get("dataBase64", "")
                user_id = str(body.get("userId", ""))
                if not data64:
                    return self._send(400, {"error": "no data"})
                raw = base64.b64decode(data64)
                name = f"cam_{user_id}_{datetime.datetime.now():%Y%m%d_%H%M%S}.jpg"
                (FILES / name).write_bytes(raw)
                # чистка файлов старше срока
                cut = time.time() - CAM_KEEP_DAYS * 86400
                for f in FILES.glob("cam_*.jpg"):
                    try:
                        if f.stat().st_mtime < cut:
                            f.unlink()
                    except OSError:
                        pass
                log(f"Снимок веб-камеры сохранён: {name} ({len(raw)//1024} КБ)")
                return self._send(200, {"ok": True, "url": f"/files/{name}"})
            if path == "/api/telegram":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                text = str(body.get("text", ""))
                _, d = get_db()
                s = (d or {}).get("settings", {})
                token, chat = s.get("tgToken", ""), s.get("tgChat", "")
                if not token or not chat:
                    return self._send(400, {"error": "telegram not configured"})
                req = urllib.request.Request(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    data=json.dumps({"chat_id": chat, "text": text}).encode(),
                    headers={"Content-Type": "application/json"})
                try:
                    urllib.request.urlopen(req, timeout=8)
                    return self._send(200, {"ok": True})
                except Exception as e:
                    return self._send(502, {"error": str(e)})
            if path == "/api/backup":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                n = do_backup("manual")
                return self._send(200, {"ok": True, "file": n})
            if path == "/api/files":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                data64 = body.get("dataBase64", "")
                orig = str(body.get("name", "file"))
                if not data64:
                    return self._send(400, {"error": "no data"})
                ext = os.path.splitext(orig)[1] or ".bin"
                name = f"f_{int(time.time()*1000)}{ext}"
                (FILES / name).write_bytes(base64.b64decode(data64))
                return self._send(200, {"ok": True, "url": f"/files/{name}"})
            return self._send(404, {"error": "not found"})
        except Exception as e:
            log(f"POST {path} error: {e}")
            return self._send(500, {"error": str(e)})


# ---------------- трей ----------------
def make_icon():
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([2, 2, 62, 62], radius=14, fill=(20, 24, 31, 255))
        d.arc([14, 14, 50, 50], start=210, end=150, fill=(229, 111, 36, 255), width=6)
        d.line([32, 32, 32, 20], fill=(237, 240, 243, 255), width=4)
        d.line([32, 32, 41, 38], fill=(237, 240, 243, 255), width=4)
        d.ellipse([29, 29, 35, 35], fill=(229, 111, 36, 255))
        return img
    except Exception:
        return None


def open_url(url):
    import webbrowser
    webbrowser.open(url)


def copy_text(text):
    try:
        import subprocess
        if sys.platform == "win32":
            subprocess.run(["clip"], input=text.encode("utf-16le"), check=True)
        elif sys.platform == "darwin":
            subprocess.run(["pbcopy"], input=text.encode(), check=True)
        else:
            subprocess.run(["xclip", "-selection", "clipboard"], input=text.encode(), check=True)
        log(f"Скопировано: {text}")
    except Exception as e:
        log(f"Не удалось скопировать: {e}")


def make_qr(text):
    try:
        import qrcode
        from PIL import Image  # noqa
        qr = qrcode.QRCode(box_size=8, border=2)
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#14181f", back_color="white")
        p = DATA / "connect_qr.png"
        img.save(p)
        return p
    except Exception as e:
        log(f"QR: {e}")
        return None


def tray_loop():
    try:
        import pystray
    except Exception:
        log("pystray недоступен — работаем без трея (используйте --console)")
        while True:
            time.sleep(3600)
        return

    url = f"http://{local_ips()[0]}:{PORT}"
    icon_img = make_icon()
    if icon_img is None:
        log("Pillow недоступен — иконка трея будет стандартной")

    def on_qr(_icon, _item):
        p = make_qr(url)
        if p:
            open_url(p.as_uri())
            log(f"QR-код: {p} ({url})")

    def on_settings(_icon, _item):
        lines = ["СМЕНАЛАН — НАСТРОЙКИ СЕРВЕРА", "=" * 40,
                 f"1. Порт сейчас: {PORT}",
                 "2. API-токен (для датчиков/камер/копий): " + (SETTINGS.get("token") or "не задан"),
                 "3. Автозапуск вместе с Windows: " + ("вкл" if SETTINGS.get("autostart") else "выкл"),
                 "", "IP-адреса этого компьютера:"]
        for ip in local_ips():
            lines.append(f"   http://{ip}:{PORT}")
        lines += ["", "Введите: порт, 'token <значение>', 'autostart on|off' или Enter — закрыть:"]
        try:
            if sys.platform == "win32":
                import ctypes
                ctypes.windll.user32.MessageBoxW(0, "\n".join(lines[:8]), "СменаЛАН — сервер", 0x40)
            ans = input("\n".join(lines) + "\n> ").strip()
            if ans.isdigit():
                SETTINGS["port"] = int(ans)
                save_settings(SETTINGS)
                log("Порт изменён — перезапустите сервер")
            elif ans.startswith("token "):
                SETTINGS["token"] = ans[6:].strip()
                save_settings(SETTINGS)
                log("API-токен обновлён")
            elif ans.startswith("autostart"):
                on = ans.endswith("on")
                SETTINGS["autostart"] = on
                save_settings(SETTINGS)
                set_autostart(on)
                log(f"Автозапуск: {'вкл' if on else 'выкл'}")
        except Exception:
            pass

    def on_quit(icon, _item):
        try:
            do_backup("shutdown")
        except Exception:
            pass
        icon.stop()
        os._exit(0)

    # ВАЖНО: меню статическое (не функция-генератор) и создаётся ПОСЛЕ
    # объявления обработчиков — иначе pystray падает с ошибкой
    # "menu_builder() missing 1 required positional argument: 'icon'"
    menu = pystray.Menu(
        pystray.MenuItem(lambda item: url, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Открыть админку", lambda icon, item: open_url(url)),
        pystray.MenuItem("Скопировать ссылку для сотрудников", lambda icon, item: copy_text(url)),
        pystray.MenuItem("Показать QR-код (телефонам)", on_qr),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Настройки сервера…", on_settings),
        pystray.MenuItem("Резервная копия сейчас", lambda icon, item: log(f"Копия: {do_backup('manual')}")),
        pystray.MenuItem("Открыть журнал server.log", lambda icon, item: open_url(LOGF.as_uri())),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Выйти (остановить сервер)", on_quit),
    )
    icon = pystray.Icon("smenalan", icon_img, "СменаЛАН — сервер", menu)
    icon.run()


def set_autostart(on: bool):
    try:
        if sys.platform != "win32":
            return
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
        cmd = f'"{sys.executable}" "{BASE / "launcher.py"}" --console'
        if on:
            winreg.SetValueEx(key, "SmenaLAN Server", 0, winreg.REG_SZ, cmd)
        else:
            try:
                winreg.DeleteValue(key, "SmenaLAN Server")
            except FileNotFoundError:
                pass
        winreg.CloseKey(key)
    except Exception as e:
        log(f"Автозапуск: {e}")


def main():
    console = "--console" in sys.argv
    if "--port" in sys.argv:
        try:
            SETTINGS["port"] = int(sys.argv[sys.argv.index("--port") + 1])
        except Exception:
            pass
    global PORT
    PORT = find_port(int(SETTINGS.get("port", 8080)))

    if not console and sys.platform == "win32":
        # одиночный экземпляр
        try:
            import ctypes
            k = ctypes.windll.kernel32
            k.CreateMutexW(None, True, "SmenaLANServerMutex")
            if k.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
                print("Сервер уже запущен (живёт в трее).")
                input("Enter — закрыть…")
                return
        except Exception:
            pass

    threading.Thread(target=backup_loop, daemon=True).start()
    threading.Thread(target=cleanup_camshots, daemon=True).start()

    srv = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    ips = local_ips()
    print("=" * 52)
    print("  СМЕНАЛАН · локальный сервер (реальное время)")
    print("=" * 52)
    print(f"  веб-приложение: {DIST}")
    for ip in ips:
        print(f"  сервер запущен:  http://{ip}:{PORT}")
    print(f"  база: SQLite ({DBF.name}) · файлы: data/files")
    print("  правый клик по иконке в трее — ссылка, QR-код, настройки")
    print("  (закрывать это окно не обязательно)")
    print("=" * 52)
    log(f"Сервер запущен на порту {PORT}, IP: {', '.join(ips)}")

    if console:
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            log("Остановлен пользователем")
    else:
        tray_loop()


if __name__ == "__main__":
    main()
