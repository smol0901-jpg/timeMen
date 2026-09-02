import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User } from "../lib/types";
import { fmtDurH } from "../lib/time";

// ---------- иконки ----------
const PATHS: Record<string, React.ReactNode> = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>,
  timer: <><path d="M10 2h4" /><circle cx="12" cy="14" r="8" /><path d="M12 14l3-3" /></>,
  chart: <><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="7" /><rect x="12" y="7" width="3" height="11" /><rect x="17" y="13" width="3" height="5" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  doc: <><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></>,
  feed: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h6M7 13h10M7 17h7" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.2-3.8 4.2-6 8-6s6.8 2.2 8 6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.2 3.5-5 6.5-5s5.5 1.8 6.5 5" /><path d="M15.5 4.6a3.5 3.5 0 010 6.8M17.5 15.4c2 .7 3.4 2.2 4 4.6" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="1" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" /></>,
  pdf: <><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v5h5" /><path d="M9 17v-4l1.8 2.4L12.6 13v4" /></>,
  xls: <><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v5h5" /><path d="M9 13l4 5M13 13l-4 5" /></>,
  json: <><path d="M8 3c-2 0-2.5 1.2-2.5 3s.5 3-2.5 3v6c3 0 2.5 1.2 2.5 3s.5 3 2.5 3" /><path d="M16 3c2 0 2.5 1.2 2.5 3s-.5 3 2.5 3v6c-3 0-2.5 1.2-2.5 3s-.5 3-2.5 3" /></>,
  shield: <><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></>,
  history: <><path d="M3 12a9 9 0 109-9 9.2 9.2 0 00-6.8 3L3 8" /><path d="M3 3v5h5M12 7v5l3.5 2" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.6 1.6 0 00-1.82-.33 1.6 1.6 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.6 1.6 0 00-1-1.51 1.6 1.6 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.6 1.6 0 00.33-1.82 1.6 1.6 0 00-1.51-1H3a2 2 0 110-4h.09a1.6 1.6 0 001.51-1 1.6 1.6 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.6 1.6 0 001.82.33h.08a1.6 1.6 0 001-1.51V3a2 2 0 114 0v.09a1.6 1.6 0 001 1.51 1.6 1.6 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.6 1.6 0 00-.33 1.82v.08a1.6 1.6 0 001.51 1H21a2 2 0 110 4h-.09a1.6 1.6 0 00-1.51 1z" /></>,
  bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  check: <path d="M20 6L9 17l-5-5" />,
  trash: <><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>,
  edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" /></>,
  dl: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></>,
  ul: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 8l5-5 5 5M12 3v12" /></>,
  camera: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  warn: <><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  like: <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />,
  comment: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  pin: <><path d="M12 17v5" /><path d="M9 3h6l1 7 2.5 2.5h-13L8 10z" /></>,
  left: <path d="M15 18l-6-6 6-6" />,
  right: <path d="M9 18l6-6-6-6" />,
  dots: <><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  desk: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
  refresh: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" /></>,
  wifi: <><path d="M5 12.5a10 10 0 0114 0M8.5 15.5a5.5 5.5 0 017 0M2 9a15 15 0 0120 0" /><path d="M12 19h.01" /></>,
  in: <><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><path d="M10 17l5-5-5-5M15 12H3" /></>,
  out: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  swap: <><path d="M17 3l4 4-4 4M21 7H8" /><path d="M7 21l-4-4 4-4M3 17h13" /></>,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  star: <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="M11 12L21 2M17 6l3 3M14 9l2 2" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></>,
  money: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></>,
};

