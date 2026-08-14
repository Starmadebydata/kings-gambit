import type { Side } from './types';

/** Shogi engine. Board indexed [rank 0..8][file 0..8]; rank 0 = gote (black) back rank, rank 8 = sente (white) back rank. Side 'w' = sente (moves toward rank 0). */

export type ShogiType = 'k' | 'r' | 'b' | 'g' | 's' | 'n' | 'l' | 'p';

export interface ShogiPiece { side: Side; type: ShogiType; promoted: boolean }

export interface ShogiMove {
  from: [number, number] | null; // null = 打ち（手驹投放）
  to: [number, number];
  drop?: ShogiType; // 投放的驹种
  promote?: boolean;
  capture?: ShogiPiece;
}

export type ShogiBoard = (ShogiPiece | null)[][];
export type Hand = Partial<Record<ShogiType, number>>;

const ORTH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL8 = [...ORTH, ...DIAG];

function initialBoard(): ShogiBoard {
  const b: ShogiBoard = Array.from({ length: 9 }, () => Array<ShogiPiece | null>(9).fill(null));
  const back: ShogiType[] = ['l', 'n', 's', 'g', 'k', 'g', 's', 'n', 'l'];
  for (let f = 0; f < 9; f++) {
    b[0][f] = { side: 'b', type: back[f], promoted: false };
    b[8][f] = { side: 'w', type: back[f], promoted: false };
    b[2][f] = { side: 'b', type: 'p', promoted: false };
    b[6][f] = { side: 'w', type: 'p', promoted: false };
  }
  b[1][1] = { side: 'b', type: 'r', promoted: false };
  b[1][7] = { side: 'b', type: 'b', promoted: false };
  b[7][1] = { side: 'w', type: 'r', promoted: false };
  b[7][7] = { side: 'w', type: 'b', promoted: false };
  return b;
}

const inBounds = (r: number, f: number) => r >= 0 && r <= 8 && f >= 0 && f <= 8;
const opp = (s: Side): Side => (s === 'w' ? 'b' : 'w');
const fwdOf = (s: Side) => (s === 'w' ? -1 : 1);
/** 敌阵三段：先手 rank 0-2，后手 rank 6-8。 */
const inPromoZone = (s: Side, r: number) => (s === 'w' ? r <= 2 : r >= 6);
/** 落点后无法再行的位置（必须成）：步/香最后一线，桂最后两线。 */
const deadEnd = (type: ShogiType, s: Side, r: number) => {
  if (type === 'p' || type === 'l') return s === 'w' ? r === 0 : r === 8;
  if (type === 'n') return s === 'w' ? r <= 1 : r >= 7;
  return false;
};

export class Shogi {
  board: ShogiBoard = initialBoard();
  hands: Record<Side, Hand> = { w: {}, b: {} };
  turn: Side = 'w';
  history: ShogiMove[] = [];

  reset() { this.board = initialBoard(); this.hands = { w: {}, b: {} }; this.turn = 'w'; this.history = []; }
  cloneBoard(): ShogiBoard { return this.board.map(row => row.map(p => (p ? { ...p } : null))); }
  at(r: number, f: number): ShogiPiece | null { return this.board[r][f]; }
  hand(side: Side): Hand { return this.hands[side]; }

  /** 驹台增减；归零即移除键，保持 hands 干净。 */
  private addHand(side: Side, t: ShogiType, d: number) {
    const h = this.hands[side];
    const v = (h[t] ?? 0) + d;
    if (v <= 0) delete h[t]; else h[t] = v;
  }

  /** 单子的伪合法着法（不含送王检查；含可选/强制成）。 */
  pieceMoves(r: number, f: number): ShogiMove[] {
    const p = this.board[r][f];
    if (!p) return [];
    const out: ShogiMove[] = [];
    const fwd = fwdOf(p.side);
    const push = (tr: number, tf: number): boolean => {
      if (!inBounds(tr, tf)) return false;
      const q = this.board[tr][tf];
      if (q && q.side === p.side) return false;
      const canPromote = !p.promoted && p.type !== 'k' && p.type !== 'g'
        && (inPromoZone(p.side, r) || inPromoZone(p.side, tr));
      if (canPromote) {
        out.push({ from: [r, f], to: [tr, tf], capture: q ?? undefined, promote: true });
        if (!deadEnd(p.type, p.side, tr)) out.push({ from: [r, f], to: [tr, tf], capture: q ?? undefined, promote: false });
      } else {
        out.push({ from: [r, f], to: [tr, tf], capture: q ?? undefined });
      }
      return !q;
    };
    const slide = (dirs: [number, number][]) => {
      for (const [dr, df] of dirs) {
        let tr = r + dr, tf = f + df;
        while (inBounds(tr, tf)) { if (!push(tr, tf)) break; tr += dr; tf += df; }
      }
    };
    // 成银/成桂/成香/と 按金将走子
    const eff: ShogiType = p.promoted && p.type !== 'r' && p.type !== 'b' ? 'g' : p.type;
    switch (eff) {
      case 'k': for (const [dr, df] of ALL8) push(r + dr, f + df); break;
      case 'g': for (const [dr, df] of [...ORTH, [fwd, -1] as [number, number], [fwd, 1] as [number, number]]) push(r + dr, f + df); break;
      case 's': for (const [dr, df] of [...DIAG, [fwd, 0] as [number, number]]) push(r + dr, f + df); break;
      case 'n': for (const df of [-1, 1]) push(r + fwd * 2, f + df); break;
      case 'p': push(r + fwd, f); break;
      case 'l': slide([[fwd, 0]]); break;
      case 'r':
        slide(ORTH);
        if (p.promoted) for (const [dr, df] of DIAG) push(r + dr, f + df);
        break;
      case 'b':
        slide(DIAG);
        if (p.promoted) for (const [dr, df] of ORTH) push(r + dr, f + df);
        break;
    }
    return out;
  }

