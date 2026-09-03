import React, { useMemo, useRef, useState } from "react";
import { useStore, openPunchOf, punchDur, workedOn, summarize, wsName, posName, remindersFor, userById } from "../lib/store";
import { SHIFT_META, ShiftType, KIND_LABEL } from "../lib/types";
import {
  todayKey, fmtMin, fmtDur, fmtDurH, fmtClock, mondayKey, addDaysKey, monthStart, monthEnd,
  yearStart, yearEnd, fmtDateFull, fmtDM, WD, weekdayIdx, isWeekend, rangeKeys, monthTitle, daysInMonth, fmtMoney, plural, fmtDate,
} from "../lib/time";
import { I, Avatar, useToast, Seg, WeekBars, StatTile, Field, Confirm, Empty, RoleBadge, useNow, Modal } from "../components/ui";
import { exportMyStats } from "../lib/excel";
import { careerData } from "./hr";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

  return (
    <div className="grid gap-4 max-w-3xl mx-auto">
      {pendings.length > 0 && pendings.map((p) => (
        <div key={p.id} className="card !border-warn/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 anim-rise">
          <span className="w-10 h-10 rounded-xl bg-warn-soft text-warn grid place-items-center shrink-0"><I n="warn" size={19} /></span>
          <div className="flex-1 min-w-0">
            <b className="text-sm block">Смена за {fmtDateFull(p.date)} требует подтверждения</b>
            <span className="text-[12px] text-mute font-bold">
              {p.auto === "unscheduled" ? "Вы вышли вне графика — система закрыла смену в 23:59. Укажите время ухода." : "Смена закрыта по графику. Если время неверно — поправьте."}
            </span>
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
                ? <>План: до <b className="font-mono">{fmtMin(open.plannedOut)}</b>. Не закроете смену — система закроет её по этому времени и отправит админу на проверку (камеры).</>
                : "Укажите, до скольких планируете работать: если не закроете смену, система закроет её по этому времени и отправит отчёт администратору."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input type="time" className="input !w-32 !h-9 font-mono" value={planTo} onChange={(e) => setPlanTo(e.target.value)} />
            <button className="btn btn-soft btn-sm" onClick={() => {
              const [h, m] = planTo.split(":").map(Number);
              setPunchPlan(open.id, h * 60 + m);
              toast(`План сохранён: до ${fmtMin(h * 60 + m)}. Администратор уведомлён.`, "ok");
            }}><I n="check" size={14} />{open.plannedOut != null ? "Изменить" : "Сохранить план"}</button>
          </div>
        </div>
      )}

      <div className="card p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent via-accent/40 to-transparent" />
        <div className="font-mono tnum font-semibold text-6xl sm:text-7xl tracking-tight">{fmtClock(now)}</div>
        <div className="text-mute font-bold mt-1.5 capitalize">{fmtDM(tk)} · {fmtDateFull(tk)}</div>
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          {cell ? (
            <span className={`badge ${SHIFT_META[cell.type].cls}`}><I n="cal" size={12} />По графику: {SHIFT_META[cell.type].label}</span>
          ) : (
            <span className="badge bg-bad-soft text-bad"><I n="warn" size={12} />Сегодня вас нет в графике</span>
          )}
          <span className={`badge ${open ? "bg-ok-soft text-ok" : "bg-paper text-mute"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-ok pulse-ok" : "bg-steel-200"}`} />
            {open ? "На смене" : "Не на смене"}
          </span>
        </div>
        {open && (
          <div className="mt-6">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-mute">Отработано сейчас</div>
            <div className="font-display text-5xl font-bold tnum text-ok mt-1">{fmtDurH(punchDur(open, db.settings.breakMin, true))}</div>
            <div className="text-[12px] text-mute font-bold mt-1">приход в {fmtMin(open.tin)} · обед {db.settings.breakMin} мин учитывается</div>
          </div>
        )}
        <div className="mt-7 flex items-center justify-center gap-3">
          {!open ? (
            <button className="btn btn-pri !h-14 !px-8 !text-base !rounded-xl" onClick={() => {
              const r = punch("app");
              if (r === "UNSCHEDULED") toast("Вы вышли вне графика — укажите плановое время работы выше", "info");
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
              <div key={p.id} className="flex items-center gap-3 border border-line rounded-lg px-3.5 py-2.5">
                <span className={`w-8 h-8 rounded-lg grid place-items-center ${p.tout === null ? "bg-ok-soft text-ok" : "bg-paper text-mute"}`}><I n={p.tout === null ? "in" : "check"} size={15} /></span>
                <b className="font-mono tnum text-sm">{fmtMin(p.tin)} → {p.tout !== null ? fmtMin(p.tout) : "идёт"}</b>
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

// ---------- статистика ----------
export function StatsView() {
  const { db, me } = useStore();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(addDaysKey(todayKey(), -13));
  const [to, setTo] = useState(todayKey());
  if (!me) return null;

  const calc = (): [string, string] => {
    const tk = todayKey();
    if (period === "day") return [tk, tk];
    if (period === "week") return [mondayKey(tk), addDaysKey(mondayKey(tk), 6)];
    if (period === "month") return [monthStart(tk), monthEnd(tk)];
    if (period === "year") return [yearStart(tk), yearEnd(tk)];
    return [from, to];
  };
  const [bf, bt] = calc();
  const row = summarize(db, me, bf, bt);

  const days = useMemo(() => {
    const keys = rangeKeys(bf, bt).slice(-14);
    return keys.map((k) => ({ label: fmtDate(k), plan: workedPlan(db, me.id, k), fact: workedOn(db, me.id, k) / 60 }));
  }, [db, bf, bt, me.id]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Seg opts={[
          { v: "day", label: "День" }, { v: "week", label: "Неделя" }, { v: "month", label: "Месяц" },
          { v: "year", label: "Год" }, { v: "range", label: "Период" },
        ]} val={period} onChange={setPeriod} />
        {period === "range" && (
          <span className="flex items-center gap-2">
            <input type="date" className="input !w-40 !h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-mute font-bold text-sm">—</span>
            <input type="date" className="input !w-40 !h-9" value={to} onChange={(e) => setTo(e.target.value)} />
          </span>
        )}
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { exportMyStats(db, me.id, me.name, bf, bt); toast("Файл Excel сохранён", "ok"); }}>
          <I n="xls" size={14} />Excel
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile icon="clock" tone="accent" label="Отработано" val={fmtDur(row.factMin)} sub={`${row.days} ${plural(row.days, "день", "дня", "дней")}`} />
        <StatTile icon="cal" tone="ink" label="По графику" val={fmtDur(row.planMin)} sub="план на период" />
        <StatTile icon="timer" tone="ok" label="Переработка" val={fmtDur(row.otMin)} sub={`×${String(db.settings.overtimeK).replace(".", ",")} к оплате`} />
        <StatTile icon="warn" tone={row.shortMin > 0 ? "bad" : "ok"} label="Недоработка" val={fmtDur(row.shortMin)} sub={row.shortMin ? "нужно отработать" : "всё закрыто"} />
        <StatTile icon="history" tone={row.late ? "warn" : "ok"} label="Опозданий" val={String(row.late)} sub="позже начала на 5+ мин" />
        <StatTile icon="money" tone="night" label="К выплате" val={fmtMoney(row.salary)} sub={me.payMode === "piece" ? "сдельно по выработке" : me.payMode === "shift" ? `${row.shifts} смен × ${me.shiftCost} ₽` : `ставка ${me.rate} ₽/ч`} />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Динамика: план и факт (ч/день)</h3>
          <WeekBars data={days} h={140} />
          <div className="flex items-center gap-4 mt-3 text-[11px] font-extrabold text-mute">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-line" />план</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ok" />факт ≥ плана</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" />факт &lt; плана</span>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Мои условия</h3>
          <div className="grid gap-3 text-sm">
            <Row k="Цех" v={wsName(db, me.workshopId)} />
            <Row k="Должность" v={posName(db, me.positionId)} />
            <Row k="Оплата" v={me.payMode === "hour" ? `почасовая · ${me.rate} ₽/ч` : me.payMode === "shift" ? `посменная · ${fmtMoney(me.shiftCost)}/смена` : "сдельная · по выработке"} />
            <Row k="Обед" v={`${db.settings.breakMin} мин (смены дольше 6 ч)`} />
            <Row k="Переработка" v={`×${String(db.settings.overtimeK).replace(".", ",")}`} />
          </div>
          {me.payMode === "piece" && (
            <p className="mt-4 text-[12px] font-bold text-mute bg-paper border border-line rounded-lg p-3">Часы учитываются автоматически, а выплата считается по закрытым объёмам в «Выработке».</p>
          )}
        </div>
      </div>
    </div>
  );
}
function workedPlan(db: ReturnType<typeof useStore>["db"], uid: string, k: string): number {
  const c = db.schedule.find((s) => s.userId === uid && s.date === k);
  return c ? SHIFT_META[c.type].planned / 60 : 0;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-line/70 pb-2"><span className="text-mute font-bold text-[12px] uppercase tracking-wide">{k}</span><b className="text-right">{v}</b></div>;
}

// ---------- график ----------
export function ScheduleView() {
  const { db, me, markEventsRead } = useStore();
  const tk = todayKey();
  const [mk, setMk] = useState(tk.slice(0, 7));
  const [scope, setScope] = useState<"me" | "ws">("me");
  if (!me) return null;

  const myEvents = db.events.filter((e) => e.userId === me.id && !e.readBy.includes(me.id));
  const dim = daysInMonth(mk + "-01");
  const keys = rangeKeys(mk + "-01", `${mk}-${String(dim).padStart(2, "0")}`);
  const users = scope === "me" ? [me] : db.users.filter((u) => u.role === "employee" && u.active && u.workshopId === me.workshopId);
  const changedDates = new Set(myEvents.flatMap((e) => e.changes.map((c) => c.date)));

  return (
    <div className="grid gap-4">
      {myEvents.length > 0 && (
        <div className="card !border-accent/60 p-4 anim-rise">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-deep grid place-items-center shrink-0"><I n="cal" size={19} /></span>
            <div className="flex-1 min-w-0">
              <b className="text-sm block">Ваш график изменился ({myEvents.length} {plural(myEvents.length, "событие", "события", "событий")})</b>
              <div className="mt-2 grid gap-1.5 max-h-40 overflow-y-auto">
                {myEvents.flatMap((e) => e.changes.slice(0, 8).map((c, i) => (
                  <div key={e.id + i} className="flex items-center gap-2 text-[12px] font-bold">
                    <span className="badge bg-paper text-ink">{fmtDate(c.date)} {WD[weekdayIdx(c.date)]}</span>
                    <span className="text-mute">{c.from ? SHIFT_META[c.from].label : "—"}</span>
                    <I n="chevR" size={12} className="text-mute" />
                    <span className={c.to ? "text-accent-deep" : "text-bad"}>{c.to ? SHIFT_META[c.to].label : "снято"}</span>
                    <span className="text-mute">· {e.by}</span>
                  </div>
                )))}
              </div>
              {myEvents.some((e) => e.comment) && (
                <p className="mt-2 text-[12px] font-bold text-mute bg-paper rounded-lg px-3 py-2 border border-line">💬 {myEvents.filter((e) => e.comment).map((e) => e.comment).join("; ")}</p>
              )}
              <button className="btn btn-soft btn-sm mt-3" onClick={markEventsRead}><I n="check" size={13} />Понятно, прочитано</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftMonth(mk, -1))}><I n="chevL" size={14} /></button>
        <b className="font-display text-sm w-36 text-center">{monthTitle(mk + "-01")}</b>
        <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftMonth(mk, 1))}><I n="chevR" size={14} /></button>
        <Seg opts={[{ v: "me", label: "Мой график" }, { v: "ws", label: "Мой цех" }]} val={scope} onChange={setScope} />
        <div className="ml-auto flex gap-1.5 flex-wrap">
          {Object.entries(SHIFT_META).map(([k, m]) => <span key={k} className={`badge ${m.cls}`}>{m.code} {m.label.split(" ")[0]}</span>)}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl !text-[12px] min-w-[640px]">
          <thead><tr><th>Сотрудник</th>{keys.map((k) => (
            <th key={k} className={`${isWeekend(k) ? "!text-accent-deep" : ""} ${k === tk ? "!bg-accent-soft" : ""}`}>{Number(k.slice(8))}<br />{WD[weekdayIdx(k)]}</th>
          ))}</tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="whitespace-nowrap"><span className="flex items-center gap-2"><Avatar u={u} size={24} /><b>{u.id === me.id ? "Вы" : u.name}</b></span></td>
                {keys.map((k) => {
                  const c = db.schedule.find((s) => s.userId === u.id && s.date === k);
                  const changed = changedDates.has(k) && u.id === me.id;
                  return (
                    <td key={k} className={`p-1 text-center ${k === tk ? "bg-accent-soft/60" : ""}`}>
                      <span className={`inline-grid place-items-center w-7 h-7 rounded-md text-[11px] font-extrabold ${c ? SHIFT_META[c.type].cls : "bg-transparent text-line"} ${changed ? "ring-2 ring-accent" : ""}`}>
                        {c ? SHIFT_META[c.type].code : "·"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scope === "ws" && <p className="text-[12px] font-bold text-mute">Состав цеха «{wsName(db, me.workshopId)}» видит общий график; изменения ваших дней подсвечены оранжевым кольцом.</p>}
    </div>
  );
}
function shiftMonth(mk: string, n: number): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- заявки ----------
export function RequestsView() {
  const { db, me, createRequest, setPunchTout } = useStore();
  const { toast } = useToast();
  const [kind, setKind] = useState<"vacation" | "swap" | "extra">("vacation");
  const [date, setDate] = useState(todayKey());
  const [dateEnd, setDateEnd] = useState(addDaysKey(todayKey(), 6));
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [fixTime, setFixTime] = useState("18:00");
  if (!me) return null;

  const sameWs = db.users.filter((u) => u.role === "employee" && u.active && u.id !== me.id && u.workshopId === me.workshopId);
  const mine = db.requests.filter((r) => r.userId === me.id);

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Новая заявка</h3>
        <Seg opts={[
          { v: "vacation", label: "Отпуск", icon: "sun" },
          { v: "swap", label: "Замена дня", icon: "swap" },
          { v: "extra", label: "Доп. смена", icon: "plus" },
        ]} val={kind} onChange={setKind} />
        <div className="grid gap-4 mt-4">
          <Field label={kind === "vacation" ? "Первый день" : "Дата"}>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {kind === "vacation" && (
            <Field label="Последний день"><input type="date" className="input" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} /></Field>
          )}
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
            if (kind === "swap" && !target) { toast("Выберите сотрудника для замены", "bad"); return; }
            createRequest(kind, date, kind === "vacation" ? (dateEnd >= date ? dateEnd : date) : undefined, kind === "swap" ? target : undefined, note.trim());
            setNote("");
            toast("Заявка отправлена администратору", "ok");
          }}><I n="send" size={16} />Отправить на согласование</button>
        </div>
      </div>

      <div className="grid gap-3">
        {mine.length === 0 && <div className="card"><Empty icon="doc" title="Заявок пока нет" text="Отпуск, замена дня или дополнительная смена — всё согласуется с администратором здесь." /></div>}
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
              {r.kind === "swap" && r.targetUserId && <p className="text-[12px] font-bold text-mute mt-1.5">Меняется с: {userById(db, r.targetUserId)?.name}</p>}
              {r.note && <p className="text-[13px] mt-1.5">{r.note}</p>}
              {r.decisionNote && <p className="text-[12px] font-bold text-mute mt-1.5">Решение: {r.decisionNote}</p>}
              {r.kind === "resolution" && r.status === "pending" && punch && (
                <div className="mt-3 flex items-center gap-2 bg-warn-soft/60 border border-warn/40 rounded-lg p-2.5 flex-wrap">
                  <span className="text-[12px] font-bold">Время ухода:</span>
                  <input type="time" className="input !w-28 !h-8 font-mono" value={fixTime} onChange={(e) => setFixTime(e.target.value)} />
                  <button className="btn btn-ok btn-sm" onClick={() => {
                    const [h, m] = fixTime.split(":").map(Number);
                    setPunchTout(punch.id, h * 60 + m, true);
                    toast("Время сохранено и отправлено администратору", "ok");
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

// ---------- профиль ----------
export function ProfileView() {
  const { db, me, updateUser, logout } = useStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ username: me?.username || "", name: me?.name || "", bio: me?.bio || "" });
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  if (!me) return null;

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
                const { shrinkImage } = await import("../lib/store");
                const src = await shrinkImage(file, 240);
                updateUser(me.id, { avatar: src });
                toast("Аватар обновлён", "ok");
              } catch { toast("Не удалось прочитать фото", "bad"); }
            }} />
          </div>
        </div>
        <div className="grid gap-4 mt-6">
          <Field label="Логин"><input className="input font-mono" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="ФИО"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="О себе" hint="Видно на стене и в профиле"><textarea className="input" rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
          <button className="btn btn-pri" onClick={() => {
            const r = updateUser(me.id, { username: f.username, name: f.name, bio: f.bio });
            toast(r || "Профиль сохранён", r ? "bad" : "ok");
          }}><I n="check" size={16} />Сохранить</button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-4"><I n="key" size={16} />Пароль</h3>
        {me.password === "" && (
          <p className="text-[12px] font-bold text-mute bg-night-soft border border-night/30 rounded-lg p-3 mb-4">
            Сейчас вход без пароля. Установите свой пароль — это ваша защита от чужих отметок.
          </p>
        )}
        <div className="grid gap-4">
          <Field label="Новый пароль" hint="Пустое поле — вход без пароля"><input type="password" className="input font-mono" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="••••" /></Field>
          <Field label="Повторите"><input type="password" className="input font-mono" value={p2} onChange={(e) => setP2(e.target.value)} placeholder="••••" /></Field>
          <button className="btn btn-dark" onClick={() => {
            if (p1 !== p2) { toast("Пароли не совпадают", "bad"); return; }
            if (me.role === "superadmin" && !p1) { toast("Суперадмин не может остаться без пароля", "bad"); return; }
            updateUser(me.id, { password: p1 });
            setP1(""); setP2("");
            toast(p1 ? "Пароль установлен" : "Пароль снят — вход без пароля", "ok");
          }}><I n="lock" size={16} />{p1 ? "Сменить пароль" : "Убрать пароль"}</button>
        </div>
        <div className="border-t border-line mt-6 pt-5">
          <button className="btn btn-bad btn-sm" onClick={() => setConfirmOut(true)}><I n="logout" size={14} />Выйти из аккаунта</button>
        </div>
      </div>

      <div className="card p-6 lg:col-span-2">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-1"><I n="chart" size={16} />Мой путь — несгораемый график за всё время работы</h3>
        <p className="text-[11.5px] text-mute font-bold mb-3">Часы и балльные оценки по месяцам. Сохраняется навсегда, даже после архивации.</p>
        {(() => {
          const data = careerData(db, me);
          if (data.every((x) => x.hours === 0 && x.points === null))
            return <p className="text-[12.5px] font-bold text-mute py-4">Данных пока нет — график наполнится с первой смены.</p>;
          return (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data}>
                <XAxis dataKey="m" tick={{ fontSize: 10, fontWeight: 700 }} interval="preserveStartEnd" />
                <YAxis yAxisId="h" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Bar yAxisId="h" dataKey="hours" name="Часы" fill="#3f6d9e" radius={[4, 4, 0, 0]} />
                <Line yAxisId="p" dataKey="points" name="Оценка (баллы)" stroke="#e56f24" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          );
        })()}
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3"><I n="star" size={16} />Мои оценки</h3>
        {db.ratings.filter((r) => r.userId === me.id).length === 0 ? (
          <p className="text-[12.5px] font-bold text-mute">Оценок пока нет — управление ставит баллы ежемесячно.</p>
        ) : (
          <div className="grid gap-1.5">
            {db.ratings.filter((r) => r.userId === me.id).sort((a, b) => b.month.localeCompare(a.month)).map((r) => (
              <div key={r.id} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
                <span className={`font-display font-bold tnum text-sm w-12 ${r.points >= 80 ? "text-ok" : r.points >= 50 ? "text-warn" : "text-bad"}`}>{r.points}</span>
                <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden"><div className={`h-full rounded-full ${r.points >= 80 ? "bg-ok" : r.points >= 50 ? "bg-warn" : "bg-bad"}`} style={{ width: `${r.points}%` }} /></div>
                <span className="text-[11px] font-bold text-mute whitespace-nowrap">{r.month}{r.note ? ` · ${r.note}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3"><I n="warn" size={16} />Мои штрафы</h3>
        {db.fines.filter((x) => x.userId === me.id).length === 0 ? (
          <p className="text-[12.5px] font-bold text-mute">Штрафов нет — так держать.</p>
        ) : (
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
        <p className="text-[11px] font-bold text-mute mt-3">Штрафы назначает администратор с указанием причины; суммы вычитаются из расчёта за период.</p>
      </div>

      <Confirm open={confirmOut} onClose={() => setConfirmOut(false)} title="Выйти?" text="Сессия на этом устройстве завершится." yesLabel="Выйти" danger={false}
        onYes={() => logout()} />
    </div>
  );
}
