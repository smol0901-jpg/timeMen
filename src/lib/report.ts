import { Settings } from "./types";
import { SumRow } from "./store";
import { hDec, fmtDateFull, todayKey } from "./time";

/** Печать отчёта в официальном бланке (диалог «Сохранить как PDF»). */
export function printPayrollReport(rows: SumRow[], periodLabel: string, s: Settings) {
  const tot = rows.reduce(
    (t, r) => ({ p: t.p + r.planMin, f: t.f + r.factMin, o: t.o + r.otMin, sh: t.sh + r.shortMin, m: t.m + r.salary }),
    { p: 0, f: 0, o: 0, sh: 0, m: 0 },
  );
  const body = rows
    .map(
      (r, i) => `<tr>
      <td>${i + 1}</td><td class="l">${esc(r.user.name)}</td><td>${esc(r.user.dept)}</td>
      <td>${hDec(r.planMin)}</td><td><b>${hDec(r.factMin)}</b></td>
      <td>${r.otMin ? hDec(r.otMin) : "—"}</td><td>${r.shortMin ? hDec(r.shortMin) : "—"}</td>
      <td>${r.late || "—"}</td><td>${r.user.rate}</td><td class="r"><b>${Math.round(r.salary).toLocaleString("ru-RU")}</b></td>
    </tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>Табель — ${esc(periodLabel)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 12.5px/1.45 "Arial", "Segoe UI", sans-serif; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2.5px solid #111; padding-bottom: 10px; }
  .org { font-size: 17px; font-weight: 700; letter-spacing: .02em; }
  .req { font-size: 11px; color: #333; margin-top: 3px; }
  .appr { text-align: right; font-size: 11.5px; min-width: 200px; }
  .appr .u { border-top: 1px solid #111; margin-top: 26px; padding-top: 2px; }
  h1 { font-size: 15px; text-align: center; margin: 18px 0 2px; letter-spacing: .06em; }
  .sub { text-align: center; font-size: 12px; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 4px 6px; font-size: 11.5px; text-align: center; }
  th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  td.l { text-align: left; } td.r { text-align: right; white-space: nowrap; }
  tr.tot td { background: #f7f7f7; font-weight: 700; }
  .sign { display: flex; justify-content: space-between; margin-top: 34px; font-size: 12px; }
  .sign .blk { width: 46%; }
  .sign .line { border-top: 1px solid #111; margin-top: 30px; padding-top: 3px; display:flex; justify-content: space-between; }
  .stamp { margin: 26px auto 0; width: 150px; height: 150px; border: 1.5px dashed #999; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: #999; font-size: 11px; }
  .foot { margin-top: 18px; font-size: 10px; color: #555; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 6px; }
</style></head><body>
  <div class="head">
    <div>
      <div class="org">${esc(s.orgName)}</div>
      <div class="req">${esc(s.orgInn)}</div>
      <div class="req">${esc(s.orgAddress)}</div>
    </div>
    <div class="appr">
      УТВЕРЖДАЮ<br>Руководитель организации
      <div class="u">подпись / расшифровка</div>
      «____» ____________ ${new Date().getFullYear()} г.
    </div>
  </div>
  <h1>ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ И РАСЧЁТА ОПЛАТЫ ТРУДА</h1>
  <div class="sub">за период: <b>${esc(periodLabel)}</b> &nbsp;·&nbsp; форма Т-13 (упрощённая, внутренняя)</div>
  <table>
    <thead><tr>
      <th>№</th><th>ФИО сотрудника</th><th>Цех / отдел</th><th>Норма, ч</th><th>Факт, ч</th>
      <th>Перераб., ч</th><th>Недораб., ч</th><th>Опозд.</th><th>Ставка, ₽/ч</th><th>Начислено, ₽</th>
    </tr></thead>
    <tbody>${body}
      <tr class="tot"><td></td><td class="l">ИТОГО</td><td></td>
        <td>${hDec(tot.p)}</td><td>${hDec(tot.f)}</td><td>${hDec(tot.o)}</td><td>${hDec(tot.sh)}</td>
        <td></td><td></td><td class="r">${Math.round(tot.m).toLocaleString("ru-RU")}</td></tr>
    </tbody>
  </table>
  <div class="sign">
    <div class="blk">Составил (плановый отдел)<div class="line"><span>подпись</span><span>расшифровка</span></div></div>
    <div class="blk">Проверил (бухгалтерия)<div class="line"><span>подпись</span><span>расшифровка</span></div></div>
  </div>
  <div class="stamp">Место печати</div>
  <div class="foot">
    <span>Сформировано системой «СменаЛАН» · ${fmtDateFull(todayKey())}</span>
    <span>Переработка оплачивается с коэффициентом ${String(s.overtimeK).replace(".", ",")}</span>
  </div>
  <script>window.onload = function () { setTimeout(function(){ window.print(); }, 350); };<\/script>
</body></html>`;

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => frame.remove(), 60000);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
