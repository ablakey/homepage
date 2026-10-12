import {
  distanceInside,
  distanceToRect,
  inflateRect,
  type Vec2,
} from "./geometry";
import { aStar, breadthFirstSearch, type Neighbours } from "./graphSearch";
import type { Obstacles } from "./obstacles";
import {
  shortcut,
  smoothPath,
  type FreeSpace,
  type SmoothingOptions,
} from "./pathSmoothing";
import type { SlamGrid } from "./slam";

export interface PlannerOptions extends SmoothingOptions {
  // Minimum distance from the robot centre to any obstacle.
  clearance: number;
}

export interface Plan {
  // Waypoints (excluding the start), all within mapped space.
  path: Vec2[];
  // Set when the path stops short of the goal: the first unmapped point on the way, for the robot to face and scan.
  lookAt: Vec2 | null;
}

// Plans on the map's own cells. A cell is blocked if its centre lies within `clearance` of an obstacle or the map edge.
// Routes optimistically through unmapped cells, then drives only the mapped prefix; replan as the map grows.
export class Planner {
  private readonly map: SlamGrid;
  private readonly obstacles: Obstacles;
  private readonly options: PlannerOptions;
  private blocked = new Uint8Array(0);

  constructor(map: SlamGrid, obstacles: Obstacles, options: PlannerOptions) {
    this.map = map;
    this.obstacles = obstacles;
    this.options = options;
  }

  // Call whenever the obstacles or the map's bounds change.
  refresh(): void {
    const { map, obstacles } = this;
    const { clearance } = this.options;
    this.blocked = new Uint8Array(map.cellCount);
    for (let cell = 0; cell < map.cellCount; cell++) {
      if (distanceInside(map.centreOf(cell), map.bounds) < clearance) {
        this.blocked[cell] = 1;
      }
    }
    for (const rect of obstacles.rects) {
      for (const cell of map.cellsNear(inflateRect(rect, clearance))) {
        if (distanceToRect(map.centreOf(cell), rect) < clearance) {
          this.blocked[cell] = 1;
        }
      }
    }
  }

  // If `goal` is blocked, plans to the nearest free cell instead. Returns null if no path exists.
  plan(start: Vec2, goal: Vec2): Plan | null {
    const { map } = this;
    const from = map.cellAt(start);
    const goalCell = map.cellAt(goal);
    if (from < 0 || goalCell < 0) return null;
    // A cell centre can be nearer an obstacle than a clear goal point inside it.
    const to = this.obstacles.isClear(goal, this.options.clearance)
      ? goalCell
      : breadthFirstSearch(
          map.cellCount,
          goalCell,
          map.neighbours,
          (c) => !this.blocked[c],
        );
    if (to < 0) return null;

    // The start and goal cells stay passable: their exact points are clear even when their centres aren't.
    const passable = (c: number) =>
      c >= 0 && (!this.blocked[c] || c === from || c === to);
    const cells = aStar(map.cellCount, from, to, this.edges(passable), (c) =>
      map.distance(c, to),
    );
    if (!cells) return null;

    const unknownAt = cells.findIndex((c, i) => i > 0 && !map.isKnown(c));
    const points = (unknownAt < 0 ? cells : cells.slice(0, unknownAt)).map(
      (c) => map.centreOf(c),
    );
    points[0] = { ...start };
    if (unknownAt < 0 && to === goalCell) points.push({ ...goal });

    const space = this.freeSpace(
      (c) => passable(c) && (c === from || map.isKnown(c)),
    );
    return {
      path: smoothPath(space, shortcut(space, points), this.options).slice(1),
      lookAt: unknownAt < 0 ? null : map.centreOf(cells[unknownAt]),
    };
  }

  // Nearest point (by path distance through mapped free cells) satisfying `isTarget`, or null if none is reachable.
  findReachable(start: Vec2, isTarget: (p: Vec2) => boolean): Vec2 | null {
    const { map } = this;
    const from = map.cellAt(start);
    if (from < 0) return null;
    const drivable = (c: number) => !this.blocked[c] && map.isKnown(c);
    const cell = breadthFirstSearch(
      map.cellCount,
      from,
      this.edges(drivable),
      (c) => isTarget(map.centreOf(c)),
    );
    return cell < 0 ? null : map.centreOf(cell);
  }

  private edges(passable: (cell: number) => boolean): Neighbours {
    return (cell, visit) =>
      this.map.neighbours(cell, (next) => {
        if (passable(next)) visit(next);
      });
  }

  private freeSpace(passable: (cell: number) => boolean): FreeSpace {
    const { map } = this;
    return {
      isFree: (p) => passable(map.cellAt(p)),
      lineOfSight: (a, b) => {
        for (const cell of map.traverse(a, b)) {
          if (!passable(cell)) return false;
        }
        return true;
      },
    };
  }
}
