import React, { useMemo, useRef, useState } from "react";
import { useStore, userById, wsName, pieceSumOf } from "../lib/store";
import { Product } from "../lib/types";
import { todayKey, addDaysKey, fmtDateFull, fmtDurH, fmtMoney, rangeKeys, monthStart, monthEnd } from "../lib/time";
import { I, useToast, Tabs, Field, Empty, Confirm, StatTile, Seg, Avatar } from "../components/ui";
import { workedOn } from "../lib/store";
import { exportProduction, parseProductsFile, productsTemplate } from "../lib/excel";

export default function ProductionView() {
  const { db, me } = useStore();
  const isAdmin = me?.role !== "employee";
  const [tab, setTab] = useState(isAdmin ? "ledger" : "mine");
  return (
    <div className="grid gap-4">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "mine", label: "Моя выработка", icon: "box" },
        { id: "record", label: "Записать", icon: "plus" },
        ...(isAdmin ? [{ id: "ledger", label: "Весь учёт", icon: "chart" }, { id: "dict", label: "Справочник продукции", icon: "layers" }] : []),
      ]} />
      {tab === "mine" && <Mine />}
      {tab === "record" && <Record />}
      {tab === "ledger" && isAdmin && <Ledger />}
      {tab === "dict" && isAdmin && <Dict />}
    </div>
  );
}

function visibleProducts(): Product[] {
  const { db, me } = useStore();
  if (!me) return [];
  if (me.role !== "employee") return db.products.filter((p) => !p.hidden).sort((a, b) => a.sort - b.sort);
  const ws = db.workshops.find((w) => w.id === me.workshopId);
  return db.products
    .filter((p) => !p.hidden && (p.workshopId === null || p.workshopId === me.workshopId))
    .sort((a, b) => a.sort - b.sort)
    .sort((a, b) => Number(b.workshopId === me.workshopId) - Number(a.workshopId === me.workshopId));
}

