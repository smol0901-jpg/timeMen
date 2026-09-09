import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { ApiLogEntry } from "../lib/types";
import { CAMERA_PRESETS, API_TEMPLATES, downloadTemplate, detectCameras, openCamera, stopCamera, CamDevice } from "../lib/camtpl";
import { I, useToast, Field, Toggle } from "./ui";
import { relTime } from "../lib/time";

// ---------- Шаблоны камер + автонастройка ----------
export function CameraTemplatesCard() {
  const { db, setSettings } = useStore();
  const { toast } = useToast();
  const s = db.settings;
  const [devices, setDevices] = useState<CamDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [liveInfo, setLiveInfo] = useState("");
  const [err, setErr] = useState("");
  const [cam, setCam] = useState({ name: "", url: "", workshopId: "" });
  const vRef = useRef<HTMLVideoElement>(null);

  const scan = async () => {
    setBusy(true);
    const d = await detectCameras();
    setDevices(d);
    setBusy(false);
    if (d.length === 0) setErr("Камеры не найдены. Подключите веб-камеру или разрешите доступ.");
    else setErr("");
  };
  // Убрали автоматическое сканирование - камера включается только по кнопке
  useEffect(() => () => { if (vRef.current) stopCamera(vRef.current); }, []);

  const startLive = async () => {
    if (!vRef.current) return;
    setErr("");
    try {
      const r = await openCamera(vRef.current, s.camPreset || "auto", s.camDeviceId);
      setLive(true);
      setLiveInfo(`${r.w}×${r.h} · автофокус/экспозиция подстроены`);
      toast(`Камера настроена автоматически: ${r.w}×${r.h}`, "ok");
    } catch {
      setErr("Не удалось открыть камеру. Проверьте доступ в браузере или выберите другое устройство.");
    }
  };

  return (
    <div className="card p-5">
      <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-1"><I n="camera" size={16} />Шаблоны камер и автонастройка</h3>
      <p className="text-[12px] text-mute font-bold mb-3">Выберите шаблон — разрешение, фокус и освещённость подстроятся автоматически. Внешняя USB-камера приоритетнее встроенной; на телефоне автоматически берётся фронтальная. Каждое применение логируется.</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <span className="lbl">Шаблон</span>
          <div className="grid gap-1.5">
            {CAMERA_PRESETS.map((p) => (
              <button key={p.id} onClick={() => { setSettings({ camPreset: p.id, camDeviceId: null }); toast(`Шаблон «${p.name}» применён и записан в журнал`, "ok"); }}
                className={`text-left rounded-xl border px-3.5 py-2.5 transition hover:border-accent ${(s.camPreset || "auto") === p.id ? "!border-accent bg-accent-soft" : "border-line"}`}>
                <b className="text-[13px] flex items-center gap-2">{p.name}{(s.camPreset || "auto") === p.id && <I n="check" size={14} className="text-accent-deep" />}</b>
                <span className="text-[11.5px] text-mute font-semibold leading-snug block mt-0.5">{p.desc}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <Toggle checked={!!s.camAutoTune} onChange={(v) => setSettings({ camAutoTune: v })} label="Автоподстройка (разрешение, свет, фокус на лице)" />
            <Toggle checked={!!s.camBio} onChange={(v) => setSettings({ camBio: v })} label="Биометрическое подтверждение по фото сотрудника" sub="маленькая нейросеть face-api, дообучается на успешных проходах" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="lbl !mb-0">Найденные камеры</span>
            <button className="btn btn-ghost btn-sm ml-auto" onClick={scan} disabled={busy}><I n="history" size={13} />{busy ? "Поиск…" : "Сканировать"}</button>
          </div>
          <div className="grid gap-1.5">
            {devices.map((d) => (
              <button key={d.id} onClick={() => { setSettings({ camDeviceId: d.id }); toast(`Закреплена камера: ${d.label}`, "ok"); }}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition hover:border-accent ${s.camDeviceId === d.id ? "!border-accent bg-accent-soft" : "border-line"}`}>
                <I n="camera" size={15} className={d.kind === "usb" ? "text-night" : d.kind === "builtin" ? "text-ok" : "text-mute"} />
                <span className="min-w-0">
                  <b className="text-[12.5px] block truncate">{d.label || "Камера без названия"}</b>
                  <span className="text-[10px] font-extrabold uppercase text-mute">{d.kind === "usb" ? "внешняя USB" : d.kind === "builtin" ? "встроенная" : "тип не определён"}</span>
                </span>
                {s.camDeviceId === d.id && <I n="check" size={14} className="ml-auto text-accent-deep" />}
              </button>
            ))}
            {devices.length === 0 && !busy && <p className="text-[12px] font-bold text-mute border border-dashed border-line rounded-lg p-3 text-center">Камеры не обнаружены</p>}
          </div>
          {s.camDeviceId && <button className="btn btn-ghost btn-sm mt-2" onClick={() => { setSettings({ camDeviceId: null }); toast("Возврат к автовыбору камеры", "ok"); }}>Вернуть автовыбор</button>}
          <div className="mt-3 rounded-xl border border-line overflow-hidden bg-steel-950">
            <video ref={vRef} playsInline muted className={`w-full ${live ? "" : "hidden"}`} />
            {!live && <div className="p-4 text-center text-[12px] font-bold text-steel-400">Предпросмотр выключен</div>}
            <div className="p-2 flex items-center gap-2 bg-steel-900">
              {!live ? (
                <button className="btn btn-dark btn-sm" onClick={startLive}><I n="play" size={13} />Проверить и настроить</button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => { if (vRef.current) stopCamera(vRef.current); setLive(false); }}><I n="stop" size={13} />Стоп</button>
              )}
              <span className="text-[11px] font-bold text-steel-200 truncate">{live ? liveInfo : "камера откроется с авто-параметрами"}</span>
            </div>
          </div>
          {err && <p className="text-[12px] font-bold text-bad mt-2 flex items-center gap-1.5"><I n="warn" size={13} />{err}</p>}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <span className="lbl">IP-камеры цехов (RTSP — захватывает сервер, нужен ffmpeg)</span>
        <div className="grid gap-1.5">
          {(s.ipCameras || []).map((c) => (
            <div key={c.id} className="flex items-center gap-2 border border-line rounded-lg px-3 py-2">
              <I n="video" size={15} className="text-night" />
              <b className="text-[12.5px] whitespace-nowrap">{c.name}</b>
              <code className="text-[11px] font-mono text-mute truncate flex-1">{c.url}</code>
              <button className="w-7 h-7 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition"
                onClick={() => { setSettings({ ipCameras: (s.ipCameras || []).filter((x) => x.id !== c.id) }); toast("Камера удалена", "ok"); }}><I n="trash" size={13} /></button>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-[1fr_1.4fr_1fr_auto] gap-2 mt-2">
          <input className="input !h-9" placeholder="Название" value={cam.name} onChange={(e) => setCam({ ...cam, name: e.target.value })} />
          <input className="input !h-9 font-mono !text-[12px]" placeholder="rtsp://admin:pass@192.168.1.64:554/stream1" value={cam.url} onChange={(e) => setCam({ ...cam, url: e.target.value })} />
          <select className="input !h-9" value={cam.workshopId} onChange={(e) => setCam({ ...cam, workshopId: e.target.value })}>
            <option value="">Без цеха</option>
            {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm !h-9" onClick={() => {
            if (!cam.name.trim() || !cam.url.trim()) { toast("Название и адрес обязательны", "bad"); return; }
            setSettings({ ipCameras: [...(s.ipCameras || []), { id: String(Date.now()), name: cam.name.trim(), url: cam.url.trim(), workshopId: cam.workshopId || null }] });
            setCam({ name: "", url: "", workshopId: "" });
            toast("IP-камера добавлена", "ok");
          }}><I n="plus" size={13} />Добавить</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Шаблоны подключений API ----------
export function ApiTemplatesCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState("");

  const testTelegram = async () => {
    setTesting("telegram");
    try {
      const r = await fetch("./api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "✅ «СменаЛАН»: проверка связи по шаблону Telegram." }) });
      const j = await r.json().catch(() => ({}));
      toast(r.ok ? "Отправлено — проверьте канал" : `Сервер: ${j.error || "не настроен токен/chat_id"}`, r.ok ? "ok" : "bad");
    } catch { toast("Сервер недоступен — запустите его (ярлык на рабочем столе)", "bad"); }
    setTesting("");
  };

  return (
    <div className="card p-5">
      <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-1"><I n="layers" size={16} />Готовые шаблоны подключений API</h3>
      <p className="text-[12px] text-mute font-bold mb-3">Скачайте шаблон, замените значения по инструкции и вставьте в настройки — всё заработает. Каждое обращение к API пишется в журнал сервера.</p>
      <div className="grid md:grid-cols-2 gap-3">
        {API_TEMPLATES.map((t) => (
          <div key={t.id} className="border border-line rounded-xl p-4 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-night-soft text-night grid place-items-center shrink-0"><I n={t.id === "telegram" ? "send" : t.id === "ollama" ? "bot" : t.id === "sensors" ? "layers" : t.id === "ipcamera" ? "video" : t.id === "tunnel" ? "wifi" : "link"} size={15} /></span>
              <div className="min-w-0">
                <b className="text-[13px] block truncate">{t.title}</b>
                <span className="text-[11px] text-mute font-bold">{t.file}</span>
              </div>
            </div>
            <p className="text-[12px] text-mute font-semibold leading-snug mt-2 flex-1">{t.desc}</p>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              <button className="btn btn-ghost btn-sm" onClick={() => { downloadTemplate(t); toast(`Шаблон ${t.file} сохранён — заполните по инструкции`, "ok"); }}><I n="download" size={13} />Шаблон</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === t.id ? null : t.id)}><I n="help" size={13} />Инструкция</button>
              {t.id === "telegram" && <button className="btn btn-soft btn-sm" disabled={!!testing} onClick={testTelegram}><I n="send" size={13} />{testing ? "Тест…" : "Тест"}</button>}
            </div>
            {open === t.id && (
              <ol className="mt-3 grid gap-1.5 border-t border-line pt-3 anim-rise">
                {t.steps.map((s2, i) => <li key={i} className="text-[12px] font-semibold text-mute leading-snug">{s2}</li>)}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Журнал настроек и API ----------
export function ConfigLogCard() {
  const { db } = useStore();
  const [srv, setSrv] = useState<{ log: { ts: string; method: string; path: string; note: string }[]; server_settings?: Record<string, unknown> } | null>(null);
  const [tab, setTab] = useState<"client" | "server">("client");

  useEffect(() => {
    let alive = true;
    const pull = () => fetch("./api/configlog", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (alive) setSrv(j); }).catch(() => {});
    pull();
    const t = setInterval(pull, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const clientLog = db.audit.filter((a) => ["Настройки", "Система", "Права", "Архив"].includes(a.action) || a.details.toLowerCase().includes("api")).slice(0, 80);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2"><I n="history" size={16} />Журнал настроек и API</h3>
        <div className="ml-auto inline-flex bg-paper border border-line rounded-lg p-0.5 gap-0.5">
          {([["client", "Настройки (клиент)"], ["server", "Запросы API (сервер)"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={`px-2.5 h-7 rounded-md text-[11px] font-extrabold transition ${tab === v ? "bg-steel-900 text-paper" : "text-mute"}`}>{l}</button>
          ))}
        </div>
      </div>
      {tab === "client" ? (
        <div className="grid gap-1 max-h-72 overflow-y-auto dark-scroll pr-1">
          {clientLog.length === 0 && <p className="text-[12px] font-bold text-mute text-center py-6">Изменений настроек пока не было</p>}
          {clientLog.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 text-[12px] border-b border-line/60 pb-1">
              <span className="font-mono text-[10.5px] text-mute whitespace-nowrap">{new Date(a.ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <b className="whitespace-nowrap">{a.actor}</b>
              <span className="badge bg-paper text-ink">{a.action}</span>
              <span className="text-mute font-semibold truncate">{a.details}</span>
            </div>
          ))}
        </div>
      ) : srv ? (
        <div className="grid gap-1 max-h-72 overflow-y-auto dark-scroll pr-1">
          {srv.log.length === 0 && <p className="text-[12px] font-bold text-mute text-center py-6">Запросов пока не было</p>}
          {srv.log.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5 text-[12px] border-b border-line/60 pb-1">
              <span className="font-mono text-[10.5px] text-mute whitespace-nowrap">{r.ts.slice(11, 19)}</span>
              <span className={`badge ${r.method === "GET" ? "bg-night-soft text-night" : "bg-ok-soft text-ok"}`}>{r.method}</span>
              <code className="font-mono text-[11.5px] truncate">{r.path}</code>
              {r.note && <span className="text-mute font-semibold truncate ml-auto">{r.note}</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] font-bold text-mute text-center py-6">Сервер недоступен — журнал запросов появится после запуска (ярлык на рабочем столе)</p>
      )}
    </div>
  );
}

export { Field };
export type { ApiLogEntry };
void relTime;
