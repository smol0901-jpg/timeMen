import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useStore, openPunchOf, wsName } from "../lib/store";
import { KioskTheme } from "../lib/types";
import { Avatar, I, Logo, Modal, OnlineDot, useNow } from "./ui";
import { fmtClock, fmtMin, nowMin, MONTHS, WD_FULL, todayKey } from "../lib/time";

const THEMES: Record<KioskTheme, { name: string; bg: string; card: string; border: string; text: string; mute: string; accent: string; chipOn: string }> = {
  steel: { name: "Сталь", bg: "#0e1116", card: "#1b212b", border: "#2c3646", text: "#edf0f3", mute: "#8291a8", accent: "#e56f24", chipOn: "#17875c" },
  mint: { name: "Мята", bg: "#0b1f1a", card: "#123129", border: "#1f5245", text: "#e8f5ef", mute: "#7fb8a5", accent: "#34d399", chipOn: "#34d399" },
  sunset: { name: "Закат", bg: "#221208", card: "#3a2011", border: "#5d351b", text: "#fdeedd", mute: "#c99b76", accent: "#f59e0b", chipOn: "#f97316" },
  ocean: { name: "Океан", bg: "#091525", card: "#11223c", border: "#1e3d63", text: "#e6f1fb", mute: "#7fa6cc", accent: "#38bdf8", chipOn: "#38bdf8" },
  light: { name: "Светлая", bg: "#e9edf1", card: "#ffffff", border: "#d3dbe4", text: "#171b22", mute: "#5d6a80", accent: "#e56f24", chipOn: "#17875c" },
};

type ShotState = { userId: string; punchId: string; dir: "in" | "out"; src: string | null; phase: "capture" | "show"; off: boolean } | null;

