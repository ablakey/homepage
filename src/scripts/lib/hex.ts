import type { Vec2 } from "./geometry";

// Pointy-top hex grid maths in axial coordinates; see redblobgames.com/grids/hexagons.
export interface Hex {
  q: number;
  r: number;
}

export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// Unit vector from a hex centre towards each neighbour's centre, matching HEX_DIRECTIONS.
const NORMALS: readonly Vec2[] = HEX_DIRECTIONS.map(({ q, r }) => ({
  x: q + r / 2,
  y: (Math.sqrt(3) / 2) * r,
}));

export const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export const hexEquals = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;

export const hexDistance = (a: Hex, b: Hex) =>
  (Math.abs(a.q - b.q) +
    Math.abs(a.r - b.r) +
    Math.abs(a.q + a.r - b.q - b.r)) /
  2;

// Nearest hex to fractional axial coordinates, via cube rounding.
export function hexRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

// Every hex within `n` steps of `centre`.
export function* hexesInRange(centre: Hex, n: number): Generator<Hex> {
  for (let dq = -n; dq <= n; dq++) {
    for (let dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) {
      yield { q: centre.q + dq, r: centre.r + dr };
    }
  }
}

// "Odd-r" offset coordinates (odd rows shifted right half a hex), for storing a rectangular patch in an array.
export const toOddR = ({ q, r }: Hex) => ({
  col: q + (r - (r & 1)) / 2,
  row: r,
});

export const fromOddR = (col: number, row: number): Hex => ({
  q: col - (row - (row & 1)) / 2,
  r: row,
});

// Maps between world points and hexes, with hex (0, 0) centred on `origin`.
export class HexLayout {
  readonly origin: Vec2;
  // Distance between neighbouring hex centres (flat-to-flat width).
  readonly size: number;
  // Centre-to-corner distance.
  readonly radius: number;

  constructor(origin: Vec2, size: number) {
    this.origin = { ...origin };
    this.size = size;
    this.radius = size / Math.sqrt(3);
  }

  hexAt(p: Vec2): Hex {
    const r = ((2 / 3) * (p.y - this.origin.y)) / this.radius;
    const q = (p.x - this.origin.x) / this.size - r / 2;
    return hexRound(q, r);
  }

  centreOf({ q, r }: Hex): Vec2 {
    return {
      x: this.origin.x + (q + r / 2) * this.size,
      y: this.origin.y + 1.5 * r * this.radius,
    };
  }

  // Every hex the segment from `a` to `b` passes through, in order, ending with the hex containing `b`.
  // Walks hex to hex, leaving each through the edge the segment crosses first.
  *traverse(a: Vec2, b: Vec2): Generator<Hex> {
    const end = this.hexAt(b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const apothem = this.size / 2;
    let hex = this.hexAt(a);
    // A straight line crosses at most ~2 hexes per step of hex distance; the cap stops float error looping.
    const maxSteps = 2 * hexDistance(hex, end) + 4;
    for (let i = 0; i < maxSteps && !hexEquals(hex, end); i++) {
      yield hex;
      const c = this.centreOf(hex);
      const ox = a.x - c.x;
      const oy = a.y - c.y;
      let exitT = Infinity;
      let exit = 0;
      NORMALS.forEach((n, k) => {
        const speed = dx * n.x + dy * n.y;
        if (speed <= 0) return;
        const t = (apothem - (ox * n.x + oy * n.y)) / speed;
        if (t < exitT) {
          exitT = t;
          exit = k;
        }
      });
      hex = hexAdd(hex, HEX_DIRECTIONS[exit]);
    }
    yield end;
  }
}
