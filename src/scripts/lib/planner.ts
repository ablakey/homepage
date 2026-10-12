import type { Vec2 } from "./geometry";
import { aStar, breadthFirstSearch } from "./graphSearch";
import type { Obstacles } from "./obstacles";
import { OccupancyGrid } from "./occupancyGrid";
import { shortcut, smoothPath, type SmoothingOptions } from "./pathSmoothing";

export interface PlannerOptions extends SmoothingOptions {
  // Occupancy grid resolution.
  cellSize: number;
  // Minimum distance from the robot centre to any obstacle.
  clearance: number;
}

// Nearest point (by path distance through mapped free space) satisfying `isTarget`, or null if none is reachable.
export function findReachable(
  obstacles: Obstacles,
  isKnown: (p: Vec2) => boolean,
  start: Vec2,
  isTarget: (p: Vec2) => boolean,
  { clearance, cellSize }: PlannerOptions,
): Vec2 | null {
  const grid = new OccupancyGrid(obstacles, clearance, cellSize);
  const from = grid.cellAt(start);
  grid.blockUnknown(isKnown, from);
  const cell = breadthFirstSearch(
    grid.cellCount,
    from,
    grid.freeAdjacent,
    (c) => isTarget(grid.centreOf(c)),
  );
  return cell < 0 ? null : grid.centreOf(cell);
}

export interface Plan {
  // Waypoints (excluding the start), all within mapped space.
  path: Vec2[];
  // Set when the path stops short of the goal: the first unmapped point on the way, for the robot to face and scan.
  lookAt: Vec2 | null;
}

// Keeps the robot centre at least `options.clearance` from every obstacle and inside cells where `isKnown` holds.
// Routes optimistically through unmapped space, then drives only the mapped prefix; replan as the map grows.
// If `goal` is blocked, plans to the nearest reachable free cell instead. Returns null if no path exists.
export function planPath(
  obstacles: Obstacles,
  isKnown: (p: Vec2) => boolean,
  start: Vec2,
  goal: Vec2,
  options: PlannerOptions,
): Plan | null {
  const grid = new OccupancyGrid(
    obstacles,
    options.clearance,
    options.cellSize,
  );
  const from = grid.cellAt(start);
  const goalCell = grid.cellAt(goal);
  const to = grid.nearestFree(goalCell);
  if (to < 0) return null;

  const cells = aStar(grid.cellCount, from, to, grid.freeMoves, (c) =>
    grid.octileDistance(c, to),
  );
  if (!cells) return null;

  const unknownAt = cells.findIndex(
    (cell, i) => i > 0 && !isKnown(grid.centreOf(cell)),
  );
  const points = (unknownAt < 0 ? cells : cells.slice(0, unknownAt)).map(
    (cell) => grid.centreOf(cell),
  );
  points[0] = { ...start };
  if (unknownAt < 0 && to === goalCell) points.push({ ...goal });

  // Shortcuts and smoothing must not stray into unmapped cells either.
  grid.blockUnknown(isKnown, from);
  return {
    path: smoothPath(grid, shortcut(grid, points), options).slice(1),
    lookAt: unknownAt < 0 ? null : grid.centreOf(cells[unknownAt]),
  };
}
