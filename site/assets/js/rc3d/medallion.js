// The club medallion: the Roosevelt Island Chess Club logo in 3D.
// Every shape on the face comes from the club's own logo, traced by tools/trace_logo.py:
// the script lettering with the swash under the R, "Chess Club", the knight and its collar,
// the orange halos that cut through the rings and checkers, and the ring and checker layout.
// Radius 1, facing +z, centred on the origin.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { Profile } from './profile.js';
import { meshFromSDF, polygonDistanceGrid, smoothstep } from './sdf.js';
import { toShapes, toLoops, bounds } from './logo.js';

const FIELD = 0.05;      // the orange face
const BACK = -0.07;      // back face
const HALO_TOP = 0.097;  // orange cut-outs sit just above the rings and checkers
const RELIEF = 0.075;    // knight relief height above its halo

function body(seg) {
  const p = new Profile();
  p.M(0, BACK).L(0.97, BACK).Q(0.99, BACK, 0.99, -0.05).L(0.99, 0.035);
  p.Q(0.99, FIELD, 0.965, FIELD).L(0, FIELD);
  return p.lathe(seg, 0.004);
}

// Coin edge with fine reeding. Normals are written analytically so the grooves stay seamless.
function reededEdge(N = 240, segments = 960) {
  const p = new Profile();
  p.M(0.984, -0.058).L(1.0, -0.05).L(1.0, 0.04).L(0.984, 0.046);
  const g = new THREE.LatheGeometry(p.points(0.003), segments);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const a = 0.0065;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.999) continue;
    const phi = Math.atan2(x, z);
    const w = smoothstep(0.05, 0.036, Math.abs(y + 0.005));
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

// A raised half-round ring. Drawn outer wall first so the lathe normals face outward.
function ring(r0, r1, z0, top) {
  const p = new Profile();
  const half = (r1 - r0) / 2;
  p.M(r1, z0).L(r1, top - half * 0.7);
  p.C(r1, top + half * 0.45, r0, top + half * 0.45, r0, top - half * 0.7);
  p.L(r0, z0);
  return new THREE.LatheGeometry(p.points(0.003), 200);
}

// Clip a polygon against a convex polygon (Sutherland-Hodgman).
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

// Bevelled checker tiles on the logo's own grid, clipped to the inner ring.
function checkers(ch) {
  const circle = [];
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    circle.push(new THREE.Vector2(Math.cos(a) * ch.clip, Math.sin(a) * ch.clip));
  }
  const parts = [];
  const gap = 0.004;
  for (let r = -6; r <= 5; r++) {
    for (let c = -5; c <= 5; c++) {
      if (Math.abs((c + r) % 2) !== ch.whiteParity) continue;
      const x0 = ch.originX + c * ch.size + gap, y0 = ch.originY + r * ch.size + gap;
      const x1 = x0 + ch.size - 2 * gap, y1 = y0 + ch.size - 2 * gap;
      const sq = [new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)];
      const poly = clipConvex(sq, circle);
      if (poly.length < 3 || polyArea(poly) < ch.size * ch.size * 0.04) continue;
      parts.push(new THREE.ExtrudeGeometry(new THREE.Shape(poly), {
        depth: 0.005, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelOffset: -0.008, bevelSegments: 3, curveSegments: 2,
      }));
    }
  }
  return placeOn(mergeGeometries(parts), FIELD - 0.004);
}

function placeOn(g, z0) {
  g.computeBoundingBox();
  g.translate(0, 0, z0 - g.boundingBox.min.z);
  return g;
}

function extrude(shapes, z0, depth, bevel, offsetRatio = 0.5) {
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel * offsetRatio,
    bevelSegments: 3,
    curveSegments: 1,
  });
  return placeOn(g, z0);
}

// Neighbouring script shapes get slightly different heights so overlapping joins never flicker.
function extrudeEach(shapes, z0, depth, bevel) {
  return mergeGeometries(shapes.map((s, i) => extrude([s], z0, depth + (i % 2) * 0.002, bevel)));
}

