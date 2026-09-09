// Готовые шаблоны камер и подключений API + автонастройка оборудования.
// Всё журналируется: каждое применение шаблона и каждый тест API попадает в журнал.

export interface CamDevice { id: string; label: string; kind: "usb" | "builtin" | "unknown" }
export interface CameraPreset {
  id: string; name: string; desc: string;
  deviceFilter: RegExp | null;      // выбор устройства по метке
  facing?: "user" | "environment";  // для телефонов
  widths: number[];                 // перебор разрешений (авто-подстройка)
  quality: number;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "auto", name: "Автоопределение", desc: "Сервер/клиент сам находит камеру: на ПК — внешнюю USB, на телефоне — фронтальную. Разрешение и фокус подбираются автоматически.",
    deviceFilter: null, widths: [1280, 960, 640], quality: 0.78,
  },
  {
    id: "usb", name: "USB-вебкамера (киоск)", desc: "Внешняя камера у терминала: Logitech C920 и аналоги. Шаблон: подключите камеру → она подхватится автоматически.",
    deviceFilter: /usb|logitech|c920|c922|webcam|hd pro|streamcam|razer|aukey|нешк/i, widths: [1920, 1280, 960], quality: 0.82,
  },
  {
    id: "builtin", name: "Встроенная камера", desc: "Камера ноутбука, планшета или айко-блока. Используется, если внешней камеры нет — переключение автоматическое.",
    deviceFilter: /facetime|built|встроен|integrated|ir camera|isight|внутренн/i, widths: [1280, 960, 640], quality: 0.75,
  },
  {
    id: "front", name: "Телефон (фронтальная)", desc: "Сотрудник подтверждает вход со своего телефона/планшета — используется фронтальная камера устройства.",
    deviceFilter: null, facing: "user", widths: [1280, 960, 640], quality: 0.75,
  },
  {
    id: "ip", name: "IP-камера (RTSP)", desc: "Сетевая камера цеха: укажите RTSP-адрес в шаблоне, сервер будет брать кадры сам (нужен ffmpeg на сервере).",
    deviceFilter: null, widths: [1280], quality: 0.7,
  },
];

export async function detectCameras(): Promise<CamDevice[]> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    // запрос разрешения, чтобы появились осмысленные подписи
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
    } catch { /* работаем без подписей */ }
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === "videoinput").map((d) => {
      const l = d.label || "Камера";
      const kind: CamDevice["kind"] = /usb|logitech|c920|webcam|hd pro|streamcam|razer/i.test(l) ? "usb"
        : /facetime|built|встроен|integrated|ir|isight/i.test(l) ? "builtin" : "unknown";
      return { id: d.deviceId, label: l, kind };
    });
  } catch { return []; }
}

/** Автоматический выбор камеры: внешняя USB приоритетнее встроенной (киоск), на телефоне — фронтальная. */
export function pickCamera(devices: CamDevice[], presetId: string, fixedId?: string | null): string | null {
  if (fixedId && devices.some((d) => d.id === fixedId)) return fixedId;
  const p = CAMERA_PRESETS.find((x) => x.id === presetId) || CAMERA_PRESETS[0];
  if (presetId === "front" || (presetId === "auto" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))) {
    return devices.find((d) => d.kind === "builtin")?.id || devices[0]?.id || null;
  }
  if (p.deviceFilter) {
    const m = devices.find((d) => p.deviceFilter!.test(d.label));
    if (m) return m.id;
  }
  if (presetId === "auto") {
    return devices.find((d) => d.kind === "usb")?.id || devices.find((d) => d.kind === "builtin")?.id || devices[0]?.id || null;
  }
  return devices[0]?.id || null;
}

