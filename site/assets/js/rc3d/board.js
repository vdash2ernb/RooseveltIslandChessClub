// The board and the set in its starting position.
// White plays from +z (nearest the default camera), file a is at -x.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildPieceGeometries, BASE_RADIUS } from './pieces.js';
import { rng } from './textures.js';

export const BOARD_UNITS = 9.4;
const EDGE = 0.05;
const THICK = 0.42;

export function squareToXZ(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return new THREE.Vector3(file - 3.5, 0, 3.5 - rank);
}

export function buildBoard(materials) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(BOARD_UNITS, THICK, BOARD_UNITS, 6, EDGE), materials.boardSide);
  frame.position.y = -THICK / 2 - 0.002;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const topSize = BOARD_UNITS - EDGE * 2;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(topSize, topSize), materials.boardTop);
  top.rotation.x = -Math.PI / 2;
  top.receiveShadow = true;
  group.add(top);
  return group;
}

const START = {
  white: { r: ['a1', 'h1'], n: ['b1', 'g1'], b: ['c1', 'f1'], q: ['d1'], k: ['e1'], p: 'abcdefgh'.split('').map((f) => f + '2') },
  black: { r: ['a8', 'h8'], n: ['b8', 'g8'], b: ['c8', 'f8'], q: ['d8'], k: ['e8'], p: 'abcdefgh'.split('').map((f) => f + '7') },
};

export async function buildSet(materials, trace, quality, pause) {
  const geos = await buildPieceGeometries(trace, quality, pause);
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  blobGeo.rotateX(-Math.PI / 2);
  const R = rng(7);
  const pieces = [];
  const group = new THREE.Group();

  for (const color of ['white', 'black']) {
    const mat = materials[color];
    for (const [type, squares] of Object.entries(START[color])) {
      for (const sq of squares) {
        const piece = new THREE.Group();
        for (const g of geos[type]) {
          const m = new THREE.Mesh(g, mat);
          m.castShadow = true;
          m.receiveShadow = true;
          piece.add(m);
        }
        const blob = new THREE.Mesh(blobGeo, materials.shadow);
        const s = BASE_RADIUS[type] * 2.9;
        blob.scale.set(s, 1, s);
        blob.position.y = 0.001;
        blob.renderOrder = 1;
        piece.add(blob);

        // Facing: knights look at the opponent, crosses face across the board.
        let yaw = (R() - 0.5) * 0.12;
        if (type === 'n') yaw += color === 'white' ? -Math.PI / 2 : Math.PI / 2;
        if (type === 'b') yaw += color === 'white' ? -0.6 : Math.PI - 0.6;
        if (type === 'r') yaw += R() * Math.PI;
        if (type === 'k' && color === 'black') yaw += Math.PI;
        piece.rotation.y = yaw;
        piece.position.copy(squareToXZ(sq));
        piece.position.x += (R() - 0.5) * 0.03;
        piece.position.z += (R() - 0.5) * 0.03;
        piece.userData = { type, color, square: sq, blob };
        group.add(piece);
        pieces.push(piece);
      }
    }
  }
  return { group, pieces };
}
