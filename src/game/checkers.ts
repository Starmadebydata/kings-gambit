// 西洋跳棋（American Checkers / English Draughts）规则引擎。
// board[8][8] 仅深色格 ((r+f)%2===1) 可用；w 在下方（5-7 行）向 row0 推进，b 在上方（0-2 行）向 row7 推进。
// 规则：强制吃子；连跳必须跳到不能跳为止；兵升王落地即终止该着；
// 兵只可斜前移动/跳吃，王可斜四向移动/跳吃（跳吃落点为隔敌后紧邻空格）；无着可走一方判负。
import type { Side } from './types';

export interface CkPiece { side: Side; king: boolean }
/** 一整着：滑步（path 单元素）或完整连跳链（path 为依次落点，caps 为依次被吃子）。 */
export interface CkMove {
  from: [number, number];
  path: [number, number][];
  caps: CkCap[];
  /** make 时回填：本着是否发生升王（undo 还原王冠用）。 */
  promoted?: boolean;
}
export interface CkCap { r: number; f: number; king: boolean }

export const ckOpp = (s: Side): Side => (s === 'w' ? 'b' : 'w');
const inB = (r: number, f: number) => r >= 0 && r < 8 && f >= 0 && f < 8;
const idx = (r: number, f: number) => r * 8 + f;
const dirsOf = (side: Side, king: boolean): [number, number][] => {
  const fwd = side === 'w' ? -1 : 1;
  return king ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[fwd, -1], [fwd, 1]];
};
const lastRankOf = (side: Side) => (side === 'w' ? 0 : 7);

export class Checkers {
  board: (CkPiece | null)[][];
  turn: Side = 'w';
  history: CkMove[] = [];

  constructor() { this.board = this.initial(); }

  initial(): (CkPiece | null)[][] {
    const b: (CkPiece | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 3; r++) for (let f = 0; f < 8; f++) if ((r + f) % 2 === 1) b[r][f] = { side: 'b', king: false };
    for (let r = 5; r < 8; r++) for (let f = 0; f < 8; f++) if ((r + f) % 2 === 1) b[r][f] = { side: 'w', king: false };
    return b;
  }

  clone(): Checkers {
    const c = new Checkers();
    c.board = this.board.map(row => row.map(p => (p ? { ...p } : null)));
    c.turn = this.turn;
    c.history = this.history.map(m => ({ from: [...m.from] as [number, number], path: m.path.map(p => [...p] as [number, number]), caps: m.caps.map(p => ({ ...p })) }));
    return c;
  }

  /** 单步跳吃（链搜索用）。removed=链中已吃子（视为不在场），empty=链中视为空格的格（起始格/途经落点），carrier=链中移动子（DFS 落点格棋盘上为空）。 */
  private jumpsFrom(r: number, f: number, removed: Set<number>, empty: Set<number>, carrier?: CkPiece): [number, number, number, number, boolean][] {
    const p = carrier ?? this.board[r][f];
    if (!p) return [];
    const out: [number, number, number, number, boolean][] = [];
    for (const [dr, df] of dirsOf(p.side, p.king)) {
      const cr = r + dr, cf = f + df, lr = r + 2 * dr, lf = f + 2 * df;
      if (!inB(lr, lf)) continue;
      const c = this.board[cr][cf];
      if (!c || c.side === p.side || removed.has(idx(cr, cf))) continue;
      const occ = this.board[lr][lf];
      if (occ && !empty.has(idx(lr, lf))) continue;
      out.push([cr, cf, lr, lf, c.king]);
    }
    return out;
  }

