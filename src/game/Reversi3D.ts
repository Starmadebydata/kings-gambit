// 黑白棋 3D 渲染与交互：绿色棋盘、双色圆盘棋子、落子下坠、翻子波浪动画、pass 通告。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildEnvironment, type Environment } from './environment';
import { buildReversiModel } from './pieceModels';
import { FxSystem } from './fx';
import { makeBorderTexture, makeCoordTexture, makeGlowTexture, makeRingTexture } from './textures';
import { Reversi, type RvMove } from './reversi';
import { findBestReversiMove } from './reversiAi';
import { sfx } from './audio';
import type { GameConfig, HudState, Settings, Side } from './types';

const BOARD_Y = 0.14;

const posX = (f: number) => f - 3.5;
const posZ = (r: number) => 3.5 - r;
const keyOf = (r: number, f: number) => `${r},${f}`;

interface PieceObj {
  r: number;
  f: number;
  side: Side;
  group: THREE.Group;
  model: THREE.Group;
  glow: THREE.Mesh;
  meshes: THREE.Mesh[]; // 可拾取的实体网格
  phase: number;
  animating: boolean;
}

interface Tween {
  t: number;
  dur: number;
  update: (k: number) => void;
  done?: () => void;
}

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export class ReversiGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private env: Environment;
  reversi = new Reversi();
  private pieces = new Map<string, PieceObj>();
  private pickables: THREE.Object3D[] = [];
  private tweens: Tween[] = [];
  private fx = new FxSystem();
  private shake: { t: number; dur: number; amp: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private raf = 0;
  private time = 0;

  // highlights
  private legalGroup = new THREE.Group();
  private lastGroup = new THREE.Group();
  private coordsGroup = new THREE.Group();

  // textures
  private texGlowW = makeGlowTexture('205,140,45');
  private texGlowB = makeGlowTexture('70,120,220');
  private texLegal = makeGlowTexture('120,230,150');
  private texRing = makeRingTexture('232,196,110');
  private texLast = makeBorderTexture('226,150,60');

  // state
  screen: 'menu' | 'game' = 'menu';
  private config: GameConfig = { mode: 'local', minutes: 0 };
  settings: Settings = { cameraSwing: true, sound: true, coords: true, legalMoves: true };
  locked = false;
  over: { winner: Side | null; reason: string } | null = null;
  private note: string | null = null;
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
    this.camera.position.set(0, 7.2, 9.8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.3, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 20;
    this.controls.minPolarAngle = 0.45;
    this.controls.maxPolarAngle = 1.32;
    this.controls.autoRotateSpeed = 0.7;

    this.env = buildEnvironment(this.scene);
    this.buildBoard();
    this.scene.add(this.legalGroup, this.lastGroup, this.coordsGroup, this.fx.group);

    this.rebuildPieces();

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.emit();
    this.loop();
  }

  // ---------- scene building ----------
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
    // 经典黑白棋绿色盘面：64 格同色，格间留缝露出深色底衬作网格
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x1f6b41, roughness: 0.5 });
    const geo = new THREE.BoxGeometry(0.96, 0.14, 0.96);
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const tile = new THREE.Mesh(geo, greenMat);
        tile.position.set(posX(f), 0.07, posZ(r));
        tile.receiveShadow = true;
        tile.userData.cell = keyOf(r, f);
        this.scene.add(tile);
        this.pickables.push(tile);
      }
    }
    // 底衬 + frame
    const base = new THREE.Mesh(new THREE.BoxGeometry(8.04, 0.1, 8.04), new THREE.MeshStandardMaterial({ color: 0x0f1310, roughness: 0.9 }));
    base.position.y = 0.02;
    this.scene.add(base);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x171b25, roughness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xb98f3e, roughness: 0.35, metalness: 0.75 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(10.7, 0.2, 10.7), frameMat);
    frame.position.y = -0.02;
    frame.receiveShadow = true;
    this.scene.add(frame);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.14, 11.2), new THREE.MeshStandardMaterial({ color: 0x10131b, roughness: 0.9 }));
    rim.position.y = -0.07;
    this.scene.add(rim);
    const trims: [number, number, number, number][] = [
      [10.74, 0.05, 0.14, 5.36], [10.74, 0.05, 0.14, -5.36], [0.14, 0.05, 10.74, 5.36], [0.14, 0.05, 10.74, -5.36]
    ];
    for (const [w, h, d, off] of trims) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat);
      const horizontal = w > d;
      t.position.set(horizontal ? 0 : off, 0.09, horizontal ? off : 0);
      this.scene.add(t);
    }
    // coordinates
    const files = 'abcdefgh';
    for (let i = 0; i < 8; i++) {
      this.addCoord(files[i], i - 3.5, 5.05, 0);
      this.addCoord(files[i], i - 3.5, -5.05, Math.PI);
      this.addCoord(String(8 - i), -5.05, i - 3.5, Math.PI / 2);
      this.addCoord(String(8 - i), 5.05, i - 3.5, -Math.PI / 2);
    }
  }

  private addCoord(ch: string, x: number, z: number, rotZ: number) {
    const t = makeCoordTexture(ch);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })
    );
    m.rotation.set(-Math.PI / 2, 0, rotZ);
    m.position.set(x, 0.085, z);
    this.coordsGroup.add(m);
  }

  // ---------- pieces ----------
  private collectMeshes(group: THREE.Group, cell: string): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.userData.cell = cell;
        o.castShadow = true;
        meshes.push(o);
      }
    });
    return meshes;
  }

  private makePiece(side: Side, r: number, f: number, fromY?: number): PieceObj {
    const group = new THREE.Group();
    const model = buildReversiModel(side);
    group.add(model);

    // 阵营光晕（与其他棋类一致）：Ivory 金 / Obsidian 蓝
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.35),
      new THREE.MeshBasicMaterial({ map: side === 'w' ? this.texGlowW : this.texGlowB, transparent: true, depthWrite: false, opacity: 0.8 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    glow.renderOrder = 1;
    group.add(glow);

    group.position.set(posX(f), fromY ?? BOARD_Y, posZ(r));
    this.scene.add(group);
    const p: PieceObj = { r, f, side, group, model, glow, meshes: [], phase: Math.random() * 6.28, animating: false };
    p.meshes = this.collectMeshes(model, keyOf(r, f));
    this.pickables.push(...p.meshes);
    return p;
  }

  private removePieceObj(p: PieceObj) {
    this.scene.remove(p.group);
    for (const m of p.meshes) {
      const i = this.pickables.indexOf(m);
      if (i >= 0) this.pickables.splice(i, 1);
    }
  }

  /** 翻面：换成另一色的圆盘模型（pickables 同步更新）。 */
  private swapModel(p: PieceObj, side: Side) {
    if (p.side === side) return;
    p.group.remove(p.model);
    for (const m of p.meshes) {
      const i = this.pickables.indexOf(m);
      if (i >= 0) this.pickables.splice(i, 1);
    }
    p.model = buildReversiModel(side);
    p.group.add(p.model);
    p.meshes = this.collectMeshes(p.model, keyOf(p.r, p.f));
    this.pickables.push(...p.meshes);
    (p.glow.material as THREE.MeshBasicMaterial).map = side === 'w' ? this.texGlowW : this.texGlowB;
    p.side = side;
  }

  rebuildPieces() {
    for (const p of [...this.pieces.values()]) this.removePieceObj(p);
    this.pieces.clear();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const side = this.reversi.board[r][f];
        if (!side) continue;
        this.pieces.set(keyOf(r, f), this.makePiece(side, r, f));
      }
    }
    this.fx.clear();
    this.lastGroup.clear();
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
    if (!hits.length) return;
    const cell = hits[0].object.userData.cell as string;
    this.handleClick(cell);
  };

  private humanTurn(): boolean {
    if (this.screen !== 'game' || this.over || this.locked) return false;
    if (this.config.mode === 'showcase') return false;
    if (this.config.mode === 'computer' && this.reversi.turn === 'b') return false;
    return true;
  }

  private handleClick(cell: string) {
    if (!this.humanTurn()) return;
    const [r, f] = cell.split(',').map(Number);
    const mv = this.reversi.legalMoves(this.reversi.turn).find(m => m.r === r && m.f === f);
    if (mv) this.doMove(mv);
  }

  /** 刷新当前行棋方的合法落点幽灵标记。 */
  private refreshLegal() {
    this.legalGroup.clear();
    if (!this.settings.legalMoves || !this.humanTurn()) return;
    for (const m of this.reversi.legalMoves(this.reversi.turn)) {
      const d = this.flatPlane(this.texLegal, 0.55, 0.155);
      d.position.set(posX(m.f), 0.155, posZ(m.r));
      d.userData.cell = keyOf(m.r, m.f);
      this.legalGroup.add(d);
    }
  }

  // ---------- moving ----------
  private tween(dur: number, update: (k: number) => void, done?: () => void, delay = 0) {
    this.tweens.push({ t: -delay, dur, update, done });
  }

  /** 执行一整着：新子下坠 → 被夹子依次翻面 → 提交。 */
  doMove(mv: RvMove) {
    if (this.reversi.board[mv.r][mv.f]) return;
    this.locked = true;
    this.note = null;
    this.legalGroup.clear();

    // last-move marker
    this.lastGroup.clear();
    const d = this.flatPlane(this.texLast, 1.0, 0.145, 1);
    d.position.set(posX(mv.f), 0.145, posZ(mv.r));
    this.lastGroup.add(d);

    const side = this.reversi.turn;
    const p = this.makePiece(side, mv.r, mv.f, 2.4);
    p.animating = true;
    this.pieces.set(keyOf(mv.r, mv.f), p);
    sfx.move();

    // 下坠
    this.tween(0.38, k => {
      p.group.position.y = 2.4 - (2.4 - BOARD_Y) * ease(k);
      p.group.scale.setScalar(1 + (1 - k) * 0.15);
    }, () => {
      p.group.position.y = BOARD_Y;
      p.group.scale.setScalar(1);
      p.animating = false;
      this.fx.dust(new THREE.Vector3(posX(mv.f), BOARD_Y, posZ(mv.r)), 3);
      this.startFlips(mv, side);
    });
  }

  /** 被夹子波浪式翻面，全部完成后提交。 */
  private startFlips(mv: RvMove, side: Side) {
    if (!mv.flips.length) { this.commitMove(mv); return; }
    let remaining = mv.flips.length;
    mv.flips.forEach(([r, f], i) => {
      const target = this.pieces.get(keyOf(r, f));
      if (!target) { if (--remaining === 0) this.commitMove(mv); return; }
      target.animating = true;
      let swapped = false;
      this.tween(0.42, k => {
        target.group.position.y = BOARD_Y + Math.sin(k * Math.PI) * 0.28;
        // 前半段压扁，后半段复原；过顶点时换色
        target.model.scale.y = k < 0.5
          ? Math.max(0.06, 1 - k * 1.9)
          : Math.max(0.06, (k - 0.5) * 1.9 + 0.06);
        if (k >= 0.5 && !swapped) { swapped = true; this.swapModel(target, side); }
      }, () => {
        target.model.scale.y = 1;
        target.group.position.y = BOARD_Y;
        target.animating = false;
        this.fx.ring(new THREE.Vector3(posX(f), BOARD_Y + 0.08, posZ(r)), side === 'w' ? 0xf0ead0 : 0x9ab8e8, 0.9, 0.3);
        sfx.capture();
        if (--remaining === 0) this.commitMove(mv);
      }, i * 0.06);
    });
  }

  private commitMove(mv: RvMove) {
    this.reversi.make(mv);
    this.over = this.reversi.isOver();

    // 对方无着 → 自动 pass（记入 history 以便 undo）；双 pass 则终局
    if (!this.over && !this.reversi.legalMoves(this.reversi.turn).length) {
      const passer = this.reversi.turn;
      this.reversi.make({ r: -1, f: -1, flips: [], pass: true });
      this.note = `${passer === 'w' ? 'Ivory' : 'Obsidian'} 无子可落 · Pass`;
      this.over = this.reversi.isOver();
      sfx.check();
    }
    if (this.over) sfx.over(this.over.winner !== null);

    this.locked = false;
    this.refreshLegal();
    this.emit();
    if (!this.over) {
      this.swingTo(this.reversi.turn);
      this.maybeAI();
    }
  }

  // ---------- AI ----------
  private maybeAI() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.screen !== 'game' || this.over) return;
    const turn = this.reversi.turn;
    const isAI = this.config.mode === 'showcase' || (this.config.mode === 'computer' && turn === 'b');
    if (!isAI) return;
    const level = this.config.level ?? 2;
    this.aiTimer = setTimeout(() => {
      if (this.over || this.screen !== 'game' || this.locked) return;
      const mv = findBestReversiMove(this.reversi, { level, jitter: this.config.mode === 'showcase' });
      if (mv) this.doMove(mv);
    }, this.config.mode === 'showcase' ? 900 : 650);
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
    this.swingTo(this.reversi.turn);
  }

  // ---------- public API ----------
  startGame(config: GameConfig) {
    this.config = config;
    this.reversi = new Reversi();
    this.over = null;
    this.note = null;
    this.locked = false;
    this.camFlip = false;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.clockW = config.minutes > 0 ? config.minutes * 60 : null;
    this.clockB = config.minutes > 0 ? config.minutes * 60 : null;
    this.lastWholeW = this.clockW ?? -1; this.lastWholeB = this.clockB ?? -1;
    this.rebuildPieces();
    this.screen = 'game';
    this.controls.autoRotate = false;
    sfx.unlock();
    sfx.start();
    this.emit();
    this.swingTo('b'); // 黑先
    this.maybeAI();
  }

  toMenu() {
    this.screen = 'menu';
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.over = null;
    this.note = null;
    this.controls.autoRotate = true;
    this.emit();
  }

  undo() {
    if (this.screen !== 'game' || this.over || this.locked) return;
    if (this.config.mode === 'showcase') return;
    if (!this.reversi.history.length) return;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.note = null;
    if (this.config.mode === 'computer') {
      // 退到人类（w）最近一着之前；跳过 AI 着与 pass 着
      while (this.reversi.history.length) {
        const m = this.reversi.undo()!;
        if (!m.pass && this.reversi.turn === 'w') break;
      }
    } else {
      // 本地双人：退回最近一手实际落子（跳过 pass）
      while (this.reversi.history.length) {
        const m = this.reversi.undo()!;
        if (!m.pass) break;
      }
    }
    this.rebuildPieces();
    const hist = this.reversi.history;
    if (hist.length) {
      const lm = hist[hist.length - 1];
      if (!lm.pass) {
        const d = this.flatPlane(this.texLast, 1.0, 0.145, 1);
        d.position.set(posX(lm.f), 0.145, posZ(lm.r));
        this.lastGroup.add(d);
      }
    }
    this.refreshLegal();
    this.emit();
    this.swingTo(this.reversi.turn);
  }

  resign() {
    if (this.screen !== 'game' || this.over) return;
    const loser: Side = this.config.mode === 'computer' ? 'w' : this.reversi.turn;
    this.over = { winner: loser === 'w' ? 'b' : 'w', reason: 'Resignation' };
    sfx.over(true);
    this.emit();
  }

  newGame() { this.startGame(this.config); }

  applySettings(s: Settings) {
    this.settings = s;
    sfx.enabled = s.sound;
    this.coordsGroup.visible = s.coords;
    if (!s.cameraSwing && this.swing) { this.swing = null; this.controls.enabled = true; }
    this.refreshLegal();
    this.emit();
  }

  // ---------- state ----------
  private emit() {
    const c = this.reversi.counts();
    this.onState({
      screen: this.screen,
      game: 'reversi',
      mode: this.config.mode,
      turn: this.reversi.turn,
      names: { w: 'Ivory', b: 'Obsidian' },
      check: false,
      capturedByW: [`○ ×${c.w}`],
      capturedByB: [`● ×${c.b}`],
      diff: c.w - c.b,
      clockW: this.clockW,
      clockB: this.clockB,
      over: this.over,
      canUndo: this.screen === 'game' && !this.over && this.config.mode !== 'showcase' && this.reversi.history.length > 0,
      humanSide: this.config.mode === 'computer' ? 'w' : null,
      note: this.note
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

    // clocks
    if (this.screen === 'game' && !this.over && this.clockW !== null && this.clockB !== null) {
      const turn = this.reversi.turn;
      if (turn === 'w') this.clockW = Math.max(0, this.clockW - dt);
      else this.clockB = Math.max(0, this.clockB - dt);
      const wWhole = Math.ceil(this.clockW), bWhole = Math.ceil(this.clockB);
      if (wWhole !== this.lastWholeW || bWhole !== this.lastWholeB) {
        this.lastWholeW = wWhole; this.lastWholeB = bWhole;
        this.emit();
      }
      if (this.clockW <= 0) { this.over = { winner: 'b', reason: 'Timeout' }; sfx.over(true); this.emit(); }
      if (this.clockB <= 0) { this.over = { winner: 'w', reason: 'Timeout' }; sfx.over(true); this.emit(); }
    }

    // idle life: legal dot pulse + subtle piece breathing（动画中的棋子跳过呼吸，避免覆盖 tween）
    const pulse = 1 + Math.sin(t * 5) * 0.12;
    for (const c of this.legalGroup.children) c.scale.setScalar(pulse);
    for (const p of this.pieces.values()) {
      if (!p.animating) p.group.position.y = BOARD_Y + Math.sin(t * 2 + p.phase) * 0.008;
    }

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
