# Credits and ownership

Everything on the Roosevelt Island Chess Club site is either owned by the club, made for the club in this project, or used under a permissive open license. This file is the record.

## Owned by the club

| Item | Notes |
|---|---|
| Club logo | Owned by the club. `tools/trace_logo.py` traces it into vector outlines (`site/assets/data/logo-trace.json`): the knight, the "Roosevelt Island" lettering with the swash under the R, "Chess Club", the rings and the checker grid. The 3D medallion and the chess-piece knights are built from that trace. |
| Photos and videos | Owned by the club (archive in `content/media/`, kept out of this repo). The web versions in `site/assets/img/club/` and `site/assets/img/coaches/` are exported by `tools/prepare_images.py`. |
| Logo marks | `site/assets/img/club-logo-64.png` and `-192.png`, cropped from the club logo. |

## Made for the club in this project (original work, no third-party assets)

| Item | Where |
|---|---|
| All chess pieces (profiles, bishop mitre, coronet, battlements, cross; the knight's head follows the club logo) | `site/assets/js/rc3d/pieces.js`, `profile.js`, `sdf.js`, `logo.js` |
| Board, wood grain, gilded inlay and coordinates, contact shadows | `site/assets/js/rc3d/board.js`, `textures.js` (all generated in code, no image files) |
| 3D club medallion | `site/assets/js/rc3d/medallion.js` |
| Lighting, materials, camera work | `site/assets/js/rc3d/stage.js`, `materials.js`, `site/assets/js/lookdev.js` |

No 3D models, HDR images, textures or stock media were downloaded.

## Public domain

| Item | Notes |
|---|---|
| The Opera Game (Morphy vs. Duke Karl and Count Isouard, Paris 1858) | The moves of a chess game are historical facts. |

## Open-source software and fonts

| Item | License | Where |
|---|---|---|
| three.js r170 | MIT | `site/assets/vendor/three/` (license in `LICENSE`) |
| three.js addons: OrbitControls, RoomEnvironment, RoundedBoxGeometry, MarchingCubes, TTFLoader, FontLoader, BufferGeometryUtils | MIT (part of three.js) | `site/assets/vendor/three/addons/` |
| opentype.js 1.3.4 | MIT | `site/assets/vendor/three/addons/libs/opentype.module.js` (license in file header) |
| Fira Sans SemiBold, by Mozilla and Telefonica | SIL Open Font License 1.1 | `site/assets/fonts/fira-sans/` (license in `OFL.txt`). Used only for "EST. 2025" on the back of the medallion. |
| Bricolage Grotesque, Atkinson Hyperlegible, JetBrains Mono (page text) | SIL Open Font License 1.1 | Loaded from Google Fonts on the look-dev page; to be self-hosted on the live site |

When adding anything new, add a row here. Only club-owned, self-made, CC0 or permissively licensed material goes on the site.
