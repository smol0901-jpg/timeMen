export type Role = "superadmin" | "admin" | "accountant" | "employee";
export type Device = "desktop" | "mobile";
export type PayMode = "hour" | "shift" | "piece";
export type KioskTheme = "steel" | "mint" | "sunset" | "ocean" | "light";

export type ModuleId =
  | "punch" | "stats" | "schedule" | "requests" | "feed" | "chat" | "production" | "games" | "profile"
  | "dashboard" | "employees" | "org" | "reports" | "ai" | "payroll" | "archive" | "dataio" | "permissions" | "audit" | "reminders" | "settings" | "help";

export interface Workshop {
  id: string;
  name: string;
  piecework: boolean; // сдельная оплата (обвалка и т.п.)
  color: string;
}

export interface Position {
  id: string;
  name: string;
  normH: number; // норма часов в день
  defPay: PayMode;
  rate: number; // ₽/час
  shiftCost: number; // ₽/смена
}

export interface User {
  id: string;
  username: string;
  password: string; // '' = без пароля (устанавливает сам сотрудник)
  name: string;
  role: Role;
  workshopId: string | null;
  positionId: string | null;
  payMode: PayMode;
  rate: number;
  shiftCost: number;
  avatar: string | null;
  color: string;
  bio: string;
  active: boolean;
  createdAt: string;
  // архив (уволенные/удалённые): запись неудаляема 30 дней, затем — только суперадмин
  archived?: boolean;
  archivedAt?: string;
  archiveReason?: string;
  archiveTone?: "pos" | "neg" | "neutral"; // зелёный / красный / без подсветки
  archiveNote?: string; // характеристика
}

export interface Punch {
  id: string;
  userId: string;
  date: string;
  tin: number;
  tout: number | null;
  source: "app" | "kiosk" | "admin" | "auto";
  auto?: "schedule" | "unscheduled" | null;
  resolution?: "pending" | "ok" | null; // требует подтверждения админа (проверить камеры)
  plannedOut?: number | null; // вне графика: сотрудник указал «работаю до»
}

export interface Fine {
  id: string;
  userId: string;
  amount: number; // ₽, вычитается из расчёта
  reason: string;
  periodId: string | null;
  createdBy: string;
  ts: string;
}

export interface Rating {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  points: number; // 0–100
  note: string;
  by: string;
  ts: string;
}

export interface PayPeriod {
  id: string;
  kind: "day" | "week" | "month" | "season";
  from: string;
  to: string;
  label: string;
  status: "open" | "approved" | "paid";
  approvedBy?: string;
  ts: string;
}

export type ShiftType = "day" | "night" | "off" | "vacation" | "sick";
export interface ShiftCell { userId: string; date: string; type: ShiftType; }

export interface Product {
  id: string;
  name: string;
  unit: string; // кг / шт
  price: number; // ₽ за единицу (ставит админ)
  workshopId: string | null;
  hidden: boolean;
  sort: number;
}

export interface ProductionRecord {
  id: string;
  userId: string;
  date: string;
  productId: string;
  qty: number;
  note: string;
  ts: string;
}

export interface Attachment { name: string; type: string; size: number; src: string; }

export interface ChatThread {
  id: string;
  kind: "dm" | "group";
  name: string; // для групп
  workshopId: string | null;
  members: string[];
  createdBy: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  userId: string;
  text: string;
  file: Attachment | null;
  ts: string;
}

export interface Reminder {
  id: string;
  title: string;
  text: string;
  targetType: "all" | "workshop" | "user" | "position";
  targetId: string | null;
  due: string;
  createdBy: string;
  createdAt: string;
  doneBy: string[];
}

export interface ScheduleEvent {
  id: string;
  userId: string;
  ts: string;
  by: string;
  changes: { date: string; from: ShiftType | null; to: ShiftType | null }[];
  comment: string;
  readBy: string[];
}

export type RequestKind = "swap" | "vacation" | "extra" | "resolution";
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
  punchId?: string;
}

