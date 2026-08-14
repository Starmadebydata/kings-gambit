// 西洋跳棋 AI：子力+推进+王活性评估，αβ 搜索（吃子优先排序），三档难度 + 时间盒降级。
import { Checkers, type CkMove } from './checkers';
import type { Level } from './types';

const MATE = 100000;

/** 评估：正 = w 优势。兵 100 / 王 170，兵推进度、底线防守、王居中度。 */
function evalBoard(c: Checkers): number {
  let score = 0;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = c.board[r][f];
    if (!p) continue;
    let v: number;
    if (p.king) {
      v = 170 + Math.round(14 - (Math.abs(3.5 - r) + Math.abs(3.5 - f))); // 王居中控场
    } else {
      v = 100 + (p.side === 'w' ? 7 - r : r) * 4; // 推进越深越值钱
      if ((p.side === 'w' && r === 7) || (p.side === 'b' && r === 0)) v += 6; // 底线兵延缓对方升王
      if (f === 0 || f === 7) v -= 2; // 边线兵略弱
    }
    score += p.side === 'w' ? v : -v;
  }
  return score;
}

const byCaps = (a: CkMove, b: CkMove) => b.caps.length - a.caps.length;

let aborted = false;

function negamax(c: Checkers, depth: number, alpha: number, beta: number, ply: number, deadline: number): number {
  if (aborted || Date.now() > deadline) { aborted = true; return (c.turn === 'w' ? 1 : -1) * evalBoard(c); }
  const moves = c.legalMoves(c.turn);
  if (!moves.length) return -MATE + ply;
  if (depth === 0) return (c.turn === 'w' ? 1 : -1) * evalBoard(c);
  let best = -Infinity;
  moves.sort(byCaps);
  for (const m of moves) {
    c.make(m);
    const s = -negamax(c, depth - 1, -beta, -alpha, ply + 1, deadline);
    c.undo();
    if (s > best) best = s;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * 选着。level 1=Easy（浅搜+抖动）2=Medium 3=Hard（深搜）。
 * 迭代加深 + 时间盒：超时的深度层整层丢弃，保留上一层结果。
 */
export function findBestCheckersMove(c: Checkers, opts: { level?: Level; jitter?: number } = {}): CkMove | null {
  const level = opts.level ?? 2;
  const moves = c.legalMoves(c.turn);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const jitter = opts.jitter ?? 0;

  const plan = level === 1
    ? { depths: [2], boxes: [700], jit: 60 + jitter }
    : level === 2
      ? { depths: [4, 3, 2], boxes: [1400, 800, 300], jit: jitter }
      : { depths: [8, 6, 4, 2], boxes: [2400, 1600, 800, 300], jit: jitter };

  let best = moves[0];
  let bestScore = -Infinity;
  for (let d = 0; d < plan.depths.length; d++) {
    aborted = false;
    const deadline = Date.now() + plan.boxes[d];
    let alpha = -Infinity;
    let localBest: CkMove | null = null;
    let localScore = -Infinity;
    const ordered = [...moves].sort(byCaps);
    for (const m of ordered) {
      c.make(m);
      let s = -negamax(c, plan.depths[d] - 1, -Infinity, -alpha, 1, deadline);
      c.undo();
      if (aborted) break;
      if (plan.jit) s += Math.round((Math.random() - 0.5) * 2 * plan.jit);
      if (s > localScore) { localScore = s; localBest = m; }
      if (s > alpha) alpha = s;
    }
    if (aborted || !localBest) break; // 本层不可信，保留上一层
    best = localBest;
    bestScore = localScore;
    // 已见杀棋：不再加深
    if (bestScore > MATE - 1000) break;
  }
  return best;
}
