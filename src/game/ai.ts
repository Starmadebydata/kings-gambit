import { Chess, Move } from 'chess.js';
import { PieceType } from './types';

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

function search(c: Chess, depth: number, alpha: number, beta: number): number {
  if (c.isCheckmate()) return c.turn() === 'w' ? -100000 - depth * 100 : 100000 + depth * 100;
  if (c.isStalemate() || c.isDraw()) return 0;
  if (depth === 0) return evalBoard(c);

  const moves = c.moves({ verbose: true })
    .sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0));

  if (c.turn() === 'w') {
    let best = -Infinity;
    for (const m of moves) {
      c.move(m);
      best = Math.max(best, search(c, depth - 1, alpha, beta));
      c.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    c.move(m);
    best = Math.min(best, search(c, depth - 1, alpha, beta));
    c.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

/** Pick a move for the side to move. jitter > 0 adds variety (showcase). */
export function findBestMove(chess: Chess, depth: number, jitter = 0): Move | null {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const white = chess.turn() === 'w';
  const scored = moves.map(m => {
    chess.move(m);
    const raw = search(chess, depth - 1, -Infinity, Infinity);
    chess.undo();
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
