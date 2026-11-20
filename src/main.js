import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------------ *
 *  Snowlit Izakaya — a collectible miniature, built entirely in code.
 * ------------------------------------------------------------------ */

const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
const compactDevice = window.matchMedia('(max-width: 720px)').matches;
function preferredPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, compactDevice ? 1.6 : 2);
}
renderer.setPixelRatio(preferredPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1828, 0.0155);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 160);
const initialCameraDirection = new THREE.Vector3(0.27, 0.35, 0.925).normalize();
const viewTarget = new THREE.Vector3(-2.0, 0.75, 0.15);
let fitDistance = 39;

const cameraFitPoints = [
  new THREE.Vector3(-12.2, 0, -12.2), new THREE.Vector3(12.2, 0, -12.2),
  new THREE.Vector3(12.2, 0, 12.2), new THREE.Vector3(-12.2, 0, 12.2),
  new THREE.Vector3(-12.2, -1.15, -12.2), new THREE.Vector3(12.2, -1.15, -12.2),
  new THREE.Vector3(12.2, -1.15, 12.2), new THREE.Vector3(-12.2, -1.15, 12.2),
  new THREE.Vector3(-6.5, 7.55, -1.5), new THREE.Vector3(2.8, 7.55, -1.5),
  new THREE.Vector3(-3.9, 8.35, -0.55), new THREE.Vector3(-9.55, 7.55, 4.15),
  new THREE.Vector3(8.8, 5.9, -5.6), new THREE.Vector3(7.9, 4.25, 2.8),
];

function calculateFitDistance(aspect = window.innerWidth / window.innerHeight) {
  const virtual = new THREE.PerspectiveCamera(camera.fov, aspect, 0.1, 180);
  const point = new THREE.Vector3();
  let distance = 39;
  for (let iteration = 0; iteration < 7; iteration++) {
    virtual.position.copy(viewTarget).addScaledVector(initialCameraDirection, distance);
    virtual.lookAt(viewTarget);
    virtual.updateProjectionMatrix();
    virtual.updateMatrixWorld(true);
    let maxX = 0;
    let maxY = 0;
    for (const p of cameraFitPoints) {
      point.copy(p).project(virtual);
      maxX = Math.max(maxX, Math.abs(point.x));
      maxY = Math.max(maxY, Math.abs(point.y));
    }
    const need = Math.max(maxX / 0.88, maxY / 0.85);
    distance *= need;
    if (Math.abs(need - 1) < 0.002) break;
  }
  return distance;
}

fitDistance = calculateFitDistance();
camera.position.copy(viewTarget).addScaledVector(initialCameraDirection, fitDistance);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(viewTarget);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.58;
controls.zoomSpeed = 0.75;
controls.minDistance = 14;
controls.maxDistance = 160;
controls.minPolarAngle = 0.16;
controls.maxPolarAngle = Math.PI / 2 - 0.035;
controls.update();

const outline = new OutlineEffect(renderer, {
  defaultThickness: 0.0017,
  defaultColor: [0.012, 0.016, 0.027],
  defaultAlpha: 0.8,
  defaultKeepAlive: true,
});

/* -------------------------------- utils -------------------------------- */

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261119);
const rng = (a, b) => a + random() * (b - a);
const pick = (arr) => arr[Math.floor(random() * arr.length)];
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x) => {
  const c = 1.42;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

/* ----------------------------- canvas textures -------------------------- */

function makeCanvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

function addGrain(ctx, w, h, amount = 0.06, count = 900, alpha = 0.12) {
  for (let i = 0; i < count; i++) {
    const a = random() * alpha;
    const light = random() > 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
  }
}

function makeWoodTexture(base, grain, highlight) {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 95; i++) {
      const x = random() * w;
      const width = 0.6 + random() * 3.2;
      ctx.strokeStyle = random() > 0.3
        ? `rgba(${grain},${0.08 + random() * 0.2})`
        : `rgba(${highlight},${0.05 + random() * 0.12})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let y = -10; y <= h + 10; y += 20) {
        const xx = x + Math.sin(y * 0.025 + i * 1.7) * (2 + random() * 3);
        if (y === -10) ctx.moveTo(xx, y);
        else ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.strokeStyle = `rgba(${grain},0.28)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 7 + random() * 13, 3 + random() * 7, random() * 0.3, 0, TAU);
      ctx.stroke();
    }
    addGrain(ctx, w, h, 0.05, 700, 0.09);
  }, { repeat: [1, 1] });
}

function makePlasterTexture(base = '#d9c9ab') {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 650; i++) {
      const a = random() * 0.07;
      ctx.fillStyle = random() > 0.4 ? `rgba(255,248,225,${a})` : `rgba(70,53,36,${a})`;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 1 + random() * 7, 0, TAU);
      ctx.fill();
    }
    addGrain(ctx, w, h, 0.05, 1200, 0.07);
  }, { repeat: [1, 1] });
}

function makeSnowTexture() {
  return makeCanvasTexture(768, 768, (ctx, w, h) => {
    ctx.fillStyle = '#eef7ff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4 + random() * 20);
      g.addColorStop(0, `rgba(${random() > 0.5 ? '191,215,240' : '255,255,255'},${0.025 + random() * 0.07})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.translate(random() * w, random() * h);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 + random() * 0.5})`;
      const r = random() * 0.9 + 0.2;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, r, 0, TAU);
      ctx.fill();
    }
    addGrain(ctx, w, h, 0.04, 600, 0.045);
  }, { repeat: [0.215, 0.215] });
}

function makeFootprintTexture() {
  return makeCanvasTexture(128, 220, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const drawFoot = () => {
      ctx.fillStyle = 'rgba(45,70,108,0.64)';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.59, w * 0.23, h * 0.26, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.24, w * 0.2, h * 0.15, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(28,48,80,0.34)';
      ctx.beginPath();
      ctx.ellipse(w * 0.46, h * 0.58, w * 0.13, h * 0.19, -0.1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.79, w * 0.18, h * 0.055, 0, 0, TAU);
      ctx.fill();
    };
    drawFoot();
  });
}

function makeTireTexture() {
  return makeCanvasTexture(512, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const band = (cx) => {
      const g = ctx.createLinearGradient(cx - 45, 0, cx + 45, 0);
      g.addColorStop(0, 'rgba(59,83,119,0)');
      g.addColorStop(0.18, 'rgba(59,83,119,0.22)');
      g.addColorStop(0.4, 'rgba(43,65,100,0.52)');
      g.addColorStop(0.55, 'rgba(25,43,74,0.6)');
      g.addColorStop(0.8, 'rgba(59,83,119,0.2)');
      g.addColorStop(1, 'rgba(59,83,119,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 45, 0, 90, h);
      ctx.strokeStyle = 'rgba(31,49,78,0.34)';
      ctx.lineWidth = 3;
      for (let y = 8; y < h; y += 28) {
        ctx.beginPath();
        ctx.moveTo(cx - 29, y);
        ctx.lineTo(cx - 4, y + 9);
        ctx.moveTo(cx + 13, y + 3);
        ctx.lineTo(cx + 35, y + 14);
        ctx.stroke();
      }
    };
    band(w * 0.38);
    band(w * 0.64);
    addGrain(ctx, w, h, 0.04, 450, 0.08);
  });
}

function makeGlowTexture(size = 256, softness = 0.64) {
  return makeCanvasTexture(size, size, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.12, 'rgba(255,255,255,0.72)');
    g.addColorStop(softness * 0.55, 'rgba(255,255,255,0.24)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}

function makeSnowflakeTexture() {
  return makeCanvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.55, 'rgba(219,238,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}

function makeSnowStreakTexture() {
  return makeCanvasTexture(96, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(235,247,255,0.9)';
    ctx.shadowBlur = 9;
    const grad = ctx.createLinearGradient(14, 10, 84, 82);
    grad.addColorStop(0, 'rgba(223,240,255,0)');
    grad.addColorStop(0.38, 'rgba(238,248,255,0.55)');
    grad.addColorStop(0.74, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(84, 82);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(31, 28);
    ctx.lineTo(71, 69);
    ctx.stroke();
  }, { srgb: false });
}

function makeSmokeTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const x = w * (0.3 + random() * 0.4);
      const y = h * (0.3 + random() * 0.4);
      const r = w * (0.13 + random() * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.11 + random() * 0.12})`);
      g.addColorStop(0.55, `rgba(255,255,255,${0.04 + random() * 0.06})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }, { srgb: false });
}

