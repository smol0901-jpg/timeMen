import { DB, Settings, SHIFT_META } from "./types";
import { SumRow, workedOn, wsName, posName } from "./store";
import { hDec, fmtDateFull, todayKey, rangeKeys, fmtMin } from "./time";

const BASE = `
  @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 12.5px/1.45 Arial, "Segoe UI", sans-serif; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2.5px solid #111; padding-bottom: 10px; }
  .org { font-size: 17px; font-weight: 700; }
  .req { font-size: 11px; color: #333; margin-top: 3px; }
  .appr { text-align: right; font-size: 11.5px; min-width: 210px; }
  .appr .u { border-top: 1px solid #111; margin-top: 26px; padding-top: 2px; }
  h1 { font-size: 15px; text-align: center; margin: 18px 0 2px; letter-spacing: .05em; }
  .sub { text-align: center; font-size: 12px; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 4px 6px; font-size: 11px; text-align: center; }
  th { background: #f0f0f0; font-size: 9.5px; text-transform: uppercase; letter-spacing: .03em; }
  td.l { text-align: left; } td.r { text-align: right; white-space: nowrap; }
  tr.tot td { background: #f7f7f7; font-weight: 700; }
  .sign { display: flex; justify-content: space-between; margin-top: 34px; font-size: 12px; }
  .sign .blk { width: 46%; }
  .sign .line { border-top: 1px solid #111; margin-top: 30px; padding-top: 3px; display: flex; justify-content: space-between; }
  .foot { margin-top: 18px; font-size: 10px; color: #555; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 6px; }
`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function head(s: Settings, title: string, sub: string, form: string): string {
  return `<div class="head">
    <div><div class="org">${esc(s.orgName)}</div><div class="req">${esc(s.orgInn)}</div><div class="req">${esc(s.orgAddress)}</div></div>
    <div class="appr">УТВЕРЖДАЮ<br>Руководитель организации<div class="u">подпись / расшифровка</div>«____» ____________ ${new Date().getFullYear()} г.</div>
  </div>
  <h1>${title}</h1><div class="sub">${sub} · ${form}</div>`;
}
function openDoc(title: string, bodyHtml: string) {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE}</style></head><body>${bodyHtml}
  <script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow!.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => frame.remove(), 60000);
}
function signatures(s: Settings): string {
  return `<div class="sign">
    <div class="blk">Составил (плановый отдел)<div class="line"><span>подпись</span><span>расшифровка</span></div></div>
    <div class="blk">Проверил (бухгалтерия)<div class="line"><span>подпись</span><span>расшифровка</span></div></div>
  </div>
  <div class="foot"><span>Сформировано системой «СменаЛАН» · ${fmtDateFull(todayKey())}</span><span>Переработка: коэффициент ${String(s.overtimeK).replace(".", ",")}</span></div>`;
}

