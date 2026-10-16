// The club medallion: a 3D build of the Roosevelt Island Chess Club logo.
// Radius 1, facing +z, centred on the origin.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { Profile } from './profile.js';
import { knightSDF } from './pieces.js';
import { meshFromSDF, smoothstep } from './sdf.js';

const FIELD = 0.05;      // height of the orange face
const BACK = -0.07;      // back face

function body(seg) {
  const p = new Profile();
  p.M(0, BACK).L(0.97, BACK).Q(0.99, BACK, 0.99, -0.05).L(0.99, 0.05);
  p.Q(0.99, 0.08, 0.96, 0.08).L(0.945, 0.08);
  p.C(0.925, 0.08, 0.92, 0.052, 0.9, FIELD).L(0, FIELD);
  return p.lathe(seg, 0.004);
}

// Coin edge with fine reeding. Normals are written analytically so the grooves stay seamless.
function reededEdge(N = 240, segments = 960) {
  const p = new Profile();
  p.M(0.984, -0.058).L(1.0, -0.05).L(1.0, 0.05).L(0.984, 0.058);
  const g = new THREE.LatheGeometry(p.points(0.003).map((v) => v), segments);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const a = 0.0065;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.999) continue;
    const phi = Math.atan2(x, z);
    const w = smoothstep(0.05, 0.036, Math.abs(y));
    const rr = r - a * w * 0.5 * (1 - Math.cos(N * phi));
    const dr = -a * w * 0.5 * N * Math.sin(N * phi);
    const s = Math.sin(phi), c = Math.cos(phi);
    pos.setXYZ(i, rr * s, y, rr * c);
    const nx = s - (dr / rr) * c, nz = c + (dr / rr) * s;
    const l = Math.hypot(nx, nz);
    nor.setXYZ(i, nx / l, 0, nz / l);
  }
  return g;
}

// Drawn outer wall first so the lathe normals face outward.
function ring(r0, r1, z0, top) {
  const p = new Profile();
  const half = (r1 - r0) / 2;
  p.M(r1, z0).L(r1, top - half * 0.6);
  p.C(r1, top + half * 0.55, r0, top + half * 0.55, r0, top - half * 0.6);
  p.L(r0, z0);
  return new THREE.LatheGeometry(p.points(0.004), 160);
}

// Clip a polygon against a convex polygon (Sutherland–Hodgman).
function clipConvex(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
    const inter = (p, q) => {
      const A1 = q.y - p.y, B1 = p.x - q.x, C1 = A1 * p.x + B1 * p.y;
      const A2 = b.y - a.y, B2 = a.x - b.x, C2 = A2 * a.x + B2 * a.y;
      const det = A1 * B2 - A2 * B1;
      return new THREE.Vector2((B2 * C1 - B1 * C2) / det, (A1 * C2 - A2 * C1) / det);
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(inter(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(inter(prev, cur));
      }
    }
    if (!out.length) break;
  }
  return out;
}

const polyArea = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
};

function checkers(limitR = 0.785, size = 0.2) {
  const circle = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    circle.push(new THREE.Vector2(Math.cos(a) * limitR, Math.sin(a) * limitR));
  }
  const parts = [];
  const bands = [[0.16, 0.8], [-0.8, -0.26]];
  for (let j = -5; j < 5; j++) {
    for (let i = -5; i < 5; i++) {
      if ((i + j) % 2 !== 0) continue;
      const x0 = i * size, y0 = j * size, x1 = x0 + size, y1 = y0 + size;
      const cy = (y0 + y1) / 2;
      if (!bands.some(([a, b]) => cy > a && cy < b)) continue;
      const sq = [new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)];
      const poly = clipConvex(sq, circle);
      if (poly.length < 3 || polyArea(poly) < size * size * 0.18) continue;
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly), {
        depth: 0.006, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelOffset: -0.005, bevelSegments: 3, curveSegments: 2,
      });
      parts.push(g);
    }
  }
  const g = mergeGeometries(parts);
  g.computeBoundingBox();
  g.translate(0, 0, FIELD - 0.004 - g.boundingBox.min.z);
  return g;
}

