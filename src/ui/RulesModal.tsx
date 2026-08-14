import { GameKind } from '../game/types';
import { IconClose, IconBook } from './Icons';

interface RulesSection { h: string; items: string[] }
interface RulesDoc { title: string; tagline: string; sections: RulesSection[] }

/** 六棋玩法说明 —— 进入对局时首次展示，亦可经 HUD 的书卷按钮随时查阅。 */
export const RULES: Record<GameKind, RulesDoc> = {
  chess: {
    title: 'Chess · 国际象棋',
    tagline: '将杀敌王者胜 — the host that traps the king takes the field.',
    sections: [
      {
        h: '目标 · Objective',
        items: [
          'Ivory 与 Obsidian 两军轮流走子，白方先行。',
          '将杀（Checkmate）敌王即胜：王被攻击且无处可逃、无子可救。',
          '逼和（无子可动但未被将军）、子力不足、三次重复局面等为和棋。',
        ],
      },
      {
        h: '棋子走法 · The Pieces',
        items: [
          '兵 Pawn：直进一格（首着可进两格），斜进一格吃子；吃过路兵、到底升变。',
          '马 Knight：走 L 形（日字），唯一可越子的棋子。',
          '象 Bishop：斜线任意距离；车 Rook：直线任意距离。',
          '后 Queen：直线 + 斜线任意距离，全军最强。',
          '王 King：八方各一格，不可送吃。',
        ],
      },
      {
        h: '特殊着法 · Special Moves',
        items: [
          '王车易位 Castling：王向车移两格、车越王而立；须王车未动、中途不受攻。',
          '升变 Promotion：兵抵底线即刻升为后（或其他棋子）。',
          '吃过路兵 En passant：敌兵首着冲两格掠过你的兵时，可立即斜吃之。',
        ],
      },
      {
        h: '操作 · Controls',
        items: [
          '点选己方棋子，绿色光点为可走格；点目标格行军，点敌子攻杀。',
          '工具栏：Undo 悔棋 · Resign 认输 · New battle 重开。',
          '拖拽旋转视角，滚轮缩放；右上角 Spoils 记录双方俘获。',
        ],
      },
    ],
  },
  xiangqi: {
    title: 'Xiangqi · 中国象棋',
    tagline: '楚河汉界，将帅不得照面 — cross the river, break the palace.',
    sections: [
      {
        h: '目标 · Objective',
        items: [
          '红先黑后，轮流走子。',
          '将死或困毙（无子可走）对方即胜。',
          '双方将帅不可在同一条直线上直接照面（飞将）。',
        ],
      },
      {
        h: '棋子走法 · The Pieces',
        items: [
          '帅/将：九宫内直行一格；仕/士：九宫内斜行一格。',
          '相/象：走田字，不能过河，田心被占则塞象眼。',
          '傌/馬：走日字，蹩马腿则不能跳。',
          '俥/車：直线任意距离，力最强。',
          '砲/炮：行如车，吃子须隔一子（炮架）跳吃。',
          '俥/卒：过河前直进一格，过河后可横移。',
        ],
      },
      {
        h: '棋盘要隘 · The Board',
        items: [
          '河界：兵卒过河方能横行；相象永不过河。',
          '九宫：将帅仕士不出九宫。',
          '炮打隔山、马踩八方，善用者得势。',
        ],
      },
      {
        h: '操作 · Controls',
        items: [
          '点选棋子后点目标格走子；绿色光点为合法着。',
          '主菜单「摆盘研究」可自由摆局打谱；工具栏可悔棋、认输、重开。',
        ],
      },
    ],
  },
  go: {
    title: 'Go · 围棋',
    tagline: '围空夺地，气尽子亡 — surround the land, seize the liberties.',
    sections: [
      {
        h: '目标 · Objective',
        items: [
          '黑先白后，交替落子于交叉点，子落不移。',
          '终局数地：盘面活子 + 所围空点，多者胜。',
          '中国规则数子法，白方贴 7.5 目（无和棋）。',
        ],
      },
      {
        h: '气与提子 · Liberties & Capture',
        items: [
          '棋子相邻的空点为其「气」；相连的同色子共享气。',
          '一块棋的气全部被堵即被提走，移出棋盘。',
          '禁自杀手：落子后自身无气且不能提敌者不可下。',
          '打劫：提一子后对方不得立即回提同形，须先在他处落子。',
        ],
      },
      {
        h: '终局 · Ending the Game',
        items: [
          '双方连续 Pass（虚着）即终局。',
          '死活两清：终局时无法做两眼的棋为死棋，计入对方地域。',
        ],
      },
      {
        h: '操作 · Controls',
        items: [
          '点击交叉点落子；绿色光点为可落处。',
          '工具栏 PASS 按钮虚着；Undo 悔棋。',
        ],
      },
    ],
  },
  shogi: {
    title: 'Shogi · 将棋',
    tagline: '夺敌之驹，反戈相向 — captured blades return to your hand.',
    sections: [
      {
        h: '目标 · Objective',
        items: [
          '先手后手交替走子，将杀对方玉将即胜。',
          '最大特色：俘获的敌子收入己方驹台，可再投回战场。',
        ],
      },
      {
        h: '棋子走法 · The Pieces',
        items: [
          '玉/王：八方一格。飞车：直线任意；角行：斜线任意。',
          '金将：直行三向 + 前两斜（六方）；银将：前五向。',
          '桂马：前向 L 形跳，可越子；香车：直前任意距离。',
          '步兵：直前一格。',
        ],
      },
      {
        h: '成驹 · Promotion',
        items: [
          '进入、移动于或离开敌阵（远端三行）时可翻面成驹。',
          '飞车成「龙」加斜走，角行成「马」加直走；其余成驹后走如金将。',
          '步兵、香车到底线、桂马到末两行必须成驹。',
        ],
      },
      {
        h: '打驹 · Drops',
        items: [
          '一回合可不移子，改将驹台敌子投于空点（投步兵等限制除外）。',
          '二步：同一条纵线不可有两个未成步兵。',
          '投出的子须有合法后续着法；不得投步直接将杀。',
        ],
      },
      {
        h: '操作 · Controls',
        items: [
          '点选棋子或驹台俘子，再点目标格走子/打驹。',
          '工具栏可悔棋、认输、重开；Spoils 面板即驹台。',
        ],
      },
    ],
  },
  checkers: {
    title: 'Checkers · 西洋跳棋',
    tagline: '连跳破阵，到底封王 — jump the line, crown the king.',
    sections: [
      {
        h: '目标 · Objective',
        items: [
          '黑先白后（深色格行棋），吃光敌子或令其无子可动即胜。',
        ],
      },
      {
        h: '走子与吃子 · Moves & Jumps',
        items: [
          '兵只可斜前进一格。',
          '跳吃：跃过相邻敌子落于其后空点，将其俘获；可连跳则连跳。',
          '强制吃子：有跳吃时必须跳吃。',
        ],
      },
      {
        h: '王棋 · Kings',
        items: [
          '兵抵对方底线即升为王，加冕金冠。',
          '王可斜前斜后行走与跳吃。',
        ],
      },
      {
        h: '操作 · Controls',
        items: [
          '点选棋子，绿色光点为可走/可跳格；连跳自动续行。',
          '工具栏可悔棋、认输、重开。',
        ],
      },
    ],
  },
  reversi: {
    title: 'Reversi · 黑白棋',
    tagline: '夹线翻覆，角落定乾坤 — every line turns the tide.',
    sections: [
      {
        h: '目标 · Objective',
        items: [
          '黑先白后，终局时子多者胜；子数相同为和。',
          '盘满或双方连续无子可落即终局数子。',
        ],
      },
      {
        h: '落子与翻面 · Placing & Flipping',
        items: [
          '落子须夹线：在横线、竖线或斜线上，以己方子夹住一段连续敌子。',
          '被夹住的敌子全部翻面变为己方颜色，可八向同时翻。',
          '无合法落点的一方自动 Pass；双方连续 Pass 即终局。',
        ],
      },
      {
        h: '战略要诀 · Strategy',
        items: [
          '角最珍贵：角子永不能被翻。',
          '慎下角邻格（X 格与 C 格），常把角拱手让人。',
          '开局莫贪子：子少者机动性反而占优。',
        ],
      },
      {
        h: '操作 · Controls',
        items: [
          '绿色光点为合法落点，点击即落子并翻面。',
          'Spoils 面板实时显示双方子数与领先；工具栏可悔棋、重开。',
        ],
      },
    ],
  },
};

export function RulesModal(props: { kind: GameKind; onClose: () => void }) {
  const doc = RULES[props.kind];
  return (
    <div className="modal-back">
      <div className="modal panel rules-modal">
        <div className="modal-head">
          <span className="rules-head-title"><IconBook size={14} /> How to Play · {doc.title}</span>
          <button className="tool" onClick={props.onClose}><IconClose /></button>
        </div>
        <div className="rules-tagline">{doc.tagline}</div>
        <div className="rules-body">
          {doc.sections.map(s => (
            <div className="rules-section" key={s.h}>
              <h4>{s.h}</h4>
              <ul>{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
        <button className="btn-gold" onClick={props.onClose}>To Battle</button>
      </div>
    </div>
  );
}
