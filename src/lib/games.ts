import { LiveKind, LiveMove } from "./types";

// Доски хранятся строками: ttt — 9 символов ('.'/X/O), checkers — 64 ('.', 'w', 'b'), chess — 64 FEN-символа.
export function initBoard(kind: LiveKind): string {
  if (kind === "ttt") return ".........";
  if (kind === "checkers") {
    let b = "";
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      b += (r + c) % 2 === 1 ? (r < 3 ? "b" : r > 4 ? "w" : ".") : ".";
    }
    return b;
  }
  // шахматы (упрощённые, до взятия короля)
  return "rnbqkbnr" + "pppppppp" + "................................" + "PPPPPPPP" + "RNBQKBNR";
}

export interface MoveResult { board: string; done: boolean; winnerIdx: number | null; }

export function applyMove(kind: LiveKind, board: string, mv: LiveMove): MoveResult | null {
  if (kind === "ttt") {
    if (board[mv.to] !== ".") return null;
    const mark = mv.p === 0 ? "X" : "O";
    const nb = board.slice(0, mv.to) + mark + board.slice(mv.to + 1);
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const win = lines.some(([a, b2, c]) => nb[a] === mark && nb[b2] === mark && nb[c] === mark);
    return { board: nb, done: win || !nb.includes("."), winnerIdx: win ? mv.p : null };
  }
  if (kind === "checkers") {
    const me = mv.p === 0 ? "w" : "b";
    if (board[mv.from] !== me) return null;
    const dir = me === "w" ? -1 : 1;
    const r = Math.floor(mv.from / 8), c = mv.from % 8;
    const tr = Math.floor(mv.to / 8), tc = mv.to % 8;
    if (board[mv.to] !== ".") return null;
    const dr = tr - r, dc = tc - c;
    if (Math.abs(dc) !== 1 || (dr !== dir && !(mv.cap !== undefined && dr === 2 * dir))) return null;
    if (mv.cap !== undefined) {
      if (dr !== 2 * dir || board[mv.cap] === "." || board[mv.cap] === me) return null;
      const nb = board.slice(0, mv.from) + "." + board.slice(mv.from + 1, mv.cap) + "." + board.slice(mv.cap + 1, mv.to) + me + board.slice(mv.to + 1);
      const enemy = me === "w" ? "b" : "w";
      return { board: nb, done: !nb.includes(enemy), winnerIdx: !nb.includes(enemy) ? mv.p : null };
    }
    if (dr !== dir) return null;
    const nb = board.slice(0, mv.from) + "." + board.slice(mv.from + 1, mv.to) + me + board.slice(mv.to + 1);
    return { board: nb, done: false, winnerIdx: null };
  }
  // chess — упрощённые правила: ходы по типу фигуры, взятие короля = победа
  const white = mv.p === 0;
  const piece = board[mv.from];
  if (!piece || piece === ".") return null;
  const isWhite = piece === piece.toUpperCase();
  if (isWhite !== white) return null;
  const target = board[mv.to];
  if (target !== "." && target.toUpperCase() === target.toUpperCase() && ((target === target.toUpperCase()) === white)) return null;
  if (!chessLegal(board, mv.from, mv.to, piece)) return null;
  let moved = piece;
  if (piece.toLowerCase() === "p") {
    const lastRow = white ? 0 : 7;
    if (Math.floor(mv.to / 8) === lastRow) moved = white ? "Q" : "q";
  }
  const nb = board.slice(0, mv.from) + "." + board.slice(mv.from + 1, mv.to) + moved + board.slice(mv.to + 1);
  const kingGone = !nb.includes(white ? "k" : "K");
  return { board: nb, done: kingGone, winnerIdx: kingGone ? mv.p : null };
}

function chessLegal(board: string, from: number, to: number, piece: string): boolean {
  const fr = Math.floor(from / 8), fc = from % 8;
  const tr = Math.floor(to / 8), tc = to % 8;
  const dr = tr - fr, dc = tc - fc;
  const adr = Math.abs(dr), adc = Math.abs(dc);
  const white = piece === piece.toUpperCase();
  const target = board[to];
  if (target !== "." && (target === target.toUpperCase()) === white) return false;
  const p = piece.toLowerCase();
  const slide = (steps: [number, number][]) => {
    for (const [sr, sc] of steps) {
      let r = fr + sr, c = fc + sc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (r === tr && c === tc) return true;
        if (board[r * 8 + c] !== ".") break;
        r += sr; c += sc;
      }
    }
    return false;
  };
  if (p === "p") {
    const dir = white ? -1 : 1;
    const startRow = white ? 6 : 1;
    if (dc === 0 && target === ".") {
      if (dr === dir) return true;
      if (fr === startRow && dr === 2 * dir && board[(fr + dir) * 8 + fc] === ".") return true;
    }
    if (adc === 1 && dr === dir && target !== ".") return true;
    return false;
  }
  if (p === "n") return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
  if (p === "k") return adr <= 1 && adc <= 1 && (adr + adc > 0);
  if (p === "r") return (dr === 0 || dc === 0) && slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  if (p === "b") return adr === adc && adr > 0 && slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  if (p === "q") return ((dr === 0 || dc === 0) || adr === adc) && slide([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
  return false;
}

export function checkersMoves(board: string, player: number): { from: number; to: number; cap?: number }[] {
  const me = player === 0 ? "w" : "b";
  const dir = me === "w" ? -1 : 1;
  const out: { from: number; to: number; cap?: number }[] = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] !== me) continue;
    const r = Math.floor(i / 8), c = i % 8;
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr * 8 + nc] === ".") out.push({ from: i, to: nr * 8 + nc });
      const jr = r + 2 * dir, jc = c + 2 * dc;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8) {
        const mid = board[nr * 8 + nc];
        if (mid !== "." && mid !== me && board[jr * 8 + jc] === ".") out.push({ from: i, to: jr * 8 + jc, cap: nr * 8 + nc });
      }
    }
  }
  return out;
}

export const KIND_LABEL_LIVE: Record<LiveKind, string> = { ttt: "Крестики-нолики", checkers: "Шашки", chess: "Шахматы (упр.)" };
