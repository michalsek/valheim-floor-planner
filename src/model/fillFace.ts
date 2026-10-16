/**
 * Fills a wall face (length × height, in metres) with whole pieces, "bands, largest
 * first": at each height, lay the tallest pieces that fit, longest first; fill what's
 * left of that band with shorter pieces, recursively. What can't be filled is reported.
 */
import type { WallPieceDef } from '../catalog/wallFamilies';

import { EPS } from './geometry/polyline';

export interface FilledPiece {
  piece: WallPieceDef;
  /** Distance from the face's start, along its length. */
  offset: number;
  /** Height of the piece's bottom edge. */
  base: number;
}

export interface UnfilledRect {
  offset: number;
  base: number;
  length: number;
  height: number;
}

export interface FaceFill {
  placed: FilledPiece[];
  unfilled: UnfilledRect[];
}

export const fillFace = (
  pieces: readonly WallPieceDef[],
  length: number,
  height: number
): FaceFill => {
  const result: FaceFill = { placed: [], unfilled: [] };
  fillRect(pieces, { offset: 0, base: 0, length, height }, result);
  return result;
};

const fillRect = (pieces: readonly WallPieceDef[], rect: UnfilledRect, out: FaceFill): void => {
  if (rect.length < EPS || rect.height < EPS) return;
  const h = tallestFitting(pieces, rect.height);
  if (h === null) {
    out.unfilled.push(rect);
    return;
  }

  const band = pieces
    .filter((p) => Math.abs(p.height - h) < EPS)
    .sort((a, b) => b.length - a.length);
  const shorter = pieces.filter((p) => p.height < h - EPS);

  let base = rect.base;
  while (rect.base + rect.height - base >= h - EPS) {
    const used = layBand(band, rect.offset, base, rect.length, out);
    fillRect(
      shorter,
      { offset: rect.offset + used, base, length: rect.length - used, height: h },
      out
    );
    base += h;
  }
  // The rest is lower than every piece of height `h`.
  fillRect(
    pieces,
    { offset: rect.offset, base, length: rect.length, height: rect.base + rect.height - base },
    out
  );
};

/** Lays pieces (longest first) left to right; returns the length used. */
const layBand = (
  band: readonly WallPieceDef[],
  offset: number,
  base: number,
  length: number,
  out: FaceFill
): number => {
  let used = 0;
  for (const piece of band) {
    while (length - used >= piece.length - EPS) {
      out.placed.push({ piece, offset: offset + used, base });
      used += piece.length;
    }
  }
  return used;
};

const tallestFitting = (pieces: readonly WallPieceDef[], height: number): number | null => {
  const heights = pieces.map((p) => p.height).filter((h) => h <= height + EPS);
  return heights.length > 0 ? Math.max(...heights) : null;
};
