import React, { useMemo, useRef, useState } from "react";
import { useStore, userById, wsName, summarizeAll, remindersFor } from "../lib/store";
import { ModuleId, MODULES, ROLE_LABEL, Role, Device, KIND_LABEL } from "../lib/types";
import {
  todayKey, mondayKey, addDaysKey, monthStart, monthEnd, monthTitle, fmtDateFull, rangeKeys, relTime, fmtMoney, hDec, fmtMin,
} from "../lib/time";
import { I, Avatar, useToast, Tabs, Field, Empty, Seg, Confirm, Toggle } from "../components/ui";
import { makeSeed } from "../lib/seed";
import { exportAttendance, exportPayroll, exportEmployees, exportProduction } from "../lib/excel";
import { printPayrollReport, printAttendanceReport, printProductionReport } from "../lib/report";

// ================= ЗАЯВКИ (АДМИН) =================
export function RequestsAdmin() {
  const { db, decideRequest } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const [note, setNote] = useState<Record<string, string>>({});
  const pend = db.requests.filter((r) => r.status === "pending" && r.kind !== "resolution");
  const rest = db.requests.filter((r) => r.status !== "pending" || r.kind === "resolution");
  const list = tab === "pending" ? pend : rest.slice(0, 60);
  const pendingCount = pend.length;

  return (
    <div className="grid gap-4 max-w-4xl">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "pending", label: "Ожидают решения", icon: "warn", count: pendingCount },
        { id: "all", label: "История", icon: "history" },
      ]} />
      {list.length === 0 && <div className="card"><Empty icon="doc" title={tab === "pending" ? "Нет ожидающих заявок" : "История пуста"} text="Заявки сотрудников на отпуск, замену и доп. смены появляются здесь." /></div>}
      {list.map((r) => {
        const u = userById(db, r.userId);
        const target = r.targetUserId ? userById(db, r.targetUserId) : null;
        const decider = r.decidedBy ? userById(db, r.decidedBy) : null;
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
            {r.status !== "pending" && r.decisionNote && <p className="text-[12px] font-bold text-mute mt-2">Решение ({decider?.name || "—"}): {r.decisionNote}</p>}
            {r.status === "pending" && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <input className="input !h-9 flex-1 min-w-[200px]" placeholder="Комментарий к решению…" value={note[r.id] || ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                <button className="btn btn-ok" onClick={() => { decideRequest(r.id, true, (note[r.id] || "").trim()); toast("Заявка одобрена, сотрудник уведомлён", "ok"); }}><I n="check" size={15} />Одобрить</button>
                <button className="btn btn-bad" onClick={() => { decideRequest(r.id, false, (note[r.id] || "").trim() || "Отклонено"); toast("Заявка отклонена", "bad"); }}><I n="x" size={15} />Отклонить</button>
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
  const { db } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("day");
  const tk = todayKey();
  const [day, setDay] = useState(tk);
  const [week, setWeek] = useState(mondayKey(tk));
  const [month, setMonth] = useState(tk.slice(0, 7));
  const [from, setFrom] = useState(monthStart(tk));
  const [to, setTo] = useState(monthEnd(tk));
  const [ws, setWs] = useState("");

  const range = useMemo((): [string, string, string] => {
    if (tab === "day") return [day, day, `Ежедневный отчёт · ${fmtDateFull(day)}`];
    if (tab === "week") { const f = week, t = addDaysKey(week, 6); return [f, t, `Еженедельный отчёт · ${fmtDateFull(f)} — ${fmtDateFull(t)}`]; }
    if (tab === "month") { const f = monthStart(month + "-01"), t = monthEnd(month + "-01"); return [f, t, `Ежемесячный отчёт · ${monthTitle(month + "-01")}`]; }
    return [from, to, `Сводный табель · ${fmtDateFull(from)} — ${fmtDateFull(to)}`];
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
        {(tab === "day" || tab === "week" || tab === "month" || tab === "payroll") && (
          <select className="input !w-56 !h-9" value={ws} onChange={(e) => setWs(e.target.value)}>
            <option value="">Все цеха</option>
            {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <span className="ml-auto flex gap-2 flex-wrap">
          {tab !== "prod" && tab !== "payroll" && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { exportAttendance(db, rf, rt, tab === "day" ? "ежедневный" : tab === "week" ? "еженедельный" : "ежемесячный"); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
              <button className="btn btn-pri btn-sm" onClick={() => { printAttendanceReport(db, rf, rt, tab === "day" ? "Ежедневный" : tab === "week" ? "Еженедельный" : "Ежемесячный", label.split("·")[1] || label); toast("Открыт бланк PDF", "ok"); }}><I n="pdf" size={14} />PDF бланк</button>
            </>
          )}
          {tab === "payroll" && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { exportPayroll(db, rows, `${rf}_${rt}`); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
              <button className="btn btn-pri btn-sm" onClick={() => { printPayrollReport(rows, label.split("·")[1] || label, db.settings); toast("Открыт бланк PDF", "ok"); }}><I n="pdf" size={14} />PDF для бухгалтерии</button>
            </>
          )}
          {tab === "prod" && (
            <>
              <input type="date" className="input !w-36 !h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" className="input !w-36 !h-9" value={to} onChange={(e) => setTo(e.target.value)} />
              <button className="btn btn-ghost btn-sm" onClick={() => { exportProduction(db, rf, rt); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
              <button className="btn btn-pri btn-sm" onClick={() => { printProductionReport(db, rf, rt, `${fmtDateFull(rf)} — ${fmtDateFull(rt)}`); toast("Открыт бланк PDF", "ok"); }}><I n="pdf" size={14} />PDF</button>
            </>
          )}
        </span>
      </div>

      {tab !== "prod" ? (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[760px]">
            <thead><tr><th>Сотрудник</th><th>Цех</th><th>Оплата</th><th>План, ч</th><th>Факт, ч</th><th>Перераб.</th><th>Недораб.</th><th>Опозд.</th><th>Смен</th><th>Начислено</th></tr></thead>
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
                  <td className="tnum font-bold text-ok whitespace-nowrap">{fmtMoney(r.salary)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="text-center text-mute font-bold py-6">Нет активных сотрудников</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot><tr className="font-bold">
                <td colSpan={3} className="!py-3">ИТОГО</td>
                <td className="tnum">{hDec(rows.reduce((s, r) => s + r.planMin, 0))}</td>
                <td className="tnum">{hDec(rows.reduce((s, r) => s + r.factMin, 0))}</td>
                <td className="tnum text-ok">{hDec(rows.reduce((s, r) => s + r.otMin, 0))}</td>
                <td className="tnum text-bad">{hDec(rows.reduce((s, r) => s + r.shortMin, 0))}</td>
                <td className="tnum text-warn">{rows.reduce((s, r) => s + r.late, 0)}</td>
                <td className="tnum">{rows.reduce((s, r) => s + r.shifts, 0)}</td>
                <td className="tnum text-ok">{fmtMoney(rows.reduce((s, r) => s + r.salary, 0))}</td>
              </tr></tfoot>
            )}
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
              {db.production.filter((r) => r.date >= rf && r.date <= rt).length === 0 && <tr><td colSpan={6} className="text-center text-mute font-bold py-6">Нет выработки за период</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ================= НАПОМИНАНИЯ =================
export function RemindersView() {
  const { db, me, addReminder, removeReminder, markReminderDone } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState({ title: "", text: "", targetType: "all" as "all" | "workshop" | "user" | "position", targetId: "", due: addDaysKey(todayKey(), 1) });
  const [del, setDel] = useState<string | null>(null);
  const myDone = me ? db.reminders.filter((r) => remindersFor(db, me).includes(r) && r.doneBy.includes(me.id)).length : 0;
  void myDone;

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="bell" size={16} />Новое напоминание</h3>
        <div className="grid gap-3">
          <Field label="Заголовок"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Санобработка линии" /></Field>
          <Field label="Текст"><textarea className="input" rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
          <Field label="Кому">
            <select className="input" value={f.targetType} onChange={(e) => { setF({ ...f, targetType: e.target.value as never, targetId: "" }); }}>
              <option value="all">Всем сотрудникам</option>
              <option value="workshop">Цеху</option>
              <option value="position">Должности</option>
              <option value="user">Конкретному человеку</option>
            </select>
          </Field>
          {f.targetType === "workshop" && (
            <select className="input" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}>
              <option value="">— цех —</option>
              {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          {f.targetType === "position" && (
            <select className="input" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}>
              <option value="">— должность —</option>
              {db.positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {f.targetType === "user" && (
            <select className="input" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}>
              <option value="">— сотрудник —</option>
              {db.users.filter((u) => u.role === "employee").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <Field label="Дата"><input type="date" className="input" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
          <button className="btn btn-pri" onClick={() => {
            if (!f.title.trim()) { toast("Укажите заголовок", "bad"); return; }
            if (f.targetType !== "all" && !f.targetId) { toast("Выберите получателя", "bad"); return; }
            addReminder(f.title.trim(), f.text.trim(), f.targetType, f.targetId || null, f.due);
            setF({ ...f, title: "", text: "" });
            toast("Напоминание создано — адресаты уведомлены", "ok");
          }}><I n="send" size={16} />Создать и уведомить</button>
        </div>
      </div>
      <div className="grid gap-3">
        {db.reminders.length === 0 && <div className="card"><Empty icon="bell" title="Напоминаний нет" text="Создавайте напоминания для цехов, должностей и людей — они приходят уведомлениями и видны в «Моей смене»." /></div>}
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
      <Confirm open={!!del} onClose={() => setDel(null)} title="Удалить напоминание?" text="Оно исчезнет у всех адресатов."
        onYes={() => { if (del) { removeReminder(del); toast("Удалено"); } }} />
    </div>
  );
}

// ================= ПРАВА =================
export function PermsView() {
  const { db, setPerm, me } = useStore();
  const { toast } = useToast();
  if (me?.role !== "superadmin") return <div className="card"><Empty icon="shield" title="Раздел суперадмина" text="Матрицей прав управляет только суперадминистратор." /></div>;
  const roles: Role[] = ["admin", "employee"];
  const devs: Device[] = ["desktop", "mobile"];
  return (
    <div className="grid gap-4 max-w-4xl">
      <div className="card !border-night/40 p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-night-soft text-night grid place-items-center shrink-0"><I n="info" size={17} /></span>
        <p className="text-[13px] font-bold text-mute leading-relaxed">Матрица «модуль × роль × устройство» решает, что видит каждая роль на ПК и в PWA на телефоне. Изменения применяются на всех устройствах мгновенно. Суперадмин всегда имеет полный доступ.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[620px]">
          <thead><tr><th>Модуль</th>{roles.map((r) => (
            <th key={r} colSpan={2} className="text-center">{ROLE_LABEL[r]}</th>
          ))}</tr>
            <tr><th></th>{roles.map((r) => devs.map((d) => (
              <th key={r + d} className="text-center !bg-transparent">{d === "desktop" ? "ПК" : "PWA"}</th>
            )))}</tr></thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.id}>
                <td><span className="flex items-center gap-2"><I n={m.icon} size={15} className="text-mute" /><b>{m.label}</b>{m.group === "admin" && <span className="badge bg-accent-soft text-accent-deep">админ</span>}</span></td>
                {roles.map((r) => devs.map((d) => {
                  const val = db.perms[m.id][r][d];
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

// ================= ДАННЫЕ =================
export function DataIOView() {
  const { db, importAll } = useStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `smenalan-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4 items-start max-w-5xl">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-2 flex items-center gap-2"><I n="file" size={16} />Резервная копия JSON</h3>
        <p className="text-[12px] text-mute font-bold leading-relaxed mb-3">Полная база: люди, отметки, график, выработка, чаты, журналы. Хранится бессрочно; сервер дополнительно делает копии автоматически каждую неделю.</p>
        <div className="grid gap-2">
          <button className="btn btn-pri" onClick={() => { downloadJson(); toast("Копия сохранена", "ok"); }}><I n="download" size={15} />Скачать копию</button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const d = JSON.parse(await file.text());
              const err = importAll(d);
              toast(err || "База восстановлена из копии", err ? "bad" : "ok");
            } catch { toast("Файл повреждён", "bad"); }
          }} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><I n="upload" size={15} />Восстановить из файла</button>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-2 flex items-center gap-2"><I n="xls" size={16} />Excel-обмен</h3>
        <p className="text-[12px] text-mute font-bold leading-relaxed mb-3">Шаблоны для быстрого заполнения и выгрузки для расчёта зарплаты внешними средствами.</p>
        <div className="grid gap-2">
          <button className="btn btn-ghost" onClick={() => { exportEmployees(db); toast("Сотрудники выгружены", "ok"); }}><I n="users" size={15} />Сотрудники → Excel</button>
          <button className="btn btn-ghost" onClick={() => { exportProduction(db, monthStart(todayKey()), monthEnd(todayKey())); toast("Выработка за месяц выгружена", "ok"); }}><I n="box" size={15} />Выработка → Excel</button>
          <button className="btn btn-ghost" onClick={() => { exportPayroll(db, summarizeAll(db, monthStart(todayKey()), monthEnd(todayKey())), monthTitle(monthStart(todayKey()))); toast("Табель за месяц выгружен", "ok"); }}><I n="coin" size={15} />Табель месяца → Excel</button>
        </div>
        <p className="text-[11px] font-bold text-mute mt-3">Импорт графика и сотрудников — в соответствующих разделах («График», «Сотрудники»).</p>
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-2 flex items-center gap-2"><I n="shield" size={16} />Хранение</h3>
        <p className="text-[12px] text-mute font-bold leading-relaxed">
          Сервер: SQLite, server/data — без ограничения места.<br />
          Фото и вложения: server/data/files.<br />
          Автосохранение: еженедельно, server/data/backups.<br />
          Журналы: в базе + server.log, бессрочно.
        </p>
        <div className="border-t border-line mt-4 pt-4">
          <button className="btn btn-bad btn-sm" onClick={() => setConfirmReset(true)}><I n="warn" size={13} />Сбросить к чистой системе</button>
          <p className="text-[11px] font-bold text-mute mt-2">Полный сброс: останется только суперадмин root и песочница demo.</p>
        </div>
      </div>
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} title="Полный сброс базы?"
        text="Все сотрудники, отметки, графики, чаты и журналы будут удалены безвозвратно. Сначала скачайте копию JSON."
        onYes={() => {
          importAll(makeSeed());
          toast("База сброшена к чистой системе", "ok");
        }} />
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
        <input className="input !w-64 !h-9" placeholder="Поиск по имени или деталям…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-[12px] font-bold text-mute ml-auto">Журнал ведётся по каждому действию и хранится бессрочно</span>
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
            {list.length === 0 && <tr><td colSpan={4} className="text-center text-mute font-bold py-6">Ничего не найдено</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= НАСТРОЙКИ =================
export function SettingsView() {
  const { db, setSettings, online } = useStore();
  const { toast } = useToast();
  const [s, setS] = useState({ ...db.settings });
  const [saved, setSaved] = useState(false);
  const ch = (k: keyof typeof s, v: string | number | boolean) => { setS({ ...s, [k]: v }); setSaved(false); };

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="gear" size={16} />Организация (для бланков PDF)</h3>
        <div className="grid gap-4">
          <Field label="Название"><input className="input" value={s.orgName} onChange={(e) => ch("orgName", e.target.value)} /></Field>
          <Field label="Реквизиты"><input className="input" value={s.orgInn} onChange={(e) => ch("orgInn", e.target.value)} /></Field>
          <Field label="Адрес"><input className="input" value={s.orgAddress} onChange={(e) => ch("orgAddress", e.target.value)} /></Field>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="clock" size={16} />Табель и оплата</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Норма часов в день" hint="Базовая; у должностей — своя"><input type="number" className="input tnum" value={s.dailyNorm} onChange={(e) => ch("dailyNorm", Number(e.target.value))} /></Field>
          <Field label="Обед, минут" hint="Вычитается из смен длиннее 6 ч"><input type="number" className="input tnum" value={s.breakMin} onChange={(e) => ch("breakMin", Number(e.target.value))} /></Field>
          <Field label="Коэффициент переработки"><input type="number" step="0.1" className="input tnum" value={s.overtimeK} onChange={(e) => ch("overtimeK", Number(e.target.value))} /></Field>
          <Field label="PIN служебного выхода" hint="Выход из режима терминала"><input className="input font-mono" value={s.adminPin} onChange={(e) => ch("adminPin", e.target.value)} /></Field>
        </div>
        <div className="mt-5 grid gap-3">
          <Toggle checked={s.kioskFree} onChange={(v) => ch("kioskFree", v)} label="Терминал без пароля" sub="отметка на киоске одним касанием" />
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="bot" size={16} />ИИ и нейросеть</h3>
        <div className="grid gap-4">
          <Field label="Режим встроенного аналитика" hint="Лайт экономит ресурсы сервера, продвинутый считает корреляции">
            <select className="input" value={s.aiMode} onChange={(e) => ch("aiMode", e.target.value)}>
              <option value="off">Выключен</option><option value="light">Лайт</option><option value="std">Стандарт (по умолчанию)</option><option value="adv">Продвинутый</option>
            </select>
          </Field>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Toggle checked={s.ollamaOn} onChange={(v) => ch("ollamaOn", v)} label="Локальная нейросеть (Ollama)" sub="по умолчанию отключена" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Адрес Ollama"><input className="input font-mono !text-[13px]" value={s.ollamaUrl} onChange={(e) => ch("ollamaUrl", e.target.value)} /></Field>
            <Field label="Модель"><input className="input font-mono !text-[13px]" value={s.ollamaModel} onChange={(e) => ch("ollamaModel", e.target.value)} /></Field>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="layers" size={16} />Локальный сервер и API</h3>
        <div className={`rounded-xl border p-4 mb-4 ${online ? "border-ok/50 bg-ok-soft/50" : "border-warn/50 bg-warn-soft/50"}`}>
          <b className="text-sm flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${online ? "bg-ok pulse-ok" : "bg-warn blink"}`} />{online ? "Сервер онлайн · реальное время" : "Локальный режим — сервер недоступен"}</b>
          <p className="text-[12px] font-bold text-mute mt-1.5 leading-relaxed">
            {online
              ? <>Адрес для сотрудников: <code className="bg-surface border border-line px-1.5 py-0.5 rounded font-mono">{window.location.protocol}//{window.location.host}</code> — ссылка и QR есть в трее сервера (правый клик по иконке).</>
              : <>Как запустить — раздел «Инструкции и API» → «Локальный режим». Вкратце: server/install.bat, затем ярлык на рабочем столе.</>}
          </p>
        </div>
        <Field label="API-токен для датчиков" hint="Пусто = запись открыта в LAN. Токен потребуется в заголовке X-API-Token">
          <input className="input font-mono" value={s.apiToken} onChange={(e) => ch("apiToken", e.target.value)} placeholder="например: sensor-2025" />
        </Field>
        <p className="text-[11px] font-bold text-mute mt-2">Эндпоинты для датчиков и интеграций: «Инструкции и API» → «API и датчики».</p>
      </div>
      <div className="lg:col-span-2 flex items-center justify-between card p-4">
        <p className="text-xs font-bold text-mute flex items-center gap-1.5"><I n="info" size={13} />Настройки применяются ко всем устройствам в сети сразу{saved && <span className="text-ok">· сохранено ✓</span>}</p>
        <button className="btn btn-pri" onClick={() => { setSettings(s); setSaved(true); toast("Настройки сохранены", "ok"); }}><I n="check" size={16} />Сохранить настройки</button>
      </div>
    </div>
  );
}