function makeBackgroundTexture() {
  return makeCanvasTexture(2048, 1280, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#01040b');
    sky.addColorStop(0.22, '#041022');
    sky.addColorStop(0.46, '#081a30');
    sky.addColorStop(0.64, '#0b2239');
    sky.addColorStop(0.78, '#0b1c2d');
    sky.addColorStop(1, '#040b14');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const horizonGlow = ctx.createRadialGradient(w * 0.51, h * 0.5, h * 0.03, w * 0.51, h * 0.5, w * 0.47);
    horizonGlow.addColorStop(0, 'rgba(48,91,137,0.2)');
    horizonGlow.addColorStop(0.48, 'rgba(27,56,92,0.09)');
    horizonGlow.addColorStop(1, 'rgba(2,7,14,0)');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 130; i++) {
      const x = rng(0, w);
      const y = rng(0, h * 0.62);
      const a = rng(0.05, 0.32) * (1 - y / h);
      const r = rng(0.5, 1.7);
      ctx.fillStyle = `rgba(207,228,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }

    const mx = w * 0.72;
    const my = h * 0.155;
    const moonHalo = ctx.createRadialGradient(mx, my, 12, mx, my, 340);
    moonHalo.addColorStop(0, 'rgba(206,227,255,0.24)');
    moonHalo.addColorStop(0.22, 'rgba(142,181,232,0.13)');
    moonHalo.addColorStop(0.6, 'rgba(84,126,181,0.05)');
    moonHalo.addColorStop(1, 'rgba(20,40,70,0)');
    ctx.fillStyle = moonHalo;
    ctx.beginPath();
    ctx.arc(mx, my, 340, 0, TAU);
    ctx.fill();

    const moonBody = ctx.createRadialGradient(mx - 14, my - 18, 4, mx, my, 58);
    moonBody.addColorStop(0, '#fffdf0');
    moonBody.addColorStop(0.58, '#ecebd8');
    moonBody.addColorStop(0.88, '#cad6de');
    moonBody.addColorStop(1, '#aebfcd');
    ctx.fillStyle = moonBody;
    ctx.beginPath();
    ctx.arc(mx, my, 56, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, 55, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 7; i++) {
      const g = ctx.createRadialGradient(mx + rng(-38, 38), my + rng(-38, 38), 0, mx + rng(-38, 38), my + rng(-38, 38), rng(8, 30));
      g.addColorStop(0, 'rgba(156,178,192,0.17)');
      g.addColorStop(1, 'rgba(156,178,192,0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - 60, my - 60, 120, 120);
    }
    ctx.restore();

    const drawCloud = (cx, cy, rx, ry, alpha, tint) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx / ry, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      g.addColorStop(0, `rgba(${tint},${alpha})`);
      g.addColorStop(0.45, `rgba(${tint},${alpha * 0.5})`);
      g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, ry, 0, TAU);
      ctx.fill();
      ctx.restore();
    };
    drawCloud(w * 0.73, h * 0.16, 390, 42, 0.22, '160,190,220');
    drawCloud(w * 0.62, h * 0.2, 250, 30, 0.16, '195,216,238');
    drawCloud(w * 0.16, h * 0.31, 330, 54, 0.1, '97,139,184');
    drawCloud(w * 0.47, h * 0.4, 460, 46, 0.07, '122,163,205');
    drawCloud(w * 0.84, h * 0.36, 260, 35, 0.08, '103,146,193');
    drawCloud(w * 0.29, h * 0.55, 390, 38, 0.05, '96,137,178');

    const ridgeY = h * 0.685;
    ctx.fillStyle = 'rgba(6,14,24,0.62)';
    ctx.beginPath();
    ctx.moveTo(0, ridgeY + 40);
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * w;
      const peak = ridgeY - 35 - Math.abs(Math.sin(i * 1.7)) * 62 - random() * 28;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(w, ridgeY + 100);
    ctx.lineTo(0, ridgeY + 100);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(155,190,221,0.1)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * w;
      const peak = ridgeY - 35 - Math.abs(Math.sin(i * 1.7)) * 62 - random() * 28;
      if (i === 0) ctx.moveTo(x, peak + 8);
      else ctx.lineTo(x, peak + 8);
    }
    ctx.stroke();

    for (let i = 0; i < 32; i++) {
      const x = random() < 0.5 ? rng(0, w * 0.28) : rng(w * 0.72, w);
      const y = ridgeY + rng(5, 90);
      const a = rng(0.08, 0.3);
      const r = rng(1.2, 3.4);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
      glow.addColorStop(0, `rgba(255,203,137,${a})`);
      glow.addColorStop(1, 'rgba(255,177,92,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.4, 0, TAU);
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.12, w * 0.5, h * 0.5, w * 0.67);
    vignette.addColorStop(0, 'rgba(0,3,9,0)');
    vignette.addColorStop(0.65, 'rgba(0,3,9,0.08)');
    vignette.addColorStop(1, 'rgba(0,2,6,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    addGrain(ctx, w, h, 0.05, 1800, 0.025);
  });
}

/* -------------------------------- textures ------------------------------ */

const woodDarkTex = makeWoodTexture('#4a2e1d', '20,11,7', '144,91,51');
const woodMidTex = makeWoodTexture('#6a4228', '32,17,8', '176,112,64');
const woodLightTex = makeWoodTexture('#8b5b35', '43,24,12', '208,148,88');
const plasterTex = makePlasterTexture('#d7c6a7');
const snowTex = makeSnowTexture();
const glowTexture = makeGlowTexture();
const snowflakeTexture = makeSnowflakeTexture();
const snowStreakTexture = makeSnowStreakTexture();

const shojiTexture = makeCanvasTexture(512, 512, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.43, 10, w * 0.5, h * 0.5, w * 0.72);
  g.addColorStop(0, '#fff8e4');
  g.addColorStop(0.48, '#ffe3b4');
  g.addColorStop(0.82, '#e7b06e');
  g.addColorStop(1, '#b8753e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 250; i++) {
    ctx.strokeStyle = `rgba(121,82,46,${0.015 + random() * 0.045})`;
    ctx.lineWidth = 0.6 + random() * 2;
    const y = random() * h;
    ctx.beginPath();
    ctx.moveTo(random() * w * 0.2, y);
    ctx.lineTo(w * (0.8 + random() * 0.2), y + rng(-4, 4));
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,246,218,${0.05 + random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(random() * w, random() * h, 8 + random() * 30, 0, TAU);
    ctx.fill();
  }
  addGrain(ctx, w, h, 0.04, 600, 0.08);
});

const smokeTexture = makeSmokeTexture();

/* -------------------------------- materials ----------------------------- */

const gradientMap = (() => {
  const steps = new Uint8Array([42, 92, 144, 194, 232, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const outlineColor = [0.012, 0.017, 0.029];

function toon(color, options = {}) {
  const {
    outlineWidth = 0.0017,
    outlineAlpha = 0.8,
    showOutline = true,
    ...rest
  } = options;
  const mat = new THREE.MeshToonMaterial({ color, gradientMap, ...rest });
  mat.userData.outlineParameters = {
    thickness: outlineWidth,
    color: outlineColor,
    alpha: outlineAlpha,
    visible: showOutline,
    keepAlive: true,
  };
  return mat;
}

function basic(color, options = {}) {
  const mat = new THREE.MeshBasicMaterial({ color, ...options });
  mat.userData.outlineParameters = { visible: false, keepAlive: true };
  return mat;
}

function spriteMaterial(color, opacity, map = glowTexture, blending = THREE.AdditiveBlending) {
  return new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    blending,
    toneMapped: false,
  });
}

const M = {
  base: toon(0x162033, { outlineWidth: 0.003, outlineAlpha: 0.9 }),
  snow: toon(0xf2f8ff, { map: snowTex, outlineWidth: 0.0017, outlineAlpha: 0.4 }),
  snowSolid: toon(0xf4f9ff, { outlineWidth: 0.0015 }),
  snowDrift: toon(0xeaf4ff, { showOutline: false }),
  snowBlue: toon(0xdfeefe, { outlineWidth: 0.0014 }),
  ice: new THREE.MeshToonMaterial({
    color: 0xbfe5ff,
    gradientMap,
    transparent: true,
    opacity: 0.72,
    emissive: 0x5e9fca,
    emissiveIntensity: 0.35,
  }),
  woodDark: toon(0xffffff, { map: woodDarkTex, outlineWidth: 0.0016 }),
  woodMid: toon(0xffffff, { map: woodMidTex, outlineWidth: 0.0016 }),
  woodLight: toon(0xffffff, { map: woodLightTex, outlineWidth: 0.0015 }),
  woodAccent: toon(0x9a693f, { outlineWidth: 0.0014 }),
  plaster: toon(0xffffff, { map: plasterTex, outlineWidth: 0.0016 }),
  roof: toon(0x28313d, { outlineWidth: 0.0022 }),
  roofDeep: toon(0x1a2029, { outlineWidth: 0.0017 }),
  stone: toon(0x7f8b98, { outlineWidth: 0.0018 }),
  stoneDark: toon(0x5b6876, { outlineWidth: 0.0016 }),
  pine: toon(0x29483b, { outlineWidth: 0.0015 }),
  pineDeep: toon(0x1b342c, { outlineWidth: 0.0015 }),
  bark: toon(0x493427, { outlineWidth: 0.0014 }),
  red: toon(0xc63e2f, { outlineWidth: 0.0016 }),
  redFabric: toon(0xb73528, { outlineWidth: 0.0014 }),
  rope: toon(0xb89b6c, { outlineWidth: 0.0012 }),
  straw: toon(0xa78352, { outlineWidth: 0.0014 }),
  black: toon(0x171a20, { outlineWidth: 0.0012 }),
  paper: toon(0xe7ddc4, { outlineWidth: 0.001 }),
  charcoal: toon(0x26282b, { outlineWidth: 0.0012 }),
  ember: new THREE.MeshBasicMaterial({ color: 0xff6b21, toneMapped: false }),
  chrome: toon(0xb7bec5, { outlineWidth: 0.0013 }),
  cream: toon(0xe3e2d7, { outlineWidth: 0.0015 }),
  darkMetal: toon(0x3d454e, { outlineWidth: 0.0014 }),
  gold: toon(0xb49259, { outlineWidth: 0.0012 }),
};

const windowGlowStart = new THREE.Color(0x392419);
const windowGlowTarget = new THREE.Color(0xffc276);
const windowMat = new THREE.MeshBasicMaterial({
  color: windowGlowStart.clone(),
  map: shojiTexture,
  toneMapped: false,
  side: THREE.DoubleSide,
});
windowMat.userData.outlineParameters = { visible: false, keepAlive: true };
const interiorMat = new THREE.MeshBasicMaterial({
  color: windowGlowStart.clone(),
  map: shojiTexture,
  toneMapped: false,
  side: THREE.DoubleSide,
});
interiorMat.userData.outlineParameters = { visible: false, keepAlive: true };
const warmBasicMaterials = [windowMat, interiorMat];
const lanternColorStart = new THREE.Color(0x5c2417);
const lanternColorTarget = new THREE.Color(0xfff3e2);

/* -------------------------------- geometry ------------------------------ */

const snowGroundY = 0.29;

// A shared, softly dented sphere gives every drift an organic silhouette.
const driftGeometry = (() => {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1
      + Math.sin(v.x * 5.1 + v.y * 3.7) * 0.07
      + Math.sin(v.z * 6.3 - v.x * 2.2) * 0.055
      + Math.cos(v.y * 7.1 + v.z * 3.1) * 0.035;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
})();

function addMesh(geometry, material, parent, x = 0, y = 0, z = 0, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  if (options.scale) mesh.scale.set(...options.scale);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  if (options.renderOrder !== undefined) mesh.renderOrder = options.renderOrder;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, w, h, d, material, x, y, z, options = {}) {
  const geo = options.rounded
    ? new RoundedBoxGeometry(w, h, d, options.roundSegments || 2, options.rounded)
    : new THREE.BoxGeometry(w, h, d);
  return addMesh(geo, material, parent, x, y, z, options);
}

function addCylinder(parent, rt, rb, h, material, x, y, z, options = {}) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, options.segments || 14, options.heightSegments || 1, options.openEnded || false);
  return addMesh(geo, material, parent, x, y, z, options);
}

function addSphere(parent, radius, material, x, y, z, options = {}) {
  const geo = new THREE.SphereGeometry(radius, options.widthSegments || 18, options.heightSegments || 12);
  return addMesh(geo, material, parent, x, y, z, options);
}

function addCylinderBetween(parent, a, b, radius, material, options = {}) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(options.radiusTop ?? radius, options.radiusBottom ?? radius, len, options.segments || 7);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, points, radius, material, options = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const geo = new THREE.TubeGeometry(curve, options.segments || 24, radius, options.radialSegments || 6, false);
  return addMesh(geo, material, parent, 0, 0, 0, { castShadow: options.castShadow !== false });
}

function roundedSquareShape(size, radius) {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + radius, -s);
  shape.lineTo(s - radius, -s);
  shape.quadraticCurveTo(s, -s, s, -s + radius);
  shape.lineTo(s, s - radius);
  shape.quadraticCurveTo(s, s, s - radius, s);
  shape.lineTo(-s + radius, s);
  shape.quadraticCurveTo(-s, s, -s, s - radius);
  shape.lineTo(-s, -s + radius);
  shape.quadraticCurveTo(-s, -s, -s + radius, -s);
  return shape;
}

function addGlow(parent, color, scale, opacity, x, y, z) {
  const mat = spriteMaterial(color, opacity);
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(scale, scale, 1);
  s.userData.baseOpacity = opacity;
  s.userData.warm = true;
  parent.add(s);
  warmGlows.push(s);
  return s;
}

const warmGlows = [];
const warmLights = [];
const warmToonMaterials = [];
const lightPools = [];

function addLightPool(parent, color, x, z, sx, sz, opacity = 0.35, y = 0.333) {
  const mat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  mat.userData.outlineParameters = { visible: false, keepAlive: true };
  const mesh = addMesh(new THREE.PlaneGeometry(sx, sz), mat, parent, x, y, z, {
    rotation: [-Math.PI / 2, 0, 0],
    castShadow: false,
    receiveShadow: false,
  });
  mesh.renderOrder = 2;
  mesh.userData.baseOpacity = opacity;
  lightPools.push(mesh);
  return mesh;
}

/* ------------------------------- background ----------------------------- */

scene.background = makeBackgroundTexture();

// Far-off bokeh lights suspended in the winter air around the diorama.
const backgroundBokeh = [];
{
  const bokehGroup = new THREE.Group();
  scene.add(bokehGroup);
  for (let i = 0; i < 22; i++) {
    const warm = i % 3 === 0;
    const angle = (i / 22) * TAU + rng(-0.16, 0.16);
    const radius = rng(21, 33);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = rng(1.6, 8.6);
    const size = warm ? rng(0.38, 0.86) : rng(0.16, 0.5);
    const mat = spriteMaterial(warm ? 0xffb36c : 0xa7d1ff, 0);
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    bokehGroup.add(sprite);
    backgroundBokeh.push({
      sprite,
      baseOpacity: warm ? rng(0.1, 0.24) : rng(0.12, 0.3),
      phase: rng(0, TAU),
      speed: rng(0.2, 0.55),
    });
  }
}

/* ------------------------------ orchestrator ---------------------------- */

const world = new THREE.Group();
scene.add(world);

const assemblyItems = [];
const assemblyGroups = new Map();

function registerAssembly(object, delay, options = {}) {
  const item = {
    object,
    delay,
    duration: options.duration ?? 0.95,
    drop: options.drop ?? 1.9,
    scaleFrom: options.scaleFrom ?? 0.94,
    startHidden: options.startHidden !== false,
    baseY: object.position.y,
    baseScale: object.scale.clone(),
    active: false,
    done: false,
  };
  object.visible = false;
  assemblyItems.push(item);
  if (options.group) {
    if (!assemblyGroups.has(options.group)) assemblyGroups.set(options.group, []);
    assemblyGroups.get(options.group).push(item);
  }
  return item;
}

function finishAssemblyItem(item) {
  item.object.position.y = item.baseY;
  item.object.scale.copy(item.baseScale);
  item.object.visible = true;
  item.active = true;
  item.done = true;
}

/* ================================ BASE ================================== */

const baseGroup = new THREE.Group();
world.add(baseGroup);

const baseMesh = addMesh(
  new RoundedBoxGeometry(24.4, 1.15, 24.4, 5, 0.24),
  M.base,
  baseGroup,
  0, -0.595, 0,
  { castShadow: true, receiveShadow: true },
);

const snowPadGeo = new THREE.ExtrudeGeometry(roundedSquareShape(22.15, 0.78), {
  depth: 0.22,
  bevelEnabled: true,
  bevelSegments: 3,
  bevelSize: 0.13,
  bevelThickness: 0.085,
  curveSegments: 8,
});
snowPadGeo.rotateX(-Math.PI / 2);
const snowPad = addMesh(snowPadGeo, M.snow, baseGroup, 0, 0.05, 0, { castShadow: false, receiveShadow: true });

const snowGroup = new THREE.Group();
baseGroup.add(snowGroup);
snowGroup.add(snowPad);
registerAssembly(baseGroup, 0.15, { drop: 0.9, scaleFrom: 0.7, duration: 1.05, group: 'base' });
registerAssembly(snowGroup, 0.78, { drop: 1.6, scaleFrom: 0.92, duration: 1.05, group: 'ground' });

// Soft contact shadow beneath the collectible base.
{
  const mat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0x00040b,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    toneMapped: false,
  });
  mat.userData.outlineParameters = { visible: false, keepAlive: true };
  const shadow = addMesh(new THREE.PlaneGeometry(31, 31), mat, world, 0, -1.24, 0, {
    rotation: [-Math.PI / 2, 0, 0],
    castShadow: false,
    receiveShadow: false,
  });
  shadow.renderOrder = -2;
  shadow.material.blending = THREE.NormalBlending;
  shadow.scale.set(1, 0.83, 1);
}

function addSnowMound(parent, x, z, radius, height, sx = 1, sz = 0.8, rot = 0, lift = 0) {
  const mesh = addMesh(driftGeometry, M.snowDrift, parent, x, snowGroundY + height * 0.08 + lift, z, {
    scale: [radius * sx, height, radius * sz],
    rotation: [0, rot, 0],
    castShadow: false,
    receiveShadow: true,
  });
  return mesh;
}

// Irregular drifts around the rim and at the foot of the buildings.
const rimDrifts = [
  [-8.4, -9.45, 1.55, 0.18], [-5.2, -9.8, 1.15, 0.15], [-2.0, -9.75, 1.45, 0.17],
  [2.0, -9.85, 1.35, 0.16], [6.4, -9.5, 1.5, 0.18], [9.25, -7.7, 1.3, 0.16],
  [9.7, -4.3, 1.15, 0.15], [9.65, 2.4, 1.35, 0.16], [9.4, 6.8, 1.5, 0.17],
  [7.8, 9.1, 1.35, 0.16], [4.4, 9.45, 1.2, 0.15], [1.0, 9.55, 1.55, 0.17],
  [-2.3, 9.4, 1.1, 0.14], [-5.6, 9.2, 1.35, 0.16], [-8.2, 7.85, 1.25, 0.16],
  [-9.55, 4.4, 1.1, 0.15], [-9.65, 1.1, 1.2, 0.14], [-9.5, -2.6, 1.35, 0.16],
  [-9.55, -6.15, 1.2, 0.15],
];
for (let i = 0; i < rimDrifts.length; i++) {
  const [x, z, r, h] = rimDrifts[i];
  addSnowMound(snowGroup, x, z, r, h, 1.5 + rng(-0.22, 0.22), 0.48 + rng(-0.08, 0.12), rng(0, TAU));
}

// Snow heaped around the house and patio edges.
const houseDrifts = [
  [-5.5, 1.7, 0.82, 0.11], [-4.5, 1.95, 0.62, 0.09], [-0.15, 1.8, 0.72, 0.09],
  [2.25, 1.6, 0.56, 0.08], [2.72, 4.9, 0.72, 0.1], [7.7, 5.38, 0.62, 0.08],
  [8.1, -0.1, 0.76, 0.1], [-6.0, -4.62, 0.8, 0.12], [2.6, -4.85, 0.7, 0.1],
];
for (const [x, z, r, h] of houseDrifts) addSnowMound(snowGroup, x, z, r, h, 1, 0.7, rng(0, TAU));

// A few wind-carved ripples on the open snow.
const driftGroup = new THREE.Group();
snowGroup.add(driftGroup);
for (let i = 0; i < 13; i++) {
  const angle = rng(0, TAU);
  const radius = rng(4.5, 9.6);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (x > -7.2 && x < 8.8 && z > -5.2 && z < 6.8) continue;
  addSnowMound(driftGroup, x, z, rng(0.65, 1.45), rng(0.05, 0.1), rng(0.8, 1.5), rng(0.35, 0.8), rng(0, TAU));
}

/* --------------------------- snow tracks & prints ----------------------- */

const groundDetails = new THREE.Group();
snowGroup.add(groundDetails);
registerAssembly(groundDetails, 1.25, { drop: 0.7, scaleFrom: 1, duration: 0.8, group: 'ground' });

// Tire ruts sweeping in from the near-right corner.
{
  const tireTex = makeTireTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: tireTex,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  mat.userData.outlineParameters = { visible: false, keepAlive: true };
  const trackGroup = new THREE.Group();
  trackGroup.position.set(4.4, snowGroundY + 0.035, 6.9);
  trackGroup.rotation.y = -0.42;
  groundDetails.add(trackGroup);
  const track = addMesh(new THREE.PlaneGeometry(2.7, 8.5), mat, trackGroup, 0, 0, 0, {
    rotation: [-Math.PI / 2, 0, 0],
    castShadow: false,
    receiveShadow: false,
  });
  track.renderOrder = 1;
}

// Human footprints meandering from the street to the entrance.
{
  const footTex = makeFootprintTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: footTex,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  mat.userData.outlineParameters = { visible: false, keepAlive: true };
  const points = [
    new THREE.Vector3(-7.3, 0, 7.9),
    new THREE.Vector3(-5.8, 0, 6.6),
    new THREE.Vector3(-4.4, 0, 5.25),
    new THREE.Vector3(-3.4, 0, 4.15),
    new THREE.Vector3(-2.5, 0, 3.1),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const count = 16;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const side = i % 2 === 0 ? 1 : -1;
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(side * 0.15);
    const holder = new THREE.Group();
    holder.position.set(p.x + perp.x, snowGroundY + 0.046, p.z + perp.z);
    holder.rotation.y = Math.atan2(tangent.x, tangent.z) + (side > 0 ? 0.04 : -0.04);
    groundDetails.add(holder);
    const foot = addMesh(new THREE.PlaneGeometry(0.35, 0.58), mat, holder, 0, 0, 0, {
      rotation: [-Math.PI / 2, 0, 0],
      castShadow: false,
      receiveShadow: false,
    });
    foot.scale.x = side;
    foot.renderOrder = 2;
  }
}

// A few kicked-up snow crumbs near the door.
for (let i = 0; i < 18; i++) {
  const x = rng(-6.3, 2.8);
  const z = rng(1.6, 4.4);
  if (x > -2.3 && x < -0.1 && z > 1.7 && z < 3.1) continue;
  addSnowMound(snowGroup, x, z, rng(0.12, 0.32), rng(0.03, 0.075), rng(0.7, 1.4), rng(0.5, 1), rng(0, TAU));
}

/* ============================ ARCHITECTURE ============================== */

const BX = -1.7;
const BZ = -1.5;
const BW = 8.4;
const BD = 5.8;
const LEFT = BX - BW / 2;
const RIGHT = BX + BW / 2;
const FRONT = BZ + BD / 2;
const BACK = BZ - BD / 2;
const FLOOR_Y = 0.5;
const LOWER_TOP = 3.12;
const UPPER_TOP = 5.55;
const EAVE_Y = 5.98;
const RIDGE_Y = 7.35;
const ROOF_OVER_X = 0.64;
const ROOF_OVER_Z = 1.36;

const buildingRoot = new THREE.Group();
world.add(buildingRoot);

/* ------------------------------ foundation ------------------------------ */

const foundationGroup = new THREE.Group();
buildingRoot.add(foundationGroup);

// Dark stone plinth.
addBox(foundationGroup, BW + 0.22, 0.28, BD + 0.22, M.stoneDark, BX, 0.14, BZ, { castShadow: true });
// Random stone divisions.
for (let i = 0; i < 6; i++) {
  addBox(
    foundationGroup,
    0.82 + rng(-0.15, 0.3), 0.12, 0.06, M.stone,
    LEFT + 0.5 + i * 1.35, 0.12 + rng(-0.02, 0.03), FRONT + 0.14,
    { castShadow: false },
  );
}
// Wooden deck, slightly proud of the walls.
addBox(foundationGroup, BW + 0.32, 0.2, BD + 0.32, M.woodMid, BX, 0.38, BZ, { castShadow: true });

// Front engawa boards and two shallow snow-dusted steps.
addBox(foundationGroup, BW + 0.7, 0.17, 0.78, M.woodLight, BX, 0.39, FRONT + 0.5, { castShadow: true });
addBox(foundationGroup, 3.2, 0.16, 0.62, M.woodMid, -1.2, 0.27, FRONT + 1.05, { castShadow: true });
addBox(foundationGroup, 3.5, 0.12, 0.42, M.woodDark, -1.2, 0.14, FRONT + 1.34, { castShadow: true });
addBox(foundationGroup, 3.45, 0.055, 0.5, M.snowSolid, -1.2, 0.405, FRONT + 1.02, { castShadow: false });
addBox(foundationGroup, 2.8, 0.04, 0.72, M.snowSolid, BX, 0.49, FRONT + 0.5, { castShadow: false });

// Small side deck that joins the covered patio.
addBox(foundationGroup, 1.5, 0.19, 4.6, M.woodMid, RIGHT + 0.42, 0.35, 2.3, { castShadow: true });

registerAssembly(foundationGroup, 1.36, { drop: 1.45, scaleFrom: 0.95, duration: 0.9, group: 'structure' });

/* -------------------------------- walls -------------------------------- */

const groundGroup = new THREE.Group();
buildingRoot.add(groundGroup);
registerAssembly(groundGroup, 1.76, { drop: 2.0, scaleFrom: 0.97, duration: 1.05, group: 'structure' });

// Rear and side walls. The front is built in segments so the doorway is real.
addBox(groundGroup, BW, LOWER_TOP - FLOOR_Y, 0.18, M.woodDark, BX, (FLOOR_Y + LOWER_TOP) / 2, BACK, { castShadow: true });
addBox(groundGroup, 0.18, LOWER_TOP - FLOOR_Y, BD, M.woodDark, LEFT, (FLOOR_Y + LOWER_TOP) / 2, BZ, { castShadow: true });
addBox(groundGroup, 0.18, LOWER_TOP - FLOOR_Y, BD, M.woodDark, RIGHT, (FLOOR_Y + LOWER_TOP) / 2, BZ, { castShadow: true });

const doorLeftX = -2.02;
const doorRightX = -0.30;
const doorTopY = 2.84;

// Front wall segments around the door opening.
addBox(groundGroup, doorLeftX - LEFT, LOWER_TOP - FLOOR_Y, 0.2, M.woodDark, (LEFT + doorLeftX) / 2, (FLOOR_Y + LOWER_TOP) / 2, FRONT, { castShadow: true });
addBox(groundGroup, RIGHT - doorRightX, LOWER_TOP - FLOOR_Y, 0.2, M.woodDark, (doorRightX + RIGHT) / 2, (FLOOR_Y + LOWER_TOP) / 2, FRONT, { castShadow: true });
addBox(groundGroup, doorRightX - doorLeftX, LOWER_TOP - doorTopY, 0.2, M.woodDark, (doorLeftX + doorRightX) / 2, (doorTopY + LOWER_TOP) / 2, FRONT, { castShadow: true });

// Horizontal wooden weatherboards across the lower facade.
for (let i = 0; i < 7; i++) {
  const y = FLOOR_Y + 0.05 + i * 0.33;
  if (y > doorTopY) break;
  addBox(groundGroup, 0.035, 0.25, 0.035, M.woodDark, LEFT + 0.06, y + 0.12, FRONT + 0.12, { castShadow: false });
}
for (let i = 0; i < 3; i++) {
  addBox(groundGroup, BW + 0.08, 0.06, 0.055, M.woodAccent, BX, FLOOR_Y + 0.49 + i * 0.76, FRONT + 0.12, { castShadow: false });
}

// Plaster panels with dark timber framing.
const plasterPanels = [
  [-4.75, 2.15, 1.35, 1.18], [-2.9, 2.62, 0.18, 0.18],
  [1.55, 2.3, 1.15, 0.85], [-4.15, 0.82, 1.6, 0.36],
];
for (const [x, y, w, h] of plasterPanels) {
  addBox(groundGroup, w, h, 0.07, M.plaster, x, y, FRONT + 0.115, { castShadow: false });
}

// Main posts: heavy, warm timber.
const postXs = [LEFT + 0.04, -4.58, -2.08, -0.24, RIGHT - 0.04];
for (const x of postXs) {
  addBox(groundGroup, 0.23, LOWER_TOP - FLOOR_Y + 0.12, 0.27, M.woodMid, x, (FLOOR_Y + LOWER_TOP) / 2, FRONT + 0.13, { castShadow: true });
}
// Top and bottom beams.
addBox(groundGroup, BW + 0.16, 0.28, 0.34, M.woodMid, BX, LOWER_TOP - 0.05, FRONT + 0.14, { castShadow: true });
addBox(groundGroup, BW + 0.16, 0.18, 0.32, M.woodDark, BX, FLOOR_Y + 0.08, FRONT + 0.14, { castShadow: true });

// Exposed side beams on the right-hand wall.
for (let i = 0; i < 3; i++) {
  addBox(groundGroup, 0.28, 0.16, BD + 0.1, M.woodMid, RIGHT + 0.13, FLOOR_Y + 0.55 + i * 0.9, BZ, { castShadow: false });
}
addBox(groundGroup, 0.09, LOWER_TOP - FLOOR_Y, 0.14, M.woodMid, RIGHT + 0.15, (FLOOR_Y + LOWER_TOP) / 2, BZ + 1.9, { castShadow: false });
addBox(groundGroup, 0.09, LOWER_TOP - FLOOR_Y, 0.14, M.woodMid, RIGHT + 0.15, (FLOOR_Y + LOWER_TOP) / 2, BZ - 1.9, { castShadow: false });

/* ----------------------------- interior room ---------------------------- */

const interiorGroup = new THREE.Group();
buildingRoot.add(interiorGroup);
registerAssembly(interiorGroup, 2.0, { drop: 0.3, scaleFrom: 1, duration: 0.6, group: 'structure' });

// Warm back wall and floor visible through the doorway.
const backWall = addMesh(new THREE.PlaneGeometry(BW - 0.4, LOWER_TOP - FLOOR_Y), interiorMat, interiorGroup, BX, (FLOOR_Y + LOWER_TOP) / 2, BACK + 0.12, { castShadow: false, receiveShadow: false });
backWall.material = interiorMat;
addBox(interiorGroup, BW - 0.55, 0.12, BD - 0.5, M.woodDark, BX, 0.58, BZ, { castShadow: false });
addBox(interiorGroup, BW - 0.7, 0.05, 0.9, M.woodMid, BX, 0.66, -1.2, { castShadow: false });

// Counter, stools and shelves.
addBox(interiorGroup, 3.7, 1.0, 0.82, M.woodMid, -1.15, 1.05, -1.15, { castShadow: false });
addBox(interiorGroup, 3.98, 0.11, 1.0, M.woodLight, -1.15, 1.59, -1.15, { castShadow: false });
for (const x of [-2.6, -1.15, 0.3]) {
  addCylinder(interiorGroup, 0.16, 0.18, 0.5, M.woodDark, x, 0.82, -0.43, { castShadow: false, segments: 10 });
  addCylinder(interiorGroup, 0.26, 0.22, 0.08, M.woodMid, x, 1.07, -0.43, { castShadow: false, segments: 12 });
}
// Back shelf with bottles.
addBox(interiorGroup, 3.4, 0.09, 0.32, M.woodDark, -1.1, 2.05, BACK + 0.48, { castShadow: false });
addBox(interiorGroup, 3.4, 0.09, 0.32, M.woodDark, -1.1, 2.54, BACK + 0.48, { castShadow: false });
const bottleColors = [0x748a5c, 0xb07b45, 0x667a8e, 0x865c3a];
for (let row = 0; row < 2; row++) {
  for (let i = 0; i < 9; i++) {
    const c = pick(bottleColors);
    const mat = toon(c, { showOutline: false, outlineWidth: 0.001 });
    const b = addCylinder(interiorGroup, 0.05, 0.065, 0.25, mat, -2.6 + i * 0.37, 2.18 + row * 0.49, BACK + 0.48, { castShadow: false, segments: 7 });
    addCylinder(interiorGroup, 0.025, 0.04, 0.1, mat, -2.6 + i * 0.37, 2.18 + row * 0.49 + 0.17, BACK + 0.48, { castShadow: false, segments: 6 });
  }
}
// Three little pendant lamps over the counter.
for (let i = 0; i < 3; i++) {
  const x = -2.4 + i * 1.3;
  addCylinder(interiorGroup, 0.012, 0.012, 0.55, M.black, x, 2.68, -1.15, { castShadow: false, segments: 4 });
  addCylinder(interiorGroup, 0.16, 0.24, 0.22, M.black, x, 2.36, -1.15, { castShadow: false, segments: 12, openEnded: true });
  const bulb = addSphere(interiorGroup, 0.085, basic(0xffd28a), x, 2.28, -1.15, { castShadow: false, widthSegments: 10, heightSegments: 8 });
  bulb.material.userData.outlineParameters = { visible: false, keepAlive: true };
  warmBasicMaterials.push(bulb.material);
  bulb.material.color.copy(windowGlowStart);
}

// Bottles set on the counter, catching the doorway light.
for (let i = 0; i < 4; i++) {
  const bx = -1.85 + i * 0.45;
  addCylinder(interiorGroup, 0.045, 0.06, 0.28, toon([0x7c8f5a, 0xb6814b, 0x65788d, 0x8f5f3b][i], { showOutline: false }), bx, 1.72, -0.92, { castShadow: false, segments: 7 });
  addCylinder(interiorGroup, 0.022, 0.03, 0.09, M.paper, bx, 1.93, -0.92, { castShadow: false, segments: 6 });
}
// A quiet chef silhouette behind the counter.
const figure = new THREE.Group();
interiorGroup.add(figure);
figure.position.set(-0.72, 1.6, -1.82);
addSphere(figure, 0.22, M.darkMetal, 0, 0.72, 0, { castShadow: false, widthSegments: 12, heightSegments: 8 });
addCylinder(figure, 0.27, 0.36, 0.85, toon(0x344152, { showOutline: false }), 0, 0.12, 0, { castShadow: false, segments: 10 });
addBox(figure, 0.4, 0.55, 0.1, toon(0x87919c, { showOutline: false }), 0, 0.2, 0.2, { castShadow: false });
addBox(figure, 0.65, 0.07, 0.4, M.woodLight, 0, 0.32, -0.13, { castShadow: false });
figure.rotation.y = 0.1;

const interiorLight = new THREE.PointLight(0xffb15d, 0, 9.5, 2);
interiorLight.position.set(-1.0, 2.25, 0.0);
buildingRoot.add(interiorLight);
warmLights.push({ light: interiorLight, target: 28 });
addGlow(buildingRoot, 0xffa95a, 3.3, 0.0, -1.0, 2.0, 1.0);

/* ------------------------------ windows / door -------------------------- */

const windowGroup = new THREE.Group();
buildingRoot.add(windowGroup);
registerAssembly(windowGroup, 2.27, { drop: 1.5, scaleFrom: 0.95, duration: 1.0, group: 'details' });

function buildLatticeWindow(parent, x, y, z, width, height, options = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const pane = addMesh(new THREE.PlaneGeometry(width, height), windowMat, g, 0, 0, 0, { castShadow: false, receiveShadow: false });
  pane.renderOrder = 0;
  const frame = options.frameMaterial || M.woodDark;
  const t = 0.075;
  addBox(g, width + 0.18, 0.11, 0.1, frame, 0, height / 2 + 0.04, 0.06, { castShadow: false });
  addBox(g, width + 0.18, 0.11, 0.1, frame, 0, -height / 2 - 0.04, 0.06, { castShadow: false });
  addBox(g, 0.11, height + 0.16, 0.1, frame, -width / 2 - 0.035, 0, 0.06, { castShadow: false });
  addBox(g, 0.11, height + 0.16, 0.1, frame, width / 2 + 0.035, 0, 0.06, { castShadow: false });
  const vCount = options.verticalBars ?? 4;
  for (let i = 1; i < vCount; i++) {
    addBox(g, 0.032, height - 0.04, 0.055, frame, -width / 2 + (width * i) / vCount, 0, 0.065, { castShadow: false });
  }
  const hCount = options.horizontalBars ?? 3;
  for (let i = 1; i < hCount; i++) {
    addBox(g, width - 0.03, 0.032, 0.055, frame, 0, -height / 2 + (height * i) / hCount, 0.065, { castShadow: false });
  }
  addBox(g, width + 0.3, 0.08, 0.24, M.snowSolid, 0, -height / 2 - 0.12, 0.08, { castShadow: false });
  return g;
}

buildLatticeWindow(windowGroup, -3.55, 1.93, FRONT + 0.15, 2.0, 1.48, { verticalBars: 4, horizontalBars: 3 });
buildLatticeWindow(windowGroup, 1.46, 1.92, FRONT + 0.15, 1.35, 1.34, { verticalBars: 3, horizontalBars: 3 });

// Small warm window on the visible right wall.
{
  const g = new THREE.Group();
  g.position.set(RIGHT + 0.16, 1.98, 0.28);
  g.rotation.y = Math.PI / 2;
  windowGroup.add(g);
  addMesh(new THREE.PlaneGeometry(1.3, 1.25), windowMat, g, 0, 0, 0, { castShadow: false, receiveShadow: false });
  for (let i = 0; i < 3; i++) {
    addBox(g, 1.45, 0.08, 0.08, M.woodDark, 0, 0.63 - i * 0.62, 0.055, { castShadow: false });
  }
  for (let i = 0; i < 4; i++) {
    addBox(g, 0.055, 1.32, 0.08, M.woodDark, -0.66 + i * 0.44, 0, 0.055, { castShadow: false });
  }
  addBox(g, 1.55, 0.07, 0.22, M.snowSolid, 0, -0.69, 0.06, { castShadow: false });
}

// Door frame and threshold.
addBox(windowGroup, doorRightX - doorLeftX + 0.3, 0.2, 0.3, M.woodDark, (doorLeftX + doorRightX) / 2, doorTopY + 0.08, FRONT + 0.1, { castShadow: false });
addBox(windowGroup, 0.16, doorTopY - FLOOR_Y, 0.3, M.woodDark, doorLeftX - 0.07, (FLOOR_Y + doorTopY) / 2, FRONT + 0.1, { castShadow: false });
addBox(windowGroup, 0.16, doorTopY - FLOOR_Y, 0.3, M.woodDark, doorRightX + 0.07, (FLOOR_Y + doorTopY) / 2, FRONT + 0.1, { castShadow: false });
addBox(windowGroup, doorRightX - doorLeftX + 0.15, 0.1, 0.42, M.woodMid, (doorLeftX + doorRightX) / 2, FLOOR_Y + 0.04, FRONT + 0.12, { castShadow: false });
addBox(windowGroup, doorRightX - doorLeftX + 0.18, 0.04, 0.55, M.snowSolid, (doorLeftX + doorRightX) / 2, FLOOR_Y + 0.11, FRONT + 0.28, { castShadow: false });

// Sliding shōji door, split into two real panels.
const doorGroup = new THREE.Group();
buildingRoot.add(doorGroup);
registerAssembly(doorGroup, 2.45, { drop: 1.2, scaleFrom: 0.94, duration: 1.0, group: 'details' });

const doorPanels = [];
function buildDoorPanel(x, zOffset, index) {
  const g = new THREE.Group();
  g.position.set(x, FLOOR_Y + 1.125, FRONT + 0.145 + zOffset);
  doorGroup.add(g);
  const width = 0.84;
  const height = 2.25;
  addMesh(new THREE.PlaneGeometry(width - 0.1, height - 0.1), windowMat, g, 0, 0, 0, { castShadow: false, receiveShadow: false });
  addBox(g, width, 0.095, 0.07, M.woodDark, 0, height / 2 - 0.02, 0.035, { castShadow: false });
  addBox(g, width, 0.095, 0.07, M.woodDark, 0, -height / 2 + 0.02, 0.035, { castShadow: false });
  addBox(g, width, 0.075, 0.07, M.woodDark, 0, height / 2 - 1.16, 0.035, { castShadow: false });
  addBox(g, width, 0.075, 0.07, M.woodDark, 0, -height / 2 + 0.72, 0.035, { castShadow: false });
  addBox(g, 0.085, height, 0.07, M.woodDark, -width / 2 + 0.025, 0, 0.035, { castShadow: false });
  addBox(g, 0.085, height, 0.07, M.woodDark, width / 2 - 0.025, 0, 0.035, { castShadow: false });
  for (let i = 1; i < 3; i++) {
    addBox(g, 0.035, height - 0.08, 0.06, M.woodDark, -width / 2 + (width * i) / 3, 0, 0.045, { castShadow: false });
  }
  for (let i = 1; i < 6; i++) {
    addBox(g, width - 0.04, 0.03, 0.06, M.woodDark, 0, -height / 2 + (height * i) / 6, 0.045, { castShadow: false });
  }
  // Warm light escaping the vertical seam.
  addBox(g, 0.018, height - 0.14, 0.025, windowMat, width / 2 - 0.055, 0, 0.062, { castShadow: false, receiveShadow: false });
  // Small round handle and a dusting of snow on the door rail.
  addSphere(g, 0.026, M.gold, width * 0.27, -0.2, 0.08, { castShadow: false, widthSegments: 8, heightSegments: 6 });
  doorPanels.push({ group: g, closedX: x, openX: x - 0.84, index });
  return g;
}
buildDoorPanel(-1.61, 0.012, 0);
buildDoorPanel(-0.76, 0.048, 1);

/* ----------------------------- second storey ---------------------------- */

const upperGroup = new THREE.Group();
buildingRoot.add(upperGroup);
registerAssembly(upperGroup, 2.88, { drop: 2.4, scaleFrom: 0.96, duration: 1.0, group: 'structure' });

// Slightly overhanging upper volume.
addBox(upperGroup, BW + 0.18, UPPER_TOP - LOWER_TOP, BD + 0.2, M.woodDark, BX, (LOWER_TOP + UPPER_TOP) / 2, BZ, { castShadow: true });
// Plaster front panels framed in timber.
const upperPanelData = [
  [-4.9, 4.55, 1.25, 1.25], [-3.1, 4.55, 1.2, 1.25], [1.0, 4.55, 1.25, 1.25], [2.05, 4.55, 0.65, 1.25],
];
for (const [x, y, w, h] of upperPanelData) {
  addBox(upperGroup, w, h, 0.075, M.plaster, x, y, FRONT + 0.11, { castShadow: false });
}
// Heavy corner posts and horizontal rails.
for (const x of [LEFT + 0.03, RIGHT - 0.03]) {
  addBox(upperGroup, 0.25, UPPER_TOP - LOWER_TOP + 0.2, 0.28, M.woodMid, x, (LOWER_TOP + UPPER_TOP) / 2, FRONT + 0.13, { castShadow: true });
}
addBox(upperGroup, BW + 0.28, 0.22, 0.31, M.woodMid, BX, LOWER_TOP + 0.18, FRONT + 0.13, { castShadow: true });
addBox(upperGroup, BW + 0.28, 0.21, 0.3, M.woodMid, BX, UPPER_TOP - 0.03, FRONT + 0.13, { castShadow: true });
addBox(upperGroup, 0.13, UPPER_TOP - LOWER_TOP, 0.16, M.woodAccent, 2.05, (LOWER_TOP + UPPER_TOP) / 2, FRONT + 0.14, { castShadow: false });
addBox(upperGroup, 0.13, UPPER_TOP - LOWER_TOP, 0.16, M.woodAccent, -4.48, (LOWER_TOP + UPPER_TOP) / 2, FRONT + 0.14, { castShadow: false });

// Two glowing upper windows.
buildLatticeWindow(upperGroup, -3.25, 4.63, FRONT + 0.16, 1.4, 1.1, { verticalBars: 3, horizontalBars: 2 });
buildLatticeWindow(upperGroup, 0.42, 4.63, FRONT + 0.16, 1.22, 1.08, { verticalBars: 3, horizontalBars: 2 });

// Tiny wooden balcony shutter panels at the sides.
addBox(upperGroup, 0.52, 1.25, 0.09, M.woodLight, -5.25, 4.52, FRONT + 0.18, { castShadow: false });
addBox(upperGroup, 0.52, 1.25, 0.09, M.woodLight, 1.9, 4.52, FRONT + 0.18, { castShadow: false });
for (let i = 0; i < 5; i++) {
  addBox(upperGroup, 0.035, 1.12, 0.03, M.woodDark, -5.42 + i * 0.1, 4.52, FRONT + 0.24, { castShadow: false });
  addBox(upperGroup, 0.035, 1.12, 0.03, M.woodDark, 1.74 + i * 0.07, 4.52, FRONT + 0.24, { castShadow: false });
}

// Mid-level eave / snow porch roof.
const midEave = new THREE.Group();
upperGroup.add(midEave);
{
  const depth = 0.82;
  const roofBox = addBox(midEave, BW + 0.55, 0.12, depth, M.roof, BX, LOWER_TOP + 0.47, FRONT + 0.38, { castShadow: true, rotation: [0.18, 0, 0] });
  const snowBox = addBox(midEave, BW + 0.35, 0.1, depth - 0.04, M.snowSolid, BX, LOWER_TOP + 0.555, FRONT + 0.37, { castShadow: false, rotation: [0.18, 0, 0] });
  for (let i = 0; i < 5; i++) {
    addBox(midEave, 0.09, 0.15, depth + 0.2, M.woodDark, LEFT + 0.9 + i * 1.6, LOWER_TOP + 0.38, FRONT + 0.37, { castShadow: false, rotation: [0.18, 0, 0] });
  }
  addBox(midEave, BW + 0.28, 0.045, 0.3, M.snowSolid, BX, LOWER_TOP + 0.58, FRONT + 0.79, { castShadow: false, rotation: [0.18, 0, 0] });
}

/* --------------------------------- roof --------------------------------- */

const roofGroup = new THREE.Group();
buildingRoot.add(roofGroup);
registerAssembly(roofGroup, 3.48, { drop: 2.9, scaleFrom: 0.95, duration: 1.12, group: 'roof' });

function createRoofSurfaceGeometry(sign, inflation = 0) {
  const cols = 32;
  const rows = 12;
  const halfW = BW / 2 + ROOF_OVER_X + inflation * 0.12;
  const halfD = BD / 2 + ROOF_OVER_Z + inflation * 0.09;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const nx = u * 2 - 1;
      const cornerLift = Math.pow(Math.abs(nx), 5) * 0.54 * Math.pow(1 - t, 2.1);
      const x = BX + nx * halfW;
      const z = BZ + sign * (halfD * (1 - t));
      const y = EAVE_Y + (RIDGE_Y - EAVE_Y) * t + cornerLift - Math.sin(Math.PI * t) * 0.14 * (1 - Math.abs(nx) * 0.2) + inflation;
      positions.push(x, y, z);
      uvs.push((x - LEFT) * 0.5, t * 2.2);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      if (sign > 0) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

for (const sign of [1, -1]) {
  addMesh(createRoofSurfaceGeometry(sign), M.roof, roofGroup, 0, 0, 0, { castShadow: true, receiveShadow: true });
}
// Snow blanket: same curved surface, lifted and very slightly oversized.
const roofSnowGroup = new THREE.Group();
roofGroup.add(roofSnowGroup);
for (const sign of [1, -1]) {
  addMesh(createRoofSurfaceGeometry(sign, 0.19), M.snowSolid, roofSnowGroup, 0, 0.02, 0, { castShadow: false, receiveShadow: true });
}

// Ridge beam and its deep snow cap.
addBox(roofGroup, BW + ROOF_OVER_X * 2 + 0.2, 0.24, 0.34, M.roofDeep, BX, RIDGE_Y + 0.02, BZ, { castShadow: true });
addCylinder(roofGroup, 0.2, 0.24, BW + ROOF_OVER_X * 2 + 0.35, M.snowSolid, BX, RIDGE_Y + 0.23, BZ, { rotation: [0, 0, Math.PI / 2], castShadow: false, segments: 12 });

// Snow lip along the front and rear eaves, with rounded lumps for weight.
for (const sign of [1, -1]) {
  const edgePoints = [];
  for (let i = 0; i <= 20; i++) {
    const nx = (i / 20) * 2 - 1;
    const lift = Math.pow(Math.abs(nx), 5) * 0.54;
    edgePoints.push(new THREE.Vector3(BX + nx * (BW / 2 + ROOF_OVER_X), EAVE_Y + lift + 0.19, BZ + sign * (BD / 2 + ROOF_OVER_Z)));
  }
  addTube(roofGroup, edgePoints, 0.115, M.snowSolid, { segments: 40, radialSegments: 7, castShadow: false });
  // Dark fascia just below.
  const fasciaPoints = edgePoints.map((p) => new THREE.Vector3(p.x, p.y - 0.18, p.z));
  addTube(roofGroup, fasciaPoints, 0.075, M.woodDark, { segments: 40, radialSegments: 5, castShadow: true });
  for (let i = 0; i < 12; i++) {
    const nx = (i / 11) * 2 - 1;
    const lift = Math.pow(Math.abs(nx), 5) * 0.42;
    addSnowMound(roofSnowGroup, BX + nx * (BW / 2 + ROOF_OVER_X) * 0.98, BZ + sign * (BD / 2 + ROOF_OVER_Z + 0.015), 0.34 + rng(-0.12, 0.2), 0.15, 1.5, 0.7, rng(0, TAU), EAVE_Y + lift - snowGroundY + 0.28);
  }
}

// Icicles under the front eave.
const icicleGroup = new THREE.Group();
roofGroup.add(icicleGroup);
for (const side of [1, -1]) {
  const count = side > 0 ? 19 : 12;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = BX + (t * 2 - 1) * (BW / 2 + ROOF_OVER_X - 0.16);
    const lift = Math.pow(Math.abs(t * 2 - 1), 5) * 0.5;
    const len = rng(0.16, 0.62) * (i % 4 === 0 ? 1.3 : 0.8);
    const geo = new THREE.ConeGeometry(rng(0.035, 0.06), len, 7);
    addMesh(geo, M.ice, icicleGroup, x, EAVE_Y + lift - 0.18 - len / 2, BZ + side * (BD / 2 + ROOF_OVER_Z + 0.055), { castShadow: false, receiveShadow: false });
  }
}

// Exposed rafters under the eaves.
for (let i = 0; i < 13; i++) {
  const x = BX - BW * 0.43 + (i / 12) * BW * 0.86;
  for (const sign of [1, -1]) {
    addBox(roofGroup, 0.07, 0.1, 0.72, M.woodDark, x, EAVE_Y - 0.34, BZ + sign * (BD / 2 + ROOF_OVER_Z - 0.53), {
      castShadow: false,
      rotation: [sign * -0.12, 0, 0],
    });
  }
}

// Gable ends: inset under the eaves, with visible timber bracing.
{
  const gableMat = toon(0xffffff, { map: plasterTex, side: THREE.DoubleSide, outlineWidth: 0.0018, outlineAlpha: 0.55 });
  const halfW = BD / 2 + ROOF_OVER_Z - 0.06;
  const baseY = UPPER_TOP - 0.02;
  const apexY = RIDGE_Y + 0.02;
  const height = apexY - baseY;
  for (const side of [-1, 1]) {
    const x = BX + side * (BW / 2 + 0.055);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, 0);
    shape.lineTo(halfW, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
    addMesh(geo, gableMat, roofGroup, x, baseY, BZ, { castShadow: false, receiveShadow: true });
    addBox(roofGroup, 0.15, 0.14, halfW * 2, M.woodDark, x + side * 0.03, baseY + 0.03, BZ, { castShadow: false });
    addCylinderBetween(roofGroup, new THREE.Vector3(x + side * 0.035, baseY + 0.06, BZ - halfW + 0.04), new THREE.Vector3(x + side * 0.035, apexY - 0.04, BZ), 0.065, M.woodDark, { castShadow: false, segments: 6 });
    addCylinderBetween(roofGroup, new THREE.Vector3(x + side * 0.035, baseY + 0.06, BZ + halfW - 0.04), new THREE.Vector3(x + side * 0.035, apexY - 0.04, BZ), 0.065, M.woodDark, { castShadow: false, segments: 6 });
    for (const dy of [0.52, 1.04]) {
      const frac = dy / height;
      const half = halfW * (1 - frac);
      addBox(roofGroup, 0.12, 0.1, half * 2, M.woodDark, x + side * 0.03, baseY + dy, BZ, { castShadow: false });
    }
    addCylinderBetween(roofGroup, new THREE.Vector3(x + side * 0.02, baseY + 0.03, BZ), new THREE.Vector3(x + side * 0.02, apexY - 0.08, BZ), 0.045, M.woodDark, { castShadow: false, segments: 5 });
    addCylinder(roofGroup, 0.14, 0.14, 0.06, M.woodDark, x + side * 0.055, baseY + 0.86, BZ, { rotation: [0, 0, Math.PI / 2], castShadow: false, segments: 14 });
    addCylinder(roofGroup, 0.1, 0.1, 0.07, M.woodDark, x + side * 0.065, baseY + 0.86, BZ, { rotation: [0, 0, Math.PI / 2], castShadow: false, segments: 14 });
    addBox(roofGroup, 0.2, 0.05, halfW * 1.5, M.snowSolid, x + side * 0.03, baseY + 0.115, BZ, { castShadow: false });
  }
}

// Snow drifts settled on the roof panels.
for (let i = 0; i < 11; i++) {
  const nx = rng(-0.82, 0.82);
  const t = rng(0.12, 0.82);
  const sign = random() > 0.5 ? 1 : -1;
  const x = BX + nx * (BW / 2 + ROOF_OVER_X - 0.35);
  const z = BZ + sign * (BD / 2 + ROOF_OVER_Z - 0.35) * (1 - t);
  const y = EAVE_Y + (RIDGE_Y - EAVE_Y) * t + 0.27 - Math.sin(Math.PI * t) * 0.14;
  addMesh(driftGeometry, M.snowDrift, roofSnowGroup, x, y - snowGroundY + 0.02, z, { scale: [rng(0.7, 1.35), rng(0.12, 0.22), rng(0.45, 0.9)], rotation: [0, rng(0, TAU), 0], castShadow: false, receiveShadow: true });
}

/* -------------------------------- chimney ------------------------------- */

const chimneyGroup = new THREE.Group();
buildingRoot.add(chimneyGroup);
registerAssembly(chimneyGroup, 4.16, { drop: 2.2, scaleFrom: 0.92, duration: 0.85, group: 'roof' });

const chimneyX = -3.9;
const chimneyZ = -0.55;
const chimneyBaseY = 6.35;
addBox(chimneyGroup, 0.7, 1.7, 0.66, M.stoneDark, chimneyX, chimneyBaseY + 0.75, chimneyZ, { castShadow: true });
for (let i = 0; i < 4; i++) {
  addBox(chimneyGroup, 0.78, 0.08, 0.73, M.stone, chimneyX, chimneyBaseY + 0.2 + i * 0.43, chimneyZ, { castShadow: false });
}
addBox(chimneyGroup, 0.88, 0.15, 0.82, M.stone, chimneyX, chimneyBaseY + 1.61, chimneyZ, { castShadow: true });
addBox(chimneyGroup, 0.93, 0.12, 0.88, M.snowSolid, chimneyX, chimneyBaseY + 1.75, chimneyZ, { castShadow: false });
addCylinder(chimneyGroup, 0.25, 0.31, 0.25, M.black, chimneyX, chimneyBaseY + 1.91, chimneyZ, { castShadow: false, segments: 10 });
// A little snow heap where the chimney meets the roof.
addMesh(driftGeometry, M.snowDrift, chimneyGroup, chimneyX, 6.9, chimneyZ, { scale: [0.82, 0.2, 0.72], castShadow: false, receiveShadow: true });

/* ------------------------------ noren + sign ---------------------------- */

const norenGroup = new THREE.Group();
buildingRoot.add(norenGroup);
registerAssembly(norenGroup, 4.46, { drop: 1.6, scaleFrom: 0.96, duration: 0.9, group: 'dressing' });

const norenTexture = makeCanvasTexture(1536, 600, (ctx, w, h) => {
  ctx.fillStyle = '#1a2b4e';
  ctx.fillRect(0, 0, w, h);
  // Woven indigo texture and top band.
  for (let i = 0; i < 100; i++) {
    ctx.strokeStyle = `rgba(9,17,34,${0.06 + random() * 0.16})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, random() * h);
    ctx.lineTo(w, random() * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#0e1a32';
  ctx.fillRect(0, 0, w, h * 0.16);
  ctx.fillStyle = '#dce7ef';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 250px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 10;
  ctx.fillText('焼 き 鳥', w / 2, h * 0.58);
  ctx.restore();
  // small crest at the bottom
  ctx.strokeStyle = 'rgba(220,231,239,.72)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.87, 36, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.87, 17, 0, TAU);
  ctx.stroke();
  addGrain(ctx, w, h, 0.04, 900, 0.07);
});

