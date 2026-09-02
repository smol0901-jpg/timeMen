import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DB, User, Device, ModuleId, Punch, ShiftCell, ShiftType, WorkRequest,
  RequestKind, Settings, PermMatrix, Role,
} from "./types";
import { SHIFT_META } from "./types";
import { makeSeed } from "./seed";
import {
  todayKey, nowMin, uid, rangeKeys, fmtMin, fmtDur, monthTitle, fmtDateFull, daysInMonth,
} from "./time";

const DB_KEY = "smenalan.db.v4";
const SES_KEY = "smenalan.session.v3";

function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 4 && Array.isArray(d.users) && d.users.some((u: User) => u.id === "u-root")) return d as DB;
    }
  } catch { /* ignore */ }
  return makeSeed();
}

// ---------- чистые расчёты ----------
export function userById(db: DB, id: string): User | undefined {
  return db.users.find((u) => u.id === id);
}
export function openPunchOf(db: DB, userId: string): Punch | undefined {
  return db.punches.filter((p) => p.userId === userId && p.tout === null)
    .sort((a, b) => (b.date + b.tin).localeCompare(a.date + a.tin))[0];
}
export function punchDur(p: Punch, breakMin: number, live = false): number {
  const end = p.tout === null ? (live ? nowMin() : 1440) : p.tout;
  let raw = end >= p.tin ? end - p.tin : 1440 - p.tin + end;
  if (raw > 360) raw -= breakMin;
  return Math.max(0, raw);
}
export function workedOn(db: DB, userId: string, date: string, live = false): number {
  return db.punches
    .filter((p) => p.userId === userId && p.date === date)
    .reduce((s, p) => s + punchDur(p, db.settings.breakMin, live), 0);
}
export function plannedOn(db: DB, userId: string, date: string): number {
  const c = db.schedule.find((s) => s.userId === userId && s.date === date);
  return c ? SHIFT_META[c.type].planned : 0;
}
export function shiftOf(db: DB, userId: string, date: string): ShiftCell | undefined {
  return db.schedule.find((s) => s.userId === userId && s.date === date);
}
export interface SumRow {
  user: User;
  planMin: number;
  factMin: number;
  otMin: number;
  shortMin: number;
  late: number;
  days: number;
  salary: number;
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
  const salary = (fact / 60) * user.rate + (ot / 60) * user.rate * (db.settings.overtimeK - 1);
  return { user, planMin: plan, factMin: fact, otMin: ot, shortMin: short, late, days, salary };
}
export function summarizeAll(db: DB, from: string, to: string, dept?: string): SumRow[] {
  return db.users
    .filter((u) => u.role === "employee" && u.active && (!dept || u.dept === dept))
    .map((u) => summarize(db, u, from, to))
    .sort((a, b) => b.factMin - a.factMin);
}
export function myNotices(db: DB, me: User) {
  return db.notices
    .filter((n) => n.audience === "all" || n.audience === me.id)
    .sort((a, b) => b.ts.localeCompare(a.ts));
}

// ---------- контекст ----------
interface StoreApi {
  db: DB;
  me: User | null;
  login: (username: string, password: string) => string | null;
  logout: () => void;
  punch: (source: Punch["source"]) => string | null;
  punchOut: () => string | null;
  kioskPunch: (userId: string) => "in" | "out" | null;
  closePunch: (id: string, tout: number) => void;
  addUser: (u: Omit<User, "id" | "createdAt" | "avatar"> & { avatar?: string | null }) => string | null;
  updateUser: (id: string, patch: Partial<User>) => string | null;
  removeUser: (id: string) => string | null;
  setShift: (userId: string, date: string, type: ShiftType | null) => void;
  fillPattern: (userId: string, monthKey: string, pattern: "5/2" | "2/2" | "3/3" | "clear", night: boolean) => void;
  publishSchedule: (monthKey: string) => void;
  importSchedule: (cells: { username: string; date: string; type: ShiftType }[]) => { ok: number; missing: string[] };
  createRequest: (kind: RequestKind, date: string, dateEnd: string | undefined, targetUserId: string | undefined, note: string) => void;
  decideRequest: (id: string, approve: boolean, note: string) => void;
  addPost: (text: string, image: string | null) => void;
  deletePost: (id: string) => void;
  toggleLike: (id: string) => void;
  addComment: (id: string, text: string) => void;
  togglePin: (id: string) => void;
  markNoticesRead: () => void;
  setPerm: (mod: ModuleId, role: Role, device: Device, val: boolean) => void;
  setSettings: (patch: Partial<Settings>) => void;
  importAll: (d: DB) => string | null;
  resetDemo: () => void;
  can: (mod: ModuleId, device: Device) => boolean;
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

