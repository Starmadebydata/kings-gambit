import { Shogi, ShogiMove, SHOGI_VALUE } from './shogi';
import type { Hand, ShogiType } from './shogi';
import type { Level } from './types';

/** Eval positive = sente ('w') ahead. 盘面子力 + 位置 + 持驹。 */
function evalBoard(s: Shogi): number {
  let score = 0;
  for (let r = 0; r < 9; r++) {
    for (let f = 0; f < 9; f++) {
      const p = s.board[r][f];
      if (!p) continue;
      let v = SHOGI_VALUE[p.type] * 100;
      if (p.promoted) {
        v += p.type === 'p' ? 300 : p.type === 'r' || p.type === 'b' ? 260 : 160;
      }
      const advance = p.side === 'w' ? 8 - r : r; // 推进度 0..8
      if (p.type === 'p') {
        v += advance * 6;
        if (p.side === 'w' ? r <= 2 : r >= 6) v += 30; // 敌阵步
      }
      if (p.type === 'n' || p.type === 'l') v += advance * 3;
      if (p.type === 's' || p.type === 'g') {
        if (Math.abs(4 - f) <= 1) v += 12; // 中央银金
        if (advance >= 5) v += 15;
      }
      if (p.type === 'r' || p.type === 'b') {
        if (p.side === 'w' ? r <= 2 : r >= 6) v += 20; // 大驹入敌阵
      }
      score += p.side === 'w' ? v : -v;
    }
  }
  const handVal = (h: Hand) => {
    let v = 0;
    for (const t of Object.keys(h) as ShogiType[]) v += (h[t] ?? 0) * SHOGI_VALUE[t] * 115;
    return v;
  };
  score += handVal(s.hands.w) - handVal(s.hands.b);
  return score;
}

/** ---- 开局库：常见序盘（先手视角坐标着法序列） ---- */
const OPENINGS: { name: string; moves: ShogiMove[] }[] = [
  // 中飞车雏形：5六步 → 3四步 → 桂马跃出
  { name: '中飞车序盘', moves: [
    { from: [6, 4], to: [5, 4] }, { from: [2, 4], to: [3, 4] },
    { from: [8, 3], to: [6, 4] }, { from: [0, 5], to: [2, 4] },
  ] },
  // 居飞车：2六步 → 8四步 → 右桂出击
  { name: '居飞车序盘', moves: [
    { from: [6, 7], to: [5, 7] }, { from: [2, 1], to: [3, 1] },
    { from: [8, 6], to: [6, 7] }, { from: [0, 2], to: [2, 1] },
  ] },
];

const sameMove = (a: ShogiMove, b: ShogiMove) =>
  (a.from === null) === (b.from === null) &&
  (a.from === null || (a.from![0] === b.from![0] && a.from![1] === b.from![1])) &&
  a.to[0] === b.to[0] && a.to[1] === b.to[1];

/** Best book move for the position, or null（落库前校验合法性）。 */
function bookMove(s: Shogi): ShogiMove | null {
  const hist = s.history;
  if (hist.length >= 8) return null;
  let best: { len: number; mv: ShogiMove } | null = null;
  for (const o of OPENINGS) {
    if (o.moves.length <= hist.length) continue;
    let ok = true;
    for (let i = 0; i < hist.length; i++) if (!sameMove(o.moves[i], hist[i])) { ok = false; break; }
    if (ok && (!best || o.moves.length > best.len)) best = { len: o.moves.length, mv: o.moves[hist.length] };
  }
  if (!best) return null;
  // 校验库着在当前局面合法（防坐标笔误）
  return s.legalMoves(s.turn).find(m => sameMove(m, best!.mv)) ?? null;
}

class StopError extends Error {}

let nodes = 0;

const moveScore = (m: ShogiMove) => {
  let v = 0;
  if (m.capture) v += 1000 + SHOGI_VALUE[m.capture.type] * 10;
  if (m.promote) v += 500;
  if (m.drop) v += SHOGI_VALUE[m.drop] * 10;
  return v;
};

function search(s: Shogi, depth: number, alpha: number, beta: number, stop?: () => boolean): number {
  if ((nodes++ & 255) === 0 && stop?.()) throw new StopError();
  const side = s.turn;
  const moves = s.legalMoves(side);
  if (moves.length === 0) {
    // 詰み：轮走方负
    return side === 'w' ? -100000 - depth * 100 : 100000 + depth * 100;
  }
  if (depth === 0) return evalBoard(s);

  moves.sort((a, b) => moveScore(b) - moveScore(a));

  if (side === 'w') {
    let best = -Infinity;
    for (const m of moves) {
      s.make(m);
      let v: number;
      try {
        v = search(s, depth - 1, alpha, beta, stop);
      } finally {
        s.undo(); // 超时异常也必须回退
      }
      best = Math.max(best, v);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    s.make(m);
    let v: number;
    try {
      v = search(s, depth - 1, alpha, beta, stop);
    } finally {
      s.undo(); // 超时异常也必须回退
    }
    best = Math.min(best, v);
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function find(s: Shogi, depth: number, jitter: number, stop?: () => boolean): ShogiMove | null {
  const moves = s.legalMoves(s.turn);
  if (!moves.length) return null;
  const white = s.turn === 'w';
  const scored = moves.map(m => {
    s.make(m);
    let raw: number;
    try {
      raw = search(s, depth - 1, -Infinity, Infinity, stop);
    } finally {
      s.undo(); // 超时异常也必须回退
    }
    const persp = white ? raw : -raw;
    return { m, s: persp + (jitter > 0 ? Math.random() * jitter : 0) };
  });
  scored.sort((a, b) => b.s - a.s);
  if (jitter > 0) {
    const top = scored.slice(0, Math.min(3, scored.length));
    return top[Math.floor(Math.random() * top.length)].m;
  }
  return scored[0].m;
}

export interface ShogiAiOptions {
  level: Level;
  jitter?: number;
}

/**
 * Pick a move for the side to move.
 * - Easy:    shallow 1-ply with heavy randomness, no opening book
 * - Medium:  depth 2 + opening book（将棋分支因子大，深度 2 已能稳健吃子）
 * - Hard:    opening book + depth 3 with a 2.2s time box（逐级降级保底）
 */
export function findBestShogiMove(s: Shogi, opts: ShogiAiOptions): ShogiMove | null {
  const jitter = opts.jitter ?? 0;
  if (opts.level >= 2) {
    const bm = bookMove(s);
    if (bm) return bm;
  }
  if (opts.level <= 1) {
    nodes = 0;
    return find(s, 1, jitter > 0 ? jitter : 60);
  }
  if (opts.level === 2) {
    nodes = 0;
    const tl = performance.now() + 1500;
    const stop = () => performance.now() > tl;
    try {
      return find(s, 2, jitter, stop);
    } catch (e) {
      if (!(e instanceof StopError)) throw e;
      nodes = 0;
      return find(s, 1, jitter);
    }
  }
  // Hard：分级迭代深度 3→2，各带独立时间盒；超时自动降级
  let mv: ShogiMove | null = null;
  for (const [d, budget] of [[3, 2200], [2, 1200]] as const) {
    nodes = 0;
    const tl = performance.now() + budget;
    const stop = () => performance.now() > tl;
    try {
      mv = find(s, d, jitter, stop);
      if (mv) return mv;
    } catch (e) {
      if (!(e instanceof StopError)) throw e;
      // 超时 → 降深度重试
    }
  }
  return mv;
}