const norenPanels = [];
{
  const topY = 3.09;
  const height = 0.97;
  const totalW = 2.28;
  const gap = 0.026;
  const panelW = (totalW - gap * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(panelW, height, 6, 10);
    const uvs = geo.attributes.uv;
    for (let k = 0; k < uvs.count; k++) {
      const localU = uvs.getX(k);
      const u0 = i / 3 + 0.012;
      const u1 = (i + 1) / 3 - 0.012;
      uvs.setX(k, u0 + localU * (u1 - u0));
    }
    const mat = toon(0xffffff, { map: norenTexture, side: THREE.DoubleSide, outlineWidth: 0.001, outlineAlpha: 0.35 });
    const mesh = addMesh(geo, mat, norenGroup, -1.2 - totalW / 2 + panelW / 2 + i * (panelW + gap), topY - height / 2, FRONT + 0.31, { castShadow: false, receiveShadow: false });
    mesh.userData.basePositions = Float32Array.from(geo.attributes.position.array);
    mesh.userData.phase = i * 1.4;
    mesh.userData.height = height;
    norenPanels.push(mesh);
  }
  // Wooden rod and end caps.
  addCylinder(norenGroup, 0.04, 0.04, totalW + 0.35, M.woodDark, -1.2, topY + 0.04, FRONT + 0.31, { rotation: [0, 0, Math.PI / 2], castShadow: true, segments: 8 });
  addSphere(norenGroup, 0.065, M.woodAccent, -1.2 - (totalW + 0.35) / 2, topY + 0.04, FRONT + 0.31, { castShadow: false, widthSegments: 8, heightSegments: 6 });
  addSphere(norenGroup, 0.065, M.woodAccent, -1.2 + (totalW + 0.35) / 2, topY + 0.04, FRONT + 0.31, { castShadow: false, widthSegments: 8, heightSegments: 6 });
  addBox(norenGroup, totalW + 0.22, 0.05, 0.09, M.snowSolid, -1.2, topY + 0.1, FRONT + 0.32, { castShadow: false });
}

