import React, { useMemo, useState } from "react";
import { useStore, userById } from "../lib/store";
import { LiveGame, LiveKind } from "../lib/types";
import { KIND_LABEL_LIVE, checkersMoves } from "../lib/games";
import { relTime } from "../lib/time";
import { I, Avatar, useToast, Empty, Modal, Seg } from "../components/ui";

export default function LiveGamesView() {
  const { db, me, createLiveGame, joinLiveGame, liveMove, resignLive, addPost } = useStore();
  const { toast } = useToast();
  const [kind, setKind] = useState<LiveKind>("checkers");
  const [opp, setOpp] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [wallAsk, setWallAsk] = useState<LiveGame | null>(null);
  if (!me) return null;

  const games = db.liveGames.filter((g) => Date.now() - new Date(g.updatedAt).getTime() < 14 * 86400000);
  const mine = games.find((g) => g.status !== "done" && g.players.includes(me.id)) || null;
  const open = openId ? games.find((g) => g.id === openId) : null;
  const emps = db.users.filter((u) => u.active && !u.archived && u.id !== me.id);

  return (
    <div className="grid gap-4 max-w-4xl mx-auto">
      <div className="card p-4 anim-rise" style={{ background: "linear-gradient(110deg,#e7eef6,#fff 60%)" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-10 h-10 rounded-xl bg-night-soft text-night grid place-items-center shrink-0"><I n="zap" size={19} /></span>
          <div className="flex-1 min-w-[220px]">
            <b className="text-sm block font-display">Живые партии внутри сети</b>
            <span className="text-[12px] text-mute font-bold">Ходы соперника появляются в течение секунды на всех устройствах · наблюдать может любой</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Seg opts={[{ v: "ttt", label: "Крестики" }, { v: "checkers", label: "Шашки" }, { v: "chess", label: "Шахматы" }]} val={kind} onChange={setKind} />
          <select className="input !w-52 !h-9" value={opp} onChange={(e) => setOpp(e.target.value)}>
            <option value="">Открытая партия (кто угодно)</option>
            {emps.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn btn-pri btn-sm" disabled={!!mine} onClick={() => {
            const id = createLiveGame(kind, opp || null);
            setOpenId(id);
            toast(opp ? "Вызов отправлен — соперник увидит уведомление" : "Партия создана — ждём соперника", "ok");
          }}><I n="plus" size={13} />{mine ? "У вас уже есть партия" : "Создать партию"}</button>
        </div>
      </div>

      {games.filter((g) => g.status === "waiting").map((g) => {
        const host = userById(db, g.players[0]);
        const invited = g.players[1] ? userById(db, g.players[1]) : null;
        const canJoin = !g.players[1] || g.players[1] === me.id;
        return (
          <div key={g.id} className="card p-4 flex items-center gap-3 flex-wrap anim-rise !border-night/40">
            <span className="badge bg-night-soft text-night"><I n="game" size={11} />{KIND_LABEL_LIVE[g.kind]}</span>
            <b className="text-sm flex items-center gap-2"><Avatar u={host} size={26} />{host?.name}</b>
            {invited && <span className="text-[12px] font-bold text-mute">→ {invited.name}</span>}
            <span className="text-[11px] text-mute font-bold ml-1">{relTime(g.createdAt)}</span>
            <div className="ml-auto flex gap-2">
              {canJoin && g.players[0] !== me.id && (
                <button className="btn btn-ok btn-sm" onClick={() => { const r = joinLiveGame(g.id); if (r) toast(r, "bad"); else { setOpenId(g.id); toast("Партия началась!", "ok"); } }}><I n="play" size={13} />Принять вызов</button>
              )}
              {g.players[0] === me.id && <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(g.id)}>Открыть</button>}
            </div>
          </div>
        );
      })}

      {open ? (
        <Board g={open} onClose={() => setOpenId(null)} onMove={(mv) => { const r = liveMove(open.id, mv); if (r) toast(r, "bad"); }}
          onResign={() => { resignLive(open.id); toast("Вы сдались", "info"); }}
          onWall={() => setWallAsk(open)} meId={me.id} />
      ) : (
        <>
          {games.filter((g) => g.status === "play").map((g) => (
            <button key={g.id} className="card p-4 flex items-center gap-3 text-left hover:-translate-y-0.5 transition-transform anim-rise" onClick={() => setOpenId(g.id)}>
              <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-deep grid place-items-center"><I n="play" size={16} /></span>
              <span className="min-w-0 flex-1">
                <b className="text-[13px] block">{KIND_LABEL_LIVE[g.kind]}: {userById(db, g.players[0])?.name.split(" ")[0]} vs {g.players[1] ? userById(db, g.players[1])?.name.split(" ")[0] : "…"}</b>
                <span className="text-[11px] text-mute font-bold">идёт сейчас · ходов: {g.moves.length} · нажмите, чтобы смотреть или играть</span>
              </span>
              <span className="badge bg-ok-soft text-ok"><span className="w-1.5 h-1.5 rounded-full bg-ok pulse-ok" />live</span>
            </button>
          ))}
          {games.filter((g) => g.status === "done").slice(0, 6).map((g) => (
            <div key={g.id} className="card p-3.5 flex items-center gap-3 anim-rise">
              <I n="check" size={16} className="text-ok shrink-0" />
              <span className="text-[12.5px] font-bold truncate">
                {KIND_LABEL_LIVE[g.kind]}: {g.winner ? `победил ${userById(db, g.winner)?.name.split(" ")[0] || "?"}` : "ничья"}
                <span className="text-mute font-semibold"> · {relTime(g.updatedAt)}</span>
              </span>
              <div className="ml-auto flex gap-1.5">
                <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(g.id)}>Доска</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setWallAsk(g)}><I n="feed" size={12} />На стену</button>
              </div>
            </div>
          ))}
          {games.length === 0 && <div className="card"><Empty icon="zap" title="Партий пока нет" text="Создайте первую — вызов мгновенно увидят коллеги на всех устройствах сети." /></div>}
        </>
      )}

      <Modal open={!!wallAsk} onClose={() => setWallAsk(null)} title="Результат на стену" w="max-w-sm"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setWallAsk(null)}>Отмена</button>
          <button className="btn btn-pri" onClick={() => {
            if (!wallAsk) return;
            const w = wallAsk.winner ? userById(db, wallAsk.winner)?.name : null;
            addPost(`🏆 ${KIND_LABEL_LIVE[wallAsk.kind]}: ${w ? `победил ${w}` : "ничья"} (${wallAsk.moves.length} ходов). Реванш?`, null, null, "g2", false, []);
            setWallAsk(null);
            toast("Опубликовано на стене", "ok");
          }}><I n="feed" size={14} />Опубликовать</button>
        </>}>
        <p className="text-sm text-mute font-bold leading-relaxed">Запись увидит вся компания: игра, счёт ходов и победитель.</p>
      </Modal>
    </div>
  );
}

