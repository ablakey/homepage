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

// Euclidean distance from a point to the nearest point of a rect (0 if inside).
export function distanceToRect(p: Vec2, rect: Rect): number {
  const dx = Math.max(rect.x - p.x, 0, p.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - p.y, 0, p.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}
