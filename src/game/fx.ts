import * as THREE from 'three';

/**
 * 轻量级游戏特效系统：爆裂火花、冲击环、尘土。
 * 无外部资源、无依赖，两个 3D 游戏共用。所有特效挂在 group 下，由 update(dt) 驱动。
 */

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  dur: number;
  gravity: number;
  drag: number;
  spin: THREE.Vector3;
  baseOpacity: number;
  shrink: number; // 每帧缩小系数（碎片类特效应远小于 1，保持飞散尺寸）
}

interface RingFx {
  mesh: THREE.Mesh;
  life: number;
  dur: number;
  maxScale: number;
  opacity: number;    // 初始透明度
  startScale: number; // 起始 scale
}

export interface BurstOpts {
  speed?: number;   // 基础飞散速度
  up?: number;      // 额外向上分量
  count?: number;
  size?: number;    // 粒子基础尺寸
  dur?: number;
  gravity?: number;
}

export class FxSystem {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private rings: RingFx[] = [];
  private geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  private ringGeo = new THREE.RingGeometry(0.11, 0.19, 40);
  private flashGeo = new THREE.CircleGeometry(0.5, 28);

  /** 爆裂火花：从一点向四周飞散，带重力、自旋与淡出（加法混合，发光感）。 */
  burst(pos: THREE.Vector3, color: number, count = 10, opts: BurstOpts = {}) {
    const { speed = 1.6, up = 1.0, size = 0.09, dur = 0.55, gravity = 4.5 } = opts;
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.5 + Math.random() * 0.7);
      const mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
        color, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      mesh.position.copy(pos);
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.sin(ph) * Math.cos(th) * sp,
          Math.cos(ph) * sp + up * Math.random(),
          Math.sin(ph) * Math.sin(th) * sp
        ),
        life: 0,
        dur: dur * (0.7 + Math.random() * 0.6),
        gravity, drag: 1.3,
        spin: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
        baseOpacity: 0.95,
        shrink: 1.4
      });
    }
  }

  /** 冲击环：水平扩散、淡出的光环。 */
  ring(pos: THREE.Vector3, color: number, maxScale = 1.8, dur = 0.45) {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(this.ringGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.4);
    this.group.add(mesh);
    this.rings.push({ mesh, life: 0, dur, maxScale, opacity: 0.8, startScale: 0.4 });
  }

  /** 爆炸闪光：实心圆盘快速扩散后淡出（加法混合），炮弹落地瞬间的强闪光。 */
  flash(pos: THREE.Vector3, color: number, maxScale = 1.4, dur = 0.28) {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(this.flashGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.12);
    this.group.add(mesh);
    this.rings.push({ mesh, life: 0, dur, maxScale, opacity: 0.95, startScale: 0.12 });
  }

  /** 碎片：被炸碎的残片，偏上半球飞散、重自旋、几乎不缩小（普通混合，实体感）。 */
  debris(pos: THREE.Vector3, color: number, count = 10, opts: BurstOpts = {}) {
    const { speed = 3.2, up = 2.2, size = 0.11, dur = 0.85, gravity = 7 } = opts;
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.9); // 偏向上半球的飞散方向
      const sp = speed * (0.5 + Math.random() * 0.8);
      const mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({
        color, roughness: 0.55, metalness: 0.2
      }));
      mesh.scale.set(
        size * (0.7 + Math.random() * 1.1),
        size * (0.5 + Math.random() * 0.9),
        size * (0.7 + Math.random() * 1.1)
      );
      mesh.position.copy(pos);
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.sin(ph) * Math.cos(th) * sp,
          Math.cos(ph) * sp + up * Math.random(),
          Math.sin(ph) * Math.sin(th) * sp
        ),
        life: 0,
        dur: dur * (0.6 + Math.random() * 0.7),
        gravity, drag: 1.6,
        spin: new THREE.Vector3((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22),
        baseOpacity: 1,
        shrink: 0.25
      });
    }
  }

  dust(pos: THREE.Vector3, count = 6, color = 0xb9b0a0) {
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const r = 0.1 + Math.random() * 0.3;
      const mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
        color, transparent: true, depthWrite: false
      }));
      mesh.scale.setScalar(0.05 + Math.random() * 0.05);
      mesh.position.set(pos.x + Math.cos(th) * r, pos.y + 0.02 + Math.random() * 0.02, pos.z + Math.sin(th) * r);
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.22 + Math.random() * 0.3, (Math.random() - 0.5) * 0.35),
        life: 0,
        dur: 0.5 + Math.random() * 0.3,
        gravity: -0.15, drag: 1.4,
        spin: new THREE.Vector3(0, 0, 0),
        baseOpacity: 0.45,
        shrink: 1.4
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const f = this.particles[i];
      f.life += dt;
      const k = f.life / f.dur;
      if (k >= 1) {
        this.group.remove(f.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      f.vel.y -= f.gravity * dt;
      f.vel.multiplyScalar(Math.max(0, 1 - f.drag * dt));
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.y += f.spin.y * dt;
      f.mesh.rotation.z += f.spin.z * dt;
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = f.baseOpacity * (1 - k);
      f.mesh.scale.multiplyScalar(1 - dt * f.shrink);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const k = r.life / r.dur;
      if (k >= 1) {
        this.group.remove(r.mesh);
        this.rings.splice(i, 1);
        continue;
      }
      r.mesh.scale.setScalar(r.startScale + (r.maxScale - r.startScale) * easeOut(k));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = r.opacity * (1 - k);
    }
  }

  clear() {
    for (const f of this.particles) this.group.remove(f.mesh);
    for (const r of this.rings) this.group.remove(r.mesh);
    this.particles = [];
    this.rings = [];
  }
}
