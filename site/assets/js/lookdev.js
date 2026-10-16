// Phase 1 look development: the board, the set and the club medallion, for approval.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage } from './rc3d/stage.js';
import { buildMaterials } from './rc3d/materials.js';
import { buildBoard, buildSet, squareToXZ } from './rc3d/board.js';
import { buildMedallion } from './rc3d/medallion.js';
import { loadLogoTrace } from './rc3d/logo.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const status = document.getElementById('status');
const caption = document.getElementById('caption');
const shotButtons = [...document.querySelectorAll('[data-shot]')];
const turntableBtn = document.getElementById('turntable');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const knightSq = squareToXZ('g1');

const SHOTS = {
  board: {
    pos: [0, 9.3, 12.4], target: [0, 0, 1.25], fit: 10.4,
    text: 'Maple and walnut squares with alternating grain, a mitred walnut frame, a gilded inlay line and engraved coordinates. Drag to look around, scroll or pinch to zoom.',
  },
  pieces: {
    pos: [3.3, 1.45, 7.9], target: [-1.1, 0.6, 3.0],
    text: 'Boxwood and ebonized walnut under a satin lacquer. Every profile is drawn by us and turned in code: beads, coves, collars, the pearl coronet and the cross.',
  },
  knight: {
    pos: [knightSq.x + 1.8, 1.2, knightSq.z - 0.9], target: [knightSq.x, 0.74, knightSq.z - 0.05],
    text: 'The knight is the knight from the club logo, sculpted in the round: its eye, nostril, mouth, jaw line and mane locks are carved in from the original artwork.',
  },
  medallion: {
    pos: [0, 4.3, 6.6], target: [0, 4.55, 0.4], fit: 2.9, medallion: true,
    text: 'The club logo in 3D, traced from the original artwork: the same knight, the same lettering and the swash under the R, with orange cut-outs through the rings and checkers. Drag to spin it.',
  },
};

