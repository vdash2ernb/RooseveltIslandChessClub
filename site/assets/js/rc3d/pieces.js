// Staunton-style chess pieces, built entirely from our own drawings.
// Units: one board square = 1. Every piece stands on y = 0.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Profile } from './profile.js';
import {
  polygonDistanceGrid, meshFromSDF, roundedExtrude, smoothstep, smin, smax,
} from './sdf.js';

// ---------------------------------------------------------------- shared base

function base(p, R) {
  p.M(0, 0).L(R, 0).L(R, 0.032);
  p.C(R + 0.016, 0.045, R + 0.012, 0.1, R * 0.84, 0.118);
  p.L(R * 0.8, 0.124);
  p.C(R * 0.69, 0.13, R * 0.69, 0.165, R * 0.76, 0.172);
  p.bead(0.205, 0.022);
  return p;
}

// ---------------------------------------------------------------- profiles

function pawnProfile() {
  const p = base(new Profile(), 0.25);
  p.L(0.17, 0.215);
  p.C(0.12, 0.26, 0.095, 0.38, 0.092, 0.455);
  p.L(0.175, 0.47);
  p.bead(0.505, 0.012);
  p.L(0.085, 0.515);
  p.L(0.082, 0.5368);
  p.A(0, 0.66, 90);
  return p;
}

function rookProfile() {
  const p = base(new Profile(), 0.3);
  p.L(0.21, 0.215);
  p.C(0.18, 0.3, 0.172, 0.45, 0.185, 0.56);
  p.L(0.235, 0.575);
  p.bead(0.61, 0.012);
  p.L(0.214, 0.62);
  p.C(0.21, 0.7, 0.222, 0.8, 0.245, 0.858);
  p.L(0.245, 0.87);
  p.L(0.163, 0.87);
  p.L(0.163, 0.83);
  p.L(0, 0.83);
  return p;
}

function knightBaseProfile() {
  const p = base(new Profile(), 0.31);
  p.L(0.215, 0.215);
  p.C(0.19, 0.25, 0.18, 0.29, 0.185, 0.31);
  p.L(0.245, 0.32);
  p.bead(0.35, 0.012);
  p.L(0.2, 0.36);
  p.L(0, 0.36);
  return p;
}

function bishopProfile() {
  const p = base(new Profile(), 0.3);
  p.L(0.205, 0.215);
  p.C(0.14, 0.3, 0.1, 0.55, 0.098, 0.66);
  p.L(0.19, 0.675);
  p.bead(0.705, 0.012);
  p.L(0.13, 0.715);
  p.bead(0.745, 0.012);
  p.L(0.07, 0.755);
  p.L(0.07, 0.8);
  p.L(0, 0.8);
  return p;
}

function queenProfile() {
  const p = base(new Profile(), 0.33);
  p.L(0.225, 0.215);
  p.C(0.15, 0.32, 0.105, 0.7, 0.1, 0.84);
  p.L(0.2, 0.855);
  p.bead(0.885, 0.013);
  p.L(0.14, 0.895);
  p.bead(0.925, 0.012);
  p.L(0.09, 0.935);
  p.C(0.085, 1.02, 0.15, 1.12, 0.215, 1.2);
  p.L(0.215, 1.215);
  p.L(0.17, 1.225);
  p.C(0.15, 1.265, 0.1, 1.29, 0.06, 1.3);
  p.L(0.03, 1.31);
  p.L(0.03, 1.3289);
  p.A(0, 1.375, 90);
  return p;
}

function kingProfile() {
  const p = base(new Profile(), 0.34);
  p.L(0.23, 0.215);
  p.C(0.16, 0.33, 0.115, 0.8, 0.11, 0.95);
  p.L(0.21, 0.965);
  p.bead(0.995, 0.013);
  p.L(0.15, 1.005);
  p.bead(1.035, 0.012);
  p.L(0.095, 1.045);
  p.C(0.09, 1.13, 0.16, 1.24, 0.225, 1.31);
  p.L(0.225, 1.325);
  p.L(0.19, 1.335);
  p.C(0.16, 1.38, 0.1, 1.405, 0.06, 1.41);
  p.L(0.05, 1.415);
  p.L(0.05, 1.44);
  p.L(0, 1.44);
  return p;
}

// ---------------------------------------------------------------- knight head