function Board({ g, meId, onClose, onMove, onResign, onWall }: {
  g: LiveGame; meId: string; onClose: () => void;
  onMove: (mv: { from: number; to: number; cap?: number }) => void;
  onResign: () => void; onWall: () => void;
}) {
  const { db } = useStore();
  const [sel, setSel] = useState<number | null>(null);
  const myIdx = g.players.indexOf(meId);
  const playing = myIdx >= 0 && g.status === "play";
  const myTurn = playing && g.turn === myIdx;
  const p0 = userById(db, g.players[0]);
  const p1 = g.players[1] ? userById(db, g.players[1]) : null;
  const legal = useMemo(() => (g.kind === "checkers" && myTurn ? checkersMoves(g.board, g.turn).filter((m) => g.board[m.from] === (g.turn === 0 ? "w" : "b")) : []), [g, myTurn]);

  const cellClick = (i: number) => {
    if (!myTurn) return;
    if (g.kind === "ttt") { onMove({ from: i, to: i }); return; }
    if (g.kind === "checkers") {
      if (sel === null) {
        if (legal.some((m) => m.from === i)) setSel(i);
        return;
      }
      const mv = legal.find((m) => m.from === sel && m.to === i);
      if (mv) { onMove({ from: mv.from, to: mv.to, cap: mv.cap }); setSel(null); }
      else setSel(legal.some((m) => m.from === i) ? i : null);
      return;
    }
    // chess
    if (sel === null) {
      const piece = g.board[i];
      if (piece !== "." && (piece === piece.toUpperCase()) === (g.turn === 0)) setSel(i);
      return;
    }
    if (i === sel) { setSel(null); return; }
    onMove({ from: sel, to: i });
    setSel(null);
  };

  return (
    <div className="card p-4 anim-rise">
      <div className="flex items-center gap-2.5 flex-wrap mb-3">
        <span className="badge bg-night-soft text-night"><I n="game" size={11} />{KIND_LABEL_LIVE[g.kind]}</span>
        <b className="text-sm flex items-center gap-2"><Avatar u={p0} size={24} />{p0?.name.split(" ")[0]} {g.kind === "chess" ? "(белые)" : ""}</b>
        <span className="font-display text-base font-bold tnum">vs</span>
        <b className="text-sm flex items-center gap-2">{p1 ? <><Avatar u={p1} size={24} />{p1.name.split(" ")[0]}</> : "ожидание соперника…"}</b>
        <span className={`badge ml-auto ${g.status === "done" ? "bg-paper text-mute" : g.turn === 0 ? "bg-accent-soft text-accent-deep" : "bg-night-soft text-night"}`}>
          {g.status === "done" ? (g.winner ? `победил ${userById(db, g.winner)?.name.split(" ")[0]}` : "ничья") : myTurn ? "ваш ход" : `ход: ${g.turn === 0 ? p0?.name.split(" ")[0] : p1?.name.split(" ")[0] || "?"}`}
        </span>
        {g.status !== "done" && <span className="badge bg-ok-soft text-ok"><span className="w-1.5 h-1.5 rounded-full bg-ok pulse-ok" />live</span>}
      </div>

      {g.kind === "ttt" && (
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {g.board.split("").map((v, i) => (
            <button key={i} onClick={() => cellClick(i)}
              className={`aspect-square rounded-xl border-2 font-display text-4xl font-bold transition-all active:scale-95 ${v === "X" ? "border-night text-night bg-night-soft" : v === "O" ? "border-accent text-accent-deep bg-accent-soft" : myTurn ? "border-line hover:border-accent bg-paper" : "border-line bg-paper"}`}>{v === "." ? "" : v}</button>
          ))}
        </div>
      )}

      {g.kind === "checkers" && (
        <div className="grid grid-cols-8 rounded-xl overflow-hidden border-4 border-steel-900 max-w-lg mx-auto">
          {g.board.split("").map((v, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const dark = (r + c) % 2 === 1;
            const can = myTurn && (legal.some((m) => m.from === i) || (sel !== null && legal.some((m) => m.from === sel && m.to === i)));
            return (
              <button key={i} onClick={() => cellClick(i)}
                className={`aspect-square relative grid place-items-center transition ${dark ? "bg-steel-700" : "bg-[#e9e2d3]"} ${sel === i ? "ring-2 ring-inset ring-accent" : ""} ${can && sel !== i ? "ring-2 ring-inset ring-ok" : ""}`}>
                {v !== "." && <span className={`w-[72%] h-[72%] rounded-full border-4 ${v === "w" ? "bg-[#f2efe8] border-[#d8d2c2]" : "bg-steel-950 border-steel-700"}`} />}
                {can && sel !== i && v === "." && <span className="w-3 h-3 rounded-full bg-ok/70" />}
              </button>
            );
          })}
        </div>
      )}

      {g.kind === "chess" && (
        <div className="grid grid-cols-8 rounded-xl overflow-hidden border-4 border-steel-900 max-w-lg mx-auto select-none">
          {g.board.split("").map((v, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const light = (r + c) % 2 === 0;
            return (
              <button key={i} onClick={() => cellClick(i)}
                className={`aspect-square grid place-items-center text-[clamp(14px,4vw,30px)] font-bold transition ${light ? "bg-[#f0e6d2]" : "bg-[#8a6f4d]"} ${sel === i ? "ring-2 ring-inset ring-accent" : ""}`}
                style={{ color: v === v.toUpperCase() ? "#f7f3e8" : "#1d1d1f", textShadow: v === v.toUpperCase() ? "0 1px 2px rgba(0,0,0,0.5)" : "none" }}>
                {v !== "." ? GLYPH[v] || v : ""}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] font-bold text-mute text-center mt-3">
        Ходы синхронизируются через сервер в реальном времени · ходов сыграно: {g.moves.length}{g.kind === "chess" ? " · упрощённые правила: победа — взятие короля" : ""}
      </p>
      <div className="flex gap-2 mt-3 justify-center flex-wrap">
        {playing && g.status === "play" && <button className="btn btn-ghost btn-sm" onClick={onResign}><I n="x" size={13} />Сдаться</button>}
        {g.status === "done" && <button className="btn btn-soft btn-sm" onClick={onWall}><I n="feed" size={13} />Результат на стену</button>}
        <button className="btn btn-dark btn-sm" onClick={onClose}><I n="chevL" size={13} />К списку</button>
      </div>
    </div>
  );
}

const GLYPH: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