function Record() {
  const { db, me, addProduction } = useStore();
  const { toast } = useToast();
  const prods = visibleProducts();
  const [pid, setPid] = useState(prods[0]?.id || "");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const recent = useMemo(() => {
    const mine = db.production.filter((r) => r.userId === me?.id);
    return [...new Set(mine.map((r) => r.productId))].slice(0, 6);
  }, [db.production, me?.id]);
  if (!me) return null;

  return (
    <div className="card p-5 max-w-xl">
      <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2"><I n="plus" size={16} />Новая запись выработки</h3>
      {recent.length > 0 && (
        <div className="mb-4">
          <span className="lbl">Быстрый выбор (из памяти)</span>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((id) => {
              const p = db.products.find((x) => x.id === id);
              return p ? <button key={id} className={`chip ${pid === id ? "!border-accent !text-accent-deep" : ""}`} onClick={() => setPid(id)}>{p.name}</button> : null;
            })}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Продукт / позиция">
          <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
            {prods.map((p) => <option key={p.id} value={p.id}>{p.name} {p.price > 0 ? `· ${p.price} ₽/${p.unit}` : ""}</option>)}
          </select>
        </Field>
        <Field label={`Количество, ${db.products.find((p) => p.id === pid)?.unit || "кг"}`}>
          <input type="number" step="0.1" min="0" className="input tnum" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.0" />
        </Field>
        <Field label="Дата смены"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Примечание"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Партия, линия…" /></Field>
      </div>
      {prods.length === 0 && <p className="text-[12px] font-bold text-warn bg-warn-soft rounded-lg p-3 mt-3">Для вашего цеха пока нет позиций — администратор добавляет их в «Справочнике продукции».</p>}
      <div className="flex items-center gap-3 mt-5">
        <button className="btn btn-pri" onClick={() => {
          const q = Number(qty.replace(",", "."));
          if (!pid || !(q > 0)) { toast("Укажите корректное количество", "bad"); return; }
          addProduction(pid, q, date, note.trim());
          setQty(""); setNote("");
          toast("Выработка записана", "ok");
        }}><I n="check" size={16} />Записать</button>
        {(() => {
          const p = db.products.find((x) => x.id === pid);
          const q = Number(qty.replace(",", ".")) || 0;
          return p && q > 0 ? <span className="text-sm font-bold text-mute">= <b className="text-ok">{fmtMoney(q * p.price)}</b> к смене</span> : null;
        })()}
      </div>
    </div>
  );
}

function Mine() {
  const { db, me, removeProduction } = useStore();
  const { toast } = useToast();
  const [from, setFrom] = useState(monthStart(todayKey()));
  const [to, setTo] = useState(monthEnd(todayKey()));
  const [del, setDel] = useState<string | null>(null);
  if (!me) return null;
  const recs = db.production.filter((r) => r.userId === me.id && r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  const byProd = new Map<string, number>();
  recs.forEach((r) => byProd.set(r.productId, (byProd.get(r.productId) || 0) + r.qty));
  const sum = pieceSumOf(db, me.id, from, to);
  const hours = rangeKeys(from, to).reduce((s, k) => s + workedOn(db, me.id, k), 0) / 60;
  const totalKg = [...byProd.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" className="input !w-40 !h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-mute font-bold">—</span>
        <input type="date" className="input !w-40 !h-9" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { exportProduction(db, from, to); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon="money" tone="ok" label="Начислено (сделка)" val={fmtMoney(sum)} sub="по ценам справочника" />
        <StatTile icon="box" tone="accent" label="Объём" val={`${Math.round(totalKg * 10) / 10} кг`} sub={`${recs.length} записей`} />
        <StatTile icon="zap" tone="night" label="Скорость" val={hours > 0 ? `${(totalKg / hours).toFixed(1)} кг/ч` : "—"} sub={`отработано ${Math.round(hours * 10) / 10} ч`} />
        <StatTile icon="flame" tone="warn" label="Рекорд дня" val={(() => {
          const byDay = new Map<string, number>();
          recs.forEach((r) => byDay.set(r.date, (byDay.get(r.date) || 0) + r.qty));
          const max = Math.max(0, ...byDay.values());
          return max ? `${Math.round(max * 10) / 10} кг` : "—";
        })()} sub="максимум за день" />
      </div>
      <div className="card overflow-hidden">
        {recs.length === 0 ? <Empty icon="box" title="Записей нет" text="Добавьте первую запись — объёмы сразу попадут в статистику и расчёт." /> : (
          <table className="tbl">
            <thead><tr><th>Дата</th><th>Позиция</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Примечание</th><th></th></tr></thead>
            <tbody>
              {recs.map((r) => {
                const p = db.products.find((x) => x.id === r.productId);
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-mono text-[12px]">{fmtDateFull(r.date)}</td>
                    <td><b>{p?.name || "—"}</b></td>
                    <td className="tnum font-bold">{r.qty} {p?.unit}</td>
                    <td className="tnum">{p?.price || 0} ₽</td>
                    <td className="tnum font-bold text-ok">{fmtMoney(r.qty * (p?.price || 0))}</td>
                    <td className="text-mute text-[12px]">{r.note || "—"}</td>
                    <td><button className="w-7 h-7 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => setDel(r.id)}><I n="trash" size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Confirm open={!!del} onClose={() => setDel(null)} title="Удалить запись?" text="Запись выработки будет удалена из учёта."
        onYes={() => { if (del) { removeProduction(del); toast("Запись удалена"); } }} />
    </div>
  );
}

function Ledger() {
  const { db } = useStore();
  const { toast } = useToast();
  const [from, setFrom] = useState(addDaysKey(todayKey(), -6));
  const [to, setTo] = useState(todayKey());
  const [ws, setWs] = useState("");
  const recs = db.production
    .filter((r) => r.date >= from && r.date <= to)
    .filter((r) => !ws || userById(db, r.userId)?.workshopId === ws)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const byUser = new Map<string, { qty: number; sum: number; h: number }>();
  recs.forEach((r) => {
    const p = db.products.find((x) => x.id === r.productId);
    const u = byUser.get(r.userId) || { qty: 0, sum: 0, h: rangeKeys(from, to).reduce((s, k) => s + workedOn(db, r.userId, k), 0) / 60 };
    u.qty += r.qty; u.sum += r.qty * (p?.price || 0);
    byUser.set(r.userId, u);
  });
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" className="input !w-40 !h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-mute font-bold">—</span>
        <input type="date" className="input !w-40 !h-9" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="input !w-56 !h-9" value={ws} onChange={(e) => setWs(e.target.value)}>
          <option value="">Все цеха</option>
          {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { exportProduction(db, from, to); toast("Excel сохранён", "ok"); }}><I n="xls" size={14} />Excel</button>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">Производительность по сотрудникам</h3>
          {byUser.size === 0 ? <p className="text-[12px] font-bold text-mute">Нет выработки за период.</p> : (
            <div className="grid gap-2">
              {[...byUser.entries()].sort((a, b) => b[1].qty - a[1].qty).map(([id, v]) => {
                const u = userById(db, id);
                const speed = v.h > 0 ? v.qty / v.h : 0;
                return (
                  <div key={id} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
                    <Avatar u={u} size={30} />
                    <div className="min-w-0 flex-1">
                      <b className="text-[13px] block truncate">{u?.name}</b>
                      <span className="text-[11px] text-mute font-bold">{wsName(db, u?.workshopId || null)} · {Math.round(v.h * 10) / 10} ч</span>
                    </div>
                    <div className="text-right">
                      <b className="block tnum text-sm">{Math.round(v.qty * 10) / 10} кг</b>
                      <span className="text-[11px] font-bold text-night">{speed.toFixed(1)} кг/ч</span>
                    </div>
                    <b className="tnum text-ok text-sm w-20 text-right">{fmtMoney(v.sum)}</b>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Дата</th><th>Сотрудник</th><th>Позиция</th><th>Кол-во</th><th>Сумма</th></tr></thead>
            <tbody>
              {recs.slice(0, 40).map((r) => {
                const p = db.products.find((x) => x.id === r.productId);
                const u = userById(db, r.userId);
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-[12px] whitespace-nowrap">{r.date}</td>
                    <td className="whitespace-nowrap">{u?.name || "—"}</td>
                    <td>{p?.name || "—"}</td>
                    <td className="tnum font-bold">{r.qty} {p?.unit}</td>
                    <td className="tnum text-ok">{fmtMoney(r.qty * (p?.price || 0))}</td>
                  </tr>
                );
              })}
              {recs.length === 0 && <tr><td colSpan={5} className="text-center text-mute font-bold py-6">Нет записей</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Dict() {
  const { db, addProduct, updateProduct, removeProduct } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState({ name: "", unit: "кг", price: "", workshopId: "" });
  const [del, setDel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wsId = db.workshops.find((w) => w.piecework)?.id || "";

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Позиция</th><th>Ед.</th><th>Цена ₽ (за ед.)</th><th>Цех</th><th></th></tr></thead>
          <tbody>
            {db.products.sort((a, b) => a.sort - b.sort).map((p) => (
              <tr key={p.id} className={p.hidden ? "opacity-45" : ""}>
                <td>
                  <input className="input !h-8 !text-[13px] !w-56" value={p.name} onChange={(e) => updateProduct(p.id, { name: e.target.value })} />
                </td>
                <td><input className="input !h-8 !w-16 !text-[13px]" value={p.unit} onChange={(e) => updateProduct(p.id, { unit: e.target.value })} /></td>
                <td><input type="number" className="input !h-8 !w-24 !text-[13px] tnum" value={p.price} onChange={(e) => updateProduct(p.id, { price: Number(e.target.value) })} /></td>
                <td>
                  <select className="input !h-8 !w-44 !text-[13px]" value={p.workshopId || ""} onChange={(e) => updateProduct(p.id, { workshopId: e.target.value || null })}>
                    <option value="">Общая</option>
                    {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </td>
                <td>
                  <span className="flex gap-1">
                    <button className={`btn btn-sm ${p.hidden ? "btn-ghost" : "btn-soft"}`} onClick={() => { updateProduct(p.id, { hidden: !p.hidden }); toast(p.hidden ? "Позиция показана" : "Позиция скрыта из записи"); }}>
                      <I n="eye" size={13} />{p.hidden ? "Скрыта" : "Скрыть"}
                    </button>
                    <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => setDel(p.id)}><I n="trash" size={14} /></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] font-bold text-mute px-4 py-3 border-t border-line">Цены редактируются сразу и попадают в расчёт с ближайшей записи. «Скрыть» — позиция остаётся в истории, но исчезает из формы записи.</p>
      </div>
      <div className="grid gap-4">
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Новая позиция</h3>
          <div className="grid gap-3">
            <Field label="Название"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Филе бедра" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ед. изм."><input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
              <Field label="Цена ₽"><input type="number" className="input tnum" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0" /></Field>
            </div>
            <Field label="Цех (видят только его сотрудники)">
              <select className="input" value={f.workshopId} onChange={(e) => setF({ ...f, workshopId: e.target.value })}>
                <option value="">Общая для всех</option>
                {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <button className="btn btn-pri" onClick={() => {
              if (!f.name.trim()) { toast("Укажите название", "bad"); return; }
              addProduct({ name: f.name.trim(), unit: f.unit || "кг", price: Number(f.price) || 0, workshopId: f.workshopId || null, hidden: false });
              setF({ name: "", unit: "кг", price: "", workshopId: "" });
              toast("Позиция добавлена", "ok");
            }}><I n="plus" size={16} />Добавить</button>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-2">Массовая загрузка</h3>
          <p className="text-[12px] text-mute font-bold mb-3">Импорт списка продукции из Excel/JSON (Название, Ед, Цена) с распределением по цехам.</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.json" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.name.endsWith(".json")) {
                const arr = JSON.parse(await file.text());
                (Array.isArray(arr) ? arr : []).forEach((x: { name?: string; unit?: string; price?: number; workshop?: string }) => {
                  if (x?.name) {
                    const w = db.workshops.find((q) => q.name.toLowerCase().includes(String(x.workshop || "").toLowerCase()));
                    addProduct({ name: String(x.name), unit: x.unit || "кг", price: Number(x.price) || 0, workshopId: w?.id || null, hidden: false });
                  }
                });
                toast("JSON импортирован", "ok");
              } else {
                const rows = await parseProductsFile(file);
                rows.forEach((r) => addProduct({ ...r, workshopId: wsId || null, hidden: false }));
                toast(`Импортировано позиций: ${rows.length}`, "ok");
              }
            } catch { toast("Не удалось прочитать файл", "bad"); }
          }} />
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm flex-1" onClick={() => fileRef.current?.click()}><I n="upload" size={13} />Импорт</button>
            <button className="btn btn-ghost btn-sm flex-1" onClick={() => { productsTemplate(); toast("Шаблон сохранён", "ok"); }}><I n="xls" size={13} />Шаблон</button>
          </div>
        </div>
      </div>
      <Confirm open={!!del} onClose={() => setDel(null)} title="Удалить позицию?" text="Если по позиции есть выработка — её можно только скрыть."
        onYes={() => {
          if (!del) return;
          const r = removeProduct(del);
          toast(r || "Позиция удалена", r ? "bad" : "ok");
        }} />
    </div>
  );
}
