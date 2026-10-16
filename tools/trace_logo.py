"""Trace the club logo into vector outlines for the 3D medallion.

Reads the club's logo PNG and writes site/assets/data/logo-trace.json with:
  - the "Roosevelt Island" lettering, including the swash under the R
  - the "Chess Club" lettering
  - the knight (with its carved detail lines as gaps) and its collar bands
  - the knight's closed silhouette (used for the chess-piece knights)
  - the orange halos that separate lettering and knight from the rings and checkers
  - ring radii and the checker grid, measured from the logo

Coordinates are normalised: the medallion radius (225 px in the 500 px logo) is 1,
the centre is the ring centre, and y points up.

Usage:
  python tools/trace_logo.py content/media/2025/10/da4500aa-c1ae-4947-8cf5-d5bb86fd9850-removebg-preview-5.png site/assets/data/logo-trace.json
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter

CX, CY, NORM = 250.5, 249.5, 225.0   # measured ring centre, and the medallion radius in px
UP = 6                                # contour upsampling factor


def soft_white(img):
    mn, mx = img.min(2), img.max(2)
    return np.clip((mn - 150) / 60, 0, 1) * np.clip((80 - (mx - mn)) / 40, 0, 1), mn


def label(b):
    H, W = b.shape
    lab = np.zeros((H, W), np.int32)
    comps = {}
    for y in range(H):
        for x in range(W):
            if b[y, x] and not lab[y, x]:
                n = len(comps) + 1
                lab[y, x] = n
                stack, pts = [(y, x)], []
                while stack:
                    cy, cx = stack.pop()
                    pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and b[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            stack.append((ny, nx))
                comps[n] = np.array(pts)
    return lab, comps


def disc_offsets(r):
    R = int(np.ceil(r))
    return [(dy, dx) for dy in range(-R, R + 1) for dx in range(-R, R + 1) if dx * dx + dy * dy <= r * r]


def max_filter(f, r):
    out = np.zeros_like(f)
    H, W = f.shape
    for dy, dx in disc_offsets(r):
        sh = np.zeros_like(f)
        ys0, ys1 = max(0, dy), min(H, H + dy)
        xs0, xs1 = max(0, dx), min(W, W + dx)
        sh[ys0:ys1, xs0:xs1] = f[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        out = np.maximum(out, sh)
    return out


def min_filter(f, r):
    return 1 - max_filter(1 - f, r)


def gaussian(f, sigma):
    r = int(np.ceil(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    f = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 0, f)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 1, f)


def upsample(f, blur=0.9):
    im = Image.fromarray(f.astype(np.float32), mode='F')
    im = im.resize((f.shape[1] * UP, f.shape[0] * UP), Image.BICUBIC)
    out = np.asarray(im, dtype=np.float32)
    return gaussian(out, blur * UP / 2) if blur else out


# --------------------------------------------------------------- marching squares

def contours(F, t=0.5):
    F = np.pad(F, 1)
    b = F > t
    case = b[:-1, :-1] * 8 + b[:-1, 1:] * 4 + b[1:, 1:] * 2 + b[1:, :-1] * 1
    ys, xs = np.nonzero((case != 0) & (case != 15))

    def pt(key):
        kind, y, x = key
        if kind == 'h':
            v0, v1 = F[y, x], F[y, x + 1]
            return (x + (t - v0) / (v1 - v0) - 1, y - 1)
        v0, v1 = F[y, x], F[y + 1, x]
        return (x - 1, y + (t - v0) / (v1 - v0) - 1)

    adj = {}

    def link(a, b_):
        adj.setdefault(a, []).append(b_)
        adj.setdefault(b_, []).append(a)

    for y, x in zip(ys, xs):
        c = case[y, x]
        T, B, L, R = ('h', y, x), ('h', y + 1, x), ('v', y, x), ('v', y, x + 1)
        center = (F[y, x] + F[y, x + 1] + F[y + 1, x] + F[y + 1, x + 1]) / 4 > t
        table = {
            1: [(L, B)], 2: [(B, R)], 3: [(L, R)], 4: [(T, R)],
            5: [(T, L), (B, R)] if center else [(T, R), (L, B)],
            6: [(T, B)], 7: [(T, L)], 8: [(T, L)], 9: [(T, B)],
            10: [(T, R), (L, B)] if center else [(T, L), (B, R)],
            11: [(T, R)], 12: [(L, R)], 13: [(B, R)], 14: [(L, B)],
        }
        for a, b_ in table[int(c)]:
            link(a, b_)

    loops, seen = [], set()
    for start in adj:
        if start in seen:
            continue
        loop, prev, cur = [], None, start
        while True:
            seen.add(cur)
            loop.append(pt(cur))
            nxt = [n for n in adj[cur] if n != prev]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            if cur == start:
                break
        if len(loop) > 8:
            loops.append(np.array(loop))
    return loops


def simplify(p, eps):
    """Douglas-Peucker on a closed loop."""
    def dp(pts):
        if len(pts) < 3:
            return pts
        a, b = pts[0], pts[-1]
        ab = b - a
        n = np.hypot(*ab) or 1e-9
        d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
        i = int(np.argmax(d))
        if d[i] > eps:
            return np.vstack([dp(pts[:i + 1])[:-1], dp(pts[i:])])
        return np.vstack([a, b])
    far = int(np.argmax(np.hypot(*(p - p[0]).T)))
    half1 = dp(p[:far + 1])
    half2 = dp(np.vstack([p[far:], p[:1]]))
    return np.vstack([half1[:-1], half2[:-1]])


def area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)


def inside(pt, poly):
    x, y = pt
    xs, ys = poly[:, 0], poly[:, 1]
    xj, yj = np.roll(xs, 1), np.roll(ys, 1)
    cond = (ys > y) != (yj > y)
    xint = (xj - xs) * (y - ys) / np.where(yj - ys == 0, 1e-12, yj - ys) + xs
    return np.count_nonzero(cond & (x < xint)) % 2 == 1


def shapes_from_field(F, eps=0.35):
    loops = contours(upsample(F))
    # hi-res pixel-centre coords -> original pixel coords -> normalised medallion coords
    loops = [simplify(l, eps) for l in loops]
    loops = [l for l in loops if len(l) >= 4 and abs(area(l)) > (UP * UP) * 1.5]
    norm = []
    for l in loops:
        x = ((l[:, 0] + 0.5) / UP - 0.5 - CX) / NORM
        y = (CY - ((l[:, 1] + 0.5) / UP - 0.5)) / NORM
        norm.append(np.stack([x, y], 1))
    depth = []
    for i, l in enumerate(norm):
        c = sum(1 for j, o in enumerate(norm) if j != i and inside(l[0], o))
        depth.append(c)
    shapes = []
    for i, l in enumerate(norm):
        if depth[i] % 2 == 0:
            shapes.append({'outer': l, 'holes': []})
    for i, l in enumerate(norm):
        if depth[i] % 2 == 1:
            parents = [s for s in shapes if inside(l[0], s['outer'])]
            if parents:
                min(parents, key=lambda s: abs(area(s['outer'])))['holes'].append(l)
    r = lambda a: [[round(float(x), 5), round(float(y), 5)] for x, y in a]
    return [{'outer': r(s['outer']), 'holes': [r(h) for h in s['holes']]} for s in shapes]


def main(src, out):
    img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    white, mn = soft_white(img)
    lab, comps = label(white > 0.5)

    def pick(rule):
        m = np.zeros(white.shape, bool)
        for n, p in comps.items():
            x0, y0, x1, y1 = p[:, 1].min(), p[:, 0].min(), p[:, 1].max(), p[:, 0].max()
            bright = mn[p[:, 0], p[:, 1]].mean()
            if rule(len(p), x0, y0, x1, y1, bright):
                m[p[:, 0], p[:, 1]] = True
        return m

    script = pick(lambda a, x0, y0, x1, y1, br: br >= 230 and y0 < 315 and a > 100)
    chess = pick(lambda a, x0, y0, x1, y1, br: br >= 230 and y0 >= 318 and y1 < 362 and a > 100)
    knight = pick(lambda a, x0, y0, x1, y1, br: x0 >= 200 and x1 <= 300 and y0 >= 100 and y1 <= 230 and a >= 15 and br >= 200)
    head = pick(lambda a, x0, y0, x1, y1, br: x0 >= 200 and x1 <= 300 and y0 >= 100 and y1 <= 200 and a >= 15 and br >= 200)

    # The knight is shaded grey in places; separate it from the orange by saturation, not brightness.
    mnc, mxc = img.min(2), img.max(2)
    neutral = np.clip((95 - (mxc - mnc)) / 40, 0, 1) * np.clip((mnc - 90) / 40, 0, 1)
    knight_region = np.zeros(white.shape, bool)
    knight_region[100:230, 200:301] = True
    knight_soft = neutral * knight_region
    # Grow the picked knight parts into the shaded areas they touch.
    kb = knight.astype(np.float32)
    for _ in range(12):
        kb = np.maximum(kb, max_filter(kb, 1.0) * (knight_soft > 0.5))
    knight = kb > 0.5
    head = knight & (np.arange(white.shape[0])[:, None] < 203)

    # Restrict the soft field to the chosen regions so neighbours never leak into the outline.
    def field(mask, grow=1.0, base=None):
        return (white if base is None else base) * max_filter(mask.astype(np.float32), grow)

    def halo(mask, r):
        return max_filter(mask.astype(np.float32), r)

    head_closed = min_filter(max_filter(head.astype(np.float32), 2.0), 2.0)

    data = {
        'source': 'Club logo, 500 px PNG. Traced by tools/trace_logo.py.',
        'norm': {'cx': CX, 'cy': CY, 'radiusPx': NORM},
        'rings': [[204 / NORM, 213.5 / NORM], [177.5 / NORM, 184.5 / NORM]],
        'checker': {'size': 48 / NORM, 'originX': -24 / NORM, 'originY': (CY - 212) / NORM, 'whiteParity': 1, 'clip': 177.5 / NORM},
        'script': shapes_from_field(field(script)),
        'scriptHalo': shapes_from_field(halo(script, 4.5)),
        'chessClub': shapes_from_field(field(chess)),
        'chessClubHalo': shapes_from_field(halo(chess, 7.0)),
        'knight': shapes_from_field(field(knight, base=knight_soft)),
        'knightHalo': shapes_from_field(halo(knight, 4.0)),
        'knightClosed': shapes_from_field(head_closed),
    }
    for k, v in data.items():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            print(k, len(v), 'shapes', sum(len(s['holes']) for s in v), 'holes', sum(len(s['outer']) for s in v), 'pts')
    with open(out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
