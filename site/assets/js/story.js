// The scroll story: the Opera Game (Paris, 1858) played in 3D as the visitor scrolls.
// Everything on screen is a pure function of scroll progress p (0..1), so scrolling back
// rewinds exactly and a fast flick can never leave anything out of place.

import * as THREE from 'three';
import { createStage } from './rc3d/stage.js';
import { buildMaterials } from './rc3d/materials.js';
import { buildBoard, buildSet, squareToXZ } from './rc3d/board.js';
import { buildMedallion } from './rc3d/medallion.js';
import { loadLogoTrace } from './rc3d/logo.js';
import { PLIES, buildTimeline, poseAt, plyAt } from './rc3d/game.js';

const $ = (s) => document.querySelector(s);
const story = $('#story');
const canvas = $('#scene');
const hudMove = $('.hud-move');
const railButtons = [...document.querySelectorAll('.rail button')];
const caps = [...document.querySelectorAll('.cap')].map((el) => ({
  el, from: Number(el.dataset.from), to: Number(el.dataset.to), shown: -1,
  hasLink: !!el.querySelector('a, button'),
}));
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
function easeOutBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

// ------------------------------------------------------------------ story map

// Scroll progress -> game time (plies played). Flat stretches leave time to read.
const GAME = [
  [0, 0], [0.125, 0], [0.245, 6], [0.278, 6], [0.445, 16], [0.478, 16], [0.625, 24],
  [0.658, 24], [0.72, 30], [0.8, 32], [0.845, 32], [0.885, 33], [1, 33],
];
function gameTime(p) {
  for (let i = 1; i < GAME.length; i++) {
    const [p1, g1] = GAME[i];
    if (p <= p1) {
      const [p0, g0] = GAME[i - 1];
      return g0 + (g1 - g0) * clamp01((p - p0) / (p1 - p0 || 1));
    }
  }
  return GAME[GAME.length - 1][1];
}

// Chapters: where each starts, and the still frame shown when motion is reduced.
const CHAPTERS = [
  { from: 0, rest: 0 },
  { from: 0.105, rest: 0.25 },
  { from: 0.268, rest: 0.45 },
  { from: 0.468, rest: 0.63 },
  { from: 0.648, rest: 0.84 },
  { from: 0.862, rest: 1 },
];
const chapterAt = (p) => CHAPTERS.reduce((c, ch, i) => (p >= ch.from - 1e-6 ? i : c), 0);

// Camera path. Keys are joined by a time-aware Hermite spline so speed stays continuous.
const CAM = [
  { p: 0.0, pos: [0, 3.0, 8.4], tgt: [0, 2.75, 0.6] },
  { p: 0.05, pos: [0, 6.2, 11.2], tgt: [0, 1.4, 0.6] },
  { p: 0.1, pos: [0, 9.4, 11.8], tgt: [0, 0, 0.9] },
  { p: 0.155, pos: [2.9, 2.2, 7.0], tgt: [0.3, 0.4, 1.4] },
  { p: 0.215, pos: [-2.3, 2.7, 6.5], tgt: [0.2, 0.3, 0.4] },
  { p: 0.29, pos: [6.6, 5.4, 6.4], tgt: [0.4, 0, 0.2] },
  { p: 0.375, pos: [7.8, 4.8, -0.6], tgt: [0.2, 0, 0.4] },
  { p: 0.455, pos: [4.8, 5.0, 7.6], tgt: [-0.8, 0, 0.8] },
  { p: 0.52, pos: [-4.0, 3.4, 6.6], tgt: [-1.2, 0.3, 0.8] },
  { p: 0.595, pos: [-6.4, 3.6, 3.0], tgt: [-1.4, 0.2, 1.6] },
  { p: 0.66, pos: [-5.8, 4.2, -0.8], tgt: [-0.8, 0.3, -2.0] },
  { p: 0.715, pos: [-4.6, 3.0, -0.6], tgt: [-0.8, 0.5, -2.6] },
  { p: 0.775, pos: [-0.4, 3.0, 0.6], tgt: [-2.2, 0.6, -3.0] },
  { p: 0.825, pos: [-0.7, 2.3, -1.1], tgt: [-2.5, 0.6, -3.5] },
  { p: 0.87, pos: [3.9, 2.7, -0.6], tgt: [-0.2, 0.55, -3.2] },
  { p: 0.915, pos: [2.5, 1.5, -1.3], tgt: [0.1, 0.45, -3.2] },
  { p: 0.965, pos: [0, 6.2, 10.4], tgt: [0, 2.2, -0.6] },
  { p: 1.0, pos: [0, 5.7, 10.4], tgt: [0, 2.55, -0.8] },
].map((k) => ({ p: k.p, pos: new THREE.Vector3(...k.pos), tgt: new THREE.Vector3(...k.tgt) }));

