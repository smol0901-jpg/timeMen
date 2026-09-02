import React, { useRef, useState } from "react";
import { useStore, userById, wsName } from "../lib/store";
import { WallPost, Attachment } from "../lib/types";
import { relTime, fileSize } from "../lib/time";
import { I, Avatar, useToast, Confirm, RoleBadge } from "./ui";

const BGS: Record<string, string> = {
  g1: "linear-gradient(120deg,#14181f 0%,#33415a 100%)",
  g2: "linear-gradient(120deg,#7a3b10 0%,#e56f24 100%)",
  g3: "linear-gradient(120deg,#0f4c3a 0%,#17875c 100%)",
  g4: "linear-gradient(120deg,#274a70 0%,#3f6d9e 100%)",
  g5: "linear-gradient(120deg,#5d2338 0%,#b0487d 100%)",
  g6: "linear-gradient(120deg,#4a3a10 0%,#a97a12 100%)",
};

export default function FeedView() {
  const { db, me, addPost, deletePost, toggleLike, addComment, togglePin, uploadAttachment } = useStore();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const anyRef = useRef<HTMLInputElement>(null);
  if (!me) return null;

  const posts = [...db.posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts.localeCompare(a.ts));
  const canManage = me.role !== "employee";

  const publish = async () => {
    if (!text.trim() && !img && !link.trim() && files.length === 0) return;
    addPost(text.trim(), img, link.trim() || null, bg, animated, files);
    setText(""); setImg(null); setLink(""); setBg(null); setAnimated(false); setFiles([]);
    toast("Запись опубликована на стене", "ok");
  };

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(list).slice(0, 5)) {
        const att = await uploadAttachment(f);
        if (f.type.startsWith("image/") && !img) setImg(att.src);
        else setFiles((prev) => [...prev, att]);
      }
    } catch {
      toast("Файл слишком большой или не читается", "bad");
    }
    setBusy(false);
  };

  return (
    <div className="max-w-2xl mx-auto grid gap-4">
      <div className="card p-4">
        <div className="flex gap-3">
          <Avatar u={me} size={42} />
          <div className="flex-1 min-w-0">
            <textarea className="input !border-transparent !bg-paper focus:!bg-surface focus:!border-accent" rows={3}
              placeholder={`Что нового, ${me.name.split(" ")[0]}? Новости цеха, фото, ссылки, файлы…`}
              value={text} onChange={(e) => setText(e.target.value)} />
            {bg && (
              <div className="mt-2 rounded-xl p-4 text-white text-sm font-bold" style={{ background: BGS[bg] }}>
                {text || "Предпросмотр фона записи…"}
              </div>
            )}
            {img && (
              <div className="relative mt-2 inline-block">
                <img src={img} alt="" className="rounded-xl border border-line max-h-60" />
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-steel-950/70 text-white grid place-items-center hover:bg-bad transition" onClick={() => setImg(null)}><I n="x" size={14} /></button>
              </div>
            )}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 bg-paper border border-line rounded-lg px-2.5 h-8 text-xs font-bold">
                    <I n="file" size={13} />{f.name}<span className="text-mute">· {fileSize(f.size)}</span>
                    <button className="text-mute hover:text-bad" onClick={() => setFiles(files.filter((_, j) => j !== i))}><I n="x" size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <input className="input !h-8 !text-xs mt-2" placeholder="Ссылка (https://…) — прикрепится к записи" value={link} onChange={(e) => setLink(e.target.value)} />
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}><I n="camera" size={14} />Фото</button>
              <button className="btn btn-ghost btn-sm" onClick={() => anyRef.current?.click()} disabled={busy}><I n="file" size={14} />{busy ? "Загрузка…" : "Файл"}</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={anyRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex items-center gap-1 ml-1">
                <button className={`w-6 h-6 rounded-full border-2 transition ${bg ? "border-ink" : "border-transparent"}`} title="Без фона" onClick={() => setBg(null)} style={{ background: "#edf0f3" }} />
                {Object.entries(BGS).map(([k, v]) => (
                  <button key={k} className={`w-6 h-6 rounded-full border-2 transition hover:scale-110 ${bg === k ? "border-ink scale-110" : "border-transparent"}`}
                    style={{ background: v }} onClick={() => setBg(bg === k ? null : k)} title="Фон записи" />
                ))}
              </div>
              <button className={`btn btn-sm ${animated ? "btn-soft" : "btn-ghost"}`} onClick={() => setAnimated(!animated)} title="Лёгкая анимация записи"><I n="zap" size={13} />Анимация</button>
              <button className="btn btn-pri btn-sm ml-auto" onClick={publish} disabled={busy || (!text.trim() && !img && !link.trim() && files.length === 0)}>
                <I n="send" size={14} />Опубликовать
              </button>
            </div>
          </div>
        </div>
      </div>

      {posts.map((p, i) => (
        <PostCard key={p.id} p={p} delay={i * 40} canManage={canManage}
          onDelete={() => setConfirmDel(p.id)} onPin={() => togglePin(p.id)} onLike={() => toggleLike(p.id)}
          onComment={(t) => addComment(p.id, t)} />
      ))}

      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Удалить запись?"
        text="Запись будет удалена со стены безвозвратно."
        onYes={() => { if (confirmDel) { deletePost(confirmDel); toast("Запись удалена"); } }} />
    </div>
  );
}

