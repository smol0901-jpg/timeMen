export type Role = "superadmin" | "admin" | "senior" | "accountant" | "employee";
export type Device = "desktop" | "mobile";

export type ModuleId =
  | "punch" | "stats" | "schedule" | "requests" | "production" | "feed" | "chat" | "games" | "profile" | "help"
  | "dashboard" | "employees" | "org" | "reports" | "ai" | "bot" | "camera" | "payroll" | "archive"
  | "reminders" | "dataio" | "settings" | "permissions" | "audit";

export interface UserNote { id: string; text: string; ts: string }

export interface UserInfo {
  phone?: string; email?: string; birth?: string; address?: string; emergency?: string; docNote?: string; hiredAt?: string;
  // +10 блоков
  passportNo?: string; snils?: string; inn?: string; bankCard?: string; bloodType?: string;
  allergies?: string; uniformSize?: string; education?: string; skills?: string; maritalStatus?: string;
  children?: string; militaryId?: string; vaccineDate?: string; medicalCheck?: string; contractEnd?: string; lockerNo?: string;
}

export interface User {
  id: string;
  empNo: string;            // уникальный табельный номер (>=5 знаков)
  username: string;          // авто-логин: фамилия+цех+дата (уникальный, короткий)
  password: string;
  name: string;
  role: Role;
  workshopId: string | null;
  positionId: string | null;
  payMode: "hour" | "shift" | "piece";
  rate: number;
  shiftCost: number;
  avatar: string | null;
  facePhoto: string | null;       // обязательное фото для биометрии
  faceDescriptor: number[] | null; // 128-мерный вектор лица (face-api)
  qrId: string;                   // идентификатор для QR/штрихкода терминала
  color: string;
  bio: string;
  info: UserInfo;
  notes: UserNote[];
  favorites: string[];            // избранные вкладки
  active: boolean;
  archived: boolean;
  archivedAt?: string;
  archiveReason?: string;
  archiveTone?: "pos" | "neg" | "neutral";
  archiveNote?: string;
  createdAt: string;
}

export interface Punch {
  id: string; userId: string; date: string; tin: number; tout: number | null;
  source: "app" | "kiosk" | "admin" | "scanner" | "auto";
  auto?: "unscheduled" | "planned" | null;
  plannedOut?: number | null;
  resolution?: "pending" | "done" | null;
  photo?: string | null;      // id снимка терминала
  byFace?: boolean;           // вход подтверждён биометрией
  matchScore?: number | null;
}

export type ShiftType = "day" | "night" | "off" | "vacation" | "sick";
export interface ShiftCell { userId: string; date: string; type: ShiftType }
export interface ScheduleEvent { id: string; userId: string; date: string; changes: { date: string; from: ShiftType | null; to: ShiftType | null }[]; comment: string; ts: string; seenBy: string[] }

export type RequestKind = "swap" | "vacation" | "extra" | "resolution";
export interface WorkRequest {
  id: string; userId: string; kind: RequestKind; date: string; dateEnd?: string; targetUserId?: string;
  note: string; status: "pending" | "approved" | "rejected"; createdAt: string; decidedBy?: string; decisionNote?: string; punchId?: string;
}

export interface Attachment { name: string; type: string; size: number; src: string }
export interface WallComment { id: string; userId: string; text: string; ts: string }
export interface WallPost {
  id: string; userId: string; text: string; image: string | null; link: string | null; bg: string | null;
  animated: boolean; attachments: Attachment[]; likes: string[]; favs: string[]; comments: WallComment[]; ts: string; pinned: boolean;
}

export interface Notice { id: string; audience: string; text: string; ts: string; readBy: string[] }
export interface AuditEntry { id: string; ts: string; actor: string; action: string; details: string }

export interface Workshop { id: string; name: string; color: string; piecework: boolean }
export interface Position { id: string; name: string; normH: number; defPay: "hour" | "shift" | "piece"; rate: number; shiftCost: number }
export interface Product { id: string; workshopId: string | null; name: string; unit: string; price: number; hidden: boolean; sort: number }
export interface ProductionRec { id: string; userId: string; productId: string; qty: number; date: string; note: string; ts: string }
export interface Fine { id: string; userId: string; amount: number; reason: string; periodId: string | null; createdBy: string; ts: string }
export interface Rating { id: string; userId: string; month: string; points: number; note: string; by: string; ts: string }
export interface PayPeriod { id: string; kind: "day" | "week" | "month" | "season"; from: string; to: string; label: string; status: "open" | "approved" | "paid"; approvedBy?: string; ts: string }
export interface CamShot { id: string; userId: string; src: string; ts: string; status: "new" | "ok" | "bad"; dir: "in" | "out" }
export interface Thread { id: string; kind: "dm" | "group"; name: string; workshopId: string | null; members: string[]; createdAt: string }
export interface Message { id: string; threadId: string; userId: string; text: string; file: Attachment | null; ts: string }
export interface Reminder { id: string; title: string; text: string; targetType: "all" | "workshop" | "user" | "position"; targetId: string | null; due: string; doneBy: string[]; ts: string }
export interface Score { id: string; userId: string; game: string; score: number; ts: string }
export interface Challenge { id: string; game: string; from: string; to: string; scoreFrom: number | null; scoreTo: number | null; done: boolean; ts: string }
export interface SensorPoint { id: string; name: string; value: number; unit: string; ts: string }
export interface BotScript { id: string; name: string; enabled: boolean; lines: string[] }
export interface GameLink { id: string; name: string; url: string }

