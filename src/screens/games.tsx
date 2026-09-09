import React, { useEffect, useRef, useState } from "react";
import { useStore, userById } from "../lib/store";
import { I, Tabs, useToast, Field, Empty, Modal, Avatar } from "../components/ui";
import { relTime } from "../lib/time";

export default function GamesView() {
  const [tab, setTab] = useState("snake");
  const { db } = useStore();
  return (
    <div className="grid gap-4">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "snake", label: "Змейка", icon: "snake" },
        { id: "tictac", label: "Крестики-нолики", icon: "grid" },
        { id: "checkers", label: "Шашки", icon: "target" },
        { id: "utils", label: "Утилиты", icon: "calc" },
        { id: "more", label: "Ещё игры", icon: "game" },
      ]} />
      {tab === "snake" && <Snake />}
      {tab === "tictac" && <TicTac />}
      {tab === "checkers" && <Checkers />}
      {tab === "utils" && <Utils />}
      {tab === "more" && <MoreGames />}
      <div className="card p-4">
        <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="star" size={16} className="text-accent" />Таблица лидеров</h3>
        {db.scores.length === 0 ? (
          <p className="text-[13px] text-mute font-bold">Результатов пока нет — сыграйте партию, счёт сохранится в общем рейтинге.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {db.scores.slice(0, 12).map((s) => {
              const u = userById(db, s.userId);
              return (
                <div key={s.id} className="flex items-center gap-2.5 border border-line rounded-lg px-3 py-2">
                  <Avatar u={u} size={28} />
                  <div className="min-w-0 flex-1">
                    <b className="text-xs block truncate">{u?.name || "—"}</b>
                    <span className="text-[10px] text-mute font-bold uppercase">{s.game} · {relTime(s.ts)}</span>
                  </div>
                  <span className="font-display font-bold tnum text-accent-deep">{s.score}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Змейка ----------
function Snake() {
  const { addScore, me } = useStore();
  const { toast } = useToast();
  const cvs = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("snake.best") || 0));
  const st = useRef({ snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, food: { x: 16, y: 10 }, score: 0, alive: true });

  const reset = () => { st.current = { snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, food: randFood(), score: 0, alive: true }; setScore(0); };
  const randFood = () => ({ x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 24) });

  const setDir = (x: number, y: number) => {
    const d = st.current.dir;
    if (x === -d.x && y === -d.y) return;
    st.current.dir = { x, y };
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") setDir(0, -1);
      if (e.key === "ArrowDown" || e.key === "s") setDir(0, 1);
      if (e.key === "ArrowLeft" || e.key === "a") setDir(-1, 0);
      if (e.key === "ArrowRight" || e.key === "d") setDir(1, 0);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
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
        toast(`Игра окончена! Счёт ${s.score} — записан в рейтинг`, s.score > 5 ? "ok" : "info");
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
      ctx.fillStyle = "#232b38";
      for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * cell, j * cell, cell, cell);
      ctx.fillStyle = "#e56f24";
      ctx.beginPath(); ctx.arc(s.food.x * cell + cell / 2, s.food.y * cell + cell / 2, cell / 2.6, 0, 7); ctx.fill();
      s.snake.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? "#edf0f3" : "#17875c";
        ctx.fillRect(p.x * cell + 1.5, p.y * cell + 1.5, cell - 3, cell - 3);
      });
    }, 110);
    return () => clearInterval(t);
  }, [running, best]);
  void me;

  return (
    <div className="card p-5 flex flex-col items-center gap-4">
      <div className="flex items-center gap-4 w-full max-w-md">
        <span className="badge bg-paper text-ink">Счёт: <b className="tnum">{score}</b></span>
        <span className="badge bg-accent-soft text-accent-deep">Рекорд: <b className="tnum">{best}</b></span>
        <div className="ml-auto flex gap-2">
          {!running ? (
            <button className="btn btn-pri btn-sm" onClick={() => { reset(); setRunning(true); }}><I n="play" size={13} />Старт</button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setRunning(false)}><I n="pause" size={13} />Пауза</button>
          )}
        </div>
      </div>
      <canvas ref={cvs} width={432} height={432} className="rounded-xl border-4 border-steel-900 w-full max-w-[432px] aspect-square" />
      <div className="grid grid-cols-3 gap-1.5 sm:hidden">
        <span />
        <button className="btn btn-dark btn-sm" onClick={() => setDir(0, -1)}>▲</button>
        <span />
        <button className="btn btn-dark btn-sm" onClick={() => setDir(-1, 0)}>◀</button>
        <button className="btn btn-dark btn-sm" onClick={() => setDir(0, 1)}>▼</button>
        <button className="btn btn-dark btn-sm" onClick={() => setDir(1, 0)}>▶</button>
      </div>
      <p className="text-[12px] text-mute font-bold">Управление: стрелки / WASD / кнопки. Результат попадает в общий рейтинг компании.</p>
    </div>
  );
}

