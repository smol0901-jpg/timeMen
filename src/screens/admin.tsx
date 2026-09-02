import React, { useMemo, useRef, useState } from "react";
import { useStore, userById, wsName, posName, openPunchOf, punchDur, summarizeAll } from "../lib/store";
import { SHIFT_META, ShiftType, Role, PayMode, PAY_LABEL, User } from "../lib/types";
import {
  todayKey, nowMin, fmtMin, fmtDur, fmtDurH, monthTitle, rangeKeys, addDaysKey, fmtDateFull, WD, weekdayIdx,
  isWeekend, fmtMoney, daysInMonth, relTime, hDec,
} from "../lib/time";
import { I, Avatar, useToast, Modal, Confirm, Field, Empty, Seg, RoleBadge, StatTile } from "../components/ui";
import { exportScheduleMonth, scheduleTemplate, parseScheduleFile, parseEmployeesFile } from "../lib/excel";
import { DossierModal, FinePanel, RatingPanel } from "./hr";

// ================= ДАШБОРД =================
export function DashboardView() {
  const { db, setPunchTout, confirmPunch } = useStore();
  const { toast } = useToast();
  const [fix, setFix] = useState<Record<string, string>>({});
  const tk = todayKey();

  const onShift = db.punches.filter((p) => p.tout === null).map((p) => ({ p, u: userById(db, p.userId) })).filter((x) => x.u);
  const planned = db.schedule.filter((s) => s.date === tk && (s.type === "day" || s.type === "night")).length;
  const lateToday = db.punches.filter((p) => {
    const c = db.schedule.find((s) => s.userId === p.userId && s.date === p.date);
    return p.date === tk && c && (c.type === "day" || c.type === "night") && p.tin > SHIFT_META[c.type].start + 5;
  }).length;
  const pendReq = db.requests.filter((r) => r.status === "pending" && r.kind !== "resolution").length;
  const resolutions = db.punches.filter((p) => p.resolution === "pending");
  const todayHours = db.punches.filter((p) => p.date === tk).reduce((s, p) => s + punchDur(p, db.settings.breakMin, true), 0);
  const sensors = useMemo(() => {
    const last = new Map<string, { value: number; unit: string; ts: string }>();
    db.sensors.forEach((sp) => last.set(sp.name, { value: sp.value, unit: sp.unit, ts: sp.ts }));
    return [...last.entries()];
  }, [db.sensors]);

  return (
    <div className="grid gap-4">
      <BestStrip />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile icon="zap" tone="ok" label="Сейчас на смене" val={String(onShift.length)} sub={`план на сегодня: ${planned}`} />
        <StatTile icon="clock" tone="accent" label="Часы за сегодня" val={fmtDur(todayHours)} sub="все сотрудники" />
        <StatTile icon="history" tone={lateToday ? "warn" : "ok"} label="Опоздали сегодня" val={String(lateToday)} sub="позже 5 мин" />
        <StatTile icon="doc" tone={pendReq ? "warn" : "ok"} label="Заявки ждут" val={String(pendReq)} sub="отпуска, замены, смены" />
        <StatTile icon="warn" tone={resolutions.length ? "bad" : "ok"} label="Ждут подтверждения" val={String(resolutions.length)} sub="внеплановые смены" />
      </div>

      {resolutions.length > 0 && (
        <div className="card !border-bad/50 p-4">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3"><I n="warn" size={16} className="text-bad" />Внеплановые смены — подтвердите часы</h3>
          <div className="grid gap-2">
            {resolutions.map((p) => {
              const u = userById(db, p.userId);
              const t = fix[p.id] || "18:00";
              return (
                <div key={p.id} className="flex items-center gap-3 flex-wrap border border-line rounded-lg px-3.5 py-2.5">
                  <Avatar u={u} size={32} />
                  <div className="min-w-0">
                    <b className="text-[13px] block">{u?.name}</b>
                    <span className="text-[11px] text-mute font-bold">{fmtDateFull(p.date)} · приход {fmtMin(p.tin)} · авто-закрытие {fmtMin(p.tout!)}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <input type="time" className="input !w-28 !h-8 font-mono" value={t} onChange={(e) => setFix({ ...fix, [p.id]: e.target.value })} />
                    <button className="btn btn-ok btn-sm" onClick={() => {
                      const [h, m] = t.split(":").map(Number);
                      setPunchTout(p.id, h * 60 + m, false);
                      confirmPunch(p.id);
                      toast(`Часы ${u?.name} подтверждены`, "ok");
                    }}><I n="check" size={13} />Подтвердить</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold">Сейчас на смене</h3>
            <span className="badge bg-ok-soft text-ok"><span className="w-1.5 h-1.5 rounded-full bg-ok pulse-ok" />live</span>
          </div>
          {onShift.length === 0 ? <Empty icon="clock" title="Никого нет на смене" text="Отметки появятся здесь в реальном времени со всех устройств." /> : (
            <table className="tbl">
              <thead><tr><th>Сотрудник</th><th>Цех</th><th>Приход</th><th>Отработано</th><th>Источник</th><th></th></tr></thead>
              <tbody>
                {onShift.map(({ p, u }) => (
                  <tr key={p.id}>
                    <td><span className="flex items-center gap-2"><Avatar u={u} size={28} /><b>{u!.name}</b></span></td>
                    <td className="text-[12px] font-bold text-mute">{wsName(db, u!.workshopId)}</td>
                    <td className="font-mono">{fmtMin(p.tin)}</td>
                    <td className="font-mono font-bold text-ok">{fmtDurH(punchDur(p, db.settings.breakMin, true))}</td>
                    <td><span className="badge bg-paper text-mute">{p.source === "kiosk" ? "терминал" : "приложение"}</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => { setPunchTout(p.id, nowMin(), false); toast(`Смена ${u!.name} закрыта (${fmtMin(nowMin())})`, "ok"); }}><I n="out" size={13} />Закрыть</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="grid gap-4">
          <div className="card p-4">
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="layers" size={15} />Датчики (API)</h3>
            {sensors.length === 0 ? <p className="text-[12px] font-bold text-mute">Показаний нет. Эндпоинты для подключения — в «Инструкции и API».</p> : (
              <div className="grid grid-cols-2 gap-2">
                {sensors.map(([name, v]) => (
                  <div key={name} className="border border-line rounded-lg px-3 py-2">
                    <div className="text-[10px] font-extrabold uppercase text-mute truncate">{name}</div>
                    <div className="font-mono font-bold tnum">{v.value} {v.unit}</div>
                    <div className="text-[10px] text-mute font-bold">{relTime(v.ts)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-4">
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="history" size={15} />Последние действия</h3>
            <div className="grid gap-2">
              {db.audit.slice(0, 6).map((a) => (
                <div key={a.id} className="text-[12px] leading-snug">
                  <b>{a.actor}</b> <span className="badge bg-paper text-mute !text-[9.5px]">{a.action}</span>
                  <div className="text-mute font-semibold">{a.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================= СОТРУДНИКИ =================
const AV_COLORS = ["#e56f24", "#3f6d9e", "#17875c", "#a97a12", "#7a4fbf", "#c74436", "#0f8b8d", "#b0487d"];

export function EmployeesView() {
  const { db, me, addUser, updateUser, archiveUser } = useStore();
  const { toast } = useToast();
  const [modal, setModal] = useState<null | { edit?: User }>(null);
  const [del, setDel] = useState<User | null>(null);
  const [hrFor, setHrFor] = useState<User | null>(null);
  const [dossier, setDossier] = useState<User | null>(null);
  const [archReason, setArchReason] = useState("");
  const [archTone, setArchTone] = useState<"pos" | "neg" | "neutral">("neutral");
  const [archNote, setArchNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ username: "", name: "", role: "employee" as Role, workshopId: "", positionId: "", payMode: "hour" as PayMode, rate: "", shiftCost: "", password: "" });

  const openAdd = () => {
    setF({ username: "", name: "", role: "employee", workshopId: db.workshops[0]?.id || "", positionId: "", payMode: "hour", rate: "", shiftCost: "", password: "" });
    setModal({});
  };
  const applyPosition = (pid: string) => {
    const p = db.positions.find((x) => x.id === pid);
    setF((prev) => ({ ...prev, positionId: pid, payMode: p?.defPay || prev.payMode, rate: p ? String(p.rate) : prev.rate, shiftCost: p ? String(p.shiftCost) : prev.shiftCost }));
  };
  const save = () => {
    if (modal?.edit) {
      const r = updateUser(modal.edit.id, {
        username: f.username, name: f.name, role: f.role, workshopId: f.workshopId || null, positionId: f.positionId || null,
        payMode: f.payMode, rate: Number(f.rate) || 0, shiftCost: Number(f.shiftCost) || 0, password: f.password,
      });
      toast(r || "Сотрудник сохранён", r ? "bad" : "ok");
    } else {
      const r = addUser({
        username: f.username, name: f.name, role: f.role, workshopId: f.workshopId || null, positionId: f.positionId || null,
        payMode: f.payMode, rate: Number(f.rate) || 0, shiftCost: Number(f.shiftCost) || 0, password: f.password,
        color: AV_COLORS[db.users.length % AV_COLORS.length], bio: "", active: true,
      });
      toast(r || "Сотрудник создан — пароль не обязателен, поставит сам", r ? "bad" : "ok");
    }
    if (!modal?.edit || !del) setModal(null);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn btn-pri" onClick={openAdd}><I n="plus" size={16} />Создать сотрудника</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const rows = await parseEmployeesFile(file);
            let ok = 0, err = 0;
            for (const r of rows) {
              const res = addUser({
                username: r.username!, name: r.name!, role: "employee", workshopId: db.workshops[0]?.id || null, positionId: null,
                payMode: "hour", rate: r.rate || 0, shiftCost: 0, password: "", color: AV_COLORS[(db.users.length + ok) % AV_COLORS.length], bio: "", active: true,
              });
              res ? err++ : ok++;
            }
            toast(`Импорт: создано ${ok}, ошибок ${err}`, err ? "bad" : "ok");
          } catch { toast("Не удалось прочитать файл", "bad"); }
        }} />
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><I n="xls" size={16} />Импорт из Excel</button>
        <span className="text-[12px] font-bold text-mute ml-auto">Всего: {db.users.filter((u) => u.role !== "superadmin").length} · активных: {db.users.filter((u) => u.active).length}</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl min-w-[860px]">
          <thead><tr><th>Сотрудник</th><th>Логин</th><th>Роль</th><th>Цех</th><th>Должность</th><th>Оплата</th><th>Пароль</th><th>Активен</th><th></th></tr></thead>
          <tbody>
            {db.users.filter((u) => !u.archived).map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td><span className="flex items-center gap-2.5"><Avatar u={u} size={30} /><b className="whitespace-nowrap">{u.name}</b></span></td>
                <td className="font-mono text-[12px]">@{u.username}</td>
                <td><RoleBadge role={u.role} /></td>
                <td>
                  <select className="input !h-8 !w-40 !text-[12px]" value={u.workshopId || ""} onChange={(e) => updateUser(u.id, { workshopId: e.target.value || null })} disabled={u.role === "superadmin"}>
                    <option value="">—</option>
                    {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </td>
                <td>
                  <select className="input !h-8 !w-40 !text-[12px]" value={u.positionId || ""} onChange={(e) => updateUser(u.id, { positionId: e.target.value || null })} disabled={u.role === "superadmin"}>
                    <option value="">—</option>
                    {db.positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td>
                  <span className="badge bg-paper text-ink">{PAY_LABEL[u.payMode]}</span>
                  <span className="text-[11px] font-bold text-mute ml-1.5">{u.payMode === "hour" ? `${u.rate} ₽/ч` : u.payMode === "shift" ? `${fmtMoney(u.shiftCost)}/см` : "выработка"}</span>
                </td>
                <td>{u.password ? <span className="badge bg-ok-soft text-ok"><I n="lock" size={11} />есть</span> : <span className="badge bg-warn-soft text-warn">без пароля</span>}</td>
                <td>
                  <button className={`btn btn-sm ${u.active ? "btn-ok" : "btn-ghost"}`} onClick={() => { updateUser(u.id, { active: !u.active }); toast(u.active ? `${u.name} отключён` : `${u.name} включён`, "ok"); }} disabled={u.role === "superadmin"}>
                    {u.active ? "Да" : "Нет"}
                  </button>
                </td>
                <td>
                  <span className="flex gap-1">
                    <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:bg-paper hover:text-ink transition" title="Досье и живой график" onClick={() => setDossier(u)}><I n="chart" size={14} /></button>
                    <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:bg-warn-soft hover:text-warn transition" title="Штрафы и балльные оценки" onClick={() => setHrFor(u)}><I n="star" size={14} /></button>
                    <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:bg-paper hover:text-ink transition" title="Редактировать" onClick={() => {
                      setF({ username: u.username, name: u.name, role: u.role, workshopId: u.workshopId || "", positionId: u.positionId || "", payMode: u.payMode, rate: String(u.rate || ""), shiftCost: String(u.shiftCost || ""), password: u.password });
                      setModal({ edit: u });
                    }}><I n="edit" size={14} /></button>
                    {u.role !== "superadmin" && (
                      <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition" title="Уволить → в архив (30 дней на восстановление)" onClick={() => { setDel(u); setArchReason(""); setArchTone("neutral"); setArchNote(""); }}><I n="layers" size={14} /></button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? `Редактирование: ${modal.edit.name}` : "Новый сотрудник"} w="max-w-xl"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setModal(null)}>Отмена</button>
          <button className="btn btn-pri" onClick={save}><I n="check" size={15} />Сохранить</button>
        </>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Логин" hint="Короткий, для входа и Excel"><input className="input font-mono" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="ivan" /></Field>
          <Field label="ФИО"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Иванов Иван" /></Field>
          <Field label="Роль">
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} disabled={modal?.edit?.id === "u-root"}>
              <option value="employee">Сотрудник</option>
              <option value="admin">Админ</option>
              {me?.role === "superadmin" && <option value="superadmin">Суперадмин</option>}
            </select>
          </Field>
          <Field label="Пароль" hint="Пусто = вход без пароля (поставит сам)"><input className="input font-mono" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="—" /></Field>
          <Field label="Цех">
            <select className="input" value={f.workshopId} onChange={(e) => setF({ ...f, workshopId: e.target.value })}>
              <option value="">Без цеха</option>
              {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}{w.piecework ? " · сдельный" : ""}</option>)}
            </select>
          </Field>
          <Field label="Должность" hint="Подставит оплату и норму">
            <select className="input" value={f.positionId} onChange={(e) => applyPosition(e.target.value)}>
              <option value="">Без должности</option>
              {db.positions.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.normH} ч</option>)}
            </select>
          </Field>
          <Field label="Тип оплаты">
            <select className="input" value={f.payMode} onChange={(e) => setF({ ...f, payMode: e.target.value as PayMode })}>
              <option value="hour">Почасовая</option><option value="shift">Посменная (часы учитываются, платим за смену)</option><option value="piece">Сдельная (по выработке)</option>
            </select>
          </Field>
          {f.payMode === "hour" && <Field label="Ставка ₽/час"><input type="number" className="input tnum" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>}
          {f.payMode === "shift" && <Field label="Стоимость смены ₽"><input type="number" className="input tnum" value={f.shiftCost} onChange={(e) => setF({ ...f, shiftCost: e.target.value })} /></Field>}
          {f.payMode === "piece" && <p className="text-[12px] font-bold text-mute bg-paper border border-line rounded-lg p-3 self-end">Оплата = Σ объём × цена позиции из справочника. Часы учёта сохраняются для статистики.</p>}
        </div>
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title={`Увольнение: ${del?.name || ""}`} w="max-w-md"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setDel(null)}>Отмена</button>
          <button className="btn btn-bad" onClick={() => {
            if (!del) return;
            if (!archReason.trim()) { toast("Укажите причину увольнения", "bad"); return; }
            const r = archiveUser(del.id, archReason.trim(), archTone, archNote.trim());
            toast(r || `${del.name} перемещён в архив (30 дней на восстановление)`, r ? "bad" : "ok");
            setDel(null);
          }}><I n="layers" size={15} />В архив</button>
        </>}>
        <div className="grid gap-4">
          <p className="text-[12.5px] text-mute font-bold leading-relaxed">Сотрудник попадает в архив с причиной, оценкой и характеристикой. Полное удаление — только суперадмином через 30 дней. История работы (часы, смены, выплаты, оценки) сохраняется навсегда.</p>
          <Field label="Причина увольнения / удаления"><input className="input" value={archReason} onChange={(e) => setArchReason(e.target.value)} placeholder="Собственное желание / сокращение / нарушение…" /></Field>
          <Field label="Оценка сотрудника" hint="Определяет подсветку в архиве">
            <div className="flex gap-1.5 flex-wrap">
              <button className={`chip ${archTone === "pos" ? "!border-ok !text-ok !bg-ok-soft" : ""}`} onClick={() => setArchTone("pos")}><I n="check" size={12} />Положительная (зелёная)</button>
              <button className={`chip ${archTone === "neutral" ? "!border-ink" : ""}`} onClick={() => setArchTone("neutral")}>Нейтральная</button>
              <button className={`chip ${archTone === "neg" ? "!border-bad !text-bad !bg-bad-soft" : ""}`} onClick={() => setArchTone("neg")}><I n="x" size={12} />Отрицательная (красная)</button>
            </div>
          </Field>
          <Field label="Характеристика"><textarea className="input" rows={3} value={archNote} onChange={(e) => setArchNote(e.target.value)} placeholder="Краткая характеристика для архива…" /></Field>
        </div>
      </Modal>

      <Modal open={!!hrFor} onClose={() => setHrFor(null)} w="max-w-xl"
        title={<span className="flex items-center gap-2"><Avatar u={hrFor} size={24} />Штрафы и оценки: {hrFor?.name}</span>}
        foot={<button className="btn btn-ghost" onClick={() => setHrFor(null)}>Закрыть</button>}>
        {hrFor && (
          <div className="grid gap-5">
            <div>
              <h4 className="lbl">Штрафы (вычитаются из расчёта)</h4>
              <FinePanel userId={hrFor.id} />
            </div>
            <div>
              <h4 className="lbl">Балльная оценка за месяц (0–100)</h4>
              <RatingPanel userId={hrFor.id} />
            </div>
          </div>
        )}
      </Modal>

      {dossier && <DossierModal user={dossier} onClose={() => setDossier(null)} />}
    </div>
  );
}

// ================= РЕДАКТОР ГРАФИКА =================
export function ScheduleEditor() {
  const { db, setShift, fillPattern, publishSchedule, importSchedule } = useStore();
  const { toast } = useToast();
  const tk = todayKey();
  const [mk, setMk] = useState(tk.slice(0, 7));
  const [uid2, setUid2] = useState(db.users.find((u) => u.role === "employee")?.id || "");
  const [comment, setComment] = useState("");
  const [pat, setPat] = useState<"5/2" | "2/2" | "3/3" | "clear">("5/2");
  const [night, setNight] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const emps = db.users.filter((u) => u.role === "employee" && u.active);
  const dim = daysInMonth(mk + "-01");
  const keys = rangeKeys(mk + "-01", `${mk}-${String(dim).padStart(2, "0")}`);
  const weeks: string[][] = [];
  for (let i = 0; i < keys.length; i += 7) weeks.push(keys.slice(i, i + 7));

  const nextType = (cur: ShiftType | undefined): ShiftType | null => {
    const order: (ShiftType | null)[] = ["day", "night", "off", "vacation", "sick", null];
    return order[(order.indexOf(cur || null) + 1) % order.length];
  };

  return (
    <div className="grid gap-4">
      <div className="card p-4 grid gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftM(mk, -1))}><I n="chevL" size={14} /></button>
          <b className="font-display text-sm w-36 text-center">{monthTitle(mk + "-01")}</b>
          <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftM(mk, 1))}><I n="chevR" size={14} /></button>
          <select className="input !w-56 !h-9" value={uid2} onChange={(e) => setUid2(e.target.value)}>
            {emps.map((u) => <option key={u.id} value={u.id}>{u.name} · {wsName(db, u.workshopId)}</option>)}
          </select>
          <input className="input !h-9 !w-64" placeholder="Комментарий к изменениям (увидит сотрудник)" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Seg small opts={[{ v: "5/2", label: "5/2" }, { v: "2/2", label: "2/2" }, { v: "3/3", label: "3/3" }, { v: "clear", label: "Очистить" }]} val={pat} onChange={setPat} />
          <button className={`btn btn-sm ${night ? "btn-dark" : "btn-ghost"}`} onClick={() => setNight(!night)}><I n="moon" size={13} />{night ? "Ночные" : "Дневные"}</button>
          <button className="btn btn-soft btn-sm" onClick={() => { fillPattern(uid2, mk + "-01", pat, night, comment.trim()); toast(`Шаблон «${pat}» применён`, "ok"); }}><I n="zap" size={13} />Заполнить месяц</button>
          <span className="mx-1 h-5 w-px bg-line" />
          <button className="btn btn-ghost btn-sm" onClick={() => { scheduleTemplate(db, mk + "-01"); toast("Шаблон Excel сохранён", "ok"); }}><I n="xls" size={13} />Шаблон</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const cells = await parseScheduleFile(file, mk + "-01");
              const res = importSchedule(cells, comment.trim());
              toast(`Импортировано ячеек: ${res.ok}${res.missing.length ? `, неизвестные логины: ${res.missing.join(", ")}` : ""}`, res.missing.length ? "bad" : "ok");
            } catch { toast("Не удалось прочитать файл", "bad"); }
          }} />
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><I n="upload" size={13} />Импорт</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { exportScheduleMonth(db, mk + "-01"); toast("График выгружен в Excel", "ok"); }}><I n="download" size={13} />Excel</button>
          <button className="btn btn-pri btn-sm ml-auto" onClick={() => { publishSchedule(mk + "-01"); toast("График опубликован — сотрудники уведомлены", "ok"); }}><I n="send" size={13} />Опубликовать</button>
        </div>
      </div>

      <div className="card p-4 overflow-x-auto">
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {Object.entries(SHIFT_META).map(([k, m]) => <span key={k} className={`badge ${m.cls}`}>{m.code} — {m.label}</span>)}
          <span className="text-[11px] font-bold text-mute ml-auto self-center">клик по ячейке переключает тип · изменения попадают в журнал и уведомления</span>
        </div>
        {emps.length === 0 ? <Empty icon="users" title="Нет сотрудников" text="Создайте сотрудников, чтобы строить график." /> : (
          <div className="min-w-[720px] grid gap-4">
            {weeks.map((wk, wi) => (
              <div key={wi}>
                <div className="grid gap-1" style={{ gridTemplateColumns: "170px repeat(7, 1fr)" }}>
                  <span />
                  {wk.map((k) => (
                    <div key={k} className={`text-center rounded-md py-1 text-[10.5px] font-extrabold ${isWeekend(k) ? "text-accent-deep" : "text-mute"} ${k === tk ? "bg-accent-soft" : ""}`}>
                      {WD[weekdayIdx(k)]} {Number(k.slice(8))}
                    </div>
                  ))}
                  <span className="text-[12px] font-bold truncate pr-2 self-center">{emps.find((u) => u.id === uid2)?.name.split(" ")[0]}</span>
                  {wk.map((k) => {
                    const c = db.schedule.find((s) => s.userId === uid2 && s.date === k);
                    return (
                      <button key={k} onClick={() => setShift(uid2, k, nextType(c?.type), comment.trim())}
                        className={`h-10 rounded-lg border text-[12px] font-extrabold transition-all active:scale-95 hover:shadow
                        ${c ? `${SHIFT_META[c.type].cls} border-transparent` : "border-dashed border-line text-line hover:border-steel-400"}`}>
                        {c ? SHIFT_META[c.type].code : "+"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t border-line pt-3">
              <b className="text-[12px] font-extrabold uppercase text-mute">Весь персонал — сводка по {monthTitle(mk + "-01")}</b>
              <div className="grid gap-1 mt-2">
                {emps.map((u) => {
                  const plan = keys.reduce((s, k) => s + (db.schedule.find((x) => x.userId === u.id && x.date === k)?.type === "day" ? 8 : db.schedule.find((x) => x.userId === u.id && x.date === k)?.type === "night" ? 11.5 : 0), 0);
                  const cnt = keys.filter((k) => ["day", "night"].includes(db.schedule.find((x) => x.userId === u.id && x.date === k)?.type || "")).length;
                  return (
                    <div key={u.id} className="flex items-center gap-2 text-[12px]">
                      <Avatar u={u} size={22} /><span className="font-bold w-40 truncate">{u.name}</span>
                      <span className="badge bg-paper text-mute">{cnt} смен</span>
                      <span className="badge bg-night-soft text-night">план {hDec(plan * 60)} ч</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function shiftM(mk: string, n: number): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- лучший сотрудник ----------
function BestStrip() {
  const { db, setSettings } = useStore();
  const { toast } = useToast();
  const [pick, setPick] = useState(false);
  const s = db.settings;
  const best = s.bestUserId ? userById(db, s.bestUserId) : null;
  if (!s.bestOn && !best) return null;
  const emps = db.users.filter((u) => u.role === "employee" && u.active && !u.archived);
  return (
    <div className="card !border-accent/50 p-4 flex items-center gap-3 flex-wrap anim-rise" style={{ background: "linear-gradient(100deg,#fbeadb 0%,#fff 55%)" }}>
      <span className="w-10 h-10 rounded-xl bg-accent text-white grid place-items-center shrink-0"><I n="star" size={19} /></span>
      <div className="min-w-0 flex-1">
        <b className="text-sm block font-display">Сотрудник месяца</b>
        {best ? (
          <span className="text-[12.5px] font-bold text-mute flex items-center gap-2 mt-0.5"><Avatar u={best} size={22} />{best.name} · {wsName(db, best.workshopId)}</span>
        ) : (
          <span className="text-[12.5px] font-bold text-mute">Не назначен — отметьте лучшего, это видно всей команде (можно и не ставить).</span>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-soft btn-sm" onClick={() => setPick(true)}><I n="star" size={13} />{best ? "Изменить" : "Назначить"}</button>
        {best && <button className="btn btn-ghost btn-sm" onClick={() => { setSettings({ bestUserId: null }); toast("Бейдж снят"); }}>Снять</button>}
        <button className={`btn btn-ghost btn-sm ${s.bestOn ? "" : "!text-mute"}`} onClick={() => setSettings({ bestOn: !s.bestOn })} title="Показывать/скрыть бейдж на стене и в дашборде">
          <I n="eye" size={13} />{s.bestOn ? "Виден" : "Скрыт"}
        </button>
      </div>
      <Modal open={pick} onClose={() => setPick(false)} title="Сотрудник месяца" w="max-w-sm"
        foot={<button className="btn btn-ghost" onClick={() => setPick(false)}>Закрыть</button>}>
        <div className="grid gap-1.5">
          {emps.map((u) => (
            <button key={u.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition hover:border-accent ${s.bestUserId === u.id ? "!border-accent bg-accent-soft" : "border-line"}`}
              onClick={() => { setSettings({ bestUserId: u.id }); setPick(false); toast(`${u.name} — сотрудник месяца`, "ok"); }}>
              <Avatar u={u} size={32} />
              <span className="min-w-0"><b className="text-[13px] block truncate">{u.name}</b><span className="text-[11px] text-mute font-bold">{wsName(db, u.workshopId)}</span></span>
              {s.bestUserId === u.id && <I n="check" size={16} className="ml-auto text-accent-deep" />}
            </button>
          ))}
          {emps.length === 0 && <p className="text-[12.5px] font-bold text-mute text-center py-4">Нет активных сотрудников.</p>}
        </div>
      </Modal>
    </div>
  );
}

export { summarizeAll, addDaysKey, fmtDateFull };
