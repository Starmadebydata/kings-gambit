import * as THREE from 'three';
import { makeGlowTexture } from './textures';

export interface Environment {
  update: (t: number, dt: number) => void;
}

/** Dark ruined-arena backdrop: stone floor, pillars, snow rocks, drifting motes. */
export function buildEnvironment(scene: THREE.Scene): Environment {
  // ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(45, 48),
    new THREE.MeshStandardMaterial({ color: 0x171c26, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);

  // stone slab ring under board
  const slab = new THREE.Mesh(
    new THREE.CylinderGeometry(8.5, 9.5, 0.35, 10),
    new THREE.MeshStandardMaterial({ color: 0x232936, roughness: 0.95, flatShading: true })
  );
  slab.position.y = -0.32;
  slab.receiveShadow = true;
  scene.add(slab);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.9, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xdfe4ec, roughness: 0.85, flatShading: true });

  // broken pillars ring
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = 15 + (i % 3) * 2.5;
    const broken = i % 3 === 1;
    const h = broken ? 2 + (i % 4) : 9;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, h, 7), pillarMat);
    pil.position.set(Math.cos(a) * r, h / 2 - 0.2, Math.sin(a) * r);
    pil.rotation.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06);
    scene.add(pil);
    if (!broken) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), pillarMat);
      cap.position.set(pil.position.x, h + 0.0, pil.position.z);
      scene.add(cap);
    }
  }

  // scattered snow rocks
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 9 + Math.random() * 16;
    const s = 0.35 + Math.random() * 1.1;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(Math.cos(a) * r, s * 0.4 - 0.15, Math.sin(a) * r);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.scale.y = 0.7 + Math.random() * 0.5;
    scene.add(rock);
  }

  // distant mountain silhouettes
  const mountMat = new THREE.MeshStandardMaterial({ color: 0x0d1119, roughness: 1, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const r = 34 + (i % 3) * 6;
    const h = 9 + (i % 4) * 4;
    const mnt = new THREE.Mesh(new THREE.ConeGeometry(8 + (i % 3) * 4, h, 5), mountMat);
    mnt.position.set(Math.cos(a) * r, h / 2 - 1.5, Math.sin(a) * r);
    mnt.rotation.y = Math.random() * 3;
    scene.add(mnt);
  }

  // star field dome
  const SN = 420;
  const spos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * Math.PI * 0.45 + 0.12;
    spos[i * 3] = Math.cos(a) * Math.cos(e) * 70;
    spos[i * 3 + 1] = Math.sin(e) * 70;
    spos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 70;
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  scene.add(new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xcfd8ea, size: 0.28, transparent: true, opacity: 0.75, depthWrite: false, fog: false })));

  // moon with halo
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 10), new THREE.MeshBasicMaterial({ color: 0xdfe8f6, fog: false }));
  moon.position.set(-24, 16, -30);
  scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('190,210,240'), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  moonGlow.scale.setScalar(14);
  moonGlow.position.copy(moon.position);
  scene.add(moonGlow);

  // war banners ring
  const banners: THREE.Mesh[] = [];
  const bannerCols = [0x7a2a26, 0x24406a];
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb98f3e, roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.15;
    const x = Math.cos(a) * 12.5, z = Math.sin(a) * 12.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.4, 6), pillarMat);
    pole.position.set(x, 2.0, z);
    scene.add(pole);
    const ban = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.04), new THREE.MeshStandardMaterial({ color: bannerCols[i % 2], roughness: 0.9 }));
    ban.position.set(x + 0.45, 3.0, z);
    scene.add(ban);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.05), trimMat);
    trim.position.set(x + 0.45, 3.95, z);
    scene.add(trim);
    banners.push(ban);
  }

  // braziers with flames + glow
  const flames: THREE.Mesh[] = [];
  const glowTexO = makeGlowTexture('255,150,70');
  const brazier = (x: number, z: number, h: number) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, h, 6), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.5 }));
    stand.position.set(x, h / 2, z);
    scene.add(stand);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 0.22, 7), new THREE.MeshStandardMaterial({ color: 0x333845, roughness: 0.5, metalness: 0.6 }));
    bowl.position.set(x, h + 0.1, z);
    scene.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffa050 }));
    flame.position.set(x, h + 0.42, z);
    scene.add(flame);
    flames.push(flame);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexO, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.scale.setScalar(2.6);
    gl.position.set(x, h + 0.45, z);
    scene.add(gl);
  };
  brazier(9, 9, 2.6); brazier(-9, -9, 2.6); brazier(9, -9, 2.2); brazier(-9, 9, 2.2);

  // rising embers around braziers
  const EN = 120;
  const epos = new Float32Array(EN * 3);
  const espd = new Float32Array(EN);
  const centers = [[9, 9], [-9, -9], [9, -9], [-9, 9]];
  for (let i = 0; i < EN; i++) {
    const c = centers[i % 4];
    epos[i * 3] = c[0] + (Math.random() - 0.5) * 1.2;
    epos[i * 3 + 1] = Math.random() * 4;
    epos[i * 3 + 2] = c[1] + (Math.random() - 0.5) * 1.2;
    espd[i] = 0.5 + Math.random() * 0.9;
  }
  const egeo = new THREE.BufferGeometry();
  egeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
  scene.add(new THREE.Points(egeo, new THREE.PointsMaterial({ color: 0xff9040, size: 0.07, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));

  // lights
  scene.add(new THREE.HemisphereLight(0x5a6a8a, 0x141820, 1.15));
  const key = new THREE.DirectionalLight(0xffd7a1, 2.3);
  key.position.set(6, 12, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9; key.shadow.camera.right = 9;
  key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 2; key.shadow.camera.far = 32;
  key.shadow.bias = -0.0006;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5f7fbf, 0.5);
  rim.position.set(-8, 6, -9);
  scene.add(rim);
  const torchA = new THREE.PointLight(0xff8c3f, 22, 30, 1.8);
  torchA.position.set(9, 3.5, 9);
  scene.add(torchA);
  const torchB = new THREE.PointLight(0xff8c3f, 22, 30, 1.8);
  torchB.position.set(-9, 3.5, -9);
  scene.add(torchB);

  // drifting motes
  const N = 260;
  const pos = new Float32Array(N * 3);
  const spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = Math.random() * 7;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    spd[i] = 0.1 + Math.random() * 0.25;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(pgeo, new THREE.PointsMaterial({
    color: 0x9fb4d8, size: 0.055, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(points);

  const update = (t: number, dt: number) => {
    const arr = pgeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      let y = arr.getY(i) + spd[i] * dt;
      if (y > 7) y = 0;
      arr.setY(i, y);
      arr.setX(i, arr.getX(i) + Math.sin(t * 0.6 + i) * 0.0015);
    }
    arr.needsUpdate = true;
    torchA.intensity = 20 + Math.sin(t * 9.3) * 3 + Math.sin(t * 23.7) * 2;
    torchB.intensity = 20 + Math.cos(t * 8.1) * 3 + Math.sin(t * 19.3) * 2;
    const ea = egeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < EN; i++) {
      let y = ea.getY(i) + espd[i] * dt;
      if (y > 4.5) y = 0.2;
      ea.setY(i, y);
      ea.setX(i, ea.getX(i) + Math.sin(t * 2 + i * 1.7) * 0.004);
    }
    ea.needsUpdate = true;
    for (let i = 0; i < flames.length; i++) {
      flames[i].scale.y = 1 + Math.sin(t * 11 + i * 2.1) * 0.18 + Math.sin(t * 27 + i) * 0.08;
    }
    for (let i = 0; i < banners.length; i++) banners[i].rotation.y = Math.sin(t * 0.8 + i) * 0.12;
  };

  return { update };
}
