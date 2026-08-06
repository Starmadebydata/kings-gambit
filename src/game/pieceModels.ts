import * as THREE from 'three';
import { PieceType, Side } from './types';

interface Palette {
  skin: number; armor: number; armorDark: number; cloth: number;
  accent: number; cape: number; gold: number; steel: number; wood: number;
}

const PAL: Record<Side, Palette> = {
  w: {
    skin: 0xd9c6a5, armor: 0xe6ebf0, armorDark: 0xaeb9c6, cloth: 0xd8dde4,
    accent: 0x4d8fd1, cape: 0x3a5f8a, gold: 0xd9b45c, steel: 0xc3ccd6, wood: 0x8a6a45
  },
  b: {
    skin: 0xb0805f, armor: 0x3c3742, armorDark: 0x2a2530, cloth: 0x7a2a26,
    accent: 0xd0503c, cape: 0x571f1d, gold: 0xd9b45c, steel: 0x6f6a75, wood: 0x5d4430
  }
};

function mat(color: number, rough = 0.85, metal = 0.12) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true });
}

function add(g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r: number, h: number, s = 7) => new THREE.ConeGeometry(r, h, s);
const sph = (r: number) => new THREE.SphereGeometry(r, 8, 6);

function legs(g: THREE.Group, p: Palette, y: number, spread = 0.08, h = 0.22, cloth?: number) {
  const m = mat(cloth ?? p.armorDark);
  add(g, box(0.09, h, 0.11), m, -spread, y + h / 2, 0);
  add(g, box(0.09, h, 0.11), m, spread, y + h / 2, 0);
}

function torso(g: THREE.Group, p: Palette, y: number, h: number, rT: number, rB: number, color?: number) {
  return add(g, cyl(rT, rB, h, 7), mat(color ?? p.armor), 0, y + h / 2, 0);
}

function head(g: THREE.Group, p: Palette, y: number, r = 0.085) {
  return add(g, sph(r), mat(p.skin, 0.7, 0.02), 0, y, 0);
}

function cape(g: THREE.Group, p: Palette, y: number, h: number, w = 0.26) {
  add(g, box(w, h, 0.03), mat(p.cape, 0.95, 0), 0, y, -0.14, 0.08);
}

function crown(g: THREE.Group, p: Palette, y: number, r = 0.09) {
  add(g, cyl(r, r, 0.06, 8), mat(p.gold, 0.4, 0.7), 0, y, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(g, cone(0.022, 0.07, 4), mat(p.gold, 0.4, 0.7), Math.cos(a) * r * 0.8, y + 0.06, Math.sin(a) * r * 0.8);
  }
}

function spear(g: THREE.Group, p: Palette, x: number, len = 0.85) {
  add(g, cyl(0.015, 0.015, len, 5), mat(p.wood, 0.9), x, len / 2 + 0.05, 0.05);
  add(g, cone(0.035, 0.12, 4), mat(p.steel, 0.35, 0.8), x, len + 0.1, 0.05);
}

function sword(g: THREE.Group, p: Palette, x: number, y: number, tilt = -0.5) {
  const s = new THREE.Group();
  add(s, box(0.035, 0.5, 0.012), mat(p.steel, 0.3, 0.85), 0, 0.25, 0);
  add(s, box(0.14, 0.03, 0.03), mat(p.gold, 0.4, 0.7), 0, 0.02, 0);
  add(s, cyl(0.02, 0.02, 0.1, 5), mat(p.wood), 0, -0.05, 0);
  s.position.set(x, y, 0.08);
  s.rotation.z = tilt;
  g.add(s);
}

function staff(g: THREE.Group, p: Palette, x: number, len = 0.95, orb: number) {
  add(g, cyl(0.018, 0.022, len, 5), mat(p.wood, 0.9), x, len / 2 + 0.05, 0.04);
  const o = add(g, sph(0.05), new THREE.MeshStandardMaterial({
    color: orb, roughness: 0.3, emissive: orb, emissiveIntensity: 0.7, flatShading: true
  }), x, len + 0.1, 0.04);
  return o;
}

function hammer(g: THREE.Group, p: Palette, x: number) {
  add(g, cyl(0.02, 0.02, 0.7, 5), mat(p.wood, 0.9), x, 0.4, 0.06);
  add(g, box(0.16, 0.16, 0.16), mat(p.steel, 0.4, 0.7), x, 0.78, 0.06);
}