// Yield so the loader can paint; the timer keeps loading going in background tabs.
const tick = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 50); });
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function main() {
  if (!webglAvailable()) {
    status.textContent = 'This browser cannot show 3D. The live site will show still images here instead.';
    loader.classList.add('failed');
    return;
  }

  const t0 = performance.now();
  try { await document.fonts.load('600 64px "Bricolage Grotesque"'); } catch { /* falls back to sans-serif */ }

  const stage = createStage(canvas);
  const { scene, camera, renderer } = stage;
  const timings = {};

  status.textContent = 'Planing the board';
  await tick();
  let t = performance.now();
  const [materials, trace] = await Promise.all([
    buildMaterials({ renderer }),
    loadLogoTrace('../assets/data/logo-trace.json'),
  ]);
  scene.add(buildBoard(materials));
  timings.board = Math.round(performance.now() - t);

  status.textContent = 'Turning the pieces';
  await tick();
  t = performance.now();
  const set = await buildSet(materials, trace, stage.quality, tick);
  scene.add(set.group);
  timings.pieces = Math.round(performance.now() - t);

  status.textContent = 'Striking the medallion';
  await tick();
  t = performance.now();
  const medallion = await buildMedallion({ materials, trace, fontBase: '../assets/fonts', quality: stage.quality, onStep: tick });
  timings.medallion = Math.round(performance.now() - t);
  const pivot = new THREE.Group();
  pivot.add(medallion);
  pivot.position.set(0, 4.5, 0.4);
  pivot.scale.setScalar(1.15);
  pivot.visible = false;
  scene.add(pivot);

  // Upload everything to the GPU before revealing, so the first interaction never hitches.
  pivot.visible = true;
  renderer.compile(scene, camera);
  pivot.visible = false;
  timings.total = Math.round(performance.now() - t0);

  // ------------------------------------------------------------ camera

  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.08, enablePan: false,
    minDistance: 2.2, maxDistance: 40, maxPolarAngle: 1.42, autoRotateSpeed: 0.55,
  });
  controls.addEventListener('change', stage.invalidate);

  let current = null;
  let tween = null;
  let medShow = 0, medTarget = 0;

  // Shots are framed for wide screens. On narrow ones the camera backs away along
  // the same line of sight so the subject still fits the width.
  function shotPosition(shot) {
    const target = new THREE.Vector3(...shot.target);
    const pos = new THREE.Vector3(...shot.pos);
    const offset = pos.sub(target);
    let k;
    if (shot.fit) {
      const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      k = Math.max(1, (shot.fit / 2 / halfTan) / offset.length());
    } else {
      k = camera.aspect < 1.3 ? Math.min(2.5, Math.pow(1.3 / camera.aspect, 0.92)) : 1;
    }
    return offset.multiplyScalar(k).add(target);
  }

  function goTo(name, instant = false) {
    const shot = SHOTS[name];
    if (!shot || name === current) return;
    current = name;
    shotButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shot === name)));
    caption.textContent = shot.text;
    medTarget = shot.medallion ? 1 : 0;
    if (shot.medallion) pivot.visible = true;
    controls.enabled = false;
    controls.autoRotate = false;
    turntableBtn.setAttribute('aria-pressed', 'false');
    const dur = instant || reduceMotion.matches ? 0 : 1.7;
    tween = {
      t: 0, dur,
      fromPos: camera.position.clone(), toPos: shotPosition(shot),
      fromTgt: controls.target.clone(), toTgt: new THREE.Vector3(...shot.target),
    };
    stage.invalidate();
  }

  const debug = { freeze: false };

  // Medallion spin state.
  const med = { rot: 0, vel: 0, tiltX: 0, tiltY: 0, aimX: 0, aimY: 0, dragging: false, lastX: 0, lastT: 0 };

  stage.addTicker((dt, time) => {
    let active = false;
    if (tween) {
      tween.t = tween.dur ? Math.min(1, tween.t + dt / tween.dur) : 1;
      const k = easeInOut(tween.t);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k);
      camera.lookAt(controls.target);
      if (tween.t >= 1) {
        tween = null;
        controls.enabled = !SHOTS[current].medallion;
        controls.update();
      }
      active = true;
    } else if (controls.enabled) {
      if (controls.update()) active = true;
    }

    // Medallion rise and spin.
    if (pivot.visible && !debug.freeze) {
      const speed = reduceMotion.matches ? 100 : 1.6;
      medShow += Math.sign(medTarget - medShow) * Math.min(Math.abs(medTarget - medShow), dt * speed);
      const k = easeInOut(medShow);
      pivot.position.y = 2.0 + 2.5 * k;
      pivot.scale.setScalar(Math.max(0.001, 1.15 * (0.55 + 0.45 * k)));

      if (!med.dragging) {
        med.rot += med.vel * dt;
        med.vel *= Math.exp(-dt * 2.2);
        if (Math.abs(med.vel) < 0.6) {
          const rest = Math.round(med.rot / Math.PI) * Math.PI;
          med.rot += (rest - med.rot) * (1 - Math.exp(-dt * 3));
        }
      }
      const sway = reduceMotion.matches ? 0 : Math.sin(time * 0.6) * 0.16 * k;
      const intro = (1 - k) * -Math.PI * 1.5;
      med.tiltX += (med.aimX - med.tiltX) * (1 - Math.exp(-dt * 4));
      med.tiltY += (med.aimY - med.tiltY) * (1 - Math.exp(-dt * 4));
      medallion.rotation.set(med.tiltX, med.rot + sway + med.tiltY + intro, 0);

      if (medShow <= 0 && medTarget === 0) pivot.visible = false;
      active = true;
    }
    return active;
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (current !== 'medallion') return;
    med.dragging = true;
    med.lastX = e.clientX;
    med.lastT = performance.now();
    med.vel = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (current !== 'medallion') return;
    if (med.dragging) {
      const now = performance.now();
      const d = (e.clientX - med.lastX) * 0.011;
      med.rot += d;
      med.vel = d / Math.max(0.008, (now - med.lastT) / 1000);
      med.lastX = e.clientX;
      med.lastT = now;
    } else if (e.pointerType === 'mouse') {
      med.aimY = (e.clientX / window.innerWidth - 0.5) * 0.35;
      med.aimX = (e.clientY / window.innerHeight - 0.5) * 0.22;
    }
  });
  const endDrag = () => { med.dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  shotButtons.forEach((b) => b.addEventListener('click', () => goTo(b.dataset.shot)));
  turntableBtn.addEventListener('click', () => {
    if (current === 'medallion') {
      med.vel = 4.5;
      return;
    }
    controls.autoRotate = !controls.autoRotate;
    turntableBtn.setAttribute('aria-pressed', String(controls.autoRotate));
    stage.invalidate();
  });
  window.addEventListener('keydown', (e) => {
    const map = { 1: 'board', 2: 'pieces', 3: 'knight', 4: 'medallion' };
    if (map[e.key]) goTo(map[e.key]);
  });

  const start = (location.hash || '').slice(1);
  camera.position.set(0, 14, 16);
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  goTo(SHOTS[start] ? start : 'board');

  loader.classList.add('done');
  document.body.classList.add('ready');

  // Debug: jump to a shot and draw it immediately, without waiting for animation frames.
  function snap(name, spin = 0) {
    goTo(name, true);
    tween = null;
    const shot = SHOTS[name];
    camera.position.copy(shotPosition(shot));
    controls.target.set(...shot.target);
    camera.lookAt(controls.target);
    controls.enabled = !shot.medallion;
    medShow = medTarget;
    pivot.visible = medTarget > 0;
    pivot.position.y = 4.5;
    pivot.scale.setScalar(1.15);
    med.rot = spin;
    med.vel = 0;
    medallion.rotation.set(0, spin, 0);
    renderer.render(scene, camera);
  }

  const info = renderer.info;
  window.__lookdev = { stage, set, medallion, timings, info, goTo, snap, camera, controls, debug };
}

main().catch((err) => {
  console.error(err);
  status.textContent = 'Something went wrong while building the scene.';
  loader.classList.add('failed');
});
