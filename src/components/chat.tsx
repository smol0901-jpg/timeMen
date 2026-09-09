import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore, userById, wsName } from "../lib/store";
import { ChatThread, Attachment } from "../lib/types";
import { relTime, fileSize } from "../lib/time";
import { I, Avatar, Modal, Field, useToast, Empty, Confirm } from "./ui";

export default function ChatView() {
  const { db, me, ensureDm, createGroup, sendMessage, deleteThread, uploadAttachment } = useStore();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [grpOpen, setGrpOpen] = useState(false);
  const [gName, setGName] = useState("");
  const [gWs, setGWs] = useState<string>("");
  const [gMembers, setGMembers] = useState<string[]>([]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  if (!me) return null;

  const myThreads = useMemo(
    () => db.threads.filter((t) => t.members.includes(me.id))
      .sort((a, b) => lastTs(db.messages, b.id).localeCompare(lastTs(db.messages, a.id))),
    [db.threads, db.messages, me.id],
  );
  const active = myThreads.find((t) => t.id === activeId) || null;
  const msgs = active ? db.messages.filter((m) => m.threadId === active.id).sort((a, b) => a.ts.localeCompare(b.ts)) : [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, activeId]);

  const threadTitle = (t: ChatThread) => {
    if (t.kind === "group") return t.name;
    const other = t.members.find((m) => m !== me.id);
    return userById(db, other || "")?.name || "Диалог";
  };
  const threadSub = (t: ChatThread) => {
    if (t.kind === "group") {
      const ws = t.workshopId ? wsName(db, t.workshopId) : `${t.members.length} участн.`;
      return `группа · ${ws}`;
    }
    const other = userById(db, t.members.find((m) => m !== me.id) || "");
    return other ? wsName(db, other.workshopId) : "";
  };

  const admins = db.users.filter((u) => u.role !== "employee" && u.active);
  const send = async () => {
    if (!active || (!text.trim())) return;
    sendMessage(active.id, text.trim(), null);
    setText("");
  };
  const sendFile = async (f: File | undefined) => {
    if (!f || !active) return;
    setBusy(true);
    try {
      const att: Attachment = await uploadAttachment(f);
      sendMessage(active.id, "", att);
    } catch { toast("Файл слишком большой", "bad"); }
    setBusy(false);
  };

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start h-full">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <b className="font-display text-sm">Сообщения</b>
          {me.role !== "employee" && (
            <button className="btn btn-soft btn-sm ml-auto" onClick={() => { setGrpOpen(true); setGName(""); setGMembers([]); setGWs(""); }}>
              <I n="plus" size={13} />Группа
            </button>
          )}
        </div>
        <div className="max-h-[260px] lg:max-h-[62vh] overflow-y-auto">
          {myThreads.length === 0 && <Empty icon="chat" title="Пока нет диалогов" text={me.role === "employee" ? "Напишите администрации — кнопка ниже." : "Откройте диалог с сотрудником или создайте группу цеха."} />}
          {myThreads.map((t) => {
            const last = [...db.messages].reverse().find((m) => m.threadId === t.id);
            const other = t.kind === "dm" ? userById(db, t.members.find((m) => m !== me.id) || "") : null;
            return (
              <button key={t.id} onClick={() => setActiveId(t.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left border-b border-line/60 transition ${activeId === t.id ? "bg-accent-soft/60" : "hover:bg-paper"}`}>
                {t.kind === "group" ? (
                  <span className="w-9 h-9 rounded-full grid place-items-center text-white font-extrabold text-xs shrink-0" style={{ background: t.workshopId ? db.workshops.find((w) => w.id === t.workshopId)?.color : "#3f6d9e" }}>
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                ) : <Avatar u={other} size={36} />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold truncate">{threadTitle(t)}</span>
                  <span className="block text-[11px] text-mute font-bold truncate">
                    {last ? `${userById(db, last.userId)?.name.split(" ")[0] || "?"}: ${last.text || (last.file ? "📎 " + last.file.name : "")}` : threadSub(t)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {me.role === "employee" && (
          <div className="p-3 border-t border-line bg-paper/50">
            <span className="lbl">Написать администрации</span>
            <div className="grid gap-1.5">
              {admins.map((a) => (
                <button key={a.id} className="btn btn-ghost btn-sm justify-start" onClick={() => { setActiveId(ensureDm(a.id)); }}>
                  <Avatar u={a} size={22} />{a.name}
                </button>
              ))}
              {admins.length === 0 && <span className="text-[11px] text-mute font-bold">Администрации пока нет</span>}
            </div>
          </div>
        )}
        {me.role !== "employee" && (
          <div className="p-3 border-t border-line bg-paper/50">
            <span className="lbl">Диалог с сотрудником</span>
            <div className="grid gap-1.5 max-h-40 overflow-y-auto">
              {db.users.filter((u) => u.role === "employee" && u.active).map((u) => (
                <button key={u.id} className="btn btn-ghost btn-sm justify-start" onClick={() => setActiveId(ensureDm(u.id))}>
                  <Avatar u={u} size={22} />{u.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card flex flex-col min-h-[420px] lg:min-h-[62vh]">
        {!active ? (
          <Empty icon="chat" title="Выберите диалог" text="Личная переписка с администрацией и групповые чаты цехов. Всё хранится на сервере." />
        ) : (
          <>
            <div className="px-4 py-3 border-b border-line flex items-center gap-3 shrink-0">
              <div className="min-w-0">
                <b className="text-sm block truncate">{threadTitle(active)}</b>
                <span className="text-[11px] text-mute font-bold">{threadSub(active)} · {active.members.length} участн.</span>
              </div>
              {(me.role !== "employee" || active.createdBy === me.id) && (
                <button className="ml-auto w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition" onClick={() => setConfirmDel(active.id)} title="Удалить чат">
                  <I n="trash" size={15} />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid gap-3 bg-paper/40">
              {msgs.length === 0 && <p className="text-center text-[12px] font-bold text-mute py-6">Сообщений пока нет — начните обсуждение.</p>}
              {msgs.map((m) => {
                const mine = m.userId === me.id;
                const u = userById(db, m.userId);
                return (
                  <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                    <Avatar u={u} size={30} />
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm border ${mine ? "bg-steel-900 text-paper border-steel-900 rounded-tr-sm" : "bg-surface border-line rounded-tl-sm"}`}>
                      {!mine && active.kind === "group" && <div className="text-[11px] font-extrabold text-accent-deep mb-0.5">{u?.name}</div>}
                      {m.text && <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>}
                      {m.file && (
                        <a href={m.file.src} download={m.file.name} className={`flex items-center gap-2 text-xs font-bold rounded-lg px-2.5 py-2 mt-1 ${mine ? "bg-white/10 hover:bg-white/20" : "bg-paper border border-line hover:border-accent"}`}>
                          <I n="file" size={14} /><span className="truncate max-w-[180px]">{m.file.name}</span><span className={mine ? "text-white/60" : "text-mute"}>{fileSize(m.file.size)}</span>
                        </a>
                      )}
                      <div className={`text-[10px] font-bold mt-1 ${mine ? "text-white/50" : "text-mute"}`}>{relTime(m.ts)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form className="p-3 border-t border-line flex items-center gap-2 shrink-0" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { sendFile(e.target.files?.[0]); e.target.value = ""; }} />
              <button type="button" className="btn btn-ghost !px-3" onClick={() => fileRef.current?.click()} disabled={busy} title="Прикрепить файл">
                <I n="file" size={16} />
              </button>
              <input className="input" placeholder={busy ? "Отправка файла…" : "Сообщение…"} value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn btn-pri !px-4" type="submit" disabled={!text.trim()}><I n="send" size={16} /></button>
            </form>
          </>
        )}
      </div>

      <Modal open={grpOpen} onClose={() => setGrpOpen(false)} title="Новая группа"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setGrpOpen(false)}>Отмена</button>
          <button className="btn btn-pri" disabled={!gName.trim() || gMembers.length === 0} onClick={() => {
            createGroup(gName.trim(), gWs || null, gMembers);
            setGrpOpen(false);
            toast("Группа создана", "ok");
          }}><I n="check" size={15} />Создать</button>
        </>}>
        <div className="grid gap-4">
          <Field label="Название группы"><input className="input" value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Например: Обвалка — координация" /></Field>
          <Field label="Привязать к цеху (необязательно)">
            <select className="input" value={gWs} onChange={(e) => { setGWs(e.target.value); if (e.target.value) setGMembers(db.users.filter((u) => u.role === "employee" && u.workshopId === e.target.value).map((u) => u.id)); }}>
              <option value="">Без привязки — выбрать вручную</option>
              {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <div>
            <span className="lbl">Участники ({gMembers.length})</span>
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto border border-line rounded-lg p-2 bg-paper/40">
              {db.users.filter((u) => u.active && u.id !== me.id).map((u) => (
                <label key={u.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition ${gMembers.includes(u.id) ? "bg-accent-soft" : "hover:bg-paper"}`}>
                  <input type="checkbox" checked={gMembers.includes(u.id)} onChange={() => setGMembers(gMembers.includes(u.id) ? gMembers.filter((x) => x !== u.id) : [...gMembers, u.id])} />
                  <Avatar u={u} size={24} /><span className="text-xs font-bold truncate">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Удалить чат?"
        text="Чат и вся переписка будут удалены для всех участников."
        onYes={() => { if (confirmDel) { deleteThread(confirmDel); setActiveId(null); toast("Чат удалён"); } }} />
    </div>
  );
}

function lastTs(msgs: { threadId: string; ts: string }[], threadId: string): string {
  let m = "";
  for (const x of msgs) if (x.threadId === threadId && x.ts > m) m = x.ts;
  return m;
}