  useEffect(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      console.warn("Хранилище переполнено — фото слишком большие");
    }
  }, [db]);

  const me = useMemo(() => db.users.find((u) => u.id === meId) || null, [db.users, meId]);

  const up = (fn: (d: DB) => void) =>
    setDb((prev) => {
      const d: DB = JSON.parse(JSON.stringify(prev));
      fn(d);
      return d;
    });
  const audit = (d: DB, actor: string, action: string, details: string) => {
    d.audit.unshift({ id: uid(), ts: new Date().toISOString(), actor, action, details });
    if (d.audit.length > 500) d.audit.length = 500;
  };
  const notify = (d: DB, audience: string, text: string) => {
    d.notices.unshift({ id: uid(), audience, text, ts: new Date().toISOString(), readBy: [] });
    if (d.notices.length > 200) d.notices.length = 200;
  };
  const who = () => me?.name || "система";

  const api: StoreApi = {
    db, me,
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
    logout() {
      setMeId(null);
      localStorage.removeItem(SES_KEY);
    },
    punch(source) {
      if (!me) return "Нет сессии";
      if (openPunchOf(db, me.id)) return "Смена уже открыта";
      up((d) => {
        d.punches.push({ id: uid(), userId: me.id, date: todayKey(), tin: nowMin(), tout: null, source });
        audit(d, source === "kiosk" ? "терминал" : me.name, "Отметка", `${me.name} — начало смены (${fmtMin(nowMin())})`);
      });
      return null;
    },
    punchOut() {
      if (!me) return "Нет сессии";
      const p = openPunchOf(db, me.id);
      if (!p) return "Нет открытой смены";
      up((d) => {
        const x = d.punches.find((q) => q.id === p.id)!;
        x.tout = nowMin();
        audit(d, me.name, "Отметка", `${me.name} — конец смены (${fmtMin(nowMin())}, отработано ${fmtDur(punchDur(x, d.settings.breakMin))})`);
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
    closePunch(id, tout) {
      up((d) => {
        const x = d.punches.find((q) => q.id === id);
        if (x) {
          x.tout = tout;
          const u = userById(d, x.userId);
          audit(d, who(), "Табель", `Закрыта незакрытая смена: ${u?.name || "?"}, конец ${fmtMin(tout)}`);
        }
      });
    },
    addUser(u) {
      if (!u.username.trim()) return "Укажите логин";
      if (db.users.some((x) => x.username.toLowerCase() === u.username.trim().toLowerCase())) return "Логин уже занят";
      if (!u.name.trim()) return "Укажите ФИО";
      up((d) => {
        d.users.push({
          id: uid(), username: u.username.trim(), password: u.password, name: u.name.trim(),
          role: u.role, dept: u.dept, rate: u.rate, avatar: u.avatar ?? null,
          color: u.color, bio: u.bio, active: true, createdAt: new Date().toISOString(),
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
    setShift(userId, date, type) {
      up((d) => {
        d.schedule = d.schedule.filter((s) => !(s.userId === userId && s.date === date));
        if (type) d.schedule.push({ userId, date, type });
        const u = userById(d, userId);
        audit(d, who(), "График", `${u?.name || "?"} ${fmtDateFull(date)}: ${type ? SHIFT_META[type].label : "ячейка очищена"}`);
      });
    },
    fillPattern(userId, mk, pattern, night) {
      up((d) => {
        d.schedule = d.schedule.filter((s) => !(s.userId === userId && s.date.startsWith(mk.slice(0, 7))));
        if (pattern !== "clear") {
          const dim = daysInMonth(mk);
          const prefix = mk.slice(0, 8);
          for (let day = 1; day <= dim; day++) {
            const key = prefix + String(day).padStart(2, "0");
            const wd = (new Date(key + "T12:00:00").getDay() + 6) % 7;
            const since = Math.floor(Date.parse(key) / 86400000);
            let work = false;
            if (pattern === "5/2") work = wd < 5;
            if (pattern === "2/2") work = since % 4 < 2;
            if (pattern === "3/3") work = since % 6 < 3;
            if (work) d.schedule.push({ userId, date: key, type: night ? "night" : "day" });
          }
        }
        const u = userById(d, userId);
        audit(d, who(), "График", `${u?.name || "?"}: шаблон «${pattern}» на ${monthTitle(mk)}`);
      });
    },
    importSchedule(cells) {
      const byLogin = new Map(db.users.map((u) => [u.username.toLowerCase(), u]));
      const missing = [...new Set(cells.filter((c) => !byLogin.has(c.username.toLowerCase())).map((c) => c.username))];
      const valid = cells.filter((c) => byLogin.has(c.username.toLowerCase()));
      up((d) => {
        for (const c of valid) {
          const u = byLogin.get(c.username.toLowerCase())!;
          d.schedule = d.schedule.filter((s) => !(s.userId === u.id && s.date === c.date));
          d.schedule.push({ userId: u.id, date: c.date, type: c.type });
        }
        audit(d, who(), "График", `Импорт из Excel: ${valid.length} ячеек${missing.length ? `, неизвестные логины: ${missing.join(", ")}` : ""}`);
      });
      return { ok: valid.length, missing };
    },
    publishSchedule(mk) {
      up((d) => {
        notify(d, "all", `Опубликован график на ${monthTitle(mk)}. Проверьте свои дни.`);
        audit(d, who(), "График", `График на ${monthTitle(mk)} опубликован для всех`);
      });
    },
    createRequest(kind, date, dateEnd, targetUserId, note) {
      if (!me) return;
      up((d) => {
        d.requests.unshift({ id: uid(), userId: me.id, kind, date, dateEnd, targetUserId, note, status: "pending", createdAt: new Date().toISOString() });
        const label = kind === "swap" ? "замена дня" : kind === "vacation" ? "отпуск" : "дополнительная смена";
        d.users.filter((u) => u.role !== "employee").forEach((a) => notify(d, a.id, `${me.name}: новая заявка — ${label} (${fmtDateFull(date)})`));
        audit(d, me.name, "Заявка", `Создана заявка: ${label} на ${fmtDateFull(date)}`);
      });
    },
    decideRequest(id, approve, note) {
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
          } else if (rq.kind === "extra") {
            d.schedule = d.schedule.filter((s) => !(s.userId === rq.userId && s.date === rq.date));
            d.schedule.push({ userId: rq.userId, date: rq.date, type: "day" });
          } else if (rq.kind === "swap" && rq.targetUserId) {
            const a = d.schedule.find((s) => s.userId === rq.userId && s.date === rq.date);
            const b = d.schedule.find((s) => s.userId === rq.targetUserId && s.date === rq.date);
            const at = a?.type, bt = b?.type;
            d.schedule = d.schedule.filter((s) => !(s.date === rq.date && (s.userId === rq.userId || s.userId === rq.targetUserId)));
            if (bt) d.schedule.push({ userId: rq.userId, date: rq.date, type: bt });
            if (at) d.schedule.push({ userId: rq.targetUserId!, date: rq.date, type: at });
          }
        }
        const label = rq.kind === "swap" ? "замена дня" : rq.kind === "vacation" ? "отпуск" : "доп. смена";
        notify(d, rq.userId, `Ваша заявка «${label}» ${approve ? "одобрена ✅" : "отклонена ❌"}${note ? ": " + note : ""}`);
        audit(d, me.name, "Заявка", `${approve ? "Одобрена" : "Отклонена"} заявка ${u?.name || "?"} (${label})`);
      });
    },
    addPost(text, image) {
      if (!me) return;
      up((d) => {
        d.posts.unshift({ id: uid(), userId: me.id, text, image, likes: [], comments: [], ts: new Date().toISOString(), pinned: false });
        audit(d, me.name, "Лента", "Новая запись на стене");
      });
    },
    deletePost(id) {
      up((d) => {
        d.posts = d.posts.filter((p) => p.id !== id);
        audit(d, who(), "Лента", "Запись удалена");
      });
    },
    toggleLike(id) {
      if (!me) return;
      up((d) => {
        const p = d.posts.find((x) => x.id === id);
        if (!p) return;
        p.likes = p.likes.includes(me.id) ? p.likes.filter((x) => x !== me.id) : [...p.likes, me.id];
      });
    },
    addComment(id, text) {
      if (!me) return;
      up((d) => {
        const p = d.posts.find((x) => x.id === id);
        if (p) p.comments.push({ id: uid(), userId: me.id, text, ts: new Date().toISOString() });
      });
    },
    togglePin(id) {
      up((d) => {
        const p = d.posts.find((x) => x.id === id);
        if (p) {
          p.pinned = !p.pinned;
          audit(d, who(), "Лента", p.pinned ? "Запись закреплена" : "Запись откреплена");
        }
      });
    },
    markNoticesRead() {
      if (!me) return;
      up((d) => {
        d.notices.forEach((n) => {
          if ((n.audience === "all" || n.audience === me.id) && !n.readBy.includes(me.id)) n.readBy.push(me.id);
        });
      });
    },
    setPerm(mod, role, device, val) {
      up((d) => {
        d.perms[mod][role][device] = val;
        audit(d, who(), "Права", `${mod} / ${role} / ${device === "desktop" ? "ПК" : "телефон"} = ${val ? "вкл" : "выкл"}`);
      });
    },
    setSettings(patch) {
      up((d) => {
        Object.assign(d.settings, patch);
        audit(d, who(), "Настройки", "Изменены настройки организации");
      });
    },
    importAll(nd) {
      if (!nd || nd.v !== 4 || !Array.isArray(nd.users) || !nd.users.some((u) => u.id === "u-root"))
        return "Файл не похож на резервную копию «СменаЛАН» (v4)";
      setDb(nd);
      return null;
    },
    resetDemo() {
      setDb(makeSeed());
    },
    can(mod, device) {
      if (!me) return false;
      if (me.role === "superadmin") return true;
      const cell = db.perms[mod]?.[me.role]?.[device];
      return !!cell;
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
