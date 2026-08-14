import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Shogi, ShogiMove, SHOGI_CHAR, SHOGI_PROMOTED_CHAR, shogiKingChar, SHOGI_VALUE } from './shogi';
import type { Hand, ShogiType } from './shogi';
import { buildEnvironment, type Environment } from './environment';
import { buildShogiModel } from './pieceModels';
import { FxSystem } from './fx';
import { makeBorderTexture, makeGlowTexture, makeRingTexture, makeWoodTexture } from './textures';
import { findBestShogiMove } from './shogiAi';
import { sfx } from './audio';
import type { GameConfig, HudState, Settings, Side } from './types';

const BOARD_Y = 0.1;
const posX = (f: number) => f - 4;
const posZ = (r: number) => r - 4;
const keyOf = (r: number, f: number) => `${r},${f}`;
const HAND_ORDER: ShogiType[] = ['r', 'b', 'g', 's', 'n', 'l', 'p'];
/** 驹台位置：先手右下（近），后手左上（远）。 */
const TRAY_POS: Record<Side, [number, number]> = { w: [6.15, 3.35], b: [-6.15, -3.35] };
/** 驹尺寸系数（王最大、步最小）。 */
const KOMA_SIZE: Record<ShogiType, number> = { k: 1.12, r: 1.06, b: 1.03, g: 0.98, s: 0.95, n: 0.9, l: 0.9, p: 0.8 };

interface PieceObj {
  r: number; f: number;
  type: ShogiType; side: Side; promoted: boolean;
  group: THREE.Group;
  proxy: THREE.Mesh;
  glow: THREE.Mesh;
  phase: number;
}

