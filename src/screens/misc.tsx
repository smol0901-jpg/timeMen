import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore, userById, wsName, wallPulse, summarizeAll, remindersFor, pieceSumOf, careerData } from "../lib/store";
import { MODULES, API_ENDPOINTS, SHIFT_META, Attachment } from "../lib/types";
import { todayKey, addDaysKey, monthStart, monthEnd, monthTitle, fmtDateFull, fmtMoney, fmtMin, nowMin, relTime, hDec, rangeKeys, weekdayIdx, fmtDurH } from "../lib/time";
import { I, Avatar, useToast, Tabs, Field, Empty, Seg, Confirm, Toggle, Modal, RoleBadge, useNow } from "../components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell, ComposedChart, Line } from "recharts";

const BGS: Record<string, string> = {
  g1: "linear-gradient(120deg,#fbeadb,#fdf3e7 60%,#fff)",
  g2: "linear-gradient(120deg,#e7eef6,#eef4fa 60%,#fff)",
  g3: "linear-gradient(120deg,#e2f2ea,#eef8f3 60%,#fff)",
  g4: "linear-gradient(120deg,#14181f,#232b38)",
};

// ================= СТЕНА =================
export function FeedView() {
  const { db, me, addPost, deletePost, toggleLike, addComment, togglePin, toggleFav, uploadAttachment } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("feed");
  const [text, setText] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [link, setLink] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState(false);
  const [mention, setMention] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ list: string[]; i: number } | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  if (!me) return null;
  const canManage = me.role !== "employee";
  const pulse = wallPulse(db);

  const allPosts = [...db.posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts.localeCompare(a.ts));
  const posts = tab === "favs" ? allPosts.filter((p) => (p.favs || []).includes(me.id)) : allPosts;
  const gallery: string[] = [];
  db.posts.forEach((p) => { if (p.image) gallery.push(p.image); p.attachments.forEach((a) => { if (a.type.startsWith("image/")) gallery.push(a.src); }); });

  const publish = () => {
    if (!text.trim() && !img && !link && photos.length === 0 && files.length === 0 && !bg) return;
    addPost(text.trim(), img, link.trim() || null, bg, animated, [...photos, ...files]);
    setText(""); setImg(null); setPhotos([]); setFiles([]); setLink(""); setBg(null); setAnimated(false);
    toast("Опубликовано на стене", "ok");
  };
  const insertMention = (name: string) => {
    setText((t) => t + (t.endsWith(" ") || !t ? "" : " ") + "@" + name.split(" ")[0] + " ");
    setMention(false);
    taRef.current?.focus();
  };

  return (
    <div className="max-w-2xl mx-auto grid gap-4">
      <div className="card p-4 anim-rise" style={{ background: BGS.g2 }}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-night-soft text-night grid place-items-center shrink-0"><I n="brain" size={19} /></span>
          <div className="min-w-0">
            <b className="text-sm block font-display">ИИ-пульс стены</b>
            <p className="text-[12px] font-bold text-mute leading-snug">{pulse.lines.slice(0, 2).join(" ")}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <span className="badge bg-surface text-ink border border-line">{pulse.posts7} записей / 7 дн</span>
          <span className="badge bg-surface text-ink border border-line">{pulse.engagement} реакций</span>
          {pulse.topAuthor && <span className="badge bg-surface text-ink border border-line"><I n="star" size={11} />{pulse.topAuthor.name.split(" ")[0]}</span>}
        </div>
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "feed", label: "Лента", icon: "feed" },
        { id: "favs", label: "Избранное", icon: "star", count: (me && db.posts.filter((p) => (p.favs || []).includes(me.id)).length) || 0 },
      ]} />

      <div className="card p-4">
        <div className="flex gap-3">
          <Avatar u={me} size={40} />
          <div className="flex-1 min-w-0">
            <div className="relative">
              <textarea ref={taRef} className="input !border-transparent !bg-paper focus:!bg-surface focus:!border-accent" rows={3}
                placeholder="Что нового? Упомяните коллегу через @…"
                value={text} onChange={(e) => { setText(e.target.value); setMention(e.target.value.endsWith("@")); }} />
              {mention && (
                <div className="absolute left-2 top-full mt-1 card z-30 w-64 max-h-52 overflow-y-auto anim-pop">
                  {db.users.filter((u) => u.active && !u.archived && u.id !== me.id).map((u) => (
                    <button key={u.id} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-paper transition" onClick={() => insertMention(u.name)}>
                      <Avatar u={u} size={24} /><span className="text-[12.5px] font-bold">{u.name}</span><span className="text-[10px] text-mute font-bold ml-auto">{wsName(db, u.workshopId)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {img && (
              <div className="relative mt-2 inline-block">
                <img src={img} alt="" className="rounded-xl border border-line max-h-60" />
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-steel-950/70 text-white grid place-items-center hover:bg-bad transition" onClick={() => setImg(null)}><I n="x" size={14} /></button>
              </div>
            )}
            {(photos.length > 0 || files.length > 0) && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {photos.map((p, i) => (
                  <span key={i} className="relative">
                    <img src={p.src} alt="" className="w-16 h-16 rounded-lg object-cover border border-line" />
                    <button className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-bad text-white grid place-items-center" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}><I n="x" size={10} /></button>
                  </span>
                ))}
                {files.map((p, i) => (
                  <span key={i} className="badge bg-paper text-ink border border-line">{p.name.slice(0, 18)}
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))}><I n="x" size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const list = Array.from(e.target.files || []);
                e.target.value = "";
                if (!list.length) return;
                setBusy(true);
                const room = 10 - photos.length;
                for (const f of list.slice(0, room)) {
                  try {
                    const a = await uploadAttachment(f);
                    if (!img) setImg(a.src); else setPhotos((p) => [...p, a]);
                  } catch { toast(`${f.name}: слишком большой`, "bad"); }
                }
                setBusy(false);
              }} />
              <button className="btn btn-ghost btn-sm" onClick={() => imgRef.current?.click()}><I n="images" size={14} />Фото ({photos.length + (img ? 1 : 0)}/10)</button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={async (e) => {
                const list = Array.from(e.target.files || []);
                e.target.value = "";
                setBusy(true);
                const atts: Attachment[] = [];
                for (const f of list.slice(0, 5)) { try { atts.push(await uploadAttachment(f)); } catch { toast(`${f.name}: ошибка или слишком большой`, "bad"); } }
                setFiles((prev) => [...prev, ...atts]);
                setBusy(false);
              }} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><I n="file" size={14} />Файлы</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDraw(true)}><I n="draw" size={14} />Рисунок</button>
              <button className={`btn btn-ghost btn-sm ${bg ? "!border-accent !text-accent-deep" : ""}`} onClick={() => setBg(bg ? null : "g1")}><I n="feed" size={14} />Фон</button>
              <button className={`btn btn-ghost btn-sm ${animated ? "!border-accent !text-accent-deep" : ""}`} onClick={() => setAnimated(!animated)}><I n="zap" size={14} />Анимация</button>
              <span className="flex-1" />
              {busy && <span className="text-[11px] font-bold text-mute">обработка…</span>}
              <button className="btn btn-pri btn-sm" onClick={publish}><I n="send" size={14} />Опубликовать</button>
            </div>
            {link !== "" || true ? (
              <input className="input !h-8 !text-[12px] mt-2" placeholder="Ссылка (https://…)" value={link} onChange={(e) => setLink(e.target.value)} />
            ) : null}
          </div>
        </div>
      </div>

      {posts.length === 0 && <div className="card"><Empty icon="feed" title={tab === "favs" ? "В избранном пусто" : "Стена пуста"} text={tab === "favs" ? "Отмечайте записи звёздочкой." : "Опубликуйте первую запись."} /></div>}
      {posts.map((p, i) => {
        const author = userById(db, p.userId);
        const liked = p.likes.includes(me.id);
        const fav = (p.favs || []).includes(me.id);
        const mine = p.userId === me.id;
        const imgs = [p.image, ...p.attachments.filter((a) => a.type.startsWith("image/")).map((a) => a.src)].filter(Boolean) as string[];
        return (
          <article key={p.id} className="card anim-rise overflow-hidden" style={{ animationDelay: `${Math.min(i * 40, 300)}ms`, background: p.bg ? BGS[p.bg] : undefined }}>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <Avatar u={author} size={40} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-sm truncate">{author?.name || "Удалённый аккаунт"}</b>
                    {author && <RoleBadge role={author.role} />}
                    {p.pinned && <span className="badge bg-accent-soft text-accent-deep"><I n="pin" size={11} />закреп</span>}
                  </div>
                  <div className="text-[11px] text-mute font-bold">{author ? wsName(db, author.workshopId) : "—"} · {relTime(p.ts)}</div>
                </div>
                <div className="ml-auto flex gap-1">
                  <button className={`w-8 h-8 rounded-lg grid place-items-center transition ${fav ? "text-accent-deep bg-accent-soft" : "text-mute hover:bg-paper"}`} onClick={() => toggleFav(p.id)} title="В избранное"><I n="star" size={15} /></button>
                  {canManage && <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-paper hover:text-accent transition" onClick={() => togglePin(p.id)}><I n="pin" size={15} /></button>}
                  {(mine || canManage) && <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition" onClick={() => setConfirmDel(p.id)}><I n="trash" size={15} /></button>}
                </div>
              </div>
              {p.text && <MentionText text={p.text} />}
              {p.link && <a href={p.link.startsWith("http") ? p.link : `https://${p.link}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-night hover:underline"><I n="link" size={14} />{p.link}</a>}
            </div>
            {imgs.length > 0 && (
              <div className={`grid gap-0.5 ${imgs.length === 1 ? "" : imgs.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {imgs.map((src, j) => (
                  <button key={j} className="relative overflow-hidden group" onClick={() => setLightbox({ list: imgs, i: j })}>
                    <img src={src} alt="" loading="lazy" className={`w-full object-cover border-y border-line transition group-hover:scale-[1.03] ${imgs.length === 1 ? "max-h-[420px]" : "h-36 sm:h-44"}`} />
                  </button>
                ))}
              </div>
            )}
            {p.attachments.filter((a) => !a.type.startsWith("image/")).map((a, j) => (
              <div key={j} className="px-4 py-2 flex items-center gap-2">
                <a href={a.src} download={a.name} className="flex items-center gap-2.5 border border-line rounded-lg px-3 py-2 hover:border-accent transition flex-1 min-w-0">
                  <I n="file" size={16} className="text-mute shrink-0" />
                  <span className="text-[12.5px] font-bold truncate">{a.name}</span>
                  <span className="text-[10.5px] text-mute font-bold ml-auto shrink-0">{Math.round(a.size / 1024)} КБ</span>
                  <I n="download" size={14} className="text-mute shrink-0" />
                </a>
              </div>
            ))}
            <PostActions p={p} liked={liked} meId={me.id} onLike={() => toggleLike(p.id)} onComment={(t) => addComment(p.id, t)} />
          </article>
        );
      })}

      {draw && <DrawModal onClose={() => setDraw(false)} onSave={(src) => { setImg(src); setDraw(false); toast("Рисунок добавлен к записи", "ok"); }} />}

      {lightbox && (
        <div className="fixed inset-0 z-[80] bg-steel-950/90 grid place-items-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox.list[lightbox.i]} alt="" className="max-w-full max-h-[85vh] rounded-xl anim-pop" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-5 flex gap-3">
            <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, i: (lightbox.i - 1 + lightbox.list.length) % lightbox.list.length }); }}><I n="chevL" size={16} /></button>
            <span className="text-paper font-bold self-center">{lightbox.i + 1} / {lightbox.list.length}</span>
            <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, i: (lightbox.i + 1) % lightbox.list.length }); }}><I n="chevR" size={16} /></button>
          </div>
        </div>
      )}

      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Удалить запись?" text="Безвозвратно."
        onYes={() => { if (confirmDel) { deletePost(confirmDel); toast("Удалено"); } }} />
    </div>
  );
}

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[\wа-яА-ЯёЁ-]+)/g);
  return (
    <p className={`mt-3 text-[15px] leading-relaxed whitespace-pre-wrap`}>
      {parts.map((p, i) => p.startsWith("@") ? <b key={i} className="text-accent-deep">{p}</b> : <React.Fragment key={i}>{p}</React.Fragment>)}
    </p>
  );
}

