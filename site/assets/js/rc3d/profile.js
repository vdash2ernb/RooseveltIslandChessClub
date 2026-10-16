// Turned-wood profiles for lathe geometry.
// A profile is drawn from the bottom center, out along the base, up the side,
// and back to the axis at the top, in (radius, height) coordinates.
// Every join between segments gets a tiny fillet so edges catch light like
// real turned wood instead of rendering razor sharp.

import * as THREE from 'three';

const V2 = THREE.Vector2;

// Curve sampling density. Phones use fewer points per curve; normals stay smooth either way.
let density = 1;
export function setProfileDensity(d) { density = d; }
const samples = (n) => Math.max(3, Math.round(n * density));

export class Profile {
  constructor() {
    this.runs = [];
    this.cur = new V2();
  }

  M(x, y) {
    this.cur = new V2(x, y);
    return this;
  }

  _push(points, fillet) {
    this.runs.push({ points, fillet });
    this.cur = points[points.length - 1].clone();
    return this;
  }

  // Straight segment.
  L(x, y, fillet) {
    return this._push([this.cur.clone(), new V2(x, y)], fillet);
  }

  // Quadratic curve.
  Q(cx, cy, x, y, fillet, n = 7) {
    const c = new THREE.QuadraticBezierCurve(this.cur.clone(), new V2(cx, cy), new V2(x, y));
    return this._push(c.getSpacedPoints(samples(n)), fillet);
  }

  // Cubic curve.
  C(c1x, c1y, c2x, c2y, x, y, fillet, n = 9) {
    const c = new THREE.CubicBezierCurve(this.cur.clone(), new V2(c1x, c1y), new V2(c2x, c2y), new V2(x, y));
    return this._push(c.getSpacedPoints(samples(n)), fillet);
  }

  // Circular arc around (cx, cy) from the current point to endDeg (counterclockwise when endDeg is larger).
  A(cx, cy, endDeg, fillet, n = 18) {
    const r = Math.hypot(this.cur.x - cx, this.cur.y - cy);
    const a0 = Math.atan2(this.cur.y - cy, this.cur.x - cx);
    const a1 = THREE.MathUtils.degToRad(endDeg);
    const pts = [];
    n = samples(n);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push(new V2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
    pts[pts.length - 1].x = Math.max(0, pts[pts.length - 1].x);
    return this._push(pts, fillet);
  }

  // Outward half-round bead from the current point straight up to height y1.
  bead(y1, out, fillet) {
    const x = this.cur.x, y0 = this.cur.y, k = out * 1.33;
    return this.C(x + k, y0, x + k, y1, x, y1, fillet);
  }

  points(defaultFillet = 0.006) {
    const runs = this.runs;
    let out = runs[0].points.map((p) => p.clone());
    for (let i = 1; i < runs.length; i++) {
      const next = runs[i].points.map((p) => p.clone());
      const f = runs[i].fillet ?? defaultFillet;
      const P = out[out.length - 1];
      const tin = P.clone().sub(out[out.length - 2]).normalize();
      const tout = next[1].clone().sub(next[0]).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(tin.dot(tout), -1, 1));
      if (f <= 0 || angle < 0.12) {
        next.shift();
        out.push(...next);
        continue;
      }
      const t = Math.min(f, 0.4 * runLength(runs[i - 1].points), 0.4 * runLength(runs[i].points));
      const A = trimEnd(out, t);
      const B = trimStart(next, t);
      const fil = new THREE.QuadraticBezierCurve(A, P.clone(), B).getSpacedPoints(density < 1 ? 3 : 4);
      out.push(...fil.slice(1, -1));
      out.push(...next);
    }
    // Clean up: no negative radii, no duplicate neighbours.
    const clean = [];
    for (const p of out) {
      p.x = Math.max(0, p.x);
      const last = clean[clean.length - 1];
      if (!last || last.distanceToSquared(p) > 1e-12) clean.push(p);
    }
    return clean;
  }

  lathe(segments = 72, fillet) {
    return new THREE.LatheGeometry(this.points(fillet), segments);
  }
}

function runLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]);
  return s;
}

// Remove length t from the end of the polyline, return the new end point.
function trimEnd(arr, t) {
  let remaining = t;
  while (arr.length > 1) {
    const a = arr[arr.length - 2], b = arr[arr.length - 1];
    const d = a.distanceTo(b);
    if (d > remaining) {
      const p = b.clone().lerp(a, remaining / d);
      arr[arr.length - 1] = p;
      return p;
    }
    remaining -= d;
    arr.pop();
  }
  return arr[0];
}

// Remove length t from the start of the polyline, return the new start point.
function trimStart(arr, t) {
  let remaining = t;
  while (arr.length > 1) {
    const a = arr[0], b = arr[1];
    const d = a.distanceTo(b);
    if (d > remaining) {
      const p = a.clone().lerp(b, remaining / d);
      arr[0] = p;
      return p;
    }
    remaining -= d;
    arr.shift();
  }
  return arr[0];
}
