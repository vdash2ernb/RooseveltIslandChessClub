// Renderer, camera, studio lighting and an on-demand render loop.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function detectQuality() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) < 820;
  return coarse && small ? 'medium' : 'high';
}

export function createStage(canvas, { quality = detectQuality(), shadowsOnDemand = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
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
  key.castShadow = true;
  key.shadow.mapSize.setScalar(quality === 'high' ? 2048 : 1024);
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
    renderer, scene, camera, key, quality,
    invalidate() { needsRender = true; },
    invalidateShadows() { renderer.shadowMap.needsUpdate = true; needsRender = true; },
    // A ticker returns true while it is animating, so the frame gets drawn.
    addTicker(fn) { tickers.add(fn); return () => tickers.delete(fn); },
  };
}
