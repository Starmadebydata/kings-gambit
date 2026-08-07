/**
 * Famous games library (Xiangqi). Each game is a full legal script from the initial
 * position to checkmate, generated from classic openings and verified move by move.
 */
import type { Side } from './types';
import type { XqType } from './pieceModels';
import { Xiangqi, XQ_CHAR, type XqMove, type XqPiece } from './xiangqi';
import { WUDI_GAMES } from './wudiGames';
import { MEIHUA_GAMES } from './meihuaGames';

export interface ScriptMove {
  from: [number, number]; // [rank, file]
  to: [number, number];
  note: string; // traditional notation
}

export interface FamousGame {
  id: string;
  title: string;
  source: string;
  desc: string;
  result: string; // '红胜' | '黑胜'
  moves: ScriptMove[];
}

/** 《橘中秘》顺炮横车弃马局 — Red sacrifices the horse, then storms in with twin chariots. */
const QI_MA: FamousGame = {
  id: 'qi-ma-ju',
  title: '顺炮横车弃马局',
  source: '古谱《橘中秘》演绎',
  desc: '顺炮横车捉炮弃马，红方双车齐发直捣九宫，古谱杀法之经典。',
  result: '红胜',
  moves: [
    { from: [7, 7], to: [7, 4], note: '炮二平五' },
    { from: [2, 7], to: [2, 4], note: '砲8平5' },
    { from: [9, 7], to: [7, 6], note: '傌二进三' },
    { from: [0, 7], to: [2, 6], note: '傌8进7' },
    { from: [9, 8], to: [8, 8], note: '俥一进一' },
    { from: [0, 8], to: [0, 7], note: '俥9平8' },
    { from: [8, 8], to: [8, 3], note: '俥一平六' },
    { from: [0, 7], to: [6, 7], note: '俥8进6' },
    { from: [8, 3], to: [1, 3], note: '俥六进七' },
    { from: [0, 1], to: [2, 0], note: '傌2进1' },
    { from: [9, 0], to: [8, 0], note: '俥九进一' },
    { from: [2, 1], to: [4, 1], note: '砲2进2' },
    { from: [8, 0], to: [8, 5], note: '俥九平四' },
    { from: [4, 1], to: [4, 6], note: '砲2平7' },
    { from: [9, 1], to: [7, 0], note: '傌八进九' },
    { from: [4, 6], to: [7, 6], note: '砲7进3' }, // Black greedily takes the horse
    { from: [7, 1], to: [7, 6], note: '炮八平三' },
    { from: [6, 7], to: [6, 6], note: '俥8平7' },
    { from: [8, 5], to: [7, 5], note: '俥四进一' },
    { from: [2, 4], to: [6, 4], note: '砲5进4' },
    { from: [9, 3], to: [8, 4], note: '仕六进五' },
    { from: [6, 4], to: [5, 4], note: '砲5退1' },
    { from: [1, 3], to: [1, 6], note: '俥六平三' },
    { from: [2, 6], to: [1, 4], note: '傌7退5' },
    { from: [1, 6], to: [1, 5], note: '俥三平四' },
    { from: [1, 4], to: [3, 3], note: '傌5进4' },
    { from: [1, 5], to: [0, 5], note: '俥四进一' },
    { from: [0, 4], to: [1, 4], note: '將5进1' },
    { from: [0, 5], to: [0, 3], note: '俥四平六' },
    { from: [3, 3], to: [1, 2], note: '傌4退3' },
    { from: [0, 3], to: [0, 6], note: '俥六平三' },
    { from: [1, 2], to: [3, 1], note: '傌3进2' },
    { from: [0, 6], to: [1, 6], note: '俥三退一' },
    { from: [1, 4], to: [2, 4], note: '將5进1' },
    { from: [7, 5], to: [1, 5], note: '俥四进六' },
    { from: [2, 4], to: [2, 3], note: '將5平4' },
    { from: [1, 5], to: [1, 3], note: '俥四平六' },
    { from: [2, 3], to: [2, 4], note: '將4平5' },
    { from: [1, 6], to: [2, 6], note: '俥三退一' } // checkmate
  ]
};

