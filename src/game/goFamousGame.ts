// 围棋名局棋谱：变着树结构与记谱工具（与象棋 famousGame.ts 对称）。
// 数据源：goFamousGames.ts（SGF 经 GoGame 引擎逐手验证）；树节点下标 path 语义与象棋一致。
import type { Side } from './types';
import type { GoFamousGame } from './goFamousGames';

export interface GoScriptMove {
  r: number; // 落点行（-1 = 虚着）
  f: number;
  pass: boolean;
  note: string; // 记谱："黑 q3" / "白 c4" / "黑虚着"
}

export interface GoScriptNode {
  move: GoScriptMove | null; // null = 根节点
  parent: number;
  children: number[];
}

export interface GoScriptTree {
  title: string;
  source: string;
  desc: string;
  result: string;
  black: string;
  white: string;
  custom: boolean; // 导入/自定义打谱（当前围棋仅名局，恒为 false）
  nodes: GoScriptNode[];
}

/** 围棋横坐标显示字母（跳过 I，与国际惯例 A-T 一致）。 */
const FILES = 'abcdefghjklmnopqrstuvwxyz';

/** 一手棋的记谱："黑 q3"（列字母 + 行号，跳过 I）。 */
export function goNote(r: number, f: number, side: Side): string {
  if (r < 0 || f < 0) return side === 'b' ? '黑虚着' : '白虚着';
  return `${side === 'b' ? '黑' : '白'} ${FILES[f]}${r + 1}`;
}

/** 线性名局 → 变着树（仅主线）。黑先，第 i 手 (i%2==0) 为黑。 */
export function goTreeFromGame(g: GoFamousGame): GoScriptTree {
  const nodes: GoScriptNode[] = [{ move: null, parent: -1, children: [] }];
  let cur = 0;
  for (let i = 0; i < g.moves.length; i++) {
    const [r, f] = g.moves[i];
    const side: Side = i % 2 === 0 ? 'b' : 'w';
    const pass = r < 0 || f < 0;
    const idx = nodes.length;
    nodes.push({ move: { r, f, pass, note: goNote(r, f, side) }, parent: cur, children: [] });
    nodes[cur].children.push(idx);
    cur = idx;
  }
  return { title: g.title, source: g.source, desc: g.desc, result: g.result, black: g.black, white: g.white, custom: false, nodes };
}

/** 沿 children[0] 从根走到主线末端，返回节点下标路径。 */
export function goMainline(tree: GoScriptTree): number[] {
  const path = [0];
  let cur = 0;
  while (tree.nodes[cur].children.length > 0) {
    cur = tree.nodes[cur].children[0];
    path.push(cur);
  }
  return path;
}

/** 导出当前打谱路径为围棋记谱文本：每行 "1. 黑 q3  白 c4"。 */
export function goExportText(tree: GoScriptTree, path: number[]): string {
  const notes = path.slice(1).map(n => tree.nodes[n].move?.note ?? '?');
  const lines: string[] = [];
  for (let i = 0; i < notes.length; i += 2) {
    lines.push(`${Math.floor(i / 2) + 1}. ${notes[i]}${notes[i + 1] ? '  ' + notes[i + 1] : ''}`);
  }
  return lines.join('\n');
}