  /** 手驹投放的伪合法着法（含二步/无去向限制，不含打步诘）。 */
  dropMoves(side: Side, type: ShogiType): ShogiMove[] {
    const out: ShogiMove[] = [];
    const count = this.hands[side][type] ?? 0;
    if (count <= 0) return out;
    for (let r = 0; r < 9; r++) {
      for (let f = 0; f < 9; f++) {
        if (this.board[r][f]) continue;
        if (deadEnd(type, side, r)) continue;
        if (type === 'p') {
          // 二步：该列不得已有己方未成步
          let dup = false;
          for (let rr = 0; rr < 9; rr++) {
            const q = this.board[rr][f];
            if (q && q.side === side && q.type === 'p' && !q.promoted) { dup = true; break; }
          }
          if (dup) continue;
        }
        out.push({ from: null, to: [r, f], drop: type });
      }
    }
    return out;
  }

  /** 盘上着法（不含投放）。 */
  boardMoves(side: Side): ShogiMove[] {
    const out: ShogiMove[] = [];
    for (let r = 0; r < 9; r++) for (let f = 0; f < 9; f++) {
      const p = this.board[r][f];
      if (p && p.side === side) out.push(...this.pieceMoves(r, f));
    }
    return out;
  }

  pseudoMoves(side: Side): ShogiMove[] {
    const out = this.boardMoves(side);
    for (const t of ['p', 'l', 'n', 's', 'g', 'b', 'r'] as ShogiType[]) out.push(...this.dropMoves(side, t));
    return out;
  }

  kingPos(side: Side): [number, number] | null {
    for (let r = 0; r < 9; r++) for (let f = 0; f < 9; f++) {
      const p = this.board[r][f];
      if (p && p.side === side && p.type === 'k') return [r, f];
    }
    return null;
  }

  /** (r,f) 是否被 bySide 棋子攻击（反向定向扫描，供 AI 搜索高频调用）。 */
  isAttacked(r: number, f: number, bySide: Side): boolean {
    const fwd = fwdOf(bySide);
    const enemyAt = (rr: number, ff: number): ShogiPiece | null => {
      if (!inBounds(rr, ff)) return null;
      const q = this.board[rr][ff];
      return q && q.side === bySide ? q : null;
    };
    // 步（と金向前攻击同形）
    if (enemyAt(r - fwd, f)?.type === 'p') return true;
    // 桂马
    if (enemyAt(r - 2 * fwd, f - 1)?.type === 'n' || enemyAt(r - 2 * fwd, f + 1)?.type === 'n') return true;
    // 香车：沿竖线向后方回扫
    for (let rr = r - fwd; inBounds(rr, f); rr -= fwd) {
      const q = this.board[rr][f];
      if (q) { if (q.side === bySide && q.type === 'l') return true; break; }
    }
    // 相邻一步子：玉/金/银/飞车（龙）/角行（马），成银成桂成香と按金
    for (const [dr, df] of ALL8) {
      const q = enemyAt(r + dr, f + df);
      if (!q) continue;
      const eff: ShogiType = q.promoted && q.type !== 'r' && q.type !== 'b' ? 'g' : q.type;
      const ad = -dr, bd = -df; // 攻击者 → 目标方向
      switch (eff) {
        case 'k': return true;
        case 'g': if ((ad === 0) !== (bd === 0) || (ad === fwd && bd !== 0)) return true; break;
        case 's': if ((ad !== 0 && bd !== 0) || (ad === fwd && bd === 0)) return true; break;
        case 'r': if (ad === 0 || bd === 0) return true; break;
        case 'b': if (ad !== 0 && bd !== 0) return true; break;
      }
    }
    // 滑行：正线飞车/龙王，斜线角行/龙马
    for (const [dr, df] of ORTH) {
      let rr = r + dr, ff = f + df;
      while (inBounds(rr, ff)) {
        const q = this.board[rr][ff];
        if (q) { if (q.side === bySide && q.type === 'r') return true; break; }
        rr += dr; ff += df;
      }
    }
    for (const [dr, df] of DIAG) {
      let rr = r + dr, ff = f + df;
      while (inBounds(rr, ff)) {
        const q = this.board[rr][ff];
        if (q) { if (q.side === bySide && q.type === 'b') return true; break; }
        rr += dr; ff += df;
      }
    }
    return false;
  }

