"""Export the club photos used on the site as web-sized WebP files.

Reads from content/media (the local archive, not in the repo) and writes to site/assets/img.
Run from the project root:  python tools/prepare_images.py
"""
from pathlib import Path

from PIL import Image, ImageOps

SRC = Path('content/media')
OUT = Path('site/assets/img')

# name: (source, focal point as (x, y) fractions for crops)
CLUB = {
    'blitz-tournament': ('2025/10/09f3273b-1503-40e8-8ebd-6b6b6094e8a2.jpg', (0.5, 0.6)),
    'robot-boy': ('2025/10/2346beb8-d972-48a0-9015-969f52d9ebc7.jpg', (0.5, 0.5)),
    'robot-table': ('2025/10/cbcee70c-76a9-465e-8cb8-85b575d7c705.jpg', (0.45, 0.6)),
    'good-game': ('2025/10/d6139712-cda3-4d83-8d38-b7b23f1173ed.jpg', (0.5, 0.5)),
    'tournament-day': ('2025/10/e7d5ad8b-a81d-41e1-8ef0-6a20082e8008.jpg', (0.5, 0.5)),
    'all-ages': ('2026/03/79773e28-1044-4f03-bfed-90f6aa4d39f3.jpg', (0.5, 0.55)),
    'meetup': ('2025/10/954d3bbe-1cfa-46a3-8be6-c6b4298c9103.jpg', (0.5, 0.55)),
    'class-in-session': ('2026/08/bf902cbd-5756-4ad6-8eb8-950f7033549f.jpg', (0.5, 0.55)),
    'blitz-girls': ('2026/08/60e46e38-5edb-43f6-a2b5-b883900852d1.jpg', (0.5, 0.6)),
    'classroom': ('2026/08/2b331122-c2bb-4cd6-b9b2-49e2b547e0a4.jpg', (0.5, 0.6)),
}

COACHES = {
    'michael-ocido': ('2025/11/d977c89b-35cd-426e-809e-9aca3d40f07f.jpg', (0.5, 0.42)),
    'kazybek-nogerbek': ('2025/11/kazybek-2.webp', (0.5, 0.4)),
    'ellan-asuela': ('2025/11/asuelan-ellan-2.jpg', (0.5, 0.42)),
    'leo-romitman': ('2025/11/leo-3.jpg', (0.5, 0.4)),
}


def load(rel):
    im = Image.open(SRC / rel)
    return ImageOps.exif_transpose(im).convert('RGB')


def fit(im, long_side):
    im = im.copy()
    im.thumbnail((long_side, long_side), Image.LANCZOS)
    return im


def crop_ratio(im, ratio, focus):
    w, h = im.size
    if w / h > ratio:
        nw = int(h * ratio)
        x = int(min(max(focus[0] * w - nw / 2, 0), w - nw))
        return im.crop((x, 0, x + nw, h))
    nh = int(w / ratio)
    y = int(min(max(focus[1] * h - nh / 2, 0), h - nh))
    return im.crop((0, y, w, y + nh))


def main():
    (OUT / 'club').mkdir(parents=True, exist_ok=True)
    (OUT / 'coaches').mkdir(parents=True, exist_ok=True)
    for name, (rel, focus) in CLUB.items():
        im = load(rel)
        for size, suffix in ((1400, ''), (720, '-720')):
            fit(im, size).save(OUT / 'club' / f'{name}{suffix}.webp', 'WEBP', quality=76, method=6)
        print('club', name, im.size)
    for name, (rel, focus) in COACHES.items():
        im = crop_ratio(load(rel), 4 / 5, focus)
        im.resize((640, 800), Image.LANCZOS).save(OUT / 'coaches' / f'{name}.webp', 'WEBP', quality=80, method=6)
        print('coach', name)


if __name__ == '__main__':
    main()