/** 顺炮直车对横车 — classic opening played out by the engine to a decisive finish. */
const SHUN_PAO: FamousGame = {
  id: 'shun-pao-zhi-heng',
  title: '顺炮直车对横车',
  source: '古谱《橘中秘》变例 · 引擎演绎',
  desc: '顺炮直车急进过河，黑方横车抢占肋道，双方互攻激烈。',
  result: '红胜',
  moves: [
    { from: [7, 7], to: [7, 4], note: '炮二平五' },
    { from: [2, 7], to: [2, 4], note: '砲8平5' },
    { from: [9, 7], to: [7, 6], note: '傌二进三' },
    { from: [0, 7], to: [2, 6], note: '傌8进7' },
    { from: [9, 8], to: [9, 7], note: '俥一平二' },
    { from: [0, 8], to: [1, 8], note: '俥9进1' },
    { from: [9, 7], to: [6, 7], note: '俥二进六' },
    { from: [1, 8], to: [1, 3], note: '俥9平4' },
    { from: [9, 1], to: [7, 2], note: '傌八进七' },
    { from: [2, 4], to: [6, 4], note: '砲五进五' },
    { from: [7, 2], to: [6, 4], note: '傌七进五' },
    { from: [2, 6], to: [1, 4], note: '傌七退五' },
    { from: [7, 4], to: [3, 4], note: '炮五进五' },
    { from: [0, 6], to: [2, 4], note: '象七进三' },
    { from: [3, 4], to: [3, 8], note: '炮五平一' },
    { from: [1, 3], to: [9, 3], note: '俥四进九' },
    { from: [9, 4], to: [9, 3], note: '帥五平六' },
    { from: [2, 1], to: [5, 1], note: '砲二进四' },
    { from: [3, 8], to: [3, 2], note: '炮一平七' },
    { from: [0, 2], to: [2, 0], note: '象三进三' },
    { from: [7, 1], to: [7, 4], note: '炮八平五' },
    { from: [5, 1], to: [7, 1], note: '砲二进三' },
    { from: [7, 4], to: [2, 4], note: '炮五进六' },
    { from: [1, 4], to: [0, 2], note: '傌五退三' },
    { from: [3, 2], to: [3, 4], note: '炮七平五' } // checkmate
  ]
};

/** 《梅花谱》屏风马破当头炮第一局（破当头炮巡河车去卒局）— Black's horses/cannons
 *  counter-attack the central cannon, win a rook, then drive home for the mate. */
const PING_FENG: FamousGame = {
  id: 'ping-feng-ma-po-pao',
  title: '屏风马破当头炮',
  source: '古谱《梅花谱》第一局 · 引擎演绎',
  desc: '屏风马柔克刚破当头炮：黑弃卒诱车、马炮联动反扑，得车后衔枚疾进，古谱反击之经典。',
  result: '黑胜',
  moves: [
    { from: [7, 7], to: [7, 4], note: '炮二平五' },
    { from: [0, 7], to: [2, 6], note: '傌8进7' },
    { from: [9, 7], to: [7, 6], note: '傌二进三' },
    { from: [3, 2], to: [4, 2], note: '卒3进一' },
    { from: [9, 8], to: [9, 7], note: '俥一平二' },
    { from: [0, 8], to: [0, 7], note: '俥9平8' },
    { from: [9, 7], to: [5, 7], note: '俥二进四' },
    { from: [0, 1], to: [2, 2], note: '傌2进3' },
    { from: [6, 2], to: [5, 2], note: '兵七进一' },
    { from: [4, 2], to: [5, 2], note: '卒3进一' },
    { from: [5, 7], to: [5, 2], note: '俥二平七' },
    { from: [3, 6], to: [4, 6], note: '卒7进一' },
    { from: [7, 1], to: [7, 2], note: '炮八平七' },
    { from: [2, 2], to: [4, 1], note: '傌3进2' },
    { from: [5, 2], to: [4, 2], note: '俥七进一' },
    { from: [2, 7], to: [4, 7], note: '砲8进二' },
    { from: [4, 2], to: [4, 6], note: '俥七平三' },
    { from: [4, 1], to: [5, 3], note: '傌2进4' },
    { from: [4, 6], to: [2, 6], note: '俥三进二' },
    { from: [0, 2], to: [2, 4], note: '象3进5' },
    { from: [2, 6], to: [5, 6], note: '俥三退三' },
    { from: [5, 3], to: [6, 1], note: '傌4进2' },
    { from: [9, 1], to: [7, 0], note: '傌八进九' },
    { from: [6, 1], to: [7, 3], note: '傌2进4' },
    { from: [9, 4], to: [8, 4], note: '帥五进一' },
    { from: [4, 7], to: [4, 3], note: '砲8平4' },
    { from: [8, 4], to: [8, 5], note: '帥五平四' },
    { from: [2, 1], to: [8, 1], note: '砲2进六' },
    { from: [9, 0], to: [9, 1], note: '俥九平八' },
    { from: [0, 0], to: [1, 0], note: '俥1进一' },
    { from: [5, 6], to: [5, 5], note: '俥三平四' },
    { from: [0, 7], to: [8, 7], note: '俥8进八' },
    { from: [8, 5], to: [7, 5], note: '帥四进一' },
    { from: [7, 3], to: [9, 4], note: '傌4进5' },
    { from: [7, 4], to: [8, 4], note: '炮五退一' },
    { from: [8, 7], to: [8, 5], note: '俥8平6' },
    { from: [7, 5], to: [7, 4], note: '帥四平五' },
    { from: [8, 5], to: [5, 5], note: '俥6退三' },
    { from: [7, 0], to: [8, 2], note: '傌九退七' },
    { from: [4, 3], to: [4, 4], note: '砲4平5' },
    { from: [7, 4], to: [7, 3], note: '帥五平六' },
    { from: [1, 0], to: [1, 3], note: '俥1平4' } // checkmate
  ]
};

