// The club logo, traced into vector outlines by tools/trace_logo.py.
// Coordinates: medallion radius = 1, centre at the logo's ring centre, y up.

import * as THREE from 'three';

let cache = null;

export async function loadLogoTrace(url) {
  if (!cache) cache = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Logo trace failed to load (${r.status})`);
    return r.json();
  });
  return cache;
}

const V2 = (p, f) => {
  const [x, y] = f ? f(p[0], p[1]) : p;
  return new THREE.Vector2(x, y);
};

// THREE.Shapes with holes, ready for ExtrudeGeometry.
export function toShapes(list, f) {
  return list.map((s) => {
    const shape = new THREE.Shape(s.outer.map((p) => V2(p, f)));
    shape.holes = s.holes.map((h) => new THREE.Path(h.map((p) => V2(p, f))));
    return shape;
  });
}

// Flat list of closed loops (outers and holes) for even-odd distance fields.
export function toLoops(list, f, { holes = true } = {}) {
  const loops = [];
  for (const s of list) {
    loops.push(s.outer.map((p) => V2(p, f)));
    if (holes) for (const h of s.holes) loops.push(h.map((p) => V2(p, f)));
  }
  return loops;
}

export function bounds(list) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of list) for (const [x, y] of s.outer) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}