async function loadFont(url) {
  const json = await new TTFLoader().loadAsync(url);
  return new Font(json);
}

// Raised lettering. Neighbouring glyphs get slightly different heights so overlapping script joins never flicker.
function lettering(font, text, { width, centerY, z0, depth, bevel, curveSegments = 10 }) {
  // Measure at size 1, then build at the final size so bevels keep their real proportions.
  let minX = Infinity, maxX = -Infinity;
  for (const s of font.generateShapes(text, 1)) {
    for (const p of s.getPoints(4)) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
  }
  const shapes = font.generateShapes(text, width / (maxX - minX));
  const parts = shapes.map((s, i) => new THREE.ExtrudeGeometry(s, {
    depth: depth + (i % 2) * 0.0025,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelOffset: -bevel * 0.3,
    bevelSegments: 3,
    curveSegments,
  }));
  const g = mergeGeometries(parts);
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(-(bb.min.x + bb.max.x) / 2, centerY - (bb.min.y + bb.max.y) / 2, z0 - bb.min.z);
  return g;
}

function plate(w, h, r, z0, depth) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelOffset: -0.008, bevelSegments: 4, curveSegments: 8,
  });
  g.computeBoundingBox();
  g.translate(0, 0, z0 - g.boundingBox.min.z);
  return g;
}

export async function buildMedallion({ materials, fontBase, quality = 'high' }) {
  const hi = quality === 'high';
  const [script, sans] = await Promise.all([
    loadFont(`${fontBase}/kaushan-script/KaushanScript-Regular.ttf`),
    loadFont(`${fontBase}/fira-sans/FiraSans-SemiBold.ttf`),
  ]);

  const group = new THREE.Group();
  const add = (geo, mat, rotateLathe = false) => {
    if (rotateLathe) geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Lathe parts are built around Y with height as the profile's y, then turned to face +z.
  add(body(hi ? 160 : 112), materials.enamel, true);
  add(reededEdge(240, hi ? 960 : 720), materials.ivorySatin, true);
  add(ring(0.8, 0.87, 0.045, 0.085), materials.ivory, true);
  const backRing = ring(0.8, 0.87, 0.045, 0.085);
  backRing.rotateX(-Math.PI / 2);
  backRing.translate(0, 0, BACK + 0.005 + 0.045);
  add(backRing, materials.ivory);

  add(checkers(), materials.checker);

  // The knight on its stand, sculpted from the same drawing as the chess piece.
  const S = 0.48;
  const knight = meshFromSDF(
    knightSDF({ pedestal: true, front: true }),
    new THREE.Vector3(-0.12, 0.48, 0),
    0.72,
    hi ? 112 : 88,
    260000,
  );
  knight.scale(S, S, S);
  const backKnight = knight.clone();
  knight.translate(0.06, 0.2, FIELD);
  add(knight, materials.ivory);

  // A smaller knight on the back, above the founding year.
  backKnight.scale(0.62, 0.62, 0.62);
  backKnight.rotateY(Math.PI);
  backKnight.translate(-0.037, 0.13, BACK);
  add(backKnight, materials.ivory);

  // Lettering.
  add(lettering(script, 'Roosevelt Island', { width: 1.74, centerY: -0.08, z0: 0.06, depth: 0.03, bevel: 0.011 }), materials.ivory);
  const plateGeo = plate(1.0, 0.25, 0.08, FIELD - 0.004, 0.026);
  plateGeo.translate(0, -0.43, 0);
  add(plateGeo, materials.enamel);
  add(lettering(sans, 'Chess Club', { width: 0.66, centerY: -0.43, z0: 0.08, depth: 0.018, bevel: 0.008, curveSegments: 8 }), materials.ivory);

  const est = lettering(sans, 'EST. 2025', { width: 0.5, centerY: -0.2, z0: 0, depth: 0.014, bevel: 0.006, curveSegments: 8 });
  est.rotateY(Math.PI);
  est.translate(0, 0, BACK + 0.002);
  add(est, materials.ivory);

  return group;
}