/** 《自出洞来无敌手》"自"字信手炮第一局 — the knight weaves in and out,
 *  the rook is given for a mating net with the cannon over the knight. */
const ZI_CHU: FamousGame = {
  id: 'zi-chu-dong-lai',
  title: '自出洞来无敌手 · 信手炮',
  source: '古谱《自出洞来无敌手》自字局',
  desc: '顺炮横车对直车：红马盘旋三进三退，弃车换杀，以马作炮架绝杀九宫，全谱无变一气呵成。',
  result: '红胜',
  moves: [
    { from: [7, 1], to: [7, 4], note: '炮八平五' },
    { from: [2, 1], to: [2, 4], note: '砲2平5' },
    { from: [9, 1], to: [7, 2], note: '傌八进七' },
    { from: [0, 1], to: [2, 2], note: '傌2进3' },
    { from: [9, 0], to: [8, 0], note: '俥九进一' },
    { from: [0, 0], to: [0, 1], note: '俥1平2' },
    { from: [8, 0], to: [8, 5], note: '俥九平四' },
    { from: [0, 5], to: [1, 4], note: '士6进5' },
    { from: [8, 5], to: [1, 5], note: '俥四进七' },
    { from: [0, 7], to: [2, 8], note: '傌8进9' },
    { from: [6, 6], to: [5, 6], note: '兵三进一' },
    { from: [0, 1], to: [6, 1], note: '俥2进六' },
    { from: [9, 7], to: [7, 6], note: '傌二进三' },
    { from: [6, 1], to: [6, 2], note: '俥2平3' },
    { from: [7, 6], to: [5, 5], note: '傌三进四' },
    { from: [3, 2], to: [4, 2], note: '卒3进一' },
    { from: [5, 5], to: [3, 6], note: '傌四进三' },
    { from: [2, 7], to: [2, 5], note: '砲8平6' },
    { from: [3, 6], to: [1, 7], note: '傌三进二' },
    { from: [2, 5], to: [2, 7], note: '砲6平8' },
    { from: [9, 8], to: [8, 8], note: '俥一进一' },
    { from: [4, 2], to: [5, 2], note: '卒3进一' },
    { from: [8, 8], to: [8, 1], note: '俥一平八' },
    { from: [0, 8], to: [1, 8], note: '俥9进一' },
    { from: [8, 1], to: [1, 1], note: '俥八进七' },
    { from: [5, 2], to: [5, 3], note: '卒3平4' },
    { from: [1, 5], to: [0, 5], note: '俥四进一' },
    { from: [1, 4], to: [0, 5], note: '士5退6' },
    { from: [1, 7], to: [2, 5], note: '傌二退四' },
    { from: [1, 8], to: [1, 5], note: '俥9平6' },
    { from: [1, 1], to: [1, 5], note: '俥八平四' },
    { from: [0, 3], to: [1, 4], note: '士4进5' },
    { from: [1, 5], to: [0, 5], note: '俥四进一' },
    { from: [0, 4], to: [0, 5], note: '將5平6' },
    { from: [7, 7], to: [7, 5], note: '炮二平四' } // checkmate
  ]
};