function shieldArm(g: THREE.Group, p: Palette, x: number, y: number) {
  add(g, box(0.05, 0.24, 0.16), mat(p.accent, 0.6, 0.3), x, y, 0.06);
  add(g, box(0.06, 0.1, 0.05), mat(p.gold, 0.4, 0.7), x - 0.005, y, 0.1);
}

function pauldrons(g: THREE.Group, p: Palette, y: number, r = 0.07) {
  add(g, cone(r, r, 6), mat(p.armor, 0.5, 0.4), -0.16, y, 0, 0, 0, 0.5);
  add(g, cone(r, r, 6), mat(p.armor, 0.5, 0.4), 0.16, y, 0, 0, 0, -0.5);
}

function helm(g: THREE.Group, p: Palette, y: number, plume?: number) {
  add(g, sph(0.095), mat(p.armor, 0.45, 0.5), 0, y + 0.01, 0);
  add(g, box(0.13, 0.02, 0.02), mat(0x111111, 0.9), 0, y + 0.01, 0.085);
  if (plume) add(g, box(0.02, 0.16, 0.12), mat(plume, 0.95), 0, y + 0.12, -0.02, -0.3);
}

function mitre(g: THREE.Group, p: Palette, y: number) {
  add(g, cone(0.09, 0.22, 6), mat(p.cloth, 0.8), 0, y + 0.12, 0);
  add(g, cyl(0.095, 0.095, 0.04, 8), mat(p.gold, 0.4, 0.7), 0, y + 0.02, 0);
}

/** Builds a stylized low-poly warrior figure for a chess piece. */
export function buildPieceModel(type: PieceType, side: Side): THREE.Group {
  return buildFigure(type, PAL[side], side);
}

export type XqType = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p';
type FigureKind = PieceType;

const XQ_PAL: Record<Side, Palette> = {
  w: { skin: 0xd9c6a5, armor: 0xc9a24e, armorDark: 0x8a6f3a, cloth: 0x9a2622, accent: 0xd0503c, cape: 0x6a1a16, gold: 0xd9b45c, steel: 0xc3ccd6, wood: 0x8a6a45 },
  b: { skin: 0xc9b08f, armor: 0x2f3a46, armorDark: 0x1d2530, cloth: 0x1d2732, accent: 0x4d8fd1, cape: 0x101a24, gold: 0xb9c2cc, steel: 0x8a94a0, wood: 0x5d4430 }
};

/** Builds a xiangqi warrior figure (red = side 'w', black = side 'b'). */
export function buildXqModel(type: XqType, side: Side): THREE.Group {
  return buildXqFigure(type, XQ_PAL[side], side);
}

