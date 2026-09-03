import { DB, Settings } from "./types";
import { SumRow, wsName, punchDur } from "./store";
import { hDec, fmtDateFull, todayKey, rangeKeys } from "./time";

function esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function page(title: string, sub: string, s: Settings, tableHtml: string, footNote: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 12.5px/1.45 Arial, "Segoe UI", sans-serif; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2.5px solid #111; padding-bottom: 10px; }
  .org { font-size: 17px; font-weight: 700; }
  .req { font-size: 11px; color: #333; margin-top: 3px; }
  .appr { text-align: right; font-size: 11.5px; min-width: 200px; }
  .appr .u { border-top: 1px solid #111; margin-top: 26px; padding-top: 2px; }
  h1 { font-size: 15px; text-align: center; margin: 18px 0 2px; letter-spacing: .05em; }
  .sub { text-align: center; font-size: 12px; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 4px 6px; font-size: 11.5px; text-align: center; }
  th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  td.l { text-align: left; } td.r { text-align: right; white-space: nowrap; }
  tr.tot td { background: #f7f7f7; font-weight: 700; }
  .sign { display: flex; justify-content: space-between; margin-top: 34px; font-size: 12px; }
  .sign .blk { width: 46%; }
  .sign .line { border-top: 1px solid #111; margin-top: 30px; padding-top: 3px; display: flex; justify-content: space-between; }
  .stamp { margin: 26px auto 0; width: 150px; height: 150px; border: 1.5px dashed #999; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #999; font-size: 11px; }
  .foot { margin-top: 18px; font-size: 10px; color: #555; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 6px; }
</style></head><body>
  <div class="head">
    <div><div class="org">${esc(s.orgName)}</div><div class="req">${esc(s.orgInn)}</div><div class="req">${esc(s.orgAddress)}</div></div>
    <div class="appr">УТВЕРЖДАЮ<br>Руководитель организации<div class="u">подпись / расшифровка</div>«____» ____________ ${new Date().getFullYear()} г.</div>
  </div>
  <h1>${esc(title)}</h1>
  <div class="sub">${esc(sub)}</div>
  ${tableHtml}
  <div class="sign">
    <div class="blk">Составил<div class="line"><span>подпись</span><span>расшифровка</span></div></div>
    <div class="blk">Проверил (бухгалтерия)<div class="line"><span>подпись</span><span>расшифровка</span></div></div>
  </div>
  <div class="stamp">Место печати</div>
  <div class="foot"><span>Сформировано системой «СменаЛАН» · ${fmtDateFull(todayKey())}</span><span>${esc(footNote)}</span></div>
  <script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script>
</body></html>`;
}

export function printPayrollReport(db: DB, rows: SumRow[], periodLabel: string) {
  const s = db.settings;
  const tot = rows.reduce((t, r) => ({ p: t.p + r.planMin, f: t.f + r.factMin, o: t.o + r.otMin, m: t.m + r.net }), { p: 0, f: 0, o: 0, m: 0 });
  const table = `<table><thead><tr><th>№</th><th>ФИО</th><th>Цех</th><th>План, ч</th><th>Факт, ч</th><th>Перераб., ч</th><th>Опозд.</th><th>Смен</th><th>К выплате, ₽</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r.user.name)}</td><td>${esc(wsName(db, r.user.workshopId))}</td><td>${hDec(r.planMin)}</td><td><b>${hDec(r.factMin)}</b></td><td>${r.otMin ? hDec(r.otMin) : "—"}</td><td>${r.late || "—"}</td><td>${r.shifts}</td><td class="r"><b>${Math.round(r.net).toLocaleString("ru-RU")}</b></td></tr>`).join("")}
    <tr class="tot"><td></td><td class="l">ИТОГО</td><td></td><td>${hDec(tot.p)}</td><td>${hDec(tot.f)}</td><td>${hDec(tot.o)}</td><td></td><td></td><td class="r">${Math.round(tot.m).toLocaleString("ru-RU")}</td></tr>
  </tbody></table>`;
  openPage(page("ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ И РАСЧЁТА ОПЛАТЫ ТРУДА", `за период: ${periodLabel} · форма Т-13 (внутренняя)`, s, table, `Переработка × ${String(s.overtimeK).replace(".", ",")} · штрафы учтены`));
}

export function printAttendanceReport(db: DB, from: string, to: string, kind: string, periodLabel: string) {
  const keys = rangeKeys(from, to).slice(0, 31);
  const users = db.users.filter((u) => u.role === "employee" && u.active && !u.archived);
  const rows = users.map((u) => {
    const cells = keys.map((k) => {
      const ps = db.punches.filter((p) => p.userId === u.id && p.date === k);
      if (!ps.length) return "—";
      const min = ps.reduce((s2, p) => s2 + punchDur(p, db.settings.breakMin), 0);
      return hDec(min);
    });
    return `<tr><td class="l">${esc(u.name)}</td>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  }).join("");
  const table = `<table><thead><tr><th>ФИО</th>${keys.map((k) => `<th>${k.slice(8)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
  openPage(page(`${kind.toUpperCase()} ОТЧЁТ ПОСЕЩАЕМОСТИ`, `${periodLabel} · часы по дням (— нет смены)`, db.settings, table, "Отметки: терминал + приложение, автозакрытие по графику"));
}

export function printProductionReport(db: DB, from: string, to: string, periodLabel: string) {
  const recs = db.production.filter((r) => r.date >= from && r.date <= to);
  const table = `<table><thead><tr><th>Дата</th><th>ФИО</th><th>Позиция</th><th>Кол-во</th><th>Сумма, ₽</th></tr></thead><tbody>
    ${recs.slice(0, 120).map((r) => {
      const p = db.products.find((x) => x.id === r.productId);
      const u = db.users.find((x) => x.id === r.userId);
      return `<tr><td>${r.date}</td><td class="l">${esc(u?.name || "—")}</td><td>${esc(p?.name || "—")}</td><td>${r.qty} ${esc(p?.unit || "")}</td><td class="r">${Math.round(r.qty * (p?.price || 0)).toLocaleString("ru-RU")}</td></tr>`;
    }).join("")}
  </tbody></table>`;
  openPage(page("ОТЧЁТ ПО ВЫРАБОТКЕ (СДЕЛЬНАЯ ОПЛАТА)", periodLabel, db.settings, table, "Цены за единицу утверждает администратор"));
}

function openPage(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => frame.remove(), 60000);
}
