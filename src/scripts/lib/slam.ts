import type { Rect, Vec2 } from "./geometry";
import {
  fromOddR,
  HEX_DIRECTIONS,
  hexAdd,
  hexEquals,
  HexLayout,
  toOddR,
  type Hex,
} from "./hex";
import { clamp } from "./math";

export interface SlamOptions {
  // Distance between neighbouring hex centres.
  cellSize: number;
  // Evidence limits; must fit in an Int8.
  minValue: number;
  maxValue: number;
  // Cells at or beyond this much evidence either way count as mapped (free if positive, occupied if negative).
  knownValue: number;
}

// A range-sensor ray: it crossed free space from `origin` to `point`, where it hit something if `hit`.
export interface RangeReading {
  origin: Vec2;
  point: Vec2;
  hit: boolean;
}

// Per-hex evidence (0 = unmapped): every hex a ray passes through gains 1; the hex a ray hits loses 1.
// Stored in odd-r offset rows; hex (0, 0) is centred on the bounds' top-left.
export class SlamGrid {
  readonly options: SlamOptions;
  bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  layout: HexLayout;
  cols = 0;
  rows = 0;
  values = new Int8Array(0);
  // Bumped whenever `values` changes, so views can skip redundant redraws.
  version = 0;

  constructor(options: SlamOptions) {
    this.options = options;
    this.layout = new HexLayout(this.bounds, options.cellSize);
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
    const { size, radius } = this.layout;
    this.layout = new HexLayout(bounds, size);
    this.cols = Math.ceil(bounds.width / size) + 1;
    this.rows = Math.ceil(bounds.height / (1.5 * radius)) + 1;
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

  // Index into `values`, or -1 outside the grid.
  indexOf(hex: Hex): number {
    const { col, row } = toOddR(hex);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  hexOfIndex(i: number): Hex {
    return fromOddR(i % this.cols, Math.floor(i / this.cols));
  }

  isKnown(p: Vec2): boolean {
    const i = this.indexOf(this.layout.hexAt(p));
    return i >= 0 && this.values[i] >= this.options.knownValue;
  }

  // If `p` lies in a known-free hex bordering unmapped space, the centre of one such unmapped neighbour.
  unmappedNeighbour(p: Vec2): Vec2 | null {
    if (!this.isKnown(p)) return null;
    const hex = this.layout.hexAt(p);
    for (const d of HEX_DIRECTIONS) {
      const next = hexAdd(hex, d);
      const i = this.indexOf(next);
      if (i >= 0 && Math.abs(this.values[i]) < this.options.knownValue) {
        return this.layout.centreOf(next);
      }
    }
    return null;
  }

  addReading({ origin, point, hit }: RangeReading): void {
    const end = this.layout.hexAt(point);
    for (const hex of this.layout.traverse(origin, point)) {
      this.add(hex, hit && hexEquals(hex, end) ? -1 : 1);
    }
  }

  private add(hex: Hex, delta: number): void {
    const i = this.indexOf(hex);
    if (i < 0) return;
    const { minValue, maxValue } = this.options;
    const value = clamp(this.values[i] + delta, minValue, maxValue);
    if (value !== this.values[i]) {
      this.values[i] = value;
      this.version++;
    }
  }
}