// The knight as a soft relief: higher where the shape is wide, rounded down to the halo at its edges.
// The logo's detail lines are gaps in the traced shape, so they come out as carved orange channels.
function knightRelief(trace, base, quality) {
  const loops = toLoops(trace.knight);
  const b = bounds(trace.knight);
  const grid = polygonDistanceGrid(loops, 0.02, quality === 'high' ? 420 : 300, 0.1);
  const D = 0.085;
  // A soft dome: steep, rounded edges rising to a smooth crown, never a flat plateau.
  // The underside is left open: it sits inside the orange halo and is never seen.
  const sdf = (x, y, z) => {
    const d2 = grid.sample(x, y);
    const t = Math.min(1, Math.max(0, -d2 / D));
    const h = RELIEF * Math.pow(Math.sin(t * Math.PI / 2), 0.7);
    return Math.max(d2, z - (base + h));
  };
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const half = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2 + 0.02;
  const zScale = 2;
  const zBottom = base - 0.008;
  return meshFromSDF(sdf, new THREE.Vector3(cx, cy, zBottom + half / zScale), half, quality === 'high' ? 140 : 104, 420000, zScale);
}

async function loadFont(url) {
  const json = await new TTFLoader().loadAsync(url);
  return new Font(json);
}

function backLettering(font, text, width, centerY, z0) {
  let minX = Infinity, maxX = -Infinity;
  for (const s of font.generateShapes(text, 1)) for (const p of s.getPoints(4)) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
  }
  const g = new THREE.ExtrudeGeometry(font.generateShapes(text, width / (maxX - minX)), {
    depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.0036, bevelOffset: -0.0018, bevelSegments: 3, curveSegments: 8,
  });
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(-(bb.min.x + bb.max.x) / 2, centerY - (bb.min.y + bb.max.y) / 2, z0 - bb.min.z);
  return g;
}

export async function buildMedallion({ materials, trace, fontBase, quality = 'high', onStep }) {
  const hi = quality === 'high';
  const step = async () => { if (onStep) await onStep(); };
  const group = new THREE.Group();
  const add = (geo, mat, rotateLathe = false) => {
    if (rotateLathe) geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Body, edge and the logo's two rings.
  add(body(hi ? 160 : 112), materials.enamel, true);
  add(reededEdge(240, hi ? 960 : 720), materials.ivorySatin, true);
  const [outer, inner] = trace.rings;
  add(ring(outer[0], outer[1], FIELD - 0.005, 0.08), materials.ivory, true);
  add(ring(inner[0], inner[1], FIELD - 0.005, 0.076), materials.ivory, true);
  add(checkers(trace.checker), materials.checker);
  await step();

  // Orange cut-outs around the lettering and the knight, as in the logo.
  const haloDepth = HALO_TOP - FIELD - 0.008;
  add(extrude(toShapes(trace.scriptHalo), FIELD - 0.004, haloDepth, 0.004, 1), materials.enamel);
  add(extrude(toShapes(trace.chessClubHalo), FIELD - 0.004, haloDepth, 0.004, 1), materials.enamel);
  add(extrude(toShapes(trace.knightHalo), FIELD - 0.004, haloDepth, 0.004, 1), materials.enamel);

  // The lettering, exactly as drawn in the logo, including the swash under the R.
  add(extrudeEach(toShapes(trace.script), HALO_TOP - 0.006, 0.018, 0.007), materials.ivory);
  add(extrudeEach(toShapes(trace.chessClub), HALO_TOP - 0.006, 0.014, 0.006), materials.ivory);
  await step();

  // The knight and its collar.
  const knight = knightRelief(trace, HALO_TOP - 0.004, quality);
  add(knight, materials.ivory);
  await step();

  // Back: the knight again, smaller, over the founding year.
  const backKnight = knight.clone();
  const kb = bounds(trace.knight);
  backKnight.translate(-(kb.minX + kb.maxX) / 2, -(kb.minY + kb.maxY) / 2, -(HALO_TOP - 0.004));
  backKnight.scale(0.72, 0.72, 0.72);
  backKnight.rotateY(Math.PI);
  backKnight.translate(0, 0.16, BACK);
  add(backKnight, materials.ivory);
  const backRing = ring(inner[0], inner[1], 0.045, 0.072);
  backRing.rotateX(-Math.PI / 2);
  backRing.translate(0, 0, BACK + 0.005 + 0.045);
  add(backRing, materials.ivory);
  const sans = await loadFont(`${fontBase}/fira-sans/FiraSans-SemiBold.ttf`);
  const est = backLettering(sans, 'EST. 2025', 0.42, -0.24, 0);
  est.rotateY(Math.PI);
  est.translate(0, 0, BACK + 0.002);
  add(est, materials.ivory);

  return group;
}
