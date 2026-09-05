export type Role = "superadmin" | "admin" | "foreman" | "accountant" | "employee";
export type Device = "desktop" | "mobile";
export type PayMode = "hour" | "shift" | "piece";
export type KioskTheme = "steel" | "mint" | "sunset" | "ocean" | "light";

export type ModuleId =
  | "punch" | "stats" | "schedule" | "requests" | "feed" | "chat" | "production" | "games" | "live" | "profile"
  | "dashboard" | "employees" | "org" | "reports" | "ai" | "bot" | "camera" | "payroll" | "archive"
  | "dataio" | "permissions" | "audit" | "reminders" | "settings" | "help";

export interface Workshop { id: string; name: string; piecework: boolean; color: string; }
export interface Position { id: string; name: string; normH: number; defPay: PayMode; rate: number; shiftCost: number; }

export interface PersonalInfo {
  phone?: string; email?: string; birth?: string; address?: string;
  emergency?: string; hiredAt?: string; docNote?: string;
  // расширенные блоки личной карточки
  passport?: string; snils?: string; taxId?: string; blood?: string; allergies?: string;
  uniformSize?: string; bank?: string; education?: string; certs?: string; medDate?: string;
}

export interface User {
  id: string; username: string; password: string; name: string; role: Role;
  workshopId: string | null; positionId: string | null; payMode: PayMode;
  rate: number; shiftCost: number; avatar: string | null; color: string; bio: string;
  active: boolean; createdAt: string; info?: PersonalInfo;
  archived?: boolean; archivedAt?: string; archiveReason?: string;
  archiveTone?: "pos" | "neg" | "neutral"; archiveNote?: string;
  empNo?: string;              // табельный номер (5+ знаков, авто)
  barcode?: string;            // код для сканера терминала
  favs?: ModuleId[];           // избранные вкладки
  notes?: string;              // заметки сотрудника (видит сам + управление)
  faceEmbedding?: number[] | null; // биометрический вектор лица
  faceUpdatedAt?: string;
}

export interface Punch {
  id: string; userId: string; date: string; tin: number; tout: number | null;
  source: "app" | "kiosk" | "admin" | "auto" | "scanner";
  auto?: "schedule" | "unscheduled" | null;
  resolution?: "pending" | "ok" | null;
  plannedOut?: number | null;
  photo?: string | null;
  bio?: "ok" | "fallback" | null; // результат биометрии
}

export interface CamShot {
  id: string; userId: string; punchId: string | null; ts: string; src: string;
  status: "new" | "ok" | "bad"; checkedBy?: string; note?: string; dir?: "in" | "out";
}

export interface Fine { id: string; userId: string; amount: number; reason: string; periodId: string | null; createdBy: string; ts: string; }
export interface Rating { id: string; userId: string; month: string; points: number; note: string; by: string; ts: string; }
export interface PayPeriod { id: string; kind: "day" | "week" | "month" | "season"; from: string; to: string; label: string; status: "open" | "approved" | "paid"; approvedBy?: string; ts: string; }

export type ShiftType = "day" | "night" | "off" | "vacation" | "sick";
export interface ShiftCell { userId: string; date: string; type: ShiftType; }

export interface Product { id: string; name: string; unit: string; price: number; workshopId: string | null; hidden: boolean; sort: number; }
export interface ProductionRecord { id: string; userId: string; date: string; productId: string; qty: number; note: string; ts: string; }

export interface Attachment { name: string; type: string; size: number; src: string; }
export interface ChatThread { id: string; kind: "dm" | "group"; name: string; workshopId: string | null; members: string[]; createdBy: string; createdAt: string; }
export interface ChatMessage { id: string; threadId: string; userId: string; text: string; file: Attachment | null; ts: string; }
export interface Reminder { id: string; title: string; text: string; targetType: "all" | "workshop" | "user" | "position"; targetId: string | null; due: string; createdBy: string; createdAt: string; doneBy: string[]; }
export interface ScheduleEvent { id: string; userId: string; ts: string; by: string; changes: { date: string; from: ShiftType | null; to: ShiftType | null }[]; comment: string; readBy: string[]; }

