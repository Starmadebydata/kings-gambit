import { Xiangqi, XqMove, XQ_VALUE } from './xiangqi';
import type { XqType } from './pieceModels';
import type { Side } from './types';

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
      }
      if (p.type === 'h' || p.type === 'r') v -= (Math.abs(4 - f)) * 3;
      if (p.type === 'c') v += (p.side === 'w' ? 9 - r : r);
      s += p.side === 'w' ? v : -v;
    }
  }
  return s;
}

function search(xq: Xiangqi, depth: number, alpha: number, beta: number): number {
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
      best = Math.max(best, search(xq, depth - 1, alpha, beta));
      xq.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    xq.make(m);
    best = Math.min(best, search(xq, depth - 1, alpha, beta));
    xq.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export function findBestXqMove(xq: Xiangqi, depth: number, jitter = 0): XqMove | null {
  const moves = xq.legalMoves(xq.turn);
  if (!moves.length) return null;
  const white = xq.turn === 'w';
  const scored = moves.map(m => {
    xq.make(m);
    const raw = search(xq, depth - 1, -Infinity, Infinity);
    xq.undo();
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