// Vertical carved sign bearing the shop's name.
{
  const signTexture = makeCanvasTexture(320, 900, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#7b4e2c');
    g.addColorStop(0.45, '#5e381f');
    g.addColorStop(1, '#3b2415');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(225,174,107,${0.03 + random() * 0.09})`;
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      const y = random() * h;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + rng(-9, 9), w * 0.7, y + rng(-9, 9), w, y + rng(-5, 5));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(28,15,7,.7)';
    ctx.lineWidth = 16;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#f1dfb5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 160px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    const chars = ['居', '酒', '屋'];
    for (let i = 0; i < 3; i++) ctx.fillText(chars[i], w / 2, 200 + i * 230);
    ctx.shadowBlur = 0;
    addGrain(ctx, w, h, 0.05, 500, 0.1);
  });
  const signGroup = new THREE.Group();
  signGroup.position.set(LEFT + 0.02, 2.32, FRONT + 0.34);
  signGroup.rotation.y = 0.05;
  norenGroup.add(signGroup);
  addBox(signGroup, 0.56, 1.7, 0.12, M.woodDark, 0.0, 0, -0.03, { castShadow: true });
  const mat = toon(0xffffff, { map: signTexture, showOutline: false });
  addMesh(new THREE.PlaneGeometry(0.5, 1.58), mat, signGroup, 0, 0, 0.035, { castShadow: false, receiveShadow: false });
  addBox(signGroup, 0.63, 0.07, 0.2, M.snowSolid, 0, 0.87, 0, { castShadow: false });
  addCylinder(signGroup, 0.02, 0.02, 0.28, M.black, -0.2, 0.99, 0, { castShadow: false, segments: 4 });
  addCylinder(signGroup, 0.02, 0.02, 0.28, M.black, 0.2, 0.99, 0, { castShadow: false, segments: 4 });
}

/* ------------------------- rear & side additions ----------------------- */

const sideRearGroup = new THREE.Group();
buildingRoot.add(sideRearGroup);
registerAssembly(sideRearGroup, 2.62, { drop: 1.5, scaleFrom: 0.97, duration: 0.85, group: 'details' });

// Timber framing on the quieter walls.
for (let i = 0; i < 4; i++) {
  addBox(sideRearGroup, 0.1, LOWER_TOP - FLOOR_Y, 0.1, M.woodMid, LEFT - 0.12, (FLOOR_Y + LOWER_TOP) / 2, BZ - 2.2 + i * 1.45, { castShadow: false });
  addBox(sideRearGroup, 0.1, UPPER_TOP - LOWER_TOP, 0.1, M.woodMid, LEFT - 0.12, (LOWER_TOP + UPPER_TOP) / 2, BZ - 2.2 + i * 1.45, { castShadow: false });
}
for (let i = 0; i < 3; i++) {
  addBox(sideRearGroup, 0.1, 0.12, BD, M.woodMid, LEFT - 0.12, 1.0 + i * 1.0, BZ, { castShadow: false });
}
for (let i = 0; i < 5; i++) {
  addBox(sideRearGroup, 0.11, UPPER_TOP - FLOOR_Y, 0.11, M.woodMid, LEFT + 0.8 + i * 1.8, (FLOOR_Y + UPPER_TOP) / 2, BACK - 0.12, { castShadow: false });
}
addBox(sideRearGroup, BW, 0.14, 0.12, M.woodMid, BX, LOWER_TOP - 0.18, BACK - 0.12, { castShadow: false });
addBox(sideRearGroup, BW, 0.13, 0.12, M.woodMid, BX, UPPER_TOP - 0.2, BACK - 0.12, { castShadow: false });

{
  const winL = buildLatticeWindow(sideRearGroup, LEFT - 0.15, 1.95, BZ - 0.25, 1.3, 1.22, { verticalBars: 3, horizontalBars: 2 });
  winL.rotation.y = -Math.PI / 2;
  const winLUp = buildLatticeWindow(sideRearGroup, LEFT - 0.15, 4.48, BZ - 1.65, 1.05, 0.92, { verticalBars: 2, horizontalBars: 2 });
  winLUp.rotation.y = -Math.PI / 2;
  const winB = buildLatticeWindow(sideRearGroup, -3.9, 4.42, BACK - 0.15, 1.3, 1.0, { verticalBars: 3, horizontalBars: 2 });
  winB.rotation.y = Math.PI;
}
{
  const d = new THREE.Group();
  d.position.set(0.85, FLOOR_Y, BACK - 0.14);
  d.rotation.y = Math.PI;
  sideRearGroup.add(d);
  addBox(d, 1.18, 2.08, 0.12, M.woodDark, 0, 1.04, 0, { castShadow: false });
  addBox(d, 0.86, 1.76, 0.025, windowMat, 0, 1.02, 0.07, { castShadow: false, receiveShadow: false });
  for (let i = 0; i < 5; i++) {
    addBox(d, 0.045, 1.76, 0.04, M.woodDark, -0.38 + i * 0.19, 1.02, 0.09, { castShadow: false });
  }
  addBox(d, 0.95, 0.06, 0.04, M.woodDark, 0, 1.09, 0.09, { castShadow: false });
  addBox(d, 1.3, 0.055, 0.22, M.snowSolid, 0, 2.12, 0.07, { castShadow: false });
  addBox(d, 1.45, 0.09, 0.6, M.woodMid, 0, 0.04, 0.25, { castShadow: false });
}
{
  const d = new THREE.Group();
  d.position.set(LEFT - 0.15, FLOOR_Y, BACK + 1.1);
  d.rotation.y = -Math.PI / 2;
  sideRearGroup.add(d);
  addBox(d, 1.0, 1.95, 0.1, M.woodDark, 0, 0.98, 0, { castShadow: false });
  addBox(d, 0.55, 1.5, 0.025, windowMat, 0, 0.95, 0.065, { castShadow: false, receiveShadow: false });
  for (let i = 0; i < 3; i++) {
    addBox(d, 0.04, 1.5, 0.04, M.woodDark, -0.2 + i * 0.2, 0.95, 0.08, { castShadow: false });
  }
  addBox(d, 0.22, 0.06, 0.04, M.gold, 0.34, 0.9, 0.095, { castShadow: false });
}
addBox(sideRearGroup, 0.26, 0.34, 0.18, M.black, LEFT - 0.18, 2.75, BACK + 1.1, { castShadow: false });
addBox(sideRearGroup, 0.32, 0.045, 0.28, M.snowSolid, LEFT - 0.18, 2.95, BACK + 1.1, { castShadow: false });
const sideBulbMat = basic(0xffd391);
sideBulbMat.userData.outlineParameters = { visible: false, keepAlive: true };
sideBulbMat.color.copy(windowGlowStart);
warmBasicMaterials.push(sideBulbMat);
addBox(sideRearGroup, 0.13, 0.15, 0.1, sideBulbMat, LEFT - 0.32, 2.54, BACK + 1.1, { castShadow: false, receiveShadow: false });
addGlow(sideRearGroup, 0xffc276, 1.1, 0.24, LEFT - 0.4, 2.53, BACK + 1.1);

/* ---------------------------- entry awning ------------------------------ */

const awningGroup = new THREE.Group();
buildingRoot.add(awningGroup);
registerAssembly(awningGroup, 4.03, { drop: 1.9, scaleFrom: 0.95, duration: 0.95, group: 'dressing' });

{
  // Compact gabled hisashi over the door, thickly snow-capped.
  const w = 3.0;
  const d = 1.05;
  addBox(awningGroup, w, 0.11, d, M.roofDeep, -1.18, 3.55, FRONT + 0.54, { castShadow: true, rotation: [0.20, 0, 0] });
  addBox(awningGroup, w - 0.08, 0.11, d - 0.04, M.snowSolid, -1.18, 3.64, FRONT + 0.53, { castShadow: false, rotation: [0.20, 0, 0] });
  // Little tile ridges.
  for (let i = 0; i < 8; i++) {
    addBox(awningGroup, 0.06, 0.08, d - 0.05, M.roof, -1.18 - w / 2 + 0.2 + i * 0.38, 3.57, FRONT + 0.53, { castShadow: false, rotation: [0.2, 0, 0] });
  }
  addBox(awningGroup, w + 0.15, 0.06, 0.18, M.snowSolid, -1.18, 3.68, FRONT + 1.03, { castShadow: false, rotation: [0.2, 0, 0] });
  // Support brackets.
  for (const x of [-2.55, 0.2]) {
    addBox(awningGroup, 0.09, 0.5, 0.09, M.woodDark, x, 3.39, FRONT + 0.1, { castShadow: false });
    addBox(awningGroup, 0.09, 0.09, 0.9, M.woodDark, x, 3.25, FRONT + 0.48, { castShadow: false, rotation: [-0.2, 0, 0] });
  }
}

/* -------------------------------- lanterns ------------------------------ */

const lanternPivots = [];
const lanternLightMats = [];

function makeLanternTexture() {
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d21e0a');
    g.addColorStop(0.22, '#ee3513');
    g.addColorStop(0.48, '#ff5928');
    g.addColorStop(0.7, '#ef3312');
    g.addColorStop(1, '#c01807');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const halo = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.55);
    halo.addColorStop(0, 'rgba(255,146,67,.26)');
    halo.addColorStop(0.58, 'rgba(255,92,36,.1)');
    halo.addColorStop(1, 'rgba(68,3,1,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] });
}

function makeLanternTextTexture(kind) {
  return makeCanvasTexture(320, 640, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#21100a';
    ctx.shadowColor = 'rgba(255,214,160,.45)';
    ctx.shadowBlur = 2;
    if (kind === 'beer') {
      ctx.font = '700 190px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
      ctx.fillText('麦', w / 2, h * 0.32);
      ctx.fillText('酒', w / 2, h * 0.66);
    } else {
      ctx.font = '700 148px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
      ctx.fillText('焼', w / 2, h * 0.25);
      ctx.fillText('き', w / 2, h * 0.49);
      ctx.fillText('鳥', w / 2, h * 0.73);
    }
  }, { srgb: true });
}

const lanternPaperTex = makeLanternTexture();
const lanternBeerTextTex = makeLanternTextTexture('beer');
const lanternChickenTextTex = makeLanternTextTexture('chicken');


function createLantern(x, y, z, kind = 'chicken', scale = 1, swayPhase = 0) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  world.add(pivot);
  registerAssembly(pivot, 5.02 + random() * 0.24, { drop: 2.1, scaleFrom: 0.9, duration: 0.9, group: 'lanterns' });

  addCylinder(pivot, 0.012, 0.012, 0.5, M.rope, 0, -0.25, 0, { castShadow: false, segments: 4 });
  addCylinder(pivot, 0.02, 0.02, 0.12, M.black, 0, -0.47, 0, { castShadow: false, segments: 5 });

  const lantern = new THREE.Group();
  lantern.position.y = -0.95 * scale;
  lantern.scale.setScalar(scale);
  pivot.add(lantern);

  const profile = [];
  const top = 0.38;
  const bottom = -0.38;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = lerp(top, bottom, t);
    const bulge = Math.sin(t * Math.PI) * 0.09;
    const r = t < 0.08 ? 0.26 : t > 0.92 ? 0.22 : 0.245 + bulge;
    profile.push(new THREE.Vector2(r, y));
  }
  const lathe = new THREE.LatheGeometry(profile, 28);
  const lmat = new THREE.MeshBasicMaterial({
    map: lanternPaperTex,
    color: lanternColorStart.clone(),
    toneMapped: false,
  });
  // Outlining a luminous paper body muddies its glow, so only the black fittings carry the ink line.
  lmat.userData.outlineParameters = { thickness: 0.0014, color: outlineColor, alpha: 0.5, visible: false, keepAlive: true };
  const body = addMesh(lathe, lmat, lantern, 0, 0, 0, { castShadow: true, receiveShadow: false });
  lanternLightMats.push(lmat);

  const textTex = kind === 'beer' ? lanternBeerTextTex : lanternChickenTextTex;
  const textMat = new THREE.MeshBasicMaterial({
    map: textTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide,
    alphaTest: 0.01,
  });
  textMat.userData.outlineParameters = { visible: false, keepAlive: true };
  for (const side of [1, -1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.53), textMat);
    decal.position.set(0, -0.01, side * 0.315);
    if (side < 0) decal.rotation.y = Math.PI;
    decal.renderOrder = 3;
    lantern.add(decal);
  }

  addCylinder(lantern, 0.25, 0.27, 0.09, M.black, 0, top + 0.02, 0, { castShadow: false, segments: 16 });
  addCylinder(lantern, 0.22, 0.20, 0.08, M.black, 0, bottom - 0.02, 0, { castShadow: false, segments: 16 });
  addCylinder(lantern, 0.018, 0.018, 0.14, M.gold, 0, bottom - 0.13, 0, { castShadow: false, segments: 4 });
  addCylinder(lantern, 0.05, 0.02, 0.26, M.redFabric, 0, bottom - 0.32, 0, { castShadow: false, segments: 6 });
  addSphere(lantern, 0.035, M.gold, 0, bottom - 0.47, 0, { castShadow: false, widthSegments: 6, heightSegments: 5 });
  // Tiny snow cap on the lantern's crown.
  addBox(lantern, 0.36, 0.055, 0.3, M.snowSolid, 0, top + 0.095, 0.03, { castShadow: false, rotation: [0.1, 0, 0] });

  const glow = addGlow(lantern, kind === 'beer' ? 0xffb26b : 0xff975d, 3.35, 0.56, 0, -0.02, 0.02);
  glow.scale.set(3.35, 3.35, 1);

  const light = new THREE.PointLight(0xffa25d, 0, 5.6, 2);
  light.position.set(0, -0.02, 0.1);
  lantern.add(light);
  warmLights.push({ light, target: kind === 'beer' ? 11.5 : 9.5 });

  lanternPivots.push({
    pivot,
    phase: swayPhase,
    angleX: 0,
    angleZ: 0,
    velX: 0,
    velZ: 0,
    scale,
  });
  return pivot;
}

createLantern(-4.22, EAVE_Y + 0.02, BZ + BD / 2 + ROOF_OVER_Z - 0.12, 'beer', 1.13, 0.4);
createLantern(1.58, EAVE_Y + 0.02, BZ + BD / 2 + ROOF_OVER_Z - 0.14, 'chicken', 1.09, 2.1);
createLantern(-2.75, EAVE_Y + 0.02, BZ - BD / 2 - ROOF_OVER_Z + 0.16, 'beer', 0.9, 3.4);

/* ----------------------------- patio canopy ----------------------------- */

const canopyGroup = new THREE.Group();
world.add(canopyGroup);
registerAssembly(canopyGroup, 3.08, { drop: 2.3, scaleFrom: 0.96, duration: 1.0, group: 'structure' });

const patioX = 5.25;
const patioZ = 2.62;
// Deck
addBox(canopyGroup, 5.15, 0.2, 5.0, M.woodMid, patioX, 0.35, patioZ, { castShadow: true });
for (let i = 0; i < 8; i++) {
  addBox(canopyGroup, 0.045, 0.03, 4.85, M.woodLight, 3.2 + i * 0.62, 0.462, patioZ, { castShadow: false });
}
addBox(canopyGroup, 5.3, 0.05, 0.24, M.snowSolid, patioX, 0.48, patioZ + 2.4, { castShadow: false });

// Lean-to roof (high at the building, low at the outer posts).
{
  const roofAngle = -Math.atan2(0.72, 4.9);
  const roof = addBox(canopyGroup, 5.35, 0.13, 4.9, M.roofDeep, 5.25, 3.97, 2.78, { castShadow: true, rotation: [0, 0, roofAngle] });
  const snow = addBox(canopyGroup, 5.18, 0.1, 4.74, M.snowSolid, 5.23, 4.07, 2.78, { castShadow: false, rotation: [0, 0, roofAngle] });
  // Rafters visible from below.
  for (let i = 0; i < 9; i++) {
    addBox(canopyGroup, 0.07, 0.11, 4.85, M.woodDark, 3.0 + i * 0.56, 3.86, 2.78, { castShadow: false, rotation: [0, 0, roofAngle] });
  }
  // Snow lip at the outer edge.
  addBox(canopyGroup, 0.16, 0.17, 4.85, M.snowSolid, 7.8, 3.57, 2.78, { castShadow: false, rotation: [0, 0, roofAngle] });
  // Lumpy snow resting on the lean-to roof.
  for (let i = 0; i < 8; i++) {
    const x = 3.15 + i * 0.61 + rng(-0.12, 0.12);
    const z = 0.85 + random() * 3.8;
    const slopeY = 4.13 - (x - 2.8) * 0.147;
    addMesh(driftGeometry, M.snowDrift, canopyGroup, x, slopeY + 0.03, z, {
      scale: [rng(0.32, 0.66), rng(0.055, 0.11), rng(0.28, 0.52)],
      rotation: [0, rng(0, TAU), 0],
      castShadow: false,
      receiveShadow: true,
    });
  }
  // Icicles on the outer eave.
  for (let i = 0; i < 8; i++) {
    const len = rng(0.12, 0.38);
    addMesh(new THREE.ConeGeometry(rng(0.025, 0.045), len, 6), M.ice, canopyGroup, 7.86, 3.46 - len / 2, 0.85 + i * 0.55, { castShadow: false });
  }
}

// Posts and cross-beams.
for (const z of [0.64, 4.78]) {
  addBox(canopyGroup, 0.18, 3.47, 0.18, M.woodDark, 7.62, 1.95, z, { castShadow: true });
  addBox(canopyGroup, 0.46, 0.16, 0.46, M.stoneDark, 7.62, 0.42, z, { castShadow: true });
  addBox(canopyGroup, 0.5, 0.055, 0.5, M.snowSolid, 7.62, 0.53, z, { castShadow: false });
  addBox(canopyGroup, 0.5, 0.11, 2.7, M.woodDark, 7.62, 3.67, (z + 2.78) / 2, { castShadow: false });
}
addBox(canopyGroup, 0.17, 0.17, 5.0, M.woodMid, 7.62, 3.58, 2.78, { castShadow: true });
addBox(canopyGroup, 0.18, 3.15, 0.18, M.woodDark, 2.72, 1.84, 5.28, { castShadow: true });

// A short cloth banner hanging from the canopy, echoing the noren.
{
  const tex = makeCanvasTexture(512, 768, (ctx, w, h) => {
    ctx.fillStyle = '#1d3054';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.02 + random() * 0.05})`;
      ctx.beginPath();
      ctx.moveTo(random() * w, 0);
      ctx.lineTo(random() * w, h);
      ctx.stroke();
    }
    ctx.fillStyle = '#eadfca';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 110px "Hiragino Mincho ProN","Yu Mincho",serif';
    ctx.fillText('焼', w / 2, h * 0.28);
    ctx.fillText('鳥', w / 2, h * 0.5);
    ctx.strokeStyle = 'rgba(234,223,202,.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.72, 45, 0, TAU);
    ctx.stroke();
    addGrain(ctx, w, h, 0.03, 300, 0.08);
  });
  const g = new THREE.Group();
  g.position.set(7.39, 3.42, 1.1);
  canopyGroup.add(g);
  addCylinder(g, 0.025, 0.025, 0.8, M.woodDark, 0, 0, 0, { rotation: [0, 0, Math.PI / 2], segments: 5, castShadow: false });
  const mat = toon(0xffffff, { map: tex, side: THREE.DoubleSide, outlineWidth: 0.001 });
  addMesh(new THREE.PlaneGeometry(0.7, 1.05), mat, g, 0, -0.55, 0.02, { castShadow: false, receiveShadow: false });
  addBox(g, 0.8, 0.045, 0.09, M.snowSolid, 0, 0.04, 0.02, { castShadow: false });
}

