import { useRef, useState } from 'react';
import { GameKind, Settings, Side } from '../game/types';
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

/** 导入记谱文本为打谱棋谱（象棋/国际象棋/围棋各自格式）。 */
export function ImportModal(props: {
  game?: GameKind;
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
  const g = props.game;
  const tip = g === 'chess'
    ? '粘贴国际象棋棋谱：支持标准 PGN（带或省略 header）与裸 SAN 着法列表，如 “1. e4 e5 2. Nf3 Nc6 …”；也可粘贴 FEN 起始局面（如 “4k3/… w - - 0 1”）从该局面开始打谱。'
    : g === 'go'
      ? '粘贴 SGF 围棋棋谱（如 (;GM[1]SZ[19]…;B[pp];W[dd]…)），将按主线解析并验证每手合法性。'
      : '粘贴传统记谱文本：支持“炮二平五 馬8进7”与带序号、括号注释的格式，整段或逐行均可。';
  const ph = g === 'chess'
    ? '例如：\n[Event "My Game"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0\n\n或 FEN：\nrnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    : g === 'go'
      ? '例如：\n(;GM[1]FF[4]SZ[19]\n;B[pd];W[dp];B[pp];W[dd];B[qp]\n;W[nc];B[qq];W[cq];B[cp]\n;W[ce];B[qc];W[qd];B[pe]\n;W[qe];B[qg];W[ne];B[hg]\n;W[eh];B[ge];W[gi];B[gf]\n;W[gh];B[ig];W[ih];B[if]\n;W[jg];B[jf];W[jh];B[je]\n;W[ch];B[dk];W[bj];B[bk]\n;W[ci];B[bi];W[cj];B[ai]\n;W[bd];B[cf];W[bf];B[cg]\n;W[ag];B[bg];W[ae];B[ad]\n;W[af];B[de];W[cf];B[bc]\n;W[ee];B[fe];W[gf];B[ef]\n;W[fg];B[df];W[ff];B[eg]\n;W[gg];B[eh];W[fc];B[fb]\n;W[gc];B[fa];W[gb];B[hb]\n;W[ha];B[ga];W[ia];B[ja]\n;W[ib];B[jb];W[ic];B[jc]\n;W[jd];B[id];W[ie];B[kk]\n;W[lk];B[kj];W[jk];B[jj]\n;W[kh];B[jg];W[ki];B[jl]\n;W[hj];B[ii];W[gk];B[fl]\n;W[gl];B[fm];W[gm];B[fn]\n;W[gn];B[fo];W[go];B[fp]\n;W[gp];B[fq];W[gq];B[er]\n;W[ds];B[es];W[dr];B[hr]\n;W[gr];B[fr];W[fp];B[eq]\n;W[ep];B[gq];W[fq];B[gp]\n;W[ho];B[hp];W[ip];B[jp]\n;W[kp];B[kq];W[lq];B[kr]\n;W[lr];B[ms];W[ls];B[mr]\n;W[nq];B[oq];W[or];B[nr]\n;W[np];B[op];W[po];B[pn]\n;W[on];B[om];W[nm];B[mn]\n;W[mm];B[ln];W[mo];B[no]\n;W[nn];B[on];W[oo];B[ko]\n;W[lo];B[mo];W[ln];B[km]\n;W[jo];B[jp];W[kp];B[kg]\n;W[lf];B[kf];W[jf];B[le]\n;W[me];B[ld];W[md];B[mc]\n;W[nc];B[nb];W[ob];B[oc]\n;W[pc];B[pb];W[qa];B[qc]\n;W[qb];B[ra];W[rc];B[rd]\n;W[sc];B[sd];W[se];B[rf]\n;W[rg];B[sf];W[sh];B[sg]\n;W[si];B[rh];W[ri];B[qh]\n;W[pi];B[ph];W[oi];B[oh]\n;W[og];B[of];W[ng];B[nf]\n;W[mg];B[mf];W[lf];B[ke]\n;W[kd];B[jc];W[kc];B[kb]\n;W[lc];B[lb];W[mb];B[ma]\n;W[na];B[oa];W[pa];B[qa]\n;W[ra];B[sa];W[sb];B[sd]\n;W[se];B[td];W[te];B[tf]\n;W[ud];B[uc];W[vc];B[vb]\n;W[wa];B[wb];W[xa];B[xb]\n;W[ya];B[za];W[zb];B[zc]\n;W[ad];B[ae];W[af];B[ag]\n;W[ah];B[ai];W[aj];B[ak]\n;W[al];B[am];W[an];B[ao]\n;W[ap];B[aq];W[ar];B[as]\n;W[at];B[au];W[av];B[aw]\n;W[ax];B[ay];W[az];B[ba]\n;W[bb];B[bc];W[bd];B[be]\n;W[bf];B[bg];W[bh];B[bi]\n;W[bj];B[bk];W[bl];B[bm]\n;W[bn];B[bo];W[bp];B[bq]\n;W[br];B[bs];W[bt];B[bu]\n;W[bv];B[bw];W[bx];B[by]\n;W[bz];B[ca];W[cb];B[cc]\n;W[cd];B[ce];W[cf];B[cg]\n;W[ch];B[ci];W[cj];B[ck]\n;W[cl];B[cm];W[cn];B[co]\n;W[cp];B[cq];W[cr];B[cs]\n;W[ct];B[cu];W[cv];B[cw]\n;W[cx];B[cy];W[cz];B[da]\n;W[db];B[dc];W[dd];B[de]\n;W[df];B[dg];W[dh];B[di]\n;W[dj];B[dk];W[dl];B[dm]\n;W[dn];B[do];W[dp];B[dq]\n;W[dr];B[ds];W[dt];B[du]\n;W[dv];B[dw];W[dx];B[dy]\n;W[dz];B[ea];W[eb];B[ec]\n;W[ed];B[ee];W[ef];B[eg]\n;W[eh];B[ei];W[ej];B[ek]\n;W[el];B[em];W[en];B[eo]\n;W[ep];B[eq];W[er];B[es]\n;W[et];B[eu];W[ev];B[ew]\n;W[ex];B[ey];W[ez];B[fa]\n;W[fb];B[fc];W[fd];B[fe]\n;W[ff];B[fg];W[fh];B[fi]\n;W[fj];B[fk];W[fl];B[fm]\n;W[fn];B[fo];W[fp];B[fq]\n;W[fr];B[fs];W[ft];B[fu]\n;W[fv];B[fw];W[fx];B[fy]\n;W[fz];B[ga];W[gb];B[gc]\n;W[gd];B[ge];W[gf];B[gg]\n;W[gh];B[gi];W[gj];B[gk]\n;W[gl];B[gm];W[gn];B[go]\n;W[gp];B[gq];W[gr];B[gs]\n;W[gt];B[gu];W[gv];B[gw]\n;W[gx];B[gy];W[gz];B[ha]\n;W[hb];B[hc];W[hd];B[he]\n;W[hf];B[hg];W[hh];B[hi]\n;W[hj];B[hk];W[hl];B[hm]\n;W[hn];B[ho];W[hp];B[hq]\n;W[hr];B[hs];W[ht];B[hu]\n;W[hv];B[hw];W[hx];B[hy]\n;W[hz];B[ia];W[ib];B[ic]\n;W[id];B[ie];W[if];B[ig]\n;W[ih];B[ii];W[ij];B[ik]\n;W[il];B[im];W[in];B[io]\n;W[ip];B[iq];W[ir];B[is]\n;W[it];B[iu];W[iv];B[iw]\n;W[ix];B[iy];W[iz];B[ja]\n;W[jb];B[jc];W[jd];B[je]\n;W[jf];B[jg];W[jh];B[ji]\n;W[jj];B[jk];W[jl];B[jm]\n;W[jn];B[jo];W[jp];B[jq]\n;W[jr];B[js];W[jt];B[ju]\n;W[jv];B[jw];W[jx];B[jy]\n;W[jz];B[ka];W[kb];B[kc]\n;W[kd];B[ke];W[kf];B[kg]\n;W[kh];B[ki];W[kj];B[kk]\n;W[kl];B[km];W[kn];B[ko]\n;W[kp];B[kq];W[kr];B[ks]\n;W[kt];B[ku];W[kv];B[kw]\n;W[kx];B[ky];W[kz];B[la]\n;W[lb];B[lc];W[ld];B[le]\n;W[lf];B[lg];W[lh];B[li]\n;W[lj];B[lk];W[ll];B[lm]\n;W[ln];B[lo];W[lp];B[lq]\n;W[lr];B[ls];W[lt];B[lu]\n;W[lv];B[lw];W[lx];B[ly]\n;W[lz];B[ma];W[mb];B[mc]\n;W[md];B[me];W[mf];B[mg]\n;W[mh];B[mi];W[mj];B[mk]\n;W[ml];B[mm];W[mn];B[mo]\n;W[mp];B[mq];W[mr];B[ms]\n;W[mt];B[mu];W[mv];B[mw]\n;W[mx];B[my];W[mz];B[na]\n;W[nb];B[nc];W[nd];B[ne]\n;W[nf];B[ng];W[nh];B[ni]\n;W[nj];B[nk];W[nl];B[nm]\n;W[nn];B[no];W[np];B[nq]\n;W[nr];B[ns];W[nt];B[nu]\n;W[nv];B[nw];W[nx];B[ny]\n;W[nz];B[oa];W[ob];B[oc]\n;W[od];B[oe];W[of];B[og]\n;W[oh];B[oi];W[oj];B[ok]\n;W[ol];B[om];W[on];B[oo]\n;W[op];B[oq];W[or];B[os]\n;W[ot];B[ou];W[ov];B[ow]\n;W[ox];B[oy];W[oz];B[pa]\n;W[pb];B[pc];W[pd];B[pe]\n;W[pf];B[pg];W[ph];B[pi]\n;W[pj];B[pk];W[pl];B[pm]\n;W[pn];B[po];W[pp];B[pq]\n;W[pr];B[ps];W[pt];B[pu]\n;W[pv];B[pw];W[px];B[py]\n;W[pz];B[qa];W[qb];B[qc]\n;W[qd];B[qe];W[qf];B[qg]\n;W[qh];B[qi];W[qj];B[qk]\n;W[ql];B[qm];W[qn];B[qo]\n;W[qp];B[qq];W[qr];B[qs]\n;W[qt];B[qu];W[qv];B[qw]\n;W[qx];B[qy];W[qz];B[ra]\n;W[rb];B[rc];W[rd];B[re]\n;W[rf];B[rg];W[rh];B[ri]\n;W[rj];B[rk];W[rl];B[rm]\n;W[rn];B[ro];W[rp];B[rq]\n;W[rr];B[rs];W[rt];B[ru]\n;W[rv];B[rw];W[rx];B[ry]\n;W[rz];B[sa];W[sb];B[sc]\n;W[sd];B[se];W[sf];B[sg]\n;W[sh];B[si];W[sj];B[sk]\n;W[sl];B[sm];W[sn];B[so]\n;W[sp];B[sq];W[sr];B[ss];W[st]'
    : '例如：\n1. 炮二平五 馬8进7\n2. 傌二进三 車9平8\n3. 俥一平二 砲8平5\n…';
  return (
    <div className="modal-back">
      <div className="modal panel script-modal">
        <div className="modal-head">
          <span>导入棋谱</span>
          <button className="tool" onClick={props.onClose}><IconClose /></button>
        </div>
        <p className="script-modal-tip">{tip}</p>
        <textarea
          className="script-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={ph}
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

/** 导出当前打谱路径为对应棋种的记谱文本。 */
export function ExportModal(props: { game?: GameKind; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(props.text); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const g = props.game;
  const tip = g === 'chess'
    ? '当前打谱路径的标准 PGN（含 header，可粘贴至任意国际象棋软件）。'
    : g === 'go'
      ? '当前打谱路径的围棋记谱文本（含变着分支切换后所走的变着主线）。'
      : '当前打谱路径的传统记谱（含分支切换后所走的变着主线）。';
  return (
    <div className="modal-back">
      <div className="modal panel script-modal">
        <div className="modal-head">
          <span>导出棋谱</span>
          <button className="tool" onClick={props.onClose}><IconClose /></button>
        </div>
        <p className="script-modal-tip">{tip}</p>
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