export const FAMOUS_GAMES: FamousGame[] = [QI_MA, SHUN_PAO, PING_FENG, ZI_CHU, ...MEIHUA_GAMES, ...WUDI_GAMES];

/** Backward-compatible alias: the first famous game. */
export const FAMOUS_GAME = QI_MA;

// ---------------------------------------------------------------------------
// Variation tree — the script state inside Xq3D is a tree, not a linear list.
// nodes[0] is the root (no move). A move leads from its parent into the node.
// ---------------------------------------------------------------------------

export interface ScriptNode {
  move: ScriptMove | null; // null for the root node
  parent: number;
  children: number[];
}

export interface ScriptTree {
  title: string;
  source: string;
  desc: string;
  result: string;
  custom: boolean; // imported or board-study script
  rootBoard?: (XqPiece | null)[][]; // non-standard starting position (board study)
  nodes: ScriptNode[];
}

/** Convert a linear famous game into a variation tree (main line only).
 *  Notes are regenerated with noteForMove so they always match the coordinates
 *  and follow the traditional style (Chinese numerals for Red, Arabic for Black). */
export function treeFromGame(g: FamousGame): ScriptTree {
  const nodes: ScriptNode[] = [{ move: null, parent: -1, children: [] }];
  let cur = 0;
  const x = new Xiangqi();
  for (const m of g.moves) {
    const mv = x.legalMoves(x.turn).find(mm =>
      mm.from[0] === m.from[0] && mm.from[1] === m.from[1] && mm.to[0] === m.to[0] && mm.to[1] === m.to[1]);
    const note = mv ? noteForMove(x, mv) : m.note;
    const idx = nodes.length;
    nodes.push({ move: { from: [...m.from], to: [...m.to], note }, parent: cur, children: [] });
    nodes[cur].children.push(idx);
    cur = idx;
    if (mv) x.make(mv);
  }
  return { title: g.title, source: g.source, desc: g.desc, result: g.result, custom: false, nodes };
}

/** A fresh empty tree (used by board study / free practice). */
export function emptyTree(title: string, source: string): ScriptTree {
  return { title, source, desc: '', result: '', custom: true, nodes: [{ move: null, parent: -1, children: [] }] };
}

/** Follow children[0] from the root to the end of the main line; returns node-index path. */
export function treeMainline(tree: ScriptTree): number[] {
  const path = [0];
  let cur = 0;
  while (tree.nodes[cur].children.length > 0) {
    cur = tree.nodes[cur].children[0];
    path.push(cur);
  }
  return path;
}

// ---------------------------------------------------------------------------
// Traditional notation parsing (ported from _classic_gen.ts for in-browser use)
// ---------------------------------------------------------------------------

const FILES = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const NUM_HAN = '一二三四五六七八九';

const CHAR_MAP: Record<string, XqType> = {
  炮: 'c', 砲: 'c', 馬: 'h', 马: 'h', 傌: 'h',
  車: 'r', 车: 'r', 俥: 'r', 卒: 'p', 兵: 'p',
  象: 'e', 相: 'e', 士: 'a', 仕: 'a', 將: 'k', 将: 'k', 帥: 'k', 帅: 'k'
};

function numVal(s: string): number {
  const i = NUM_HAN.indexOf(s);
  if (i >= 0) return i + 1;
  const half = s.replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xff10));
  const n = parseInt(half, 10);
  if (Number.isNaN(n) || n < 1 || n > 9) throw new Error(`bad number: ${s}`);
  return n;
}

const fileOf = (side: Side, n: number) => (side === 'w' ? 9 - n : n - 1);