// Warm string lights under the canopy.
const stringLightGroup = new THREE.Group();
canopyGroup.add(stringLightGroup);
{
  const points = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    points.push(new THREE.Vector3(2.9 + t * 4.55, 3.26 + Math.sin(t * Math.PI) * -0.18, 4.58));
  }
  addTube(stringLightGroup, points, 0.011, M.black, { segments: 30, radialSegments: 4, castShadow: false });
  for (let i = 2; i < 18; i += 3) {
    const p = points[i];
    const bulbMat = basic(0xffc06c);
    bulbMat.userData.outlineParameters = { visible: false, keepAlive: true };
    bulbMat.color.copy(windowGlowStart);
    warmBasicMaterials.push(bulbMat);
    const b = addSphere(stringLightGroup, 0.052, bulbMat, p.x, p.y - 0.08, p.z, { castShadow: false, widthSegments: 8, heightSegments: 6 });
    addGlow(stringLightGroup, 0xffbc6e, 0.5, 0.28, p.x, p.y - 0.08, p.z);
  }
}

registerAssembly(stringLightGroup, 4.9, { drop: 1.2, scaleFrom: 0.98, duration: 0.8, group: 'dressing' });

/* --------------------------- patio furnishings -------------------------- */

const patioProps = new THREE.Group();
canopyGroup.add(patioProps);
registerAssembly(patioProps, 5.12, { drop: 1.55, scaleFrom: 0.9, duration: 0.9, group: 'furniture' });

