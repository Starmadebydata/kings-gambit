// 黑白棋 AI：位置表 + 机动性评估，negamax αβ，三档难度 + 时间盒降级。
import { Reversi, rvOpp, type RvMove } from './reversi';
import type { Side } from './types';

// 经典位置价值表（角极贵，角邻格为大坑）
const POS = [
  [100, -50, 15, 10, 10, 15, -50, 100],
  [-50, -80, 1, 1, 1, 1, -80, -50],
  [15, 1, 5, 2, 2, 5, 1, 15],
  [10, 1, 2, 1, 1, 2, 1, 10],
  [10, 1, 2, 1, 1, 2, 1, 10],
  [15, 1, 5, 2, 2, 5, 1, 15],
  [-50, -80, 1, 1, 1, 1, -80, -50],
  [100, -50, 15, 10, 10, 15, -50, 100]
];

function evalBoard(g: Reversi, side: Side): number {
  const me = side, op = rvOpp(side);
  const c = g.counts();
  // 终局直接数子
  if (c.empty <= 10) {
    const diff = me === 'w' ? c.w - c.b : c.b - c.w;
    return diff * 50 + (c.empty === 0 ? diff * 20 : 0);
  }
  let pos = 0;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = g.board[r][f];
    if (p === me) pos += POS[r][f];
    else if (p === op) pos -= POS[r][f];
  }
  const mobMe = g.legalMoves(me).length;
  const mobOp = g.legalMoves(op).length;
  const mobility = (mobMe - mobOp) * 6 + (mobOp === 0 ? 15 : 0);
  // 前期子少为佳（保机动），后期子多
  const parity = me === 'w' ? c.w - c.b : c.b - c.w;
  const discWeight = c.empty > 40 ? -1.5 : 1;
  return pos + mobility + parity * discWeight;
}

function orderedMoves(g: Reversi): RvMove[] {
  return g.legalMoves(g.turn).sort((a, b) => POS[b.r][b.f] - POS[a.r][a.f]);
}

function negamax(g: Reversi, depth: number, alpha: number, beta: number, side: Side, deadline: number): number {
  if (Date.now() > deadline) return evalBoard(g, side);
  const over = g.isOver();
  if (over) {
    if (over.winner === side) return 100000 + depth;
    if (over.winner === null) return 0;
    return -100000 - depth;
  }
  let moves = orderedMoves(g);
  if (!moves.length) {
    // pass：同一搜索者继续
    g.make({ r: -1, f: -1, flips: [], pass: true });
    const s = -negamax(g, depth, -beta, -alpha, rvOpp(side), deadline);
    g.undo();
    return s;
  }
  if (depth === 0) return evalBoard(g, side);
  let best = -Infinity;
  for (const m of moves) {
    g.make(m);
    const s = -negamax(g, depth - 1, -beta, -alpha, rvOpp(side), deadline);
    g.undo();
    if (s > best) best = s;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function findBestReversiMove(
  g: Reversi,
  opts: { level?: 1 | 2 | 3; jitter?: boolean } = {}
): RvMove | null {
  const level = opts.level ?? 2;
  const moves = orderedMoves(g);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  const depths = level === 1 ? [2] : level === 2 ? [4, 3, 2] : [7, 6, 5, 4, 3, 2];
  const budget = level === 1 ? 250 : level === 2 ? 700 : 1600;
  const t0 = Date.now();
  let bestMove = moves[0];
  let scored: { m: RvMove; s: number }[] = [];

  for (const d of depths) {
    if (Date.now() - t0 > budget) break;
    const deadline = Date.now() + budget;
    scored = moves.map(m => {
      g.make(m);
      const s = -negamax(g, d - 1, -Infinity, Infinity, rvOpp(g.turn), deadline);
      g.undo();
      return { m, s };
    });
    scored.sort((a, b) => b.s - a.s);
    bestMove = scored[0].m;
    if (scored[0].s >= 90000) break; // 见杀停搜
  }

  if (opts.jitter || level === 1) {
    const top = scored.filter(x => x.s >= scored[0].s - 12);
    return top[Math.floor(Math.random() * top.length)].m;
  }
  return bestMove;
}
