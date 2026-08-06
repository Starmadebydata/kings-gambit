// 围棋启发式 AI：不依赖搜索树，按落子价值评分选取。
// 价值来源：提子、打吃（紧对方最后一气）、自保（气多）、位置（角/边/天元）。
import { GoGame } from './go';

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

  // 位置价值：星位/角/边优先（前几手有方向感）
  const d = Math.min(r, n - 1 - r, f, n - 1 - f); // 到边距离
  if (d === 0) s += 1.2; // 一线
  if (d <= 2) s += 1.6; // 三四线
  // 星位附近微加成（17/19 路经典布局点位）
  if (d === 2 || d === 3) s += 0.4;

  // 随机扰动：让 AI 不那么死板，也避免永同局
  s *= 0.85 + Math.random() * 0.3;
  return s;
}

/**
 * 选最佳落点；无可下之着返回 null（应虚着）。
 * 快结束时（可落点 < 8 或棋盘使用率 > 88%）倾向虚着收束。
 */
export function findBestMove(g: GoGame): [number, number] | null {
  const n = g.n;
  let occupied = 0;
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (let r = 0; r < n; r++) for (let f = 0; f < n; f++) {
    if (g.board[r][f]) { occupied++; continue; }
    const s = scoreMove(g, r, f);
    if (s > bestScore) { bestScore = s; best = [r, f]; }
  }
  const empties = n * n - occupied;
  if (best === null) return null;
  // 无吸引力的着（全是低价值随机）且棋盘接近尾声 → 虚着
  if (bestScore < 2.2 && (empties < 10 || occupied > n * n * 0.86)) return null;
  return best;
}
