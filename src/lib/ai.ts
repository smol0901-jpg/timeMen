import { DB, CronJob, LiveKind, LiveMove, GameAI } from "./types";
import { initBoard, applyMove, checkersMoves } from "./games";
import { todayKey, nowMin, addDaysKey, rangeKeys } from "./time";

// ---------- Крон-задачи ----------
export async function executeCronJob(db: DB, job: CronJob): Promise<string> {
  switch (job.kind) {
    case "analyze_shifts": return analyzeShifts(db);
    case "analyze_photos": return analyzePhotos(db);
    case "check_schedule": return checkSchedule(db);
    case "check_punctuality": return checkPunctuality(db);
    case "analyze_production": return analyzeProduction(db);
    case "analyze_hours": return analyzeHours(db);
    case "custom": return "Пользовательская задача";
    default: return "Неизвестный тип задачи";
  }
}

function analyzeShifts(db: DB): string {
  const tk = todayKey();
  const open = db.punches.filter((p) => p.tout === null);
  const unscheduled = open.filter((p) => p.auto === "unscheduled");
  return `Открыто смен: ${open.length}, вне графика: ${unscheduled.length}`;
}

function analyzePhotos(db: DB): string {
  const recent = db.camshots.filter((s) => Date.now() - new Date(s.ts).getTime() < 86400000);
  const unverified = recent.filter((s) => s.status === "new");
  return `Снимков за сутки: ${recent.length}, не проверено: ${unverified.length}`;
}

function checkSchedule(db: DB): string {
  const tk = todayKey();
  const next7 = rangeKeys(tk, addDaysKey(tk, 6));
  const gaps = next7.filter((k) => !db.schedule.some((s) => s.date === k && (s.type === "day" || s.type === "night")));
  return gaps.length > 0 ? `Дней без смен: ${gaps.length}` : "График заполнен";
}

function checkPunctuality(db: DB): string {
  const tk = todayKey();
  const late = db.punches.filter((p) => {
    if (p.date !== tk) return false;
    const cell = db.schedule.find((s) => s.userId === p.userId && s.date === tk);
    return cell && (cell.type === "day" || cell.type === "night") && p.tin > 485;
  });
  return late.length > 0 ? `Опозданий сегодня: ${late.length}` : "Опозданий нет";
}

function analyzeProduction(db: DB): string {
  const tk = todayKey();
  const today = db.production.filter((r) => r.date === tk);
  const total = today.reduce((s, r) => s + r.qty, 0);
  return `Выработка сегодня: ${total.toFixed(1)} кг (${today.length} записей)`;
}

function analyzeHours(db: DB): string {
  const tk = todayKey();
  const today = db.punches.filter((p) => p.date === tk);
  const hours = today.reduce((s, p) => s + (p.tout ? (p.tout - p.tin) : 0), 0) / 60;
  return `Часов сегодня: ${hours.toFixed(1)} (${today.length} отметок)`;
}

// ---------- ИИ-анализ ----------
export async function analyzeAll(db: DB): Promise<string> {
  const shifts = analyzeShifts(db);
  const photos = analyzePhotos(db);
  const schedule = checkSchedule(db);
  const punctuality = checkPunctuality(db);
  const production = analyzeProduction(db);
  const hours = analyzeHours(db);
  return `Анализ завершён. Смены: ${shifts}. Фото: ${photos}. График: ${schedule}. Пунктуальность: ${punctuality}. Выработка: ${production}. Часы: ${hours}`;
}

export function generateBotReport(db: DB): string {
  const tk = todayKey();
  const open = db.punches.filter((p) => p.tout === null).length;
  const todayPunches = db.punches.filter((p) => p.date === tk).length;
  const todayProduction = db.production.filter((r) => r.date === tk).reduce((s, r) => s + r.qty, 0);
  const unverifiedPhotos = db.camshots.filter((s) => s.status === "new").length;
  const pendingRequests = db.requests.filter((r) => r.status === "pending").length;

  return `
=== ОТЧЁТ ИИ-БОТА ===
Дата: ${tk}
Время: ${new Date().toLocaleTimeString("ru-RU")}

СМЕНЫ:
- Открыто сейчас: ${open}
- Отметок сегодня: ${todayPunches}

ВЫРАБОТКА:
- Сегодня: ${todayProduction.toFixed(1)} кг

КАМЕРЫ:
- Непроверенных снимков: ${unverifiedPhotos}

ЗАЯВКИ:
- Ожидают решения: ${pendingRequests}

УВЕРЕННОСТЬ МОДЕЛИ: ${db.botBrain.confidence}%
ПОСЛЕДНЕЕ ОБУЧЕНИЕ: ${db.botBrain.lastTraining ? new Date(db.botBrain.lastTraining).toLocaleString("ru-RU") : "никогда"}
  `.trim();
}

// ---------- ИИ в играх ----------
export function calculateAIMove(kind: LiveKind, board: string, player: number, level: string, ai?: GameAI): LiveMove | null {
  if (kind === "ttt") return calculateTTTMove(board, player, level);
  if (kind === "checkers") return calculateCheckersMove(board, player, level, ai);
  if (kind === "chess") return calculateChessMove(board, player, level, ai);
  return null;
}

