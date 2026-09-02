export type Role = "superadmin" | "admin" | "employee";
export type Device = "desktop" | "mobile";

export type ModuleId =
  | "punch"
  | "stats"
  | "schedule"
  | "requests"
  | "feed"
  | "profile"
  | "dashboard"
  | "employees"
  | "reports"
  | "dataio"
  | "permissions"
  | "audit"
  | "settings";

export interface User {
  id: string;
  username: string;
  password: string; // '' = вход без пароля
  name: string;
  role: Role;
  dept: string;
  rate: number; // ₽/час
  avatar: string | null; // dataURL
  color: string;
  bio: string;
  active: boolean;
  createdAt: string;
}

export interface Punch {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD (дата начала)
  tin: number; // минуты от полуночи
  tout: number | null; // null = смена открыта
  source: "app" | "kiosk" | "admin";
}

export type ShiftType = "day" | "night" | "off" | "vacation" | "sick";

export interface ShiftCell {
  userId: string;
  date: string;
  type: ShiftType;
}

export type RequestKind = "swap" | "vacation" | "extra";

export interface WorkRequest {
  id: string;
  userId: string;
  kind: RequestKind;
  date: string;
  dateEnd?: string;
  targetUserId?: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedBy?: string;
  decisionNote?: string;
}

export interface WallComment {
  id: string;
  userId: string;
  text: string;
  ts: string;
}

export interface WallPost {
  id: string;
  userId: string;
  text: string;
  image: string | null;
  likes: string[];
  comments: WallComment[];
  ts: string;
  pinned: boolean;
}

export interface Notice {
  id: string;
  audience: string; // userId или 'all'
  text: string;
  ts: string;
  readBy: string[];
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  action: string;
  details: string;
}

export interface Settings {
  orgName: string;
  orgInn: string;
  orgAddress: string;
  dailyNorm: number; // часы
  breakMin: number; // обед, мин
  overtimeK: number; // коэффициент переработки
  kioskFree: boolean; // терминал без пароля
  adminPin: string; // служебный выход из терминала
}

export type PermMatrix = Record<ModuleId, Record<Role, { desktop: boolean; mobile: boolean }>>;

export interface DB {
  v: number;
  users: User[];
  punches: Punch[];
  schedule: ShiftCell[];
  requests: WorkRequest[];
  posts: WallPost[];
  notices: Notice[];
  audit: AuditEntry[];
  settings: Settings;
  perms: PermMatrix;
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Суперадмин",
  admin: "Админ",
  employee: "Сотрудник",
};

export const MODULES: { id: ModuleId; label: string; icon: string; group: "user" | "admin" }[] = [
  { id: "punch", label: "Моя смена", icon: "clock", group: "user" },
  { id: "stats", label: "Статистика", icon: "chart", group: "user" },
  { id: "schedule", label: "График", icon: "cal", group: "user" },
  { id: "requests", label: "Заявки", icon: "doc", group: "user" },
  { id: "feed", label: "Лента", icon: "feed", group: "user" },
  { id: "profile", label: "Профиль", icon: "user", group: "user" },
  { id: "dashboard", label: "Дашборд", icon: "grid", group: "admin" },
  { id: "employees", label: "Сотрудники", icon: "users", group: "admin" },
  { id: "reports", label: "Отчёты", icon: "pdf", group: "admin" },
  { id: "dataio", label: "Данные / Excel", icon: "xls", group: "admin" },
  { id: "permissions", label: "Права доступа", icon: "shield", group: "admin" },
  { id: "audit", label: "Журнал аудита", icon: "history", group: "admin" },
  { id: "settings", label: "Настройки", icon: "gear", group: "admin" },
];

export const SHIFT_META: Record<
  ShiftType,
  { code: string; label: string; cls: string; start: number; end: number; planned: number }
> = {
  day: { code: "Я", label: "День 08–17", cls: "bg-ok-soft text-ok", start: 480, end: 1020, planned: 480 },
  night: { code: "Н", label: "Ночь 20–08", cls: "bg-night-soft text-night", start: 1200, end: 480, planned: 690 },
  off: { code: "В", label: "Выходной", cls: "bg-paper text-mute", start: 0, end: 0, planned: 0 },
  vacation: { code: "О", label: "Отпуск", cls: "bg-warn-soft text-warn", start: 0, end: 0, planned: 0 },
  sick: { code: "Б", label: "Больничный", cls: "bg-bad-soft text-bad", start: 0, end: 0, planned: 0 },
};

export function defaultPerms(): PermMatrix {
  const T = { desktop: true, mobile: true };
  const F = { desktop: false, mobile: false };
  const userMods: ModuleId[] = ["punch", "stats", "schedule", "requests", "feed", "profile"];
  const adminMods: ModuleId[] = ["dashboard", "employees", "reports", "dataio", "settings"];
  const m = {} as PermMatrix;
  for (const mod of MODULES) {
    const isUser = userMods.includes(mod.id);
    const isAdmin = adminMods.includes(mod.id);
    m[mod.id] = {
      employee: isUser ? { ...T } : { ...F },
      admin: isUser || isAdmin ? { ...T } : { ...F },
      superadmin: { ...T },
    };
  }
  return m;
}
