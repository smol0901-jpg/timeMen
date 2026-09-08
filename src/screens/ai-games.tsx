import React, { useState, useEffect } from "react";
import { useStore } from "../lib/store";
import { LiveKind, AILevel, LiveGame } from "../lib/types";
import { I, useToast, Seg, Empty } from "../components/ui";
import { applyMove } from "../lib/games";

export default function AIGamesView() {
  const { db, me, createAIGame, makeAIMove, learnFromGame } = useStore();
  const { toast } = useToast();
  const [kind, setKind] = useState<LiveKind>("ttt");
  const [level, setLevel] = useState<AILevel>("medium");
  const [gameId, setGameId] = useState<string | null>(null);

  if (!me) return null;

  const game = gameId ? db.liveGames.find((g) => g.id === gameId) : null;

  const startGame = () => {
    const id = createAIGame(kind, level);
    setGameId(id);
    toast(`Игра с ИИ началась (${level})`, "ok");
  };

  useEffect(() => {
    if (game && game.status === "play" && game.turn === 1) {
      setTimeout(() => {
        const err = makeAIMove(game.id);
        if (err) toast(err, "bad");
      }, 500);
    }
  }, [game]);

  const handleMove = (to: number, from?: number, cap?: number) => {
    if (!game || game.status !== "play" || game.turn !== 0) return;
    const move = { from: from ?? to, to, p: 0, cap };
    const result = applyMove(game.kind, game.board, move);
    if (!result) return;

    // Обновляем локально через liveMove
    const { liveMove } = useStore();
    const err = liveMove(game.id, { from: from ?? to, to, cap });
    if (err) {
      toast(err, "bad");
      return;
    }

    // Если игра закончилась
    if (result.done) {
      const winner = result.winnerIdx === 0 ? "human" : result.winnerIdx === 1 ? "ai" : "draw";
      learnFromGame(game.id, winner);
      toast(winner === "human" ? "Вы победили!" : winner === "ai" ? "ИИ победил" : "Ничья", winner === "human" ? "ok" : "info");
      setGameId(null);
    }
  };

  const ai = db.gameAI.find((a) => a.kind === kind);

  return (
    <div className="grid gap-4 max-w-3xl mx-auto">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4">Игры с ИИ</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <span className="lbl">Игра</span>
            <Seg opts={[
              { v: "ttt", label: "Крестики-нолики", icon: "grid" },
              { v: "checkers", label: "Шашки", icon: "target" },
              { v: "chess", label: "Шахматы", icon: "game" },
            ]} val={kind} onChange={(k) => setKind(k as LiveKind)} />
          </div>
          <div>
            <span className="lbl">Уровень ИИ</span>
            <Seg opts={[
              { v: "easy", label: "Лёгкий" },
              { v: "medium", label: "Средний" },
              { v: "hard", label: "Сложный" },
              { v: "adaptive", label: "Самообучение" },
            ]} val={level} onChange={(l) => setLevel(l as AILevel)} />
          </div>
        </div>
        {ai && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-ok-soft text-ok p-2 text-center">
              <div className="font-display text-lg font-bold tnum">{ai.wins}</div>
              <div className="text-[10px] font-extrabold uppercase">Побед ИИ</div>
            </div>
            <div className="rounded-lg bg-bad-soft text-bad p-2 text-center">
              <div className="font-display text-lg font-bold tnum">{ai.losses}</div>
              <div className="text-[10px] font-extrabold uppercase">Поражений</div>
            </div>
            <div className="rounded-lg bg-paper text-mute p-2 text-center">
              <div className="font-display text-lg font-bold tnum">{ai.draws}</div>
              <div className="text-[10px] font-extrabold uppercase">Ничьих</div>
            </div>
          </div>
        )}
        {!game ? (
          <button className="btn btn-pri w-full" onClick={startGame}><I n="play" size={16} />Начать игру</button>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <b className="text-sm">Ваш ход: {game.turn === 0 ? "ДА" : "НЕТ (ИИ думает...)"}</b>
              <button className="btn btn-ghost btn-sm" onClick={() => setGameId(null)}><I n="x" size={13} />Сдаться</button>
            </div>
            <GameBoard game={game} onMove={handleMove} />
          </div>
        )}
      </div>
    </div>
  );
}

function GameBoard({ game, onMove }: { game: LiveGame; onMove: (to: number, from?: number, cap?: number) => void }) {
  if (game.kind === "ttt") return <TTTBoard board={game.board} onMove={onMove} />;
  if (game.kind === "checkers") return <CheckersBoard board={game.board} onMove={onMove} />;
  if (game.kind === "chess") return <ChessBoard board={game.board} onMove={onMove} />;
  return null;
}

function TTTBoard({ board, onMove }: { board: string; onMove: (to: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
      {board.split("").map((cell, i) => (
        <button key={i} onClick={() => cell === "." && onMove(i)}
          className={`aspect-square rounded-xl border-2 text-4xl font-bold transition ${cell === "." ? "border-line hover:border-accent" : "border-steel-400"} ${cell === "X" ? "text-night" : cell === "O" ? "text-accent" : ""}`}>
          {cell !== "." ? cell : ""}
        </button>
      ))}
    </div>
  );
}

function CheckersBoard({ board, onMove }: { board: string; onMove: (to: number, from: number, cap?: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-8 gap-0.5 max-w-md mx-auto border-4 border-steel-900 rounded">
      {board.split("").map((cell, i) => {
        const r = Math.floor(i / 8), c = i % 8;
        const dark = (r + c) % 2 === 1;
        return (
          <button key={i} onClick={() => {
            if (sel === null) {
              if (cell === "w") setSel(i);
            } else {
              if (cell === ".") {
                const dr = Math.floor(i / 8) - Math.floor(sel / 8);
                const dc = (i % 8) - (sel % 8);
                if (Math.abs(dc) === 1 && dr === -1) {
                  onMove(i, sel);
                  setSel(null);
                } else if (Math.abs(dc) === 2 && dr === -2) {
                  const cap = Math.floor(sel / 8) * 8 + (sel % 8) + dc / 2;
                  if (board[cap] === "b") {
                    onMove(i, sel, cap);
                    setSel(null);
                  }
                }
              } else {
                setSel(null);
              }
            }
          }}
            className={`aspect-square grid place-items-center ${dark ? "bg-steel-700" : "bg-[#e9e2d3]"} ${sel === i ? "ring-2 ring-accent" : ""}`}>
            {cell === "w" && <span className="w-3/4 h-3/4 rounded-full bg-[#f2efe8] border-4 border-[#d8d2c2]" />}
            {cell === "b" && <span className="w-3/4 h-3/4 rounded-full bg-steel-950 border-4 border-steel-700" />}
          </button>
        );
      })}
    </div>
  );
}

function ChessBoard({ board, onMove }: { board: string; onMove: (to: number, from: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const pieces: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  return (
    <div className="grid grid-cols-8 gap-0 max-w-md mx-auto border-4 border-steel-900 rounded">
      {board.split("").map((cell, i) => {
        const r = Math.floor(i / 8), c = i % 8;
        const light = (r + c) % 2 === 0;
        return (
          <button key={i} onClick={() => {
            if (sel === null) {
              if (cell !== "." && cell === cell.toUpperCase()) setSel(i);
            } else {
              onMove(i, sel);
              setSel(null);
            }
          }}
            className={`aspect-square grid place-items-center text-2xl ${light ? "bg-[#f0d9b5]" : "bg-[#b58863]"} ${sel === i ? "ring-2 ring-accent" : ""}`}>
            {cell !== "." && pieces[cell]}
          </button>
        );
      })}
    </div>
  );
}
