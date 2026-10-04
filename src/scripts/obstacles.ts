import { rayAabb, type RayHit, type Rect, type Vec2 } from "./collision";

// Static boxes (text ink) and the world bounds, in document coordinates. Shared by the lidar and the path planner.
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

  // Brute force over all rects; fine for a few thousand boxes at 100 rays/s.
  castRay(origin: Vec2, angle: number): RayHit {
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    let distance = Math.max(0, rayAabb(origin, dir, this.bounds)?.far ?? 0);
    let hitRect: Rect | null = null;

    for (const rect of this.rects) {
      const span = rayAabb(origin, dir, rect);
      // Ignore rects the origin is inside of (near < 0).
      if (span && span.near >= 0 && span.near < distance) {
        distance = span.near;
        hitRect = rect;
      }
    }

    return {
      point: { x: origin.x + dir.x * distance, y: origin.y + dir.y * distance },
      distance,
      rect: hitRect,
    };
  }
}
