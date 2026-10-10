import type { Rect, Vec2 } from "./collision";
import type { LidarReading } from "./lidar";

export const SLAM_MAX_VALUE = 100;
export const SLAM_MIN_VALUE = -100;
// Cells at or beyond this much evidence either way count as mapped (free if positive, occupied if negative).
export const SLAM_KNOWN_VALUE = 25;

// Axial coordinates of a pointy-top hex (see redblobgames.com/grids/hexagons).
export interface Hex {
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
const NORMALS = DIRECTIONS.map(({ q, r }) => ({
  x: q + r / 2,
  y: (Math.sqrt(3) / 2) * r,
}));

function roundHex(q: number, r: number): Hex {
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

const hexDistance = (a: Hex, b: Hex) =>
  (Math.abs(a.q - b.q) +
    Math.abs(a.r - b.r) +
    Math.abs(a.q + a.r - b.q - b.r)) /
  2;

// Per-hex evidence (0 = unmapped): every hex a ray passes through gains 1; the hex a ray hits loses 1.
// Stored as "odd-r" offset rows (odd rows shifted right half a hex); hex (0, 0) is centred on the bounds' top-left.
export class SlamGrid {
  // Distance between neighbouring hex centres (flat-to-flat width).
  readonly cellSize: number;
  // Centre-to-corner distance.
  readonly radius: number;
  bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  cols = 0;
  rows = 0;
  values = new Int8Array(0);
  // Bumped whenever `values` changes, so views can skip redundant redraws.
  version = 0;

  constructor(cellSize = 10) {
    this.cellSize = cellSize;
    this.radius = cellSize / Math.sqrt(3);
  }

  // Keeps existing cells when only the size changes (e.g. the page grows); clears if the origin moves.
  setBounds(bounds: Rect): void {
    const b = this.bounds;
    if (
      b.x === bounds.x &&
      b.y === bounds.y &&
      b.width === bounds.width &&
      b.height === bounds.height
    ) {
      return;
    }
    const sameOrigin = b.x === bounds.x && b.y === bounds.y;
    const old = { values: this.values, cols: this.cols, rows: this.rows };
    this.bounds = { ...bounds };
    this.cols = Math.ceil(bounds.width / this.cellSize) + 1;
    this.rows = Math.ceil(bounds.height / (1.5 * this.radius)) + 1;
    this.values = new Int8Array(this.cols * this.rows);
    if (sameOrigin) {
      const cols = Math.min(this.cols, old.cols);
      for (let row = 0; row < Math.min(this.rows, old.rows); row++) {
        const from = row * old.cols;
        this.values.set(
          old.values.subarray(from, from + cols),
          row * this.cols,
        );
      }
    }
    this.version++;
  }

  clear(): void {
    this.values.fill(0);
    this.version++;
  }

  hexAt(p: Vec2): Hex {
    const r = ((2 / 3) * (p.y - this.bounds.y)) / this.radius;
    const q = (p.x - this.bounds.x) / this.cellSize - r / 2;
    return roundHex(q, r);
  }

  centreOf({ q, r }: Hex): Vec2 {
    return {
      x: this.bounds.x + (q + r / 2) * this.cellSize,
      y: this.bounds.y + 1.5 * r * this.radius,
    };
  }

  // Index into `values`, or -1 outside the grid.
  indexOf({ q, r }: Hex): number {
    const col = q + (r - (r & 1)) / 2;
    if (col < 0 || r < 0 || col >= this.cols || r >= this.rows) return -1;
    return r * this.cols + col;
  }

  hexOfIndex(i: number): Hex {
    const r = Math.floor(i / this.cols);
    return { q: (i % this.cols) - (r - (r & 1)) / 2, r };
  }

  isKnown(p: Vec2): boolean {
    const i = this.indexOf(this.hexAt(p));
    return i >= 0 && this.values[i] >= SLAM_KNOWN_VALUE;
  }

  // If `p` lies in a known-free hex bordering unmapped space, the centre of one such unmapped neighbour.
  unmappedNeighbour(p: Vec2): Vec2 | null {
    if (!this.isKnown(p)) return null;
    const hex = this.hexAt(p);
    for (const d of DIRECTIONS) {
      const next = { q: hex.q + d.q, r: hex.r + d.r };
      const i = this.indexOf(next);
      if (i >= 0 && Math.abs(this.values[i]) < SLAM_KNOWN_VALUE) {
        return this.centreOf(next);
      }
    }
    return null;
  }

  // Walks every hex from the ray origin to its end point, leaving each through the edge the ray crosses first.
  addReading({ origin, point, hit }: LidarReading): void {
    const end = this.hexAt(point);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const apothem = this.cellSize / 2;
    let hex = this.hexAt(origin);
    // A straight line crosses at most ~2 hexes per step of hex distance; the cap stops float error looping.
    const maxSteps = 2 * hexDistance(hex, end) + 4;
    for (let i = 0; i < maxSteps && (hex.q !== end.q || hex.r !== end.r); i++) {
      this.add(hex, 1);
      const c = this.centreOf(hex);
      const ox = origin.x - c.x;
      const oy = origin.y - c.y;
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
      hex = { q: hex.q + DIRECTIONS[exit].q, r: hex.r + DIRECTIONS[exit].r };
    }
    this.add(end, hit ? -1 : 1);
  }

  private add(hex: Hex, delta: number): void {
    const i = this.indexOf(hex);
    if (i < 0) return;
    const value = Math.min(
      SLAM_MAX_VALUE,
      Math.max(SLAM_MIN_VALUE, this.values[i] + delta),
    );
    if (value !== this.values[i]) {
      this.values[i] = value;
      this.version++;
    }
  }
}