export type RequestKind = "swap" | "vacation" | "extra" | "resolution";
export interface WorkRequest {
  id: string; userId: string; kind: RequestKind; date: string; dateEnd?: string; targetUserId?: string;
  note: string; status: "pending" | "approved" | "rejected"; createdAt: string;
  decidedBy?: string; decisionNote?: string; punchId?: string;
}

export interface WallComment { id: string; userId: string; text: string; ts: string; }
export interface WallPost {
  id: string; userId: string; text: string; image: string | null; attachments: Attachment[];
  link: string | null; bg: string | null; animated: boolean; likes: string[]; comments: WallComment[];
  ts: string; pinned: boolean; favs?: string[];
}

export interface Notice { id: string; audience: string; text: string; ts: string; readBy: string[]; }
export interface AuditEntry { id: string; ts: string; actor: string; action: string; details: string; }
export interface GameLink { id: string; name: string; url: string; }
export interface GameScore { id: string; game: string; userId: string; score: number; ts: string; }
export interface Challenge { id: string; game: string; from: string; to: string; scoreFrom: number | null; scoreTo: number | null; ts: string; done: boolean; }
export interface SensorPoint { id: string; name: string; value: number; unit: string; ts: string; }
export interface BotScript { id: string; name: string; enabled: boolean; lines: string[]; ts: string; }

export type LiveKind = "ttt" | "checkers" | "chess";
export interface LiveMove { p: number; from: number; to: number; cap?: number; piece?: string; }
export interface LiveGame {
  id: string; kind: LiveKind; players: [string, string | null]; status: "waiting" | "play" | "done";
  turn: number; board: string; moves: LiveMove[]; winner: string | null;
  createdAt: string; updatedAt: string; note?: string;
}

export interface Settings {
  orgName: string; orgInn: string; orgAddress: string;
  dailyNorm: number; breakMin: number; overtimeK: number;
  kioskFree: boolean; adminPin: string;
  aiMode: "off" | "light" | "std" | "adv";
  ollamaOn: boolean; ollamaUrl: string; ollamaModel: string;
  apiToken: string; kioskTheme: KioskTheme;
  bestUserId: string | null; bestOn: boolean; camNote: string;
  camOn: boolean; camMirror: boolean; camFlash: boolean; camOnOut: boolean; camQuality: number;
  camBio: boolean; camAutoTune: boolean; camThreshold: number;
  tgToken: string; tgChat: string; tgEvents: string[];
  announcement: string;
}

export type PermMatrix = Record<ModuleId, Record<Role, { desktop: boolean; mobile: boolean }>>;

export interface DB {
  v: number;
  users: User[]; workshops: Workshop[]; positions: Position[];
  punches: Punch[]; schedule: ShiftCell[]; products: Product[]; production: ProductionRecord[];
  threads: ChatThread[]; messages: ChatMessage[]; reminders: Reminder[]; events: ScheduleEvent[];
  requests: WorkRequest[]; posts: WallPost[]; notices: Notice[]; audit: AuditEntry[];
  games: GameLink[]; scores: GameScore[]; challenges: Challenge[]; sensors: SensorPoint[];
  fines: Fine[]; ratings: Rating[]; periods: PayPeriod[]; camshots: CamShot[]; scripts: BotScript[];
  liveGames: LiveGame[];
  settings: Settings; perms: PermMatrix;
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Суперадмин", admin: "Админ", foreman: "Старший смены", accountant: "Бухгалтерия", employee: "Сотрудник",
};
export const PAY_LABEL: Record<PayMode, string> = { hour: "Почасовая", shift: "Посменная", piece: "Сдельная" };
export const KIND_LABEL: Record<RequestKind, string> = { swap: "Замена дня", vacation: "Отпуск", extra: "Доп. смена", resolution: "Подтверждение смены" };

