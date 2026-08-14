// 黑白棋（Reversi / Othello）规则引擎。
// board[8][8]，初始中央四子交叉；黑（Obsidian）先手。
// 规则：落子须在至少一个方向夹住连续敌子并以己方子收尾，被夹子全部翻转；
// 无合法着的一方 pass（history 记 pass 着以便 undo）；双方连续无着或盘满终局，数子定胜负（可和）。
import type { Side } from './types';

/** 一整着：落子 + 翻转列表；pass=true 表示虚着（不落子）。 */
export interface RvMove {
  r: number;
  f: number;
  flips: [number, number][];
  pass?: boolean;
}

export const rvOpp = (s: Side): Side => (s === 'w' ? 'b' : 'w');
const inB = (r: number, f: number) => r >= 0 && r < 8 && f >= 0 && f < 8;
const DIRS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]
];

export class Reversi {
  board: (Side | null)[][];
  turn: Side = 'b'; // 标准黑白棋黑先
  history: RvMove[] = [];

  constructor() { this.board = this.initial(); }

  initial(): (Side | null)[][] {
    const b: (Side | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
    b[3][3] = 'w'; b[4][4] = 'w';
    b[3][4] = 'b'; b[4][3] = 'b';
    return b;
  }

  clone(): Reversi {
    const c = new Reversi();
    c.board = this.board.map(row => [...row]);
    c.turn = this.turn;
    c.history = this.history.map(m => ({ ...m, flips: m.flips.map(p => [...p] as [number, number]) }));
    return c;
  }

  /** 在 (r,f) 落子 side 会翻转的敌子列表（空 = 不合法）。 */
  flipsFor(r: number, f: number, side: Side): [number, number][] {
    if (this.board[r][f]) return [];
    const out: [number, number][] = [];
    for (const [dr, df] of DIRS) {
      const line: [number, number][] = [];
      let cr = r + dr, cf = f + df;
      while (inB(cr, cf) && this.board[cr][cf] === rvOpp(side)) {
        line.push([cr, cf]);
        cr += dr; cf += df;
      }
      if (line.length && inB(cr, cf) && this.board[cr][cf] === side) out.push(...line);
    }
    return out;
  }

  legalMoves(side: Side): RvMove[] {
    const out: RvMove[] = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      if (this.board[r][f]) continue;
      const flips = this.flipsFor(r, f, side);
      if (flips.length) out.push({ r, f, flips });
    }
    return out;
  }

  make(m: RvMove) {
    if (!m.pass) {
      this.board[m.r][m.f] = this.turn;
      for (const [r, f] of m.flips) this.board[r][f] = this.turn;
    }
    this.history.push(m);
    this.turn = rvOpp(this.turn);
  }

  undo(): RvMove | null {
    const m = this.history.pop();
    if (!m) return null;
    this.turn = rvOpp(this.turn);
    if (!m.pass) {
      this.board[m.r][m.f] = null;
      for (const [r, f] of m.flips) this.board[r][f] = rvOpp(this.turn); // 翻回敌方色
    }
    return m;
  }

  counts(): { w: number; b: number; empty: number } {
    let w = 0, b = 0, empty = 0;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = this.board[r][f];
      if (p === 'w') w++;
      else if (p === 'b') b++;
      else empty++;
    }
    return { w, b, empty };
  }

  isOver(): { winner: Side | null; reason: string } | null {
    const { w, b, empty } = this.counts();
    if (empty > 0 && (this.legalMoves('w').length || this.legalMoves('b').length)) return null;
    if (w === b) return { winner: null, reason: 'Draw' };
    return { winner: w > b ? 'w' : 'b', reason: `${w}–${b}` };
  }
}
