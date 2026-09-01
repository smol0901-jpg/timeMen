import { DB, User, ShiftCell, Punch, ShiftType } from "./types";
import { defaultPerms } from "./types";
import {
  todayKey, addDaysKey, dkey, monthStart, monthEnd, daysInMonth,
  weekdayIdx, seeded, rint, nowMin,
} from "./time";

const AVA_COLORS = ["#e56f24", "#3f6d9e", "#17875c", "#8a5aa0", "#b0567b", "#4d8a9c", "#a97a12", "#5d6a80"];

function mkUser(
  id: string, username: string, password: string, name: string,
  role: User["role"], dept: string, rate: number, bio: string, color: string,
): User {
  return { id, username, password, name, role, dept, rate, avatar: null, color, bio, active: true, createdAt: new Date().toISOString() };
}

export function makeSeed(): DB {
  const r = seeded(20260212);
  const tk = todayKey();
  const now = new Date();

  const users: User[] = [
    mkUser("u-root", "root", "root", "Главный администратор", "superadmin", "Управление", 0, "Полный контроль сервера, прав и данных.", AVA_COLORS[0]),
    mkUser("u-plan", "plan", "1234", "Ольга Ветрова", "admin", "Плановый отдел", 0, "Составляю графики, разбираю заявки.", AVA_COLORS[1]),
    mkUser("u-igor", "igor", "1234", "Игорь Савельев", "employee", "Цех №1 Сборка", 320, "Старший линии сборки.", AVA_COLORS[2]),
    mkUser("u-marina", "marina", "", "Марина Крылова", "employee", "Цех №1 Сборка", 300, "Контроль качества.", AVA_COLORS[3]),
    mkUser("u-sergey", "sergey", "1234", "Сергей Лапин", "employee", "Цех №2 Упаковка", 280, "Оператор линии упаковки.", AVA_COLORS[4]),
    mkUser("u-anna", "anna", "", "Анна Юдина", "employee", "Цех №2 Упаковка", 310, "Маркировка и отгрузка.", AVA_COLORS[5]),
    mkUser("u-dima", "dima", "1234", "Дмитрий Орлов", "employee", "Цех №1 Сборка", 340, "Наладчик станков.", AVA_COLORS[6]),
    mkUser("u-elena", "elena", "1234", "Елена Мороз", "employee", "Цех №2 Упаковка", 290, "Упаковка, ночные смены.", AVA_COLORS[7]),
    mkUser("u-pavel", "pavel", "", "Павел Гущин", "employee", "Цех №1 Сборка", 275, "Сборка узлов.", AVA_COLORS[1]),
    mkUser("u-nata", "nata", "1234", "Наталья Реброва", "employee", "Цех №2 Упаковка", 305, "Фасовка.", AVA_COLORS[3]),
  ];
  const emps = users.filter((u) => u.role === "employee");

  // ---- график: текущий и следующий месяц ----
  const schedule: ShiftCell[] = [];
  const months = [tk.slice(0, 7) + "-01", addDaysKey(monthEnd(tk), 1)];
  for (const mk of months) {
    const dim = daysInMonth(mk);
    emps.forEach((u, i) => {
      const night = i % 4 === 1;
      const pat = i % 3; // 0 = 5/2, 1 = 2/2, 2 = 2/2 со сдвигом
      for (let d = 1; d <= dim; d++) {
        const key = `${mk.slice(0, 8)}${String(d).padStart(2, "0")}`;
        const wd = weekdayIdx(key);
        let work: boolean;
        if (pat === 0) work = wd < 5;
        else {
          const since = Math.floor((Date.parse(key) / 86400000) + i) ;
          work = pat === 1 ? since % 4 < 2 : since % 4 >= 2;
        }
        if (u.id === "u-elena" && mk === months[0] && d >= 10 && d <= 14) {
          schedule.push({ userId: u.id, date: key, type: "vacation" });
          continue;
        }
        if (work) schedule.push({ userId: u.id, date: key, type: night ? "night" : "day" });
      }
    });
  }

  // ---- отметки за 16 дней ----
  const punches: Punch[] = [];
  const isOn = (uid: string, key: string): ShiftType | null => {
    const c = schedule.find((s) => s.userId === uid && s.date === key);
    return c ? c.type : null;
  };
  for (let back = 16; back >= 1; back--) {
    const key = addDaysKey(tk, -back);
    for (const u of emps) {
      const t = isOn(u.id, key);
      if (t === "day") {
        const late = r() < 0.13;
        const tin = 480 + rint(r, -4, 10) + (late ? rint(r, 18, 42) : 0);
        const tout = 1020 + rint(r, -10, 85);
        punches.push({ id: `p-${key}-${u.id}`, userId: u.id, date: key, tin, tout, source: r() < 0.5 ? "kiosk" : "app" });
      } else if (t === "night") {
        punches.push({ id: `p-${key}-${u.id}`, userId: u.id, date: key, tin: 1200 + rint(r, -5, 12), tout: 480 + rint(r, -15, 25), source: "kiosk" });
      }
    }
  }
  // незакрытая смена вчера (демо для админа)
  punches.push({ id: "p-open-yest", userId: "u-pavel", date: addDaysKey(tk, -1), tin: 483, tout: null, source: "kiosk" });
  // сегодня на смене прямо сейчас
  const nm = nowMin();
  const onToday = emps.filter((u) => isOn(u.id, tk) === "day").slice(0, 4);
  onToday.forEach((u, i) => {
    punches.push({
      id: `p-open-${u.id}`, userId: u.id, date: tk,
      tin: Math.max(0, nm - rint(r, 60, 260) - i * 17), tout: null, source: i % 2 ? "kiosk" : "app",
    });
  });
  // один уже отработал сегодня (только если сейчас позже 08:20)
  const done = emps.find((u) => isOn(u.id, tk) === "day" && !onToday.includes(u));
  if (done && nm > 500) {
    punches.push({ id: `p-done-${done.id}`, userId: done.id, date: tk, tin: 482, tout: Math.min(nm - 5, 1020), source: "app" });
  }

  const iso = (daysAgo: number, h: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, rint(r, 0, 59), 0, 0);
    return d.toISOString();
  };

  const db: DB = {
    v: 4,
    users,
    punches,
    schedule,
    requests: [
      { id: "rq-1", userId: "u-marina", kind: "swap", date: addDaysKey(tk, 1), targetUserId: "u-igor", note: "Нужно отлучиться в МФЦ с утра, отработаю за Игоря пятницу.", status: "pending", createdAt: iso(0, 9) },
      { id: "rq-2", userId: "u-sergey", kind: "vacation", date: addDaysKey(tk, 12), dateEnd: addDaysKey(tk, 21), note: "Отпуск, поездка к семье. График согласован с мастером.", status: "pending", createdAt: iso(1, 14) },
      { id: "rq-3", userId: "u-dima", kind: "extra", date: addDaysKey(tk, 6 - weekdayIdx(tk) > 0 ? 6 - weekdayIdx(tk) : 6), note: "Могу выйти в дополнительную смену на линию №2.", status: "pending", createdAt: iso(0, 11) },
      { id: "rq-4", userId: "u-elena", kind: "extra", date: addDaysKey(tk, -6), note: "Доп. смена вместо Анны.", status: "approved", createdAt: iso(8, 10), decidedBy: "u-plan", decisionNote: "Одобрено, табель обновлён." },
      { id: "rq-5", userId: "u-pavel", kind: "swap", date: addDaysKey(tk, -4), targetUserId: "u-dima", note: "Прошу замену на день.", status: "rejected", createdAt: iso(6, 12), decidedBy: "u-plan", decisionNote: "Нет резерва в этот день, попробуйте пятницу." },
    ],
    posts: [
      {
        id: "w-1", userId: "u-root", pinned: true, ts: iso(3, 10),
        text: "Сервер «СменаЛАН» запущен в локальной Wi-Fi сети завода. Отмечайтесь через приложение или терминал у входа в цех. Вопросы — в плановый отдел.",
        image: null, likes: ["u-plan", "u-igor", "u-anna", "u-elena"],
        comments: [{ id: "c-1", userId: "u-plan", text: "Инструкция по терминалу — в закреплённых файлах.", ts: iso(3, 11) }],
      },
      {
        id: "w-2", userId: "u-igor", pinned: false, ts: iso(0, 8),
        text: "В цехе №1 запустили новую линию! Сборка пошла быстрее, спасибо всем, кто помогал с монтажом на выходных.",
        image: "https://image.qwenlm.ai/generated-images/7b2a83ed-dc35-4e87-af1e-517d030730d3/_result.png",
        likes: ["u-marina", "u-plan", "u-dima", "u-pavel", "u-nata"],
        comments: [
          { id: "c-2", userId: "u-marina", text: "Красота! Поздравляю бригаду!", ts: iso(0, 9) },
          { id: "c-3", userId: "u-plan", text: "Доп. смены за монтаж оплачу по коэффициенту 1,5.", ts: iso(0, 9) },
        ],
      },
      {
        id: "w-3", userId: "u-plan", pinned: false, ts: iso(1, 17),
        text: "График на следующий месяц опубликован. Проверьте свои дни в разделе «График» — заявки на замены принимаю до пятницы.",
        image: null, likes: ["u-sergey", "u-nata"], comments: [],
      },
      {
        id: "w-4", userId: "u-anna", pinned: false, ts: iso(0, 12),
        text: "Кто может подменить в субботу на отгрузке? Долго не держать, пара часов всего 🙂",
        image: null, likes: ["u-sergey"],
        comments: [{ id: "c-4", userId: "u-sergey", text: "Могу после 12:00, напиши в личку.", ts: iso(0, 12) }],
      },
    ],
    notices: [
      { id: "n-1", audience: "u-plan", text: "Новые заявки: 3 ожидают решения", ts: iso(0, 11), readBy: [] },
      { id: "n-2", audience: "u-root", text: "Новые заявки: 3 ожидают решения", ts: iso(0, 11), readBy: [] },
      { id: "n-3", audience: "all", text: "Добро пожаловать в «СменаЛАН»! Отметки, график и заявки — теперь в одном месте.", ts: iso(3, 10), readBy: ["u-root", "u-plan"] },
    ],
    audit: [
      { id: "a-1", ts: iso(0, 8), actor: "терминал", action: "Отметка", details: "Игорь Савельев — начало смены (08:02)" },
      { id: "a-2", ts: iso(1, 17), actor: "Ольга Ветрова", action: "График", details: "Опубликован график на следующий месяц" },
      { id: "a-3", ts: iso(1, 14), actor: "Сергей Лапин", action: "Заявка", details: "Создана заявка: отпуск" },
      { id: "a-4", ts: iso(3, 10), actor: "Главный администратор", action: "Система", details: "Сервер развёрнут, загружены демо-данные" },
    ],
    settings: {
      orgName: 'ООО «Завод Протон»',
      orgInn: "ИНН 7712345678 / КПП 771201001",
      orgAddress: "г. Москва, ул. Заводская, 14",
      dailyNorm: 8,
      breakMin: 30,
      overtimeK: 1.5,
      kioskFree: true,
      adminPin: "1234",
    },
    perms: defaultPerms(),
  };
  void dkey; void monthStart; void now;
  return db;
}
