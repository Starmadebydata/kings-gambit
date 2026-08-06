import { useEffect, useRef } from 'react';
import type { ScriptInfo } from '../game/types';

/**
 * 棋谱打谱浏览器：着法列表 + 播放控制 + 变着分支 + 导入/导出。
 * 象棋按回合两列排布（红/黑）；围棋单列每手一行（第 N 手 · 黑/白坐标）。
 * 点击任意一着跳转，当前着高亮并自动滚动跟随。
 * 某着右侧出现 ⤴n 徽标表示该着后有 n 个变着分支，点击循环切换分支。
 */
export function ScriptPanel(props: {
  info: ScriptInfo;
  onToggle: () => void;
  onStep: (dir: number) => void;
  onGoto: (i: number) => void;
  onExit: () => void;
  onBranch: (ply: number) => void;
  onImport: () => void;
  onExport: () => void;
}) {
  const { info } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const isGo = info.game === 'go';

  // build rounds: 象棋 [roundNo, redPly(1-based), blackPly]；围棋单列每手一行（black=0）
  const rounds: { no: number; red: number; black: number }[] = isGo
    ? Array.from({ length: info.total }, (_, i) => ({ no: i + 1, red: i + 1, black: 0 }))
    : [];
  if (!isGo) {
    for (let p = 0; p < info.total; p += 2) {
      rounds.push({ no: p / 2 + 1, red: p + 1, black: p + 2 <= info.total ? p + 2 : 0 });
    }
  }

  // auto-scroll so the current move stays visible
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.ply.current');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [info.index]);

  // 当前着高亮：仅在着法位于主线时高亮（站在分支上时主线列表不高亮）
  const plyClass = (ply: number) => 'ply' + (info.index === ply && info.onMain ? ' current' : '');

  // 分支徽标：branches[ply] = 第 ply 着节点（路径下标）的子节点数，>1 表示有分叉
  const badge = (ply: number) =>
    info.branches[ply] > 1 ? (
      <button
        className="branch-badge"
        title={`第 ${ply} 着后有 ${info.branches[ply]} 个变着，点击切换`}
        onClick={() => props.onBranch(ply)}
      >
        ⤴{info.branches[ply]}
      </button>
    ) : null;

  return (
    <div className="script-panel">
      <div className="script-head">
        <div>
          <div className="script-title">{info.title}</div>
          <div className="script-sub">{info.source} · {info.result} · 共 {isGo ? info.total : Math.ceil(info.total / 2)} {isGo ? '手' : '回合'}</div>
          {info.desc && <div className="script-desc">{info.desc}</div>}
        </div>
        <div className="script-tools">
          {!isGo && <button className="stool" title="导入传统记谱文本" onClick={props.onImport}>导入</button>}
          <button className="stool" title="导出当前打谱路径为传统记谱" onClick={props.onExport}>导出</button>
          <button className="script-close" title="退出棋谱" onClick={props.onExit}>✕</button>
        </div>
      </div>

      <div className="script-controls">
        <button className="sbtn" title="回到开局" onClick={() => props.onGoto(0)} disabled={info.index <= 0}>⏮</button>
        <button className="sbtn" title="上一步" onClick={() => props.onStep(-1)} disabled={info.index <= 0}>◀</button>
        <button className={'sbtn play' + (info.playing ? ' on' : '')} title={info.playing ? '暂停' : '自动演示'} onClick={props.onToggle}>
          {info.playing ? '⏸' : '▶'}
        </button>
        <button className="sbtn" title="下一步" onClick={() => props.onStep(1)} disabled={info.index >= info.total || info.over}>▶|</button>
        <button className="sbtn" title="跳到终局" onClick={() => props.onGoto(info.total)} disabled={info.index >= info.total || info.over}>⏭</button>
        <span className="script-progress">{info.index}/{info.total}</span>
      </div>

      <div className="script-list" ref={listRef}>
        <div className="script-list-head">
          {isGo ? <><span>手</span><span>着法</span></> : <><span>回合</span><span>红方</span><span>黑方</span></>}
        </div>
        {rounds.map(rd => (
          <div key={rd.no} className={'round' + (info.onMain && (info.index === rd.red || (rd.black && info.index === rd.black)) ? ' active' : '')}>
            <span className="round-no">{rd.no}.</span>
            <span className="ply-cell">
              <button className={plyClass(rd.red)} onClick={() => props.onGoto(rd.red)}>{info.notes[rd.red - 1]}</button>
              {badge(rd.red)}
            </span>
            <span className="ply-cell">
              <button className={plyClass(rd.black)} onClick={() => props.onGoto(rd.black)} disabled={!rd.black}>{rd.black ? info.notes[rd.black - 1] : ''}</button>
              {rd.black ? badge(rd.black) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
