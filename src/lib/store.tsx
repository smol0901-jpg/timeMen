import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DB, User, Device, ModuleId, Punch, ShiftCell, ShiftType, WorkRequest, RequestKind,
  Settings, PermMatrix, Role, Workshop, Position, Product, PayPeriod, Attachment, ScheduleEvent, PayMode,
  LiveKind, LiveMove, LiveGame,
} from "./types";
import { applyMove, initBoard, KIND_LABEL_LIVE } from "./games";
import { SHIFT_META, defaultPerms } from "./types";
import {
  todayKey, nowMin, uid, rangeKeys, fmtMin, fmtDur, fmtDurH, fmtDateFull, addDaysKey, monthTitle,
  monthStart, monthEnd, daysInMonth, weekdayIdx,
} from "./time";

const DB_KEY = "smenalan.db.v8";
const SES_KEY = "smenalan.session.v3";
const RECOVERY_CODE_B64 = "TkVVUkFMX0FSQ0hJVEVDVF9QUkVNSVVNKys=";

// ---------- seed ----------
export function makeSeed(): DB {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const tk = todayKey();
  const root: User = {
    id: "u-root", username: "root", password: "root", name: "Суперадминистратор", role: "superadmin",
    workshopId: null, positionId: null, payMode: "hour", rate: 0, shiftCost: 0, avatar: null, color: "#171b22",
    bio: "Полный контроль системы. Резервный код восстановления хранится в зашифрованном виде.",
    active: true, createdAt: iso(now),
    info: { phone: "", email: "", birth: "", address: "", emergency: "", hiredAt: tk, docNote: "" },
  };
  const buh: User = {
    id: "u-buh", username: "buh", password: "1234", name: "Бухгалтер Светлана", role: "accountant",
    workshopId: null, positionId: null, payMode: "hour", rate: 0, shiftCost: 0, avatar: null, color: "#7a4fbf",
    bio: "Расчёты появляются здесь после подтверждения периода администратором.",
    active: true, createdAt: iso(now),
    info: { phone: "", email: "", birth: "", address: "", emergency: "", hiredAt: tk, docNote: "" },
  };
  const demo: User = {
    id: "u-demo", username: "demo", password: "", name: "Демо Сотрудник", role: "employee",
    workshopId: "w-meat", positionId: "p-deboner", payMode: "piece", rate: 0, shiftCost: 0, avatar: null, color: "#e56f24",
    bio: "Песочница для демонстрации. Сотрудников создаёт админ.",
    active: true, createdAt: iso(now),
    info: { phone: "+7 900 000-00-00", email: "demo@prodlan.ru", birth: "", address: "", emergency: "", hiredAt: tk, docNote: "Документы в отделе кадров" },
  };
  const mk = tk.slice(0, 7);
  const schedule: ShiftCell[] = [];
  for (let d = 1; d <= daysInMonth(mk + "-01"); d++) {
    const date = `${mk}-${String(d).padStart(2, "0")}`;
    if (weekdayIdx(date) < 5) schedule.push({ userId: "u-demo", date, type: "day" });
  }
  return {
    v: 8,
    users: [root, buh, demo],
    workshops: [
      { id: "w-1", name: "Цех №1 — линия", piecework: false, color: "#3f6d9e" },
      { id: "w-meat", name: "Мясной цех — обвалка птицы", piecework: true, color: "#c74436" },
    ],
    positions: [
      { id: "p-op", name: "Оператор линии", normH: 8, defPay: "hour", rate: 320, shiftCost: 0 },
      { id: "p-master", name: "Мастер смены", normH: 8, defPay: "hour", rate: 450, shiftCost: 0 },
      { id: "p-deboner", name: "Обвальщик птицы", normH: 12, defPay: "piece", rate: 0, shiftCost: 0 },
      { id: "p-pack", name: "Упаковщик", normH: 8, defPay: "shift", rate: 0, shiftCost: 2600 },
      { id: "p-guard", name: "Охранник (сутки)", normH: 24, defPay: "shift", rate: 0, shiftCost: 3800 },
    ],
    punches: [],
    schedule,
    products: [
      { id: "pr-bird", name: "Птица (приёмка)", unit: "кг", price: 0, workshopId: "w-meat", hidden: false, sort: 1 },
      { id: "pr-file", name: "Филе", unit: "кг", price: 180, workshopId: "w-meat", hidden: false, sort: 2 },
      { id: "pr-wing", name: "Крыло", unit: "кг", price: 95, workshopId: "w-meat", hidden: false, sort: 3 },
      { id: "pr-carcass", name: "Каркас", unit: "кг", price: 25, workshopId: "w-meat", hidden: false, sort: 4 },
      { id: "pr-skin", name: "Кожа", unit: "кг", price: 40, workshopId: "w-meat", hidden: false, sort: 5 },
      { id: "pr-bone", name: "Кость трубчатая", unit: "кг", price: 15, workshopId: "w-meat", hidden: false, sort: 6 },
    ],
    production: [],
    threads: [],
    messages: [],
    reminders: [],
    events: [],
    requests: [],
    posts: [
      {
        id: uid(), userId: "u-root", pinned: true, ts: iso(now),
        text: "Добро пожаловать в «СменаЛАН»!\n\nКорпоративная стена: новости, фото, ссылки, файлы. ИИ-бот принимает поручения в разделе «ИИ-бот и скрипты». Групповые чаты цехов — в «Сообщениях».",
        image: null, attachments: [], link: null, bg: "g1", animated: true, likes: [], comments: [],
      },
    ],
    notices: [{ id: uid(), audience: "all", text: "Система запущена. root / root · buh / 1234 · demo без пароля.", ts: iso(now), readBy: [] }],
    audit: [{ id: uid(), ts: iso(now), actor: "система", action: "Система", details: "Инициализация базы v7" }],
    games: [{ id: uid(), name: "Косынка (браузер)", url: "https://cardgames.io/solitaire/" }],
    scores: [],
    challenges: [],
    sensors: [],
    fines: [],
    ratings: [],
    periods: [],
    camshots: [],
    scripts: [
      {
        id: uid(), name: "Утренний бриф", enabled: true, ts: iso(now),
        lines: ["кто на смене", "неделя", "опоздания"],
      },
    ],
    liveGames: [],
    settings: {
      orgName: "ООО «Продлайн»", orgInn: "ИНН 7701234567 · КПП 770101001", orgAddress: "г. Пролетарск, ул. Заводская, 14",
      dailyNorm: 8, breakMin: 45, overtimeK: 1.5, kioskFree: true, adminPin: "1234",
      aiMode: "std", ollamaOn: false, ollamaUrl: "http://localhost:11434", ollamaModel: "llama3", apiToken: "",
      kioskTheme: "steel", bestUserId: null, bestOn: true, camNote: "проверьте записи камер",
      camOn: true, camMirror: true, camFlash: true, camOnOut: false, camQuality: 0.7,
      camBio: true, camAutoTune: true, camThreshold: 0.58,
      tgToken: "", tgChat: "", tgEvents: ["request", "schedule", "resolution"],
      announcement: "",
    },
    perms: defaultPerms(),
  };
}

// ---------- авто-идентификаторы ----------
const LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch",
  ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
export function translit(s: string): string {
  return s.toLowerCase().split("").map((c) => (LAT[c] !== undefined ? LAT[c] : c)).join("").replace(/[^a-z0-9]/g, "");
}
export function genEmpNo(db: DB): string {
  const max = db.users.reduce((m, u) => Math.max(m, Number(u.empNo) || 10000), 10000);
  return String(max + 1);
}
export function makeLogin(db: DB, name: string, workshopId: string | null): string {
  const surname = translit((name.trim().split(/\s+/)[0] || "user")).slice(0, 7) || "user";
  const wsIdx = workshopId ? Math.max(0, db.workshops.findIndex((w) => w.id === workshopId)) + 1 : 0;
  const d = new Date();
  const base = `${surname}${wsIdx ? "-c" + wsIdx : ""}-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`.slice(0, 15);
  let login = base;
  let i = 2;
  while (db.users.some((x) => x.username.toLowerCase() === login.toLowerCase())) login = `${base}-${i++}`;
  return login;
}
export function makeBarcode(empNo: string): string { return `SL1:${empNo}`; }

