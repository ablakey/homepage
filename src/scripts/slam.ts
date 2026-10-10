import type { Rect, Vec2 } from "./collision";
import type { LidarReading } from "./lidar";

export const SLAM_MAX_VALUE = 100;
export const SLAM_MIN_VALUE = -100;
// Cells at or beyond this much evidence either way count as mapped (free if positive, occupied if negative).
export const SLAM_KNOWN_VALUE = 25;

// Per-cell evidence (0 = unmapped): every cell a ray passes through gains 1; the cell a ray hits loses 1.
export class SlamGrid {
  readonly cellSize: number;
  bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  cols = 0;
  rows = 0;
  values = new Int8Array(0);
  // Bumped whenever `values` changes, so views can skip redundant redraws.
  version = 0;

  constructor(cellSize = 10) {
    this.cellSize = cellSize;
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
    this.cols = Math.ceil(bounds.width / this.cellSize);
    this.rows = Math.ceil(bounds.height / this.cellSize);
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

  isKnown(p: Vec2): boolean {
    const cx = Math.floor((p.x - this.bounds.x) / this.cellSize);
    const cy = Math.floor((p.y - this.bounds.y) / this.cellSize);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return false;
    return this.values[cy * this.cols + cx] >= SLAM_KNOWN_VALUE;
  }

  // If `p` lies in a known-free cell bordering unmapped space, the centre of one such unmapped neighbour.
  unmappedNeighbour(p: Vec2): Vec2 | null {
    if (!this.isKnown(p)) return null;
    const cx = Math.floor((p.x - this.bounds.x) / this.cellSize);
    const cy = Math.floor((p.y - this.bounds.y) / this.cellSize);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      if (Math.abs(this.values[ny * this.cols + nx]) < SLAM_KNOWN_VALUE) {
        return {
          x: this.bounds.x + (nx + 0.5) * this.cellSize,
          y: this.bounds.y + (ny + 0.5) * this.cellSize,
        };
      }
    }
    return null;
  }

  // Amanatides-Woo traversal of every cell from the ray origin to its end point.
  addReading({ origin, point, hit }: LidarReading): void {
    const size = this.cellSize;
    const ax = (origin.x - this.bounds.x) / size;
    const ay = (origin.y - this.bounds.y) / size;
    const dx = (point.x - this.bounds.x) / size - ax;
    const dy = (point.y - this.bounds.y) / size - ay;
    let cx = Math.floor(ax);
    let cy = Math.floor(ay);
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const tDeltaX = stepX ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY ? Math.abs(1 / dy) : Infinity;
    let tMaxX =
      stepX > 0
        ? (cx + 1 - ax) * tDeltaX
        : stepX < 0
          ? (ax - cx) * tDeltaX
          : Infinity;
    let tMaxY =
      stepY > 0
        ? (cy + 1 - ay) * tDeltaY
        : stepY < 0
          ? (ay - cy) * tDeltaY
          : Infinity;

    // Step count fixed up front so float error can't overshoot or loop.
    const steps =
      Math.abs(Math.floor(ax + dx) - cx) + Math.abs(Math.floor(ay + dy) - cy);
    for (let i = 0; i < steps; i++) {
      this.add(cx, cy, 1);
      if (tMaxX < tMaxY) {
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        tMaxY += tDeltaY;
        cy += stepY;
      }
    }
    this.add(cx, cy, hit ? -1 : 1);
  }

  private add(cx: number, cy: number, delta: number): void {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    const i = cy * this.cols + cx;
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
