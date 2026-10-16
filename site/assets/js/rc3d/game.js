// The Opera Game, Paris 1858: Paul Morphy vs. Duke Karl of Brunswick and Count Isouard.
// The game is simulated once into per-piece tracks. After that, where every piece stands
// is a pure function of "game time" g (0 = start, 33 = after 17. Rd8#), so scrolling
// backwards rewinds exactly and fast scrolling can never leave a piece out of place.

import * as THREE from 'three';
import { squareToXZ } from './board.js';

export const PLIES = [
  { n: 1, san: 'e4', moves: [['e2', 'e4']], say: "White moves a pawn to the center." },
  { n: 1, san: 'e5', moves: [['e7', 'e5']], say: "Black answers with a pawn." },
  { n: 2, san: 'Nf3', moves: [['g1', 'f3']], say: "White brings out a knight." },
  { n: 2, san: 'd6', moves: [['d7', 'd6']], say: "Black protects the pawn." },
  { n: 3, san: 'd4', moves: [['d2', 'd4']], say: "White pushes a second pawn forward." },
  { n: 3, san: 'Bg4', moves: [['c8', 'g4']], say: "Black brings out a bishop." },
  { n: 4, san: 'dxe5', moves: [['d4', 'e5']], say: "White's pawn takes a black pawn." },
  { n: 4, san: 'Bxf3', moves: [['g4', 'f3']], say: "Black's bishop takes White's knight." },
  { n: 5, san: 'Qxf3', moves: [['d1', 'f3']], say: "White's queen takes the bishop back." },
  { n: 5, san: 'dxe5', moves: [['d6', 'e5']], say: "Black's pawn takes a white pawn." },
  { n: 6, san: 'Bc4', moves: [['f1', 'c4']], say: "White brings out a bishop." },
  { n: 6, san: 'Nf6', moves: [['g8', 'f6']], say: "Black brings out a knight." },
  { n: 7, san: 'Qb3', moves: [['f3', 'b3']], say: "White's queen attacks two pawns at once." },
  { n: 7, san: 'Qe7', moves: [['d8', 'e7']], say: "Black's queen steps in to defend." },
  { n: 8, san: 'Nc3', moves: [['b1', 'c3']], say: "White brings out the other knight." },
  { n: 8, san: 'c6', moves: [['c7', 'c6']], say: "Black moves a pawn." },
  { n: 9, san: 'Bg5', moves: [['c1', 'g5']], say: "White's bishop attacks Black's knight." },
  { n: 9, san: 'b5', moves: [['b7', 'b5']], say: "Black's pawn attacks White's bishop." },
  { n: 10, san: 'Nxb5', moves: [['c3', 'b5']], say: "White's knight takes the pawn." },
  { n: 10, san: 'cxb5', moves: [['c6', 'b5']], say: "Black's pawn takes the knight." },
  { n: 11, san: 'Bxb5+', moves: [['c4', 'b5']], check: 'e8', say: "White's bishop takes a pawn. Check!" },
  { n: 11, san: 'Nbd7', moves: [['b8', 'd7']], say: "Black blocks the check with a knight." },
  { n: 12, san: 'O-O-O', moves: [['e1', 'c1'], ['a1', 'd1']], say: "White castles, moving the king to safety." },
  { n: 12, san: 'Rd8', moves: [['a8', 'd8']], say: "Black brings a rook to defend." },
  { n: 13, san: 'Rxd7', moves: [['d1', 'd7']], say: "White's rook takes the knight." },
  { n: 13, san: 'Rxd7', moves: [['d8', 'd7']], say: "Black's rook takes the rook back." },
  { n: 14, san: 'Rd1', moves: [['h1', 'd1']], say: "White brings the last rook into the attack." },
  { n: 14, san: 'Qe6', moves: [['e7', 'e6']], say: "Black's queen moves to help defend." },
  { n: 15, san: 'Bxd7+', moves: [['b5', 'd7']], check: 'e8', say: "White's bishop takes the rook. Check!" },
  { n: 15, san: 'Nxd7', moves: [['f6', 'd7']], say: "Black's knight takes the bishop." },
  { n: 16, san: 'Qb8+', moves: [['b3', 'b8']], check: 'e8', say: "White gives up the queen! Check!" },
  { n: 16, san: 'Nxb8', moves: [['d7', 'b8']], say: "Black's knight has to take the queen." },
  { n: 17, san: 'Rd8#', moves: [['d1', 'd8']], check: 'e8', mate: true, say: "The rook moves in. Checkmate!" },
];

