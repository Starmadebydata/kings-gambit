import { Xiangqi, XqMove, XQ_VALUE } from './xiangqi';
import type { XqType } from './pieceModels';
import type { Level, Side } from './types';

/** Eval positive = red ('w') ahead. */
function evalBoard(xq: Xiangqi): number {
  let s = 0;
  const b = xq.board;
  for (let r = 0; r < 10; r++) {
    for (let f = 0; f < 9; f++) {
      const p = b[r][f];
      if (!p) continue;
      let v = XQ_VALUE[p.type] * 100;
      if (p.type === 'p') {
        const crossed = p.side === 'w' ? r <= 4 : r >= 5;
        if (crossed) v += 80;
        v += (p.side === 'w' ? 9 - r : r) * 2;
        // 高兵：深入敌方腹地价值更高
        if (p.side === 'w' ? r <= 2 : r >= 7) v += 25;
      }
      if (p.type === 'h' || p.type === 'r') v -= (Math.abs(4 - f)) * 3;
      if (p.type === 'c') v += (p.side === 'w' ? 9 - r : r);
      // ---- 位置价值增强 ----
      if (p.type === 'h') {
        const crossed = p.side === 'w' ? r <= 4 : r >= 5;
        if (crossed) v += 30; // 过河马有威胁
        const deep = p.side === 'w' ? r <= 2 : r >= 7;
        if (deep && Math.abs(f - 4) <= 1) v += 40; // 卧槽/挂角马
      }
      if (p.type === 'c') {
        if (f === 4) v += 10; // 中路炮（牵制中线）
        const home = p.side === 'w' ? r >= 8 : r <= 1;
        if (home) v += 8; // 底线炮有架子
      }
      if (p.type === 'r') {
        const crossed = p.side === 'w' ? r <= 4 : r >= 5;
        if (crossed) v += 15; // 过河车控制力强
      }
      s += p.side === 'w' ? v : -v;
    }
  }
  return s;
}

/** ---- 开局库：常见开局（红先，坐标着法序列） ---- */
const OPENINGS: { name: string; moves: XqMove[] }[] = [
  // 中炮对屏风马：炮二平五 馬8进7 馬二进三 卒7进1 車一平二 車9平8
  { name: '中炮对屏风马', moves: [
    { from: [7, 7], to: [7, 4] }, { from: [0, 7], to: [2, 6] },
    { from: [9, 7], to: [7, 6] }, { from: [3, 6], to: [4, 6] },
    { from: [9, 8], to: [9, 7] }, { from: [0, 8], to: [0, 7] },
  ] },
  // 中炮对顺炮：炮二平五 炮8平5 馬二进三 馬8进7 車一平二 車9进1
  { name: '中炮对顺炮', moves: [
    { from: [7, 7], to: [7, 4] }, { from: [2, 7], to: [2, 4] },
    { from: [9, 7], to: [7, 6] }, { from: [0, 7], to: [2, 6] },
    { from: [9, 8], to: [9, 7] }, { from: [0, 8], to: [1, 8] },
  ] },
  // 中炮对列炮：炮二平五 炮2平5 馬二进三 馬2进3 車一平二 車1进1
  { name: '中炮对列炮', moves: [
    { from: [7, 7], to: [7, 4] }, { from: [2, 1], to: [2, 4] },
    { from: [9, 7], to: [7, 6] }, { from: [0, 1], to: [2, 2] },
    { from: [9, 8], to: [9, 7] }, { from: [0, 0], to: [1, 0] },
  ] },
  // 飞相局：相三进五 馬8进7 傌二进三 卒7进1
  { name: '飞相局', moves: [
    { from: [9, 4], to: [7, 2] }, { from: [0, 7], to: [2, 6] },
    { from: [9, 7], to: [7, 6] }, { from: [3, 6], to: [4, 6] },
  ] },
];

const sameMove = (a: XqMove, b: XqMove) =>
  a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1];

/** Best book move for the position, or null. */
function bookMove(xq: Xiangqi): XqMove | null {
  const hist = xq.history;
  if (hist.length >= 12) return null;
  let best: { len: number; mv: XqMove } | null = null;
  for (const o of OPENINGS) {
    if (o.moves.length <= hist.length) continue;
    let ok = true;
    for (let i = 0; i < hist.length; i++) if (!sameMove(o.moves[i], hist[i])) { ok = false; break; }
    if (ok && (!best || o.moves.length > best.len)) best = { len: o.moves.length, mv: o.moves[hist.length] };
  }
  return best?.mv ?? null;
}

class StopError extends Error {}

let nodes = 0;

function search(xq: Xiangqi, depth: number, alpha: number, beta: number, stop?: () => boolean): number {
  if ((nodes++ & 1023) === 0 && stop?.()) throw new StopError();
  const side = xq.turn;
  const moves = xq.legalMoves(side);
  if (moves.length === 0) {
    // side to move loses in xiangqi
    return side === 'w' ? -100000 - depth * 100 : 100000 + depth * 100;
  }
  if (depth === 0) return evalBoard(xq);

  moves.sort((a, b) => ((b.capture ? XQ_VALUE[b.capture.type as XqType] : 0)) - ((a.capture ? XQ_VALUE[a.capture.type as XqType] : 0)));

  if (side === 'w') {
    let best = -Infinity;
    for (const m of moves) {
      xq.make(m);
      let v: number;
      try {
        v = search(xq, depth - 1, alpha, beta, stop);
      } finally {
        xq.undo(); // 超时异常也必须回退
      }
      best = Math.max(best, v);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    xq.make(m);
    let v: number;
    try {
      v = search(xq, depth - 1, alpha, beta, stop);
    } finally {
      xq.undo(); // 超时异常也必须回退
    }
    best = Math.min(best, v);
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function find(xq: Xiangqi, depth: number, jitter: number, stop?: () => boolean): XqMove | null {
  const moves = xq.legalMoves(xq.turn);
  if (!moves.length) return null;
  const white = xq.turn === 'w';
  const scored = moves.map(m => {
    xq.make(m);
    let raw: number;
    try {
      raw = search(xq, depth - 1, -Infinity, Infinity, stop);
    } finally {
      xq.undo(); // 超时异常也必须回退
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

export interface XqAiOptions {
  level: Level;
  jitter?: number;
}

/**
 * Pick a move for the side to move.
 * - Easy:    shallow 1-ply with heavy randomness, no opening book
 * - Medium:  depth 3 + opening book
 * - Hard:    opening book + depth 4 with an 1.8s time box (falls back to depth 3)
 */
export function findBestXqMove(xq: Xiangqi, opts: XqAiOptions): XqMove | null {
  const jitter = opts.jitter ?? 0;
  if (opts.level >= 2) {
    const bm = bookMove(xq);
    if (bm) return bm;
  }
  if (opts.level <= 1) {
    nodes = 0;
    return find(xq, 1, jitter > 0 ? jitter : 60);
  }
  if (opts.level === 2) {
    nodes = 0;
    return find(xq, 3, jitter);
  }
  // Hard：分级迭代深度 4→3→2，各带独立时间盒；超时自动降级
  let mv: XqMove | null = null;
  for (const [d, budget] of [[4, 1800], [3, 1200], [2, 600]] as const) {
    nodes = 0;
    const tl = performance.now() + budget;
    const stop = () => performance.now() > tl;
    try {
      mv = find(xq, d, jitter, stop);
      if (mv) return mv;
    } catch (e) {
      if (!(e instanceof StopError)) throw e;
      // 超时 → 降深度重试
    }
  }
  return mv; // 理论不可达（depth 2 极快），保底返回
}
