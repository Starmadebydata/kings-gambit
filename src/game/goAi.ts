// 围棋 AI：启发式候选 + 蒙特卡洛 rollout 评估。
// - Easy：纯启发式评分 + 重随机（轻量、秒回）
// - Medium：启发式 top-8 候选 × 每候选 40 次 rollout（棋盘自适应深度）
// - Hard：启发式 top-12 候选 × 每候选 110 次 rollout + 2.5s 时间盒
import { GoGame } from './go';
import type { Level } from './types';

/** 计算落子 (r,f) 的启发式评分。分数越高越优。 */
function scoreMove(g: GoGame, r: number, f: number): number {
  const side = g.turn;
  const opp = side === 'b' ? 'w' : 'b';
  const n = g.n;
  let s = 0;

  // 模拟落子后评估提子/打吃
  const board = g.board;
  const groupInfo = (rr: number, ff: number): { cells: [number, number][]; libs: Set<string> } => {
    const color = board[rr][ff];
    const cells: [number, number][] = [];
    const libs = new Set<string>();
    const seen = new Set<string>([`${rr},${ff}`]);
    const stack: [number, number][] = [[rr, ff]];
    while (stack.length) {
      const [cr, cf] = stack.pop()!;
      cells.push([cr, cf]);
      for (const [dr, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = cr + dr, nf = cf + df;
        if (nr < 0 || nr >= n || nf < 0 || nf >= n) continue;
        const p = board[nr][nf];
        if (p === null) libs.add(`${nr},${nf}`);
        else if (p === color && !seen.has(`${nr},${nf}`)) {
          seen.add(`${nr},${nf}`);
          stack.push([nr, nf]);
        }
      }
    }
    return { cells, libs };
  };

  board[r][f] = side;
  // 提子收益
  let captured = 0;
  const atari: { size: number }[] = [];
  for (const [dr, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nr = r + dr, nf = f + df;
    if (nr < 0 || nr >= n || nf < 0 || nf >= n) continue;
    const p = board[nr][nf];
    if (p === opp) {
      const gi = groupInfo(nr, nf);
      if (gi.libs.size === 0) captured += gi.cells.length;
      else if (gi.libs.size === 1) atari.push({ size: gi.cells.length });
    }
  }
  s += captured * 14; // 提子：大头
  s += atari.reduce((a, b) => a + 3 + Math.min(b.size, 5) * 0.8, 0); // 打吃

  // 己方连通块气多 → 安全；气少 → 补气
  const mine = groupInfo(r, f);
  s += Math.min(mine.libs.size, 4) * 1.2;
  if (mine.libs.size === 1) s -= 1; // 落子即陷入被打吃，略扣
  board[r][f] = null;

  // 位置价值：角/边优先，三四线为黄金线
  const d = Math.min(r, n - 1 - r, f, n - 1 - f); // 到边距离
  if (d === 0) s += 1.2; // 一线
  if (d <= 2) s += 1.6; // 三四线
  if (d === 2 || d === 3) s += 0.4; // 星位附近微加成

  // 随机扰动：让 AI 不那么死板，也避免永同局
  s *= 0.85 + Math.random() * 0.3;
  return s;
}

/**
 * 蒙特卡洛 rollout：从当前局面随机对弈 depth 手后按数子法评估。
 * 返回黑方得分差（black - white，正值 = 黑方占优）。
 * 模拟的着法全部自行回退，不改变外部局面。
 */
function rollout(g: GoGame, depth: number): number {
  const n = g.n;
  let moves = 0;
  for (let i = 0; i < depth; i++) {
    if (g.isOver()) break; // 双方连续虚着，模拟提前结束
    const empties: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let f = 0; f < n; f++) if (!g.board[r][f]) empties.push([r, f]);
    if (!empties.length) { g.pass(); moves++; continue; }
    let played = false;
    const tries = Math.min(10, empties.length);
    for (let t = 0; t < tries; t++) {
      const [r, f] = empties[Math.floor(Math.random() * empties.length)];
      if (g.play(r, f).ok) { played = true; break; }
    }
    if (!played) g.pass();
    moves++;
  }
  const { black, white } = g.score();
  for (let i = 0; i < moves; i++) g.undo();
  return black - white;
}

export interface GoAiOptions {
  level: Level;
  jitter?: number;
}

/**
 * 选最佳落点；无可下之着返回 null（应虚着）。
 * 快结束时（可落点 < 10 或棋盘使用率 > 86%）且启发分全低 → 虚着收束。
 */
export function findBestMove(g: GoGame, opts: GoAiOptions): [number, number] | null {
  const n = g.n;
  const level = opts.level ?? 2;
  const jitter = opts.jitter ?? 0;

  let occupied = 0;
  for (let r = 0; r < n; r++) for (let f = 0; f < n; f++) if (g.board[r][f]) occupied++;
  const emptiesCount = n * n - occupied;

  // ---- 候选收集（启发式打分；排除已有子/自杀禁手） ----
  const cands: { pos: [number, number]; s: number; winRate?: number }[] = [];
  for (let r = 0; r < n; r++) for (let f = 0; f < n; f++) {
    if (g.board[r][f] || g.legalAt(r, f) !== null) continue;
    cands.push({ pos: [r, f], s: scoreMove(g, r, f) });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.s - a.s);

  // 尾声且无吸引力着法 → 虚着
  if (cands[0].s < 2.2 && (emptiesCount < 10 || occupied > n * n * 0.86)) return null;

  // 最终选择前验证可落子（劫争等动态禁止项），不可行则顺延
  const pick = (list: { pos: [number, number] }[]): [number, number] | null => {
    for (const c of list) {
      const r = g.play(c.pos[0], c.pos[1]);
      if (r.ok) { g.undo(); return c.pos; }
    }
    return null;
  };

  // ---- Easy：纯启发式 + 重随机（top-3 抽签） ----
  if (level <= 1) {
    const top = cands.slice(0, Math.min(3, cands.length)).sort(() => Math.random() - 0.5);
    return pick(top) ?? pick(cands) ?? null;
  }

  // ---- Medium / Hard：蒙特卡洛 rollout ----
  const isBlack = g.turn === 'b';
  const k = level === 2 ? 8 : 12;
  const sims = level === 2 ? 40 : 110;
  const depth = n <= 9 ? 16 : n <= 13 ? 12 : 8; // 棋盘越小模拟手数越多
  const deadline = performance.now() + (level === 2 ? 1500 : 2500);

  const top = cands.slice(0, Math.min(k, cands.length));
  for (const c of top) {
    let wins = 0;
    let done = 0;
    for (let i = 0; i < sims; i++) {
      const r = g.play(c.pos[0], c.pos[1]);
      if (!r.ok) { wins = 0; break; } // 劫争/自杀禁手：该候选不可行
      const diff = rollout(g, depth);
      g.undo();
      // 我方黑 → diff>0 好；我方白 → diff<0 好
      if ((isBlack && diff > 0) || (!isBlack && diff < 0)) wins++;
      done++;
      if ((done & 15) === 0 && performance.now() > deadline) break; // 时间盒
    }
    c.winRate = done ? wins / done : 0.5;
  }

  top.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
  if (jitter > 0) {
    // 观战多样性：top-3 抽签
    const top3 = top.slice(0, Math.min(3, top.length)).sort(() => Math.random() - 0.5);
    return pick(top3) ?? pick(top);
  }
  return pick(top);
}
