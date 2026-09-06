import React, { useMemo, useState } from "react";
import { useStore, userById, summarizeAll } from "../lib/store";
import { PayPeriod } from "../lib/types";
import { todayKey, monthStart, monthEnd, monthTitle, fmtMoney, hDec, fmtDateFull, addDaysKey, mondayKey } from "../lib/time";
import { I, useToast, Empty, Field, Modal, Avatar } from "../components/ui";
import { exportPayroll } from "../lib/excel";
import { printPayrollReport } from "../lib/report";

const KIND_RU: Record<PayPeriod["kind"], string> = { day: "День", week: "Неделя", month: "Месяц", season: "Сезон" };

export default function PayrollView() {
  const { db, me, createPeriod, setPeriodStatus, summarizeRows } = useStoreRows();
  const { toast } = useToast();
  const isAdmin = me?.role === "admin" || me?.role === "superadmin";
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "month" as PayPeriod["kind"], from: monthStart(todayKey()), to: monthEnd(todayKey()) });
  const [sel, setSel] = useState<string | null>(null);

  const periods = db.periods;
  const visible = isAdmin ? periods : periods.filter((p) => p.status !== "open");
  const selected = visible.find((p) => p.id === sel) || visible[0] || null;
  const rows = useMemo(() => (selected ? summarizeAll(db, selected.from, selected.to) : []), [db, selected]);
  const tot = rows.reduce((t, r) => ({ g: t.g + r.salary, f: t.f + r.fineSum, n: t.n + r.net, h: t.h + r.factMin }), { g: 0, f: 0, n: 0, h: 0 });

  const preset = (kind: PayPeriod["kind"]) => {
    const tk = todayKey();
    if (kind === "day") setF({ kind, from: tk, to: tk });
    if (kind === "week") { const m = mondayKey(tk); setF({ kind, from: m, to: addDaysKey(m, 6) }); }
    if (kind === "month") setF({ kind, from: monthStart(tk), to: monthEnd(tk) });
    if (kind === "season") {
      const y = Number(tk.slice(0, 4));
      const m = Number(tk.slice(5, 7));
      const q = Math.floor((m - 1) / 3);
      setF({ kind, from: `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, to: monthEnd(`${y}-${String(q * 3 + 3).padStart(2, "0")}-01`) });
    }
  };

  return (
    <div className="grid gap-4">
      <div className="card !border-night/40 p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-night-soft text-night grid place-items-center shrink-0"><I n="coin" size={17} /></span>
        <p className="text-[12.5px] font-bold text-mute leading-relaxed">
          {isAdmin
            ? "Создайте расчётный период (день, неделя, месяц, сезон), проверьте суммы и подтвердите — только после подтверждения расчёты становятся видны бухгалтерии."
            : "Расчёты появляются здесь после подтверждения периода администратором. Статус «выплачен» ставится после фактической выплаты."}
        </p>
        {isAdmin && <button className="btn btn-pri btn-sm ml-auto shrink-0" onClick={() => setOpen(true)}><I n="plus" size={13} />Период</button>}
      </div>

      {visible.length === 0 && (
        <div className="card"><Empty icon="coin" title={isAdmin ? "Периодов пока нет" : "Нет подтверждённых периодов"}
          text={isAdmin ? "Создайте первый расчётный период — система посчитает часы, переработки, выработку, штрафы и итог к выплате." : "Администратор ещё не подтвердил ни один период. Как только подтвердит — расчёты появятся здесь автоматически."} /></div>
      )}

      <div className="grid gap-2">
        {visible.map((p) => (
          <button key={p.id} onClick={() => setSel(p.id)}
            className={`card p-4 text-left transition-all hover:-translate-y-0.5 ${selected?.id === p.id ? "!border-accent ring-2 ring-accent/20" : ""}`}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`badge ${p.status === "open" ? "bg-warn-soft text-warn" : p.status === "approved" ? "bg-night-soft text-night" : "bg-ok-soft text-ok"}`}>
                {p.status === "open" ? "черновик" : p.status === "approved" ? "подтверждён" : "выплачен"}
              </span>
              <b className="font-display text-sm">{p.label}</b>
              <span className="text-[11.5px] font-bold text-mute">{KIND_RU[p.kind]} · {fmtDateFull(p.from)} — {fmtDateFull(p.to)}</span>
              {p.approvedBy && <span className="text-[11px] font-bold text-mute ml-auto">подтвердил: {userById(db, p.approvedBy)?.name || "—"}</span>}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile icon="clock" tone="night" label="Часы факт" val={`${hDec(tot.h)} ч`} />
            <Tile icon="coin" tone="accent" label="Начислено" val={fmtMoney(tot.g)} />
            <Tile icon="warn" tone={tot.f ? "bad" : "ok"} label="Штрафы" val={tot.f ? "−" + fmtMoney(tot.f) : "нет"} />
            <Tile icon="money" tone="ok" label="К выплате" val={fmtMoney(tot.n)} />
          </div>
          <div className="card overflow-x-auto">
            <table className="tbl min-w-[820px]">
              <thead><tr><th>Сотрудник</th><th>Цех</th><th>Оплата</th><th>Часы</th><th>Смен</th><th>Начислено</th><th>Штрафы</th><th>К выплате</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td><span className="flex items-center gap-2"><Avatar u={r.user} size={26} /><b className="whitespace-nowrap">{r.user.name}</b></span></td>
                    <td className="text-[12px] font-bold text-mute whitespace-nowrap">{db.workshops.find((w) => w.id === r.user.workshopId)?.name || "—"}</td>
                    <td><span className="badge bg-paper text-mute">{r.user.payMode === "hour" ? "часы" : r.user.payMode === "shift" ? "смены" : "сделка"}</span></td>
                    <td className="tnum">{hDec(r.factMin)}</td>
                    <td className="tnum">{r.shifts}</td>
                    <td className="tnum font-bold">{fmtMoney(r.salary)}</td>
                    <td className={`tnum ${r.fineSum ? "text-bad font-bold" : "text-mute"}`}>{r.fineSum ? "−" + fmtMoney(r.fineSum) : "—"}</td>
                    <td className="tnum font-bold text-ok">{fmtMoney(r.net)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="text-center text-mute font-bold py-6">Нет активных сотрудников</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card p-4 flex items-center gap-2 flex-wrap">
            <button className="btn btn-ghost btn-sm" onClick={() => { exportPayroll(db, rows, selected.label); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { printPayrollReport(rows, selected.label, db.settings); toast("Открыт бланк PDF", "ok"); }}><I n="pdf" size={14} />PDF-бланк</button>
            {isAdmin && (
              <span className="ml-auto flex gap-2 flex-wrap">
                {selected.status === "open" && (
                  <button className="btn btn-ok btn-sm" onClick={() => { setPeriodStatus(selected.id, "approved"); toast("Период подтверждён — бухгалтерия видит расчёты", "ok"); }}><I n="check" size={13} />Подтвердить период</button>
                )}
                {selected.status === "approved" && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setPeriodStatus(selected.id, "open"); toast("Период возвращён в черновики"); }}><I n="history" size={13} />Вернуть</button>
                    <button className="btn btn-pri btn-sm" onClick={() => { setPeriodStatus(selected.id, "paid"); toast("Отмечено: выплачено", "ok"); }}><I n="money" size={13} />Выплачено</button>
                  </>
                )}
                {selected.status === "paid" && <span className="badge bg-ok-soft text-ok !h-8 !px-3"><I n="check" size={13} />Выплачено</span>}
              </span>
            )}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новый расчётный период" w="max-w-md"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
          <button className="btn btn-pri" onClick={() => {
            const label = f.kind === "month" ? monthTitle(f.from) : f.kind === "day" ? fmtDateFull(f.from) : `${fmtDateFull(f.from)} — ${fmtDateFull(f.to)}`;
            createPeriod(f.kind, f.from, f.to, `${KIND_RU[f.kind]}: ${label}`);
            setOpen(false);
            toast("Период создан — проверьте суммы и подтвердите", "ok");
          }}><I n="check" size={15} />Создать</button>
        </>}>
        <div className="grid gap-4">
          <Field label="Тип периода">
            <div className="flex gap-1.5 flex-wrap">
              {(["day", "week", "month", "season"] as PayPeriod["kind"][]).map((k) => (
                <button key={k} className={`chip ${f.kind === k ? "!border-accent !text-accent-deep" : ""}`} onClick={() => preset(k)}>{KIND_RU[k]}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="С"><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="По"><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Tile({ icon, tone, label, val }: { icon: string; tone: string; label: string; val: string }) {
  const tones: Record<string, string> = {
    accent: "bg-accent-soft text-accent-deep", ok: "bg-ok-soft text-ok", bad: "bg-bad-soft text-bad", night: "bg-night-soft text-night",
  };
  return (
    <div className="card p-3.5 flex items-start gap-3">
      <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${tones[tone]}`}><I n={icon} size={17} /></span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-mute">{label}</div>
        <div className="font-display text-[16px] font-bold tnum truncate">{val}</div>
      </div>
    </div>
  );
}

/** хук-обёртка, чтобы не дублировать деструктуризацию */
function useStoreRows() {
  const s = useStore();
  return { ...s, summarizeRows: summarizeAll };
}