/** Match one traditional-notation ply against the current position; returns legal candidates. */
function matchMoves(x: Xiangqi, text: string): { mv: XqMove; note: string }[] {
  let s = text.replace(/[（(].*?[)）]/g, '').trim();
  const side = x.turn;
  let front: boolean | null = null;
  if (s.startsWith('前')) { front = true; s = s.slice(1); }
  else if (s.startsWith('后')) { front = false; s = s.slice(1); }

  const pcChar = s[0];
  const type = CHAR_MAP[pcChar];
  if (!type) throw new Error(`unknown piece char: ${pcChar} in "${text}"`);

  // 普通记谱“炮二平五”：s[1]=起点路 s[2]=动词 s[3:]=目标；
  // 前/后记谱“前炮进一”：s[1]=动词 s[2:]=目标（无起点路），需错位取用
  const hasFront = front !== null;
  const fromFile = hasFront ? -1 : fileOf(side, numVal(s[1]));
  const verb = hasFront ? s[1] : s[2];
  const n = numVal(s.slice(hasFront ? 2 : 3));
  const adv = side === 'w';

  const out: { mv: XqMove; note: string }[] = [];
  for (const mv of x.legalMoves(side)) {
    const p = x.board[mv.from[0]][mv.from[1]];
    if (!p || p.type !== type) continue;
    if (front === null && mv.from[1] !== fromFile) continue;
    if (front !== null) {
      const poss: [number, number][] = [];
      for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
        const q = x.board[r][f];
        if (q && q.side === side && q.type === type) poss.push([r, f]);
      }
      poss.sort((a, b) => (side === 'w' ? a[0] - b[0] : b[0] - a[0]));
      const target = front ? poss[0] : poss[poss.length - 1];
      if (mv.from[0] !== target[0] || mv.from[1] !== target[1]) continue;
    }

    const dr = mv.to[0] - mv.from[0];
    const df = mv.to[1] - mv.from[1];
    const isAdv = adv ? dr < 0 : dr > 0;
    let ok = false;

    if (verb === '平') {
      ok = dr === 0 && mv.to[1] === fileOf(side, n);
    } else if (type === 'h' || type === 'e' || type === 'a') {
      ok = mv.to[1] === fileOf(side, n) && isAdv === (verb === '进');
    } else if (type === 'k') {
      ok = verb === '平' ? dr === 0 && mv.to[1] === fileOf(side, n) : Math.abs(dr) === 1 && isAdv === (verb === '进');
    } else if (type === 'p') {
      ok = verb === '平' ? dr === 0 && mv.to[1] === fileOf(side, n) : isAdv && Math.abs(dr) === 1;
    } else {
      ok = Math.abs(dr) === n && isAdv === (verb === '进');
    }
    if (!ok) continue;
    out.push({ mv, note: noteForMove(x, mv) });
  }
  return out;
}

/** Traditional notation for one move from the given position. */
export function noteForMove(x: Xiangqi, mv: XqMove): string {
  const pc = x.board[mv.from[0]][mv.from[1]];
  if (!pc) return '?';
  const name = XQ_CHAR[pc.side][pc.type];
  const fNum = (f: number) => (pc.side === 'w' ? FILES[8 - f] : String(f + 1));
  const dr = mv.to[0] - mv.from[0];
  const isAdv = pc.side === 'w' ? dr < 0 : dr > 0;
  const t = pc.type as XqType;

  // 同列双炮：按传统记谱用“前炮/后炮”记（去掉起点路，步数照旧）
  if (t === 'c') {
    let twinR = -1;
    for (let r = 0; r < 10; r++) {
      if (r === mv.from[0]) continue;
      const q = x.board[r][mv.from[1]];
      if (q && q.side === pc.side && q.type === 'c') { twinR = r; break; }
    }
    if (twinR >= 0) {
      const isFront = pc.side === 'w' ? mv.from[0] < twinR : mv.from[0] > twinR;
      const verb = dr === 0 ? '平' : isAdv ? '进' : '退';
      const steps = dr === 0 ? fNum(mv.to[1]) : pc.side === 'w' ? FILES[Math.abs(dr) - 1] : String(Math.abs(dr));
      return `${isFront ? '前' : '后'}${name}${verb}${steps}`;
    }
  }

  if (t === 'h' || t === 'e' || t === 'a') return `${name}${fNum(mv.from[1])}${isAdv ? '进' : '退'}${fNum(mv.to[1])}`;
  if (t === 'k' || t === 'p') return dr === 0 ? `${name}${fNum(mv.from[1])}平${fNum(mv.to[1])}` : `${name}${fNum(mv.from[1])}${isAdv ? '进' : '退'}${pc.side === 'w' ? '一' : '1'}`;
  if (dr === 0) return `${name}${fNum(mv.from[1])}平${fNum(mv.to[1])}`;
  const steps = pc.side === 'w' ? FILES[Math.abs(dr) - 1] : String(Math.abs(dr));
  return `${name}${fNum(mv.from[1])}${isAdv ? '进' : '退'}${steps}`;
}