export const TOTAL_PLIES = PLIES.length;

// Windows inside one ply (0..1). A captured piece leaves first, then the capturer lands.
const QUIET = [0.14, 0.86];
const VICTIM = [0.04, 0.5];
const CAPTURER = [0.3, 0.9];

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Captured pieces line up on the frame border, between the rank numbers.
function slotPosition(color, index) {
  const x = color === 'white' ? -4.33 : 4.33;
  const z = color === 'white' ? -3 + index : 3 - index;
  return new THREE.Vector3(x, 0, z);
}

export function buildTimeline(pieces) {
  const at = new Map();
  pieces.forEach((p, i) => at.set(p.userData.square, i));
  const tracks = pieces.map((p) => ({
    piece: p,
    type: p.userData.type,
    color: p.userData.color,
    home: squareToXZ(p.userData.square),
    yaw: p.rotation.y,
    jitter: p.position.clone().sub(squareToXZ(p.userData.square)),
    moves: [],
    capture: null,
  }));
  const lost = { white: 0, black: 0 };

  PLIES.forEach((ply, i) => {
    for (const [from, to] of ply.moves) {
      const mover = at.get(from);
      const victim = at.get(to);
      if (mover === undefined) throw new Error(`No piece on ${from} at ply ${i}`);
      const capture = victim !== undefined;
      if (capture) {
        const t = tracks[victim];
        t.capture = { ply: i, from: squareToXZ(to), to: slotPosition(t.color, lost[t.color]++) };
        at.delete(to);
      }
      tracks[mover].moves.push({ ply: i, from: squareToXZ(from), to: squareToXZ(to), capture });
      at.delete(from);
      at.set(to, mover);
    }
  });
  return tracks;
}

const tmpA = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
const qYaw = new THREE.Quaternion();
const qTilt = new THREE.Quaternion();
const tiltAxis = new THREE.Vector3();

// Place every tracked piece for game time g. Returns true if anything is mid-air.
export function poseAt(tracks, g) {
  let moving = false;
  for (const t of tracks) {
    const pos = tmpA.copy(t.home);
    let lift = 0, tilt = 0, dir = null;

    for (const m of t.moves) {
      const [a, b] = m.capture ? CAPTURER : QUIET;
      const k = clamp01((g - m.ply - a) / (b - a));
      if (k <= 0) break;
      const e = easeInOut(k);
      pos.lerpVectors(m.from, m.to, e);
      if (k < 1) {
        const knight = t.type === 'n';
        const dist = m.from.distanceTo(m.to);
        lift = Math.sin(Math.PI * k) * (knight ? 0.75 : 0.32 + 0.04 * dist);
        tilt = Math.sin(Math.PI * k) * 0.09;
        dir = tiltAxis.subVectors(m.to, m.from).normalize();
        moving = true;
        break;
      }
    }

    if (t.capture) {
      const k = clamp01((g - t.capture.ply - VICTIM[0]) / (VICTIM[1] - VICTIM[0]));
      if (k > 0) {
        pos.lerpVectors(t.capture.from, t.capture.to, easeInOut(k));
        lift = Math.sin(Math.PI * k) * 1.25;
        tilt = 0;
        if (k < 1) moving = true;
      }
    }

    t.piece.position.set(pos.x + t.jitter.x, lift, pos.z + t.jitter.z);
    qYaw.setFromAxisAngle(yAxis, t.yaw);
    if (tilt && dir) {
      // Lean slightly into the direction of travel, like a piece carried by hand.
      qTilt.setFromAxisAngle(new THREE.Vector3(dir.z, 0, -dir.x), tilt);
      t.piece.quaternion.copy(qTilt).multiply(qYaw);
    } else {
      t.piece.quaternion.copy(qYaw);
    }
  }
  return moving;
}

// The last ply that has started by game time g, or -1.
export function plyAt(g) {
  return Math.min(TOTAL_PLIES - 1, Math.floor(g - 0.1));
}
