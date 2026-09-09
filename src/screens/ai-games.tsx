import React, { useState, useEffect } from "react";
import { useStore } from "../lib/store";
import { LiveKind, AILevel } from "../lib/types";
import { I, useToast, Seg, Empty } from "../components/ui";
import { applyMove, initBoard } from "../lib/games";
import { calculateAIMove } from "../lib/ai";

interface LocalGame {
  id: string;
  kind: LiveKind;
  level: AILevel;
  board: string;
  turn: number;
  moves: number;
  done: boolean;
  winner: string | null;
}

export default function AIGamesView() {
  const { db, me } = useStore();
  const { toast } = useToast();
  const [kind, setKind] = useState<LiveKind>("ttt");
  const [level, setLevel] = useState<AILevel>("medium");
  const [game, setGame] = useState<LocalGame | null>(null);

  if (!me) return null;

  const ai = db.gameAI.find((a) => a.kind === kind);

  const startGame = () => {
    setGame({
      id: 'local-' + Date.now(),
      kind,
      level,
      board: initBoard(kind),
      turn: 0,
      moves: 0,
      done: false,
      winner: null
    });
    toast(`Игра с ИИ началась (${level})`, "ok");
  };

  // AI ход
  useEffect(() => {
    if (!game || game.done || game.turn !== 1) return;
    
    const timer = setTimeout(() => {
      const aiMove = calculateAIMove(game.kind, game.board, 1, game.level);
      if (!aiMove) return;
      
      const result = applyMove(game.kind, game.board, { ...aiMove, p: 1 });
      if (!result) return;
      
      setGame({
        ...game,
        board: result.board,
        turn: 0,
        moves: game.moves + 1,
        done: result.done,
        winner: result.winnerIdx === 1 ? "ИИ" : result.winnerIdx === 0 ? "Вы" : null
      });
      
      if (result.done) {
        const winner = result.winnerIdx === 1 ? "ai" : result.winnerIdx === 0 ? "human" : "draw";
        toast(winner === "human" ? "Вы победили!" : winner === "ai" ? "ИИ победил" : "Ничья", 
              winner === "human" ? "ok" : "info");
      }
    }, 600);
    
    return () => clearTimeout(timer);
  }, [game]);

  const handleMove = (to: number, from?: number, cap?: number) => {
    if (!game || game.done || game.turn !== 0) return;
    
    const move = { from: from ?? to, to, p: 0, cap };
    const result = applyMove(game.kind, game.board, move);
    if (!result) return;
    
    setGame({
      ...game,
      board: result.board,
      turn: 1,
      moves: game.moves + 1,
      done: result.done,
      winner: result.winnerIdx === 0 ? "Вы" : result.winnerIdx === 1 ? "ИИ" : null
    });
    
    if (result.done) {
      const winner = result.winnerIdx === 0 ? "human" : result.winnerIdx === 1 ? "ai" : "draw";
      toast(winner === "human" ? "Вы победили!" : winner === "ai" ? "ИИ победил" : "Ничья", 
            winner === "human" ? "ok" : "info");
    }
  };

  return (
    <div className="grid gap-4 max-w-3xl mx-auto">
      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
          <I n="game" size={18} className="text-accent" />
          Игры с ИИ
        </h3>
        
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
          <button className="btn btn-pri w-full" onClick={startGame}>
            <I n="play" size={16} />Начать игру
          </button>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <b className="text-sm">
                {game.done ? (
                  <span className={game.winner === "Вы" ? "text-ok" : "text-bad"}>
                    {game.winner === "Вы" ? "🎉 Победа!" : game.winner === "ИИ" ? "😔 Поражение" : "🤝 Ничья"}
                  </span>
                ) : (
                  <>Ваш ход: {game.turn === 0 ? "✅ ДА" : "⏳ НЕТ (ИИ думает...)"}</>
                )}
              </b>
              <button className="btn btn-ghost btn-sm" onClick={() => setGame(null)}>
                <I n="x" size={13} />Завершить
              </button>
            </div>
            
            <GameBoard game={game} onMove={handleMove} />
          </div>
        )}
      </div>
    </div>
  );
}