export interface WallComment { id: string; userId: string; text: string; ts: string; }
export interface WallPost {
  id: string;
  userId: string;
  text: string;
  image: string | null;
  attachments: Attachment[];
  link: string | null;
  bg: string | null; // градиентный фон
  animated: boolean;
  likes: string[];
  comments: WallComment[];
  ts: string;
  pinned: boolean;
  favs?: string[]; // «избранное» по пользователям
}

export interface Notice { id: string; audience: string; text: string; ts: string; readBy: string[]; }
export interface AuditEntry { id: string; ts: string; actor: string; action: string; details: string; }
export interface GameLink { id: string; name: string; url: string; }
export interface GameScore { id: string; game: string; userId: string; score: number; ts: string; }
export interface SensorPoint { id: string; name: string; value: number; unit: string; ts: string; }

export interface Settings {
  orgName: string;
  orgInn: string;
  orgAddress: string;
  dailyNorm: number;
  breakMin: number;
  overtimeK: number;
  kioskFree: boolean;
  adminPin: string;
  aiMode: "off" | "light" | "std" | "adv";
  ollamaOn: boolean;
  ollamaUrl: string;
  ollamaModel: string;
  apiToken: string;
  kioskTheme: KioskTheme;
  bestUserId: string | null; // «лучший сотрудник» месяца
  bestOn: boolean; // показывать ли бейдж
  camNote: string; // подсказка админу про камеры для внеплановых смен
}

export type PermMatrix = Record<ModuleId, Record<Role, { desktop: boolean; mobile: boolean }>>;

export interface DB {
  v: number;
  users: User[];
  workshops: Workshop[];
  positions: Position[];
  punches: Punch[];
  schedule: ShiftCell[];
  products: Product[];
  production: ProductionRecord[];
  threads: ChatThread[];
  messages: ChatMessage[];
  reminders: Reminder[];
  events: ScheduleEvent[];
  requests: WorkRequest[];
  posts: WallPost[];
  notices: Notice[];
  audit: AuditEntry[];
  games: GameLink[];
  scores: GameScore[];
  sensors: SensorPoint[];
  fines: Fine[];
  ratings: Rating[];
  periods: PayPeriod[];
  settings: Settings;
  perms: PermMatrix;
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Суперадмин",
  admin: "Админ",
  accountant: "Бухгалтерия",
  employee: "Сотрудник",
};

export const PAY_LABEL: Record<PayMode, string> = {
  hour: "Почасовая",
  shift: "Посменная",
  piece: "Сдельная",
};

export const KIND_LABEL: Record<RequestKind, string> = {
  swap: "Замена дня",
  vacation: "Отпуск",
  extra: "Доп. смена",
  resolution: "Подтверждение смены",
};

