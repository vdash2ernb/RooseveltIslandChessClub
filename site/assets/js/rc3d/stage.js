// Renderer, camera, studio lighting and an on-demand render loop.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Detail tiers. Phones get lighter meshes, smaller textures and fewer pixels; weaker phones also
// drop real-time shadows (the soft contact shadows under each piece stay). Add ?quality=low|medium|high
// to the URL to preview a tier.
export const DETAIL = {
  high: { dpr: 2, shadow: 2048, board: 2048, seg: 64, mc: 1, curve: 1, knightZ: 1.5, knightRes: 100, edge: 960, body: 160, ring: 200, relief: 140, reliefGrid: 420 },
  medium: { dpr: 1.5, shadow: 1024, board: 1024, seg: 40, mc: 0.75, curve: 0.65, knightZ: 1, knightRes: 80, edge: 600, body: 96, ring: 128, relief: 84, reliefGrid: 260 },
  low: { dpr: 1.25, shadow: 0, board: 1024, seg: 32, mc: 0.65, curve: 0.55, knightZ: 1, knightRes: 64, edge: 480, body: 80, ring: 96, relief: 72, reliefGrid: 220 },
};

export function detectQuality() {
  const forced = new URLSearchParams(window.location.search).get('quality');
  if (forced && DETAIL[forced]) return forced;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) < 820;
  if (!(coarse && small)) return 'high';
  const memory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  return memory <= 4 || cores <= 4 ? 'low' : 'medium';
}

export function createStage(canvas, { quality = detectQuality(), shadowsOnDemand = false } = {}) {
  const detail = DETAIL[quality];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, detail.dpr));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = detail.shadow > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // With shadowsOnDemand the shadow map is redrawn only when something casting a shadow moves.
  renderer.shadowMap.autoUpdate = !shadowsOnDemand;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);

  // Warm key light from the front left, the only shadow caster.
  const key = new THREE.DirectionalLight('#ffe4c8', 2.2);
  key.position.set(-6.5, 11, 7.5);
  key.castShadow = detail.shadow > 0;
  key.shadow.mapSize.setScalar(detail.shadow || 512);
  Object.assign(key.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 2, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key);

  // Cool river-blue rim from behind, to separate dark pieces from the dusk background.
  const rim = new THREE.DirectionalLight('#8fbfe0', 1.5);
  rim.position.set(6, 6, -10);
  scene.add(rim);

  // Soft fill.
  scene.add(new THREE.HemisphereLight('#cfdbe4', '#3b2a1e', 0.35));

  let needsRender = true;
  const tickers = new Set();

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let active = false;
    for (const t of tickers) if (t(dt, now / 1000)) active = true;
    if (active || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }
  requestAnimationFrame(frame);

  return {
    renderer, scene, camera, key, quality, detail,
    invalidate() { needsRender = true; },
    invalidateShadows() { renderer.shadowMap.needsUpdate = true; needsRender = true; },
    // A ticker returns true while it is animating, so the frame gets drawn.
    addTicker(fn) { tickers.add(fn); return () => tickers.delete(fn); },
  };
}
