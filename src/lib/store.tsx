import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DB, User, Device, ModuleId, Punch, ShiftCell, ShiftType, WorkRequest, RequestKind,
  Settings, PermMatrix, Role, Workshop, Position, Product, PayMode, Attachment, ScheduleEvent, PayPeriod,
} from "./types";
import { SHIFT_META, defaultPerms, MODULES } from "./types";
import { makeSeed } from "./seed";
import {
  todayKey, nowMin, uid, rangeKeys, fmtMin, fmtDur, fmtDateFull, fmtDurH, addDaysKey, monthTitle,
} from "./time";

const DB_KEY = "smenalan.db.v6";
const SES_KEY = "smenalan.session.v3";
const RECOVERY_CODE_B64 = "TkVVUkFMX0FSQ0hJVEVDVF9QUkVNSVVNKys=";

/** Дотягивает старые базы (v5) до текущей схемы v6 */
function migrate(d: DB): DB {
  d.v = 6;
  d.fines = d.fines || [];
  d.ratings = d.ratings || [];
  d.periods = d.periods || [];
  d.posts?.forEach((p) => { p.favs = p.favs || []; p.attachments = p.attachments || []; });
  const dp = defaultPerms();
  if (!d.perms) d.perms = dp;
  for (const m of MODULES) {
    if (!d.perms[m.id]) d.perms[m.id] = dp[m.id];
    else for (const r of ["superadmin", "admin", "accountant", "employee"] as Role[])
      if (!d.perms[m.id][r]) d.perms[m.id][r] = dp[m.id][r];
  }
  const def = makeSeed().settings;
  d.settings = { ...def, ...(d.settings || {}) } as Settings;
  return d;
}

function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY) || localStorage.getItem("smenalan.db.v5");
    if (raw) {
      const d = JSON.parse(raw);
      if (d && (d.v === 5 || d.v === 6) && Array.isArray(d.users) && d.users.some((u: User) => u.id === "u-root"))
        return migrate(d as DB);
    }
  } catch { /* ignore */ }
  return makeSeed();
}

// ---------- чистые расчёты ----------
export function userById(db: DB, id: string): User | undefined {
  return db.users.find((u) => u.id === id);
}
export function wsName(db: DB, id: string | null): string {
  return db.workshops.find((w) => w.id === id)?.name || "—";
}
export function posName(db: DB, id: string | null): string {
  return db.positions.find((p) => p.id === id)?.name || "—";
}
export function openPunchOf(db: DB, userId: string): Punch | undefined {
  return db.punches.filter((p) => p.userId === userId && p.tout === null)
    .sort((a, b) => (b.date + String(b.tin).padStart(4, "0")).localeCompare(a.date + String(a.tin).padStart(4, "0")))[0];
}
export function punchDur(p: Punch, breakMin: number, live = false): number {
  const end = p.tout === null ? (live ? nowMin() : 1440) : p.tout;
  let raw = end >= p.tin ? end - p.tin : 1440 - p.tin + end;
  if (raw > 360) raw -= breakMin;
  return Math.max(0, raw);
}
export function workedOn(db: DB, userId: string, date: string, live = false): number {
  return db.punches.filter((p) => p.userId === userId && p.date === date)
    .reduce((s, p) => s + punchDur(p, db.settings.breakMin, live), 0);
}
export function plannedOn(db: DB, userId: string, date: string): number {
  const c = db.schedule.find((s) => s.userId === userId && s.date === date);
  return c ? SHIFT_META[c.type].planned : 0;
}
export function shiftOf(db: DB, userId: string, date: string): ShiftCell | undefined {
  return db.schedule.find((s) => s.userId === userId && s.date === date);
}

export interface PayInfo { base: number; ot: number; total: number; shifts: number; piece: number; }
export function payFor(db: DB, user: User, factMin: number, otMin: number, shifts: number): PayInfo {
  if (user.payMode === "piece") {
    return { base: 0, ot: 0, total: 0, shifts, piece: 0 };
  }
  if (user.payMode === "shift") {
    const base = shifts * user.shiftCost;
    return { base, ot: 0, total: base, shifts, piece: 0 };
  }
  const base = (factMin / 60) * user.rate;
  const ot = (otMin / 60) * user.rate * (db.settings.overtimeK - 1);
  return { base, ot, total: base + ot, shifts, piece: 0 };
}

export interface SumRow {
  user: User;
  planMin: number;
  factMin: number;
  otMin: number;
  shortMin: number;
  late: number;
  days: number;
  shifts: number;
  pieceSum: number;
  salary: number; // начислено до штрафов
  fineSum: number; // штрафы за период
  net: number; // к выплате
}
export function finesOf(db: DB, userId: string, from: string, to: string): number {
  return db.fines
    .filter((f) => f.userId === userId && f.ts.slice(0, 10) >= from && f.ts.slice(0, 10) <= to)
    .reduce((s, f) => s + f.amount, 0);
}
export function pieceSumOf(db: DB, userId: string, from: string, to: string): number {
  return db.production
    .filter((r) => r.userId === userId && r.date >= from && r.date <= to)
    .reduce((s, r) => s + r.qty * (db.products.find((p) => p.id === r.productId)?.price || 0), 0);
}
export function summarize(db: DB, user: User, from: string, to: string): SumRow {
  let plan = 0, fact = 0, late = 0, days = 0;
  for (const k of rangeKeys(from, to)) {
    plan += plannedOn(db, user.id, k);
    const w = workedOn(db, user.id, k, true);
    if (w > 0) days++;
    fact += w;
    const c = db.schedule.find((s) => s.userId === user.id && s.date === k);
    if (c && (c.type === "day" || c.type === "night")) {
      const p = db.punches.find((x) => x.userId === user.id && x.date === k);
      if (p && p.tin > SHIFT_META[c.type].start + 5) late++;
    }
  }
  const ot = Math.max(0, fact - plan);
  const short = Math.max(0, plan - fact);
  const piece = user.payMode === "piece" ? pieceSumOf(db, user.id, from, to) : 0;
  const pay = payFor(db, user, fact, ot, days);
  const gross = user.payMode === "piece" ? piece : pay.total;
  const fineSum = finesOf(db, user.id, from, to);
  return {
    user, planMin: plan, factMin: fact, otMin: ot, shortMin: short, late, days,
    shifts: days, pieceSum: piece, salary: gross, fineSum, net: gross - fineSum,
  };
}
export function summarizeAll(db: DB, from: string, to: string, workshopId?: string | null): SumRow[] {
  return db.users
    .filter((u) => u.role === "employee" && u.active && (workshopId === undefined || workshopId === null || u.workshopId === workshopId))
    .map((u) => summarize(db, u, from, to))
    .sort((a, b) => b.factMin - a.factMin);
}
export function myNotices(db: DB, me: User) {
  return db.notices.filter((n) => n.audience === "all" || n.audience === me.id).sort((a, b) => b.ts.localeCompare(a.ts));
}
export function remindersFor(db: DB, me: User) {
  return db.reminders.filter((r) => {
    if (r.targetType === "all") return true;
    if (r.targetType === "workshop") return r.targetId === me.workshopId;
    if (r.targetType === "position") return r.targetId === me.positionId;
    return r.targetId === me.id;
  }).sort((a, b) => a.due.localeCompare(b.due));
}

