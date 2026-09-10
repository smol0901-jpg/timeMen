import { z } from 'zod';

// Валидация пользователя
export const userSchema = z.object({
  id: z.string().min(1, "ID обязателен"),
  username: z.string()
    .min(3, "Логин должен содержать минимум 3 символа")
    .max(50, "Логин не должен превышать 50 символов")
    .regex(/^[a-zA-Z0-9_-]+$/, "Логин может содержать только буквы, цифры, _ и -"),
  name: z.string()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(100, "Имя не должно превышать 100 символов"),
  password: z.string()
    .min(8, "Пароль должен содержать минимум 8 символов")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Пароль должен содержать заглавные, строчные буквы и цифры")
    .optional(),
  role: z.enum(['superadmin', 'admin', 'foreman', 'accountant', 'employee']),
  workshopId: z.string().nullable(),
  positionId: z.string().nullable(),
  payMode: z.enum(['hour', 'shift', 'piece']),
  rate: z.number().min(0, "Ставка не может быть отрицательной"),
  shiftCost: z.number().min(0, "Стоимость смены не может быть отрицательной"),
  avatar: z.string().nullable(),
  faceEmbedding: z.array(z.number()).nullable().optional(),
  faceUpdatedAt: z.string().optional(),
  barcode: z.string().optional(),
  color: z.string(),
  bio: z.string().max(500, "Биография не должна превышать 500 символов"),
  info: z.object({
    phone: z.string().optional(),
    email: z.string().email("Некорректный email").optional(),
    birth: z.string().optional(),
    address: z.string().optional(),
    emergency: z.string().optional(),
    hiredAt: z.string().optional(),
    docNote: z.string().optional(),
    passportNo: z.string().optional(),
    snils: z.string().optional(),
    inn: z.string().optional(),
    bankCard: z.string().optional(),
    bloodType: z.string().optional(),
    allergies: z.string().optional(),
    uniformSize: z.string().optional(),
    education: z.string().optional(),
    skills: z.string().optional(),
    maritalStatus: z.string().optional(),
  }).optional(),
  favs: z.array(z.string()).optional(),
  notes: z.string().optional(),
  active: z.boolean(),
  archived: z.boolean().optional(),
  archivedAt: z.string().optional(),
  archiveReason: z.string().optional(),
  archiveTone: z.enum(['pos', 'neg', 'neutral']).optional(),
  archiveNote: z.string().optional(),
  createdAt: z.string(),
});

// Валидация смены
export const punchSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректный формат даты"),
  tin: z.number().min(0).max(1440, "Время не может превышать 24 часа"),
  tout: z.number().min(0).max(1440).nullable(),
  source: z.enum(['app', 'kiosk', 'admin', 'scanner', 'auto']),
  auto: z.enum(['unscheduled', 'planned', 'schedule']).nullable().optional(),
  plannedOut: z.number().min(0).max(1440).nullable().optional(),
  resolution: z.enum(['pending', 'done']).nullable().optional(),
});

// Валидация графика
export const scheduleCellSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['day', 'night', 'off', 'vacation', 'sick']),
});

// Валидация заявки
export const requestSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  kind: z.enum(['swap', 'vacation', 'extra', 'resolution']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetUserId: z.string().optional(),
  note: z.string().max(1000, "Примечание не должно превышать 1000 символов"),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string(),
  decidedBy: z.string().optional(),
  decisionNote: z.string().optional(),
  punchId: z.string().optional(),
});

// Валидация сообщения
export const messageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  userId: z.string().min(1),
  text: z.string().max(5000, "Сообщение не должно превышать 5000 символов"),
  file: z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    src: z.string(),
  }).nullable(),
  ts: z.string(),
});

// Валидация поста
export const postSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  text: z.string().max(10000, "Пост не должен превышать 10000 символов"),
  image: z.string().nullable(),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    src: z.string(),
  })),
  link: z.string().url("Некорректный URL").nullable(),
  bg: z.string().nullable(),
  animated: z.boolean(),
  likes: z.array(z.string()),
  comments: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    text: z.string(),
    ts: z.string(),
  })),
  ts: z.string(),
  pinned: z.boolean(),
});

