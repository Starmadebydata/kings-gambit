import * as THREE from 'three';
import { PieceType, Side, PIECE_GLYPH } from './types';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Soft radial glow disc. */
export function makeGlowTexture(rgb: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, `rgba(${rgb},0.95)`);
  g.addColorStop(0.45, `rgba(${rgb},0.55)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return tex(c);
}

/** Ring outline glow (selection). */
export function makeRingTexture(rgb: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(128, 128);
  ctx.strokeStyle = `rgba(${rgb},1)`;
  ctx.lineWidth = 7;
  ctx.shadowColor = `rgba(${rgb},0.9)`;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.stroke();
  return tex(c);
}

/** Square border glow (last move / check). */
export function makeBorderTexture(rgb: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(128, 128);
  ctx.strokeStyle = `rgba(${rgb},0.95)`;
  ctx.lineWidth = 8;
  ctx.shadowColor = `rgba(${rgb},0.9)`;
  ctx.shadowBlur = 12;
  const r = 14;
  ctx.strokeRect(r, r, 128 - r * 2, 128 - r * 2);
  ctx.strokeRect(r, r, 128 - r * 2, 128 - r * 2);
  // faint inner fill
  ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(${rgb},0.14)`;
  ctx.fillRect(r, r, 128 - r * 2, 128 - r * 2);
  return tex(c);
}

function shieldPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h * 0.52);
  ctx.quadraticCurveTo(x + w, y + h * 0.78, x + w / 2, y + h);
  ctx.quadraticCurveTo(x, y + h * 0.78, x, y + h * 0.52);
  ctx.closePath();
}

/** Floating shield badge with piece glyph, like a heraldic marker. */
export function makeBadgeTexture(type: PieceType, side: Side): THREE.CanvasTexture {
  return makeGlyphBadge(PIECE_GLYPH[type], side === 'w' ? '#d9b45c' : '#c8503c', '#f3ecd9', side);
}

/** Generic heraldic badge with a custom glyph (used for xiangqi characters). */
export function makeGlyphBadge(glyph: string, ring: string, ink: string, side: Side): THREE.CanvasTexture {
  const { c, ctx } = canvas(96, 116);
  const glowCol = side === 'w' ? 'rgba(217,180,92,0.8)' : 'rgba(200,80,60,0.8)';
  ctx.shadowColor = glowCol;
  ctx.shadowBlur = 8;
  shieldPath(ctx, 10, 8, 76, 92);
  ctx.fillStyle = 'rgba(18,14,10,0.92)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.shadowBlur = 0;
  shieldPath(ctx, 16, 14, 64, 80);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(217,180,92,0.35)';
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = '700 50px "Kaiti SC", "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 48, 54);
  return tex(c);
}

/** Horizontal label text (river names, banners). */
export function makeLabelTexture(text: string, color: string, fontPx = 64): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 128);
  ctx.fillStyle = color;
  ctx.font = `700 ${fontPx}px "Kaiti SC", "STKaiti", "KaiTi", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 10;
  ctx.fillText(text, 256, 66);
  return tex(c);
}

/** Gold serif coordinate character. */
export function makeCoordTexture(ch: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(64, 64);
  ctx.fillStyle = '#c8a24e';
  ctx.font = '600 44px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  ctx.fillText(ch, 32, 34);
  return tex(c);
}

/** Plank wood texture for the board slab. */
export function makeWoodTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#241a10';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9; i++) {
    const y = i * 58;
    const g = ctx.createLinearGradient(0, y, 0, y + 58);
    g.addColorStop(0, `rgba(${60 + (i % 3) * 10},${40 + (i % 4) * 6},22,1)`);
    g.addColorStop(0.5, '#2b1e12');
    g.addColorStop(1, '#1d1409');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, 512, 56);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, y, 512, 56);
  }
  for (let i = 0; i < 240; i++) {
    ctx.strokeStyle = `rgba(${20 + Math.random() * 30},${12 + Math.random() * 16},6,${0.12 + Math.random() * 0.15})`;
    ctx.lineWidth = 1 + Math.random();
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(140, y + 6 - Math.random() * 12, 360, y + 6 - Math.random() * 12, 512, y);
    ctx.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    ctx.strokeStyle = 'rgba(15,9,4,0.5)';
    ctx.lineWidth = 2;
    for (let r = 2; r < 12; r += 3) { ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r, 0.3, 0, Math.PI * 2); ctx.stroke(); }
  }
  return tex(c);
}

/** River band texture: deep water with wave strokes. */
export function makeRiverTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 120);
  const g = ctx.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, '#0d2434');
  g.addColorStop(0.5, '#164058');
  g.addColorStop(1, '#0d2434');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 120);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 1024, y = 12 + Math.random() * 96, w = 26 + Math.random() * 70;
    ctx.strokeStyle = `rgba(140,200,235,${0.08 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 5 - Math.random() * 5, x + w, y);
    ctx.stroke();
  }
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(190,230,255,${0.1 + Math.random() * 0.16})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 120, 2 + Math.random() * 3, 1.5);
  }
  return tex(c);
}

/** Simple heraldic shield used in HUD panels (data-url for CSS). */
export function shieldDataUrl(side: Side): string {
  const { c, ctx } = canvas(48, 56);
  const ring = side === 'w' ? '#d9b45c' : '#c8503c';
  shieldPath(ctx, 4, 3, 40, 48);
  ctx.fillStyle = side === 'w' ? '#20242c' : '#2a1512';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
  ctx.stroke();
  return c.toDataURL();
}
