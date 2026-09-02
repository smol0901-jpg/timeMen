import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { User, Role } from "../lib/types";
import { ROLE_LABEL } from "../lib/types";
import { fileSize } from "../lib/time";

// ---------- иконки ----------
const P: Record<string, React.ReactNode> = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  chart: <><path d="M3 21h18" /><path d="M6 17v-6M11 17V7M16 17v-9" /></>,
  doc: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></>,
  feed: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 14.7c2.6.6 4.5 2.4 4.5 5.3" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  pdf: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 13h6M9 16h4" /></>,
  xls: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9.5 12l5 5M14.5 12l-5 5" /></>,
  shield: <><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  history: <><path d="M4 5v4h4" /><path d="M4.5 9a8 8 0 11-1 4" /><path d="M12 8v4l3 2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>,
  bell: <><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 004 0" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  brain: <><path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V6a2 2 0 00-3-2z" /><path d="M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0V6a2 2 0 013-2z" /></>,
  game: <><rect x="3" y="7" width="18" height="11" rx="5" /><path d="M8 11v3M6.5 12.5h3M15 11.5h.01M17.5 13.5h.01" /></>,
  box: <><path d="M3 8l9-4 9 4v9l-9 4-9-4z" /><path d="M3 8l9 4 9-4M12 12v9" /></>,
  factory: <><path d="M3 21V10l6 3v-3l6 3V4h6v17z" /><path d="M7 17h2M12 17h2M17 17h2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.8.6-1.5 1.1-1.5 2.2" /><path d="M12 17h.01" /></>,
  wifi: <><path d="M3 9.5a13 13 0 0118 0M6.5 13a8 8 0 0111 0M10 16.5a3.5 3.5 0 014 0" /><path d="M12 20h.01" /></>,
  desk: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  in: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 19h16" /></>,
  out: <><path d="M12 15V3" /><path d="M8 7l4-4 4 4" /><path d="M4 19h16" /></>,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  x: <path d="M5 5l14 14M19 5L5 19" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>,
  edit: <><path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19z" /><path d="M14.5 6.5l3 3" /></>,
  send: <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>,
  pin: <><path d="M9 4h6l-1 6 3 3H7l3-3z" /><path d="M12 13v7" /></>,
  comment: <><path d="M21 12a8 8 0 01-11.6 7.2L4 21l1.8-5.4A8 8 0 1121 12z" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></>,
  play: <path d="M7 4l13 8-13 8z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5v.01M15.5 15.5h.01" /></>,
  download: <><path d="M12 3v11" /><path d="M8 10l4 4 4-4" /><path d="M4 19h16" /></>,
  upload: <><path d="M12 14V3" /><path d="M8 7l4-4 4 4" /><path d="M4 19h16" /></>,
  link: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.5 1.5" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5" /></>,
  star: <path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z" />,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.5 9.8c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 1.8c0 2.7-5 1.7-5 4.4 0 1 1.1 1.8 2.5 1.8s2.5-.8 2.5-1.8" /></>,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  flame: <path d="M12 3s6 4.5 6 10a6 6 0 01-12 0c0-2 .8-3.7 1.8-5C8.5 10 10 10.5 10 8c0-2 2-5 2-5z" />,
  warn: <><path d="M12 4L2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>,
  key: <><circle cx="8" cy="14" r="4.5" /><path d="M11.5 11L20 3M17 6l2.5 2.5M14.5 8.5l2 2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8" /></>,
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  swap: <><path d="M7 8h13l-3.5-3.5" /><path d="M17 16H4l3.5 3.5" /></>,
  zap: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5M3 17.5l9 5 9-5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  bot: <><rect x="5" y="8" width="14" height="11" rx="2" /><path d="M12 8V4M8 4h8" /><path d="M9 13h.01M15 13h.01M9.5 16.5h5" /></>,
  money: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6.5 9.5h.01M17.5 14.5h.01" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" /></>,
  file: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /></>,
  logout: <><path d="M14 4H6v16h8" /><path d="M10 12h11M17 8l4 4-4 4" /></>,
  chevL: <path d="M14 6l-6 6 6 6" />,
  chevR: <path d="M10 6l6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.5-4.5" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M20 20h.01M17 17h3v3" /></>,
  snake: <><path d="M4 17c0-3 4-3 4-6s-4-3-4-6" /><path d="M20 7c0 3-4 3-4 6s4 3 4 6" /><circle cx="4" cy="5" r="1" /><circle cx="20" cy="19" r="1" /></>,
};