  /** 某格出发的所有 maximal 连跳链（兵升王即止）。 */
  private chainsFrom(r0: number, f0: number): CkMove[] {
    const p = this.board[r0][f0];
    if (!p) return [];
    const last = lastRankOf(p.side);
    const removed = new Set<number>();
    const empty = new Set<number>([idx(r0, f0)]);
    const out: CkMove[] = [];
    const path: [number, number][] = [];
    const caps: CkCap[] = [];
    const snap = () => ({ from: [r0, f0] as [number, number], path: path.map(q => [...q] as [number, number]), caps: caps.map(q => ({ ...q })) });
    const dfs = (r: number, f: number) => {
      // 兵抵达底线：该着立即结束
      if (path.length && !p.king && r === last) { out.push(snap()); return; }
      const jumps = this.jumpsFrom(r, f, removed, empty, p);
      if (!jumps.length) { if (path.length) out.push(snap()); return; }
      for (const [cr, cf, lr, lf, ck] of jumps) {
        removed.add(idx(cr, cf)); empty.add(idx(lr, lf));
        path.push([lr, lf]); caps.push({ r: cr, f: cf, king: ck });
        dfs(lr, lf);
        removed.delete(idx(cr, cf)); empty.delete(idx(lr, lf));
        path.pop(); caps.pop();
      }
    };
    dfs(r0, f0);
    return out;
  }

  /** 某侧是否存在任何单步跳吃（强制吃子判定）。 */
  private anyJumps(side: Side): boolean {
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = this.board[r][f];
      if (p && p.side === side && this.jumpsFrom(r, f, new Set(), new Set()).length) return true;
    }
    return false;
  }

  /** 滑步（仅当本方无跳吃时合法）。 */
  private slidesFrom(r: number, f: number): CkMove[] {
    const p = this.board[r][f];
    if (!p) return [];
    const out: CkMove[] = [];
    for (const [dr, df] of dirsOf(p.side, p.king)) {
      const nr = r + dr, nf = f + df;
      if (inB(nr, nf) && !this.board[nr][nf]) out.push({ from: [r, f], path: [[nr, nf]], caps: [] });
    }
    return out;
  }

  legalMovesFrom(r: number, f: number): CkMove[] {
    const p = this.board[r][f];
    if (!p || p.side !== this.turn) return [];
    if (this.anyJumps(this.turn)) return this.chainsFrom(r, f);
    return this.slidesFrom(r, f);
  }

  legalMoves(side: Side): CkMove[] {
    const mustJump = this.anyJumps(side);
    const out: CkMove[] = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = this.board[r][f];
      if (!p || p.side !== side) continue;
      if (mustJump) out.push(...this.chainsFrom(r, f));
      else out.push(...this.slidesFrom(r, f));
    }
    return out;
  }

  make(m: CkMove) {
    const [r0, f0] = m.from;
    const p = this.board[r0][f0]!;
    for (const c of m.caps) this.board[c.r][c.f] = null;
    const [r1, f1] = m.path[m.path.length - 1];
    m.promoted = !p.king && r1 === lastRankOf(p.side);
    this.board[r1][f1] = { side: p.side, king: p.king || m.promoted };
    this.board[r0][f0] = null;
    this.history.push(m);
    this.turn = ckOpp(this.turn);
  }

  undo(): CkMove | null {
    const m = this.history.pop();
    if (!m) return null;
    this.turn = ckOpp(this.turn);
    const [r0, f0] = m.from;
    const [r1, f1] = m.path[m.path.length - 1];
    const p = this.board[r1][f1]!;
    // 还原升级：仅当本着确实升王时撤销王冠（避免误摘原有的王）
    this.board[r0][f0] = { side: p.side, king: p.king && !m.promoted };
    this.board[r1][f1] = null;
    for (const c of m.caps) this.board[c.r][c.f] = { side: ckOpp(p.side), king: c.king };
    return m;
  }

  countPieces(side: Side): { men: number; kings: number } {
    let men = 0, kings = 0;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = this.board[r][f];
      if (p && p.side === side) { if (p.king) kings++; else men++; }
    }
    return { men, kings };
  }

  isOver(): { winner: Side | null; reason: string } | null {
    const cw = this.countPieces('w'), cb = this.countPieces('b');
    if (cw.men + cw.kings === 0) return { winner: 'b', reason: 'No pieces' };
    if (cb.men + cb.kings === 0) return { winner: 'w', reason: 'No pieces' };
    if (this.legalMoves(this.turn).length === 0) return { winner: ckOpp(this.turn), reason: 'No moves' };
    return null;
  }
}
