import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Xiangqi, XqMove, XQ_CHAR, XQ_VALUE } from './xiangqi';
import type { XqBoard } from './xiangqi';
import { buildEnvironment, type Environment } from './environment';
import { buildXqModel, XQ_HEIGHT, type XqType } from './pieceModels';
import { FxSystem } from './fx';
import { makeBorderTexture, makeGlyphBadge, makeGlowTexture, makeLabelTexture, makeRingTexture, makeRiverTexture, makeWoodTexture } from './textures';
import { findBestXqMove } from './xqAi';
import { sfx } from './audio';
import { treeFromGame, emptyTree, parseNotationText, exportScriptText, noteForMove, treeMainline } from './famousGame';
import type { FamousGame, ScriptNode, ScriptTree } from './famousGame';
import type { GameConfig, HudState, Settings, Side } from './types';

const BOARD_Y = 0.1;
const posX = (f: number) => f - 4;
const posZ = (r: number) => r - 4.5;
const keyOf = (r: number, f: number) => `${r},${f}`;

interface PieceObj {
  r: number; f: number;
  type: XqType; side: Side;
  group: THREE.Group;
  badge: THREE.Sprite;
  proxy: THREE.Mesh;
  glow: THREE.Mesh;
  phase: number;
  badgeY: number;
}

