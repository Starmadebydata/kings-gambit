import type { Side } from './types';
import type { XqType } from './pieceModels';

/** Xiangqi engine. Board indexed [rank 0..9][file 0..8]; rank 0 = black back rank, rank 9 = red back rank. Side 'w' = red. */

export interface XqPiece { side: Side; type: XqType }
export interface XqMove {
  from: [number, number]; // [rank, file]
  to: [number, number];
  capture?: XqPiece;
}

export type XqBoard = (XqPiece | null)[][];

const ORTH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function initialBoard(): XqBoard {
  const b: XqBoard = Array.from({ length: 10 }, () => Array<XqPiece | null>(9).fill(null));
  const back: XqType[] = ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'];
  for (let f = 0; f < 9; f++) {
    b[0][f] = { side: 'b', type: back[f] };
    b[9][f] = { side: 'w', type: back[f] };
    b[3][f] = f % 2 === 0 ? { side: 'b', type: 'p' } : null;
    b[6][f] = f % 2 === 0 ? { side: 'w', type: 'p' } : null;
  }
  b[2][1] = { side: 'b', type: 'c' }; b[2][7] = { side: 'b', type: 'c' };
  b[7][1] = { side: 'w', type: 'c' }; b[7][7] = { side: 'w', type: 'c' };
  return b;
}

const inBounds = (r: number, f: number) => r >= 0 && r <= 9 && f >= 0 && f <= 8;
const inPalace = (side: Side, r: number, f: number) =>
  f >= 3 && f <= 5 && (side === 'w' ? r >= 7 && r <= 9 : r >= 0 && r <= 2);
const crossedRiver = (side: Side, r: number) => (side === 'w' ? r <= 4 : r >= 5);
const ownHalf = (side: Side, r: number) => (side === 'w' ? r >= 5 : r <= 4);

export class Xiangqi {
  board: XqBoard = initialBoard();
  turn: Side = 'w';
  history: XqMove[] = [];

  reset() { this.board = initialBoard(); this.turn = 'w'; this.history = []; }
  cloneBoard(): XqBoard { return this.board.map(row => row.map(p => (p ? { ...p } : null))); }

  at(r: number, f: number): XqPiece | null { return this.board[r][f]; }

  /** Pseudo-legal moves for one piece (ignores check). */
  pieceMoves(r: number, f: number): XqMove[] {
    const p = this.board[r][f];
    if (!p) return [];
    const out: XqMove[] = [];
    const push = (tr: number, tf: number) => {
      if (!inBounds(tr, tf)) return;
      const q = this.board[tr][tf];
      if (q && q.side === p.side) return;
      out.push({ from: [r, f], to: [tr, tf], capture: q ?? undefined });
    };

    switch (p.type) {
      case 'k':
        for (const [dr, df] of ORTH) {
          const tr = r + dr, tf = f + df;
          if (inPalace(p.side, tr, tf)) push(tr, tf);
        }
        break;
      case 'a':
        for (const [dr, df] of DIAG) {
          const tr = r + dr, tf = f + df;
          if (inPalace(p.side, tr, tf)) push(tr, tf);
        }
        break;
      case 'e':
        for (const [dr, df] of DIAG) {
          const tr = r + dr * 2, tf = f + df * 2;
          const er = r + dr, ef = f + df;
          if (!inBounds(tr, tf) || !ownHalf(p.side, tr)) continue;
          if (this.board[er][ef]) continue; // blocked eye
          push(tr, tf);
        }
        break;
      case 'h':
        for (const [dr, df] of ORTH) {
          if (this.board[r + dr]?.[f + df]) continue; // hobbled leg
          for (const [pr, pf] of [[dr === 0 ? 1 : 0, dr === 0 ? 0 : 1], [dr === 0 ? -1 : 0, dr === 0 ? 0 : -1]] as [number, number][]) {
            const tr = r + dr * 2 + pr, tf = f + df * 2 + pf;
            if (inBounds(tr, tf)) push(tr, tf);
          }
        }
        break;
      case 'r':
        for (const [dr, df] of ORTH) {
          let tr = r + dr, tf = f + df;
          while (inBounds(tr, tf)) {
            const q = this.board[tr][tf];
            if (!q) push(tr, tf);
            else { push(tr, tf); break; }
            tr += dr; tf += df;
          }
        }
        break;
      case 'c':
        for (const [dr, df] of ORTH) {
          let tr = r + dr, tf = f + df;
          let screen = false;
          while (inBounds(tr, tf)) {
            const q = this.board[tr][tf];
            if (!screen) {
              if (!q) push(tr, tf);
              else screen = true;
            } else if (q) {
              if (q.side !== p.side) push(tr, tf);
              break;
            }
            tr += dr; tf += df;
          }
        }
        break;
      case 'p': {
        const fwd = p.side === 'w' ? -1 : 1;
        push(r + fwd, f);
        if (crossedRiver(p.side, r)) { push(r, f - 1); push(r, f + 1); }
        break;
      }
    }
    return out;
  }