// Long table
addBox(patioProps, 1.9, 0.13, 0.9, M.woodLight, 5.3, 1.02, 2.6, { castShadow: true });
addBox(patioProps, 1.75, 0.07, 0.78, M.woodMid, 5.3, 0.92, 2.6, { castShadow: false });
for (const [x, z] of [[4.45, 2.22], [6.15, 2.22], [4.45, 2.98], [6.15, 2.98]]) {
  addBox(patioProps, 0.1, 0.86, 0.1, M.woodDark, x, 0.55, z, { castShadow: true });
}
// Two stools
for (const [x, z, rot] of [[4.4, 3.45, 0.1], [6.2, 3.42, -0.15]]) {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  s.rotation.y = rot;
  patioProps.add(s);
  addCylinder(s, 0.3, 0.32, 0.13, M.woodMid, 0, 0.7, 0, { castShadow: true, segments: 14 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    addCylinder(s, 0.04, 0.05, 0.6, M.woodDark, Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2, { castShadow: true, segments: 5 });
  }
  addCylinder(s, 0.3, 0.3, 0.035, M.snowSolid, 0, 0.78, 0, { castShadow: false, segments: 14 });
}
// A little sake set on the table.
addCylinder(patioProps, 0.075, 0.09, 0.32, toon(0x3f5a4a, { showOutline: false }), 5.0, 1.24, 2.6, { castShadow: false, segments: 8 });
addCylinder(patioProps, 0.04, 0.04, 0.1, toon(0x3f5a4a, { showOutline: false }), 5.0, 1.45, 2.6, { castShadow: false, segments: 6 });
for (const [x, z] of [[5.35, 2.52], [5.7, 2.7]]) {
  addCylinder(patioProps, 0.055, 0.045, 0.075, M.paper, x, 1.115, z, { castShadow: false, segments: 10 });
}
addBox(patioProps, 0.45, 0.05, 0.3, M.paper, 6.0, 1.115, 2.53, { castShadow: false });
// Cushions on a side bench.
addBox(patioProps, 1.3, 0.14, 0.5, M.woodDark, 3.55, 0.53, 4.5, { castShadow: true });
for (let i = 0; i < 2; i++) {
  addBox(patioProps, 0.5, 0.09, 0.42, M.redFabric, 3.2 + i * 0.58, 0.68, 4.5, { castShadow: false, rounded: 0.08 });
}
addBox(patioProps, 1.34, 0.055, 0.52, M.snowSolid, 3.55, 0.76, 4.5, { castShadow: false });

// Charcoal brazier with warm coals.
const brazierGroup = new THREE.Group();
canopyGroup.add(brazierGroup);
brazierGroup.position.set(6.55, 0.45, 4.35);
registerAssembly(brazierGroup, 5.55, { drop: 1.35, scaleFrom: 0.85, duration: 0.85, group: 'furniture' });

addCylinder(brazierGroup, 0.44, 0.5, 0.22, M.charcoal, 0, 0.12, 0, { castShadow: true, segments: 16 });
addCylinder(brazierGroup, 0.5, 0.42, 0.3, M.stoneDark, 0, 0.38, 0, { castShadow: true, segments: 16 });
addCylinder(brazierGroup, 0.42, 0.42, 0.06, M.charcoal, 0, 0.55, 0, { castShadow: false, segments: 16 });
for (let i = 0; i < 7; i++) {
  const a = (i / 7) * TAU + rng(-0.18, 0.18);
  const r = rng(0.08, 0.3);
  addSphere(brazierGroup, rng(0.06, 0.12), M.ember, Math.cos(a) * r, 0.6, Math.sin(a) * r, { castShadow: false, widthSegments: 7, heightSegments: 5, scale: [1, 0.55, 1] });
}
for (let i = 0; i < 4; i++) {
  addCylinder(brazierGroup, 0.018, 0.018, 0.82, M.darkMetal, -0.28 + i * 0.19, 0.68, 0, { rotation: [0, 0, Math.PI / 2], castShadow: false, segments: 4 });
  addCylinder(brazierGroup, 0.018, 0.018, 0.82, M.darkMetal, 0, 0.68, -0.28 + i * 0.19, { rotation: [Math.PI / 2, 0, 0], castShadow: false, segments: 4 });
}
for (let i = 0; i < 3; i++) {
  const a = (i / 3) * TAU;
  addCylinder(brazierGroup, 0.035, 0.04, 0.3, M.darkMetal, Math.cos(a) * 0.38, 0.15, Math.sin(a) * 0.38, { castShadow: false, segments: 4 });
}
const brazierGlow = addGlow(brazierGroup, 0xff7b34, 1.25, 0.34, 0, 0.65, 0);
const brazierLight = new THREE.PointLight(0xff7a2c, 0, 4.5, 2);
brazierLight.position.set(0, 0.85, 0);
brazierGroup.add(brazierLight);
warmLights.push({ light: brazierLight, target: 8.5 });
addBox(brazierGroup, 0.9, 0.035, 0.32, M.snowSolid, 0, 0.62, 0.42, { castShadow: false });

// Small snow-dusted firewood stack.
for (let i = 0; i < 6; i++) {
  addCylinder(patioProps, 0.09, 0.1, 0.65, M.bark, 7.2 + (i % 3) * 0.11, 0.54 + Math.floor(i / 3) * 0.17, 4.95, { rotation: [Math.PI / 2, 0, 0], castShadow: true, segments: 6 });
}
addBox(patioProps, 0.48, 0.05, 0.72, M.snowSolid, 7.32, 0.78, 4.95, { castShadow: false });

/* ------------------------------- stone lantern -------------------------- */

const stoneLanternGroup = new THREE.Group();
world.add(stoneLanternGroup);
stoneLanternGroup.position.set(-9.3, 0, -1.15);
registerAssembly(stoneLanternGroup, 5.72, { drop: 2.0, scaleFrom: 0.92, duration: 0.95, group: 'street' });

addBox(stoneLanternGroup, 1.05, 0.22, 1.05, M.stoneDark, 0, 0.35, 0, { castShadow: true });
addBox(stoneLanternGroup, 0.85, 0.18, 0.85, M.stone, 0, 0.51, 0, { castShadow: true });
addCylinder(stoneLanternGroup, 0.16, 0.22, 0.95, M.stone, 0, 1.04, 0, { castShadow: true, segments: 8 });
addBox(stoneLanternGroup, 0.7, 0.14, 0.7, M.stone, 0, 1.55, 0, { castShadow: true });
// Firebox with four pillars and a warm core.
const fireBox = new THREE.Group();
fireBox.position.y = 1.93;
stoneLanternGroup.add(fireBox);
const coreMat = basic(0xffc889);
coreMat.userData.outlineParameters = { visible: false, keepAlive: true };
coreMat.color.copy(windowGlowStart);
warmBasicMaterials.push(coreMat);
addBox(fireBox, 0.46, 0.5, 0.46, coreMat, 0, 0, 0, { castShadow: false, receiveShadow: false });
for (const [x, z] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) {
  addBox(fireBox, 0.12, 0.6, 0.12, M.stone, x, 0, z, { castShadow: true });
}
addBox(fireBox, 0.66, 0.1, 0.66, M.stone, 0, 0.35, 0, { castShadow: true });
// Pyramidal roof and snow.
addMesh(new THREE.ConeGeometry(0.63, 0.45, 4), M.stone, stoneLanternGroup, 0, 2.36, 0, { rotation: [0, Math.PI / 4, 0], castShadow: true });
addMesh(new THREE.ConeGeometry(0.61, 0.18, 4), M.snowSolid, stoneLanternGroup, 0, 2.48, 0, { rotation: [0, Math.PI / 4, 0], castShadow: false });
addSphere(stoneLanternGroup, 0.12, M.stone, 0, 2.68, 0, { castShadow: true, widthSegments: 8, heightSegments: 6 });
addCylinder(stoneLanternGroup, 0.025, 0.025, 0.18, M.stone, 0, 2.82, 0, { castShadow: false, segments: 6 });
addSnowMound(stoneLanternGroup, 0, 0.02, 0.82, 0.12, 1.15, 0.9, 0);
addGlow(stoneLanternGroup, 0xffb05c, 2.0, 0.26, 0, 1.95, 0.27);
const stoneLight = new THREE.PointLight(0xffa75b, 0, 5.4, 2);
stoneLight.position.set(0, 1.95, 0.25);
stoneLanternGroup.add(stoneLight);
warmLights.push({ light: stoneLight, target: 6.5 });

/* ------------------------------ utility pole ---------------------------- */

const poleGroup = new THREE.Group();
world.add(poleGroup);
poleGroup.position.set(-9.55, 0, 4.15);
registerAssembly(poleGroup, 5.96, { drop: 3.0, scaleFrom: 0.95, duration: 1.0, group: 'street' });

addCylinder(poleGroup, 0.105, 0.17, 7.2, M.bark, 0, 3.8, 0, { castShadow: true, segments: 9 });
addBox(poleGroup, 0.65, 0.22, 0.65, M.stoneDark, 0, 0.28, 0, { castShadow: true });
addCylinder(poleGroup, 0.15, 0.16, 0.25, M.stone, 0, 0.51, 0, { castShadow: true, segments: 8 });
addCylinder(poleGroup, 0.18, 0.18, 0.055, M.snowSolid, 0, 7.42, 0, { castShadow: false, segments: 9 });
// Crossarms and insulators.
for (const [y, w] of [[6.7, 2.1], [6.1, 1.45]]) {
  addBox(poleGroup, w, 0.12, 0.15, M.woodDark, 0, y, 0, { castShadow: true });
  addBox(poleGroup, w * 0.92, 0.05, 0.17, M.snowSolid, 0, y + 0.085, 0, { castShadow: false });
  for (let i = 0; i < 3; i++) {
    addCylinder(poleGroup, 0.045, 0.055, 0.17, M.paper, -w * 0.37 + i * w * 0.37, y + 0.14, 0, { castShadow: false, segments: 7 });
  }
}
// Curved lamp arm and enamel shade.
{
  const pts = [
    new THREE.Vector3(0, 5.18, 0),
    new THREE.Vector3(0.35, 5.1, 0.1),
    new THREE.Vector3(0.72, 4.94, 0.16),
    new THREE.Vector3(0.87, 4.72, 0.18),
  ];
  addTube(poleGroup, pts, 0.045, M.darkMetal, { segments: 16, radialSegments: 5 });
  addMesh(new THREE.ConeGeometry(0.34, 0.34, 16, 1, true), M.darkMetal, poleGroup, 0.88, 4.54, 0.18, { castShadow: false });
  addCylinder(poleGroup, 0.08, 0.08, 0.08, M.gold, 0.88, 4.75, 0.18, { castShadow: false, segments: 8 });
  const bulb = addSphere(poleGroup, 0.14, basic(0xffd18a), 0.88, 4.4, 0.18, { castShadow: false, widthSegments: 12, heightSegments: 8 });
  bulb.material.userData.outlineParameters = { visible: false, keepAlive: true };
  bulb.material.color.copy(windowGlowStart);
  warmBasicMaterials.push(bulb.material);
  addGlow(poleGroup, 0xffc57d, 2.3, 0.32, 0.88, 4.38, 0.18);
  const lampLight = new THREE.PointLight(0xffbd72, 0, 8.0, 2);
  lampLight.position.set(0.88, 4.4, 0.3);
  poleGroup.add(lampLight);
  warmLights.push({ light: lampLight, target: 18 });
  addBox(poleGroup, 0.62, 0.045, 0.5, M.snowSolid, 0.88, 4.74, 0.18, { castShadow: false, rotation: [0.04, 0, 0.06] });
}
// Sagging service wires toward the roof.
{
  const wireGroup = new THREE.Group();
  world.add(wireGroup);
  registerAssembly(wireGroup, 6.02, { drop: 0.9, scaleFrom: 0.99, duration: 0.7, group: 'street' });
  const p1 = new THREE.Vector3(-9.55, 6.78, 4.15);
  const p2 = new THREE.Vector3(LEFT + 0.3, 6.75, FRONT - 1.1);
  for (let k = 0; k < 2; k++) {
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.y -= 0.45 + k * 0.17;
    mid.z += k * 0.35;
    addTube(wireGroup, [p1.clone().add(new THREE.Vector3(0, k * 0.13, k * 0.12)), mid, p2.clone().add(new THREE.Vector3(0, k * 0.12, k * 0.1))], 0.012, M.black, { segments: 24, radialSegments: 3, castShadow: false });
  }
}
// Snow heaped at the foot.
addSnowMound(poleGroup, 0.1, 0.15, 0.67, 0.13, 1.15, 0.9, 0);

/* --------------------------------- pine --------------------------------- */

const pineGroup = new THREE.Group();
pineGroup.position.set(8.15, 0, -5.56);
world.add(pineGroup);
registerAssembly(pineGroup, 6.22, { drop: 2.4, scaleFrom: 0.93, duration: 1.05, group: 'landscape' });

function addPineCluster(parent, x, y, z, size, rotation = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotation;
  parent.add(g);
  // Layered needle pads, slightly offset so the silhouette is never a flat disc.
  const lobes = [
    [0, 0, 0, 1.0, 0.38, 0.9, M.pine],
    [size * 0.52, size * 0.06, size * 0.2, 0.62, 0.3, 0.62, M.pineDeep],
    [-size * 0.48, -size * 0.03, -size * 0.16, 0.58, 0.28, 0.54, M.pine],
  ];
  for (const [x2, y2, z2, sx, sy, sz, mat] of lobes) {
    addMesh(new THREE.IcosahedronGeometry(size, 1), mat, g, x2, y2, z2, {
      scale: [sx * 1.28, sy, sz * 1.12],
      rotation: [0, rng(-0.4, 0.4), rng(-0.06, 0.06)],
      castShadow: true,
    });
  }
  // Two overlapping snow caps leave little green windows visible at the edges.
  addMesh(driftGeometry, M.snowDrift, g, size * 0.06, size * 0.22, 0, {
    scale: [size * 1.12, size * 0.16, size * 0.82],
    rotation: [0, rng(0, TAU), 0.03],
    castShadow: false,
  });
  addMesh(driftGeometry, M.snowDrift, g, -size * 0.5, size * 0.17, size * 0.17, {
    scale: [size * 0.5, size * 0.12, size * 0.44],
    rotation: [0, rng(0, TAU), 0],
    castShadow: false,
  });
  addMesh(driftGeometry, M.snowDrift, g, size * 0.53, size * 0.18, -size * 0.16, {
    scale: [size * 0.43, size * 0.1, size * 0.4],
    rotation: [0, rng(0, TAU), 0],
    castShadow: false,
  });
  return g;
}

{
  const trunkPts = [
    new THREE.Vector3(0, 0.1, 0),
    new THREE.Vector3(-0.18, 1.4, 0.12),
    new THREE.Vector3(0.08, 2.7, -0.06),
    new THREE.Vector3(-0.24, 4.0, 0.08),
    new THREE.Vector3(-0.08, 4.9, 0),
  ];
  for (let i = 0; i < trunkPts.length - 1; i++) {
    addCylinderBetween(pineGroup, trunkPts[i], trunkPts[i + 1], 0.14 - i * 0.02, M.bark, { segments: 7, radiusTop: 0.11 - i * 0.017 });
  }
  const branches = [
    { from: 1.2, end: [-1.7, 2.0, 0.5], size: 0.95, rot: 0.2 },
    { from: 1.55, end: [1.6, 2.55, -0.4], size: 1.0, rot: -0.4 },
    { from: 2.35, end: [-1.4, 3.25, -0.8], size: 0.85, rot: 1.1 },
    { from: 2.7, end: [1.35, 3.65, 0.6], size: 0.82, rot: -1.2 },
    { from: 3.35, end: [-0.9, 4.3, 0.8], size: 0.72, rot: 0.5 },
    { from: 3.85, end: [0.8, 4.7, -0.6], size: 0.75, rot: -0.6 },
    { from: 4.55, end: [-0.2, 5.2, 0.2], size: 0.56, rot: 0 },
  ];
  for (const b of branches) {
    const start = new THREE.Vector3(-0.13, b.from, 0);
    const end = new THREE.Vector3(...b.end);
    const mid = start.clone().lerp(end, 0.55);
    mid.y += 0.3;
    addTube(pineGroup, [start, mid, end], 0.055, M.bark, { segments: 10, radialSegments: 5 });
    addPineCluster(pineGroup, end.x, end.y, end.z, b.size, b.rot);
  }
  addPineCluster(pineGroup, -0.1, 5.15, 0, 0.7, 0.2);
  addSnowMound(pineGroup, 0, 0.1, 1.2, 0.2, 1.15, 0.9, 0.3);
  // Stones around the roots.
  for (let i = 0; i < 4; i++) {
    const s = addMesh(new THREE.IcosahedronGeometry(rng(0.28, 0.5), 0), M.stoneDark, pineGroup, rng(-1.2, 1.2), 0.25, rng(-0.8, 0.8), { castShadow: true, scale: [1.2, 0.55, 0.9], rotation: [0, rng(0, TAU), 0] });
    addSnowMound(pineGroup, s.position.x, s.position.z, 0.32, 0.08, 1.1, 0.8, 0);
  }
}

// Small snow-covered rocks near the patio and lantern (separate, low key).
const looseRockGroup = new THREE.Group();
world.add(looseRockGroup);
registerAssembly(looseRockGroup, 6.46, { drop: 1.2, scaleFrom: 0.9, duration: 0.8, group: 'landscape' });
for (const [x, z, r] of [[8.8, 7.6, 0.55], [8.2, 8.2, 0.32], [-9.9, -6.2, 0.5], [-6.5, -8.7, 0.6]]) {
  addMesh(new THREE.IcosahedronGeometry(r, 0), M.stoneDark, looseRockGroup, x, 0.22, z, { castShadow: true, scale: [1.5, 0.55, 0.9], rotation: [0, rng(0, TAU), 0] });
  addSnowMound(looseRockGroup, x, z, r * 1.05, r * 0.2, 1.2, 0.85, 0);
}

/* ------------------------------ bare shrubs ----------------------------- */

const shrubGroup = new THREE.Group();
world.add(shrubGroup);
registerAssembly(shrubGroup, 6.58, { drop: 1.8, scaleFrom: 0.92, duration: 0.9, group: 'landscape' });

function addBareShrub(parent, x, z, scale = 1, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  parent.add(g);
  const base = new THREE.Vector3(0, 0.1, 0);
  const branchEnds = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + seed;
    const len = rng(0.55, 1.25);
    const mid = new THREE.Vector3(Math.cos(a) * len * 0.3, 0.62 + random() * 0.55, Math.sin(a) * len * 0.3);
    const end = new THREE.Vector3(Math.cos(a) * len, 1.15 + random() * 0.65, Math.sin(a) * len);
    addTube(g, [base, mid, end], 0.025, M.bark, { segments: 8, radialSegments: 4, castShadow: false });
    branchEnds.push(end);
    for (let j = 0; j < 2; j++) {
      const a2 = a + rng(-0.55, 0.55);
      const e2 = end.clone().add(new THREE.Vector3(Math.cos(a2) * 0.32, 0.28 + random() * 0.25, Math.sin(a2) * 0.32));
      addTube(g, [end, e2], 0.013, M.bark, { segments: 5, radialSegments: 3, castShadow: false });
      branchEnds.push(e2);
    }
  }
  for (let i = 0; i < 10; i++) {
    const end = branchEnds[Math.floor(random() * branchEnds.length)];
    addSnowMound(g, end.x + rng(-0.08, 0.08), end.z, rng(0.06, 0.14), rng(0.025, 0.06), 1.1, 0.75, rng(0, TAU));
  }
  addSnowMound(g, 0, 0, 0.55, 0.1, 1.2, 0.9, rng(0, TAU));
}
addBareShrub(shrubGroup, -9.05, -6.55, 1.15, 0.6);
addBareShrub(shrubGroup, -6.45, -7.9, 0.95, 2.2);
addBareShrub(shrubGroup, 3.9, -8.8, 0.85, 4.0);
addBareShrub(shrubGroup, 9.3, 8.25, 0.72, 5.4);

