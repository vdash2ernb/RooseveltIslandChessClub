// Procedural textures, all generated in code: no image files, nothing licensed.

import * as THREE from 'three';

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, seed + i * 31);
    n += a; f *= 2; a *= 0.5;
  }
  return s / n;
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A flat-sawn wood tile with the grain running along x. Feature scale is per 512 px,
// so tiles of any size share the same look.
export function woodTile(W, H, { base, dark, seed = 1, rings = 7, contrast = 1, streaks = 0.5, pores = 0.05 }) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const B = rgb(base), D = rgb(dark);
  for (let y = 0; y < H; y++) {
    const v = y / 512;
    for (let x = 0; x < W; x++) {
      const u = x / 512;
      const warp = fbm(u * 1.6, v * 2.2, seed, 3);
      let r = v * rings + warp * 2.6 + Math.sin(u * 5.0 + seed) * 0.18;
      r -= Math.floor(r);
      const late = Math.pow(r, 2.6) * (1 - smooth(0.965, 1.0, r));
      const streak = fbm(u * 1.4, v * 110, seed + 7, 3) - 0.5;
      const pore = hash2(x, y, seed + 3) - 0.5;
      const broad = fbm(u * 0.9, v * 0.9, seed + 11, 2) - 0.5;
      let t = (late * 0.62 + streak * streaks + broad * 0.25) * contrast + pore * pores;
      t = Math.min(1, Math.max(0, t + 0.12));
      const o = (y * W + x) * 4;
      d[o] = B[0] + (D[0] - B[0]) * t;
      d[o + 1] = B[1] + (D[1] - B[1]) * t;
      d[o + 2] = B[2] + (D[2] - B[2]) * t;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Turned-wood grain for the pieces: fine streaks that run up the piece, seamless around it.
export function pieceGrain(seed, { base, dark, contrast = 1 }, N = 512, M = 64) {
  const c = document.createElement('canvas');
  c.width = N; c.height = M;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, M);
  const d = img.data;
  const R = rng(seed);
  const waves = [];
  for (let i = 0; i < 40; i++) {
    const f = 2 + Math.floor(R() * 90);
    waves.push([f, R() * Math.PI * 2, (0.35 + R()) / Math.sqrt(f)]);
  }
  let norm = 0;
  for (const w of waves) norm += w[2];
  const B = rgb(base), D = rgb(dark);
  for (let y = 0; y < M; y++) {
    const v = y / M;
    for (let x = 0; x < N; x++) {
      const u = x / N + 0.004 * Math.sin(v * Math.PI * 4 + seed);
      let s = 0;
      for (const [f, p, a] of waves) s += a * Math.sin(u * Math.PI * 2 * f + p);
      let t = 0.5 + (s / norm) * 1.6 * contrast;
      t = Math.min(1, Math.max(0, t));
      const o = (y * N + x) * 4;
      d[o] = B[0] + (D[0] - B[0]) * t;
      d[o + 1] = B[1] + (D[1] - B[1]) * t;
      d[o + 2] = B[2] + (D[2] - B[2]) * t;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// The board top: mitred walnut frame, gilded inlay line, engraved and gilded coordinates,
// maple and walnut squares with alternating grain. Canvas top = rank 8, left = file a.
export function boardTop({ size = 2048, units, field = 8, maple, walnut, frame, font }) {
  const S = size, ppu = S / units, border = ((units - field) / 2) * ppu, sq = ppu;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const R = rng(4242);

  // Frame, four mitred pieces with grain along each side.
  const sides = [
    { poly: [[0, 0], [S, 0], [S - border, border], [border, border]], rot: 0 },
    { poly: [[0, S], [S, S], [S - border, S - border], [border, S - border]], rot: 0 },
    { poly: [[0, 0], [border, border], [border, S - border], [0, S]], rot: Math.PI / 2 },
    { poly: [[S, 0], [S - border, border], [S - border, S - border], [S, S]], rot: Math.PI / 2 },
  ];
  // `frame` is a long strip with grain along its length.
  sides.forEach((s, i) => {
    ctx.save();
    ctx.beginPath();
    s.poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    const srcY = Math.floor(R() * Math.max(1, frame.height - border));
    const cx = i < 2 ? S / 2 : (i === 2 ? border / 2 : S - border / 2);
    const cy = i === 0 ? border / 2 : (i === 1 ? S - border / 2 : S / 2);
    ctx.translate(cx, cy);
    ctx.rotate(s.rot);
    ctx.drawImage(frame, 0, srcY, frame.width, border, -S / 2, -border / 2, S, border);
    ctx.restore();
  });
  // Mitre joints.
  ctx.strokeStyle = 'rgba(20,10,4,0.45)';
  ctx.lineWidth = 1.5;
  [[0, 0, border, border], [S, 0, S - border, border], [0, S, border, S - border], [S, S, S - border, S - border]].forEach(([a, b, x, y]) => {
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(x, y); ctx.stroke();
  });

  // Squares.
  for (let row = 0; row < 8; row++) {
    for (let file = 0; file < 8; file++) {
      const rank = 7 - row;
      const light = (file + rank) % 2 === 1;
      const x = border + file * sq, y = border + row * sq;
      const tile = light ? maple : walnut;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, sq, sq); ctx.clip();
      const sx = R() * (tile.width - 260), sy = R() * (tile.height - 260);
      if (light) {
        ctx.drawImage(tile, sx, sy, 256, 256, x, y, sq, sq);
      } else {
        ctx.translate(x + sq / 2, y + sq / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(tile, sx, sy, 256, 256, -sq / 2, -sq / 2, sq, sq);
      }
      ctx.restore();
      const j = (R() - 0.5) * 0.07;
      ctx.fillStyle = j > 0 ? `rgba(255,240,215,${j})` : `rgba(30,15,5,${-j})`;
      ctx.fillRect(x, y, sq, sq);
    }
  }
  // Veneer seams.
  ctx.strokeStyle = 'rgba(25,12,5,0.28)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const p = Math.round(border + i * sq) + 0.5;
    ctx.beginPath(); ctx.moveTo(p, border); ctx.lineTo(p, S - border); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(border, p); ctx.lineTo(S - border, p); ctx.stroke();
  }

  // Gilded inlay line around the field.
  const gold = ctx.createLinearGradient(0, 0, S, S);
  gold.addColorStop(0, '#e6c48a'); gold.addColorStop(0.5, '#c79a5c'); gold.addColorStop(1, '#e9cf9c');
  const inset = 0.09 * ppu;
  ctx.strokeStyle = 'rgba(15,8,3,0.6)';
  ctx.lineWidth = 0.05 * ppu;
  ctx.strokeRect(border - inset, border - inset, S - 2 * (border - inset), S - 2 * (border - inset));
  ctx.strokeStyle = gold;
  ctx.lineWidth = 0.022 * ppu;
  ctx.strokeRect(border - inset, border - inset, S - 2 * (border - inset), S - 2 * (border - inset));

  // Engraved, gilded coordinates.
  const fs = 0.25 * ppu;
  ctx.font = `600 ${fs}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const engrave = (txt, x, y, rot) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(10,5,2,0.75)';
    ctx.fillText(txt, 0, -1.6);
    ctx.fillStyle = 'rgba(255,225,170,0.22)';
    ctx.fillText(txt, 0, 1.8);
    ctx.fillStyle = gold;
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  const mid = (border - inset) / 2;
  'abcdefgh'.split('').forEach((l, i) => {
    const x = border + (i + 0.5) * sq;
    engrave(l, x, S - mid, 0);
    engrave(l, S - x, mid, Math.PI);
  });
  for (let i = 0; i < 8; i++) {
    const y = border + (7 - i + 0.5) * sq;
    engrave(String(i + 1), mid, y, 0);
    engrave(String(i + 1), S - mid, S - y, Math.PI);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft contact shadow under each piece.
export function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(0.42, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
