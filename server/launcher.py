#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""СменаЛАН — локальный сервер для Wi-Fi сети.
Живёт в трее: ссылка для сотрудников, QR-код, настройки, резервные копии.
База — SQLite (server/data), без ограничения места. Запуск: python launcher.py [--console]
"""
import base64, datetime as dt, http.server, io, json, os, re, socket, socketserver, sqlite3, subprocess, sys, threading, time, urllib.parse, webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.normpath(os.path.join(ROOT, "..", "dist"))
DATA = os.path.join(ROOT, "data")
FILES = os.path.join(DATA, "files")
BACKUPS = os.path.join(DATA, "backups")
LOG_FILE = os.path.join(ROOT, "server.log")
CONFIG_FILE = os.path.join(DATA, "server.json")
SQL_FILE = os.path.join(DATA, "smenalan.sqlite")
MIRROR = os.path.join(DATA, "db.json")
START = time.time()

MIME = {".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml",
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webmanifest": "application/manifest+json",
        ".json": "application/json", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webm": "video/webm", ".mp4": "video/mp4"}

def log(msg):
    line = "[%s] %s" % (dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def ensure_dirs():
    for d in (DATA, FILES, BACKUPS):
        os.makedirs(d, exist_ok=True)

def load_config():
    cfg = {"port": 8080, "autostart": False, "token": "", "last_backup": ""}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    except Exception:
        pass
    return cfg

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

CFG = load_config()
LOCK = threading.Lock()

# ---------- SQLite ----------
def conn():
    c = sqlite3.connect(SQL_FILE, timeout=10)
    c.execute("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL DEFAULT 0, data TEXT, updated TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS sensors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, value REAL, unit TEXT, ts TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS requests_log (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT, ts TEXT)")
    return c

def get_state():
    with LOCK:
        c = conn()
        row = c.execute("SELECT version FROM state WHERE id=1").fetchone()
        c.close()
    return row[0] if row else 0

def get_db():
    with LOCK:
        c = conn()
        row = c.execute("SELECT version, data FROM state WHERE id=1").fetchone()
        c.close()
    return (row[0], row[1]) if row and row[1] else (0, None)

def set_db(data_obj, client_version):
    with LOCK:
        c = conn()
        cur = c.execute("SELECT version FROM state WHERE id=1").fetchone()
        stored = cur[0] if cur else 0
        ver = max(int(client_version or 0), stored + 1)
        text = json.dumps(data_obj, ensure_ascii=False)
        now = dt.datetime.now().isoformat(timespec="seconds")
        if cur:
            c.execute("UPDATE state SET version=?, data=?, updated=? WHERE id=1", (ver, text, now))
        else:
            c.execute("INSERT INTO state (id, version, data, updated) VALUES (1,?,?,?)", (ver, text, now))
        c.commit(); c.close()
    try:
        with open(MIRROR, "w", encoding="utf-8") as f:
            f.write(text)
    except Exception:
        pass
    maybe_weekly_backup(text)
    return ver

def maybe_weekly_backup(text=None):
    try:
        last = CFG.get("last_backup") or ""
        if last and (dt.datetime.now() - dt.datetime.fromisoformat(last)).days < 7:
            return None
        if text is None:
            _, text = get_db()
        if not text:
            return None
        name = "smenalan-%s.json" % dt.datetime.now().strftime("%Y%m%d-%H%M")
        path = os.path.join(BACKUPS, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        CFG["last_backup"] = dt.datetime.now().isoformat(timespec="seconds")
        save_config(CFG)
        log("Резервная копия: %s" % path)
        return path
    except Exception as e:
        log("Ошибка резервной копии: %s" % e)
        return None

def net_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

IP = net_ip()
PORT = int(CFG.get("port") or 8080)

# ---------- HTTP ----------
class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def _token_ok(self):
        t = CFG.get("token") or ""
        if not t:
            return True
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return self.headers.get("X-API-Token") == t or q.get("token", [""])[0] == t

    def _data(self):
        _, text = get_db()
        try:
            return json.loads(text) if text else None
        except Exception:
            return None

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,X-API-Token")
        self.end_headers()

    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        path = p.path
        q = urllib.parse.parse_qs(p.query)
        try:
            if path == "/api/ping":
                return self._send(200, {"ok": True, "server": "smenalan", "time": dt.datetime.now().isoformat(timespec="seconds")})
            if path == "/api/state":
                return self._send(200, {"version": get_state()})
            if path == "/api/db":
                ver, text = get_db()
                if not text:
                    return self._send(404, {"error": "empty"})
                return self._send(200, {"version": ver, "data": json.loads(text)})
            if path == "/api/health":
                backups = sorted(os.listdir(BACKUPS)) if os.path.isdir(BACKUPS) else []
                size = os.path.getsize(SQL_FILE) if os.path.exists(SQL_FILE) else 0
                return self._send(200, {"ok": True, "version": get_state(), "uptime_sec": int(time.time() - START), "port": PORT,
                                        "sqlite_bytes": size, "backups": len(backups), "last_backup": CFG.get("last_backup") or None})
            if path == "/api/endpoints":
                return self._send(200, {"endpoints": [
                    "GET /api/ping", "GET /api/health", "GET /api/state", "GET /api/db", "POST /api/db", "GET /api/today",
                    "GET /api/employees", "GET /api/punches?date=YYYY-MM-DD", "GET /api/stats?from&to", "GET /api/production?from&to",
                    "GET /api/logs?limit=N", "GET /api/sensors", "GET /api/sensors/latest?name=X", "POST /api/sensors",
                    "POST /api/backup", "GET /api/backups", "POST /api/files", "GET /files/<имя>"]})
            if path == "/api/today":
                d = self._data()
                today = dt.date.today().isoformat()
                if not d:
                    return self._send(200, {"today": today, "on_shift": [], "punches": []})
                names = {u["id"]: u["name"] for u in d.get("users", [])}
                punches = [x for x in d.get("punches", []) if x.get("date") == today]
                on_shift = [{"userId": x["userId"], "name": names.get(x["userId"], "?"), "tin": x["tin"]}
                            for x in punches if x.get("tout") is None]
                return self._send(200, {"today": today, "on_shift": on_shift,
                                        "punches": [{"name": names.get(x["userId"], "?"), "tin": x["tin"], "tout": x.get("tout")} for x in punches]})
            if path == "/api/employees":
                d = self._data()
                if not d:
                    return self._send(200, [])
                ws = {w["id"]: w["name"] for w in d.get("workshops", [])}
                return self._send(200, [{"id": u["id"], "username": u["username"], "name": u["name"], "role": u["role"],
                                         "workshop": ws.get(u.get("workshopId") or "", None), "active": u.get("active", True)}
                                        for u in d.get("users", [])])
            if path == "/api/punches":
                d = self._data()
                date = q.get("date", [dt.date.today().isoformat()])[0]
                names = {u["id"]: u["name"] for u in (d or {}).get("users", [])}
                out = [{"name": names.get(x["userId"], "?"), "date": x["date"], "tin": x["tin"], "tout": x.get("tout")}
                       for x in (d or {}).get("punches", []) if x.get("date") == date]
                return self._send(200, out)
            if path == "/api/stats":
                d = self._data()
                f = q.get("from", [dt.date.today().replace(day=1).isoformat()])[0]
                t = q.get("to", [dt.date.today().isoformat()])[0]
                plan = {"day": 480, "night": 690}
                res = {}
                for u in (d or {}).get("users", []):
                    if u.get("role") != "employee":
                        continue
                    res[u["id"]] = {"name": u["name"], "plan_min": 0, "fact_min": 0}
                for s in (d or {}).get("schedule", []):
                    if s["date"] < f or s["date"] > t or s["userId"] not in res:
                        continue
                    res[s["userId"]]["plan_min"] += plan.get(s["type"], 0)
                for p in (d or {}).get("punches", []):
                    if p["date"] < f or p["date"] > t or p["userId"] not in res or p.get("tout") is None:
                        continue
                    raw = p["tout"] - p["tin"] if p["tout"] >= p["tin"] else 1440 - p["tin"] + p["tout"]
                    if raw > 360:
                        raw -= (d or {}).get("settings", {}).get("breakMin", 45)
                    res[p["userId"]]["fact_min"] += max(0, raw)
                return self._send(200, list(res.values()))
            if path == "/api/production":
                d = self._data()
                f = q.get("from", ["2000-01-01"])[0]
                t = q.get("to", ["2999-01-01"])[0]
                names = {u["id"]: u["name"] for u in (d or {}).get("users", [])}
                prods = {p["id"]: p for p in (d or {}).get("products", [])}
                out = []
                for r in (d or {}).get("production", []):
                    if f <= r["date"] <= t:
                        pr = prods.get(r["productId"], {})
                        out.append({"date": r["date"], "name": names.get(r["userId"], "?"), "product": pr.get("name", "?"),
                                    "qty": r["qty"], "unit": pr.get("unit", ""), "sum": round(r["qty"] * pr.get("price", 0), 2)})
                return self._send(200, out)
            if path == "/api/logs":
                d = self._data()
                limit = int(q.get("limit", ["100"])[0])
                return self._send(200, (d or {}).get("audit", [])[:limit])
            if path == "/api/sensors/latest":
                name = q.get("name", [""])[0]
                with LOCK:
                    c = conn()
                    if name:
                        row = c.execute("SELECT name, value, unit, ts FROM sensors WHERE name=? ORDER BY id DESC LIMIT 1", (name,)).fetchone()
                    else:
                        row = c.execute("SELECT name, value, unit, ts FROM sensors ORDER BY id DESC LIMIT 1").fetchone()
                    c.close()
                return self._send(200, ({"name": row[0], "value": row[1], "unit": row[2], "ts": row[3]} if row else None))
            if path == "/api/sensors":
                limit = int(q.get("limit", ["100"])[0])
                with LOCK:
                    c = conn()
                    rows = c.execute("SELECT name, value, unit, ts FROM sensors ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
                    c.close()
                return self._send(200, [{"name": r[0], "value": r[1], "unit": r[2], "ts": r[3]} for r in rows])
            if path == "/api/backups":
                items = sorted(os.listdir(BACKUPS), reverse=True) if os.path.isdir(BACKUPS) else []
                return self._send(200, [{"file": x, "size": os.path.getsize(os.path.join(BACKUPS, x))} for x in items])
            if path.startswith("/files/"):
                name = os.path.basename(path)
                fp = os.path.join(FILES, name)
                if not os.path.isfile(fp):
                    return self._send(404, {"error": "not found"})
                ext = os.path.splitext(name)[1].lower()
                with open(fp, "rb") as f:
                    return self._send(200, f.read(), MIME.get(ext, "application/octet-stream"))
            # статика из dist
            rel = path.lstrip("/") or "index.html"
            fp = os.path.normpath(os.path.join(DIST, rel))
            if not fp.startswith(DIST) or not os.path.isfile(fp):
                fp = os.path.join(DIST, "index.html")
            ext = os.path.splitext(fp)[1].lower()
            with open(fp, "rb") as f:
                return self._send(200, f.read(), MIME.get(ext, "application/octet-stream"))
        except Exception as e:
            log("GET %s ошибка: %s" % (path, e))
            return self._send(500, {"error": str(e)})

    def do_POST(self):
        p = urllib.parse.urlparse(self.path).path
        try:
            if p == "/api/db":
                body = self._body()
                if not body or "data" not in body:
                    return self._send(400, {"error": "need {data}"})
                if not isinstance(body["data"], dict) or body["data"].get("v") != 5:
                    return self._send(400, {"error": "bad db version (need v=5)"})
                ver = set_db(body["data"], body.get("version", 0))
                return self._send(200, {"ok": True, "version": ver})
            if p == "/api/sensors":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                b = self._body() or {}
                name = str(b.get("name") or "sensor")[:64]
                value = float(b.get("value", 0))
                unit = str(b.get("unit") or "")[:16]
                ts = dt.datetime.now().isoformat(timespec="seconds")
                with LOCK:
                    c = conn()
                    c.execute("INSERT INTO sensors (name, value, unit, ts) VALUES (?,?,?,?)", (name, value, unit, ts))
                    c.commit(); c.close()
                return self._send(200, {"ok": True, "name": name, "value": value, "ts": ts})
            if p == "/api/backup":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                path = maybe_weekly_backup()
                if path is None:
                    CFG["last_backup"] = ""
                    path = maybe_weekly_backup()
                return self._send(200, {"ok": True, "file": os.path.basename(path or "")})
            if p == "/api/files":
                if not self._token_ok():
                    return self._send(403, {"error": "token required"})
                b = self._body() or {}
                name = re.sub(r"[^A-Za-zА-Яа-яЁё0-9._-]", "_", str(b.get("name") or "file"))[:80] or "file"
                b64 = str(b.get("dataBase64") or "")
                data = base64.b64decode(b64)
                fname = "%s_%s" % (dt.datetime.now().strftime("%Y%m%d%H%M%S"), name)
                with open(os.path.join(FILES, fname), "wb") as f:
                    f.write(data)
                log("Файл сохранён: %s (%d байт)" % (fname, len(data)))
                return self._send(200, {"ok": True, "url": "/files/" + fname})
            return self._send(404, {"error": "unknown endpoint"})
        except Exception as e:
            log("POST %s ошибка: %s" % (p, e))
            return self._send(500, {"error": str(e)})

class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

# ---------- трей ----------
def make_icon_image():
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (64, 64), (20, 24, 31, 255))
    d = ImageDraw.Draw(img)
    d.ellipse([10, 10, 54, 54], outline=(229, 111, 36, 255), width=6)
    d.line([32, 32, 32, 17], fill=(237, 240, 243, 255), width=5)
    d.line([32, 32, 43, 39], fill=(237, 240, 243, 255), width=5)
    d.ellipse([28, 28, 36, 36], fill=(229, 111, 36, 255))
    return img

def copy_text(text):
    for cmd in (["clip"], ["xclip", "-selection", "clipboard"], ["pbcopy"]):
        try:
            pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            pr.communicate(text.encode("utf-8"))
            if pr.returncode == 0:
                return True
        except Exception:
            continue
    try:
        import tkinter as tk
        r = tk.Tk(); r.withdraw(); r.clipboard_clear(); r.clipboard_append(text); r.update(); r.destroy()
        return True
    except Exception:
        return False

def show_qr(icon=None, item=None):
    try:
        import qrcode
        url = "http://%s:%d" % (IP, PORT)
        img = qrcode.make(url)
        path = os.path.join(DATA, "qr.png")
        img.save(path)
        os.startfile(path) if sys.platform == "win32" else subprocess.Popen(["xdg-open", path])
    except Exception as e:
        log("QR ошибка: %s" % e)

def write_autostart(enable):
    if sys.platform != "win32":
        return
    try:
        startup = os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs\Startup")
        bat = os.path.join(startup, "smenalan-server.bat")
        if enable:
            py = sys.executable
            with open(bat, "w", encoding="utf-8") as f:
                f.write('@echo off\r\nstart "" /min "%s" "%s"\r\n' % (py, os.path.abspath(__file__)))
        elif os.path.exists(bat):
            os.remove(bat)
    except Exception as e:
        log("Автозапуск: %s" % e)

def show_settings(icon=None, item=None):
    def run():
        try:
            import tkinter as tk
            from tkinter import ttk
            w = tk.Tk(); w.title("СменаЛАН — настройки сервера"); w.geometry("460x330")
            w.resizable(False, False)
            pad = {"padx": 14, "pady": 6}
            tk.Label(w, text="Порт (нужен перезапуск сервера)", font=("Segoe UI", 9, "bold")).pack(anchor="w", **pad)
            port = tk.Entry(w, font=("Consolas", 11)); port.insert(0, str(CFG.get("port", 8080))); port.pack(fill="x", **pad)
            tk.Label(w, text="API-токен для датчиков (пусто = открыто)", font=("Segoe UI", 9, "bold")).pack(anchor="w", **pad)
            tok = tk.Entry(w, font=("Consolas", 11)); tok.insert(0, str(CFG.get("token", ""))); tok.pack(fill="x", **pad)
            tk.Label(w, text="Файлы и фото: %s" % FILES, font=("Segoe UI", 8), fg="#666", wraplength=420).pack(anchor="w", **pad)
            auto = tk.BooleanVar(value=bool(CFG.get("autostart")))
            ttk.Checkbutton(w, text="Запускать сервер вместе с Windows", variable=auto).pack(anchor="w", **pad)
            tk.Label(w, text="IP для сотрудников: http://%s:%s" % (IP, port.get() or CFG.get("port")),
                     font=("Consolas", 10, "bold"), fg="#c85b15").pack(anchor="w", **pad)
            def ok():
                try:
                    CFG["port"] = int(port.get() or 8080)
                except ValueError:
                    pass
                CFG["token"] = tok.get().strip()
                CFG["autostart"] = bool(auto.get())
                save_config(CFG)
                write_autostart(CFG["autostart"])
                log("Настройки сохранены: порт %s, токен %s, автозапуск %s" % (CFG["port"], "вкл" if CFG["token"] else "выкл", CFG["autostart"]))
                w.destroy()
            tk.Button(w, text="Сохранить", command=ok, font=("Segoe UI", 10, "bold")).pack(pady=10)
            w.mainloop()
        except Exception as e:
            log("Окно настроек недоступно (%s). Правьте server/data/server.json вручную." % e)
    threading.Thread(target=run, daemon=True).start()

def main():
    global PORT
    ensure_dirs()
    console = "--console" in sys.argv
    try:
        httpd = ThreadingServer(("0.0.0.0", PORT), H)
    except OSError:
        for cand in range(PORT + 1, PORT + 20):
            try:
                httpd = ThreadingServer(("0.0.0.0", cand), H)
                PORT = cand
                break
            except OSError:
                continue
        else:
            log("Нет свободного порта"); sys.exit(1)

    print("=" * 52)
    print("  СМЕНАЛАН · локальный сервер (SQLite, реальное время)")
    print("=" * 52)
    print("  веб-приложение: %s" % DIST)
    print("  сервер запущен:  http://%s:%d" % (IP, PORT))
    print("  ссылка для сотрудников: http://%s:%d" % (IP, PORT))
    print("  база: %s" % SQL_FILE)
    print("  фото и файлы: %s" % FILES)
    print("  резервные копии: %s (еженедельно)" % BACKUPS)
    print("  правый клик по иконке в трее — меню сервера")
    print("=" * 52)
    log("Сервер запущен http://%s:%d (dist=%s, sqlite=%s)" % (IP, PORT, DIST, os.path.exists(SQL_FILE)))

    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    if console:
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            log("Остановлен вручную"); sys.exit(0)

    try:
        import pystray
        from pystray import Menu, MenuItem
    except Exception as e:
        log("pystray недоступен (%s) — работаем в консоли, Ctrl+C для выхода" % e)
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            sys.exit(0)

    def quit_app(icon, item):
        log("Сервер остановлен из трея")
        try:
            icon.stop()
        except Exception:
            pass
        try:
            httpd.shutdown()
        except Exception:
            pass
        os._exit(0)

    menu = Menu(
        MenuItem("СМЕНАЛАН — сервер запущен", None, enabled=False),
        MenuItem("Открыть: http://%s:%d" % (IP, PORT), lambda i, s: webbrowser.open("http://%s:%d" % (IP, PORT)), default=True),
        MenuItem("Скопировать ссылку для сотрудников", lambda i, s: copy_text("http://%s:%d" % (IP, PORT))),
        MenuItem("Показать QR-код для телефона", show_qr),
        Menu.SEPARATOR,
        MenuItem("IP: %s:%d (клик — копировать)" % (IP, PORT), lambda i, s: copy_text(str(IP))),
        MenuItem("Настройки сервера…", show_settings),
        MenuItem("Резервная копия сейчас", lambda i, s: (CFG.__setitem__("last_backup", ""), maybe_weekly_backup())),
        MenuItem("Журнал server.log", lambda i, s: os.startfile(LOG_FILE) if sys.platform == "win32" else None),
        Menu.SEPARATOR,
        MenuItem("Выйти (остановить сервер)", quit_app),
    )
    icon = pystray.Icon("smenalan", make_icon_image(), "СменаЛАН · http://%s:%d" % (IP, PORT), menu)
    try:
        icon.run()
    except Exception as e:
        log("Трей недоступен (%s) — сервер работает в фоне" % e)
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            sys.exit(0)

if __name__ == "__main__":
    main()
