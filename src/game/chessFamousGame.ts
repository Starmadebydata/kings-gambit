/**
 * Chess famous-game / study script support: variation tree + PGN/FEN import & export.
 * Mirrors famousGame.ts (xiangqi) — nodes[0] is the root, a move leads into its node.
 * Moves are stored as from/to/promotion (position-based, no SAN ambiguity) with a SAN note.
 */
import { Chess, type Square } from 'chess.js';

export interface ChessScriptMove {
  from: Square;
  to: Square;
  promotion?: string;
  note: string; // SAN
}

export interface ChessFamousGame {
  id: string;
  title: string;
  source: string;
  desc: string;
  result: string; // '1-0' | '0-1' | '1/2-1/2'
  moves: string[]; // SAN sequence from the initial position
}

export interface ChessScriptNode {
  move: ChessScriptMove | null; // null for the root node
  parent: number;
  children: number[];
}

export interface ChessScriptTree {
  title: string;
  source: string;
  desc: string;
  result: string;
  custom: boolean; // imported or FEN-based script
  rootFen?: string; // non-standard starting position (FEN import)
  nodes: ChessScriptNode[];
}

/** Convert a linear famous game (SAN list) into a variation tree (main line only). */
export function chessTreeFromGame(g: ChessFamousGame): ChessScriptTree {
  const nodes: ChessScriptNode[] = [{ move: null, parent: -1, children: [] }];
  let cur = 0;
  const c = new Chess();
  for (const san of g.moves) {
    const mv = c.move(san);
    if (!mv) throw new Error(`illegal SAN in game data: ${san}`);
    const idx = nodes.length;
    nodes.push({
      move: { from: mv.from, to: mv.to, promotion: mv.promotion, note: mv.san },
      parent: cur,
      children: []
    });
    nodes[cur].children.push(idx);
    cur = idx;
  }
  return { title: g.title, source: g.source, desc: g.desc, result: g.result, custom: false, nodes };
}

/** A fresh empty tree (used by FEN-import study: start from a custom position). */
export function emptyChessTree(title: string, source: string, rootFen?: string): ChessScriptTree {
  return { title, source, desc: '', result: '', custom: true, rootFen, nodes: [{ move: null, parent: -1, children: [] }] };
}

/** Follow children[0] from the root to the end of the main line; returns node-index path. */
export function chessMainline(tree: ChessScriptTree): number[] {
  const path = [0];
  let cur = 0;
  while (tree.nodes[cur].children.length > 0) {
    cur = tree.nodes[cur].children[0];
    path.push(cur);
  }
  return path;
}

function looksLikeFen(text: string): boolean {
  const parts = text.trim().split(/\s+/);
  return parts.length >= 4 && parts[0].includes('/');
}

/**
 * Import PGN text (standard PGN with headers, bare "1. e4 e5" move lists, or a FEN
 * starting position) as a new study tree. PGN variations are ignored (main line only).
 */
export function parsePgnText(text: string): { tree: ChessScriptTree | null; error: string | null } {
  const src = text.trim();
  if (!src) return { tree: null, error: '没有可解析的内容' };

  // FEN starting position?
  if (looksLikeFen(src)) {
    try {
      new Chess(src);
    } catch {
      return { tree: null, error: 'FEN 无效：请检查棋子排布、行棋方、易位权等字段' };
    }
    return {
      tree: emptyChessTree('FEN 局面研究', '玩家导入', src),
      error: null
    };
  }

  // PGN (or bare SAN list)
  const c = new Chess();
  try {
    c.loadPgn(src);
  } catch (e) {
    return { tree: null, error: `PGN 解析失败：${(e as Error).message.slice(0, 120)}` };
  }
  const hist = c.history({ verbose: true });
  if (hist.length === 0) return { tree: null, error: 'PGN 中没有着法' };

  const nodes: ChessScriptNode[] = [{ move: null, parent: -1, children: [] }];
  let cur = 0;
  const cc = new Chess();
  for (const h of hist) {
    const mv = cc.move({ from: h.from, to: h.to, promotion: h.promotion });
    if (!mv) break;
    const idx = nodes.length;
    nodes.push({ move: { from: mv.from, to: mv.to, promotion: mv.promotion, note: mv.san }, parent: cur, children: [] });
    nodes[cur].children.push(idx);
    cur = idx;
  }
  const hdrs = c.getHeaders();
  const title = hdrs['Event'] || '自定义棋谱';
  return {
    tree: {
      title,
      source: hdrs['Site'] ? `${hdrs['Site']}${hdrs['Date'] ? ' · ' + hdrs['Date'] : ''}` : '玩家导入',
      desc: `共 ${hist.length} 着，解析成功`,
      result: hdrs['Result'] || '',
      custom: true,
      nodes
    },
    error: null
  };
}

/** Format a path of tree node indices as standard PGN text (headers + move list). */
export function exportPgnText(tree: ChessScriptTree, path: number[]): string {
  const c = tree.rootFen ? new Chess(tree.rootFen) : new Chess();
  c.header('Event', tree.title);
  if (tree.source) c.header('Source', tree.source);
  c.header('Result', tree.result || '*');
  for (let j = 1; j < path.length; j++) {
    const m = tree.nodes[path[j]].move;
    if (!m) break;
    try {
      const mv = c.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (!mv) break;
    } catch {
      break;
    }
  }
  return c.pgn();
}