// Реал-тайм сетевые игры
export type GameKind = "tictac" | "checkers" | "chess" | "dots";
export interface GameRoom {
  id: string; kind: GameKind; players: [string, string | null]; turn: number; // 0|1
  board: number[]; moves: { p: number; from?: number; to?: number; player: number; ts: string }[];
  winner: number | null | "draw"; createdAt: string; ts: string;
}

export interface Settings {
  orgName: string; orgInn: string; orgAddress: string;
  dailyNorm: number; breakMin: number; overtimeK: number; adminPin: string; kioskFree: boolean;
  aiMode: "off" | "light" | "std" | "adv"; ollamaOn: boolean; ollamaUrl: string; ollamaModel: string;
  apiToken: string; camOn: boolean; camOnOut: boolean; camMirror: boolean; camFlash: boolean; camQuality: number; camNote: string;
  camAuto: boolean;            // автонастройка камеры (разрешение/свет/фокус на лице)
  faceCheck: boolean;          // биометрическое подтверждение
  faceThreshold: number;       // порог совпадения лица (дистанция)
  kioskTheme: string; bestOn: boolean; bestUserId: string | null;
  tgToken: string; tgChat: string; tgEvents: string[];
  autostart: boolean;          // автозапуск с ОС
  tunnelOn: boolean;           // туннель для мобильного интернета
  tunnelUrl: string;
  dataDir: string;             // выделенный диск/папка под сервер
  highPerf: boolean;           // режим повышенной производительности (WAL)
}

export type PermMatrix = Record<ModuleId, Record<Role, { desktop: boolean; mobile: boolean }>>;

export interface DB {
  v: number;
  users: User[]; punches: Punch[]; schedule: ShiftCell[]; events: ScheduleEvent[]; requests: WorkRequest[];
  posts: WallPost[]; notices: Notice[]; audit: AuditEntry[]; settings: Settings; perms: PermMatrix;
  workshops: Workshop[]; positions: Position[]; products: Product[]; production: ProductionRec[];
  fines: Fine[]; ratings: Rating[]; periods: PayPeriod[]; camshots: CamShot[]; threads: Thread[]; messages: Message[];
  reminders: Reminder[]; scores: Score[]; challenges: Challenge[]; sensors: SensorPoint[]; scripts: BotScript[];
  games: GameLink[]; rooms: GameRoom[];
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Суперадмин", admin: "Админ", senior: "Ст. смены", accountant: "Бухгалтерия", employee: "Сотрудник",
};

// Бренд и поддержка
export const BRAND = {
  company: "NEURAL_ARCHITECT_PREMIUM++",
  telegram: "ASV_PROD",
  zen: "ASV_PROD",
  email: "smolyaninovchef@vk.com",
  phone: "+79934894429",
};

export const MODULES: { id: ModuleId; label: string; icon: string; group: string }[] = [
  // Работа
  { id: "punch", label: "Моя смена", icon: "clock", group: "Работа" },
  { id: "stats", label: "Статистика", icon: "chart", group: "Работа" },
  { id: "schedule", label: "График", icon: "cal", group: "Работа" },
  { id: "requests", label: "Заявки", icon: "doc", group: "Работа" },
  { id: "production", label: "Выработка", icon: "box", group: "Работа" },
  // Общение
  { id: "feed", label: "Стена", icon: "feed", group: "Общение" },
  { id: "chat", label: "Сообщения", icon: "chat", group: "Общение" },
  { id: "games", label: "Игры", icon: "game", group: "Общение" },
  // Личное
  { id: "profile", label: "Профиль", icon: "user", group: "Личное" },
  { id: "help", label: "Инструкции", icon: "help", group: "Личное" },
  // Управление
  { id: "dashboard", label: "Дашборд", icon: "grid", group: "Управление" },
  { id: "employees", label: "Сотрудники", icon: "users", group: "Управление" },
  { id: "org", label: "Цеха и ФОТ", icon: "factory", group: "Управление" },
  { id: "reports", label: "Отчёты", icon: "pdf", group: "Управление" },
  { id: "payroll", label: "Расчёты", icon: "coin", group: "Управление" },
  { id: "camera", label: "Снимки камер", icon: "camera", group: "Управление" },
  { id: "reminders", label: "Напоминания", icon: "bell", group: "Управление" },
  { id: "archive", label: "Архив", icon: "layers", group: "Управление" },
  // Интеллект
  { id: "ai", label: "ИИ-аналитик", icon: "brain", group: "Интеллект" },
  { id: "bot", label: "ИИ-бот и скрипты", icon: "bot", group: "Интеллект" },
  // Система
  { id: "dataio", label: "Данные и сервер", icon: "xls", group: "Система" },
  { id: "settings", label: "Настройки", icon: "gear", group: "Система" },
  { id: "permissions", label: "Права доступа", icon: "shield", group: "Система" },
  { id: "audit", label: "Журналы", icon: "history", group: "Система" },
];

