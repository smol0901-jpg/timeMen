import React, { useState } from "react";
import { useStore } from "../lib/store";
import { I, useToast, Field, Empty, Modal, Seg } from "../components/ui";
import { uid, fmtDateFull } from "../lib/time";

interface Order {
  id: string;
  title: string;
  workshopId: string | null;
  quantity: number;
  unit: "kg" | "pcs" | "l" | "ton";
  deadline: string;
  status: "new" | "in_progress" | "completed";
  createdAt: string;
  notes: string;
}

export default function OrdersView() {
  const { db, me } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"list" | "new" | "analytics">("list");
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("smenalan.orders") || "[]");
    } catch { return []; }
  });
  const [form, setForm] = useState({
    title: "", workshopId: "", quantity: "", unit: "kg" as Order["unit"], deadline: "", notes: "",
  });
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "completed">("all");

  if (!me) return null;

  const saveOrders = (o: Order[]) => {
    setOrders(o);
    localStorage.setItem("smenalan.orders", JSON.stringify(o));
  };

  const createOrder = () => {
    if (!form.title.trim() || !form.quantity || !form.deadline) {
      toast("Заполните все обязательные поля", "bad");
      return;
    }
    const order: Order = {
      id: uid(),
      title: form.title.trim(),
      workshopId: form.workshopId || null,
      quantity: Number(form.quantity),
      unit: form.unit,
      deadline: form.deadline,
      status: "new",
      createdAt: new Date().toISOString(),
      notes: form.notes.trim(),
    };
    saveOrders([order, ...orders]);
    setForm({ title: "", workshopId: "", quantity: "", unit: "kg", deadline: "", notes: "" });
    toast("Заказ создан", "ok");
    setTab("list");
  };

  const updateStatus = (id: string, status: Order["status"]) => {
    const updated = orders.map((o) => o.id === id ? { ...o, status } : o);
    saveOrders(updated);
    toast("Статус обновлён", "ok");
  };

  const deleteOrder = (id: string) => {
    saveOrders(orders.filter((o) => o.id !== id));
    toast("Заказ удалён", "ok");
  };

  const filteredOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const unitLabels = { kg: "кг", pcs: "шт", l: "л", ton: "т" };
  const statusLabels = {
    new: { label: "Новый", color: "bg-night-soft text-night" },
    in_progress: { label: "В работе", color: "bg-warn-soft text-warn" },
    completed: { label: "Выполнен", color: "bg-ok-soft text-ok" },
  };

  // Аналитика
  const totalQuantity = orders.reduce((s, o) => s + o.quantity, 0);
  const completedQuantity = orders.filter((o) => o.status === "completed").reduce((s, o) => s + o.quantity, 0);
  const byWorkshop = new Map<string, number>();
  orders.forEach((o) => {
    const ws = o.workshopId ? db.workshops.find((w) => w.id === o.workshopId)?.name || "Без цеха" : "Без цеха";
    byWorkshop.set(ws, (byWorkshop.get(ws) || 0) + o.quantity);
  });

  return (
    <div className="grid gap-4 max-w-5xl mx-auto">
      <div className="card p-5 anim-rise" style={{ background: "linear-gradient(135deg, #fbeadb 0%, #fff 100%)" }}>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-accent text-white grid place-items-center"><I n="box" size={24} /></span>
          <div className="flex-1">
            <b className="font-display text-base block">Планирование продукции</b>
            <span className="text-[12px] text-mute font-bold">Заказы для цехов, распределение, аналитика</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {[
          { id: "list", label: "Заказы", icon: "doc", count: orders.length },
          { id: "new", label: "Новый заказ", icon: "plus" },
          { id: "analytics", label: "Аналитика", icon: "chart" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-[13px] font-bold transition border-b-2 -mb-px flex items-center gap-1.5
            ${tab === t.id ? "border-accent text-ink" : "border-transparent text-mute hover:text-ink"}`}>
            <I n={t.icon} size={15} />{t.label}
            {t.count !== undefined && t.count > 0 && <span className="badge bg-accent text-white !px-1.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <Seg opts={[
              { v: "all", label: "Все" },
              { v: "new", label: "Новые" },
              { v: "in_progress", label: "В работе" },
              { v: "completed", label: "Выполнены" },
            ]} val={filter} onChange={(v) => setFilter(v as any)} />
          </div>
          {filteredOrders.length === 0 ? (
            <Empty icon="box" title="Заказов нет" text="Создайте первый заказ для планирования производства." />
          ) : (
            filteredOrders.map((o) => {
              const ws = o.workshopId ? db.workshops.find((w) => w.id === o.workshopId) : null;
              return (
                <div key={o.id} className="card p-4 anim-rise">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <b className="text-[13px]">{o.title}</b>
                        <span className={`badge ${statusLabels[o.status].color}`}>{statusLabels[o.status].label}</span>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2 mt-2">
                        <div>
                          <div className="text-[10px] font-extrabold uppercase text-mute">Объём</div>
                          <div className="text-[12px] font-bold">{o.quantity} {unitLabels[o.unit]}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-extrabold uppercase text-mute">Цех</div>
                          <div className="text-[12px] font-bold">{ws?.name || "Не назначен"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-extrabold uppercase text-mute">Срок</div>
                          <div className="text-[12px] font-bold">{fmtDateFull(o.deadline)}</div>
                        </div>
                      </div>
                      {o.notes && <p className="text-[11px] text-mute font-semibold mt-2">{o.notes}</p>}
                      <div className="text-[10px] text-mute font-bold mt-2">#{o.id.slice(0, 8)} · {new Date(o.createdAt).toLocaleString("ru-RU")}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {o.status !== "completed" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(o.id, o.status === "new" ? "in_progress" : "completed")}>
                          <I n="check" size={13} />{o.status === "new" ? "В работу" : "Завершить"}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm !text-bad" onClick={() => deleteOrder(o.id)}>
                        <I n="trash" size={13} />Удалить
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "new" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Новый заказ</h3>
          <div className="grid gap-4">
            <Field label="Название заказа"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Например: Филе куриное" /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Цех">
                <select className="input" value={form.workshopId} onChange={(e) => setForm({ ...form, workshopId: e.target.value })}>
                  <option value="">Не назначен</option>
                  {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Срок выполнения"><input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Объём"><input type="number" className="input tnum" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="100" /></Field>
              <Field label="Единица измерения">
                <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as Order["unit"] })}>
                  <option value="kg">Килограммы (кг)</option>
                  <option value="pcs">Штуки (шт)</option>
                  <option value="l">Литры (л)</option>
                  <option value="ton">Тонны (т)</option>
                </select>
              </Field>
            </div>
            <Field label="Примечания"><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Дополнительная информация…" /></Field>
            <button className="btn btn-pri" onClick={createOrder}><I n="plus" size={16} />Создать заказ</button>
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card p-4">
              <div className="text-[10px] font-extrabold uppercase text-mute">Всего заказов</div>
              <div className="font-display text-2xl font-bold tnum mt-1">{orders.length}</div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-extrabold uppercase text-mute">Общий объём</div>
              <div className="font-display text-2xl font-bold tnum mt-1">{totalQuantity}</div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-extrabold uppercase text-mute">Выполнено</div>
              <div className="font-display text-2xl font-bold tnum mt-1 text-ok">{completedQuantity}</div>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Загрузка по цехам</h3>
            {byWorkshop.size === 0 ? (
              <p className="text-[12px] font-bold text-mute text-center py-6">Нет данных</p>
            ) : (
              <div className="grid gap-2">
                {[...byWorkshop.entries()].map(([ws, qty]) => {
                  const max = Math.max(...byWorkshop.values());
                  return (
                    <div key={ws}>
                      <div className="flex justify-between text-[12px] font-bold mb-1">
                        <span>{ws}</span>
                        <span className="tnum">{qty}</span>
                      </div>
                      <div className="h-2 rounded-full bg-line overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(qty / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
