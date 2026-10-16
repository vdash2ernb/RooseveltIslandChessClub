// Staunton-style chess pieces, built entirely from our own drawings.
// Units: one board square = 1. Every piece stands on y = 0.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Profile, setProfileDensity } from './profile.js';
import { DETAIL } from './stage.js';
import {
  polygonDistanceGrid, meshFromSDF, roundedExtrude, smoothstep, smin, smax,
} from './sdf.js';
import { toLoops, bounds } from './logo.js';

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

// The knight's head comes from the club logo (tools/trace_logo.py). Its closed silhouette
// gives the form, and the logo's detail lines (eye, nostril, mouth, jaw, mane locks) are
// carved into both sides. Head units: neck base at y = 0, ear tip at 1.16, facing -x.
const HEAD_HEIGHT = 1.16;

function headTransform(trace) {
  const b = bounds(trace.knightClosed);
  const s = HEAD_HEIGHT / (b.maxY - b.minY);
  const cx = (b.minX + b.maxX) / 2;
  return (x, y) => [(x - cx) * s - 0.16, (y - b.minY) * s];
}

let knightCache = null;
function knightFields(trace) {
  if (knightCache) return knightCache;
  const f = headTransform(trace);
  const neckBase = bounds(trace.knightClosed).minY;
  const head = trace.knight.filter((s) => Math.max(...s.outer.map((p) => p[1])) > neckBase + 0.02);
  const closed = polygonDistanceGrid(toLoops(trace.knightClosed, f, { holes: false }), 0.14, 280, 0.2);
  const open = polygonDistanceGrid(toLoops(head, f), 0.06, 320, 0.05);
  let tip = [0, -Infinity];
  for (const s of trace.knightClosed) for (const p of s.outer) {
    const q = f(p[0], p[1]);
    if (q[1] > tip[1]) tip = q;
  }
  knightCache = { closed, open, tip };
  return knightCache;
}

export function knightSDF(trace) {
  const { closed, open, tip } = knightFields(trace);
  return (x, y, z) => {
    const d2 = closed.sample(x, y);
    let w = 0.165;
    w -= 0.06 * smoothstep(-0.3, -0.7, x);
    w -= 0.085 * smoothstep(tip[1] - 0.18, tip[1] - 0.02, y);
    w += 0.015 * smoothstep(0.35, 0.0, y);
    w *= 0.7 + 0.3 * smoothstep(0.0, 0.16, -d2);
    // The logo's detail lines, carved in.
    const groove = smoothstep(-0.012, 0.01, open.sample(x, y)) * smoothstep(-0.005, -0.035, d2);
    w -= 0.042 * groove;
    let d = roundedExtrude(d2, z, w, Math.min(0.07, 0.85 * w));
    // Split the ear tip into a pair.
    const slab = Math.max(Math.abs(z) - 0.013, tip[1] - 0.17 - y, Math.abs(x - tip[0]) - 0.12);
    return smax(d, -slab, 0.012);
  };
}

export function knightHeadGeometry(trace, res = 120, zScale = 2) {
  const g = meshFromSDF(knightSDF(trace), new THREE.Vector3(-0.16, 0.58, 0), 0.66, res, 160000, zScale);
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

// `pause` is awaited between the heavy steps so the page stays responsive while loading.
export async function buildPieceGeometries(trace, quality = 'high', pause = async () => {}) {
  const { seg, mc, curve, knightZ, knightRes } = DETAIL[quality] || DETAIL.high;
  setProfileDensity(curve);

  knightFields(trace);
  await pause();
  const knightHead = knightHeadGeometry(trace, knightRes, knightZ);
  knightHead.scale(0.72, 0.72, 0.72);
  knightHead.translate(0, 0.33, 0);
  await pause();

  const mitre = mitreGeometry(Math.round(64 * mc));
  mitre.translate(0, 0.78, 0);
  await pause();

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
