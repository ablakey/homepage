import {
  distance,
  distanceInside,
  distanceToRect,
  lerp,
  type Vec2,
} from "./geometry";
import { breadthFirstSearch, type Neighbours } from "./graphSearch";
import type { Obstacles } from "./obstacles";

const ORTHOGONAL: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAGONAL: readonly [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// Square-celled configuration space for a round robot: a cell is blocked if its centre lies within `clearance`
// of a rect or the bounds edge. Cells are numbered row-major from the bounds' top-left.
export class OccupancyGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  private readonly origin: Vec2;

  constructor(obstacles: Obstacles, clearance: number, cellSize: number) {
    const { bounds } = obstacles;
    this.cellSize = cellSize;
    this.origin = { x: bounds.x, y: bounds.y };
    this.cols = Math.max(1, Math.ceil(bounds.width / cellSize));
    this.rows = Math.max(1, Math.ceil(bounds.height / cellSize));
    this.blocked = new Uint8Array(this.cols * this.rows);

    for (let cell = 0; cell < this.blocked.length; cell++) {
      if (distanceInside(this.centreOf(cell), bounds) < clearance) {
        this.blocked[cell] = 1;
      }
    }
    // Only visit cells within each rect's inflated bounding box.
    for (const rect of obstacles.rects) {
      const x0 = this.colOf(rect.x - clearance);
      const x1 = this.colOf(rect.x + rect.width + clearance);
      const y0 = this.rowOf(rect.y - clearance);
      const y1 = this.rowOf(rect.y + rect.height + clearance);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const cell = cy * this.cols + cx;
          if (distanceToRect(this.centreOf(cell), rect) < clearance) {
            this.blocked[cell] = 1;
          }
        }
      }
    }
  }

  get cellCount(): number {
    return this.blocked.length;
  }

  private colOf(x: number): number {
    const col = Math.floor((x - this.origin.x) / this.cellSize);
    return Math.min(this.cols - 1, Math.max(0, col));
  }

  private rowOf(y: number): number {
    const row = Math.floor((y - this.origin.y) / this.cellSize);
    return Math.min(this.rows - 1, Math.max(0, row));
  }

  // Points outside the grid map to the nearest edge cell.
  cellAt(p: Vec2): number {
    return this.rowOf(p.y) * this.cols + this.colOf(p.x);
  }

  centreOf(cell: number): Vec2 {
    return {
      x: this.origin.x + ((cell % this.cols) + 0.5) * this.cellSize,
      y: this.origin.y + (Math.floor(cell / this.cols) + 0.5) * this.cellSize,
    };
  }

  isFree(p: Vec2): boolean {
    return !this.blocked[this.cellAt(p)];
  }

  // Also blocks every cell whose centre fails `isKnown`, except `except` (typically the robot's own cell).
  blockUnknown(isKnown: (p: Vec2) => boolean, except: number): void {
    for (let cell = 0; cell < this.blocked.length; cell++) {
      if (cell !== except && !isKnown(this.centreOf(cell))) {
        this.blocked[cell] = 1;
      }
    }
  }

  // Samples the segment every half cell.
  lineOfSight(a: Vec2, b: Vec2): boolean {
    const steps = Math.ceil(distance(a, b) / (this.cellSize / 2));
    for (let i = 1; i < steps; i++) {
      if (!this.isFree(lerp(a, b, i / steps))) return false;
    }
    return true;
  }

  // Exact 8-connected path length (in cells) between two cells on an empty grid; an admissible A* heuristic.
  octileDistance(a: number, b: number): number {
    const dx = Math.abs((a % this.cols) - (b % this.cols));
    const dy = Math.abs(Math.floor(a / this.cols) - Math.floor(b / this.cols));
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  }

  // Closest unblocked cell to `cell` (4-connected steps, passing through blocked cells), or -1 if none.
  nearestFree(cell: number): number {
    return breadthFirstSearch(
      this.cellCount,
      cell,
      this.adjacent,
      (c) => !this.blocked[c],
    );
  }

  // 4-connected in-bounds neighbours, blocked or not.
  readonly adjacent: Neighbours = (cell, visit) => {
    const cx = cell % this.cols;
    const cy = Math.floor(cell / this.cols);
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      visit(ny * this.cols + nx, 1);
    }
  };

  // 4-connected free neighbours.
  readonly freeAdjacent: Neighbours = (cell, visit) =>
    this.adjacent(cell, (next) => {
      if (!this.blocked[next]) visit(next, 1);
    });

  // 8-connected free neighbours, costed in cells; diagonal moves may not cut past a blocked corner.
  readonly freeMoves: Neighbours = (cell, visit) => {
    this.freeAdjacent(cell, visit);
    const cx = cell % this.cols;
    const cy = Math.floor(cell / this.cols);
    for (const [dx, dy] of DIAGONAL) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      const next = ny * this.cols + nx;
      if (
        this.blocked[next] ||
        this.blocked[cy * this.cols + nx] ||
        this.blocked[ny * this.cols + cx]
      ) {
        continue;
      }
      visit(next, Math.SQRT2);
    }
  };
}