interface Tween { t: number; dur: number; update: (k: number) => void; done?: () => void }
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export class XqGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private env: Environment;
  private xq = new Xiangqi();
  private pieces = new Map<string, PieceObj>();
  private pickables: THREE.Object3D[] = [];
  private tweens: Tween[] = [];
  private fx = new FxSystem();
  private shake: { t: number; dur: number; amp: number } | null = null;
  private shellFx: THREE.Group | null = null; // 飞行中的炮弹（清理钩子用）
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private raf = 0;
  private time = 0;

  private hlGroup = new THREE.Group();
  private selRing: THREE.Mesh;
  private legalGroup = new THREE.Group();
  private lastGroup = new THREE.Group();
  private checkMark: THREE.Mesh;

  private texGlowR = makeGlowTexture('205,45,40');
  private texGlowB = makeGlowTexture('70,120,220');
  private texLegal = makeGlowTexture('70,220,130');
  private texCap = makeRingTexture('220,70,50');
  private texRing = makeRingTexture('232,196,110');
  private texLast = makeBorderTexture('226,150,60');
  private texCheck = makeBorderTexture('230,60,50');
  private badgeCache = new Map<string, THREE.CanvasTexture>();

  screen: 'menu' | 'game' = 'menu';
  private config: GameConfig = { mode: 'local', minutes: 0 };
  settings: Settings = { cameraSwing: true, sound: true, coords: true, legalMoves: true };
  private selected: PieceObj | null = null;
  private legalForSelected: XqMove[] = [];
  private locked = false;
  private over: { winner: Side | null; reason: string } | null = null;
  private capturedW: PieceObj[] = [];
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

  // script (famous game study / playback / variation tree)
  private script: {
    tree: ScriptTree;
    path: number[]; // node indices from root (0) to the current node
    i: number; // current depth = path.length - 1
    playing: boolean;
    main: number[]; // mainline node indices (for “current ply on mainline” UI state)
  } | null = null;
  // board setup (摆盘研究) — freely edit a position, then study from it
  private setup: { board: XqBoard; selected: [number, number] | null } | null = null;
  private scriptTimer: ReturnType<typeof setTimeout> | null = null;
  private replayNote: string | null = null;
  private pendingOver: { winner: Side | null; reason: string } | null = null;

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
    this.camera.position.set(0, 7.6, 10.4);

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
    this.scene.add(this.hlGroup, this.legalGroup, this.lastGroup, this.fx.group);

    this.selRing = this.flatPlane(this.texRing, 1.0, 0.14);
    this.selRing.visible = false;
    this.checkMark = this.flatPlane(this.texCheck, 0.98, 0.135);
    this.checkMark.visible = false;
    this.hlGroup.add(this.selRing, this.checkMark);

    this.rebuildPieces();

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
    const woodMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.75 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xb98f3e, roughness: 0.4, metalness: 0.6 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.2, 11.4), woodMat);
    slab.position.y = -0.02;
    slab.receiveShadow = true;
    this.scene.add(slab);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.14, 12.0), new THREE.MeshStandardMaterial({ color: 0x10131b, roughness: 0.9 }));
    rim.position.y = -0.08;
    this.scene.add(rim);
    const base = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.22, 12.6), new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.95, flatShading: true }));
    base.position.y = -0.24;
    this.scene.add(base);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xb98f3e, roughness: 0.35, metalness: 0.75 });
    const trims: [number, number, number, number][] = [
      [10.66, 0.05, 0.14, 5.66], [10.66, 0.05, 0.14, -5.66], [0.14, 0.05, 11.36, 5.32], [0.14, 0.05, 11.36, -5.32]
    ];
    for (const [w, h, d, off] of trims) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat);
      const horizontal = w > d;
      t.position.set(horizontal ? 0 : off, 0.06, horizontal ? off : 0);
      this.scene.add(t);
    }
    // corner brackets
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bx = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.12), goldMat);
      bx.position.set(sx * 4.92, 0.08, sz * 5.52);
      const bz = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.7), goldMat);
      bz.position.set(sx * 5.2, 0.08, sz * 5.24);
      this.scene.add(bx, bz);
    }

    // grid lines
    for (let r = 0; r < 10; r++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(8.08, 0.02, 0.06), lineMat);
      line.position.set(0, 0.09, posZ(r));
      this.scene.add(line);
    }
    for (let f = 0; f < 9; f++) {
      if (f === 0 || f === 8) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 9.06), lineMat);
        line.position.set(posX(f), 0.09, 0);
        this.scene.add(line);
      } else {
        for (const cz of [-2.5, 2.5]) {
          const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 4.0), lineMat);
          line.position.set(posX(f), 0.09, cz);
          this.scene.add(line);
        }
      }
    }
    // river
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 0.94),
      new THREE.MeshBasicMaterial({ map: makeRiverTexture(), transparent: true, opacity: 0.98, depthWrite: false })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.095;
    this.scene.add(river);
    const mkLabel = (text: string, x: number, rot: number) => {
      const t = makeLabelTexture(text, '#d9b45c', 72);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.67), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.rotation.set(-Math.PI / 2, 0, rot);
      m.position.set(x, 0.1, 0);
      this.scene.add(m);
    };
    mkLabel('楚 河', -2.1, Math.PI);
    mkLabel('漢 界', 2.1, 0);

    // intersection inlays + file numerals
    const dotGeo = new THREE.CylinderGeometry(0.085, 0.1, 0.014, 8);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0x0b0805, roughness: 0.55 });
    const dots = new THREE.InstancedMesh(dotGeo, dotMat, 90);
    const m4 = new THREE.Matrix4();
    let di = 0;
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      m4.setPosition(posX(f), 0.082, posZ(r));
      dots.setMatrixAt(di++, m4);
    }
    this.scene.add(dots);
    const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const mkNum = (text: string, x: number, z: number, rot: number) => {
      const t = makeLabelTexture(text, '#a8823e', 96);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.rotation.set(-Math.PI / 2, 0, rot);
      m.position.set(x, 0.093, z);
      this.scene.add(m);
    };
    for (let f = 0; f < 9; f++) {
      mkNum(NUM[f], posX(f), 5.35, 0);
      mkNum(NUM[8 - f], posX(f), -5.35, Math.PI);
    }

    // palace diagonals
    for (const cz of [-3.5, 3.5]) {
      for (const rot of [Math.PI / 4, -Math.PI / 4]) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 2.83), lineMat);
        d.position.set(0, 0.09, cz);
        d.rotation.y = rot;
        this.scene.add(d);
      }
    }

    // invisible pick planes at intersections
    const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const pickGeo = new THREE.PlaneGeometry(0.98, 0.98);
    for (let r = 0; r < 10; r++) {
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
  private badgeTex(type: XqType, side: Side) {
    const key = type + side;
    let t = this.badgeCache.get(key);
    if (!t) {
      const ring = side === 'w' ? '#d9b45c' : '#7f9dbd';
      const ink = side === 'w' ? '#ff5a3c' : '#eef4fa';
      t = makeGlyphBadge(XQ_CHAR[side][type], ring, ink, side);
      this.badgeCache.set(key, t);
    }
    return t;
  }

  private makePiece(type: XqType, side: Side, r: number, f: number): PieceObj {
    const group = new THREE.Group();
    group.add(buildXqModel(type, side));
    group.rotation.y = side === 'w' ? Math.PI : 0; // face the enemy

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshBasicMaterial({ map: side === 'w' ? this.texGlowR : this.texGlowB, transparent: true, depthWrite: false, opacity: 0.85 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    glow.renderOrder = 1;
    group.add(glow);

    const badgeY = XQ_HEIGHT[type] + 0.32;
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.badgeTex(type, side), transparent: true, depthWrite: false }));
    badge.scale.set(0.42, 0.5, 1);
    badge.position.y = badgeY;
    group.add(badge);

    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.2, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.y = 0.6;
    proxy.userData.key = keyOf(r, f);
    group.add(proxy);
    this.pickables.push(proxy);

    group.position.set(posX(f), BOARD_Y, posZ(r));
    this.scene.add(group);
    return { r, f, type, side, group, badge, proxy, glow, phase: Math.random() * 6.28, badgeY };
  }

  private removePieceObj(p: PieceObj) {
    this.scene.remove(p.group);
    const i = this.pickables.indexOf(p.proxy);
    if (i >= 0) this.pickables.splice(i, 1);
  }

  rebuildPieces() {
    if (this.shellFx) { this.scene.remove(this.shellFx); this.shellFx = null; }
    for (const p of [...this.pieces.values()]) this.removePieceObj(p);
    for (const p of [...this.capturedW, ...this.capturedB]) this.removePieceObj(p);
    this.pieces.clear();
    this.capturedW = [];
    this.capturedB = [];
    for (let r = 0; r < 10; r++) {
      for (let f = 0; f < 9; f++) {
        const pc = this.xq.board[r][f];
        if (pc) this.pieces.set(keyOf(r, f), this.makePiece(pc.type, pc.side, r, f));
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
    const key = hits[0].object.userData.key as string;
    this.handleClick(key);
  };

  private humanTurn(): boolean {
    if (this.screen !== 'game' || this.over || this.locked) return false;
    if (this.setup) return false;
    // 打谱研究（非自动演示）：允许自由走子形成变着
    if (this.script) return !this.script.playing && !this.pendingOver;
    if (this.config.mode === 'showcase') return false;
    if (this.config.mode === 'computer' && this.xq.turn === 'b') return false;
    return true;
  }

  private handleClick(key: string) {
    if (this.setup) { this.handleSetupClick(key); return; }
    if (!this.humanTurn()) return;
    if (this.selected) {
      const [r, f] = key.split(',').map(Number);
      const mv = this.legalForSelected.find(m => m.to[0] === r && m.to[1] === f);
      if (mv) { this.doMove(mv); return; }
    }
    const piece = this.pieces.get(key);
    if (piece && piece.side === this.xq.turn) this.select(piece);
    else this.clearSelection();
  }

  private select(p: PieceObj) {
    this.clearSelection();
    this.selected = p;
    this.legalForSelected = this.xq.legalMovesFrom(p.r, p.f);
    this.selRing.visible = true;
    this.selRing.position.set(posX(p.f), 0.14, posZ(p.r));
    if (this.settings.legalMoves) {
      for (const m of this.legalForSelected) {
        const isCap = !!m.capture;
        const d = this.flatPlane(isCap ? this.texCap : this.texLegal, isCap ? 0.9 : 0.72, 0.125);
        d.position.set(posX(m.to[1]), 0.125, posZ(m.to[0]));
        this.legalGroup.add(d);
      }
    }
    sfx.select();
  }

  private clearSelection() {
    this.selected = null;
    this.legalForSelected = [];
    this.selRing.visible = false;
    this.legalGroup.clear();
  }

  private clearHighlights() {
    this.clearSelection();
    this.lastGroup.clear();
    this.checkMark.visible = false;
  }

  // ---------- moving ----------
  private tween(dur: number, update: (k: number) => void, done?: () => void) {
    this.tweens.push({ t: 0, dur, update, done });
  }

  private hopTo(p: PieceObj, x: number, z: number, dur: number, done?: () => void) {
    const sx = p.group.position.x, sz = p.group.position.z;
    if (Math.hypot(x - sx, z - sz) > 0.01) p.group.rotation.y = Math.atan2(x - sx, z - sz);
    let lastK = 0, trail = 0;
    this.tween(dur, k => {
      const e = ease(k);
      const h = Math.sin(e * Math.PI);
      p.group.position.x = sx + (x - sx) * e;
      p.group.position.z = sz + (z - sz) * e;
      p.group.position.y = BOARD_Y + h * 0.3;
      // squash & stretch：顶点拉长、起落压扁
      const press = 0.12 * Math.max((1 - k) * (1 - k), k * k);
      const stretch = 1 + h * 0.3;
      p.group.scale.set(
        (1 / Math.sqrt(stretch)) * (1 + press),
        stretch * (1 - press),
        (1 / Math.sqrt(stretch)) * (1 + press)
      );
      p.group.rotation.x = -h * 0.32; // 沿移动方向俯仰
      // 跳跃尾迹：沿途留一点尘土
      const dk = k - lastK;
      lastK = k;
      trail += dk;
      if (trail > 0.14 && k > 0.1 && k < 0.9) {
        trail = 0;
        this.fx.dust(p.group.position, 1);
      }
    }, () => {
      p.group.position.y = BOARD_Y;
      p.group.scale.set(1, 1, 1);
      p.group.rotation.x = 0;
      // 落点反馈：尘土 + 小冲击环
      this.fx.dust(new THREE.Vector3(p.group.position.x, BOARD_Y, p.group.position.z), 4);
      this.fx.ring(new THREE.Vector3(p.group.position.x, BOARD_Y + 0.02, p.group.position.z), 0xc8a75a, 0.8, 0.32);
      done?.();
    });
  }

  doMove(mv: XqMove, sync = false) {
    const mover = this.pieces.get(keyOf(mv.from[0], mv.from[1]));
    if (!mover) return;
    this.locked = true;
    this.clearSelection();
    // 打谱研究：自由走子记录进变着树（自动演示走主变，由 scriptTick 自行维护 path）
    if (this.script && !sync) this.scriptApplyMove(mv);

    const victim = mv.capture ? this.pieces.get(keyOf(mv.to[0], mv.to[1])) : undefined;

    this.lastGroup.clear();
    for (const [r, f] of [mv.from, mv.to]) {
      const d = this.flatPlane(this.texLast, 0.98, 0.115, 1);
      d.position.set(posX(f), 0.115, posZ(r));
      this.lastGroup.add(d);
    }

    if (sync) {
      // script playback: commit the engine + state immediately so the script can
      // never drift from the animation; the hop afterwards is purely visual.
      this.commitMove(mv, victim);
      if (mover.type === 'c' && victim) this.cannonShot(mover, posX(mv.to[1]), posZ(mv.to[0]));
      else this.hopTo(mover, posX(mv.to[1]), posZ(mv.to[0]), 0.5);
    } else {
      if (mover.type === 'c' && victim) {
        // 炮吃子：炮弹发射，落地后引爆并 commit
        this.cannonShot(mover, posX(mv.to[1]), posZ(mv.to[0]), () => this.commitMove(mv, victim));
      } else {
        this.hopTo(mover, posX(mv.to[1]), posZ(mv.to[0]), 0.5, () => this.commitMove(mv, victim));
      }
    }
  }

  /**
   * 炮吃子专属动画：炮身后坐，炮弹沿高弧线飞向目标，尾部拖火烟。
   * 落地后触发 done（commitMove，爆炸特效在其中触发），炮再快速滑移归位（被爆炸掩盖）。
   */
  private cannonShot(p: PieceObj, x: number, z: number, done?: () => void) {
    const sx = p.group.position.x, sz = p.group.position.z;
    const dx = x - sx, dz = z - sz;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len, nz = dz / len;
    p.group.rotation.y = Math.atan2(dx, dz);
    // 炮弹：深色弹体 + 橙色引信
    const shell = new THREE.Group();
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a3a46, roughness: 0.35, metalness: 0.7 })
    );
    shell.add(ball);
    const fuse = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.07, 0.045),
      new THREE.MeshBasicMaterial({ color: 0xffb050 })
    );
    fuse.position.y = 0.07;
    shell.add(fuse);
    shell.position.set(sx, BOARD_Y + 0.2, sz);
    shell.rotation.y = Math.atan2(dx, dz);
    this.scene.add(shell);
    this.shellFx = shell;
    let lastK = 0, trail = 0;
    this.tween(0.34, k => {
      const e = ease(k);
      const h = Math.sin(e * Math.PI);
      shell.position.x = sx + dx * e;
      shell.position.z = sz + dz * e;
      shell.position.y = BOARD_Y + 0.2 + h * 0.6;
      // 弹体滚动（引信转动可见）+ 轻微俯仰摆动
      const dk = k - lastK;
      lastK = k;
      ball.rotation.z -= dk * 16;
      shell.rotation.x = -h * 0.35;
      // 尾部拖火烟
      trail += dk;
      if (trail > 0.05) {
        trail = 0;
        this.fx.dust(shell.position, 1, 0xff9a40);
      }
      // 炮身后坐：前 45% 退后并回弹，之后保持原位
      const recoil = Math.sin(Math.min(k * 2.2, 1) * Math.PI) * 0.09;
      p.group.position.x = sx - nx * recoil;
      p.group.position.z = sz - nz * recoil;
    }, () => {
      this.scene.remove(shell);
      if (this.shellFx === shell) this.shellFx = null;
      done?.(); // 触发 commitMove（爆炸特效在其中生成）
      // 炮快速滑移归位到目标格（被爆炸特效掩盖）
      const gx = p.group.position.x, gz = p.group.position.z;
      this.tween(0.12, k => {
        const e = ease(k);
        p.group.position.x = gx + (x - gx) * e;
        p.group.position.z = gz + (z - gz) * e;
      }, () => {
        p.group.position.set(x, BOARD_Y, z);
        p.group.rotation.y = 0;
        p.group.scale.set(1, 1, 1);
      });
    });
  }

  private commitMove(mv: XqMove, victim: PieceObj | undefined) {
    const moverKey = keyOf(mv.from[0], mv.from[1]);
    const mover = this.pieces.get(moverKey);
    this.pieces.delete(moverKey);
    if (mover) this.pieces.set(keyOf(mv.to[0], mv.to[1]), mover);
    if (victim) {
      const list = victim.side === 'b' ? this.capturedW : this.capturedB;
      list.push(victim);
      const hitPos = new THREE.Vector3(posX(mv.to[1]), BOARD_Y + 0.05, posZ(mv.to[0]));
      if (mover?.type === 'c') {
        // 炮弹爆炸：强闪光 + 橙火/被吃方双色爆裂 + 大冲击环 + 四分五裂碎片 + 强震屏
        this.fx.flash(hitPos, 0xffd27a, 1.5, 0.26);
        this.fx.burst(hitPos, 0xffa040, 12, { speed: 2.7, up: 1.6, dur: 0.6 });
        this.fx.burst(hitPos, victim.side === 'w' ? 0xff6b4a : 0x7fb0e8, 10, { speed: 2.2, up: 1.4 });
        this.fx.ring(hitPos, 0xe8c56a, 2.2, 0.5);
        this.fx.debris(hitPos, victim.side === 'w' ? 0xc0392b : 0x5d7fa8, 12, { speed: 3.4, up: 2.2 });
        this.shake = { t: 0, dur: 0.35, amp: 0.08 };
        this.dissolvePiece(victim); // 被炸碎：快速缩小淡出
      } else {
        // 常规吃子：被击飞动画 + 爆裂火花 + 冲击环 + 震屏
        this.hitAway(victim, mv.from, mv.to);
        this.fx.burst(hitPos, victim.side === 'w' ? 0xff6b4a : 0x7fb0e8, 14, { speed: 2.1, up: 1.2 });
        this.fx.ring(hitPos, 0xe8c56a, 1.7, 0.42);
        this.shake = { t: 0, dur: 0.3, amp: 0.05 };
      }
    }

    this.xq.make(mv);
    if (mover) {
      mover.r = mv.to[0]; mover.f = mv.to[1];
      mover.proxy.userData.key = keyOf(mv.to[0], mv.to[1]);
    }
    if (victim) sfx.capture(); else sfx.move();

    if (this.xq.inCheck(this.xq.turn)) this.updateCheckMark();
    else this.checkMark.visible = false;

    const over = this.xq.isOver();
    if (over) {
      if (this.script) this.pendingOver = over; // reveal after the final pause
      else { this.over = over; sfx.over(true); }
    }

    this.locked = false;
    this.emit();
    if (!this.over) {
      // 打谱模式：相机交给用户控制，不自动摆动视角
      if (!this.script) this.swingTo(this.xq.turn);
      this.maybeAI();
    }
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

  /** 被炸碎（炮击专用）：快速缩小 + 淡出，残骸由爆炸碎片代替。 */
  private dissolvePiece(v: PieceObj) {
    this.tween(0.16, k => {
      v.group.scale.setScalar(Math.max(0.02, 1 - k * 0.85));
      this.setPieceOpacity(v, Math.max(0, 1 - k * 1.4));
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
    const turn = this.xq.turn;
    const isAI = this.config.mode === 'showcase' || (this.config.mode === 'computer' && turn === 'b');
    if (!isAI) return;
    const depth = this.config.mode === 'showcase' ? 2 : 3;
    const jitter = this.config.mode === 'showcase' ? 60 : 0;
    this.aiTimer = setTimeout(() => {
      if (this.over || this.screen !== 'game') return;
      const mv = findBestXqMove(this.xq, depth, jitter);
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
    this.swingTo(this.xq.turn);
  }

  // ---------- public API ----------
  startGame(config: GameConfig) {
    this.stopScript();
    this.config = config;
    this.xq.reset();
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
    this.stopScript();
    this.setup = null;
    this.selRing.visible = false;
    this.screen = 'menu';
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.over = null;
    this.controls.autoRotate = true;
    this.emit();
  }

  undo() {
    if (this.screen !== 'game' || this.over || this.locked || this.script) return;
    if (this.config.mode === 'showcase') return;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.config.mode === 'computer') {
      this.xq.undo();
      if (this.xq.turn === 'b' && this.xq.history.length) this.xq.undo();
    } else {
      this.xq.undo();
    }
    this.rebuildPieces();
    const last = this.xq.history[this.xq.history.length - 1];
    if (last) {
      for (const [r, f] of [last.from, last.to]) {
        const d = this.flatPlane(this.texLast, 0.98, 0.115, 1);
        d.position.set(posX(f), 0.115, posZ(r));
        this.lastGroup.add(d);
      }
    }
    this.emit();
    this.swingTo(this.xq.turn);
  }

  resign() {
    if (this.screen !== 'game' || this.over || this.script) return;
    const loser: Side = this.config.mode === 'computer' ? 'w' : this.xq.turn;
    this.over = { winner: loser === 'w' ? 'b' : 'w', reason: 'Resignation' };
    sfx.over(true);
    this.emit();
  }

  newGame() { this.startGame(this.config); }

  // ---------- famous-game script (study / playback) ----------

  /** Load a famous game. autoplay=true starts the cinematic demo; otherwise the user studies move by move. */
  startScript(game: FamousGame, autoplay = false, intro = '') {
    this.startGame({ mode: 'local', minutes: 0 });
    const tree = treeFromGame(game);
    this.script = { tree, path: treeMainline(tree), i: 0, playing: false, main: treeMainline(tree) };
    this.pendingOver = null;
    this.replayNote = intro || game.title;
    this.emit();
    if (autoplay) this.scriptTogglePlay();
  }

  /** Compatibility wrapper: cinematic auto-play of a famous game. */
  startReplay(game: FamousGame, intro = '') {
    this.startScript(game, true, intro);
  }

  private stopScript() {
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = null;
    this.script = null;
    this.replayNote = null;
    this.pendingOver = null;
  }

  /** Leave study mode and return to the main menu. */
  scriptExit() {
    if (!this.script) return;
    this.stopScript();
    this.toMenu();
  }

  // ---------- board setup (摆盘研究) ----------

  /** 进入摆盘模式：从初始局面开始自由编辑（拿起棋子 → 点击目标格放置）。 */
  enterSetup() {
    this.startGame({ mode: 'local', minutes: 0 });
    this.setup = { board: this.xq.cloneBoard(), selected: null };
    this.pendingOver = null;
    this.replayNote = '摆盘模式：点击棋子拿起，点击目标格放置，点击自身取消';
    this.emit();
  }

  private setupRebuild() {
    for (const p of [...this.pieces.values()]) this.removePieceObj(p);
    for (const p of [...this.capturedW, ...this.capturedB]) this.removePieceObj(p);
    this.pieces.clear();
    this.capturedW = [];
    this.capturedB = [];
    const b = this.setup!.board;
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const pc = b[r][f];
      if (pc) this.pieces.set(keyOf(r, f), this.makePiece(pc.type, pc.side, r, f));
    }
    this.fx.clear();
    this.clearHighlights();
  }

  private handleSetupClick(key: string) {
    const st = this.setup!;
    const [r, f] = key.split(',').map(Number);
    if (st.selected) {
      const [sr, sf] = st.selected;
      if (sr === r && sf === f) { // 点击自身：取消拿起
        st.selected = null;
        this.selRing.visible = false;
        return;
      }
      // 拿起 → 放置（目标格若有棋子则被覆盖）
      const piece = st.board[sr][sf];
      const targetOld = st.board[r][f];
      // 模拟拿起+放置，再做合法性校验（九宫/半场/将帅照面）
      st.board[sr][sf] = null;
      st.board[r][f] = piece;
      const err = piece ? this.setupPlacementOk(piece.side, piece.type, r, f, st.board) : null;
      if (err) {
        st.board[sr][sf] = piece; // 回滚拿起
        st.board[r][f] = targetOld; // 回滚目标格
        this.replayNote = `摆盘无效：${err}`;
        this.emit();
        sfx.error();
        return; // 保持拿起状态，可重新选格
      }
      st.selected = null;
      this.selRing.visible = false;
      this.setupRebuild();
      return;
    }
    if (st.board[r][f]) {
      st.selected = [r, f];
      this.selRing.visible = true;
      this.selRing.position.set(posX(f), 0.14, posZ(r));
      sfx.select();
    }
  }

  /**
   * 摆盘摆放位置合法性（符合象棋基本规则）：
   * 将/帅、士/仕只能在己方九宫内；象/相不能过河；将帅不得照面。
   * 传入的 board 已为“拿起+放置完成”后的模拟局面。
   */
  private setupPlacementOk(side: Side, type: XqType, r: number, f: number, board: XqBoard): string | null {
    if (type === 'k' || type === 'a') {
      const palace = side === 'w' ? r >= 7 && r <= 9 && f >= 3 && f <= 5 : r >= 0 && r <= 2 && f >= 3 && f <= 5;
      if (!palace) return type === 'k' ? '将/帅只能在九宫内' : '士/仕只能在九宫内';
    } else if (type === 'e') {
      const ownHalf = side === 'w' ? r >= 5 : r <= 4;
      if (!ownHalf) return '象/相不能过河';
    }
    if (type === 'k' && this.setupFacing(board)) return '将帅不能照面';
    return null;
  }

  /** 将帅照面检测：任一异方王对同列且之间无子即为照面。 */
  private setupFacing(board: XqBoard): boolean {
    for (let f = 0; f < 9; f++) {
      const kings: { side: Side; r: number }[] = [];
      for (let r = 0; r < 10; r++) {
        const p = board[r][f];
        if (p && p.type === 'k') kings.push({ side: p.side, r });
      }
      for (let i = 0; i < kings.length; i++) for (let j = i + 1; j < kings.length; j++) {
        if (kings[i].side === kings[j].side) continue;
        let blocked = false;
        for (let m = kings[i].r + 1; m < kings[j].r; m++) if (board[m][f]) { blocked = true; break; }
        if (!blocked) return true;
      }
    }
    return false;
  }

  setupDeleteSelected() {
    const st = this.setup;
    if (!st || !st.selected) return;
    st.board[st.selected[0]][st.selected[1]] = null;
    st.selected = null;
    this.selRing.visible = false;
    this.setupRebuild();
  }

  setupClear() {
    const st = this.setup;
    if (!st) return;
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) st.board[r][f] = null;
    st.selected = null;
    this.selRing.visible = false;
    this.setupRebuild();
  }

  setupReset() {
    const st = this.setup;
    if (!st) return;
    st.board = new Xiangqi().cloneBoard();
    st.selected = null;
    this.selRing.visible = false;
    this.setupRebuild();
  }

  /** 从摆盘局面开始自由打谱（双方各需一名将/帅）。 */
  setupStudy() {
    const st = this.setup;
    if (!st) return;
    const hasK = (side: Side) => st.board.some(row => row.some(p => p && p.side === side && p.type === 'k'));
    if (!hasK('w') || !hasK('b')) {
      this.replayNote = '摆盘无效：双方各需一名将/帅才能开始';
      this.emit();
      return;
    }
    if (this.setupFacing(st.board)) {
      this.replayNote = '摆盘无效：将帅不能照面';
      this.emit();
      return;
    }
    const tree = emptyTree('摆盘研究', '自定义局面');
    tree.rootBoard = st.board.map(row => row.map(p => (p ? { ...p } : null)));
    this.xq.board = tree.rootBoard;
    this.xq.turn = 'w';
    this.xq.history = [];
    this.setup = null;
    this.script = { tree, path: [0], i: 0, playing: false, main: [0] };
    this.pendingOver = null;
    this.replayNote = '摆盘研究 · 从自定义局面开始';
    this.rebuildPieces();
    this.emit();
  }

  setupExit() {
    if (!this.setup) return;
    this.setup = null;
    this.selRing.visible = false;
    this.toMenu();
  }

  /** Play / pause the scripted game. */
  scriptTogglePlay() {
    const sc = this.script;
    if (!sc || this.screen !== 'game') return;
    if (this.pendingOver) return; // result reveal in progress
    if (sc.playing) {
      sc.playing = false;
      if (this.scriptTimer) clearTimeout(this.scriptTimer);
      this.scriptTimer = null;
      this.emit();
      return;
    }
    sc.playing = true;
    if (sc.i === 0) this.replayNote = sc.tree.title;
    this.emit();
    this.scheduleScriptStep(sc.i === 0 ? 3.2 : 0.8);
  }

  /** Jump to ply `target` (0 = initial position, max = path end). Stops playback. */
  scriptGoTo(target: number) {
    const sc = this.script;
    if (!sc || this.screen !== 'game') return;
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = null;
    sc.playing = false;
    const t = Math.max(0, Math.min(sc.path.length - 1, Math.round(target)));
    if (t === sc.i) { this.emit(); return; }
    this.rebuildFromPath(t);
  }

  /** Rebuild the engine + pieces from the tree root along `path` up to `upTo` nodes. */
  private rebuildFromPath(upTo: number) {
    const sc = this.script!;
    const x = this.xq;
    if (sc.tree.rootBoard) {
      x.board = sc.tree.rootBoard.map(row => row.map(p => (p ? { ...p } : null)));
      x.turn = 'w';
    } else {
      x.reset();
    }
    x.history = [];
    for (let j = 1; j <= upTo; j++) {
      const sm = sc.tree.nodes[sc.path[j]].move;
      if (!sm) break;
      const mv = x.legalMoves(x.turn).find(m =>
        m.from[0] === sm.from[0] && m.from[1] === sm.from[1] && m.to[0] === sm.to[0] && m.to[1] === sm.to[1]);
      if (!mv) break;
      x.make(mv);
    }
    sc.i = upTo;
    this.rebuildPieces();
    this.lastGroup.clear();
    if (upTo > 0) {
      const last = x.history[x.history.length - 1];
      if (last) {
        for (const [r, f] of [last.from, last.to]) {
          const d = this.flatPlane(this.texLast, 0.98, 0.115, 1);
          d.position.set(posX(f), 0.115, posZ(r));
          this.lastGroup.add(d);
        }
      }
    }
    if (x.inCheck(x.turn)) this.updateCheckMark();
    else this.checkMark.visible = false;
    const over = x.isOver();
    if (upTo === sc.path.length - 1 && over) {
      this.pendingOver = null;
      this.over = over;
      this.replayNote = `终局 · ${over.winner === 'w' ? '红胜' : '黑胜'}`;
    } else {
      this.over = null;
      this.replayNote = upTo === 0 ? sc.tree.title : `${Math.ceil(upTo / 2)}. ${sc.tree.nodes[sc.path[upTo]].move!.note}`;
    }
    this.emit();
  }

  /**
   * 打谱研究：自由走子。着法已存在 → 切换到该分支；否则追加为新变着节点。
   * 分支挂在当前节点 sc.i 之下；若路径延伸到当前节点之后（研究中途走子），先截断。
   * 仅更新树/路径，引擎落子由 commitMove 完成。
   */
  private scriptApplyMove(mv: XqMove) {
    const sc = this.script!;
    const tree = sc.tree;
    if (sc.path.length - 1 > sc.i) sc.path = sc.path.slice(0, sc.i + 1);
    const cur = sc.path[sc.i];
    const node = tree.nodes[cur];
    const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
    const exist = node.children.find(c => {
      const m = tree.nodes[c].move!;
      return same(m.from, mv.from) && same(m.to, mv.to);
    });
    let note: string;
    if (exist !== undefined) {
      sc.path.push(exist);
      note = tree.nodes[exist].move!.note;
    } else {
      note = noteForMove(this.xq, mv);
      const idx = tree.nodes.length;
      tree.nodes.push({ move: { from: [...mv.from], to: [...mv.to], note }, parent: cur, children: [] });
      node.children.push(idx);
      sc.path.push(idx);
    }
    sc.i = sc.path.length - 1;
    sc.playing = false;
    this.replayNote = `${Math.ceil(sc.i / 2)}. ${note}`;
  }

  /** 在第 `ply` 着（路径下标）处循环切换到下一个变着分支。 */
  scriptSwitchBranch(ply: number) {
    const sc = this.script;
    if (!sc || this.screen !== 'game') return;
    if (ply < 1 || ply >= sc.path.length) return;
    const node = sc.tree.nodes[sc.path[ply]];
    if (node.children.length <= 1) return;
    const curChild = ply + 1 < sc.path.length ? sc.path[ply + 1] : -1;
    let idx = node.children.findIndex(c => c === curChild);
    idx = (idx + 1) % node.children.length;
    // 切到目标分支，停留在分支着（不沿该分支延伸到底）
    const newPath = [...sc.path.slice(0, ply + 1), node.children[idx]];
    sc.path = newPath;
    sc.playing = false;
    this.rebuildFromPath(newPath.length - 1);
  }

  /** Import traditional notation text as a new study script. */
  scriptImportText(text: string): { ok: boolean; error: string | null } {
    const { tree, error } = parseNotationText(text);
    if (!tree) return { ok: false, error };
    this.startGame({ mode: 'local', minutes: 0 });
    this.script = { tree, path: treeMainline(tree), i: 0, playing: false, main: treeMainline(tree) };
    this.pendingOver = null;
    this.replayNote = tree.title;
    this.emit();
    return { ok: true, error: null };
  }

  /** Export the current path as traditional notation text. */
  scriptExportText(): string {
    const sc = this.script;
    if (!sc) return '';
    return exportScriptText(sc.tree, sc.path);
  }

  /** Step forward (+1) or backward (-1) by one ply. */
  scriptStep(dir: number) {
    const sc = this.script;
    if (!sc) return;
    this.scriptGoTo(sc.i + (dir > 0 ? 1 : -1));
  }

  private scheduleScriptStep(seconds: number) {
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = setTimeout(() => this.scriptTick(), seconds * 1000);
  }

  private scriptTick() {
    const sc = this.script;
    if (!sc || !sc.playing || this.screen !== 'game') return;
    if (this.pendingOver) {
      // final position reached — hold it, then reveal the result
      this.replayNote = this.pendingOver.winner === null ? '终局 · 和棋' : `绝杀 · ${this.pendingOver.winner === 'w' ? '红胜' : '黑胜'}`;
      this.emit();
      this.scriptTimer = setTimeout(() => {
        if (this.pendingOver) {
          this.over = this.pendingOver;
          sfx.over(true);
          this.emit();
        }
        (window as unknown as { __replayDone?: boolean }).__replayDone = true;
      }, 3200);
      return;
    }
    if (sc.i >= sc.path.length - 1) {
      // leaf reached: stop; reveal the result if the position is over
      const over = this.xq.isOver();
      if (over) {
        this.pendingOver = over;
        this.replayNote = `终局 · ${over.winner === 'w' ? '红胜' : '黑胜'}`;
        this.emit();
        this.scriptTimer = setTimeout(() => {
          if (this.pendingOver) { this.over = this.pendingOver; sfx.over(true); this.emit(); }
          (window as unknown as { __replayDone?: boolean }).__replayDone = true;
        }, 3200);
        return;
      }
      sc.playing = false;
      this.emit();
      return;
    }
    const cur = sc.path[sc.i];
    const child = sc.tree.nodes[cur].children[0];
    if (child === undefined) { sc.playing = false; this.emit(); return; }
    const sm = sc.tree.nodes[child].move!;
    // engine-side expectation: rebuild the reference board up to the CURRENT ply (xq is there)
    const ref = new Xiangqi();
    if (sc.tree.rootBoard) {
      ref.board = sc.tree.rootBoard.map(row => row.map(p => (p ? { ...p } : null)));
      ref.turn = 'w';
    } else {
      ref.reset();
    }
    for (let j = 1; j <= sc.i; j++) {
      const s = sc.tree.nodes[sc.path[j]].move!;
      const lm = ref.legalMoves(ref.turn).find(m =>
        m.from[0] === s.from[0] && m.from[1] === s.from[1] && m.to[0] === s.to[0] && m.to[1] === s.to[1]);
      if (lm) ref.make(lm);
    }
    const live = JSON.stringify(this.xq.board), expected = JSON.stringify(ref.board);
    if (live !== expected) {
      console.error('script: board diverged at ply', sc.i, 'turn', this.xq.turn);
      console.error('live   :', this.dumpBoard(this.xq));
      console.error('expected:', this.dumpBoard(ref));
      // resync engine to expected state so the show can go on
      this.xq.board = ref.board;
      this.xq.turn = ref.turn;
      this.rebuildPieces();
    }
    const mv = this.xq.legalMoves(this.xq.turn).find(m =>
      m.from[0] === sm.from[0] && m.from[1] === sm.from[1] && m.to[0] === sm.to[0] && m.to[1] === sm.to[1]);
    if (!mv) {
      console.error('script: scripted move not legal', sm);
      (window as unknown as { __replayDone?: boolean }).__replayDone = true;
      return;
    }
    // advance the path: if the next move is already on the path (mainline continuation) just
    // step the index; otherwise append it as a fresh variation node
    if (sc.i + 1 < sc.path.length && sc.path[sc.i + 1] === child) sc.i++;
    else { sc.path = [...sc.path.slice(0, sc.i + 1), child]; sc.i = sc.path.length - 1; }
    this.replayNote = `${Math.ceil(sc.i / 2)}. ${sm.note}`;
    this.emit();
    this.doMove(mv, true);
    this.scheduleScriptStep(2.25);
  }

  private updateCheckMark() {
    const k = this.xq.kingPos(this.xq.turn);
    if (k) {
      this.checkMark.visible = true;
      this.checkMark.position.set(posX(k[1]), 0.135, posZ(k[0]));
      this.fx.ring(new THREE.Vector3(posX(k[1]), BOARD_Y + 0.03, posZ(k[0])), 0xe0403a, 1.1, 0.4);
      this.shake = { t: 0, dur: 0.25, amp: 0.03 };
    }
    sfx.check();
  }

  private dumpBoard(x: Xiangqi): string {
    return x.board.map(row => row.map(p => (p ? (p.side === 'w' ? XQ_CHAR.w[p.type] : XQ_CHAR.b[p.type]) : '.')).join('')).join('/');
  }

  applySettings(s: Settings) {
    this.settings = s;
    sfx.enabled = s.sound;
    if (!s.cameraSwing && this.swing) { this.swing = null; this.controls.enabled = true; }
    this.emit();
  }

  // ---------- state ----------
  private emit() {
    const cw = this.capturedW.map(p => XQ_CHAR.b[p.type]).sort();
    const cb = this.capturedB.map(p => XQ_CHAR.w[p.type]).sort();
    const diff = this.capturedW.reduce((s, p) => s + XQ_VALUE[p.type], 0) - this.capturedB.reduce((s, p) => s + XQ_VALUE[p.type], 0);
    const sc = this.script;
    this.onState({
      screen: this.screen,
      game: 'xiangqi',
      mode: this.config.mode,
      turn: this.xq.turn,
      names: { w: 'Red', b: 'Black' },
      check: this.xq.inCheck(this.xq.turn),
      capturedByW: cw,
      capturedByB: cb,
      diff: Math.round(diff * 2) / 2,
      clockW: this.clockW,
      clockB: this.clockB,
      over: this.over,
      canUndo: !this.script && this.screen === 'game' && !this.over && this.config.mode !== 'showcase' && this.xq.history.length > 0,
      humanSide: this.config.mode === 'computer' ? 'w' : null,
      replayNote: this.script || this.setup ? this.replayNote : null,
      setup: !!this.setup,
      scriptInfo: sc ? {
        title: sc.tree.title,
        source: sc.tree.source,
        desc: sc.tree.desc,
        result: sc.tree.result,
        total: sc.path.length - 1,
        index: sc.i,
        playing: sc.playing,
        onMain: sc.main.includes(sc.path[sc.i]),
        over: !!this.over || !!this.pendingOver,
        notes: sc.path.slice(1).map(n => sc.tree.nodes[n].move!.note),
        branches: sc.path.map(n => sc.tree.nodes[n].children.length),
        custom: sc.tree.custom
      } : null
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
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

    // slow cinematic push-in during script playback
    if (this.script?.playing && this.screen === 'game' && !this.swing) {
      const off = this.camera.position.clone().sub(this.controls.target);
      const d = off.length();
      if (d > 9.6) {
        off.setLength(Math.max(9.6, d - dt * 0.16));
        this.camera.position.copy(this.controls.target).add(off);
      }
    }

    if (this.screen === 'game' && !this.over && this.clockW !== null && this.clockB !== null) {
      const turn = this.xq.turn;
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
    for (const p of this.pieces.values()) {
      p.badge.position.y = p.badgeY + Math.sin(t * 2 + p.phase) * 0.03;
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
    if (this.shellFx) { this.scene.remove(this.shellFx); this.shellFx = null; }
    this.fx.clear();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
