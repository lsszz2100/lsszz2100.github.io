/* Neon Breach — the arena: an orbital foundry ring built entirely from
   procedural geometry, canvas textures and analytic collision volumes. */

import * as THREE from '../vendor/three.module.js';
import { TAU, clamp, lerp, rand, randInt, rayBox, rayCylinder, pick } from './core.js';

export const ARENA = {
  radius: 33,          // structural wall radius
  playRadius: 30.4,    // player clamp
  floorY: 0,
  spawnRadius: 27,
};

const PALETTE = {
  floor: 0x0a141f,
  wall: 0x0c1824,
  metal: 0x16242f,
  teal: 0x35f0d6,
  cyan: 0x35d6ff,
  magenta: 0xff2d75,
  amber: 0xffa93d,
  violet: 0x8b5cf6,
};

/* --------------------------------------------------------------- textures */

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

function floorTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#14222f';
    g.fillRect(0, 0, w, h);
    const cell = 256;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = randInt(-7, 7);
        g.fillStyle = `rgb(${20 + v},${34 + v},${46 + v})`;
        g.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
        // panel scratches
        g.strokeStyle = 'rgba(120,180,210,0.05)';
        g.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          const sx = x * cell + rand(8, cell - 8);
          const sy = y * cell + rand(8, cell - 8);
          g.moveTo(sx, sy);
          g.lineTo(sx + rand(-40, 40), sy + rand(-30, 30));
          g.stroke();
        }
        // rivets
        g.fillStyle = 'rgba(150,200,220,0.10)';
        for (const [ox, oy] of [[14, 14], [cell - 20, 14], [14, cell - 20], [cell - 20, cell - 20]]) {
          g.beginPath();
          g.arc(x * cell + ox, y * cell + oy, 2.2, 0, TAU);
          g.fill();
        }
      }
    }
    // seams
    g.strokeStyle = 'rgba(2,6,10,0.9)';
    g.lineWidth = 7;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell); g.lineTo(w, i * cell); g.stroke();
    }
    // faint cool glow along seams
    g.strokeStyle = 'rgba(70,210,240,0.26)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * cell + 4, 0); g.lineTo(i * cell + 4, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell + 4); g.lineTo(w, i * cell + 4); g.stroke();
    }
  }, [7, 7]);
}

function wallTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#16232f';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = x % 64 === 0 ? 'rgba(48,76,98,0.6)' : 'rgba(28,48,64,0.55)';
      g.fillRect(x, 0, 30, h);
      g.fillStyle = 'rgba(2,6,10,0.55)';
      g.fillRect(x + 30, 0, 2, h);
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(70,120,150,${rand(0.02, 0.07)})`;
      g.fillRect(rand(0, w), rand(0, h), rand(6, 60), rand(1, 4));
    }
    // horizontal service bands
    [70, 210, 360].forEach((y) => {
      g.fillStyle = 'rgba(40,70,92,0.7)';
      g.fillRect(0, y, w, 10);
      g.fillStyle = 'rgba(2,6,10,0.7)';
      g.fillRect(0, y + 10, w, 3);
    });
  }, [10, 1]);
}

function windowTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#050a10';
    g.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 6; y += 10) {
      for (let x = 5; x < w - 5; x += 9) {
        if (Math.random() < 0.44) {
          const c = Math.random() < 0.18 ? '255,169,61' : Math.random() < 0.5 ? '53,214,255' : '120,200,235';
          g.fillStyle = `rgba(${c},${rand(0.35, 0.95)})`;
          g.fillRect(x, y, 5, 6);
        }
      }
    }
  });
}

function glowTexture(inner, outer) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, outer);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function holoTexture(title, sub, accent) {
  return canvasTex(1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(6,18,28,0.55)';
    g.fillRect(0, 0, w, h);
    // frame
    g.strokeStyle = accent;
    g.lineWidth = 6;
    g.globalAlpha = 0.85;
    g.strokeRect(18, 18, w - 36, h - 36);
    g.globalAlpha = 1;
    // hazard stripes
    for (let i = 0; i < 14; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,169,61,0.16)' : 'rgba(0,0,0,0)';
      g.save();
      g.translate(i * 78, h - 96);
      g.rotate(-0.35);
      g.fillRect(0, 0, 46, 130);
      g.restore();
    }
    g.fillStyle = accent;
    g.font = '900 132px "Orbitron", "Chakra", sans-serif';
    g.textBaseline = 'middle';
    g.fillText(title, 62, 150);
    g.fillStyle = 'rgba(220,245,255,0.86)';
    g.font = '700 54px "Chakra", "Pretendard", sans-serif';
    g.fillText(sub, 66, 268);
    g.fillStyle = 'rgba(53,214,255,0.5)';
    g.font = '400 30px "Chakra", monospace';
    for (let i = 0; i < 5; i++) {
      g.fillText('▚▞ 09-' + (100 + i * 37) + '  SEC-ALPHA', 66, 350 + i * 0);
      break;
    }
    // scanlines
    g.fillStyle = 'rgba(53,214,255,0.07)';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  });
}

/* --------------------------------------------------------------- sky */

function makeSky() {
  const geo = new THREE.SphereGeometry(420, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x040611) },
      mid: { value: new THREE.Color(0x0d1f33) },
      horizon: { value: new THREE.Color(0x2a1a3a) },
      glowA: { value: new THREE.Color(0x1b4f63) },
      glowB: { value: new THREE.Color(0x5a1636) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top, mid, horizon, glowA, glowB;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = mix(horizon, mid, smoothstep(0.42, 0.62, h));
        c = mix(c, top, smoothstep(0.6, 0.95, h));
        float ang = atan(vDir.z, vDir.x);
        float band = smoothstep(0.30, 0.0, abs(h - 0.52));
        c += glowA * band * (0.45 + 0.35 * sin(ang * 2.0 + 1.2));
        c += glowB * band * (0.30 + 0.30 * sin(ang * 3.0 - 2.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

function makeStars(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const theta = rand(0, TAU);
    const phi = Math.acos(rand(0.02, 0.9));
    const r = 380;
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.cos(phi) * r * 0.7 + 40;
    pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    c.setHSL(rand(0.48, 0.62), rand(0.1, 0.45), rand(0.55, 0.95));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: true, vertexColors: true, transparent: true,
    opacity: 0.9, depthWrite: false, fog: false, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)'),
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

/* --------------------------------------------------------------- materials */

function envMap(renderer) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#0a1220');
  grd.addColorStop(0.45, '#16394d');
  grd.addColorStop(0.6, '#1f5a6e');
  grd.addColorStop(0.68, '#2a1630');
  grd.addColorStop(1, '#0a1018');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  // neon strips in the environment so metal picks up colour
  const strips = [['#35f0d6', 60, 150, 120, 10], ['#ff2d75', 300, 140, 150, 8], ['#35d6ff', 200, 85, 90, 5]];
  for (const [col, x, y, w, h] of strips) {
    g.fillStyle = col;
    g.globalAlpha = 0.85;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 0.18;
    g.fillRect(x - 6, y - 8, w + 12, h + 16);
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

/* --------------------------------------------------------------- build */

export function buildArena(renderer, scene, quality) {
  const group = new THREE.Group();
  scene.add(group);

  const env = envMap(renderer);
  scene.environment = env;
  scene.fog = new THREE.FogExp2(0x0a1521, 0.0135);

  const floorTex = floorTexture();
  const wallTex = wallTexture();
  const glowCyan = glowTexture('rgba(220,255,255,1)', 'rgba(53,214,255,0.55)');
  const glowMagenta = glowTexture('rgba(255,230,240,1)', 'rgba(255,45,117,0.5)');
  const glowAmber = glowTexture('rgba(255,245,225,1)', 'rgba(255,169,61,0.5)');
  const glowTeal = glowTexture('rgba(230,255,250,1)', 'rgba(53,240,214,0.55)');

  const floorGlowTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,220,255,0.85)';
    g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.stroke();
    }
    g.fillStyle = 'rgba(90,240,255,0.5)';
    for (let i = 0; i < 26; i++) g.fillRect(rand(0, w), rand(0, h), 2, 2);
  }, [7, 7]);
  const matFloor = new THREE.MeshStandardMaterial({
    map: floorTex, color: 0xffffff, metalness: 0.7, roughness: 0.42,
    envMapIntensity: 1.15, emissive: 0x2fd8ff, emissiveMap: floorGlowTex, emissiveIntensity: 0.28,
  });
  const matWall = new THREE.MeshStandardMaterial({
    map: wallTex, color: 0xc4d4e0, metalness: 0.62, roughness: 0.55, side: THREE.BackSide,
    envMapIntensity: 0.9,
  });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x1b2b38, metalness: 0.86, roughness: 0.42, envMapIntensity: 1 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x0d1720, metalness: 0.6, roughness: 0.7 });
  const matTrimCyan = new THREE.MeshStandardMaterial({ color: 0x0d2a33, emissive: PALETTE.cyan, emissiveIntensity: 0.85, metalness: 0.4, roughness: 0.4 });
  const matTrimTeal = new THREE.MeshStandardMaterial({ color: 0x0c2c28, emissive: PALETTE.teal, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.4 });
  const matTrimMagenta = new THREE.MeshStandardMaterial({ color: 0x2c0d1a, emissive: PALETTE.magenta, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.4 });
  const matTrimAmber = new THREE.MeshStandardMaterial({ color: 0x2c1e0a, emissive: PALETTE.amber, emissiveIntensity: 0.75, metalness: 0.4, roughness: 0.4 });

  /* sky + stars + skyline */
  const sky = makeSky();
  group.add(sky);
  const stars = makeStars(quality === 'low' ? 500 : 1100);
  group.add(stars);

  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x0a121b, metalness: 0.5, roughness: 0.7,
    emissive: 0xffffff, emissiveMap: windowTexture(), emissiveIntensity: 0.85,
  });
  const towerCount = quality === 'low' ? 46 : 78;
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  for (let i = 0; i < towerCount; i++) {
    const ang = (i / towerCount) * TAU + rand(-0.05, 0.05);
    const dist = rand(58, 165);
    const h = rand(18, 96) * (dist > 110 ? 1.3 : 1);
    const w = rand(7, 20);
    const d = rand(7, 20);
    v3.set(Math.cos(ang) * dist, h / 2 - 2, Math.sin(ang) * dist);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang + rand(-0.3, 0.3));
    s3.set(w, h, d);
    m4.compose(v3, q, s3);
    towers.setMatrixAt(i, m4);
  }
  towers.instanceMatrix.needsUpdate = true;
  group.add(towers);

  /* floor */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA.radius, 96), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // lower skirt so the platform reads as a solid slab from above
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(ARENA.radius, ARENA.radius - 2.5, 3.2, 96, 1, true), matDark);
  skirt.position.y = -1.65;
  group.add(skirt);

  // concentric guide rings + hazard ring
  const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  [8.5, 16.5, 24.5, 29.8].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + (i === 3 ? 0.34 : 0.1), 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    group.add(ring);
  });
  const hazard = new THREE.Mesh(
    new THREE.RingGeometry(28.2, 29.4, 96),
    new THREE.MeshStandardMaterial({ color: 0x2a1a06, emissive: PALETTE.amber, emissiveIntensity: 0.55, roughness: 0.8 })
  );
  hazard.rotation.x = -Math.PI / 2;
  hazard.position.y = 0.011;
  group.add(hazard);

  /* perimeter wall */
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ARENA.radius, ARENA.radius, 11, 96, 1, true), matWall);
  wall.position.y = 5.5;
  wall.receiveShadow = true;
  group.add(wall);

  // wall trims
  const trimGeo = new THREE.TorusGeometry(ARENA.radius - 22.75, 0.09, 6, 96);
  void trimGeo;
  [1.6, 5.2, 8.4].forEach((y, i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(ARENA.radius - 0.06, 0.075, 6, 120), i === 1 ? matTrimMagenta : matTrimCyan);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    group.add(t);
  });
  // vertical buttress ribs
  const ribGeo = new THREE.BoxGeometry(0.5, 11, 0.9);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU;
    const rib = new THREE.Mesh(ribGeo, matMetal);
    rib.position.set(Math.cos(a) * (ARENA.radius - 0.35), 5.5, Math.sin(a) * (ARENA.radius - 0.35));
    rib.rotation.y = -a;
    group.add(rib);
    if (i % 4 === 0) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.8, 0.16), i % 8 === 0 ? matTrimMagenta : matTrimTeal);
      lamp.position.set(Math.cos(a) * (ARENA.radius - 0.8), 7.4, Math.sin(a) * (ARENA.radius - 0.8));
      lamp.rotation.y = -a;
      group.add(lamp);
    }
  }

  /* floor markings: painted decals, stencils and scuffs */
  const decalTex = canvasTex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    // landing circle
    g.strokeStyle = 'rgba(240,190,90,0.55)';
    g.lineWidth = 10;
    g.beginPath(); g.arc(cx, cy, 300, 0, TAU); g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.arc(cx, cy, 322, 0, TAU); g.stroke();
    // hazard chevrons
    g.save();
    g.translate(cx, cy);
    for (let k = 0; k < 24; k++) {
      g.rotate(TAU / 24);
      g.fillStyle = k % 2 ? 'rgba(245,200,100,0.28)' : 'rgba(20,30,40,0.0)';
      g.beginPath();
      g.moveTo(360, -16); g.lineTo(402, 0); g.lineTo(360, 16); g.lineTo(348, 0);
      g.closePath(); g.fill();
    }
    g.restore();
    // sector stencil
    g.save();
    g.translate(cx - 150, cy + 150);
    g.rotate(-0.12);
    g.fillStyle = 'rgba(200,235,255,0.26)';
    g.font = '900 190px "Orbitron", "Chakra", sans-serif';
    g.fillText('09', 0, 0);
    g.restore();
    // service arrows
    g.strokeStyle = 'rgba(90,220,255,0.3)';
    g.lineWidth = 12;
    for (let k = 0; k < 4; k++) {
      const a = k * (Math.PI / 2) + 0.35;
      const r = 235;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.moveTo(-40, -26); g.lineTo(26, 0); g.lineTo(-40, 26);
      g.stroke();
      g.restore();
    }
    // small stencils + scuffs
    g.fillStyle = 'rgba(180,215,235,0.16)';
    g.font = '700 26px "Chakra", sans-serif';
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const r = rand(120, 420);
      g.save();
      g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.rotate(rand(-0.4, 0.4));
      g.fillText(pick(['A-09', 'LOAD 2.4T', 'KEEP CLEAR', 'VANTA', 'BAY 07', 'NO STEP']), 0, 0);
      g.restore();
    }
    g.strokeStyle = 'rgba(10,20,28,0.35)';
    for (let i = 0; i < 40; i++) {
      g.lineWidth = rand(1, 4);
      g.beginPath();
      const x = rand(40, w - 40);
      const y = rand(40, h - 40);
      g.moveTo(x, y);
      g.lineTo(x + rand(-90, 90), y + rand(-90, 90));
      g.stroke();
    }
  });
  const decal = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA.radius - 1.2, 96),
    new THREE.MeshStandardMaterial({
      map: decalTex, transparent: true, depthWrite: false, opacity: 0.92,
      metalness: 0.35, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2,
    })
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.02;
  decal.receiveShadow = false;
  group.add(decal);

  /* blast doors set into the wall */
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.2;
    const door = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.2, 0.5), matMetal);
    door.add(frame);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.4, 0.22), matDark);
    slab.position.z = 0.2;
    door.add(slab);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 0.1), i % 2 ? matTrimAmber : matTrimCyan);
    seam.position.z = 0.34;
    door.add(seam);
    for (const sy of [-1.7, 1.7]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 0.08), i % 2 ? matTrimAmber : matTrimCyan);
      stripe.position.set(0, sy, 0.34);
      door.add(stripe);
    }
    door.position.set(Math.cos(a) * (ARENA.radius - 0.45), 2.8, Math.sin(a) * (ARENA.radius - 0.45));
    door.rotation.y = -a + Math.PI / 2;
    group.add(door);
  }

  /* colliders */
  const boxes = [];
  const cyls = [];
  const addBox = (x, z, hw, hd, y0, y1, tag) => { boxes.push({ x, z, hw, hd, y0, y1, tag: tag || 'metal' }); return boxes[boxes.length - 1]; };
  const addCyl = (x, z, r, y0, y1, tag) => { cyls.push({ x, z, r, y0, y1, tag: tag || 'metal' }); return cyls[cyls.length - 1]; };

  /* meta props: cover crates, containers, pillars */
  const cratePositions = [
    [-13.5, -9, 2.6, 2.6, 1.55, 0],
    [12.5, -11, 2.4, 2.4, 1.4, 0.4],
    [15.5, 10.5, 2.8, 2.8, 1.7, -0.3],
    [-15, 12, 2.5, 2.5, 1.5, 0.2],
    [-3.5, 17.5, 3.0, 2.2, 1.45, 0.9],
    [4.5, -18, 3.1, 2.3, 1.5, -0.7],
  ];
  const containerPositions = [
    [-9.5, 3.5, 4.2, 2.4, 2.35, 0.15],
    [9.5, 4.5, 2.4, 4.2, 2.35, -0.1],
    [-2.5, -12.5, 4.4, 2.6, 2.2, 0.05],
  ];
  const barrierPositions = [
    [-20, -4, 3.4, 0.8, 1.05, 0.55],
    [20, 2, 3.4, 0.8, 1.05, -0.55],
    [-4, 22, 3.4, 0.9, 1.0, 1.2],
  ];

  const crateMat = new THREE.MeshStandardMaterial({ color: 0x223543, metalness: 0.72, roughness: 0.46, envMapIntensity: 0.9 });
  const contMat = new THREE.MeshStandardMaterial({ color: 0x1b2f3c, metalness: 0.66, roughness: 0.55, envMapIntensity: 0.8 });

  const makeCrate = (x, z, w, d, h, rot, big) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), big ? contMat : crateMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // edge frames
    const frameMat = big ? matTrimAmber : matTrimCyan;
    const frameY = [0.06, h - 0.06];
    for (const y of frameY) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d + 0.04), frameMat);
      fr.position.y = y;
      g.add(fr);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.07), matMetal);
        post.position.set((sx * w) / 2, h / 2, (sz * d) / 2);
        g.add(post);
      }
    }
    if (big) {
      // hazard chevrons
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.22, 0.03), matTrimAmber);
      stripe.position.set(0, h * 0.62, d / 2 + 0.01);
      g.add(stripe);
    } else {
      const label = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.4, 0.02), matTrimTeal);
      label.position.set(0, h * 0.55, d / 2 + 0.01);
      g.add(label);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    // collision uses axis-aligned bounds of the rotated box
    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    addBox(x, z, (w * c + d * s) / 2, (w * s + d * c) / 2, 0, h, big ? 'container' : 'crate');
    return g;
  };

  cratePositions.forEach(([x, z, w, d, h, rot]) => makeCrate(x, z, w, d, h, rot, false));
  containerPositions.forEach(([x, z, w, d, h, rot]) => makeCrate(x, z, w, d, h, rot, true));
  barrierPositions.forEach(([x, z, w, d, h, rot]) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matMetal);
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.06, 0.06), matTrimMagenta);
    glow.position.set(0, h - 0.12, d / 2 + 0.02);
    g.add(glow);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    addBox(x, z, w / 2, d / 2, 0, h, 'barrier');
  });

  /* pillars */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const x = Math.cos(a) * 25.2;
    const z = Math.sin(a) * 25.2;
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.5, 8.6, 1.5), matMetal);
    col.position.y = 4.3;
    col.castShadow = true;
    g.add(col);
    for (const y of [0.5, 4.3, 8.1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 1.62), y === 4.3 ? matTrimTeal : matTrimCyan);
      band.position.y = y;
      g.add(band);
    }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.1), matTrimAmber);
    lamp.position.set(0, 7.1, 0.8);
    g.add(lamp);
    g.position.set(x, 0, z);
    g.rotation.y = -a;
    group.add(g);
    addBox(x, z, 0.8, 0.8, 0, 8.6, 'pillar');
  }

  /* central reactor */
  const reactor = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.7, 1.1, 8), matMetal);
  base.position.y = 0.55;
  base.castShadow = true; base.receiveShadow = true;
  reactor.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(3.34, 0.1, 6, 8), matTrimCyan);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 1.08;
  reactor.add(baseRing);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0a3a3a, emissive: PALETTE.teal, emissiveIntensity: 0.75,
    metalness: 0.3, roughness: 0.25, transparent: true, opacity: 0.95,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.78, 6.2, 16), coreMat);
  core.position.y = 4.2;
  reactor.add(core);
  const coreShell = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.16, 16, 1, true), matTrimCyan);
  coreShell.position.y = 7.35;
  reactor.add(coreShell);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.9 + i * 0.45, 0.07, 6, 40), i === 1 ? matTrimMagenta : matTrimTeal);
    r.position.y = 2.2 + i * 1.65;
    r.rotation.x = Math.PI / 2 + i * 0.4;
    r.rotation.z = i * 0.7;
    reactor.add(r);
    rings.push(r);
  }
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTeal, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
  }));
  coreGlow.scale.set(9, 9, 1);
  coreGlow.position.y = 4.2;
  reactor.add(coreGlow);
  group.add(reactor);
  addCyl(0, 0, 3.55, 0, 1.1, 'reactor');
  addCyl(0, 0, 1.5, 1.1, 7.4, 'reactor-core');

  const reactorLight = new THREE.PointLight(PALETTE.teal, 26, 34, 2);
  reactorLight.position.set(0, 3.4, 0);
  reactorLight.castShadow = false;
  group.add(reactorLight);

  /* overhead gantry */
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x101c26, metalness: 0.8, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, ARENA.radius * 1.9), beamMat);
    beam.position.set(Math.cos(a) * 4, 13.5, Math.sin(a) * 4);
    beam.rotation.y = -a + Math.PI / 2;
    group.add(beam);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, ARENA.radius * 1.7), i % 2 ? matTrimCyan : matTrimMagenta);
    strip.position.set(Math.cos(a) * 4, 13.1, Math.sin(a) * 4);
    strip.rotation.y = -a + Math.PI / 2;
    group.add(strip);
    // hanging lamp cones
    for (const t of [-0.5, 0.5]) {
      const lampPos = new THREE.Vector3(Math.cos(a) * 4, 13, Math.sin(a) * 4)
        .add(new THREE.Vector3(Math.sin(-a + Math.PI / 2), 0, Math.cos(-a + Math.PI / 2)).multiplyScalar(t * ARENA.radius));
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.3, 8), matTrimAmber);
      lamp.position.copy(lampPos).setY(12.9);
      group.add(lamp);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(3.6, 12, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd7a0, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      cone.position.copy(lampPos).setY(6.8);
      group.add(cone);
    }
  }

  /* holo billboards on the wall */
  const holoTex = holoTexture('NEON BREACH', 'SECTOR 09  //  ARENA PROTOCOL', '#35f0d6');
  const holoTex2 = holoTexture('VANTA', 'FOUNDRY ONLINE  09', '#ff2d75');
  const holos = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.8;
    const tex = i % 2 === 0 ? holoTex : holoTex2;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.8), mat);
    plane.position.set(Math.cos(a) * (ARENA.radius - 0.9), 7.9, Math.sin(a) * (ARENA.radius - 0.9));
    plane.lookAt(0, 6.5, 0);
    group.add(plane);
    holos.push({ mesh: plane, mat, base: 0.86, phase: rand(0, TAU) });
  }

  /* searchlight beams sweeping the sky */
  const beams = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i === 1 ? 0xff6a9a : 0x6ef0ff, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 60, 12, 1, true), mat);
    beam.position.set(rand(-40, 40), 30, rand(-40, 40));
    group.add(beam);
    beams.push({ mesh: beam, phase: rand(0, TAU), speed: rand(0.08, 0.16) });
  }

  /* lighting */
  const hemi = new THREE.HemisphereLight(0x9fd0f0, 0x11181f, 1.05);
  group.add(hemi);
  const amb = new THREE.AmbientLight(0x4a6a86, 0.35);
  group.add(amb);
  const moon = new THREE.DirectionalLight(0xbfe0ff, 2.0);
  moon.position.set(-26, 40, 18);
  moon.castShadow = quality !== 'low';
  if (moon.castShadow) {
    moon.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    moon.shadow.camera.left = -38;
    moon.shadow.camera.right = 38;
    moon.shadow.camera.top = 38;
    moon.shadow.camera.bottom = -38;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 110;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.02;
  }
  group.add(moon);
  group.add(moon.target);

  const accents = [
    { c: 0xff2d75, p: [-19, 3.2, -16], i: 22 },
    { c: 0x35d6ff, p: [21, 3.6, 13], i: 20 },
    { c: 0xffa93d, p: [4, 3.0, 24], i: 16 },
  ];
  accents.forEach(({ c, p, i }) => {
    const l = new THREE.PointLight(c, i, 26, 2);
    l.position.set(p[0], p[1], p[2]);
    group.add(l);
  });

  /* spawn gates: glowing pads around the ring */
  const gates = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.32;
    const x = Math.cos(a) * ARENA.spawnRadius;
    const z = Math.sin(a) * ARENA.spawnRadius;
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.5, 24), new THREE.MeshBasicMaterial({
      color: 0xff2d75, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.014, z);
    group.add(pad);
    gates.push({ x, z, pad, angle: a });
  }

  /* ------------------------------------------------------- collision api */

  const state = {
    time: 0,
    pulse: 0,
    gates,
    boxes,
    cyls,
    reactor,
    reactorLight,
    holos,
  };

  /**
   * Distance along a ray to the first solid surface, capped by maxDist.
   * Returns { dist, kind } or null when the ray reaches maxDist untouched.
   */
  function hitDistance(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    let kind = null;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const t = rayBox(ox, oy, oz, dx, dy, dz, b);
      if (t !== null && t < best && t >= 0) { best = t; kind = b.tag; }
    }
    for (let i = 0; i < cyls.length; i++) {
      const c = cyls[i];
      // vertical extent test: sample the hit point height
      const t = rayCylinder(ox, oz, dx, dz, c.x, c.z, c.r);
      if (t !== null && t < best) {
        const hy = oy + dy * t;
        if (hy >= c.y0 - 0.02 && hy <= c.y1 + 0.02) {
          // core cylinder is thin; walls of the reactor count as solid too
          best = t; kind = c.tag;
        }
      }
    }
    // arena wall
    const a = dx * dx + dz * dz;
    if (a > 1e-9) {
      const b = 2 * (ox * dx + oz * dz);
      const c0 = ox * ox + oz * oz - (ARENA.playRadius + 0.7) * (ARENA.playRadius + 0.7);
      const disc = b * b - 4 * a * c0;
      if (disc > 0) {
        const t = (-b + Math.sqrt(disc)) / (2 * a);
        if (t > 0 && t < best) { best = t; kind = 'wall'; }
      }
    }
    return kind ? { dist: best, kind } : null;
  }

  function groundHeight(x, z, feetY) {
    let h = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.y1 > 2.6) continue; // pillars are not standable
      if (x > b.x - b.hw - 0.05 && x < b.x + b.hw + 0.05 && z > b.z - b.hd - 0.05 && z < b.z + b.hd + 0.05) {
        if (feetY >= b.y1 - 0.35) h = Math.max(h, b.y1);
      }
    }
    for (let i = 0; i < cyls.length; i++) {
      const c = cyls[i];
      if (c.y1 > 2.6) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r && feetY >= c.y1 - 0.35) h = Math.max(h, c.y1);
    }
    return h;
  }

  /** Push a circle (player/enemy footprint) out of all solid volumes. */
  function resolveCircle(pos, radius, height) {
    // arena boundary
    const r = Math.hypot(pos.x, pos.z);
    const maxR = ARENA.playRadius - radius;
    if (r > maxR) {
      const k = maxR / (r || 1);
      pos.x *= k;
      pos.z *= k;
    }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (pos.y > b.y1 - 0.22) continue;         // standing on top or above
      if (pos.y + height < b.y0) continue;
      const cx = clamp(pos.x, b.x - b.hw, b.x + b.hw);
      const cz = clamp(pos.z, b.z - b.hd, b.z + b.hd);
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      let d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      if (d2 < 1e-8) {
        // centre inside the box: push out along the shallowest axis
        const left = Math.abs(pos.x - (b.x - b.hw));
        const right = Math.abs(b.x + b.hw - pos.x);
        const front = Math.abs(pos.z - (b.z - b.hd));
        const back = Math.abs(b.z + b.hd - pos.z);
        const m = Math.min(left, right, front, back);
        if (m === left) pos.x = b.x - b.hw - radius;
        else if (m === right) pos.x = b.x + b.hw + radius;
        else if (m === front) pos.z = b.z - b.hd - radius;
        else pos.z = b.z + b.hd + radius;
        continue;
      }
      const d = Math.sqrt(d2);
      const push = radius - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    }
    for (let i = 0; i < cyls.length; i++) {
      const c = cyls[i];
      if (pos.y > c.y1 - 0.22) continue;
      if (pos.y + height < c.y0) continue;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min && d > 1e-5) {
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
  }

  function isFree(x, z, radius) {
    if (Math.hypot(x, z) > ARENA.playRadius - radius) return false;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.y1 > 2.6) continue;
      const cx = clamp(x, b.x - b.hw, b.x + b.hw);
      const cz = clamp(z, b.z - b.hd, b.z + b.hd);
      if ((x - cx) ** 2 + (z - cz) ** 2 < radius * radius) return false;
    }
    for (let i = 0; i < cyls.length; i++) {
      const c = cyls[i];
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r + radius) return false;
    }
    return true;
  }

  function update(dt, time, opts) {
    state.time = time;
    const fever = opts && opts.fever ? 1 : 0;
    const pulse = 0.5 + 0.5 * Math.sin(time * (fever ? 7 : 1.6));
    state.pulse = pulse;
    coreMat.emissiveIntensity = 0.42 + pulse * 0.25 + fever * 0.4;
    reactorLight.intensity = 20 + pulse * 8 + fever * 14;
    coreGlow.material.opacity = 0.42 + pulse * 0.14;
    rings.forEach((r, i) => {
      r.rotation.z += dt * (0.35 + i * 0.18) * (fever ? 2.2 : 1);
      r.rotation.x = Math.PI / 2 + Math.sin(time * 0.6 + i) * 0.22;
      r.position.y = 2.2 + i * 1.65 + Math.sin(time * 0.9 + i * 1.7) * 0.12;
    });
    stars.rotation.y = time * 0.004;
    holos.forEach((h, i) => {
      h.mat.opacity = h.base * (0.86 + 0.14 * Math.sin(time * 3.4 + h.phase)) * (0.7 + 0.3 * Math.sin(time * 0.7 + i));
    });
    beams.forEach((b, i) => {
      b.mesh.rotation.z = Math.sin(time * b.speed + b.phase) * 0.5;
      b.mesh.rotation.x = Math.cos(time * b.speed * 0.7 + b.phase) * 0.4;
      b.mesh.material.opacity = 0.035 + 0.02 * Math.sin(time * 0.8 + i);
    });
    gates.forEach((g, i) => {
      g.pad.material.opacity = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(time * 2.2 + i));
    });
    hazard.material.emissiveIntensity = 0.45 + pulse * 0.25;
  }

  return {
    group, update, resolveCircle, groundHeight, hitDistance, isFree,
    boxes, cyls, gates, reactor, coreMat, moon, env,
    dispose() {
      scene.environment = null;
      scene.fog = null;
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      scene.remove(group);
      env.dispose();
    },
  };
}

/** Random point on a spawn gate, kept free of cover. */
export function pickSpawn(arena, minPlayerDist, playerPos, minDistBetween) {
  const candidates = [];
  for (const g of arena.gates) {
    const d = Math.hypot(g.x - playerPos.x, g.z - playerPos.z);
    if (d > minPlayerDist) candidates.push(g);
  }
  const list = candidates.length ? candidates : arena.gates;
  const shuffled = list.slice().sort(() => Math.random() - 0.5);
  for (const g of shuffled) {
    let x = g.x + rand(-1.4, 1.4);
    let z = g.z + rand(-1.4, 1.4);
    if (arena.isFree(x, z, 0.9)) {
      if (minDistBetween) {
        let ok = true;
        for (const p of minDistBetween) {
          if (Math.hypot(p.x - x, p.z - z) < 2.2) { ok = false; break; }
        }
        if (!ok) continue;
      }
      return { x, z };
    }
  }
  return { x: pick(arena.gates).x, z: pick(arena.gates).z };
}

export { PALETTE };
