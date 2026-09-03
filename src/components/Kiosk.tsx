import React, { useEffect, useMemo, useState } from "react";
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

export default function Kiosk({ onExit }: { onExit: () => void }) {
  const { db, kioskPunch, setSettings } = useStore();
  const now = useNow();
  const [flash, setFlash] = useState<{ name: string; dir: "in" | "out"; time: string; off: boolean } | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null); // userId | 'exit' | 'theme'
  const [themePick, setThemePick] = useState<KioskTheme | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [qr, setQr] = useState(false);
  const [qrSrc, setQrSrc] = useState("");

  const theme = THEMES[db.settings.kioskTheme || "steel"] || THEMES.steel;
  const emps = db.users.filter((u) => u.active && !u.archived);
  const free = db.settings.kioskFree;
  const url = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";

  useEffect(() => {
    if (qr && url) QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#14181f", light: "#ffffff" } }).then(setQrSrc).catch(() => {});
  }, [qr, url]);

  const doPunch = (userId: string) => {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    const wasOpen = !!openPunchOf(db, userId);
    kioskPunch(userId);
    setFlash({ name: u.name, dir: wasOpen ? "out" : "in", time: fmtMin(nowMin()), off: !wasOpen && !db.schedule.some((s) => s.userId === userId && s.date === todayKey() && (s.type === "day" || s.type === "night")) });
    setTimeout(() => setFlash(null), 1900);
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
      else setPinErr("Неверный PIN администратора");
    } else if (pinFor === "theme") {
      if (pin === db.settings.adminPin && themePick) { setSettings({ kioskTheme: themePick }); setPinFor(null); }
      else setPinErr("Неверный PIN администратора");
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
          <div className="text-[10px] font-bold uppercase tracking-widest mt-1 truncate" style={{ color: theme.mute }}>отметки у входа · тема «{theme.name}»</div>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <OnlineDot />
          <button className="btn btn-sm !h-8 px-2.5 font-bold rounded-lg border transition active:scale-95" style={{ borderColor: theme.border, background: theme.card, color: theme.text }} onClick={() => setQr(true)}>
            <I n="qr" size={14} /><span className="hidden sm:inline">Подключить телефон</span>
          </button>
          <button className="btn btn-sm !h-8 px-2.5 font-bold rounded-lg border transition active:scale-95" style={{ borderColor: theme.border, background: theme.card, color: theme.text }} onClick={() => { setPinFor("exit"); setPin(""); setPinErr(""); }}>
            <I n="lock" size={13} /><span className="hidden sm:inline">Служебный выход</span>
          </button>
        </div>
      </div>

      <div className="text-center py-4 sm:py-6 shrink-0">
        <div className="font-mono tnum font-semibold text-5xl sm:text-7xl tracking-tight leading-none">{fmtClock(now)}</div>
        <div className="font-bold mt-2 capitalize text-sm sm:text-base" style={{ color: theme.mute }}>{WD_FULL[(now.getDay() + 6) % 7]}, {now.getDate()} {MONTHS[now.getMonth()]}</div>
      </div>

      <div className="flex-1 overflow-y-auto dark-scroll px-4 sm:px-5 pb-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {emps.map((u) => {
            const open = openPunchOf(db, u.id);
            const off = open?.auto === "unscheduled";
            return (
              <button key={u.id} onClick={() => tap(u.id)}
                className="relative rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-150 active:scale-[0.97] cursor-pointer hover:-translate-y-0.5"
                style={{ background: theme.card, borderColor: open ? theme.chipOn : theme.border, boxShadow: open ? `0 0 0 1px ${theme.chipOn}` : undefined }}>
                <div className="flex items-center gap-2.5 sm:gap-3">
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
                      {off && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase" style={{ background: "#a97a12", color: "#fff" }}>вне графика</span>}
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold uppercase" style={{ background: theme.bg, color: theme.mute, border: `1px solid ${theme.border}` }}>не на смене</span>
                  )}
                  <I n={open ? "out" : "in"} size={16} className={open ? "" : ""} />
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-center text-[11px] font-bold mt-4" style={{ color: theme.mute }}>
          {free ? "Нажмите на карточку — отметка ставится сразу" : "Отметка после ввода личного пароля"} · длительность смены видна только сотруднику и руководству
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

      {flash && (
        <div className="fixed inset-0 z-[80] grid place-items-center pointer-events-none p-4">
          <div className="absolute inset-0 anim-flash" style={{ background: flash.dir === "in" ? `${theme.chipOn}44` : `${theme.bg}d9` }} />
          <div className="relative anim-pop rounded-3xl px-8 sm:px-12 py-8 text-center border-2" style={{ background: "#ffffff", color: "#171b22", borderColor: flash.off ? "#a97a12" : theme.accent }}>
            <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center" style={{ background: flash.dir === "in" ? "#e2f2ea" : "#fbeadb", color: flash.dir === "in" ? "#17875c" : "#c85b15" }}>
              <I n={flash.dir === "in" ? "in" : "out"} size={26} />
            </div>
            <div className="font-display text-xl font-bold mt-3">{flash.name}</div>
            <div className="text-mute font-bold text-sm mt-1">{flash.dir === "in" ? "Начало смены" : "Конец смены"} · {flash.time}</div>
            {flash.off && <div className="mt-2 text-[12px] font-extrabold text-warn">Вы вышли вне графика — укажите время «работаю до» в приложении</div>}
          </div>
        </div>
      )}

      <Modal open={!!pinFor} onClose={() => setPinFor(null)} w="max-w-sm"
        title={pinFor === "exit" ? "Служебный выход" : pinFor === "theme" ? `Тема «${themePick ? THEMES[themePick].name : ""}» (PIN)` : "Подтвердите отметку"}
        foot={<>
          <button className="btn btn-ghost" onClick={() => setPinFor(null)}>Отмена</button>
          <button className="btn btn-pri" onClick={submitPin}>{pinFor === "exit" ? "Выйти" : pinFor === "theme" ? "Применить" : "Отметиться"}</button>
        </>}>
        <input autoFocus type="password" inputMode="numeric" className="input text-center font-mono tracking-[0.3em]"
          placeholder={pinFor === "exit" || pinFor === "theme" ? "PIN администратора" : "Ваш пароль"}
          value={pin} onChange={(e) => { setPin(e.target.value); setPinErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && submitPin()} />
        {pinErr && <div className="mt-2 text-xs font-bold text-bad flex items-center gap-1.5"><I n="warn" size={13} />{pinErr}</div>}
      </Modal>

      <Modal open={qr} onClose={() => setQr(false)} title="Подключение телефона к серверу" w="max-w-sm">
        <div className="text-center grid gap-3">
          {qrSrc ? <img src={qrSrc} alt="QR" className="mx-auto w-60 h-60 rounded-xl border border-line" /> : <div className="h-60 grid place-items-center text-mute font-bold">Формируем QR…</div>}
          <p className="text-[12.5px] text-mute font-bold leading-relaxed">Отсканируйте камерой телефона — откроется приложение, подключённое к этому серверу. Добавьте на главный экран как PWA.</p>
          <div className="rounded-lg bg-paper border border-line px-3 py-2 font-mono text-[12px] font-bold break-all">{url}</div>
        </div>
      </Modal>
    </div>
  );
}
