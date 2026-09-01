import * as XLSX from "xlsx";
import { DB, ShiftType } from "./types";
import { SHIFT_META } from "./types";
import { SumRow } from "./store";
import {
  hDec, daysInMonth, fmtDateFull, rangeKeys, weekdayIdx, WD, fmtMin,
} from "./time";

export function saveWorkbook(wb: XLSX.WorkBook, name: string) {
  XLSX.writeFile(wb, name, { compression: true });
}

function sheet(data: unknown[], widths?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(data);
  if (widths) ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

const CODE_TO_TYPE: Record<string, ShiftType> = {
  "Я": "day", "Н": "night", "В": "off", "О": "vacation", "Б": "sick",
};

export function exportPayroll(rows: SumRow[], periodLabel: string, orgName: string) {
  const data = rows.map((r, i) => ({
    "№": i + 1,
    "ФИО": r.user.name,
    "Логин": r.user.username,
    "Цех": r.user.dept,
    "Дней отработано": r.days,
    "Норма, ч": hDec(r.planMin),
    "Факт, ч": hDec(r.factMin),
    "Переработка, ч": hDec(r.otMin),
    "Недоработка, ч": hDec(r.shortMin),
    "Опозданий": r.late,
    "Ставка, ₽/ч": r.user.rate,
    "Начислено, ₽": Math.round(r.salary),
  }));
  const tot = rows.reduce(
    (t, r) => ({ p: t.p + r.planMin, f: t.f + r.factMin, o: t.o + r.otMin, s: t.s + r.shortMin, m: t.m + r.salary }),
    { p: 0, f: 0, o: 0, s: 0, m: 0 },
  );
  data.push({
    "№": "" as unknown as number, "ФИО": "ИТОГО", "Логин": "", "Цех": "", "Дней отработано": "",
    "Норма, ч": hDec(tot.p), "Факт, ч": hDec(tot.f), "Переработка, ч": hDec(tot.o),
    "Недоработка, ч": hDec(tot.s), "Опозданий": "", "Ставка, ₽/ч": "", "Начислено, ₽": Math.round(tot.m),
  } as never);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(data, [4, 26, 12, 18, 8, 9, 9, 13, 13, 10, 10, 12]), "Расчёт");
  const info = sheet([
    { Поле: "Организация", Значение: orgName },
    { Поле: "Период", Значение: periodLabel },
    { Поле: "Сформировано", Значение: fmtDateFull(new Date().toISOString().slice(0, 10)) + " " + new Date().toLocaleTimeString("ru-RU").slice(0, 5) },
    { Поле: "Источник", Значение: "СменаЛАН — сервер учёта рабочего времени" },
  ], [16, 60]);
  XLSX.utils.book_append_sheet(wb, info, "Инфо");
  saveWorkbook(wb, `raschet_${periodLabel.replace(/[^0-9a-zа-яё]/gi, "_")}.xlsx`);
}

export function exportSchedule(db: DB, monthKey: string, dept?: string) {
  const dim = daysInMonth(monthKey);
  const emps = db.users.filter((u) => u.role === "employee" && (!dept || u.dept === dept));
  const data = emps.map((u) => {
    const row: Record<string, string | number> = { "ФИО": u.name, "Цех": u.dept };
    let hours = 0;
    for (let d = 1; d <= dim; d++) {
      const key = monthKey.slice(0, 8) + String(d).padStart(2, "0");
      const c = db.schedule.find((s) => s.userId === u.id && s.date === key);
      row[String(d)] = c ? SHIFT_META[c.type].code : "·";
      if (c) hours += SHIFT_META[c.type].planned / 60;
    }
    row["Часы"] = hours;
    return row;
  });
  const wb = XLSX.utils.book_new();
  const ws = sheet(data, [26, 18, ...Array(dim).fill(3.5), 6]);
  XLSX.utils.book_append_sheet(wb, ws, "График");
  saveWorkbook(wb, `grafik_${monthKey.slice(0, 7)}.xlsx`);
}

export function exportMyStats(db: DB, userId: string, userName: string, from: string, to: string) {
  const rows = rangeKeys(from, to).map((k) => {
    const c = db.schedule.find((s) => s.userId === userId && s.date === k);
    const ps = db.punches.filter((p) => p.userId === userId && p.date === k);
    const fact = ps.reduce((s, p) => {
      const end = p.tout === null ? null : p.tout;
      if (end === null) return s;
      let raw = end >= p.tin ? end - p.tin : 1440 - p.tin + end;
      if (raw > 360) raw -= db.settings.breakMin;
      return s + Math.max(0, raw);
    }, 0);
    return {
      "Дата": k.split("-").reverse().join("."),
      "День недели": WD[weekdayIdx(k)],
      "По графику": c ? SHIFT_META[c.type].label : "—",
      "Приход": ps.length ? fmtMin(ps[0].tin) : "—",
      "Уход": ps.length && ps[ps.length - 1].tout !== null ? fmtMin(ps[ps.length - 1].tout!) : ps.length ? "на смене" : "—",
      "Факт, ч": fact ? hDec(fact) : "",
    };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows, [12, 14, 14, 8, 10, 8]), userName.slice(0, 28));
  saveWorkbook(wb, `tabel_${userName.split(" ")[0]}_${from}_${to}.xlsx`);
}