export const MODULES: { id: ModuleId; label: string; icon: string; group: "user" | "admin" }[] = [
  { id: "punch", label: "Моя смена", icon: "clock", group: "user" },
  { id: "stats", label: "Статистика", icon: "chart", group: "user" },
  { id: "schedule", label: "График", icon: "cal", group: "user" },
  { id: "requests", label: "Заявки", icon: "doc", group: "user" },
  { id: "production", label: "Выработка", icon: "box", group: "user" },
  { id: "feed", label: "Стена", icon: "feed", group: "user" },
  { id: "chat", label: "Сообщения", icon: "chat", group: "user" },
  { id: "games", label: "Игры и утилиты", icon: "game", group: "user" },
  { id: "live", label: "Онлайн-игры", icon: "zap", group: "user" },
  { id: "profile", label: "Профиль", icon: "user", group: "user" },
  { id: "dashboard", label: "Дашборд", icon: "grid", group: "admin" },
  { id: "employees", label: "Сотрудники", icon: "users", group: "admin" },
  { id: "org", label: "Цеха · Должности · ФОТ", icon: "factory", group: "admin" },
  { id: "reports", label: "Отчёты", icon: "pdf", group: "admin" },
  { id: "ai", label: "ИИ-аналитик", icon: "brain", group: "admin" },
  { id: "bot", label: "ИИ-бот и скрипты", icon: "bot", group: "admin" },
  { id: "camera", label: "Снимки камер", icon: "camera", group: "admin" },
  { id: "payroll", label: "Расчёты", icon: "coin", group: "admin" },
  { id: "archive", label: "Архив сотрудников", icon: "layers", group: "admin" },
  { id: "reminders", label: "Напоминания", icon: "bell", group: "admin" },
  { id: "dataio", label: "Данные / Excel", icon: "xls", group: "admin" },
  { id: "permissions", label: "Права доступа", icon: "shield", group: "admin" },
  { id: "audit", label: "Журналы", icon: "history", group: "admin" },
  { id: "settings", label: "Настройки", icon: "gear", group: "admin" },
  { id: "help", label: "Инструкции и API", icon: "help", group: "admin" },
];

/** Группы вкладок панели управления (сворачиваются/разворачиваются) */
export const NAV_GROUPS: { id: string; label: string; mods: ModuleId[] }[] = [
  { id: "day", label: "Рабочий день", mods: ["punch", "stats", "schedule", "requests", "production"] },
  { id: "team", label: "Команда", mods: ["employees", "org", "archive", "dashboard"] },
  { id: "money", label: "Отчёты и деньги", mods: ["reports", "payroll", "dataio"] },
  { id: "com", label: "Коммуникации", mods: ["feed", "chat", "games", "live", "bot"] },
  { id: "intel", label: "Интеллект и контроль", mods: ["ai", "camera", "reminders", "audit"] },
  { id: "sys", label: "Система", mods: ["permissions", "settings", "help", "profile"] },
];

export const SHIFT_META: Record<ShiftType, { code: string; label: string; cls: string; start: number; end: number; planned: number }> = {
  day: { code: "Я", label: "День 08–17", cls: "bg-ok-soft text-ok", start: 480, end: 1020, planned: 480 },
  night: { code: "Н", label: "Ночь 20–08", cls: "bg-night-soft text-night", start: 1200, end: 480, planned: 690 },
  off: { code: "В", label: "Выходной", cls: "bg-paper text-mute", start: 0, end: 0, planned: 0 },
  vacation: { code: "О", label: "Отпуск", cls: "bg-warn-soft text-warn", start: 0, end: 0, planned: 0 },
  sick: { code: "Б", label: "Больничный", cls: "bg-bad-soft text-bad", start: 0, end: 0, planned: 0 },
};