// Our own drawing of the knight's head, facing -x. Head units: neck base at y = 0, ear tip near 1.16.
export function knightSilhouette() {
  const s = new THREE.Shape();
  s.moveTo(0.3, 0.0);
  s.lineTo(-0.25, 0.0);
  s.bezierCurveTo(-0.29, 0.1, -0.31, 0.22, -0.26, 0.32);       // chest
  s.bezierCurveTo(-0.235, 0.37, -0.2, 0.39, -0.19, 0.42);      // throat
  s.bezierCurveTo(-0.26, 0.4, -0.4, 0.34, -0.5, 0.33);         // jaw line
  s.bezierCurveTo(-0.56, 0.33, -0.6, 0.36, -0.6, 0.4);         // chin
  s.bezierCurveTo(-0.58, 0.42, -0.57, 0.43, -0.585, 0.445);    // mouth
  s.bezierCurveTo(-0.65, 0.46, -0.68, 0.52, -0.66, 0.57);      // muzzle
  s.bezierCurveTo(-0.64, 0.61, -0.6, 0.63, -0.56, 0.645);      // nostril
  s.bezierCurveTo(-0.46, 0.71, -0.32, 0.82, -0.22, 0.9);       // nose bridge
  s.bezierCurveTo(-0.17, 0.94, -0.13, 0.98, -0.11, 1.02);      // forehead
  s.bezierCurveTo(-0.09, 1.08, -0.06, 1.13, -0.03, 1.16);      // ear front
  s.bezierCurveTo(0.0, 1.12, 0.03, 1.06, 0.05, 1.01);          // ear back
  s.bezierCurveTo(0.08, 0.99, 0.12, 0.98, 0.16, 0.95);         // poll
  s.bezierCurveTo(0.28, 0.85, 0.36, 0.62, 0.36, 0.4);          // crest
  s.bezierCurveTo(0.36, 0.22, 0.32, 0.08, 0.3, 0.0);           // back of neck
  return s.getSpacedPoints(420);
}

let knightGrid = null;
function getKnightGrid() {
  if (!knightGrid) knightGrid = polygonDistanceGrid(knightSilhouette(), 0.12, 260);
  return knightGrid;
}

const boxSDF2 = (x, y, cx, cy, hx, hy, r) => {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

// The knight head as a distance function, in head units.
// opts.thickness scales the depth, opts.pedestal adds the logo's little stand, opts.front keeps only z > -0.03.
export function knightSDF({ thickness = 1, pedestal = false, front = false } = {}) {
  const grid = getKnightGrid();
  const width = (x, y, d2) => {
    let w = 0.165;
    w -= 0.06 * smoothstep(-0.3, -0.66, x);
    w -= 0.085 * smoothstep(0.98, 1.12, y);
    w += 0.015 * smoothstep(0.35, 0.0, y);
    w *= 0.7 + 0.3 * smoothstep(0.0, 0.16, -d2);
    return w * thickness;
  };
  const eye = { x: -0.27, y: 0.79 };
  const eyeZ = width(eye.x, eye.y, grid.sample(eye.x, eye.y));
  const nos = { x: -0.6, y: 0.585 };
  const nosZ = width(nos.x, nos.y, grid.sample(nos.x, nos.y));

  return (x, y, z) => {
    let d2 = grid.sample(x, y);
    if (pedestal) {
      d2 = smin(d2, boxSDF2(x, y, 0.05, -0.05, 0.33, 0.06, 0.02), 0.03);
      d2 = smin(d2, boxSDF2(x, y, 0.05, -0.15, 0.4, 0.045, 0.02), 0.015);
    }
    const w = width(x, y, d2);
    let d = roundedExtrude(d2, z, w, Math.min(0.07 * thickness, 0.85 * w));

    // Eyes and nostrils.
    const ez = Math.abs(z) - eyeZ;
    d = smax(d, -(Math.hypot(x - eye.x, y - eye.y, ez) - 0.038 * thickness), 0.018);
    const nz = Math.abs(z) - nosZ;
    d = smax(d, -(Math.hypot(x - nos.x, y - nos.y, nz) - 0.022 * thickness), 0.012);

    // Split the ears into a pair.
    const slab = Math.max(Math.abs(z) - 0.013 * thickness, 0.995 - y, -0.16 - x);
    d = smax(d, -slab, 0.012);

    // Carved mane along the crest.
    const mask = smoothstep(0.02, 0.2, x) * smoothstep(0.12, 0.3, y) * (1 - smoothstep(0.92, 1.0, y)) * smoothstep(-0.13, -0.02, d2);
    if (mask > 0) d += 0.0055 * thickness * mask * Math.sin((y - x * 0.55) * 50);

    if (front) d = Math.max(d, -z - 0.03);
    return d;
  };
}

export function knightHeadGeometry(res = 100) {
  const g = meshFromSDF(knightSDF(), new THREE.Vector3(-0.16, 0.58, 0), 0.66, res);
  return addPlanarUV(g, 1.4);
}

// ---------------------------------------------------------------- bishop mitre

function mitreSDF() {
  const path = new THREE.Path();
  path.moveTo(0.075, -0.02);
  path.bezierCurveTo(0.12, 0.03, 0.155, 0.09, 0.152, 0.16);
  path.bezierCurveTo(0.15, 0.24, 0.1, 0.31, 0.045, 0.355);
  path.bezierCurveTo(0.03, 0.365, 0.015, 0.37, 0, 0.372);
  const right = path.getSpacedPoints(90);
  const left = right.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y));
  const grid = polygonDistanceGrid([...right, ...left], 0.06, 200);
  const a = THREE.MathUtils.degToRad(50);
  const nx = Math.sin(a), ny = Math.cos(a);
  return (x, y, z) => {
    const r = Math.hypot(x, z);
    let d = grid.sample(r, y);
    d = smin(d, Math.hypot(x, y - 0.43, z) - 0.048, 0.025);
    const plane = Math.abs(x * nx + (y - 0.27) * ny) - 0.016;
    const cut = Math.max(plane, -(x + 0.015), 0.02 - y);
    return smax(d, -cut, 0.008);
  };
}

