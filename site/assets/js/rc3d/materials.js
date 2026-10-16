// Materials for the set, the board and the medallion. Colours follow the brand palette.

import * as THREE from 'three';
import { woodTile, pieceGrain, boardTop, contactShadow } from './textures.js';

export const PALETTE = {
  orange: '#ff5b1f',
  ivory: '#f3ebdd',
  maple: '#d9b98a',
  walnut: '#5a3a26',
};

export async function buildMaterials({ renderer, font = '"Bricolage Grotesque", sans-serif' }) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const mapleTile = woodTile(512, 512, { base: '#e2c394', dark: '#b88a55', seed: 11, rings: 5, contrast: 0.55, streaks: 0.45 });
  const walnutTile = woodTile(512, 512, { base: '#6a4630', dark: '#2c190e', seed: 23, rings: 6, contrast: 0.85, streaks: 0.6 });
  const frameStrip = woodTile(2048, 192, { base: '#5c3b26', dark: '#24140a', seed: 37, rings: 4, contrast: 0.9, streaks: 0.6 });

  const top = boardTop({ units: 9.3, maple: mapleTile, walnut: walnutTile, frame: frameStrip, font });
  top.anisotropy = aniso;

  const sideTex = new THREE.CanvasTexture(frameStrip);
  sideTex.colorSpace = THREE.SRGBColorSpace;
  sideTex.anisotropy = aniso;

  const lightGrain = pieceGrain(5, { base: '#ffffff', dark: '#d8c3a0', contrast: 0.32 });
  const darkGrain = pieceGrain(9, { base: '#ffffff', dark: '#8a6a55', contrast: 0.45 });
  lightGrain.anisotropy = darkGrain.anisotropy = aniso;

  const blob = contactShadow();

  return {
    boardTop: new THREE.MeshPhysicalMaterial({
      map: top, roughness: 0.46, clearcoat: 0.55, clearcoatRoughness: 0.22,
    }),
    boardSide: new THREE.MeshPhysicalMaterial({
      map: sideTex, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.25,
    }),
    white: new THREE.MeshPhysicalMaterial({
      color: '#ead9b9', map: lightGrain, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.14,
      sheen: 0.25, sheenColor: new THREE.Color('#fff4e0'), sheenRoughness: 0.6,
    }),
    black: new THREE.MeshPhysicalMaterial({
      color: '#3a2619', map: darkGrain, roughness: 0.36, clearcoat: 0.85, clearcoatRoughness: 0.1,
    }),
    shadow: new THREE.MeshBasicMaterial({
      map: blob, transparent: true, depthWrite: false, opacity: 0.62,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    enamel: new THREE.MeshPhysicalMaterial({
      color: PALETTE.orange, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.035,
    }),
    ivory: new THREE.MeshPhysicalMaterial({
      color: '#f4ead9', roughness: 0.3, clearcoat: 0.75, clearcoatRoughness: 0.08,
    }),
    ivorySatin: new THREE.MeshPhysicalMaterial({
      color: '#efe4d2', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.2,
    }),
    checker: new THREE.MeshPhysicalMaterial({
      color: '#ece3d4', roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.3,
    }),
  };
}