export const NAV_GROUPS = ["Работа", "Общение", "Личное", "Управление", "Интеллект", "Система"];

export const KIND_LABEL: Record<RequestKind, string> = {
  swap: "Замена дня", vacation: "Отпуск", extra: "Доп. смена", resolution: "Подтверждение смены",
};

export const PAY_LABEL = { hour: "Почасовая", shift: "Посменная", piece: "Сдельная" };

export const SHIFT_META: Record<ShiftType, { code: string; label: string; cls: string; start: number; end: number; planned: number }> = {
  day: { code: "Я", label: "День 08–17", cls: "bg-ok-soft text-ok", start: 480, end: 1020, planned: 480 },
  night: { code: "Н", label: "Ночь 20–08", cls: "bg-night-soft text-night", start: 1200, end: 480, planned: 690 },
  off: { code: "В", label: "Выходной", cls: "bg-paper text-mute", start: 0, end: 0, planned: 0 },
  vacation: { code: "О", label: "Отпуск", cls: "bg-warn-soft text-warn", start: 0, end: 0, planned: 0 },
  sick: { code: "Б", label: "Больничный", cls: "bg-bad-soft text-bad", start: 0, end: 0, planned: 0 },
};

export const API_ENDPOINTS: { method: "GET" | "POST"; path: string; desc: string; auth: boolean }[] = [
  { method: "GET", path: "/api/ping", desc: "Проверка доступности", auth: false },
  { method: "GET", path: "/api/health", desc: "Версия БД, аптайм, копии, размер", auth: false },
  { method: "GET", path: "/api/state", desc: "Версия базы (real-time)", auth: false },
  { method: "GET", path: "/api/db", desc: "Полная база {version, data}", auth: false },
  { method: "POST", path: "/api/db", desc: "Синхронизация клиентов", auth: false },
  { method: "GET", path: "/api/today", desc: "Кто сейчас на смене", auth: false },
  { method: "GET", path: "/api/employees", desc: "Сотрудники (без паролей)", auth: false },
  { method: "GET", path: "/api/punches?date=", desc: "Отметки за дату", auth: false },
  { method: "GET", path: "/api/stats", desc: "План/факт часы", auth: false },
  { method: "GET", path: "/api/production", desc: "Выработка", auth: false },
  { method: "GET", path: "/api/camshots", desc: "Снимки камер (мета)", auth: false },
  { method: "GET", path: "/api/logs", desc: "Журнал действий", auth: false },
  { method: "GET", path: "/api/sensors/latest?name=", desc: "Последнее показание", auth: false },
  { method: "GET", path: "/api/backups", desc: "Список копий", auth: false },
  { method: "GET", path: "/api/tunnel", desc: "Статус туннеля (моб. интернет)", auth: false },
  { method: "POST", path: "/api/sensors", desc: "Запись показания датчика", auth: true },
  { method: "POST", path: "/api/webcam", desc: "Снимок веб-камеры в архив", auth: true },
  { method: "POST", path: "/api/telegram", desc: "Отправка в Telegram", auth: true },
  { method: "POST", path: "/api/backup", desc: "Резервная копия сейчас", auth: true },
  { method: "POST", path: "/api/files", desc: "Загрузка файла → URL", auth: true },
  { method: "POST", path: "/api/restart", desc: "Перезапуск сервера", auth: true },
  { method: "POST", path: "/api/autostart", desc: "Вкл/выкл автозапуск", auth: true },
  { method: "GET", path: "/files/<имя>", desc: "Скачивание файла", auth: false },
  { method: "GET", path: "/api/endpoints", desc: "Этот список (JSON)", auth: false },
];

export function defaultPerms(): PermMatrix {
  const roles: Role[] = ["superadmin", "admin", "senior", "accountant", "employee"];
  const empMods: ModuleId[] = ["punch", "stats", "schedule", "requests", "production", "feed", "chat", "games", "profile", "help"];
  const seniorMods: ModuleId[] = [...empMods, "dashboard", "schedule", "camera", "reminders"];
  const accMods: ModuleId[] = ["stats", "schedule", "feed", "chat", "games", "profile", "help", "reports", "payroll", "ai"];
  const adminMods: ModuleId[] = [...empMods, "dashboard", "employees", "org", "reports", "payroll", "camera", "reminders", "archive", "ai", "bot", "dataio", "settings"];
  const out = {} as PermMatrix;
  for (const m of MODULES.map((x) => x.id)) {
    out[m] = {} as PermMatrix[ModuleId];
    for (const r of roles) {
      const on = r === "superadmin"
        || (r === "admin" && adminMods.includes(m))
        || (r === "senior" && seniorMods.includes(m))
        || (r === "accountant" && accMods.includes(m))
        || (r === "employee" && empMods.includes(m));
      out[m][r] = { desktop: on, mobile: on };
    }
  }
  return out;
}