function mitreGeometry(res = 80) {
  const g = meshFromSDF(mitreSDF(), new THREE.Vector3(0, 0.225, 0), 0.27, res);
  return addPlanarUV(g, 2.2);
}

function addPlanarUV(g, scale) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * scale + pos.getZ(i) * scale * 0.5;
    uv[i * 2 + 1] = pos.getY(i) * scale * 0.25;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---------------------------------------------------------------- small parts

function merlons() {
  const parts = [];
  const n = 5, span = ((Math.PI * 2) / n) * 0.58, rIn = 0.163, rOut = 0.245;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - span / 2, a1 = a0 + span;
    const s = new THREE.Shape();
    s.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
    s.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
    s.absarc(0, 0, rOut, a0, a1, false);
    s.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    s.absarc(0, 0, rIn, a1, a0, true);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.042, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.009, bevelOffset: -0.009, bevelSegments: 4, curveSegments: 18,
    });
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, 0.866 - g.boundingBox.min.y, 0);
  return g;
}

function coronet() {
  const parts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.031, 20, 14);
    s.translate(Math.cos(a) * 0.2, 1.243, Math.sin(a) * 0.2);
    parts.push(s);
  }
  return mergeGeometries(parts);
}

function cross() {
  const s = new THREE.Shape();
  const v = 0.034, h = 0.1, y0 = 0.0, y1 = 0.27, a0 = 0.15, a1 = 0.215, f = 0.008;
  s.moveTo(-v + f, y0);
  s.lineTo(v - f, y0);
  s.lineTo(v, a0);
  s.lineTo(h - f, a0 - f);
  s.lineTo(h, (a0 + a1) / 2);
  s.lineTo(h - f, a1 + f);
  s.lineTo(v, a1);
  s.lineTo(v + f, y1);
  s.lineTo(-v - f, y1);
  s.lineTo(-v, a1);
  s.lineTo(-h + f, a1 + f);
  s.lineTo(-h, (a0 + a1) / 2);
  s.lineTo(-h + f, a0 - f);
  s.lineTo(-v, a0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.045, bevelEnabled: true, bevelThickness: 0.013, bevelSize: 0.012, bevelOffset: -0.012, bevelSegments: 5, curveSegments: 4,
  });
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(0, 1.425, -(bb.min.z + bb.max.z) / 2);
  return g;
}

// ---------------------------------------------------------------- assembly

export function buildPieceGeometries(quality = 'high') {
  const seg = quality === 'high' ? 64 : 44;
  const mc = quality === 'high' ? 1 : 0.75;

  const knightHead = knightHeadGeometry(Math.round(86 * mc));
  knightHead.scale(0.72, 0.72, 0.72);
  knightHead.translate(0, 0.33, 0);

  const mitre = mitreGeometry(Math.round(64 * mc));
  mitre.translate(0, 0.78, 0);

  return {
    p: [pawnProfile().lathe(seg)],
    r: [rookProfile().lathe(seg), merlons()],
    n: [knightBaseProfile().lathe(seg), knightHead],
    b: [bishopProfile().lathe(seg), mitre],
    q: [queenProfile().lathe(seg), coronet()],
    k: [kingProfile().lathe(seg), cross()],
  };
}

export const BASE_RADIUS = { p: 0.25, r: 0.3, n: 0.31, b: 0.3, q: 0.33, k: 0.34 };
