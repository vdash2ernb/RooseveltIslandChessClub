// "Your move": a mate-in-one on the 3D board. White plays Rd8#, the same move that ends the Opera Game.
// Every square is a real button laid over the canvas, so the puzzle works by touch, mouse and keyboard.

import * as THREE from 'three';
import { createStage } from './rc3d/stage.js';
import { buildMaterials } from './rc3d/materials.js';
import { buildBoard, buildSet, squareToXZ } from './rc3d/board.js';
import { loadLogoTrace } from './rc3d/logo.js';

const LAYOUT = {
  white: { k: ['g1'], r: ['d1'], p: ['a2', 'b2', 'f2', 'g2', 'h2'] },
  black: { k: ['g8'], p: ['a7', 'b7', 'f7', 'g7', 'h7'] },
};

// White's legal moves in this position.
const MOVES = {
  d1: ['d2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'c1', 'b1', 'a1', 'e1', 'f1'],
  g1: ['f1', 'h1'],
  a2: ['a3', 'a4'], b2: ['b3', 'b4'], f2: ['f3', 'f4'], g2: ['g3', 'g4'], h2: ['h3', 'h4'],
};
const SOLUTION = ['d1', 'd8'];
const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

const pause = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 60); });
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function easeOutBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export async function startPuzzle(section) {
  if (section.dataset.started) return;
  section.dataset.started = 'true';
  const stageEl = section.querySelector('.puzzle-stage');
  const canvas = section.querySelector('#puzzle-canvas');
  const hits = section.querySelector('.puzzle-hits');
  const status = section.querySelector('#puzzle-status');
  const btn = (act) => section.querySelector(`[data-act="${act}"]`);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!document.createElement('canvas').getContext('webgl2')) throw new Error('WebGL 2 is not available');

  const stage = createStage(canvas, { shadowsOnDemand: true });
  const { scene, camera, renderer } = stage;
  const [materials, trace] = await Promise.all([
    buildMaterials({ renderer }),
    loadLogoTrace('assets/data/logo-trace.json'),
  ]);
  scene.add(buildBoard(materials));
  const set = await buildSet(materials, trace, stage.quality, pause, LAYOUT);
  scene.add(set.group);

  const bySquare = new Map(set.pieces.map((p) => [p.userData.square, p]));
  const home = new Map(set.pieces.map((p) => [p, p.position.clone()]));
  const blackKing = bySquare.get('g8');
  const kingQuat = blackKing.quaternion.clone();

  // Camera: a high three-quarter view from White's side, pulled back until the whole board,
  // frame corners included, fits inside the canvas with a margin. Works at any canvas size.
  const target = new THREE.Vector3(0, -0.1, 0.1);
  const dir = new THREE.Vector3(0, 10.6, 7.9).normalize();
  const E = 4.72, T = 0.44;
  const fitPoints = [
    [-E, 0, -E], [E, 0, -E], [-E, 0, E], [E, 0, E],
    [-E, -T, E], [E, -T, E],
    [-3.5, 1.2, -3.5], [3.5, 1.2, -3.5], [0, 1.8, -3.5],
  ].map((p) => new THREE.Vector3(...p));
  const probe = new THREE.Vector3();
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.fov = 30;
    camera.updateProjectionMatrix();
    let d = 14;
    for (let i = 0; i < 6; i++) {
      camera.position.copy(target).addScaledVector(dir, d);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      let reach = 0;
      for (const p of fitPoints) {
        probe.copy(p).project(camera);
        reach = Math.max(reach, Math.abs(probe.x), Math.abs(probe.y));
      }
      d *= reach / 0.94;
    }
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    placeButtons();
    stage.invalidate();
  }

  // ---------------------------------------------------------------- square buttons
  const files = 'abcdefgh';
  const buttons = new Map();
  for (let r = 8; r >= 1; r--) {
    for (const f of files) {
      const sq = f + r;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sq-btn';
      b.dataset.sq = sq;
      b.hidden = true;
      b.addEventListener('click', () => onSquare(sq));
      hits.appendChild(b);
      buttons.set(sq, b);
    }
  }
  const v = new THREE.Vector3();
  const toPx = (x, z, w, h) => {
    v.set(x, 0, z).project(camera);
    return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
  };
  function placeButtons() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const [sq, b] of buttons) {
      const c = squareToXZ(sq);
      const [cx, cy] = toPx(c.x, c.z, w, h);
      const [lx] = toPx(c.x - 0.5, c.z, w, h), [rx] = toPx(c.x + 0.5, c.z, w, h);
      const [, ty] = toPx(c.x, c.z - 0.5, w, h), [, by] = toPx(c.x, c.z + 0.5, w, h);
      b.style.left = `${cx}px`;
      b.style.top = `${cy}px`;
      b.style.width = `${(rx - lx) * 0.94}px`;
      b.style.height = `${(by - ty) * 0.94}px`;
    }
  }

  // ---------------------------------------------------------------- state
  let selected = null;
  let busy = false;
  let solved = false;

  const label = (sq) => {
    const p = bySquare.get(sq);
    return p ? `${p.userData.color} ${NAMES[p.userData.type]} on ${sq}` : sq;
  };

  function refresh() {
    btn('hint').disabled = busy;
    btn('answer').disabled = busy;
    btn('reset').disabled = busy;
    for (const [sq, b] of buttons) {
      const piece = bySquare.get(sq);
      const selectable = !solved && !busy && piece && piece.userData.color === 'white' && MOVES[sq];
      const dest = !solved && !busy && selected && MOVES[selected].includes(sq);
      b.hidden = !(selectable || dest);
      b.classList.toggle('dest', !!dest);
      b.classList.toggle('selected', sq === selected);
      b.setAttribute('aria-label', dest ? `Move ${label(selected)} to ${sq}` : `Select ${label(sq)}`);
      b.setAttribute('aria-pressed', sq === selected ? 'true' : 'false');
    }
  }

  function say(text, win = false) {
    status.textContent = text;
    status.classList.toggle('win', win);
  }

  // ---------------------------------------------------------------- animation
  const tweens = new Set();
  function tween(dur, step) {
    return new Promise((resolve) => {
      const t = { k: 0, dur: reduce.matches ? 0.001 : dur, step, resolve };
      tweens.add(t);
      stage.invalidate();
    });
  }
  stage.addTicker((dt) => {
    if (!tweens.size) return false;
    for (const t of [...tweens]) {
      t.k = Math.min(1, t.k + dt / t.dur);
      t.step(t.k);
      if (t.k >= 1) { tweens.delete(t); t.resolve(); }
    }
    stage.invalidateShadows();
    return true;
  });

  function lift(piece, up) {
    const y0 = piece.position.y, y1 = up ? 0.28 : 0;
    return tween(0.4, (k) => { piece.position.y = y0 + (y1 - y0) * ease(k); });
  }

  function slide(piece, to) {
    const a = piece.position.clone();
    const b = squareToXZ(to);
    const y0 = a.y;
    return tween(1.0, (k) => {
      const e = ease(k);
      piece.position.x = a.x + (b.x - a.x) * e;
      piece.position.z = a.z + (b.z - a.z) * e;
      piece.position.y = y0 * (1 - e) + Math.sin(Math.PI * k) * 0.45;
    });
  }

  const tipDir = new THREE.Vector3(1, 0, -0.25).normalize();
  const tipAxis = new THREE.Vector3(tipDir.z, 0, -tipDir.x);
  const kingHome = home.get(blackKing).clone();
  const pivot = kingHome.clone().addScaledVector(tipDir, 0.34);
  const q = new THREE.Quaternion(), off = new THREE.Vector3();
  function tipKing(amount) {
    q.setFromAxisAngle(tipAxis, amount * THREE.MathUtils.degToRad(84));
    off.copy(kingHome).sub(pivot).applyQuaternion(q);
    blackKing.position.copy(pivot).add(off);
    blackKing.quaternion.copy(q).multiply(kingQuat);
    blackKing.userData.blob.visible = amount < 0.05;
  }

  // ---------------------------------------------------------------- moves
  async function play(from, to) {
    busy = true;
    selected = null;
    refresh();
    const piece = bySquare.get(from);
    await slide(piece, to);
    bySquare.delete(from);
    bySquare.set(to, piece);
    piece.userData.square = to;

    if (from === SOLUTION[0] && to === SOLUTION[1]) {
      solved = true;
      say('Checkmate! The rook on d8 attacks the black king, and the king's own pawns block every way out. Paul Morphy won his famous 1858 game with this same move.', true);
      await tween(1.6, (k) => tipKing(easeOutBounce(k)));
      btn('hint').hidden = true;
      btn('answer').hidden = true;
      btn('reset').hidden = false;
      busy = false;
      refresh();
      btn('reset').focus();
      return;
    }

    const type = piece.userData.type;
    say(type === 'r'
      ? `Rook to ${to} is a safe move, but it isn't checkmate yet. Look at the top row, where the black king is.`
      : type === 'p'
        ? 'A pawn move won't end the game. Which white piece can reach the top row?'
        : 'Your king is already safe. Try another piece.');
    await new Promise((r) => setTimeout(r, reduce.matches ? 200 : 1600));
    await slide(piece, from);
    piece.position.y = 0;
    bySquare.delete(to);
    bySquare.set(from, piece);
    piece.userData.square = from;
    busy = false;
    refresh();
  }

  async function onSquare(sq) {
    if (busy || solved) return;
    if (selected && MOVES[selected].includes(sq)) {
      const piece = bySquare.get(selected);
      piece.position.y = 0;
      await play(selected, sq);
      return;
    }
    const piece = bySquare.get(sq);
    if (!piece || piece.userData.color !== 'white') return;
    if (selected) await lift(bySquare.get(selected), false);
    if (selected === sq) {
      selected = null;
      say('Pick a white piece to start.');
    } else {
      selected = sq;
      await lift(piece, true);
      say(`${NAMES[piece.userData.type][0].toUpperCase()}${NAMES[piece.userData.type].slice(1)} on ${sq} selected. Where should it go?`);
    }
    refresh();
  }

  btn('hint').addEventListener('click', () => {
    say('Hint: the black king can't step forward, because its own pawns are in the way. Which white piece can reach the top row?');
    buttons.get('d1').focus();
  });
  btn('answer').addEventListener('click', async () => {
    if (busy || solved) return;
    if (selected && selected !== 'd1') await lift(bySquare.get(selected), false);
    selected = 'd1';
    await play('d1', 'd8');
  });
  btn('reset').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    refresh();
    const rook = bySquare.get('d8');
    if (rook) {
      bySquare.delete('d8');
      bySquare.set('d1', rook);
      rook.userData.square = 'd1';
      tipKing(0);
      await slide(rook, 'd1');
      rook.position.y = 0;
    }
    solved = false;
    busy = false;
    btn('hint').hidden = false;
    btn('answer').hidden = false;
    btn('reset').hidden = true;
    say('Pick a white piece to start.');
    refresh();
    buttons.get('d1').focus();
  });

  // Debug: finish any running animation immediately (useful where animation frames are paused).
  window.__puzzle = {
    flush() {
      for (const t of [...tweens]) { t.step(1); tweens.delete(t); t.resolve(); }
      stage.invalidateShadows();
    },
  };

  new ResizeObserver(frame).observe(canvas);
  frame();
  refresh();
  stage.invalidateShadows();
  renderer.compile(scene, camera);
  stageEl.classList.add('ready');
}
