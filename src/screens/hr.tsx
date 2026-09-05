import React, { useMemo, useState } from "react";
import { useStore, userById, punchDur, summarize } from "../lib/store";
import { User } from "../lib/types";
import { todayKey, fmtDateFull, fmtMoney, hDec, monthTitle, relTime, MONTHS_NOM } from "../lib/time";
import { I, Avatar, useToast, Modal, Field, Empty, Confirm, RoleBadge } from "../components/ui";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

// ---------- несгораемый «живой» график сотрудника ----------
export function careerData(db: ReturnType<typeof useStore>["db"], u: User) {
  const start = new Date(u.createdAt);
  const now = new Date();
  const out: { m: string; hours: number; shifts: number; points: number | null; pay: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= now && out.length < 60) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const from = `${key}-01`;
    const to = `${key}-31`;
    const ps = db.punches.filter((p) => p.userId === u.id && p.date.startsWith(key));
    const hours = Math.round(ps.reduce((s, p) => s + punchDur(p, db.settings.breakMin), 0) / 60 * 10) / 10;
    const shifts = new Set(ps.map((p) => p.date)).size;
    const r = db.ratings.find((x) => x.userId === u.id && x.month === key);
    const pay = Math.round(summarize(db, u, from, to).salary);
    out.push({ m: `${MONTHS_NOM[cur.getMonth()].slice(0, 3)} ${String(cur.getFullYear()).slice(2)}`, hours, shifts, points: r ? r.points : null, pay });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function DossierModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { db } = useStore();
  const data = useMemo(() => (user ? careerData(db, user) : []), [db, user]);
  if (!user) return null;
  const totH = Math.round(data.reduce((s, x) => s + x.hours, 0));
  const totS = data.reduce((s, x) => s + x.shifts, 0);
  const totP = data.reduce((s, x) => s + x.pay, 0);
  const tone = user.archiveTone === "pos" ? "ok" : user.archiveTone === "neg" ? "bad" : null;
  return (
    <Modal open onClose={onClose} w="max-w-3xl"
      title={<span className="flex items-center gap-2"><Avatar u={user} size={26} />Досье: {user.name}
        {user.archived && <span className={`badge ${tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-paper text-mute"}`}>в архиве</span>}</span>}>
      <div className="grid gap-4">
        {user.archived && (
          <div className={`rounded-xl border p-3.5 text-[12.5px] font-bold ${tone === "ok" ? "border-ok/50 bg-ok-soft/50" : tone === "bad" ? "border-bad/50 bg-bad-soft/50" : "border-line bg-paper"}`}>
            Причина: {user.archiveReason || "—"} · {user.archivedAt ? fmtDateFull(user.archivedAt.slice(0, 10)) : ""}
            {user.archiveNote && <p className="mt-1 font-semibold text-mute">Характеристика: {user.archiveNote}</p>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center"><div className="font-display text-lg font-bold tnum">{totH}</div><div className="text-[10.5px] font-extrabold uppercase text-mute">часов за всё время</div></div>
          <div className="card p-3 text-center"><div className="font-display text-lg font-bold tnum">{totS}</div><div className="text-[10.5px] font-extrabold uppercase text-mute">смен</div></div>
          <div className="card p-3 text-center"><div className="font-display text-lg font-bold tnum">{fmtMoney(totP)}</div><div className="text-[10.5px] font-extrabold uppercase text-mute">выплачено</div></div>
        </div>
        <div className="card p-4">
          <h4 className="font-display text-[13px] font-semibold mb-3">Живой график: часы и оценки по месяцам (сохраняется навсегда)</h4>
          {data.every((x) => x.hours === 0 && x.points === null) ? (
            <p className="text-[12px] font-bold text-mute">Данных пока нет — график наполнится с первой смены.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe1e8" />
                <XAxis dataKey="m" tick={{ fontSize: 10, fontWeight: 700 }} interval="preserveStartEnd" />
                <YAxis yAxisId="h" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Bar yAxisId="h" dataKey="hours" name="Часы" fill="#3f6d9e" radius={[4, 4, 0, 0]} />
                <Line yAxisId="p" dataKey="points" name="Оценка (баллы)" stroke="#e56f24" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-4">
          <h4 className="font-display text-[13px] font-semibold mb-2">Выплаты по месяцам</h4>
          <div className="flex flex-wrap gap-1.5">
            {data.filter((x) => x.pay > 0).map((x, i) => (
              <span key={i} className="badge bg-paper text-ink font-mono">{x.m}: {fmtMoney(x.pay)}</span>
            ))}
            {data.every((x) => x.pay === 0) && <p className="text-[12px] font-bold text-mute">Выплат пока нет.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------- штрафы ----------
export function FinePanel({ userId }: { userId: string }) {
  const { db, me, addFine, removeFine } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState({ amount: "", reason: "" });
  const [del, setDel] = useState<string | null>(null);
  const canManage = me?.role === "admin" || me?.role === "superadmin";
  const fines = db.fines.filter((x) => x.userId === userId);
  return (
    <div className="grid gap-3">
      {canManage && (
        <div className="grid sm:grid-cols-[110px_1fr_auto] gap-2">
          <input type="number" className="input !h-9 tnum" placeholder="Сумма ₽" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <input className="input !h-9" placeholder="Причина: опоздание, брак, нарушение ТБ…" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <button className="btn btn-bad btn-sm !h-9" onClick={() => {
            const a = Number(f.amount);
            if (!a || a <= 0 || !f.reason.trim()) { toast("Укажите сумму и причину", "bad"); return; }
            addFine(userId, a, f.reason.trim(), null);
            setF({ amount: "", reason: "" });
            toast("Штраф назначен, сотрудник уведомлён", "ok");
          }}><I n="plus" size={13} />Штраф</button>
        </div>
      )}
      {fines.length === 0 ? <p className="text-[12px] font-bold text-mute">Штрафов нет.</p> : fines.map((x) => (
        <div key={x.id} className="flex items-center gap-2.5 border border-bad/30 bg-bad-soft/40 rounded-lg px-3 py-2">
          <I n="warn" size={15} className="text-bad shrink-0" />
          <div className="min-w-0 flex-1">
            <b className="text-[12.5px] block">{x.reason}</b>
            <span className="text-[10.5px] font-bold text-mute">{fmtDateFull(x.ts.slice(0, 10))} · {userById(db, x.createdBy)?.name || "—"}</span>
          </div>
          <b className="tnum text-bad text-sm whitespace-nowrap">−{fmtMoney(x.amount)}</b>
          {canManage && <button className="w-7 h-7 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => setDel(x.id)}><I n="x" size={13} /></button>}
        </div>
      ))}
      <Confirm open={!!del} onClose={() => setDel(null)} title="Снять штраф?" text="Сумма вернётся в расчёт сотрудника, он получит уведомление." yesLabel="Снять"
        onYes={() => { if (del) { removeFine(del); toast("Штраф снят", "ok"); } }} />
    </div>
  );
}

// ---------- балльные оценки ----------
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
          <Field label="Комментарий (видит сотрудник)"><input className="input !h-9" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Дисциплина, качество, инициатива…" /></Field>
          <button className="btn btn-pri btn-sm" onClick={() => {
            addRating(userId, m, pts, note.trim());
            setNote("");
            toast(`Оценка за ${monthTitle(m + "-01")} сохранена и отправлена сотруднику`, "ok");
          }}><I n="star" size={13} />Поставить оценку</button>
        </div>
      )}
      {list.length === 0 ? <p className="text-[12px] font-bold text-mute">Оценок пока нет.</p> : (
        <div className="grid gap-1.5">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
              <span className={`font-display font-bold tnum text-sm w-12 ${r.points >= 80 ? "text-ok" : r.points >= 50 ? "text-warn" : "text-bad"}`}>{r.points}</span>
              <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden"><div className={`h-full rounded-full ${r.points >= 80 ? "bg-ok" : r.points >= 50 ? "bg-warn" : "bg-bad"}`} style={{ width: `${r.points}%` }} /></div>
              <span className="text-[11px] font-bold text-mute whitespace-nowrap">{r.month}{r.note ? ` · ${r.note}` : ""}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] font-bold text-mute">Оценки видят только сам сотрудник и управление. История уходит в архив и аналитику навсегда.</p>
    </div>
  );
}

// ---------- архив сотрудников ----------
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
        <p className="text-[12.5px] font-bold text-mute leading-relaxed">
          Уволенные и удалённые сотрудники попадают сюда с причиной, оценкой и характеристикой. Запись несгораема:
          полное удаление возможно только суперадмином и не раньше чем через 30 дней — защита от ошибочных действий.
          Живой график работы (часы, смены, оценки, выплаты) сохраняется навсегда.
        </p>
      </div>
      {list.length === 0 && <div className="card"><Empty icon="layers" title="Архив пуст" text="Здесь появятся сотрудники после увольнения — с причиной, характеристикой и полной историей работы." /></div>}
      <div className="grid gap-3">
        {list.map((u) => {
          const tone = u.archiveTone;
          const border = tone === "neg" ? "!border-bad/60" : tone === "pos" ? "!border-ok/60" : "";
          const bgc = tone === "neg" ? "bg-bad-soft/30" : tone === "pos" ? "bg-ok-soft/30" : "";
          const dl = daysLeft(u);
          return (
            <div key={u.id} className={`card p-4 anim-rise ${border} ${bgc}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <Avatar u={u} size={40} />
                <div className="min-w-0">
                  <b className="text-sm flex items-center gap-2">{u.name}
                    {tone === "neg" && <span className="badge bg-bad text-white">отрицательно</span>}
                    {tone === "pos" && <span className="badge bg-ok text-white">положительно</span>}
                  </b>
                  <span className="text-[11.5px] font-bold text-mute">@{u.username} · уволен {u.archivedAt ? fmtDateFull(u.archivedAt.slice(0, 10)) : "—"} · {relTime(u.archivedAt || new Date().toISOString())}</span>
                </div>
                <div className="ml-auto flex gap-2 flex-wrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => setDossier(u)}><I n="chart" size={13} />Досье</button>
                  <button className="btn btn-ok btn-sm" onClick={() => setConfirmRes(u)}><I n="history" size={13} />Восстановить</button>
                  {isSuper && (
                    <button className="btn btn-bad btn-sm" disabled={dl > 0} title={dl > 0 ? `Доступно через ${dl} дн.` : ""} onClick={() => setConfirmDel(u)}>
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
      </div>

      {dossier && <DossierModal user={dossier} onClose={() => setDossier(null)} />}
      <Confirm open={!!confirmRes} onClose={() => setConfirmRes(null)} title={`Восстановить ${confirmRes?.name}?`} danger={false} yesLabel="Восстановить"
        text="Сотрудник снова станет активным, доступы вернутся. История и архивная запись сохранятся."
        onYes={() => { if (confirmRes) { restoreUser(confirmRes.id); toast(`${confirmRes.name} восстановлен`, "ok"); } }} />
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} title={`Удалить ${confirmDel?.name} навсегда?`}
        text="Все данные (отметки, график, оценки, штрафы) будут стёрты безвозвратно. Действие необратимо."
        onYes={() => { if (confirmDel) { const r = hardDeleteUser(confirmDel.id); toast(r || "Удалён из архива навсегда", r ? "bad" : "ok"); } }} />
    </div>
  );
}

export { RoleBadge };
