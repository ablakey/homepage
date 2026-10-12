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

export const distance = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Direction of travel from `a` to `b`, in the same convention as Pose.heading.
export const headingTo = (a: Vec2, b: Vec2) => Math.atan2(b.y - a.y, b.x - a.x);

// Normalises an angle to [-π, π].
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const inflateRect = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  width: r.width + 2 * by,
  height: r.height + 2 * by,
});

export const containsRect = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

// Distance from `p` to the nearest edge of `rect`; negative when `p` lies outside.
export const distanceInside = (p: Vec2, rect: Rect) =>
  Math.min(
    p.x - rect.x,
    rect.x + rect.width - p.x,
    p.y - rect.y,
    rect.y + rect.height - p.y,
  );

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
