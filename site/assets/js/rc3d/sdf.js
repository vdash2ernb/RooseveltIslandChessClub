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

// Sample a closed polygon (array of Vector2) into a signed distance grid. Negative inside.
export function polygonDistanceGrid(poly, pad = 0.12, res = 256) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const span = Math.max(maxX - minX, maxY - minY);
  const step = span / (res - 1);
  const nx = Math.ceil((maxX - minX) / step) + 1;
  const ny = Math.ceil((maxY - minY) / step) + 1;
  const grid = new Float32Array(nx * ny);

  const n = poly.length;
  const ax = new Float32Array(n), ay = new Float32Array(n), ex = new Float32Array(n), ey = new Float32Array(n), el = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    ax[i] = a.x; ay[i] = a.y; ex[i] = b.x - a.x; ey[i] = b.y - a.y;
    el[i] = ex[i] * ex[i] + ey[i] * ey[i] || 1e-12;
  }

  for (let j = 0; j < ny; j++) {
    const py = minY + j * step;
    for (let i = 0; i < nx; i++) {
      const px = minX + i * step;
      let best = Infinity, inside = false;
      for (let k = 0; k < n; k++) {
        const wx = px - ax[k], wy = py - ay[k];
        const t = clamp((wx * ex[k] + wy * ey[k]) / el[k], 0, 1);
        const dx = wx - ex[k] * t, dy = wy - ey[k] * t;
        const d = dx * dx + dy * dy;
        if (d < best) best = d;
        const yi = ay[k], yj = ay[k] + ey[k];
        if ((yi > py) !== (yj > py)) {
          const xCross = ax[k] + ex[k] * (py - yi) / ey[k];
          if (px < xCross) inside = !inside;
        }
      }
      grid[j * nx + i] = inside ? -Math.sqrt(best) : Math.sqrt(best);
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
export function meshFromSDF(sdf, center, half, res = 96, maxPoly = 120000) {
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, maxPoly);
  mc.isolation = 0;
  const { field, size, halfsize } = mc;
  for (let z = 0; z < size; z++) {
    const pz = center.z + ((z - halfsize) / halfsize) * half;
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

  const count = mc.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    pos[o] = center.x + mc.positionArray[o] * half;
    pos[o + 1] = center.y + mc.positionArray[o + 1] * half;
    pos[o + 2] = center.z + mc.positionArray[o + 2] * half;
    v.set(mc.normalArray[o], mc.normalArray[o + 1], mc.normalArray[o + 2]).normalize();
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