export function defaultPerms(): PermMatrix {
  const roles: Role[] = ["superadmin", "admin", "foreman", "accountant", "employee"];
  const empMods: ModuleId[] = ["punch", "stats", "schedule", "requests", "production", "feed", "chat", "games", "live", "profile", "help"];
  const accMods: ModuleId[] = ["stats", "schedule", "feed", "chat", "games", "live", "profile", "help", "reports", "payroll", "ai"];
  // старший смены: всё как у сотрудника + оперативное управление сменами
  const foremanMods: ModuleId[] = [...empMods, "dashboard", "camera", "reminders", "ai"];
  const adminMods: ModuleId[] = [
    ...empMods, "dashboard", "employees", "org", "reports", "ai", "bot", "camera", "payroll", "archive", "reminders", "dataio", "settings",
  ];
  const out = {} as PermMatrix;
  for (const m of MODULES.map((x) => x.id)) {
    out[m] = {} as PermMatrix[ModuleId];
    for (const r of roles) {
      const on = r === "superadmin"
        || (r === "admin" && adminMods.includes(m))
        || (r === "foreman" && foremanMods.includes(m))
        || (r === "accountant" && accMods.includes(m))
        || (r === "employee" && empMods.includes(m));
      out[m][r] = { desktop: on, mobile: on };
    }
  }
  return out;
}

export const BRAND = {
  name: "NEURAL_ARCHITECT_PREMIUM++",
  telegram: "ASV_PROD",
  dzen: "ASV_PROD",
  email: "smolyaninovchef@vk.com",
  phone: "+79934894429",
  phonePretty: "+7 993 489-44-29",
};

export const API_ENDPOINTS: { method: string; path: string; desc: string; auth: boolean }[] = [
  { method: "GET", path: "/api/ping", desc: "Проверка доступности сервера", auth: false },
  { method: "GET", path: "/api/health", desc: "Состояние: версия БД, аптайм, ускорение, туннель", auth: false },
  { method: "GET", path: "/api/state", desc: "Версия базы (real-time синхронизация)", auth: false },
  { method: "GET", path: "/api/db", desc: "Полная база {version, data}", auth: false },
  { method: "POST", path: "/api/db", desc: "Запись базы (синхронизация клиентов)", auth: false },
  { method: "GET", path: "/api/today", desc: "Кто сейчас на смене", auth: false },
  { method: "GET", path: "/api/employees", desc: "Список сотрудников (без паролей)", auth: false },
  { method: "GET", path: "/api/punches?date=YYYY-MM-DD", desc: "Отметки за дату", auth: false },
  { method: "GET", path: "/api/production?from&to", desc: "Выработка (обвалка, цеха)", auth: false },
  { method: "GET", path: "/api/camshots?limit=N", desc: "Снимки веб-камер терминала", auth: false },
  { method: "GET", path: "/api/logs?limit=N", desc: "Журнал действий (аудит)", auth: false },
  { method: "GET", path: "/api/tunnel", desc: "Публичная ссылка (туннель для мобильного интернета)", auth: false },
  { method: "GET", path: "/api/backups", desc: "Список резервных копий", auth: false },
  { method: "GET", path: "/api/endpoints", desc: "Этот список (машиночитаемый)", auth: false },
  { method: "POST", path: "/api/sensors", desc: "Показание датчика {name, value, unit}", auth: true },
  { method: "POST", path: "/api/webcam", desc: "Снимок веб-камеры {userId, dataBase64} → архив 120 дней", auth: true },
  { method: "POST", path: "/api/telegram", desc: "Сообщение в Telegram-канал {text}", auth: true },
  { method: "POST", path: "/api/backup", desc: "Резервная копия сейчас", auth: true },
  { method: "POST", path: "/api/files", desc: "Загрузить файл → URL", auth: true },
  { method: "POST", path: "/api/restart", desc: "Перезапустить сервер (без выключения ПК)", auth: true },
  { method: "POST", path: "/api/autostart", desc: "Автозапуск с ОС {on: true|false}", auth: true },
  { method: "POST", path: "/api/models/download", desc: "Скачать нейросети распознавания лиц (~7 МБ) на сервер", auth: true },
  { method: "GET", path: "/files/<имя>", desc: "Скачать сохранённый файл", auth: false },
  { method: "GET", path: "/models/<файл>", desc: "Файлы нейросетей (после загрузки)", auth: false },
];
