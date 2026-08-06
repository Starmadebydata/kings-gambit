// 围棋规则引擎：落子、提子、打劫、自杀禁手、虚着（pass）、悔棋、数子终局。
// 纯逻辑模块，不依赖 Three.js；b=黑（先手）、w=白。
import type { Side } from './types';

export interface GoMove {
  r: number; // 落点行（-1 = 虚着）
  f: number;
  side: Side; // 行棋方
  captured: [number, number][]; // 本手提掉的敌方棋子
  prevKo: [number, number] | null; // 落子前劫位（悔棋恢复用）
  prevPasses: number;
  pass: boolean;
}

const OTHER: Record<Side, Side> = { b: 'w', w: 'b' };

/** 数子法黑贴 3¾ 子（贴目 7.5 目）。 */
export const KOMI_SUB = 3.75;

function fmtMargin(m: number): string {
  const q = Math.round(m * 4) / 4;
  const whole = Math.floor(q);
  const frac = Math.round((q - whole) * 4);
  const f = frac === 0 ? '' : frac === 1 ? '¼' : frac === 2 ? '半' : '¾';
  return whole > 0 ? (f ? `${whole} ${f}` : `${whole}`) : f;
}

export class GoGame {
  readonly n: number;
  board: (Side | null)[][]; // [r][f]：r=0 顶端，f=0 左侧
  turn: Side = 'b'; // 黑先
  passes = 0; // 连续虚着计数（双方连虚 → 终局）
  ko: [number, number] | null = null; // 劫位：上一步被提的单子
  history: GoMove[] = [];
  lastMove: [number, number] | null = null;
  capturesB = 0; // 黑方提白子数
  capturesW = 0; // 白方提黑子数

  constructor(n = 19) {
    this.n = n;
    this.board = Array.from({ length: n }, () => Array<Side | null>(n).fill(null));
  }

  cloneBoard(): (Side | null)[][] {
    return this.board.map(row => [...row]);
  }

  inBounds(r: number, f: number) {
    return r >= 0 && r < this.n && f >= 0 && f < this.n;
  }

