import React, { useState } from "react";
import { useStore } from "../lib/store";
import { I, useToast, Field, Empty, Modal } from "../components/ui";
import { uid } from "../lib/time";
import { BRAND } from "../lib/types";

interface SupportTicket {
  id: string;
  userId: string;
  title: string;
  text: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "new" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  responses: { id: string; text: string; by: string; ts: string }[];
}

export default function SupportView() {
  const { db, me } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"tickets" | "new" | "contacts">("tickets");
  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("smenalan.tickets") || "[]");
    } catch { return []; }
  });
  const [form, setForm] = useState({ title: "", text: "", priority: "medium" as SupportTicket["priority"] });
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responseText, setResponseText] = useState("");

  if (!me) return null;

  const saveTickets = (t: SupportTicket[]) => {
    setTickets(t);
    localStorage.setItem("smenalan.tickets", JSON.stringify(t));
  };

  const createTicket = () => {
    if (!form.title.trim() || !form.text.trim()) {
      toast("Заполните заголовок и текст", "bad");
      return;
    }
    const ticket: SupportTicket = {
      id: uid(),
      userId: me.id,
      title: form.title.trim(),
      text: form.text.trim(),
      priority: form.priority,
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responses: [],
    };
    saveTickets([ticket, ...tickets]);
    setForm({ title: "", text: "", priority: "medium" });
    toast("Обращение создано", "ok");
    setTab("tickets");
  };

  const addResponse = () => {
    if (!selectedTicket || !responseText.trim()) return;
    const updated = tickets.map((t) => {
      if (t.id === selectedTicket.id) {
        return {
          ...t,
          responses: [...t.responses, { id: uid(), text: responseText.trim(), by: me.name, ts: new Date().toISOString() }],
          updatedAt: new Date().toISOString(),
          status: "in_progress" as const,
        };
      }
      return t;
    });
    saveTickets(updated);
    setSelectedTicket(updated.find((t) => t.id === selectedTicket.id) || null);
    setResponseText("");
    toast("Ответ добавлен", "ok");
  };

  const updateStatus = (id: string, status: SupportTicket["status"]) => {
    const updated = tickets.map((t) => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t);
    saveTickets(updated);
    toast("Статус обновлён", "ok");
  };

  const myTickets = tickets.filter((t) => t.userId === me.id);
  const allTickets = me.role !== "employee" ? tickets : myTickets;

  const priorityColors = {
    low: "bg-paper text-mute",
    medium: "bg-night-soft text-night",
    high: "bg-warn-soft text-warn",
    critical: "bg-bad-soft text-bad",
  };

  const statusLabels = {
    new: { label: "Новое", color: "bg-night-soft text-night" },
    in_progress: { label: "В работе", color: "bg-warn-soft text-warn" },
    resolved: { label: "Решено", color: "bg-ok-soft text-ok" },
    closed: { label: "Закрыто", color: "bg-paper text-mute" },
  };

  return (
    <div className="grid gap-4 max-w-4xl mx-auto">
      <div className="card p-5 anim-rise" style={{ background: "linear-gradient(135deg, #e7eef6 0%, #fff 100%)" }}>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-night text-white grid place-items-center"><I n="help" size={24} /></span>
          <div className="flex-1">
            <b className="font-display text-base block">Поддержка и обратная связь</b>
            <span className="text-[12px] text-mute font-bold">Создавайте обращения, отслеживайте статус, получайте ответы</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {[
          { id: "tickets", label: "Обращения", icon: "doc", count: allTickets.length },
          { id: "new", label: "Новое обращение", icon: "plus" },
          { id: "contacts", label: "Контакты", icon: "phone" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-[13px] font-bold transition border-b-2 -mb-px flex items-center gap-1.5
            ${tab === t.id ? "border-accent text-ink" : "border-transparent text-mute hover:text-ink"}`}>
            <I n={t.icon} size={15} />{t.label}
            {t.count !== undefined && t.count > 0 && <span className="badge bg-accent text-white !px-1.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "tickets" && (
        <div className="grid gap-3">
          {allTickets.length === 0 ? (
            <Empty icon="doc" title="Обращений нет" text="Создайте первое обращение, если нужна помощь." />
          ) : (
            allTickets.map((t) => {
              const user = db.users.find((u) => u.id === t.userId);
              return (
                <div key={t.id} className="card p-4 anim-rise">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <b className="text-[13px]">{t.title}</b>
                        <span className={`badge ${priorityColors[t.priority]}`}>{t.priority === "critical" ? "Критично" : t.priority === "high" ? "Высокий" : t.priority === "medium" ? "Средний" : "Низкий"}</span>
                        <span className={`badge ${statusLabels[t.status].color}`}>{statusLabels[t.status].label}</span>
                      </div>
                      <p className="text-[12px] text-mute font-semibold line-clamp-2">{t.text}</p>
                      <div className="text-[10px] text-mute font-bold mt-1.5">
                        #{t.id.slice(0, 8)} · {user?.name || "Неизвестный"} · {new Date(t.createdAt).toLocaleString("ru-RU")}
                        {t.responses.length > 0 && <span className="ml-2">· {t.responses.length} ответов</span>}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTicket(t)}><I n="eye" size={13} />Открыть</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "new" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Новое обращение</h3>
          <div className="grid gap-4">
            <Field label="Заголовок"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Кратко опишите проблему" /></Field>
            <Field label="Приоритет">
              <div className="flex gap-2">
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <button key={p} className={`chip ${form.priority === p ? "!border-accent !text-accent-deep !bg-accent-soft" : ""}`}
                    onClick={() => setForm({ ...form, priority: p })}>
                    {p === "critical" ? "Критично" : p === "high" ? "Высокий" : p === "medium" ? "Средний" : "Низкий"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Описание"><textarea className="input" rows={5} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Подробно опишите проблему или вопрос…" /></Field>
            <button className="btn btn-pri" onClick={createTicket}><I n="send" size={16} />Отправить обращение</button>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Контакты разработчика</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-paper border border-line p-4">
              <b className="text-[13px] block mb-2">Компания</b>
              <p className="text-[12px] font-bold text-mute">{BRAND.company}</p>
            </div>
            <div className="rounded-xl bg-paper border border-line p-4">
              <b className="text-[13px] block mb-2">Telegram / Zen</b>
              <p className="text-[12px] font-bold text-night">@{BRAND.telegram}</p>
            </div>
            <div className="rounded-xl bg-paper border border-line p-4">
              <b className="text-[13px] block mb-2">Email</b>
              <p className="text-[12px] font-bold text-mute">{BRAND.email}</p>
            </div>
            <div className="rounded-xl bg-paper border border-line p-4">
              <b className="text-[13px] block mb-2">Телефон</b>
              <p className="text-[12px] font-bold text-mute">{BRAND.phone}</p>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-xl bg-accent-soft border border-accent/30">
            <p className="text-[12.5px] font-bold text-accent-deep leading-relaxed">
              💡 Создайте обращение через вкладку "Новое обращение" — оно получит уникальный ID и будет отслеживаться. 
              Все обращения хранятся локально и доступны только вам и администрации.
            </p>
          </div>
        </div>
      )}

      <Modal open={!!selectedTicket} onClose={() => setSelectedTicket(null)} title={selectedTicket?.title || ""} w="max-w-2xl">
        {selectedTicket && (
          <div className="grid gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${priorityColors[selectedTicket.priority]}`}>
                {selectedTicket.priority === "critical" ? "Критично" : selectedTicket.priority === "high" ? "Высокий" : selectedTicket.priority === "medium" ? "Средний" : "Низкий"}
              </span>
              <span className={`badge ${statusLabels[selectedTicket.status].color}`}>{statusLabels[selectedTicket.status].label}</span>
              <span className="text-[10px] text-mute font-bold ml-auto">#{selectedTicket.id.slice(0, 8)}</span>
            </div>
            <div className="rounded-xl bg-paper border border-line p-4">
              <p className="text-[13px] leading-relaxed">{selectedTicket.text}</p>
              <div className="text-[10px] text-mute font-bold mt-2">
                {db.users.find((u) => u.id === selectedTicket.userId)?.name} · {new Date(selectedTicket.createdAt).toLocaleString("ru-RU")}
              </div>
            </div>
            {selectedTicket.responses.length > 0 && (
              <div>
                <b className="text-[12px] block mb-2">Ответы ({selectedTicket.responses.length})</b>
                <div className="grid gap-2">
                  {selectedTicket.responses.map((r) => (
                    <div key={r.id} className="rounded-xl bg-surface border border-line p-3">
                      <p className="text-[12.5px]">{r.text}</p>
                      <div className="text-[10px] text-mute font-bold mt-1">{r.by} · {new Date(r.ts).toLocaleString("ru-RU")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Field label="Добавить ответ"><textarea className="input" rows={3} value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder="Ваш ответ…" /></Field>
              <button className="btn btn-pri btn-sm mt-2" onClick={addResponse}><I n="send" size={13} />Отправить ответ</button>
            </div>
            {me.role !== "employee" && (
              <div className="border-t border-line pt-3">
                <b className="text-[12px] block mb-2">Изменить статус</b>
                <div className="flex gap-2">
                  {(["new", "in_progress", "resolved", "closed"] as const).map((s) => (
                    <button key={s} className={`btn btn-sm ${selectedTicket.status === s ? "btn-pri" : "btn-ghost"}`} onClick={() => { updateStatus(selectedTicket.id, s); setSelectedTicket({ ...selectedTicket, status: s }); }}>
                      {statusLabels[s].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
