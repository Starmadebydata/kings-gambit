// 围棋名局棋谱：变着树结构与记谱工具（与象棋 famousGame.ts 对称）。
// 数据源：goFamousGames.ts（SGF 经 GoGame 引擎逐手验证）；树节点下标 path 语义与象棋一致。
import type { Side } from './types';
import type { GoFamousGame } from './goFamousGames';
import { GoGame } from './go';

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
  size?: number; // 棋盘路数（SGF 导入可为 9/13/19，缺省 19）
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

/** 解析 SGF 节点：位于 src[i]（';' 之后，或紧凑格式的直接 B/W 处）。
 * 紧凑格式（B[..]W[..] 间无分号）会在遇到第二个 B/W 属性时结束本节点。 */
function parseSgfNode(
  src: string,
  i: number
): { color: 'b' | 'w'; coords: string; next: number } | null {
  let j = i;
  let color: 'b' | 'w' | null = null;
  let coords = '';
  while (j < src.length && src[j] !== ';' && src[j] !== '(' && src[j] !== ')') {
    let k = j;
    while (k < src.length && /[A-Za-z]/.test(src[k])) k++;
    if (k === j) break; // 非法字符
    const name = src.slice(j, k);
    if ((name === 'B' || name === 'W') && color !== null) break; // 紧凑格式：新节点开始
    while (k < src.length && src[k] === '[') {
      const close = src.indexOf(']', k + 1);
      if (close < 0) return null;
      const val = src.slice(k + 1, close);
      if (name === 'B' || name === 'W') { color = name.toLowerCase() as 'b' | 'w'; coords = val; }
      k = close + 1;
    }
    j = k;
  }
  if (!color) return null; // 无落子属性的节点（如 N[] / C[]）
  return { color, coords, next: j };
}

/**
 * 导入标准 SGF 文本为围棋打谱树（仅解析主线，忽略分支与注释）。
 * 支持 9/13/19 路（SZ 字段，缺省 19），落子坐标经 GoGame 引擎逐手验证。
 */
export function parseSgfText(text: string): { tree: GoScriptTree | null; error: string | null } {
  const src = text.trim();
  if (!src) return { tree: null, error: '没有可解析的内容' };
  if (!src.startsWith('(') || !src.includes(';')) {
    return { tree: null, error: 'SGF 格式无效：请粘贴以“(;”开头的标准 SGF 文本' };
  }

  // 棋盘大小
  const szm = src.match(/\bSZ\[(\d+)\]/);
  const size = szm ? parseInt(szm[1], 10) : 19;
  if (size !== 9 && size !== 13 && size !== 19) {
    return { tree: null, error: `不支持 ${size} 路棋盘（仅支持 9/13/19 路）` };
  }

  // 主线扫描：根集合内（深度 1）收集着法；某节点后的第一个分支视为主线延续，其余分支跳过
  const plies: { color: 'b' | 'w'; r: number; f: number }[] = [];
  let depth = 0;
  let inMain = true;
  let skipDepth = -1;
  const branchSeen: number[] = [0]; // 每层已出现的 '(' 数（第一个分支 = 主线）
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '(') {
      if (!(inMain && (branchSeen[depth] ?? 0) === 0)) { inMain = false; skipDepth = depth; }
      branchSeen[depth] = (branchSeen[depth] ?? 0) + 1;
      depth++;
      i++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      if (!inMain && depth <= skipDepth) inMain = true;
      i++;
      continue;
    }
    if (ch === ';' && inMain && depth >= 1) {
      const n = parseSgfNode(src, i + 1);
      i = n ? n.next : i + 1;
      if (!n) continue;
      const c = n.coords.toLowerCase();
      if (!c) { plies.push({ color: n.color, r: -1, f: -1 }); continue; } // 虚着 B[] / W[]
      if (c.length !== 2) continue;
      const f = c.charCodeAt(0) - 97;
      const r = c.charCodeAt(1) - 97;
      if (r < 0 || r >= size || f < 0 || f >= size) {
        return { tree: null, error: `第 ${plies.length + 1} 手落点越界：${n.coords}` };
      }
      plies.push({ color: n.color, r, f });
      continue;
    }
    // 紧凑格式：无分号的直接 B[..] / W[..]
    if (depth >= 1 && inMain && (ch === 'B' || ch === 'W') && src[i + 1] === '[') {
      const n = parseSgfNode(src, i);
      i = n ? n.next : i + 1;
      if (!n) continue;
      const c = n.coords.toLowerCase();
      if (!c) { plies.push({ color: n.color, r: -1, f: -1 }); continue; }
      if (c.length !== 2) continue;
      const f = c.charCodeAt(0) - 97;
      const r = c.charCodeAt(1) - 97;
      if (r < 0 || r >= size || f < 0 || f >= size) {
        return { tree: null, error: `第 ${plies.length + 1} 手落点越界：${n.coords}` };
      }
      plies.push({ color: n.color, r, f });
      continue;
    }
    i++;
  }
  if (plies.length === 0) return { tree: null, error: 'SGF 中没有着法' };

  // 引擎逐手验证（含行棋方交替、打劫/自杀等规则）
  const g = new GoGame(size);
  const nodes: GoScriptNode[] = [{ move: null, parent: -1, children: [] }];
  let cur = 0;
  let expect: 'b' | 'w' = 'b';
  for (let p = 0; p < plies.length; p++) {
    const mv = plies[p];
    if (mv.color !== expect) {
      return { tree: null, error: `第 ${p + 1} 手：行棋方与轮次不符（应为${expect === 'b' ? '黑' : '白'}）` };
    }
    if (mv.r < 0) g.pass();
    else {
      const res = g.play(mv.r, mv.f);
      if (!res.ok) {
        return { tree: null, error: `第 ${p + 1} 手 ${goNote(mv.r, mv.f, mv.color)} 非法：${res.error}` };
      }
    }
    const idx = nodes.length;
    nodes.push({ move: { r: mv.r, f: mv.f, pass: mv.r < 0, note: goNote(mv.r, mv.f, mv.color) }, parent: cur, children: [] });
    nodes[cur].children.push(idx);
    cur = idx;
    expect = expect === 'b' ? 'w' : 'b';
  }

  const h = (k: string) => { const m = src.match(new RegExp(`\\b${k}\\[([^\\]]*)\\]`)); return m ? m[1].trim() : ''; };
  const ev = h('EV'), dt = h('DT'), so = h('SO'), re = h('RE'), pb = h('PB'), pw = h('PW');
  const source = [so, dt].filter(Boolean).join(' · ') || '玩家导入';
  return {
    tree: {
      title: ev || '自定义棋谱',
      source,
      desc: `共 ${plies.length} 手，解析成功（${size} 路）`,
      result: re,
      black: pb || '黑方',
      white: pw || '白方',
      custom: true,
      size,
      nodes
    },
    error: null
  };
}
