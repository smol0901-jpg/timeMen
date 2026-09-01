import React, { useMemo, useRef, useState } from "react";
import {
  useStore, openPunchOf, punchDur, workedOn, plannedOn, summarizeAll, summarize, userById,
} from "../lib/store";
import { SHIFT_META, ShiftType, User, Role, ROLE_LABEL } from "../lib/types";
import {
  todayKey, nowMin, fmtMin, fmtDur, fmtDurH, fmtDM, fmtDateFull, fmtMoney,
  mondayKey, addDaysKey, monthStart, monthEnd, monthTitle, daysInMonth, rangeKeys,
  weekdayIdx, WD, isWeekend, relTime, hDec, fmtDate,
} from "../lib/time";
import { I, Avatar, useNow, useToast, Bars, Progress, Seg, Field, Empty, Modal, Confirm, RoleBadge, shrinkImage, Stat } from "../components/ui";
import { exportSchedule } from "../lib/excel";

// ================= ДАШБОРД =================
export function DashboardView({ go }: { go: (v: string) => void }) {
  const { db, me, closePunch, decideRequest } = useStore();
  const { toast } = useToast();
  const now = useNow();
  const tk = todayKey();

  const openNow = db.punches.filter((p) => p.tout === null);
  const today = openNow.filter((p) => p.date === tk);
  const stale = openNow.filter((p) => p.date !== tk);
  const factToday = db.users.reduce((s, u) => s + workedOn(db, u.id, tk, true), 0);
  const lateToday = today.filter((p) => p.tin > 485).length;
  const pending = db.requests.filter((r) => r.status === "pending");
  const rowsMonth = summarizeAll(db, monthStart(tk), monthEnd(tk));
  const monthFact = rowsMonth.reduce((s, r) => s + r.factMin, 0);
  const monthOt = rowsMonth.reduce((s, r) => s + r.otMin, 0);

  const wk = mondayKey(tk);
  const week = rangeKeys(wk, addDaysKey(wk, 6)).map((k) => ({
    label: WD[weekdayIdx(k)],
    a: db.users.reduce((s, u) => s + plannedOn(db, u.id, k), 0),
    b: db.users.reduce((s, u) => s + workedOn(db, u.id, k, true), 0),
  }));

  const depts = [...new Set(db.users.filter((u) => u.role === "employee").map((u) => u.dept))];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat icon="users" tone="ok" label="На смене сейчас" value={today.length} sub={`из ${db.users.filter((u) => u.role === "employee" && u.active).length} сотрудников`} />
        <Stat icon="clock" tone="accent" label="Отработано сегодня" value={fmtDurH(factToday)} sub="по всем цехам" />
        <Stat icon="warn" tone={lateToday ? "warn" : "ok"} label="Опоздали сегодня" value={lateToday} sub="после 08:05" />
        <Stat icon="doc" tone={pending.length ? "bad" : "ok"} label="Заявки в ожидании" value={pending.length} sub={pending.length ? "требуют решения" : "всё разобрано"} />
        <Stat icon="chart" tone="night" label="Факт за месяц" value={fmtDurH(monthFact)} sub={`переработка ${fmtDurH(monthOt)}`} />
        <Stat icon="wifi" tone="ink" label="Активных сессий" value={openNow.length} sub="открытые отметки" />
      </div>

      <div className="grid xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="grid gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold">Сейчас на смене</h3>
              <span className="text-[11px] font-extrabold text-mute">{fmtDateFull(tk)} · {fmtMin(nowMin())}</span>
            </div>
            {today.length === 0 ? <Empty icon="clock" text="Никто ещё не отметился — тишина в цехах" /> : (
              <div className="grid gap-2">
                {today.map((p) => {
                  const u = userById(db, p.userId);
                  const el = punchDur(p, db.settings.breakMin, true);
                  const plan = plannedOn(db, p.userId, tk);
                  return (
                    <div key={p.id} className="flex items-center gap-3 border border-line rounded-xl p-3 hover:border-steel-400 transition">
                      <span className="relative"><Avatar u={u} size={38} /><span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-ok ring-2 ring-white pulse-ok" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{u?.name}</div>
                        <div className="text-[11px] text-mute font-bold">с {fmtMin(p.tin)} · {p.source === "kiosk" ? "терминал" : "приложение"} · {u?.dept}</div>
                      </div>
                      <div className="text-right hidden sm:block w-28">
                        <div className="font-mono tnum font-bold text-ok">{fmtDurH(el)}</div>
                        {plan > 0 && <div className="mt-1"><Progress val={(el / plan) * 100} tone="ok" /></div>}
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => { closePunch(p.id, nowMin()); toast(`Смена ${u?.name} закрыта вручную`, "ok"); }}>Закрыть</button>
                    </div>
                  );
                })}
              </div>
            )}
            {stale.length > 0 && (
              <div className="mt-4 border border-warn/30 bg-warn-soft rounded-xl p-3">
                <div className="text-xs font-extrabold text-warn flex items-center gap-1.5 mb-2"><I n="warn" size={14} />Незакрытые смены прошлых дней — забыли отметиться</div>
                {stale.map((p) => {
                  const u = userById(db, p.userId);
                  return (
                    <div key={p.id} className="flex items-center gap-2 py-1 text-sm">
                      <b>{u?.name}</b><span className="text-mute text-xs font-bold">{fmtDM(p.date)}, начал в {fmtMin(p.tin)}</span>
                      <button className="btn btn-sm btn-ghost ml-auto" onClick={() => { closePunch(p.id, 1050); toast(`Закрыто в 17:30 (по графику)`, "ok"); }}>Закрыть в 17:30</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-4">Неделя предприятия: план и факт</h3>
            <Bars data={week} />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold">Заявки на решении</h3>
              <button className="btn btn-soft btn-sm" onClick={() => go("requests")}>Все заявки<I n="right" size={13} /></button>
            </div>
            {pending.length === 0 ? <Empty icon="check" text="Новых заявок нет" /> : (
              <div className="grid gap-2.5">
                {pending.slice(0, 4).map((r) => {
                  const u = userById(db, r.userId);
                  const label = r.kind === "swap" ? "замена дня" : r.kind === "vacation" ? "отпуск" : "доп. смена";
                  return (
                    <div key={r.id} className="border border-line rounded-xl p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar u={u} size={30} />
                        <div className="min-w-0 flex-1">
                          <b className="text-xs block truncate">{u?.name}</b>
                          <span className="text-[11px] text-mute font-bold">{label} · {fmtDate(r.date)} · {relTime(r.createdAt)}</span>
                        </div>
                      </div>
                      {r.note && <p className="text-xs text-mute font-semibold mt-1.5 line-clamp-2">{r.note}</p>}
                      <div className="flex gap-2 mt-2.5">
                        <button className="btn btn-ok btn-sm flex-1" onClick={() => { decideRequest(r.id, true, ""); toast("Заявка одобрена, график обновлён", "ok"); }}><I n="check" size={13} />Одобрить</button>
                        <button className="btn btn-ghost btn-sm flex-1" onClick={() => { decideRequest(r.id, false, ""); toast("Заявка отклонена"); }}><I n="x" size={13} />Отклонить</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Цеха за месяц</h3>
            <div className="grid gap-3">
              {depts.map((d) => {
                const rs = rowsMonth.filter((r) => r.user.dept === d);
                const f = rs.reduce((s, r) => s + r.factMin, 0);
                const p = rs.reduce((s, r) => s + r.planMin, 0);
                return (
                  <div key={d}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span>{d} · {rs.length} чел.</span>
                      <span className="tnum text-mute">{fmtDurH(f)} / {fmtDurH(p)}</span>
                    </div>
                    <Progress val={p ? (f / p) * 100 : 0} tone={f >= p ? "ok" : f >= p * 0.85 ? "accent" : "bad"} />
                  </div>
                );
              })}
            </div>
          </div>

          {me?.role === "superadmin" && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-semibold">Последние действия</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => go("audit")}>Журнал<I n="right" size={13} /></button>
              </div>
              <div className="grid gap-2 text-xs font-semibold text-mute">
                {db.audit.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex gap-2"><span className="text-mute/70 tnum shrink-0">{relTime(a.ts)}</span><span className="truncate"><b className="text-ink">{a.actor}:</b> {a.details}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================= СОТРУДНИКИ =================
const AV_COLORS = ["#e56f24", "#3f6d9e", "#17875c", "#8a5aa0", "#b0567b", "#4d8a9c", "#a97a12", "#5d6a80"];

export function EmployeesView() {
  const { db, me, addUser, updateUser, removeUser } = useStore();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [deptF, setDeptF] = useState("");
  const [edit, setEdit] = useState<User | "new" | null>(null);
  const [del, setDel] = useState<User | null>(null);
  const tk = todayKey();

  const depts = [...new Set(db.users.map((u) => u.dept))];
  const list = db.users.filter((u) => (!deptF || u.dept === deptF) && (u.name.toLowerCase().includes(q.toLowerCase()) || u.username.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="grid gap-4">
      <div className="card p-4 flex flex-wrap gap-2.5 items-center">
        <div className="relative">
          <I n="search" size={15} />
          <input className="input !pl-9 !w-56" placeholder="Поиск: имя или логин" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <select className="input !w-48" value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="">Все цеха</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-xs font-bold text-mute">{list.length} чел. · сотрудников без лимита</span>
        <button className="btn btn-pri ml-auto" onClick={() => setEdit("new")}><I n="plus" size={16} />Добавить сотрудника</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl min-w-[760px]">
            <thead><tr><th>Сотрудник</th><th>Роль</th><th>Цех</th><th>Ставка</th><th>Пароль</th><th>Часы за месяц</th><th>Статус</th><th className="!text-right">Действия</th></tr></thead>
            <tbody>
              {list.map((u) => {
                const s = summarize(db, u, monthStart(tk), monthEnd(tk));
                const isRoot = u.role === "superadmin";
                return (
                  <tr key={u.id} className={u.active ? "" : "opacity-55"}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar u={u} size={34} />
                        <div className="min-w-0">
                          <div className="font-bold flex items-center gap-1.5">{u.name}{isRoot && <I n="star" size={12} />}</div>
                          <div className="text-[11px] text-mute font-bold font-mono">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td className="text-xs font-bold">{u.dept}</td>
                    <td className="tnum text-xs font-bold">{u.rate ? `${u.rate} ₽/ч` : "—"}</td>
                    <td>{u.password ? <span className="badge bg-paper text-mute"><I n="lock" size={11} />задан</span> : <span className="badge bg-ok-soft text-ok">без пароля</span>}</td>
                    <td className="tnum font-bold text-xs">{u.role === "employee" ? fmtDurH(s.factMin) : "—"}</td>
                    <td>
                      <button className={`badge cursor-pointer transition ${u.active ? "bg-ok-soft text-ok hover:bg-ok hover:text-white" : "bg-bad-soft text-bad hover:bg-bad hover:text-white"}`}
                        onClick={() => { updateUser(u.id, { active: !u.active }); toast(u.active ? `${u.name} отключён от системы` : `${u.name} снова активен`, u.active ? "bad" : "ok"); }}>
                        {u.active ? "активен" : "отключён"}
                      </button>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-night-soft hover:text-night transition" onClick={() => setEdit(u)} title="Изменить"><I n="edit" size={15} /></button>
                        <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition disabled:opacity-30" disabled={isRoot}
                          title={isRoot ? "Суперадмина удалить невозможно" : "Удалить"} onClick={() => setDel(u)}><I n="trash" size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {edit && <EmployeeModal u={edit === "new" ? null : edit} canSuper={me?.role === "superadmin"} depts={depts}
        onClose={() => setEdit(null)}
        onSave={(data) => {
          if (edit === "new") {
            const e = addUser({
              name: "", username: "", password: "", role: "employee", dept: "", rate: 0, bio: "", active: true,
              ...data, color: AV_COLORS[db.users.length % AV_COLORS.length],
            });
            if (e) return toast(e, "bad");
            toast(`Сотрудник ${data.name} создан`, "ok");
          } else {
            const e = updateUser(edit.id, data);
            if (e) return toast(e, "bad");
            toast("Изменения сохранены", "ok");
          }
          setEdit(null);
        }} />}

      <Confirm open={!!del} onClose={() => setDel(null)} title={`Удалить ${del?.name}?`}
        text={<>Будут удалены отметки, график и заявки этого сотрудника. Записи в ленте останутся. Действие необратимо.</>}
        onYes={() => { if (del) { const e = removeUser(del.id); e ? toast(e, "bad") : toast("Пользователь удалён"); } }} />
    </div>
  );
}

function EmployeeModal({ u, onClose, onSave, depts, canSuper }: {
  u: User | null; onClose: () => void; onSave: (d: Partial<User>) => void; depts: string[]; canSuper: boolean;
}) {
  const [name, setName] = useState(u?.name || "");
  const [username, setUsername] = useState(u?.username || "");
  const [password, setPassword] = useState(u?.password || "");
  const [role, setRole] = useState<Role>(u?.role || "employee");
  const [dept, setDept] = useState(u?.dept || depts[0] || "Цех №1");
  const [rate, setRate] = useState(u?.rate || 0);
  const [bio, setBio] = useState(u?.bio || "");
  const [avatar, setAvatar] = useState(u?.avatar || null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Modal open onClose={onClose} title={u ? "Изменить сотрудника" : "Новый сотрудник"} w="max-w-xl"
      foot={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-pri" onClick={() => onSave({ name, username, password, role, dept, rate, bio, avatar })}><I n="check" size={15} />Сохранить</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex items-center gap-4">
          <button className="relative group" onClick={() => fileRef.current?.click()}>
            <Avatar u={{ ...({} as User), name: name || "??", color: "#3f6d9e", avatar }} size={64} />
            <span className="absolute inset-0 rounded-full bg-steel-950/50 opacity-0 group-hover:opacity-100 grid place-items-center text-white transition"><I n="camera" size={20} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await shrinkImage(f, 256)); }} />
          <div className="text-xs font-bold text-mute">Фотоаватар — необязательно.<br />Без фото показывается инициал-эмблема.</div>
        </div>
        <Field label="ФИО"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Пётр Сергеевич" /></Field>
        <Field label="Логин"><input className="input font-mono" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ivanov" /></Field>
        <Field label="Пароль" hint="Пусто — вход без пароля (для терминала)"><input className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="—" /></Field>
        <Field label="Роль">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="employee">Сотрудник</option>
            <option value="admin">Админ</option>
            {canSuper && <option value="superadmin">Суперадмин</option>}
          </select>
        </Field>
        <Field label="Цех / отдел">
          <input className="input" list="depts-list" value={dept} onChange={(e) => setDept(e.target.value)} />
          <datalist id="depts-list">{depts.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="Ставка, ₽/час" hint="Для расчёта зарплаты в отчётах"><input type="number" min={0} className="input tnum" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></Field>
        <div className="sm:col-span-2">
          <Field label="Короткая информация"><textarea className="input" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Бригадир, линия №2…" /></Field>
        </div>
      </div>
      {role === "superadmin" && <p className="mt-3 text-[11px] font-bold text-warn flex items-center gap-1.5"><I n="shield" size={13} />Суперадмин получает полный контроль, его нельзя удалить.</p>}
    </Modal>
  );
}

// ================= РЕДАКТОР ГРАФИКА =================
export function ScheduleEditor() {
  const { db, me, setShift, fillPattern, publishSchedule } = useStore();
  const { toast } = useToast();
  const tk = todayKey();
  const [mk, setMk] = useState(tk.slice(0, 7) + "-01");
  const [deptF, setDeptF] = useState("");
  const [menu, setMenu] = useState<{ u: string; d: string; x: number; y: number } | null>(null);
  const [pat, setPat] = useState("5/2d");
  const dim = daysInMonth(mk);
  const days = Array.from({ length: dim }, (_, i) => ({ key: mk.slice(0, 8) + String(i + 1).padStart(2, "0"), day: i + 1 }));
  const emps = db.users.filter((u) => u.role === "employee" && (!deptF || u.dept === deptF));
  const depts = [...new Set(db.users.filter((u) => u.role === "employee").map((u) => u.dept))];

  const cellOf = (uid: string, date: string) => db.schedule.find((s) => s.userId === uid && s.date === date);
  const headcount = (date: string) => emps.filter((u) => { const c = cellOf(u.id, date); return c && (c.type === "day" || c.type === "night"); }).length;

  return (
    <div className="grid gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button className="w-9 h-9 rounded-lg border border-line grid place-items-center hover:bg-paper transition" onClick={() => setMk(addDaysKey(mk, -daysInMonth(mk)))}><I n="left" size={16} /></button>
          <div className="font-display font-semibold text-sm w-40 text-center">{monthTitle(mk)}</div>
          <button className="w-9 h-9 rounded-lg border border-line grid place-items-center hover:bg-paper transition" onClick={() => setMk(addDaysKey(monthEnd(mk), 1))}><I n="right" size={16} /></button>
        </div>
        <select className="input !w-44 !h-9" value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="">Все цеха</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => { exportSchedule(db, mk, deptF || undefined); toast("График выгружен в Excel", "ok"); }}><I n="xls" size={14} />Excel</button>
          <button className="btn btn-pri btn-sm" onClick={() => { publishSchedule(mk); toast("График опубликован — сотрудники получили уведомление", "ok"); }}><I n="send" size={14} />Опубликовать</button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2.5 text-xs font-bold text-mute">
        <I n="info" size={14} />
        Клик по ячейке — тип смены. Шаблон месяца применяется кнопкой в строке сотрудника.
        <span className="ml-auto flex items-center gap-1.5">
          Шаблон:
          <select className="input !h-8 !w-44 text-xs" value={pat} onChange={(e) => setPat(e.target.value)}>
            <option value="5/2d">5/2 · день 08–17</option>
            <option value="5/2n">5/2 · ночь 20–08</option>
            <option value="2/2d">2/2 · день</option>
            <option value="3/3d">3/3 · день</option>
            <option value="clear">Очистить месяц</option>
          </select>
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[62vh]">
          <table className="tbl border-separate border-spacing-0" style={{ minWidth: 34 * dim + 220 }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 bg-surface z-10 min-w-[200px] !bg-paper">Сотрудник</th>
                {days.map(({ key, day }) => (
                  <th key={key} className={`!px-0 text-center min-w-[32px] ${isWeekend(key) ? "!bg-steel-900/8 text-mute" : ""} ${key === tk ? "!bg-accent-soft" : ""}`}>
                    <div className="text-[9px] opacity-70">{WD[weekdayIdx(key)]}</div>{day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emps.map((u) => (
                <tr key={u.id}>
                  <td className="sticky left-0 bg-surface z-10 border-r border-line">
                    <div className="flex items-center gap-2">
                      <Avatar u={u} size={28} />
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate leading-tight">{u.name}</div>
                        <div className="text-[10px] text-mute font-bold truncate">{u.dept}</div>
                      </div>
                      <button className="ml-auto btn btn-ghost btn-sm !h-6 !px-1.5 !text-[10px]"
                        onClick={() => {
                          const night = pat === "5/2n";
                          const p = pat === "clear" ? "clear" : pat.slice(0, 3) as "5/2" | "2/2" | "3/3";
                          fillPattern(u.id, mk, p, night);
                          toast(`Шаблон применён: ${u.name}`, "ok");
                        }}>шаблон</button>
                    </div>
                  </td>
                  {days.map(({ key }) => {
                    const c = cellOf(u.id, key);
                    const meta = c ? SHIFT_META[c.type] : null;
                    return (
                      <td key={key} className={`!p-0.5 text-center ${isWeekend(key) ? "bg-paper/50" : ""} ${key === tk ? "bg-accent-soft/50" : ""}`}>
                        <button
                          onClick={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); setMenu({ u: u.id, d: key, x: Math.min(r.left, window.innerWidth - 190), y: Math.min(r.bottom + 4, window.innerHeight - 240) }); }}
                          className={`w-full h-8 rounded-md text-[11px] font-extrabold transition hover:ring-2 hover:ring-accent/50 cursor-pointer ${meta ? meta.cls : "bg-transparent text-line hover:bg-paper"}`}>
                          {meta ? meta.code : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 bg-paper z-10 font-extrabold text-[11px] text-mute uppercase tracking-wider border-r border-line">В смену, чел.</td>
                {days.map(({ key }) => {
                  const n = headcount(key);
                  return <td key={key} className={`text-center font-mono tnum text-[11px] font-bold ${n === 0 ? "text-line" : n <= 2 ? "text-warn" : "text-ok"}`}>{n || "·"}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className="fixed z-50 anim-pop card p-1.5 shadow-xl w-[180px]" style={{ left: menu.x, top: menu.y }}>
            <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-mute">
              {userById(db, menu.u)?.name.split(" ")[0]} · {fmtDM(menu.d)}
            </div>
            {(Object.keys(SHIFT_META) as ShiftType[]).map((t) => (
              <button key={t} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-paper text-left transition"
                onClick={() => { setShift(menu.u, menu.d, t); setMenu(null); }}>
                <span className={`badge ${SHIFT_META[t].cls} !w-7 justify-center`}>{SHIFT_META[t].code}</span>
                <span className="text-xs font-bold">{SHIFT_META[t].label}</span>
              </button>
            ))}
            <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-bad-soft text-bad text-xs font-bold transition"
              onClick={() => { setShift(menu.u, menu.d, null); setMenu(null); }}>
              <I n="x" size={13} />Очистить ячейку
            </button>
          </div>
        </>
      )}
    </div>
  );
  void me;
}
