import { HudState, Settings, PIECE_GLYPH } from '../game/types';
import { shieldDataUrl } from '../game/textures';
import { ScriptPanel } from './ScriptPanel';
import {
  IconUndo, IconFlag, IconSwords, IconSound, IconMute, IconExpand,
  IconFlip, IconGrid, IconGear, IconBook, IconHome
} from './Icons';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Hud(props: {
  hud: HudState;
  settings: Settings;
  onUndo: () => void;
  onResign: () => void;
  onNewGame: () => void;
  onPass?: () => void;
  onFlip: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
  onToggleSound: () => void;
  onToggleCoords: () => void;
  onScriptToggle?: () => void;
  onScriptStep?: (dir: number) => void;
  onScriptGoto?: (i: number) => void;
  onScriptExit?: () => void;
  onScriptBranch?: (ply: number) => void;
  onScriptImport?: () => void;
  onScriptExport?: () => void;
  onSetupDelete?: () => void;
  onSetupClear?: () => void;
  onSetupReset?: () => void;
  onSetupStudy?: () => void;
  onSetupExit?: () => void;
  onRules?: () => void;
  onHome?: () => void;
}) {
  const { hud, settings } = props;
  const scriptMode = !!hud.scriptInfo;
  const diffInt = Math.round(hud.diff);
  const status = hud.diff === 0 ? 'Even' : hud.diff > 0 ? `${hud.names.w} +${diffInt}` : `${hud.names.b} +${-diffInt}`;
  return (
    <>
      {/* turn indicator */}
      <div className="panel turn-panel">
        <img src={shieldDataUrl(hud.turn)} alt="" className="shield" />
        <div>
          <div className="tiny">To move</div>
          <div className={'side-name ' + (hud.turn === 'w' ? 'ivory' : 'obsidian')}>
            {hud.names[hud.turn]}{hud.check ? ' · Check!' : ''}
          </div>
        </div>
        {hud.clockW !== null && (
          <div className="clocks">
            <div className={'clock' + (hud.turn === 'w' ? ' on' : '')}>{fmt(Math.ceil(hud.clockW))}</div>
            <div className={'clock' + (hud.turn === 'b' ? ' on' : '')}>{fmt(Math.ceil(hud.clockB!))}</div>
          </div>
        )}
      </div>

      {/* toolbar — replaced by the script browser in famous-game study mode; by the setup bar in board-edit mode */}
      {hud.setup ? (
        <div className="setup-bar">
          <span className="setup-hint">摆盘：点棋子拿起 · 点格放置 · 点自身取消</span>
          <button className="sbtn-set" title="移除选中的棋子" onClick={props.onSetupDelete}>移除</button>
          <button className="sbtn-set" title="清空整个棋盘" onClick={props.onSetupClear}>清空</button>
          <button className="sbtn-set" title="恢复初始局面" onClick={props.onSetupReset}>重置</button>
          <button className="sbtn-set gold" title="以当前局面开始打谱研究（双方各需一名将/帅）" onClick={props.onSetupStudy}>开始打谱</button>
          <button className="sbtn-set" title="退出摆盘模式" onClick={props.onSetupExit}>退出</button>
        </div>
      ) : scriptMode && hud.scriptInfo ? (
        <ScriptPanel
          info={hud.scriptInfo}
          onToggle={props.onScriptToggle!}
          onStep={props.onScriptStep!}
          onGoto={props.onScriptGoto!}
          onExit={props.onScriptExit!}
          onBranch={props.onScriptBranch!}
          onImport={props.onScriptImport!}
          onExport={props.onScriptExport!}
          onHome={props.onHome}
        />
      ) : (
        <div className="toolbar">
          {props.onHome && (
            <button className="tool" title="Main Menu · 返回主页" onClick={props.onHome}><IconHome /></button>
          )}
          <button className="tool" title="Undo" disabled={!hud.canUndo} onClick={props.onUndo}><IconUndo /></button>
          <button className="tool danger" title="Resign" onClick={props.onResign}><IconFlag /></button>
          <button className="tool" title="New battle" onClick={props.onNewGame}><IconSwords /></button>
          {props.onRules && (
            <button className="tool" title="How to play · 玩法说明" onClick={props.onRules}><IconBook /></button>
          )}
          {hud.game === 'go' && props.onPass && (
            <button className="tool" title="Pass（虚着）" onClick={props.onPass}><span className="tool-word">PASS</span></button>
          )}
          <button className="tool" title={settings.sound ? 'Mute' : 'Sound'} onClick={props.onToggleSound}>
            {settings.sound ? <IconSound /> : <IconMute />}
          </button>
          <button className="tool" title="Flip camera" onClick={props.onFlip}><IconFlip /></button>
          <button className="tool" title="Coordinates" onClick={props.onToggleCoords}
            style={{ opacity: settings.coords ? 1 : 0.45 }}><IconGrid /></button>
          <button className="tool" title="Fullscreen" onClick={props.onFullscreen}><IconExpand /></button>
          <button className="tool" title="Settings" onClick={props.onSettings}><IconGear /></button>
        </div>
      )}

      {/* spoils — moves to the left corner in script mode so the script browser owns the right side */}
      <div className={'panel spoils' + (scriptMode ? ' script-spoils' : '')}>
        <div className="spoils-head"><span className="tiny">Spoils</span><span className="tiny gold">{status}</span></div>
        <div className="spoils-row">
          <img src={shieldDataUrl('w')} alt="" className="mini-shield" />
          <span className="glyphs">{hud.capturedByW.join(' ') || '—'}</span>
        </div>
        <div className="spoils-row">
          <img src={shieldDataUrl('b')} alt="" className="mini-shield" />
          <span className="glyphs red">{hud.capturedByB.join(' ') || '—'}</span>
        </div>
      </div>

      {hud.replayNote ? (
        <div className="replay-note"><span className="replay-live">{hud.setup ? '● 摆盘' : hud.scriptInfo?.custom ? '● 打谱' : '● 名局回放'}</span>{hud.replayNote}</div>
      ) : hud.note ? (
        <div className="replay-note"><span className="replay-live">● 提示</span>{hud.note}</div>
      ) : (
        <div className="hint">Drag to orbit · Scroll to zoom · Click a piece to command it</div>
      )}
    </>
  );
}