// Валидация заказа
export const orderSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Название обязательно").max(200),
  workshopId: z.string().nullable(),
  quantity: z.number().positive("Количество должно быть положительным"),
  unit: z.enum(['kg', 'pcs', 'l', 'ton']),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['new', 'in_progress', 'completed']),
  createdAt: z.string(),
  notes: z.string().max(1000).optional(),
});

// Валидация напоминания
export const reminderSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Заголовок обязателен").max(200),
  text: z.string().max(2000),
  targetType: z.enum(['all', 'workshop', 'user', 'position']),
  targetId: z.string().nullable(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdBy: z.string(),
  createdAt: z.string(),
  doneBy: z.array(z.string()),
});

// Валидация настроек
export const settingsSchema = z.object({
  orgName: z.string().min(1, "Название организации обязательно").max(200),
  orgInn: z.string().max(50),
  orgAddress: z.string().max(500),
  dailyNorm: z.number().min(1).max(24),
  breakMin: z.number().min(0).max(120),
  overtimeK: z.number().min(1).max(3),
  kioskFree: z.boolean(),
  adminPin: z.string().min(4, "PIN должен содержать минимум 4 символа").max(10),
  camOn: z.boolean(),
  camMirror: z.boolean(),
  camFlash: z.boolean(),
  camQuality: z.number().min(0.1).max(1),
  camNote: z.string().max(500),
  camBio: z.boolean(),
  camAutoTune: z.boolean(),
  camThreshold: z.number().min(0.1).max(1),
  camPreset: z.string().optional(),
  camDeviceId: z.string().nullable().optional(),
  camIpUrl: z.string().url().optional(),
  ipCameras: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    workshopId: z.string().nullable(),
  })).optional(),
  tgToken: z.string().optional(),
  tgChat: z.string().optional(),
  tgEvents: z.array(z.string()).optional(),
  aiMode: z.enum(['off', 'light', 'std', 'adv']),
  ollamaOn: z.boolean(),
  ollamaUrl: z.string().url().optional(),
  ollamaModel: z.string().optional(),
  apiToken: z.string().optional(),
  autostart: z.boolean().optional(),
  tunnelOn: z.boolean().optional(),
  tunnelUrl: z.string().url().optional(),
  kioskTheme: z.string().optional(),
});

// Валидация крон-задачи
export const cronJobSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Название обязательно").max(200),
  kind: z.enum(['analyze_shifts', 'analyze_photos', 'check_punctuality', 'custom']),
  enabled: z.boolean(),
  interval: z.number().min(1, "Интервал должен быть минимум 1 минута").max(1440, "Интервал не может превышать 24 часа"),
  lastRun: z.string().nullable(),
  nextRun: z.string().nullable(),
  params: z.record(z.string(), z.unknown()),
  createdBy: z.string(),
  createdAt: z.string(),
  runCount: z.number().min(0),
});

// Валидация игры с ИИ
export const gameAISchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: z.enum(['ttt', 'checkers', 'chess']),
  level: z.enum(['easy', 'medium', 'hard', 'adaptive']),
  wins: z.number().min(0),
  losses: z.number().min(0),
  draws: z.number().min(0),
  learningData: z.array(z.object({
    board: z.string(),
    bestMove: z.number(),
    score: z.number(),
  })),
  createdAt: z.string(),
});

// Вспомогательные функции для валидации
export function validateUser(data: unknown) {
  try {
    return userSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validatePunch(data: unknown) {
  try {
    return punchSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateScheduleCell(data: unknown) {
  try {
    return scheduleCellSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateRequest(data: unknown) {
  try {
    return requestSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateMessage(data: unknown) {
  try {
    return messageSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validatePost(data: unknown) {
  try {
    return postSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateOrder(data: unknown) {
  try {
    return orderSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateReminder(data: unknown) {
  try {
    return reminderSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateSettings(data: unknown) {
  try {
    return settingsSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateCronJob(data: unknown) {
  try {
    return cronJobSchema.parse(data);
  } catch (error) {
    return null;
  }
}

export function validateGameAI(data: unknown) {
  try {
    return gameAISchema.parse(data);
  } catch (error) {
    return null;
  }
}