function GameBoard({ game, onMove }: { game: LocalGame; onMove: (to: number, from?: number, cap?: number) => void }) {
  if (game.kind === "ttt") return <TTTBoard board={game.board} onMove={onMove} />;
  if (game.kind === "checkers") return <CheckersBoard board={game.board} onMove={onMove} />;
  if (game.kind === "chess") return <ChessBoard board={game.board} onMove={onMove} />;
  return null;
}

function TTTBoard({ board, onMove }: { board: string; onMove: (to: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
      {board.split("").map((cell, i) => (
        <button
          key={i}
          onClick={() => cell === "." && onMove(i)}
          disabled={cell !== "."}
          className={`aspect-square rounded-xl border-2 text-4xl font-bold transition-all
            ${cell === "." ? "border-line hover:border-accent hover:bg-accent-soft cursor-pointer" : "border-steel-400 cursor-default"}
            ${cell === "X" ? "text-night bg-night-soft" : cell === "O" ? "text-accent bg-accent-soft" : "bg-surface"}`}
        >
          {cell !== "." ? cell : ""}
        </button>
      ))}
    </div>
  );
}

function CheckersBoard({ board, onMove }: { board: string; onMove: (to: number, from: number, cap?: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-8 gap-0.5 max-w-md mx-auto border-4 border-steel-900 rounded-lg overflow-hidden">
      {board.split("").map((cell, i) => {
        const r = Math.floor(i / 8), c = i % 8;
        const dark = (r + c) % 2 === 1;
        const isSelected = sel === i;
        const isWhite = cell === "w";
        const isBlack = cell === "b";

        return (
          <button
            key={i}
            onClick={() => {
              if (sel === null) {
                if (isWhite) setSel(i);
              } else {
                if (cell === ".") {
                  const dr = Math.floor(i / 8) - Math.floor(sel / 8);
                  const dc = (i % 8) - (sel % 8);
                  
                  // Обычный ход
                  if (Math.abs(dc) === 1 && dr === -1) {
                    onMove(i, sel);
                    setSel(null);
                  }
                  // Взятие
                  else if (Math.abs(dc) === 2 && dr === -2) {
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
            className={`aspect-square grid place-items-center transition-all
              ${dark ? "bg-steel-700" : "bg-[#e9e2d3]"}
              ${isSelected ? "ring-2 ring-accent ring-inset" : ""}
              ${isWhite && sel === null ? "hover:ring-2 hover:ring-accent hover:ring-inset cursor-pointer" : ""}`}
          >
            {isWhite && (
              <span className="w-3/4 h-3/4 rounded-full bg-[#f2efe8] border-4 border-[#d8d2c2] shadow-md" />
            )}
            {isBlack && (
              <span className="w-3/4 h-3/4 rounded-full bg-steel-950 border-4 border-steel-700 shadow-md" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ChessBoard({ board, onMove }: { board: string; onMove: (to: number, from: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const pieces: Record<string, string> = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
  };

  return (
    <div className="grid grid-cols-8 gap-0 max-w-md mx-auto border-4 border-steel-900 rounded-lg overflow-hidden">
      {board.split("").map((cell, i) => {
        const r = Math.floor(i / 8), c = i % 8;
        const light = (r + c) % 2 === 0;
        const isSelected = sel === i;
        const isWhite = cell !== "." && cell === cell.toUpperCase();

        return (
          <button
            key={i}
            onClick={() => {
              if (sel === null) {
                if (cell !== "." && isWhite) setSel(i);
              } else {
                onMove(i, sel);
                setSel(null);
              }
            }}
            className={`aspect-square grid place-items-center text-2xl transition-all
              ${light ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
              ${isSelected ? "ring-2 ring-accent ring-inset" : ""}
              ${cell !== "." && isWhite && sel === null ? "hover:ring-2 hover:ring-accent hover:ring-inset cursor-pointer" : ""}`}
          >
            {cell !== "." && (
              <span className={isWhite ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" : "text-steel-900"}>
                {pieces[cell]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
