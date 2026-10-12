import type { Rect, Vec2 } from "./geometry";
import type { Neighbours } from "./graphSearch";

// Axial coordinates of a pointy-top hex; see redblobgames.com/grids/hexagons.
interface Hex {
  q: number;
  r: number;
}

const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// Unit vector from a hex centre towards each neighbour's centre, matching DIRECTIONS.
const NORMALS: readonly Vec2[] = DIRECTIONS.map(({ q, r }) => ({
  x: q + r / 2,
  y: (Math.sqrt(3) / 2) * r,
}));

const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

const hexDistance = (a: Hex, b: Hex) =>
  (Math.abs(a.q - b.q) +
    Math.abs(a.r - b.r) +
    Math.abs(a.q + a.r - b.q - b.r)) /
  2;

// Nearest hex to fractional axial coordinates, via cube rounding.
function hexRound(q: number, r: number): Hex {
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

// A rectangle of pointy-top hexes covering `bounds`, with hex (0, 0) centred on its top-left.
// Callers see cells as numbers (-1 = outside): row by row in odd-r offset order, so per-cell data fits flat typed arrays.
export class HexGrid {
  // Distance between neighbouring hex centres (flat-to-flat width).
  readonly size: number;
  // Centre-to-corner distance.
  readonly radius: number;
  bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  cols = 0;
  rows = 0;

  constructor(size: number) {
    this.size = size;
    this.radius = size / Math.sqrt(3);
  }

  get cellCount(): number {
    return this.cols * this.rows;
  }

  setBounds(bounds: Rect): void {
    this.bounds = { ...bounds };
    this.cols = Math.ceil(bounds.width / this.size) + 1;
    this.rows = Math.ceil(bounds.height / (1.5 * this.radius)) + 1;
  }

  cellAt(p: Vec2): number {
    return this.indexOf(this.hexAt(p));
  }

  centreOf(cell: number): Vec2 {
    return this.hexCentre(this.hexOf(cell));
  }

  // Steps between two cells.
  distance(a: number, b: number): number {
    return hexDistance(this.hexOf(a), this.hexOf(b));
  }

  // The six adjacent cells that lie inside the grid, each one step away.
  readonly neighbours: Neighbours = (cell, visit) => {
    const hex = this.hexOf(cell);
    for (const d of DIRECTIONS) {
      const next = this.indexOf(hexAdd(hex, d));
      if (next >= 0) visit(next);
    }
  };

  // Every cell whose centre might lie inside `rect` (a superset; callers test exactly).
  *cellsNear(rect: Rect): Generator<number> {
    const rowOf = (y: number) => (y - this.bounds.y) / (1.5 * this.radius);
    const colOf = (x: number) => (x - this.bounds.x) / this.size;
    const row0 = Math.max(0, Math.floor(rowOf(rect.y)));
    const row1 = Math.min(
      this.rows - 1,
      Math.ceil(rowOf(rect.y + rect.height)),
    );
    // Odd rows sit half a hex right, so widen by one column to cover both.
    const col0 = Math.max(0, Math.floor(colOf(rect.x)) - 1);
    const col1 = Math.min(this.cols - 1, Math.ceil(colOf(rect.x + rect.width)));
    for (let row = row0; row <= row1; row++) {
      for (let col = col0; col <= col1; col++) yield row * this.cols + col;
    }
  }

  // Every cell the segment from `a` to `b` passes through, in order, ending with the cell containing `b`.
  // Walks hex to hex, leaving each through the edge the segment crosses first.
  *traverse(a: Vec2, b: Vec2): Generator<number> {
    const end = this.hexAt(b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const apothem = this.size / 2;
    let hex = this.hexAt(a);
    // A straight line crosses at most ~2 hexes per step of hex distance; the cap stops float error looping.
    const maxSteps = 2 * hexDistance(hex, end) + 4;
    for (let i = 0; i < maxSteps && (hex.q !== end.q || hex.r !== end.r); i++) {
      yield this.indexOf(hex);
      const c = this.hexCentre(hex);
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
      hex = hexAdd(hex, DIRECTIONS[exit]);
    }
    yield this.indexOf(end);
  }

  private hexAt(p: Vec2): Hex {
    const r = ((2 / 3) * (p.y - this.bounds.y)) / this.radius;
    const q = (p.x - this.bounds.x) / this.size - r / 2;
    return hexRound(q, r);
  }

  private hexCentre({ q, r }: Hex): Vec2 {
    return {
      x: this.bounds.x + (q + r / 2) * this.size,
      y: this.bounds.y + 1.5 * r * this.radius,
    };
  }

  private indexOf({ q, r }: Hex): number {
    const col = q + (r - (r & 1)) / 2;
    if (col < 0 || r < 0 || col >= this.cols || r >= this.rows) return -1;
    return r * this.cols + col;
  }

  private hexOf(cell: number): Hex {
    const row = Math.floor(cell / this.cols);
    return { q: (cell % this.cols) - (row - (row & 1)) / 2, r: row };
  }
}