  private neighbors(r: number, f: number): [number, number][] {
    const out: [number, number][] = [];
    for (const [dr, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nf = f + df;
      if (this.inBounds(nr, nf)) out.push([nr, nf]);
    }
    return out;
  }

  /** 连通块及其气（BFS）。调用前 board[r][f] 必须非空。 */
  private groupInfo(r: number, f: number): { cells: [number, number][]; libs: Set<string> } {
    const side = this.board[r][f];
    const cells: [number, number][] = [];
    const libs = new Set<string>();
    const seen = new Set<string>([`${r},${f}`]);
    const stack: [number, number][] = [[r, f]];
    while (stack.length) {
      const [cr, cf] = stack.pop()!;
      cells.push([cr, cf]);
      for (const [nr, nf] of this.neighbors(cr, cf)) {
        const p = this.board[nr][nf];
        if (p === null) libs.add(`${nr},${nf}`);
        else if (p === side && !seen.has(`${nr},${nf}`)) {
          seen.add(`${nr},${nf}`);
          stack.push([nr, nf]);
        }
      }
    }
    return { cells, libs };
  }

  /** 该点能否落子（不含劫预判——劫需模拟提子数后判定）。返回错误信息或 null。 */
  legalAt(r: number, f: number): string | null {
    if (!this.inBounds(r, f)) return '越界';
    if (this.board[r][f]) return '此处已有棋子';
    const side = this.turn;
    this.board[r][f] = side;
    let canCapture = false;
    for (const [nr, nf] of this.neighbors(r, f)) {
      const p = this.board[nr][nf];
      if (p && p !== side && this.groupInfo(nr, nf).libs.size === 0) { canCapture = true; break; }
    }
    if (!canCapture && this.groupInfo(r, f).libs.size === 0) {
      this.board[r][f] = null;
      return '自杀禁手：落子后无气';
    }
    this.board[r][f] = null;
    return null;
  }

  /** 落子。成功返回被提棋子；失败返回错误信息（棋盘不变）。 */
  play(r: number, f: number): { ok: boolean; error?: string; captured: [number, number][] } {
    const err = this.legalAt(r, f);
    if (err) return { ok: false, error: err, captured: [] };
    const side = this.turn;
    this.board[r][f] = side;
    const captured: [number, number][] = [];
    for (const [nr, nf] of this.neighbors(r, f)) {
      const p = this.board[nr][nf];
      if (!p || p === side) continue;
      const g = this.groupInfo(nr, nf);
      if (g.libs.size === 0) {
        for (const [cr, cf] of g.cells) {
          this.board[cr][cf] = null;
          captured.push([cr, cf]);
        }
      }
    }
    // 劫争：落点恰是上一步被提的单子（ko 位），且本手恰好只提回一子 → 禁止立即回提
    if (captured.length === 1 && this.ko && r === this.ko[0] && f === this.ko[1]) {
      this.board[r][f] = null;
      for (const [cr, cf] of captured) this.board[cr][cf] = OTHER[side];
      return { ok: false, error: '劫争：不能立即提回', captured: [] };
    }
    const prevKo = this.ko;
    const prevPasses = this.passes;
    this.ko = captured.length === 1 ? captured[0] : null;
    this.passes = 0;
    if (side === 'b') this.capturesB += captured.length;
    else this.capturesW += captured.length;
    this.history.push({ r, f, side, captured, prevKo, prevPasses, pass: false });
    this.lastMove = [r, f];
    this.turn = OTHER[side];
    return { ok: true, captured };
  }

  /** 虚着：放弃一手。双方连续虚着即终局。 */
  pass() {
    const side = this.turn;
    this.history.push({ r: -1, f: -1, side, captured: [], prevKo: this.ko, prevPasses: this.passes, pass: true });
    this.ko = null;
    this.passes++;
    this.turn = OTHER[side];
  }

  isOver() {
    return this.passes >= 2;
  }

  private lastRealMove(): [number, number] | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const m = this.history[i];
      if (!m.pass) return [m.r, m.f];
    }
    return null;
  }

  undo(): boolean {
    const mv = this.history.pop();
    if (!mv) return false;
    if (!mv.pass) {
      this.board[mv.r][mv.f] = null;
      for (const [cr, cf] of mv.captured) this.board[cr][cf] = OTHER[mv.side];
      if (mv.side === 'b') this.capturesB -= mv.captured.length;
      else this.capturesW -= mv.captured.length;
    }
    this.turn = mv.side;
    this.ko = mv.prevKo;
    this.passes = mv.prevPasses;
    this.lastMove = mv.pass ? this.lastMove : this.lastRealMove();
    return true;
  }

  /**
   * 数子法计分：空点按边界颜色归属（两色相邻视为无主），
   * 得分 = 本方棋子数 + 本方领地空点数。
   */
  score(): { black: number; white: number } {
    const { n } = this;
    const owner: (Side | null)[][] = Array.from({ length: n }, () => Array<Side | null>(n).fill(null));
    const seen = new Set<string>();
    for (let r = 0; r < n; r++) for (let f = 0; f < n; f++) {
      if (this.board[r][f] !== null || seen.has(`${r},${f}`)) continue;
      const cells: [number, number][] = [];
      const colors = new Set<Side>();
      const stack: [number, number][] = [[r, f]];
      seen.add(`${r},${f}`);
      while (stack.length) {
        const [cr, cf] = stack.pop()!;
        cells.push([cr, cf]);
        for (const [nr, nf] of this.neighbors(cr, cf)) {
          const p = this.board[nr][nf];
          if (p) colors.add(p);
          else if (!seen.has(`${nr},${nf}`)) {
            seen.add(`${nr},${nf}`);
            stack.push([nr, nf]);
          }
        }
      }
      const own = colors.size === 1 ? [...colors][0] : null;
      for (const [cr, cf] of cells) owner[cr][cf] = own;
    }
    let black = 0, white = 0;
    for (let r = 0; r < n; r++) for (let f = 0; f < n; f++) {
      const p = this.board[r][f] ?? owner[r][f];
      if (p === 'b') black++;
      else if (p === 'w') white++;
    }
    return { black, white };
  }

  /** 终局结果：双方连续虚着后生效。黑 ≥ 半盘+3¾ 子（取整）胜。 */
  result(): { winner: Side; margin: string } | null {
    if (this.passes < 2) return null;
    const { black, white } = this.score();
    const total = this.n * this.n;
    const blackWinLine = total / 2 + KOMI_SUB;
    const whiteWinLine = total / 2 - KOMI_SUB;
    if (black >= Math.ceil(blackWinLine)) return { winner: 'b', margin: fmtMargin(black - blackWinLine) };
    return { winner: 'w', margin: fmtMargin(white - whiteWinLine) };
  }
}