export default function Kiosk({ onExit }: { onExit: () => void }) {
  const { db, kioskPunch, addCamShot, setSettings } = useStore();
  const now = useNow();
  const [flash, setFlash] = useState<{ name: string; dir: "in" | "out"; time: string } | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null); // userId | 'exit' | 'theme'
  const [themePick, setThemePick] = useState<KioskTheme | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [qr, setQr] = useState(false);
  const [qrSrc, setQrSrc] = useState("");
  const [shot, setShot] = useState<ShotState>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const theme = THEMES[db.settings.kioskTheme || "steel"] || THEMES.steel;
  const emps = db.users.filter((u) => u.active && !u.archived);
  const free = db.settings.kioskFree;
  const url = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";

  useEffect(() => {
    if (qr && url) QRCode.toDataURL(url, { width: 320, margin: 1 }).then(setQrSrc).catch(() => {});
  }, [qr, url]);

  // старт камеры при фазе съёмки
  useEffect(() => {
    if (!shot || shot.phase !== "capture") return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { width: 640 } }).then((s) => {
      stream = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
      // авто-захват через 1.2 с
      setTimeout(() => {
        const v = videoRef.current, c = canvasRef.current;
        if (v && c && v.videoWidth) {
          c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext("2d")!.drawImage(v, 0, 0);
          const src = c.toDataURL("image/jpeg", db.settings.camQuality || 0.7);
          finishShot(src);
        } else {
          finishShot(null);
        }
      }, 1200);
    }).catch(() => finishShot(null));
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.phase]);

  const finishShot = (src: string | null) => {
    setShot((s) => (s ? { ...s, src, phase: "show" } : s));
  };
  const closeShot = () => {
    if (shot?.src) addCamShot(shot.punchId, shot.userId, shot.src, shot.dir);
    setShot(null);
  };
  useEffect(() => {
    if (shot?.phase === "show") { const t = setTimeout(closeShot, 3000); return () => clearTimeout(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.phase]);

  const doPunch = (userId: string) => {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    const wasOpen = !!openPunchOf(db, userId);
    const r = kioskPunch(userId);
    if (!r) return;
    const off = !db.schedule.some((s) => s.userId === userId && s.date === todayKey() && (s.type === "day" || s.type === "night"));
    setFlash({ name: u.name, dir: r.dir, time: fmtMin(nowMin()) });
    setTimeout(() => setFlash(null), 1900);
    const needCam = db.settings.camOn && (r.dir === "in" || db.settings.camOnOut);
    if (needCam) setShot({ userId, punchId: r.punchId, dir: r.dir, src: null, phase: "capture", off: off && r.dir === "in" });
  };
  const tap = (userId: string) => {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    if (!free && u.password) { setPinFor(userId); setPin(""); setPinErr(""); return; }
    doPunch(userId);
  };
  const submitPin = () => {
    if (pinFor === "exit") {
      if (pin === db.settings.adminPin) onExit();
      else setPinErr("Неверный PIN");
    } else if (pinFor === "theme") {
      if (pin === db.settings.adminPin && themePick) { setSettings({ kioskTheme: themePick }); setPinFor(null); }
      else setPinErr("Неверный PIN");
    } else {
      const u = db.users.find((x) => x.id === pinFor);
      if (u && pin === u.password) { doPunch(u.id); setPinFor(null); }
      else setPinErr("Неверный пароль");
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: theme.bg, color: theme.text }}>
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b shrink-0" style={{ borderColor: theme.border }}>
        <Logo size={36} />
        <div className="min-w-0">
          <div className="font-display font-bold text-sm leading-none">СМЕНА<span style={{ color: theme.accent }}>ЛАН</span> · ТЕРМИНАЛ</div>
          <div className="text-[10px] font-bold uppercase tracking-widest mt-1 truncate" style={{ color: theme.mute }}>тема «{theme.name}»{db.settings.camOn ? " · камера вкл" : ""}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <OnlineDot />
          <button className="btn btn-sm !h-8 px-2.5 font-bold rounded-lg border transition active:scale-95" style={{ borderColor: theme.border, background: theme.card, color: theme.text }} onClick={() => setQr(true)}>
            <I n="qr" size={14} /><span className="hidden sm:inline">Телефон</span>
          </button>
          <button className="btn btn-sm !h-8 px-2.5 font-bold rounded-lg border transition active:scale-95" style={{ borderColor: theme.border, background: theme.card, color: theme.text }} onClick={() => { setPinFor("exit"); setPin(""); setPinErr(""); }}>
            <I n="lock" size={13} /><span className="hidden sm:inline">Выход</span>
          </button>
        </div>
      </div>

      <div className="text-center py-4 sm:py-6 shrink-0">
        <div className="font-mono tnum font-semibold text-5xl sm:text-7xl tracking-tight leading-none">{fmtClock(now)}</div>
        <div className="font-bold mt-2 capitalize text-sm sm:text-base" style={{ color: theme.mute }}>{WD_FULL[(now.getDay() + 6) % 7]}, {now.getDate()} {MONTHS[now.getMonth()]}</div>
      </div>

      <div className="flex-1 overflow-y-auto dark-scroll px-4 sm:px-5 pb-3">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {emps.map((u) => {
            const open = openPunchOf(db, u.id);
            const off = open?.auto === "unscheduled";
            return (
              <button key={u.id} onClick={() => tap(u.id)}
                className="relative rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-150 active:scale-[0.97] cursor-pointer hover:-translate-y-0.5"
                style={{ background: theme.card, borderColor: open ? theme.chipOn : theme.border }}>
                <div className="flex items-center gap-2.5">
                  <Avatar u={u} size={42} />
                  <div className="min-w-0">
                    <div className="font-extrabold text-[13px] sm:text-sm leading-tight truncate">{u.name}</div>
                    <div className="text-[10.5px] font-bold truncate mt-0.5" style={{ color: theme.mute }}>{wsName(db, u.workshopId)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-1">
                  {open ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-extrabold uppercase text-white" style={{ background: theme.chipOn }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white pulse-ok" />на смене
                      </span>
                      {off && <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase" style={{ background: "#a97a12", color: "#fff" }}>вне графика</span>}
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold uppercase" style={{ background: theme.bg, color: theme.mute, border: `1px solid ${theme.border}` }}>не на смене</span>
                  )}
                  <I n={open ? "out" : "in"} size={16} />
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-center text-[11px] font-bold mt-4" style={{ color: theme.mute }}>
          {free ? "Коснитесь карточки — отметка ставится сразу" : "Отметка после личного пароля"} · длительность смены видна только сотруднику и руководству
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 py-2.5 border-t shrink-0" style={{ borderColor: theme.border }}>
        <span className="text-[10px] font-extrabold uppercase tracking-widest mr-1" style={{ color: theme.mute }}>Оформление:</span>
        {(Object.keys(THEMES) as KioskTheme[]).map((k) => (
          <button key={k} title={THEMES[k].name} onClick={() => { setThemePick(k); setPinFor("theme"); setPin(""); setPinErr(""); }}
            className={`w-6 h-6 rounded-full border-2 transition active:scale-90 ${(db.settings.kioskTheme || "steel") === k ? "scale-110" : ""}`}
            style={{ background: THEMES[k].bg, borderColor: THEMES[k].accent, boxShadow: (db.settings.kioskTheme || "steel") === k ? `0 0 0 2px ${THEMES[k].accent}` : undefined }} />
        ))}
      </div>

      {/* вспышка отметки */}
      {flash && !shot && (
        <div className="fixed inset-0 z-[80] grid place-items-center pointer-events-none p-4">
          <div className="absolute inset-0 anim-flash" style={{ background: flash.dir === "in" ? `${theme.chipOn}44` : `${theme.bg}d9` }} />
          <div className="relative anim-pop rounded-3xl px-8 sm:px-12 py-8 text-center border-2" style={{ background: "#fff", color: "#171b22", borderColor: theme.accent }}>
            <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center" style={{ background: flash.dir === "in" ? "#e2f2ea" : "#fbeadb", color: flash.dir === "in" ? "#17875c" : "#c85b15" }}>
              <I n={flash.dir === "in" ? "in" : "out"} size={26} />
            </div>
            <div className="font-display text-xl font-bold mt-3">{flash.name}</div>
            <div className="text-mute font-bold text-sm mt-1">{flash.dir === "in" ? "Начало смены" : "Конец смены"} · {flash.time}</div>
          </div>
        </div>
      )}

      {/* веб-камера */}
      {shot && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4" style={{ background: "rgba(10,12,16,0.85)" }}>
          <div className="relative anim-pop rounded-3xl overflow-hidden border-4 max-w-xl w-full" style={{ borderColor: theme.accent, background: "#0e1116" }}>
            {shot.phase === "capture" ? (
              <div className="relative">
                <video ref={videoRef} playsInline muted className="w-full" style={{ transform: db.settings.camMirror ? "scaleX(-1)" : undefined }} />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="w-40 h-40 rounded-full border-4 border-dashed border-white/70 animate-pulse" />
                </div>
                <div className="absolute bottom-3 inset-x-0 text-center text-white font-display text-sm font-bold drop-shadow">Смотрим в камеру…</div>
              </div>
            ) : (
              <div className="relative">
                {db.settings.camFlash && <div className="absolute inset-0 bg-white anim-flash pointer-events-none z-10" />}
                {shot.src ? <img src={shot.src} alt="" className="w-full" /> : <div className="h-64 grid place-items-center text-white font-bold">Камера недоступна — отметка сохранена без снимка</div>}
                <div className="absolute bottom-0 inset-x-0 p-4 text-white" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
                  <b className="font-display text-lg block">{db.users.find((u) => u.id === shot.userId)?.name}</b>
                  <span className="text-[12px] font-bold opacity-80">{shot.dir === "in" ? "Приход" : "Уход"} · {fmtMin(nowMin())} · снимок в архиве (120 дней)</span>
                  {shot.off && <span className="block text-[12px] font-extrabold text-warn mt-0.5">⚠ Вне графика — укажите «работаю до» в приложении</span>}
                </div>
              </div>
            )}
          </div>
          <p className="absolute bottom-6 text-white/70 font-bold text-[12px]">Снимок показывается 3 секунды и уходит в архив — управление сверит, тот ли человек отметился</p>
        </div>
      )}

      <Modal open={!!pinFor} onClose={() => setPinFor(null)} w="max-w-sm"
        title={pinFor === "exit" ? "Служебный выход" : pinFor === "theme" ? `Тема «${themePick ? THEMES[themePick].name : ""}» — PIN` : "Подтвердите отметку"}
        foot={<>
          <button className="btn btn-ghost" onClick={() => setPinFor(null)}>Отмена</button>
          <button className="btn btn-pri" onClick={submitPin}>{pinFor === "exit" ? "Выйти" : pinFor === "theme" ? "Применить" : "Отметиться"}</button>
        </>}>
        <input autoFocus type="password" inputMode="numeric" className="input text-center font-mono tracking-[0.3em]"
          placeholder={pinFor === "exit" || pinFor === "theme" ? "PIN администратора" : "Ваш пароль"}
          value={pin} onChange={(e) => { setPin(e.target.value); setPinErr(""); }} onKeyDown={(e) => e.key === "Enter" && submitPin()} />
        {pinErr && <div className="mt-2 text-xs font-bold text-bad flex items-center gap-1.5"><I n="warn" size={13} />{pinErr}</div>}
      </Modal>

      <Modal open={qr} onClose={() => setQr(false)} title="Подключение телефона к серверу" w="max-w-sm">
        <div className="text-center grid gap-3">
          {qrSrc ? <img src={qrSrc} alt="QR" className="mx-auto w-60 h-60 rounded-xl border border-line" /> : <div className="h-60 grid place-items-center text-mute font-bold">Формируем…</div>}
          <p className="text-[12.5px] text-mute font-bold leading-relaxed">Сканируйте камерой — откроется приложение, подключённое к этому серверу.</p>
          <div className="rounded-lg bg-paper border border-line px-3 py-2 font-mono text-[12px] font-bold break-all">{url}</div>
        </div>
      </Modal>
    </div>
  );
}
