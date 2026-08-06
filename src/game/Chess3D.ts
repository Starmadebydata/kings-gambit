import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Chess, type Move, type Square } from 'chess.js';
import { buildEnvironment, type Environment } from './environment';
import { buildPieceModel, PIECE_HEIGHT } from './pieceModels';
import { FxSystem } from './fx';
import { makeBadgeTexture, makeBorderTexture, makeCoordTexture, makeGlowTexture, makeRingTexture } from './textures';
import { findBestMove } from './ai';
import { sfx } from './audio';
import { PIECE_GLYPH, PIECE_VALUE, type GameConfig, type HudState, type PieceType, type Settings, type Side } from './types';

const BOARD_Y = 0.14;

const fileOf = (sq: string) => sq.charCodeAt(0) - 97;
const rankOf = (sq: string) => parseInt(sq[1], 10);
const sqX = (sq: string) => fileOf(sq) - 3.5;
const sqZ = (sq: string) => 4.5 - rankOf(sq);

interface PieceObj {
  square: Square;
  type: PieceType;
  side: Side;
  group: THREE.Group;
  model: THREE.Group;
  badge: THREE.Sprite;
  proxy: THREE.Mesh;
  glow: THREE.Mesh;
  phase: number;
  badgeY: number;
}

interface Tween {
  t: number;
  dur: number;
  update: (k: number) => void;
  done?: () => void;
}

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export class ChessGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private env: Environment;
  private chess = new Chess();
  private pieces = new Map<Square, PieceObj>();
  private tiles: THREE.Mesh[] = [];
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
  private checkMark: THREE.Mesh;
  private coordsGroup = new THREE.Group();

  // textures
  private texGlowW = makeGlowTexture('70,120,220');
  private texGlowB = makeGlowTexture('205,45,40');
  private texLegal = makeGlowTexture('70,220,130');
  private texCap = makeRingTexture('220,70,50');
  private texRing = makeRingTexture('232,196,110');
  private texLast = makeBorderTexture('226,150,60');
  private texCheck = makeBorderTexture('230,60,50');
  private badgeCache = new Map<string, THREE.CanvasTexture>();

  // state
  screen: 'menu' | 'game' = 'menu';
  private config: GameConfig = { mode: 'local', minutes: 0 };
  settings: Settings = { cameraSwing: true, sound: true, coords: true, legalMoves: true };
  private selected: PieceObj | null = null;
  private legalForSelected: Move[] = [];
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
    this.checkMark = this.flatPlane(this.texCheck, 1.02, 0.165);
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
    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const isLight = (f + r) % 2 === 0;
        const tile = new THREE.Mesh(geo, isLight ? lightMat : darkMat);
        tile.position.set(f - 3.5, 0.07, 4.5 - r);
        tile.receiveShadow = true;
        const sq = String.fromCharCode(97 + f) + r;
        tile.userData.square = sq;
        this.scene.add(tile);
        this.tiles.push(tile);
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
      this.addCoord(String(i + 1), -5.05, 4.5 - (i + 1), Math.PI / 2);
      this.addCoord(String(i + 1), 5.05, 4.5 - (i + 1), -Math.PI / 2);
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
  private badgeTex(type: PieceType, side: Side) {
    const key = type + side;
    let t = this.badgeCache.get(key);
    if (!t) { t = makeBadgeTexture(type, side); this.badgeCache.set(key, t); }
    return t;
  }

  private makePiece(type: PieceType, side: Side, square: Square): PieceObj {
    const group = new THREE.Group();
    const model = buildPieceModel(type, side);
    group.add(model);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({ map: side === 'w' ? this.texGlowW : this.texGlowB, transparent: true, depthWrite: false, opacity: 0.85 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    glow.renderOrder = 1;
    group.add(glow);

    const badgeY = PIECE_HEIGHT[type] + 0.34;
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.badgeTex(type, side), transparent: true, depthWrite: false }));
    badge.scale.set(0.42, 0.5, 1);
    badge.position.y = badgeY;
    group.add(badge);

    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.2, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.y = 0.6;
    proxy.userData.square = square;
    group.add(proxy);
    this.pickables.push(proxy);

    group.position.set(sqX(square), BOARD_Y, sqZ(square));
    this.scene.add(group);
    return { square, type, side, group, model, badge, proxy, glow, phase: Math.random() * 6.28, badgeY };
  }

  private removePieceObj(p: PieceObj) {
    this.scene.remove(p.group);
    const i = this.pickables.indexOf(p.proxy);
    if (i >= 0) this.pickables.splice(i, 1);
    p.group.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        // geometries shared; only dispose unique sprite materials
      }
    });
  }

  rebuildPieces() {
    for (const p of [...this.pieces.values()]) this.removePieceObj(p);
    for (const p of [...this.capturedW, ...this.capturedB]) this.removePieceObj(p);
    this.pieces.clear();
    this.capturedW = [];
    this.capturedB = [];
    const board = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const pc = board[r][f];
        if (!pc) continue;
        const sq = String.fromCharCode(97 + f) + (8 - r);
        this.pieces.set(sq as Square, this.makePiece(pc.type, pc.color, sq as Square));
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
    const sq = hits[0].object.userData.square as Square;
    this.handleClick(sq);
  };

  private humanTurn(): boolean {
    if (this.screen !== 'game' || this.over || this.locked) return false;
    if (this.config.mode === 'showcase') return false;
    if (this.config.mode === 'computer' && this.chess.turn() === 'b') return false;
    return true;
  }

  private handleClick(sq: Square) {
    if (!this.humanTurn()) return;
    if (this.selected) {
      const mv = this.legalForSelected.find(m => m.to === sq);
      if (mv) { this.doMove(mv); return; }
    }
    const piece = this.pieces.get(sq);
    if (piece && piece.side === this.chess.turn()) this.select(piece);
    else this.clearSelection();
  }

  private select(p: PieceObj) {
    this.clearSelection();
    this.selected = p;
    this.legalForSelected = this.chess.moves({ square: p.square, verbose: true });
    this.selRing.visible = true;
    this.selRing.position.set(sqX(p.square), 0.17, sqZ(p.square));
    if (this.settings.legalMoves) {
      for (const m of this.legalForSelected) {
        const isCap = !!m.captured;
        const d = this.flatPlane(isCap ? this.texCap : this.texLegal, isCap ? 0.95 : 0.8, 0.155);
        d.position.set(sqX(m.to), 0.155, sqZ(m.to));
        d.userData.square = m.to;
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
  private tween(dur: number, update: (k: number) => void, done?: () => void, delay = 0) {
    this.tweens.push({ t: -delay, dur, update, done });
  }

  private hopTo(p: PieceObj, x: number, z: number, dur: number, done?: () => void) {
    const sx = p.group.position.x, sz = p.group.position.z;
    const ang = Math.atan2(x - sx, z - sz);
    if (Math.hypot(x - sx, z - sz) > 0.01) {
      // keep model's own random yaw but lean group toward direction
      p.group.rotation.y = ang;
    }
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

  doMove(mv: Move) {
    const mover = this.pieces.get(mv.from);
    if (!mover) return;
    this.locked = true;
    this.clearSelection();

    const capSq = (mv.flags.includes('e') ? mv.to[0] + mv.from[1] : mv.to) as Square;
    const victim = mv.captured ? this.pieces.get(capSq) : undefined;

    // last-move markers
    this.lastGroup.clear();
    for (const sq of [mv.from, mv.to]) {
      const d = this.flatPlane(this.texLast, 1.0, 0.145, 1);
      d.position.set(sqX(sq), 0.145, sqZ(sq));
      this.lastGroup.add(d);
    }

    // castle rook
    let rook: PieceObj | undefined;
    let rookTo: Square | null = null;
    if (mv.flags.includes('k')) { rook = this.pieces.get((mv.color === 'w' ? 'h1' : 'h8') as Square); rookTo = (mv.color === 'w' ? 'f1' : 'f8') as Square; }
    if (mv.flags.includes('q')) { rook = this.pieces.get((mv.color === 'w' ? 'a1' : 'a8') as Square); rookTo = (mv.color === 'w' ? 'd1' : 'd8') as Square; }

    this.hopTo(mover, sqX(mv.to), sqZ(mv.to), 0.5, () => this.commitMove(mv, victim, capSq));
    if (rook && rookTo) this.hopTo(rook, sqX(rookTo), sqZ(rookTo), 0.5);
  }

  private toGraveyard(v: PieceObj) {
    const list = v.side === 'b' ? this.capturedW : this.capturedB;
    const i = list.length;
    list.push(v);
    const xBase = v.side === 'b' ? 5.7 : -5.7;
    const col = Math.floor(i / 8);
    const x = xBase + (v.side === 'b' ? col : -col) * 0.9;
    const z = -3.5 + (i % 8) * 1.0;
    this.hopTo(v, x, z, 0.7);
    (v.glow.material as THREE.MeshBasicMaterial).opacity = 0.55;
  }

  private commitMove(mv: Move, victim: PieceObj | undefined, capSq: Square) {
    // update maps
    const mover = this.pieces.get(mv.from);
    this.pieces.delete(mv.from);
    if (mover) this.pieces.set(mv.to, mover);
    if (victim) {
      this.pieces.delete(capSq);
      this.removePieceObjFromBoard(victim);
      this.toGraveyard(victim);
      // 打击特效：爆裂火花 + 冲击环 + 震屏
      const hitPos = new THREE.Vector3(sqX(capSq), BOARD_Y + 0.05, sqZ(capSq));
      this.fx.burst(hitPos, victim.side === 'w' ? 0xffd9a0 : 0x9ab8e8, 12, { speed: 2.0, up: 1.1 });
      this.fx.ring(hitPos, 0xe8c56a, 1.8, 0.42);
      this.shake = { t: 0, dur: 0.3, amp: 0.05 };
    }
    if (mv.flags.includes('k') || mv.flags.includes('q')) {
      const rf = (mv.flags.includes('k') ? (mv.color === 'w' ? 'h1' : 'h8') : (mv.color === 'w' ? 'a1' : 'a8')) as Square;
      const rt = (mv.flags.includes('k') ? (mv.color === 'w' ? 'f1' : 'f8') : (mv.color === 'w' ? 'd1' : 'd8')) as Square;
      const rk = this.pieces.get(rf);
      if (rk) { this.pieces.delete(rf); rk.square = rt; rk.proxy.userData.square = rt; this.pieces.set(rt, rk); }
    }

    this.chess.move({ from: mv.from, to: mv.to, promotion: 'q' });
    if (victim) sfx.capture(); else sfx.move();
    if (mover) {
      mover.square = mv.to;
      mover.proxy.userData.square = mv.to;
      if (mv.flags.includes('p')) {
        // rebuild as queen with a pop
        const old = mover;
        this.removePieceObj(old);
        this.pieces.delete(mv.to);
        const np = this.makePiece('q', mv.color, mv.to);
        this.pieces.set(mv.to, np);
        np.group.scale.setScalar(0.4);
        this.tween(0.35, k => np.group.scale.setScalar(0.4 + 0.6 * ease(k)));
      }
    }

    // check marker
    if (this.chess.inCheck()) {
      const ksq = this.kingSquare(this.chess.turn());
      if (ksq) {
        this.checkMark.visible = true;
        this.checkMark.position.set(sqX(ksq), 0.165, sqZ(ksq));
        this.fx.ring(new THREE.Vector3(sqX(ksq), BOARD_Y + 0.03, sqZ(ksq)), 0xe0403a, 1.2, 0.4);
        this.shake = { t: 0, dur: 0.25, amp: 0.03 };
      }
      sfx.check();
    } else this.checkMark.visible = false;

    // game over?
    if (this.chess.isCheckmate()) {
      this.over = { winner: this.chess.turn() === 'w' ? 'b' : 'w', reason: 'Checkmate' };
      sfx.over(true);
    } else if (this.chess.isStalemate()) {
      this.over = { winner: null, reason: 'Stalemate' };
      sfx.over(false);
    } else if (this.chess.isDraw()) {
      this.over = { winner: null, reason: this.chess.isInsufficientMaterial() ? 'Insufficient material' : 'Draw' };
      sfx.over(false);
    }

    this.locked = false;
    this.emit();
    if (!this.over) {
      this.swingTo(this.chess.turn());
      this.maybeAI();
    }
  }

  private removePieceObjFromBoard(v: PieceObj) {
    const i = this.pickables.indexOf(v.proxy);
    if (i >= 0) this.pickables.splice(i, 1);
  }

  private kingSquare(side: Side): Square | null {
    const b = this.chess.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (p && p.type === 'k' && p.color === side) return (String.fromCharCode(97 + f) + (8 - r)) as Square;
    }
    return null;
  }

  // ---------- AI ----------
  private maybeAI() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.screen !== 'game' || this.over) return;
    const turn = this.chess.turn();
    const isAI = this.config.mode === 'showcase' || (this.config.mode === 'computer' && turn === 'b');
    if (!isAI) return;
    const depth = this.config.mode === 'showcase' ? 2 : 3;
    const jitter = this.config.mode === 'showcase' ? 60 : 0;
    this.aiTimer = setTimeout(() => {
      if (this.over || this.screen !== 'game') return;
      const mv = findBestMove(this.chess, depth, jitter);
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
    this.swingTo(this.chess.turn());
  }

  // ---------- public API ----------
  startGame(config: GameConfig) {
    this.config = config;
    this.chess = new Chess();
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
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.config.mode === 'computer') {
      this.chess.undo();
      if (this.chess.turn() === 'b' && this.chess.history().length) this.chess.undo();
    } else {
      this.chess.undo();
    }
    this.rebuildPieces();
    const hist = this.chess.history({ verbose: true });
    if (hist.length) {
      const lm = hist[hist.length - 1];
      for (const sq of [lm.from, lm.to]) {
        const d = this.flatPlane(this.texLast, 1.0, 0.145, 1);
        d.position.set(sqX(sq), 0.145, sqZ(sq));
        this.lastGroup.add(d);
      }
    }
    this.emit();
    this.swingTo(this.chess.turn());
  }

  resign() {
    if (this.screen !== 'game' || this.over) return;
    const loser: Side = this.config.mode === 'computer' ? 'w' : this.chess.turn();
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
  private capturedTypes(list: PieceObj[]): PieceType[] {
    return list.map(p => p.type).sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  }

  private emit() {
    const cw = this.capturedTypes(this.capturedW);
    const cb = this.capturedTypes(this.capturedB);
    const diff = cw.reduce((s, t) => s + PIECE_VALUE[t], 0) - cb.reduce((s, t) => s + PIECE_VALUE[t], 0);
    this.onState({
      screen: this.screen,
      game: 'chess',
      mode: this.config.mode,
      turn: this.chess.turn(),
      names: { w: 'Ivory', b: 'Obsidian' },
      check: this.chess.inCheck(),
      capturedByW: cw.map(t => PIECE_GLYPH[t]),
      capturedByB: cb.map(t => PIECE_GLYPH[t]),
      diff,
      clockW: this.clockW,
      clockB: this.clockB,
      over: this.over,
      canUndo: this.screen === 'game' && !this.over && this.config.mode !== 'showcase' && this.chess.history().length > 0,
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;

    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(k);
      if (k >= 1) { this.tweens.splice(i, 1); tw.done?.(); }
    }

    // camera swing
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
      const turn = this.chess.turn();
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

    // idle life: badge bob + ring pulse
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
    this.fx.clear();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
