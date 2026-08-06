import { Chess, Move } from 'chess.js';
import { Level, PieceType } from './types';

const VAL: Record<PieceType, number> = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 };

/** Static eval, positive = white ahead. */
function evalBoard(c: Chess): number {
  let s = 0;
  const b = c.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (!p) continue;
      let v = VAL[p.type];
      const cd = Math.abs(3.5 - f) + Math.abs(3.5 - r);
      v -= cd * 4;
      v += (p.type === 'p' ? 4 : 1) * (p.color === 'w' ? 7 - r : r);
      if (p.type === 'n' && ((r === 0 && f === 0) || (r === 0 && f === 7) || (r === 7 && f === 0) || (r === 7 && f === 7))) v -= 40;
      s += p.color === 'w' ? v : -v;
    }
  }
  return s;
}

/** MVV-LVA: most valuable victim, least valuable attacker. */
const MVV_LVA = (m: Move): number => {
  if (!m.captured) return m.promotion ? VAL[m.promotion] - 10 : 0;
  return VAL[m.captured] * 10 - VAL[m.piece] + (m.promotion ? 900 : 0);
};

/** ---- 开局库：常见开局 SAN 序列（前 12 着内使用） ---- */
const OPENINGS: { san: string[]; name: string }[] = [
  { name: 'Ruy Lopez', san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { name: 'Italian Game', san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { name: 'Scotch Game', san: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { name: 'Petrov Defense', san: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { name: 'Four Knights', san: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { name: 'French Defense', san: ['e4', 'e6', 'd4', 'd5'] },
  { name: 'Sicilian Defense', san: ['e4', 'c5', 'Nf3', 'd6', 'd4'] },
  { name: 'Caro-Kann Defense', san: ['e4', 'c6', 'd4', 'd5'] },
  { name: "Queen's Gambit", san: ['d4', 'd5', 'c4'] },
  { name: "Queen's Gambit Declined", san: ['d4', 'd5', 'c4', 'e6'] },
  { name: 'King\'s Indian Defense', san: ['d4', 'Nf6', 'c4', 'g6'] },
  { name: 'Nimzo-Indian Defense', san: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { name: 'English Opening', san: ['c4'] },
];

/** Best book move for the position, or null. */
function bookMove(c: Chess): Move | null {
  const hist = c.history();
  if (hist.length >= 12) return null;
  let best: { len: number; san: string } | null = null;
  for (const o of OPENINGS) {
    if (o.san.length <= hist.length) continue;
    let ok = true;
    for (let i = 0; i < hist.length; i++) if (o.san[i] !== hist[i]) { ok = false; break; }
    if (ok && (!best || o.san.length > best.len)) best = { len: o.san.length, san: o.san[hist.length] };
  }
  if (!best) return null;
  return c.moves({ verbose: true }).find(m => m.san === best!.san) ?? null;
}

/** ---- 置换表（FEN key） ---- */
interface TTEntry { depth: number; score: number; flag: 'exact' | 'lower' | 'upper' }
const tt = new Map<string, TTEntry>();

class TimeoutError extends Error {}

/** Quiescence: only captures & promotions, avoids the horizon effect. Time-checked. */
function quiescence(c: Chess, alpha: number, beta: number, qd: number, deadline: number): number {
  if ((nodes++ & 255) === 0 && performance.now() > deadline) throw new TimeoutError();
  const stand = evalBoard(c);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qd <= 0) return alpha;
  const moves = c.moves({ verbose: true })
    .filter(m => m.captured || m.promotion)
    .sort((a, b) => MVV_LVA(b) - MVV_LVA(a));
  for (const m of moves) {
    c.move(m);
    let s: number;
    try {
      s = -quiescence(c, -beta, -alpha, qd - 1, deadline);
    } finally {
      c.undo(); // 超时异常也必须回退
    }
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

let nodes = 0;

function search(c: Chess, depth: number, alpha: number, beta: number, qd: number, deadline: number): number {
  // time check (every 512 nodes)
  if ((nodes++ & 511) === 0 && performance.now() > deadline) throw new TimeoutError();

  const key = c.fen();
  const entry = tt.get(key);
  if (entry && entry.depth >= depth) {
    if (entry.flag === 'exact') return entry.score;
    if (entry.flag === 'lower' && entry.score >= beta) return entry.score;
    if (entry.flag === 'upper' && entry.score <= alpha) return entry.score;
  }

  if (c.isCheckmate()) return -100000 - depth * 100;
  if (c.isStalemate() || c.isDraw()) return 0;
  if (depth === 0) return quiescence(c, alpha, beta, qd, deadline);

  const moves = c.moves({ verbose: true }).sort((a, b) => MVV_LVA(b) - MVV_LVA(a));
  let best = -Infinity;
  let flag: TTEntry['flag'] = 'upper';
  for (const m of moves) {
    c.move(m);
    let s: number;
    try {
      s = -search(c, depth - 1, -beta, -alpha, qd, deadline);
    } finally {
      c.undo(); // 超时异常也必须回退，避免污染棋盘
    }
    if (s > best) best = s;
    if (best > alpha) { alpha = best; flag = 'exact'; }
    if (alpha >= beta) { flag = 'lower'; break; }
  }
  tt.set(key, { depth, score: best, flag });
  return best;
}

/** Root search for one depth, returns the best move. jitter > 0 picks randomly among top-3. */
function searchRoot(c: Chess, depth: number, qd: number, deadline: number, jitter: number): Move | null {
  const moves = c.moves({ verbose: true }).sort((a, b) => MVV_LVA(b) - MVV_LVA(a));
  if (!moves.length) return null;
  const white = c.turn() === 'w';
  const scored = moves.map(m => {
    c.move(m);
    let raw: number;
    try {
      raw = -search(c, Math.max(0, depth - 1), -Infinity, Infinity, qd, deadline);
    } finally {
      c.undo(); // 超时异常也必须回退
    }
    return { m, s: (white ? raw : -raw) + (jitter > 0 ? Math.random() * jitter : 0) };
  });
  scored.sort((a, b) => b.s - a.s);
  if (jitter > 0) {
    return scored[Math.floor(Math.random() * Math.min(3, scored.length))].m;
  }
  return scored[0].m;
}

export interface AiOptions {
  level: Level;
  jitter?: number;
}

/**
 * Pick a move for the side to move.
 * - Easy:    shallow 1-ply with heavy randomness
 * - Medium:  depth 3 + opening book + TT + MVV-LVA (time-bounded)
 * - Hard:    iterative deepening 1..6 + quiescence + book (time-bounded)
 */
export function findBestMove(chess: Chess, opts: AiOptions): Move | null {
  const jitter = opts.jitter ?? 0;
  // opening book for Medium/Hard
  if (opts.level >= 2) {
    const bm = bookMove(chess);
    if (bm) return bm;
  }

  if (opts.level <= 1) {
    nodes = 0;
    const t0 = performance.now();
    const mv = searchRoot(chess, 1, 0, t0 + 500, jitter > 0 ? jitter : 60);
    tt.clear();
    return mv;
  }

  nodes = 0;
  tt.clear();
  const timeMs = opts.level === 2 ? 1500 : 2500;
  const deadline = performance.now() + timeMs;
  const qd = opts.level === 2 ? 0 : 4;
  let best: Move | null = null;
  try {
    for (let d = 1; d <= (opts.level === 2 ? 3 : 6); d++) {
      best = searchRoot(chess, d, qd, deadline, jitter);
      if (performance.now() > deadline) break;
    }
  } catch (e) {
    if (!(e instanceof TimeoutError)) throw e;
    // keep the last completed depth's move
  }
  return best;
}
