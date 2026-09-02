import React, { useRef, useState } from "react";
import { useStore, userById } from "../lib/store";
import { WallPost } from "../lib/types";
import { relTime } from "../lib/time";
import { I, Avatar, useToast, Confirm, shrinkImage, RoleBadge } from "./ui";

export default function FeedView() {
  const { db, me, addPost, deletePost, toggleLike, addComment, togglePin } = useStore();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!me) return null;

  const posts = [...db.posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts.localeCompare(a.ts));
  const canManage = me.role !== "employee";

  const publish = () => {
    if (!text.trim() && !img) return;
    addPost(text.trim(), img);
    setText(""); setImg(""); setImg(null);
    toast("Запись опубликована на стене", "ok");
  };

  return (
    <div className="max-w-2xl mx-auto grid gap-4">
      <div className="card p-4">
        <div className="flex gap-3">
          <Avatar u={me} size={42} />
          <div className="flex-1 min-w-0">
            <textarea className="input !border-transparent !bg-paper focus:!bg-surface focus:!border-accent" rows={3}
              placeholder={`Что нового, ${me.name.split(" ")[0]}? Запись увидят все в сети…`}
              value={text} onChange={(e) => setText(e.target.value)} />
            {img && (
              <div className="relative mt-2 inline-block">
                <img src={img} alt="" className="rounded-xl border border-line max-h-64" />
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-steel-950/70 text-white grid place-items-center hover:bg-bad transition" onClick={() => setImg(null)}><I n="x" size={14} /></button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2.5">
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                <I n="camera" size={14} />{busy ? "Обработка…" : "Фото"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                try { setImg(await shrinkImage(f, 1280)); } catch { toast("Не удалось прочитать фото", "bad"); }
                setBusy(false);
              }} />
              <span className="text-[11px] font-bold text-mute hidden sm:block">· фото сжимается и хранится на сервере</span>
              <button className="btn btn-pri btn-sm ml-auto" onClick={publish} disabled={(!text.trim() && !img) || busy}><I n="send" size={14} />Опубликовать</button>
            </div>
          </div>
        </div>
      </div>

      {posts.map((p, i) => (
        <PostCard key={p.id} p={p} delay={i * 40} canManage={canManage}
          onDelete={() => setConfirmDel(p.id)} onPin={() => togglePin(p.id)}
          onLike={() => toggleLike(p.id)}
          onComment={(t) => { addComment(p.id, t); }} />
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

  return (
    <article className="card anim-rise overflow-hidden" style={{ animationDelay: `${Math.min(delay, 300)}ms` }}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar u={author} size={42} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-sm truncate">{author?.name || "Удалённый аккаунт"}</b>
              {author && <RoleBadge role={author.role} />}
              {p.pinned && <span className="badge bg-accent-soft text-accent-deep"><I n="pin" size={11} />закреп</span>}
            </div>
            <div className="text-[11px] text-mute font-bold">{author?.dept || "—"} · {relTime(p.ts)}</div>
          </div>
          {(mine || canManage) && (
            <div className="ml-auto flex gap-1">
              {canManage && (
                <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-paper hover:text-accent transition" title={p.pinned ? "Открепить" : "Закрепить"} onClick={onPin}><I n="pin" size={15} /></button>
              )}
              <button className="w-8 h-8 rounded-lg grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition" title="Удалить" onClick={onDelete}><I n="trash" size={15} /></button>
            </div>
          )}
        </div>
        {p.text && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">{p.text}</p>}
      </div>
      {p.image && <img src={p.image} alt="" className="w-full max-h-[440px] object-cover border-y border-line" loading="lazy" />}
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
