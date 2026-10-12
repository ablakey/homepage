import {
  distanceInside,
  distanceToRect,
  rayAabb,
  type Rect,
  type Vec2,
} from "./geometry";

// Static boxes (text ink, images) and the world bounds, in world coordinates. Shared by the lidar and the path planner.
export class Obstacles {
  bounds: Rect;
  rects: readonly Rect[];

  constructor(
    bounds: Rect = { x: 0, y: 0, width: 0, height: 0 },
    rects: readonly Rect[] = [],
  ) {
    this.bounds = bounds;
    this.rects = rects;
  }

  // Whether `p` is at least `clearance` from every rect and inside the bounds by that much.
  isClear(p: Vec2, clearance: number): boolean {
    return (
      distanceInside(p, this.bounds) >= clearance &&
      this.rects.every((r) => distanceToRect(p, r) >= clearance)
    );
  }

  // Distance to the first rect hit, or to the bounds edge if none. Brute force; fine for a few thousand boxes at 100 rays/s.
  castRay(origin: Vec2, angle: number): number {
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    let distance = Math.max(0, rayAabb(origin, dir, this.bounds)?.far ?? 0);
    for (const rect of this.rects) {
      const span = rayAabb(origin, dir, rect);
      // Ignore rects the origin is inside of (near < 0).
      if (span && span.near >= 0 && span.near < distance) {
        distance = span.near;
      }
    }
    return distance;
  }
}
