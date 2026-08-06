import { useRef, useState } from 'react';
import { Settings, Side } from '../game/types';
import { IconClose, IconSwords, IconHome } from './Icons';

export function SettingsModal(props: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const { settings, onChange } = props;
  const row = (key: keyof Settings, label: string, desc: string) => (
    <button className="set-row" onClick={() => onChange({ ...settings, [key]: !settings[key] })}>
      <div className="set-text">
        <div className="set-label">{label}</div>
        <div className="set-desc">{desc}</div>
      </div>
      <div className={'toggle' + (settings[key] ? ' on' : '')}><div className="knob" /></div>
    </button>
  );
  return (
    <div className="modal-back">
      <div className="modal panel">
        <div className="modal-head"><span>Settings</span><button className="tool" onClick={props.onClose}><IconClose /></button></div>
        {row('cameraSwing', 'Camera Swing', 'The camera swings to the player on move.')}
        {row('sound', 'Battle Sounds', 'Drums, steel and horns.')}
        {row('coords', 'Coordinates', 'Show the golden ranks and files around the board.')}
        {row('legalMoves', 'Legal Moves', 'Glow the field where a selected piece may march.')}
      </div>
    </div>
  );
}

export function GameOverModal(props: {
  over: { winner: Side | null; reason: string };
  names: { w: string; b: string };
  onRematch: () => void;
  onMenu: () => void;
}) {
  const { over, names } = props;
  const title = over.winner ? `${names[over.winner]} Triumphs` : 'A Draw';
  return (
    <div className="modal-back">
      <div className="modal panel over-modal">
        <div className="over-reason">{over.reason}</div>
        <h2 className={'over-title ' + (over.winner === 'w' ? 'ivory' : over.winner === 'b' ? 'obsidian' : '')}>{title}</h2>
        <p className="over-flavor">
          {over.winner
            ? `The ${names[over.winner === 'w' ? 'b' : 'w']} host breaks and scatters from the field.`
            : 'Neither host yields; the field stays silent.'}
        </p>
        <div className="over-btns">
          <button className="btn-gold" onClick={props.onRematch}><IconSwords size={14} /> Rematch</button>
          <button className="btn-dark" onClick={props.onMenu}><IconHome size={14} /> Main Menu</button>
        </div>
      </div>
    </div>
  );
}

/** 导入传统记谱文本为打谱棋谱（支持序号、括号注释、换行与空格分隔）。 */
export function ImportModal(props: {
  onImport: (text: string) => { ok: boolean; error: string | null };
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const doImport = () => {
    const r = props.onImport(text);
    if (r.ok) props.onClose();
    else setError(r.error);
  };
  return (
    <div className="modal-back">
      <div className="modal panel script-modal">
        <div className="modal-head">
          <span>导入棋谱</span>
          <button className="tool" onClick={props.onClose}><IconClose /></button>
        </div>
        <p className="script-modal-tip">
          粘贴传统记谱文本：支持“炮二平五 馬8进7”与带序号、括号注释的格式，整段或逐行均可。
        </p>
        <textarea
          className="script-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'例如：\n1. 炮二平五 馬8进7\n2. 傌二进三 車9平8\n3. 俥一平二 砲8平5\n…'}
          spellCheck={false}
        />
        {error && <div className="script-error">{error}</div>}
        <div className="script-modal-actions">
          <button className="btn-dark" onClick={props.onClose}>取消</button>
          <button className="btn-gold" onClick={doImport} disabled={!text.trim()}>解析并导入</button>
        </div>
      </div>
    </div>
  );
}

/** 导出当前打谱路径为传统记谱文本。 */
export function ExportModal(props: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(props.text); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="modal-back">
      <div className="modal panel script-modal">
        <div className="modal-head">
          <span>导出棋谱</span>
          <button className="tool" onClick={props.onClose}><IconClose /></button>
        </div>
        <p className="script-modal-tip">当前打谱路径的传统记谱（含分支切换后所走的变着主线）。</p>
        <textarea
          className="script-textarea"
          readOnly
          value={props.text}
          ref={taRef}
          onFocus={e => e.currentTarget.select()}
        />
        <div className="script-modal-actions">
          <button className="btn-dark" onClick={props.onClose}>关闭</button>
          <button className={'btn-gold' + (copied ? ' copied' : '')} onClick={copy}>{copied ? '已复制 ✓' : '复制到剪贴板'}</button>
        </div>
      </div>
    </div>
  );
}