export const MODULES: { id: ModuleId; label: string; icon: string; group: "user" | "admin" }[] = [
  { id: "punch", label: "Моя смена", icon: "clock", group: "user" },
  { id: "stats", label: "Статистика", icon: "chart", group: "user" },
  { id: "schedule", label: "График", icon: "cal", group: "user" },
  { id: "requests", label: "Заявки", icon: "doc", group: "user" },
  { id: "production", label: "Выработка", icon: "box", group: "user" },
  { id: "feed", label: "Стена", icon: "feed", group: "user" },
  { id: "chat", label: "Сообщения", icon: "chat", group: "user" },
  { id: "games", label: "Игры и утилиты", icon: "game", group: "user" },
  { id: "profile", label: "Профиль", icon: "user", group: "user" },
  { id: "dashboard", label: "Дашборд", icon: "grid", group: "admin" },
  { id: "employees", label: "Сотрудники", icon: "users", group: "admin" },
  { id: "org", label: "Цеха · Должности · ФОТ", icon: "factory", group: "admin" },
  { id: "reports", label: "Отчёты", icon: "pdf", group: "admin" },
  { id: "ai", label: "ИИ-аналитик", icon: "brain", group: "admin" },
  { id: "payroll", label: "Расчёты", icon: "coin", group: "admin" },
  { id: "archive", label: "Архив сотрудников", icon: "layers", group: "admin" },
  { id: "reminders", label: "Напоминания", icon: "bell", group: "admin" },
  { id: "dataio", label: "Данные / Excel", icon: "xls", group: "admin" },
  { id: "permissions", label: "Права доступа", icon: "shield", group: "admin" },
  { id: "audit", label: "Журналы", icon: "history", group: "admin" },
  { id: "settings", label: "Настройки", icon: "gear", group: "admin" },
  { id: "help", label: "Инструкции и API", icon: "help", group: "admin" },
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
  const roles: Role[] = ["superadmin", "admin", "accountant", "employee"];
  const empMods: ModuleId[] = ["punch", "stats", "schedule", "requests", "production", "feed", "chat", "games", "profile", "help"];
  const accMods: ModuleId[] = ["stats", "schedule", "feed", "chat", "games", "profile", "help", "reports", "payroll", "ai"];
  const adminMods: ModuleId[] = [
    ...empMods,
    "dashboard", "employees", "org", "reports", "ai", "payroll", "archive", "reminders", "dataio", "settings",
  ];
  const all = MODULES.map((m) => m.id);
  const out = {} as PermMatrix;
  for (const m of all) {
    out[m] = {} as PermMatrix[ModuleId];
    for (const r of roles) {
      const on =
        (r === "superadmin") ||
        (r === "admin" && adminMods.includes(m)) ||
        (r === "accountant" && accMods.includes(m)) ||
        (r === "employee" && empMods.includes(m));
      out[m][r] = { desktop: on, mobile: on };
    }
  }
  return out;
}

export const API_ENDPOINTS: { method: string; path: string; desc: string; auth: boolean }[] = [
  { method: "GET", path: "/api/ping", desc: "Проверка доступности сервера", auth: false },
  { method: "GET", path: "/api/health", desc: "Состояние: версия БД, аптайм, бэкапы", auth: false },
  { method: "GET", path: "/api/state", desc: "Версия базы (для real-time синхронизации)", auth: false },
  { method: "GET", path: "/api/db", desc: "Полная база {version, data}", auth: false },
  { method: "POST", path: "/api/db", desc: "Запись базы (синхронизация клиентов)", auth: false },
  { method: "GET", path: "/api/today", desc: "Кто сейчас на смене + отметки за сегодня", auth: false },
  { method: "GET", path: "/api/employees", desc: "Список сотрудников (без паролей)", auth: false },
  { method: "GET", path: "/api/punches?date=YYYY-MM-DD", desc: "Отметки за дату", auth: false },
  { method: "GET", path: "/api/stats?from=..&to=..", desc: "Часы план/факт по сотрудникам", auth: false },
  { method: "GET", path: "/api/production?from=..&to=..", desc: "Выработка (обвалка, цеха)", auth: false },
  { method: "GET", path: "/api/logs?limit=N", desc: "Журнал действий (аудит)", auth: false },
  { method: "GET", path: "/api/sensors", desc: "Лента показаний датчиков", auth: false },
  { method: "GET", path: "/api/sensors/latest?name=X", desc: "Последнее значение датчика", auth: false },
  { method: "POST", path: "/api/sensors", desc: "Записать показание {name, value, unit}", auth: true },
  { method: "POST", path: "/api/backup", desc: "Создать резервную копию сейчас", auth: true },
  { method: "GET", path: "/api/backups", desc: "Список резервных копий", auth: false },
  { method: "POST", path: "/api/files", desc: "Загрузить файл (фото стены/чата) → URL", auth: true },
  { method: "GET", path: "/files/<имя>", desc: "Скачать сохранённый файл", auth: false },
  { method: "GET", path: "/api/endpoints", desc: "Этот список (машиночитаемый)", auth: false },
];
