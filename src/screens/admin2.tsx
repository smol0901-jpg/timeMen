import React, { useMemo, useRef, useState } from "react";
import { useStore, summarizeAll, userById } from "../lib/store";
import { MODULES, ModuleId, Role, ROLE_LABEL } from "../lib/types";
import {
  todayKey, monthStart, monthEnd, monthTitle, fmtDateFull, fmtMoney, fmtDurH,
  relTime, hDec, fileSize, fmtDate,
} from "../lib/time";
import { I, Avatar, useToast, Seg, Field, Empty, Confirm, RoleBadge } from "../components/ui";
import { exportPayroll, templateSchedule, templateEmployees, parseScheduleFile, parseEmployeesFile, exportJson, parseJsonFile } from "../lib/excel";
import { printPayrollReport } from "../lib/report";
import { DB } from "../lib/types";

// ================= ЗАЯВКИ (админ) =================
export function RequestsAdminView() {
  const { db, me, decideRequest } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState<"pending" | "done" | "all">("pending");
  const [deptF, setDeptF] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const depts = [...new Set(db.users.filter((u) => u.role === "employee").map((u) => u.dept))];

  const list = db.requests
    .filter((r) => (f === "all" ? true : f === "pending" ? r.status === "pending" : r.status !== "pending"))
    .filter((r) => !deptF || userById(db, r.userId)?.dept === deptF)
    .sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.createdAt.localeCompare(a.createdAt));

  const KIND: Record<string, [string, string]> = { swap: ["Замена дня", "swap"], vacation: ["Отпуск", "sun"], extra: ["Доп. смена", "plus"] };

  return (
    <div className="grid gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Seg opts={[{ v: "pending", l: `Ожидают (${db.requests.filter((r) => r.status === "pending").length})` }, { v: "done", l: "Обработанные" }, { v: "all", l: "Все" }]} val={f} onChange={setF} />
        <select className="input !w-44 !h-9" value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="">Все цеха</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <p className="ml-auto text-xs font-bold text-mute hidden md:block">Одобрение автоматически правит график сотрудника</p>
      </div>

      {list.length === 0 ? <div className="card"><Empty icon="check" text="Заявок в этом фильтре нет" /></div> : (
        <div className="grid md:grid-cols-2 gap-3.5">
          {list.map((r) => {
            const u = userById(db, r.userId);
            const dec = r.decidedBy ? userById(db, r.decidedBy) : null;
            const target = r.targetUserId ? userById(db, r.targetUserId) : null;
            const st = r.status === "pending" ? ["ожидает", "bg-warn-soft text-warn"] : r.status === "approved" ? ["одобрена", "bg-ok-soft text-ok"] : ["отклонена", "bg-bad-soft text-bad"];
            return (
              <div key={r.id} className={`card p-4 ${r.status === "pending" ? "!border-warn/40" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <Avatar u={u} size={38} />
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{u?.name} <span className="text-mute font-bold text-xs">· {u?.dept}</span></div>
                    <div className="text-[11px] text-mute font-bold">{relTime(r.createdAt)}</div>
                  </div>
                  <span className={`badge ml-auto ${st[1]}`}>{st[0]}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="badge bg-steel-900 text-paper"><I n={KIND[r.kind][1]} size={11} />{KIND[r.kind][0]}</span>
                  <span className="text-xs font-bold">{fmtDateFull(r.date)}{r.dateEnd ? ` — ${fmtDateFull(r.dateEnd)}` : ""}</span>
                  {target && <span className="text-xs font-bold text-mute">подменяет: {target.name}</span>}
                </div>
                {r.note && <p className="text-sm text-mute font-semibold mt-2 bg-paper rounded-lg p-2.5">«{r.note}»</p>}
                {r.status === "pending" ? (
                  <>
                    <input className="input !h-9 mt-3 text-xs" placeholder="Комментарий к решению (необязательно)"
                      value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                    <div className="flex gap-2 mt-2.5">
                      <button className="btn btn-ok flex-1" onClick={() => { decideRequest(r.id, true, notes[r.id] || ""); toast("Одобрено — график и уведомления обновлены", "ok"); }}><I n="check" size={15} />Одобрить</button>
                      <button className="btn btn-bad flex-1" onClick={() => { decideRequest(r.id, false, notes[r.id] || ""); toast("Заявка отклонена", "bad"); }}><I n="x" size={15} />Отклонить</button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs font-bold mt-3 text-mute">Решение: {dec?.name || "—"} · <span className={r.status === "approved" ? "text-ok" : "text-bad"}>{r.decisionNote}</span></p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================= ОТЧЁТЫ =================
export function ReportsView() {
  const { db } = useStore();
  const { toast } = useToast();
  const tk = todayKey();
  const [mode, setMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState(tk.slice(0, 7));
  const [from, setFrom] = useState(monthStart(tk));
  const [to, setTo] = useState(monthEnd(tk));
  const [deptF, setDeptF] = useState("");

  const bf = mode === "month" ? monthStart(month + "-01") : from;
  const bt = mode === "month" ? monthEnd(month + "-01") : to;
  const label = mode === "month" ? monthTitle(month + "-01") : `${fmtDateFull(bf)} — ${fmtDateFull(bt)}`;
  const rows = useMemo(() => summarizeAll(db, bf, bt, deptF || undefined), [db, bf, bt, deptF]);
  const depts = [...new Set(db.users.filter((u) => u.role === "employee").map((u) => u.dept))];
  const tot = rows.reduce((t, r) => ({ p: t.p + r.planMin, f: t.f + r.factMin, o: t.o + r.otMin, s: t.s + r.shortMin, m: t.m + r.salary }), { p: 0, f: 0, o: 0, s: 0, m: 0 });

  return (
    <div className="grid gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Seg opts={[{ v: "month", l: "Месяц" }, { v: "range", l: "Произвольный период" }]} val={mode} onChange={setMode} />
        {mode === "month" ? (
          <input type="month" className="input !w-44 !h-9" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        ) : (
          <div className="flex items-center gap-2">
            <input type="date" className="input !w-40 !h-9" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-mute font-bold text-sm">—</span>
            <input type="date" className="input !w-40 !h-9" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <select className="input !w-44 !h-9" value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="">Все цеха</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => { exportPayroll(rows, label, db.settings.orgName); toast("Excel для бухгалтерии сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
          <button className="btn btn-dark btn-sm" onClick={() => { printPayrollReport(rows, label, db.settings); toast("Открываю бланк — в диалоге выберите «Сохранить как PDF»", "ok"); }}><I n="pdf" size={14} />PDF-бланк</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Начислено всего", fmtMoney(tot.m), "money", "text-night"],
          ["Факт часов", fmtDurH(tot.f), "clock", "text-accent-deep"],
          ["Переработка", fmtDurH(tot.o), "timer", "text-ok"],
          ["Недоработка", fmtDurH(tot.s), "warn", "text-bad"],
        ].map(([l, v, ic, c]) => (
          <div key={l as string} className="card p-4">
            <div className={`w-8 h-8 rounded-lg bg-paper grid place-items-center ${c}`}><I n={ic as string} size={15} /></div>
            <div className="font-display text-lg font-bold mt-2 tnum">{v}</div>
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-mute">{l}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">Сводный табель · {label}</h3>
          <span className="text-xs font-bold text-mute">{rows.length} сотрудников · переработка ×{String(db.settings.overtimeK).replace(".", ",")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[860px]">
            <thead><tr><th>№</th><th>ФИО</th><th>Цех</th><th>Дней</th><th>Норма</th><th>Факт</th><th>Перераб.</th><th>Недораб.</th><th>Опозд.</th><th>Ставка</th><th className="!text-right">Начислено</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.user.id}>
                  <td className="text-mute tnum">{i + 1}</td>
                  <td><div className="flex items-center gap-2.5"><Avatar u={r.user} size={28} /><b>{r.user.name}</b></div></td>
                  <td className="text-xs font-bold">{r.user.dept}</td>
                  <td className="tnum">{r.days}</td>
                  <td className="tnum">{hDec(r.planMin)}</td>
                  <td className="tnum font-bold">{hDec(r.factMin)}</td>
                  <td className="tnum text-ok font-bold">{r.otMin ? "+" + hDec(r.otMin) : "—"}</td>
                  <td className="tnum text-bad font-bold">{r.shortMin ? "−" + hDec(r.shortMin) : "—"}</td>
                  <td className="tnum">{r.late || "—"}</td>
                  <td className="tnum">{r.user.rate}</td>
                  <td className="!text-right font-bold tnum">{fmtMoney(r.salary)}</td>
                </tr>
              ))}
              <tr className="!bg-paper font-bold">
                <td></td><td>ИТОГО</td><td></td><td></td>
                <td className="tnum">{hDec(tot.p)}</td><td className="tnum">{hDec(tot.f)}</td>
                <td className="tnum text-ok">+{hDec(tot.o)}</td><td className="tnum text-bad">−{hDec(tot.s)}</td>
                <td></td><td></td><td className="!text-right tnum">{fmtMoney(tot.m)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] font-bold text-mute flex items-center gap-1.5"><I n="info" size={13} />PDF открывается на официальном бланке (форма Т-13, упрощённая) с шапкой организации, подписями и местом печати — в диалоге печати выберите «Сохранить как PDF».</p>
    </div>
  );
}

// ================= ПРАВА ДОСТУПА =================
export function PermissionsView() {
  const { db, me, setPerm } = useStore();
  const { toast } = useToast();
  const isSuper = me?.role === "superadmin";
  const lockedForAdmin: ModuleId[] = ["permissions", "audit"];

  return (
    <div className="grid gap-4">
      <div className="card p-4 flex items-start gap-3 !border-night/30">
        <div className="w-9 h-9 rounded-lg bg-night-soft text-night grid place-items-center shrink-0"><I n="shield" size={17} /></div>
        <div className="text-sm font-semibold text-mute leading-relaxed">
          Матрица «модуль × роль × устройство» решает, что видит суперадмин, админ и сотрудник — отдельно на <b className="text-ink">ПК (админка)</b> и на <b className="text-ink">телефоне/планшете (PWA)</b>. Изменения применяются мгновенно для всех устройств в сети.
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl min-w-[680px]">
            <thead>
              <tr>
                <th rowSpan={2} className="align-bottom">Модуль</th>
                <th colSpan={2} className="!text-center !bg-paper">Сотрудник</th>
                <th colSpan={2} className="!text-center !bg-night-soft/60">Админ</th>
                <th colSpan={2} className="!text-center !bg-accent-soft/60">Суперадмин</th>
              </tr>
              <tr>
                {["ПК", "PWA", "ПК", "PWA", "ПК", "PWA"].map((h, i) => <th key={i} className="!text-center">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <React.Fragment key={m.id}>
                  {m.group === "admin" && (
                    <tr><td colSpan={7} className="!bg-steel-900 !text-paper !text-[10px] !font-extrabold uppercase tracking-[0.14em] !py-1.5">Управление</td></tr>
                  )}
                  <tr>
                    <td><span className="flex items-center gap-2 font-bold text-sm"><I n={m.icon} size={15} />{m.label}</span></td>
                    {(["employee", "admin", "superadmin"] as Role[]).map((role) =>
                      (["desktop", "mobile"] as const).map((dev) => {
                        const val = db.perms[m.id]?.[role]?.[dev] ?? role === "superadmin";
                        const locked = role === "superadmin" || (!isSuper && lockedForAdmin.includes(m.id));
                        return (
                          <td key={role + dev} className="!text-center">
                            <button
                              disabled={locked}
                              onClick={() => { setPerm(m.id, role, dev, !val); toast(`${m.label}: ${ROLE_LABEL[role]} / ${dev === "desktop" ? "ПК" : "PWA"} — ${!val ? "открыто" : "скрыто"}`); }}
                              className={`w-9 h-7 rounded-md border transition-all cursor-pointer active:scale-90 disabled:cursor-not-allowed
                                ${val ? "bg-ok border-ok text-white" : "bg-paper border-line text-line"} ${locked ? "opacity-60" : "hover:scale-105"}`}>
                              <I n={val ? "check" : "x"} size={13} />
                            </button>
                          </td>
                        );
                      })
                    )}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] font-bold text-mute flex items-center gap-1.5"><I n="star" size={13} />Суперадмин всегда имеет доступ ко всем модулям на любых устройствах — его строка зафиксирована. Раздел «{lockedForAdmin.map((m) => MODULES.find((x) => x.id === m)?.label).join("», «")}» редактирует только суперадмин.</p>
    </div>
  );
}

// ================= ДАННЫЕ / EXCEL =================
export function DataIOView() {
  const { db, me, importSchedule, importAll, resetDemo, addUser } = useStore();
  const { toast } = useToast();
  const [reset, setReset] = useState(false);
  const schedRef = useRef<HTMLInputElement>(null);
  const empRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const size = fileSize(JSON.stringify(db).length);

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2"><I n="cal" size={16} />График из Excel</h3>
        <p className="text-xs font-semibold text-mute mt-2 leading-relaxed">Скачайте шаблон, заполните (дата · логин · тип Я/Н/В/О/Б) и загрузите обратно — ячейки графика проставятся автоматически.</p>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-ghost btn-sm flex-1" onClick={() => templateSchedule(todayKey())}><I n="dl" size={14} />Шаблон</button>
          <button className="btn btn-pri btn-sm flex-1" onClick={() => schedRef.current?.click()}><I n="ul" size={14} />Загрузить</button>
          <input ref={schedRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try {
              const { cells, errors } = await parseScheduleFile(f);
              const res = importSchedule(cells);
              toast(`Импортировано ${res.ok} ячеек${res.missing.length ? `; неизвестные логины: ${res.missing.join(", ")}` : ""}`, res.missing.length ? "bad" : "ok");
              if (errors.length) console.info("Ошибки строк:", errors);
            } catch { toast("Не удалось прочитать файл", "bad"); }
          }} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2"><I n="users" size={16} />Сотрудники из Excel</h3>
        <p className="text-xs font-semibold text-mute mt-2 leading-relaxed">Массовое создание персонала из шаблона: ФИО, логин, пароль, роль, цех, ставка.</p>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-ghost btn-sm flex-1" onClick={() => templateEmployees()}><I n="dl" size={14} />Шаблон</button>
          <button className="btn btn-pri btn-sm flex-1" onClick={() => empRef.current?.click()}><I n="ul" size={14} />Загрузить</button>
          <input ref={empRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try {
              const { rows, errors } = await parseEmployeesFile(f);
              let ok = 0, fail = 0;
              const colors = ["#e56f24", "#3f6d9e", "#17875c", "#8a5aa0", "#b0567b", "#4d8a9c"];
              for (const r of rows) {
                const err = addUser({ name: r.name, username: r.username, password: r.password, role: r.role === "admin" ? "admin" : "employee", dept: r.dept, rate: r.rate, bio: r.bio, active: true, color: colors[(ok + rows.length) % colors.length] });
                err ? fail++ : ok++;
              }
              toast(`Создано ${ok} сотрудников${fail ? `, пропущено ${fail}` : ""}${errors.length ? `; ${errors[0]}` : ""}`, fail ? "bad" : "ok");
            } catch { toast("Не удалось прочитать файл", "bad"); }
          }} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2"><I n="json" size={16} />Резервная копия (JSON)</h3>
        <p className="text-xs font-semibold text-mute mt-2 leading-relaxed">Полная выгрузка базы: персонал, табель, график, заявки, лента, права. Подходит для переноса на другой сервер и расчёта зарплаты внешними инструментами.</p>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-ghost btn-sm flex-1" onClick={() => { exportJson(db); toast("Резервная копия сохранена", "ok"); }}><I n="dl" size={14} />Выгрузить</button>
          <button className="btn btn-dark btn-sm flex-1" onClick={() => jsonRef.current?.click()}><I n="ul" size={14} />Восстановить</button>
          <input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try {
              const err = importAll(await parseJsonFile(f));
              err ? toast(err, "bad") : toast("База восстановлена из копии", "ok");
            } catch { toast("Файл повреждён", "bad"); }
          }} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2"><I n="wifi" size={16} />Развёртывание в LAN</h3>
        <ol className="text-xs font-semibold text-mute mt-2 leading-relaxed list-decimal list-inside grid gap-1.5">
          <li><b className="text-ink">npm run build</b> — сборка сервера</li>
          <li>Раздайте папку <b className="text-ink">dist</b> любым статик-сервером: <span className="font-mono bg-paper px-1.5 py-0.5 rounded">npx serve dist</span></li>
          <li>Узнайте IP хоста (<span className="font-mono bg-paper px-1.5 py-0.5 rounded">ipconfig</span>) — например 192.168.1.7</li>
          <li>Все устройства в той же Wi-Fi сети открывают <b className="text-ink">http://192.168.1.7:3000</b></li>
          <li>Телефоны: «Установить приложение» → PWA-иконка на рабочем столе</li>
        </ol>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2"><I n="chart" size={16} />Состояние базы</h3>
        <div className="grid grid-cols-2 gap-2.5 mt-3 text-sm font-bold">
          {[
            ["Объём", size], ["Сотрудников", db.users.length],
            ["Отметок", db.punches.length], ["Ячеек графика", db.schedule.length],
            ["Заявок", db.requests.length], ["Записей ленты", db.posts.length],
          ].map(([k, v]) => (
            <div key={k} className="bg-paper rounded-xl p-3">
              <div className="lbl !mb-0.5">{k}</div>
              <div className="tnum">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {me?.role === "superadmin" && (
        <div className="card p-5 !border-bad/30">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2 text-bad"><I n="warn" size={16} />Опасная зона</h3>
          <p className="text-xs font-semibold text-mute mt-2 leading-relaxed">Полный сброс к демо-данным: текущая база будет заменена. Перед сбросом сделайте резервную копию.</p>
          <button className="btn btn-bad btn-sm mt-4" onClick={() => setReset(true)}><I n="refresh" size={14} />Сбросить к демо-данным</button>
        </div>
      )}

      <Confirm open={reset} onClose={() => setReset(false)} title="Сбросить всю базу?" yes="Сбросить"
        text="Все пользователи, отметки, графики и заявки будут заменены демо-данными. Отмены нет."
        onYes={() => { resetDemo(); toast("База сброшена к демо-данным", "ok"); }} />
    </div>
  );
}

// ================= АУДИТ =================
export function AuditView() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const list = db.audit.filter((a) => !q || (a.actor + a.action + a.details).toLowerCase().includes(q.toLowerCase()));
  const tones: Record<string, string> = {
    "Отметка": "bg-ok-soft text-ok", "Заявка": "bg-warn-soft text-warn", "График": "bg-night-soft text-night",
    "Сотрудники": "bg-accent-soft text-accent-deep", "Вход": "bg-paper text-mute", "Система": "bg-bad-soft text-bad",
  };
  return (
    <div className="grid gap-4">
      <div className="card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <I n="search" size={15} />
          <input className="input !pl-9" placeholder="Фильтр: имя, действие…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <span className="text-xs font-bold text-mute ml-auto tnum">{list.length} записей · хранится 500 последних</span>
      </div>
      <div className="card overflow-hidden">
        {list.length === 0 ? <Empty icon="history" text="Ничего не найдено" /> : (
          <div className="max-h-[64vh] overflow-y-auto">
            <table className="tbl">
              <thead className="sticky top-0"><tr><th className="w-36">Когда</th><th className="w-44">Кто</th><th className="w-32">Действие</th><th>Детали</th></tr></thead>
              <tbody>
                {list.slice(0, 200).map((a) => (
                  <tr key={a.id}>
                    <td className="text-xs font-bold text-mute tnum whitespace-nowrap">{fmtDate(a.ts.slice(0, 10))} {a.ts.slice(11, 16)}</td>
                    <td className="font-bold text-xs">{a.actor}</td>
                    <td><span className={`badge ${tones[a.action] || "bg-paper text-mute"}`}>{a.action}</span></td>
                    <td className="text-xs font-semibold text-mute">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          <Field label="Норма часов в день"><input type="number" className="input tnum" value={s.dailyNorm} onChange={(e) => ch("dailyNorm", Number(e.target.value))} /></Field>
          <Field label="Обед, минут" hint="Вычитается из смен длиннее 6 ч"><input type="number" className="input tnum" value={s.breakMin} onChange={(e) => ch("breakMin", Number(e.target.value))} /></Field>
          <Field label="Коэффициент переработки" hint="1.5 = полуторная оплата"><input type="number" step="0.1" className="input tnum" value={s.overtimeK} onChange={(e) => ch("overtimeK", Number(e.target.value))} /></Field>
          <Field label="PIN служебного выхода" hint="Для выхода из режима терминала"><input className="input font-mono" value={s.adminPin} onChange={(e) => ch("adminPin", e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-3 mt-5 cursor-pointer select-none">
          <button className={`w-11 h-7 rounded-full transition-colors relative ${s.kioskFree ? "bg-ok" : "bg-steel-200"}`} onClick={(e) => { e.preventDefault(); ch("kioskFree", !s.kioskFree); }}>
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${s.kioskFree ? "left-[18px]" : "left-0.5"}`} />
          </button>
          <span className="text-sm font-bold">Терминал без пароля<span className="block text-[11px] text-mute font-semibold">отметка на киоске одним касанием</span></span>
        </label>
      </div>
      <div className="lg:col-span-2 card p-6 bg-steel-900 !border-steel-700 text-paper">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-accent grid place-items-center shrink-0"><I n="wifi" size={20} /></div>
          <div className="flex-1 min-w-[260px]">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              Локальный сервер (системный трей)
              <span className={`badge ${online ? "bg-ok text-white" : "bg-warn text-white"}`}>
                <span className={`w-1.5 h-1.5 rounded-full bg-white ${online ? "pulse-ok" : "blink"}`} />
                {online ? "онлайн · общая база" : "офлайн · локальный режим"}
              </span>
            </h3>
            <p className="text-[13px] text-steel-200 leading-relaxed mt-2 max-w-2xl">
              Порт, автозапуск и ссылка для сотрудников настраиваются в <b className="text-paper">иконке сервера в трее</b> (правый клик):
              копирование ссылки в один клик, QR-код для телефонов, список IP-адресов. Установка: папка <span className="font-mono text-accent">server</span> → <span className="font-mono text-accent">install.bat</span>.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[11.5px] font-bold text-steel-400">
              <span>база: server/data/db.json</span>
              <span>журнал: server/server.log</span>
              <span>резервная копия создаётся при каждом сохранении</span>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2 flex items-center justify-between card p-4">
        <p className="text-xs font-bold text-mute flex items-center gap-1.5"><I n="info" size={13} />Настройки применяются ко всем устройствам в сети сразу{saved && <span className="text-ok">· сохранено ✓</span>}</p>
        <button className="btn btn-pri" onClick={() => { setSettings(s); setSaved(true); toast("Настройки сохранены", "ok"); }}><I n="check" size={16} />Сохранить настройки</button>
      </div>
    </div>
  );
}