/** Открыть камеру с авто-подстройкой: перебор разрешений, непрерывный фокус/экспозиция (адаптация к освещению). */
export async function openCamera(video: HTMLVideoElement, presetId: string, deviceId?: string | null): Promise<{ w: number; h: number; deviceId: string | null }> {
  const p = CAMERA_PRESETS.find((x) => x.id === presetId) || CAMERA_PRESETS[0];
  const devices = await detectCameras();
  const id = pickCamera(devices, presetId, deviceId);
  let lastErr: unknown = null;
  for (const w of p.widths) {
    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          width: { ideal: w }, height: { ideal: Math.round(w * 0.75) },
          ...(id ? { deviceId: { exact: id } } : {}),
          ...(p.facing ? { facingMode: p.facing } : {}),
        },
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = s;
      await video.play().catch(() => {});
      // адаптация к освещению и фокус на лице — непрерывные режимы, если камера поддерживает
      const track = s.getVideoTracks()[0];
      const cap = track.getCapabilities ? track.getCapabilities() : ({} as MediaTrackCapabilities);
      const adv: Record<string, unknown> = {};
      if ((cap as Record<string, unknown>).focusMode) adv.focusMode = "continuous";
      if ((cap as Record<string, unknown>).exposureMode) adv.exposureMode = "continuous";
      if ((cap as Record<string, unknown>).whiteBalanceMode) adv.whiteBalanceMode = "continuous";
      if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] }).catch(() => {});
      const st = track.getSettings();
      return { w: st.width || w, h: st.height || Math.round(w * 0.75), deviceId: st.deviceId || id || null };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("camera unavailable");
}

export function stopCamera(video: HTMLVideoElement) {
  const s = video.srcObject as MediaStream | null;
  s?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
}

// ---------------- шаблоны подключений API ----------------
export interface ApiTemplate {
  id: string; title: string; file: string; desc: string;
  steps: string[];
  content: Record<string, unknown>;
}