  inCheck(side: Side): boolean {
    const k = this.kingPos(side);
    if (!k) return false;
    return this.isAttacked(k[0], k[1], opp(side));
  }

  make(m: ShogiMove) {
    if (m.drop) {
      this.addHand(this.turn, m.drop, -1);
      this.board[m.to[0]][m.to[1]] = { side: this.turn, type: m.drop, promoted: false };
    } else {
      const p = this.board[m.from![0]][m.from![1]]!;
      // 外部直接构造的着法不带 capture；落点有子即为吃（兼容 AI 搜索与 3D 层传入）
      if (m.capture === undefined) m.capture = this.board[m.to[0]][m.to[1]] ?? undefined;
      if (m.capture) {
        // 被俘驹（去成）入己方驹台
        this.addHand(this.turn, m.capture.type, 1);
      }
      this.board[m.to[0]][m.to[1]] = { side: p.side, type: p.type, promoted: p.promoted || !!m.promote };
      this.board[m.from![0]][m.from![1]] = null;
    }
    this.history.push(m);
    this.turn = opp(this.turn);
  }

  undo(): ShogiMove | null {
    const m = this.history.pop();
    if (!m) return null;
    this.turn = opp(this.turn);
    if (m.drop) {
      this.board[m.to[0]][m.to[1]] = null;
      this.addHand(this.turn, m.drop, 1);
    } else {
      const p = this.board[m.to[0]][m.to[1]]!;
      this.board[m.from![0]][m.from![1]] = { side: p.side, type: p.type, promoted: m.promote ? false : p.promoted };
      this.board[m.to[0]][m.to[1]] = m.capture ?? null;
      if (m.capture) this.addHand(this.turn, m.capture.type, -1);
    }
    return m;
  }

  /** 不含打步诘过滤的合法着（内部递归用）。投放不移开己方子，天然不送王，无需逐一试探。 */
  private legalMovesRaw(side: Side): ShogiMove[] {
    const out: ShogiMove[] = this.legalBoardMoves(side);
    out.push(...this.pseudoDropMoves(side));
    return out;
  }

  private pseudoDropMoves(side: Side): ShogiMove[] {
    const out: ShogiMove[] = [];
    for (const t of ['p', 'l', 'n', 's', 'g', 'b', 'r'] as ShogiType[]) out.push(...this.dropMoves(side, t));
    return out;
  }

  /** 盘上着法的送王过滤（make/undo + 快速 isAttacked）。 */
  private legalBoardMoves(side: Side): ShogiMove[] {
    const out: ShogiMove[] = [];
    for (const m of this.boardMoves(side)) {
      this.make(m);
      const k = this.kingPos(side);
      const safe = k && !this.isAttacked(k[0], k[1], opp(side));
      this.undo();
      if (safe) out.push(m);
    }
    return out;
  }

  /** 完整合法着（含打步诘禁手过滤）。 */
  legalMoves(side: Side): ShogiMove[] {
    const out = this.legalBoardMoves(side);
    const fwd = fwdOf(side);
    const ek = this.kingPos(opp(side));
    for (const m of this.pseudoDropMoves(side)) {
      if (m.drop === 'p' && ek && ek[0] === m.to[0] + fwd && ek[1] === m.to[1]) {
        // 该步投放正对敌王 → 试判打步诘（其余投放不送王、也不将）
        this.make(m);
        const mate = this.legalMovesRaw(opp(side)).length === 0;
        this.undo();
        if (mate) continue;
      }
      out.push(m);
    }
    return out;
  }

  legalMovesFrom(r: number, f: number): ShogiMove[] {
    const p = this.board[r][f];
    if (!p) return [];
    const out: ShogiMove[] = [];
    for (const m of this.pieceMoves(r, f)) {
      this.make(m);
      const k = this.kingPos(p.side);
      const safe = k && !this.isAttacked(k[0], k[1], opp(p.side));
      this.undo();
      if (safe) out.push(m);
    }
    return out;
  }

  /** 无合法着 = 诘み（输）。 */
  isOver(): { winner: Side; reason: string } | null {
    if (this.legalMoves(this.turn).length > 0) return null;
    return { winner: opp(this.turn), reason: this.inCheck(this.turn) ? '诘み · Checkmate' : 'No Legal Moves' };
  }
}

/** 驹面汉字（未成）。 */
export const SHOGI_CHAR: Record<ShogiType, string> = {
  k: '王', r: '飛', b: '角', g: '金', s: '銀', n: '桂', l: '香', p: '歩',
};
/** 驹面汉字（成驹，赤字）。 */
export const SHOGI_PROMOTED_CHAR: Record<ShogiType, string> = {
  k: '王', r: '龍', b: '馬', g: '金', s: '全', n: '圭', l: '杏', p: 'と',
};
/** 先手玉=玉，后手玉=王。 */
export const shogiKingChar = (side: Side) => (side === 'w' ? '玉' : '王');

export const SHOGI_VALUE: Record<ShogiType, number> = {
  p: 1, l: 3, n: 3.5, s: 5, g: 5.5, b: 8.5, r: 9.5, k: 0,
};
