import React, { useMemo, useRef, useState } from "react";
import {
  useStore, openPunchOf, punchDur, workedOn, plannedOn, shiftOf, summarize, SumRow, userById,
} from "../lib/store";
import { SHIFT_META, ShiftType } from "../lib/types";
import {
  todayKey, nowMin, fmtMin, fmtDur, fmtDurH, fmtDM, fmtDateFull, fmtClock, fmtMoney,
  mondayKey, addDaysKey, monthStart, monthEnd, monthTitle, daysInMonth, rangeKeys,
  weekdayIdx, WD, isWeekend, relTime, hDec, yearStart, yearEnd, plural, MONTHS_NOM,
} from "../lib/time";
import { I, Avatar, useNow, useToast, Bars, Progress, Seg, Field, Empty, Modal, RoleBadge, shrinkImage } from "../components/ui";
import { exportMyStats } from "../lib/excel";

// ================= МОЯ СМЕНА =================
export function PunchView() {
  const { db, me, punch, punchOut } = useStore();
  const { toast } = useToast();
  const now = useNow();
  if (!me) return null;
  const open = openPunchOf(db, me.id);
  const tk = todayKey();
  const cell = shiftOf(db, me.id, tk);
  const todayWorked = workedOn(db, me.id, tk, true);
  const todayPlan = plannedOn(db, me.id, tk);
  const elapsed = open ? punchDur(open, db.settings.breakMin, true) : 0;

  const wk = mondayKey(tk);
  const week = rangeKeys(wk, addDaysKey(wk, 6)).map((k) => ({
    label: WD[weekdayIdx(k)], a: plannedOn(db, me.id, k), b: workedOn(db, me.id, k, true),
  }));
  const weekFact = week.reduce((s, d) => s + d.b, 0);
  const weekPlan = week.reduce((s, d) => s + d.a, 0);

  const recent = db.punches.filter((p) => p.userId === me.id).sort((a, b) => (b.date + String(b.tin).padStart(4, "0")).localeCompare(a.date + String(a.tin).padStart(4, "0"))).slice(0, 8);

  return (
    <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4">
      <div className="card p-6 sm:p-8 bg-steel-900 text-paper !border-steel-700 relative overflow-hidden">
        <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full border-[26px] border-steel-800 pointer-events-none" />
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-steel-400">
          <span className={`w-2 h-2 rounded-full ${open ? "bg-ok pulse-ok" : "bg-steel-600"}`} />
          {open ? "вы на смене" : "смена не начата"}
        </div>
        <div className="font-mono tnum font-semibold text-[56px] sm:text-[76px] leading-none tracking-tight mt-4">
          {fmtClock(now)}
        </div>
        <div className="text-steel-400 font-bold mt-2 capitalize">{fmtDateFull(tk)}</div>

        <div className="mt-7 flex flex-wrap items-center gap-5">
          {open ? (
            <>
              <div>
                <div className="lbl !text-steel-400">Отработано сейчас</div>
                <div className="font-display text-3xl sm:text-4xl font-bold tnum text-ok">{fmtDurH(elapsed)}<span className="blink">:</span>{String(Math.floor(now.getSeconds())).padStart(2, "0")}</div>
                <div className="text-xs font-bold text-steel-400 mt-1">начало в {fmtMin(open.tin)} · {open.source === "kiosk" ? "через терминал" : "через приложение"}</div>
              </div>
              <button className="btn btn-bad h-14 px-7 text-base ml-auto" onClick={() => { const e = punchOut(); e ? toast(e, "bad") : toast(`Смена закрыта в ${fmtMin(nowMin())}. Отработано ${fmtDur(elapsed)}.`, "ok"); }}>
                <I n="out" size={20} />Завершить смену
              </button>
            </>
          ) : (
            <>
              <div>
                <div className="lbl !text-steel-400">Сегодня по графику</div>
                <div className="font-display text-2xl font-bold">
                  {cell && cell.type !== "off" ? (
                    <span className="flex items-center gap-2">{SHIFT_META[cell.type].label}<span className={`badge ${SHIFT_META[cell.type].cls}`}>{SHIFT_META[cell.type].code}</span></span>
                  ) : cell ? "Выходной" : "Не запланировано"}
                </div>
                <div className="text-xs font-bold text-steel-400 mt-1">{cell?.type === "off" || !cell ? "можно взять доп. смену через заявку" : `план ${fmtDur(todayPlan)}`}</div>
              </div>
              <button className="btn btn-ok h-14 px-7 text-base ml-auto shadow-[0_6px_24px_-6px_rgba(23,135,92,0.7)]" onClick={() => { const e = punch("app"); e ? toast(e, "bad") : toast(`Смена открыта в ${fmtMin(nowMin())}`, "ok"); }}>
                <I n="in" size={20} />Начать смену
              </button>
            </>
          )}
        </div>

        {todayPlan > 0 && (
          <div className="mt-7">
            <div className="flex justify-between text-xs font-bold text-steel-400 mb-1.5">
              <span>Выполнение дневного плана</span>
              <span className="tnum">{Math.round((todayWorked / todayPlan) * 100)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-steel-700 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${todayWorked >= todayPlan ? "bg-ok" : "bg-accent"}`} style={{ width: `${Math.min(100, (todayWorked / todayPlan) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 content-start">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold">Эта неделя</h3>
            <span className="text-xs font-bold text-mute tnum">{fmtDur(weekFact)} из {fmtDur(weekPlan)}</span>
          </div>
          <Bars data={week} />
          <div className="mt-3"><Progress val={weekPlan ? (weekFact / weekPlan) * 100 : 0} tone={weekFact >= weekPlan ? "ok" : "accent"} /></div>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">Последние отметки</h3>
          {recent.length === 0 ? <Empty icon="clock" text="Отметок пока нет — начните смену" /> : (
            <div className="grid gap-1.5">
              {recent.map((p) => (
                <div key={p.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-line/60 last:border-0">
                  <span className="font-bold w-24 shrink-0">{fmtDM(p.date)}</span>
                  <span className={`w-7 h-7 rounded-lg grid place-items-center ${p.tout === null ? "bg-ok-soft text-ok" : "bg-paper text-mute"}`}><I n={p.tout === null ? "in" : "check"} size={14} /></span>
                  <span className="font-mono tnum text-xs font-semibold">{fmtMin(p.tin)} → {p.tout === null ? "…" : fmtMin(p.tout)}</span>
                  <span className="ml-auto font-bold tnum">{p.tout === null ? fmtDurH(punchDur(p, db.settings.breakMin, true)) + " +" : fmtDurH(punchDur(p, db.settings.breakMin))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================= СТАТИСТИКА =================
type Period = "day" | "week" | "month" | "year" | "custom";
export function StatsView() {
  const { db, me } = useStore();
  const { toast } = useToast();
  const tk = todayKey();
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(monthStart(tk));
  const [to, setTo] = useState(tk);

  if (!me) return null;
  const bounds = useMemo((): [string, string] => {
    if (period === "day") return [tk, tk];
    if (period === "week") return [mondayKey(tk), addDaysKey(mondayKey(tk), 6)];
    if (period === "month") return [monthStart(tk), monthEnd(tk)];
    if (period === "year") return [yearStart(tk), yearEnd(tk)];
    return [from, to];
  }, [period, from, to, tk]);
  const [bf, bt] = bounds;
  const row = summarize(db, me, bf, bt);

  const chart = useMemo(() => {
    const keys = rangeKeys(bf, bt);
    if (keys.length <= 31) return keys.map((k) => ({ label: k.slice(8), a: plannedOn(db, me.id, k), b: workedOn(db, me.id, k, true) }));
    const byMonth = new Map<string, { a: number; b: number }>();
    for (const k of keys) {
      const mk = k.slice(0, 7);
      const e = byMonth.get(mk) || { a: 0, b: 0 };
      e.a += plannedOn(db, me.id, k); e.b += workedOn(db, me.id, k, true);
      byMonth.set(mk, e);
    }
    return [...byMonth.entries()].map(([mk, v]) => ({ label: MONTHS_NOM[Number(mk.slice(5, 7)) - 1].slice(0, 3), ...v }));
  }, [bf, bt, db, me.id]);

  const rows = useMemo(() => rangeKeys(bf, bt).filter((k) => plannedOn(db, me.id, k) > 0 || workedOn(db, me.id, k) > 0).reverse(), [bf, bt, db, me.id]);

  return (
    <div className="grid gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Seg opts={[{ v: "day", l: "День" }, { v: "week", l: "Неделя" }, { v: "month", l: "Месяц" }, { v: "year", l: "Год" }, { v: "custom", l: "Период" }]} val={period} onChange={setPeriod} />
        {period === "custom" && (
          <div className="flex items-center gap-2 text-sm font-bold text-mute">
            <input type="date" className="input !w-40 !h-9" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            —
            <input type="date" className="input !w-40 !h-9" value={to} min={from} max={tk} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-bold text-mute hidden sm:block">{fmtDateFull(bf)} — {fmtDateFull(bt)}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { exportMyStats(db, me.id, me.name, bf, bt); toast("Файл Excel сохранён", "ok"); }}>
            <I n="xls" size={14} />Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile icon="clock" tone="accent" label="Отработано" val={fmtDur(row.factMin)} sub={`${row.days} ${plural(row.days, "день", "дня", "дней")}`} />
        <StatTile icon="cal" tone="ink" label="По графику" val={fmtDur(row.planMin)} sub="план на период" />
        <StatTile icon="timer" tone="ok" label="Переработка" val={fmtDur(row.otMin)} sub={`×${String(db.settings.overtimeK).replace(".", ",")} к оплате`} />
        <StatTile icon="warn" tone={row.shortMin > 0 ? "bad" : "ok"} label="Недоработка" val={fmtDur(row.shortMin)} sub={row.shortMin ? "нужно отработать" : "всё закрыто"} />
        <StatTile icon="history" tone={row.late ? "warn" : "ok"} label="Опозданий" val={String(row.late)} sub="позже начала на 5+ мин" />
        <StatTile icon="money" tone="night" label="К выплате" val={fmtMoney(row.salary)} sub={`ставка ${me.rate} ₽/ч`} />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Динамика: план и факт</h3>
          <Bars data={chart} />
        </div>
        <div className="card p-5 min-h-0">
          <h3 className="font-display text-sm font-semibold mb-3">Дни периода</h3>
          <div className="max-h-[380px] overflow-y-auto pr-1">
            {rows.length === 0 ? <Empty text="В выбранном периоде нет рабочих дней" /> : (
              <table className="tbl">
                <thead><tr><th>Дата</th><th>График</th><th>Приход</th><th>Уход</th><th className="!text-right">Факт</th></tr></thead>
                <tbody>
                  {rows.map((k) => {
                    const c = shiftOf(db, me.id, k);
                    const ps = db.punches.filter((p) => p.userId === me.id && p.date === k);
                    const late = c && ps[0] && ps[0].tin > SHIFT_META[c.type].start + 5;
                    return (
                      <tr key={k}>
                        <td className="font-bold whitespace-nowrap">{fmtDM(k)}</td>
                        <td>{c ? <span className={`badge ${SHIFT_META[c.type].cls}`}>{SHIFT_META[c.type].code} {SHIFT_META[c.type].label.split(" ")[1] || ""}</span> : "—"}</td>
                        <td className="font-mono tnum text-xs">{ps[0] ? fmtMin(ps[0].tin) : "—"} {late && <span className="badge bg-warn-soft text-warn ml-1">опозд.</span>}</td>
                        <td className="font-mono tnum text-xs">{ps.length && ps[ps.length - 1].tout !== null ? fmtMin(ps[ps.length - 1].tout!) : ps.length ? "на смене" : "—"}</td>
                        <td className="!text-right font-bold tnum">{workedOn(db, me.id, k, true) ? fmtDurH(workedOn(db, me.id, k, true)) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, tone, label, val, sub }: { icon: string; tone: "ink" | "ok" | "bad" | "accent" | "night" | "warn"; label: string; val: string; sub: string }) {
  const tones: Record<string, string> = {
    ink: "text-steel-900", ok: "text-ok", bad: "text-bad", accent: "text-accent-deep", night: "text-night", warn: "text-warn",
  };
  const bgs: Record<string, string> = {
    ink: "bg-paper", ok: "bg-ok-soft", bad: "bg-bad-soft", accent: "bg-accent-soft", night: "bg-night-soft", warn: "bg-warn-soft",
  };
  return (
    <div className="card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className={`w-8 h-8 rounded-lg grid place-items-center ${bgs[tone]} ${tones[tone]}`}><I n={icon} size={15} /></div>
      <div className="font-display text-[17px] font-bold mt-2.5 tnum leading-tight">{val}</div>
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-mute mt-0.5">{label}</div>
      <div className="text-[11px] text-mute font-semibold mt-0.5">{sub}</div>
    </div>
  );
}

// ================= ГРАФИК (просмотр) =================
export function ScheduleView({ onAskSwap }: { onAskSwap?: (date: string) => void }) {
  const { db, me } = useStore();
  const tk = todayKey();
  const [mk, setMk] = useState(tk.slice(0, 7) + "-01");
  const [mode, setMode] = useState<"me" | "dept">("me");
  if (!me) return null;
  const dim = daysInMonth(mk);
  const mates = db.users.filter((u) => u.role === "employee" && u.active && u.dept === me.dept && u.id !== me.id);
  const days = Array.from({ length: dim }, (_, i) => mk.slice(0, 8) + String(i + 1).padStart(2, "0"));

  return (
    <div className="grid gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button className="w-9 h-9 rounded-lg border border-line grid place-items-center hover:bg-paper transition" onClick={() => setMk(addDaysKey(monthEnd(mk), 1))}><I n="left" size={16} /></button>
          <div className="font-display font-semibold text-sm w-40 text-center">{monthTitle(mk)}</div>
          <button className="w-9 h-9 rounded-lg border border-line grid place-items-center hover:bg-paper transition" onClick={() => setMk(addDaysKey(mk, -daysInMonth(mk)))}><I n="right" size={16} /></button>
        </div>
        <Seg opts={[{ v: "me", l: "Мой график" }, { v: "dept", l: `Цех: ${me.dept}` }]} val={mode} onChange={setMode} />
        <div className="ml-auto flex gap-2 flex-wrap">
          {(Object.keys(SHIFT_META) as ShiftType[]).map((t) => (
            <span key={t} className={`badge ${SHIFT_META[t].cls}`}>{SHIFT_META[t].code} · {SHIFT_META[t].label}</span>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[64vh] overflow-y-auto">
          <table className="tbl">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-32">Дата</th>
                <th className="w-40">Моя смена</th>
                {mode === "dept" && <th>Работают в цехе</th>}
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {days.map((k) => {
                const c = shiftOf(db, me.id, k);
                const we = isWeekend(k);
                const isToday = k === tk;
                const working = mates.filter((u) => { const s = shiftOf(db, u.id, k); return s && (s.type === "day" || s.type === "night"); });
                return (
                  <tr key={k} className={isToday ? "!bg-accent-soft/60" : we ? "bg-paper/40" : ""}>
                    <td className={`font-bold whitespace-nowrap ${we ? "text-mute" : ""}`}>
                      {fmtDM(k)}{isToday && <span className="badge bg-accent text-white ml-2">сегодня</span>}
                    </td>
                    <td>
                      {c ? (
                        <span className={`badge ${SHIFT_META[c.type].cls} !px-2.5`}>{SHIFT_META[c.type].code} · {SHIFT_META[c.type].label}</span>
                      ) : <span className="text-mute text-xs font-bold">{we ? "выходной" : "не назначено"}</span>}
                    </td>
                    {mode === "dept" && (
                      <td>
                        {working.length === 0 ? <span className="text-mute text-xs font-bold">—</span> : (
                          <div className="flex flex-wrap gap-1.5">
                            {working.map((u) => (
                              <span key={u.id} className="inline-flex items-center gap-1.5 bg-paper border border-line rounded-full pl-0.5 pr-2 py-0.5 text-[11px] font-bold">
                                <Avatar u={u} size={20} />{u.name.split(" ")[0]}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="!text-right">
                      {(!c || c.type === "off") && k >= tk && onAskSwap && (
                        <button className="btn btn-soft btn-sm" onClick={() => onAskSwap(k)}><I n="swap" size={13} />Замена</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================= ЗАЯВКИ =================
export function RequestsView({ draft, onDraftUsed }: { draft?: { kind: "swap" | "vacation" | "extra"; date?: string } | null; onDraftUsed?: () => void }) {
  const { db, me, createRequest } = useStore();
  const { toast } = useToast();
  const tk = todayKey();
  const [kind, setKind] = useState<"swap" | "vacation" | "extra">(draft?.kind || "swap");
  const [date, setDate] = useState(draft?.date || addDaysKey(tk, 1));
  const [dateEnd, setDateEnd] = useState(addDaysKey(tk, 7));
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLFormElement>(null);
  if (!me) return null;

  React.useEffect(() => {
    if (draft) { setKind(draft.kind); if (draft.date) setDate(draft.date); onDraftUsed?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const mates = db.users.filter((u) => u.role === "employee" && u.active && u.id !== me.id);
  const mine = db.requests.filter((r) => r.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const KIND = { swap: ["Замена дня", "swap"], vacation: ["Отпуск", "sun"], extra: ["Доп. смена", "plus"] } as const;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return toast("Укажите дату", "bad");
    if (kind === "vacation" && dateEnd < date) return toast("Дата окончания раньше начала", "bad");
    createRequest(kind, date, kind === "vacation" ? dateEnd : undefined, kind === "swap" ? target || undefined : undefined, note.trim());
    setNote("");
    fileRef.current?.reset();
    setDate(addDaysKey(tk, 1));
    toast("Заявка отправлена администратору", "ok");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
      <form ref={fileRef} onSubmit={submit} className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Новая заявка</h3>
        <div className="grid gap-4">
          <Seg opts={[{ v: "swap", l: "Замена дня" }, { v: "vacation", l: "Отпуск" }, { v: "extra", l: "Доп. смена" }]} val={kind} onChange={setKind} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={kind === "vacation" ? "С даты" : "Дата"}>
              <input type="date" className="input" value={date} min={tk} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            {kind === "vacation" && (
              <Field label="По дату">
                <input type="date" className="input" value={dateEnd} min={date} onChange={(e) => setDateEnd(e.target.value)} required />
              </Field>
            )}
            {kind === "swap" && (
              <Field label="Кто подменит (не обязательно)">
                <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">— не выбрано —</option>
                  {mates.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept}</option>)}
                </select>
              </Field>
            )}
          </div>
          <Field label="Комментарий">
            <textarea className="input" rows={3} placeholder={kind === "swap" ? "Почему нужна замена и когда отработаете…" : kind === "vacation" ? "Куда и почему…" : "Какую смену готовы взять…"} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button className="btn btn-pri w-full" type="submit"><I n="send" size={16} />Отправить на согласование</button>
          <p className="text-[11px] text-mute font-semibold -mt-1">Решение принимает админ — статус придёт в уведомления и появится в списке справа.</p>
        </div>
      </form>

      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Мои заявки <span className="text-mute">({mine.length})</span></h3>
        {mine.length === 0 ? <Empty icon="doc" text="Заявок пока нет" /> : (
          <div className="grid gap-2.5">
            {mine.map((r) => {
              const dec = r.decidedBy ? userById(db, r.decidedBy) : null;
              const st = r.status === "pending" ? ["на рассмотрении", "bg-warn-soft text-warn"] : r.status === "approved" ? ["одобрена", "bg-ok-soft text-ok"] : ["отклонена", "bg-bad-soft text-bad"];
              return (
                <div key={r.id} className="border border-line rounded-xl p-4 hover:border-steel-400 transition">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-8 h-8 rounded-lg bg-paper grid place-items-center text-mute"><I n={KIND[r.kind][1]} size={15} /></span>
                    <b className="text-sm">{KIND[r.kind][0]}</b>
                    <span className="text-xs font-bold text-mute">{fmtDateFull(r.date)}{r.dateEnd ? ` — ${fmtDateFull(r.dateEnd)}` : ""}</span>
                    <span className={`badge ml-auto ${st[1]}`}>{st[0]}</span>
                  </div>
                  {r.note && <p className="text-sm text-mute font-semibold mt-2">{r.note}</p>}
                  {r.targetUserId && r.kind === "swap" && (
                    <p className="text-xs font-bold text-mute mt-1">Подменяет: {userById(db, r.targetUserId)?.name || "—"}</p>
                  )}
                  {r.status !== "pending" && (
                    <p className="text-xs font-bold mt-2 text-mute">Решение ({dec?.name || "админ"}): <span className={r.status === "approved" ? "text-ok" : "text-bad"}>{r.decisionNote}</span> · {relTime(r.createdAt)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ================= ПРОФИЛЬ =================
export function ProfileView() {
  const { db, me, updateUser, logout } = useStore();
  const { toast } = useToast();
  const [name, setName] = useState(me?.name || "");
  const [bio, setBio] = useState(me?.bio || "");
  const [username, setUsername] = useState(me?.username || "");
  const [avatar, setAvatar] = useState<string | null>(me?.avatar || null);
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (!me) return null;

  const save = () => {
    if (me.password && curPwd !== me.password) return toast("Текущий пароль указан неверно", "bad");
    if (newPwd && newPwd !== newPwd2) return toast("Новые пароли не совпадают", "bad");
    const err = updateUser(me.id, { name, bio, username, avatar, password: newPwd ? newPwd : newPwd === "" && !me.password ? "" : me.password });
    if (err) return toast(err, "bad");
    setCurPwd(""); setNewPwd(""); setNewPwd2("");
    toast("Профиль сохранён", "ok");
  };

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
      <div className="card p-6 text-center">
        <button className="relative group mx-auto block" onClick={() => fileRef.current?.click()}>
          <Avatar u={{ ...me, avatar }} size={110} />
          <span className="absolute inset-0 rounded-full bg-steel-950/55 opacity-0 group-hover:opacity-100 transition grid place-items-center text-white">
            <I n="camera" size={26} />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) { setAvatar(await shrinkImage(f, 256)); toast("Фото загружено — не забудьте сохранить", "ok"); }
        }} />
        <div className="font-display font-bold text-lg mt-4">{me.name}</div>
        <div className="text-sm text-mute font-bold mt-1">{me.dept}</div>
        <div className="flex justify-center mt-2"><RoleBadge role={me.role} /></div>
        <div className="grid grid-cols-2 gap-2 mt-5 text-left">
          <div className="bg-paper rounded-xl p-3">
            <div className="lbl !mb-0.5">Ставка</div>
            <div className="font-bold text-sm tnum">{me.rate ? `${me.rate} ₽/ч` : "оклад"}</div>
          </div>
          <div className="bg-paper rounded-xl p-3">
            <div className="lbl !mb-0.5">Часов за месяц</div>
            <div className="font-bold text-sm tnum">{fmtDur(summarize(db, me, monthStart(todayKey()), monthEnd(todayKey())).factMin)}</div>
          </div>
        </div>
        <button className="btn btn-ghost w-full mt-5" onClick={() => { logout(); }}><I n="logout" size={16} />Выйти из аккаунта</button>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-sm font-semibold mb-4">Настройки профиля</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="ФИО"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Логин" hint="Используется для входа и в Excel-шаблонах"><input className="input font-mono" value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Коротко о себе"><textarea className="input" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Должность, навыки, бригада…" /></Field>
          </div>
        </div>
        <h4 className="lbl mt-6 !text-xs flex items-center gap-1.5"><I n="key" size={13} />Смена пароля</h4>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Текущий пароль">{me.password ? <input type="password" className="input" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} /> : <input className="input" disabled value="пароль не задан" />}</Field>
          <Field label="Новый пароль" hint="Оставьте пустым — без изменений"><input type="password" className="input" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></Field>
          <Field label="Повторите новый"><input type="password" className="input" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} /></Field>
        </div>
        {me.password === "" && newPwd === "" && (
          <p className="text-[11px] font-bold text-warn mt-2 flex items-center gap-1.5"><I n="info" size={13} />Сейчас вход без пароля. Задайте пароль, чтобы ограничить доступ к аккаунту.</p>
        )}
        <div className="flex justify-end mt-6"><button className="btn btn-pri" onClick={save}><I n="check" size={16} />Сохранить изменения</button></div>
      </div>
    </div>
  );
}