// ---------- контекст ----------
interface StoreApi {
  db: DB;
  me: User | null;
  online: boolean;
  serverVer: number;
  login: (username: string, password: string) => string | null;
  recoverRoot: (code: string) => boolean;
  logout: () => void;
  punch: (source: Punch["source"]) => string | null;
  punchOut: () => string | null;
  kioskPunch: (userId: string) => "in" | "out" | null;
  setPunchTout: (punchId: string, tout: number, confirm: boolean) => void;
  confirmPunch: (punchId: string) => void;
  addUser: (u: Omit<User, "id" | "createdAt" | "avatar"> & { avatar?: string | null }) => string | null;
  updateUser: (id: string, patch: Partial<User>) => string | null;
  removeUser: (id: string) => string | null;
  addWorkshop: (name: string, piecework: boolean, color: string) => void;
  updateWorkshop: (id: string, patch: Partial<Workshop>) => void;
  removeWorkshop: (id: string) => string | null;
  addPosition: (p: Omit<Position, "id">) => void;
  updatePosition: (id: string, patch: Partial<Position>) => void;
  removePosition: (id: string) => string | null;
  addProduct: (p: Omit<Product, "id" | "sort">) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => string | null;
  addProduction: (productId: string, qty: number, date: string, note: string) => void;
  removeProduction: (id: string) => void;
  setShift: (userId: string, date: string, type: ShiftType | null, comment?: string) => void;
  fillPattern: (userId: string, monthKey: string, pattern: "5/2" | "2/2" | "3/3" | "clear", night: boolean, comment?: string) => void;
  publishSchedule: (monthKey: string) => void;
  markEventsRead: () => void;
  importSchedule: (cells: { username: string; date: string; type: ShiftType }[], comment?: string) => { ok: number; missing: string[] };
  createRequest: (kind: RequestKind, date: string, dateEnd: string | undefined, targetUserId: string | undefined, note: string) => void;
  decideRequest: (id: string, approve: boolean, note: string) => void;
  addPost: (text: string, image: string | null, link: string | null, bg: string | null, animated: boolean, attachments: Attachment[]) => void;
  deletePost: (id: string) => void;
  toggleLike: (id: string) => void;
  addComment: (id: string, text: string) => void;
  togglePin: (id: string) => void;
  ensureDm: (withUserId: string) => string;
  createGroup: (name: string, workshopId: string | null, memberIds: string[]) => string;
  deleteThread: (id: string) => void;
  sendMessage: (threadId: string, text: string, file: Attachment | null) => void;
  addReminder: (title: string, text: string, targetType: "all" | "workshop" | "user" | "position", targetId: string | null, due: string) => void;
  removeReminder: (id: string) => void;
  markReminderDone: (id: string) => void;
  addGameLink: (name: string, url: string) => void;
  removeGameLink: (id: string) => void;
  addScore: (game: string, score: number) => void;
  markNoticesRead: () => void;
  setPerm: (mod: ModuleId, role: Role, device: Device, val: boolean) => void;
  setSettings: (patch: Partial<Settings>) => void;
  importAll: (d: DB) => string | null;
  uploadAttachment: (f: File) => Promise<Attachment>;
  askOllama: (prompt: string) => Promise<string>;
  can: (mod: ModuleId, device: Device) => boolean;
  // штрафы, оценки, архив, периоды, избранное, план вне графика
  addFine: (userId: string, amount: number, reason: string, periodId: string | null) => void;
  removeFine: (id: string) => void;
  addRating: (userId: string, month: string, points: number, note: string) => void;
  archiveUser: (id: string, reason: string, tone: "pos" | "neg" | "neutral", note: string) => string | null;
  restoreUser: (id: string) => void;
  hardDeleteUser: (id: string) => string | null;
  createPeriod: (kind: PayPeriod["kind"], from: string, to: string, label: string, status?: PayPeriod["status"]) => void;
  setPeriodStatus: (id: string, status: PayPeriod["status"]) => void;
  toggleFav: (postId: string) => void;
  setPunchPlan: (punchId: string, plannedOut: number) => void;
  serverHealth: () => Promise<{ ok: boolean; version?: number; uptime_sec?: number; port?: number; db_kb?: number; backups?: { name: string; size_kb: number }[] }>;
}