function PostActions({ p, liked, meId, onLike, onComment }: { p: { likes: string[]; comments: { id: string; userId: string; text: string; ts: string }[] }; liked: boolean; meId: string; onLike: () => void; onComment: (t: string) => void }) {
  const { db, me } = useStore();
  const [openC, setOpenC] = useState(false);
  const [ct, setCt] = useState("");
  return (
    <>
      <div className="px-4 py-2.5 flex items-center gap-2">
        <button onClick={onLike} className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-extrabold transition-all active:scale-90 ${liked ? "bg-bad-soft text-bad" : "bg-paper text-mute hover:text-bad"}`}>
          <I n="heart" size={14} />{p.likes.length || ""}
        </button>
        <button onClick={() => setOpenC(!openC)} className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-extrabold transition ${openC ? "bg-night-soft text-night" : "bg-paper text-mute hover:text-night"}`}>
          <I n="comment" size={14} />{p.comments.length || ""}
        </button>
        {p.likes.length > 0 && (
          <span className="ml-auto text-[11px] font-bold text-mute truncate">
            {p.likes.slice(0, 3).map((id) => userById(db, id)?.name.split(" ")[0]).filter(Boolean).join(", ")}
            {p.likes.length > 3 && ` +${p.likes.length - 3}`}
          </span>
        )}
      </div>
      {openC && (
        <div className="border-t border-line bg-paper/50 p-4 grid gap-3">
          {p.comments.map((c) => {
            const cu = userById(db, c.userId);
            return (
              <div key={c.id} className="flex gap-2.5">
                <Avatar u={cu} size={28} />
                <div className="bg-surface border border-line rounded-xl rounded-tl-sm px-3 py-2 text-sm flex-1">
                  <div className="flex items-baseline gap-2"><b className="text-xs">{cu?.name || "—"}</b><span className="text-[10px] text-mute font-bold">{relTime(c.ts)}</span></div>
                  <div className="mt-0.5">{c.text}</div>
                </div>
              </div>
            );
          })}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ct.trim()) { onComment(ct.trim()); setCt(""); } }}>
            <Avatar u={me} size={28} />
            <input className="input !h-9 text-sm flex-1" placeholder="Комментарий…" value={ct} onChange={(e) => setCt(e.target.value)} />
            <button className="btn btn-dark !h-9 !px-3" type="submit"><I n="send" size={14} /></button>
          </form>
        </div>
      )}
    </>
  );
}