export function I({ n, size = 18, sw = 2 }: { n: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {PATHS[n] || <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

// ---------- аватар ----------
export function Avatar({ u, size = 36, ring }: { u: User | null | undefined; size?: number; ring?: boolean }) {
  const initials = (u?.name || "??").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 grid place-items-center font-extrabold text-white ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, background: u?.avatar ? undefined : `linear-gradient(135deg, ${u?.color || "#5d6a80"}, #1b212b)`, fontSize: size * 0.36 }}
    >
      {u?.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : initials}
      {u && !u.active && <div className="absolute inset-0 bg-steel-950/60 grid place-items-center"><I n="x" size={size * 0.4} /></div>}
    </div>
  );
}

export function RoleBadge({ role }: { role: User["role"] }) {
  const map = {
    superadmin: "bg-accent-soft text-accent-deep",
    admin: "bg-night-soft text-night",
    employee: "bg-paper text-mute",
  } as const;
  const label = { superadmin: "Суперадмин", admin: "Админ", employee: "Сотрудник" }[role];
  return <span className={`badge ${map[role]}`}>{label}</span>;
}

// ---------- модальные окна ----------
export function Modal({ open, onClose, title, children, w = "max-w-lg", foot }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; w?: string; foot?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-steel-950/65 backdrop-blur-[2px]" />
      <div
        className={`relative anim-pop w-full ${w} bg-surface rounded-t-2xl sm:rounded-2xl border border-line shadow-2xl max-h-[92vh] flex flex-col`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h3 className="font-display text-[15px] font-semibold">{title}</h3>
          <button className="w-8 h-8 grid place-items-center rounded-lg hover:bg-paper text-mute transition" onClick={onClose}><I n="x" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {foot && <div className="px-5 py-4 border-t border-line flex justify-end gap-2 shrink-0 bg-paper/40 rounded-b-2xl">{foot}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onYes, title, text, yes = "Удалить", danger = true }: {
  open: boolean; onClose: () => void; onYes: () => void; title: string; text: React.ReactNode; yes?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} w="max-w-md"
      foot={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className={`btn ${danger ? "btn-bad" : "btn-pri"}`} onClick={() => { onYes(); onClose(); }}>{yes}</button>
      </>}>
      <div className="flex gap-3 items-start text-sm text-mute leading-relaxed">
        <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${danger ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}><I n="warn" /></div>
        <div>{text}</div>
      </div>
    </Modal>
  );
}