function buildFigure(kind: FigureKind, p: Palette, side: Side): THREE.Group {
  const g = new THREE.Group();

  switch (kind) {
    case 'p': { // foot soldier with spear
      legs(g, p, 0, 0.07, 0.2, p.cloth);
      torso(g, p, 0.2, 0.26, 0.11, 0.15, p.cloth);
      add(g, cone(0.13, 0.09, 7), mat(p.armor, 0.5, 0.4), 0, 0.48, 0); // breastplate
      head(g, p, 0.56);
      helm(g, p, 0.57);
      spear(g, p, 0.17, 0.8);
      break;
    }
    case 'r': { // bulky heavy with war hammer
      legs(g, p, 0, 0.1, 0.2);
      torso(g, p, 0.2, 0.3, 0.17, 0.2);
      pauldrons(g, p, 0.5, 0.09);
      head(g, p, 0.58, 0.08);
      helm(g, p, 0.59);
      hammer(g, p, 0.22);
      shieldArm(g, p, -0.22, 0.38);
      break;
    }
    case 'n': { // swordsman with plumed helm
      legs(g, p, 0, 0.08, 0.22);
      torso(g, p, 0.22, 0.28, 0.12, 0.16);
      pauldrons(g, p, 0.5, 0.07);
      head(g, p, 0.6);
      helm(g, p, 0.61, side === 'w' ? 0x2e4d71 : 0x7a2a26);
      sword(g, p, 0.2, 0.42, -0.6);
      shieldArm(g, p, -0.2, 0.4);
      cape(g, p, 0.42, 0.34);
      break;
    }
    case 'b': { // robed mystic with glowing staff
      add(g, cone(0.2, 0.5, 7), mat(p.cloth, 0.9), 0, 0.25, 0);
      torso(g, p, 0.42, 0.22, 0.1, 0.13, p.cloth);
      head(g, p, 0.7);
      mitre(g, p, 0.72);
      staff(g, p, 0.18, 0.9, side === 'w' ? 0x7fb4ff : 0xff7a4d);
      cape(g, p, 0.5, 0.4, 0.22);
      break;
    }
    case 'q': { // crowned sovereign
      add(g, cone(0.24, 0.62, 8), mat(p.cloth, 0.9), 0, 0.31, 0);
      torso(g, p, 0.5, 0.24, 0.1, 0.14, p.cloth);
      add(g, cyl(0.13, 0.13, 0.05, 8), mat(p.gold, 0.4, 0.7), 0, 0.62, 0);
      head(g, p, 0.8);
      crown(g, p, 0.88, 0.085);
      staff(g, p, 0.17, 0.85, side === 'w' ? 0xbfe0ff : 0xffb46a);
      cape(g, p, 0.58, 0.5, 0.28);
      pauldrons(g, p, 0.72, 0.05);
      break;
    }
    case 'k': { // tall war-king with greatsword
      add(g, cone(0.25, 0.68, 8), mat(p.cape, 0.9), 0, 0.34, 0);
      torso(g, p, 0.52, 0.26, 0.12, 0.16);
      pauldrons(g, p, 0.78, 0.07);
      head(g, p, 0.86);
      crown(g, p, 0.95, 0.09);
      sword(g, p, 0.22, 0.5, -0.35);
      cape(g, p, 0.62, 0.56, 0.3);
      break;
    }
  }

  // organic variation
  g.rotation.y = (Math.random() - 0.5) * 0.9;
  const s = 0.96 + Math.random() * 0.08;
  g.scale.setScalar(s);
  g.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

/* ---------- xiangqi figures: original Chinese war-band designs ---------- */

/** Wide conical hat with a gold finial. */
function conicHat(g: THREE.Group, p: Palette, y: number, r = 0.14, color?: number) {
  add(g, cone(r, 0.1, 8), mat(color ?? p.armorDark, 0.7, 0.25), 0, y + 0.04, 0);
  add(g, sph(0.022), mat(p.gold, 0.4, 0.7), 0, y + 0.1, 0);
}

/** Chinese helm with brim and tall tassel plume. */
function tasselHelm(g: THREE.Group, p: Palette, y: number, tassel: number) {
  add(g, cyl(0.105, 0.11, 0.03, 8), mat(p.gold, 0.45, 0.6), 0, y - 0.03, 0);
  add(g, sph(0.095), mat(p.armor, 0.45, 0.5), 0, y + 0.01, 0);
  add(g, cyl(0.012, 0.012, 0.1, 5), mat(p.gold, 0.45, 0.6), 0, y + 0.13, 0);
  add(g, cone(0.05, 0.13, 6), mat(tassel, 0.95), 0, y + 0.23, 0);
}

/** Four opera-style command flags fanned on the back. */
function backFlags(g: THREE.Group, p: Palette, y: number, color: number) {
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    add(f, cyl(0.008, 0.008, 0.52, 4), mat(p.wood, 0.9), 0, 0.26, 0);
    add(f, box(0.11, 0.17, 0.012), mat(color, 0.95), 0.06, 0.42, 0);
    add(f, box(0.11, 0.022, 0.014), mat(p.gold, 0.5, 0.6), 0.06, 0.51, 0);
    f.position.set(-0.13 + i * 0.087, y, -0.13);
    f.rotation.z = (i - 1.5) * 0.24;
    g.add(f);
  }
}

/** Curved dao saber with flaring tip. */
function dao(g: THREE.Group, p: Palette, x: number, y: number, tilt = -0.7) {
  const s = new THREE.Group();
  add(s, cyl(0.016, 0.016, 0.12, 5), mat(p.wood), 0, 0, 0);
  add(s, cyl(0.032, 0.032, 0.016, 6), mat(p.gold, 0.45, 0.6), 0, 0.07, 0);
  add(s, box(0.028, 0.32, 0.012), mat(p.steel, 0.3, 0.85), 0.015, 0.24, 0, 0, 0, 0.1);
  add(s, box(0.05, 0.13, 0.012), mat(p.steel, 0.3, 0.85), 0.055, 0.43, 0, 0, 0, 0.45);
  s.position.set(x, y, 0.08);
  s.rotation.z = tilt;
  g.add(s);
}

