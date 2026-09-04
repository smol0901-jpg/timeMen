import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore, userById } from "../lib/store";
import { WallPost, Attachment } from "../lib/types";
import { relTime, fileSize } from "../lib/time";
import { I, Avatar, useToast, Confirm, Modal, RoleBadge } from "./ui";

const BGS: Record<string, string> = {
  g1: "linear-gradient(135deg,#14181f 0%,#e56f24 130%)",
  g2: "linear-gradient(135deg,#0f2b3f,#17875c)",
  g3: "linear-gradient(135deg,#3c1f0e,#a97a12)",
  g4: "linear-gradient(135deg,#1b212b,#3f6d9e)",
};

export default function FeedView() {
  const { db, me, addPost, deletePost, toggleLike, addComment, togglePin, toggleFav, uploadAttachment } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"all" | "fav" | "photos">("all");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [mention, setMention] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  if (!me) return null;

  const canManage = me.role !== "employee";
  const all = [...db.posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts.localeCompare(a.ts));
  const posts = tab === "fav" ? all.filter((p) => (p.favs || []).includes(me.id)) : all;

  const gallery = useMemo(() => {
    const out: { src: string; by: string; ts: string }[] = [];
    db.posts.forEach((p) => {
      if (p.image) out.push({ src: p.image, by: p.userId, ts: p.ts });
      (p.attachments || []).forEach((a) => { if (a.type.startsWith("image/")) out.push({ src: a.src, by: p.userId, ts: p.ts }); });
    });
    return out.sort((a, b) => b.ts.localeCompare(a.ts));
  }, [db.posts]);

  const mentionCandidates = useMemo(() => {
    if (mention === null) return [];
    const q = mention.toLowerCase();
    return db.users.filter((u) => u.id !== me.id && (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))).slice(0, 5);
  }, [mention, db.users, me.id]);

  const onText = (v: string) => {
    setText(v);
    const caret = taRef.current?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = before.match(/@([\wа-яё]*)$/i);
    setMention(m ? m[1] : null);
  };
  const insertMention = (username: string) => {
    const caret = taRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\wа-яё]*)$/i, `@${username} `);
    setText(before + text.slice(caret));
    setMention(null);
    taRef.current?.focus();
  };

  const pickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const arr = Array.from(list).slice(0, 10 - images.length);
    if (Array.from(list).length > arr.length) toast("Максимум 10 фото на запись", "bad");
    setBusy(true);
    try {
      for (const f of arr) {
        const att = await uploadAttachment(f);
        if (f.type.startsWith("image/")) setImages((prev) => [...prev, att.src]);
        else setFiles((prev) => [...prev, att]);
      }
    } catch { toast("Не удалось загрузить файл", "bad"); }
    setBusy(false);
  };

  const publish = () => {
    if (!text.trim() && images.length === 0 && files.length === 0 && !link.trim()) return;
    const [first, ...rest] = images;
    const imgAtts: Attachment[] = rest.map((src, i) => ({ name: `Фото ${i + 2}`, type: "image/jpeg", size: 0, src }));
    addPost(text.trim(), first || null, link.trim() || null, bg, animated, [...imgAtts, ...files]);
    setText(""); setLink(""); setBg(null); setAnimated(false); setImages([]); setFiles([]);
    toast("Запись опубликована на стене", "ok");
  };

  return (
    <div className="max-w-2xl mx-auto grid gap-4 pb-6">
      <div className="flex gap-1 bg-paper border border-line rounded-xl p-1 w-full">
        {([["all", "feed", "Лента"], ["fav", "star", "Избранное"], ["photos", "camera", `Фото · ${gallery.length}`]] as [typeof tab, string, string][]).map(([t, ic, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12px] font-extrabold transition ${tab === t ? "bg-steel-900 text-paper shadow" : "text-mute hover:text-ink"}`}>
            <I n={ic} size={14} />{l}
          </button>
        ))}
      </div>

      {tab !== "photos" && (
        <div className="card p-4">
          <div className="flex gap-3">
            <Avatar u={me} size={42} />
            <div className="flex-1 min-w-0">
              <div className="relative">
                <textarea ref={taRef} className="input !border-transparent !bg-paper focus:!bg-surface focus:!border-accent" rows={3}
                  placeholder={`Что нового, ${me.name.split(" ")[0]}? Отметьте коллег через @…`}
                  value={text} onChange={(e) => onText(e.target.value)} />
                {mention !== null && mentionCandidates.length > 0 && (
                  <div className="absolute left-2 bottom-2 z-10 card !rounded-lg overflow-hidden w-64 anim-pop">
                    {mentionCandidates.map((u) => (
                      <button key={u.id} className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-paper text-left transition" onClick={() => insertMention(u.username)}>
                        <Avatar u={u} size={24} /><b className="text-[12px] truncate">@{u.username}</b><span className="text-[10.5px] text-mute font-bold truncate ml-auto">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(images.length > 0 || files.length > 0) && (
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {images.map((src, i) => (
                    <div key={i} className="relative group">
                      <img src={src} alt="" className="w-full aspect-square object-cover rounded-lg border border-line" />
                      <button className="absolute top-1 right-1 w-6 h-6 rounded-full bg-steel-950/75 text-white grid place-items-center opacity-90 hover:bg-bad transition" onClick={() => setImages(images.filter((_, j) => j !== i))}><I n="x" size={12} /></button>
                    </div>
                  ))}
                  {files.map((f, i) => (
                    <div key={i} className="relative border border-line rounded-lg p-2 flex flex-col items-center justify-center text-center bg-paper">
                      <I n="file" size={18} className="text-mute" />
                      <span className="text-[9.5px] font-bold truncate w-full mt-1">{f.name}</span>
                      <button className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-steel-950/70 text-white grid place-items-center hover:bg-bad" onClick={() => setFiles(files.filter((_, j) => j !== i))}><I n="x" size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              {link && <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-night bg-night-soft rounded-lg px-3 py-1.5 w-fit max-w-full"><I n="link" size={13} /><span className="truncate">{link}</span><button onClick={() => setLink("")}><I n="x" size={12} /></button></div>}

              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <I n="camera" size={14} />{busy ? "Загрузка…" : `Фото (${images.length}/10)`}
                </button>
                <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" multiple className="hidden" onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setDraw(true)}><I n="edit" size={14} />Рисунок</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { const l = window.prompt("Ссылка (https://…)", link || "https://"); if (l) setLink(l.trim()); }}><I n="link" size={14} />Ссылка</button>
                <button className={`btn btn-ghost btn-sm ${animated ? "!border-accent !text-accent-deep" : ""}`} onClick={() => setAnimated(!animated)} title="Мерцающий акцент записи"><I n="zap" size={14} />Анимация</button>
                <button className="btn btn-pri btn-sm ml-auto" onClick={publish} disabled={busy || (!text.trim() && images.length === 0 && files.length === 0 && !link.trim())}>
                  <I n="send" size={14} />Опубликовать
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] font-extrabold uppercase text-mute mr-1">Фон:</span>
                <button className={`w-6 h-6 rounded-md border-2 transition ${bg === null ? "border-ink" : "border-line hover:border-steel-400"}`} style={{ background: "#fff" }} onClick={() => setBg(null)} title="Без фона" />
                {Object.entries(BGS).map(([k, v]) => (
                  <button key={k} className={`w-6 h-6 rounded-md border-2 transition ${bg === k ? "border-ink scale-110" : "border-line hover:border-steel-400"}`} style={{ background: v }} onClick={() => setBg(k)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "photos" ? (
        gallery.length === 0 ? (
          <div className="card p-10 text-center">
            <I n="camera" size={30} className="mx-auto text-mute" />
            <b className="font-display text-sm block mt-3">Фотографий пока нет</b>
            <p className="text-[12.5px] text-mute font-bold mt-1">Все фото и рисунки со стены собраны здесь — удобно просматривать и скачивать.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {gallery.map((g, i) => (
              <button key={i} className="relative rounded-xl overflow-hidden border border-line group anim-rise" style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }} onClick={() => setLightbox(g.src)}>
                <img src={g.src} alt="" loading="lazy" className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" />
                <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-steel-950/85 to-transparent px-2.5 py-1.5 text-left opacity-0 group-hover:opacity-100 transition">
                  <b className="text-[10.5px] text-paper block truncate">{userById(db, g.by)?.name || "—"}</b>
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        posts.map((p, i) => (
          <PostCard key={p.id} p={p} delay={i * 40} canManage={canManage}
            onDelete={() => setConfirmDel(p.id)} onPin={() => togglePin(p.id)} onLike={() => toggleLike(p.id)}
            onFav={() => { toggleFav(p.id); }} onComment={(t) => addComment(p.id, t)} onPhoto={setLightbox} />
        ))
      )}
      {tab === "fav" && posts.length === 0 && (
        <div className="card p-10 text-center">
          <I n="star" size={30} className="mx-auto text-accent" />
          <b className="font-display text-sm block mt-3">В избранном пусто</b>
          <p className="text-[12.5px] text-mute font-bold mt-1">Нажмите ⭐ на любой записи — она появится здесь и будет видна только вам.</p>
        </div>
      )}

      <DrawModal open={draw} onClose={() => setDraw(false)} onSave={(src) => { addPost("Рисунок со стены 🎨", src, null, null, false, []); setDraw(false); toast("Рисунок опубликован", "ok"); }} />

      {lightbox && (
        <div className="fixed inset-0 z-[85] bg-steel-950/92 grid place-items-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-[88vh] rounded-xl shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 btn btn-ghost !bg-steel-800 !text-paper !border-steel-600" onClick={() => setLightbox(null)}><I n="x" size={16} />Закрыть</button>
        </div>
      )}

      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Удалить запись?" text="Запись будет удалена со стены безвозвратно."
        onYes={() => { if (confirmDel) { deletePost(confirmDel); toast("Запись удалена"); } }} />
    </div>
  );
}

function MentionText({ text }: { text: string }) {
  const { db } = useStore();
  const parts = text.split(/(@[\wа-яё]+)/gi);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith("@") && db.users.some((u) => u.username.toLowerCase() === p.slice(1).toLowerCase())
          ? <b key={i} className="text-accent-deep bg-accent-soft rounded px-1">{p}</b>
          : <span key={i}>{p}</span>)}
    </span>
  );
}

function PostCard({ p, canManage, onDelete, onPin, onLike, onFav, onComment, onPhoto, delay }: {
  p: WallPost; canManage: boolean; onDelete: () => void; onPin: () => void; onLike: () => void;
  onFav: () => void; onComment: (t: string) => void; onPhoto: (src: string) => void; delay: number;
}) {
  const { db, me } = useStore();
  const [openC, setOpenC] = useState(false);
  const [ct, setCt] = useState("");
  const author = userById(db, p.userId);
  const liked = !!me && p.likes.includes(me.id);
  const faved = !!me && (p.favs || []).includes(me.id);
  const mine = me?.id === p.userId;
  const imgs = [p.image, ...(p.attachments || []).filter((a) => a.type.startsWith("image/")).map((a) => a.src)].filter(Boolean) as string[];
  const docs = (p.attachments || []).filter((a) => !a.type.startsWith("image/"));

  return (
    <article className="card anim-rise overflow-hidden" style={{ animationDelay: `${Math.min(delay, 300)}ms` }}>
      <div className="p-4" style={p.bg ? { background: BGS[p.bg], color: "#f4f6f8" } : undefined}>
        <div className="flex items-center gap-3">
          <Avatar u={author} size={42} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-sm truncate">{author?.name || "Удалённый аккаунт"}</b>
              {author && <RoleBadge role={author.role} />}
              {p.pinned && <span className="badge bg-accent-soft text-accent-deep"><I n="pin" size={11} />закреп</span>}
            </div>
            <div className={`text-[11px] font-bold ${p.bg ? "text-white/70" : "text-mute"}`}>{relTime(p.ts)}{p.animated ? " · ⚡ живая запись" : ""}</div>
          </div>
          {(mine || canManage) && (
            <div className="ml-auto flex gap-1">
              {canManage && <button className={`w-8 h-8 rounded-lg grid place-items-center transition ${p.bg ? "text-white/70 hover:bg-white/15" : "text-mute hover:bg-paper hover:text-accent"}`} title={p.pinned ? "Открепить" : "Закрепить"} onClick={onPin}><I n="pin" size={15} /></button>}
              <button className={`w-8 h-8 rounded-lg grid place-items-center transition ${p.bg ? "text-white/70 hover:bg-white/15" : "text-mute hover:bg-bad-soft hover:text-bad"}`} title="Удалить" onClick={onDelete}><I n="trash" size={15} /></button>
            </div>
          )}
        </div>
        {p.text && <p className="mt-3 text-[15px] leading-relaxed"><MentionText text={p.text} /></p>}
        {p.link && (
          <a href={p.link.startsWith("http") ? p.link : `https://${p.link}`} target="_blank" rel="noreferrer"
            className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface/90 px-3 py-2 text-[12.5px] font-bold text-night hover:border-night transition w-fit max-w-full">
            <I n="link" size={14} /><span className="truncate">{p.link}</span><I n="chevR" size={13} />
          </a>
        )}
      </div>

      {imgs.length > 0 && (
        <div className={`grid gap-0.5 ${imgs.length === 1 ? "" : imgs.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {imgs.slice(0, 9).map((src, i) => (
            <button key={i} className="relative group" onClick={() => onPhoto(src)}>
              <img src={src} alt="" loading="lazy" className={`w-full object-cover border-y border-line group-hover:opacity-90 transition ${imgs.length === 1 ? "max-h-[440px]" : "aspect-square"}`} />
              {i === 8 && imgs.length > 9 && <span className="absolute inset-0 grid place-items-center bg-steel-950/60 text-white font-display font-bold text-xl">+{imgs.length - 9}</span>}
            </button>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {docs.map((a, i) => (
            <a key={i} href={a.src} download={a.name} className="inline-flex items-center gap-1.5 border border-line rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold hover:border-accent hover:text-accent-deep transition">
              <I n="file" size={13} />{a.name}<span className="text-mute">{a.size ? fileSize(a.size) : ""}</span><I n="download" size={12} />
            </a>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 flex items-center gap-1.5">
        <button onClick={onLike} className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-extrabold transition-all active:scale-90 ${liked ? "bg-bad-soft text-bad" : "bg-paper text-mute hover:text-bad"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />
          </svg>{p.likes.length || ""}
        </button>
        <button onClick={() => setOpenC(!openC)} className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-extrabold transition ${openC ? "bg-night-soft text-night" : "bg-paper text-mute hover:text-night"}`}>
          <I n="comment" size={14} />{p.comments.length || ""}
        </button>
        <button onClick={onFav} title="В избранное (видно только вам)" className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-extrabold transition-all active:scale-90 ${faved ? "bg-warn-soft text-warn" : "bg-paper text-mute hover:text-warn"}`}>
          <I n="star" size={14} />{faved ? "в избранном" : ""}
        </button>
        {p.likes.length > 0 && (
          <span className="ml-auto text-[11px] font-bold text-mute truncate hidden sm:block">
            {p.likes.slice(0, 3).map((id) => userById(db, id)?.name.split(" ")[0]).filter(Boolean).join(", ")}{p.likes.length > 3 && ` +${p.likes.length - 3}`}
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
                  <div className="mt-0.5"><MentionText text={c.text} /></div>
                </div>
              </div>
            );
          })}
          <form className="flex gap-2.5" onSubmit={(e) => { e.preventDefault(); if (ct.trim()) { onComment(ct.trim()); setCt(""); } }}>
            <Avatar u={me} size={30} />
            <input className="input !h-9 text-sm flex-1" placeholder="Комментарий… (@ для упоминания)" value={ct} onChange={(e) => setCt(e.target.value)} />
            <button className="btn btn-dark !h-9 !px-3" type="submit"><I n="send" size={14} /></button>
          </form>
        </div>
      )}
    </article>
  );
}

// ---------- рисование на стене ----------
function DrawModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (src: string) => void }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#e56f24");
  const [size, setSize] = useState(6);
  const drawing = useRef(false);
  const colors = ["#171b22", "#e56f24", "#17875c", "#3f6d9e", "#c74436", "#a97a12", "#7a4fbf", "#ffffff"];

  useEffect(() => {
    if (!open) return;
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, [open]);

  const pos = (e: React.PointerEvent) => {
    const c = cvs.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = cvs.current!.getContext("2d")!;
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = cvs.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };

  return (
    <Modal open={open} onClose={onClose} title="Рисунок на стену" w="max-w-xl"
      foot={<>
        <button className="btn btn-ghost" onClick={() => { const c = cvs.current!; const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }}><I n="trash" size={14} />Очистить</button>
        <button className="btn btn-pri" onClick={() => onSave(cvs.current!.toDataURL("image/png"))}><I n="send" size={14} />На стену</button>
      </>}>
      <canvas ref={cvs} width={700} height={460} className="w-full rounded-xl border-2 border-line touch-none cursor-crosshair bg-white"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)} />
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {colors.map((c) => (
          <button key={c} className={`w-7 h-7 rounded-full border-2 transition ${color === c ? "border-ink scale-110" : "border-line"}`} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
        <input type="range" min={2} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} className="ml-auto accent-[#e56f24]" />
        <span className="text-[11px] font-extrabold text-mute w-16">кисть {size}px</span>
      </div>
    </Modal>
  );
}