/** Сводный табель + оплата (форма Т-13 упрощённая) */
export function printPayrollReport(rows: SumRow[], periodLabel: string, s: Settings) {
  const tot = rows.reduce((t, r) => ({ p: t.p + r.planMin, f: t.f + r.factMin, o: t.o + r.otMin, sh: t.sh + r.shortMin, m: t.m + r.salary }), { p: 0, f: 0, o: 0, sh: 0, m: 0 });
  const body = rows.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r.user.name)}</td><td>${esc(wsName({ workshops: [{ id: r.user.workshopId, name: "", piecework: false, color: "" }] } as unknown as DB, r.user.workshopId) === "—" ? "—" : "")}</td>
    <td>${hDec(r.planMin)}</td><td><b>${hDec(r.factMin)}</b></td><td>${r.otMin ? hDec(r.otMin) : "—"}</td><td>${r.shortMin ? hDec(r.shortMin) : "—"}</td>
    <td>${r.late || "—"}</td><td>${r.shifts}</td><td>${r.user.rate || r.user.shiftCost || "сд."}</td><td class="r"><b>${Math.round(r.salary).toLocaleString("ru-RU")}</b></td></tr>`).join("");
  openDoc("Табель", `${head(s, "ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ И РАСЧЁТА ОПЛАТЫ ТРУДА", `за период: <b>${esc(periodLabel)}</b>`, "форма Т-13 (упрощённая)")}
    <table><thead><tr><th>№</th><th>ФИО</th><th>Оплата</th><th>Норма, ч</th><th>Факт, ч</th><th>Перераб., ч</th><th>Недораб., ч</th><th>Опозд.</th><th>Смен</th><th>Ставка/смена</th><th>Начислено, ₽</th></tr></thead>
    <tbody>${body}<tr class="tot"><td></td><td class="l">ИТОГО</td><td></td><td>${hDec(tot.p)}</td><td>${hDec(tot.f)}</td><td>${hDec(tot.o)}</td><td>${hDec(tot.sh)}</td><td></td><td></td><td></td><td class="r">${Math.round(tot.m).toLocaleString("ru-RU")}</td></tr></tbody></table>
    ${signatures(s)}`);
}

/** Посещаемость: кто был на смене и сколько часов (день/неделя/месяц) + заявки */
export function printAttendanceReport(db: DB, from: string, to: string, title: string, periodLabel: string) {
  const keys = rangeKeys(from, to);
  const emps = db.users.filter((u) => u.role === "employee" && u.active);
  const wide = keys.length > 10;
  const cols = wide
    ? keys.filter((_, i) => i % Math.ceil(keys.length / 10) === 0)
    : keys;
  const headCells = keys.map((k) => `<th title="${fmtDateFull(k)}">${k.slice(8)}</th>`).join("");
  const rows = emps.map((u) => {
    let tot = 0;
    const cells = keys.map((k) => {
      const w = workedOn(db, u.id, k);
      tot += w;
      const cell = db.schedule.find((s) => s.userId === u.id && s.date === k);
      const code = cell ? SHIFT_META[cell.type].code : "·";
      return `<td>${w ? hDec(w) : `<span style="color:#999">${code}</span>`}</td>`;
    }).join("");
    return `<tr><td class="l">${esc(u.name)}</td><td>${esc(wsName(db, u.workshopId))}</td>${cells}<td><b>${hDec(tot)}</b></td></tr>`;
  }).join("");
  const req = db.requests.filter((q) => q.date >= from && q.date <= to);
  const reqRows = req.map((q) => `<tr><td>${fmtDateFull(q.date)}</td><td class="l">${esc(db.users.find((u) => u.id === q.userId)?.name || "?")}</td>
    <td>${q.kind === "swap" ? "Замена дня" : q.kind === "vacation" ? "Отпуск" : q.kind === "extra" ? "Доп. смена" : "Подтверждение"}</td>
    <td>${q.status === "pending" ? "ожидает" : q.status === "approved" ? "одобрена" : "отклонена"}</td></tr>`).join("");
  void cols;
  openDoc(title, `${head(db.settings, `ОТЧЁТ О ПОСЕЩАЕМОСТИ СМЕН`, `${esc(periodLabel)} · ${fmtDateFull(from)} — ${fmtDateFull(to)} · в ячейках часы, В — выходной, О — отпуск`, "внутренняя форма П-2")}
    <table><thead><tr><th>ФИО</th><th>Цех</th>${headCells}<th>Итого, ч</th></tr></thead><tbody>${rows}</tbody></table>
    <h1 style="margin-top:22px">ЗАЯВКИ ЗА ПЕРИОД</h1>
    <table><thead><tr><th>Дата</th><th>Сотрудник</th><th>Тип</th><th>Статус</th></tr></thead>
    <tbody>${reqRows || `<tr><td colspan="4">Заявок за период нет</td></tr>`}</tbody></table>
    ${signatures(db.settings)}`);
}

/** Отчёт по выработке (сдельные цеха) */
export function printProductionReport(db: DB, from: string, to: string, periodLabel: string) {
  const recs = db.production.filter((r) => r.date >= from && r.date <= to);
  const byUser = new Map<string, { qty: number; sum: number }>();
  const byProd = new Map<string, number>();
  recs.forEach((r) => {
    const p = db.products.find((x) => x.id === r.productId);
    const sum = r.qty * (p?.price || 0);
    const u = byUser.get(r.userId) || { qty: 0, sum: 0 };
    u.qty += r.qty; u.sum += sum; byUser.set(r.userId, u);
    byProd.set(p?.name || "?", (byProd.get(p?.name || "?") || 0) + r.qty);
  });
  const rows = [...byUser.entries()].map(([uid2, v], i) => {
    const u = db.users.find((x) => x.id === uid2);
    return `<tr><td>${i + 1}</td><td class="l">${esc(u?.name || "?")}</td><td>${esc(wsName(db, u?.workshopId || null))}</td>
      <td>${Math.round(v.qty * 10) / 10}</td><td class="r"><b>${Math.round(v.sum).toLocaleString("ru-RU")}</b></td></tr>`;
  }).join("");
  const prod = [...byProd.entries()].map(([n, q]) => `<tr><td class="l">${esc(n)}</td><td>${Math.round(q * 10) / 10} кг</td></tr>`).join("");
  const tot = [...byUser.values()].reduce((s, v) => s + v.sum, 0);
  openDoc("Выработка", `${head(db.settings, "ОТЧЁТ ПО СДЕЛЬНОЙ ВЫРАБОТКЕ", `${esc(periodLabel)} · ${fmtDateFull(from)} — ${fmtDateFull(to)}`, "форма С-1")}
    <table><thead><tr><th>№</th><th>Сотрудник</th><th>Цех</th><th>Объём, кг</th><th>Начислено, ₽</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5">Нет выработки за период</td></tr>`}
    <tr class="tot"><td></td><td class="l">ИТОГО</td><td></td><td></td><td class="r">${Math.round(tot).toLocaleString("ru-RU")}</td></tr></tbody></table>
    <h1 style="margin-top:22px">ПОЗИЦИИ</h1>
    <table><thead><tr><th>Продукт</th><th>Объём</th></tr></thead><tbody>${prod || `<tr><td colspan="2">Нет данных</td></tr>`}</tbody></table>
    ${signatures(db.settings)}`);
}