/* -------------------------------- sake props ---------------------------- */

const propsGroup = new THREE.Group();
world.add(propsGroup);
registerAssembly(propsGroup, 6.88, { drop: 1.85, scaleFrom: 0.9, duration: 0.95, group: 'props' });

function makeSakeLabel(text, width = 256, height = 384) {
  return makeCanvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = '#e8dec5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(78,48,27,.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#3c2818';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 70px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], w / 2, h * 0.3 + i * 78);
    }
    ctx.strokeStyle = '#a24735';
    ctx.lineWidth = 7;
    ctx.strokeRect(w * 0.27, h * 0.72, w * 0.46, h * 0.12);
    ctx.fillStyle = '#a24735';
    ctx.font = '500 27px "Hiragino Kaku Gothic ProN",sans-serif';
    ctx.fillText('純 米 酒', w / 2, h * 0.79);
    addGrain(ctx, w, h, 0.03, 300, 0.08);
  });
}

function makeStrawBarrel(x, z, scale = 1, rotation = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0.32, z);
  g.rotation.y = rotation;
  g.scale.setScalar(scale);
  propsGroup.add(g);
  const bodyY = 0.48;
  const barrel = addCylinder(g, 0.41, 0.43, 0.92, M.straw, 0, bodyY, 0, { castShadow: true, segments: 16 });
  // straw banding
  for (let i = 0; i < 4; i++) {
    addCylinder(g, 0.43, 0.43, 0.07, toon(0x7f6238, { showOutline: false }), 0, 0.18 + i * 0.24, 0, { castShadow: false, segments: 16 });
  }
  addCylinder(g, 0.35, 0.35, 0.035, M.woodDark, 0, 0.95, 0, { castShadow: false, segments: 16 });
  addCylinder(g, 0.1, 0.1, 0.06, M.woodMid, 0, 0.98, 0, { castShadow: false, segments: 8 });
  // paper label on the front
  const label = makeSakeLabel('清酒');
  const mat = toon(0xffffff, { map: label, showOutline: false });
  addMesh(new THREE.PlaneGeometry(0.36, 0.55), mat, g, 0, 0.5, 0.425, { castShadow: false, receiveShadow: false });
  addBox(g, 0.7, 0.05, 0.12, M.snowSolid, 0, 1.0, 0.15, { castShadow: false, rotation: [0, 0.1, 0.04] });
  return g;
}
makeStrawBarrel(-4.75, 2.45, 1.0, -0.25);
makeStrawBarrel(-3.94, 2.64, 0.82, 0.35);
makeStrawBarrel(-5.15, 3.22, 0.7, -0.7);

// Wooden bucket and ladle.
addCylinder(propsGroup, 0.28, 0.24, 0.45, M.woodDark, -5.45, 0.57, 3.85, { castShadow: true, segments: 12 });
for (let i = 0; i < 3; i++) {
  const a = (i / 3) * TAU;
  addCylinder(propsGroup, 0.012, 0.012, 0.38, M.gold, -5.45 + Math.cos(a) * 0.27, 0.68, 3.85 + Math.sin(a) * 0.27, { castShadow: false, segments: 4 });
}
addCylinder(propsGroup, 0.255, 0.255, 0.05, M.snowSolid, -5.45, 0.78, 3.85, { castShadow: false, segments: 12 });

// A-frame handwritten menu board.
{
  const menuTex = makeCanvasTexture(480, 760, (ctx, w, h) => {
    ctx.fillStyle = '#e9dfc6';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(102,70,38,.12)';
    for (let i = 0; i < 18; i++) ctx.fillRect(0, random() * h, w, 1 + random() * 3);
    ctx.strokeStyle = 'rgba(92,61,34,.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3d2b1b';
    ctx.font = '600 57px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    ctx.fillText('本 日 の お す す め', w / 2, 100);
    ctx.strokeStyle = 'rgba(62,42,25,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 128);
    ctx.lineTo(w - 70, 128);
    ctx.stroke();
    const items = [
      ['焼き鳥', '¥ 180'],
      ['おでん', '¥ 450'],
      ['生ビール', '¥ 500'],
      ['熱燗', '¥ 400'],
      ['枝豆', '¥ 280'],
    ];
    ctx.font = '500 40px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    for (let i = 0; i < items.length; i++) {
      const y = 202 + i * 91;
      ctx.textAlign = 'left';
      ctx.fillText(items[i][0], 54, y);
      ctx.textAlign = 'right';
      ctx.fillText(items[i][1], w - 54, y);
      ctx.strokeStyle = 'rgba(62,42,25,.17)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(52, y + 31);
      ctx.lineTo(w - 52, y + 31);
      ctx.stroke();
    }
    ctx.fillStyle = '#a34332';
    ctx.beginPath();
    ctx.arc(w - 90, h - 87, 44, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e9dfc6';
    ctx.textAlign = 'center';
    ctx.font = '600 30px "Hiragino Mincho ProN",serif';
    ctx.fillText('雪', w - 90, h - 87);
    addGrain(ctx, w, h, 0.03, 400, 0.09);
  });
  const boardGroup = new THREE.Group();
  boardGroup.position.set(-2.95, 0.3, 3.78);
  boardGroup.rotation.y = -0.18;
  propsGroup.add(boardGroup);
  const front = new THREE.Group();
  front.rotation.x = -0.12;
  boardGroup.add(front);
  addBox(front, 0.84, 1.34, 0.08, M.woodDark, 0, 0.72, 0, { castShadow: true });
  const mat = toon(0xffffff, { map: menuTex, showOutline: false });
  addMesh(new THREE.PlaneGeometry(0.68, 1.16), mat, front, 0, 0.74, 0.045, { castShadow: false, receiveShadow: false });
  const back = new THREE.Group();
  back.rotation.x = Math.PI + 0.12;
  boardGroup.add(back);
  addBox(back, 0.84, 1.34, 0.06, M.woodDark, 0, 0.72, 0, { castShadow: false });
  // little snow cap
  addBox(boardGroup, 0.88, 0.055, 0.18, M.snowSolid, 0, 1.39, 0.01, { castShadow: false });
  addCylinder(boardGroup, 0.025, 0.025, 1.25, M.woodDark, -0.39, 0.73, 0.14, { rotation: [1.28, 0, 0], castShadow: false, segments: 5 });
  addCylinder(boardGroup, 0.025, 0.025, 1.25, M.woodDark, 0.39, 0.73, 0.14, { rotation: [1.28, 0, 0], castShadow: false, segments: 5 });
}

// Slatted crates near the patio.
function addCrate(x, z, rot, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0.3, z);
  g.rotation.y = rot;
  g.scale.setScalar(scale);
  propsGroup.add(g);
  for (let i = 0; i < 4; i++) {
    addBox(g, 0.68, 0.09, 0.5, M.woodMid, 0, 0.1 + i * 0.17, 0, { castShadow: true });
  }
  for (const x2 of [-0.3, 0.3]) {
    addBox(g, 0.07, 0.62, 0.5, M.woodDark, x2, 0.35, 0, { castShadow: true });
  }
  addBox(g, 0.74, 0.045, 0.56, M.snowSolid, 0, 0.7, 0, { castShadow: false });
}
addCrate(7.75, 1.4, 0.15, 1.0);
addCrate(7.42, 1.15, -0.2, 0.8);

// A tiny ceramic jug and folded cloth at the doorway.
addSphere(propsGroup, 0.18, M.stone, -2.35, 0.62, 2.35, { castShadow: true, scale: [1, 1.1, 0.8], widthSegments: 10, heightSegments: 8 });
addCylinder(propsGroup, 0.06, 0.08, 0.16, M.stone, -2.35, 0.82, 2.35, { castShadow: false, segments: 8 });
addCylinder(propsGroup, 0.18, 0.2, 0.03, M.snowSolid, -2.35, 0.83, 2.35, { castShadow: false, segments: 10 });

/* ------------------------------- motorcycle ----------------------------- */

const bikeGroup = new THREE.Group();
world.add(bikeGroup);
bikeGroup.position.set(-7.25, 0.31, 6.35);
bikeGroup.rotation.y = -0.72;
registerAssembly(bikeGroup, 7.16, { drop: 1.8, scaleFrom: 0.9, duration: 1.0, group: 'props' });

{
  const bike = new THREE.Group();
  bike.rotation.z = -0.07;
  bikeGroup.add(bike);
  // Wheels
  for (const z of [-0.72, 0.72]) {
    const tire = addMesh(new THREE.TorusGeometry(0.35, 0.11, 10, 24), M.black, bike, 0, 0.35, z, { rotation: [0, Math.PI / 2, 0], castShadow: true });
    addCylinder(bike, 0.2, 0.2, 0.08, M.chrome, 0, 0.35, z, { rotation: [Math.PI / 2, 0, 0], castShadow: false, segments: 14 });
    for (let i = 0; i < 6; i++) {
      addCylinder(bike, 0.012, 0.012, 0.34, M.chrome, 0, 0.35 + Math.cos((i / 6) * TAU) * 0.24, z + Math.sin((i / 6) * TAU) * 0.24, { rotation: [Math.PI / 2, 0, (i / 6) * TAU], castShadow: false, segments: 4 });
    }
    // fenders
    addMesh(new THREE.TorusGeometry(0.44, 0.055, 7, 16, Math.PI), M.cream, bike, 0, 0.43, z, { rotation: [0, Math.PI / 2, 0], castShadow: true });
  }
  // Body
  addMesh(new THREE.SphereGeometry(0.46, 18, 12), M.cream, bike, 0, 0.8, -0.2, { scale: [0.9, 1.0, 1.35], castShadow: true });
  addMesh(new THREE.SphereGeometry(0.38, 16, 10), M.cream, bike, 0, 0.67, 0.25, { scale: [0.83, 0.8, 1.0], castShadow: true });
  // front shield / leg guard
  addBox(bike, 0.62, 0.82, 0.12, M.cream, 0, 0.92, 0.55, { rounded: 0.18, rotation: [-0.14, 0, 0], castShadow: true });
  addBox(bike, 0.55, 0.4, 0.36, M.cream, 0, 0.55, 0.38, { rounded: 0.13, castShadow: true });
  // seat
  addBox(bike, 0.45, 0.15, 0.78, M.bark, 0, 1.24, -0.28, { rounded: 0.12, rotation: [0.04, 0, 0], castShadow: true });
  addBox(bike, 0.42, 0.09, 0.65, M.black, 0, 1.16, -0.31, { rounded: 0.05, castShadow: false });
  // handlebars, headlight, mirror
  addCylinder(bike, 0.03, 0.03, 0.82, M.chrome, 0, 1.28, 0.57, { rotation: [0, 0, Math.PI / 2], castShadow: false, segments: 5 });
  for (const x of [-0.4, 0.4]) {
    addCylinder(bike, 0.035, 0.035, 0.15, M.black, x, 1.28, 0.57, { rotation: [0, 0, Math.PI / 2], castShadow: false, segments: 5 });
    addCylinder(bike, 0.02, 0.02, 0.32, M.chrome, x, 1.43, 0.57, { castShadow: false, segments: 4 });
    addMesh(new THREE.CircleGeometry(0.09, 10), M.chrome, bike, x, 1.6, 0.57, { rotation: [0, 0, 0], castShadow: false });
  }
  addSphere(bike, 0.14, basic(0xffd394), 0, 1.04, 0.7, { castShadow: false, widthSegments: 12, heightSegments: 8 });
  addCylinder(bike, 0.17, 0.14, 0.2, M.chrome, 0, 1.05, 0.66, { rotation: [Math.PI / 2, 0, 0], castShadow: false, segments: 12, openEnded: true });
  // exhaust & stand
  addCylinder(bike, 0.075, 0.09, 0.7, M.chrome, 0.26, 0.42, -0.1, { rotation: [Math.PI / 2, 0, 0], castShadow: false, segments: 8 });
  addCylinder(bike, 0.025, 0.025, 0.55, M.darkMetal, -0.2, 0.24, -0.36, { rotation: [0.2, 0, -0.3], castShadow: false, segments: 4 });
  // snow on seat and shield
  addBox(bike, 0.4, 0.055, 0.7, M.snowSolid, 0, 1.34, -0.28, { rounded: 0.12, rotation: [0.04, 0, 0], castShadow: false });
  addBox(bike, 0.6, 0.045, 0.18, M.snowSolid, 0, 1.34, 0.55, { rotation: [-0.14, 0, 0], castShadow: false });
  // A small pool of warm light from the headlight.
  addLightPool(world, 0xffc982, -7.25, 7.8, 1.8, 2.4, 0.12, snowGroundY + 0.035);
}

// Snow heaped around the parked bike.
addSnowMound(snowGroup, -7.15, 6.35, 1.05, 0.14, 1.2, 0.75, 0.2);
addSnowMound(snowGroup, -8.2, 6.9, 0.7, 0.1, 1.05, 0.8, 0.2);

/* -------------------------------- bench --------------------------------- */

const benchGroup = new THREE.Group();
benchGroup.position.set(8.05, 0, 7.28);
benchGroup.rotation.y = -0.42;
world.add(benchGroup);
registerAssembly(benchGroup, 7.02, { drop: 1.45, scaleFrom: 0.93, duration: 0.9, group: 'props' });

addBox(benchGroup, 1.95, 0.14, 0.6, M.woodLight, 0, 0.76, 0, { castShadow: true, rounded: 0.05 });
addBox(benchGroup, 1.8, 0.07, 0.48, M.woodMid, 0, 0.66, 0, { castShadow: false });
for (const x of [-0.72, 0.72]) {
  addBox(benchGroup, 0.13, 0.7, 0.46, M.woodDark, x, 0.36, 0, { castShadow: true });
  addBox(benchGroup, 0.1, 0.66, 0.1, M.woodDark, x, 1.08, -0.28, { rotation: [-0.13, 0, 0], castShadow: false });
}
for (let i = 0; i < 3; i++) {
  addBox(benchGroup, 1.9, 0.12, 0.07, M.woodMid, 0, 0.95 + i * 0.24, -0.31, { rotation: [-0.13, 0, 0], castShadow: false });
}
addBox(benchGroup, 2.0, 0.065, 0.64, M.snowSolid, 0, 0.86, 0.02, { castShadow: false });
addBox(benchGroup, 1.9, 0.045, 0.1, M.snowSolid, 0, 1.56, -0.36, { rotation: [-0.13, 0, 0], castShadow: false });
for (let i = 0; i < 2; i++) {
  addBox(benchGroup, 0.36, 0.07, 0.42, M.snowSolid, -0.66 + i * 0.55, 0.93, 0.17, { castShadow: false, rotation: [0, rng(-0.2, 0.2), 0] });
}
addSnowMound(benchGroup, -0.08, 0.72, 0.6, 0.08, 1.3, 0.6, 0.4);

/* ----------------------------- warm light pools ------------------------- */

addLightPool(snowGroup, 0xffa65b, -1.2, 3.0, 5.6, 3.5, 0.27);
addLightPool(snowGroup, 0xffb363, 5.15, 3.7, 4.6, 3.8, 0.19);
addLightPool(snowGroup, 0xffbb78, -8.45, 4.15, 3.4, 3.1, 0.18);
addLightPool(snowGroup, 0xffab63, -9.1, -0.65, 2.4, 2.2, 0.12);
addLightPool(snowGroup, 0xff8a45, 6.55, 4.55, 1.4, 1.4, 0.14);
addLightPool(snowGroup, 0xff9955, -4.22, 2.95, 2.15, 1.9, 0.16);
addLightPool(snowGroup, 0xff9955, 1.58, 2.95, 2.15, 1.9, 0.16);

/* ================================ ATMOSPHERE ============================ */

const moon = new THREE.DirectionalLight(0xa8c8ff, 2.7);
moon.position.set(-12, 19, 11);
moon.target.position.set(0, 1.8, 0);
moon.castShadow = true;
moon.shadow.mapSize.set(compactDevice ? 1024 : 2048, compactDevice ? 1024 : 2048);
moon.shadow.camera.left = -17;
moon.shadow.camera.right = 17;
moon.shadow.camera.top = 17;
moon.shadow.camera.bottom = -17;
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 50;
moon.shadow.bias = -0.0005;
moon.shadow.normalBias = 0.035;
scene.add(moon);
scene.add(moon.target);

const hemi = new THREE.HemisphereLight(0x8cb9f2, 0x111827, 1.15);
scene.add(hemi);

const fill = new THREE.DirectionalLight(0x6084be, 0.65);
fill.position.set(9, 7, -12);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffb36d, 0.22);
rim.position.set(4, 2, 12);
rim.target.position.set(-1, 2, 0);
scene.add(rim);
scene.add(rim.target);

