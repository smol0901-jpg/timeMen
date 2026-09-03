import { DB, User } from "./types";
import { defaultPerms } from "./types";
import { dkey, todayKey, addDaysKey, uid, mondayKey } from "./time";

const AV = ["#e56f24", "#3f6d9e", "#17875c", "#a97a12", "#7a4fbf", "#c74436", "#0f8b8d", "#b0487d"];

export function makeSeed(): DB {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const tk = todayKey();
  const d1 = addDaysKey(tk, -1);
  const d2 = addDaysKey(tk, -2);
  const wk = mondayKey(tk);

  const root: User = {
    id: "u-root", username: "root", password: "root", name: "Суперадминистратор",
    role: "superadmin", workshopId: null, positionId: null, payMode: "hour", rate: 0, shiftCost: 0,
    avatar: null, color: "#171b22", bio: "Полный контроль системы. Пароль меняется в профиле; резервный код восстановления хранится в зашифрованном виде.",
    active: true, createdAt: iso(now),
  };
  const buh: User = {
    id: "u-buh", username: "buh", password: "1234", name: "Бухгалтерия",
    role: "accountant", workshopId: null, positionId: null, payMode: "hour", rate: 0, shiftCost: 0,
    avatar: null, color: "#0f8b8d", bio: "Получает расчёты после подтверждения периодов администратором.",
    active: true, createdAt: iso(now),
  };
  const demo: User = {
    id: "u-demo", username: "demo", password: "", name: "Демо Сотрудник",
    role: "employee", workshopId: "w-meat", positionId: "p-deboner", payMode: "piece", rate: 0, shiftCost: 0,
    avatar: null, color: AV[0], bio: "Песочница для демонстрации системы. Создайте своих сотрудников в админке.",
    active: true, createdAt: iso(now),
  };

  const dim = now.getDate();
  const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const schedule = [];
  for (let d = 1; d <= dim; d++) {
    const date = `${mk}-${String(d).padStart(2, "0")}`;
    const wd = (new Date(date + "T12:00:00").getDay() + 6) % 7;
    if (wd < 5) schedule.push({ userId: "u-demo", date, type: "day" as const });
  }

  const db: DB = {
    v: 6,
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
    punches: [
      { id: uid(), userId: "u-demo", date: d2, tin: 478, tout: 1025, source: "kiosk" },
      { id: uid(), userId: "u-demo", date: d1, tin: 484, tout: 1052, source: "app" },
      { id: uid(), userId: "u-demo", date: wk, tin: 476, tout: 1010, source: "kiosk" },
    ],
    schedule,
    products: [
      { id: "pr-bird", name: "Птица (приёмка на обвалку)", unit: "кг", price: 0, workshopId: "w-meat", hidden: false, sort: 1 },
      { id: "pr-file", name: "Филе", unit: "кг", price: 180, workshopId: "w-meat", hidden: false, sort: 2 },
      { id: "pr-wing", name: "Крыло", unit: "кг", price: 95, workshopId: "w-meat", hidden: false, sort: 3 },
      { id: "pr-carcass", name: "Каркас", unit: "кг", price: 25, workshopId: "w-meat", hidden: false, sort: 4 },
      { id: "pr-skin", name: "Кожа", unit: "кг", price: 40, workshopId: "w-meat", hidden: false, sort: 5 },
      { id: "pr-bone", name: "Кость трубчатая", unit: "кг", price: 15, workshopId: "w-meat", hidden: false, sort: 6 },
    ],
    production: [
      { id: uid(), userId: "u-demo", date: d1, productId: "pr-file", qty: 42, note: "утренняя партия", ts: iso(new Date()) },
      { id: uid(), userId: "u-demo", date: d1, productId: "pr-wing", qty: 18, note: "", ts: iso(new Date()) },
    ],
    threads: [],
    messages: [],
    reminders: [
      {
        id: uid(), title: "Инвентаризация ножей", text: "Сдать ножи на заточку и отметиться у мастера до конца смены.",
        targetType: "workshop", targetId: "w-meat", due: addDaysKey(tk, 2), createdBy: "u-root", createdAt: iso(now), doneBy: [],
      },
    ],
    events: [],
    requests: [],
    posts: [
      {
        id: uid(), userId: "u-root", pinned: true, ts: iso(now),
        text: "Добро пожаловать в «СменаЛАН»!\n\nЭто корпоративная стена: новости, фото с производства, рисунки, ссылки и файлы — до 10 фото за раз. Отмечайте коллег через @, добавляйте сообщения в избранное ⭐. Групповые обсуждения цехов — в «Сообщениях».",
        image: null, attachments: [], link: null, bg: "g1", animated: true, favs: ["u-demo"],
        likes: ["u-demo"], comments: [
          { id: uid(), userId: "u-demo", text: "Отлично, стена работает!", ts: iso(now) },
        ],
      },
      {
        id: uid(), userId: "u-root", pinned: false, ts: iso(new Date(now.getTime() - 3600e3)),
        text: "Напоминание: отметки ставим в приложении или на терминале у входа. Вышли вне графика — система попросит указать время «работаю до» и предупредит админа проверить камеры.",
        image: null, attachments: [], link: null, bg: null, animated: false, favs: [],
        likes: [], comments: [],
      },
    ],
    notices: [
      { id: uid(), audience: "all", text: "Система запущена. Суперадмин: root / root · Бухгалтерия: buh / 1234 · Песочница: demo (без пароля).", ts: iso(now), readBy: [] },
    ],
    audit: [
      { id: uid(), ts: iso(now), actor: "система", action: "Система", details: "Инициализация новой базы v6 (демо-режим отключён, песочница demo)" },
    ],
    games: [
      { id: uid(), name: "Косынка (в браузере)", url: "https://cardgames.io/solitaire/" },
    ],
    scores: [],
    sensors: [],
    fines: [],
    ratings: [],
    periods: [],
    settings: {
      orgName: "ООО «Продлайн»", orgInn: "ИНН 7701234567 · КПП 770101001", orgAddress: "г. Пролетарск, ул. Заводская, 14",
      dailyNorm: 8, breakMin: 45, overtimeK: 1.5, kioskFree: true, adminPin: "1234",
      aiMode: "std", ollamaOn: false, ollamaUrl: "http://localhost:11434", ollamaModel: "llama3", apiToken: "",
      kioskTheme: "steel", bestUserId: null, bestOn: true,
      camNote: "Проверьте записи камер у входа и в цехе за указанный период.",
    },
    perms: defaultPerms(),
  };
  return db;
}

export { dkey };
