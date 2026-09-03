import React, { useRef, useState } from "react";
import { useStore, openPunchOf, punchDur, workedOn, summarize, wsName, posName, remindersFor, userById, careerData } from "../lib/store";
import { SHIFT_META, KIND_LABEL, PersonalInfo } from "../lib/types";
import {
  todayKey, fmtMin, fmtDur, fmtDurH, fmtClock, mondayKey, addDaysKey, monthStart, monthEnd,
  yearStart, yearEnd, fmtDateFull, fmtDM, WD, weekdayIdx, isWeekend, rangeKeys, monthTitle, daysInMonth, fmtMoney, fmtDate,
} from "../lib/time";
import { I, Avatar, useToast, Seg, WeekBars, StatTile, Field, Confirm, Empty, RoleBadge, useNow, Modal } from "../components/ui";
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

type Period = "day" | "week" | "month" | "year" | "range";

export function PunchView() {
  const { db, me, punch, punchOut, setPunchTout, setPunchPlan } = useStore();
  const { toast } = useToast();
  const now = useNow();
  const [fixTime, setFixTime] = useState("18:00");
  const [planTo, setPlanTo] = useState("18:00");
  if (!me) return null;
  const open = openPunchOf(db, me.id);
  const tk = todayKey();
  const cell = db.schedule.find((s) => s.userId === me.id && s.date === tk);
  const todayWorked = workedOn(db, me.id, tk, true);
  const myPunches = db.punches.filter((p) => p.userId === me.id && p.date === tk).sort((a, b) => a.tin - b.tin);
  const pendings = db.punches.filter((p) => p.userId === me.id && p.resolution === "pending");
  const reminders = remindersFor(db, me).filter((r) => !r.doneBy.includes(me.id));
  const shot = open?.photo ? db.camshots.find((c) => c.id === open.photo) : null;

  return (
    <div className="grid gap-4 max-w-3xl mx-auto">
      {pendings.map((p) => (
        <div key={p.id} className="card !border-warn/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 anim-rise">
          <span className="w-10 h-10 rounded-xl bg-warn-soft text-warn grid place-items-center shrink-0"><I n="warn" size={19} /></span>
          <div className="flex-1 min-w-0">
            <b className="text-sm block">Смена за {fmtDateFull(p.date)} требует подтверждения</b>
            <span className="text-[12px] text-mute font-bold">{p.auto === "unscheduled" ? "Вне графика — укажите время ухода." : "Проверьте время и подтвердите."}</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="time" className="input !w-32 !h-9 font-mono" value={fixTime} onChange={(e) => setFixTime(e.target.value)} />
            <button className="btn btn-ok btn-sm" onClick={() => {
              const [h, m] = fixTime.split(":").map(Number);
              setPunchTout(p.id, h * 60 + m, true);
              toast("Время ухода сохранено", "ok");
            }}><I n="check" size={14} />Подтвердить</button>
          </div>
        </div>
      ))}

      {open && open.auto === "unscheduled" && (
        <div className="card !border-warn/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 anim-rise">
          <span className="w-10 h-10 rounded-xl bg-warn-soft text-warn grid place-items-center shrink-0"><I n="cal" size={19} /></span>
          <div className="flex-1 min-w-0">
            <b className="text-sm block">Вы вышли вне графика</b>
            <span className="text-[12px] text-mute font-bold">
              {open.plannedOut != null
                ? <>План: до <b className="font-mono">{fmtMin(open.plannedOut)}</b>. Не закроете смену — система закроет по этому времени и отправит админу (проверка камер).</>
                : "Укажите, до скольких планируете работать: если не закроете смену, она закроется по этому времени."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input type="time" className="input !w-32 !h-9 font-mono" value={planTo} onChange={(e) => setPlanTo(e.target.value)} />
            <button className="btn btn-soft btn-sm" onClick={() => {
              const [h, m] = planTo.split(":").map(Number);
              setPunchPlan(open.id, h * 60 + m);
              toast(`План: до ${fmtMin(h * 60 + m)}. Администратор уведомлён.`, "ok");
            }}><I n="check" size={14} />{open.plannedOut != null ? "Изменить" : "Сохранить"}</button>
          </div>
        </div>
      )}

      <div className="card p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent via-accent/40 to-transparent" />
        <div className="font-mono tnum font-semibold text-6xl sm:text-7xl tracking-tight">{fmtClock(now)}</div>
        <div className="text-mute font-bold mt-1.5 capitalize">{fmtDM(tk)} · {fmtDateFull(tk)}</div>
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          {cell ? <span className={`badge ${SHIFT_META[cell.type].cls}`}><I n="cal" size={12} />По графику: {SHIFT_META[cell.type].label}</span>
            : <span className="badge bg-bad-soft text-bad"><I n="warn" size={12} />Сегодня вас нет в графике</span>}
          <span className={`badge ${open ? "bg-ok-soft text-ok" : "bg-paper text-mute"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-ok pulse-ok" : "bg-steel-200"}`} />{open ? "На смене" : "Не на смене"}
          </span>
          {shot && <span className="badge bg-night-soft text-night"><I n="camera" size={12} />снимок сделан</span>}
        </div>
        {open && (
          <div className="mt-6">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-mute">Отработано сейчас</div>
            <div className="font-display text-5xl font-bold tnum text-ok mt-1">{fmtDurH(punchDur(open, db.settings.breakMin, true))}</div>
            <div className="text-[12px] text-mute font-bold mt-1">приход в {fmtMin(open.tin)} · обед {db.settings.breakMin} мин</div>
          </div>
        )}
        <div className="mt-7 flex items-center justify-center gap-3">
          {!open ? (
            <button className="btn btn-pri !h-14 !px-8 !text-base !rounded-xl" onClick={() => {
              const r = punch("app");
              if (r === "UNSCHEDULED") toast("Вы вышли вне графика — укажите плановое время выше", "info");
              else if (r) toast(r, "bad");
              else toast("Смена открыта — хорошего дня!", "ok");
            }}><I n="in" size={20} />Начать смену</button>
          ) : (
            <button className="btn btn-dark !h-14 !px-8 !text-base !rounded-xl" onClick={() => {
              const r = punchOut();
              toast(r || "Смена закрыта", r ? "bad" : "ok");
            }}><I n="out" size={20} />Закончить смену</button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatTile icon="clock" tone="accent" label="Сегодня" val={fmtDur(todayWorked)} sub={`норма ${cell ? SHIFT_META[cell.type].planned / 60 : db.settings.dailyNorm} ч`} />
        <StatTile icon="history" tone="ink" label="Отметки за день" val={String(myPunches.length)} sub={myPunches.map((p) => `${fmtMin(p.tin)}–${p.tout !== null ? fmtMin(p.tout) : "…"}`).join(", ") || "пока нет"} />
        <StatTile icon="bell" tone={reminders.length ? "warn" : "ok"} label="Напоминания" val={String(reminders.length)} sub={reminders[0]?.title || "всё сделано"} />
      </div>

      {myPunches.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">Отметки за сегодня</h3>
          <div className="grid gap-2">
            {myPunches.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border border-line rounded-lg px-3.5 py-2.5 flex-wrap">
                <span className={`w-8 h-8 rounded-lg grid place-items-center ${p.tout === null ? "bg-ok-soft text-ok" : "bg-paper text-mute"}`}><I n={p.tout === null ? "in" : "check"} size={15} /></span>
                <b className="font-mono tnum text-sm">{fmtMin(p.tin)} → {p.tout !== null ? fmtMin(p.tout) : "идёт"}</b>
                {p.auto === "unscheduled" && <span className="badge bg-warn-soft text-warn">вне графика</span>}
                {p.resolution === "pending" && <span className="badge bg-warn-soft text-warn">ждёт подтверждения</span>}
                <span className="text-[11px] font-extrabold uppercase text-mute ml-auto">{p.source === "kiosk" ? "терминал" : p.source === "auto" ? "авто" : "приложение"}</span>
                <b className="font-mono tnum text-sm text-ok">{fmtDur(punchDur(p, db.settings.breakMin, true))}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StatsView() {
  const { db, me } = useStore();
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(addDaysKey(todayKey(), -13));
  const [to, setTo] = useState(todayKey());
  if (!me) return null;
  const tk = todayKey();
  const calc = (): [string, string] => {
    if (period === "day") return [tk, tk];
    if (period === "week") return [mondayKey(tk), addDaysKey(mondayKey(tk), 6)];
    if (period === "month") return [monthStart(tk), monthEnd(tk)];
    if (period === "year") return [yearStart(tk), yearEnd(tk)];
    return [from, to];
  };
  const [bf, bt] = calc();
  const row = summarize(db, me, bf, bt);
  const days = rangeKeys(mondayKey(tk), addDaysKey(mondayKey(tk), 6));
  const week = days.map((k) => ({
    label: WD[weekdayIdx(k)],
    plan: db.schedule.find((s) => s.userId === me.id && s.date === k)?.type ? SHIFT_META[db.schedule.find((s) => s.userId === me.id && s.date === k)!.type].planned / 60 : 0,
    fact: Math.round(workedOn(db, me.id, k, true) / 6) / 10,
  }));

  return (
    <div className="grid gap-4 max-w-3xl mx-auto">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <Seg opts={[{ v: "day", label: "День" }, { v: "week", label: "Неделя" }, { v: "month", label: "Месяц" }, { v: "year", label: "Год" }, { v: "range", label: "Период" }]} val={period} onChange={setPeriod} />
        {period === "range" && (
          <span className="flex items-center gap-2">
            <input type="date" className="input !w-36 !h-8" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-mute font-bold">—</span>
            <input type="date" className="input !w-36 !h-8" value={to} onChange={(e) => setTo(e.target.value)} />
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon="clock" tone="accent" label="Факт" val={fmtDur(row.factMin)} sub={`${row.days} ${row.days === 1 ? "день" : "дней"} работы`} />
        <StatTile icon="target" tone="night" label="План" val={fmtDur(row.planMin)} sub={`выполнение ${row.planMin ? Math.round((row.factMin / row.planMin) * 100) : 100}%`} />
        <StatTile icon="trend" tone={row.otMin ? "ok" : "ink"} label="Переработка" val={fmtDur(row.otMin)} sub={`коэф. ×${db.settings.overtimeK}`} />
        <StatTile icon="coin" tone="ok" label={me.payMode === "piece" ? "По выработке" : "Начислено"} val={fmtMoney(row.salary)} sub={row.fineSum ? `штрафы −${fmtMoney(row.fineSum)}` : "без штрафов"} />
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Неделя: план и факт</h3>
        <WeekBars data={week} />
        <div className="flex gap-4 mt-3 text-[11px] font-bold text-mute">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-line" />план</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" />факт</span>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[520px]">
          <thead><tr><th>Дата</th><th>По графику</th><th>Приход</th><th>Уход</th><th>Часы</th></tr></thead>
          <tbody>
            {rangeKeys(bf, bt).reverse().map((k) => {
              const c = db.schedule.find((s) => s.userId === me.id && s.date === k);
              const ps = db.punches.filter((p) => p.userId === me.id && p.date === k);
              if (!c && ps.length === 0) return null;
              return (
                <tr key={k}>
                  <td className={`font-bold whitespace-nowrap ${isWeekend(k) ? "text-accent-deep" : ""}`}>{fmtDateFull(k)}</td>
                  <td>{c ? <span className={`badge ${SHIFT_META[c.type].cls}`}>{SHIFT_META[c.type].code} · {SHIFT_META[c.type].label}</span> : <span className="text-mute font-bold">—</span>}</td>
                  <td className="font-mono">{ps[0] ? fmtMin(ps[0].tin) : "—"}</td>
                  <td className="font-mono">{ps.map((p) => p.tout !== null ? fmtMin(p.tout) : "…").join(", ") || "—"}</td>
                  <td className="font-mono font-bold text-ok">{workedOn(db, me.id, k) ? fmtDur(workedOn(db, me.id, k)) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScheduleView() {
  const { db, me, markEventsRead } = useStore();
  const tk = todayKey();
  const [mk, setMk] = useState(tk.slice(0, 7));
  const [scope, setScope] = useState<"me" | "ws">("me");
  if (!me) return null;
  const dim = daysInMonth(mk + "-01");
  const keys = rangeKeys(`${mk}-01`, `${mk}-${String(dim).padStart(2, "0")}`);
  const myEvents = db.events.filter((e) => e.userId === me.id && !e.readBy.includes(me.id));
  const changedDates = new Set(myEvents.flatMap((e) => e.changes.map((c) => c.date)));
  const users = scope === "me" ? [me] : db.users.filter((u) => u.role === "employee" && u.active && !u.archived && u.workshopId === me.workshopId);
  const weeks: string[][] = [];
  for (let i = 0; i < keys.length; i += 7) weeks.push(keys.slice(i, i + 7));

  return (
    <div className="grid gap-4 max-w-4xl mx-auto">
      {myEvents.length > 0 && (
        <div className="card !border-accent/50 p-4 anim-rise">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-deep grid place-items-center"><I n="cal" size={17} /></span>
            <b className="text-sm">График изменён ({myEvents.length})</b>
            <button className="btn btn-soft btn-sm ml-auto" onClick={markEventsRead}><I n="check" size={13} />Понятно</button>
          </div>
          <div className="grid gap-1.5 mt-3">
            {myEvents.slice(0, 4).map((e) => (
              <div key={e.id} className="text-[12.5px] font-bold">
                {e.by} · {e.changes.map((c) => `${fmtDate(c.date)}: ${c.from ? SHIFT_META[c.from].code : "—"}→${c.to ? SHIFT_META[c.to].code : "×"}`).join(", ")}
                {e.comment && <span className="text-mute"> — {e.comment}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftM(mk, -1))}><I n="chevL" size={14} /></button>
        <b className="font-display text-sm w-36 text-center">{monthTitle(mk + "-01")}</b>
        <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftM(mk, 1))}><I n="chevR" size={14} /></button>
        <Seg small opts={[{ v: "me", label: "Мой график" }, { v: "ws", label: "Мой цех" }]} val={scope} onChange={setScope} />
        <span className="ml-auto flex gap-1.5 flex-wrap">
          {Object.entries(SHIFT_META).map(([k, m]) => <span key={k} className={`badge ${m.cls}`}>{m.code}</span>)}
        </span>
      </div>
      <div className="card p-4 overflow-x-auto">
        <div className="min-w-[640px] grid gap-1">
          <div className="grid gap-1" style={{ gridTemplateColumns: "150px repeat(7, 1fr)" }}>
            <span />
            {weeks[0]?.map((k) => <div key={k} className={`text-center rounded-md py-1 text-[10.5px] font-extrabold ${isWeekend(k) ? "text-accent-deep" : "text-mute"} ${k === tk ? "bg-accent-soft" : ""}`}>{WD[weekdayIdx(k)]} {Number(k.slice(8))}</div>)}
          </div>
          {weeks.slice(1).map((wk, wi) => (
            <div key={wi} className="grid gap-1" style={{ gridTemplateColumns: "150px repeat(7, 1fr)" }}>
              <span />
              {wk.map((k) => <div key={k} className={`text-center rounded-md py-1 text-[10.5px] font-extrabold ${isWeekend(k) ? "text-accent-deep" : "text-mute"} ${k === tk ? "bg-accent-soft" : ""}`}>{WD[weekdayIdx(k)]} {Number(k.slice(8))}</div>)}
            </div>
          ))}
          {users.map((u) => (
            <React.Fragment key={u.id}>
              {users.length > 1 && <div className="flex items-center gap-2 pt-2"><Avatar u={u} size={22} /><b className="text-[12px]">{u.name}</b></div>}
              {weeks.map((wk, wi) => (
                <div key={wi} className="grid gap-1" style={{ gridTemplateColumns: "150px repeat(7, 1fr)" }}>
                  {wi === 0 && users.length === 1 ? <span className="text-[12px] font-bold truncate pr-2 self-center">{u.name}</span> : <span />}
                  {wk.map((k) => {
                    const c = db.schedule.find((s) => s.userId === u.id && s.date === k);
                    const changed = u.id === me.id && changedDates.has(k);
                    return (
                      <div key={k} className={`h-9 rounded-lg grid place-items-center text-[12px] font-extrabold border ${c ? `${SHIFT_META[c.type].cls} ${changed ? "!ring-2 !ring-accent" : "border-transparent"}` : "border-dashed border-line text-line"} ${k === tk ? "ring-1 ring-steel-400" : ""}`}>
                        {c ? SHIFT_META[c.type].code : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
function shiftM(mk: string, n: number): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function RequestsView() {
  const { db, me, createRequest, setPunchTout } = useStore();
  const { toast } = useToast();
  const [kind, setKind] = useState<"vacation" | "swap" | "extra">("vacation");
  const [date, setDate] = useState(addDaysKey(todayKey(), 7));
  const [dateEnd, setDateEnd] = useState(addDaysKey(todayKey(), 13));
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [fixTime, setFixTime] = useState("18:00");
  if (!me) return null;
  const sameWs = db.users.filter((u) => u.role === "employee" && u.active && !u.archived && u.workshopId === me.workshopId && u.id !== me.id);
  const mine = db.requests.filter((r) => r.userId === me.id);

  return (
    <div className="grid gap-4 max-w-3xl mx-auto">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-3">Новая заявка</h3>
        <Seg opts={[{ v: "vacation", label: "Отпуск", icon: "sun" }, { v: "swap", label: "Замена дня", icon: "swap" }, { v: "extra", label: "Доп. смена", icon: "plus" }]} val={kind} onChange={setKind} />
        <div className="grid gap-4 mt-4">
          <Field label={kind === "vacation" ? "Первый день" : "Дата"}><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {kind === "vacation" && <Field label="Последний день"><input type="date" className="input" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} /></Field>}
          {kind === "swap" && (
            <Field label="С кем поменяться" hint="Сотрудники вашего цеха">
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">— выберите —</option>
                {sameWs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Комментарий"><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Поясните для администратора…" /></Field>
          <button className="btn btn-pri" onClick={() => {
            if (kind === "swap" && !target) { toast("Выберите сотрудника", "bad"); return; }
            createRequest(kind, date, kind === "vacation" ? (dateEnd >= date ? dateEnd : date) : undefined, kind === "swap" ? target : undefined, note.trim());
            setNote("");
            toast("Заявка отправлена", "ok");
          }}><I n="send" size={16} />Отправить</button>
        </div>
      </div>
      <div className="grid gap-3">
        {mine.length === 0 && <div className="card"><Empty icon="doc" title="Заявок пока нет" text="Отпуск, замена дня, доп. смена — согласуются здесь." /></div>}
        {mine.map((r) => {
          const punch = r.punchId ? db.punches.find((p) => p.id === r.punchId) : null;
          return (
            <div key={r.id} className="card p-4 anim-rise">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${r.status === "pending" ? "bg-warn-soft text-warn" : r.status === "approved" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                  {r.status === "pending" ? "ожидает" : r.status === "approved" ? "одобрена" : "отклонена"}
                </span>
                <b className="text-sm">{KIND_LABEL[r.kind]}</b>
                <span className="text-[12px] text-mute font-bold ml-auto">{fmtDateFull(r.date)}{r.dateEnd && r.dateEnd !== r.date ? ` — ${fmtDateFull(r.dateEnd)}` : ""}</span>
              </div>
              {r.kind === "swap" && r.targetUserId && <p className="text-[12px] font-bold text-mute mt-1.5">С: {userById(db, r.targetUserId)?.name}</p>}
              {r.note && <p className="text-[13px] mt-1.5">{r.note}</p>}
              {r.decisionNote && <p className="text-[12px] font-bold text-mute mt-1.5">Решение: {r.decisionNote}</p>}
              {r.kind === "resolution" && r.status === "pending" && punch && (
                <div className="mt-3 flex items-center gap-2 bg-warn-soft/60 border border-warn/40 rounded-lg p-2.5 flex-wrap">
                  <span className="text-[12px] font-bold">Время ухода:</span>
                  <input type="time" className="input !w-28 !h-8 font-mono" value={fixTime} onChange={(e) => setFixTime(e.target.value)} />
                  <button className="btn btn-ok btn-sm" onClick={() => {
                    const [h, m] = fixTime.split(":").map(Number);
                    setPunchTout(punch.id, h * 60 + m, true);
                    toast("Сохранено", "ok");
                  }}><I n="check" size={13} />Подтвердить</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileView() {
  const { db, me, updateUser, logout } = useStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ username: me?.username || "", name: me?.name || "", bio: me?.bio || "" });
  const [info, setInfo] = useState<PersonalInfo>({ phone: "", email: "", birth: "", address: "", emergency: "", hiredAt: "", docNote: "", ...(me?.info || {}) });
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  if (!me) return null;
  const career = careerData(db, me);

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start max-w-4xl mx-auto w-full">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <Avatar u={me} size={72} />
          <div>
            <b className="font-display text-base block">{me.name}</b>
            <div className="flex items-center gap-2 mt-1"><RoleBadge role={me.role} /><span className="text-[12px] text-mute font-bold">@{me.username}</span></div>
            <div className="text-[12px] text-mute font-bold mt-1">{wsName(db, me.workshopId)} · {posName(db, me.positionId)}</div>
          </div>
          <div className="ml-auto grid gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><I n="camera" size={13} />Фото</button>
            {me.avatar && <button className="btn btn-ghost btn-sm" onClick={() => updateUser(me.id, { avatar: null })}>Убрать</button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const src = await (await import("../lib/store")).shrinkImage(file, 240);
                updateUser(me.id, { avatar: src });
                toast("Аватар обновлён", "ok");
              } catch { toast("Не удалось прочитать фото", "bad"); }
            }} />
          </div>
        </div>
        <div className="grid gap-4 mt-6">
          <Field label="Логин"><input className="input font-mono" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="ФИО"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="О себе"><textarea className="input" rows={2} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
          <button className="btn btn-pri" onClick={() => {
            const r = updateUser(me.id, { username: f.username, name: f.name, bio: f.bio });
            toast(r || "Сохранено", r ? "bad" : "ok");
          }}><I n="check" size={16} />Сохранить</button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-4"><I n="user" size={16} />Личная карточка</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Телефон"><input className="input" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} placeholder="+7 …" /></Field>
          <Field label="E-mail"><input className="input" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></Field>
          <Field label="Дата рождения"><input type="date" className="input" value={info.birth} onChange={(e) => setInfo({ ...info, birth: e.target.value })} /></Field>
          <Field label="Дата приёма"><input type="date" className="input" value={info.hiredAt} onChange={(e) => setInfo({ ...info, hiredAt: e.target.value })} /></Field>
          <Field label="Адрес"><input className="input" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></Field>
          <Field label="Экстренный контакт"><input className="input" value={info.emergency} onChange={(e) => setInfo({ ...info, emergency: e.target.value })} placeholder="Имя + телефон" /></Field>
        </div>
        <Field label="Документы"><input className="input mt-3" value={info.docNote} onChange={(e) => setInfo({ ...info, docNote: e.target.value })} placeholder="Например: паспорт и СНИЛС в отделе кадров" /></Field>
        <p className="text-[11px] font-bold text-mute mt-2">Карточку видите вы и управление.</p>
        <button className="btn btn-dark mt-3" onClick={() => { updateUser(me.id, { info }); toast("Карточка сохранена", "ok"); }}><I n="check" size={15} />Сохранить карточку</button>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-4"><I n="key" size={16} />Пароль</h3>
        {me.password === "" && <p className="text-[12px] font-bold text-mute bg-night-soft border border-night/30 rounded-lg p-3 mb-4">Сейчас вход без пароля. Установите свой — защита от чужих отметок.</p>}
        <div className="grid gap-4">
          <Field label="Новый пароль" hint="Пусто — вход без пароля"><input type="password" className="input font-mono" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
          <Field label="Повторите"><input type="password" className="input font-mono" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
          <button className="btn btn-dark" onClick={() => {
            if (p1 !== p2) { toast("Пароли не совпадают", "bad"); return; }
            if (me.role === "superadmin" && !p1) { toast("Суперадмин не может быть без пароля", "bad"); return; }
            updateUser(me.id, { password: p1 });
            setP1(""); setP2("");
            toast(p1 ? "Пароль установлен" : "Пароль снят", "ok");
          }}><I n="lock" size={16} />{p1 ? "Сменить" : "Убрать пароль"}</button>
        </div>
        <div className="border-t border-line mt-6 pt-5">
          <button className="btn btn-bad btn-sm" onClick={() => setConfirmOut(true)}><I n="logout" size={14} />Выйти</button>
        </div>
      </div>

      <div className="card p-6 lg:col-span-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-1"><I n="chart" size={16} />Мой путь — несгораемый график за всё время</h3>
        <p className="text-[11.5px] text-mute font-bold mb-3">Часы, смены и балльные оценки. Сохраняется навсегда.</p>
        {career.every((x) => x.hours === 0 && x.points === null) ? (
          <p className="text-[12.5px] font-bold text-mute py-4">Данных пока нет — наполнится с первой смены.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={career}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe1e8" />
              <XAxis dataKey="m" tick={{ fontSize: 10, fontWeight: 700 }} interval="preserveStartEnd" />
              <YAxis yAxisId="h" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <Bar yAxisId="h" dataKey="hours" name="Часы" fill="#3f6d9e" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" dataKey="points" name="Оценка" stroke="#e56f24" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3"><I n="star" size={16} />Мои оценки</h3>
        {db.ratings.filter((r) => r.userId === me.id).length === 0 ? <p className="text-[12.5px] font-bold text-mute">Оценок пока нет.</p> : (
          <div className="grid gap-1.5">
            {db.ratings.filter((r) => r.userId === me.id).sort((a, b) => b.month.localeCompare(a.month)).map((r) => (
              <div key={r.id} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
                <span className={`font-display font-bold tnum text-sm w-12 ${r.points >= 80 ? "text-ok" : r.points >= 50 ? "text-warn" : "text-bad"}`}>{r.points}</span>
                <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden"><div className={`h-full rounded-full ${r.points >= 80 ? "bg-ok" : r.points >= 50 ? "bg-warn" : "bg-bad"}`} style={{ width: `${r.points}%` }} /></div>
                <span className="text-[11px] font-bold text-mute whitespace-nowrap">{r.month}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3"><I n="warn" size={16} />Мои штрафы</h3>
        {db.fines.filter((x) => x.userId === me.id).length === 0 ? <p className="text-[12.5px] font-bold text-mute">Штрафов нет — так держать.</p> : (
          <div className="grid gap-1.5">
            {db.fines.filter((x) => x.userId === me.id).map((x) => (
              <div key={x.id} className="flex items-center gap-2.5 border border-bad/30 bg-bad-soft/40 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <b className="text-[12.5px] block">{x.reason}</b>
                  <span className="text-[10.5px] font-bold text-mute">{fmtDateFull(x.ts.slice(0, 10))}</span>
                </div>
                <b className="tnum text-bad text-sm">−{fmtMoney(x.amount)}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirm open={confirmOut} onClose={() => setConfirmOut(false)} title="Выйти?" text="Сессия завершится." yesLabel="Выйти" danger={false} onYes={() => logout()} />
    </div>
  );
}
