import type { Rect } from "./collision";
import type { LidarReading } from "./lidar";

export const SLAM_MAX_VALUE = 100;
const INITIAL_VALUE = 50;

// Per-cell free-space evidence: rays passing through a cell add 1, a ray ending on an obstacle in a cell subtracts 1.
export class SlamGrid {
  readonly cellSize: number;
  bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  cols = 0;
  rows = 0;
  values = new Uint8Array(0);
  // Bumped whenever `values` changes, so views can skip redundant redraws.
  version = 0;

  constructor(cellSize = 10) {
    this.cellSize = cellSize;
  }

  // Clears the map only when the bounds actually change.
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
    this.bounds = { ...bounds };
    this.cols = Math.ceil(bounds.width / this.cellSize);
    this.rows = Math.ceil(bounds.height / this.cellSize);
    this.values = new Uint8Array(this.cols * this.rows).fill(INITIAL_VALUE);
    this.version++;
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
    const value = Math.min(SLAM_MAX_VALUE, Math.max(0, this.values[i] + delta));
    if (value !== this.values[i]) {
      this.values[i] = value;
      this.version++;
    }
  }
}