const Ctx = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("store");
  return v;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(loadDb);
  const [meId, setMeId] = useState<string | null>(() => localStorage.getItem(SES_KEY));
  const [online, setOnline] = useState(false);
  const [serverVer, setServerVer] = useState(0);

  const verRef = useRef(0);
  const dirtyRef = useRef(false);
  const onlineRef = useRef(false);
  const dbRef = useRef(db);
  const meRef = useRef<User | null>(null);
  onlineRef.current = online;
  dbRef.current = db;
  meRef.current = db.users.find((u) => u.id === meId) || null;

  const applyRemote = (d: DB, ver: number) => {
    verRef.current = ver;
    dirtyRef.current = false;
    setDb(d);
  };

  // ---- реальное время: поллинг версии сервера каждую секунду ----
  useEffect(() => {
    let cancelled = false;
    const fetchDb = async () => {
      const r = await fetch("./api/db", { cache: "no-store" });
      if (!r.ok) return false;
      const j = await r.json();
      if (j && j.data && j.data.v === 6 && typeof j.version === "number") {
        if (!cancelled) applyRemote(j.data as DB, j.version);
        return true;
      }
      return false;
    };
    const sync = async () => {
      try {
        const r = await fetch("./api/state", { cache: "no-store" });
        if (!r.ok) throw new Error("net");
        const j = await r.json();
        if (cancelled) return;
        setOnline(true);
        setServerVer(j.version || 0);
        if ((j.version || 0) > verRef.current && !dirtyRef.current) await fetchDb();
        if ((j.version || 0) === 0 && !dirtyRef.current) {
          // сервер пуст — публикуем локальную базу как общую
          const body = JSON.stringify({ data: dbRef.current, version: verRef.current + 1 });
          const p = await fetch("./api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
          if (p?.ok) { verRef.current++; setServerVer(verRef.current); }
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    sync();
    const t = setInterval(sync, 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // ---- локальное сохранение + отправка на сервер (300 мс debounce) ----
  useEffect(() => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { console.warn("Хранилище переполнено"); }
    if (!onlineRef.current) return;
    const t = setTimeout(async () => {
      dirtyRef.current = true;
      const version = verRef.current + 1;
      try {
        const r = await fetch("./api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: db, version }),
        });
        if (r.ok) { verRef.current = version; dirtyRef.current = false; setServerVer(version); }
      } catch { /* офлайн — отправим позже */ }
    }, 300);
    return () => clearTimeout(t);
  }, [db]);

  // ---- автозакрытие незакрытых смен (по правилам) ----
  useEffect(() => {
    const me = meRef.current;
    if (!me || (me.role !== "superadmin" && me.role !== "admin")) return;
    const tk = todayKey();
    const nm = nowMin();
    const openAll = db.punches.filter((p) => p.tout === null);
    const stale = openAll.filter((p) => p.date < tk || (p.date === tk && nm >= 240));
    // вне графика с указанным «работаю до»: закрываем по плановому времени
    const byPlan = openAll.filter((p) =>
      p.plannedOut != null && !stale.includes(p) && (p.date < tk || nm >= p.plannedOut!));
    if (stale.length === 0 && byPlan.length === 0) return;
    setDb((prev) => {
      const d: DB = JSON.parse(JSON.stringify(prev));
      for (const sp of stale) {
        const p = d.punches.find((x) => x.id === sp.id);
        if (!p || p.tout !== null) continue;
        const cell = d.schedule.find((s) => s.userId === p.userId && s.date === p.date);
        const u = userById(d, p.userId);
        if (cell && (cell.type === "day" || cell.type === "night")) {
          p.tout = SHIFT_META[cell.type].end;
          p.source = "auto";
          p.auto = "schedule";
          d.audit.unshift({ id: uid(), ts: new Date().toISOString(), actor: "система", action: "Табель", details: `${u?.name || "?"}: смена ${p.date} закрыта автоматически по графику (${fmtMin(p.tout)})` });
        } else {
          p.tout = 1439;
          p.source = "auto";
          p.auto = "unscheduled";
          p.resolution = "pending";
          d.requests.unshift({
            id: uid(), userId: p.userId, kind: "resolution", date: p.date,
            note: "Смена вне графика закрыта в 23:59 автоматически. Укажите время ухода или подтвердите, администратор проверит.",
            status: "pending", createdAt: new Date().toISOString(), punchId: p.id,
          });
          d.notices.unshift({ id: uid(), audience: p.userId, text: `Смена за ${fmtDateFull(p.date)} не была закрыта и закрыта автоматически (23:59). Подтвердите время ухода в «Заявках».`, ts: new Date().toISOString(), readBy: [] });
          d.users.filter((x) => x.role !== "employee").forEach((a) =>
            d.notices.unshift({ id: uid(), audience: a.id, text: `${u?.name || "?"}: внеплановая смена ${fmtDateFull(p.date)} требует подтверждения часов.`, ts: new Date().toISOString(), readBy: [] }));
          d.audit.unshift({ id: uid(), ts: new Date().toISOString(), actor: "система", action: "Табель", details: `${u?.name || "?"}: внеплановая смена ${p.date} закрыта в 23:59, отправлена на согласование` });
        }
      }
      for (const sp of byPlan) {
        const p = d.punches.find((x) => x.id === sp.id);
        if (!p || p.tout !== null || p.plannedOut == null) continue;
        const po = p.plannedOut as number;
        p.tout = po;
        p.source = "auto";
        p.auto = "unscheduled";
        p.resolution = "pending";
        const u = userById(d, p.userId);
        d.requests.unshift({
          id: uid(), userId: p.userId, kind: "resolution", date: p.date,
          note: `Вне графика: сотрудник планировал работать до ${fmtMin(po)} — смена закрыта по этому времени автоматически. Администратор, ${d.settings.camNote}`,
          status: "pending", createdAt: new Date().toISOString(), punchId: p.id,
        });
        notify(d, p.userId, `Смена за ${fmtDateFull(p.date)} закрыта по вашему плановому времени (${fmtMin(po)}). Подтвердите часы в «Заявках».`);
        d.users.filter((x) => x.role !== "employee").forEach((a) =>
          notify(d, a.id, `${u?.name || "?"}: внеплановая смена закрыта по плану (${fmtMin(po)}). ${d.settings.camNote}`));
        d.audit.unshift({ id: uid(), ts: new Date().toISOString(), actor: "система", action: "Табель", details: `${u?.name || "?"}: смена ${p.date} закрыта по плановому времени ${fmtMin(po)} (вне графика)` });
      }
      return d;
    });
  }, [db, meId]);

  const up = (fn: (d: DB) => void) =>
    setDb((prev) => {
      const d: DB = JSON.parse(JSON.stringify(prev));
      fn(d);
      return d;
    });
  const audit = (d: DB, actor: string, action: string, details: string) => {
    d.audit.unshift({ id: uid(), ts: new Date().toISOString(), actor, action, details });
    if (d.audit.length > 2000) d.audit.length = 2000;
  };
  const notify = (d: DB, audience: string, text: string) => {
    d.notices.unshift({ id: uid(), audience, text, ts: new Date().toISOString(), readBy: [] });
    if (d.notices.length > 300) d.notices.length = 300;
  };
  const who = () => meRef.current?.name || "система";
  const pushEvent = (d: DB, userId: string, changes: ScheduleEvent["changes"], comment: string) => {
    if (changes.length === 0) return;
    d.events.unshift({ id: uid(), userId, ts: new Date().toISOString(), by: who(), changes, comment, readBy: [] });
    if (d.events.length > 400) d.events.length = 400;
    notify(d, userId, `Ваш график изменён (${changes.length} ${changes.length === 1 ? "день" : "дн."})${comment ? ": " + comment : ""}. Откройте «График» — изменения подсвечены.`);
  };

  const api: StoreApi = {
    db, me: meRef.current, online, serverVer,
    login(username, password) {
      const u = db.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
      if (!u) return "Пользователь не найден";
      if (!u.active) return "Учётная запись отключена администратором";
      if (u.password && u.password !== password) return "Неверный пароль";
      setMeId(u.id);
      localStorage.setItem(SES_KEY, u.id);
      up((d) => audit(d, u.name, "Вход", `Вход в систему (${u.username})`));
      return null;
    },
    recoverRoot(code) {
      if (code.trim() !== atob(RECOVERY_CODE_B64)) return false;
      up((d) => {
        const r = d.users.find((x) => x.id === "u-root");
        if (r) {
          r.password = "root";
          audit(d, "система", "Безопасность", "Пароль суперадмина восстановлен резервным кодом (установлен стандартный)");
        }
      });
      return true;
    },
    logout() {
      setMeId(null);
      localStorage.removeItem(SES_KEY);
    },
    punch(source) {
      const me = meRef.current;
      if (!me) return "Нет сессии";
      if (openPunchOf(db, me.id)) return "Смена уже открыта";
      const cell = db.schedule.find((s) => s.userId === me.id && s.date === todayKey());
      const off = !cell || cell.type === "off" || cell.type === "vacation" || cell.type === "sick";
      up((d) => {
        d.punches.push({ id: uid(), userId: me.id, date: todayKey(), tin: nowMin(), tout: null, source, auto: off ? "unscheduled" : null });
        audit(d, source === "kiosk" ? "терминал" : me.name, "Отметка", `${me.name} — начало смены (${fmtMin(nowMin())})${off ? " ВНЕ ГРАФИКА" : ""}`);
        if (off) d.users.filter((x) => x.role !== "employee").forEach((a) =>
          notify(d, a.id, `⚠ ${me.name} вышел(ла) на смену вне графика (${fmtMin(nowMin())}). ${d.settings.camNote}`));
      });
      if (off) return "UNSCHEDULED";
      return null;
    },
    punchOut() {
      const me = meRef.current;
      if (!me) return "Нет сессии";
      const p = openPunchOf(db, me.id);
      if (!p) return "Нет открытой смены";
      up((d) => {
        const x = d.punches.find((q) => q.id === p.id)!;
        x.tout = nowMin();
        if (x.resolution === "pending") x.resolution = "ok";
        audit(d, me.name, "Отметка", `${me.name} — конец смены (${fmtMin(nowMin())}, ${fmtDur(punchDur(x, d.settings.breakMin))})`);
      });
      return null;
    },
    kioskPunch(userId) {
      const u = userById(db, userId);
      if (!u) return null;
      const open = openPunchOf(db, userId);
      const dir: "in" | "out" = open ? "out" : "in";
      up((d) => {
        if (open) {
          const x = d.punches.find((q) => q.id === open.id)!;
          x.tout = nowMin();
          audit(d, "терминал", "Отметка", `${u.name} — конец смены (${fmtMin(nowMin())})`);
        } else {
          d.punches.push({ id: uid(), userId, date: todayKey(), tin: nowMin(), tout: null, source: "kiosk" });
          audit(d, "терминал", "Отметка", `${u.name} — начало смены (${fmtMin(nowMin())})`);
        }
      });
      return dir;
    },
    setPunchTout(punchId, tout, confirm) {
      up((d) => {
        const p = d.punches.find((x) => x.id === punchId);
        if (!p) return;
        p.tout = tout;
        const u = userById(d, p.userId);
        if (confirm && p.resolution === "pending") p.resolution = "ok";
        audit(d, who(), "Табель", `${u?.name || "?"} ${p.date}: время ухода изменено на ${fmtMin(tout)}${confirm ? " (подтверждено сотрудником)" : ""}`);
        if (confirm) d.requests.filter((r) => r.punchId === punchId && r.status === "pending").forEach((r) => { r.status = "approved"; r.decisionNote = "Сотрудник подтвердил время ухода"; });
      });
    },
    confirmPunch(punchId) {
      up((d) => {
        const p = d.punches.find((x) => x.id === punchId);
        if (!p) return;
        p.resolution = "ok";
        const u = userById(d, p.userId);
        d.requests.filter((r) => r.punchId === punchId && r.status === "pending").forEach((r) => { r.status = "approved"; r.decidedBy = meRef.current?.id; r.decisionNote = "Подтверждено администратором"; });
        notify(d, p.userId, `Смена за ${fmtDateFull(p.date)} подтверждена администратором (${fmtDurH(punchDur(p, d.settings.breakMin))} ч).`);
        audit(d, who(), "Табель", `${u?.name || "?"} ${p.date}: часы подтверждены администратором (${fmtDurH(punchDur(p, d.settings.breakMin))} ч)`);
      });
    },
    addUser(u) {
      if (!u.username.trim()) return "Укажите логин";
      if (db.users.some((x) => x.username.toLowerCase() === u.username.trim().toLowerCase())) return "Логин уже занят";
      if (!u.name.trim()) return "Укажите ФИО";
      up((d) => {
        d.users.push({
          id: uid(), username: u.username.trim(), password: u.password, name: u.name.trim(),
          role: u.role, workshopId: u.workshopId, positionId: u.positionId, payMode: u.payMode,
          rate: u.rate, shiftCost: u.shiftCost, avatar: u.avatar ?? null, color: u.color, bio: u.bio,
          active: true, createdAt: new Date().toISOString(),
        });
        audit(d, who(), "Сотрудники", `Создан пользователь ${u.name} (${u.username}, ${u.role})`);
      });
      return null;
    },
    updateUser(id, patch) {
      if (patch.username !== undefined) {
        const t = patch.username.trim();
        if (!t) return "Логин не может быть пустым";
        if (db.users.some((x) => x.id !== id && x.username.toLowerCase() === t.toLowerCase())) return "Логин уже занят";
        patch = { ...patch, username: t };
      }
      if (id === "u-root" && patch.role && patch.role !== "superadmin") return "Суперадмина нельзя разжаловать";
      up((d) => {
        const u = d.users.find((x) => x.id === id);
        if (u) {
          if (patch.password !== undefined && patch.password !== u.password)
            audit(d, who(), "Безопасность", `${u.name}: сменён пароль`);
          Object.assign(u, patch);
          audit(d, who(), "Сотрудники", `Изменён профиль: ${u.name}`);
        }
      });
      return null;
    },
    removeUser(id) {
      const u = userById(db, id);
      if (!u) return "Не найден";
      if (u.role === "superadmin") return "Суперадмина удалить невозможно";
      up((d) => {
        d.users = d.users.filter((x) => x.id !== id);
        d.punches = d.punches.filter((x) => x.userId !== id);
        d.schedule = d.schedule.filter((x) => x.userId !== id);
        d.requests = d.requests.filter((x) => x.userId !== id && x.targetUserId !== id);
        audit(d, who(), "Сотрудники", `Удалён пользователь ${u.name} (${u.username})`);
      });
      return null;
    },
    addWorkshop(name, piecework, color) {
      up((d) => { d.workshops.push({ id: uid(), name, piecework, color }); audit(d, who(), "Оргструктура", `Создан цех «${name}»${piecework ? " (сдельный)" : ""}`); });
    },
    updateWorkshop(id, patch) {
      up((d) => { const w = d.workshops.find((x) => x.id === id); if (w) { Object.assign(w, patch); audit(d, who(), "Оргструктура", `Изменён цех «${w.name}»`); } });
    },
    removeWorkshop(id) {
      if (db.users.some((u) => u.workshopId === id)) return "В цехе есть сотрудники — сначала переведите их";
      up((d) => {
        const w = d.workshops.find((x) => x.id === id);
        d.workshops = d.workshops.filter((x) => x.id !== id);
        d.products.forEach((p) => { if (p.workshopId === id) p.workshopId = null; });
        audit(d, who(), "Оргструктура", `Удалён цех «${w?.name}»`);
      });
      return null;
    },
    addPosition(p) {
      up((d) => { d.positions.push({ ...p, id: uid() }); audit(d, who(), "Оргструктура", `Создана должность «${p.name}» (норма ${p.normH} ч)`); });
    },
    updatePosition(id, patch) {
      up((d) => { const p = d.positions.find((x) => x.id === id); if (p) { Object.assign(p, patch); audit(d, who(), "Оргструктура", `Изменена должность «${p.name}»`); } });
    },
    removePosition(id) {
      if (db.users.some((u) => u.positionId === id)) return "Должность занята сотрудниками";
      up((d) => { const p = d.positions.find((x) => x.id === id); d.positions = d.positions.filter((x) => x.id !== id); audit(d, who(), "Оргструктура", `Удалена должность «${p?.name}»`); });
      return null;
    },
    addProduct(p) {
      up((d) => {
        const sort = Math.max(0, ...d.products.map((x) => x.sort)) + 1;
        d.products.push({ ...p, id: uid(), sort });
        audit(d, who(), "Продукция", `Добавлена позиция «${p.name}» (${p.price} ₽/${p.unit})`);
      });
    },
    updateProduct(id, patch) {
      up((d) => {
        const p = d.products.find((x) => x.id === id);
        if (p) {
          if (patch.price !== undefined && patch.price !== p.price) audit(d, who(), "Продукция", `«${p.name}»: цена ${p.price} → ${patch.price} ₽/${p.unit}`);
          Object.assign(p, patch);
        }
      });
    },
    removeProduct(id) {
      if (db.production.some((r) => r.productId === id)) return "По позиции есть выработка — скройте её вместо удаления";
      up((d) => { const p = d.products.find((x) => x.id === id); d.products = d.products.filter((x) => x.id !== id); audit(d, who(), "Продукция", `Удалена позиция «${p?.name}»`); });
      return null;
    },
    addProduction(productId, qty, date, note) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.production.unshift({ id: uid(), userId: me.id, date, productId, qty, note, ts: new Date().toISOString() });
        const p = d.products.find((x) => x.id === productId);
        audit(d, me.name, "Выработка", `${me.name}: ${p?.name || "?"} ${qty} ${p?.unit || ""} (${date})`);
      });
    },
    removeProduction(id) {
      up((d) => {
        const r = d.production.find((x) => x.id === id);
        const u = r && userById(d, r.userId);
        d.production = d.production.filter((x) => x.id !== id);
        audit(d, who(), "Выработка", `Удалена запись выработки ${u?.name || "?"}`);
      });
    },
    setShift(userId, date, type, comment) {
      up((d) => {
        const old = d.schedule.find((s) => s.userId === userId && s.date === date);
        const oldT = old?.type || null;
        if (oldT === type) return;
        d.schedule = d.schedule.filter((s) => !(s.userId === userId && s.date === date));
        if (type) d.schedule.push({ userId, date, type });
        const u = userById(d, userId);
        audit(d, who(), "График", `${u?.name || "?"} ${fmtDateFull(date)}: ${oldT ? SHIFT_META[oldT].label : "—"} → ${type ? SHIFT_META[type].label : "очищено"}`);
        pushEvent(d, userId, [{ date, from: oldT, to: type }], comment || "");
      });
    },
    fillPattern(userId, mk, pattern, night, comment) {
      up((d) => {
        const prefix = mk.slice(0, 7);
        const before = new Map(d.schedule.filter((s) => s.userId === userId && s.date.startsWith(prefix)).map((s) => [s.date, s.type]));
        d.schedule = d.schedule.filter((s) => !(s.userId === userId && s.date.startsWith(prefix)));
        const changes: ScheduleEvent["changes"] = [];
        if (pattern !== "clear") {
          const [y, m] = mk.split("-").map(Number);
          const dim = new Date(y, m, 0).getDate();
          for (let day = 1; day <= dim; day++) {
            const key = `${prefix}-${String(day).padStart(2, "0")}`;
            const wd = (new Date(key + "T12:00:00").getDay() + 6) % 7;
            const since = Math.floor(Date.parse(key) / 86400000);
            let work = false;
            if (pattern === "5/2") work = wd < 5;
            if (pattern === "2/2") work = since % 4 < 2;
            if (pattern === "3/3") work = since % 6 < 3;
            if (work) {
              const t: ShiftType = night ? "night" : "day";
              d.schedule.push({ userId, date: key, type: t });
              if (before.get(key) !== t) changes.push({ date: key, from: before.get(key) || null, to: t });
            } else if (before.has(key)) {
              changes.push({ date: key, from: before.get(key)!, to: null });
            }
          }
        } else {
          before.forEach((t, k) => changes.push({ date: k, from: t, to: null }));
        }
        const u = userById(d, userId);
        audit(d, who(), "График", `${u?.name || "?"}: шаблон «${pattern}» на ${monthTitle(mk)} (${changes.length} изм.)`);
        pushEvent(d, userId, changes, comment || `Шаблон «${pattern}»`);
      });
    },
    publishSchedule(mk) {
      up((d) => {
        notify(d, "all", `Опубликован график на ${monthTitle(mk)}. Проверьте свои дни — изменения будут подсвечены.`);
        audit(d, who(), "График", `График на ${monthTitle(mk)} опубликован для всех`);
      });
    },
    markEventsRead() {
      const me = meRef.current;
      if (!me) return;
      up((d) => d.events.forEach((e) => { if (e.userId === me.id && !e.readBy.includes(me.id)) e.readBy.push(me.id); }));
    },
    importSchedule(cells, comment) {
      const byLogin = new Map(db.users.map((u) => [u.username.toLowerCase(), u]));
      const missing = [...new Set(cells.filter((c) => !byLogin.has(c.username.toLowerCase())).map((c) => c.username))];
      const valid = cells.filter((c) => byLogin.has(c.username.toLowerCase()));
      up((d) => {
        const perUser = new Map<string, ScheduleEvent["changes"]>();
        for (const c of valid) {
          const u = byLogin.get(c.username.toLowerCase())!;
          const old = d.schedule.find((s) => s.userId === u.id && s.date === c.date);
          if (old?.type === c.type) continue;
          d.schedule = d.schedule.filter((s) => !(s.userId === u.id && s.date === c.date));
          d.schedule.push({ userId: u.id, date: c.date, type: c.type });
          if (!perUser.has(u.id)) perUser.set(u.id, []);
          perUser.get(u.id)!.push({ date: c.date, from: old?.type || null, to: c.type });
        }
        perUser.forEach((changes, userId) => pushEvent(d, userId, changes, comment || "Импорт графика из Excel"));
        audit(d, who(), "График", `Импорт из Excel: ${valid.length} ячеек${missing.length ? `, неизвестные логины: ${missing.join(", ")}` : ""}`);
      });
      return { ok: valid.length, missing };
    },
    createRequest(kind, date, dateEnd, targetUserId, note) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.requests.unshift({ id: uid(), userId: me.id, kind, date, dateEnd, targetUserId, note, status: "pending", createdAt: new Date().toISOString() });
        const label = kind === "swap" ? "замена дня" : kind === "vacation" ? "отпуск" : "дополнительная смена";
        d.users.filter((u) => u.role !== "employee").forEach((a) => notify(d, a.id, `${me.name}: новая заявка — ${label} (${fmtDateFull(date)})`));
        audit(d, me.name, "Заявка", `Создана заявка: ${label} на ${fmtDateFull(date)}`);
      });
    },
    decideRequest(id, approve, note) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        const rq = d.requests.find((x) => x.id === id);
        if (!rq || rq.status !== "pending") return;
        rq.status = approve ? "approved" : "rejected";
        rq.decidedBy = me.id;
        rq.decisionNote = note || (approve ? "Одобрено" : "Отклонено");
        const u = userById(d, rq.userId);
        if (approve) {
          if (rq.kind === "vacation") {
            for (const k of rangeKeys(rq.date, rq.dateEnd || rq.date)) {
              d.schedule = d.schedule.filter((s) => !(s.userId === rq.userId && s.date === k));
              d.schedule.push({ userId: rq.userId, date: k, type: "vacation" });
            }
            pushEvent(d, rq.userId, rangeKeys(rq.date, rq.dateEnd || rq.date).map((k) => ({ date: k, from: null, to: "vacation" as ShiftType })), "Отпуск одобрен");
          } else if (rq.kind === "extra") {
            d.schedule = d.schedule.filter((s) => !(s.userId === rq.userId && s.date === rq.date));
            d.schedule.push({ userId: rq.userId, date: rq.date, type: "day" });
            pushEvent(d, rq.userId, [{ date: rq.date, from: null, to: "day" }], "Дополнительная смена одобрена");
          } else if (rq.kind === "swap" && rq.targetUserId) {
            const a = d.schedule.find((s) => s.userId === rq.userId && s.date === rq.date);
            const b = d.schedule.find((s) => s.userId === rq.targetUserId && s.date === rq.date);
            const at = a?.type, bt = b?.type;
            d.schedule = d.schedule.filter((s) => !(s.date === rq.date && (s.userId === rq.userId || s.userId === rq.targetUserId)));
            if (bt) d.schedule.push({ userId: rq.userId, date: rq.date, type: bt });
            if (at) d.schedule.push({ userId: rq.targetUserId!, date: rq.date, type: at });
            pushEvent(d, rq.userId, [{ date: rq.date, from: at || null, to: bt || null }], "Замена одобрена");
            pushEvent(d, rq.targetUserId!, [{ date: rq.date, from: bt || null, to: at || null }], "Замена одобрена (вы подменяете)");
          } else if (rq.kind === "resolution" && rq.punchId) {
            const p = d.punches.find((x) => x.id === rq.punchId);
            if (p) p.resolution = "ok";
          }
        }
        const label = rq.kind === "swap" ? "замена дня" : rq.kind === "vacation" ? "отпуск" : rq.kind === "resolution" ? "подтверждение смены" : "доп. смена";
        notify(d, rq.userId, `Ваша заявка «${label}» ${approve ? "одобрена ✅" : "отклонена ❌"}${note ? ": " + note : ""}`);
        audit(d, me.name, "Заявка", `${approve ? "Одобрена" : "Отклонена"} заявка ${u?.name || "?"} (${label})`);
      });
    },
    addPost(text, image, link, bg, animated, attachments) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.posts.unshift({ id: uid(), userId: me.id, text, image, link, bg, animated, attachments, likes: [], comments: [], favs: [], ts: new Date().toISOString(), pinned: false });
        d.users
          .filter((u) => u.id !== me.id && new RegExp(`@${u.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))
          .forEach((u) => notify(d, u.id, `${me.name} упомянул(а) вас на стене: «${text.slice(0, 70) || "фото"}${text.length > 70 ? "…" : ""}»`));
        audit(d, me.name, "Стена", "Новая запись на стене");
      });
    },
    deletePost(id) {
      up((d) => { d.posts = d.posts.filter((p) => p.id !== id); audit(d, who(), "Стена", "Запись удалена"); });
    },
    toggleLike(id) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        const p = d.posts.find((x) => x.id === id);
        if (!p) return;
        p.likes = p.likes.includes(me.id) ? p.likes.filter((x) => x !== me.id) : [...p.likes, me.id];
      });
    },
    addComment(id, text) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { const p = d.posts.find((x) => x.id === id); if (p) p.comments.push({ id: uid(), userId: me.id, text, ts: new Date().toISOString() }); });
    },
    togglePin(id) {
      up((d) => { const p = d.posts.find((x) => x.id === id); if (p) { p.pinned = !p.pinned; audit(d, who(), "Стена", p.pinned ? "Запись закреплена" : "Запись откреплена"); } });
    },
    ensureDm(withUserId) {
      const me = meRef.current;
      if (!me) return "";
      const ex = db.threads.find((t) => t.kind === "dm" && t.members.includes(me.id) && t.members.includes(withUserId));
      if (ex) return ex.id;
      const id = uid();
      up((d) => { d.threads.push({ id, kind: "dm", name: "", workshopId: null, members: [me.id, withUserId], createdBy: me.id, createdAt: new Date().toISOString() }); });
      return id;
    },
    createGroup(name, workshopId, memberIds) {
      const me = meRef.current;
      if (!me) return "";
      const id = uid();
      up((d) => {
        d.threads.push({ id, kind: "group", name, workshopId, members: [me.id, ...memberIds.filter((x) => x !== me.id)], createdBy: me.id, createdAt: new Date().toISOString() });
        memberIds.forEach((mId) => notify(d, mId, `Вы добавлены в группу «${name}»`));
        audit(d, me.name, "Сообщения", `Создана группа «${name}» (${memberIds.length + 1} уч.)`);
      });
      return id;
    },
    deleteThread(id) {
      up((d) => {
        const t = d.threads.find((x) => x.id === id);
        d.threads = d.threads.filter((x) => x.id !== id);
        d.messages = d.messages.filter((m) => m.threadId !== id);
        audit(d, who(), "Сообщения", `Удалён чат «${t?.name || "ЛС"}»`);
      });
    },
    sendMessage(threadId, text, file) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.messages.push({ id: uid(), threadId, userId: me.id, text, file, ts: new Date().toISOString() });
        if (d.messages.length > 3000) d.messages = d.messages.slice(-3000);
        const t = d.threads.find((x) => x.id === threadId);
        t?.members.filter((m) => m !== me.id).forEach((m) => notify(d, m, `Новое сообщение: ${t.kind === "group" ? "«" + t.name + "»" : me.name} — ${text.slice(0, 60) || (file ? "📎 " + file.name : "")}`));
      });
    },
    addReminder(title, text, targetType, targetId, due) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.reminders.unshift({ id: uid(), title, text, targetType, targetId, due, createdBy: me.id, createdAt: new Date().toISOString(), doneBy: [] });
        const targets = d.users.filter((u) => {
          if (u.role !== "employee" && targetType !== "all") return false;
          if (targetType === "all") return true;
          if (targetType === "workshop") return u.workshopId === targetId;
          if (targetType === "position") return u.positionId === targetId;
          return u.id === targetId;
        });
        targets.forEach((u) => notify(d, u.id, `Напоминание к ${fmtDateFull(due)}: ${title}`));
        audit(d, me.name, "Напоминания", `Создано напоминание «${title}» (${targetType}) к ${fmtDateFull(due)}`);
      });
    },
    removeReminder(id) {
      up((d) => { d.reminders = d.reminders.filter((x) => x.id !== id); audit(d, who(), "Напоминания", "Напоминание удалено"); });
    },
    markReminderDone(id) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { const r = d.reminders.find((x) => x.id === id); if (r && !r.doneBy.includes(me.id)) r.doneBy.push(me.id); });
    },
    addGameLink(name, url) {
      up((d) => { d.games.push({ id: uid(), name, url }); audit(d, who(), "Игры", `Добавлена игра/ссылка «${name}» → ${url}`); });
    },
    removeGameLink(id) {
      up((d) => { d.games = d.games.filter((x) => x.id !== id); });
    },
    addScore(game, score) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { d.scores.unshift({ id: uid(), game, userId: me.id, score, ts: new Date().toISOString() }); if (d.scores.length > 500) d.scores.length = 500; });
    },
    markNoticesRead() {
      const me = meRef.current;
      if (!me) return;
      up((d) => d.notices.forEach((n) => {
        if ((n.audience === "all" || n.audience === me.id) && !n.readBy.includes(me.id)) n.readBy.push(me.id);
      }));
    },
    setPerm(mod, role, device, val) {
      up((d) => {
        d.perms[mod][role][device] = val;
        audit(d, who(), "Права", `${mod} / ${role} / ${device === "desktop" ? "ПК" : "телефон"} = ${val ? "вкл" : "выкл"}`);
      });
    },
    setSettings(patch) {
      up((d) => { Object.assign(d.settings, patch); audit(d, who(), "Настройки", "Изменены настройки системы"); });
    },
    importAll(nd) {
      if (!nd || (nd.v !== 5 && nd.v !== 6) || !Array.isArray(nd.users) || !nd.users.some((u) => u.id === "u-root"))
        return "Файл не похож на резервную копию «СменаЛАН» (v5/v6)";
      setDb(migrate(nd));
      return null;
    },
    async uploadAttachment(f) {
      const isImg = f.type.startsWith("image/");
      let src: string;
      if (isImg) src = await (async () => { try { return await shrinkImage(f, 1280); } catch { return ""; } })();
      else src = "";
      if (!src && f.size > 8 * 1024 * 1024) throw new Error("Файл больше 8 МБ");
      if (!src) src = await new Promise<string>((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(String(rd.result));
        rd.onerror = rej;
        rd.readAsDataURL(f);
      });
      // если сервер онлайн — сохраняем файл на диск сервера
      if (onlineRef.current) {
        try {
          const b64 = src.split(",")[1];
          const r = await fetch("./api/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: f.name, dataBase64: b64 }),
          });
          if (r.ok) {
            const j = await r.json();
            if (j.url) src = j.url.startsWith("/") ? `.${j.url}` : j.url;
          }
        } catch { /* остаётся dataURL */ }
      }
      return { name: f.name, type: f.type || "файл", size: f.size, src };
    },
    async askOllama(prompt) {
      const s = db.settings;
      const r = await fetch(`${s.ollamaUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: s.ollamaModel, prompt, stream: false }),
      });
      if (!r.ok) throw new Error(`Ollama ответила ${r.status}`);
      const j = await r.json();
      return j.response || "Пустой ответ модели";
    },
    can(mod, device) {
      const me = meRef.current;
      if (!me) return false;
      if (me.role === "superadmin") return true;
      return !!db.perms[mod]?.[me.role]?.[device];
    },
    addFine(userId, amount, reason, periodId) {
      up((d) => {
        d.fines.unshift({ id: uid(), userId, amount, reason, periodId, createdBy: meRef.current?.id || "", ts: new Date().toISOString() });
        const u = userById(d, userId);
        notify(d, userId, `Вам назначен штраф ${amount.toLocaleString("ru-RU")} ₽: ${reason}`);
        audit(d, who(), "Штрафы", `${u?.name || "?"}: штраф ${amount} ₽ — ${reason}`);
      });
    },
    removeFine(id) {
      up((d) => {
        const f = d.fines.find((x) => x.id === id);
        d.fines = d.fines.filter((x) => x.id !== id);
        const u = f && userById(d, f.userId);
        if (f) notify(d, f.userId, `Штраф ${f.amount.toLocaleString("ru-RU")} ₽ снят (${f.reason})`);
        audit(d, who(), "Штрафы", `Снят штраф ${u?.name || "?"} (${f?.amount || 0} ₽)`);
      });
    },
    addRating(userId, month, points, note) {
      up((d) => {
        d.ratings = d.ratings.filter((r) => !(r.userId === userId && r.month === month));
        d.ratings.unshift({ id: uid(), userId, month, points, note, by: meRef.current?.id || "", ts: new Date().toISOString() });
        const u = userById(d, userId);
        notify(d, userId, `Оценка за ${month}: ${points} баллов${note ? " — " + note : ""}`);
        audit(d, who(), "Оценки", `${u?.name || "?"}: ${month} — ${points} баллов`);
      });
    },
    archiveUser(id, reason, tone, note) {
      const u = userById(db, id);
      if (!u) return "Не найден";
      if (u.role === "superadmin") return "Суперадмина архивировать нельзя";
      up((d) => {
        const x = d.users.find((y) => y.id === id)!;
        x.active = false;
        x.archived = true;
        x.archivedAt = new Date().toISOString();
        x.archiveReason = reason;
        x.archiveTone = tone;
        x.archiveNote = note;
        audit(d, who(), "Архив", `${u.name}: перемещён в архив (${reason}, ${tone === "pos" ? "положительно" : tone === "neg" ? "отрицательно" : "нейтрально"})`);
      });
      return null;
    },
    restoreUser(id) {
      up((d) => {
        const x = d.users.find((y) => y.id === id);
        if (x) {
          x.active = true;
          x.archived = false;
          audit(d, who(), "Архив", `${x.name} восстановлен из архива`);
        }
      });
    },
    hardDeleteUser(id) {
      const u = userById(db, id);
      if (!u) return "Не найден";
      if (meRef.current?.role !== "superadmin") return "Полное удаление доступно только суперадмину";
      if (!u.archived) return "Сначала переместите сотрудника в архив";
      const days = (Date.now() - new Date(u.archivedAt || 0).getTime()) / 86400000;
      if (days < 30) return `Защита от ошибок: с момента архивации должно пройти 30 дней (осталось ${Math.ceil(30 - days)} дн.)`;
      up((d) => {
        d.users = d.users.filter((x) => x.id !== id);
        d.punches = d.punches.filter((x) => x.userId !== id);
        d.schedule = d.schedule.filter((x) => x.userId !== id);
        d.requests = d.requests.filter((x) => x.userId !== id && x.targetUserId !== id);
        d.fines = d.fines.filter((x) => x.userId !== id);
        d.ratings = d.ratings.filter((x) => x.userId !== id);
        audit(d, who(), "Архив", `${u.name} удалён из архива безвозвратно (по истечении 30 дней)`);
      });
      return null;
    },
    createPeriod(kind, from, to, label, status) {
      up((d) => {
        const st = status || "open";
        d.periods.unshift({ id: uid(), kind, from, to, label, status: st, approvedBy: st !== "open" ? meRef.current?.id : undefined, ts: new Date().toISOString() });
        audit(d, who(), "Расчёты", `Расчётный период «${label}» (${from} — ${to})${st === "approved" ? " — подтверждён и передан бухгалтерии" : ""}`);
        if (st === "approved")
          d.users.filter((x) => x.role === "accountant").forEach((a) =>
            notify(d, a.id, `Период «${label}» подтверждён администратором — расчёты доступны в разделе «Расчёты»`));
      });
    },
    setPeriodStatus(id, status) {
      up((d) => {
        const p = d.periods.find((x) => x.id === id);
        if (!p) return;
        p.status = status;
        if (status !== "open") p.approvedBy = meRef.current?.id;
        audit(d, who(), "Расчёты", `Период «${p.label}»: статус ${status === "approved" ? "подтверждён" : status === "paid" ? "выплачен" : "открыт"}`);
        if (status === "approved")
          d.users.filter((x) => x.role === "accountant").forEach((a) =>
            notify(d, a.id, `Период «${p.label}» подтверждён администратором — расчёты доступны в разделе «Расчёты»`));
      });
    },
    toggleFav(postId) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        const p = d.posts.find((x) => x.id === postId);
        if (!p) return;
        p.favs = p.favs || [];
        p.favs = p.favs.includes(me.id) ? p.favs.filter((x) => x !== me.id) : [...p.favs, me.id];
      });
    },
    setPunchPlan(punchId, plannedOut) {
      up((d) => {
        const p = d.punches.find((x) => x.id === punchId);
        if (!p) return;
        p.plannedOut = plannedOut;
        const u = userById(d, p.userId);
        audit(d, who(), "Табель", `${u?.name || "?"}: план вне графика — работать до ${fmtMin(plannedOut)}`);
        d.users.filter((x) => x.role !== "employee").forEach((a) =>
          notify(d, a.id, `${u?.name || "?"} вне графика: планирует работать до ${fmtMin(plannedOut)}. Если не отметится — смена закроется по плану. ${d.settings.camNote}`));
      });
    },
    async serverHealth() {
      try {
        const r = await fetch("./api/health", { cache: "no-store" });
        if (!r.ok) return { ok: false };
        const j = await r.json();
        return { ok: true, ...j };
      } catch {
        return { ok: false };
      }
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// сжатие изображения для вложений
export async function shrinkImage(file: File, maxW: number): Promise<string> {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = rej;
    rd.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const k = Math.min(1, maxW / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  });
}

export { addDaysKey };