function tangent(keys, i, prop) {
  const a = keys[Math.max(0, i - 1)], b = keys[Math.min(keys.length - 1, i + 1)];
  const dt = b.p - a.p || 1;
  return b[prop].clone().sub(a[prop]).multiplyScalar(1 / dt);
}
const TAN = CAM.map((_, i) => ({ pos: tangent(CAM, i, 'pos'), tgt: tangent(CAM, i, 'tgt') }));

function cameraAt(p, outPos, outTgt) {
  let i = 0;
  while (i < CAM.length - 2 && p > CAM[i + 1].p) i++;
  const a = CAM[i], b = CAM[i + 1];
  const h = b.p - a.p;
  const t = clamp01((p - a.p) / h);
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  for (const [prop, out] of [['pos', outPos], ['tgt', outTgt]]) {
    out.copy(a[prop]).multiplyScalar(h00)
      .addScaledVector(TAN[i][prop], h10 * h)
      .addScaledVector(b[prop], h01)
      .addScaledVector(TAN[i + 1][prop], h11 * h);
  }
}

// ------------------------------------------------------------------ captions, HUD, rail (no 3D needed)

let storyTop = 0, storyLen = 1;
function measure() {
  storyTop = story.getBoundingClientRect().top + window.scrollY;
  storyLen = Math.max(1, story.offsetHeight - window.innerHeight);
}
const rawProgress = () => clamp01((window.scrollY - storyTop) / storyLen);

function updateCaptions(p) {
  const fade = 0.016;
  for (const c of caps) {
    const fin = c.from <= 0 ? 1 : smooth(c.from, c.from + fade, p);
    const fout = c.to >= 1 ? 1 : 1 - smooth(c.to - fade, c.to, p);
    const o = Math.round(fin * fout * 100) / 100;
    if (o === c.shown) continue;
    c.shown = o;
    c.el.style.opacity = String(o);
    c.el.style.transform = `translate3d(0, ${((1 - o) * 22).toFixed(1)}px, 0)`;
    // Hide invisible captions that hold links, so the keyboard never lands on something unseen.
    if (c.hasLink) c.el.style.visibility = o > 0.02 ? 'visible' : 'hidden';
  }
}

let lastHud = '', lastChapter = -1;
function updateHud(p, g) {
  const i = plyAt(g);
  const text = i < 0 ? 'Ready' : `${PLIES[i].n}${i % 2 ? '…' : '.'} ${PLIES[i].san}`;
  if (text !== lastHud) { hudMove.textContent = text; lastHud = text; }
  const ch = chapterAt(p);
  if (ch !== lastChapter) {
    railButtons.forEach((b, k) => (k === ch ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    lastChapter = ch;
  }
}

// Chapter buttons glide the page instead of jumping, so the game plays through at a calm pace.
// Longer trips take longer (about 1.5 to 5 seconds). Any wheel, touch or key from the visitor cancels the glide.
let glide = null;
function glideTo(top) {
  if (glide) cancelAnimationFrame(glide.raf);
  const from = window.scrollY;
  const dist = Math.abs(top - from);
  if (reduce.matches || dist < 2) { window.scrollTo(0, top); return; }
  const dur = Math.min(5000, 1500 + (dist / Math.max(1, storyLen)) * 6000);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
    window.scrollTo(0, from + (top - from) * e);
    glide = k < 1 ? { raf: requestAnimationFrame(step) } : null;
  };
  glide = { raf: requestAnimationFrame(step) };
}
const stopGlide = () => { if (glide) { cancelAnimationFrame(glide.raf); glide = null; } };
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, stopGlide, { passive: true }));

railButtons.forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation();
  measure();
  glideTo(storyTop + Number(b.dataset.go) * storyLen);
}));

// The visible state follows the scroll with a critically damped ease and a speed limit,
// so even a fast flick or a scrollbar drag plays the game smoothly instead of snapping.
let target = 0, shown = 0, velocity = 0;
const SMOOTH_TIME = 0.55;   // seconds to settle
const MAX_SPEED = 0.16;     // story progress per second: the whole game takes at least six seconds
function smoothDamp(current, goal, dt) {
  const omega = 2 / SMOOTH_TIME;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = MAX_SPEED * SMOOTH_TIME;
  const change = Math.max(-maxChange, Math.min(maxChange, current - goal));
  const temp = (velocity + omega * change) * dt;
  velocity = (velocity - omega * temp) * exp;
  let out = current - change + (change + temp) * exp;
  if ((goal - current > 0) === (out > goal)) { out = goal; velocity = 0; }
  return out;
}
function readScroll() {
  let p = rawProgress();
  if (reduce.matches) p = CHAPTERS[chapterAt(p)].rest;
  target = p;
}