function calculateTTTMove(board: string, player: number, level: string): LiveMove | null {
  const me = player === 0 ? "X" : "O";
  const opp = player === 0 ? "O" : "X";
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  // Победа
  for (const [a, b, c] of lines) {
    if (board[a] === me && board[b] === me && board[c] === ".") return { from: a, to: c, p: player };
    if (board[a] === me && board[c] === me && board[b] === ".") return { from: a, to: b, p: player };
    if (board[b] === me && board[c] === me && board[a] === ".") return { from: b, to: a, p: player };
  }

  // Блокировка
  if (level !== "easy") {
    for (const [a, b, c] of lines) {
      if (board[a] === opp && board[b] === opp && board[c] === ".") return { from: a, to: c, p: player };
      if (board[a] === opp && board[c] === opp && board[b] === ".") return { from: a, to: b, p: player };
      if (board[b] === opp && board[c] === opp && board[a] === ".") return { from: b, to: a, p: player };
    }
  }

  // Центр
  if (level !== "easy" && board[4] === ".") return { from: 0, to: 4, p: player };

  // Углы
  if (level === "hard" && board[0] === ".") return { from: 0, to: 0, p: player };

  // Случайный ход
  const empty = board.split("").map((c, i) => c === "." ? i : -1).filter((i) => i >= 0);
  if (empty.length === 0) return null;
  const to = empty[Math.floor(Math.random() * empty.length)];
  return { from: to, to, p: player };
}

function calculateCheckersMove(board: string, player: number, level: string, ai?: GameAI): LiveMove | null {
  const moves = checkersMoves(board, player);
  if (moves.length === 0) return null;

  // Самообучение: используем сохранённые данные
  if (ai && ai.learningData.length > 0 && Math.random() > 0.3) {
    const learned = ai.learningData[Math.floor(Math.random() * ai.learningData.length)];
    const match = moves.find((m) => m.to === learned.bestMove);
    if (match) return { from: match.from, to: match.to, cap: match.cap, p: player };
  }

  // Приоритет взятий
  const captures = moves.filter((m) => m.cap !== undefined);
  if (captures.length > 0 && level !== "easy") {
    const m = captures[Math.floor(Math.random() * captures.length)];
    return { from: m.from, to: m.to, cap: m.cap, p: player };
  }

  // Случайный ход
  const m = moves[Math.floor(Math.random() * moves.length)];
  return { from: m.from, to: m.to, cap: m.cap, p: player };
}

function calculateChessMove(board: string, player: number, level: string, ai?: GameAI): LiveMove | null {
  const me = player === 0 ? "white" : "black";
  const pieces: { [key: string]: number[] } = { white: [], black: [] };

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === ".") continue;
    if (p === p.toUpperCase()) pieces.white.push(i);
    else pieces.black.push(i);
  }

  const myPieces = pieces[me];
  if (myPieces.length === 0) return null;

  // Простая стратегия: случайный ход случайной фигуры
  const from = myPieces[Math.floor(Math.random() * myPieces.length)];
  const piece = board[from];

  // Генерируем возможные ходы
  const possibleMoves = generateChessMoves(board, from, piece, player);
  if (possibleMoves.length === 0) return null;

  const to = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  return { from, to, p: player };
}

function generateChessMoves(board: string, from: number, piece: string, player: number): number[] {
  const moves: number[] = [];
  const fr = Math.floor(from / 8), fc = from % 8;
  const white = piece === piece.toUpperCase();
  const p = piece.toLowerCase();

  const addIfValid = (tr: number, tc: number) => {
    if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) return false;
    const to = tr * 8 + tc;
    const target = board[to];
    if (target === ".") { moves.push(to); return true; }
    if ((target === target.toUpperCase()) !== white) { moves.push(to); return false; }
    return false;
  };

  if (p === "p") {
    const dir = white ? -1 : 1;
    const startRow = white ? 6 : 1;
    if (board[(fr + dir) * 8 + fc] === ".") {
      moves.push((fr + dir) * 8 + fc);
      if (fr === startRow && board[(fr + 2 * dir) * 8 + fc] === ".") {
        moves.push((fr + 2 * dir) * 8 + fc);
      }
    }
    for (const dc of [-1, 1]) {
      const tr = fr + dir, tc = fc + dc;
      if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const target = board[tr * 8 + tc];
        if (target !== "." && (target === target.toUpperCase()) !== white) {
          moves.push(tr * 8 + tc);
        }
      }
    }
  } else if (p === "n") {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      addIfValid(fr + dr, fc + dc);
    }
  } else if (p === "k") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        addIfValid(fr + dr, fc + dc);
      }
    }
  } else if (p === "r" || p === "q") {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let r = fr + dr, c = fc + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!addIfValid(r, c)) break;
        r += dr; c += dc;
      }
    }
  }
  if (p === "b" || p === "q") {
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let r = fr + dr, c = fc + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!addIfValid(r, c)) break;
        r += dr; c += dc;
      }
    }
  }

  return moves;
}
