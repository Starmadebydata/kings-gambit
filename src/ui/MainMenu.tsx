import { GameConfig, GameKind, Level, Mode } from '../game/types';
import type { FamousGame } from '../game/famousGame';
import type { GoFamousGame } from '../game/goFamousGames';
import { IconCpu, IconUsers, IconEye, IconGear, IconCrown, IconHourglass, IconPlay, IconBook } from './Icons';

const MODES: { id: Mode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'computer', label: 'Computer', icon: <IconCpu size={14} />, desc: 'Face the war-council of Obsidian. You command the Ivory host — the engine answers.' },
  { id: 'local', label: '2 Players', icon: <IconUsers size={14} />, desc: 'Two commanders, one board. The camera swings to the player on move — you can disable that in settings.' },
  { id: 'showcase', label: 'Showcase', icon: <IconEye size={14} />, desc: 'Lean back. Both armies fight on their own while the camera circles the field.' }
];

const CLOCKS = [0, 5, 10, 15];

const LEVELS: { id: Level; label: string }[] = [
  { id: 1, label: 'Easy' },
  { id: 2, label: 'Medium' },
  { id: 3, label: 'Hard' },
];

export function MainMenu(props: {
  config: GameConfig;
  kind: GameKind;
  onConfig: (c: GameConfig) => void;
  onKind: (k: GameKind) => void;
  onStart: () => void;
  games?: FamousGame[];
  goGames?: GoFamousGame[];
  onReplay?: (game: FamousGame | GoFamousGame, autoplay: boolean) => void;
  onImportScript?: () => void;
  onSetupStudy?: () => void;
  onSettings: () => void;
}) {
  const { config, onConfig, kind, onKind, games, goGames } = props;
  return (
    <div className="menu-wrap">
      <h1 className="title"><IconCrown size={30} /> King's Gambit</h1>
      <p className="tagline">{kind === 'chess' ? 'Chess is a battlefield — command it.' : kind === 'xiangqi' ? '楚河漢界 · 兩軍對壘 — the river divides two kingdoms.' : '纵横十九道 · 方寸天地间 — the board is a universe.'}</p>
      <div className="menu-panel">
        <div className="tabs kind">
          <button className={'tab' + (kind === 'chess' ? ' active' : '')} onClick={() => onKind('chess')}>
            <span>♞ Chess</span>
          </button>
          <button className={'tab' + (kind === 'xiangqi' ? ' active' : '')} onClick={() => onKind('xiangqi')}>
            <span className="kai">傌 中国象棋</span>
          </button>
          <button className={'tab' + (kind === 'go' ? ' active' : '')} onClick={() => onKind('go')}>
            <span className="kai">⚫ 围棋 Go</span>
          </button>
        </div>
        <div className="tabs">
          {MODES.map(m => (
            <button key={m.id}
              className={'tab' + (config.mode === m.id ? ' active' : '')}
              onClick={() => onConfig({ ...config, mode: m.id })}>
              {m.icon}<span>{m.label}</span>
            </button>
          ))}
        </div>
        <p className="desc">{MODES.find(m => m.id === config.mode)!.desc}</p>
        {config.mode === 'computer' && (
          <>
            <div className="clock-label"><IconCpu size={12} /> AI Level</div>
            <div className="tabs small">
              {LEVELS.map(l => (
                <button key={l.id}
                  className={'tab' + ((config.level ?? 2) === l.id ? ' active' : '')}
                  onClick={() => onConfig({ ...config, level: l.id })}>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="clock-label"><IconHourglass size={12} /> Hourglass</div>
        <div className="tabs small">
          {CLOCKS.map(c => (
            <button key={c}
              className={'tab' + (config.minutes === c ? ' active' : '')}
              onClick={() => onConfig({ ...config, minutes: c })}>
              <span>{c === 0 ? 'None' : `${c} min`}</span>
            </button>
          ))}
        </div>
        {kind === 'go' && (
          <>
            <div className="clock-label">Board Size</div>
            <div className="tabs small go-size">
              {[9, 13, 19].map(s => (
                <button key={s}
                  className={'tab' + ((config.goSize ?? 19) === s ? ' active' : '')}
                  onClick={() => onConfig({ ...config, goSize: s })}>
                  <span>{s}×{s}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn-gold" onClick={props.onStart}>
          <IconCrown size={15} /> Take the Field
        </button>
        {kind === 'go' && goGames && goGames.length > 0 && props.onReplay && (
          <div className="menu-games">
            <div className="clock-label"><IconBook size={12} /> 名局棋谱</div>
            {goGames.map(g => (
              <div key={g.id} className="game-row">
                <div className="game-info">
                  <span className="game-title">{g.title}</span>
                  <span className="game-meta">{g.source} · {g.result} · {g.moves.length} 手</span>
                </div>
                <div className="game-actions">
                  <button className="mini-btn" title="逐步打谱" onClick={() => props.onReplay!(g, false)}>
                    <IconBook size={12} /> 打谱
                  </button>
                  <button className="mini-btn gold" title="自动演示整局" onClick={() => props.onReplay!(g, true)}>
                    <IconPlay size={12} /> 自动演示
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {kind === 'xiangqi' && games && games.length > 0 && props.onReplay && (
          <div className="menu-games">
            <div className="clock-label"><IconBook size={12} /> 名局棋谱</div>
            {games.map(g => (
              <div key={g.id} className="game-row">
                <div className="game-info">
                  <span className="game-title">{g.title}</span>
                  <span className="game-meta">{g.source} · {g.result} · {Math.ceil(g.moves.length / 2)} 回合</span>
                </div>
                <div className="game-actions">
                  <button className="mini-btn" title="逐步打谱" onClick={() => props.onReplay!(g, false)}>
                    <IconBook size={12} /> 打谱
                  </button>
                  <button className="mini-btn gold" title="自动演示整局" onClick={() => props.onReplay!(g, true)}>
                    <IconPlay size={12} /> 自动演示
                  </button>
                </div>
              </div>
            ))}
            <div className="game-row tools-row">
              <div className="game-info">
                <span className="game-title">棋谱工具</span>
                <span className="game-meta">导入文本棋谱 · 自由摆盘打谱</span>
              </div>
              <div className="game-actions">
                <button className="mini-btn" title="导入传统记谱文本（如：1. 炮二平五 馬8进7 …）" onClick={() => props.onImportScript?.()}>
                  <IconBook size={12} /> 导入棋谱
                </button>
                <button className="mini-btn gold" title="自由摆放棋子后开始打谱研究" onClick={() => props.onSetupStudy?.()}>
                  <IconCrown size={12} /> 摆盘研究
                </button>
              </div>
            </div>
          </div>
        )}
        <button className="btn-dark" onClick={props.onSettings}>
          <IconGear size={14} /> Settings
        </button>
      </div>
    </div>
  );
}