export const API_TEMPLATES: ApiTemplate[] = [
  {
    id: "telegram", title: "Telegram-бот и канал", file: "telegram.template.json",
    desc: "Отправка заявок, публикаций графика и внеплановых смен в Telegram.",
    steps: [
      "1. В Telegram напишите @BotFather → /newbot → получите токен вида 123456:ABC…",
      "2. Добавьте бота в канал/чат и сделайте администратором.",
      "3. Узнайте chat_id: бот @userinfobot (для канала: перешлите сообщение в @getmyid_bot).",
      "4. Замените значения в шаблоне и вставьте в Настройках админки (блок Telegram).",
      "5. Нажмите «Сохранить и отправить тест» — сообщение придёт в канал.",
    ],
    content: {
      _ИНСТРУКЦИЯ: "замените значения ниже и вставьте в Настройки → Telegram",
      bot_token: "ЗАМЕНИТЕ_НА_ТОКЕН_ОТ_BOTFATHER",
      chat_id: "ЗАМЕНИТЕ_НА_CHAT_ID (например -1001234567890 или @канал)",
      triggers: ["request", "schedule", "resolution", "camera"],
      server_endpoint: "POST /api/telegram {text}",
    },
  },
  {
    id: "ollama", title: "Локальная нейросеть (Ollama)", file: "ollama.template.json",
    desc: "ИИ-анализ, прогнозы и предложения по графику на вашей машине.",
    steps: [
      "1. Установите Ollama: https://ollama.com/download",
      "2. Скачайте небольшую модель: ollama pull llama3 (или qwen2.5:3b для слабых ПК).",
      "3. Запустите: ollama serve (порт 11434 по умолчанию).",
      "4. В Настройках админки включите «Локальная нейросеть», укажите адрес и модель.",
      "5. Раздел «ИИ-аналитик» → «Полный анализ» — ответ придёт от вашей модели.",
    ],
    content: {
      _ИНСТРУКЦИЯ: "адрес и модель вставляются в Настройки → ИИ и нейросеть",
      url: "http://localhost:11434",
      model: "llama3",
      lightweight_models: ["qwen2.5:1.5b", "gemma2:2b", "phi3.5:3.8b"],
      server_endpoint: "используется напрямую из приложения",
    },
  },
  {
    id: "sensors", title: "Датчики (температура, вес, СКУД)", file: "sensors.template.json",
    desc: "Любое устройство пишет показания в систему одним HTTP-запросом.",
    steps: [
      "1. В Настройках админки задайте API-токен (или оставьте пустым для открытой LAN).",
      "2. Настройте устройство на POST-запрос по образцу из шаблона.",
      "3. Показания появятся на Дашборде и в журнале; хранение бессрочное.",
    ],
    content: {
      _ИНСТРУКЦИЯ: "отправьте HTTP-запрос с любого устройства в вашей сети",
      method: "POST",
      url: "http://АДРЕС_СЕРВЕРА:8080/api/sensors",
      headers: { "Content-Type": "application/json", "X-API-Token": "ВАШ_ТОКЕН_ИЗ_НАСТРОЕК" },
      body: { name: "temp_myasnoy", value: 4.2, unit: "°C" },
      пример_curl: "curl -X POST http://192.168.1.10:8080/api/sensors -H \"Content-Type: application/json\" -d '{\"name\":\"temp\",\"value\":4.2,\"unit\":\"°C\"}'",
    },
  },
  {
    id: "ipcamera", title: "IP-камера (RTSP/ONVIF)", file: "ipcamera.template.json",
    desc: "Подключение любой сетевой камеры цеха к серверу.",
    steps: [
      "1. Узнайте RTSP-адрес камеры (обычно rtsp://логин:пароль@IP:554/stream1).",
      "2. Вставьте список камер в Настройках админки (блок «IP-камеры»).",
      "3. Для захвата кадров сервером установите ffmpeg на ПК-сервер (winget install ffmpeg).",
      "4. Кадры будут складываться в server/data/files и появляться в «Снимках камер».",
    ],
    content: {
      _ИНСТРУКЦИЯ: "замените адреса и добавьте камеры в Настройки → IP-камеры",
      cameras: [
        { name: "Вход / проходная", url: "rtsp://admin:ПАРОЛЬ@192.168.1.64:554/stream1", workshop: null },
        { name: "Мясной цех", url: "rtsp://admin:ПАРОЛЬ@192.168.1.65:554/stream1", workshop: "Мясной цех — обвалка птицы" },
      ],
      snapshot_command: "ffmpeg -rtsp_transport tcp -i \"<url>\" -frames:v 1 -q:v 5 server/data/files/cam_<имя>.jpg",
      server_endpoint: "POST /api/webcam {userId, dataBase64}",
    },
  },
  {
    id: "webhook", title: "Веб-хук (внешние системы)", file: "webhook.template.json",
    desc: "1С, CRM и скрипты забирают данные или пишут в систему по HTTP.",
    steps: [
      "1. Чтение: GET /api/today, /api/punches?date=…, /api/stats, /api/production — без токена в LAN.",
      "2. Запись: POST с заголовком X-API-Token (токен из Настроек).",
      "3. Полная синхронизация: GET /api/db → {version, data}.",
    ],
    content: {
      _ИНСТРУКЦИЯ: "базовый адрес — http://АДРЕС_СЕРВЕРА:8080",
      read: ["GET /api/today", "GET /api/employees", "GET /api/punches?date=2025-01-20", "GET /api/production", "GET /api/db"],
      write: ["POST /api/sensors", "POST /api/files", "POST /api/telegram", "POST /api/backup"],
      headers: { "X-API-Token": "ВАШ_ТОКЕН_ИЗ_НАСТРОЕК" },
    },
  },
  {
    id: "tunnel", title: "Туннель (доступ через мобильный интернет)", file: "tunnel.template.json",
    desc: "Работа из дома/с телефона вне Wi-Fi предприятия — без белых IP и настройки роутера.",
    steps: [
      "1. Установите cloudflared: winget install cloudflare.cloudflared (или brew/apt).",
      "2. Разовый вход: cloudflared tunnel login.",
      "3. Запустите: cloudflared tunnel --url http://localhost:8080 — получите адрес *.trycloudflare.com.",
      "4. Вставьте адрес в Настройках (блок «Туннель») — он появится в подсказках для сотрудников.",
      "5. Автозапуск туннеля вместе с сервером: cloudflared service install.",
    ],
    content: {
      _ИНСТРУКЦИЯ: "постоянный туннель: cloudflared tunnel create smenalan → route dns → run",
      quick_command: "cloudflared tunnel --url http://localhost:8080",
      service_install: "cloudflared service install",
      вставьте_адрес_в: "Настройки → Сервер и API → Туннель",
    },
  },
];

export function downloadTemplate(t: ApiTemplate) {
  const blob = new Blob([JSON.stringify(t.content, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = t.file;
  a.click();
  URL.revokeObjectURL(a.href);
}
