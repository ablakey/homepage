export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Pose {
  position: Vec2;
  // Radians; 0 faces +x (right), positive rotates clockwise in screen space.
  heading: number;
}

export interface RayHit {
  point: Vec2;
  distance: number;
  // null when the ray reached the world bounds without hitting a rect.
  rect: Rect | null;
}

// Parametric [entry, exit] interval of a ray along one axis slab.
function slab(origin: number, dir: number, min: number, max: number) {
  if (dir === 0) {
    return origin < min || origin > max
      ? { near: Infinity, far: -Infinity }
      : { near: -Infinity, far: Infinity };
  }
  const t1 = (min - origin) / dir;
  const t2 = (max - origin) / dir;
  return t1 < t2 ? { near: t1, far: t2 } : { near: t2, far: t1 };
}

// Slab-method ray vs AABB. Returns entry/exit distances along `dir` (unit vector), or null on miss.
export function rayAabb(
  origin: Vec2,
  dir: Vec2,
  rect: Rect,
): { near: number; far: number } | null {
  const sx = slab(origin.x, dir.x, rect.x, rect.x + rect.width);
  const sy = slab(origin.y, dir.y, rect.y, rect.y + rect.height);
  const near = Math.max(sx.near, sy.near);
  const far = Math.min(sx.far, sy.far);
  return near <= far && far >= 0 ? { near, far } : null;
}

export class CollisionWorld {
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