measure();
readScroll();
shown = target;
updateCaptions(shown);
updateHud(shown, gameTime(shown));
window.addEventListener('scroll', readScroll, { passive: true });
window.addEventListener('resize', () => { measure(); readScroll(); });

// ------------------------------------------------------------------ 3D

function webglAvailable() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

const pause = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 60); });

function highlightTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 92);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 120, 18);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function start3D() {
  if (!webglAvailable()) throw new Error('WebGL 2 is not available');
  const stage = createStage(canvas, { shadowsOnDemand: true });
  const { scene, camera, renderer } = stage;

  const [materials, trace] = await Promise.all([
    buildMaterials({ renderer }),
    loadLogoTrace('assets/data/logo-trace.json'),
  ]);
  scene.add(buildBoard(materials));
  await pause();

  const medallion = await buildMedallion({ materials, trace, fontBase: 'assets/fonts', quality: stage.quality, onStep: pause });
  const pivot = new THREE.Group();
  pivot.add(medallion);
  scene.add(pivot);

  // Last-move highlights: the move being played fades in while the one before fades out.
  const hlTex = highlightTexture();
  const hlGeo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);
  const makeHl = (color) => {
    const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
      map: hlTex, color, transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false,
    }));
    m.position.y = 0.002;
    m.renderOrder = 2;
    m.visible = false;
    scene.add(m);
    return m;
  };
  const hl = {
    cur: [makeHl('#ff7a3d'), makeHl('#ff7a3d')],
    prev: [makeHl('#ff7a3d'), makeHl('#ff7a3d')],
    check: makeHl('#ff3b1a'),
  };

  let tracks = null, king = null;
  const kingTip = { dir: new THREE.Vector3(-1, 0, 1).normalize(), radius: 0.34 };
  kingTip.axis = new THREE.Vector3(kingTip.dir.z, 0, -kingTip.dir.x);

  // Layout: captions sit left on wide screens, so the scene shifts right; on phones it shifts up.
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.fov = w / h < 0.8 ? 40 : 32;
    if (w >= 900) camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.12, w, h);
    camera.updateProjectionMatrix();
    stage.invalidate();
  }
  new ResizeObserver(layout).observe(canvas);
  layout();

  // Portrait screens back the camera away along its line of sight so the subject keeps fitting.
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  function placeCamera(p) {
    cameraAt(p, camPos, camTgt);
    const a = camera.aspect;
    if (a < 1.3) {
      const k = Math.min(1.9, Math.pow(1.3 / a, 0.75));
      camPos.sub(camTgt).multiplyScalar(k).add(camTgt);
    }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
  }

  const aim = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    aim.tx = (e.clientY / window.innerHeight - 0.5) * 0.25;
    aim.ty = (e.clientX / window.innerWidth - 0.5) * 0.4;
  }, { passive: true });

  const qBase = new THREE.Quaternion(), qTip = new THREE.Quaternion(), offset = new THREE.Vector3();
  const pivotPoint = new THREE.Vector3();
  let lastG = -1, lastP = -1;

  function apply(p, time, dt) {
    const g = gameTime(p);
    let shadows = false;

    // Pieces: game state, then the drop-in at the start and the king's fall at the end.
    if (tracks) {
      const inWindow = p < 0.13 || (p > 0.88 && p < 0.935);
      if (g !== lastG || (p !== lastP && inWindow)) {
        poseAt(tracks, g);
        for (const t of tracks) {
          const sq = t.piece.userData.square;
          const order = { 1: 0, 2: 1, 7: 2, 8: 3 }[sq[1]];
          const s = 0.03 + order * 0.014 + (sq.charCodeAt(0) - 97) * 0.0016;
          const k = clamp01((p - s) / 0.03);
          t.piece.visible = k > 0;
          if (k < 1) t.piece.position.y += 6 * Math.pow(1 - easeOutCubic(k), 1);
        }
        const tip = easeOutBounce(clamp01((p - 0.885) / 0.04));
        if (king) {
          king.piece.userData.blob.visible = tip < 0.05;
          if (tip > 0) {
            pivotPoint.copy(king.piece.position).addScaledVector(kingTip.dir, kingTip.radius);
            pivotPoint.y = 0;
            qBase.copy(king.piece.quaternion);
            qTip.setFromAxisAngle(kingTip.axis, tip * THREE.MathUtils.degToRad(84));
            offset.copy(king.piece.position).sub(pivotPoint).applyQuaternion(qTip);
            king.piece.position.copy(pivotPoint).add(offset);
            king.piece.quaternion.copy(qTip).multiply(qBase);
          }
        }
        shadows = true;
      }
    }

    // Highlights.
    const i = plyAt(g);
    const showHl = (pair, ply, o) => {
      const [from, to] = ply ? ply.moves[0] : [];
      [from, to].forEach((sq, k) => {
        const m = pair[k];
        m.visible = !!ply && o > 0.01;
        if (!m.visible) return;
        m.position.x = squareToXZ(sq).x;
        m.position.z = squareToXZ(sq).z;
        m.material.opacity = o * (k ? 0.42 : 0.24);
      });
    };
    const tIn = i >= 0 ? smooth(0.1, 0.35, g - i) : 0;
    showHl(hl.cur, i >= 0 ? PLIES[i] : null, tIn);
    showHl(hl.prev, i >= 1 ? PLIES[i - 1] : null, i >= 1 ? 1 - tIn : 0);
    const checkO = i >= 0 && PLIES[i].check ? smooth(0.8, 0.95, g - i) : 0;
    hl.check.visible = checkO > 0.01 && p < 0.9;
    if (hl.check.visible) {
      const c = squareToXZ(PLIES[i].check);
      hl.check.position.set(c.x, 0.002, c.z);
      hl.check.material.opacity = checkO * 0.55;
    }

    // Medallion: hovers at the start, flips away, returns for the finale.
    const kA = easeInOut(clamp01((p - 0.02) / 0.07));
    const kF = easeOutCubic(clamp01((p - 0.925) / 0.06));
    aim.x += (aim.tx - aim.x) * (1 - Math.exp(-dt * 4));
    aim.y += (aim.ty - aim.y) * (1 - Math.exp(-dt * 4));
    const sway = reduce.matches ? 0 : Math.sin(time * 0.6) * 0.14;
    let idle = false;
    const scrolled = p !== lastP;
    if (kF > 0) {
      pivot.visible = true;
      pivot.position.set(0, 9 - 5.75 * kF, -1.0);
      medallion.rotation.set(aim.x, (1 - kF) * -Math.PI * 2 + sway + aim.y, 0);
      idle = true;
      if (scrolled) shadows = true;
    } else if (kA < 1) {
      pivot.visible = true;
      pivot.position.set(0, 2.75 + kA * kA * 7.5, 0.6);
      medallion.rotation.set(-kA * Math.PI * 0.5 + aim.x * (1 - kA), sway * (1 - kA) + aim.y * (1 - kA), 0);
      idle = kA < 0.5;
      if (scrolled) shadows = true;
    } else {
      pivot.visible = false;
    }

    placeCamera(p);
    if (shadows) stage.invalidateShadows();
    lastG = g;
    lastP = p;
    return idle && !reduce.matches;
  }

  let lastTime = 0;
  // While the story is off screen, nothing is drawn: the state jumps straight to the scroll position,
  // so the rest of the page scrolls freely and the story is already in place when it comes back.
  let storyVisible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      storyVisible = e.isIntersecting;
      if (storyVisible) stage.invalidate();
    }).observe(story);
  }

  stage.addTicker((dt, time) => {
    lastTime = time;
    if (!storyVisible) { shown = target; velocity = 0; return false; }
    if (reduce.matches) { shown = target; velocity = 0; } else shown = smoothDamp(shown, target, Math.max(dt, 1 / 240));
    if (Math.abs(target - shown) < 0.00003 && Math.abs(velocity) < 0.0005) { shown = target; velocity = 0; }
    const moving = shown !== lastP;
    if (moving) {
      updateCaptions(shown);
      updateHud(shown, gameTime(shown));
    }
    const idle = apply(shown, time, dt);
    return moving || idle;
  });

  // First frame, then reveal, then the set builds in the background.
  apply(shown, 0, 0.016);
  renderer.compile(scene, camera);
  stage.invalidate();
  document.documentElement.classList.add('ready');

  await pause();
  const set = await buildSet(materials, trace, stage.quality, pause);
  scene.add(set.group);
  tracks = buildTimeline(set.pieces);
  king = tracks.find((t) => t.type === 'k' && t.color === 'black');
  lastG = -1;
  apply(shown, lastTime, 0.016);
  stage.invalidateShadows();

  // Debug: draw any point of the story immediately.
  function seek(p) {
    target = shown = p;
    updateCaptions(p);
    updateHud(p, gameTime(p));
    lastG = -1;
    apply(p, lastTime, 0.016);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }
  window.__story = { stage, set, tracks, seek, get progress() { return shown; }, gameTime };
}

start3D().catch((err) => {
  console.error(err);
  document.documentElement.classList.add('no-webgl');
  // Captions still follow the scroll without 3D.
  const loop = () => {
    shown = target;
    updateCaptions(shown);
    updateHud(shown, gameTime(shown));
    requestAnimationFrame(loop);
  };
  loop();
});