/** Ji halberd: long shaft, spear tip and side crescent blade. */
function halberd(g: THREE.Group, p: Palette, x: number, len = 1.0) {
  add(g, cyl(0.014, 0.014, len, 5), mat(p.wood, 0.9), x, len / 2 + 0.05, 0.04);
  add(g, cone(0.028, 0.14, 4), mat(p.steel, 0.35, 0.8), x, len + 0.11, 0.04);
  add(g, box(0.1, 0.13, 0.012), mat(p.steel, 0.35, 0.8), x + 0.06, len + 0.03, 0.04, 0, 0, -0.45);
  add(g, cone(0.04, 0.05, 6), mat(0xc8503c, 0.95), x, len + 0.03, 0.04);
}

/** Spear with a tassel tuft under the blade. */
function tasseledSpear(g: THREE.Group, p: Palette, x: number, tassel: number, len = 0.78) {
  add(g, cyl(0.014, 0.014, len, 5), mat(p.wood, 0.9), x, len / 2 + 0.05, 0.05);
  add(g, cone(0.045, 0.05, 6), mat(tassel, 0.95), x, len + 0.04, 0.05);
  add(g, cone(0.028, 0.13, 4), mat(p.steel, 0.35, 0.8), x, len + 0.12, 0.05);
}

/** Official cap with horizontal wing flaps. */
function futou(g: THREE.Group, y: number) {
  add(g, cyl(0.085, 0.095, 0.1, 7), mat(0x171a21, 0.65, 0.2), 0, y + 0.05, 0);
  add(g, box(0.36, 0.024, 0.05), mat(0x171a21, 0.65, 0.2), 0, y + 0.01, -0.03);
}

/** Court tablet held ahead with both wide sleeves. */
function huTablet(g: THREE.Group, p: Palette) {
  add(g, box(0.07, 0.17, 0.09), mat(p.cloth, 0.9), -0.09, 0.5, 0.1, 0.5, 0, 0.2);
  add(g, box(0.07, 0.17, 0.09), mat(p.cloth, 0.9), 0.09, 0.5, 0.1, 0.5, 0, -0.2);
  add(g, box(0.05, 0.24, 0.014), mat(0xe8e0cc, 0.55, 0.05), 0, 0.58, 0.13, 0.3);
}

/** Flat feather fan of the strategist. */
function featherFan(g: THREE.Group, p: Palette, x: number) {
  const s = new THREE.Group();
  add(s, cyl(0.009, 0.009, 0.16, 4), mat(p.wood), 0, 0, 0);
  const blade = add(s, cone(0.1, 0.22, 6), mat(0xe6e1d3, 0.9, 0), 0, 0.18, 0);
  blade.scale.z = 0.22;
  s.position.set(x, 0.55, 0.1);
  s.rotation.z = x > 0 ? -0.35 : 0.35;
  g.add(s);
}

/** Straight jian sword with hanging tassel. */
function jian(g: THREE.Group, p: Palette, x: number, y: number, tassel: number, tilt = -0.4) {
  const s = new THREE.Group();
  add(s, box(0.03, 0.48, 0.012), mat(p.steel, 0.3, 0.85), 0, 0.26, 0);
  add(s, box(0.12, 0.025, 0.03), mat(p.gold, 0.45, 0.6), 0, 0.02, 0);
  add(s, cyl(0.018, 0.018, 0.09, 5), mat(p.wood), 0, -0.04, 0);
  add(s, cone(0.025, 0.06, 5), mat(tassel, 0.95), 0, -0.11, 0.01, Math.PI);
  s.position.set(x, y, 0.08);
  s.rotation.z = tilt;
  g.add(s);
}

/** Conical spiked helm with trailing plume (black army style). */
function spikeHelm(g: THREE.Group, p: Palette, y: number, plume: number) {
  add(g, cyl(0.1, 0.105, 0.025, 8), mat(p.armorDark, 0.5, 0.5), 0, y - 0.03, 0);
  add(g, cone(0.095, 0.13, 7), mat(p.armor, 0.45, 0.5), 0, y + 0.04, 0);
  add(g, cyl(0.008, 0.008, 0.09, 4), mat(p.gold, 0.45, 0.6), 0, y + 0.14, 0);
  add(g, box(0.02, 0.03, 0.14), mat(plume, 0.95), 0, y + 0.12, -0.07, 0.5);
}

/** Flat triangular pennant, tip toward +x (black army style). */
function pennant(g: THREE.Group, color: number, x: number, y: number, z: number) {
  const f = add(g, cone(0.09, 0.24, 3), mat(color, 0.95), x, y, z, 0, 0, -Math.PI / 2);
  f.scale.z = 0.18;
}

