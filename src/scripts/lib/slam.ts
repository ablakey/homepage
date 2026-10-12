import type { Rect, Vec2 } from "./geometry";
import { HexGrid } from "./hexGrid";
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
export class SlamGrid extends HexGrid {
  readonly options: SlamOptions;
  values = new Int8Array(0);
  // Bumped whenever `values` changes, so views can skip redundant redraws.
  version = 0;

  constructor(options: SlamOptions) {
    super(options.cellSize);
    this.options = options;
  }

  // Keeps existing cells when only the size changes (e.g. the page grows); clears if the origin moves.
  override setBounds(bounds: Rect): void {
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
    super.setBounds(bounds);
    this.values = new Int8Array(this.cellCount);
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

  // Mapped as free.
  isKnown(cell: number): boolean {
    return cell >= 0 && this.values[cell] >= this.options.knownValue;
  }

  // If `p` lies in a known-free hex bordering unmapped space, the centre of one such unmapped neighbour.
  unmappedNeighbour(p: Vec2): Vec2 | null {
    const cell = this.cellAt(p);
    if (!this.isKnown(cell)) return null;
    let found = -1;
    this.neighbours(cell, (next) => {
      if (found < 0 && Math.abs(this.values[next]) < this.options.knownValue) {
        found = next;
      }
    });
    return found < 0 ? null : this.centreOf(found);
  }

  addReading({ origin, point, hit }: RangeReading): void {
    const end = this.cellAt(point);
    for (const cell of this.traverse(origin, point)) {
      this.add(cell, hit && cell === end ? -1 : 1);
    }
  }

  private add(cell: number, delta: number): void {
    if (cell < 0) return;
    const { minValue, maxValue } = this.options;
    const value = clamp(this.values[cell] + delta, minValue, maxValue);
    if (value !== this.values[cell]) {
      this.values[cell] = value;
      this.version++;
    }
  }
}
