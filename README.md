# King's Gambit — 3D 国际象棋 · 中国象棋 · 围棋

一个基于 Three.js 的 3D 三棋游戏：**国际象棋（Chess）**、**中国象棋（Xiangqi）**、**围棋（Go）**。
支持人机对战 / 双人对战 / Showcase 观战三种模式，包含完整 3D 棋子模型、特效系统、氛围场景与名局棋谱研究功能。

## 功能特性

- **三大棋种**：国际象棋（chess.js 驱动）、中国象棋（自研规则引擎）、围棋（自研规则引擎，9/13/19 路，支持劫争/自杀禁手/虚着/数子终局）
- **三种模式**：人机对战（AI 陪练）、双人对战、Showcase 自动观战
- **3D 表现**：
  - 中国象棋棋子独立中式造型（骑兵、战车、野战火炮，红黑阵营结构性差异）
  - 共享特效系统：吃子爆裂粒子、冲击环、尘土尾迹、炮吃子专属炮弹动效、相机震屏
  - 环境氛围场景与相机运镜
- **名局棋谱**（打谱研究 / 自动演示）：
  - 象棋 4 局古谱：《橘中秘》顺炮横车弃马局、顺炮直车对横车；《梅花谱》屏风马破当头炮；《自出洞来无敌手》信手炮
  - 围棋 2 局名局：吴清源 vs 本因坊秀哉 1933「三三·星·天元」、木谷实 vs 吴清源 1939 镰仓十番棋第一局
- **棋谱工具**：传统记谱导入/导出、打谱中自由落子记变着、分支切换、摆盘研究（象棋）
- **其他**：计时器（无限制/5/10/15 分钟）、合成音效、设置持久化（localStorage）

## 快速开始

```bash
npm install
npm run dev      # 开发服务器（默认 http://localhost:5173）
npm run build    # 生产构建（tsc -b && vite build）
```

## 技术栈

- Vite 5 + React 18 + TypeScript
- Three.js 0.166（OrbitControls、ACESFilmicToneMapping）
- chess.js（国际象棋引擎）；自研引擎：`xiangqi.ts`（象棋）、`go.ts`（围棋）

## 项目结构

```
src/
├── App.tsx                  # 顶层：菜单/游戏切换、HUD、设置持久化
├── game/
│   ├── Chess3D.ts           # 国际象棋 3D 游戏
│   ├── Xq3D.ts              # 中国象棋 3D 游戏
│   ├── Go3D.ts              # 围棋 3D 游戏
│   ├── xiangqi.ts / xqAi.ts # 象棋规则引擎 / AI
│   ├── go.ts / goAi.ts      # 围棋规则引擎 / AI
│   ├── famousGame.ts        # 象棋名局库与记谱解析
│   ├── goFamousGames.ts     # 围棋名局数据
│   ├── fx.ts                # 共享特效系统
│   └── pieceModels.ts / textures.ts / environment.ts / audio.ts
└── ui/
    ├── MainMenu.tsx         # 主菜单
    ├── Hud.tsx              # 游戏 HUD
    ├── ScriptPanel.tsx      # 棋谱浏览器
    └── Modals.tsx           # 弹窗（结算/设置/导入/导出）
```

## 玩法说明

- **操作**：拖拽旋转视角 · 滚轮缩放 · 点击棋子选择，再点击目标格走子
- **名局棋谱**：主菜单选择棋种 → 「名局棋谱」区 → 打谱（逐步研究）或自动演示（视频式回放）
- **棋谱浏览器**：点击着法跳转、⏮ ◀ ▶ ▶| ⏭ 控制、分支可切换、可导入传统记谱文本、可导出当前路径

## License

[MIT](LICENSE) © 2026 Starmadebydata