// Snowfall: two depth layers of soft, drifting flakes.
const snowSystems = [];

function createSnowLayer(count, size, opacity, minY, maxY, spread, speedMin, speedMax, windScale, options = {}) {
  const {
    map = snowflakeTexture,
    color = 0xddeeff,
    windX = 1.0,
    windZ = 0.36,
    sway = 0.3,
    blending = THREE.NormalBlending,
    depthTest = true,
  } = options;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rng(-spread, spread);
    positions[i * 3 + 1] = rng(minY, maxY);
    positions[i * 3 + 2] = rng(-spread, spread);
    speeds[i] = rng(speedMin, speedMax);
    phases[i] = rng(0, TAU);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 8, 0), spread * 1.9);
  const mat = new THREE.PointsMaterial({
    color,
    size,
    map,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest,
    sizeAttenuation: true,
    alphaTest: 0.02,
    toneMapped: false,
    blending,
  });
  mat.userData.outlineParameters = { visible: false, keepAlive: true };
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const sys = {
    points,
    positions,
    speeds,
    phases,
    count,
    spread,
    minY: 0.25,
    maxY,
    opacity,
    windScale,
    windX,
    windZ,
    sway,
  };
  snowSystems.push(sys);
  return sys;
}

// Six layers stack into a proper blizzard: distant flakes, close crystals,
// long wind-driven streaks, and soft foreground bokeh.
createSnowLayer(4800, 0.085, 0.62, 0.3, 16, 23, 1.2, 2.6, 1.0, { color: 0xcfe2f6, windX: 1.5, windZ: 0.46, sway: 0.26 });
createSnowLayer(3400, 0.14, 0.88, 0.3, 15, 15, 2.2, 4.2, 1.0, { color: 0xe8f3ff, windX: 2.1, windZ: 0.64, sway: 0.38 });
createSnowLayer(1350, 0.28, 0.92, 0.3, 12, 9, 2.8, 5.4, 1.0, { color: 0xf7fbff, windX: 2.7, windZ: 0.84, sway: 0.5 });
createSnowLayer(160, 0.52, 0.26, 0.5, 12, 7.5, 0.7, 1.8, 1.0, { color: 0xf2f9ff, windX: 1.2, windZ: 0.4, sway: 0.3 });
createSnowLayer(520, 0.52, 0.42, 0.3, 15, 20, 4.2, 7.2, 1.0, { map: snowStreakTexture, color: 0xe8f4ff, windX: 4.2, windZ: 1.2, sway: 0.34 });
createSnowLayer(620, 0.19, 0.68, 0.35, 3.2, 15, 0.2, 0.65, 1.0, { map: snowStreakTexture, color: 0xf0f8ff, windX: 5.2, windZ: 1.5, sway: 0.55 });
createSnowLayer(260, 0.65, 0.3, 1.5, 10, 8, 0.25, 0.6, 1.0, { map: glowTexture, color: 0xeaf5ff, windX: 0.35, windZ: 0.15, sway: 0.2 });

const windStreakSystems = [];
function createWindStreaks(count, spread, opacity, length) {
  const positions = new Float32Array(count * 6);
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: rng(-spread, spread),
      y: rng(0.4, 16),
      z: rng(-spread, spread),
      speed: rng(3.2, 7.0),
      phase: rng(0, TAU),
      length: length * rng(0.65, 1.35),
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 8, 0), spread * 1.9);
  const mat = new THREE.LineBasicMaterial({
    color: 0xddeeff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  mat.userData.outlineParameters = { visible: false, keepAlive: true };
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);
  windStreakSystems.push({ lines, particles, positions, spread, opacity });
}
createWindStreaks(1850, 18, 0.36, 0.27);
createWindStreaks(560, 11, 0.32, 0.42);

const snowHazeSprites = [];
{
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.SpriteMaterial({
      map: smokeTexture,
      color: 0xc9dff2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
    mat.userData.outlineParameters = { visible: false, keepAlive: true };
    const sprite = new THREE.Sprite(mat);
    const angle = (i / 8) * TAU + rng(-0.2, 0.2);
    const radius = rng(15, 23);
    sprite.position.set(Math.cos(angle) * radius, rng(1.3, 4.5), Math.sin(angle) * radius);
    const s = rng(7, 14);
    sprite.scale.set(s * 1.6, s * 0.55, 1);
    scene.add(sprite);
    snowHazeSprites.push({ sprite, baseOpacity: rng(0.05, 0.11), phase: rng(0, TAU), speed: rng(0.12, 0.3) });
  }
}

// Chimney and brazier smoke.
const smokePuffs = [];
function createSmoke(origin, count, scaleBase, rise, color, opacity) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: smokeTexture,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: true,
    });
    mat.userData.outlineParameters = { visible: false, keepAlive: true };
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(origin);
    const s = scaleBase * rng(0.7, 1.2);
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    smokePuffs.push({
      sprite,
      mat,
      origin: origin.clone(),
      age: random(),
      speed: rng(0.075, 0.135),
      drift: rng(-0.25, 0.25),
      seed: rng(0, TAU),
      scaleBase,
      opacity,
      rise,
    });
  }
}
const chimneySmokeOrigin = new THREE.Vector3(chimneyX, chimneyBaseY + 2.1, chimneyZ);
const brazierSmokeOrigin = new THREE.Vector3(6.55, 1.15, 4.35);
createSmoke(chimneySmokeOrigin, 24, 0.58, 2.8, 0xc7d8e8, 0.22);
createSmoke(brazierSmokeOrigin, 22, 0.38, 1.75, 0xc3d3e1, 0.2);

/* ------------------------------ animation state ------------------------- */

let elapsed = 0;
let atmosphere = 0;
let doorTimer = 2.0;
let userHasInteracted = false;
let paused = false;
let doorOpen = false;
let doorTargetX = doorPanels[1].closedX;
let introTime = 0;
let introActive = true;
const introDuration = 4.8;
const introStart = camera.position.clone();
const introTarget = initialCameraDirection.clone().multiplyScalar(fitDistance);
const lookTarget = new THREE.Vector3(0, 2.3, 0.18);

const clock = new THREE.Clock();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(preferredPixelRatio());
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const newFit = calculateFitDistance(w / h);
  if (introActive) {
    introTarget.copy(viewTarget).addScaledVector(initialCameraDirection, newFit);
  } else if (!userHasInteracted) {
    camera.position.copy(viewTarget).addScaledVector(initialCameraDirection, newFit);
    controls.target.copy(viewTarget);
  }
  fitDistance = newFit;
  controls.update();
}

window.addEventListener('resize', resize);

function interruptIntro() {
  if (!introActive) return;
  introActive = false;
  introTime = introDuration;
}

for (const evt of ['pointerdown', 'wheel', 'touchstart']) {
  canvas.addEventListener(evt, () => { userHasInteracted = true; interruptIntro(); }, { passive: true });
}

// Door state: a slow, irregular, almost absent-minded slide.
function updateDoor(dt) {
  doorTimer -= dt;
  if (doorTimer <= 0) {
    doorOpen = !doorOpen;
    doorTimer = doorOpen ? rng(3.8, 6.4) : rng(5.5, 9.5);
  }
  const panel = doorPanels[1];
  const target = doorOpen ? panel.openX : panel.closedX;
  panel.group.position.x = THREE.MathUtils.damp(panel.group.position.x, target, 0.65, dt);
  doorPanels[0].group.position.x = doorPanels[0].closedX;
}

function updateNoren(time) {
  for (const panel of norenPanels) {
    const pos = panel.geometry.attributes.position;
    const base = panel.userData.basePositions;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const factor = (panel.userData.height / 2 - y) / panel.userData.height;
      const wave = Math.sin(time * 1.25 + x * 3.2 + panel.userData.phase) * 0.044 * factor
        + Math.sin(time * 0.57 + panel.userData.phase) * 0.026 * factor;
      pos.setZ(i, wave);
      pos.setX(i, x + Math.sin(time * 0.9 + panel.userData.phase + y) * 0.013 * factor);
    }
    pos.needsUpdate = true;
    panel.geometry.computeVertexNormals();
  }
}

function updateLanterns(dt, time) {
  for (const l of lanternPivots) {
    if (!l.pivot.visible) continue;
    const windZ = Math.sin(time * 0.42 + l.phase) * 0.036 + Math.sin(time * 0.91 + l.phase * 1.7) * 0.016 + 0.012;
    const windX = Math.sin(time * 0.35 + l.phase * 0.8) * 0.022 + Math.sin(time * 1.13 + l.phase) * 0.01;
    const stiffness = 2.9;
    const damping = 0.78;
    l.velZ += (-stiffness * (l.angleZ - windZ) - damping * l.velZ) * dt;
    l.velX += (-stiffness * (l.angleX - windX) - damping * l.velX) * dt;
    l.angleZ += l.velZ * dt;
    l.angleX += l.velX * dt;
    l.pivot.rotation.z = l.angleZ;
    l.pivot.rotation.x = l.angleX;
    l.pivot.rotation.y = Math.sin(time * 0.19 + l.phase) * 0.04;
  }
}

function updateSnow(dt, time) {
  for (const sys of snowSystems) {
    const arr = sys.positions;
    for (let i = 0; i < sys.count; i++) {
      const ix = i * 3;
      const phase = sys.phases[i];
      const gust = 0.72
        + Math.sin(time * 0.6 + phase * 0.17) * 0.34
        + Math.sin(time * 1.65 + phase * 1.9) * 0.14;
      arr[ix + 1] -= sys.speeds[i] * dt;
      arr[ix] += (sys.windX * gust + Math.sin(time * 1.1 + phase) * sys.sway) * dt * sys.windScale;
      arr[ix + 2] += (sys.windZ * gust + Math.cos(time * 0.85 + phase * 1.3) * sys.sway * 0.7) * dt * sys.windScale;
      if (arr[ix + 1] < 0.22) {
        arr[ix + 1] = sys.maxY + random() * 2.2;
        arr[ix] = rng(-sys.spread, sys.spread);
        arr[ix + 2] = rng(-sys.spread, sys.spread);
      }
      if (arr[ix] > sys.spread) arr[ix] -= sys.spread * 2;
      if (arr[ix] < -sys.spread) arr[ix] += sys.spread * 2;
      if (arr[ix + 2] > sys.spread) arr[ix + 2] -= sys.spread * 2;
      if (arr[ix + 2] < -sys.spread) arr[ix + 2] += sys.spread * 2;
    }
    sys.points.geometry.attributes.position.needsUpdate = true;
    sys.points.material.opacity = sys.opacity * atmosphere;
  }

  for (const sys of windStreakSystems) {
    const arr = sys.positions;
    for (let i = 0; i < sys.particles.length; i++) {
      const p = sys.particles[i];
      const gust = 0.7 + Math.sin(time * 0.7 + p.phase * 0.2) * 0.35;
      p.y -= p.speed * dt;
      p.x += (4.2 * gust + Math.sin(time + p.phase) * 0.65) * dt;
      p.z += (1.1 * gust + Math.cos(time * 0.8 + p.phase) * 0.4) * dt;
      if (p.y < 0.3) { p.y = 16 + random() * 2; p.x = rng(-sys.spread, sys.spread); p.z = rng(-sys.spread, sys.spread); }
      if (p.x > sys.spread) p.x -= sys.spread * 2;
      if (p.x < -sys.spread) p.x += sys.spread * 2;
      if (p.z > sys.spread) p.z -= sys.spread * 2;
      if (p.z < -sys.spread) p.z += sys.spread * 2;
      const ix = i * 6;
      arr[ix] = p.x;
      arr[ix + 1] = p.y;
      arr[ix + 2] = p.z;
      arr[ix + 3] = p.x - p.length;
      arr[ix + 4] = p.y + p.length * 0.72;
      arr[ix + 5] = p.z - p.length * 0.22;
    }
    sys.lines.geometry.attributes.position.needsUpdate = true;
    sys.lines.material.opacity = sys.opacity * atmosphere;
  }

  for (const haze of snowHazeSprites) {
    haze.sprite.position.x += (0.43 + Math.sin(time * 0.5 + haze.phase) * 0.12) * dt;
    haze.sprite.position.z += 0.13 * dt;
    if (haze.sprite.position.x > 25) haze.sprite.position.x = -25;
    if (haze.sprite.position.z > 25) haze.sprite.position.z = -25;
    haze.sprite.material.opacity = haze.baseOpacity * atmosphere * (0.72 + Math.sin(time * haze.speed + haze.phase) * 0.28);
  }
}

function updateSmoke(dt, time) {
  for (const p of smokePuffs) {
    p.age += dt * p.speed;
    if (p.age > 1) p.age -= 1;
    const t = p.age;
    const x = p.origin.x + Math.sin(time * 0.5 + p.seed + t * 2.8) * (0.1 + t * 0.42) + p.drift * t * 1.8 + t * (p.origin.y > 5 ? 1.55 : 0.8);
    const y = p.origin.y + t * p.rise + Math.sin(t * Math.PI) * 0.2;
    const z = p.origin.z + Math.cos(time * 0.37 + p.seed + t * 2.2) * (0.08 + t * 0.3);
    p.sprite.position.set(x, y, z);
    const scale = p.scaleBase * (0.55 + t * 2.2);
    p.sprite.scale.set(scale, scale, 1);
    p.sprite.material.rotation = p.seed + t * 0.35;
    const fade = Math.sin(Math.min(1, t) * Math.PI);
    p.mat.opacity = fade * p.opacity * atmosphere;
  }
}

function updateAssembly(time) {
  for (const item of assemblyItems) {
    if (!item.active) {
      if (time < item.delay) {
        item.object.visible = false;
        continue;
      }
      item.active = true;
      item.object.visible = true;
    }
    if (item.done) continue;
    const t = clamp((time - item.delay) / item.duration, 0, 1);
    const eased = easeOutCubic(t);
    const bob = Math.sin(t * Math.PI) * 0.03;
    item.object.position.y = item.baseY + item.drop * (1 - eased) - bob;
    item.object.scale.copy(item.baseScale).multiplyScalar(lerp(item.scaleFrom, 1, eased));
    if (t >= 1) finishAssemblyItem(item);
  }
}

function updateAtmosphere(dt, time) {
  const ramp = clamp((time - 7.85) / 2.15, 0, 1);
  atmosphere = easeInOutCubic(ramp);
  for (const entry of warmLights) entry.light.intensity = entry.target * atmosphere;
  for (const g of warmGlows) g.material.opacity = g.userData.baseOpacity * atmosphere;
  for (const pool of lightPools) pool.material.opacity = pool.userData.baseOpacity * atmosphere;
  for (const mat of warmBasicMaterials) mat.color.copy(windowGlowStart).lerp(windowGlowTarget, atmosphere);
  for (const mat of lanternLightMats) mat.color.copy(lanternColorStart).lerp(lanternColorTarget, atmosphere);
  for (const sys of snowSystems) sys.points.material.opacity = sys.opacity * atmosphere;
  for (const b of backgroundBokeh) {
    b.sprite.material.opacity = b.baseOpacity * (0.3 + atmosphere * 0.7) * (0.72 + 0.28 * Math.sin(time * b.speed + b.phase));
  }

  // Subtle interior life: warm light breathing, gently irregular.
  const breath = 0.97 + Math.sin(time * 0.75) * 0.025 + Math.sin(time * 2.1) * 0.008;
  interiorLight.intensity = 28 * atmosphere * breath;
  if (brazierGlow) brazierGlow.material.opacity = brazierGlow.userData.baseOpacity * atmosphere * (0.8 + Math.sin(time * 3.7) * 0.15 + Math.sin(time * 7.1) * 0.05);
}

function updateIntro(dt) {
  if (!introActive) return;
  introTime += dt;
  const t = clamp(introTime / introDuration, 0, 1);
  const e = easeInOutCubic(t);
  camera.position.lerpVectors(introStart, introTarget, e);
  camera.lookAt(lookTarget);
  if (t >= 1) introActive = false;
}

function render() {
  outline.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  if (paused) { render(); return; }
  elapsed += Math.min(rawDt, 0.1);

  if (elapsed < 9.8) {
    renderer.shadowMap.needsUpdate = true;
  }

  updateIntro(dt);
  if (!introActive) controls.update();

  updateAssembly(elapsed);
  if (elapsed > 7.3) {
    updateDoor(dt);
  }
  updateNoren(elapsed);
  updateLanterns(dt, elapsed);
  updateSnow(dt, elapsed);
  updateSmoke(dt, elapsed);
  updateAtmosphere(dt, elapsed);

  // A tiny, slow camera drift after the opening, only before the user takes over.
  render();
}

// Expose a minimal handle for automated visual checks (no visible UI).
window.__izakaya = {
  scene,
  camera,
  controls,
  renderer,
  setTime: (t, complete = true) => {
    elapsed = t;
    introActive = false;
    updateAssembly(t);
    if (complete) for (const item of assemblyItems) finishAssemblyItem(item);
    updateAtmosphere(0, t);
    updateSnow(0, t);
    updateSmoke(0, t);
    updateNoren(t);
    doorPanels[0].group.position.x = doorPanels[0].closedX;
    doorPanels[1].group.position.x = doorPanels[1].closedX;
    camera.position.copy(initialCameraDirection).multiplyScalar(fitDistance);
    controls.target.copy(viewTarget);
    controls.update();
    renderer.shadowMap.needsUpdate = true;
    render();
  },
  resetAssembly: () => {
    for (const item of assemblyItems) {
      item.active = false;
      item.done = false;
      item.object.visible = false;
      item.object.position.y = item.baseY;
      item.object.scale.copy(item.baseScale);
    }
  },
  setDoor: (open) => {
    doorOpen = open;
    doorTimer = 999;
    doorPanels[1].group.position.x = open ? doorPanels[1].openX : doorPanels[1].closedX;
    doorPanels[0].group.position.x = doorPanels[0].closedX;
    render();
  },
  freeze: () => { introActive = false; controls.enabled = false; paused = true; },
  resume: () => { controls.enabled = true; paused = false; },
  getElapsed: () => elapsed,
};

resize();
animate();