function migrate(d: DB): DB {
  const seed = makeSeed();
  const out: DB = { ...seed, ...d, v: 8 } as DB;
  (["workshops", "positions", "punches", "schedule", "products", "production", "threads", "messages", "reminders",
    "events", "requests", "posts", "notices", "audit", "games", "scores", "challenges", "sensors", "fines",
    "ratings", "periods", "camshots", "scripts"] as const).forEach((k) => {
    if (!Array.isArray((out as never as Record<string, unknown>)[k])) (out as never as Record<string, unknown[]>)[k] = [];
  });
  out.settings = { ...seed.settings, ...(d.settings || {}) };
  if (!Array.isArray(out.liveGames)) out.liveGames = [];
  // обратное заполнение новых полей пользователей
  let nextNo = out.users.reduce((m, u) => Math.max(m, Number(u.empNo) || 10000), 10000);
  out.users = out.users.map((u) => {
    const empNo = u.empNo || String(++nextNo);
    return { ...u, empNo, barcode: u.barcode || makeBarcode(empNo), favs: u.favs || [], notes: u.notes || "", faceEmbedding: u.faceEmbedding ?? null };
  });
  if (!d.perms || !d.perms.punch || !d.perms.punch.foreman) out.perms = defaultPerms();
  if (!out.users.some((u) => u.id === "u-root")) out.users.unshift(seed.users[0]);
  out.camshots = out.camshots.filter((c) => Date.now() - new Date(c.ts).getTime() < 120 * 86400000).slice(0, 1500);
  return out;
}

function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && (d.v === 8 || d.v === 7 || d.v === 6 || d.v === 5) && Array.isArray(d.users) && d.users.some((u: User) => u.id === "u-root"))
        return migrate(d as DB);
    }
  } catch { /* ignore */ }
  return migrate(makeSeed());
}