/** Four triangular pennants fanned on the back. */
function backPennants(g: THREE.Group, p: Palette, y: number, color: number) {
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    add(f, cyl(0.008, 0.008, 0.52, 4), mat(p.wood, 0.9), 0, 0.26, 0);
    const pn = add(f, cone(0.08, 0.24, 3), mat(color, 0.95), 0.05, 0.44, 0, 0, 0, -Math.PI / 2);
    pn.scale.z = 0.18;
    f.position.set(-0.13 + i * 0.087, y, -0.13);
    f.rotation.z = (i - 1.5) * 0.24;
    g.add(f);
  }
}

/** Low-poly horse facing +z, returns its group for positioning. */
function horseBody(g: THREE.Group, color: number, s: number, tack: number) {
  const h = new THREE.Group();
  const m = mat(color, 0.9, 0);
  add(h, box(0.2, 0.18, 0.42), m, 0, 0.34, 0);
  add(h, box(0.05, 0.3, 0.05), m, -0.07, 0.15, 0.15);
  add(h, box(0.05, 0.3, 0.05), m, 0.07, 0.15, 0.15);
  add(h, box(0.05, 0.3, 0.05), m, -0.07, 0.15, -0.15);
  add(h, box(0.05, 0.3, 0.05), m, 0.07, 0.15, -0.15);
  add(h, box(0.09, 0.24, 0.1), m, 0, 0.5, 0.25, 0.5);
  add(h, box(0.08, 0.1, 0.2), m, 0, 0.64, 0.37);
  add(h, cone(0.02, 0.06, 4), m, -0.03, 0.71, 0.32);
  add(h, cone(0.02, 0.06, 4), m, 0.03, 0.71, 0.32);
  add(h, box(0.02, 0.03, 0.18), m, 0, 0.38, -0.28, 0.7);
  add(h, box(0.015, 0.14, 0.08), mat(0x17120e, 0.95), 0, 0.56, 0.2, 0.5);   // mane
  add(h, box(0.055, 0.06, 0.055), mat(0x14100c, 0.9), -0.07, 0.03, 0.15);  // hooves
  add(h, box(0.055, 0.06, 0.055), mat(0x14100c, 0.9), 0.07, 0.03, 0.15);
  add(h, box(0.055, 0.06, 0.055), mat(0x14100c, 0.9), -0.07, 0.03, -0.15);
  add(h, box(0.055, 0.06, 0.055), mat(0x14100c, 0.9), 0.07, 0.03, -0.15);
  add(h, box(0.22, 0.05, 0.22), mat(tack, 0.9), 0, 0.45, -0.02);
  add(h, box(0.09, 0.03, 0.1), mat(tack, 0.9), 0, 0.7, 0.42);
  h.scale.setScalar(s);
  g.add(h);
  return h;
}

/** Chariot wheel with axis along x, with spokes. */
function wheel(g: THREE.Group, p: Palette, x: number, y: number, z: number, r = 0.16) {
  add(g, cyl(r, r, 0.035, 10), mat(p.wood, 0.85, 0.1), x, y, z, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const s = add(g, box(0.045, r * 1.75, 0.02), mat(p.wood, 0.85), x, y, z);
    s.rotation.x = (i / 4) * Math.PI;
  }
  add(g, cyl(0.035, 0.035, 0.07, 6), mat(p.gold, 0.5, 0.5), x, y, z, 0, 0, Math.PI / 2);
}

/** Ruyi scepter of the black minister. */
function ruyi(g: THREE.Group, p: Palette, x: number) {
  const s = new THREE.Group();
  add(s, cyl(0.012, 0.012, 0.3, 5), mat(p.gold, 0.5, 0.5), 0, 0.15, 0);
  const hd = add(s, cone(0.06, 0.08, 5), mat(p.gold, 0.5, 0.5), 0, 0.32, 0);
  hd.scale.z = 0.4;
  s.position.set(x, 0.5, 0.1);
  s.rotation.z = -0.3;
  g.add(s);
}