export function I({ n, size = 18, className = "" }: { n: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {P[n] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export function Logo({ size = 40, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg width={size} height={size} viewBox="0 0 512 512">
        <rect width="512" height="512" rx="116" fill={dark ? "#edf0f3" : "#14181f"} />
        <g fill="none" stroke="#e56f24" strokeWidth="42" strokeLinecap="round"><path d="M256 108a148 148 0 1 1-139 97" /></g>
        <path d="M96 148l14 82 80-30z" fill="#e56f24" />
        <g stroke={dark ? "#14181f" : "#edf0f3"} strokeWidth="28" strokeLinecap="round"><path d="M256 256V168" /><path d="M256 256l60 38" /></g>
        <circle cx="256" cy="256" r="13" fill="#e56f24" />
      </svg>
    </span>
  );
}

// ---------- аватар ----------
export function Avatar({ u, size = 36 }: { u: User | undefined | null; size?: number }) {
  const init = (u?.name || "??").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return u?.avatar ? (
    <img src={u.avatar} alt="" style={{ width: size, height: size }} className="rounded-full object-cover ring-2 ring-line shrink-0" />
  ) : (
    <span style={{ width: size, height: size, background: u?.color || "#55637a", fontSize: size * 0.36 }}
      className="rounded-full grid place-items-center text-white font-extrabold shrink-0 ring-2 ring-white/40">
      {init}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const cls = role === "superadmin" ? "bg-ink text-paper" : role === "admin" ? "bg-accent-soft text-accent-deep" : "bg-paper text-mute";
  return <span className={`badge ${cls}`}>{ROLE_LABEL[role]}</span>;
}

// ---------- модальные ----------
export function Modal({ open, onClose, title, children, foot, w = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode; w?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: "rgba(14,17,22,0.55)", backdropFilter: "blur(3px)" }}>
      <div className={`card w-full ${w} anim-pop max-h-[92vh] flex flex-col`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line shrink-0">
          <h3 className="font-display text-sm font-semibold flex-1 truncate">{title}</h3>
          <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-paper transition" onClick={onClose}><I n="x" size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {foot && <div className="px-5 py-3.5 border-t border-line flex justify-end gap-2 shrink-0 bg-paper/40">{foot}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, title, text, onYes, danger = true, yesLabel = "Удалить" }: {
  open: boolean; onClose: () => void; title: string; text: React.ReactNode; onYes: () => void; danger?: boolean; yesLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} w="max-w-sm"
      foot={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className={`btn ${danger ? "btn-bad" : "btn-pri"}`} onClick={() => { onYes(); onClose(); }}>{yesLabel}</button>
      </>}>
      <p className="text-sm text-mute leading-relaxed">{text}</p>
    </Modal>
  );
}

// ---------- тосты ----------
type Tone = "ok" | "bad" | "info";
const ToastCtx = createContext<{ toast: (t: string, tone?: Tone) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; t: string; tone: Tone }[]>([]);
  const idRef = useRef(1);
  const toast = (t: string, tone: Tone = "info") => {
    const id = idRef.current++;
    setItems((x) => [...x.slice(-4), { id, t, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[90] grid gap-2 w-[min(360px,90vw)] pointer-events-none">
        {items.map((i) => (
          <div key={i.id} className={`anim-toast pointer-events-auto card !rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm font-bold shadow-lg border-l-4
            ${i.tone === "ok" ? "!border-l-ok" : i.tone === "bad" ? "!border-l-bad" : "!border-l-night"}`}>
            <span className={i.tone === "ok" ? "text-ok" : i.tone === "bad" ? "text-bad" : "text-night"}>
              <I n={i.tone === "ok" ? "check" : i.tone === "bad" ? "warn" : "info"} size={17} />
            </span>
            <span className="leading-snug">{i.t}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- разное ----------
export function useNow(ms = 1000): Date {
  const [n, setN] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setN(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export function OnlineDot() {
  const { online, serverVer } = useStore();
  return (
    <span title={online ? `LAN-сервер онлайн · версия базы ${serverVer} · реальное время` : "LAN-сервер недоступен — локальный режим"}
      className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-mute">
      <span className={`w-2 h-2 rounded-full ${online ? "bg-ok pulse-ok" : "bg-warn blink"}`} />
      <span className="hidden sm:inline">{online ? `Сервер · синхронно (v${serverVer})` : "Локальный режим"}</span>
    </span>
  );
}

export function Seg<T extends string>({ opts, val, onChange, small }: {
  opts: { v: T; label: string; icon?: string }[]; val: T; onChange: (v: T) => void; small?: boolean;
}) {
  return (
    <div className="inline-flex bg-paper border border-line rounded-lg p-0.5 gap-0.5 flex-wrap">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`inline-flex items-center gap-1.5 rounded-md font-bold transition-all ${small ? "px-2 h-7 text-[11px]" : "px-3 h-8 text-xs"}
          ${val === o.v ? "bg-steel-900 text-paper shadow" : "text-mute hover:text-ink"}`}>
          {o.icon && <I n={o.icon} size={small ? 12 : 14} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function WeekBars({ data, h = 110 }: { data: { label: string; plan: number; fact: number }[]; h?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.plan, d.fact)));
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height: h }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end">
          <div className="w-full flex items-end justify-center gap-1 flex-1">
            <div className="w-2.5 sm:w-3.5 rounded-t bg-line transition-all" style={{ height: `${(d.plan / max) * 100}%` }} title="план" />
            <div className={`w-2.5 sm:w-3.5 rounded-t transition-all ${d.fact >= d.plan ? "bg-ok" : d.fact > 0 ? "bg-accent" : "bg-bad/50"}`}
              style={{ height: `${Math.max(2, (d.fact / max) * 100)}%` }} title="факт" />
          </div>
          <span className="text-[10px] font-extrabold text-mute truncate">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="lbl">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-mute font-semibold mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`w-11 h-7 rounded-full transition-colors relative shrink-0 ${checked ? "bg-ok" : "bg-steel-200"}`}>
        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span className="text-sm font-bold">{label}{sub && <span className="block text-[11px] text-mute font-semibold">{sub}</span>}</span>
    </label>
  );
}

export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; icon?: string; count?: number }[]; active: string; onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto dark-scroll border-b border-line -mb-px">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-1.5 px-3.5 h-10 text-[13px] font-extrabold whitespace-nowrap border-b-2 -mb-px transition-all
          ${active === t.id ? "border-accent text-ink" : "border-transparent text-mute hover:text-ink"}`}>
          {t.icon && <I n={t.icon} size={15} />}{t.label}
          {t.count !== undefined && t.count > 0 && <span className="badge bg-accent text-white !px-1.5">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-paper border border-line grid place-items-center text-mute"><I n={icon} size={26} /></div>
      <div className="font-display text-sm font-semibold mt-4">{title}</div>
      {text && <p className="text-[13px] text-mute font-semibold mt-1.5 max-w-sm mx-auto leading-relaxed">{text}</p>}
    </div>
  );
}

export function Progress({ val, tone = "accent" }: { val: number; tone?: "accent" | "ok" | "bad" | "night" }) {
  const v = Math.max(0, Math.min(1, val));
  const c = tone === "ok" ? "bg-ok" : tone === "bad" ? "bg-bad" : tone === "night" ? "bg-night" : "bg-accent";
  return (
    <div className="h-1.5 rounded-full bg-line overflow-hidden">
      <div className={`h-full ${c} rounded-full transition-all duration-500`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function StatTile({ icon, tone, label, val, sub }: { icon: string; tone: string; label: string; val: string; sub?: string }) {
  const tones: Record<string, string> = {
    accent: "bg-accent-soft text-accent-deep", ok: "bg-ok-soft text-ok", bad: "bg-bad-soft text-bad",
    warn: "bg-warn-soft text-warn", night: "bg-night-soft text-night", ink: "bg-paper text-ink",
  };
  return (
    <div className="card p-3.5 flex items-start gap-3 hover:-translate-y-0.5 transition-transform">
      <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${tones[tone] || tones.accent}`}><I n={icon} size={17} /></span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-mute truncate">{label}</div>
        <div className="font-display text-[17px] font-bold tnum leading-tight mt-0.5 truncate">{val}</div>
        {sub && <div className="text-[11px] text-mute font-bold truncate mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); toast("Скопировано в буфер", "ok"); }}>
      <I n="copy" size={13} />{label || "Копировать"}
    </button>
  );
}

export { fileSize };
export { shrinkImage } from "../lib/store";