// ---------- Крестики-нолики ----------
function TicTac() {
  const { addScore } = useStore();
  const [b, setB] = useState<(null | "X" | "O")[]>(Array(9).fill(null));
  const [x, setX] = useState(true);
  const [scoreX, setScoreX] = useState(0);
  const [scoreO, setScoreO] = useState(0);
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const win = lines.map(([a, c2, d]) => b[a] && b[a] === b[c2] && b[a] === b[d] ? b[a] : null).find(Boolean) || null;
  const draw = !win && b.every(Boolean);
  const click = (i: number) => {
    if (b[i] || win) return;
    const nb = [...b]; nb[i] = x ? "X" : "O"; setB(nb);
    const w = lines.map(([a, c2, d]) => nb[a] && nb[a] === nb[c2] && nb[a] === nb[d] ? nb[a] : null).find(Boolean);
    if (w === "X") { setScoreX((v) => v + 1); addScore("Крестики-нолики", 1); }
    if (w === "O") { setScoreO((v) => v + 1); addScore("Крестики-нолики", 1); }
    setX(!x);
  };
  return (
    <div className="card p-5 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <span className="badge bg-night-soft text-night">X: {scoreX}</span>
        <b className="font-display text-sm">{win ? `Победили ${win}!` : draw ? "Ничья" : `Ход: ${x ? "X" : "O"}`}</b>
        <span className="badge bg-accent-soft text-accent-deep">O: {scoreO}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {b.map((v, i) => (
          <button key={i} onClick={() => click(i)}
            className={`aspect-square rounded-xl border-2 font-display text-4xl font-bold transition-all active:scale-95
            ${v === "X" ? "border-night text-night bg-night-soft" : v === "O" ? "border-accent text-accent-deep bg-accent-soft" : "border-line hover:border-steel-400 bg-paper"}`}>
            {v}
          </button>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm mt-4 mx-auto" onClick={() => setB(Array(9).fill(null))}><I n="history" size={13} />Новая партия</button>
    </div>
  );
}

// ---------- Шашки (упрощённые, 2 игрока) ----------
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
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && b[cr * 8 + cc] && b[cr * 8 + cc] !== p && !b[jr * 8 + jc])
        out.push({ to: jr * 8 + jc, cap: cr * 8 + cc });
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
    const wLeft = nb.filter((v) => v === "w").length, bLeft = nb.filter((v) => v === "b").length;
    if (wLeft === 0 || bLeft === 0) addScore("Шашки", 1);
  };
  const wLeft = board.filter((v) => v === "w").length, bLeft = board.filter((v) => v === "b").length;
  return (
    <div className="card p-5 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="badge bg-paper text-ink">Белые: {wLeft}</span>
        <b className="font-display text-sm">{wLeft === 0 ? "Победили чёрные!" : bLeft === 0 ? "Победили белые!" : `Ход ${white ? "белых" : "чёрных"}`}</b>
        <span className="badge bg-ink text-paper">Чёрные: {bLeft}</span>
      </div>
      <div className="grid grid-cols-8 rounded-xl overflow-hidden border-4 border-steel-900">
        {board.map((v, i) => {
          const r = Math.floor(i / 8), c = i % 8;
          const dark = (r + c) % 2 === 1;
          const isSel = sel === i;
          const canGo = myMoves.some((m) => m.to === i);
          return (
            <button key={i} onClick={() => click(i)} className={`aspect-square relative grid place-items-center transition ${dark ? "bg-steel-700" : "bg-[#e9e2d3]"} ${canGo ? "ring-2 ring-inset ring-ok" : ""} ${isSel ? "ring-2 ring-inset ring-accent" : ""}`}>
              {v && <span className={`w-[72%] h-[72%] rounded-full shadow-inner border-4 ${v === "w" ? "bg-[#f2efe8] border-[#d8d2c2]" : "bg-steel-950 border-steel-700"}`} />}
              {canGo && !v && <span className="w-3 h-3 rounded-full bg-ok/70" />}
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost btn-sm mt-4 mx-auto" onClick={() => { setBoard(init()); setSel(null); setWhite(true); }}><I n="history" size={13} />Новая партия</button>
    </div>
  );
}

// ---------- Утилиты ----------
function Utils() {
  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      <Calculator />
      <div className="grid gap-4">
        <Stopwatch />
        <Timer />
        <Camera />
      </div>
    </div>
  );
}

function Calculator() {
  const [expr, setExpr] = useState("");
  const [res, setRes] = useState("0");
  const calc = (s: string): number => {
    const toks = s.replace(/\s/g, "").match(/(\d+\.?\d*|[+\-*/()])/g) || [];
    let i = 0;
    const peek = () => toks[i];
    const num = (): number => {
      if (peek() === "(") { i++; const v = add(); i++; return v; }
      return parseFloat(toks[i++]);
    };
    const mul = (): number => {
      let v = num();
      while (peek() === "*" || peek() === "/") { const op = toks[i++]; const r = num(); v = op === "*" ? v * r : v / r; }
      return v;
    };
    const add = (): number => {
      let v = mul();
      while (peek() === "+" || peek() === "-") { const op = toks[i++]; const r = mul(); v = op === "+" ? v + r : v - r; }
      return v;
    };
    return add();
  };
  const press = (k: string) => {
    if (k === "=") { try { const v = calc(expr); setRes(String(Math.round(v * 1e8) / 1e8)); } catch { setRes("Ошибка"); } return; }
    if (k === "C") { setExpr(""); setRes("0"); return; }
    if (k === "⌫") { setExpr(expr.slice(0, -1)); return; }
    setExpr(expr + k);
  };
  const keys = ["C", "(", ")", "⌫", "7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];
  return (
    <div className="card p-5">
      <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="calc" size={16} />Калькулятор</h3>
      <div className="bg-steel-900 text-paper rounded-xl p-4 mb-3">
        <div className="text-right text-xs font-mono text-steel-400 h-4 truncate">{expr || " "}</div>
        <div className="text-right font-display text-2xl font-bold tnum truncate">{res}</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {keys.map((k) => (
          <button key={k} onClick={() => press(k)}
            className={`h-11 rounded-lg font-display font-bold text-sm transition active:scale-95
            ${k === "=" ? "bg-accent text-white hover:bg-accent-deep" : k === "C" ? "bg-bad-soft text-bad" : "bg-paper border border-line hover:border-steel-400"}`}>{k}</button>
        ))}
      </div>
    </div>
  );
}

function Stopwatch() {
  const [t, setT] = useState(0);
  const [run, setRun] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  useEffect(() => {
    if (!run) return;
    const i = setInterval(() => setT((x) => x + 10), 10);
    return () => clearInterval(i);
  }, [run]);
  const fmt = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms / 10) % 100).padStart(2, "0")}`;
  return (
    <div className="card p-5">
      <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="timer" size={16} />Секундомер</h3>
      <div className="font-mono tnum font-semibold text-4xl text-center py-3">{fmt(t)}</div>
      <div className="flex justify-center gap-2">
        <button className="btn btn-ok btn-sm" onClick={() => setRun(!run)}><I n={run ? "pause" : "play"} size={13} />{run ? "Пауза" : "Старт"}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setLaps([...laps, t])} disabled={!run}><I n="pin" size={13} />Круг</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setRun(false); setT(0); setLaps([]); }}><I n="stop" size={13} />Сброс</button>
      </div>
      {laps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
          {laps.map((l, i) => <span key={i} className="badge bg-paper text-ink font-mono">#{i + 1} {fmt(l)}</span>)}
        </div>
      )}
    </div>
  );
}

function Timer() {
  const [min, setMin] = useState(5);
  const [left, setLeft] = useState(0);
  const [run, setRun] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    if (!run || left <= 0) { if (run && left <= 0) { setRun(false); toast("Таймер завершён!", "ok"); } return; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [run, left]);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="card p-5">
      <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="clock" size={16} />Таймер</h3>
      <div className="font-mono tnum font-semibold text-4xl text-center py-3">{fmt(left)}</div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {[1, 3, 5, 10, 15, 30].map((m) => (
          <button key={m} className={`chip ${min === m && !run ? "!border-accent !text-accent-deep" : ""}`} onClick={() => { setMin(m); setLeft(m * 60); setRun(false); }}>{m} мин</button>
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-3">
        <button className="btn btn-ok btn-sm" onClick={() => { if (left === 0) setLeft(min * 60); setRun(!run); }}><I n={run ? "pause" : "play"} size={13} />{run ? "Пауза" : "Старт"}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setRun(false); setLeft(0); }}><I n="stop" size={13} />Сброс</button>
      </div>
    </div>
  );
}

function Camera() {
  const { addPost } = useStore();
  const { toast } = useToast();
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const vRef = useRef<HTMLVideoElement>(null);
  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      if (vRef.current) { vRef.current.srcObject = s; await vRef.current.play(); }
      setOn(true); setErr("");
    } catch { setErr("Камера недоступна или нет разрешения"); }
  };
  const stop = () => {
    const s = vRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    setOn(false);
  };
  const shot = () => {
    const v = vRef.current; if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const src = c.toDataURL("image/jpeg", 0.85);
    stop();
    addPost("Фото с камеры 📸", src, null, null, false, []);
    toast("Фото опубликовано на стене", "ok");
  };
  return (
    <div className="card p-5">
      <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2"><I n="camera" size={16} />Камера → в ленту</h3>
      {!on ? (
        <div className="text-center py-4">
          {err && <p className="text-xs font-bold text-bad mb-2">{err}</p>}
          <button className="btn btn-dark" onClick={start}><I n="camera" size={16} />Включить камеру</button>
          <p className="text-[11px] text-mute font-bold mt-2">Снимок сразу попадёт на стену сервера</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <video ref={vRef} playsInline muted className="rounded-xl border border-line w-full" />
          <div className="flex gap-2">
            <button className="btn btn-pri flex-1" onClick={shot}><I n="camera" size={16} />Снять и опубликовать</button>
            <button className="btn btn-ghost" onClick={stop}>Выкл</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- внешние игры ----------
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
      {db.games.length === 0 ? <Empty icon="game" title="Ссылок пока нет" text="Админ может добавить любую браузерную игру или путь к локальной." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {db.games.map((g) => (
            <div key={g.id} className="flex items-center gap-2.5 border border-line rounded-xl px-3.5 py-3 hover:border-accent transition group">
              <span className="w-9 h-9 rounded-lg bg-night-soft text-night grid place-items-center shrink-0"><I n="game" size={17} /></span>
              <a href={g.url.startsWith("http") ? g.url : `https://${g.url}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <b className="text-sm block truncate group-hover:text-accent-deep transition">{g.name}</b>
                <span className="text-[10px] text-mute font-bold truncate block">{g.url}</span>
              </a>
              {isAdmin && <button className="w-7 h-7 rounded-md grid place-items-center text-mute hover:text-bad hover:bg-bad-soft transition" onClick={() => { removeGameLink(g.id); toast("Ссылка удалена"); }}><I n="trash" size={13} /></button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Добавить игру / ссылку" w="max-w-sm"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
          <button className="btn btn-pri" disabled={!name.trim() || !url.trim()} onClick={() => { addGameLink(name.trim(), url.trim()); setOpen(false); toast("Игра добавлена", "ok"); }}><I n="check" size={15} />Добавить</button>
        </>}>
        <div className="grid gap-4">
          <Field label="Название"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Морской бой" /></Field>
          <Field label="URL или путь" hint="https://… или сетевой путь \\server\games\battleship.exe — откроется в новой вкладке"><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://battleship-game.org" /></Field>
        </div>
      </Modal>
    </div>
  );
}