interface Tween { t: number; dur: number; update: (k: number) => void; done?: () => void }
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export class ShogiGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private env: Environment;
  private shogi = new Shogi();
  private pieces = new Map<string, PieceObj>();
  private handStacks: { group: THREE.Group; proxies: THREE.Mesh[] }[] = [];
  private pickables: THREE.Object3D[] = [];
  private tweens: Tween[] = [];
  private fx = new FxSystem();
  private shake: { t: number; dur: number; amp: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private raf = 0;
  private time = 0;

  private hlGroup = new THREE.Group();
  private selRing: THREE.Mesh;
  private legalGroup = new THREE.Group();
  private lastGroup = new THREE.Group();
  private checkMark: THREE.Mesh;
  private promoGroup = new THREE.Group();

  private texGlowW = makeGlowTexture('205,140,45');
  private texGlowB = makeGlowTexture('70,120,220');
  private texLegal = makeGlowTexture('70,220,130');
  private texCap = makeRingTexture('220,70,50');
  private texRing = makeRingTexture('232,196,110');
  private texLast = makeBorderTexture('226,150,60');
  private texCheck = makeBorderTexture('230,60,50');
  private charCache = new Map<string, THREE.CanvasTexture>();

  screen: 'menu' | 'game' = 'menu';
  private config: GameConfig = { mode: 'local', minutes: 0 };
  settings: Settings = { cameraSwing: true, sound: true, coords: true, legalMoves: true };
  private selectedPiece: PieceObj | null = null;
  private selectedHand: { side: Side; type: ShogiType } | null = null;
  private legalForSelected: ShogiMove[] = [];
  private pendingPromo: { yes: ShogiMove; no: ShogiMove } | null = null;
  private locked = false;
  private over: { winner: Side | null; reason: string } | null = null;
  private clockW: number | null = null;
  private clockB: number | null = null;
  private lastWholeW = -1;
  private lastWholeB = -1;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private swing: { t: number; dur: number; from: number; to: number; phi: number; radius: number } | null = null;
  private camFlip = false;
  private downPos = { x: 0, y: 0 };
  private disposed = false;

  constructor(private container: HTMLElement, private onState: (s: HudState) => void) {

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0x0e1118, 0.024);
    this.scene.background = new THREE.Color(0x0e1118);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
    this.camera.position.set(0, 8.6, 10.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.3, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 22;
    this.controls.minPolarAngle = 0.45;
    this.controls.maxPolarAngle = 1.32;
    this.controls.autoRotateSpeed = 0.7;

    this.env = buildEnvironment(this.scene);
    this.buildBoard();
    this.scene.add(this.hlGroup, this.legalGroup, this.lastGroup, this.promoGroup, this.fx.group);

    this.selRing = this.flatPlane(this.texRing, 1.0, 0.14);
    this.selRing.visible = false;
    this.checkMark = this.flatPlane(this.texCheck, 0.98, 0.135);
    this.checkMark.visible = false;
    this.hlGroup.add(this.selRing, this.checkMark);

    this.rebuildPieces();
    this.rebuildHands();

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.emit();
    this.loop();
  }

  // ---------- board ----------
  private flatPlane(tex: THREE.Texture, size: number, y: number, order = 2) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = order;
    return m;
  }

  private buildBoard() {
    const woodMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.72 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x5a4326, roughness: 0.6, metalness: 0.2 });
    // 棋盘主体（将棋盘为正方形 9×9 格）
    const slab = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 10.4), woodMat);
    slab.position.y = -0.03;
    slab.receiveShadow = true;
    this.scene.add(slab);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.14, 11.0), new THREE.MeshStandardMaterial({ color: 0x10131b, roughness: 0.9 }));
    rim.position.y = -0.1;
    this.scene.add(rim);
    const base = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.22, 11.6), new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.95, flatShading: true }));
    base.position.y = -0.26;
    this.scene.add(base);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xb98f3e, roughness: 0.35, metalness: 0.75 });
    const trims: [number, number, number, number][] = [
      [10.46, 0.05, 0.12, 5.0], [10.46, 0.05, 0.12, -5.0], [0.12, 0.05, 10.0, 4.94], [0.12, 0.05, 10.0, -4.94]
    ];
    for (const [w, h, d, off] of trims) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat);
      const horizontal = w > d;
      t.position.set(horizontal ? 0 : off, 0.06, horizontal ? off : 0);
      this.scene.add(t);
    }

    // 格线：10×10 条线围出 9×9 格
    for (let i = 0; i < 10; i++) {
      const off = i - 4.5;
      const h = new THREE.Mesh(new THREE.BoxGeometry(9.06, 0.02, 0.045), lineMat);
      h.position.set(0, 0.09, off);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 9.06), lineMat);
      v.position.set(off, 0.09, 0);
      this.scene.add(h, v);
    }
    // 星位（四段×四列交叉点）
    const dotGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.02, 8);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.5 });
    for (const dx of [-1.5, 1.5]) for (const dz of [-1.5, 1.5]) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(dx, 0.09, dz);
      this.scene.add(dot);
    }

    // 驹台（手驹托盘）
    for (const side of ['w', 'b'] as Side[]) {
      const [tx, tz] = TRAY_POS[side];
      const tray = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 1.6), new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 0.8 }));
      tray.position.set(tx, 0.02, tz);
      tray.receiveShadow = true;
      const trayRim = new THREE.Mesh(new THREE.BoxGeometry(2.86, 0.08, 1.76), goldMat);
      trayRim.position.set(tx, -0.05, tz);
      this.scene.add(tray, trayRim);
    }

    // 隐形拾取面：每个格子一个
    const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const pickGeo = new THREE.PlaneGeometry(0.98, 0.98);
    for (let r = 0; r < 9; r++) {
      for (let f = 0; f < 9; f++) {
        const m = new THREE.Mesh(pickGeo, pickMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(posX(f), 0.1, posZ(r));
        m.userData.key = keyOf(r, f);
        this.scene.add(m);
        this.pickables.push(m);
      }
    }
  }

  // ---------- pieces ----------
  /** 駒面汉字纹理：未成黑字，成驹赤字。 */
  private charTex(type: ShogiType, side: Side, promoted: boolean): THREE.CanvasTexture {
    const ch = promoted ? SHOGI_PROMOTED_CHAR[type] : type === 'k' ? shogiKingChar(side) : SHOGI_CHAR[type];
    const key = ch + (promoted ? '!' : '');
    let t = this.charCache.get(key);
    if (!t) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 160;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 160);
      ctx.font = '700 92px "Hiragino Mincho ProN","Yu Mincho","Songti SC","SimSun",serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = promoted ? '#c0392b' : '#2b2016';
      ctx.fillText(ch, 64, 84);
      t = new THREE.CanvasTexture(c);
      t.anisotropy = 4;
      this.charCache.set(key, t);
    }
    return t;
  }

  private makePiece(type: ShogiType, side: Side, promoted: boolean, r: number, f: number): PieceObj {
    const group = new THREE.Group();
    group.add(buildShogiModel(this.charTex(type, side, promoted), KOMA_SIZE[type]));
    group.rotation.y = side === 'b' ? Math.PI : 0; // 尖端指向敌方

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.0),
      new THREE.MeshBasicMaterial({ map: side === 'w' ? this.texGlowW : this.texGlowB, transparent: true, depthWrite: false, opacity: 0.8 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    glow.renderOrder = 1;
    group.add(glow);

    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.5, 0.9),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.y = 0.25;
    proxy.userData.key = keyOf(r, f);
    group.add(proxy);
    this.pickables.push(proxy);

    group.position.set(posX(f), BOARD_Y, posZ(r));
    this.scene.add(group);
    return { r, f, type, side, promoted, group, proxy, glow, phase: Math.random() * 6.28 };
  }

  private removePieceObj(p: PieceObj) {
    this.scene.remove(p.group);
    const i = this.pickables.indexOf(p.proxy);
    if (i >= 0) this.pickables.splice(i, 1);
  }

  rebuildPieces() {
    for (const p of [...this.pieces.values()]) this.removePieceObj(p);
    this.pieces.clear();
    for (let r = 0; r < 9; r++) {
      for (let f = 0; f < 9; f++) {
        const pc = this.shogi.board[r][f];
        if (pc) this.pieces.set(keyOf(r, f), this.makePiece(pc.type, pc.side, pc.promoted, r, f));
      }
    }
    this.fx.clear();
    this.clearHighlights();
  }

  /** 驹台手驹展示：每类一叠（最多 3 枚叠放）+ 数量标。 */
  rebuildHands() {
    for (const st of this.handStacks) {
      this.scene.remove(st.group);
      for (const px of st.proxies) {
        const i = this.pickables.indexOf(px);
        if (i >= 0) this.pickables.splice(i, 1);
      }
    }
    this.handStacks = [];
    for (const side of ['w', 'b'] as Side[]) {
      const hand = this.shogi.hands[side];
      const [tx, tz] = TRAY_POS[side];
      const present = HAND_ORDER.filter(t => (hand[t] ?? 0) > 0);
      const gap = Math.min(0.52, 2.3 / Math.max(1, present.length));
      present.forEach((type, i) => {
        const count = hand[type] ?? 0;
        const stack = new THREE.Group();
        const n = Math.min(3, count);
        for (let j = 0; j < n; j++) {
          const koma = buildShogiModel(this.charTex(type, side, false), 0.52);
          koma.rotation.y = (side === 'b' ? Math.PI : 0) + (j > 0 ? (Math.random() - 0.5) * 0.3 : 0);
          koma.position.set((Math.random() - 0.5) * 0.05 * j, j * 0.055, (Math.random() - 0.5) * 0.05 * j);
          stack.add(koma);
        }
        if (count > 1) {
          const label = this.countLabel(count);
          label.position.y = 0.24;
          stack.add(label);
        }
        const x = tx - (present.length - 1) * gap / 2 + i * gap;
        stack.position.set(x, BOARD_Y + 0.07, tz);
        // 拾取代理
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.4, 0.62),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        proxy.position.y = 0.2;
        proxy.userData.key = `hand:${side}:${type}`;
        stack.add(proxy);
        this.pickables.push(proxy);
        this.scene.add(stack);
        this.handStacks.push({ group: stack, proxies: [proxy] });
      });
    }
  }

  private countLabel(n: number): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 96; c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.font = '700 34px "Trebuchet MS",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8d5a0';
    ctx.fillText(`×${n}`, 48, 26);
    const t = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(0.42, 0.21, 1);
    return s;
  }

  // ---------- interaction ----------
  private onDown = (e: PointerEvent) => { this.downPos = { x: e.clientX, y: e.clientY }; };

  private onUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downPos.x, dy = e.clientY - this.downPos.y;
    if (dx * dx + dy * dy > 36) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (!hits.length) { this.cancelPromo(); this.clearSelection(); return; }
    const key = hits[0].object.userData.key as string;
    this.handleClick(key);
  };

  private humanTurn(): boolean {
    if (this.screen !== 'game' || this.over || this.locked) return false;
    if (this.config.mode === 'showcase') return false;
    if (this.config.mode === 'computer' && this.shogi.turn === 'b') return false;
    return true;
  }

  private handleClick(key: string) {
    if (key.startsWith('promo:')) { this.resolvePromo(key === 'promo:1'); return; }
    if (this.pendingPromo) this.cancelPromo();
    if (key.startsWith('hand:')) {
      if (!this.humanTurn()) return;
      const [, side, type] = key.split(':');
      if (side !== this.shogi.turn) { this.clearSelection(); return; }
      this.selectHand(side as Side, type as ShogiType);
      return;
    }
    // 棋盘格
    if (this.selectedPiece || this.selectedHand) {
      const [r, f] = key.split(',').map(Number);
      const matches = this.legalForSelected.filter(m => m.to[0] === r && m.to[1] === f);
      if (matches.length === 1) { this.doMove(matches[0]); return; }
      if (matches.length >= 2) { this.beginPromo(matches); return; }
    }
    const piece = this.pieces.get(key);
    if (piece && piece.side === this.shogi.turn && this.humanTurn()) this.selectPiece(piece);
    else this.clearSelection();
  }

  private selectPiece(p: PieceObj) {
    this.clearSelection();
    this.selectedPiece = p;
    this.legalForSelected = this.shogi.legalMovesFrom(p.r, p.f);
    this.showSelection(posX(p.f), posZ(p.r));
    sfx.select();
  }

  private selectHand(side: Side, type: ShogiType) {
    this.clearSelection();
    this.selectedHand = { side, type };
    this.legalForSelected = this.shogi.legalMoves(side).filter(m => m.drop === type);
    const stack = this.handStacks.find(s => s.proxies[0]?.userData.key === `hand:${side}:${type}`);
    if (stack) this.showSelection(stack.group.position.x, stack.group.position.z);
    sfx.select();
  }

  private showSelection(x: number, z: number) {
    this.selRing.visible = true;
    this.selRing.position.set(x, 0.14, z);
    if (this.settings.legalMoves) {
      const seen = new Set<string>();
      for (const m of this.legalForSelected) {
        const k = keyOf(m.to[0], m.to[1]);
        if (seen.has(k)) continue;
        seen.add(k);
        const isCap = !!m.capture;
        const d = this.flatPlane(isCap ? this.texCap : this.texLegal, isCap ? 0.9 : 0.72, 0.125);
        d.position.set(posX(m.to[1]), 0.125, posZ(m.to[0]));
        this.legalGroup.add(d);
      }
    }
  }

  private clearSelection() {
    this.selectedPiece = null;
    this.selectedHand = null;
    this.legalForSelected = [];
    this.selRing.visible = false;
    this.legalGroup.clear();
  }

  private clearHighlights() {
    this.clearSelection();
    this.cancelPromo();
    this.lastGroup.clear();
    this.checkMark.visible = false;
  }

  // ---------- promotion choice ----------
  private choiceTex(text: string, color: string): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = '700 40px "Hiragino Mincho ProN","Songti SC","SimSun",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 34);
    return new THREE.CanvasTexture(c);
  }

  /** 同一落点有成/不成两选 → 浮出选择按钮。 */
  private beginPromo(ms: ShogiMove[]) {
    const yes = ms.find(m => m.promote)!;
    const no = ms.find(m => !m.promote)!;
    this.pendingPromo = { yes, no };
    this.legalGroup.clear();
    const [r, f] = yes.to;
    const flip = this.shogi.turn === 'b';
    const mkBtn = (text: string, color: string, y: number, k: string) => {
      const btn = new THREE.Group();
      const bg = new THREE.Mesh(
        new THREE.PlaneGeometry(1.05, 0.32),
        new THREE.MeshBasicMaterial({ color: 0x141821, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
      );
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.24),
        new THREE.MeshBasicMaterial({ map: this.choiceTex(text, color), transparent: true, depthWrite: false, side: THREE.DoubleSide })
      );
      label.position.z = 0.012;
      bg.add(label);
      bg.userData.key = k;
      btn.add(bg);
      btn.position.set(posX(f), y, posZ(r));
      btn.rotation.x = -Math.PI / 3;
      if (flip) btn.rotation.y = Math.PI;
      this.pickables.push(bg);
      this.promoGroup.add(btn);
    };
    mkBtn('成 る', '#e8b04c', 1.12, 'promo:1');
    mkBtn('不 成', '#b8c4d2', 0.68, 'promo:0');
    sfx.select();
  }

  private resolvePromo(yes: boolean) {
    if (!this.pendingPromo) return;
    const mv = yes ? this.pendingPromo.yes : this.pendingPromo.no;
    this.cancelPromo();
    this.doMove(mv);
  }

  private cancelPromo() {
    this.promoGroup.traverse(o => {
      if ((o as THREE.Mesh).isMesh && this.pickables.includes(o)) {
        this.pickables.splice(this.pickables.indexOf(o), 1);
      }
    });
    this.promoGroup.clear();
    this.pendingPromo = null;
  }

  // ---------- moving ----------
  private tween(dur: number, update: (k: number) => void, done?: () => void) {
    this.tweens.push({ t: 0, dur, update, done });
  }

  private markLast(spots: [number, number][]) {
    this.lastGroup.clear();
    for (const [r, f] of spots) {
      const d = this.flatPlane(this.texLast, 0.98, 0.115, 1);
      d.position.set(posX(f), 0.115, posZ(r));
      this.lastGroup.add(d);
    }
  }

  private hopTo(p: PieceObj, x: number, z: number, dur: number, done?: () => void) {
    const sx = p.group.position.x, sz = p.group.position.z;
    this.tween(dur, k => {
      const e = ease(k);
      const h = Math.sin(e * Math.PI);
      p.group.position.x = sx + (x - sx) * e;
      p.group.position.z = sz + (z - sz) * e;
      p.group.position.y = BOARD_Y + h * 0.28;
      p.group.rotation.x = -h * 0.22; // 沿移动方向俯仰
    }, () => {
      p.group.position.y = BOARD_Y;
      p.group.rotation.x = 0;
      this.fx.dust(new THREE.Vector3(x, BOARD_Y, z), 4);
      this.fx.ring(new THREE.Vector3(x, BOARD_Y + 0.02, z), 0xc8a75a, 0.8, 0.32);
      done?.();
    });
  }

  doMove(mv: ShogiMove) {
    if (this.locked) return;
    this.locked = true;
    this.clearSelection();
    if (mv.drop) { this.animateDrop(mv); return; }
    const mover = this.pieces.get(keyOf(mv.from![0], mv.from![1]));
    if (!mover) { this.locked = false; return; }
    const victim = mv.capture ? this.pieces.get(keyOf(mv.to[0], mv.to[1])) : undefined;
    this.markLast([mv.from!, mv.to]);
    this.hopTo(mover, posX(mv.to[1]), posZ(mv.to[0]), 0.5, () => this.commitMove(mv, victim));
  }

  private commitMove(mv: ShogiMove, victim: PieceObj | undefined) {
    // 先落引擎（make 依赖落点原状判定吃子），再更新 3D 映射
    this.shogi.make(mv);
    const moverKey = keyOf(mv.from![0], mv.from![1]);
    const mover = this.pieces.get(moverKey);
    if (mover) {
      this.pieces.delete(moverKey);
      this.pieces.set(keyOf(mv.to[0], mv.to[1]), mover);
      mover.r = mv.to[0]; mover.f = mv.to[1];
      mover.proxy.userData.key = keyOf(mv.to[0], mv.to[1]);
    }
    if (victim) {
      const hitPos = new THREE.Vector3(posX(mv.to[1]), BOARD_Y + 0.05, posZ(mv.to[0]));
      this.hitAway(victim, mv.from!, mv.to);
      this.fx.burst(hitPos, victim.side === 'w' ? 0xffb46a : 0x7fb0e8, 14, { speed: 2.1, up: 1.2 });
      this.fx.ring(hitPos, 0xe8c56a, 1.7, 0.42);
      this.shake = { t: 0, dur: 0.3, amp: 0.05 };
      sfx.capture();
    } else {
      sfx.move();
    }

    if (mv.promote && mover) this.promotePiece(mover);
    this.rebuildHands();

    if (this.shogi.inCheck(this.shogi.turn)) this.updateCheckMark();
    else this.checkMark.visible = false;

    const over = this.shogi.isOver();
    if (over) { this.over = over; sfx.over(true); }

    this.locked = false;
    this.emit();
    if (!this.over) {
      this.swingTo(this.shogi.turn);
      this.maybeAI();
    }
  }

  /** 打入：手驹从駒台飞落棋盘。 */
  private animateDrop(mv: ShogiMove) {
    const type = mv.drop!;
    const side = this.shogi.turn;
    const [tx, tz] = TRAY_POS[side];
    const p = this.makePiece(type, side, false, mv.to[0], mv.to[1]);
    this.pieces.set(keyOf(mv.to[0], mv.to[1]), p);
    p.group.position.set(tx, BOARD_Y + 1.1, tz);
    p.group.scale.setScalar(0.72);
    this.markLast([mv.to]);
    const dx = posX(mv.to[1]), dz = posZ(mv.to[0]);
    this.tween(0.42, k => {
      const e = ease(k);
      p.group.position.x = tx + (dx - tx) * e;
      p.group.position.z = tz + (dz - tz) * e;
      p.group.position.y = BOARD_Y + (1 - e) * (1 - e) * 1.0;
      const s = 0.72 + 0.28 * e;
      p.group.scale.setScalar(s);
    }, () => {
      p.group.position.set(dx, BOARD_Y, dz);
      p.group.scale.setScalar(1);
      this.shogi.make(mv);
      this.fx.dust(new THREE.Vector3(dx, BOARD_Y, dz), 5);
      this.fx.ring(new THREE.Vector3(dx, BOARD_Y + 0.02, dz), 0xc8a75a, 0.9, 0.35);
      sfx.move();
      this.rebuildHands();
      if (this.shogi.inCheck(this.shogi.turn)) this.updateCheckMark();
      else this.checkMark.visible = false;
      const over = this.shogi.isOver();
      if (over) { this.over = over; sfx.over(true); }
      this.locked = false;
      this.emit();
      if (!this.over) {
        this.swingTo(this.shogi.turn);
        this.maybeAI();
      }
    });
  }

  /** 成驹：原位换赤字駒面 + 红光特效。 */
  private promotePiece(p: PieceObj) {
    const pos = p.group.position.clone();
    this.removePieceObj(p);
    this.pieces.delete(keyOf(p.r, p.f));
    const np = this.makePiece(p.type, p.side, true, p.r, p.f);
    np.group.position.copy(pos);
    this.pieces.set(keyOf(p.r, p.f), np);
    const fxPos = new THREE.Vector3(pos.x, BOARD_Y + 0.2, pos.z);
    this.fx.flash(fxPos, 0xe85a4a, 1.2, 0.3);
    this.fx.ring(fxPos, 0xe85a4a, 1.3, 0.4);
  }

  /** 被吃棋子：沿来子方向被击飞，翻滚缩小并淡出。 */
  private hitAway(v: PieceObj, from: [number, number], to: [number, number]) {
    const dirX = posX(to[1]) - posX(from[1]);
    const dirZ = posZ(to[0]) - posZ(from[0]);
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len, nz = dirZ / len;
    const sx = v.group.position.x, sz = v.group.position.z;
    let lastK = 0;
    this.tween(0.42, k => {
      const e = ease(k);
      const dk = k - lastK;
      lastK = k;
      v.group.position.x = sx + nx * 0.55 * e;
      v.group.position.z = sz + nz * 0.55 * e;
      v.group.position.y = BOARD_Y + Math.sin(e * Math.PI) * 0.55 * (1 - k * 0.4);
      v.group.rotation.y += dk * 9;
      v.group.rotation.z += dk * 7;
      v.group.scale.setScalar(Math.max(0.02, 1 - k * 0.8));
      this.setPieceOpacity(v, Math.max(0, 1 - k * 0.8));
    }, () => {
      this.removePieceObj(v);
      this.setPieceOpacity(v, 1);
    });
  }

  private setPieceOpacity(p: PieceObj, o: number) {
    p.group.traverse(obj => {
      const m = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) {
        mm.transparent = true;
        mm.opacity = o;
      }
    });
  }

  // ---------- AI ----------
  private maybeAI() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.screen !== 'game' || this.over) return;
    const turn = this.shogi.turn;
    const isAI = this.config.mode === 'showcase' || (this.config.mode === 'computer' && turn === 'b');
    if (!isAI) return;
    const level = this.config.level ?? 2;
    const jitter = this.config.mode === 'showcase' ? 60 : 0;
    this.aiTimer = setTimeout(() => {
      if (this.over || this.screen !== 'game') return;
      const mv = findBestShogiMove(this.shogi, { level, jitter });
      if (mv) this.doMove(mv);
    }, this.config.mode === 'showcase' ? 1000 : 650);
  }

  // ---------- camera ----------
  private swingTo(side: Side) {
    if (!this.settings.cameraSwing || this.screen !== 'game') return;
    const base = side === 'w' ? 0 : Math.PI;
    const target = base + (this.camFlip ? Math.PI : 0);
    const off = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    const to = target + Math.round((sph.theta - target) / (Math.PI * 2)) * Math.PI * 2;
    this.swing = { t: 0, dur: 1.2, from: sph.theta, to, phi: sph.phi, radius: sph.radius };
    this.controls.enabled = false;
  }

  flipCamera() {
    this.camFlip = !this.camFlip;
    this.swingTo(this.shogi.turn);
  }

  // ---------- public API ----------
  startGame(config: GameConfig) {
    this.config = config;
    this.shogi.reset();
    this.over = null;
    this.locked = false;
    this.camFlip = false;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.clockW = config.minutes > 0 ? config.minutes * 60 : null;
    this.clockB = config.minutes > 0 ? config.minutes * 60 : null;
    this.lastWholeW = this.clockW ?? -1; this.lastWholeB = this.clockB ?? -1;
    this.rebuildPieces();
    this.rebuildHands();
    this.screen = 'game';
    this.controls.autoRotate = false;
    sfx.unlock();
    sfx.start();
    this.emit();
    this.swingTo('w');
  }

  toMenu() {
    this.selRing.visible = false;
    this.screen = 'menu';
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.over = null;
    this.controls.autoRotate = true;
    this.emit();
  }

  undo() {
    if (this.screen !== 'game' || this.over || this.locked) return;
    if (this.config.mode === 'showcase') return;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.config.mode === 'computer') {
      this.shogi.undo();
      if (this.shogi.turn === 'b' && this.shogi.history.length) this.shogi.undo();
    } else {
      this.shogi.undo();
    }
    this.rebuildPieces();
    this.rebuildHands();
    const last = this.shogi.history[this.shogi.history.length - 1];
    if (last) this.markLast(last.from ? [last.from, last.to] : [last.to]);
    this.emit();
    this.swingTo(this.shogi.turn);
  }

  resign() {
    if (this.screen !== 'game' || this.over) return;
    const loser: Side = this.config.mode === 'computer' ? 'w' : this.shogi.turn;
    this.over = { winner: loser === 'w' ? 'b' : 'w', reason: 'Resignation' };
    sfx.over(true);
    this.emit();
  }

  newGame() { this.startGame(this.config); }

  private updateCheckMark() {
    const k = this.shogi.kingPos(this.shogi.turn);
    if (k) {
      this.checkMark.visible = true;
      this.checkMark.position.set(posX(k[1]), 0.135, posZ(k[0]));
      this.fx.ring(new THREE.Vector3(posX(k[1]), BOARD_Y + 0.03, posZ(k[0])), 0xe0403a, 1.1, 0.4);
      this.shake = { t: 0, dur: 0.25, amp: 0.03 };
    }
    sfx.check();
  }

  applySettings(s: Settings) {
    this.settings = s;
    sfx.enabled = s.sound;
    if (!s.cameraSwing && this.swing) { this.swing = null; this.controls.enabled = true; }
    this.emit();
  }

  // ---------- state ----------
  private fmtHand(h: Hand): string[] {
    return HAND_ORDER.filter(t => (h[t] ?? 0) > 0).map(t => `${SHOGI_CHAR[t]}×${h[t]}`);
  }

  private emit() {
    const hw = this.shogi.hands.w, hb = this.shogi.hands.b;
    const vw = HAND_ORDER.reduce((s, t) => s + (hw[t] ?? 0) * SHOGI_VALUE[t], 0);
    const vb = HAND_ORDER.reduce((s, t) => s + (hb[t] ?? 0) * SHOGI_VALUE[t], 0);
    this.onState({
      screen: this.screen,
      game: 'shogi',
      mode: this.config.mode,
      turn: this.shogi.turn,
      names: { w: '先手 Sente', b: '後手 Gote' },
      check: this.shogi.inCheck(this.shogi.turn),
      capturedByW: this.fmtHand(hw),
      capturedByB: this.fmtHand(hb),
      diff: Math.round((vw - vb) * 2) / 2,
      clockW: this.clockW,
      clockB: this.clockB,
      over: this.over,
      canUndo: this.screen === 'game' && !this.over && this.config.mode !== 'showcase' && this.shogi.history.length > 0,
      humanSide: this.config.mode === 'computer' ? 'w' : null
    });
  }

  // ---------- loop ----------
  private resize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.25);
    this.time += dt;
    const t = this.time;

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(k);
      if (k >= 1) { this.tweens.splice(i, 1); tw.done?.(); }
    }

    if (this.swing) {
      const s = this.swing;
      s.t += dt;
      const k = ease(Math.min(1, s.t / s.dur));
      const theta = s.from + (s.to - s.from) * k;
      const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(s.radius, s.phi, theta)).add(this.controls.target);
      this.camera.position.copy(pos);
      this.camera.lookAt(this.controls.target);
      if (s.t >= s.dur) { this.swing = null; this.controls.enabled = true; }
    } else {
      this.controls.autoRotate = this.screen === 'menu';
      this.controls.update();
    }

    if (this.screen === 'game' && !this.over && this.clockW !== null && this.clockB !== null) {
      const turn = this.shogi.turn;
      if (turn === 'w') this.clockW = Math.max(0, this.clockW - dt);
      else this.clockB = Math.max(0, this.clockB - dt);
      const wWhole = Math.ceil(this.clockW), bWhole = Math.ceil(this.clockB);
      if (wWhole !== this.lastWholeW || bWhole !== this.lastWholeB) {
        this.lastWholeW = wWhole; this.lastWholeB = bWhole;
        this.emit();
      }
      if (this.clockW <= 0 && !this.over) { this.over = { winner: 'b', reason: 'Timeout' }; sfx.over(true); this.emit(); }
      if (this.clockB <= 0 && !this.over) { this.over = { winner: 'w', reason: 'Timeout' }; sfx.over(true); this.emit(); }
    }

    this.selRing.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
    if (this.checkMark.visible) this.checkMark.scale.setScalar(1 + Math.sin(t * 7) * 0.06);

    if (this.shake) {
      this.shake.t += dt;
      const k = this.shake.t / this.shake.dur;
      const a = this.shake.amp * Math.max(0, 1 - k);
      this.camera.position.x += (Math.random() - 0.5) * 2 * a;
      this.camera.position.y += (Math.random() - 0.5) * 2 * a;
      if (k >= 1) this.shake = null;
    }

    this.fx.update(dt);
    this.env.update(t, dt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    this.controls.dispose();
    this.fx.clear();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