  pseudoMoves(side: Side): XqMove[] {
    const out: XqMove[] = [];
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = this.board[r][f];
      if (p && p.side === side) out.push(...this.pieceMoves(r, f));
    }
    return out;
  }

  kingPos(side: Side): [number, number] | null {
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = this.board[r][f];
      if (p && p.side === side && p.type === 'k') return [r, f];
    }
    return null;
  }

  /** True if the two generals face each other on an open file. */
  kingsFacing(): boolean {
    const kw = this.kingPos('w'), kb = this.kingPos('b');
    if (!kw || !kb || kw[1] !== kb[1]) return false;
    for (let r = kb[0] + 1; r < kw[0]; r++) if (this.board[r][kw[1]]) return false;
    return true;
  }

  /** Direct attack test on a square by `bySide` (includes flying-general via file ray). */
  isAttacked(r: number, f: number, bySide: Side): boolean {
    const b = this.board;
    // orthogonal rays: chariot, cannon (over one screen), general (flying)
    for (const [dr, df] of ORTH) {
      let tr = r + dr, tf = f + df;
      let screen = false;
      while (inBounds(tr, tf)) {
        const q = b[tr][tf];
        if (q) {
          if (!screen) {
            if (q.side === bySide && (q.type === 'r' || q.type === 'k')) return true;
            screen = true;
          } else {
            if (q.side === bySide && q.type === 'c') return true;
            break;
          }
        }
        tr += dr; tf += df;
      }
    }
    // horse attackers
    for (let dr = -2; dr <= 2; dr++) {
      for (let df = -2; df <= 2; df++) {
        if (Math.abs(dr) + Math.abs(df) !== 3) continue;
        if (Math.abs(dr) !== 1 && Math.abs(dr) !== 2) continue;
        const hr = r + dr, hf = f + df;
        if (!inBounds(hr, hf)) continue;
        const q = b[hr][hf];
        if (!q || q.side !== bySide || q.type !== 'h') continue;
        // leg of the horse: the orthogonal step from the horse toward the long axis
        const lr = hr + (Math.abs(dr) === 2 ? Math.sign(r - hr) : 0);
        const lf = hf + (Math.abs(df) === 2 ? Math.sign(f - hf) : 0);
        if (!b[lr][lf]) return true;
      }
    }
    // pawn attackers
    const fwd = bySide === 'w' ? -1 : 1;
    const behind = b[r - fwd]?.[f]; // pawn one step "behind" the attack direction
    if (behind && behind.side === bySide && behind.type === 'p') return true;
    for (const df of [-1, 1]) {
      const q = b[r]?.[f - df];
      if (q && q.side === bySide && q.type === 'p' && crossedRiver(bySide, r)) return true;
    }
    // advisor / elephant attackers (diagonal)
    for (const [dr, df] of DIAG) {
      const q1 = b[r + dr]?.[f + df];
      if (q1 && q1.side === bySide && q1.type === 'a') return true;
      const q2 = b[r + dr * 2]?.[f + df * 2];
      if (q2 && q2.side === bySide && q2.type === 'e' && !b[r + dr]?.[f + df]) return true;
    }
    return false;
  }

  inCheck(side: Side): boolean {
    const k = this.kingPos(side);
    if (!k) return false;
    if (this.kingsFacing()) return true;
    return this.isAttacked(k[0], k[1], side === 'w' ? 'b' : 'w');
  }

  make(m: XqMove) {
    const p = this.board[m.from[0]][m.from[1]]!;
    m.capture = this.board[m.to[0]][m.to[1]] ?? undefined;
    this.board[m.to[0]][m.to[1]] = p;
    this.board[m.from[0]][m.from[1]] = null;
    this.history.push(m);
    this.turn = this.turn === 'w' ? 'b' : 'w';
  }

  undo(): XqMove | null {
    const m = this.history.pop();
    if (!m) return null;
    const p = this.board[m.to[0]][m.to[1]]!;
    this.board[m.from[0]][m.from[1]] = p;
    this.board[m.to[0]][m.to[1]] = m.capture ?? null;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    return m;
  }

  legalMoves(side: Side): XqMove[] {
    const out: XqMove[] = [];
    for (const m of this.pseudoMoves(side)) {
      this.make(m);
      const k = this.kingPos(side);
      const safe = k && !this.isAttacked(k[0], k[1], side === 'w' ? 'b' : 'w') && !this.kingsFacing();
      this.undo();
      if (safe) out.push(m);
    }
    return out;
  }

  legalMovesFrom(r: number, f: number): XqMove[] {
    const p = this.board[r][f];
    if (!p) return [];
    const out: XqMove[] = [];
    for (const m of this.pieceMoves(r, f)) {
      this.make(m);
      const k = this.kingPos(p.side);
      const safe = k && !this.isAttacked(k[0], k[1], p.side === 'w' ? 'b' : 'w') && !this.kingsFacing();
      this.undo();
      if (safe) out.push(m);
    }
    return out;
  }

  /** In xiangqi, having no legal moves is a loss (checkmate or stalemate). */
  isOver(): { winner: Side; reason: string } | null {
    if (this.legalMoves(this.turn).length > 0) return null;
    return {
      winner: this.turn === 'w' ? 'b' : 'w',
      reason: this.inCheck(this.turn) ? 'Checkmate' : '困毙 · No Legal Moves'
    };
  }
}

export const XQ_CHAR: Record<Side, Record<XqType, string>> = {
  w: { k: '帥', a: '仕', e: '相', h: '傌', r: '俥', c: '炮', p: '兵' },
  b: { k: '將', a: '士', e: '象', h: '傌', r: '俥', c: '砲', p: '卒' }
};

export const XQ_VALUE: Record<XqType, number> = {
  p: 1, h: 4, c: 4.5, r: 9, e: 2, a: 2, k: 0
};
