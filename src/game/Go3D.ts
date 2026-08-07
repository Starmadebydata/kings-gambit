// 围棋 3D 场景：棋盘网格、双凸棋子、落子/提子动画、拾取交互、AI 接线、数子终局。
// 风格与 Chess3D/Xq3D 一致：暗色废墟环境 + 木质棋盘 + 金色镶边。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GoGame } from './go';
import { findBestMove } from './goAi';
import { goTreeFromGame, goMainline, goExportText, goNote, parseSgfText, type GoScriptTree } from './goFamousGame';
import type { GoFamousGame } from './goFamousGames';
import { buildEnvironment, type Environment } from './environment';
import { FxSystem } from './fx';
import { makeBorderTexture, makeCoordTexture, makeWoodTexture } from './textures';
import { sfx } from './audio';
import type { GameConfig, HudState, Settings, Side } from './types';

const BOARD_Y = 0.12;
const CELL = 0.5; // 交叉点间距
const posX = (f: number, n: number) => (f - (n - 1) / 2) * CELL;
const posZ = (r: number, n: number) => (r - (n - 1) / 2) * CELL;
const keyOf = (r: number, f: number) => `${r},${f}`;
/** 围棋横坐标字母（跳过 I，与惯例一致）。 */
const FILES = 'abcdefghjklmnopqrstuvwxyz';

interface StoneObj {
  r: number;
  f: number;
  side: Side;
  group: THREE.Group;
}