// ---------- тосты ----------
type ToastKind = "ok" | "bad" | "info";
const ToastCtx = createContext<{ toast: (text: string, kind?: ToastKind) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; text: string; kind: ToastKind }[]>([]);
  const idRef = useRef(1);
  const toast = (text: string, kind: ToastKind = "info") => {
    const id = idRef.current++;
    setItems((p) => [...p.slice(-3), { id, text, kind }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3600);
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed z-[90] bottom-24 lg:bottom-6 right-3 sm:right-6 flex flex-col gap-2 items-end pointer-events-none">
        {items.map((t) => (
          <div key={t.id}
            className={`anim-toast pointer-events-auto flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl shadow-xl border text-sm font-semibold max-w-[92vw]
              ${t.kind === "ok" ? "bg-steel-900 text-paper border-steel-700" : t.kind === "bad" ? "bg-bad text-white border-bad" : "bg-surface text-ink border-line"}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${t.kind === "ok" ? "bg-ok pulse-ok" : t.kind === "bad" ? "bg-white" : "bg-accent"}`} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- прочее ----------
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="lbl">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-mute mt-1">{hint}</span>}
    </label>
  );
}

export function Seg<T extends string>({ opts, val, onChange }: { opts: { v: T; l: string }[]; val: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex bg-steel-900/6 border border-line rounded-lg p-0.5 gap-0.5">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-3 h-8 rounded-md text-xs font-extrabold transition-all ${val === o.v ? "bg-steel-900 text-paper shadow" : "text-mute hover:text-ink"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon = "info", text }: { icon?: string; text: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-3 text-mute">
      <div className="w-12 h-12 rounded-xl bg-paper border border-line grid place-items-center"><I n={icon} size={22} /></div>
      <p className="text-sm font-semibold text-center max-w-[260px]">{text}</p>
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone = "ink" }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: string; tone?: "ink" | "ok" | "bad" | "accent" | "night" | "warn";
}) {
  const tones: Record<string, string> = {
    ink: "bg-steel-900 text-paper", ok: "bg-ok-soft text-ok", bad: "bg-bad-soft text-bad",
    accent: "bg-accent-soft text-accent-deep", night: "bg-night-soft text-night", warn: "bg-warn-soft text-warn",
  };
  return (
    <div className="card p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${tones[tone]}`}><I n={icon} size={19} /></div>
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-mute">{label}</div>
        <div className="font-display text-lg font-semibold leading-tight tnum truncate">{value}</div>
        {sub && <div className="text-xs text-mute mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

/** Двойные бары: a = план (сталь), b = факт (оранжевый). Значения в минутах. */
export function Bars({ data }: { data: { label: string; a: number; b: number }[] }) {
  const max = Math.max(60, ...data.map((d) => Math.max(d.a, d.b)));
  return (
    <div>
      <div className="flex items-end gap-1.5 sm:gap-2 h-36">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
            <div className="text-[10px] font-bold text-mute opacity-0 group-hover:opacity-100 transition tnum whitespace-nowrap">
              {d.b > 0 ? fmtDurH(d.b) : "—"}
            </div>
            <div className="w-full flex items-end justify-center gap-[3px] h-24">
              <div className="w-2.5 sm:w-3.5 rounded-t-sm bg-steel-200 group-hover:bg-steel-400 transition-all duration-500"
                style={{ height: `${Math.max(3, (d.a / max) * 100)}%` }} title={`План: ${fmtDurH(d.a)}`} />
              <div className="w-2.5 sm:w-3.5 rounded-t-sm bg-accent transition-all duration-500"
                style={{ height: `${Math.max(d.b > 0 ? 6 : 3, (d.b / max) * 100)}%`, opacity: d.b > 0 ? 1 : 0.25 }} title={`Факт: ${fmtDurH(d.b)}`} />
            </div>
            <div className="text-[10px] font-extrabold text-mute truncate max-w-full">{d.label}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-[11px] font-bold text-mute">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-steel-200" />План</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" />Факт</span>
      </div>
    </div>
  );
}

export function Progress({ val, tone = "accent" }: { val: number; tone?: "accent" | "ok" | "bad" | "warn" }) {
  const c = { accent: "bg-accent", ok: "bg-ok", bad: "bg-bad", warn: "bg-warn" }[tone];
  return (
    <div className="h-2 rounded-full bg-steel-900/8 overflow-hidden">
      <div className={`h-full rounded-full ${c} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, val))}%` }} />
    </div>
  );
}

export function useNow(ms = 1000): Date {
  const [n, setN] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setN(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export function OnlineDot() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-mute">
      <span className={`w-2 h-2 rounded-full ${on ? "bg-ok pulse-ok" : "bg-bad"}`} />
      {on ? "LAN · онлайн" : "офлайн"}
    </span>
  );
}

/** Сжатие изображения до dataURL (для аватаров и ленты). */
export function shrinkImage(file: File, max: number, q = 0.82): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", q));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="relative shrink-0 rounded-[22%] bg-steel-900 grid place-items-center overflow-hidden" style={{ width: size, height: size }}>
      <svg viewBox="0 0 512 512" width={size} height={size}>
        <g fill="none" stroke="#e56f24" strokeWidth="46" strokeLinecap="round">
          <path d="M256 108a148 148 0 1 1-139 97" />
        </g>
        <path d="M96 148l14 82 80-30z" fill="#e56f24" />
        <g stroke="#edf0f3" strokeWidth="30" strokeLinecap="round">
          <path d="M256 256V166" />
          <path d="M256 256l62 40" />
        </g>
        <circle cx="256" cy="256" r="14" fill="#e56f24" />
      </svg>
    </div>
  );
}