function buildXqFigure(type: XqType, p: Palette, side: Side): THREE.Group {
  const g = new THREE.Group();
  const tassel = side === 'w' ? 0xd0503c : 0x4d8fd1;

  switch (type) {
    case 'p': { // soldier: red conical hat vs black spiked helm
      legs(g, p, 0, 0.07, 0.2, p.cloth);
      torso(g, p, 0.2, 0.24, 0.1, 0.14, p.cloth);
      add(g, cyl(0.13, 0.14, 0.05, 7), mat(p.armorDark, 0.7, 0.25), 0, 0.26, 0);
      head(g, p, 0.53);
      if (side === 'w') conicHat(g, p, 0.57, 0.13);
      else spikeHelm(g, p, 0.56, tassel);
      add(g, box(0.05, 0.16, 0.06), mat(p.cloth, 0.9), 0.12, 0.4, 0.06, 0, 0, -0.7);  // spear arm
      add(g, box(0.05, 0.16, 0.06), mat(p.cloth, 0.9), -0.12, 0.4, 0.05, 0, 0, 0.5);
      add(g, cyl(0.08, 0.09, 0.025, 6), mat(p.armor, 0.5, 0.4), -0.17, 0.42, 0.08, 0, 0, Math.PI / 2); // buckler
      add(g, box(0.04, 0.26, 0.02), mat(p.accent, 0.9), 0, 0.34, 0.13, 0, 0, 0.6);   // sash
      tasseledSpear(g, p, 0.17, tassel);
      break;
    }
    case 'h': { // cavalry: mounted warrior on horse
      horseBody(g, side === 'w' ? 0x8a5a33 : 0x23262d, 1, p.accent);
      torso(g, p, 0.5, 0.2, 0.09, 0.12);
      pauldrons(g, p, 0.68, 0.05);
      head(g, p, 0.76, 0.075);
      if (side === 'w') { tasselHelm(g, p, 0.77, tassel); dao(g, p, 0.16, 0.6, -0.9); }
      else { spikeHelm(g, p, 0.77, tassel); tasseledSpear(g, p, 0.16, tassel, 0.7); }
      add(g, box(0.045, 0.16, 0.05), mat(p.armor, 0.8), 0.12, 0.62, 0.06, 0, 0, -0.8); // weapon arm
      add(g, box(0.045, 0.16, 0.05), mat(p.armor, 0.8), -0.11, 0.62, 0.1, 0.6, 0, 0.4); // rein arm
      add(g, box(0.015, 0.015, 0.42), mat(0x3a2a1a, 0.9), 0, 0.62, 0.26, 0.5);  // reins
      add(g, box(0.02, 0.14, 0.04), mat(p.gold, 0.5, 0.5), -0.12, 0.42, 0);     // stirrups
      add(g, box(0.02, 0.14, 0.04), mat(p.gold, 0.5, 0.5), 0.12, 0.42, 0);
      break;
    }
    case 'r': { // war chariot: horse + two-wheel cart + warrior
      const hh = horseBody(g, side === 'w' ? 0x7a4a2a : 0x1d2026, 0.8, p.accent);
      hh.position.z = 0.48;
      add(g, cyl(0.02, 0.02, 0.5, 5), mat(p.wood, 0.9), 0, 0.22, 0.28, Math.PI / 2 - 0.15);
      add(g, box(0.34, 0.16, 0.3), mat(p.wood, 0.85), 0, 0.3, -0.12);
      add(g, box(0.36, 0.1, 0.03), mat(p.accent, 0.9), 0, 0.42, -0.26);
      wheel(g, p, -0.2, 0.16, -0.1);
      wheel(g, p, 0.2, 0.16, -0.1);
      torso(g, p, 0.42, 0.22, 0.1, 0.13);
      head(g, p, 0.7);
      add(g, box(0.05, 0.18, 0.06), mat(p.armor, 0.8), 0.13, 0.55, 0.06, 0, 0, -0.7);
      add(g, box(0.05, 0.18, 0.06), mat(p.armor, 0.8), -0.12, 0.55, 0.1, 0.7, 0, 0.4);
      add(g, box(0.015, 0.015, 0.6), mat(0x3a2a1a, 0.9), 0, 0.6, 0.3, 1.2);   // reins to horse
      add(g, box(0.03, 0.08, 0.3), mat(p.wood, 0.85), -0.17, 0.42, -0.12);    // side rails
      add(g, box(0.03, 0.08, 0.3), mat(p.wood, 0.85), 0.17, 0.42, -0.12);
      if (side === 'w') {
        tasselHelm(g, p, 0.71, tassel);
        halberd(g, p, 0.16, 0.95);
        add(g, cyl(0.015, 0.015, 0.55, 5), mat(p.wood, 0.9), -0.12, 0.75, -0.18); // Qin canopy
        add(g, cone(0.26, 0.1, 8), mat(p.cloth, 0.9), -0.12, 1.05, -0.18);
      } else {
        spikeHelm(g, p, 0.71, tassel);
        dao(g, p, 0.16, 0.55, -0.8);
        add(g, cyl(0.01, 0.01, 0.6, 4), mat(p.wood, 0.9), -0.14, 0.7, -0.24);
        add(g, cyl(0.01, 0.01, 0.6, 4), mat(p.wood, 0.9), 0.14, 0.7, -0.24);
        pennant(g, tassel, -0.22, 0.98, -0.24);
        pennant(g, tassel, 0.06, 0.98, -0.24);
      }
      break;
    }
    case 'c': { // field cannon on wheeled carriage + gunner
      add(g, box(0.18, 0.08, 0.34), mat(p.wood, 0.85), 0, 0.18, 0);
      wheel(g, p, -0.13, 0.14, 0.02, 0.14);
      wheel(g, p, 0.13, 0.14, 0.02, 0.14);
      if (side === 'w') {
        add(g, cyl(0.06, 0.08, 0.42, 7), mat(p.gold, 0.4, 0.7), 0, 0.3, 0.06, Math.PI / 2 - 0.35);
        add(g, cyl(0.07, 0.07, 0.05, 7), mat(p.armorDark, 0.5, 0.6), 0, 0.37, 0.25, Math.PI / 2 - 0.35);
        add(g, cyl(0.075, 0.075, 0.03, 7), mat(p.armorDark, 0.5, 0.6), 0, 0.26, -0.06, Math.PI / 2 - 0.35);
        add(g, cyl(0.07, 0.07, 0.03, 7), mat(p.armorDark, 0.5, 0.6), 0, 0.33, 0.14, Math.PI / 2 - 0.35);
      } else {
        add(g, cyl(0.04, 0.06, 0.55, 7), mat(p.steel, 0.45, 0.7), 0, 0.28, 0.1, Math.PI / 2 - 0.15);
        add(g, cyl(0.05, 0.05, 0.04, 7), mat(p.armorDark, 0.5, 0.6), 0, 0.32, 0.35, Math.PI / 2 - 0.15);
        add(g, cyl(0.055, 0.055, 0.03, 7), mat(p.armorDark, 0.5, 0.6), 0, 0.27, 0.0, Math.PI / 2 - 0.15);
        add(g, cyl(0.05, 0.05, 0.03, 7), mat(p.armorDark, 0.5, 0.6), 0, 0.3, 0.2, Math.PI / 2 - 0.15);
      }
      add(g, box(0.05, 0.05, 0.3), mat(p.wood, 0.85), 0, 0.13, -0.28, -0.35); // trail
      add(g, box(0.1, 0.08, 0.09), mat(p.wood, 0.9), 0.17, 0.1, -0.22);       // ammo crate
      add(g, sph(0.028), mat(p.steel, 0.4, 0.6), 0.15, 0.16, -0.2);
      add(g, sph(0.028), mat(p.steel, 0.4, 0.6), 0.19, 0.16, -0.24);
      const gu = new THREE.Group();
      gu.position.set(0, 0, -0.3);
      g.add(gu);
      legs(gu, p, 0, 0.06, 0.18, p.cloth);
      torso(gu, p, 0.18, 0.22, 0.09, 0.13, p.cloth);
      head(gu, p, 0.48, 0.075);
      if (side === 'w') conicHat(gu, p, 0.52, 0.11);
      else spikeHelm(gu, p, 0.51, tassel);
      add(gu, cyl(0.01, 0.01, 0.5, 4), mat(p.wood, 0.9), 0.08, 0.42, 0.12, 1.1); // linstock
      add(gu, sph(0.03), new THREE.MeshStandardMaterial({ color: side === 'w' ? 0xffb46a : 0x7fb4ff, roughness: 0.3, emissive: side === 'w' ? 0xffb46a : 0x7fb4ff, emissiveIntensity: 0.9, flatShading: true }), 0.08, 0.62, 0.36);
      break;
    }
    case 'a': { // advisor: red futou+hu tablet vs black box hat+scroll
      add(g, cone(0.21, 0.56, 7), mat(p.cloth, 0.9), 0, 0.28, 0);
      add(g, cyl(0.12, 0.13, 0.04, 7), mat(p.gold, 0.5, 0.5), 0, 0.42, 0);
      torso(g, p, 0.46, 0.2, 0.1, 0.13, p.cloth);
      add(g, cyl(0.07, 0.09, 0.05, 7), mat(p.gold, 0.5, 0.5), 0, 0.66, 0);   // collar
      add(g, box(0.03, 0.14, 0.02), mat(p.gold, 0.5, 0.5), 0, 0.4, 0.19);    // belt pendant
      head(g, p, 0.72);
      if (side === 'w') {
        futou(g, 0.76);
        huTablet(g, p);
      } else {
        add(g, cyl(0.09, 0.1, 0.04, 7), mat(0x171a21, 0.65, 0.2), 0, 0.77, 0);
        add(g, box(0.14, 0.12, 0.14), mat(0x171a21, 0.65, 0.2), 0, 0.85, 0);
        add(g, box(0.07, 0.17, 0.09), mat(p.cloth, 0.9), -0.09, 0.5, 0.1, 0.5, 0, 0.2);
        add(g, box(0.07, 0.17, 0.09), mat(p.cloth, 0.9), 0.09, 0.5, 0.1, 0.5, 0, -0.2);
        add(g, cyl(0.025, 0.025, 0.26, 6), mat(0xe8e0cc, 0.55, 0.05), 0, 0.56, 0.14, 0, 0, Math.PI / 2);
      }
      break;
    }
    case 'e': { // minister: red wide-brim+fan vs black tall hat+ruyi
      add(g, cone(0.22, 0.6, 7), mat(p.cloth, 0.9), 0, 0.3, 0);
      add(g, cyl(0.13, 0.14, 0.04, 7), mat(p.armorDark, 0.6, 0.3), 0, 0.44, 0);
      torso(g, p, 0.48, 0.2, 0.1, 0.13, p.cloth);
      add(g, cyl(0.07, 0.09, 0.05, 7), mat(p.gold, 0.5, 0.5), 0, 0.68, 0);   // collar
      head(g, p, 0.74);
      if (side === 'w') {
        conicHat(g, p, 0.78, 0.17, p.cloth);
        featherFan(g, p, 0.16);
      } else {
        add(g, cyl(0.08, 0.09, 0.14, 7), mat(0x171a21, 0.65, 0.2), 0, 0.84, 0);
        add(g, sph(0.025), mat(p.gold, 0.4, 0.7), 0, 0.93, 0);
        ruyi(g, p, 0.16);
      }
      break;
    }
    case 'k': { // general: red tassel helm+rect flags+jian vs black spike helm+pennants+dao
      add(g, cone(0.24, 0.6, 8), mat(p.cape, 0.9), 0, 0.3, 0);
      torso(g, p, 0.48, 0.26, 0.13, 0.17);
      add(g, cyl(0.14, 0.15, 0.05, 8), mat(p.gold, 0.45, 0.6), 0, 0.5, 0);
      add(g, cone(0.15, 0.14, 4), mat(p.armor, 0.45, 0.5), 0, 0.66, 0.06);
      pauldrons(g, p, 0.74, 0.07);
      for (let i = -1; i <= 1; i++)
        add(g, box(0.09, 0.22, 0.03), mat(p.armor, 0.5, 0.4), i * 0.1, 0.42, 0.14, 0.15, 0, -i * 0.15); // tassets
      add(g, box(0.06, 0.22, 0.07), mat(p.armor, 0.8), 0.16, 0.62, 0.08, 0, 0, -0.6); // sword arm
      add(g, box(0.06, 0.22, 0.07), mat(p.armor, 0.8), -0.16, 0.62, 0.06, 0, 0, 0.4);
      head(g, p, 0.82);
      if (side === 'w') {
        tasselHelm(g, p, 0.83, tassel);
        backFlags(g, p, 0.62, 0x9a2622);
        jian(g, p, 0.22, 0.5, tassel);
      } else {
        spikeHelm(g, p, 0.83, tassel);
        backPennants(g, p, 0.62, p.accent);
        dao(g, p, 0.22, 0.52, -0.5);
      }
      break;
    }
  }

  // organic variation (vehicles stay aligned)
  const vehicle = type === 'h' || type === 'r' || type === 'c';
  g.rotation.y = (Math.random() - 0.5) * (vehicle ? 0.12 : 0.9);
  const s = 0.96 + Math.random() * 0.08;
  g.scale.setScalar(s);
  g.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

export const PIECE_HEIGHT: Record<PieceType, number> = {
  p: 0.7, n: 0.8, b: 0.95, r: 0.8, q: 1.0, k: 1.1
};

export const XQ_HEIGHT: Record<XqType, number> = {
  p: 0.7, h: 1.0, r: 1.15, c: 0.8, a: 0.92, e: 0.95, k: 1.15
};
