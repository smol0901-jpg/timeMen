import * as XLSX from "xlsx";
import { DB, ShiftType } from "./types";
import { summarizeAll, SumRow, wsName, posName } from "./store";
import { rangeKeys, monthTitle, daysInMonth, hDec } from "./time";

function save(wb: XLSX.WorkBook, name: string) {
  XLSX.writeFile(wb, name);
}

export function exportAttendance(db: DB, from: string, to: string, kind: string) {
  const ws = XLSX.utils.aoa_to_sheet([
    [`СменаЛАН — ${kind} отчёт посещаемости`, `${from} — ${to}`],
    [],
    ["ФИО", "Логин", "Цех", "План, ч", "Факт, ч", "Переработка, ч", "Недоработка, ч", "Опоздания", "Смен", "Начислено, ₽", "Штрафы, ₽", "К выплате, ₽"],
    ...summarizeAll(db, from, to).map((r) => [
      r.user.name, r.user.username, wsName(db, r.user.workshopId),
      hDec(r.planMin), hDec(r.factMin), hDec(r.otMin), hDec(r.shortMin), r.late, r.shifts,
      Math.round(r.salary), Math.round(r.fineSum), Math.round(r.net),
    ]),
  ]);
  ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 26 }, { wch: 9 }, { wch: 9 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 7 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, ws, "Отчёт");
  save(b, `posechaemost_${from}_${to}.xlsx`);
}

export function exportPayroll(db: DB, rows: SumRow[], label: string) {
  const ws = XLSX.utils.aoa_to_sheet([
    [`СменаЛАН — табель и оплата`, label, db.settings.orgName, db.settings.orgInn],
    [],
    ["ФИО", "Цех", "Должность", "Оплата", "План, ч", "Факт, ч", "Перераб., ч", "Смен", "Ставка/смена", "Начислено, ₽", "Штрафы, ₽", "К выплате, ₽"],
    ...rows.map((r) => [
      r.user.name, wsName(db, r.user.workshopId), posName(db, r.user.positionId),
      r.user.payMode === "hour" ? "почасовая" : r.user.payMode === "shift" ? "посменная" : "сдельная",
      hDec(r.planMin), hDec(r.factMin), hDec(r.otMin), r.shifts,
      r.user.payMode === "hour" ? `${r.user.rate} ₽/ч` : r.user.payMode === "shift" ? `${r.user.shiftCost} ₽/см` : "выработка",
      Math.round(r.salary), Math.round(r.fineSum), Math.round(r.net),
    ]),
    [],
    ["ИТОГО", "", "", "", hDec(rows.reduce((s, r) => s + r.planMin, 0)), hDec(rows.reduce((s, r) => s + r.factMin, 0)),
      hDec(rows.reduce((s, r) => s + r.otMin, 0)), rows.reduce((s, r) => s + r.shifts, 0), "",
      Math.round(rows.reduce((s, r) => s + r.salary, 0)), Math.round(rows.reduce((s, r) => s + r.fineSum, 0)), Math.round(rows.reduce((s, r) => s + r.net, 0))],
  ]);
  ws["!cols"] = [{ wch: 24 }, { wch: 26 }, { wch: 18 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, ws, "Табель");
  save(b, `tabel_${label}.xlsx`);
}

export function exportProduction(db: DB, from: string, to: string) {
  const ws = XLSX.utils.aoa_to_sheet([
    ["СменаЛАН — выработка", `${from} — ${to}`],
    [],
    ["Дата", "ФИО", "Цех", "Позиция", "Кол-во", "Ед.", "Цена ₽", "Сумма ₽", "Примечание"],
    ...db.production.filter((r) => r.date >= from && r.date <= to).map((r) => {
      const p = db.products.find((x) => x.id === r.productId);
      const u = db.users.find((x) => x.id === r.userId);
      return [r.date, u?.name || "?", wsName(db, u?.workshopId || null), p?.name || "?", r.qty, p?.unit || "", p?.price || 0, Math.round(r.qty * (p?.price || 0)), r.note];
    }),
  ]);
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, ws, "Выработка");
  save(b, `vyrabotka_${from}_${to}.xlsx`);
}

export function exportEmployees(db: DB) {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Логин", "ФИО", "Роль", "Цех", "Должность", "Оплата", "Ставка ₽/ч", "Смена ₽"],
    ...db.users.filter((u) => !u.archived).map((u) => [u.username, u.name, u.role, wsName(db, u.workshopId), posName(db, u.positionId), u.payMode, u.rate, u.shiftCost]),
  ]);
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, ws, "Сотрудники");
  save(b, "sotrudniki.xlsx");
}

export function exportFot(db: DB, from: string, to: string) {
  exportPayroll(db, summarizeAll(db, from, to), `${from}_${to}`);
}

export function scheduleTemplate(db: DB, monthKey: string) {
  const dim = daysInMonth(monthKey + "-01");
  const head = ["Логин", "ФИО", ...rangeKeys(monthKey + "-01", `${monthKey}-${String(dim).padStart(2, "0")}`).map((k) => k.slice(8))];
  const rows = db.users.filter((u) => u.role === "employee" && !u.archived).map((u) => [
    u.username, u.name,
    ...rangeKeys(monthKey + "-01", `${monthKey}-${String(dim).padStart(2, "0")}`).map((k) => {
      const c = db.schedule.find((s) => s.userId === u.id && s.date === k);
      return c ? c.type.charAt(0).toUpperCase() : "";
    }),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([
    [`Шаблон графика на ${monthTitle(monthKey + "-01")}`],
    ["Коды: Я — день, Н — ночь, В — выходной, О — отпуск, Б — больничный, пусто — нет"],
    head, ...rows,
  ]);
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, ws, "График");
  save(b, `grafik_shablon_${monthKey}.xlsx`);
}

export function exportScheduleMonth(db: DB, monthKey: string) { scheduleTemplate(db, monthKey); }

const CODES: Record<string, ShiftType> = { "Я": "day", "D": "day", "Н": "night", "N": "night", "В": "off", "О": "vacation", "Б": "sick" };

export async function parseScheduleFile(file: File, monthKey: string): Promise<{ username: string; date: string; type: ShiftType }[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headIdx = rows.findIndex((r) => String(r[0] || "").trim().toLowerCase() === "логин");
  if (headIdx < 0) throw new Error("no header");
  const head = rows[headIdx].map((x) => String(x ?? ""));
  const out: { username: string; date: string; type: ShiftType }[] = [];
  for (const r of rows.slice(headIdx + 1)) {
    const username = String(r[0] ?? "").trim();
    if (!username) continue;
    for (let i = 2; i < head.length; i++) {
      const day = String(head[i] ?? "").trim();
      if (!/^\d{1,2}$/.test(day)) continue;
      const code = String(r[i] ?? "").trim().toUpperCase();
      if (!code || !(code in CODES)) continue;
      out.push({ username, date: `${monthKey}-${String(Number(day)).padStart(2, "0")}`, type: CODES[code] });
    }
  }
  return out;
}

export async function parseEmployeesFile(file: File): Promise<Partial<{ username: string; name: string; rate: number }>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const out: Partial<{ username: string; name: string; rate: number }>[] = [];
  for (const r of rows) {
    const u = String(r[0] ?? "").trim();
    const n = String(r[1] ?? "").trim();
    if (!u || !n || u.toLowerCase() === "логин") continue;
    out.push({ username: u.replace(/^@/, ""), name: n, rate: Number(r[6]) || 0 });
  }
  return out;
}
