// 西洋跳棋 3D 渲染与交互：深色格棋盘、圆饼棋子、连跳逐段动画、吃子特效、升王加冠。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildEnvironment, type Environment } from './environment';
import { buildCheckerModel, buildCheckerCrown } from './pieceModels';
import { FxSystem } from './fx';
import { makeBorderTexture, makeCoordTexture, makeGlowTexture, makeRingTexture } from './textures';
import { Checkers, type CkMove } from './checkers';
import { findBestCheckersMove } from './checkersAi';
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
  king: boolean;
  group: THREE.Group;
  model: THREE.Group;
  proxy: THREE.Mesh;
  glow: THREE.Mesh;
  phase: number;
}

interface Tween {
  t: number;
  dur: number;
  update: (k: number) => void;
  done?: () => void;
}

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export class CheckersGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private env: Environment;
  checkers = new Checkers();
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
  private hlGroup = new THREE.Group();
  private selRing: THREE.Mesh;
  private legalGroup = new THREE.Group();
  private lastGroup = new THREE.Group();
  private coordsGroup = new THREE.Group();

  // textures
  private texGlowW = makeGlowTexture('70,120,220');
  private texGlowB = makeGlowTexture('205,45,40');
  private texLegal = makeGlowTexture('70,220,130');
  private texCap = makeRingTexture('220,70,50');
  private texRing = makeRingTexture('232,196,110');
  private texLast = makeBorderTexture('226,150,60');

  // state
  screen: 'menu' | 'game' = 'menu';
  private config: GameConfig = { mode: 'local', minutes: 0 };
  settings: Settings = { cameraSwing: true, sound: true, coords: true, legalMoves: true };
  private selected: PieceObj | null = null;
  private legalForSelected: CkMove[] = [];
  locked = false;
  private over: { winner: Side | null; reason: string } | null = null;
  private capturedW: PieceObj[] = []; // b 方被吃子（白方战果）
  private capturedB: PieceObj[] = [];
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
    this.scene.add(this.hlGroup, this.legalGroup, this.lastGroup, this.coordsGroup, this.fx.group);

    this.selRing = this.flatPlane(this.texRing, 1.05, 0.17);
    this.selRing.visible = false;
    this.hlGroup.add(this.selRing);

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
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xe9e7e0, roughness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2231, roughness: 0.55 });
    const geo = new THREE.BoxGeometry(0.985, 0.14, 0.985);
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        // 可玩深色格：(r+f)%2===1（与引擎一致）
        const playable = (r + f) % 2 === 1;
        const tile = new THREE.Mesh(geo, playable ? darkMat : lightMat);
        tile.position.set(posX(f), 0.07, posZ(r));
        tile.receiveShadow = true;
        tile.userData.cell = keyOf(r, f);
        this.scene.add(tile);
        this.pickables.push(tile);
      }
    }
    // frame
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
  private makePiece(side: Side, king: boolean, r: number, f: number): PieceObj {
    const group = new THREE.Group();
    const model = buildCheckerModel(side, king);
    group.add(model);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.05),
      new THREE.MeshBasicMaterial({ map: side === 'w' ? this.texGlowW : this.texGlowB, transparent: true, depthWrite: false, opacity: 0.85 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    glow.renderOrder = 1;
    group.add(glow);

    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.7, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.y = 0.25;
    proxy.userData.cell = keyOf(r, f);
    group.add(proxy);
    this.pickables.push(proxy);

    group.position.set(posX(f), BOARD_Y, posZ(r));
    this.scene.add(group);
    return { r, f, side, king, group, model, proxy, glow, phase: Math.random() * 6.28 };
  }

  private removePieceObj(p: PieceObj) {
    this.scene.remove(p.group);
    const i = this.pickables.indexOf(p.proxy);
    if (i >= 0) this.pickables.splice(i, 1);
  }

  rebuildPieces() {
    for (const p of [...this.pieces.values()]) this.removePieceObj(p);
    for (const p of [...this.capturedW, ...this.capturedB]) this.removePieceObj(p);
    this.pieces.clear();
    this.capturedW = [];
    this.capturedB = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const pc = this.checkers.board[r][f];
        if (!pc) continue;
        this.pieces.set(keyOf(r, f), this.makePiece(pc.side, pc.king, r, f));
      }
    }
    this.fx.clear();
    this.clearHighlights();
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
    if (!hits.length) { this.clearSelection(); return; }
    const cell = hits[0].object.userData.cell as string;
    this.handleClick(cell);
  };

  private humanTurn(): boolean {
    if (this.screen !== 'game' || this.over || this.locked) return false;
    if (this.config.mode === 'showcase') return false;
    if (this.config.mode === 'computer' && this.checkers.turn === 'b') return false;
    return true;
  }

  private handleClick(cell: string) {
    if (!this.humanTurn()) return;
    if (this.selected) {
      const [tr, tf] = cell.split(',').map(Number);
      const mv = this.legalForSelected.find(m => m.path[m.path.length - 1][0] === tr && m.path[m.path.length - 1][1] === tf);
      if (mv) { this.doMove(mv); return; }
    }
    const piece = this.pieces.get(cell);
    if (piece && piece.side === this.checkers.turn) this.select(piece);
    else this.clearSelection();
  }

  private select(p: PieceObj) {
    this.clearSelection();
    this.selected = p;
    this.legalForSelected = this.checkers.legalMovesFrom(p.r, p.f);
    this.selRing.visible = true;
    this.selRing.position.set(posX(p.f), 0.17, posZ(p.r));
    if (this.settings.legalMoves) {
      for (const m of this.legalForSelected) {
        const [dr, df] = m.path[m.path.length - 1];
        const isCap = m.caps.length > 0;
        const d = this.flatPlane(isCap ? this.texCap : this.texLegal, isCap ? 0.95 : 0.8, 0.155);
        d.position.set(posX(df), 0.155, posZ(dr));
        d.userData.cell = keyOf(dr, df);
        this.legalGroup.add(d);
      }
    }
    sfx.select();
  }

  clearSelection() {
    this.selected = null;
    this.legalForSelected = [];
    this.selRing.visible = false;
    this.legalGroup.clear();
  }

  private clearHighlights() {
    this.clearSelection();
    this.lastGroup.clear();
  }

  // ---------- moving ----------
  private tween(dur: number, update: (k: number) => void, done?: () => void, delay = 0) {
    this.tweens.push({ t: -delay, dur, update, done });
  }

  private hopTo(p: PieceObj, x: number, z: number, dur: number, done?: () => void) {
    const sx = p.group.position.x, sz = p.group.position.z;
    let lastK = 0, trail = 0;
    this.tween(dur, k => {
      const e = ease(k);
      const h = Math.sin(e * Math.PI);
      p.group.position.x = sx + (x - sx) * e;
      p.group.position.z = sz + (z - sz) * e;
      p.group.position.y = BOARD_Y + h * (p.king ? 0.34 : 0.42);
      const press = 0.12 * Math.max((1 - k) * (1 - k), k * k);
      const stretch = 1 + h * 0.22;
      p.group.scale.set(
        (1 / Math.sqrt(stretch)) * (1 + press),
        stretch * (1 - press),
        (1 / Math.sqrt(stretch)) * (1 + press)
      );
      const dk = k - lastK;
      lastK = k;
      trail += dk;
      if (trail > 0.18 && k > 0.1 && k < 0.9) {
        trail = 0;
        this.fx.dust(p.group.position, 1);
      }
    }, () => {
      p.group.position.y = BOARD_Y;
      p.group.scale.set(1, 1, 1);
      this.fx.dust(new THREE.Vector3(p.group.position.x, BOARD_Y, p.group.position.z), 3);
      done?.();
    });
  }

  /** 执行一整着（滑步或完整连跳链）：逐段跳动动画，途经被吃子依次出局。 */
  doMove(mv: CkMove) {
    const mover = this.pieces.get(keyOf(mv.from[0], mv.from[1]));
    if (!mover) return;
    this.locked = true;
    this.clearSelection();

    // last-move markers：起点 + 沿途落点
    this.lastGroup.clear();
    const marks: [number, number][] = [mv.from, ...mv.path];
    for (const [r, f] of marks) {
      const d = this.flatPlane(this.texLast, 1.0, 0.145, 1);
      d.position.set(posX(f), 0.145, posZ(r));
      this.lastGroup.add(d);
    }

    const hopDur = mv.caps.length ? 0.38 : 0.5;
    const step = (i: number) => {
      const [r, f] = mv.path[i];
      this.hopTo(mover, posX(f), posZ(r), hopDur, () => {
        if (i < mv.caps.length) {
          this.vanquish(mv.caps[i].r, mv.caps[i].f);
          if (i + 1 < mv.path.length) { this.tween(0.06, () => { }, () => step(i + 1)); return; }
        }
        this.commitMove(mv, mover);
      });
    };
    step(0);
  }

  /** 被吃子出局：移出棋盘映射 → 飞进墓地 → 打击特效。 */
  private vanquish(r: number, f: number) {
    const key = keyOf(r, f);
    const v = this.pieces.get(key);
    if (!v) return;
    this.pieces.delete(key);
    const list = v.side === 'b' ? this.capturedW : this.capturedB;
    const i = list.length;
    list.push(v);
    const xBase = v.side === 'b' ? 5.7 : -5.7;
    const col = Math.floor(i / 8);
    const x = xBase + (v.side === 'b' ? col : -col) * 0.9;
    const z = -3.5 + (i % 8) * 1.0;
    this.hopTo(v, x, z, 0.6);
    (v.glow.material as THREE.MeshBasicMaterial).opacity = 0.55;
    const hitPos = new THREE.Vector3(posX(f), BOARD_Y + 0.05, posZ(r));
    this.fx.burst(hitPos, v.side === 'w' ? 0xffd9a0 : 0x9ab8e8, 12, { speed: 2.0, up: 1.1 });
    this.fx.ring(hitPos, 0xe8c56a, 1.8, 0.42);
    this.shake = { t: 0, dur: 0.3, amp: 0.05 };
    sfx.capture();
  }

  private commitMove(mv: CkMove, mover: PieceObj) {
    const [fr, ff] = mv.from;
    const [tr, tf] = mv.path[mv.path.length - 1];
    this.pieces.delete(keyOf(fr, ff));
    mover.r = tr; mover.f = tf;
    mover.proxy.userData.cell = keyOf(tr, tf);
    this.pieces.set(keyOf(tr, tf), mover);

    this.checkers.make(mv);
    if (!mv.caps.length) sfx.move();
    if (mv.promoted) {
      mover.king = true;
      const crown = buildCheckerCrown();
      crown.scale.setScalar(0.05);
      mover.model.add(crown);
      this.tween(0.4, k => crown.scale.setScalar(0.05 + 0.95 * ease(k)));
      this.fx.ring(new THREE.Vector3(posX(tf), BOARD_Y + 0.2, posZ(tr)), 0xf0d080, 1.4, 0.5);
      sfx.check();
    }

    this.over = this.checkers.isOver();
    if (this.over) sfx.over(this.over.winner !== null);

    this.locked = false;
    this.emit();
    if (!this.over) {
      this.swingTo(this.checkers.turn);
      this.maybeAI();
    }
  }

  // ---------- AI ----------
  private maybeAI() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.screen !== 'game' || this.over) return;
    const turn = this.checkers.turn;
    const isAI = this.config.mode === 'showcase' || (this.config.mode === 'computer' && turn === 'b');
    if (!isAI) return;
    const level = this.config.level ?? 2;
    const jitter = this.config.mode === 'showcase' ? 60 : 0;
    this.aiTimer = setTimeout(() => {
      if (this.over || this.screen !== 'game') return;
      const mv = findBestCheckersMove(this.checkers, { level, jitter });
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
    this.swingTo(this.checkers.turn);
  }

  // ---------- public API ----------
  startGame(config: GameConfig) {
    this.config = config;
    this.checkers = new Checkers();
    this.over = null;
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
    this.swingTo('w');
  }

  toMenu() {
    this.screen = 'menu';
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.over = null;
    this.controls.autoRotate = true;
    this.emit();
  }

  undo() {
    if (this.screen !== 'game' || this.over || this.locked) return;
    if (this.config.mode === 'showcase') return;
    if (!this.checkers.history.length) return;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.checkers.undo();
    if (this.config.mode === 'computer' && this.checkers.turn === 'b' && this.checkers.history.length) this.checkers.undo();
    this.rebuildPieces();
    const hist = this.checkers.history;
    if (hist.length) {
      const lm = hist[hist.length - 1];
      for (const [r, f] of [lm.from, ...lm.path]) {
        const d = this.flatPlane(this.texLast, 1.0, 0.145, 1);
        d.position.set(posX(f), 0.145, posZ(r));
        this.lastGroup.add(d);
      }
    }
    this.emit();
    this.swingTo(this.checkers.turn);
  }

  resign() {
    if (this.screen !== 'game' || this.over) return;
    const loser: Side = this.config.mode === 'computer' ? 'w' : this.checkers.turn;
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
    this.emit();
  }

  // ---------- state ----------
  private emit() {
    const cw = this.capturedW;
    const cb = this.capturedB;
    const nW = this.checkers.countPieces('w');
    const nB = this.checkers.countPieces('b');
    this.onState({
      screen: this.screen,
      game: 'checkers',
      mode: this.config.mode,
      turn: this.checkers.turn,
      names: { w: 'Ivory', b: 'Obsidian' },
      check: false,
      capturedByW: [...cw].sort((a, b) => Number(b.king) - Number(a.king)).map(p => p.king ? '◉' : '●'),
      capturedByB: [...cb].sort((a, b) => Number(b.king) - Number(a.king)).map(p => p.king ? '◉' : '●'),
      diff: (nW.men + nW.kings) - (nB.men + nB.kings),
      clockW: this.clockW,
      clockB: this.clockB,
      over: this.over,
      canUndo: this.screen === 'game' && !this.over && this.config.mode !== 'showcase' && this.checkers.history.length > 0,
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

    // clocks
    if (this.screen === 'game' && !this.over && this.clockW !== null && this.clockB !== null) {
      const turn = this.checkers.turn;
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

    // idle life: ring pulse + subtle piece breathing
    this.selRing.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
    for (const p of this.pieces.values()) {
      p.group.position.y = BOARD_Y + Math.sin(t * 2 + p.phase) * 0.008;
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