interface Tween { t: number; dur: number; update: (k: number) => void; done?: () => void }
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export class GoGame3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private env: Environment;
  private go = new GoGame(19);
  private stones = new Map<string, StoneObj>();
  private boardGroup = new THREE.Group(); // 棋盘本体（尺寸变化时整体重建）
  private coordsGroup = new THREE.Group(); // 坐标（独立控制显隐）
  private pickables: THREE.Object3D[] = [];
  private tweens: Tween[] = [];
  private fx = new FxSystem();
  private shake: { t: number; dur: number; amp: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private raf = 0;
  private time = 0;

  private lastGroup = new THREE.Group();
  private texLast = makeBorderTexture('226,150,60');

  screen: 'menu' | 'game' = 'menu';
  private config: GameConfig = { mode: 'local', minutes: 0 };
  settings: Settings = { cameraSwing: true, sound: true, coords: true, legalMoves: true };
  private locked = false;
  private over: { winner: Side | null; reason: string } | null = null;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private swing: { t: number; dur: number; from: number; to: number; phi: number; radius: number } | null = null;
  private camFlip = false;
  private downPos = { x: 0, y: 0 };
  private disposed = false;
  private replayNote: string | null = null;
  private script: {
    tree: GoScriptTree;
    path: number[]; // 当前路径（树节点下标）
    i: number; // 当前着（path 下标）
    playing: boolean;
    main: number[]; // 主线路径（onMain 高亮用）
  } | null = null;
  private scriptTimer: ReturnType<typeof setTimeout> | null = null;
  /** 打谱播放落子节奏（毫秒/手，默认 1000）。录制电影机位视频时可按段落调整。 */
  scriptStepMs = 1000;

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
    this.scene.add(this.boardGroup, this.coordsGroup, this.lastGroup, this.fx.group);
    this.buildBoard();

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.emit();
    this.loop();
  }

  // ---------- board ----------
  private starPoints(n: number): [number, number][] {
    if (n === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
    if (n === 13) return [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6], [3, 6], [6, 3], [6, 9], [9, 6]];
    return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
  }

  private buildBoard() {
    this.scene.remove(this.boardGroup);
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.pickables = [];
    const n = this.go.n;
    const span = (n - 1) * CELL; // 网格跨度
    const size = span + 1.5; // 木板外沿

    const woodMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.75 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xb98f3e, roughness: 0.4, metalness: 0.6 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 0.2, size), woodMat);
    slab.position.y = -0.02;
    slab.receiveShadow = true;
    this.boardGroup.add(slab);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(size + 0.6, 0.14, size + 0.6), new THREE.MeshStandardMaterial({ color: 0x10131b, roughness: 0.9 }));
    rim.position.y = -0.08;
    this.boardGroup.add(rim);
    const base = new THREE.Mesh(new THREE.BoxGeometry(size + 1.2, 0.22, size + 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.95, flatShading: true }));
    base.position.y = -0.24;
    this.boardGroup.add(base);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xb98f3e, roughness: 0.35, metalness: 0.75 });
    const half = size / 2;
    const trims: [number, number, number, number][] = [
      [size + 0.06, 0.05, 0.14, half + 0.3], [size + 0.06, 0.05, 0.14, -(half + 0.3)],
      [0.14, 0.05, size + 0.06, half + 0.3], [0.14, 0.05, size + 0.06, -(half + 0.3)]
    ];
    for (const [w, h, d, off] of trims) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat);
      const horizontal = w > d;
      t.position.set(horizontal ? 0 : off, 0.06, horizontal ? off : 0);
      this.boardGroup.add(t);
    }

    // grid lines: n horizontal + n vertical
    for (let r = 0; r < n; r++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(span, 0.02, 0.018), lineMat);
      line.position.set(0, 0.09, posZ(r, n));
      this.boardGroup.add(line);
    }
    for (let f = 0; f < n; f++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, span), lineMat);
      line.position.set(posX(f, n), 0.09, 0);
      this.boardGroup.add(line);
    }

    // star points (星位)
    const starGeo = new THREE.CylinderGeometry(0.05, 0.055, 0.014, 8);
    const starMat = new THREE.MeshStandardMaterial({ color: 0x0b0805, roughness: 0.55 });
    for (const [sr, sf] of this.starPoints(n)) {
      const s = new THREE.Mesh(starGeo, starMat);
      s.position.set(posX(sf, n), 0.082, posZ(sr, n));
      this.boardGroup.add(s);
    }

    // coordinates (letters along f, digits along r)
    this.coordsGroup.clear();
    const mkC = (text: string, x: number, z: number, rot: number) => {
      const t = makeCoordTexture(text);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })
      );
      m.rotation.set(-Math.PI / 2, 0, rot);
      m.position.set(x, 0.085, z);
      this.coordsGroup.add(m);
    };
    const edgeZ = half + 0.45, edgeX = half + 0.45;
    for (let f = 0; f < n; f++) {
      const letter = FILES[f];
      mkC(letter, posX(f, n), edgeZ, 0);
      mkC(letter, posX(f, n), -edgeZ, Math.PI);
    }
    for (let r = 0; r < n; r++) {
      const num = String(r + 1);
      mkC(num, edgeX, posZ(r, n), Math.PI / 2);
      mkC(num, -edgeX, posZ(r, n), -Math.PI / 2);
    }

    // invisible pick planes at intersections
    const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const pickGeo = new THREE.PlaneGeometry(0.44, 0.44);
    for (let r = 0; r < n; r++) {
      for (let f = 0; f < n; f++) {
        const m = new THREE.Mesh(pickGeo, pickMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(posX(f, n), 0.1, posZ(r, n));
        m.userData.key = keyOf(r, f);
        this.boardGroup.add(m);
        this.pickables.push(m);
      }
    }
  }

  // ---------- stones ----------
  private makeStone(side: Side, r: number, f: number): StoneObj {
    const group = new THREE.Group();
    const mat = side === 'b'
      ? new THREE.MeshStandardMaterial({ color: 0x16181e, roughness: 0.35, metalness: 0.35 })
      : new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.22, metalness: 0.08 });
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.185, 24, 14), mat);
    stone.scale.y = 0.34; // 双凸扁形
    stone.castShadow = true;
    group.add(stone);
    group.position.set(posX(f, this.go.n), BOARD_Y + 0.02, posZ(r, this.go.n));
    this.scene.add(group);
    return { r, f, side, group };
  }

  /** 落子：棋子从上方坠落到交叉点，落地尘土 + 冲击环。 */
  private placeStone(side: Side, r: number, f: number): StoneObj {
    const obj = this.makeStone(side, r, f);
    const g = obj.group;
    const x = g.position.x, z = g.position.z;
    g.position.y = 1.7;
    this.tween(0.32, k => {
      const e = ease(k);
      g.position.y = BOARD_Y + 0.02 + (1.7 - BOARD_Y - 0.02) * (1 - e);
      g.rotation.z = (1 - e) * 0.45;
    }, () => {
      g.position.set(x, BOARD_Y + 0.02, z);
      g.rotation.set(0, 0, 0);
      this.fx.dust(new THREE.Vector3(x, BOARD_Y, z), 5);
      this.fx.ring(new THREE.Vector3(x, BOARD_Y + 0.02, z), side === 'b' ? 0x8f98a8 : 0xd8d2c4, 0.7, 0.3);
    });
    return obj;
  }

  /** 提子：被提棋子弹起、翻转、缩小消失。 */
  private popStone(s: StoneObj) {
    const g = s.group;
    const x = g.position.x, z = g.position.z;
    this.tween(0.4, k => {
      const e = ease(k);
      g.position.x = x + Math.sin(k * 5) * 0.07 * (1 - k);
      g.position.y = BOARD_Y + 0.02 + e * 1.15;
      g.scale.setScalar(Math.max(0.02, 1 - k * 0.85));
      g.rotation.z += 0.28;
    }, () => {
      this.scene.remove(g);
      this.fx.dust(new THREE.Vector3(x, BOARD_Y, z), 4, 0x8a95a8);
    });
  }

  private rebuildStones() {
    for (const s of [...this.stones.values()]) this.scene.remove(s.group);
    this.stones.clear();
    const board = this.go.board;
    for (let r = 0; r < this.go.n; r++) {
      for (let f = 0; f < this.go.n; f++) {
        const side = board[r][f];
        if (side) this.stones.set(keyOf(r, f), this.makeStone(side, r, f));
      }
    }
    this.fx.clear();
    this.updateLastMark();
  }

  private updateLastMark() {
    this.lastGroup.clear();
    const lm = this.go.lastMove;
    if (!lm) return;
    const d = this.flatPlane(this.texLast, 0.32, 0.115, 1);
    d.position.set(posX(lm[1], this.go.n), 0.115, posZ(lm[0], this.go.n));
    this.lastGroup.add(d);
  }

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
    const key = hits[0].object.userData.key as string;
    this.handleClick(key);
  };

  private humanTurn(): boolean {
    if (this.screen !== 'game' || this.over || this.locked) return false;
    if (this.script) return !this.script.playing; // 打谱：播放中禁落子，暂停时可自由变着
    if (this.config.mode === 'showcase') return false;
    if (this.config.mode === 'computer' && this.go.turn === 'w') return false;
    return true;
  }

  private handleClick(key: string) {
    if (!this.humanTurn()) return;
    const [r, f] = key.split(',').map(Number);
    this.doPlay(r, f);
  }

  // ---------- playing ----------
  private tween(dur: number, update: (k: number) => void, done?: () => void) {
    this.tweens.push({ t: 0, dur, update, done });
  }

  private doPlay(r: number, f: number, sync = false) {
    if (this.screen !== 'game' || this.over || this.locked) return;
    const side = this.go.turn;
    const res = this.go.play(r, f);
    if (!res.ok) {
      this.replayNote = res.error!;
      this.emit();
      sfx.error();
      return;
    }
    if (this.script && !sync) this.scriptApplyMove(r, f, side);
    this.locked = true;
    this.replayNote = null;
    const captured: StoneObj[] = [];
    for (const [cr, cf] of res.captured) {
      const s = this.stones.get(keyOf(cr, cf));
      if (s) {
        captured.push(s);
        this.stones.delete(keyOf(cr, cf));
      }
    }
    const stone = this.placeStone(side, r, f);
    this.stones.set(keyOf(r, f), stone);
    for (const s of captured) this.popStone(s);
    if (captured.length) sfx.capture(); else sfx.move();
    this.updateLastMark();
    this.emit();
    this.tween(0.35, () => { }, () => {
      this.locked = false;
      if (!this.over) {
        // 打谱模式：相机交给用户控制，不自动摆动视角
        if (!this.script) this.swingTo(this.go.turn);
        this.maybeAI();
      }
    });
  }

  /** 虚着：放弃一手。双方连续虚着 → 数子终局。 */
  private doPass(sync = false) {
    if (this.screen !== 'game' || this.over || this.locked) return;
    const side = this.go.turn;
    this.go.pass();
    if (this.script && !sync) this.scriptApplyPass(side);
    this.replayNote = side === 'b' ? '黑方虚着 · 白方行棋' : '白方虚着 · 黑方行棋';
    this.checkOver();
    this.emit();
    if (this.over) return;
    // 打谱模式：相机交给用户控制，不自动摆动视角
    if (!this.script) this.swingTo(this.go.turn);
    this.maybeAI();
  }

  /** 公开入口：HUD 工具栏虚着按钮。 */
  pass() { this.doPass(); }

  private checkOver() {
    if (!this.go.isOver()) return;
    const res = this.go.result();
    if (res) {
      this.over = { winner: res.winner, reason: `终局 · ${res.winner === 'b' ? '黑方' : '白方'}胜 ${res.margin} 子（黑贴3¾子）` };
      sfx.over(true);
    } else {
      this.over = { winner: null, reason: '终局 · 和棋' };
      sfx.over(false);
    }
  }

  // ---------- AI ----------
  private maybeAI() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.screen !== 'game' || this.over) return;
    const turn = this.go.turn;
    const isAI = this.config.mode === 'showcase' || (this.config.mode === 'computer' && turn === 'w');
    if (!isAI) return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      if (this.over || this.screen !== 'game') return;
      const mv = findBestMove(this.go, {
        level: this.config.level ?? 2,
        jitter: this.config.mode === 'showcase' ? 60 : 0,
      });
      if (mv) this.doPlay(mv[0], mv[1]);
      else this.doPass();
    }, this.config.mode === 'showcase' ? 900 : 700);
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
    this.swingTo(this.go.turn);
  }

  // ---------- public API ----------
  startGame(config: GameConfig) {
    this.config = config;
    this.go = new GoGame(config.goSize ?? 19);
    this.over = null;
    this.locked = false;
    this.camFlip = false;
    this.replayNote = null;
    if (this.aiTimer) { clearTimeout(this.aiTimer); this.aiTimer = null; }
    if (this.scriptTimer) { clearTimeout(this.scriptTimer); this.scriptTimer = null; }
    this.script = null;
    this.buildBoard();
    this.rebuildStones();
    this.screen = 'game';
    this.controls.autoRotate = false;
    sfx.unlock();
    sfx.start();
    this.emit();
    this.swingTo('b');
  }

  toMenu() {
    this.screen = 'menu';
    if (this.aiTimer) { clearTimeout(this.aiTimer); this.aiTimer = null; }
    if (this.scriptTimer) { clearTimeout(this.scriptTimer); this.scriptTimer = null; }
    this.script = null;
    this.over = null;
    this.replayNote = null;
    this.controls.autoRotate = true;
    this.emit();
  }

  undo() {
    if (this.screen !== 'game' || this.over || this.locked || this.aiTimer || this.script) return;
    if (this.config.mode === 'showcase') return;
    if (this.config.mode === 'computer') {
      this.go.undo();
      if (this.go.turn === 'w' && this.go.history.length) this.go.undo();
    } else {
      this.go.undo();
    }
    this.replayNote = null;
    this.rebuildStones();
    this.emit();
    this.swingTo(this.go.turn);
  }

  resign() {
    if (this.screen !== 'game' || this.over) return;
    const loser: Side = this.config.mode === 'computer' ? 'b' : this.go.turn;
    this.over = { winner: loser === 'b' ? 'w' : 'b', reason: 'Resignation' };
    sfx.over(true);
    this.emit();
  }

  newGame() { this.startGame(this.config); }

  // ---------- 名局棋谱（script 模式） ----------

  /** 进入名局打谱：开局摆好，可播放 / 跳转 / 自由变着。 */
  startScript(game: GoFamousGame, autoplay = false, intro = '') {
    this.startGame({ mode: 'local', minutes: 0 });
    const tree = goTreeFromGame(game);
    this.script = { tree, path: goMainline(tree), i: 0, playing: false, main: goMainline(tree) };
    this.replayNote = intro || game.title;
    this.emit();
    if (autoplay) this.scriptTogglePlay();
  }

  /** 兼容入口：名局自动演示。 */
  startReplay(game: GoFamousGame, intro = '') {
    this.startScript(game, true, intro);
  }

  private stopScript() {
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = null;
    this.script = null;
    this.replayNote = null;
  }

  /** 退出打谱，回到主菜单。 */
  scriptExit() {
    if (!this.script) return;
    this.stopScript();
    this.toMenu();
  }

  /** 播放 / 暂停。 */
  scriptTogglePlay() {
    const sc = this.script;
    if (!sc || this.screen !== 'game') return;
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
    this.scheduleScriptStep(sc.i === 0 ? 3.2 : this.scriptStepMs / 1000);
  }

  /** 跳到第 target 着（0 = 开局，末尾 = 终局），停止播放。 */
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

  /** 沿当前路径从开局重放引擎到第 upTo 着。 */
  private rebuildFromPath(upTo: number) {
    const sc = this.script!;
    this.go = new GoGame(this.go.n);
    for (let j = 1; j <= upTo; j++) {
      const sm = sc.tree.nodes[sc.path[j]].move;
      if (!sm) break;
      if (sm.pass) { this.go.pass(); continue; }
      if (!this.go.play(sm.r, sm.f).ok) { console.error('script: rebuild failed at ply', j, sm); break; }
    }
    sc.i = upTo;
    this.over = null;
    this.rebuildStones();
    this.replayNote = upTo === 0 ? sc.tree.title : `${Math.ceil(upTo / 2)}. ${sc.tree.nodes[sc.path[upTo]].move!.note}`;
    this.emit();
  }

  /** 上一步 / 下一步。 */
  scriptStep(dir: number) {
    const sc = this.script;
    if (!sc) return;
    this.scriptGoTo(sc.i + (dir > 0 ? 1 : -1));
  }

  /** 在第 ply 着处循环切换到下一个变着分支。 */
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

  /** 打谱自由落子：已存在则沿旧节点，否则新建变着节点。 */
  private scriptApplyMove(r: number, f: number, side: Side) {
    const sc = this.script!;
    const tree = sc.tree;
    if (sc.path.length - 1 > sc.i) sc.path = sc.path.slice(0, sc.i + 1);
    const cur = sc.path[sc.i];
    const node = tree.nodes[cur];
    const exist = node.children.find(c => {
      const m = tree.nodes[c].move!;
      return !m.pass && m.r === r && m.f === f;
    });
    let note: string;
    if (exist !== undefined) { sc.path.push(exist); note = tree.nodes[exist].move!.note; }
    else {
      note = goNote(r, f, side);
      const idx = tree.nodes.length;
      tree.nodes.push({ move: { r, f, pass: false, note }, parent: cur, children: [] });
      node.children.push(idx);
      sc.path.push(idx);
    }
    sc.i = sc.path.length - 1;
    sc.playing = false;
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = null;
    this.replayNote = `${Math.ceil(sc.i / 2)}. ${note}`;
  }

  /** 打谱虚着：同样记入变着树。 */
  private scriptApplyPass(side: Side) {
    const sc = this.script!;
    const tree = sc.tree;
    if (sc.path.length - 1 > sc.i) sc.path = sc.path.slice(0, sc.i + 1);
    const cur = sc.path[sc.i];
    const node = tree.nodes[cur];
    const exist = node.children.find(c => tree.nodes[c].move!.pass);
    let note: string;
    if (exist !== undefined) { sc.path.push(exist); note = tree.nodes[exist].move!.note; }
    else {
      note = goNote(-1, -1, side);
      const idx = tree.nodes.length;
      tree.nodes.push({ move: { r: -1, f: -1, pass: true, note }, parent: cur, children: [] });
      node.children.push(idx);
      sc.path.push(idx);
    }
    sc.i = sc.path.length - 1;
    sc.playing = false;
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = null;
    this.replayNote = note;
  }

  /** 导出当前打谱路径为围棋记谱文本。 */
  scriptExportText(): string {
    const sc = this.script;
    if (!sc) return '';
    return goExportText(sc.tree, sc.path);
  }

  /** 导入 SGF 文本为新的打谱棋谱（支持 9/13/19 路）。 */
  scriptImportText(text: string): { ok: boolean; error: string | null } {
    const { tree, error } = parseSgfText(text);
    if (!tree) return { ok: false, error };
    this.startGame({ mode: 'local', minutes: 0, goSize: tree.size ?? 19 });
    this.script = { tree, path: goMainline(tree), i: 0, playing: false, main: goMainline(tree) };
    this.replayNote = tree.title;
    this.emit();
    return { ok: true, error: null };
  }

  private scheduleScriptStep(seconds: number) {
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = setTimeout(() => this.scriptTick(), seconds * 1000);
  }

  /** 播放推进：沿主线每 1.0s 走一手，到叶子停止。 */
  private scriptTick() {
    const sc = this.script;
    if (!sc || !sc.playing || this.screen !== 'game') return;
    if (sc.i >= sc.path.length - 1) {
      sc.playing = false;
      this.emit();
      (window as unknown as { __replayDone?: boolean }).__replayDone = true;
      return;
    }
    const cur = sc.path[sc.i];
    const child = sc.tree.nodes[cur].children[0];
    if (child === undefined) { sc.playing = false; this.emit(); return; }
    const sm = sc.tree.nodes[child].move!;
    if (sc.i + 1 < sc.path.length && sc.path[sc.i + 1] === child) sc.i++;
    else { sc.path = [...sc.path.slice(0, sc.i + 1), child]; sc.i = sc.path.length - 1; }
    this.replayNote = `${Math.ceil(sc.i / 2)}. ${sm.note}`;
    this.emit();
    if (sm.pass) this.doPass(true);
    else this.doPlay(sm.r, sm.f, true);
    this.scheduleScriptStep(this.scriptStepMs / 1000);
  }


  applySettings(s: Settings) {
    this.settings = s;
    sfx.enabled = s.sound;
    this.coordsGroup.visible = s.coords;
    if (!s.cameraSwing && this.swing) { this.swing = null; this.controls.enabled = true; }
    this.emit();
  }

  // ---------- state ----------
  private emit() {
    const nB = this.go.capturesB; // 黑方提子数（白子）
    const nW = this.go.capturesW; // 白方提子数（黑子）
    this.onState({
      screen: this.screen,
      game: 'go',
      mode: this.config.mode,
      turn: this.go.turn,
      names: { w: 'White', b: 'Black' },
      check: false,
      capturedByW: nW > 0 ? ['●×' + nW] : [],
      capturedByB: nB > 0 ? ['○×' + nB] : [],
      diff: Math.round((nW - nB) * 2) / 2,
      clockW: null,
      clockB: null,
      over: this.over,
      canUndo: !this.script && this.screen === 'game' && !this.over && this.config.mode !== 'showcase' && this.go.history.length > 0,
      humanSide: this.config.mode === 'computer' ? 'b' : null,
      replayNote: this.replayNote,
      scriptInfo: this.script ? {
        title: this.script.tree.title,
        source: this.script.tree.source,
        desc: this.script.tree.desc,
        result: this.script.tree.result,
        total: this.script.path.length - 1,
        index: this.script.i,
        playing: this.script.playing,
        onMain: this.script.main.includes(this.script.path[this.script.i]),
        over: !!this.over,
        notes: this.script.path.slice(1).map(n => this.script!.tree.nodes[n].move!.note),
        branches: this.script.path.map(n => this.script!.tree.nodes[n].children.length),
        custom: this.script.tree.custom,
        game: 'go'
      } : null,
      setup: false
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
