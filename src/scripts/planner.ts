import { distanceToRect, type Vec2 } from "./collision";
import type { Obstacles } from "./obstacles";

const CELL_SIZE = 4;

// 8-connected moves: [dx, dy, cost in cells].
const MOVES: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

// Obstacles inflated by `clearance`: a cell is blocked if its centre is within `clearance` of a rect or the bounds edge.
class OccupancyGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  private readonly origin: Vec2;

  constructor(obstacles: Obstacles, clearance: number) {
    const { bounds } = obstacles;
    this.origin = { x: bounds.x, y: bounds.y };
    this.cols = Math.max(1, Math.ceil(bounds.width / CELL_SIZE));
    this.rows = Math.max(1, Math.ceil(bounds.height / CELL_SIZE));
    this.blocked = new Uint8Array(this.cols * this.rows);

    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const c = this.centreOf(cy * this.cols + cx);
        if (
          c.x - bounds.x < clearance ||
          right - c.x < clearance ||
          c.y - bounds.y < clearance ||
          bottom - c.y < clearance
        ) {
          this.blocked[cy * this.cols + cx] = 1;
        }
      }
    }

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

  private colOf(x: number): number {
    const col = Math.floor((x - this.origin.x) / CELL_SIZE);
    return Math.min(this.cols - 1, Math.max(0, col));
  }

  private rowOf(y: number): number {
    const row = Math.floor((y - this.origin.y) / CELL_SIZE);
    return Math.min(this.rows - 1, Math.max(0, row));
  }

  cellAt(p: Vec2): number {
    return this.rowOf(p.y) * this.cols + this.colOf(p.x);
  }

  centreOf(cell: number): Vec2 {
    return {
      x: this.origin.x + ((cell % this.cols) + 0.5) * CELL_SIZE,
      y: this.origin.y + (Math.floor(cell / this.cols) + 0.5) * CELL_SIZE,
    };
  }

  // Breadth-first search outwards for the closest unblocked cell, or -1 if none.
  nearestFree(cell: number): number {
    const seen = new Uint8Array(this.blocked.length);
    const queue = [cell];
    seen[cell] = 1;
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      if (!this.blocked[cur]) return cur;
      const cx = cur % this.cols;
      const cy = Math.floor(cur / this.cols);
      for (const [dx, dy] of MOVES.slice(0, 4)) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const next = ny * this.cols + nx;
        if (!seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    return -1;
  }

  lineOfSight(a: Vec2, b: Vec2): boolean {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL_SIZE / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (this.blocked[this.cellAt(p)]) return false;
    }
    return true;
  }
}

// Binary min-heap of cell ids keyed by f-score; stale entries are skipped by the caller.
class MinHeap {
  private readonly ids: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number): void {
    let i = this.ids.length;
    this.ids.push(id);
    this.keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= key) break;
      this.ids[i] = this.ids[parent];
      this.keys[i] = this.keys[parent];
      i = parent;
    }
    this.ids[i] = id;
    this.keys[i] = key;
  }

  pop(): number {
    const top = this.ids[0];
    const id = this.ids.pop()!;
    const key = this.keys.pop()!;
    const n = this.ids.length;
    if (n === 0) return top;
    let i = 0;
    while (true) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const c = l + 1 < n && this.keys[l + 1] < this.keys[l] ? l + 1 : l;
      if (this.keys[c] >= key) break;
      this.ids[i] = this.ids[c];
      this.keys[i] = this.keys[c];
      i = c;
    }
    this.ids[i] = id;
    this.keys[i] = key;
    return top;
  }
}

function aStar(
  grid: OccupancyGrid,
  start: number,
  goal: number,
): number[] | null {
  const { cols, rows, blocked } = grid;
  const gx = goal % cols;
  const gy = Math.floor(goal / cols);
  // Octile distance.
  const h = (cell: number) => {
    const dx = Math.abs((cell % cols) - gx);
    const dy = Math.abs(Math.floor(cell / cols) - gy);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };

  const g = new Float64Array(cols * rows).fill(Infinity);
  const parent = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const open = new MinHeap();
  g[start] = 0;
  open.push(start, h(start));

  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goal) {
      const cells = [cur];
      for (let c = parent[cur]; c >= 0; c = parent[c]) cells.push(c);
      return cells.reverse();
    }
    if (closed[cur]) continue;
    closed[cur] = 1;

    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
    for (const [dx, dy, cost] of MOVES) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = ny * cols + nx;
      if (blocked[next] || closed[next]) continue;
      // No cutting corners past blocked cells on diagonal moves.
      if (dx && dy && (blocked[cy * cols + nx] || blocked[ny * cols + cx])) {
        continue;
      }
      const score = g[cur] + cost;
      if (score < g[next]) {
        g[next] = score;
        parent[next] = cur;
        open.push(next, score + h(next));
      }
    }
  }
  return null;
}

// Greedily drop waypoints that have a clear straight line to an earlier one.
function shortcut(grid: OccupancyGrid, points: Vec2[]): Vec2[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  let anchor = points[0];
  for (let i = 2; i < points.length; i++) {
    if (!grid.lineOfSight(anchor, points[i])) {
      anchor = points[i - 1];
      out.push(anchor);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const SMOOTH_ITERATIONS = 5;

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Cut corner `b` with a chord, shrinking the cut until the chord is clear; keeps `b` if none fit.
function cutCorner(grid: OccupancyGrid, a: Vec2, b: Vec2, c: Vec2): Vec2[] {
  for (let t = 0.25; t > 0.02; t /= 2) {
    const q = lerp(b, a, t);
    const r = lerp(b, c, t);
    if (grid.lineOfSight(q, r)) return [q, r];
  }
  return [b];
}

// Chaikin corner cutting (converges to a quadratic B-spline) that never enters blocked cells.
function smooth(grid: OccupancyGrid, points: Vec2[]): Vec2[] {
  for (let n = 0; n < SMOOTH_ITERATIONS && points.length > 2; n++) {
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      out.push(...cutCorner(grid, points[i - 1], points[i], points[i + 1]));
    }
    out.push(points[points.length - 1]);
    points = out;
  }
  return points;
}

// Waypoints (excluding `start`) keeping the robot centre at least `clearance` from every obstacle.
// If `goal` is blocked, plans to the nearest reachable free cell instead. Returns null if no path exists.
export function planPath(
  obstacles: Obstacles,
  start: Vec2,
  goal: Vec2,
  clearance: number,
): Vec2[] | null {
  const grid = new OccupancyGrid(obstacles, clearance);
  const from = grid.cellAt(start);
  const goalCell = grid.cellAt(goal);
  const to = grid.nearestFree(goalCell);
  if (to < 0) return null;

  const cells = aStar(grid, from, to);
  if (!cells) return null;

  const points = cells.map((cell) => grid.centreOf(cell));
  points[0] = { ...start };
  if (to === goalCell) points.push({ ...goal });
  return smooth(grid, shortcut(grid, points)).slice(1);
}