// ---------- чистые расчёты ----------
export function userById(db: DB, id: string): User | undefined { return db.users.find((u) => u.id === id); }
export function userByLogin(db: DB, login: string): User | undefined { return db.users.find((u) => u.username.toLowerCase() === login.trim().toLowerCase()); }
export function wsName(db: DB, id: string | null): string { return db.workshops.find((w) => w.id === id)?.name || "—"; }
export function posName(db: DB, id: string | null): string { return db.positions.find((p) => p.id === id)?.name || "—"; }
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
  return db.punches.filter((p) => p.userId === userId && p.date === date).reduce((s, p) => s + punchDur(p, db.settings.breakMin, live), 0);
}
export function plannedOn(db: DB, userId: string, date: string): number {
  const c = db.schedule.find((s) => s.userId === userId && s.date === date);
  return c ? SHIFT_META[c.type].planned : 0;
}
export function finesOf(db: DB, userId: string, from: string, to: string): number {
  return db.fines.filter((f) => f.userId === userId && f.ts.slice(0, 10) >= from && f.ts.slice(0, 10) <= to).reduce((s, f) => s + f.amount, 0);
}
function payFor(db: DB, user: User, factMin: number, otMin: number, shifts: number) {
  if (user.payMode === "shift") return shifts * user.shiftCost;
  const base = (factMin / 60) * user.rate;
  return base + (otMin / 60) * user.rate * (db.settings.overtimeK - 1);
}
export function pieceSumOf(db: DB, userId: string, from: string, to: string): number {
  return db.production.filter((r) => r.userId === userId && r.date >= from && r.date <= to)
    .reduce((s, r) => s + r.qty * (db.products.find((p) => p.id === r.productId)?.price || 0), 0);
}
export interface SumRow {
  user: User; planMin: number; factMin: number; otMin: number; shortMin: number; late: number;
  days: number; shifts: number; pieceSum: number; salary: number; fineSum: number; net: number;
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
  const gross = user.payMode === "piece" ? piece : payFor(db, user, fact, ot, days);
  const fineSum = finesOf(db, user.id, from, to);
  return { user, planMin: plan, factMin: fact, otMin: ot, shortMin: short, late, days, shifts: days, pieceSum: piece, salary: gross, fineSum, net: gross - fineSum };
}
export function summarizeAll(db: DB, from: string, to: string, workshopId?: string | null): SumRow[] {
  return db.users
    .filter((u) => u.role === "employee" && u.active && !u.archived && (workshopId === undefined || workshopId === null || u.workshopId === workshopId))
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
export function wallPulse(db: DB) {
  const week = rangeKeys(addDaysKey(todayKey(), -6), todayKey());
  const recent = db.posts.filter((p) => week.includes(p.ts.slice(0, 10)));
  const byAuthor = new Map<string, number>();
  recent.forEach((p) => byAuthor.set(p.userId, (byAuthor.get(p.userId) || 0) + 1));
  const top = [...byAuthor.entries()].sort((a, b) => b[1] - a[1])[0];
  const byDay = new Map<string, number>();
  recent.forEach((p) => byDay.set(p.ts.slice(0, 10), (byDay.get(p.ts.slice(0, 10)) || 0) + 1));
  const peak = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const eng = recent.reduce((s, p) => s + p.likes.length + p.comments.length, 0);
  const lines: string[] = [];
  lines.push(recent.length ? `За 7 дней на стене ${recent.length} записей, вовлечённость ${eng} (лайки + комментарии).` : "За неделю записей не было — стена ждёт активности.");
  if (top) lines.push(`Самый активный автор: ${userById(db, top[0])?.name || "?"} (${top[1]} зап.).`);
  if (peak) lines.push(`Пик активности: ${fmtDateFull(peak[0])}.`);
  const media = recent.filter((p) => p.image || p.attachments.length).length;
  if (media) lines.push(`Медиа-контент: ${media} из ${recent.length} записей содержат фото или файлы.`);
  return { posts7: recent.length, engagement: eng, lines, topAuthor: top ? userById(db, top[0]) : null };
}
export function careerData(db: DB, u: User) {
  const start = new Date(u.createdAt);
  const now = new Date();
  const out: { m: string; hours: number; shifts: number; points: number | null; pay: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= now && out.length < 60) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const ps = db.punches.filter((p) => p.userId === u.id && p.date.startsWith(key));
    const hours = Math.round(ps.reduce((s, p) => s + punchDur(p, db.settings.breakMin), 0) / 60 * 10) / 10;
    const shifts = new Set(ps.map((p) => p.date)).size;
    const r = db.ratings.find((x) => x.userId === u.id && x.month === key);
    out.push({ m: key, hours, shifts, points: r ? r.points : null, pay: Math.round(summarize(db, u, `${key}-01`, `${key}-31`).salary) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

// ---------- контекст ----------
interface StoreApi {
  db: DB; me: User | null; online: boolean; serverVer: number;
  login: (username: string, password: string) => string | null;
  recoverRoot: (code: string) => boolean;
  logout: () => void;
  punch: (source: Punch["source"]) => "UNSCHEDULED" | string | null;
  punchOut: () => string | null;
  kioskPunch: (userId: string, source?: "kiosk" | "scanner") => { dir: "in" | "out"; punchId: string } | null;
  setPunchTout: (punchId: string, tout: number, confirm: boolean) => void;
  confirmPunch: (punchId: string) => void;
  setPunchPlan: (punchId: string, plannedOut: number) => void;
  addUser: (u: Omit<User, "id" | "createdAt" | "avatar"> & { avatar?: string | null }) => string | null;
  updateUser: (id: string, patch: Partial<User>) => string | null;
  archiveUser: (id: string, reason: string, tone: "pos" | "neg" | "neutral", note: string) => string | null;
  restoreUser: (id: string) => void;
  hardDeleteUser: (id: string) => string | null;
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
  fillPattern: (userId: string, monthKey: string, pattern: "5/2" | "2/2" | "3/3" | "clear" | "all", night: boolean, comment?: string, offset?: number) => void;
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
  toggleFav: (postId: string) => void;
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
  addChallenge: (game: string, toUserId: string) => void;
  submitChallenge: (id: string, score: number) => void;
  postChallengeResult: (id: string) => void;
  markNoticesRead: () => void;
  setPerm: (mod: ModuleId, role: Role, device: Device, val: boolean) => void;
  setSettings: (patch: Partial<Settings>) => void;
  importAll: (d: DB) => string | null;
  uploadAttachment: (f: File) => Promise<Attachment>;
  askOllama: (prompt: string) => Promise<string>;
  can: (mod: ModuleId, device: Device) => boolean;
  addFine: (userId: string, amount: number, reason: string, periodId: string | null) => void;
  removeFine: (id: string) => void;
  addRating: (userId: string, month: string, points: number, note: string) => void;
  createPeriod: (kind: PayPeriod["kind"], from: string, to: string, label: string, status?: PayPeriod["status"]) => void;
  setPeriodStatus: (id: string, status: PayPeriod["status"]) => void;
  addCamShot: (punchId: string | null, userId: string, src: string, dir: "in" | "out") => void;
  setCamStatus: (id: string, status: "ok" | "bad", note?: string) => void;
  deleteCamShot: (id: string) => void;
  addScript: (name: string) => string;
  updateScript: (id: string, patch: Partial<{ name: string; lines: string[]; enabled: boolean }>) => void;
  deleteScript: (id: string) => void;
  botSay: (text: string) => string;
  runScript: (id: string) => string[];
  sendTelegram: (text: string) => Promise<boolean>;
  serverHealth: () => Promise<{ ok: boolean; version?: number; uptime_sec?: number; port?: number; db_kb?: number; backups?: { name: string; size_kb: number }[]; tunnel?: string | null; autostart?: boolean; wal?: boolean; priority?: boolean }>;
  // избранное, биометрия, онлайн-игры, сервер
  toggleFavMod: (mod: ModuleId) => void;
  updateUserFace: (userId: string, emb: number[] | null, silent?: boolean) => void;
  createLiveGame: (kind: LiveKind, toUserId: string | null) => string;
  joinLiveGame: (id: string) => string | null;
  liveMove: (id: string, move: Omit<LiveMove, "p">) => string | null;
  resignLive: (id: string) => void;
  serverRestart: () => Promise<boolean>;
  serverAutostart: (on: boolean) => Promise<boolean>;
  serverTunnel: () => Promise<{ url: string | null; available: boolean }>;
  downloadFaceModels: () => Promise<boolean>;
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

  // реальное время
  useEffect(() => {
    let cancelled = false;
    const fetchDb = async () => {
      const r = await fetch("./api/db", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.data && j.data.v === 8 && typeof j.version === "number" && !cancelled) {
        verRef.current = j.version;
        dirtyRef.current = false;
        setDb(j.data as DB);
      }
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
          const p = await fetch("./api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: dbRef.current, version: verRef.current + 1 }) }).catch(() => null);
          if (p?.ok) { verRef.current++; setServerVer(verRef.current); }
        }
      } catch { if (!cancelled) setOnline(false); }
    };
    sync();
    const t = setInterval(sync, 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // локальное сохранение + отправка
  useEffect(() => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { console.warn("Хранилище переполнено"); }
    if (!onlineRef.current) return;
    const t = setTimeout(async () => {
      dirtyRef.current = true;
      const version = verRef.current + 1;
      try {
        const r = await fetch("./api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: db, version }) });
        if (r.ok) { verRef.current = version; dirtyRef.current = false; setServerVer(version); }
      } catch { /* офлайн */ }
    }, 300);
    return () => clearTimeout(t);
  }, [db]);

  // автозакрытие смен
  useEffect(() => {
    const me = meRef.current;
    if (!me || (me.role !== "superadmin" && me.role !== "admin")) return;
    const tk = todayKey();
    const nm = nowMin();
    const openAll = db.punches.filter((p) => p.tout === null);
    const stale = openAll.filter((p) => p.date < tk || (p.date === tk && nm >= 240));
    const byPlan = openAll.filter((p) => p.plannedOut != null && !stale.includes(p) && (p.date < tk || nm >= p.plannedOut!));
    if (stale.length === 0 && byPlan.length === 0) return;
    setDb((prev) => {
      const d: DB = JSON.parse(JSON.stringify(prev));
      for (const sp of stale) {
        const p = d.punches.find((x) => x.id === sp.id);
        if (!p || p.tout !== null) continue;
        const cell = d.schedule.find((s) => s.userId === p.userId && s.date === p.date);
        const u = userById(d, p.userId);
        if (cell && (cell.type === "day" || cell.type === "night")) {
          p.tout = SHIFT_META[cell.type].end; p.source = "auto"; p.auto = "schedule";
          d.audit.unshift({ id: uid(), ts: new Date().toISOString(), actor: "система", action: "Табель", details: `${u?.name || "?"}: смена ${p.date} закрыта по графику (${fmtMin(p.tout)})` });
        } else {
          p.tout = 1439; p.source = "auto"; p.auto = "unscheduled"; p.resolution = "pending";
          d.requests.unshift({ id: uid(), userId: p.userId, kind: "resolution", date: p.date, note: "Вне графика: смена закрыта в 23:59 автоматически.", status: "pending", createdAt: new Date().toISOString(), punchId: p.id });
          d.notices.unshift({ id: uid(), audience: p.userId, text: `Смена за ${fmtDateFull(p.date)} закрыта автоматически (23:59). Подтвердите время ухода в «Заявках».`, ts: new Date().toISOString(), readBy: [] });
          d.users.filter((x) => x.role !== "employee").forEach((a) => d.notices.unshift({ id: uid(), audience: a.id, text: `${u?.name || "?"}: внеплановая смена требует подтверждения. ${d.settings.camNote}`, ts: new Date().toISOString(), readBy: [] }));
          pushTg(d, "resolution", `⚠ ${u?.name || "?"}: внеплановая смена ${p.date} требует подтверждения (${d.settings.camNote})`);
        }
      }
      for (const sp of byPlan) {
        const p = d.punches.find((x) => x.id === sp.id);
        if (!p || p.tout !== null || p.plannedOut == null) continue;
        const po = p.plannedOut as number;
        p.tout = po; p.source = "auto"; p.auto = "unscheduled"; p.resolution = "pending";
        const u = userById(d, p.userId);
        d.requests.unshift({ id: uid(), userId: p.userId, kind: "resolution", date: p.date, note: `Вне графика: закрыта по плану до ${fmtMin(po)}.`, status: "pending", createdAt: new Date().toISOString(), punchId: p.id });
        d.notices.unshift({ id: uid(), audience: p.userId, text: `Смена за ${fmtDateFull(p.date)} закрыта по вашему плану (${fmtMin(po)}). Подтвердите в «Заявках».`, ts: new Date().toISOString(), readBy: [] });
        d.users.filter((x) => x.role !== "employee").forEach((a) => d.notices.unshift({ id: uid(), audience: a.id, text: `${u?.name || "?"}: внеплановая смена закрыта по плану до ${fmtMin(po)}. ${d.settings.camNote}`, ts: new Date().toISOString(), readBy: [] }));
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
  function pushTg(d: DB, key: string, text: string) {
    const s = d.settings;
    if (!s.tgToken || !s.tgChat || !s.tgEvents.includes(key)) return;
    fetch(`https://api.telegram.org/bot${s.tgToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: s.tgChat, text }),
    }).catch(() => {});
  }
  const who = () => meRef.current?.name || "система";
  const pushEvent = (d: DB, userId: string, changes: ScheduleEvent["changes"], comment: string) => {
    if (changes.length === 0) return;
    d.events.unshift({ id: uid(), userId, ts: new Date().toISOString(), by: who(), changes, comment, readBy: [] });
    if (d.events.length > 500) d.events.length = 500;
    notify(d, userId, `График изменён (${changes.length} дн.)${comment ? ": " + comment : ""}. Откройте «График» — изменения подсвечены.`);
  };

  const api: StoreApi = {
    db, me: meRef.current, online, serverVer,
    login(username, password) {
      const u = db.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
      if (!u) return "Пользователь не найден";
      if (u.archived) return "Учётная запись в архиве";
      if (!u.active) return "Учётная запись отключена";
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
        if (r) { r.password = "root"; audit(d, "система", "Безопасность", "Пароль суперадмина восстановлен резервным кодом"); }
      });
      return true;
    },
    logout() { setMeId(null); localStorage.removeItem(SES_KEY); },
    punch(source) {
      const me = meRef.current;
      if (!me) return "Нет сессии";
      if (openPunchOf(db, me.id)) return "Смена уже открыта";
      const cell = db.schedule.find((s) => s.userId === me.id && s.date === todayKey());
      const off = !cell || cell.type === "off" || cell.type === "vacation" || cell.type === "sick";
      up((d) => {
        d.punches.push({ id: uid(), userId: me.id, date: todayKey(), tin: nowMin(), tout: null, source, auto: off ? "unscheduled" : null });
        audit(d, me.name, "Отметка", `${me.name} — начало смены (${fmtMin(nowMin())})${off ? " ВНЕ ГРАФИКА" : ""}`);
        if (off) d.users.filter((x) => x.role !== "employee").forEach((a) => notify(d, a.id, `⚠ ${me.name} вышел(ла) вне графика (${fmtMin(nowMin())}). ${d.settings.camNote}`));
      });
      return off ? "UNSCHEDULED" : null;
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
    kioskPunch(userId, source) {
      const u = userById(db, userId);
      if (!u || u.archived || !u.active) return null;
      // направление определяется строго по этому сотруднику (защита от «чужой» смены)
      const open = openPunchOf(db, userId);
      const dir: "in" | "out" = open ? "out" : "in";
      const punchId = open ? open.id : uid();
      const src = source || "kiosk";
      up((d) => {
        // атомарная перепроверка: у выбранного сотрудника может быть только одна открытая смена
        const cur = d.punches.find((q) => q.userId === userId && q.tout === null);
        if (cur) {
          cur.tout = nowMin();
          audit(d, src === "scanner" ? "сканер" : "терминал", "Отметка", `${u.name} — конец смены (${fmtMin(nowMin())})`);
        } else {
          d.punches.push({ id: punchId, userId, date: todayKey(), tin: nowMin(), tout: null, source: src, auto: d.schedule.some((s) => s.userId === userId && s.date === todayKey() && (s.type === "day" || s.type === "night")) ? null : "unscheduled" });
          audit(d, src === "scanner" ? "сканер" : "терминал", "Отметка", `${u.name} — начало смены (${fmtMin(nowMin())})`);
        }
      });
      return { dir, punchId };
    },
    setPunchTout(punchId, tout, confirm) {
      up((d) => {
        const p = d.punches.find((x) => x.id === punchId);
        if (!p) return;
        p.tout = tout;
        const u = userById(d, p.userId);
        if (confirm && p.resolution === "pending") p.resolution = "ok";
        audit(d, who(), "Табель", `${u?.name || "?"} ${p.date}: уход ${fmtMin(tout)}${confirm ? " (подтверждено)" : ""}`);
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
        notify(d, p.userId, `Смена за ${fmtDateFull(p.date)} подтверждена (${fmtDurH(punchDur(p, d.settings.breakMin))} ч).`);
        audit(d, who(), "Табель", `${u?.name || "?"} ${p.date}: часы подтверждены (${fmtDurH(punchDur(p, d.settings.breakMin))} ч)`);
      });
    },
    setPunchPlan(punchId, plannedOut) {
      up((d) => {
        const p = d.punches.find((x) => x.id === punchId);
        if (!p) return;
        p.plannedOut = plannedOut;
        const u = userById(d, p.userId);
        audit(d, who(), "Табель", `${u?.name || "?"}: план вне графика — до ${fmtMin(plannedOut)}`);
        d.users.filter((x) => x.role !== "employee").forEach((a) => notify(d, a.id, `${u?.name || "?"} вне графика: работает до ${fmtMin(plannedOut)}. ${d.settings.camNote}`));
      });
    },
    addUser(u) {
      if (!u.name.trim()) return "Укажите ФИО";
      // уникальность ФИО среди активных — иначе на терминале смена «открывается» нескольким под одним именем
      const sameName = db.users.find((x) => !x.archived && x.name.trim().toLowerCase() === u.name.trim().toLowerCase());
      if (sameName) return `Сотрудник с таким ФИО уже есть (${sameName.username}). Уточните имя, чтобы отметки были однозначными`;
      const empNo = genEmpNo(db);
      let username = u.username.trim();
      if (!username) username = makeLogin(db, u.name, u.workshopId);
      if (db.users.some((x) => x.username.toLowerCase() === username.toLowerCase())) return `Логин «${username}» уже занят — измените или оставьте пустым для автогенерации`;
      const barcode = makeBarcode(empNo);
      up((d) => {
        d.users.push({
          ...u, id: uid(), username, name: u.name.trim(), avatar: u.avatar ?? null, active: true, createdAt: new Date().toISOString(),
          empNo, barcode, favs: [] as ModuleId[], notes: "", faceEmbedding: null,
        } as unknown as User);
        audit(d, who(), "Сотрудники", `Создан ${u.name} (${username}, таб. № ${empNo}, ${u.role})`);
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
          if (patch.password !== undefined && patch.password !== u.password) audit(d, who(), "Безопасность", `${u.name}: сменён пароль`);
          if (patch.info) u.info = { ...(u.info || {}), ...patch.info };
          Object.assign(u, patch);
          audit(d, who(), "Сотрудники", `Изменён профиль: ${u.name}`);
        }
      });
      return null;
    },
    archiveUser(id, reason, tone, note) {
      const u = userById(db, id);
      if (!u) return "Не найден";
      if (u.role === "superadmin") return "Суперадмина архивировать нельзя";
      up((d) => {
        const x = d.users.find((y) => y.id === id)!;
        x.active = false; x.archived = true; x.archivedAt = new Date().toISOString();
        x.archiveReason = reason; x.archiveTone = tone; x.archiveNote = note;
        audit(d, who(), "Архив", `${u.name}: в архив (${reason}, ${tone})`);
      });
      return null;
    },
    restoreUser(id) {
      up((d) => {
        const x = d.users.find((y) => y.id === id);
        if (x) { x.active = true; x.archived = false; audit(d, who(), "Архив", `${x.name} восстановлен`); }
      });
    },
    hardDeleteUser(id) {
      const u = userById(db, id);
      if (!u) return "Не найден";
      if (meRef.current?.role !== "superadmin") return "Только суперадмин";
      if (!u.archived) return "Сначала в архив";
      const days = (Date.now() - new Date(u.archivedAt || 0).getTime()) / 86400000;
      if (days < 30) return `После архивации должно пройти 30 дней (осталось ${Math.ceil(30 - days)} дн.)`;
      up((d) => {
        d.users = d.users.filter((x) => x.id !== id);
        d.punches = d.punches.filter((x) => x.userId !== id);
        d.schedule = d.schedule.filter((x) => x.userId !== id);
        d.fines = d.fines.filter((x) => x.userId !== id);
        d.ratings = d.ratings.filter((x) => x.userId !== id);
        audit(d, who(), "Архив", `${u.name} удалён безвозвратно`);
      });
      return null;
    },
    addWorkshop(name, piecework, color) { up((d) => { d.workshops.push({ id: uid(), name, piecework, color }); audit(d, who(), "Оргструктура", `Цех «${name}»`); }); },
    updateWorkshop(id, patch) { up((d) => { const w = d.workshops.find((x) => x.id === id); if (w) { Object.assign(w, patch); audit(d, who(), "Оргструктура", `Цех «${w.name}» изменён`); } }); },
    removeWorkshop(id) {
      if (db.users.some((u) => u.workshopId === id)) return "В цехе есть сотрудники";
      up((d) => { const w = d.workshops.find((x) => x.id === id); d.workshops = d.workshops.filter((x) => x.id !== id); d.products.forEach((p) => { if (p.workshopId === id) p.workshopId = null; }); audit(d, who(), "Оргструктура", `Удалён цех «${w?.name}»`); });
      return null;
    },
    addPosition(p) { up((d) => { d.positions.push({ ...p, id: uid() }); audit(d, who(), "Оргструктура", `Должность «${p.name}» (${p.normH} ч)`); }); },
    updatePosition(id, patch) { up((d) => { const p = d.positions.find((x) => x.id === id); if (p) Object.assign(p, patch); }); },
    removePosition(id) {
      if (db.users.some((u) => u.positionId === id)) return "Должность занята";
      up((d) => { d.positions = d.positions.filter((x) => x.id !== id); });
      return null;
    },
    addProduct(p) { up((d) => { d.products.push({ ...p, id: uid(), sort: Math.max(0, ...d.products.map((x) => x.sort)) + 1 }); audit(d, who(), "Продукция", `Позиция «${p.name}» ${p.price} ₽/${p.unit}`); }); },
    updateProduct(id, patch) { up((d) => { const p = d.products.find((x) => x.id === id); if (p) { if (patch.price !== undefined && patch.price !== p.price) audit(d, who(), "Продукция", `«${p.name}»: цена → ${patch.price}`); Object.assign(p, patch); } }); },
    removeProduct(id) {
      if (db.production.some((r) => r.productId === id)) return "Есть выработка — скройте позицию";
      up((d) => { d.products = d.products.filter((x) => x.id !== id); });
      return null;
    },
    addProduction(productId, qty, date, note) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.production.unshift({ id: uid(), userId: me.id, date, productId, qty, note, ts: new Date().toISOString() });
        const p = d.products.find((x) => x.id === productId);
        audit(d, me.name, "Выработка", `${me.name}: ${p?.name || "?"} ${qty} ${p?.unit || ""}`);
      });
    },
    removeProduction(id) { up((d) => { d.production = d.production.filter((x) => x.id !== id); audit(d, who(), "Выработка", "Запись удалена"); }); },
    setShift(userId, date, type, comment) {
      up((d) => {
        const old = d.schedule.find((s) => s.userId === userId && s.date === date);
        const oldT = old?.type || null;
        if (oldT === type) return;
        d.schedule = d.schedule.filter((s) => !(s.userId === userId && s.date === date));
        if (type) d.schedule.push({ userId, date, type });
        const u = userById(d, userId);
        audit(d, who(), "График", `${u?.name || "?"} ${fmtDateFull(date)}: ${oldT ? SHIFT_META[oldT].code : "—"} → ${type ? SHIFT_META[type].code : "×"}`);
        pushEvent(d, userId, [{ date, from: oldT, to: type }], comment || "");
      });
    },
    fillPattern(userId, mk, pattern, night, comment, offset) {
      up((d) => {
        const prefix = mk.slice(0, 7);
        const before = new Map(d.schedule.filter((s) => s.userId === userId && s.date.startsWith(prefix)).map((s) => [s.date, s.type]));
        d.schedule = d.schedule.filter((s) => !(s.userId === userId && s.date.startsWith(prefix)));
        const changes: ScheduleEvent["changes"] = [];
        const dim = daysInMonth(mk + "-01");
        for (let day = 1; day <= dim; day++) {
          const key = `${prefix}-${String(day).padStart(2, "0")}`;
          const wd = weekdayIdx(key);
          const since = Math.floor(Date.parse(key) / 86400000) - (offset || 0);
          let work = false;
          if (pattern === "5/2") work = wd < 5;
          if (pattern === "2/2") work = ((since % 4) + 4) % 4 < 2;
          if (pattern === "3/3") work = ((since % 6) + 6) % 6 < 3;
          if (pattern === "all") work = true;
          if (work) {
            const t: ShiftType = night ? "night" : "day";
            d.schedule.push({ userId, date: key, type: t });
            if (before.get(key) !== t) changes.push({ date: key, from: before.get(key) || null, to: t });
          } else if (before.has(key) && pattern !== "clear") {
            changes.push({ date: key, from: before.get(key)!, to: null });
          }
        }
        if (pattern === "clear") before.forEach((t, k) => changes.push({ date: k, from: t, to: null }));
        const u = userById(d, userId);
        audit(d, who(), "График", `${u?.name || "?"}: «${pattern}» на ${monthTitle(mk + "-01")} (${changes.length} изм.)`);
        pushEvent(d, userId, changes, comment || `Шаблон «${pattern}»`);
      });
    },
    publishSchedule(mk) {
      up((d) => {
        notify(d, "all", `Опубликован график на ${monthTitle(mk + "-01")}. Изменения подсвечены в «Графике».`);
        audit(d, who(), "График", `График ${monthTitle(mk + "-01")} опубликован`);
        pushTg(d, "schedule", `📅 Опубликован график на ${monthTitle(mk + "-01")}`);
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
        perUser.forEach((changes, userId) => pushEvent(d, userId, changes, comment || "Импорт графика"));
        audit(d, who(), "График", `Импорт: ${valid.length} ячеек${missing.length ? `, неизвестны: ${missing.join(", ")}` : ""}`);
      });
      return { ok: valid.length, missing };
    },
    createRequest(kind, date, dateEnd, targetUserId, note) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.requests.unshift({ id: uid(), userId: me.id, kind, date, dateEnd, targetUserId, note, status: "pending", createdAt: new Date().toISOString() });
        const label = kind === "swap" ? "замена" : kind === "vacation" ? "отпуск" : "доп. смена";
        d.users.filter((u) => u.role !== "employee").forEach((a) => notify(d, a.id, `${me.name}: заявка — ${label} (${fmtDateFull(date)})`));
        audit(d, me.name, "Заявка", `${label} на ${fmtDateFull(date)}`);
        pushTg(d, "request", `📝 ${me.name}: заявка «${label}» на ${fmtDateFull(date)}`);
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
            pushEvent(d, rq.userId, [{ date: rq.date, from: null, to: "day" }], "Доп. смена одобрена");
          } else if (rq.kind === "swap" && rq.targetUserId) {
            const a = d.schedule.find((s) => s.userId === rq.userId && s.date === rq.date);
            const b = d.schedule.find((s) => s.userId === rq.targetUserId && s.date === rq.date);
            const at = a?.type, bt = b?.type;
            d.schedule = d.schedule.filter((s) => !(s.date === rq.date && (s.userId === rq.userId || s.userId === rq.targetUserId)));
            if (bt) d.schedule.push({ userId: rq.userId, date: rq.date, type: bt });
            if (at) d.schedule.push({ userId: rq.targetUserId!, date: rq.date, type: at });
            pushEvent(d, rq.userId, [{ date: rq.date, from: at || null, to: bt || null }], "Замена одобрена");
            pushEvent(d, rq.targetUserId!, [{ date: rq.date, from: bt || null, to: at || null }], "Замена одобрена (подменяете)");
          } else if (rq.kind === "resolution" && rq.punchId) {
            const p = d.punches.find((x) => x.id === rq.punchId);
            if (p) p.resolution = "ok";
          }
        }
        const label = rq.kind === "swap" ? "замена" : rq.kind === "vacation" ? "отпуск" : rq.kind === "resolution" ? "подтверждение" : "доп. смена";
        notify(d, rq.userId, `Заявка «${label}» ${approve ? "одобрена ✅" : "отклонена ❌"}${note ? ": " + note : ""}`);
        audit(d, me.name, "Заявка", `${approve ? "Одобрена" : "Отклонена"}: ${label} (${userById(d, rq.userId)?.name || "?"})`);
      });
    },
    addPost(text, image, link, bg, animated, attachments) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.posts.unshift({ id: uid(), userId: me.id, text, image, link, bg, animated, attachments: attachments || [], likes: [], comments: [], ts: new Date().toISOString(), pinned: false });
        audit(d, me.name, "Стена", "Новая запись");
      });
    },
    deletePost(id) { up((d) => { d.posts = d.posts.filter((p) => p.id !== id); audit(d, who(), "Стена", "Запись удалена"); }); },
    toggleLike(id) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { const p = d.posts.find((x) => x.id === id); if (p) p.likes = p.likes.includes(me.id) ? p.likes.filter((x) => x !== me.id) : [...p.likes, me.id]; });
    },
    addComment(id, text) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { const p = d.posts.find((x) => x.id === id); if (p) p.comments.push({ id: uid(), userId: me.id, text, ts: new Date().toISOString() }); });
    },
    togglePin(id) { up((d) => { const p = d.posts.find((x) => x.id === id); if (p) { p.pinned = !p.pinned; audit(d, who(), "Стена", p.pinned ? "Закреплено" : "Откреплено"); } }); },
    toggleFav(postId) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { const p = d.posts.find((x) => x.id === postId); if (!p) return; p.favs = p.favs || []; p.favs = p.favs.includes(me.id) ? p.favs.filter((x) => x !== me.id) : [...p.favs, me.id]; });
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
        memberIds.forEach((mId) => notify(d, mId, `Вы в группе «${name}»`));
        audit(d, me.name, "Сообщения", `Группа «${name}»`);
      });
      return id;
    },
    deleteThread(id) { up((d) => { d.threads = d.threads.filter((x) => x.id !== id); d.messages = d.messages.filter((m) => m.threadId !== id); }); },
    sendMessage(threadId, text, file) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.messages.push({ id: uid(), threadId, userId: me.id, text, file, ts: new Date().toISOString() });
        if (d.messages.length > 3000) d.messages = d.messages.slice(-3000);
        const t = d.threads.find((x) => x.id === threadId);
        t?.members.filter((m) => m !== me.id).forEach((m) => notify(d, m, `Сообщение ${t.kind === "group" ? "«" + t.name + "»" : me.name}: ${text.slice(0, 50) || "📎 файл"}`));
      });
    },
    addReminder(title, text, targetType, targetId, due) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.reminders.unshift({ id: uid(), title, text, targetType, targetId, due, createdBy: me.id, createdAt: new Date().toISOString(), doneBy: [] });
        d.users.filter((u) => (targetType === "all" ? true : targetType === "workshop" ? u.workshopId === targetId : targetType === "position" ? u.positionId === targetId : u.id === targetId))
          .forEach((u) => notify(d, u.id, `Напоминание к ${fmtDateFull(due)}: ${title}`));
        audit(d, me.name, "Напоминания", `«${title}» к ${fmtDateFull(due)}`);
      });
    },
    removeReminder(id) { up((d) => { d.reminders = d.reminders.filter((x) => x.id !== id); }); },
    markReminderDone(id) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { const r = d.reminders.find((x) => x.id === id); if (r && !r.doneBy.includes(me.id)) r.doneBy.push(me.id); });
    },
    addGameLink(name, url) { up((d) => { d.games.push({ id: uid(), name, url }); }); },
    removeGameLink(id) { up((d) => { d.games = d.games.filter((x) => x.id !== id); }); },
    addScore(game, score) {
      const me = meRef.current;
      if (!me) return;
      up((d) => { d.scores.unshift({ id: uid(), game, userId: me.id, score, ts: new Date().toISOString() }); if (d.scores.length > 500) d.scores.length = 500; });
    },
    addChallenge(game, toUserId) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        d.challenges.unshift({ id: uid(), game, from: me.id, to: toUserId, scoreFrom: null, scoreTo: null, ts: new Date().toISOString(), done: false });
        notify(d, toUserId, `${me.name} вызывает вас на дуэль: ${game}! Ответьте в «Играх».`);
        audit(d, me.name, "Игры", `Дуэль ${game} → ${userById(d, toUserId)?.name || "?"}`);
      });
    },
    submitChallenge(id, score) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        const c = d.challenges.find((x) => x.id === id);
        if (!c) return;
        if (me.id === c.from) c.scoreFrom = score;
        if (me.id === c.to) c.scoreTo = score;
        if (c.scoreFrom !== null && c.scoreTo !== null) {
          c.done = true;
          const w = c.scoreFrom === c.scoreTo ? null : c.scoreFrom > c.scoreTo ? c.from : c.to;
          [c.from, c.to].forEach((u) => notify(d, u, `Дуэль «${c.game}» завершена: ${c.scoreFrom} : ${c.scoreTo}. ${w ? "Победил " + (userById(d, w)?.name || "?") : "Ничья!"}`));
        }
      });
    },
    postChallengeResult(id) {
      const me = meRef.current;
      const c = db.challenges.find((x) => x.id === id);
      if (!me || !c) return;
      const w = c.scoreFrom === c.scoreTo ? null : (c.scoreFrom || 0) > (c.scoreTo || 0) ? c.from : c.to;
      const text = `🎮 Дуэль «${c.game}»: ${userById(db, c.from)?.name || "?"} ${c.scoreFrom} : ${c.scoreTo} ${userById(db, c.to)?.name || "?"}. ${w ? "Победа: " + (userById(db, w)?.name || "?") + "!" : "Ничья!"}`;
      up((d) => { d.posts.unshift({ id: uid(), userId: me.id, text, image: null, link: null, bg: "g3", animated: false, attachments: [], likes: [], comments: [], ts: new Date().toISOString(), pinned: false }); });
    },
    markNoticesRead() {
      const me = meRef.current;
      if (!me) return;
      up((d) => d.notices.forEach((n) => { if ((n.audience === "all" || n.audience === me.id) && !n.readBy.includes(me.id)) n.readBy.push(me.id); }));
    },
    setPerm(mod, role, device, val) {
      up((d) => { d.perms[mod][role][device] = val; audit(d, who(), "Права", `${mod}/${role}/${device} = ${val ? "вкл" : "выкл"}`); });
    },
    setSettings(patch) { up((d) => { Object.assign(d.settings, patch); audit(d, who(), "Настройки", "Изменены настройки"); }); },
    importAll(nd) {
      if (!nd || ![5, 6, 7].includes(nd.v) || !Array.isArray(nd.users) || !nd.users.some((u) => u.id === "u-root"))
        return "Файл не похож на копию «СменаЛАН»";
      setDb(migrate(nd));
      return null;
    },
    async uploadAttachment(f) {
      const isImg = f.type.startsWith("image/");
      let src = "";
      if (isImg) { try { src = await shrinkImage(f, 1280); } catch { src = ""; } }
      if (!src && f.size > 8 * 1024 * 1024) throw new Error("Файл больше 8 МБ");
      if (!src) src = await new Promise<string>((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(f); });
      if (onlineRef.current) {
        try {
          const r = await fetch("./api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, dataBase64: src.split(",")[1] }) });
          if (r.ok) { const j = await r.json(); if (j.url) src = j.url.startsWith("/") ? `.${j.url}` : j.url; }
        } catch { /* dataURL */ }
      }
      return { name: f.name, type: f.type || "файл", size: f.size, src };
    },
    async askOllama(prompt) {
      const s = db.settings;
      const r = await fetch(`${s.ollamaUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: s.ollamaModel, prompt, stream: false }),
      });
      if (!r.ok) throw new Error(`Ollama: ${r.status}`);
      const j = await r.json();
      return j.response || "Пустой ответ";
    },
    can(mod, device) {
      const me = meRef.current;
      if (!me) return false;
      if (me.role === "superadmin") return true;
      return !!db.perms[mod]?.[me.role]?.[device];
    },
    toggleFavMod(mod) {
      const me = meRef.current;
      if (!me) return;
      up((d) => {
        const u = d.users.find((x) => x.id === me.id);
        if (!u) return;
        const favs = u.favs || [];
        u.favs = favs.includes(mod) ? favs.filter((x) => x !== mod) : [...favs, mod];
      });
    },
    updateUserFace(userId, emb, silent) {
      up((d) => {
        const u = d.users.find((x) => x.id === userId);
        if (!u) return;
        u.faceEmbedding = emb;
        u.faceUpdatedAt = emb ? new Date().toISOString() : undefined;
        if (!silent) audit(d, who(), "Биометрия", `${u.name}: ${emb ? "обновлён вектор лица (самообучение)" : "биометрия сброшена"}`);
      });
    },
    createLiveGame(kind, toUserId) {
      const me = meRef.current!;
      const id = uid();
      up((d) => {
        d.liveGames = d.liveGames.filter((g) => g.status !== "done" || Date.now() - new Date(g.updatedAt).getTime() < 7 * 86400000);
        d.liveGames.unshift({
          id, kind, players: [me.id, toUserId], status: toUserId ? "waiting" : "waiting", turn: 0,
          board: initBoard(kind), moves: [], winner: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        if (toUserId) notify(d, toUserId, `${me.name} вызывает вас на дуэль: ${KIND_LABEL_LIVE[kind]}. Раздел «Онлайн-игры».`);
        audit(d, me.name, "Игры", `Создана партия ${KIND_LABEL_LIVE[kind]}`);
      });
      return id;
    },
    joinLiveGame(id) {
      const me = meRef.current!;
      const g = db.liveGames.find((x) => x.id === id);
      if (!g || g.status !== "waiting") return "Партия уже идёт или завершена";
      if (g.players[1] && g.players[1] !== me.id && g.players[0] !== me.id) return "Соперник уже назначен";
      up((d) => {
        const x = d.liveGames.find((y) => y.id === id);
        if (!x) return;
        if (x.players[0] === me.id) { x.players = [me.id, null]; }
        else x.players = [x.players[0], me.id];
        x.status = "play";
        x.updatedAt = new Date().toISOString();
        notify(d, x.players[0], `Партия «${KIND_LABEL_LIVE[x.kind]}» началась — ваш ход ${x.players[0] === me.id ? "первым" : "вторым"}.`);
        audit(d, me.name, "Игры", `Присоединился к партии ${KIND_LABEL_LIVE[x.kind]}`);
      });
      return null;
    },
    liveMove(id, move) {
      const me = meRef.current!;
      const g = db.liveGames.find((x) => x.id === id);
      if (!g || g.status !== "play") return "Партия не активна";
      const myIdx = g.players.indexOf(me.id);
      if (myIdx !== g.turn) return "Сейчас ход соперника";
      const res = applyMove(g.kind, g.board, { ...move, p: myIdx });
      if (!res) return "Такой ход невозможен";
      up((d) => {
        const x = d.liveGames.find((y) => y.id === id);
        if (!x) return;
        x.board = res.board;
        x.moves.push({ ...move, p: myIdx });
        x.turn = x.turn === 0 ? 1 : 0;
        x.updatedAt = new Date().toISOString();
        if (res.done) {
          x.status = "done";
          x.winner = res.winnerIdx !== null ? x.players[res.winnerIdx] : null;
          const wname = x.winner ? userById(d, x.winner)?.name : null;
          audit(d, me.name, "Игры", `Партия ${KIND_LABEL_LIVE[x.kind]} завершена${wname ? `, победил ${wname}` : ", ничья"}`);
          d.scores.unshift({ id: uid(), game: KIND_LABEL_LIVE[x.kind], userId: x.winner || me.id, score: 1, ts: new Date().toISOString() });
          d.scores = d.scores.slice(0, 200);
          x.players.forEach((pid) => { if (pid) notify(d, pid, `Партия «${KIND_LABEL_LIVE[x.kind]}» завершена: ${wname ? "победил " + wname : "ничья"}.`); });
        }
      });
      return null;
    },
    resignLive(id) {
      const me = meRef.current!;
      up((d) => {
        const x = d.liveGames.find((y) => y.id === id);
        if (!x || x.status !== "play") return;
        const myIdx = x.players.indexOf(me.id);
        x.status = "done";
        x.winner = x.players[myIdx === 0 ? 1 : 0] || null;
        x.updatedAt = new Date().toISOString();
        audit(d, me.name, "Игры", `Сдался в партии ${KIND_LABEL_LIVE[x.kind]}`);
        x.players.forEach((pid) => { if (pid) notify(d, pid, `${me.name} завершил партию «${KIND_LABEL_LIVE[x.kind]}».`); });
      });
    },
    async serverRestart() {
      try {
        const r = await fetch("./api/restart", { method: "POST", headers: { "Content-Type": "application/json", "X-API-Token": db.settings.apiToken || "" }, body: "{}" });
        return r.ok;
      } catch { return false; }
    },
    async serverAutostart(on) {
      try {
        const r = await fetch("./api/autostart", { method: "POST", headers: { "Content-Type": "application/json", "X-API-Token": db.settings.apiToken || "" }, body: JSON.stringify({ on }) });
        return r.ok;
      } catch { return false; }
    },
    async serverTunnel() {
      try {
        const r = await fetch("./api/tunnel", { cache: "no-store" });
        if (!r.ok) return { url: null, available: false };
        const j = await r.json();
        return { url: j.url || null, available: !!j.available };
      } catch { return { url: null, available: false }; }
    },
    async downloadFaceModels() {
      try {
        const r = await fetch("./api/models/download", { method: "POST", headers: { "Content-Type": "application/json", "X-API-Token": db.settings.apiToken || "" }, body: "{}" });
        return r.ok;
      } catch { return false; }
    },
    addFine(userId, amount, reason, periodId) {
      up((d) => {
        d.fines.unshift({ id: uid(), userId, amount, reason, periodId, createdBy: meRef.current?.id || "", ts: new Date().toISOString() });
        notify(d, userId, `Штраф ${amount.toLocaleString("ru-RU")} ₽: ${reason}`);
        audit(d, who(), "Штрафы", `${userById(d, userId)?.name || "?"}: ${amount} ₽ — ${reason}`);
      });
    },
    removeFine(id) { up((d) => { const f = d.fines.find((x) => x.id === id); d.fines = d.fines.filter((x) => x.id !== id); if (f) notify(d, f.userId, `Штраф ${f.amount} ₽ снят`); audit(d, who(), "Штрафы", "Штраф снят"); }); },
    addRating(userId, month, points, note) {
      up((d) => {
        d.ratings = d.ratings.filter((r) => !(r.userId === userId && r.month === month));
        d.ratings.unshift({ id: uid(), userId, month, points, note, by: meRef.current?.id || "", ts: new Date().toISOString() });
        notify(d, userId, `Оценка за ${month}: ${points} баллов${note ? " — " + note : ""}`);
        audit(d, who(), "Оценки", `${userById(d, userId)?.name || "?"}: ${month} = ${points}`);
      });
    },
    createPeriod(kind, from, to, label, status) {
      up((d) => {
        const st = status || "open";
        d.periods.unshift({ id: uid(), kind, from, to, label, status: st, approvedBy: st !== "open" ? meRef.current?.id : undefined, ts: new Date().toISOString() });
        audit(d, who(), "Расчёты", `Период «${label}»${st === "approved" ? " — передан бухгалтерии" : ""}`);
        if (st === "approved") d.users.filter((x) => x.role === "accountant").forEach((a) => notify(d, a.id, `Период «${label}» подтверждён — расчёты доступны`));
      });
    },
    setPeriodStatus(id, status) {
      up((d) => {
        const p = d.periods.find((x) => x.id === id);
        if (!p) return;
        p.status = status;
        if (status !== "open") p.approvedBy = meRef.current?.id;
        audit(d, who(), "Расчёты", `«${p.label}»: ${status}`);
        if (status === "approved") d.users.filter((x) => x.role === "accountant").forEach((a) => notify(d, a.id, `Период «${p.label}» подтверждён`));
      });
    },
    addCamShot(punchId, userId, src, dir) {
      up((d) => {
        const id = uid();
        d.camshots.unshift({ id, userId, punchId, ts: new Date().toISOString(), src, status: "new", dir });
        if (d.camshots.length > 1500) d.camshots.length = 1500;
        if (punchId) { const p = d.punches.find((x) => x.id === punchId); if (p) p.photo = id; }
        audit(d, "камера", "Снимки", `${userById(d, userId)?.name || "?"}: снимок при ${dir === "in" ? "приходе" : "уходе"} (хранение 120 дней)`);
      });
    },
    setCamStatus(id, status, note) {
      up((d) => {
        const c = d.camshots.find((x) => x.id === id);
        if (c) { c.status = status; c.checkedBy = meRef.current?.id; c.note = note || c.note; audit(d, who(), "Снимки", `Снимок ${status === "ok" ? "подтверждён" : "помечен"}`); }
      });
    },
    deleteCamShot(id) { up((d) => { d.camshots = d.camshots.filter((x) => x.id !== id); }); },
    addScript(name) {
      const id = uid();
      up((d) => {
        if (d.scripts.length >= 100) return;
        d.scripts.push({ id, name, enabled: true, lines: [], ts: new Date().toISOString() });
        audit(d, who(), "Бот", `Скрипт «${name}»`);
      });
      return id;
    },
    updateScript(id, patch) { up((d) => { const s = d.scripts.find((x) => x.id === id); if (s) Object.assign(s, patch); }); },
    deleteScript(id) { up((d) => { const s = d.scripts.find((x) => x.id === id); d.scripts = d.scripts.filter((x) => x.id !== id); if (s) audit(d, who(), "Бот", `Скрипт «${s.name}» удалён`); }); },
    botSay(text) {
      return botCommand(dbRef.current, text.trim(), up, notify, audit, pushTg, who());
    },
    runScript(id) {
      const s = db.scripts.find((x) => x.id === id);
      if (!s) return [];
      const out: string[] = [];
      for (const line of s.lines) {
        if (!line.trim()) continue;
        out.push(botCommand(dbRef.current, line.trim(), up, notify, audit, pushTg, who()));
      }
      up((d) => audit(d, who(), "Бот", `Скрипт «${s.name}»: ${s.lines.length} команд`));
      return out;
    },
    async sendTelegram(text) {
      const s = db.settings;
      if (!s.tgToken || !s.tgChat) return false;
      try {
        const r = await fetch(`https://api.telegram.org/bot${s.tgToken}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: s.tgChat, text }),
        });
        return r.ok;
      } catch { return false; }
    },
    async serverHealth() {
      try {
        const r = await fetch("./api/health", { cache: "no-store" });
        if (!r.ok) return { ok: false };
        const j = await r.json();
        return { ok: true, ...j };
      } catch { return { ok: false }; }
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// ---------- парсер команд ИИ-бота ----------
function botCommand(
  db: DB, text: string,
  up: (fn: (d: DB) => void) => void,
  notify: (d: DB, audience: string, text: string) => void,
  audit: (d: DB, actor: string, action: string, details: string) => void,
  pushTg: (d: DB, key: string, text: string) => void,
  actor: string,
): string {
  const low = text.toLowerCase();
  const parts = text.split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const byLogin = (l: string) => db.users.find((u) => u.username.toLowerCase() === l.replace("@", "").toLowerCase());
  const tk = todayKey();

  if (["помощь", "help", "команды"].includes(cmd)) {
    return "Команды бота:\n• кто на смене · опоздания · заявки · лучший · неделя\n• статистика <логин>\n• напомни <логин|all> <ГГГГ-ММ-ДД> <текст>\n• стена <текст> · личка <логин> <текст>\n• график <логин> <ГГГГ-ММ-ДД> <Я|Н|В|О|Б|->\n• замени <логин1> <логин2> <ГГГГ-ММ-ДД>\n• штраф <логин> <сумма> <причина> · оценка <логин> <баллы>\n• анализ стены · телеграм <текст> · скрипты";
  }
  if (cmd === "кто" || cmd === "смена" || low.startsWith("кто на смене")) {
    const on = db.punches.filter((p) => p.tout === null).map((p) => userById(db, p.userId)?.name || "?");
    return on.length ? `Сейчас на смене (${on.length}): ${on.join(", ")}` : "Сейчас на смене никого нет.";
  }
  if (cmd === "опоздания") {
    const late = db.punches.filter((p) => {
      const c = db.schedule.find((s) => s.userId === p.userId && s.date === p.date);
      return p.date === tk && c && (c.type === "day" || c.type === "night") && p.tin > SHIFT_META[c.type].start + 5;
    }).map((p) => `${userById(db, p.userId)?.name || "?"} (${fmtMin(p.tin)})`);
    return late.length ? `Опоздали сегодня: ${late.join(", ")}` : "Опозданий сегодня нет ✅";
  }
  if (cmd === "заявки") {
    const n = db.requests.filter((r) => r.status === "pending").length;
    return n ? `Ожидают решения: ${n} заявок. Раздел «Заявки».` : "Ожидающих заявок нет.";
  }
  if (cmd === "лучший") {
    const from = addDaysKey(tk, -13);
    const m = new Map<string, number>();
    db.production.filter((r) => r.date >= from).forEach((r) => m.set(r.userId, (m.get(r.userId) || 0) + r.qty));
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `Лучший по выработке за 2 недели: ${userById(db, top[0])?.name || "?"} — ${Math.round(top[1] * 10) / 10} кг.` : "Недостаточно данных о выработке.";
  }
  if (cmd === "неделя") {
    const days = rangeKeys(tk, addDaysKey(tk, 6));
    const rows = days.map((k) => {
      const n = db.schedule.filter((c) => c.date === k && (c.type === "day" || c.type === "night")).length;
      return `${k.slice(8)}: ${n}`;
    });
    const critical = days.filter((k) => db.schedule.filter((c) => c.date === k && (c.type === "day" || c.type === "night")).length < 2);
    return `Покрытие на 7 дней → ${rows.join(", ")} чел.\n${critical.length ? `⚠ Критично (<2 чел.): ${critical.map((k) => k.slice(8)).join(", ")}` : "Все дни покрыты ✅"}`;
  }
  if (cmd === "статистика") {
    const u = byLogin(parts[1] || "");
    if (!u) return "Укажите логин: статистика <логин>";
    const r = summarize(db, u, monthStart(tk), monthEnd(tk));
    return `${u.name}: план ${Math.round(r.planMin / 60 * 10) / 10} ч, факт ${Math.round(r.factMin / 60 * 10) / 10} ч, опозданий ${r.late}, смен ${r.shifts}, начислено ${Math.round(r.net)} ₽.`;
  }
  if (cmd === "напомни") {
    const whoArg = parts[1] || "all";
    const due = /^\d{4}-\d{2}-\d{2}$/.test(parts[2] || "") ? parts[2] : addDaysKey(tk, 1);
    const body = parts.slice(due === (parts[2] || "") ? 3 : 2).join(" ") || "Поручение от ИИ-бота";
    const target = whoArg === "all" ? { t: "all" as const, id: null } : byLogin(whoArg) ? { t: "user" as const, id: byLogin(whoArg)!.id } : { t: "all" as const, id: null };
    up((d) => {
      d.reminders.unshift({ id: uid(), title: body.slice(0, 60), text: body, targetType: target.t, targetId: target.id, due, createdBy: "", createdAt: new Date().toISOString(), doneBy: [] });
      d.users.filter((u) => (target.t === "all" ? true : u.id === target.id)).forEach((u) => notify(d, u.id, `🤖 Бот: напоминание к ${fmtDateFull(due)}: ${body}`));
      audit(d, actor, "Бот", `Напоминание: ${body}`);
    });
    return `Напоминание создано к ${fmtDateFull(due)}: «${body}»`;
  }
  if (cmd === "стена") {
    const body = parts.slice(1).join(" ");
    if (!body) return "Что написать на стену?";
    up((d) => { d.posts.unshift({ id: uid(), userId: "u-root", text: `🤖 ${body}`, image: null, link: null, bg: "g2", animated: false, attachments: [], likes: [], comments: [], ts: new Date().toISOString(), pinned: false }); audit(d, actor, "Бот", `Запись на стену: ${body.slice(0, 40)}`); });
    return "Записал на стену ✅";
  }
  if (cmd === "личка") {
    const u = byLogin(parts[1] || "");
    const body = parts.slice(2).join(" ");
    if (!u) return "Укажите логин: личка <логин> <текст>";
    if (!body) return "Что написать?";
    up((d) => {
      const ex = d.threads.find((t) => t.kind === "dm" && t.members.includes(u.id) && t.members.includes("u-root"));
      const tid = ex ? ex.id : uid();
      if (!ex) d.threads.push({ id: tid, kind: "dm", name: "", workshopId: null, members: ["u-root", u.id], createdBy: "u-root", createdAt: new Date().toISOString() });
      d.messages.push({ id: uid(), threadId: tid, userId: "u-root", text: `🤖 ${body}`, file: null, ts: new Date().toISOString() });
      notify(d, u.id, `🤖 Бот в личке: ${body.slice(0, 60)}`);
      audit(d, actor, "Бот", `Личка ${u.name}: ${body.slice(0, 40)}`);
    });
    return `Отправил в личку ${u.name} ✅`;
  }
  if (cmd === "график") {
    const u = byLogin(parts[1] || "");
    const date = parts[2] || "";
    const code = (parts[3] || "").toUpperCase();
    if (!u || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Формат: график <логин> <ГГГГ-ММ-ДД> <Я|Н|В|О|Б|->";
    const map: Record<string, ShiftType | null> = { "Я": "day", "Н": "night", "В": "off", "О": "vacation", "Б": "sick", "-": null };
    if (!(code in map)) return "Коды: Я Н В О Б -";
    up((d) => {
      const old = d.schedule.find((s) => s.userId === u.id && s.date === date);
      d.schedule = d.schedule.filter((s) => !(s.userId === u.id && s.date === date));
      if (map[code]) d.schedule.push({ userId: u.id, date, type: map[code]! });
      d.events.unshift({ id: uid(), userId: u.id, ts: new Date().toISOString(), by: "🤖 бот", changes: [{ date, from: old?.type || null, to: map[code] }], comment: "Изменено ИИ-ботом", readBy: [] });
      notify(d, u.id, `🤖 Бот изменил ваш график ${fmtDateFull(date)} → ${map[code] ? SHIFT_META[map[code]!].label : "снято"}`);
      audit(d, actor, "Бот", `График ${u.username} ${date} → ${code}`);
    });
    return `${u.name}: ${fmtDateFull(date)} → ${map[code] ? SHIFT_META[map[code]!].label : "ячейка очищена"} ✅`;
  }
  if (cmd === "замени") {
    const a = byLogin(parts[1] || ""), b = byLogin(parts[2] || "");
    const date = parts[3] || "";
    if (!a || !b || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Формат: замени <логин1> <логин2> <ГГГГ-ММ-ДД>";
    up((d) => {
      const ca = d.schedule.find((s) => s.userId === a.id && s.date === date);
      const cb = d.schedule.find((s) => s.userId === b.id && s.date === date);
      const at = ca?.type, bt = cb?.type;
      d.schedule = d.schedule.filter((s) => !(s.date === date && (s.userId === a.id || s.userId === b.id)));
      if (bt) d.schedule.push({ userId: a.id, date, type: bt });
      if (at) d.schedule.push({ userId: b.id, date, type: at });
      [a.id, b.id].forEach((id) => {
        d.events.unshift({ id: uid(), userId: id, ts: new Date().toISOString(), by: "🤖 бот", changes: [{ date, from: null, to: null }], comment: `Замена: ${a.name} ↔ ${b.name}`, readBy: [] });
        notify(d, id, `🤖 Бот поменял вас местами ${fmtDateFull(date)}: ${a.name} ↔ ${b.name}`);
      });
      audit(d, actor, "Бот", `Замена ${a.username} ↔ ${b.username} ${date}`);
    });
    return `Поменял: ${a.name} ↔ ${b.name} на ${fmtDateFull(date)} ✅`;
  }
  if (cmd === "штраф") {
    const u = byLogin(parts[1] || "");
    const amount = Number(parts[2]);
    const reason = parts.slice(3).join(" ") || "По решению руководства";
    if (!u || !amount) return "Формат: штраф <логин> <сумма> <причина>";
    up((d) => {
      d.fines.unshift({ id: uid(), userId: u.id, amount, reason, periodId: null, createdBy: "", ts: new Date().toISOString() });
      notify(d, u.id, `Штраф ${amount} ₽: ${reason}`);
      audit(d, actor, "Бот", `Штраф ${u.username}: ${amount} ₽`);
    });
    return `Штраф ${u.name}: ${amount} ₽ — ${reason}`;
  }
  if (cmd === "оценка") {
    const u = byLogin(parts[1] || "");
    const pts = Math.max(0, Math.min(100, Number(parts[2]) || 0));
    if (!u) return "Формат: оценка <логин> <0-100>";
    up((d) => {
      const month = tk.slice(0, 7);
      d.ratings = d.ratings.filter((r) => !(r.userId === u.id && r.month === month));
      d.ratings.unshift({ id: uid(), userId: u.id, month, points: pts, note: "от ИИ-бота", by: "", ts: new Date().toISOString() });
      notify(d, u.id, `Оценка за ${month}: ${pts} баллов`);
      audit(d, actor, "Бот", `Оценка ${u.username}: ${pts}`);
    });
    return `Оценка ${u.name} за ${tk.slice(0, 7)}: ${pts} баллов ✅`;
  }
  if (low.startsWith("анализ")) {
    const p = wallPulse(db);
    return `📊 Пульс стены:\n${p.lines.join("\n")}`;
  }
  if (cmd === "телеграм") {
    const body = parts.slice(1).join(" ") || "Тестовое сообщение от «СменаЛАН»";
    if (!db.settings.tgToken || !db.settings.tgChat) return "Telegram не настроен: Настройки → Telegram (токен и chat_id).";
    fetch(`https://api.telegram.org/bot${db.settings.tgToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: db.settings.tgChat, text: `🤖 ${body}` }),
    }).catch(() => {});
    return `Отправил в Telegram: «${body}» ✅`;
  }
  if (cmd === "скрипты") {
    const list = db.scripts.map((s) => `• ${s.name} (${s.lines.length} команд) ${s.enabled ? "" : "[выкл]"}`).join("\n");
    return db.scripts.length ? `Скрипты бота:\n${list}` : "Скриптов нет — создайте в разделе «ИИ-бот и скрипты».";
  }
  return `Не понял команду «${cmd}». Напишите «помощь» — покажу весь список.`;
}

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

export { monthStart, monthEnd, addDaysKey, fmtDateFull };
