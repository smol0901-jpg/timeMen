import React, { useMemo, useRef, useState } from "react";
import { useStore, userById, wsName, summarizeAll, remindersFor, careerData, finesOf } from "../lib/store";
import { ModuleId, MODULES, ROLE_LABEL, Role, Device, KIND_LABEL, User } from "../lib/types";
import {
  todayKey, mondayKey, addDaysKey, monthStart, monthEnd, monthTitle, fmtDateFull, relTime, fmtMoney, hDec,
} from "../lib/time";
import { I, Avatar, useToast, Tabs, Field, Empty, Seg, Confirm, Toggle } from "../components/ui";
import { exportAttendance, exportPayroll, exportEmployees, exportProduction, exportFot } from "../lib/excel";
import { printPayrollReport, printAttendanceReport, printProductionReport } from "../lib/report";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

// ================= HR-компоненты (штрафы, оценки, досье) =================
export function FinePanel({ userId }: { userId: string }) {
  const { db, me, addFine, removeFine } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState({ amount: "", reason: "" });
  const canManage = me?.role === "admin" || me?.role === "superadmin";
  const fines = db.fines.filter((x) => x.userId === userId);
  return (
    <div className="grid gap-3">
      {canManage && (
        <div className="grid sm:grid-cols-[110px_1fr_auto] gap-2">
          <input type="number" className="input !h-9 tnum" placeholder="Сумма ₽" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <input className="input !h-9" placeholder="Причина…" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <button className="btn btn-bad btn-sm !h-9" onClick={() => {
            const a = Number(f.amount);
            if (!a || a <= 0 || !f.reason.trim()) { toast("Сумма и причина обязательны", "bad"); return; }
            addFine(userId, a, f.reason.trim(), null);
            setF({ amount: "", reason: "" });
            toast("Штраф назначен", "ok");
          }}><I n="plus" size={13} />Штраф</button>
        </div>
      )}
      {fines.length === 0 ? <p className="text-[12px] font-bold text-mute">Штрафов нет.</p> : fines.map((x) => (
        <div key={x.id} className="flex items-center gap-2.5 border border-bad/30 bg-bad-soft/40 rounded-lg px-3 py-2">
          <I n="warn" size={15} className="text-bad shrink-0" />
          <div className="min-w-0 flex-1">
            <b className="text-[12.5px] block">{x.reason}</b>
            <span className="text-[10.5px] font-bold text-mute">{fmtDateFull(x.ts.slice(0, 10))}</span>
          </div>
          <b className="tnum text-bad text-sm">−{fmtMoney(x.amount)}</b>
          {canManage && <button className="w-7 h-7 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => { removeFine(x.id); toast("Штраф снят", "ok"); }}><I n="x" size={13} /></button>}
        </div>
      ))}
    </div>
  );
}

export function RatingPanel({ userId }: { userId: string }) {
  const { db, me, addRating } = useStore();
  const { toast } = useToast();
  const [m, setM] = useState(todayKey().slice(0, 7));
  const [pts, setPts] = useState(80);
  const [note, setNote] = useState("");
  const canManage = me?.role === "admin" || me?.role === "superadmin";
  const list = db.ratings.filter((r) => r.userId === userId).sort((a, b) => b.month.localeCompare(a.month));
  return (
    <div className="grid gap-3">
      {canManage && (
        <div className="border border-line rounded-xl p-3.5 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Месяц"><input type="month" className="input !h-9" value={m} onChange={(e) => setM(e.target.value)} /></Field>
            <Field label={`Баллы: ${pts}/100`}><input type="range" min={0} max={100} value={pts} onChange={(e) => setPts(Number(e.target.value))} className="w-full mt-2 accent-[#e56f24]" /></Field>
          </div>
          <Field label="Комментарий"><input className="input !h-9" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn btn-pri btn-sm" onClick={() => { addRating(userId, m, pts, note.trim()); setNote(""); toast("Оценка сохранена", "ok"); }}><I n="star" size={13} />Поставить</button>
        </div>
      )}
      {list.length === 0 ? <p className="text-[12px] font-bold text-mute">Оценок нет.</p> : (
        <div className="grid gap-1.5">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
              <span className={`font-display font-bold tnum text-sm w-12 ${r.points >= 80 ? "text-ok" : r.points >= 50 ? "text-warn" : "text-bad"}`}>{r.points}</span>
              <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden"><div className={`h-full rounded-full ${r.points >= 80 ? "bg-ok" : r.points >= 50 ? "bg-warn" : "bg-bad"}`} style={{ width: `${r.points}%` }} /></div>
              <span className="text-[11px] font-bold text-mute whitespace-nowrap">{r.month}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DossierModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { db } = useStore();
  const data = useMemo(() => (user ? careerData(db, user) : []), [db, user]);
  if (!user) return null;
  const totH = Math.round(data.reduce((s, x) => s + x.hours, 0));
  const totS = data.reduce((s, x) => s + x.shifts, 0);
  const totP = data.reduce((s, x) => s + x.pay, 0);
  const info = user.info;
  return (
    <ModalWrap onClose={onClose} title={<span className="flex items-center gap-2"><Avatar u={user} size={26} />Досье: {user.name}{user.archived && <span className="badge bg-paper text-mute">в архиве</span>}</span>}>
      <div className="grid gap-4">
        {user.archived && (
          <div className={`rounded-xl border p-3.5 text-[12.5px] font-bold ${user.archiveTone === "pos" ? "border-ok/50 bg-ok-soft/50" : user.archiveTone === "neg" ? "border-bad/50 bg-bad-soft/50" : "border-line bg-paper"}`}>
            Причина: {user.archiveReason || "—"} · {user.archivedAt ? fmtDateFull(user.archivedAt.slice(0, 10)) : ""}
            {user.archiveNote && <p className="mt-1 font-semibold text-mute">Характеристика: {user.archiveNote}</p>}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniStat v={String(totH)} l="часов" /><MiniStat v={String(totS)} l="смен" /><MiniStat v={fmtMoney(totP)} l="выплачено" />
          <MiniStat v={fmtMoney(finesOf(db, user.id, "2000-01-01", "2999-12-31"))} l="штрафы" />
        </div>
        {info && (info.phone || info.email || info.birth || info.address || info.emergency || info.docNote) && (
          <div className="card p-4">
            <h4 className="lbl">Личная карточка</h4>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
              {info.phone && <p><b>Телефон:</b> {info.phone}</p>}
              {info.email && <p><b>E-mail:</b> {info.email}</p>}
              {info.birth && <p><b>Рождение:</b> {info.birth}</p>}
              {info.hiredAt && <p><b>Приём:</b> {info.hiredAt}</p>}
              {info.address && <p><b>Адрес:</b> {info.address}</p>}
              {info.emergency && <p><b>Экстренный контакт:</b> {info.emergency}</p>}
              {info.docNote && <p className="sm:col-span-2"><b>Документы:</b> {info.docNote}</p>}
            </div>
          </div>
        )}
        <div className="card p-4">
          <h4 className="font-display text-[13px] font-semibold mb-3">Живой график: часы и оценки (хранится навсегда)</h4>
          {data.every((x) => x.hours === 0 && x.points === null) ? <p className="text-[12px] font-bold text-mute">Данных пока нет.</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe1e8" />
                <XAxis dataKey="m" tick={{ fontSize: 10, fontWeight: 700 }} interval="preserveStartEnd" />
                <YAxis yAxisId="h" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip /><Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Bar yAxisId="h" dataKey="hours" name="Часы" fill="#3f6d9e" radius={[4, 4, 0, 0]} />
                <Line yAxisId="p" dataKey="points" name="Оценка" stroke="#e56f24" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </ModalWrap>
  );
}
function MiniStat({ v, l }: { v: string; l: string }) {
  return <div className="card p-2.5 text-center"><div className="font-display text-[15px] font-bold tnum truncate">{v}</div><div className="text-[10px] font-extrabold uppercase text-mute">{l}</div></div>;
}
function ModalWrap({ title, children, onClose }: { title: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()} style={{ background: "rgba(14,17,22,0.55)", backdropFilter: "blur(3px)" }}>
      <div className="card w-full max-w-3xl anim-pop max-h-[92vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line shrink-0">
          <h3 className="font-display text-sm font-semibold flex-1 truncate">{title}</h3>
          <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-paper transition" onClick={onClose}><I n="x" size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ================= ЗАЯВКИ (АДМИН) =================
export function RequestsAdmin() {
  const { db, decideRequest } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const [note, setNote] = useState<Record<string, string>>({});
  const pend = db.requests.filter((r) => r.status === "pending" && r.kind !== "resolution");
  const rest = db.requests.filter((r) => r.status !== "pending" || r.kind === "resolution").slice(0, 60);
  const list = tab === "pending" ? pend : rest;
  return (
    <div className="grid gap-4 max-w-4xl">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "pending", label: "Ожидают", icon: "warn", count: pend.length },
        { id: "all", label: "История", icon: "history" },
      ]} />
      {list.length === 0 && <div className="card"><Empty icon="doc" title={tab === "pending" ? "Нет ожидающих заявок" : "История пуста"} /></div>}
      {list.map((r) => {
        const u = userById(db, r.userId);
        const target = r.targetUserId ? userById(db, r.targetUserId) : null;
        return (
          <div key={r.id} className="card p-4 anim-rise">
            <div className="flex items-center gap-3 flex-wrap">
              <Avatar u={u} size={36} />
              <div className="min-w-0">
                <b className="text-sm block">{u?.name} <span className="text-mute font-bold text-[11px]">· {wsName(db, u?.workshopId || null)}</span></b>
                <span className="text-[12px] font-bold">{KIND_LABEL[r.kind]} · {fmtDateFull(r.date)}{r.dateEnd && r.dateEnd !== r.date ? ` — ${fmtDateFull(r.dateEnd)}` : ""}{target ? ` · с ${target.name}` : ""}</span>
              </div>
              <span className={`badge ml-auto ${r.status === "pending" ? "bg-warn-soft text-warn" : r.status === "approved" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                {r.status === "pending" ? "ожидает" : r.status === "approved" ? "одобрена" : "отклонена"}
              </span>
            </div>
            {r.note && <p className="text-[13px] mt-2 bg-paper border border-line rounded-lg px-3 py-2">{r.note}</p>}
            {r.status !== "pending" && r.decisionNote && <p className="text-[12px] font-bold text-mute mt-2">Решение: {r.decisionNote}</p>}
            {r.status === "pending" && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <input className="input !h-9 flex-1 min-w-[200px]" placeholder="Комментарий…" value={note[r.id] || ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                <button className="btn btn-ok" onClick={() => { decideRequest(r.id, true, (note[r.id] || "").trim()); toast("Одобрено", "ok"); }}><I n="check" size={15} />Одобрить</button>
                <button className="btn btn-bad" onClick={() => { decideRequest(r.id, false, (note[r.id] || "").trim() || "Отклонено"); toast("Отклонено", "bad"); }}><I n="x" size={15} />Отклонить</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ================= ОТЧЁТЫ =================
export function ReportsView() {
  const { db, me, createPeriod } = useStore();
  const { toast } = useToast();
  const isAdmin = me?.role === "admin" || me?.role === "superadmin";
  const [tab, setTab] = useState("day");
  const tk = todayKey();
  const [day, setDay] = useState(tk);
  const [week, setWeek] = useState(mondayKey(tk));
  const [month, setMonth] = useState(tk.slice(0, 7));
  const [from, setFrom] = useState(monthStart(tk));
  const [to, setTo] = useState(monthEnd(tk));
  const [ws, setWs] = useState("");

  const range = useMemo((): [string, string, string] => {
    if (tab === "day") return [day, day, `Ежедневный · ${fmtDateFull(day)}`];
    if (tab === "week") { const f = week, t = addDaysKey(week, 6); return [f, t, `Еженедельный · ${fmtDateFull(f)} — ${fmtDateFull(t)}`]; }
    if (tab === "month") { const f = monthStart(month + "-01"), t = monthEnd(month + "-01"); return [f, t, `Ежемесячный · ${monthTitle(month + "-01")}`]; }
    return [from, to, `Сводный · ${fmtDateFull(from)} — ${fmtDateFull(to)}`];
  }, [tab, day, week, month, from, to]);
  const [rf, rt, label] = range;
  const rows = summarizeAll(db, rf, rt, ws || null);

  return (
    <div className="grid gap-4">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "day", label: "Ежедневный", icon: "clock" },
        { id: "week", label: "Еженедельный", icon: "cal" },
        { id: "month", label: "Ежемесячный", icon: "chart" },
        { id: "payroll", label: "Табель и оплата", icon: "coin" },
        { id: "prod", label: "Выработка", icon: "box" },
      ]} />
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        {tab === "day" && <input type="date" className="input !w-44 !h-9" value={day} onChange={(e) => setDay(e.target.value)} />}
        {tab === "week" && (
          <span className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setWeek(addDaysKey(week, -7))}><I n="chevL" size={14} /></button>
            <input type="date" className="input !w-44 !h-9" value={week} onChange={(e) => setWeek(mondayKey(e.target.value))} />
            <button className="btn btn-ghost btn-sm" onClick={() => setWeek(addDaysKey(week, 7))}><I n="chevR" size={14} /></button>
          </span>
        )}
        {tab === "month" && <input type="month" className="input !w-44 !h-9" value={month} onChange={(e) => setMonth(e.target.value)} />}
        {tab === "payroll" && (
          <span className="flex items-center gap-2">
            <input type="date" className="input !w-40 !h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-mute font-bold">—</span>
            <input type="date" className="input !w-40 !h-9" value={to} onChange={(e) => setTo(e.target.value)} />
          </span>
        )}
        {tab !== "prod" && (
          <select className="input !w-56 !h-9" value={ws} onChange={(e) => setWs(e.target.value)}>
            <option value="">Все цеха</option>
            {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <span className="ml-auto flex gap-2 flex-wrap">
          {isAdmin && tab !== "prod" && (
            <button className="btn btn-dark btn-sm" onClick={() => {
              createPeriod(tab === "day" ? "day" : tab === "week" ? "week" : tab === "month" ? "month" : "season", rf, rt, label, "approved");
              toast("Период подтверждён и передан бухгалтерии", "ok");
            }}><I n="coin" size={14} />В бухгалтерию</button>
          )}
          {tab !== "prod" && tab !== "payroll" && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { exportAttendance(db, rf, rt, tab); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
              <button className="btn btn-pri btn-sm" onClick={() => { printAttendanceReport(db, rf, rt, tab === "day" ? "Ежедневный" : tab === "week" ? "Еженедельный" : "Ежемесячный", label.split("·")[1] || label); }}><I n="pdf" size={14} />PDF бланк</button>
            </>
          )}
          {tab === "payroll" && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { exportPayroll(db, rows, `${rf}_${rt}`); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
              <button className="btn btn-pri btn-sm" onClick={() => { printPayrollReport(db, rows, label.split("·")[1] || label); }}><I n="pdf" size={14} />PDF для бухгалтерии</button>
            </>
          )}
          {tab === "prod" && (
            <>
              <input type="date" className="input !w-36 !h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" className="input !w-36 !h-9" value={to} onChange={(e) => setTo(e.target.value)} />
              <button className="btn btn-ghost btn-sm" onClick={() => { exportProduction(db, rf, rt); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
              <button className="btn btn-pri btn-sm" onClick={() => printProductionReport(db, rf, rt, `${fmtDateFull(rf)} — ${fmtDateFull(rt)}`)}><I n="pdf" size={14} />PDF</button>
            </>
          )}
        </span>
      </div>

      {tab !== "prod" ? (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[820px]">
            <thead><tr><th>Сотрудник</th><th>Цех</th><th>Оплата</th><th>План, ч</th><th>Факт, ч</th><th>Перераб.</th><th>Недораб.</th><th>Опозд.</th><th>Смен</th><th>Начислено</th><th>Штрафы</th><th>К выплате</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user.id}>
                  <td><span className="flex items-center gap-2"><Avatar u={r.user} size={26} /><b className="whitespace-nowrap">{r.user.name}</b></span></td>
                  <td className="text-[12px] font-bold text-mute whitespace-nowrap">{wsName(db, r.user.workshopId)}</td>
                  <td><span className="badge bg-paper text-mute">{r.user.payMode === "hour" ? "часы" : r.user.payMode === "shift" ? "смены" : "сделка"}</span></td>
                  <td className="tnum">{hDec(r.planMin)}</td>
                  <td className="tnum font-bold">{hDec(r.factMin)}</td>
                  <td className={`tnum ${r.otMin ? "text-ok font-bold" : "text-mute"}`}>{r.otMin ? hDec(r.otMin) : "—"}</td>
                  <td className={`tnum ${r.shortMin ? "text-bad font-bold" : "text-mute"}`}>{r.shortMin ? hDec(r.shortMin) : "—"}</td>
                  <td className={`tnum ${r.late ? "text-warn font-bold" : "text-mute"}`}>{r.late || "—"}</td>
                  <td className="tnum">{r.shifts}</td>
                  <td className="tnum">{fmtMoney(r.salary)}</td>
                  <td className={`tnum ${r.fineSum ? "text-bad font-bold" : "text-mute"}`}>{r.fineSum ? `−${fmtMoney(r.fineSum)}` : "—"}</td>
                  <td className="tnum font-bold text-ok whitespace-nowrap">{fmtMoney(r.net)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={12} className="text-center text-mute font-bold py-6">Нет активных сотрудников</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Дата</th><th>Сотрудник</th><th>Цех</th><th>Позиция</th><th>Кол-во</th><th>Сумма</th></tr></thead>
            <tbody>
              {db.production.filter((r) => r.date >= rf && r.date <= rt).slice(0, 80).map((r) => {
                const u = userById(db, r.userId);
                const p = db.products.find((x) => x.id === r.productId);
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-[12px]">{r.date}</td>
                    <td className="whitespace-nowrap">{u?.name || "—"}</td>
                    <td className="text-[12px] text-mute font-bold whitespace-nowrap">{wsName(db, u?.workshopId || null)}</td>
                    <td>{p?.name || "—"}</td>
                    <td className="tnum font-bold">{r.qty} {p?.unit}</td>
                    <td className="tnum text-ok">{fmtMoney(r.qty * (p?.price || 0))}</td>
                  </tr>
                );
              })}
              {db.production.filter((r) => r.date >= rf && r.date <= rt).length === 0 && <tr><td colSpan={6} className="text-center text-mute font-bold py-6">Нет выработки</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ================= РАСЧЁТЫ (БУХГАЛТЕРИЯ) =================
export function PayrollView() {
  const { db, me, setPeriodStatus, createPeriod } = useStore();
  const { toast } = useToast();
  const [sel, setSel] = useState<string | null>(null);
  const isAdmin = me?.role === "admin" || me?.role === "superadmin";
  const isAcc = me?.role === "accountant";
  const [nf, setNf] = useState({ kind: "month" as "day" | "week" | "month" | "season", from: monthStart(todayKey()), to: monthEnd(todayKey()), label: "" });

  const approved = db.periods.filter((p) => p.status !== "open");
  const cur = db.periods.find((p) => p.id === sel) || approved[0];
  const rows = cur ? summarizeAll(db, cur.from, cur.to) : [];

  return (
    <div className="grid gap-4">
      {isAcc && approved.length === 0 && (
        <div className="card !border-night/40 p-5"><Empty icon="coin" title="Ждём подтверждения администратора" text="Расчёты появляются здесь после того, как админ подтвердит период (день, неделю, месяц или сезон) в «Отчётах» или ниже." /></div>
      )}
      {isAdmin && (
        <div className="card p-4 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold uppercase text-mute">Новый период:</span>
          <select className="input !w-32 !h-9" value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value as never })}>
            <option value="day">День</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="season">Сезон</option>
          </select>
          <input type="date" className="input !w-40 !h-9" value={nf.from} onChange={(e) => setNf({ ...nf, from: e.target.value })} />
          <input type="date" className="input !w-40 !h-9" value={nf.to} onChange={(e) => setNf({ ...nf, to: e.target.value })} />
          <button className="btn btn-ghost btn-sm" onClick={() => { createPeriod(nf.kind, nf.from, nf.to, nf.label.trim() || `${nf.kind === "day" ? "День" : nf.kind === "week" ? "Неделя" : nf.kind === "month" ? "Месяц" : "Сезон"} ${nf.from}—${nf.to}`, "open"); toast("Период создан (черновик)", "ok"); }}><I n="plus" size={13} />Черновик</button>
          <button className="btn btn-pri btn-sm" onClick={() => { createPeriod(nf.kind, nf.from, nf.to, nf.label.trim() || `${nf.kind === "day" ? "День" : nf.kind === "week" ? "Неделя" : nf.kind === "month" ? "Месяц" : "Сезон"} ${nf.from}—${nf.to}`, "approved"); toast("Подтверждено и передано бухгалтерии", "ok"); }}><I n="check" size={13} />Подтвердить и передать</button>
        </div>
      )}
      {db.periods.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {db.periods.slice(0, 12).map((p) => (
            <button key={p.id} onClick={() => setSel(p.id)}
              className={`chip !h-9 px-3 ${cur?.id === p.id ? "!border-accent !text-accent-deep !bg-accent-soft" : ""} ${p.status === "open" ? "opacity-60" : ""}`}>
              <I n={p.status === "paid" ? "check" : p.status === "approved" ? "coin" : "edit"} size={13} />
              {p.label.slice(0, 26)}
              <span className={`badge ${p.status === "paid" ? "bg-ok text-white" : p.status === "approved" ? "bg-night-soft text-night" : "bg-paper text-mute"}`}>{p.status === "paid" ? "выплачен" : p.status === "approved" ? "подтверждён" : "черновик"}</span>
            </button>
          ))}
        </div>
      )}
      {cur && (
        <>
          <div className="card p-4 flex items-center gap-3 flex-wrap">
            <b className="font-display text-sm">{cur.label}</b>
            <span className="text-[12px] text-mute font-bold">{fmtDateFull(cur.from)} — {fmtDateFull(cur.to)}</span>
            <span className="ml-auto flex gap-2 flex-wrap">
              {isAdmin && cur.status === "open" && <button className="btn btn-pri btn-sm" onClick={() => { setPeriodStatus(cur.id, "approved"); toast("Передано бухгалтерии", "ok"); }}><I n="send" size={13} />Подтвердить</button>}
              {(isAcc || isAdmin) && cur.status === "approved" && <button className="btn btn-ok btn-sm" onClick={() => { setPeriodStatus(cur.id, "paid"); toast("Отмечен выплаченным", "ok"); }}><I n="check" size={13} />Выплачено</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => { exportPayroll(db, rows, `${cur.from}_${cur.to}`); toast("Excel сохранён", "ok"); }}><I n="xls" size={13} />Excel</button>
              <button className="btn btn-pri btn-sm" onClick={() => printPayrollReport(db, rows, cur.label)}><I n="pdf" size={13} />PDF бланк</button>
            </span>
          </div>
          <div className="card overflow-x-auto">
            <table className="tbl min-w-[700px]">
              <thead><tr><th>Сотрудник</th><th>Цех</th><th>Тип</th><th>Факт, ч</th><th>Смен</th><th>Начислено</th><th>Штрафы</th><th>К выплате</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td className="whitespace-nowrap"><b>{r.user.name}</b></td>
                    <td className="text-[12px] text-mute font-bold">{wsName(db, r.user.workshopId)}</td>
                    <td><span className="badge bg-paper text-mute">{r.user.payMode === "hour" ? "часы" : r.user.payMode === "shift" ? "смены" : "сделка"}</span></td>
                    <td className="tnum">{hDec(r.factMin)}</td>
                    <td className="tnum">{r.shifts}</td>
                    <td className="tnum">{fmtMoney(r.salary)}</td>
                    <td className={`tnum ${r.fineSum ? "text-bad font-bold" : "text-mute"}`}>{r.fineSum ? `−${fmtMoney(r.fineSum)}` : "—"}</td>
                    <td className="tnum font-bold text-ok">{fmtMoney(r.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="font-bold"><td colSpan={5} className="!py-3">ИТОГО к выплате</td>
                <td className="tnum">{fmtMoney(rows.reduce((s, r) => s + r.salary, 0))}</td>
                <td className="tnum text-bad">−{fmtMoney(rows.reduce((s, r) => s + r.fineSum, 0))}</td>
                <td className="tnum text-ok">{fmtMoney(rows.reduce((s, r) => s + r.net, 0))}</td></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ================= НАПОМИНАНИЯ =================
export function RemindersView() {
  const { db, addReminder, removeReminder, markReminderDone } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState({ title: "", text: "", targetType: "all" as "all" | "workshop" | "user" | "position", targetId: "", due: addDaysKey(todayKey(), 1) });
  const [del, setDel] = useState<string | null>(null);
  void remindersFor;
  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="bell" size={16} />Новое напоминание</h3>
        <div className="grid gap-3">
          <Field label="Заголовок"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Текст"><textarea className="input" rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
          <Field label="Кому">
            <select className="input" value={f.targetType} onChange={(e) => setF({ ...f, targetType: e.target.value as never, targetId: "" })}>
              <option value="all">Всем</option><option value="workshop">Цеху</option><option value="position">Должности</option><option value="user">Человеку</option>
            </select>
          </Field>
          {f.targetType === "workshop" && <select className="input" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}><option value="">—</option>{db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
          {f.targetType === "position" && <select className="input" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}><option value="">—</option>{db.positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          {f.targetType === "user" && <select className="input" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}><option value="">—</option>{db.users.filter((u) => u.role === "employee" && !u.archived).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
          <Field label="Дата"><input type="date" className="input" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
          <button className="btn btn-pri" onClick={() => {
            if (!f.title.trim()) { toast("Укажите заголовок", "bad"); return; }
            if (f.targetType !== "all" && !f.targetId) { toast("Выберите получателя", "bad"); return; }
            addReminder(f.title.trim(), f.text.trim(), f.targetType, f.targetId || null, f.due);
            setF({ ...f, title: "", text: "" });
            toast("Создано — адресаты уведомлены", "ok");
          }}><I n="send" size={16} />Создать</button>
        </div>
      </div>
      <div className="grid gap-3">
        {db.reminders.length === 0 && <div className="card"><Empty icon="bell" title="Напоминаний нет" /></div>}
        {db.reminders.map((r) => {
          const tgt = r.targetType === "all" ? "все" : r.targetType === "workshop" ? db.workshops.find((w) => w.id === r.targetId)?.name : r.targetType === "position" ? db.positions.find((p) => p.id === r.targetId)?.name : userById(db, r.targetId || "")?.name;
          const overdue = r.due < todayKey();
          return (
            <div key={r.id} className={`card p-4 anim-rise ${overdue ? "!border-warn/50" : ""}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${overdue ? "bg-warn-soft text-warn" : "bg-night-soft text-night"}`}><I n="cal" size={11} />{fmtDateFull(r.due)}</span>
                <b className="text-sm">{r.title}</b>
                <span className="badge bg-paper text-mute">→ {tgt || "—"}</span>
                <span className="ml-auto flex gap-1">
                  <button className="btn btn-ghost btn-sm" onClick={() => markReminderDone(r.id)}><I n="check" size={13} />Выполнено ({r.doneBy.length})</button>
                  <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition" onClick={() => setDel(r.id)}><I n="trash" size={14} /></button>
                </span>
              </div>
              {r.text && <p className="text-[13px] mt-1.5">{r.text}</p>}
            </div>
          );
        })}
      </div>
      <Confirm open={!!del} onClose={() => setDel(null)} title="Удалить напоминание?" text="Исчезнет у всех адресатов." onYes={() => { if (del) { removeReminder(del); toast("Удалено"); } }} />
    </div>
  );
}

// ================= ПРАВА =================
export function PermsView() {
  const { db, setPerm, me } = useStore();
  const { toast } = useToast();
  if (me?.role !== "superadmin") return <div className="card"><Empty icon="shield" title="Раздел суперадмина" /></div>;
  const roles: Role[] = ["admin", "accountant", "employee"];
  const devs: Device[] = ["desktop", "mobile"];
  return (
    <div className="grid gap-4 max-w-4xl">
      <div className="card !border-night/40 p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-night-soft text-night grid place-items-center shrink-0"><I n="info" size={17} /></span>
        <p className="text-[13px] font-bold text-mute leading-relaxed">Матрица «модуль × роль × устройство». Применяется на всех устройствах мгновенно. Суперадмин всегда имеет полный доступ.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[700px]">
          <thead><tr><th>Модуль</th>{roles.map((r) => <th key={r} colSpan={2} className="text-center">{ROLE_LABEL[r]}</th>)}</tr>
            <tr><th></th>{roles.flatMap((r) => devs.map((d) => <th key={r + d} className="text-center !bg-transparent">{d === "desktop" ? "ПК" : "PWA"}</th>))}</tr></thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.id}>
                <td><span className="flex items-center gap-2"><I n={m.icon} size={15} className="text-mute" /><b>{m.label}</b></span></td>
                {roles.flatMap((r) => devs.map((d) => {
                  const val = db.perms[m.id]?.[r]?.[d] ?? false;
                  return (
                    <td key={r + d} className="text-center">
                      <button onClick={() => { setPerm(m.id as ModuleId, r, d, !val); toast(`${m.label}: ${ROLE_LABEL[r]} ${d === "desktop" ? "ПК" : "PWA"} — ${!val ? "открыт" : "закрыт"}`, "ok"); }}
                        className={`w-9 h-6 rounded-full transition-colors relative inline-block ${val ? "bg-ok" : "bg-steel-200"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${val ? "left-[14px]" : "left-0.5"}`} />
                      </button>
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= ДАННЫЕ + АВТОКОНТРОЛЬ =================
export function DataIOView() {
  const { db, importAll, serverHealth } = useStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [diag, setDiag] = useState<{ ok: boolean; version?: number; uptime_sec?: number; port?: number; db_kb?: number; backups?: { name: string; size_kb: number }[]; ms?: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const runDiag = async () => {
    setChecking(true);
    const t0 = performance.now();
    const r = await serverHealth();
    setDiag({ ...r, ms: Math.round(performance.now() - t0) });
    setChecking(false);
  };
  React.useEffect(() => { runDiag(); const t = setInterval(runDiag, 15000); return () => clearInterval(t); }, []);

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start max-w-5xl">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="zap" size={16} />Автоконтроль сервера</h3>
        <div className={`rounded-xl border p-4 ${diag?.ok ? "border-ok/50 bg-ok-soft/50" : "border-bad/50 bg-bad-soft/50"}`}>
          <b className="text-sm flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${diag?.ok ? "bg-ok pulse-ok" : "bg-bad blink"}`} />
            {diag?.ok ? "Сервер работоспособен" : checking ? "Проверка…" : "Сервер недоступен — локальный режим"}
          </b>
          {diag?.ok && (
            <div className="grid grid-cols-2 gap-2 mt-3 text-[12px] font-bold text-mute">
              <span>Версия базы: <b className="text-ink">v{diag.version}</b></span>
              <span>Порт: <b className="text-ink">{diag.port}</b></span>
              <span>Аптайм: <b className="text-ink">{diag.uptime_sec ? `${Math.floor(diag.uptime_sec / 3600)} ч ${Math.floor((diag.uptime_sec % 3600) / 60)} мин` : "—"}</b></span>
              <span>База: <b className="text-ink">{diag.db_kb ? `${(diag.db_kb / 1024).toFixed(1)} МБ` : "—"}</b></span>
              <span>Отклик: <b className="text-ink">{diag.ms} мс</b></span>
              <span>Резервных копий: <b className="text-ink">{diag.backups?.length ?? 0}</b></span>
            </div>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            <button className="btn btn-ghost btn-sm" onClick={runDiag} disabled={checking}><I n="history" size={13} />Проверить</button>
            {diag?.ok && <button className="btn btn-ghost btn-sm" onClick={async () => {
              try {
                const r = await fetch("./api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                toast(r.ok ? "Копия создана на сервере" : "Сервер отклонил (нужен токен)", r.ok ? "ok" : "bad");
                runDiag();
              } catch { toast("Не удалось", "bad"); }
            }}><I n="download" size={13} />Копия сейчас</button>}
          </div>
        </div>
        {diag?.ok && diag.backups && diag.backups.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {diag.backups.slice(0, 5).map((b) => (
              <div key={b.name} className="flex items-center gap-2 text-[11.5px] font-bold text-mute border border-line rounded-lg px-3 py-1.5">
                <I n="file" size={13} /><span className="truncate">{b.name}</span><span className="ml-auto tnum">{(b.size_kb / 1024).toFixed(1)} МБ</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] font-bold text-mute mt-3">Автопроверка каждые 15 с. Хранение бессрочное, еженедельные автокопии.</p>
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-2 flex items-center gap-2"><I n="file" size={16} />Резервная копия JSON</h3>
        <p className="text-[12px] text-mute font-bold leading-relaxed mb-3">Полная база. Сервер дополнительно делает копии еженедельно автоматически.</p>
        <div className="grid gap-2">
          <button className="btn btn-pri" onClick={() => {
            const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `smenalan-backup-${todayKey()}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast("Копия сохранена", "ok");
          }}><I n="download" size={15} />Скачать копию</button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const err = importAll(JSON.parse(await file.text()));
              toast(err || "База восстановлена", err ? "bad" : "ok");
            } catch { toast("Файл повреждён", "bad"); }
          }} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><I n="upload" size={15} />Восстановить</button>
          <button className="btn btn-ghost" onClick={() => { exportEmployees(db); toast("Сотрудники → Excel", "ok"); }}><I n="users" size={15} />Сотрудники → Excel</button>
          <button className="btn btn-ghost" onClick={() => { exportFot(db, monthStart(todayKey()), monthEnd(todayKey())); toast("ФОТ месяца → Excel", "ok"); }}><I n="coin" size={15} />ФОТ месяца → Excel</button>
        </div>
        <div className="border-t border-line mt-4 pt-4">
          <button className="btn btn-bad btn-sm" onClick={() => setConfirmReset(true)}><I n="warn" size={13} />Сбросить к чистой системе</button>
        </div>
      </div>
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} title="Полный сброс?" text="Все данные будут удалены. Сначала скачайте копию."
        onYes={() => { importAll(JSON.parse(JSON.stringify({ ...db, v: 5, users: db.users.filter((u) => u.id === "u-root"), punches: [], schedule: [], production: [], posts: [], notices: [], fines: [], ratings: [], periods: [], camshots: [], threads: [], messages: [], reminders: [], events: [], requests: [], audit: [], scores: [], challenges: [], sensors: [], scripts: [] }))); toast("Сброшено", "ok"); }} />
    </div>
  );
}

// ================= ЖУРНАЛЫ =================
export function AuditView() {
  const { db } = useStore();
  const [flt, setFlt] = useState("");
  const [q, setQ] = useState("");
  const actions = [...new Set(db.audit.map((a) => a.action))];
  const list = db.audit.filter((a) => (!flt || a.action === flt) && (!q || (a.actor + a.details).toLowerCase().includes(q.toLowerCase()))).slice(0, 300);
  return (
    <div className="grid gap-4">
      <div className="card p-4 flex items-center gap-2 flex-wrap">
        <select className="input !w-52 !h-9" value={flt} onChange={(e) => setFlt(e.target.value)}>
          <option value="">Все виды действий</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input className="input !w-64 !h-9" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-[12px] font-bold text-mute ml-auto">Журнал по каждому действию, бессрочно</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[700px]">
          <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Детали</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap font-mono text-[11.5px]">{new Date(a.ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="whitespace-nowrap font-bold">{a.actor}</td>
                <td><span className="badge bg-paper text-ink">{a.action}</span></td>
                <td className="text-[12.5px]">{a.details}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="text-center text-mute font-bold py-6">Пусто</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= АРХИВ =================
export function ArchiveView() {
  const { db, me, restoreUser, hardDeleteUser } = useStore();
  const { toast } = useToast();
  const [dossier, setDossier] = useState<User | null>(null);
  const [confirmRes, setConfirmRes] = useState<User | null>(null);
  const [confirmDel, setConfirmDel] = useState<User | null>(null);
  const list = db.users.filter((u) => u.archived);
  const isSuper = me?.role === "superadmin";
  const daysLeft = (u: User) => Math.max(0, Math.ceil(30 - (Date.now() - new Date(u.archivedAt || 0).getTime()) / 86400000));
  return (
    <div className="grid gap-4 max-w-4xl">
      <div className="card !border-warn/40 p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-warn-soft text-warn grid place-items-center shrink-0"><I n="layers" size={17} /></span>
        <p className="text-[12.5px] font-bold text-mute leading-relaxed">Уволенные — здесь, с причиной, оценкой и характеристикой. Полное удаление — только суперадмином через 30 дней. Живой график работы хранится навсегда.</p>
      </div>
      {list.length === 0 && <div className="card"><Empty icon="layers" title="Архив пуст" /></div>}
      {list.map((u) => {
        const dl = daysLeft(u);
        const border = u.archiveTone === "neg" ? "!border-bad/60" : u.archiveTone === "pos" ? "!border-ok/60" : "";
        return (
          <div key={u.id} className={`card p-4 anim-rise ${border}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <Avatar u={u} size={40} />
              <div className="min-w-0">
                <b className="text-sm flex items-center gap-2">{u.name}
                  {u.archiveTone === "neg" && <span className="badge bg-bad text-white">отрицательно</span>}
                  {u.archiveTone === "pos" && <span className="badge bg-ok text-white">положительно</span>}
                </b>
                <span className="text-[11.5px] font-bold text-mute">@{u.username} · уволен {u.archivedAt ? fmtDateFull(u.archivedAt.slice(0, 10)) : "—"} · {relTime(u.archivedAt || new Date().toISOString())}</span>
              </div>
              <div className="ml-auto flex gap-2 flex-wrap">
                <button className="btn btn-ghost btn-sm" onClick={() => setDossier(u)}><I n="chart" size={13} />Досье</button>
                <button className="btn btn-ok btn-sm" onClick={() => setConfirmRes(u)}><I n="history" size={13} />Восстановить</button>
                {isSuper && (
                  <button className="btn btn-bad btn-sm" disabled={dl > 0} onClick={() => setConfirmDel(u)}>
                    <I n="trash" size={13} />{dl > 0 ? `Удалить (через ${dl} дн.)` : "Удалить навсегда"}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2.5 grid sm:grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-line bg-surface px-3 py-2"><b>Причина:</b> {u.archiveReason || "—"}</div>
              <div className="rounded-lg border border-line bg-surface px-3 py-2"><b>Характеристика:</b> {u.archiveNote || "—"}</div>
            </div>
          </div>
        );
      })}
      {dossier && <DossierModal user={dossier} onClose={() => setDossier(null)} />}
      <Confirm open={!!confirmRes} onClose={() => setConfirmRes(null)} title={`Восстановить ${confirmRes?.name}?`} danger={false} yesLabel="Восстановить"
        text="Сотрудник снова активен, доступы вернутся." onYes={() => { if (confirmRes) { restoreUser(confirmRes.id); toast("Восстановлен", "ok"); } }} />
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} title={`Удалить ${confirmDel?.name} навсегда?`}
        text="Все данные будут стёрты безвозвратно." onYes={() => { if (confirmDel) { const r = hardDeleteUser(confirmDel.id); toast(r || "Удалён навсегда", r ? "bad" : "ok"); } }} />
    </div>
  );
}

// ================= НАСТРОЙКИ =================
export function SettingsView() {
  const { db, setSettings, online, sendTelegram } = useStore();
  const { toast } = useToast();
  const [s, setS] = useState({ ...db.settings });
  const ch = (k: keyof typeof s, v: string | number | boolean | string[]) => setS({ ...s, [k]: v });

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="gear" size={16} />Организация (бланки PDF)</h3>
        <div className="grid gap-4">
          <Field label="Название"><input className="input" value={s.orgName} onChange={(e) => ch("orgName", e.target.value)} /></Field>
          <Field label="Реквизиты"><input className="input" value={s.orgInn} onChange={(e) => ch("orgInn", e.target.value)} /></Field>
          <Field label="Адрес"><input className="input" value={s.orgAddress} onChange={(e) => ch("orgAddress", e.target.value)} /></Field>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="clock" size={16} />Табель и оплата</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Норма ч/день"><input type="number" className="input tnum" value={s.dailyNorm} onChange={(e) => ch("dailyNorm", Number(e.target.value))} /></Field>
          <Field label="Обед, мин"><input type="number" className="input tnum" value={s.breakMin} onChange={(e) => ch("breakMin", Number(e.target.value))} /></Field>
          <Field label="Коэф. переработки"><input type="number" step="0.1" className="input tnum" value={s.overtimeK} onChange={(e) => ch("overtimeK", Number(e.target.value))} /></Field>
          <Field label="PIN терминала"><input className="input font-mono" value={s.adminPin} onChange={(e) => ch("adminPin", e.target.value)} /></Field>
        </div>
        <div className="mt-4 grid gap-3">
          <Toggle checked={s.kioskFree} onChange={(v) => ch("kioskFree", v)} label="Терминал без пароля" />
          <Toggle checked={s.bestOn} onChange={(v) => ch("bestOn", v)} label="Бейдж «Сотрудник месяца»" />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="camera" size={16} />Веб-камера терминала</h3>
        <div className="grid gap-3">
          <Toggle checked={s.camOn} onChange={(v) => ch("camOn", v)} label="Снимок при приходе" sub="фиксация кто отметился · показ 3 с · архив 120 дней" />
          <Toggle checked={s.camOnOut} onChange={(v) => ch("camOnOut", v)} label="Снимок при уходе" />
          <Toggle checked={s.camMirror} onChange={(v) => ch("camMirror", v)} label="Зеркальный предпросмотр" />
          <Toggle checked={s.camFlash} onChange={(v) => ch("camFlash", v)} label="Вспышка при съёмке" />
          <Field label={`Качество сжатия: ${Math.round(s.camQuality * 100)}%`}>
            <input type="range" min={30} max={95} value={Math.round(s.camQuality * 100)} onChange={(e) => ch("camQuality", Number(e.target.value) / 100)} className="w-full accent-[#e56f24]" />
          </Field>
          <Field label="Подсказка админу (внеплановые смены)"><input className="input" value={s.camNote} onChange={(e) => ch("camNote", e.target.value)} /></Field>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="send" size={16} />Telegram-уведомления</h3>
        <div className="grid gap-4">
          <Field label="Токен бота" hint="BotFather → /newbot"><input className="input font-mono !text-[13px]" value={s.tgToken} onChange={(e) => ch("tgToken", e.target.value)} placeholder="123456:ABC…" /></Field>
          <Field label="Chat ID / канал" hint="например -100123456 или @канал"><input className="input font-mono !text-[13px]" value={s.tgChat} onChange={(e) => ch("tgChat", e.target.value)} /></Field>
          <div>
            <span className="lbl">Триггеры</span>
            <div className="flex gap-1.5 flex-wrap">
              {([["request", "Новые заявки"], ["schedule", "Публикация графика"], ["resolution", "Внеплановые смены"], ["camera", "Снимки камер"]] as const).map(([k, l]) => (
                <button key={k} className={`chip ${s.tgEvents.includes(k) ? "!border-accent !text-accent-deep !bg-accent-soft" : ""}`}
                  onClick={() => ch("tgEvents", s.tgEvents.includes(k) ? s.tgEvents.filter((x) => x !== k) : [...s.tgEvents, k])}>
                  <I n={s.tgEvents.includes(k) ? "check" : "plus"} size={12} />{l}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-dark btn-sm self-start" onClick={async () => {
            setSettings(s);
            const ok = await sendTelegram("✅ «СменаЛАН»: тестовое сообщение. Триггеры настроены.");
            toast(ok ? "Отправлено в Telegram" : "Не получилось — проверьте токен и chat_id", ok ? "ok" : "bad");
          }}><I n="send" size={13} />Сохранить и отправить тест</button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="bot" size={16} />ИИ и нейросеть</h3>
        <div className="grid gap-4">
          <Field label="Режим встроенного аналитика">
            <select className="input" value={s.aiMode} onChange={(e) => ch("aiMode", e.target.value)}>
              <option value="off">Выключен</option><option value="light">Лайт</option><option value="std">Стандарт</option><option value="adv">Продвинутый</option>
            </select>
          </Field>
          <Toggle checked={s.ollamaOn} onChange={(v) => ch("ollamaOn", v)} label="Локальная нейросеть (Ollama)" sub="по умолчанию отключена" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Адрес Ollama"><input className="input font-mono !text-[13px]" value={s.ollamaUrl} onChange={(e) => ch("ollamaUrl", e.target.value)} /></Field>
            <Field label="Модель"><input className="input font-mono !text-[13px]" value={s.ollamaModel} onChange={(e) => ch("ollamaModel", e.target.value)} /></Field>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="shield" size={16} />Сервер и API</h3>
        <div className={`rounded-xl border p-4 mb-4 ${online ? "border-ok/50 bg-ok-soft/50" : "border-warn/50 bg-warn-soft/50"}`}>
          <b className="text-sm flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${online ? "bg-ok pulse-ok" : "bg-warn blink"}`} />{online ? "Сервер онлайн · реальное время" : "Локальный режим"}</b>
          {online && <p className="text-[12px] font-bold text-mute mt-1.5">Адрес для сотрудников: <code className="bg-surface border border-line px-1.5 py-0.5 rounded font-mono">{window.location.protocol}//{window.location.host}</code></p>}
        </div>
        <Field label="API-токен" hint="Для датчиков, веб-камеры и резервных копий"><input className="input font-mono" value={s.apiToken} onChange={(e) => ch("apiToken", e.target.value)} placeholder="sensor-2025" /></Field>
        <p className="text-[11px] font-bold text-mute mt-2">Эндпоинты — «Инструкции и API». Тема киоска меняется на самом терминале (5 оформлений) или здесь:</p>
        <div className="flex gap-2 flex-wrap mt-2">
          {([["steel", "Сталь", "#0e1116", "#e56f24"], ["mint", "Мята", "#0b1f1a", "#34d399"], ["sunset", "Закат", "#221208", "#f59e0b"], ["ocean", "Океан", "#091525", "#38bdf8"], ["light", "Светлая", "#e9edf1", "#e56f24"]] as const).map(([k, n, bgc, acc]) => (
            <button key={k} onClick={() => ch("kioskTheme", k)} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 font-bold text-[12px] transition active:scale-95 ${s.kioskTheme === k ? "!border-ink" : "border-line hover:border-steel-400"}`}>
              <span className="w-5 h-5 rounded-full border border-line" style={{ background: `linear-gradient(135deg, ${bgc} 55%, ${acc} 55%)` }} />{n}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 flex items-center justify-between card p-4">
        <p className="text-xs font-bold text-mute flex items-center gap-1.5"><I n="info" size={13} />Применяется ко всем устройствам сети сразу</p>
        <button className="btn btn-pri" onClick={() => { setSettings(s); toast("Настройки сохранены", "ok"); }}><I n="check" size={16} />Сохранить</button>
      </div>
    </div>
  );
}
