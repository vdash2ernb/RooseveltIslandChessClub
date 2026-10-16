// Signed distance field helpers for sculpted forms (the knight head, the bishop mitre).
// A 2D silhouette is sampled into a distance grid, shaped into a 3D field,
// then polygonised with marching cubes. Normals come from the field gradient,
// so the surface shades smoothly with no visible facets or seams.

import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);

// Distance from a 2D signed distance d2 and a slab of half-thickness w, with edges rounded by r.
export function roundedExtrude(d2, z, w, r) {
  const qx = d2 + r, qy = Math.abs(z) - w + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// Sample closed polygons into a signed distance grid. Negative inside (even-odd, so holes work).
// `poly` is one loop (array of Vector2) or an array of loops. Distances beyond maxDist are clamped.
export function polygonDistanceGrid(poly, pad = 0.12, res = 256, maxDist = 0.2) {
  const loops = Array.isArray(poly[0]) ? poly : [poly];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const loop of loops) for (const p of loop) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const span = Math.max(maxX - minX, maxY - minY);
  const step = span / (res - 1);
  const nx = Math.ceil((maxX - minX) / step) + 1;
  const ny = Math.ceil((maxY - minY) / step) + 1;
  const grid = new Float32Array(nx * ny);

  const n = loops.reduce((s, l) => s + l.length, 0);
  const ax = new Float32Array(n), ay = new Float32Array(n), ex = new Float32Array(n), ey = new Float32Array(n), el = new Float32Array(n);
  let e = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++, e++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      ax[e] = a.x; ay[e] = a.y; ex[e] = b.x - a.x; ey[e] = b.y - a.y;
      el[e] = ex[e] * ex[e] + ey[e] * ey[e] || 1e-12;
    }
  }

  // Inside or outside, one scanline per row (even-odd crossings).
  const inside = new Uint8Array(nx * ny);
  const xs = [];
  for (let j = 0; j < ny; j++) {
    const py = minY + j * step;
    xs.length = 0;
    for (let k = 0; k < n; k++) {
      const yi = ay[k], yj = ay[k] + ey[k];
      if ((yi > py) !== (yj > py)) xs.push(ax[k] + ex[k] * (py - yi) / ey[k]);
    }
    xs.sort((a, b) => a - b);
    let c = 0;
    for (let i = 0; i < nx; i++) {
      const px = minX + i * step;
      while (c < xs.length && xs[c] <= px) c++;
      inside[j * nx + i] = c & 1;
    }
  }

  // Distances, checking only the edges near each cell; anything further than maxDist is clamped.
  const B = maxDist;
  const bx = Math.ceil((maxX - minX) / B) + 1, by = Math.ceil((maxY - minY) / B) + 1;
  const buckets = Array.from({ length: bx * by }, () => []);
  for (let k = 0; k < n; k++) {
    const x0 = Math.min(ax[k], ax[k] + ex[k]) - B, x1 = Math.max(ax[k], ax[k] + ex[k]) + B;
    const y0 = Math.min(ay[k], ay[k] + ey[k]) - B, y1 = Math.max(ay[k], ay[k] + ey[k]) + B;
    const i0 = Math.max(0, Math.floor((x0 - minX) / B)), i1 = Math.min(bx - 1, Math.floor((x1 - minX) / B));
    const j0 = Math.max(0, Math.floor((y0 - minY) / B)), j1 = Math.min(by - 1, Math.floor((y1 - minY) / B));
    for (let bj = j0; bj <= j1; bj++) for (let bi = i0; bi <= i1; bi++) buckets[bj * bx + bi].push(k);
  }
  const max2 = maxDist * maxDist;
  for (let j = 0; j < ny; j++) {
    const py = minY + j * step;
    const brow = Math.floor((py - minY) / B) * bx;
    for (let i = 0; i < nx; i++) {
      const px = minX + i * step;
      const list = buckets[brow + Math.floor((px - minX) / B)];
      let best = max2;
      for (let q = 0; q < list.length; q++) {
        const k = list[q];
        const wx = px - ax[k], wy = py - ay[k];
        const t = clamp((wx * ex[k] + wy * ey[k]) / el[k], 0, 1);
        const dx = wx - ex[k] * t, dy = wy - ey[k] * t;
        const d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      const d = Math.sqrt(best);
      grid[j * nx + i] = inside[j * nx + i] ? -d : d;
    }
  }

  return {
    sample(x, y) {
      const fx = (x - minX) / step, fy = (y - minY) / step;
      if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) {
        const cx = clamp(fx, 0, nx - 1), cy = clamp(fy, 0, ny - 1);
        const edge = grid[Math.round(cy) * nx + Math.round(cx)];
        return edge + Math.hypot(fx - cx, fy - cy) * step;
      }
      const i0 = Math.min(nx - 2, Math.floor(fx)), j0 = Math.min(ny - 2, Math.floor(fy));
      const tx = fx - i0, ty = fy - j0;
      const a = grid[j0 * nx + i0], b = grid[j0 * nx + i0 + 1];
      const c = grid[(j0 + 1) * nx + i0], d = grid[(j0 + 1) * nx + i0 + 1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    },
    bounds: { minX, minY, maxX, maxY },
  };
}

// Polygonise sdf(x, y, z) inside a cube centred at `center` with half-size `half`.
// zScale > 1 stretches z so shallow reliefs get more resolution: the cube spans half / zScale in z.
export function meshFromSDF(sdf, center, half, res = 96, maxPoly = 120000, zScale = 1) {
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, maxPoly);
  mc.isolation = 0;
  const { field, size, halfsize } = mc;
  for (let z = 0; z < size; z++) {
    const pz = center.z + ((z - halfsize) / halfsize) * half / zScale;
    for (let y = 0; y < size; y++) {
      const py = center.y + ((y - halfsize) / halfsize) * half;
      const row = z * size * size + y * size;
      for (let x = 0; x < size; x++) {
        const px = center.x + ((x - halfsize) / halfsize) * half;
        field[row + x] = -sdf(px, py, pz);
      }
    }
  }
  mc.update();

  const count = Math.min(mc.count, maxPoly * 3);
  if (mc.count > count) console.warn(`meshFromSDF: ${mc.count / 3} triangles exceeds the ${maxPoly} budget; lower the resolution.`);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    pos[o] = center.x + mc.positionArray[o] * half;
    pos[o + 1] = center.y + mc.positionArray[o + 1] * half;
    pos[o + 2] = center.z + mc.positionArray[o + 2] * half / zScale;
    v.set(mc.normalArray[o], mc.normalArray[o + 1], mc.normalArray[o + 2] * zScale).normalize();
    nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z;
  }
  mc.geometry.dispose();
  mc.material.dispose();

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
