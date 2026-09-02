import * as XLSX from "xlsx";
import { DB, User, SHIFT_META, KIND_LABEL, PayMode } from "./types";
import { summarize, summarizeAll, SumRow, workedOn, plannedOn, openPunchOf, punchDur, pieceSumOf, wsName, posName } from "./store";
import { rangeKeys, fmtDateFull, fmtMin, todayKey, monthTitle, hDec } from "./time";

function save(wb: XLSX.WorkBook, name: string) {
  XLSX.writeFile(wb, name);
}
const PAY: Record<PayMode, string> = { hour: "почасовая", shift: "посменная", piece: "сдельная" };

export function exportEmployees(db: DB) {
  const rows = db.users.filter((u) => u.role !== "superadmin").map((u) => ({
    Логин: u.username, ФИО: u.name, Роль: u.role === "admin" ? "админ" : "сотрудник",
    Цех: wsName(db, u.workshopId), Должность: posName(db, u.positionId),
    Оплата: PAY[u.payMode], "Ставка ₽/ч": u.rate || "", "Смена ₽": u.shiftCost || "",
    Пароль: u.password ? "есть" : "нет", Активен: u.active ? "да" : "нет",
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Сотрудники");
  save(wb, "smenalan-sotrudniki.xlsx");
}

export function exportScheduleMonth(db: DB, monthKey: string) {
  const emps = db.users.filter((u) => u.role === "employee" && u.active);
  const rows = emps.map((u) => {
    const r: Record<string, string> = { Логин: u.username, ФИО: u.name, Цех: wsName(db, u.workshopId) };
    const dim = Number(monthKey.slice(8, 10));
    for (let d = 1; d <= dim; d++) {
      const k = monthKey.slice(0, 8) + String(d).padStart(2, "0");
      const c = db.schedule.find((s) => s.userId === u.id && s.date === k);
      r[String(d)] = c ? SHIFT_META[c.type].code : "";
    }
    return r;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "График");
  save(wb, `smenalan-grafik-${monthKey}.xlsx`);
}

export function scheduleTemplate(db: DB, monthKey: string) {
  const emps = db.users.filter((u) => u.role === "employee" && u.active);
  const rows = emps.map((u) => {
    const r: Record<string, string> = { Логин: u.username, ФИО: u.name };
    const dim = Number(monthKey.slice(8, 10));
    for (let d = 1; d <= dim; d++) r[String(d)] = "";
    return r;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Шаблон");
  save(wb, `smenalan-shablon-grafika-${monthKey}.xlsx`);
}

export function parseScheduleFile(file: File, monthKey: string): Promise<{ username: string; date: string; type: keyof typeof SHIFT_META }[]> {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = rej;
    rd.onload = () => {
      try {
        const wb = XLSX.read(rd.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const out: { username: string; date: string; type: keyof typeof SHIFT_META }[] = [];
        const codes: Record<string, keyof typeof SHIFT_META> = { Я: "day", Н: "night", В: "off", О: "vacation", Б: "sick" };
        rows.forEach((r) => {
          const login = String(r["Логин"] || r["логин"] || r["login"] || "").trim();
          if (!login) return;
          Object.keys(r).forEach((k) => {
            const d = Number(k);
            const v = String(r[k]).trim().toUpperCase();
            if (d >= 1 && d <= 31 && codes[v]) {
              out.push({ username: login, date: `${monthKey.slice(0, 8)}${String(d).padStart(2, "0")}`, type: codes[v] });
            }
          });
        });
        res(out);
      } catch { rej(new Error("bad file")); }
    };
    rd.readAsArrayBuffer(file);
  });
}

export function parseEmployeesFile(file: File): Promise<Partial<User>[]> {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = rej;
    rd.onload = () => {
      try {
        const wb = XLSX.read(rd.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        const out = rows.map((r) => ({
          username: String(r["Логин"] || r["логин"] || "").trim(),
          name: String(r["ФИО"] || r["фио"] || "").trim(),
          rate: Number(r["Ставка ₽/ч"] || r["Ставка"] || 0) || 0,
          password: "",
        })).filter((x) => x.username && x.name);
        res(out as Partial<User>[]);
      } catch { rej(new Error("bad file")); }
    };
    rd.readAsArrayBuffer(file);
  });
}

export function exportPayroll(db: DB, rows: SumRow[], periodLabel: string) {
  const sheet = rows.map((r, i) => ({
    "№": i + 1, "ФИО": r.user.name, "Цех": wsName(db, r.user.workshopId), "Должность": posName(db, r.user.positionId),
    "Оплата": PAY[r.user.payMode], "Норма, ч": hDec(r.planMin), "Факт, ч": hDec(r.factMin),
    "Переработка, ч": hDec(r.otMin), "Недоработка, ч": hDec(r.shortMin), "Опозданий": r.late,
    "Смен": r.shifts, "Сдельно, ₽": r.user.payMode === "piece" ? Math.round(r.pieceSum) : "",
    "Ставка ₽/ч": r.user.rate || "", "Смена ₽": r.user.shiftCost || "", "Начислено, ₽": Math.round(r.salary),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Табель");
  save(wb, `smenalan-tabel-${periodLabel.replace(/[^\wа-яА-Я-]+/g, "_")}.xlsx`);
}

export function exportAttendance(db: DB, from: string, to: string, title: string) {
  const emps = db.users.filter((u) => u.role === "employee" && u.active);
  const keys = rangeKeys(from, to);
  const rows = emps.map((u) => {
    const r: Record<string, string | number> = { "ФИО": u.name, "Цех": wsName(db, u.workshopId) };
    let fact = 0;
    keys.forEach((k) => {
      const w = workedOn(db, u.id, k);
      fact += w;
      r[fmtDateFull(k)] = w ? hDec(w) : "";
    });
    r["Итого, ч"] = hDec(fact);
    return r;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), title);
  const req = db.requests.filter((q) => q.date >= from && q.date <= to).map((q) => ({
    Дата: q.date, "Сотрудник": db.users.find((u) => u.id === q.userId)?.name || "?",
    Тип: KIND_LABEL[q.kind], Статус: q.status === "pending" ? "ожидает" : q.status === "approved" ? "одобрена" : "отклонена",
    Комментарий: q.note,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(req.length ? req : [{ " ": "Заявок за период нет" }]), "Заявки");
  save(wb, `smenalan-${title}-${from}_${to}.xlsx`);
}

export function exportProduction(db: DB, from: string, to: string) {
  const rows = db.production.filter((r) => r.date >= from && r.date <= to).map((r) => {
    const p = db.products.find((x) => x.id === r.productId);
    return {
      Дата: r.date,
      Сотрудник: db.users.find((u) => u.id === r.userId)?.name || "?",
      Цех: wsName(db, db.users.find((u) => u.id === r.userId)?.workshopId || null),
      Позиция: p?.name || "?", Кол: r.qty, Ед: p?.unit || "", "Цена": p?.price || 0, "Сумма, ₽": Math.round(r.qty * (p?.price || 0)),
      Примечание: r.note,
    };
  });
  const byProd = new Map<string, number>();
  db.production.filter((r) => r.date >= from && r.date <= to).forEach((r) => {
    const p = db.products.find((x) => x.id === r.productId);
    const k = p?.name || "?";
    byProd.set(k, (byProd.get(k) || 0) + r.qty);
  });
  const summary = [...byProd.entries()].map(([name, qty]) => ({ Позиция: name, "Всего, кг": Math.round(qty * 10) / 10 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ " ": "Нет выработки за период" }]), "Выработка");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary.length ? summary : [{ " ": "Нет данных" }]), "Итоги по позициям");
  save(wb, `smenalan-vyrabotka-${from}_${to}.xlsx`);
}

export function exportMyStats(db: DB, userId: string, name: string, from: string, to: string) {
  const row = summarize(db, db.users.find((u) => u.id === userId)!, from, to);
  const keys = rangeKeys(from, to);
  const days = keys.map((k) => {
    const w = workedOn(db, userId, k);
    const pl = plannedOn(db, userId, k);
    return { Дата: fmtDateFull(k), "План, ч": hDec(pl), "Факт, ч": w ? hDec(w) : "", "Баланс, ч": hDec(w - pl) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(days), "По дням");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
    Период: `${fmtDateFull(from)} — ${fmtDateFull(to)}`, "Факт, ч": hDec(row.factMin), "План, ч": hDec(row.planMin),
    "Переработка, ч": hDec(row.otMin), "Недоработка, ч": hDec(row.shortMin), "Опозданий": row.late, "К выплате, ₽": Math.round(row.salary),
  }]), "Итог"),
  save(wb, `smenalan-${name.replace(/\s+/g, "_")}-${from}_${to}.xlsx`);
}

export function parseProductsFile(file: File): Promise<{ name: string; unit: string; price: number }[]> {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = rej;
    rd.onload = () => {
      try {
        const wb = XLSX.read(rd.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        res(rows.map((r) => ({
          name: String(r["Название"] || r["Позиция"] || r["name"] || "").trim(),
          unit: String(r["Ед"] || r["unit"] || "кг").trim() || "кг",
          price: Number(r["Цена"] || r["price"] || 0) || 0,
        })).filter((x) => x.name));
      } catch { rej(new Error("bad file")); }
    };
    rd.readAsArrayBuffer(file);
  });
}

export function productsTemplate() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { Название: "Филе", Ед: "кг", Цена: 180 },
    { Название: "Крыло", Ед: "кг", Цена: 95 },
  ]), "Продукция");
  save(wb, "smenalan-shablon-produktsii.xlsx");
}

export function exportFot(db: DB, from: string, to: string) {
  const rows = summarizeAll(db, from, to).map((r) => ({
    "ФИО": r.user.name, "Цех": wsName(db, r.user.workshopId), "Должность": posName(db, r.user.positionId),
    "Оплата": PAY[r.user.payMode], "Часы": hDec(r.factMin), "Смен": r.shifts, "Начислено, ₽": Math.round(r.salary),
  }));
  const tot = rows.reduce((s, r) => s + (r["Начислено, ₽"] as number), 0);
  rows.push({ "ФИО": "ИТОГО", "Цех": "", "Должность": "", "Оплата": "", "Часы": "", "Смен": "", "Начислено, ₽": tot } as never);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "ФОТ");
  save(wb, `smenalan-fot-${from}_${to}.xlsx`);
}

export { workedOn, plannedOn, openPunchOf, punchDur, pieceSumOf, todayKey, monthTitle };
