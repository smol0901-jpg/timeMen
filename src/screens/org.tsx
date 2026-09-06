import React, { useMemo, useState } from "react";
import { useStore, summarizeAll, posName } from "../lib/store";
import { PAY_LABEL, PayMode } from "../lib/types";
import { monthStart, monthEnd, monthTitle, todayKey, addDaysKey, fmtMoney, hDec } from "../lib/time";
import { I, useToast, Tabs, Field, Confirm, Empty, Seg, Toggle, StatTile } from "../components/ui";
import { exportFot } from "../lib/excel";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function OrgView() {
  const [tab, setTab] = useState("ws");
  return (
    <div className="grid gap-4">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "ws", label: "Цеха", icon: "factory" },
        { id: "pos", label: "Должности", icon: "users" },
        { id: "fot", label: "ФОТ и аналитика", icon: "coin" },
      ]} />
      {tab === "ws" && <Workshops />}
      {tab === "pos" && <Positions />}
      {tab === "fot" && <Fot />}
    </div>
  );
}

function Workshops() {
  const { db, addWorkshop, updateWorkshop, removeWorkshop } = useStore();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [pw, setPw] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const colors = ["#3f6d9e", "#c74436", "#17875c", "#a97a12", "#7a4fbf", "#0f8b8d", "#b0487d", "#e56f24"];
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div className="grid sm:grid-cols-2 gap-3">
        {db.workshops.map((w) => {
          const cnt = db.users.filter((u) => u.workshopId === w.id && u.active).length;
          return (
            <div key={w.id} className="card p-4 anim-rise" style={{ borderTop: `4px solid ${w.color}` }}>
              <div className="flex items-center gap-2">
                <input className="input !h-9 font-display !text-sm font-semibold" value={w.name} onChange={(e) => updateWorkshop(w.id, { name: e.target.value })} />
                <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition shrink-0" onClick={() => setDel(w.id)}><I n="trash" size={14} /></button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {colors.map((c) => (
                  <button key={c} className={`w-5 h-5 rounded-full transition ${w.color === c ? "ring-2 ring-offset-1 ring-ink" : ""}`} style={{ background: c }} onClick={() => updateWorkshop(w.id, { color: c })} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] font-extrabold text-mute uppercase">{cnt} сотрудн.</span>
                <button className={`btn btn-sm ${w.piecework ? "btn-soft" : "btn-ghost"}`} onClick={() => { updateWorkshop(w.id, { piecework: !w.piecework }); toast(w.piecework ? "Цех переведён на повременную оплату" : "Цех переведён на сдельную оплату", "ok"); }}>
                  <I n="coin" size={13} />{w.piecework ? "Сдельный" : "Повременный"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Новый цех</h3>
        <div className="grid gap-4">
          <Field label="Название"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Цех №3 — упаковка" /></Field>
          <Toggle checked={pw} onChange={setPw} label="Сдельная оплата" sub="выработка в кг × цена позиции (как обвалка)" />
          <button className="btn btn-pri" onClick={() => {
            if (!name.trim()) { toast("Укажите название", "bad"); return; }
            addWorkshop(name.trim(), pw, colors[db.workshops.length % colors.length]);
            setName(""); setPw(false);
            toast("Цех создан", "ok");
          }}><I n="plus" size={16} />Создать цех</button>
          <p className="text-[12px] text-mute font-bold leading-relaxed">Цехов может быть сколько угодно. Сотрудники прикрепляются в разделе «Сотрудники», продукция справочника видна только своему цеху.</p>
        </div>
      </div>
      <Confirm open={!!del} onClose={() => setDel(null)} title="Удалить цех?" text="Удаление возможно, только если в цехе нет сотрудников."
        onYes={() => { if (del) { const r = removeWorkshop(del); toast(r || "Цех удалён", r ? "bad" : "ok"); } }} />
    </div>
  );
}

function Positions() {
  const { db, addPosition, updatePosition, removePosition } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState({ name: "", normH: "8", defPay: "hour" as PayMode, rate: "", shiftCost: "" });
  const [del, setDel] = useState<string | null>(null);
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Должность</th><th>Норма ч/день</th><th>Оплата</th><th>Ставка ₽/ч</th><th>Смена ₽</th><th>Занято</th><th></th></tr></thead>
          <tbody>
            {db.positions.map((p) => {
              const cnt = db.users.filter((u) => u.positionId === p.id && u.active).length;
              return (
                <tr key={p.id}>
                  <td><input className="input !h-8 !text-[13px] !w-48" value={p.name} onChange={(e) => updatePosition(p.id, { name: e.target.value })} /></td>
                  <td><input type="number" className="input !h-8 !w-20 tnum" value={p.normH} onChange={(e) => updatePosition(p.id, { normH: Number(e.target.value) })} /></td>
                  <td>
                    <select className="input !h-8 !w-32 !text-[13px]" value={p.defPay} onChange={(e) => updatePosition(p.id, { defPay: e.target.value as PayMode })}>
                      <option value="hour">Почасовая</option><option value="shift">Посменная</option><option value="piece">Сдельная</option>
                    </select>
                  </td>
                  <td><input type="number" className="input !h-8 !w-24 tnum" value={p.rate} onChange={(e) => updatePosition(p.id, { rate: Number(e.target.value) })} /></td>
                  <td><input type="number" className="input !h-8 !w-24 tnum" value={p.shiftCost} onChange={(e) => updatePosition(p.id, { shiftCost: Number(e.target.value) })} /></td>
                  <td className="text-center font-bold">{cnt}</td>
                  <td><button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => setDel(p.id)}><I n="trash" size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] font-bold text-mute px-4 py-3 border-t border-line">Норма часов своя для каждой должности: 8 ч, 12 ч или сутки (24 ч). При создании сотрудника нормы и тип оплаты подставляются от должности.</p>
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Новая должность</h3>
        <div className="grid gap-3">
          <Field label="Название"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Наладчик" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Норма ч/день"><input type="number" className="input tnum" value={f.normH} onChange={(e) => setF({ ...f, normH: e.target.value })} /></Field>
            <Field label="Оплата">
              <select className="input" value={f.defPay} onChange={(e) => setF({ ...f, defPay: e.target.value as PayMode })}>
                <option value="hour">Почасовая</option><option value="shift">Посменная</option><option value="piece">Сдельная</option>
              </select>
            </Field>
            <Field label="Ставка ₽/ч"><input type="number" className="input tnum" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
            <Field label="Смена ₽"><input type="number" className="input tnum" value={f.shiftCost} onChange={(e) => setF({ ...f, shiftCost: e.target.value })} /></Field>
          </div>
          <button className="btn btn-pri" onClick={() => {
            if (!f.name.trim()) { toast("Укажите название", "bad"); return; }
            addPosition({ name: f.name.trim(), normH: Number(f.normH) || 8, defPay: f.defPay, rate: Number(f.rate) || 0, shiftCost: Number(f.shiftCost) || 0 });
            setF({ name: "", normH: "8", defPay: "hour", rate: "", shiftCost: "" });
            toast("Должность создана", "ok");
          }}><I n="plus" size={16} />Создать</button>
        </div>
      </div>
      <Confirm open={!!del} onClose={() => setDel(null)} title="Удалить должность?" text="Удаление возможно, только если она не занята сотрудниками."
        onYes={() => { if (del) { const r = removePosition(del); toast(r || "Должность удалена", r ? "bad" : "ok"); } }} />
    </div>
  );
}

type FotPeriod = "month" | "q" | "year";
function Fot() {
  const { db } = useStore();
  const { toast } = useToast();
  const [period, setPeriod] = useState<FotPeriod>("month");
  const tk = todayKey();

  const ranges = useMemo((): { label: string; from: string; to: string }[] => {
    if (period === "month") {
      return [-2, -1, 0, 1].map((n) => {
        const d = new Date(Number(tk.slice(0, 4)), Number(tk.slice(5, 7)) - 1 + n, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { label: monthTitle(key + "-01").split(" ")[0].slice(0, 3), from: monthStart(key + "-01"), to: monthEnd(key + "-01") };
      });
    }
    if (period === "q") {
      const y = Number(tk.slice(0, 4));
      const curQ = Math.floor((Number(tk.slice(5, 7)) - 1) / 3);
      return [curQ - 1, curQ, curQ + 1].map((q) => {
        const yy = y + Math.floor(q / 4);
        const qq = ((q % 4) + 4) % 4;
        const from = `${yy}-${String(qq * 3 + 1).padStart(2, "0")}-01`;
        const toD = new Date(yy, qq * 3 + 3, 0);
        return { label: `${qq + 1} кв`, from, to: `${toD.getFullYear()}-${String(toD.getMonth() + 1).padStart(2, "0")}-${String(toD.getDate()).padStart(2, "0")}` };
      });
    }
    const y = Number(tk.slice(0, 4));
    return [y - 1, y, y + 1].map((yy) => ({ label: String(yy), from: `${yy}-01-01`, to: `${yy}-12-31` }));
  }, [period, tk]);

  const series = ranges.map((r) => ({
    name: r.label,
    ФОТ: Math.round(summarizeAll(db, r.from, r.to).reduce((s, x) => s + x.salary, 0)),
    Часы: Math.round(summarizeAll(db, r.from, r.to).reduce((s, x) => s + x.factMin, 0) / 60),
  }));
  const cur = series[period === "month" ? 2 : 1];
  const prev = series[period === "month" ? 1 : 0];
  const growth = prev && prev.ФОТ > 0 ? ((cur.ФОТ - prev.ФОТ) / prev.ФОТ) * 100 : 0;
  const forecast = period === "year" ? cur.ФОТ : Math.round(cur.ФОТ * (prev.ФОТ ? (1 + growth / 200) : 1));

  const byPos = new Map<string, number>();
  summarizeAll(db, ranges[period === "month" ? 2 : 1].from, ranges[period === "month" ? 2 : 1].to).forEach((r) => {
    const k = posName(db, r.user.positionId);
    byPos.set(k, (byPos.get(k) || 0) + r.salary);
  });

  const risks: { icon: string; text: string; tone: string }[] = [];
  const rows = summarizeAll(db, ranges[period === "month" ? 2 : 1].from, ranges[period === "month" ? 2 : 1].to);
  rows.filter((r) => r.planMin > 0 && r.otMin / r.planMin > 0.15).slice(0, 3).forEach((r) =>
    risks.push({ icon: "flame", tone: "warn", text: `${r.user.name}: переработка ${Math.round((r.otMin / r.planMin) * 100)}% от плана — риск выгорания и роста ФОТ` }));
  rows.filter((r) => r.planMin > 0 && r.shortMin / r.planMin > 0.25).slice(0, 3).forEach((r) =>
    risks.push({ icon: "warn", tone: "bad", text: `${r.user.name}: недоработка ${Math.round((r.shortMin / r.planMin) * 100)}% — проверить график и больничные` }));
  if (growth > 12) risks.push({ icon: "trend", tone: "warn", text: `ФОТ растёт на ${growth.toFixed(0)}% к прошлому периоду — проверьте ставки и объёмы` });
  if (growth < -12) risks.push({ icon: "trend", tone: "night", text: `ФОТ снизился на ${Math.abs(growth).toFixed(0)}% — возможны отпуска или простой` });
  if (risks.length === 0) risks.push({ icon: "check", tone: "ok", text: "Рисков не обнаружено: ФОТ и часы в норме" });

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Seg opts={[{ v: "month", label: "Месяцы" }, { v: "q", label: "Кварталы" }, { v: "year", label: "Годы" }]} val={period} onChange={setPeriod} />
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => {
          const r = ranges[period === "month" ? 2 : 1];
          exportFot(db, r.from, r.to); toast("Excel сохранён", "ok");
        }}><I n="xls" size={14} />Экспорт ФОТ</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon="coin" tone="accent" label="ФОТ за период" val={fmtMoney(cur.ФОТ)} sub="начислено по всем" />
        <StatTile icon="clock" tone="night" label="Часы" val={`${cur.Часы} ч`} sub="факт по компании" />
        <StatTile icon="trend" tone={growth >= 0 ? "ok" : "bad"} label="Динамика" val={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`} sub="к прошлому периоду" />
        <StatTile icon="brain" tone="warn" label="Прогноз след. периода" val={fmtMoney(forecast)} sub="по тренду последних периодов" />
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">ФОТ и часы по периодам</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe1e8" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} />
              <YAxis yAxisId="m" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}к`} />
              <YAxis yAxisId="h" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => Number(v).toLocaleString("ru-RU")} />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
              <Bar yAxisId="m" dataKey="ФОТ" fill="#e56f24" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="h" dataKey="Часы" fill="#3f6d9e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-4">
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">ФОТ по должностям</h3>
            {[...byPos.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => {
              const max = Math.max(...byPos.values(), 1);
              return (
                <div key={k} className="mb-2.5">
                  <div className="flex justify-between text-[12px] font-bold mb-1"><span>{k}</span><span className="tnum">{fmtMoney(v)}</span></div>
                  <div className="h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: `${(v / max) * 100}%` }} /></div>
                </div>
              );
            })}
            {byPos.size === 0 && <p className="text-[12px] font-bold text-mute">Нет начислений за период.</p>}
          </div>
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="warn" size={15} className="text-warn" />Риски</h3>
            <div className="grid gap-2">
              {risks.map((r, i) => (
                <div key={i} className={`flex items-start gap-2.5 text-[12px] font-bold rounded-lg border p-2.5 ${r.tone === "bad" ? "bg-bad-soft/60 border-bad/30" : r.tone === "warn" ? "bg-warn-soft/60 border-warn/30" : r.tone === "ok" ? "bg-ok-soft/60 border-ok/30" : "bg-night-soft/60 border-night/30"}`}>
                  <I n={r.icon} size={15} className={r.tone === "bad" ? "text-bad" : r.tone === "warn" ? "text-warn" : r.tone === "ok" ? "text-ok" : "text-night"} />
                  {r.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