function PostCard({ p, canManage, onDelete, onPin, onLike, onComment, delay }: {
  p: WallPost; canManage: boolean; onDelete: () => void; onPin: () => void; onLike: () => void; onComment: (t: string) => void; delay: number;
}) {
  const { db, me } = useStore();
  const [openC, setOpenC] = useState(false);
  const [ct, setCt] = useState("");
  const author = userById(db, p.userId);
  const liked = !!me && p.likes.includes(me.id);
  const mine = me?.id === p.userId;
  const bgStyle = p.bg ? { background: BGS[p.bg] } : undefined;

  return (
    <article className={`card anim-rise overflow-hidden ${p.animated ? "hover:shadow-lg" : ""}`} style={{ animationDelay: `${Math.min(delay, 300)}ms` }}>
      <div className={`p-4 ${p.bg ? "text-white" : ""}`} style={bgStyle}>
        <div className="flex items-center gap-3">
          <Avatar u={author} size={42} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-sm truncate">{author?.name || "Удалённый аккаунт"}</b>
              {author && <RoleBadge role={author.role} />}
              {p.pinned && <span className="badge bg-accent-soft text-accent-deep"><I n="pin" size={11} />закреп</span>}
            </div>
            <div className={`text-[11px] font-bold ${p.bg ? "text-white/70" : "text-mute"}`}>
              {author ? wsName(db, author.workshopId) : "—"} · {relTime(p.ts)}
            </div>
          </div>
          {(mine || canManage) && (
            <div className="ml-auto flex gap-1">
              {canManage && (
                <button className={`w-8 h-8 rounded-lg grid place-items-center transition ${p.bg ? "text-white/80 hover:bg-white/15" : "text-mute hover:bg-paper hover:text-accent"}`} title={p.pinned ? "Открепить" : "Закрепить"} onClick={onPin}><I n="pin" size={15} /></button>
              )}
              <button className={`w-8 h-8 rounded-lg grid place-items-center transition ${p.bg ? "text-white/80 hover:bg-white/15" : "text-mute hover:bg-bad-soft hover:text-bad"}`} title="Удалить" onClick={onDelete}><I n="trash" size={15} /></button>
            </div>
          )}
        </div>
        {p.text && <p className={`mt-3 text-[15px] leading-relaxed whitespace-pre-wrap ${p.animated ? "anim-flash-once" : ""}`}>{p.text}</p>}
        {p.link && (
          <a href={p.link.startsWith("http") ? p.link : `https://${p.link}`} target="_blank" rel="noreferrer"
            className={`mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold transition ${p.bg ? "bg-white/12 hover:bg-white/20 text-white" : "bg-paper border border-line hover:border-accent"}`}>
            <I n="link" size={16} /><span className="truncate">{p.link}</span><I n="chevR" size={14} className="ml-auto" />
          </a>
        )}
      </div>
      {p.image && <img src={p.image} alt="" className="w-full max-h-[440px] object-cover border-y border-line" loading="lazy" />}
      {p.attachments.length > 0 && (
        <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-t border-line bg-paper/40">
          {p.attachments.map((f, i) => (
            <a key={i} href={f.src} download={f.name}
              className="inline-flex items-center gap-1.5 bg-surface border border-line rounded-lg px-2.5 h-8 text-xs font-bold hover:border-accent transition">
              <I n={f.type.startsWith("image") ? "camera" : f.type.startsWith("video") ? "video" : "file"} size={13} />
              <span className="max-w-[160px] truncate">{f.name}</span><span className="text-mute">{fileSize(f.size)}</span>
              <I n="download" size={12} className="text-mute" />
            </a>
          ))}
        </div>
      )}
      <div className="px-4 py-2.5 flex items-center gap-2">
        <button onClick={onLike}
          className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-extrabold transition-all active:scale-90 ${liked ? "bg-bad-soft text-bad" : "bg-paper text-mute hover:text-bad"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />
          </svg>
          {p.likes.length || ""}
        </button>
        <button onClick={() => setOpenC(!openC)}
          className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-extrabold transition ${openC ? "bg-night-soft text-night" : "bg-paper text-mute hover:text-night"}`}>
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
                <Avatar u={cu} size={30} />
                <div className="bg-surface border border-line rounded-xl rounded-tl-sm px-3 py-2 text-sm flex-1">
                  <div className="flex items-baseline gap-2"><b className="text-xs">{cu?.name || "—"}</b><span className="text-[10px] text-mute font-bold">{relTime(c.ts)}</span></div>
                  <div className="mt-0.5">{c.text}</div>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2.5">
            <Avatar u={me} size={30} />
            <form className="flex-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ct.trim()) { onComment(ct.trim()); setCt(""); } }}>
              <input className="input !h-9 text-sm" placeholder="Написать комментарий…" value={ct} onChange={(e) => setCt(e.target.value)} />
              <button className="btn btn-dark !h-9 !px-3" type="submit"><I n="send" size={14} /></button>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}