function DrawModal({ onClose, onSave }: { onClose: () => void; onSave: (src: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#e56f24");
  const [w, setW] = useState(5);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };
  return (
    <Modal open onClose={onClose} title="Рисунок на стену" w="max-w-2xl"
      foot={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-pri" onClick={() => onSave(ref.current!.toDataURL("image/jpeg", 0.85))}><I n="check" size={15} />Добавить</button>
      </>}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {["#e56f24", "#17875c", "#3f6d9e", "#c74436", "#171b22", "#a97a12"].map((c) => (
          <button key={c} className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-ink scale-110" : "border-line"}`} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
        <input type="range" min={2} max={16} value={w} onChange={(e) => setW(Number(e.target.value))} className="w-28 accent-[#e56f24]" />
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { const c = ref.current!; const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }}><I n="trash" size={13} />Очистить</button>
      </div>
      <canvas ref={ref} width={760} height={420} className="w-full rounded-xl border border-line touch-none cursor-crosshair"
        onPointerDown={(e) => { drawing.current = true; const ctx = ref.current!.getContext("2d")!; const p = pos(e); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(p.x, p.y); (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (!drawing.current) return; const ctx = ref.current!.getContext("2d")!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }}
        onPointerUp={() => { drawing.current = false; }} />
    </Modal>
  );
}

// ================= СООБЩЕНИЯ =================
export function ChatView() {
  const { db, me, ensureDm, createGroup, deleteThread, sendMessage, uploadAttachment } = useStore();
  const { toast } = useToast();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [grp, setGrp] = useState(false);
  const [gName, setGName] = useState("");
  const [gWs, setGWs] = useState("");
  const [gMembers, setGMembers] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  if (!me) return null;
  const isAdmin = me.role !== "employee";
  const myThreads = db.threads.filter((t) => t.members.includes(me.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const thread = db.threads.find((t) => t.id === active) || null;
  const msgs = db.messages.filter((m) => m.threadId === active).sort((a, b) => a.ts.localeCompare(b.ts));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, active]);

  const send = () => {
    if (!active || !text.trim()) return;
    sendMessage(active, text.trim(), null);
    setText("");
  };

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start max-w-5xl mx-auto">
      <div className="card p-3">
        <div className="flex items-center gap-2 mb-2">
          <b className="font-display text-[13px] px-1">Сообщения</b>
          {isAdmin && <button className="btn btn-soft btn-sm ml-auto" onClick={() => setGrp(true)}><I n="plus" size={13} />Группа</button>}
        </div>
        {!isAdmin && (
          <button className="btn btn-ghost btn-sm w-full mb-2" onClick={() => {
            const admin = db.users.find((u) => u.role === "admin" || u.role === "superadmin");
            if (admin) { setActive(ensureDm(admin.id)); toast("Чат с администрацией открыт", "ok"); }
            else toast("Администратор не найден", "bad");
          }}><I n="chat" size={14} />Написать администрации</button>
        )}
        <div className="grid gap-1 max-h-[60vh] overflow-y-auto dark-scroll">
          {myThreads.map((t) => {
            const other = t.kind === "dm" ? userById(db, t.members.find((m) => m !== me.id) || "") : null;
            const last = db.messages.filter((m) => m.threadId === t.id).slice(-1)[0];
            return (
              <button key={t.id} onClick={() => setActive(t.id)} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${active === t.id ? "bg-accent-soft border border-accent" : "hover:bg-paper border border-transparent"}`}>
                {t.kind === "group" ? <span className="w-9 h-9 rounded-full bg-night-soft text-night grid place-items-center shrink-0"><I n="users" size={16} /></span> : <Avatar u={other} size={36} />}
                <span className="min-w-0 flex-1">
                  <b className="text-[12.5px] block truncate">{t.kind === "group" ? t.name : other?.name || "—"}</b>
                  <span className="text-[11px] text-mute font-bold truncate block">{last ? `${userById(db, last.userId)?.name.split(" ")[0]}: ${last.text || "📎"}` : "нет сообщений"}</span>
                </span>
              </button>
            );
          })}
          {myThreads.length === 0 && <p className="text-[12px] font-bold text-mute text-center py-6">Чатов пока нет</p>}
        </div>
      </div>

      <div className="card flex flex-col min-h-[60vh]">
        {!thread ? <Empty icon="chat" title="Выберите чат" text="Личные сообщения и группы цехов. Всё синхронизируется в реальном времени." /> : (
          <>
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <b className="font-display text-[13px] truncate">{thread.kind === "group" ? thread.name : userById(db, thread.members.find((m) => m !== me.id) || "")?.name}</b>
              <span className="text-[11px] text-mute font-bold">{thread.members.length} уч.</span>
              {isAdmin && <button className="w-8 h-8 ml-auto rounded-lg grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition" onClick={() => { deleteThread(thread.id); setActive(null); }}><I n="trash" size={14} /></button>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid gap-3 content-start">
              {msgs.map((m) => {
                const u = userById(db, m.userId);
                const own = m.userId === me.id;
                return (
                  <div key={m.id} className={`flex gap-2.5 ${own ? "flex-row-reverse" : ""}`}>
                    <Avatar u={u} size={30} />
                    <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${own ? "bg-steel-900 text-paper rounded-tr-sm" : "bg-paper border border-line rounded-tl-sm"}`}>
                      {!own && <b className="text-[11px] block mb-0.5 opacity-70">{u?.name}</b>}
                      {m.text && <span className="whitespace-pre-wrap">{m.text}</span>}
                      {m.file && (
                        m.file.type.startsWith("image/") ? <img src={m.file.src} alt="" className="rounded-lg max-h-52 mt-1" /> :
                          <a href={m.file.src} download={m.file.name} className="flex items-center gap-2 font-bold underline"><I n="file" size={14} />{m.file.name}</a>
                      )}
                      <span className={`block text-[9.5px] font-bold mt-1 ${own ? "text-steel-400" : "text-mute"}`}>{relTime(m.ts)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="p-3 border-t border-line flex gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !active) return;
                try { const a = await uploadAttachment(f); sendMessage(active, "", a); } catch { toast("Файл слишком большой", "bad"); }
              }} />
              <button className="btn btn-ghost !px-3" onClick={() => fileRef.current?.click()}><I n="file" size={16} /></button>
              <input className="input flex-1" placeholder="Сообщение…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
              <button className="btn btn-pri" onClick={send}><I n="send" size={16} /></button>
            </div>
          </>
        )}
      </div>

      <Modal open={grp} onClose={() => setGrp(false)} title="Новая группа (только админ)" w="max-w-md"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setGrp(false)}>Отмена</button>
          <button className="btn btn-pri" onClick={() => {
            if (!gName.trim() || gMembers.size === 0) { toast("Название и участники обязательны", "bad"); return; }
            const id = createGroup(gName.trim(), gWs || null, [...gMembers]);
            setActive(id); setGrp(false); setGName(""); setGMembers(new Set());
            toast("Группа создана", "ok");
          }}><I n="check" size={15} />Создать</button>
        </>}>
        <div className="grid gap-3">
          <Field label="Название"><input className="input" value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Цех №1 — общее" /></Field>
          <Field label="Привязка к цеху (необязательно)">
            <select className="input" value={gWs} onChange={(e) => setGWs(e.target.value)}><option value="">—</option>{db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          </Field>
          <div>
            <span className="lbl">Участники</span>
            <div className="grid gap-1 max-h-52 overflow-y-auto dark-scroll">
              {db.users.filter((u) => u.active && !u.archived && u.id !== me.id).map((u) => (
                <button key={u.id} onClick={() => { const n = new Set(gMembers); n.has(u.id) ? n.delete(u.id) : n.add(u.id); setGMembers(n); }}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left ${gMembers.has(u.id) ? "border-accent bg-accent-soft" : "border-line"}`}>
                  <Avatar u={u} size={24} /><b className="text-[12px]">{u.name}</b><span className="text-[10px] text-mute font-bold ml-auto">{wsName(db, u.workshopId)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ================= ИГРЫ + ДУЭЛИ + УТИЛИТЫ =================
export function GamesView() {
  const [tab, setTab] = useState("snake");
  return (
    <div className="grid gap-4 max-w-4xl mx-auto">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "snake", label: "Змейка", icon: "snake" },
        { id: "tictac", label: "Крестики", icon: "grid" },
        { id: "checkers", label: "Шашки", icon: "target" },
        { id: "duel", label: "Дуэли", icon: "zap" },
        { id: "utils", label: "Утилиты", icon: "calc" },
        { id: "more", label: "Ещё", icon: "game" },
      ]} />
      {tab === "snake" && <Snake />}
      {tab === "tictac" && <TicTac />}
      {tab === "checkers" && <Checkers />}
      {tab === "duel" && <Duels />}
      {tab === "utils" && <Utils />}
      {tab === "more" && <MoreGames />}
      <Leaderboard />
    </div>
  );
}

function Leaderboard() {
  const { db } = useStore();
  if (db.scores.length === 0) return null;
  return (
    <div className="card p-4">
      <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="star" size={16} className="text-accent" />Рейтинг компании</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {db.scores.slice(0, 12).map((s) => {
          const u = userById(db, s.userId);
          return (
            <div key={s.id} className="flex items-center gap-2.5 border border-line rounded-lg px-3 py-2">
              <Avatar u={u} size={28} />
              <div className="min-w-0 flex-1"><b className="text-xs block truncate">{u?.name || "—"}</b><span className="text-[10px] text-mute font-bold uppercase">{s.game}</span></div>
              <span className="font-display font-bold tnum text-accent-deep">{s.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Snake() {
  const { addScore } = useStore();
  const { toast } = useToast();
  const cvs = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("snake.best") || 0));
  const st = useRef({ snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, food: { x: 16, y: 10 }, score: 0, alive: true });
  const randFood = () => ({ x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 24) });
  const setDir = (x: number, y: number) => { const d = st.current.dir; if (x === -d.x && y === -d.y) return; st.current.dir = { x, y }; };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") setDir(0, -1);
      if (e.key === "ArrowDown" || e.key === "s") setDir(0, 1);
      if (e.key === "ArrowLeft" || e.key === "a") setDir(-1, 0);
      if (e.key === "ArrowRight" || e.key === "d") setDir(1, 0);
      if (e.key.startsWith("Arrow")) e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const s = st.current;
      if (!s.alive) return;
      const head = { x: (s.snake[0].x + s.dir.x + 24) % 24, y: (s.snake[0].y + s.dir.y + 24) % 24 };
      if (s.snake.some((c) => c.x === head.x && c.y === head.y)) {
        s.alive = false;
        setRunning(false);
        addScore("Змейка", s.score);
        if (s.score > best) { setBest(s.score); localStorage.setItem("snake.best", String(s.score)); }
        toast(`Финиш! ${s.score} очков — в общем рейтинге`, "ok");
        return;
      }
      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) { s.score += 10; setScore(s.score); s.food = randFood(); }
      else s.snake.pop();
      const c = cvs.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      const cell = c.width / 24;
      ctx.fillStyle = "#14181f"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#1b212b";
      for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * cell, j * cell, cell, cell);
      ctx.fillStyle = "#e56f24";
      ctx.beginPath(); ctx.arc(s.food.x * cell + cell / 2, s.food.y * cell + cell / 2, cell / 2.6, 0, 7); ctx.fill();
      s.snake.forEach((p, i) => { ctx.fillStyle = i === 0 ? "#edf0f3" : "#17875c"; ctx.fillRect(p.x * cell + 1.5, p.y * cell + 1.5, cell - 3, cell - 3); });
    }, 110);
    return () => clearInterval(t);
  }, [running, best]);
  return (
    <div className="card p-5 flex flex-col items-center gap-4">
      <div className="flex items-center gap-3 w-full max-w-md flex-wrap">
        <span className="badge bg-paper text-ink">Счёт: <b className="tnum">{score}</b></span>
        <span className="badge bg-accent-soft text-accent-deep">Рекорд: <b className="tnum">{best}</b></span>
        <div className="ml-auto">
          {!running ? <button className="btn btn-pri btn-sm" onClick={() => { st.current = { snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, food: randFood(), score: 0, alive: true }; setScore(0); setRunning(true); }}><I n="play" size={13} />Старт</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => setRunning(false)}><I n="pause" size={13} />Пауза</button>}
        </div>
      </div>
      <canvas ref={cvs} width={432} height={432} className="rounded-xl border-4 border-steel-900 w-full max-w-[432px] aspect-square" />
      <div className="grid grid-cols-3 gap-1.5 lg:hidden">
        <span /><button className="btn btn-dark btn-sm" onClick={() => setDir(0, -1)}>▲</button><span />
        <button className="btn btn-dark btn-sm" onClick={() => setDir(-1, 0)}>◀</button>
        <button className="btn btn-dark btn-sm" onClick={() => setDir(0, 1)}>▼</button>
        <button className="btn btn-dark btn-sm" onClick={() => setDir(1, 0)}>▶</button>
      </div>
      <p className="text-[12px] text-mute font-bold">Стрелки/WASD · результат попадает в общий рейтинг и может быть опубликован на стене.</p>
    </div>
  );
}

function TicTac() {
  const { addScore } = useStore();
  const [b, setB] = useState<(null | "X" | "O")[]>(Array(9).fill(null));
  const [x, setX] = useState(true);
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const win = lines.map(([a, c2, d]) => b[a] && b[a] === b[c2] && b[a] === b[d] ? b[a] : null).find(Boolean) || null;
  const draw = !win && b.every(Boolean);
  const click = (i: number) => {
    if (b[i] || win) return;
    const nb = [...b]; nb[i] = x ? "X" : "O"; setB(nb);
    const w = lines.map(([a, c2, d]) => nb[a] && nb[a] === nb[c2] && nb[a] === nb[d] ? nb[a] : null).find(Boolean);
    if (w) addScore("Крестики-нолики", 1);
    setX(!x);
  };
  return (
    <div className="card p-5 max-w-md mx-auto w-full">
      <b className="font-display text-sm block text-center mb-4">{win ? `Победили ${win}!` : draw ? "Ничья" : `Ход: ${x ? "X" : "O"}`}</b>
      <div className="grid grid-cols-3 gap-2">
        {b.map((v, i) => (
          <button key={i} onClick={() => click(i)} className={`aspect-square rounded-xl border-2 font-display text-4xl font-bold transition-all active:scale-95 ${v === "X" ? "border-night text-night bg-night-soft" : v === "O" ? "border-accent text-accent-deep bg-accent-soft" : "border-line hover:border-steel-400 bg-paper"}`}>{v}</button>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm mt-4 mx-auto" onClick={() => { setB(Array(9).fill(null)); setX(true); }}><I n="history" size={13} />Новая партия</button>
    </div>
  );
}

function Checkers() {
  const { addScore } = useStore();
  const init = (): (null | "w" | "b")[] => {
    const b: (null | "w" | "b")[] = Array(64).fill(null);
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      if ((r + c) % 2 === 1) { if (r < 3) b[i] = "b"; if (r > 4) b[i] = "w"; }
    }
    return b;
  };
  const [board, setBoard] = useState(init);
  const [sel, setSel] = useState<number | null>(null);
  const [white, setWhite] = useState(true);
  const moves = (b: (null | "w" | "b")[], i: number): { to: number; cap?: number }[] => {
    const p = b[i]; if (!p) return [];
    const r = Math.floor(i / 8), c = i % 8;
    const dir = p === "w" ? -1 : 1;
    const out: { to: number; cap?: number }[] = [];
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !b[nr * 8 + nc]) out.push({ to: nr * 8 + nc });
      const cr = r + dir, cc = c + dc, jr = r + 2 * dir, jc = c + 2 * dc;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && b[cr * 8 + cc] && b[cr * 8 + cc] !== p && !b[jr * 8 + jc]) out.push({ to: jr * 8 + jc, cap: cr * 8 + cc });
    }
    return out;
  };
  const myMoves = sel !== null ? moves(board, sel) : [];
  const click = (i: number) => {
    if (sel === null) { if (board[i] && ((board[i] === "w") === white)) setSel(i); return; }
    const mv = myMoves.find((m) => m.to === i);
    if (board[i] && ((board[i] === "w") === white)) { setSel(i); return; }
    if (!mv) { setSel(null); return; }
    const nb = [...board];
    nb[mv.to] = nb[sel]; nb[sel] = null;
    if (mv.cap !== undefined) nb[mv.cap] = null;
    setBoard(nb); setSel(null); setWhite(!white);
    if (nb.filter((v) => v === "w").length === 0 || nb.filter((v) => v === "b").length === 0) addScore("Шашки", 1);
  };
  return (
    <div className="card p-5 max-w-md mx-auto w-full">
      <b className="font-display text-sm block text-center mb-3">Ход {white ? "белых" : "чёрных"}</b>
      <div className="grid grid-cols-8 rounded-xl overflow-hidden border-4 border-steel-900">
        {board.map((v, i) => {
          const r = Math.floor(i / 8), c = i % 8;
          const dark = (r + c) % 2 === 1;
          const canGo = myMoves.some((m) => m.to === i);
          return (
            <button key={i} onClick={() => click(i)} className={`aspect-square relative grid place-items-center ${dark ? "bg-steel-700" : "bg-[#e9e2d3]"} ${canGo ? "ring-2 ring-inset ring-ok" : ""} ${sel === i ? "ring-2 ring-inset ring-accent" : ""}`}>
              {v && <span className={`w-[72%] h-[72%] rounded-full border-4 ${v === "w" ? "bg-[#f2efe8] border-[#d8d2c2]" : "bg-steel-950 border-steel-700"}`} />}
              {canGo && !v && <span className="w-3 h-3 rounded-full bg-ok/70" />}
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost btn-sm mt-4 mx-auto" onClick={() => { setBoard(init()); setSel(null); setWhite(true); }}><I n="history" size={13} />Новая партия</button>
    </div>
  );
}

function Duels() {
  const { db, me, addChallenge, submitChallenge, postChallengeResult } = useStore();
  const { toast } = useToast();
  const [game, setGame] = useState("Змейка");
  const [opp, setOpp] = useState("");
  const [myScore, setMyScore] = useState<Record<string, string>>({});
  if (!me) return null;
  const mine = db.challenges.filter((c) => c.from === me.id || c.to === me.id);
  const emps = db.users.filter((u) => u.active && !u.archived && u.id !== me.id);
  return (
    <div className="grid gap-4">
      <div className="card p-4 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-extrabold uppercase text-mute">Вызов на дуэль:</span>
        <select className="input !w-44 !h-9" value={game} onChange={(e) => setGame(e.target.value)}>
          <option>Змейка</option><option>Шашки</option><option>Крестики-нолики</option><option>Нарды (счёт вручную)</option>
        </select>
        <select className="input !w-52 !h-9" value={opp} onChange={(e) => setOpp(e.target.value)}>
          <option value="">— соперник —</option>
          {emps.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className="btn btn-pri btn-sm" disabled={!opp} onClick={() => { addChallenge(game, opp); toast("Вызов отправлен — соперник увидит уведомление", "ok"); }}><I n="zap" size={13} />Вызвать</button>
        <span className="text-[11px] font-bold text-mute">Результаты синхронизируются между устройствами и могут быть опубликованы на стене.</span>
      </div>
      {mine.length === 0 && <div className="card"><Empty icon="zap" title="Дуэлей нет" text="Вызовите коллегу — сыграйте в перерыве." /></div>}
      {mine.map((c) => {
        const from = userById(db, c.from), to = userById(db, c.to);
        const iAmFrom = c.from === me.id;
        const myDone = iAmFrom ? c.scoreFrom !== null : c.scoreTo !== null;
        return (
          <div key={c.id} className="card p-4 anim-rise">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="badge bg-accent-soft text-accent-deep"><I n="game" size={11} />{c.game}</span>
              <b className="text-sm flex items-center gap-2"><Avatar u={from} size={24} />{from?.name}</b>
              <span className="font-display text-lg font-bold tnum">{c.scoreFrom ?? "–"} : {c.scoreTo ?? "–"}</span>
              <b className="text-sm flex items-center gap-2"><Avatar u={to} size={24} />{to?.name}</b>
              {c.done && <span className="badge bg-ok-soft text-ok ml-auto">завершена{c.scoreFrom !== c.scoreTo ? ` · победил ${((c.scoreFrom || 0) > (c.scoreTo || 0) ? from : to)?.name.split(" ")[0]}` : " · ничья"}</span>}
            </div>
            {!c.done && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {myDone ? <span className="text-[12px] font-bold text-ok flex items-center gap-1.5"><I n="check" size={14} />Ваш счёт принят, ждём соперника</span> : (
                  <>
                    <span className="text-[12px] font-bold">Ваш счёт:</span>
                    <input type="number" className="input !w-24 !h-8 tnum" value={myScore[c.id] || ""} onChange={(e) => setMyScore({ ...myScore, [c.id]: e.target.value })} />
                    <button className="btn btn-ok btn-sm" onClick={() => {
                      const s = Number(myScore[c.id]);
                      if (Number.isNaN(s)) { toast("Введите счёт", "bad"); return; }
                      submitChallenge(c.id, s);
                      toast("Счёт отправлен", "ok");
                    }}><I n="send" size={13} />Отправить</button>
                  </>
                )}
              </div>
            )}
            {c.done && (
              <button className="btn btn-soft btn-sm mt-3" onClick={() => { postChallengeResult(c.id); toast("Результат опубликован на стене", "ok"); }}><I n="feed" size={13} />На стену</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Utils() {
  return (
    <div className="grid sm:grid-cols-2 gap-4 items-start">
      <Converter /><ShiftEnd /><OvertimeCalc /><Lottery /><Dice /><Checklist /><DateDiff /><Split /><Pomodoro /><PieceCalc />
    </div>
  );
}
function UCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return <div className="card p-4"><h3 className="font-display text-[13px] font-semibold mb-3 flex items-center gap-2"><I n={icon} size={15} />{title}</h3>{children}</div>;
}
function Converter() {
  const [v, setV] = useState("100");
  const n = Number(v) || 0;
  return (
    <UCard icon="calc" title="Конвертер единиц">
      <input className="input !h-9 tnum" value={v} onChange={(e) => setV(e.target.value)} />
      <div className="grid grid-cols-2 gap-1.5 mt-2 text-[12px] font-bold">
        <span className="badge bg-paper text-ink">{n} кг = {(n / 1000).toFixed(3)} т</span>
        <span className="badge bg-paper text-ink">{n} кг = {(n * 2.2046).toFixed(1)} lb</span>
        <span className="badge bg-paper text-ink">{n} шт × 0.5 = {n * 0.5} кг (тушка)</span>
        <span className="badge bg-paper text-ink">{(n * 1000).toFixed(0)} г</span>
      </div>
    </UCard>
  );
}
function ShiftEnd() {
  const now = useNow();
  const minsLeft = (target: number) => { const cur = now.getHours() * 60 + now.getMinutes(); return ((target - cur) + 1440) % 1440; };
  return (
    <UCard icon="clock" title="До конца смены">
      <div className="grid gap-1.5">
        {[[480, "08:00 → 17:00"], [1200, "20:00 → 08:00"], [480 + 720, "08:00 → 20:00 (12 ч)"]].map(([m, l]) => (
          <div key={String(l)} className="flex items-center justify-between border border-line rounded-lg px-3 py-2">
            <span className="text-[12px] font-bold">{l}</span>
            <span className="font-mono tnum font-bold text-accent-deep">{fmtDurH(minsLeft(m as number))}</span>
          </div>
        ))}
      </div>
    </UCard>
  );
}
function OvertimeCalc() {
  const [h, setH] = useState("10");
  const [rate, setRate] = useState("320");
  const norm = 8;
  const hh = Number(h) || 0, rr = Number(rate) || 0;
  const ot = Math.max(0, hh - norm);
  return (
    <UCard icon="trend" title="Калькулятор переработки">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Часов за день"><input className="input !h-9 tnum" value={h} onChange={(e) => setH(e.target.value)} /></Field>
        <Field label="Ставка ₽/ч"><input className="input !h-9 tnum" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
      </div>
      <p className="text-[12.5px] font-bold mt-2">Переработка {ot} ч ×1.5 = <b className="text-ok">{fmtMoney(ot * rr * 1.5)}</b> · всего {fmtMoney(norm * rr + ot * rr * 1.5)}</p>
    </UCard>
  );
}
function Lottery() {
  const [list, setList] = useState("Иван, Пётр, Мария");
  const [res, setRes] = useState("");
  return (
    <UCard icon="users" title="Жеребьёвка">
      <textarea className="input" rows={2} value={list} onChange={(e) => setList(e.target.value)} />
      <button className="btn btn-dark btn-sm mt-2" onClick={() => {
        const arr = list.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
        if (arr.length) setRes(arr[Math.floor(Math.random() * arr.length)]);
      }}><I n="play" size={13} />Выбрать</button>
      {res && <p className="mt-2 font-display font-bold text-accent-deep">→ {res}</p>}
    </UCard>
  );
}
function Dice() {
  const [v, setV] = useState<number[] | null>(null);
  return (
    <UCard icon="target" title="Кубики / случайное число">
      <button className="btn btn-dark btn-sm" onClick={() => setV([1, 2].map(() => 1 + Math.floor(Math.random() * 6)))}><I n="play" size={13} />Бросить 2 кубика</button>
      {v && <p className="mt-2 font-display text-2xl font-bold tnum">{v[0]} + {v[1]} = {v[0] + v[1]}</p>}
    </UCard>
  );
}
function Checklist() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chk") || '[]') as { t: string; d: boolean }[]; } catch { return []; }
  });
  const [nt, setNt] = useState("");
  const save = (x: { t: string; d: boolean }[]) => { setItems(x); localStorage.setItem("chk", JSON.stringify(x)); };
  return (
    <UCard icon="check" title="Чек-лист смены">
      <div className="flex gap-2">
        <input className="input !h-9 flex-1" placeholder="Пункт…" value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nt.trim()) { save([...items, { t: nt.trim(), d: false }]); setNt(""); } }} />
        <button className="btn btn-dark btn-sm !h-9" onClick={() => { if (nt.trim()) { save([...items, { t: nt.trim(), d: false }]); setNt(""); } }}><I n="plus" size={13} /></button>
      </div>
      <div className="grid gap-1 mt-2">
        {items.map((it, i) => (
          <button key={i} className="flex items-center gap-2 text-left text-[12.5px] font-bold" onClick={() => save(items.map((x, j) => j === i ? { ...x, d: !x.d } : x))}>
            <span className={`w-4 h-4 rounded grid place-items-center shrink-0 ${it.d ? "bg-ok text-white" : "border border-line"}`}>{it.d && <I n="check" size={11} />}</span>
            <span className={it.d ? "line-through text-mute" : ""}>{it.t}</span>
            <span className="ml-auto w-5 h-5 grid place-items-center text-mute hover:text-bad" onClick={(e) => { e.stopPropagation(); save(items.filter((_, j) => j !== i)); }}><I n="x" size={12} /></span>
          </button>
        ))}
      </div>
    </UCard>
  );
}
function DateDiff() {
  const [a, setA] = useState(addDaysKey(todayKey(), -7));
  const [b, setB] = useState(todayKey());
  const days = Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  return (
    <UCard icon="cal" title="Разница дат">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className="input !h-9" value={a} onChange={(e) => setA(e.target.value)} />
        <input type="date" className="input !h-9" value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      <p className="text-[12.5px] font-bold mt-2">{days} дн. · рабочих ≈ {Math.max(0, days - Math.floor(days / 7) * 2)}</p>
    </UCard>
  );
}
function Split() {
  const [sum, setSum] = useState("3000");
  const [n, setN] = useState("4");
  const s = Number(sum) || 0, k = Math.max(1, Number(n) || 1);
  return (
    <UCard icon="coin" title="Разделить сумму">
      <div className="grid grid-cols-2 gap-2">
        <input className="input !h-9 tnum" value={sum} onChange={(e) => setSum(e.target.value)} placeholder="Сумма" />
        <input className="input !h-9 tnum" value={n} onChange={(e) => setN(e.target.value)} placeholder="На сколько" />
      </div>
      <p className="text-[12.5px] font-bold mt-2">По <b className="text-ok">{fmtMoney(s / k)}</b> с человека</p>
    </UCard>
  );
}
function Pomodoro() {
  const [left, setLeft] = useState(25 * 60);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run || left <= 0) { if (run) setRun(false); return; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [run, left]);
  return (
    <UCard icon="timer" title="Помодоро (перерыв)">
      <div className="font-mono tnum font-semibold text-3xl text-center">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</div>
      <div className="flex justify-center gap-2 mt-2">
        <button className="btn btn-ok btn-sm" onClick={() => setRun(!run)}><I n={run ? "pause" : "play"} size={13} /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setRun(false); setLeft(25 * 60); }}><I n="stop" size={13} /></button>
      </div>
    </UCard>
  );
}
function PieceCalc() {
  const [kg, setKg] = useState("50");
  const [price, setPrice] = useState("180");
  const res = (Number(kg) || 0) * (Number(price) || 0);
  return (
    <UCard icon="box" title="Сделка: кг × цена">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Кг"><input className="input !h-9 tnum" value={kg} onChange={(e) => setKg(e.target.value)} /></Field>
        <Field label="₽ за кг"><input className="input !h-9 tnum" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      </div>
      <p className="text-[12.5px] font-bold mt-2">Итого: <b className="text-ok">{fmtMoney(res)}</b></p>
    </UCard>
  );
}
function MoreGames() {
  const { db, me, addGameLink, removeGameLink } = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const isAdmin = me?.role !== "employee";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2"><I n="game" size={16} />Внешние игры и ссылки</h3>
        {isAdmin && <button className="btn btn-soft btn-sm ml-auto" onClick={() => setOpen(true)}><I n="plus" size={13} />Добавить</button>}
      </div>
      {db.games.length === 0 ? <Empty icon="game" title="Ссылок нет" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {db.games.map((g) => (
            <div key={g.id} className="flex items-center gap-2.5 border border-line rounded-xl px-3.5 py-3 hover:border-accent transition group">
              <span className="w-9 h-9 rounded-lg bg-night-soft text-night grid place-items-center shrink-0"><I n="game" size={17} /></span>
              <a href={g.url.startsWith("http") ? g.url : `https://${g.url}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <b className="text-sm block truncate group-hover:text-accent-deep transition">{g.name}</b>
                <span className="text-[10px] text-mute font-bold truncate block">{g.url}</span>
              </a>
              {isAdmin && <button className="w-7 h-7 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => { removeGameLink(g.id); toast("Удалено"); }}><I n="trash" size={13} /></button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Добавить игру / ссылку" w="max-w-sm"
        foot={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
          <button className="btn btn-pri" disabled={!name.trim() || !url.trim()} onClick={() => { addGameLink(name.trim(), url.trim()); setOpen(false); toast("Добавлено", "ok"); }}><I n="check" size={15} />Добавить</button></>}>
        <div className="grid gap-4">
          <Field label="Название"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Морской бой" /></Field>
          <Field label="URL или путь"><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ================= ИИ-АНАЛИТИК =================
export function AIView() {
  const { db, setSettings, askOllama } = useStore();
  const { toast } = useToast();
  const s = db.settings;
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState({ ollamaOn: s.ollamaOn, ollamaUrl: s.ollamaUrl, ollamaModel: s.ollamaModel });
  const mode = s.aiMode || "std";

  const rep = useMemo(() => {
    const tk = todayKey();
    const mf = monthStart(tk), mt = monthEnd(tk);
    const rows = summarizeAll(db, mf, mt);
    const plan = rows.reduce((x, r) => x + r.planMin, 0);
    const fact = rows.reduce((x, r) => x + r.factMin, 0);
    const att = plan > 0 ? (fact / plan) * 100 : 100;
    const fot = rows.reduce((x, r) => x + r.net, 0);
    const dayNum = Math.max(1, Number(tk.slice(8, 10)));
    const dim = new Date(Number(tk.slice(0, 4)), Number(tk.slice(5, 7)), 0).getDate();
    const chart = rangeKeys(addDaysKey(tk, -13), tk).map((k) => {
      let pl = 0, fc = 0;
      rows.forEach((r) => {
        const c = db.schedule.find((x) => x.userId === r.user.id && x.date === k);
        if (c) pl += SHIFT_META[c.type].planned;
        fc += db.punches.filter((p) => p.userId === r.user.id && p.date === k).reduce((s2, p) => s2 + (p.tout !== null ? Math.max(0, (p.tout >= p.tin ? p.tout - p.tin : 1440 - p.tin + p.tout) - (p.tout - p.tin > 360 ? db.settings.breakMin : 0)) : 0), 0);
      });
      return { d: k.slice(8), att: pl > 0 ? Math.min(110, Math.round((fc / pl) * 100)) : 0 };
    });
    const insights: { icon: string; tone: string; title: string; text: string }[] = [
      { icon: att >= 92 ? "check" : "warn", tone: att >= 92 ? "ok" : "warn", title: `Посещаемость: ${att.toFixed(0)}%`, text: `Факт ${hDec(fact)} ч при плане ${hDec(plan)} ч за ${monthTitle(mf)}.` },
      { icon: "coin", tone: "night", title: `ФОТ: ${fmtMoney(fot)} → прогноз ${fmtMoney((fot / dayNum) * dim)}`, text: `Средний дневной фонд ${fmtMoney(fot / dayNum)}. Штрафы учтены.` },
    ];
    const late = rows.filter((r) => r.late > 0);
    if (late.length) insights.push({ icon: "history", tone: "warn", title: `Опоздания: ${late.length} чел.`, text: late.slice(0, 3).map((r) => r.user.name.split(" ")[0]).join(", ") });
    const m = new Map<string, number>();
    db.production.filter((r) => r.date >= addDaysKey(tk, -13)).forEach((r) => m.set(r.userId, (m.get(r.userId) || 0) + r.qty));
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) insights.push({ icon: "flame", tone: "accent", title: `Лучший по выработке: ${userById(db, top[0])?.name || "—"}`, text: `${Math.round(top[1])} кг за 2 недели.` });
    if (mode === "adv") {
      const next7 = rangeKeys(addDaysKey(tk, 1), addDaysKey(tk, 7));
      const unc = next7.filter((k) => !db.schedule.some((c) => c.date === k && (c.type === "day" || c.type === "night")));
      insights.push({ icon: "cal", tone: unc.length ? "bad" : "ok", title: unc.length ? `${unc.length} дн. без смен на неделе` : "Неделя покрыта", text: unc.length ? `Дни: ${unc.map((k) => k.slice(8)).join(", ")}` : "Смены назначены." });
    }
    return { chart, insights, att, fot, forecast: (fot / dayNum) * dim };
  }, [db, mode]);

  return (
    <div className="grid gap-4 max-w-5xl">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-deep grid place-items-center"><I n="brain" size={20} /></span>
        <div className="flex-1 min-w-[200px]">
          <b className="text-sm block font-display">Встроенный аналитик</b>
          <span className="text-[12px] text-mute font-bold">Лайт · Стандарт · Продвинутый — нагрузка на сервер минимальная</span>
        </div>
        <Seg opts={[{ v: "off", label: "Выкл" }, { v: "light", label: "Лайт" }, { v: "std", label: "Стандарт" }, { v: "adv", label: "Продвинутый" }]} val={mode}
          onChange={(v) => { setSettings({ aiMode: v }); toast(`Режим: ${v}`, "ok"); }} />
      </div>
      {mode === "off" ? <div className="card"><Empty icon="brain" title="Аналитик выключен" /></div> : (
        <>
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
            <div className="card p-5">
              <h3 className="font-display text-sm font-semibold mb-3">Посещаемость, 14 дней</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={rep.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe1e8" />
                  <XAxis dataKey="d" tick={{ fontSize: 9.5, fontWeight: 700 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 110]} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(0)}%`} />
                  <Bar dataKey="att" name="%" radius={[5, 5, 0, 0]}>
                    {rep.chart.map((c, i) => <Cell key={i} fill={c.att >= 90 ? "#17875c" : c.att >= 70 ? "#e56f24" : "#c74436"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="font-display text-sm font-semibold mb-3">ФОТ и прогноз</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-paper border border-line p-3"><div className="text-[10px] font-extrabold uppercase text-mute">Начислено</div><div className="font-display text-lg font-bold tnum">{fmtMoney(rep.fot)}</div></div>
                <div className="rounded-xl bg-accent-soft border border-accent/30 p-3"><div className="text-[10px] font-extrabold uppercase text-accent-deep">Прогноз месяца</div><div className="font-display text-lg font-bold tnum text-accent-deep">{fmtMoney(rep.forecast)}</div></div>
              </div>
              <p className="text-[11.5px] text-mute font-bold leading-relaxed mt-3">Линейная экстраполяция с учётом штрафов и сдельной выработки.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {(mode === "light" ? rep.insights.slice(0, 3) : rep.insights).map((x, i) => (
              <div key={i} className={`card p-4 anim-rise border-l-4 ${x.tone === "ok" ? "!border-l-ok" : x.tone === "bad" ? "!border-l-bad" : x.tone === "warn" ? "!border-l-warn" : x.tone === "night" ? "!border-l-night" : "!border-l-accent"}`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center gap-2 mb-1"><I n={x.icon} size={16} className={x.tone === "ok" ? "text-ok" : x.tone === "bad" ? "text-bad" : x.tone === "warn" ? "text-warn" : x.tone === "night" ? "text-night" : "text-accent-deep"} /><b className="text-[13px]">{x.title}</b></div>
                <p className="text-[12.5px] text-mute font-semibold leading-relaxed">{x.text}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="card p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-10 h-10 rounded-xl bg-night-soft text-night grid place-items-center"><I n="bot" size={20} /></span>
          <div className="flex-1 min-w-[220px]">
            <b className="text-sm block font-display">Локальная нейросеть (Ollama)</b>
            <span className="text-[12px] text-mute font-bold">По умолчанию отключена.</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-[auto_1fr_1fr_auto] gap-3 mt-4 items-end">
          <div className="pb-1"><Toggle checked={local.ollamaOn} onChange={(v) => setLocal({ ...local, ollamaOn: v })} label="Включена" /></div>
          <Field label="Адрес"><input className="input font-mono !text-[13px]" value={local.ollamaUrl} onChange={(e) => setLocal({ ...local, ollamaUrl: e.target.value })} /></Field>
          <Field label="Модель"><input className="input font-mono !text-[13px]" value={local.ollamaModel} onChange={(e) => setLocal({ ...local, ollamaModel: e.target.value })} /></Field>
          <button className="btn btn-dark" onClick={() => { setSettings(local); toast("Сохранено", "ok"); }}><I n="check" size={15} />Сохранить</button>
        </div>
        {s.ollamaOn && (
          <div className="mt-4 border-t border-line pt-4">
            <button className="btn btn-pri btn-sm" disabled={busy} onClick={async () => {
              setBusy(true); setAns("");
              try {
                const rows = summarizeAll(db, monthStart(todayKey()), monthEnd(todayKey()));
                const summary = rows.map((r) => `${r.user.name}: план ${hDec(r.planMin)}ч факт ${hDec(r.factMin)}ч выплата ${Math.round(r.net)}р`).join("\n");
                setAns(await askOllama(`Ты аналитик «СменаЛАН». Данные:\n${summary}\n\nДай 5 выводов и 3 рекомендации на русском.`));
              } catch { setAns("Ollama недоступна. Проверьте: ollama serve, ollama pull " + s.ollamaModel + ", адрес " + s.ollamaUrl); }
              setBusy(false);
            }}><I n="brain" size={14} />{busy ? "Думает…" : "Полный анализ"}</button>
            {ans && <pre className="mt-4 bg-steel-900 text-paper rounded-xl p-4 text-[12.5px] font-sans font-semibold whitespace-pre-wrap max-h-80 overflow-y-auto dark-scroll">{ans}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}

// ================= ИИ-БОТ И СКРИПТЫ =================
export function BotView() {
  const { db, botSay, runScript, addScript, updateScript, deleteScript } = useStore();
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<{ from: "me" | "bot"; text: string }[]>([
    { from: "bot", text: "Я бот «СменаЛАН». Пишите поручения: «напомни ivan 2025-01-20 сдать отчёт», «график ivan 2025-01-20 Н», «проверь неделю», «анализ стены». Полная справка — «помощь»." },
  ]);
  const [inp, setInp] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const pulse = wallPulse(db);

  const say = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: "me", text }]);
    const reply = botSay(text);
    setTimeout(() => setMsgs((m) => [...m, { from: "bot", text: reply }]), 150);
    setInp("");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
      <div className="grid gap-4">
        <div className="card p-4 anim-rise" style={{ background: BGS.g3 }}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-ok-soft text-ok grid place-items-center"><I n="brain" size={19} /></span>
            <div><b className="text-sm block font-display">ИИ наблюдает за стеной</b><p className="text-[12px] font-bold text-mute">{pulse.lines.join(" ")}</p></div>
          </div>
        </div>
        <div className="card flex flex-col min-h-[52vh]">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent-deep grid place-items-center"><I n="bot" size={16} /></span>
            <b className="font-display text-[13px]">Бот-помощник</b>
            <span className="badge bg-ok-soft text-ok ml-auto">30+ команд</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 grid gap-3 content-start">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${m.from === "me" ? "bg-steel-900 text-paper rounded-tr-sm" : "bg-paper border border-line rounded-tl-sm"}`}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-line">
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {["кто на смене", "проверь неделю", "опоздания", "анализ стены", "лучший", "помощь"].map((q) => (
                <button key={q} className="chip !h-6 !text-[10.5px]" onClick={() => say(q)}>{q}</button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); say(inp); }}>
              <input className="input flex-1" placeholder="Поручение боту…" value={inp} onChange={(e) => setInp(e.target.value)} />
              <button className="btn btn-pri" type="submit"><I n="send" size={16} /></button>
            </form>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <b className="font-display text-[13px]">Скрипты бота ({db.scripts.length}/100)</b>
          <button className="btn btn-soft btn-sm ml-auto" onClick={() => { addScript(`Скрипт ${db.scripts.length + 1}`); toast("Скрипт создан", "ok"); }}><I n="plus" size={13} />Новый</button>
        </div>
        <div className="grid gap-3">
          {db.scripts.map((s) => (
            <div key={s.id} className="border border-line rounded-xl p-3">
              <div className="flex items-center gap-2">
                <input className="input !h-8 !text-[12.5px] font-bold flex-1" value={s.name} onChange={(e) => updateScript(s.id, { name: e.target.value })} />
                <Toggle checked={s.enabled} onChange={(v) => updateScript(s.id, { enabled: v })} label="" />
              </div>
              {editId === s.id ? (
                <textarea className="input mt-2 font-mono !text-[11.5px]" rows={5} value={s.lines.join("\n")} onChange={(e) => updateScript(s.id, { lines: e.target.value.split("\n") })} placeholder={"каждая строка — команда:\nкто на смене\nнеделя"} />
              ) : (
                <p className="text-[11px] font-bold text-mute mt-2 font-mono truncate">{s.lines.length ? s.lines.join(" · ") : "пусто — добавьте команды"}</p>
              )}
              <div className="flex gap-1.5 mt-2">
                <button className="btn btn-pri btn-sm" onClick={() => { const out = runScript(s.id); toast(`Выполнено команд: ${out.length}`, "ok"); }}><I n="play" size={12} />Запустить</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditId(editId === s.id ? null : s.id)}><I n="edit" size={12} />{editId === s.id ? "Готово" : "Редактировать"}</button>
                <button className="btn btn-ghost btn-sm !text-bad" onClick={() => { deleteScript(s.id); toast("Скрипт удалён"); }}><I n="trash" size={12} /></button>
              </div>
            </div>
          ))}
          {db.scripts.length === 0 && <p className="text-[12px] font-bold text-mute text-center py-4">Скриптов нет</p>}
        </div>
        <p className="text-[11px] font-bold text-mute mt-3 leading-relaxed">Скрипт — последовательность команд бота (напомнить, записать на стену, изменить график, написать в личку, проверить неделю…). До 100 скриптов, редактирование и удаление в любой момент.</p>
      </div>
    </div>
  );
}

// ================= СНИМКИ КАМЕР =================
export function CameraView() {
  const { db, setCamStatus, deleteCamShot, addPost, ensureDm, sendMessage } = useStore();
  const { toast } = useToast();
  const [flt, setFlt] = useState("");
  const [st, setSt] = useState("");
  const [view, setView] = useState<string | null>(null);
  const list = db.camshots.filter((c) => (!flt || c.userId === flt) && (!st || c.status === st));
  const cur = db.camshots.find((c) => c.id === view) || null;
  const curUser = cur ? userById(db, cur.userId) : null;
  return (
    <div className="grid gap-4">
      <div className="card p-4 flex items-center gap-2 flex-wrap">
        <select className="input !w-56 !h-9" value={flt} onChange={(e) => setFlt(e.target.value)}>
          <option value="">Все сотрудники</option>
          {[...new Set(db.camshots.map((c) => c.userId))].map((id) => <option key={id} value={id}>{userById(db, id)?.name || id}</option>)}
        </select>
        <Seg small opts={[{ v: "", label: "Все" }, { v: "new", label: "Новые" }, { v: "ok", label: "Подтв." }, { v: "bad", label: "Сомнит." }]} val={st} onChange={setSt} />
        <span className="text-[12px] font-bold text-mute ml-auto">Снимки хранятся 120 дней и сжимаются · всего {db.camshots.length}</span>
      </div>
      {list.length === 0 ? <div className="card"><Empty icon="camera" title="Снимков нет" text="Включите камеру терминала в Настройках — снимки появятся при отметках." /></div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {list.slice(0, 60).map((c) => {
            const u = userById(db, c.userId);
            return (
              <button key={c.id} className="card overflow-hidden text-left hover:-translate-y-0.5 transition-transform anim-rise" onClick={() => setView(c.id)}>
                <img src={c.src} alt="" className="w-full h-32 object-cover" loading="lazy" />
                <div className="p-2.5">
                  <b className="text-[12px] block truncate">{u?.name || "—"}</b>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`badge ${c.status === "ok" ? "bg-ok-soft text-ok" : c.status === "bad" ? "bg-bad-soft text-bad" : "bg-paper text-mute"}`}>{c.status === "ok" ? "тот самый" : c.status === "bad" ? "сомнение" : "новый"}</span>
                    <span className="text-[10px] font-bold text-mute ml-auto">{relTime(c.ts)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {cur && curUser && (
        <div className="fixed inset-0 z-[75] bg-steel-950/80 grid place-items-center p-4" onClick={() => setView(null)}>
          <div className="card max-w-2xl w-full anim-pop" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-line flex items-center gap-3">
              <b className="font-display text-sm">{curUser.name}</b>
              <span className="badge bg-paper text-mute">{cur.dir === "out" ? "уход" : "приход"} · {relTime(cur.ts)}</span>
              <button className="w-8 h-8 ml-auto rounded-lg grid place-items-center text-mute hover:bg-paper" onClick={() => setView(null)}><I n="x" size={16} /></button>
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-4">
              <div>
                <span className="lbl">Снимок терминала</span>
                <img src={cur.src} alt="" className="rounded-xl border border-line w-full" />
              </div>
              <div>
                <span className="lbl">Аватар (сравнение)</span>
                <div className="rounded-xl border border-line p-4 grid place-items-center bg-paper">
                  {curUser.avatar ? <img src={curUser.avatar} alt="" className="w-40 h-40 rounded-full object-cover" /> : <Avatar u={curUser} size={120} />}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-line flex gap-2 flex-wrap">
              <button className="btn btn-ok btn-sm" onClick={() => { setCamStatus(cur.id, "ok"); toast("Подтверждено", "ok"); }}><I n="check" size={13} />Тот самый</button>
              <button className="btn btn-bad btn-sm" onClick={() => { setCamStatus(cur.id, "bad"); toast("Помечен как сомнительный", "bad"); }}><I n="warn" size={13} />Сомнительно</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { addPost(`Снимок с терминала: ${curUser.name}`, cur.src, null, null, false, []); toast("Отправлено на стену", "ok"); }}><I n="feed" size={13} />На стену</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { const tid = ensureDm(cur.userId); sendMessage(tid, "Снимок с терминала:", { name: `cam_${cur.ts.slice(0, 10)}.jpg`, type: "image/jpeg", size: 0, src: cur.src }); toast("Отправлено в личку сотруднику", "ok"); }}><I n="chat" size={13} />В личку</button>
              <a className="btn btn-ghost btn-sm" href={cur.src} download={`cam_${curUser.username}_${cur.ts.slice(0, 10)}.jpg`}><I n="download" size={13} />Скачать</a>
              <button className="btn btn-ghost btn-sm !text-bad ml-auto" onClick={() => { deleteCamShot(cur.id); setView(null); toast("Удалён"); }}><I n="trash" size={13} />Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= ЦЕХА · ДОЛЖНОСТИ · ФОТ =================
export function OrgView() {
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
  const colors = ["#3f6d9e", "#c74436", "#17875c", "#a97a12", "#7a4fbf", "#0f8b8d", "#b0487d", "#e56f24"];
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="grid sm:grid-cols-2 gap-3">
        {db.workshops.map((w) => {
          const cnt = db.users.filter((u) => u.workshopId === w.id && u.active && !u.archived).length;
          return (
            <div key={w.id} className="card p-4 anim-rise" style={{ borderTop: `4px solid ${w.color}` }}>
              <div className="flex items-center gap-2">
                <input className="input !h-9 font-display !text-sm font-semibold" value={w.name} onChange={(e) => updateWorkshop(w.id, { name: e.target.value })} />
                <button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition shrink-0" onClick={() => { const r = removeWorkshop(w.id); if (r) toast(r, "bad"); else toast("Цех удалён", "ok"); }}><I n="trash" size={14} /></button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {colors.map((c) => <button key={c} className={`w-5 h-5 rounded-full transition ${w.color === c ? "ring-2 ring-offset-1 ring-ink" : ""}`} style={{ background: c }} onClick={() => updateWorkshop(w.id, { color: c })} />)}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] font-extrabold text-mute uppercase">{cnt} сотрудн.</span>
                <button className={`btn btn-sm ${w.piecework ? "btn-soft" : "btn-ghost"}`} onClick={() => { updateWorkshop(w.id, { piecework: !w.piecework }); toast(w.piecework ? "Повременный" : "Сдельный", "ok"); }}>
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
          <Field label="Название"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Toggle checked={pw} onChange={setPw} label="Сдельная оплата" sub="выработка × цена позиции" />
          <button className="btn btn-pri" onClick={() => {
            if (!name.trim()) { toast("Название обязательно", "bad"); return; }
            addWorkshop(name.trim(), pw, colors[db.workshops.length % colors.length]);
            setName(""); setPw(false);
            toast("Цех создан", "ok");
          }}><I n="plus" size={16} />Создать</button>
        </div>
      </div>
    </div>
  );
}
function Positions() {
  const { db, addPosition, updatePosition, removePosition } = useStore();
  const { toast } = useToast();
  const [f, setF] = useState({ name: "", normH: "8", defPay: "hour", rate: "", shiftCost: "" });
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[640px]">
          <thead><tr><th>Должность</th><th>Норма ч/день</th><th>Оплата</th><th>Ставка ₽/ч</th><th>Смена ₽</th><th>Занято</th><th></th></tr></thead>
          <tbody>
            {db.positions.map((p) => {
              const cnt = db.users.filter((u) => u.positionId === p.id && u.active && !u.archived).length;
              return (
                <tr key={p.id}>
                  <td><input className="input !h-8 !text-[13px] !w-44" value={p.name} onChange={(e) => updatePosition(p.id, { name: e.target.value })} /></td>
                  <td><input type="number" className="input !h-8 !w-20 tnum" value={p.normH} onChange={(e) => updatePosition(p.id, { normH: Number(e.target.value) })} /></td>
                  <td><select className="input !h-8 !w-32 !text-[13px]" value={p.defPay} onChange={(e) => updatePosition(p.id, { defPay: e.target.value as never })}><option value="hour">Почасовая</option><option value="shift">Посменная</option><option value="piece">Сдельная</option></select></td>
                  <td><input type="number" className="input !h-8 !w-24 tnum" value={p.rate} onChange={(e) => updatePosition(p.id, { rate: Number(e.target.value) })} /></td>
                  <td><input type="number" className="input !h-8 !w-24 tnum" value={p.shiftCost} onChange={(e) => updatePosition(p.id, { shiftCost: Number(e.target.value) })} /></td>
                  <td className="text-center font-bold">{cnt}</td>
                  <td><button className="w-8 h-8 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => { const r = removePosition(p.id); if (r) toast(r, "bad"); else toast("Удалена", "ok"); }}><I n="trash" size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Новая должность</h3>
        <div className="grid gap-3">
          <Field label="Название"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Норма ч"><input type="number" className="input tnum" value={f.normH} onChange={(e) => setF({ ...f, normH: e.target.value })} /></Field>
            <Field label="Оплата"><select className="input" value={f.defPay} onChange={(e) => setF({ ...f, defPay: e.target.value })}><option value="hour">Почасовая</option><option value="shift">Посменная</option><option value="piece">Сдельная</option></select></Field>
            <Field label="₽/ч"><input type="number" className="input tnum" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
            <Field label="₽/смена"><input type="number" className="input tnum" value={f.shiftCost} onChange={(e) => setF({ ...f, shiftCost: e.target.value })} /></Field>
          </div>
          <button className="btn btn-pri" onClick={() => {
            if (!f.name.trim()) { toast("Название обязательно", "bad"); return; }
            addPosition({ name: f.name.trim(), normH: Number(f.normH) || 8, defPay: f.defPay as never, rate: Number(f.rate) || 0, shiftCost: Number(f.shiftCost) || 0 });
            setF({ name: "", normH: "8", defPay: "hour", rate: "", shiftCost: "" });
            toast("Должность создана", "ok");
          }}><I n="plus" size={16} />Создать</button>
        </div>
      </div>
    </div>
  );
}
function Fot() {
  const { db } = useStore();
  const tk = todayKey();
  const ranges = useMemo(() => {
    return [-2, -1, 0, 1].map((n) => {
      const d = new Date(Number(tk.slice(0, 4)), Number(tk.slice(5, 7)) - 1 + n, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { label: monthTitle(key + "-01").split(" ")[0].slice(0, 3), from: monthStart(key + "-01"), to: monthEnd(key + "-01") };
    });
  }, [tk]);
  const series = ranges.map((r) => ({ name: r.label, ФОТ: Math.round(summarizeAll(db, r.from, r.to).reduce((s, x) => s + x.net, 0)) }));
  const cur = series[2].ФОТ, prev = series[1].ФОТ;
  const growth = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: "ФОТ за месяц", v: fmtMoney(cur) }, { l: "Динамика", v: `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%` },
        { l: "Прогноз след. месяца", v: fmtMoney(cur * (1 + growth / 200)) }, { l: "Сотрудников", v: String(db.users.filter((u) => u.role === "employee" && u.active && !u.archived).length) }].map((x, i) => (
          <div key={i} className="card p-4"><div className="text-[10.5px] font-extrabold uppercase text-mute">{x.l}</div><div className="font-display text-lg font-bold tnum mt-1">{x.v}</div></div>
        ))}
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">ФОТ по месяцам</h3>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe1e8" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}к`} />
            <Tooltip formatter={(v) => Number(v).toLocaleString("ru-RU")} />
            <Bar dataKey="ФОТ" fill="#e56f24" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ================= ВЫРАБОТКА =================
export function ProductionView() {
  const { db, me, addProduction, removeProduction } = useStore();
  const { toast } = useToast();
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  if (!me) return null;
  const isAdmin = me.role !== "employee";
  const prods = db.products.filter((p) => !p.hidden && (isAdmin || !p.workshopId || p.workshopId === me.workshopId)).sort((a, b) => a.sort - b.sort);
  const mine = db.production.filter((r) => isAdmin || r.userId === me.id).slice(0, 60);
  const monthKg = db.production.filter((r) => r.date.startsWith(todayKey().slice(0, 7)) && (isAdmin || r.userId === me.id)).reduce((s, r) => s + r.qty, 0);
  const monthSum = pieceSumOf(db, me.id, monthStart(todayKey()), monthEnd(todayKey()));

  return (
    <div className="grid gap-4 max-w-3xl mx-auto">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><div className="text-[10.5px] font-extrabold uppercase text-mute">За месяц, всего</div><div className="font-display text-xl font-bold tnum mt-1">{Math.round(monthKg * 10) / 10} кг</div></div>
        <div className="card p-4"><div className="text-[10.5px] font-extrabold uppercase text-mute">{me.payMode === "piece" ? "К оплате (сделка)" : "Стоимость выработки"}</div><div className="font-display text-xl font-bold tnum mt-1 text-ok">{fmtMoney(monthSum)}</div></div>
      </div>
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-3">Записать выработку</h3>
        <div className="grid sm:grid-cols-[1fr_110px_auto] gap-2 items-end">
          <Field label="Позиция">
            <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
              <option value="">—</option>
              {prods.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.price} ₽/{p.unit}</option>)}
            </select>
          </Field>
          <Field label="Кол-во"><input type="number" className="input tnum" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <button className="btn btn-pri" onClick={() => {
            const q = Number(qty);
            if (!pid || !q || q <= 0) { toast("Позиция и количество обязательны", "bad"); return; }
            addProduction(pid, q, todayKey(), note.trim());
            setQty(""); setNote("");
            toast("Записано (позиция сохранена в памяти для быстрого выбора)", "ok");
          }}><I n="plus" size={16} />Записать</button>
        </div>
        <input className="input mt-3" placeholder="Примечание (партия, линия…)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Дата</th><th>{isAdmin ? "Сотрудник" : "Позиция"}</th><th>Кол-во</th><th>Сумма</th><th></th></tr></thead>
          <tbody>
            {mine.map((r) => {
              const p = db.products.find((x) => x.id === r.productId);
              const u = userById(db, r.userId);
              return (
                <tr key={r.id}>
                  <td className="font-mono text-[12px]">{r.date}</td>
                  <td className="whitespace-nowrap">{isAdmin ? u?.name : p?.name}{r.note && <span className="text-mute font-bold text-[11px]"> · {r.note}</span>}</td>
                  <td className="tnum font-bold">{r.qty} {p?.unit}</td>
                  <td className="tnum text-ok">{fmtMoney(r.qty * (p?.price || 0))}</td>
                  <td>{(isAdmin || r.userId === me.id) && <button className="w-7 h-7 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => { removeProduction(r.id); toast("Удалено"); }}><I n="trash" size={13} /></button>}</td>
                </tr>
              );
            })}
            {mine.length === 0 && <tr><td colSpan={5} className="text-center text-mute font-bold py-6">Записей нет</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= ИНСТРУКЦИИ И API =================
export function HelpView() {
  const { online } = useStore();
  const [role, setRole] = useState("local");
  return (
    <div className="grid gap-4 max-w-4xl">
      <Seg opts={[
        { v: "local", label: "Локальный режим и запуск", icon: "wifi" },
        { v: "super", label: "Суперадмину", icon: "shield" },
        { v: "admin", label: "Админу", icon: "gear" },
        { v: "acc", label: "Бухгалтерии", icon: "coin" },
        { v: "emp", label: "Сотруднику", icon: "user" },
        { v: "api", label: "API и датчики", icon: "layers" },
      ]} val={role} onChange={setRole} />

      {role === "local" && (
        <div className="card p-6 grid gap-3">
          <h3 className="font-display text-base font-semibold flex items-center gap-2"><I n="wifi" size={18} className={online ? "text-ok" : "text-warn"} />{online ? "Сервер онлайн" : "Локальный режим (без сервера)"}</h3>
          <ol className="grid gap-2 text-[13.5px] font-semibold text-mute leading-relaxed list-decimal list-inside">
            <li>На ПК с Windows откройте папку <b className="text-ink">server</b> и запустите <b className="text-ink">install.bat</b> — установщик проверит Python, поставит зависимости и создаст ярлык на рабочем столе.</li>
            <li>Двойной клик по ярлыку <b className="text-ink">«СменаЛАН — сервер»</b> — сервер поднимется и уйдёт в трей.</li>
            <li>Правый клик по иконке трея: <b className="text-ink">«Скопировать ссылку»</b> — раздайте её сотрудникам (или покажите QR-код на терминале).</li>
            <li>Разрешите доступ в окне брандмауэра Windows (частные сети).</li>
            <li>Телефоны: откройте ссылку → «Добавить на главный экран» → PWA работает как приложение.</li>
          </ol>
          <div className={`rounded-xl border p-3.5 text-[12.5px] font-bold ${online ? "border-ok/50 bg-ok-soft/50" : "border-warn/50 bg-warn-soft/50"}`}>
            {online ? "Все устройства сейчас синхронизированы в реальном времени: изменения видны на всех гаджетах за секунду." : "Сервер не найден: данные пока хранятся в браузере этого устройства. Запустите server/install.bat → ярлык на рабочем столе — и всё синхронизируется автоматически."}
          </div>
          <p className="text-[12px] font-bold text-mute">База — SQLite (server/data), без ограничения места. Еженедельные автокопии, снимки камер 120 дней, журналы бессрочно. Сервер без трея: <code className="bg-paper border border-line px-1 rounded">python launcher.py --console</code>.</p>
        </div>
      )}
      {role === "super" && (
        <HelpList title="Суперадминистратору" items={[
          "Вход: root / стандартный пароль. Резервный код восстановления — на экране входа (сбрасывает на стандартный).",
          "Права доступа: матрица «модуль × роль × ПК/PWA» — что видит каждая роль на каждом устройстве.",
          "Журналы: полный аудит по каждому действию (смена пароля, график, штрафы, вход в систему).",
          "Архив: полное удаление сотрудника — только вами и не раньше 30 дней после архивации.",
          "Данные: резервные копии JSON, сброс базы, автоконтроль сервера.",
          "Настройки: API-токен, Telegram, ИИ, темы киоска.",
        ]} />
      )}
      {role === "admin" && (
        <HelpList title="Администратору" items={[
          "Сотрудники: создание (пароль не обязателен), цеха, должности, тип оплаты; увольнение → архив с причиной и характеристикой.",
          "График: массовое планирование — выберите сотрудников, шаблон (5/2, 2/2, 3/3, каждый день, сдвиг цикла), один клик на месяц. Горизонт ±6 месяцев.",
          "Вне графика: система предупредит, сотрудник указывает «работаю до», смена закроется по плану, вам придёт запрос на проверку камер.",
          "Заявки: отпуск, замены, доп. смены — одобрение автоматически правит график.",
          "Штрафы и балльные оценки — в карточке сотрудника (звёздочка в списке).",
          "Отчёты: ежедневный/еженедельный/ежемесячный, табель для бухгалтерии (Excel/PDF), кнопка «В бухгалтерию».",
          "ИИ-бот: поручения и скрипты (напомнить, изменить график, написать в личку, проверить неделю).",
          "Снимки камер: подтверждение «тот ли человек отметился», отправка на стену или в личку.",
          "Telegram: настройте токен и триггеры — заявки, график, внеплановые смены.",
        ]} />
      )}
      {role === "acc" && (
        <HelpList title="Бухгалтерии" items={[
          "Вход: buh / 1234 (смените пароль в профиле).",
          "Расчёты появляются в разделе «Расчёты» только после подтверждения периода администратором (день/неделя/месяц/сезон).",
          "В таблице: начислено, штрафы, «к выплате». Отметка «Выплачено» фиксирует статус.",
          "Выгрузка: Excel и официальный PDF-бланк с шапкой организации, подписями и местом печати.",
          "Отчёты: посещаемость и табель по цехам за любой период.",
        ]} />
      )}
      {role === "emp" && (
        <HelpList title="Сотруднику" items={[
          "Вход: логин от админа, пароль не обязателен — поставьте свой в профиле.",
          "Отметки: в приложении или на терминале (киоске). Терминал делает снимок — так подтверждается, что отметились именно вы.",
          "Вне графика: укажите «работаю до …» — смена закроется по плану и уйдёт админу на подтверждение.",
          "Статистика: часы за день/неделю/месяц/год/любой период, план и факт.",
          "График: свой и своего цеха; изменения приходят уведомлением и подсвечиваются.",
          "Заявки: отпуск, замена дня, доп. смена — всё через админа.",
          "Выработка: записывайте кг по позициям — для сдельной оплаты это ваш заработок.",
          "Стена, чаты цехов, игры и утилиты — в свободное время. Дуэли с коллегами, результаты можно выкладывать на стену.",
          "Личная карточка, оценки и штрафы — в профиле.",
        ]} />
      )}
      {role === "api" && (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[640px]">
            <thead><tr><th>Метод</th><th>Эндпоинт</th><th>Назначение</th><th>Токен</th></tr></thead>
            <tbody>
              {API_ENDPOINTS.map((e) => (
                <tr key={e.path + e.method}>
                  <td><span className={`badge ${e.method === "GET" ? "bg-night-soft text-night" : "bg-ok-soft text-ok"}`}>{e.method}</span></td>
                  <td className="font-mono text-[12px]">{e.path}</td>
                  <td className="text-[12.5px]">{e.desc}</td>
                  <td>{e.auth ? <span className="badge bg-warn-soft text-warn">да</span> : <span className="text-mute font-bold">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12px] font-bold text-mute p-4 border-t border-line">Токен задаётся в Настройках и передаётся заголовком X-API-Token или ?token=…. Пример датчика: POST /api/sensors {"{name, value, unit}"}. Веб-камера терминала: POST /api/webcam — снимок в архив (120 дней). Telegram: POST /api/telegram.</p>
        </div>
      )}
      <div className="card p-4">
        <h3 className="font-display text-sm font-semibold mb-2 flex items-center gap-2"><I n="info" size={15} />Доступы по умолчанию</h3>
        <div className="flex gap-2 flex-wrap text-[12px] font-bold">
          <span className="badge bg-ink text-paper">root / root — суперадмин</span>
          <span className="badge bg-accent-soft text-accent-deep">buh / 1234 — бухгалтерия</span>
          <span className="badge bg-paper text-ink border border-line">demo — песочница, без пароля</span>
          <span className="badge bg-warn-soft text-warn">PIN терминала: 1234</span>
        </div>
      </div>
    </div>
  );
}
function HelpList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card p-6">
      <h3 className="font-display text-base font-semibold mb-4">{title}</h3>
      <ul className="grid gap-2.5">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] font-semibold text-mute leading-relaxed">
            <I n="check" size={16} className="text-ok shrink-0 mt-0.5" />{x}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { fmtMin, nowMin, remindersFor, fmtDurH };