export function templateSchedule(monthKey: string) {
  const rows = [
    { "Дата (ДД.ММ.ГГГГ)": "05." + monthKey.slice(5, 7) + "." + monthKey.slice(0, 4), "Логин": "igor", "Тип (Я/Н/В/О/Б)": "Я" },
    { "Дата (ДД.ММ.ГГГГ)": "06." + monthKey.slice(5, 7) + "." + monthKey.slice(0, 4), "Логин": "igor", "Тип (Я/Н/В/О/Б)": "Н" },
    { "Дата (ДД.ММ.ГГГГ)": "", "Логин": "", "Тип (Я/Н/В/О/Б)": "" },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows, [18, 14, 18]), "Шаблон");
  const help = sheet([
    { Правило: "Дата в формате ДД.ММ.ГГГГ или ГГГГ-ММ-ДД" },
    { Правило: "Логин — как в системе (колонка Логин в «Сотрудниках»)" },
    { Правило: "Тип: Я — день 08–17, Н — ночь 20–08, В — выходной, О — отпуск, Б — больничный" },
    { Правило: "Пустые строки игнорируются. Существующие ячейки за выбранный день перезаписываются." },
  ], [90]);
  XLSX.utils.book_append_sheet(wb, help, "Подсказка");
  saveWorkbook(wb, "shablon_grafika.xlsx");
}

export function templateEmployees() {
  const rows = [
    { "ФИО": "Иванов Пётр Сергеевич", "Логин": "ivanov", "Пароль (пусто = без пароля)": "1234", "Роль (employee/admin)": "employee", "Цех": "Цех №1 Сборка", "Ставка ₽/ч": 300, "О себе": "" },
    { "ФИО": "", "Логин": "", "Пароль (пусто = без пароля)": "", "Роль (employee/admin)": "", "Цех": "", "Ставка ₽/ч": "", "О себе": "" },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows, [30, 14, 26, 20, 18, 10, 30]), "Шаблон");
  saveWorkbook(wb, "shablon_sotrudnikov.xlsx");
}

function parseDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export async function parseScheduleFile(file: File): Promise<{ cells: { username: string; date: string; type: ShiftType }[]; errors: string[] }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false });
  const cells: { username: string; date: string; type: ShiftType }[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const vals = Object.values(r);
    const date = parseDate(vals[0]);
    const username = String(vals[1] ?? "").trim();
    const tRaw = String(vals[2] ?? "").trim().toUpperCase();
    if (!date && !username && !tRaw) return;
    const type = CODE_TO_TYPE[tRaw];
    if (!date) return void errors.push(`Строка ${i + 2}: не распознана дата «${vals[0]}»`);
    if (!username) return void errors.push(`Строка ${i + 2}: нет логина`);
    if (!type) return void errors.push(`Строка ${i + 2}: неизвестный тип «${tRaw}»`);
    cells.push({ username, date, type });
  });
  return { cells, errors };
}

export async function parseEmployeesFile(file: File): Promise<{ rows: { name: string; username: string; password: string; role: string; dept: string; rate: number; bio: string }[]; errors: string[] }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false });
  const out: { name: string; username: string; password: string; role: string; dept: string; rate: number; bio: string }[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const v = Object.values(r);
    const name = String(v[0] ?? "").trim();
    const username = String(v[1] ?? "").trim();
    if (!name && !username) return;
    if (!name || !username) return void errors.push(`Строка ${i + 2}: нужны ФИО и логин`);
    const role = String(v[3] ?? "employee").trim().toLowerCase() === "admin" ? "admin" : "employee";
    out.push({
      name, username,
      password: String(v[2] ?? "").trim(),
      role,
      dept: String(v[4] ?? "Без цеха").trim() || "Без цеха",
      rate: Number(String(v[5] ?? "0").replace(",", ".")) || 0,
      bio: String(v[6] ?? ""),
    });
  });
  return { rows: out, errors };
}

export function exportJson(db: DB) {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `smenalan_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function parseJsonFile(file: File): Promise<DB> {
  return JSON.parse(await file.text());
}