/**
 * Parse traditional notation text (spaces / newlines separate plies) into a tree.
 * Strips move numbers like "1." and parenthesized comments. DFS resolves ambiguity.
 */
export function parseNotationText(text: string): { tree: ScriptTree | null; error: string | null } {
  const plies = text
    .split(/[\s,，、]+/)
    .map(t => t.replace(/^\d+[.、)]\s*/, '').replace(/[（(].*?[)）]/g, '').trim())
    .filter(Boolean);
  if (plies.length === 0) return { tree: null, error: '没有可解析的着法' };
  if (plies.length > 600) return { tree: null, error: '着法过多（>600），请分段导入' };

  const x = new Xiangqi();
  const nodes: ScriptNode[] = [{ move: null, parent: -1, children: [] }];
  let cur = 0;

  const apply = (sm: ScriptMove): boolean => {
    const mv = x.legalMoves(x.turn).find(m =>
      m.from[0] === sm.from[0] && m.from[1] === sm.from[1] && m.to[0] === sm.to[0] && m.to[1] === sm.to[1]);
    if (!mv) return false;
    const idx = nodes.length;
    nodes.push({ move: sm, parent: cur, children: [] });
    nodes[cur].children.push(idx);
    cur = idx;
    x.make(mv);
    return true;
  };
  const unapply = () => {
    if (cur === 0) return;
    const node = nodes[cur];
    const parent = node.parent;
    nodes[parent].children.pop();
    nodes.pop();
    cur = parent;
    x.undo();
  };

  // DFS with backtracking to resolve ambiguous plies (e.g. two cannons on a file).
  // `maxI` remembers the deepest ply reached so an error points at the real culprit
  // even after the search unwinds back to the root.
  let maxI = 0;
  const rec = (i: number): boolean => {
    if (i > maxI) maxI = i;
    if (i >= plies.length) return true;
    let cands: { mv: XqMove; note: string }[];
    try {
      cands = matchMoves(x, plies[i]);
    } catch (e) {
      cands = [];
    }
    if (cands.length === 0) return false;
    for (const c of cands) {
      const ok = apply({ from: [c.mv.from[0], c.mv.from[1]], to: [c.mv.to[0], c.mv.to[1]], note: c.note });
      if (ok && rec(i + 1)) return true;
      if (ok) unapply();
    }
    return false;
  };

  if (!rec(0)) {
    const bad = plies[maxI];
    return {
      tree: null,
      error: `第 ${maxI + 1} 着「${bad || '?'}」无法解析（该局面下不合法，或记谱格式有误）`
    };
  }
  return {
    tree: {
      title: '自定义棋谱',
      source: '玩家导入',
      desc: `共 ${plies.length} 着，解析成功`,
      result: '',
      custom: true,
      nodes
    },
    error: null
  };
}

/** Format a path of tree node indices as "1. 炮二平五 馬8进7" lines. */
export function exportScriptText(tree: ScriptTree, path: number[]): string {
  const notes = path.slice(1).map(n => tree.nodes[n].move?.note ?? '?');
  const lines: string[] = [];
  for (let i = 0; i < notes.length; i += 2) {
    lines.push(`${Math.floor(i / 2) + 1}. ${notes[i]}${notes[i + 1] ? ' ' + notes[i + 1] : ''}`);
  }
  return lines.join('\n');
}
